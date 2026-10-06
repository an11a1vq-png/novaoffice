import io
import os
import sys
import shutil
import urllib.parse
import base64
import re
import time
import asyncio
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response, StreamingResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.config import STATIC_DIR, UPLOADS_DIR
from app.models.document import (
    DocumentCreate,
    DocumentMeta,
    DocumentResponse,
    DocumentUpdate,
    ExportDocxRequest,
    ExportXlsxRequest,
    ExportPptxRequest,
    AIChatRequest,
    AIDocAssistRequest,
    AISheetFormulaRequest,
    AISlideGenerateRequest,
    AIFullDocFixRequest,
    AISheetAssistRequest,
)
from app.services.ai_service import AIService
from app.services.docx_service import DocxService
from app.services.pdf_service import PdfService
from app.services.pptx_service import PptxService
from app.services.storage import StorageService
from app.services.xlsx_service import XlsxService

app = FastAPI(title="NovaOffice API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directory
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

from app.config import BASE_DIR, STATIC_DIR, UPLOADS_DIR

# ----------------- Page Routes -----------------
@app.get("/", response_class=HTMLResponse)
async def serve_workspace():
    return FileResponse(STATIC_DIR / "workspace.html")

@app.get("/workspace", response_class=HTMLResponse)
async def serve_workspace_alias():
    return FileResponse(STATIC_DIR / "workspace.html")

@app.get("/hub", response_class=HTMLResponse)
async def serve_hub():
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/doc", response_class=HTMLResponse)
async def serve_doc():
    return FileResponse(STATIC_DIR / "doc.html")

@app.get("/sheet", response_class=HTMLResponse)
async def serve_sheet():
    return FileResponse(STATIC_DIR / "sheet.html")

@app.get("/slide", response_class=HTMLResponse)
async def serve_slide():
    return FileResponse(STATIC_DIR / "slide.html")

@app.get("/pdf", response_class=HTMLResponse)
async def serve_pdf():
    return FileResponse(STATIC_DIR / "pdf.html")

@app.post("/api/system/open-window")
async def open_new_window():
    """Spawns an independent desktop window instance."""
    try:
        import subprocess
        if getattr(sys, "frozen", False):
            exe_path = sys.executable
            subprocess.Popen([exe_path], close_fds=True)
        else:
            desktop_py = BASE_DIR / "desktop.py"
            subprocess.Popen([sys.executable, str(desktop_py)], close_fds=True)
        return {"status": "ok", "message": "Đang mở cửa sổ mới..."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ----------------- Document REST APIs -----------------
@app.get("/api/documents", response_model=List[DocumentMeta])
async def list_documents(type: Optional[str] = None, search: Optional[str] = None, trash: bool = False):
    return StorageService.list_documents(doc_type=type, search_query=search, in_trash=trash)

@app.post("/api/documents", response_model=DocumentResponse)
async def create_document(doc: DocumentCreate):
    return StorageService.create_document(doc)

@app.get("/api/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, type: Optional[str] = None):
    document = StorageService.get_document(doc_id, doc_type=type)
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
    return document

@app.put("/api/documents/{doc_id}", response_model=DocumentResponse)
async def update_document(doc_id: str, doc_update: DocumentUpdate, type: Optional[str] = None):
    document = StorageService.update_document(doc_id, doc_update, doc_type=type)
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu để cập nhật")
    return document

@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str, type: Optional[str] = None, permanent: bool = False):
    success = StorageService.delete_document(doc_id, doc_type=type, permanent=permanent)
    if not success:
        raise HTTPException(status_code=404, detail="Không thể xóa tài liệu")
    return {"message": "Đã xóa tài liệu thành công"}

@app.post("/api/documents/{doc_id}/restore")
async def restore_document(doc_id: str, type: Optional[str] = None):
    success = StorageService.restore_document(doc_id, doc_type=type)
    if not success:
        raise HTTPException(status_code=404, detail="Không thể khôi phục tài liệu")
    return {"message": "Đã khôi phục tài liệu thành công"}

@app.post("/api/documents/trash/empty")
async def empty_trash():
    count = StorageService.empty_trash()
    return {"message": f"Đã dọn sạch {count} tài liệu trong thùng rác"}

@app.post("/api/documents/{doc_id}/duplicate", response_model=DocumentResponse)
async def duplicate_document(doc_id: str):
    duplicated = StorageService.duplicate_document(doc_id)
    if not duplicated:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu gốc để nhân bản")
    return duplicated

# ----------------- Exporters -----------------
@app.post("/api/export/docx")
async def export_docx(req: ExportDocxRequest):
    buffer = DocxService.html_to_docx(req.html_content, req.title)
    encoded_filename = urllib.parse.quote(f"{req.title}.docx")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

@app.post("/api/export/xlsx")
async def export_xlsx(req: ExportXlsxRequest):
    data_dict = {"sheets": {name: {"data": {f"{chr(65+c)}{r+1}": {"value": cell} for r, row in enumerate(matrix) for c, cell in enumerate(row)}} for name, matrix in req.sheets.items()}}
    buffer = XlsxService.export_to_xlsx(data_dict, req.title)
    encoded_filename = urllib.parse.quote(f"{req.title}.xlsx")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

@app.post("/api/export/sheet-raw")
async def export_sheet_raw(data: dict):
    title = data.get("title", "Bang_Tinh")
    buffer = XlsxService.export_to_xlsx(data, title)
    encoded_filename = urllib.parse.quote(f"{title}.xlsx")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

@app.post("/api/export/pptx")
async def export_pptx(req: ExportPptxRequest):
    deck_dict = {"slides": req.slides, "theme": "modern-dark"}
    buffer = PptxService.export_to_pptx(deck_dict, req.title)
    encoded_filename = urllib.parse.quote(f"{req.title}.pptx")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

@app.post("/api/export/slide-raw")
async def export_slide_raw(deck_data: dict):
    title = deck_data.get("title", "Bai_Thuyet_Trinh")
    buffer = PptxService.export_to_pptx(deck_data, title)
    encoded_filename = urllib.parse.quote(f"{title}.pptx")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

@app.post("/api/export/pdf")
async def export_pdf(data: dict):
    title = data.get("title", "Tai_Lieu")
    html_content = data.get("html_content", "")
    buffer = PdfService.html_to_pdf(html_content, title)
    encoded_filename = urllib.parse.quote(f"{title}.pdf")
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

def prompt_windows_save_as(title: str, ext: str, file_desc: str) -> Optional[Path]:
    """
    Opens native Windows 'Save As' file dialog.
    Must be executed in a separate worker thread.
    """
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        root.focus_force()

        initial_dir = str(Path(os.environ.get("USERPROFILE", Path.home())) / "Downloads")
        clean_title = re.sub(r'[\\/*?:"<>|]', "", title).strip() or "Tai_Lieu"

        selected_path = filedialog.asksaveasfilename(
            parent=root,
            initialdir=initial_dir,
            initialfile=f"{clean_title}.{ext}",
            title=f"Lưu {file_desc} - NovaOffice",
            defaultextension=f".{ext}",
            filetypes=[(file_desc, f"*.{ext}"), ("Tất cả các tệp", "*.*")]
        )
        root.destroy()

        if selected_path:
            return Path(selected_path)
        return None
    except Exception as e:
        clean_title = re.sub(r'[\\/*?:"<>|]', "", title).strip() or "Tai_Lieu"
        downloads_dir = Path(os.environ.get("USERPROFILE", Path.home())) / "Downloads"
        return downloads_dir / f"{clean_title}.{ext}"

@app.post("/api/export/save-as")
async def export_save_as(data: dict):
    """
    Handles user export with native Windows Save As dialog.
    Saves directly to user-chosen path, keeps a copy in uploads, and returns paths.
    """
    file_type = data.get("type", "pdf").lower()
    title = data.get("title", "Tai_Lieu").strip() or "Tai_Lieu"
    html_content = data.get("html_content", "")
    explicit_target = data.get("target_path")
    skip_dialog = data.get("skip_dialog", False)

    type_meta = {
        "pdf": ("pdf", "Tệp PDF (*.pdf)"),
        "annotated_pdf": ("pdf", "Tệp PDF (*.pdf)"),
        "docx": ("docx", "Tệp Microsoft Word (*.docx)"),
        "xlsx": ("xlsx", "Tệp Microsoft Excel (*.xlsx)"),
        "pptx": ("pptx", "Tệp Microsoft PowerPoint (*.pptx)")
    }

    ext, desc = type_meta.get(file_type, ("pdf", "Tệp PDF (*.pdf)"))

    # Determine save path
    if explicit_target:
        target_path = Path(explicit_target)
    elif skip_dialog:
        clean_title = re.sub(r'[\\/*?:"<>|]', "", title).strip() or "Tai_Lieu"
        target_path = Path(os.environ.get("USERPROFILE", Path.home())) / "Downloads" / f"{clean_title}.{ext}"
    else:
        target_path = await asyncio.to_thread(prompt_windows_save_as, title, ext, desc)
        if not target_path:
            return {"status": "cancelled", "message": "Đã hủy thao tác lưu"}

    # Generate buffer based on type
    try:
        if file_type == "pdf":
            buffer = PdfService.html_to_pdf(html_content, title)
        elif file_type == "annotated_pdf":
            images = data.get("images", [])
            if not images:
                raise HTTPException(status_code=400, detail="Không có hình ảnh để lưu PDF")
            buffer = PdfService.images_to_pdf(images)
        elif file_type == "docx":
            buffer = DocxService.html_to_docx(html_content, title)
        elif file_type == "xlsx":
            sheets_data = data.get("sheets", {})
            buffer = XlsxService.export_to_xlsx(data if "sheets" in data else {"sheets": sheets_data}, title)
        elif file_type == "pptx":
            slide_data = data.get("slides", [])
            theme = data.get("theme", "modern-dark")
            buffer = PptxService.export_to_pptx(data if "slides" in data else {"slides": slide_data, "theme": theme}, title)
        else:
            raise HTTPException(status_code=400, detail=f"Loại tệp không hỗ trợ: {file_type}")

        # Ensure directory exists and write
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(buffer.getvalue())

        # Also write a copy into UPLOADS_DIR for local app reference
        upload_copy = UPLOADS_DIR / target_path.name
        with open(upload_copy, "wb") as f:
            f.write(buffer.getvalue())

        return {
            "status": "ok",
            "file_name": target_path.name,
            "path": str(target_path.resolve()),
            "folder": str(target_path.parent.resolve()),
            "url": f"/api/uploads/{urllib.parse.quote(target_path.name)}",
            "message": f"Đã lưu thành công {target_path.name}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu tệp: {str(e)}")

@app.post("/api/pdf/convert-to-doc")
async def convert_pdf_to_doc(data: dict):
    """
    Converts a PDF file (by uploaded filename or base64 payload) into an editable NovaDoc document.
    """
    file_name = data.get("file_name", "")
    pdf_data_b64 = data.get("pdf_data", "")

    if file_name:
        target = UPLOADS_DIR / file_name
        if not target.exists():
            raise HTTPException(status_code=404, detail="Không tìm thấy tệp PDF trong hệ thống")
        with open(target, "rb") as f:
            pdf_bytes = f.read()
        title = Path(file_name).stem
    elif pdf_data_b64:
        if ',' in pdf_data_b64:
            pdf_data_b64 = pdf_data_b64.split(',', 1)[1]
        pdf_bytes = base64.b64decode(pdf_data_b64)
        title = data.get("title", "Tài liệu chuyển đổi từ PDF")
    else:
        raise HTTPException(status_code=400, detail="Thiếu thông tin tệp PDF cần chuyển đổi")

    try:
        html = PdfService.pdf_to_html(pdf_bytes)
        doc = StorageService.create_document(DocumentCreate(
            title=f"{title} (Soạn thảo)",
            type="doc",
            content={"html": html},
            tags=["chuyển_đổi", "pdf", "word"]
        ))
        return {
            "status": "ok",
            "doc_id": doc.id,
            "title": doc.title,
            "redirect": f"/doc?id={doc.id}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi trích xuất tài liệu PDF: {str(e)}")

@app.post("/api/pdf/save-annotated")
async def save_annotated_pdf(data: dict):
    """
    Compiles flattened page images into a multi-page PDF document and saves to uploads.
    """
    images = data.get("images", [])
    title = data.get("title", "Tai_Lieu_Da_Sua")
    if not images:
        raise HTTPException(status_code=400, detail="Không có dữ liệu trang để lưu")

    try:
        pdf_buffer = PdfService.images_to_pdf(images)
        clean_title = re.sub(r'[^\w\s-]', '', title).strip().replace(' ', '_') or "Tai_Lieu_Da_Sua"
        new_filename = f"{clean_title}_edited_{int(time.time())}.pdf"
        target_path = UPLOADS_DIR / new_filename

        with open(target_path, "wb") as f:
            f.write(pdf_buffer.getvalue())

        return {
            "status": "ok",
            "file_name": new_filename,
            "path": str(target_path.resolve()),
            "url": f"/api/uploads/{urllib.parse.quote(new_filename)}",
            "redirect": f"/pdf?file={urllib.parse.quote(new_filename)}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu tệp PDF chỉnh sửa: {str(e)}")

@app.post("/api/pdf/save-overwrite")
async def save_overwrite_pdf(data: dict):
    """
    Overwrites the existing PDF file directly in UPLOADS_DIR.
    """
    images = data.get("images", [])
    filename = data.get("file_name", "").strip()
    if not images:
        raise HTTPException(status_code=400, detail="Không có dữ liệu trang để lưu")
    if not filename:
        raise HTTPException(status_code=400, detail="Tên tệp không hợp lệ để lưu đè")

    try:
        pdf_buffer = PdfService.images_to_pdf(images)
        target_path = UPLOADS_DIR / filename

        with open(target_path, "wb") as f:
            f.write(pdf_buffer.getvalue())

        return {
            "status": "ok",
            "file_name": filename,
            "path": str(target_path.resolve()),
            "url": f"/api/uploads/{urllib.parse.quote(filename)}",
            "message": f"Đã lưu đè thành công tệp {filename}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu đè tệp PDF: {str(e)}")

@app.post("/api/system/show-in-folder")
async def show_in_folder(data: dict):
    """
    Opens Windows File Explorer and highlights the specified file or folder.
    """
    file_path = data.get("path")
    file_name = data.get("file_name")

    target = None
    if file_path and Path(file_path).exists():
        target = Path(file_path)
    elif file_name and (UPLOADS_DIR / file_name).exists():
        target = UPLOADS_DIR / file_name
    elif file_name and (DATA_DIR / "docs" / f"{file_name}.json").exists():
        target = DATA_DIR / "docs" / f"{file_name}.json"
    else:
        target = UPLOADS_DIR

    try:
        import subprocess
        if target.is_file():
            subprocess.Popen(["explorer.exe", f"/select,{target.resolve()}"])
        else:
            subprocess.Popen(["explorer.exe", str(target.resolve())])
        return {"status": "ok", "message": f"Đã mở thư mục chứa {target.name}", "folder": str(target.parent.resolve())}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/system/open-file")
async def open_file(data: dict):
    """
    Opens the specified file using Windows default application.
    """
    file_path = data.get("path")
    file_name = data.get("file_name")

    target = None
    if file_path and Path(file_path).exists():
        target = Path(file_path)
    elif file_name and (UPLOADS_DIR / file_name).exists():
        target = UPLOADS_DIR / file_name

    if target and target.is_file():
        try:
            os.startfile(str(target.resolve()))
            return {"status": "ok", "message": f"Đã mở {target.name}"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    return {"status": "error", "message": "Không tìm thấy tệp để mở"}

@app.get("/api/system/open-local")
async def open_local_file(path: str = Query(...)):
    """
    Imports and opens a local file on the user's system by absolute path,
    redirecting to the appropriate editor (doc, sheet, slide, pdf).
    """
    file_path = Path(path)
    if not file_path.exists() or not file_path.is_file():
        return RedirectResponse(url="/")

    ext = file_path.suffix.lower()
    filename = file_path.name
    with open(file_path, "rb") as f:
        content_bytes = f.read()

    if ext == ".docx":
        stream = io.BytesIO(content_bytes)
        html = DocxService.docx_to_html(stream)
        doc = StorageService.create_document(DocumentCreate(
            title=file_path.stem,
            type="doc",
            content={"html": html},
            tags=["local", "docx"]
        ))
        return RedirectResponse(url=f"/doc?id={doc.id}")

    elif ext in [".xlsx", ".xls"]:
        stream = io.BytesIO(content_bytes)
        sheet_data = XlsxService.import_from_xlsx(stream)
        doc = StorageService.create_document(DocumentCreate(
            title=file_path.stem,
            type="sheet",
            content=sheet_data,
            tags=["local", "xlsx"]
        ))
        return RedirectResponse(url=f"/sheet?id={doc.id}")

    elif ext in [".pptx", ".ppt"]:
        stream = io.BytesIO(content_bytes)
        slide_data = PptxService.import_from_pptx(stream)
        doc = StorageService.create_document(DocumentCreate(
            title=file_path.stem,
            type="slide",
            content=slide_data,
            tags=["local", "pptx"]
        ))
        return RedirectResponse(url=f"/slide?id={doc.id}")

    elif ext == ".pdf":
        target = UPLOADS_DIR / filename
        with open(target, "wb") as f:
            f.write(content_bytes)
        return RedirectResponse(url=f"/pdf?file={urllib.parse.quote(filename)}")

    elif ext in [".txt", ".md"]:
        text = content_bytes.decode("utf-8", errors="replace")
        paragraphs = "\n".join([f"<p>{p.strip()}</p>" for p in text.split("\n\n") if p.strip()])
        doc = StorageService.create_document(DocumentCreate(
            title=file_path.stem,
            type="doc",
            content={"html": paragraphs},
            tags=["local", ext[1:]]
        ))
        return RedirectResponse(url=f"/doc?id={doc.id}")

    return RedirectResponse(url="/")

# ----------------- File Import & Uploads -----------------
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_file"
    ext = Path(filename).suffix.lower()
    content_bytes = await file.read()

    if ext == ".docx":
        # Extract HTML from docx
        stream = io.BytesIO(content_bytes)
        html = DocxService.docx_to_html(stream)
        doc = StorageService.create_document(DocumentCreate(
            title=Path(filename).stem,
            type="doc",
            content={"html": html},
            tags=["imported", "docx"]
        ))
        return {"status": "ok", "redirect": f"/doc?id={doc.id}"}

    elif ext in [".xlsx", ".xls"]:
        stream = io.BytesIO(content_bytes)
        sheet_data = XlsxService.import_from_xlsx(stream)
        doc = StorageService.create_document(DocumentCreate(
            title=Path(filename).stem,
            type="sheet",
            content=sheet_data,
            tags=["imported", "xlsx"]
        ))
        return {"status": "ok", "redirect": f"/sheet?id={doc.id}"}

    elif ext == ".pdf":
        target = UPLOADS_DIR / filename
        with open(target, "wb") as f:
            f.write(content_bytes)
        return {"status": "ok", "redirect": f"/pdf?file={urllib.parse.quote(filename)}"}

    elif ext in [".txt", ".md"]:
        text = content_bytes.decode("utf-8", errors="ignore")
        paragraphs = "\n".join([f"<p>{p.strip()}</p>" for p in text.split("\n\n") if p.strip()])
        doc = StorageService.create_document(DocumentCreate(
            title=Path(filename).stem,
            type="doc",
            content={"html": paragraphs},
            tags=["imported", ext[1:]]
        ))
        return {"status": "ok", "redirect": f"/doc?id={doc.id}"}

    else:
        # Save to uploads
        target = UPLOADS_DIR / filename
        with open(target, "wb") as f:
            f.write(content_bytes)
        return {"status": "ok", "message": "Đã tải file lên", "filename": filename}

@app.get("/api/uploads/{filename}")
async def get_uploaded_file(filename: str):
    file_path = UPLOADS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File không tồn tại")
    return FileResponse(file_path)

# ----------------- Nova AI Endpoints -----------------
@app.get("/api/ai/status")
async def get_ai_status():
    is_alive = AIService.is_ollama_available()
    return {
        "status": "ready" if is_alive else "offline",
        "engine": "Ollama (qwen2.5:3b)",
        "mode": "100% Local Offline"
    }

@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest):
    reply = AIService.chat(user_message=req.message, history=req.history, context=req.context or "")
    return {"reply": reply}

@app.post("/api/ai/doc-assist")
async def ai_doc_assist(req: AIDocAssistRequest):
    result = AIService.doc_assist(
        action=req.action,
        text=req.text,
        user_instruction=req.user_instruction or "",
        context=req.context or ""
    )
    return {"result": result}

@app.post("/api/ai/sheet-formula")
async def ai_sheet_formula(req: AISheetFormulaRequest):
    res = AIService.sheet_formula(
        query=req.query,
        active_cell=req.active_cell or "A1",
        context=req.context or ""
    )
    return res

@app.post("/api/ai/slide-generate")
async def ai_slide_generate(req: AISlideGenerateRequest):
    deck = AIService.slide_generate(
        topic=req.topic,
        num_slides=req.num_slides or 3
    )
    return deck

@app.post("/api/ai/full-doc-fix")
async def ai_full_doc_fix(req: AIFullDocFixRequest):
    fixed_html = AIService.full_document_fix(req.html_content)
    return {
        "status": "ok",
        "fixed_html": fixed_html,
        "message": "Đã hoàn tất rà soát chính tả, ngữ pháp và định dạng toàn bộ tài liệu"
    }

@app.post("/api/ai/sheet-assist")
async def ai_sheet_assist(req: AISheetAssistRequest):
    if req.action == "formula":
        res = AIService.sheet_formula(query=req.query, active_cell=req.active_cell or "A1", context=req.context or "")
        return res
    else:
        # General sheet assist query
        res = AIService.chat(
            user_message=f"Hỗ trợ bảng tính: {req.query}",
            context=f"Ô hiện tại: {req.active_cell}\nDữ liệu: {req.context}"
        )
        return {"reply": res}

