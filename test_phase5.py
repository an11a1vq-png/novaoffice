import sys
import io
import os
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.services.docx_service import DocxService
from app.services.xlsx_service import XlsxService
from app.services.pptx_service import PptxService
from app.services.pdf_service import PdfService
from app.services.assoc_service import register_file_associations, unregister_file_associations
from app.config import UPLOADS_DIR

client = TestClient(app)

class TestPhase5Improvements(unittest.TestCase):
    def setUp(self):
        self.temp_files = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception:
                pass

    def test_pptx_import_export_roundtrip(self):
        """Tests that PPTX can be exported and imported correctly."""
        deck_data = {
            "title": "Báo cáo Q4",
            "theme": "corporate-blue",
            "slides": [
                {
                    "title": "Tổng quan Q4",
                    "subtitle": "Kế hoạch kinh doanh",
                    "layout": "title-slide"
                },
                {
                    "title": "Chỉ số doanh thu",
                    "content": "Doanh thu tăng trưởng 35% so với cùng kỳ",
                    "layout": "standard"
                }
            ]
        }
        pptx_buf = PptxService.export_to_pptx(deck_data)
        self.assertGreater(len(pptx_buf.getvalue()), 1000)

        imported = PptxService.import_from_pptx(pptx_buf)
        self.assertIn("slides", imported)
        self.assertEqual(len(imported["slides"]), 2)
        self.assertIn("Tổng quan Q4", imported["slides"][0]["title"])

    def test_open_local_file_docx(self):
        """Tests GET /api/system/open-local on a real .docx file."""
        docx_buf = DocxService.html_to_docx("<p>Nội dung kiểm thử Word</p>", "Test_Doc")
        test_path = "test_sample_open.docx"
        with open(test_path, "wb") as f:
            f.write(docx_buf.getvalue())
        self.temp_files.append(test_path)

        res = client.get(f"/api/system/open-local?path={os.path.abspath(test_path)}", follow_redirects=False)
        self.assertIn(res.status_code, [302, 307])
        self.assertTrue(res.headers["location"].startswith("/doc?id="))

    def test_open_local_file_xlsx(self):
        """Tests GET /api/system/open-local on a real .xlsx file."""
        sheet_data = {
            "sheets": {
                "Sheet1": {
                    "A1": {"value": 100, "formula": ""},
                    "A2": {"value": 200, "formula": ""}
                }
            }
        }
        xlsx_buf = XlsxService.export_to_xlsx(sheet_data, "Test_Sheet")
        test_path = "test_sample_open.xlsx"
        with open(test_path, "wb") as f:
            f.write(xlsx_buf.getvalue())
        self.temp_files.append(test_path)

        res = client.get(f"/api/system/open-local?path={os.path.abspath(test_path)}", follow_redirects=False)
        self.assertIn(res.status_code, [302, 307])
        self.assertTrue(res.headers["location"].startswith("/sheet?id="))

    def test_open_local_file_pptx(self):
        """Tests GET /api/system/open-local on a real .pptx file."""
        deck_data = {
            "slides": [{"title": "Slide Test", "content": "Nội dung slide", "layout": "standard"}]
        }
        pptx_buf = PptxService.export_to_pptx(deck_data, "Test_Presentation")
        test_path = "test_sample_open.pptx"
        with open(test_path, "wb") as f:
            f.write(pptx_buf.getvalue())
        self.temp_files.append(test_path)

        res = client.get(f"/api/system/open-local?path={os.path.abspath(test_path)}", follow_redirects=False)
        self.assertIn(res.status_code, [302, 307])
        self.assertTrue(res.headers["location"].startswith("/slide?id="))

    def test_open_local_file_pdf(self):
        """Tests GET /api/system/open-local on a real .pdf file."""
        pdf_buf = PdfService.html_to_pdf("<p>Tài liệu PDF thử nghiệm</p>", "Test_Pdf")
        test_path = "test_sample_open.pdf"
        with open(test_path, "wb") as f:
            f.write(pdf_buf.getvalue())
        self.temp_files.append(test_path)

        res = client.get(f"/api/system/open-local?path={os.path.abspath(test_path)}", follow_redirects=False)
        self.assertIn(res.status_code, [302, 307])
        self.assertTrue(res.headers["location"].startswith("/pdf?file="))

    def test_file_association_service(self):
        """Tests registering and unregistering Windows file associations."""
        reg_ok = register_file_associations()
        self.assertTrue(reg_ok)
        unreg_ok = unregister_file_associations()
        self.assertTrue(unreg_ok)
        # Re-register so machine maintains associations
        register_file_associations()

    def test_doc_ui_elements(self):
        """Verifies doc.html has pageCountDisplay and table picker elements."""
        doc_html_path = Path("static/doc.html")
        content = doc_html_path.read_text(encoding="utf-8")
        self.assertIn("pageCountDisplay", content)
        self.assertIn("tablePickerDropdown", content)
        self.assertIn("tableGridMatrix", content)

    def test_doc_js_methods(self):
        """Verifies doc.js has initTablePicker, updatePageCount, insertTableFromGrid."""
        doc_js_path = Path("static/js/doc.js")
        content = doc_js_path.read_text(encoding="utf-8")
        self.assertIn("initTablePicker", content)
        self.assertIn("updatePageCount", content)
        self.assertIn("insertTableFromGrid", content)

if __name__ == "__main__":
    unittest.main()
