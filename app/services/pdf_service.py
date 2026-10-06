import io
import re
import base64
from pathlib import Path
from typing import List, Union
from bs4 import BeautifulSoup
from PIL import Image

import pdfplumber
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register Unicode TrueType fonts for full Vietnamese diacritics support
UNICODE_FONT = 'Helvetica'
UNICODE_FONT_BOLD = 'Helvetica-Bold'

for candidate in ['C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/segoeui.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
    if Path(candidate).exists():
        try:
            pdfmetrics.registerFont(TTFont('UnicodeSans', candidate))
            UNICODE_FONT = 'UnicodeSans'
            break
        except Exception:
            pass

for candidate in ['C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/segoeuib.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
    if Path(candidate).exists():
        try:
            pdfmetrics.registerFont(TTFont('UnicodeSans-Bold', candidate))
            UNICODE_FONT_BOLD = 'UnicodeSans-Bold'
            break
        except Exception:
            pass

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
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontName=UNICODE_FONT_BOLD,
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#0f172a'),
            spaceAfter=14
        )
        h2_style = ParagraphStyle(
            'CustomH2',
            parent=styles['Heading2'],
            fontName=UNICODE_FONT_BOLD,
            fontSize=16,
            leading=20,
            textColor=colors.HexColor('#1e293b'),
            spaceBefore=10,
            spaceAfter=8
        )
        body_style = ParagraphStyle(
            'CustomBody',
            parent=styles['Normal'],
            fontName=UNICODE_FONT,
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

    @staticmethod
    def pdf_to_html(source: Union[str, Path, bytes, io.BytesIO]) -> str:
        """
        Extracts content from a PDF file using pdfplumber and converts it
        into rich HTML format structured for editing in NovaDoc.
        Intelligently distinguishes real tables from text layouts,
        groups bullet lists into <ul><li>, and formats headings.
        """
        html_parts = []
        pdf_stream = io.BytesIO(source) if isinstance(source, bytes) else source

        with pdfplumber.open(pdf_stream) as pdf:
            total_pages = len(pdf.pages)
            for page_idx, page in enumerate(pdf.pages):
                page_num = page_idx + 1

                # 1. Extract genuine multi-column tables (>= 2 columns and >= 2 rows)
                tables = page.extract_tables()
                has_real_table = False
                if tables:
                    for tbl in tables:
                        if tbl and len(tbl) >= 2 and len(tbl[0]) >= 2 and any(any(row) for row in tbl):
                            has_real_table = True
                            table_html = ['<table border="1" style="width:100%; border-collapse:collapse; margin:14px 0; border:1px solid #cbd5e1;">']
                            for r_idx, row in enumerate(tbl):
                                table_html.append('<tr>')
                                for cell in row:
                                    tag = 'th' if r_idx == 0 else 'td'
                                    cell_txt = (cell or '').replace('\n', '<br>')
                                    bg = 'background-color:#f8fafc;' if r_idx == 0 else ''
                                    table_html.append(f'<{tag} style="border:1px solid #cbd5e1; padding:6px 10px; {bg}">{cell_txt}</{tag}>')
                                table_html.append('</tr>')
                            table_html.append('</table>')
                            html_parts.append(''.join(table_html))

                # 2. Extract textual content
                raw_text = page.extract_text()
                if raw_text and not has_real_table:
                    lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
                    i = 0
                    n = len(lines)
                    in_list = False

                    while i < n:
                        line = lines[i]

                        # Document Title / Candidate Name (First line if short)
                        if i == 0 and page_num == 1 and len(line) < 60:
                            if in_list:
                                html_parts.append('</ul>')
                                in_list = False
                            html_parts.append(f'<h1 style="color:#0f172a; font-size:22pt; font-weight:bold; margin-bottom:4px;">{line}</h1>')
                            i += 1
                            continue

                        # Subtitle (Job title, role, sub-headline)
                        if i == 1 and page_num == 1 and len(line) < 100 and any(k in line for k in ['Thực tập', 'Developer', 'Kỹ sư', 'Chuyên viên', 'Sinh viên', 'Giám đốc', 'Quản lý']):
                            if in_list:
                                html_parts.append('</ul>')
                                in_list = False
                            html_parts.append(f'<p style="color:#2563eb; font-size:12pt; font-weight:600; margin-bottom:4px;">{line}</p>')
                            i += 1
                            continue

                        # Contact Info strip
                        if i == 2 and page_num == 1 and ('@' in line or '09' in line or '08' in line or '03' in line or '07' in line or 'github' in line):
                            if in_list:
                                html_parts.append('</ul>')
                                in_list = False
                            html_parts.append(f'<p style="color:#64748b; font-size:9.5pt; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">{line}</p>')
                            i += 1
                            continue

                        # Major Section Headers (ALL CAPS or standard section prefix)
                        clean_no_symbol = re.sub(r'[\s&•\-\|/]', '', line)
                        is_main_header = (len(line) < 80 and (clean_no_symbol.isupper() or line.startswith(('CHƯƠNG', 'BÀI', 'PHẦN', 'ĐIỀU', 'MỤC', 'I.', 'II.', 'III.', 'IV.'))))
                        if is_main_header:
                            if in_list:
                                html_parts.append('</ul>')
                                in_list = False
                            html_parts.append(f'<h2 style="color:#1e293b; font-size:13pt; font-weight:bold; border-bottom:2px solid #2563eb; padding-bottom:3px; margin-top:20px; margin-bottom:10px;">{line}</h2>')
                            i += 1
                            continue

                        # Project or Subsection Title
                        if '•' in line and any(k in line for k in ['GitHub', 'Demo', '–', '-', '2024', '2025', '2026', '2027']):
                            if in_list:
                                html_parts.append('</ul>')
                                in_list = False
                            html_parts.append(f'<h3 style="color:#0f172a; font-size:11.5pt; font-weight:bold; margin-top:12px; margin-bottom:3px;">{line}</h3>')
                            i += 1
                            continue

                        # Tech stack or metadata subtitle
                        if line.startswith(('—', 'Desktop App', 'Web App', 'Đồ án', 'Phần mềm')):
                            if in_list:
                                html_parts.append('</ul>')
                                in_list = False
                            html_parts.append(f'<p style="color:#475569; font-style:italic; font-size:10pt; margin-bottom:6px;">{line}</p>')
                            i += 1
                            continue

                        # Bullet items
                        if line.startswith(('•', '-', '*')):
                            if not in_list:
                                html_parts.append('<ul style="list-style-type:disc; padding-left:22px; margin-bottom:8px;">')
                                in_list = True
                            clean_bullet = line.lstrip('•-* ').strip()
                            html_parts.append(f'<li style="margin-bottom:4px; line-height:1.5; color:#334155;">{clean_bullet}</li>')
                            i += 1
                            continue

                        # Regular Paragraph (Join continuous wrapped sentences)
                        if in_list:
                            html_parts.append('</ul>')
                            in_list = False

                        para = [line]
                        i += 1
                        while i < n:
                            nxt = lines[i]
                            nxt_clean = re.sub(r'[\s&•\-\|/]', '', nxt)
                            if (nxt_clean.isupper() or 
                                nxt.startswith(('•', '-', '*', '—', 'Desktop App', 'Web App', 'Đồ án', 'CHƯƠNG', 'BÀI', 'I.', 'II.')) or 
                                ('•' in nxt and any(k in nxt for k in ['GitHub', 'Demo', '–', '-']))):
                                break
                            para.append(nxt)
                            i += 1

                        html_parts.append(f'<p style="margin-bottom:8px; line-height:1.6; text-align:justify; color:#334155;">{" ".join(para)}</p>')

                    if in_list:
                        html_parts.append('</ul>')

                # 3. Add page break if there are subsequent pages
                if page_num < total_pages:
                    html_parts.append(
                        f'<div class="page-break" style="margin:24px 0; border-top:2px dashed #94a3b8; text-align:center; position:relative;">'
                        f'<span style="background:#fff; padding:2px 8px; font-size:11px; color:#64748b; position:relative; top:-10px;">'
                        f'Trang {page_num + 1}'
                        f'</span></div>'
                    )

        if not html_parts:
            return "<p><em>(Tài liệu PDF không có nội dung văn bản hoặc chỉ chứa ảnh scan)</em></p>"

        return "\n".join(html_parts)

    @staticmethod
    def images_to_pdf(images_base64_list: List[str]) -> io.BytesIO:
        """
        Compiles a list of base64-encoded image data URLs (from canvas exports)
        into a single, high-quality paginated PDF document.
        """
        pil_images = []
        for img_data in images_base64_list:
            if not img_data:
                continue
            # Strip data URL prefix if present: data:image/png;base64,...
            if ',' in img_data:
                img_data = img_data.split(',', 1)[1]
            
            raw_bytes = base64.b64decode(img_data)
            img = Image.open(io.BytesIO(raw_bytes))
            # Convert RGBA to RGB with white background
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                bg = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                bg.paste(img, mask=img.split()[-1])
                pil_images.append(bg)
            else:
                pil_images.append(img.convert('RGB'))

        if not pil_images:
            raise ValueError("Không có hình ảnh nào để tạo PDF")

        buffer = io.BytesIO()
        first_img = pil_images[0]
        other_images = pil_images[1:] if len(pil_images) > 1 else []

        first_img.save(
            buffer,
            format='PDF',
            save_all=True,
            append_images=other_images,
            resolution=150.0
        )
        buffer.seek(0)
        return buffer
