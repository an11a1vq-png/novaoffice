import os
import sys
from pathlib import Path

# When bundled with PyInstaller
if getattr(sys, 'frozen', False):
    EXE_DIR = Path(sys.executable).parent
    BUNDLE_DIR = Path(sys._MEIPASS)
    STATIC_DIR = BUNDLE_DIR / "static"

    # If portable data folder exists next to exe, use it; otherwise use Documents/NovaOffice
    if (EXE_DIR / "data").exists():
        DATA_DIR = EXE_DIR / "data"
    else:
        user_docs = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Documents" / "NovaOffice"
        DATA_DIR = user_docs / "data"
else:
    BASE_DIR = Path(__file__).resolve().parent.parent
    STATIC_DIR = BASE_DIR / "static"
    DATA_DIR = BASE_DIR / "data"

DOCS_DIR = DATA_DIR / "docs"
SHEETS_DIR = DATA_DIR / "sheets"
SLIDES_DIR = DATA_DIR / "slides"
UPLOADS_DIR = DATA_DIR / "uploads"

# Ensure all data directories exist
for path in [DATA_DIR, DOCS_DIR, SHEETS_DIR, SLIDES_DIR, UPLOADS_DIR]:
    path.mkdir(parents=True, exist_ok=True)

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", 8000))
