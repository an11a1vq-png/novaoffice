import os
import sys
import socket
import threading
import time
import webbrowser
import multiprocessing
import urllib.request
import urllib.parse
import traceback
import tempfile
import shutil

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

def find_active_novaoffice_server(start_port=8000, max_ports=20):
    """Checks if a NovaOffice backend is already running on any local port."""
    for port in range(start_port, start_port + max_ports):
        url = f"http://{HOST}:{port}/api/documents"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NovaOffice-Ping"})
            with urllib.request.urlopen(req, timeout=0.35) as resp:
                if resp.status == 200:
                    log_debug(f"Detected existing NovaOffice backend on port {port}. Reusing server!")
                    return port
        except Exception:
            continue
    return None

def find_free_port(start_port=8000, max_attempts=50):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
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
    url = f"http://{host}:{port}/api/documents"
    log_debug(f"Waiting for backend to become ready at {url} (timeout: {timeout}s)...")
    start = time.time()
    while time.time() - start < timeout:
        if server_error:
            log_debug(f"Server thread reported an error early: {server_error}")
            return False
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NovaOffice-HealthCheck"})
            with urllib.request.urlopen(req, timeout=0.8) as resp:
                if resp.status == 200:
                    log_debug(f"Backend is READY in {time.time() - start:.2f} seconds!")
                    return True
        except Exception:
            time.sleep(0.12)
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
    # Step 1: Check if NovaOffice is ALREADY running on this machine
    active_port = find_active_novaoffice_server(start_port=8000, max_ports=20)
    server_owner = False

    if active_port:
        port = active_port
        log_debug(f"Attaching new window to active NovaOffice instance at port {port}")
    else:
        port = find_free_port(8000)
        log_debug(f"Selected new port: {port}")
        os.environ["PORT"] = str(port)

        # Start FastAPI server in background thread
        server_thread = threading.Thread(target=start_server, args=(port,), daemon=True)
        server_thread.start()
        server_owner = True

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

    # Check if a file path was passed in CLI args (e.g. double click or right-click Open with)
    file_arg = None
    if len(sys.argv) > 1:
        potential_path = sys.argv[1].strip('"\'')
        if os.path.exists(potential_path) and os.path.isfile(potential_path):
            file_arg = os.path.abspath(potential_path)

    if file_arg:
        encoded_path = urllib.parse.quote(file_arg)
        url = f"http://{HOST}:{port}/api/system/open-local?path={encoded_path}"
        log_debug(f"Direct file open requested: {file_arg} -> {url}")
    else:
        url = f"http://{HOST}:{port}"

    log_debug(f"Launching PyWebView window pointing to {url}...")

    # Isolate WebView2 profile per process so multiple instances run without file lock errors
    wv2_temp = os.path.join(
        tempfile.gettempdir(),
        "NovaOffice_WV2",
        f"inst_{os.getpid()}_{int(time.time() * 1000) % 100000}"
    )
    try:
        os.makedirs(wv2_temp, exist_ok=True)
        os.environ["WEBVIEW2_USER_DATA_FOLDER"] = wv2_temp
    except Exception:
        pass

    # Try launching native WebView window
    try:
        import webview
        window = webview.create_window(
            title="NovaOffice Suite",
            url=url,
            width=1340,
            height=860,
            min_size=(960, 620),
            confirm_close=False,
            text_select=True
        )
        webview.start()
        log_debug("WebView closed cleanly.")
    except Exception as e:
        log_debug(f"PyWebView failed: {e}. Falling back to default web browser.")
        webbrowser.open(url)
        if server_owner:
            while True:
                time.sleep(1)

    # Clean up temp WebView profile on exit
    try:
        if os.path.exists(wv2_temp):
            shutil.rmtree(wv2_temp, ignore_errors=True)
    except Exception:
        pass

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "--register":
            from app.services.assoc_service import register_file_associations
            register_file_associations()
            sys.exit(0)
        elif sys.argv[1] == "--unregister":
            from app.services.assoc_service import unregister_file_associations
            unregister_file_associations()
            sys.exit(0)
    run_app()
