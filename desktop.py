import os
import sys
import socket
import threading
import time
import webbrowser
import multiprocessing
import urllib.request
import traceback

# Necessary for PyInstaller on Windows
multiprocessing.freeze_support()

# Safe stream redirection when running without console
log_file_path = os.path.join(os.environ.get("TEMP", os.path.expanduser("~")), "novaoffice_app.log")
try:
    log_fp = open(log_file_path, "a", encoding="utf-8", buffering=1)
    if sys.stdout is None:
        sys.stdout = log_fp
    if sys.stderr is None:
        sys.stderr = log_fp
except Exception:
    pass

def log_debug(msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] [NovaDesktop] {msg}\n"
    try:
        if sys.stderr:
            sys.stderr.write(formatted)
            sys.stderr.flush()
    except Exception:
        pass

import uvicorn
from app.config import HOST

def find_free_port(start_port=8000, max_attempts=50):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((HOST, port))
                return port
            except OSError:
                continue
    return 8000

server_error = None

def start_server(port):
    global server_error
    try:
        log_debug(f"Importing FastAPI app and configuring Uvicorn on {HOST}:{port}...")
        from app.main import app
        config = uvicorn.Config(
            app=app,
            host=HOST,
            port=port,
            log_level="warning",
            loop="asyncio",
            access_log=False
        )
        server = uvicorn.Server(config)
        server.run()
    except Exception as e:
        server_error = traceback.format_exc()
        log_debug(f"FATAL server error:\n{server_error}")

def wait_for_server(host, port, timeout=25):
    """Actively polls the backend until it responds with HTTP 200."""
    url = f"http://{host}:{port}/"
    log_debug(f"Waiting for backend to become ready at {url} (timeout: {timeout}s)...")
    start = time.time()
    while time.time() - start < timeout:
        if server_error:
            log_debug(f"Server thread reported an error early: {server_error}")
            return False
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NovaOffice-HealthCheck"})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    log_debug(f"Backend is READY in {time.time() - start:.2f} seconds!")
                    return True
        except Exception:
            time.sleep(0.15)
    log_debug("Timed out waiting for backend to become ready.")
    return False

def show_error_dialog(title, message):
    try:
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        messagebox.showerror(title, message)
        root.destroy()
    except Exception:
        pass

def run_app():
    port = find_free_port(8000)
    log_debug(f"Selected port: {port}")
    os.environ["PORT"] = str(port)

    # Start FastAPI server in background thread
    server_thread = threading.Thread(target=start_server, args=(port,), daemon=True)
    server_thread.start()

    # Wait until server is actually up and serving 200 OK
    is_ready = wait_for_server(HOST, port, timeout=25)
    if not is_ready:
        err_msg = (
            f"Không thể khởi động dịch vụ máy chủ nội bộ tại http://{HOST}:{port}.\n\n"
            f"Chi tiết nhật ký được ghi tại:\n{log_file_path}\n\n"
        )
        if server_error:
            err_msg += f"Lỗi chi tiết:\n{server_error[:400]}"
        show_error_dialog("Lỗi Khởi Động NovaOffice", err_msg)
        return

    url = f"http://{HOST}:{port}"
    log_debug(f"Launching PyWebView window pointing to {url}...")

    # Try launching native WebView window
    try:
        import webview
        window = webview.create_window(
            title="NovaOffice Suite",
            url=url,
            width=1320,
            height=850,
            min_size=(960, 620),
            confirm_close=False,
            text_select=True
        )
        webview.start()
        log_debug("WebView closed cleanly.")
    except Exception as e:
        log_debug(f"PyWebView failed: {e}. Falling back to default web browser.")
        webbrowser.open(url)
        while True:
            time.sleep(1)

if __name__ == "__main__":
    run_app()
