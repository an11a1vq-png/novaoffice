import sys
import io
import os
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.services.storage import StorageService
from app.services.pptx_service import PptxService
from app.config import UPLOADS_DIR
from app.models.document import DocumentUpdate

client = TestClient(app)

class TestPhase6Improvements(unittest.TestCase):
    def setUp(self):
        self.created_files = []

    def tearDown(self):
        for f in self.created_files:
            try:
                p = Path(f)
                if p.exists():
                    p.unlink()
            except Exception:
                pass

    def test_pptx_upload_endpoint(self):
        """Verifies that POST /api/upload supports .pptx files and creates a slide document."""
        deck_data = {
            "title": "Slide Upload Test",
            "slides": [{"title": "Trang 1", "content": "Nội dung slide test", "layout": "standard"}]
        }
        pptx_buf = PptxService.export_to_pptx(deck_data, "Test_Upload")
        
        files = {
            "file": ("presentation_test.pptx", pptx_buf.getvalue(), "application/vnd.openxmlformats-officedocument.presentationml.presentation")
        }
        res = client.post("/api/upload", files=files)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertTrue(data.get("redirect", "").startswith("/slide?id="))

    def test_pdf_rename_in_storage(self):
        """Verifies that StorageService.update_document can rename raw uploaded PDF files."""
        sample_pdf = UPLOADS_DIR / "sample_temp_rename_test.pdf"
        sample_pdf.write_bytes(b"%PDF-1.4 sample content for rename test")
        self.created_files.append(str(sample_pdf))

        renamed_meta = StorageService.update_document("sample_temp_rename_test.pdf", DocumentUpdate(title="Bao_Cao_Moi"), doc_type="pdf")
        self.assertIsNotNone(renamed_meta)
        self.assertEqual(renamed_meta.title, "Bao_Cao_Moi.pdf")

        new_pdf_path = UPLOADS_DIR / "Bao_Cao_Moi.pdf"
        self.created_files.append(str(new_pdf_path))
        self.assertTrue(new_pdf_path.exists())

    def test_pptx_process_3step_export(self):
        """Verifies that PptxService exports process-3step slides properly."""
        deck_data = {
            "title": "Quy Trình 3 Bước",
            "slides": [
                {
                    "title": "Kế hoạch 3 giai đoạn",
                    "layout": "process-3step",
                    "col1Title": "Khởi tạo",
                    "col1Content": "Thu thập yêu cầu",
                    "col2Title": "Thiết kế",
                    "col2Content": "Xây dựng mô hình",
                    "col3Title": "Phát hành",
                    "col3Content": "Bàn giao khách hàng"
                }
            ]
        }
        buf = PptxService.export_to_pptx(deck_data, "Quy_Trinh")
        self.assertGreater(len(buf.getvalue()), 1000)

    def test_dashboard_drag_and_drop_overlay_present(self):
        """Verifies index.html contains dropOverlay element for fast Drag & Drop."""
        html = Path("static/index.html").read_text(encoding="utf-8")
        self.assertIn("dropOverlay", html)
        self.assertIn("Thả tệp vào đây để mở ngay", html)

    def test_hub_js_rename_and_drag_drop(self):
        """Verifies hub.js contains promptRenameDocument and drag-and-drop listener."""
        js = Path("static/js/hub.js").read_text(encoding="utf-8")
        self.assertIn("promptRenameDocument", js)
        self.assertIn("dragenter", js)
        self.assertIn("dropOverlay", js)

    def test_doc_js_safe_treewalker_replace(self):
        """Verifies doc.js has safe TreeWalker replacement."""
        js = Path("static/js/doc.js").read_text(encoding="utf-8")
        self.assertIn("createTreeWalker", js)
        self.assertIn("SHOW_TEXT", js)

if __name__ == "__main__":
    unittest.main()
