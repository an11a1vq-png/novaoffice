from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class DocumentMeta(BaseModel):
    id: str
    title: str
    type: str  # "doc", "sheet", "slide", "pdf"
    created_at: str
    updated_at: str
    size_bytes: int = 0
    tags: List[str] = Field(default_factory=list)
    is_trash: bool = False
    deleted_at: Optional[str] = None

class DocumentCreate(BaseModel):
    title: str
    type: str  # "doc", "sheet", "slide"
    content: Optional[Any] = None
    tags: List[str] = Field(default_factory=list)

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[Any] = None
    tags: Optional[List[str]] = None
    is_trash: Optional[bool] = None

class DocumentResponse(BaseModel):
    id: str
    title: str
    type: str
    created_at: str
    updated_at: str
    content: Any
    tags: List[str] = Field(default_factory=list)
    is_trash: bool = False
    deleted_at: Optional[str] = None

class ExportDocxRequest(BaseModel):
    title: str
    html_content: str

class ExportXlsxRequest(BaseModel):
    title: str
    sheets: Dict[str, List[List[Any]]]

class ExportPptxRequest(BaseModel):
    title: str
    slides: List[Dict[str, Any]]

class AIChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None
    context: Optional[str] = ""

class AIDocAssistRequest(BaseModel):
    action: str  # "continue", "summarize", "improve", "draft", "translate"
    text: str
    user_instruction: Optional[str] = ""
    context: Optional[str] = ""

class AISheetFormulaRequest(BaseModel):
    query: str
    active_cell: Optional[str] = "A1"
    context: Optional[str] = ""

class AISlideGenerateRequest(BaseModel):
    topic: str
    num_slides: Optional[int] = 3

class AIFullDocFixRequest(BaseModel):
    html_content: str
    instruction: Optional[str] = ""

class AISheetAssistRequest(BaseModel):
    action: str  # "formula", "clean", "fill", "explain"
    query: str
    active_cell: Optional[str] = "A1"
    context: Optional[str] = ""

