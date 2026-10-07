import io
import unittest
from fastapi.testclient import TestClient
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

from app.main import app
from app.services.pptx_service import PptxService

class TestSlideStandardLayout(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_slide_html_has_standard_and_shapes_layout_options(self):
        res = self.client.get("/slide")
        self.assertEqual(res.status_code, 200)
        self.assertIn('<option value="standard">', res.text)
        self.assertIn('<option value="shapes">', res.text)
        self.assertIn('Khung khối gốc (PowerPoint Shapes)', res.text)

    def test_slide_js_has_shapes_handlers(self):
        res = self.client.get("/static/js/slide.js")
        self.assertEqual(res.status_code, 200)
        js_code = res.text
        self.assertIn("case 'shapes':", js_code)
        self.assertIn("renderShapesHtml(", js_code)
        self.assertIn("updateShapeTableCell(", js_code)
        self.assertIn("updateShapeText(", js_code)

    def test_pptx_import_and_export_rich_shapes(self):
        prs = pptx.Presentation()
        prs.slide_width = Inches(13.333)
        prs.slide_height = Inches(7.5)
        
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = RGBColor(15, 23, 42) # #0F172A

        # 1. Title textbox
        tb_title = slide.shapes.add_textbox(Inches(1), Inches(0.5), Inches(11), Inches(0.8))
        tb_title.text_frame.text = "MỤC 1.8.1: XÁC THỰC VÀ CLAIMS"

        # 2. Line shape
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1), Inches(1.4), Inches(11), Inches(0.04))
        line.fill.solid()
        line.fill.fore_color.rgb = RGBColor(56, 189, 248) # #38BDF8

        # 3. Card 1 with background fill and border
        card1 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1), Inches(1.6), Inches(3.4), Inches(2.2))
        card1.fill.solid()
        card1.fill.fore_color.rgb = RGBColor(30, 41, 59) # #1E293B
        card1.line.color.rgb = RGBColor(56, 189, 248) # #38BDF8
        card1.text_frame.text = "Claim (Mẩu thông tin)\n• ClaimTypes.Name = GV01\v• Role = GiaoVien"

        # 4. Code Block
        code_box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1), Inches(4.2), Inches(11), Inches(2.5))
        code_box.fill.solid()
        code_box.fill.fore_color.rgb = RGBColor(11, 19, 43) # #0B132B
        code_box.line.color.rgb = RGBColor(56, 189, 248)
        p = code_box.text_frame.paragraphs[0]
        p.text = "// AccountController.cs\nvar claims = new List<Claim>();"
        p.font.name = "Consolas"

        # 5. Speaker notes
        slide.notes_slide.notes_text_frame.text = "Ghi chú thuyết trình cho slide 18."

        # Save to buffer
        buf = io.BytesIO()
        prs.save(buf)
        buf.seek(0)

        # Import
        imported_deck = PptxService.import_from_pptx(buf)
        self.assertIn("slides", imported_deck)
        self.assertEqual(len(imported_deck["slides"]), 1)
        
        imported_slide = imported_deck["slides"][0]
        self.assertEqual(imported_slide["layout"], "shapes")
        self.assertEqual(imported_slide["bg_color"], "#0F172A")
        self.assertEqual(imported_slide.get("notes"), "Ghi chú thuyết trình cho slide 18.")
        
        shapes = imported_slide.get("shapes", [])
        self.assertEqual(len(shapes), 4)

        # Check soft break \v was converted to \n
        c1_shape = [s for s in shapes if "Claim (Mẩu thông tin)" in s["text"]][0]
        self.assertNotIn("\v", c1_shape["text"])
        self.assertIn("Role = GiaoVien", c1_shape["text"])
        self.assertEqual(c1_shape["fill"], "#1E293B")
        self.assertEqual(c1_shape["border"], "#38BDF8")

        # Check code shape
        code_shape = [s for s in shapes if s.get("is_code")][0]
        self.assertEqual(code_shape["fill"], "#0B132B")
        self.assertIn("var claims", code_shape["text"])

        # Re-export to PPTX
        export_buf = PptxService.export_to_pptx(imported_deck, "Test_Shapes")
        self.assertGreater(export_buf.getbuffer().nbytes, 1000)

        # Re-import to verify round-trip
        reimported = PptxService.import_from_pptx(export_buf)
        self.assertEqual(len(reimported["slides"]), 1)
        self.assertEqual(reimported["slides"][0]["layout"], "shapes")
        self.assertEqual(len(reimported["slides"][0]["shapes"]), 4)

if __name__ == "__main__":
    unittest.main()
