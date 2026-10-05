import io
from bs4 import BeautifulSoup
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

class PdfService:
    @staticmethod
    def html_to_pdf(html_content: str, title: str = "Tài liệu NovaOffice") -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=54
        )

        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#0f172a'),
            spaceAfter=14
        )
        h2_style = ParagraphStyle(
            'CustomH2',
            parent=styles['Heading2'],
            fontSize=16,
            leading=20,
            textColor=colors.HexColor('#1e293b'),
            spaceBefore=10,
            spaceAfter=8
        )
        body_style = ParagraphStyle(
            'CustomBody',
            parent=styles['Normal'],
            fontSize=11,
            leading=16,
            textColor=colors.HexColor('#334155'),
            spaceAfter=8
        )

        story = []
        soup = BeautifulSoup(html_content, "html.parser")

        for el in soup.children:
            if not hasattr(el, 'name') or el.name is None:
                txt = str(el).strip()
                if txt:
                    story.append(Paragraph(txt, body_style))
                continue

            tag = el.name.lower()
            text = el.get_text().strip()
            if not text and tag != "hr":
                continue

            if tag == "h1":
                story.append(Paragraph(text, title_style))
            elif tag in ["h2", "h3"]:
                story.append(Paragraph(text, h2_style))
            elif tag == "hr":
                story.append(Spacer(1, 10))
            else:
                story.append(Paragraph(text, body_style))

        if not story:
            story.append(Paragraph(title, title_style))
            story.append(Paragraph("Tài liệu không có nội dung.", body_style))

        doc.build(story)
        buffer.seek(0)
        return buffer
