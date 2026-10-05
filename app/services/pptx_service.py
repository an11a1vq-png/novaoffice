import io
from typing import Any, Dict, List
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

THEME_COLORS = {
    "modern-dark": {
        "bg": RGBColor(15, 23, 42),       # slate 900
        "title": RGBColor(248, 250, 252),  # slate 50
        "body": RGBColor(203, 213, 225),   # slate 300
        "accent": RGBColor(56, 189, 248)   # sky 400
    },
    "clean-light": {
        "bg": RGBColor(255, 255, 255),
        "title": RGBColor(30, 41, 59),
        "body": RGBColor(71, 85, 105),
        "accent": RGBColor(37, 99, 235)
    },
    "corporate-blue": {
        "bg": RGBColor(240, 249, 255),
        "title": RGBColor(12, 74, 110),
        "body": RGBColor(30, 58, 138),
        "accent": RGBColor(2, 132, 199)
    },
    "emerald": {
        "bg": RGBColor(240, 253, 244),
        "title": RGBColor(6, 78, 59),
        "body": RGBColor(22, 101, 52),
        "accent": RGBColor(16, 185, 129)
    }
}

class PptxService:
    @staticmethod
    def export_to_pptx(deck_data: Dict[str, Any], default_title: str = "Bai_Thuyet_Trinh") -> io.BytesIO:
        prs = pptx.Presentation()
        prs.slide_width = Inches(13.333)  # 16:9 widescreen
        prs.slide_height = Inches(7.5)

        blank_slide_layout = prs.slide_layouts[6]
        theme_name = deck_data.get("theme", "modern-dark")
        palette = THEME_COLORS.get(theme_name, THEME_COLORS["modern-dark"])

        slides_list = deck_data.get("slides", [])
        if not slides_list:
            slides_list = [{
                "title": default_title,
                "subtitle": "Tạo bằng NovaSlide",
                "layout": "title-slide"
            }]

        for slide_info in slides_list:
            slide = prs.slides.add_slide(blank_slide_layout)
            
            # Fill background
            background = slide.background
            fill = background.fill
            fill.solid()
            fill.fore_color.rgb = palette["bg"]

            layout = slide_info.get("layout", "standard")
            title_text = slide_info.get("title", "")
            subtitle_text = slide_info.get("subtitle", "")
            content_text = slide_info.get("content", "")
            bullets = slide_info.get("bullets", [])

            if layout == "title-slide":
                # Center Title & Subtitle
                tx_box = slide.shapes.add_textbox(Inches(1.5), Inches(2.2), Inches(10.33), Inches(3.2))
                tf = tx_box.text_frame
                tf.word_wrap = True

                p1 = tf.paragraphs[0]
                p1.text = title_text
                p1.alignment = PP_ALIGN.CENTER
                p1.font.size = Pt(48)
                p1.font.bold = True
                p1.font.color.rgb = palette["title"]

                if subtitle_text:
                    p2 = tf.add_paragraph()
                    p2.text = subtitle_text
                    p2.alignment = PP_ALIGN.CENTER
                    p2.font.size = Pt(24)
                    p2.font.color.rgb = palette["accent"]
                    p2.space_before = Pt(20)

            elif layout == "bullet-list" or bullets:
                # Title on top
                tx_box_title = slide.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.33), Inches(1.2))
                tf_title = tx_box_title.text_frame
                tf_title.word_wrap = True
                p_title = tf_title.paragraphs[0]
                p_title.text = title_text
                p_title.font.size = Pt(36)
                p_title.font.bold = True
                p_title.font.color.rgb = palette["title"]

                # Bullets below
                tx_box_body = slide.shapes.add_textbox(Inches(1.2), Inches(2.2), Inches(10.5), Inches(4.5))
                tf_body = tx_box_body.text_frame
                tf_body.word_wrap = True

                first = True
                for b_item in bullets:
                    p = tf_body.paragraphs[0] if first else tf_body.add_paragraph()
                    first = False
                    p.text = f"•  {b_item}"
                    p.font.size = Pt(24)
                    p.font.color.rgb = palette["body"]
                    p.space_after = Pt(16)

            else:
                # Standard Title + Content
                tx_box_title = slide.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.33), Inches(1.2))
                tf_title = tx_box_title.text_frame
                tf_title.word_wrap = True
                p_title = tf_title.paragraphs[0]
                p_title.text = title_text
                p_title.font.size = Pt(36)
                p_title.font.bold = True
                p_title.font.color.rgb = palette["title"]

                tx_box_body = slide.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(11.33), Inches(4.5))
                tf_body = tx_box_body.text_frame
                tf_body.word_wrap = True
                p_body = tf_body.paragraphs[0]
                p_body.text = content_text or subtitle_text
                p_body.font.size = Pt(22)
                p_body.font.color.rgb = palette["body"]

        buffer = io.BytesIO()
        prs.save(buffer)
        buffer.seek(0)
        return buffer
