import os
import sys
import base64
import unittest
from io import BytesIO
from PIL import Image
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.main import app
from app.services.pdf_service import PdfService

class TestNovaPdfEditor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_pdf_ui_elements(self):
        """Verify NovaPDF HTML has all editing ribbon tools and two-layer canvas."""
        res = self.client.get("/pdf")
        self.assertEqual(res.status_code, 200)
        html = res.text

        # Tool buttons
        self.assertIn("tool-pan", html)
        self.assertIn("tool-text", html)
        self.assertIn("tool-draw", html)
        self.assertIn("tool-whiteout", html)
        self.assertIn("tool-highlight", html)
        self.assertIn("tool-stamp", html)
        self.assertIn("convertToNovaDoc()", html)
        self.assertIn("saveAnnotatedPdf()", html)

        # Dual canvas architecture
        self.assertIn('id="the-canvas"', html)
        self.assertIn('id="annotation-canvas"', html)
        self.assertIn('id="annotation-dom-layer"', html)

        # Check CSS
        css = self.client.get("/static/css/style.css").text
        self.assertIn(".pdf-tool-btn", css)
        self.assertIn(".pdf-textbox-overlay", css)
        self.assertIn(".pdf-stamp-overlay", css)

        # Check JS
        js = self.client.get("/static/js/pdf.js").text
        self.assertIn("convertToNovaDoc", js)
        self.assertIn("saveAnnotatedPdf", js)
        self.assertIn("applyStamp", js)
        self.assertIn("addTextBoxAt", js)

    def test_02_pdf_to_novadoc_conversion(self):
        """Test converting a PDF into an editable NovaDoc document."""
        # 1. Create a PDF in memory
        sample_html = "<h1>BẢN HỢP ĐỒNG KINH TẾ</h1><p>Bên A đồng ý cung cấp giải pháp NovaOffice cho Bên B.</p>"
        pdf_buf = PdfService.html_to_pdf(sample_html, title="HopDongKinhTe")
        pdf_b64 = base64.b64encode(pdf_buf.getvalue()).decode("utf-8")

        # 2. Call conversion endpoint
        res = self.client.post("/api/pdf/convert-to-doc", json={
            "pdf_data": pdf_b64,
            "title": "HopDongKinhTe"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertTrue("doc_id" in data)
        self.assertTrue("redirect" in data)

        # 3. Verify newly created NovaDoc in storage
        doc_res = self.client.get(f"/api/documents/{data['doc_id']}?type=doc")
        self.assertEqual(doc_res.status_code, 200)
        doc = doc_res.json()
        self.assertIn("HopDongKinhTe", doc["title"])
        extracted_html = doc["content"]["html"]
        self.assertTrue(len(extracted_html) > 0)
        self.assertIn("BẢN HỢP ĐỒNG", extracted_html)

    def test_03_save_annotated_pdf(self):
        """Test saving an annotated PDF with merged canvas pages."""
        # Create a sample canvas page as base64 JPEG
        img = Image.new("RGB", (800, 1100), color=(255, 255, 255))
        buf = BytesIO()
        img.save(buf, format="JPEG")
        img_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

        res = self.client.post("/api/pdf/save-annotated", json={
            "title": "Bien_Ban_Da_Ky",
            "images": [img_b64]
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertTrue(data["file_name"].endswith(".pdf"))
        self.assertTrue("url" in data)

        # Verify that the generated file is a valid PDF
        file_res = self.client.get(data["url"])
        self.assertEqual(file_res.status_code, 200)
        self.assertTrue(file_res.content.startswith(b"%PDF"))

if __name__ == "__main__":
    unittest.main()
