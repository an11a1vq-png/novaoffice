import os
import sys
import unittest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.main import app

class TestNovaOfficeSuiteAllModules(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    # ------------------ MỤC 1: NOVADOC ------------------
    def test_01_novadoc_ui_and_features(self):
        """Verify NovaDoc HTML and JS feature integration."""
        res = self.client.get("/doc")
        self.assertEqual(res.status_code, 200)
        html = res.text
        # Page break button
        self.assertIn("insertPageBreak()", html)
        # Header / Footer toggle
        self.assertIn("toggleHeaderFooter()", html)
        # Line Spacing
        self.assertIn("setLineSpacing", html)
        # Watermark
        self.assertIn("setWatermark", html)
        # Checklist
        self.assertIn("insertChecklist()", html)
        # Table tools
        self.assertIn("tableAddRow()", html)
        self.assertIn("tableAddCol()", html)
        # Version History Drawer
        self.assertIn("versionHistoryDrawer", html)

        # Verify CSS contains page-break and header/footer definitions
        css = self.client.get("/static/css/style.css").text
        self.assertIn(".page-break", css)
        self.assertIn(".doc-header-zone", css)

    # ------------------ MỤC 2: NOVASHEET ------------------
    def test_02_novasheet_ui_and_features(self):
        """Verify NovaSheet UI elements and formula support."""
        res = self.client.get("/sheet")
        self.assertEqual(res.status_code, 200)
        html = res.text
        # Number formatting dropdown
        self.assertIn('value="currency"', html)
        self.assertIn('value="percent"', html)
        self.assertIn('value="date"', html)
        # Multi-cell range stats bar
        self.assertIn("rangeStatsBar", html)
        self.assertIn("statCount", html)
        self.assertIn("statSum", html)
        self.assertIn("statAvg", html)
        # Freeze panes
        self.assertIn("toggleFreezeFirstCol()", html)

        # Check sheet.js contains the extended formula engine functions (IF, VLOOKUP, CONCAT)
        sheet_js = self.client.get("/static/js/sheet.js").text
        self.assertIn("parseFormulaArgs", sheet_js)
        self.assertIn("evaluateCondition", sheet_js)
        self.assertIn("VLOOKUP", sheet_js)
        self.assertIn("CONCATENATE", sheet_js)

    # ------------------ MỤC 3: NOVASLIDE ------------------
    def test_03_novaslide_ui_and_features(self):
        """Verify NovaSlide Speaker Notes, Presenter Mode, and PDF Export."""
        res = self.client.get("/slide")
        self.assertEqual(res.status_code, 200)
        html = res.text
        # Speaker notes
        self.assertIn("speakerNotesContainer", html)
        self.assertIn("slideSpeakerNotes", html)
        # Presenter Mode
        self.assertIn("presenterModeOverlay", html)
        self.assertIn("startPresenterMode()", html)
        self.assertIn("presenterCurrentSlide", html)
        self.assertIn("presenterNextSlide", html)
        self.assertIn("presenterNotesText", html)
        self.assertIn("presenterTimer", html)
        # Slide PDF Export
        self.assertIn("exportSlidePdf()", html)

    # ------------------ MỤC 4: HUB & NOVAPDF ------------------
    def test_04_hub_and_novapdf(self):
        """Verify Hub Templates, Trash Management, and NovaPDF."""
        # Hub elements
        res_hub = self.client.get("/hub")
        self.assertEqual(res_hub.status_code, 200)
        hub_html = res_hub.text
        self.assertIn("Kho Biểu Mẫu Chuẩn", hub_html)
        self.assertIn("doc_leave", hub_html)
        self.assertIn("doc_meeting", hub_html)
        self.assertIn("doc_contract", hub_html)
        self.assertIn("sheet_finance", hub_html)
        self.assertIn("sheet_project", hub_html)
        self.assertIn("slide_pitch", hub_html)
        self.assertIn("Thùng rác", hub_html)

        # NovaPDF elements
        res_pdf = self.client.get("/pdf")
        self.assertEqual(res_pdf.status_code, 200)
        pdf_html = res_pdf.text
        self.assertIn("fitWidth()", pdf_html)
        self.assertIn("rotatePage()", pdf_html)
        self.assertIn("downloadPdf()", pdf_html)

    # ------------------ CRUD & TRASH WORKFLOW ------------------
    def test_05_trash_lifecycle(self):
        """End-to-end test of creation, soft-delete, restore, and permanent deletion."""
        # Create doc
        c_res = self.client.post("/api/documents", json={
            "title": "Văn bản thử nghiệm Suite",
            "type": "doc",
            "content": {"html": "<p>Nội dung</p>"}
        })
        self.assertEqual(c_res.status_code, 200)
        doc_id = c_res.json()["id"]

        # Move to trash
        del_res = self.client.delete(f"/api/documents/{doc_id}?type=doc")
        self.assertEqual(del_res.status_code, 200)

        # Confirm in trash
        trash_res = self.client.get("/api/documents?trash=true")
        self.assertIn(doc_id, [d["id"] for d in trash_res.json()])

        # Restore
        rst_res = self.client.post(f"/api/documents/{doc_id}/restore?type=doc")
        self.assertEqual(rst_res.status_code, 200)

        # Confirm restored to active
        act_res = self.client.get("/api/documents?trash=false")
        self.assertIn(doc_id, [d["id"] for d in act_res.json()])

        # Clean up
        self.client.delete(f"/api/documents/{doc_id}?type=doc&permanent=true")

if __name__ == "__main__":
    unittest.main()
