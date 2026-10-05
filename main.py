import os
import sys
import time
import webbrowser
import threading
import uvicorn

from app.config import HOST, PORT

def open_browser():
    """Wait for server to start, then automatically open the default web browser."""
    time.sleep(1.2)
    url = f"http://{HOST}:{PORT}"
    print(f"\n[NovaOffice] Dang mo trinh duyet tai: {url}")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"[NovaOffice] Khong the tu dong mo trinh duyet: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("      NOVAOFFICE SUITE - HE THONG UNG DUNG VAN PHONG")
    print("=" * 60)
    print(f"[*] May chu dang khoi chay tai: http://{HOST}:{PORT}")
    print("[*] Nhan Ctrl + C de dung may chu bat cu luc nao.")
    print("=" * 60)

    # Launch browser opener in background thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Start FastAPI server
    uvicorn.run("app.main:app", host=HOST, port=PORT, log_level="info", reload=False)
