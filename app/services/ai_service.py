import json
import os
import re
import subprocess
import time
from typing import Any, Dict, List, Optional
import requests

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")

SYSTEM_PROMPT_BASE = """Bạn là NOVA AI, trợ lý trí tuệ nhân tạo chuyên sâu trong bộ ứng dụng văn phòng NovaOffice.
Phong cách làm việc của bạn:
- Tối giản, siêu nhanh, dứt khoát và chuẩn xác 100%.
- Sử dụng tiếng Việt chuẩn mực, văn phong văn phòng chỉn chu.
- Tập trung vào tính ứng dụng thực tế: viết văn bản chuẩn mẫu, tạo công thức bảng tính chính xác, thiết kế dàn ý thuyết trình mạch lạc."""

class AIService:
    @staticmethod
    def is_ollama_available() -> bool:
        try:
            r = requests.get(f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags", timeout=1.5)
            return r.status_code == 200
        except Exception:
            return False

    @classmethod
    def ensure_ollama_running(cls) -> bool:
        if cls.is_ollama_available():
            return True

        possible_paths = [
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe"),
            r"C:\Program Files\Ollama\ollama.exe"
        ]
        for p in possible_paths:
            if os.path.exists(p):
                try:
                    subprocess.Popen(
                        [p, "serve"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=0x08000000  # CREATE_NO_WINDOW
                    )
                    time.sleep(2)
                    return cls.is_ollama_available()
                except Exception:
                    pass
        return False

    @classmethod
    def query_llm(cls, messages: List[Dict[str, str]], temperature: float = 0.7, json_format: bool = False) -> str:
        """Call local Ollama with multi-turn chat format."""
        cls.ensure_ollama_running()
        url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"

        payload = {
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
            }
        }
        if json_format:
            payload["format"] = "json"

        try:
            res = requests.post(url, json=payload, timeout=45)
            if res.status_code == 200:
                data = res.json()
                return data.get("message", {}).get("content", "").strip()
            else:
                return f"[Lỗi kết nối Ollama: Mã lỗi {res.status_code}]"
        except requests.exceptions.Timeout:
            return "[Lỗi: Quá thời gian chờ phản hồi từ mô hình AI cục bộ]"
        except Exception as e:
            return f"[Lỗi: Không thể kết nối tới dịch vụ Ollama cục bộ ({e}). Hãy đảm bảo Ollama đang hoạt động]"

    @classmethod
    def chat(cls, user_message: str, history: Optional[List[Dict[str, str]]] = None, context: str = "") -> str:
        messages = [{"role": "system", "content": SYSTEM_PROMPT_BASE}]
        if context:
            messages.append({"role": "system", "content": f"Ngữ cảnh tài liệu hiện tại của người dùng:\n{context[:1500]}"})
        if history:
            messages.extend(history[-8:])
        messages.append({"role": "user", "content": user_message})
        return cls.query_llm(messages)

    @classmethod
    def doc_assist(cls, action: str, text: str, user_instruction: str = "", context: str = "") -> str:
        """Process document assistant requests: continue, summarize, improve, draft, translate."""
        system_instruction = SYSTEM_PROMPT_BASE + "\nBạn đang hỗ trợ người dùng soạn thảo và chỉnh sửa trực tiếp trong NovaDoc."

        if action == "continue":
            prompt = f"Hãy viết tiếp một cách tự nhiên và mạch lạc đoạn văn bản sau đây:\n\n\"{text}\""
            if user_instruction:
                prompt += f"\nYêu cầu bổ sung: {user_instruction}"
        elif action == "summarize":
            prompt = f"Hãy tóm tắt ngắn gọn các ý chính của đoạn văn bản sau đây thành các gạch đầu dòng rõ ràng:\n\n{text}"
        elif action == "improve":
            prompt = f"Hãy sửa lỗi chính tả, chuẩn hóa dấu câu và cải thiện văn phong đoạn văn sau trở nên trang trọng, mượt mà hơn. Chỉ trả về văn bản đã cải thiện, không giải thích dài dòng:\n\n{text}"
        elif action == "draft":
            prompt = f"Hãy soạn thảo một đoạn văn bản chỉn chu, có cấu trúc rõ ràng theo yêu cầu sau:\n\n{user_instruction or text}"
        elif action == "translate":
            prompt = f"Hãy dịch chuẩn xác đoạn văn bản sau sang ngôn ngữ mục tiêu (Anh hoặc Việt):\n\n{text}"
        elif action == "rewrite_custom":
            prompt = f"Hãy viết lại đoạn văn bản sau theo đúng chỉ dẫn của người dùng: \"{user_instruction}\"\n\nĐoạn văn gốc:\n\"{text}\"\n\nChỉ trả về đoạn văn mới đã viết lại, không thêm lời chào hay giải thích."
        else:
            prompt = f"Yêu cầu xử lý văn bản: {user_instruction}\nNội dung văn bản:\n{text}"

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt}
        ]
        return cls.query_llm(messages, temperature=0.5)

    @classmethod
    def full_document_fix(cls, html_or_text: str) -> str:
        """Auto-review and fix spelling, grammar, and typography for entire document while preserving HTML structure."""
        prompt = f"""Hãy rà soát toàn bộ văn bản sau đây: sửa triệt để các lỗi chính tả tiếng Việt, sửa lỗi ngữ pháp, chuẩn hóa dấu câu và viết hoa các danh xưng/tiêu đề theo chuẩn văn phòng.
QUAN TRỌNG: Hãy giữ nguyên các thẻ HTML (h1, h2, h3, p, table, tr, td, ul, li) nếu có. Chỉ sửa nội dung chữ bên trong. Không thêm bất kỳ lời bình luận hay giải thích nào ở đầu và cuối!

Nội dung cần rà soát:
{html_or_text[:4000]}"""

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_BASE},
            {"role": "user", "content": prompt}
        ]
        return cls.query_llm(messages, temperature=0.3)

    @classmethod
    def sheet_formula(cls, query: str, active_cell: str = "A1", context: str = "") -> Dict[str, Any]:
        """Generate Excel formula from natural language prompt."""
        prompt = f"""Người dùng cần một công thức Excel trong NovaSheet cho ô {active_cell}.
Yêu cầu của người dùng: "{query}"
Ngữ cảnh dữ liệu xung quanh (nếu có): {context or 'Bảng tính văn phòng chuẩn'}

Hãy trả về kết quả dưới định dạng JSON duy nhất như sau (không kèm giải thích bên ngoài):
{{
  "formula": "=TÊN_HÀM(...)",
  "explanation": "Giải thích ngắn gọn 1 câu về cách hoạt động của công thức"
}}"""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_BASE},
            {"role": "user", "content": prompt}
        ]
        res = cls.query_llm(messages, temperature=0.2, json_format=True)
        try:
            match = re.search(r"\{.*\}", res, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return json.loads(res)
        except Exception:
            formula_match = re.search(r"(=[A-Z0-9_]+\([^\)]*\)|=[A-Z0-9+\-*/]+)", res)
            if formula_match:
                return {"formula": formula_match.group(0), "explanation": res}
            return {"formula": "=SUM(A1:A10)", "explanation": res}

    @classmethod
    def slide_generate(cls, topic: str, num_slides: int = 3) -> Dict[str, Any]:
        """Generate slide presentation outline as structured JSON."""
        prompt = f"""Hãy thiết kế dàn ý bài thuyết trình gồm {num_slides} slide về chủ đề: "{topic}".
Mỗi slide phải có bố cục (layout) thuộc một trong các loại: 'title-slide', 'bullet-list', 'two-column', 'quote'.
Trả về kết quả bằng định dạng JSON thuần túy theo mẫu sau:
{{
  "title": "Tiêu đề bài thuyết trình",
  "theme": "modern-dark",
  "slides": [
    {{
      "title": "Tiêu đề Slide 1",
      "subtitle": "Phụ đề giới thiệu",
      "layout": "title-slide"
    }},
    {{
      "title": "Tiêu đề Slide 2",
      "layout": "bullet-list",
      "bullets": ["Ý 1", "Ý 2", "Ý 3"]
    }},
    {{
      "title": "Tiêu đề Slide 3",
      "layout": "two-column",
      "col1Title": "Cột 1",
      "col1Content": "Nội dung cột 1",
      "col2Title": "Cột 2",
      "col2Content": "Nội dung cột 2"
    }}
  ]
}}"""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_BASE},
            {"role": "user", "content": prompt}
        ]
        res = cls.query_llm(messages, temperature=0.7, json_format=True)
        try:
            match = re.search(r"\{.*\}", res, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return json.loads(res)
        except Exception:
            return {
                "title": topic,
                "theme": "modern-dark",
                "slides": [
                    {"title": topic, "subtitle": "Tạo tự động bởi Nova AI", "layout": "title-slide"},
                    {"title": "Mục Tiêu Chính", "layout": "bullet-list", "bullets": ["Nắm bắt mục tiêu", "Phân tích số liệu", "Định hướng hành động"]}
                ]
            }
