import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import DATA_DIR, DOCS_DIR, SHEETS_DIR, SLIDES_DIR, UPLOADS_DIR
from app.models.document import DocumentCreate, DocumentMeta, DocumentResponse, DocumentUpdate

TYPE_TO_DIR = {
    "doc": DOCS_DIR,
    "sheet": SHEETS_DIR,
    "slide": SLIDES_DIR,
    "pdf": UPLOADS_DIR,
}

class StorageService:
    @staticmethod
    def _get_dir_for_type(doc_type: str) -> Path:
        return TYPE_TO_DIR.get(doc_type, DATA_DIR / f"{doc_type}s")

    @staticmethod
    def _find_file_path(doc_id: str, doc_type: Optional[str] = None) -> Optional[Path]:
        if doc_type and doc_type in TYPE_TO_DIR:
            candidate = TYPE_TO_DIR[doc_type] / f"{doc_id}.json"
            if candidate.exists():
                return candidate
        # Search all directories
        for target_dir in [DOCS_DIR, SHEETS_DIR, SLIDES_DIR, UPLOADS_DIR]:
            candidate = target_dir / f"{doc_id}.json"
            if candidate.exists():
                return candidate
            # also check if it's an uploaded raw file
            for f in target_dir.glob(f"{doc_id}.*"):
                if f.is_file():
                    return f
        return None

    @classmethod
    def list_documents(cls, doc_type: Optional[str] = None, search_query: Optional[str] = None, in_trash: bool = False) -> List[DocumentMeta]:
        results: List[DocumentMeta] = []
        directories = [cls._get_dir_for_type(doc_type)] if doc_type and doc_type in TYPE_TO_DIR else [DOCS_DIR, SHEETS_DIR, SLIDES_DIR, UPLOADS_DIR]

        for target_dir in directories:
            if not target_dir.exists():
                continue
            for file_path in target_dir.glob("*.json"):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        doc_is_trash = bool(data.get("is_trash", False))
                        if doc_is_trash != in_trash:
                            continue

                        meta = DocumentMeta(
                            id=data.get("id", file_path.stem),
                            title=data.get("title", file_path.stem),
                            type=data.get("type", "doc"),
                            created_at=data.get("created_at", datetime.now().isoformat()),
                            updated_at=data.get("updated_at", datetime.now().isoformat()),
                            size_bytes=file_path.stat().st_size,
                            tags=data.get("tags", []),
                            is_trash=doc_is_trash,
                            deleted_at=data.get("deleted_at")
                        )
                        if search_query:
                            query_lower = search_query.lower()
                            if query_lower not in meta.title.lower() and not any(query_lower in t.lower() for t in meta.tags):
                                continue
                        results.append(meta)
                except Exception:
                    continue

            # Also check raw uploaded PDFs (only if not viewing trash)
            if not in_trash and doc_type in (None, "pdf"):
                for pdf_file in UPLOADS_DIR.glob("*.pdf"):
                    stat = pdf_file.stat()
                    results.append(DocumentMeta(
                        id=pdf_file.name,
                        title=pdf_file.name,
                        type="pdf",
                        created_at=datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        updated_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        size_bytes=stat.st_size,
                        tags=["pdf", "upload"],
                        is_trash=False
                    ))

        # Sort by updated_at descending
        results.sort(key=lambda x: x.updated_at, reverse=True)
        return results

    @classmethod
    def create_document(cls, payload: DocumentCreate) -> DocumentResponse:
        doc_id = str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()
        target_dir = cls._get_dir_for_type(payload.type)
        target_dir.mkdir(parents=True, exist_ok=True)

        doc_data = {
            "id": doc_id,
            "title": payload.title or f"Tài liệu không tên ({payload.type.upper()})",
            "type": payload.type,
            "created_at": now,
            "updated_at": now,
            "content": payload.content if payload.content is not None else cls._get_default_content(payload.type),
            "tags": payload.tags,
        }

        file_path = target_dir / f"{doc_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(doc_data, f, ensure_ascii=False, indent=2)

        return DocumentResponse(**doc_data)

    @classmethod
    def get_document(cls, doc_id: str, doc_type: Optional[str] = None) -> Optional[DocumentResponse]:
        file_path = cls._find_file_path(doc_id, doc_type)
        if not file_path or not file_path.suffix == ".json":
            return None

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return DocumentResponse(**data)

    @classmethod
    def update_document(cls, doc_id: str, payload: DocumentUpdate, doc_type: Optional[str] = None) -> Optional[DocumentResponse]:
        file_path = cls._find_file_path(doc_id, doc_type)
        if not file_path or not file_path.suffix == ".json":
            return None

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if payload.title is not None:
            data["title"] = payload.title
        if payload.content is not None:
            data["content"] = payload.content
        if payload.tags is not None:
            data["tags"] = payload.tags
        data["updated_at"] = datetime.now().isoformat()

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return DocumentResponse(**data)

    @classmethod
    def delete_document(cls, doc_id: str, doc_type: Optional[str] = None, permanent: bool = False) -> bool:
        file_path = cls._find_file_path(doc_id, doc_type)
        if not file_path:
            return False
        try:
            if permanent or file_path.suffix.lower() == ".pdf":
                file_path.unlink()
                return True
            else:
                # Soft delete: mark is_trash = True
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                data["is_trash"] = True
                data["deleted_at"] = datetime.now().isoformat()
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                return True
        except Exception:
            return False

    @classmethod
    def restore_document(cls, doc_id: str, doc_type: Optional[str] = None) -> bool:
        file_path = cls._find_file_path(doc_id, doc_type)
        if not file_path:
            return False
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            data["is_trash"] = False
            data["deleted_at"] = None
            data["updated_at"] = datetime.now().isoformat()
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False

    @classmethod
    def empty_trash(cls) -> int:
        count = 0
        for target_dir in [DOCS_DIR, SHEETS_DIR, SLIDES_DIR]:
            if not target_dir.exists():
                continue
            for file_path in target_dir.glob("*.json"):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if data.get("is_trash", False):
                        file_path.unlink()
                        count += 1
                except Exception:
                    continue
        return count

    @classmethod
    def duplicate_document(cls, doc_id: str) -> Optional[DocumentResponse]:
        existing = cls.get_document(doc_id)
        if not existing:
            return None
        new_payload = DocumentCreate(
            title=f"{existing.title} (Bản sao)",
            type=existing.type,
            content=existing.content,
            tags=list(existing.tags)
        )
        return cls.create_document(new_payload)

    @staticmethod
    def _get_default_content(doc_type: str) -> Any:
        if doc_type == "doc":
            return {
                "html": "<h2>Chào mừng đến với NovaDoc!</h2><p>Bắt đầu nhập nội dung của bạn tại đây hoặc chọn các mẫu có sẵn trên thanh công cụ.</p>"
            }
        elif doc_type == "sheet":
            return {
                "activeSheet": "Trang tính 1",
                "sheets": {
                    "Trang tính 1": {
                        "data": {
                            "A1": {"value": "Mục", "bold": True, "bg": "#f1f5f9"},
                            "B1": {"value": "Doanh Thu", "bold": True, "bg": "#f1f5f9"},
                            "C1": {"value": "Chi Phí", "bold": True, "bg": "#f1f5f9"},
                            "D1": {"value": "Lợi Nhuận", "bold": True, "bg": "#f1f5f9"},
                            "A2": {"value": "Tháng 1"},
                            "B2": {"value": 15000},
                            "C2": {"value": 9000},
                            "D2": {"formula": "=B2-C2"},
                            "A3": {"value": "Tháng 2"},
                            "B3": {"value": 22000},
                            "C3": {"value": 11000},
                            "D3": {"formula": "=B3-C3"},
                            "A4": {"value": "Tổng cộng", "bold": True},
                            "B4": {"formula": "=SUM(B2:B3)", "bold": True},
                            "C4": {"formula": "=SUM(C2:C3)", "bold": True},
                            "D4": {"formula": "=SUM(D2:D3)", "bold": True, "color": "#16a34a"},
                        }
                    }
                }
            }
        elif doc_type == "slide":
            return {
                "theme": "modern-dark",
                "slides": [
                    {
                        "id": "slide-1",
                        "title": "Báo Cáo Dự Án NovaOffice",
                        "subtitle": "Giải pháp ứng dụng văn phòng thế hệ mới",
                        "layout": "title-slide",
                        "content": "Chào mừng bạn đến với công cụ trình bày bài thuyết trình trực quan."
                    },
                    {
                        "id": "slide-2",
                        "title": "Tính Năng Nổi Bật",
                        "layout": "bullet-list",
                        "bullets": [
                            "Soạn thảo văn bản chuẩn chỉnh",
                            "Bảng tính & công thức thời gian thực",
                            "Thiết kế slide trình diễn toàn màn hình",
                            "Xuất file đa định dạng chuẩn (.docx, .xlsx, .pptx)"
                        ]
                    }
                ]
            }
        return {}
