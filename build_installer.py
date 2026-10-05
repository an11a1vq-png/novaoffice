import os
import sys
import shutil
import zipfile
import subprocess
from pathlib import Path

def create_installer():
    dist_dir = Path("dist")
    source_app_dir = dist_dir / "NovaOffice"
    if not source_app_dir.exists():
        print(f"Error: {source_app_dir} does not exist. Run PyInstaller first!")
        return False

    print("[*] Creating application zip payload from dist/NovaOffice...")
    payload_zip = Path("installer_payload.zip")
    with zipfile.ZipFile(payload_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for file in source_app_dir.rglob("*"):
            if file.is_file():
                arcname = file.relative_to(source_app_dir)
                zf.write(file, arcname)

    print(f"[*] Payload created: {payload_zip} ({payload_zip.stat().st_size / (1024*1024):.2f} MB)")

    # Create installer GUI script
    installer_code = '''import os
import sys
import zipfile
import threading
import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox

APP_NAME = "NovaOffice Suite"
TARGET_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "NovaOffice"
DESKTOP_DIR = Path(os.environ.get("USERPROFILE", Path.home())) / "Desktop"
START_MENU_DIR = Path(os.environ.get("APPDATA", Path.home())) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "NovaOffice"

def create_shortcut(target, link_path, icon=None, description=""):
    try:
        ps_cmd = f"""
        $WshShell = New-Object -comObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut('{link_path}')
        $Shortcut.TargetPath = '{target}'
        $Shortcut.WorkingDirectory = '{Path(target).parent}'
        """
        if icon:
            ps_cmd += f"\\n$Shortcut.IconLocation = '{icon}'"
        if description:
            ps_cmd += f"\\n$Shortcut.Description = '{description}'"
        ps_cmd += "\\n$Shortcut.Save()"
        subprocess.run(["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps_cmd], capture_output=True)
    except Exception as e:
        print("Shortcut error:", e)

class InstallerApp:
    def __init__(self, root):
        self.root = root
        self.root.title(f"Cài đặt {APP_NAME}")
        self.root.geometry("520x360")
        self.root.resizable(False, False)
        
        # Modern background & theme
        self.root.configure(bg="#f8fafc")
        
        # Center window
        self.root.update_idletasks()
        w = self.root.winfo_width()
        h = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"+{x}+{y}")

        # Top Header Banner
        header = tk.Frame(root, bg="#2563eb", height=80)
        header.pack(fill=tk.X, side=tk.TOP)
        header.pack_propagate(False)

        title_lbl = tk.Label(header, text="NovaOffice Suite - Bộ Cài Đặt", font=("Segoe UI", 16, "bold"), fg="white", bg="#2563eb")
        title_lbl.pack(anchor="w", padx=24, pady=(16, 2))

        sub_lbl = tk.Label(header, text="Bộ ứng dụng văn phòng hiện đại (Word, Excel, PowerPoint, PDF)", font=("Segoe UI", 9), fg="#bfdbfe", bg="#2563eb")
        sub_lbl.pack(anchor="w", padx=24)

        # Body container
        body = tk.Frame(root, bg="#f8fafc")
        body.pack(fill=tk.BOTH, expand=True, padx=24, pady=16)

        desc = tk.Label(
            body,
            text=f"Bộ cài đặt sẽ tự động thiết lập {APP_NAME} trên máy tính của bạn.\\nKhông yêu cầu quyền Quản trị viên (Admin).",
            font=("Segoe UI", 10),
            bg="#f8fafc",
            fg="#334155",
            justify=tk.LEFT
        )
        desc.pack(anchor="w", pady=(0, 10))

        # Destination info
        dest_frame = tk.LabelFrame(body, text="Thư mục cài đặt", font=("Segoe UI", 9, "bold"), bg="#f8fafc", fg="#475569", padx=10, pady=8)
        dest_frame.pack(fill=tk.X, pady=(0, 12))

        dest_lbl = tk.Label(dest_frame, text=str(TARGET_DIR), font=("Segoe UI", 9), bg="#f8fafc", fg="#0f172a")
        dest_lbl.pack(anchor="w")

        # Options
        self.desktop_var = tk.BooleanVar(value=True)
        cb_desktop = tk.Checkbutton(body, text="Tạo biểu tượng trên Màn hình chính (Desktop)", variable=self.desktop_var, font=("Segoe UI", 9), bg="#f8fafc", fg="#1e293b", activebackground="#f8fafc")
        cb_desktop.pack(anchor="w")

        self.start_var = tk.BooleanVar(value=True)
        cb_start = tk.Checkbutton(body, text="Tạo biểu tượng trong Menu Start", variable=self.start_var, font=("Segoe UI", 9), bg="#f8fafc", fg="#1e293b", activebackground="#f8fafc")
        cb_start.pack(anchor="w")

        # Progress bar
        self.progress = ttk.Progressbar(body, mode="indeterminate")
        self.status_lbl = tk.Label(body, text="", font=("Segoe UI", 9), bg="#f8fafc", fg="#64748b")

        # Bottom Buttons
        footer = tk.Frame(root, bg="#f1f5f9", height=54, bd=1, relief=tk.RIDGE)
        footer.pack(fill=tk.X, side=tk.BOTTOM)
        footer.pack_propagate(False)

        self.btn_cancel = tk.Button(footer, text="Hủy bỏ", command=root.quit, font=("Segoe UI", 9), padx=14, pady=4, bg="#e2e8f0", fg="#334155", relief=tk.FLAT)
        self.btn_cancel.pack(side=tk.RIGHT, padx=(6, 20), pady=12)

        self.btn_install = tk.Button(footer, text="Cài Đặt Ngay", command=self.start_install, font=("Segoe UI", 9, "bold"), padx=18, pady=4, bg="#2563eb", fg="white", relief=tk.FLAT, cursor="hand2")
        self.btn_install.pack(side=tk.RIGHT, pady=12)

    def start_install(self):
        self.btn_install.config(state=tk.DISABLED)
        self.btn_cancel.config(state=tk.DISABLED)
        self.progress.pack(fill=tk.X, pady=(10, 4))
        self.progress.start(10)
        self.status_lbl.config(text="Đang giải nén tập tin và thiết lập...")
        self.status_lbl.pack(anchor="w")

        threading.Thread(target=self.do_install, daemon=True).start()

    def do_install(self):
        try:
            bundle_dir = getattr(sys, '_MEIPASS', Path(__file__).parent)
            zip_path = Path(bundle_dir) / "installer_payload.zip"

            # 1. Terminate any running instances so files are not locked
            try:
                subprocess.run(["taskkill", "/F", "/IM", "NovaOffice.exe"], capture_output=True)
                subprocess.run(["taskkill", "/F", "/IM", "NovaOffice_Portable.exe"], capture_output=True)
            except Exception:
                pass

            # 2. Create target directory
            TARGET_DIR.mkdir(parents=True, exist_ok=True)

            # 3. Extract payload (clean overwrite)
            with zipfile.ZipFile(zip_path, 'r') as zf:
                zf.extractall(TARGET_DIR)

            exe_path = TARGET_DIR / "NovaOffice.exe"
            if not exe_path.exists():
                alt_exe = TARGET_DIR / "NovaOffice_Portable.exe"
                if alt_exe.exists():
                    exe_path = alt_exe

            icon_path = TARGET_DIR / "app.ico"
            if not icon_path.exists():
                icon_path = exe_path

            # 4. Create Desktop shortcut
            if self.desktop_var.get():
                desktop_link = DESKTOP_DIR / f"{APP_NAME}.lnk"
                create_shortcut(exe_path, desktop_link, icon_path, f"Khởi chạy {APP_NAME}")

            # 5. Create Start Menu shortcut
            if self.start_var.get():
                START_MENU_DIR.mkdir(parents=True, exist_ok=True)
                start_link = START_MENU_DIR / f"{APP_NAME}.lnk"
                create_shortcut(exe_path, start_link, icon_path, f"Khởi chạy {APP_NAME}")

            # 6. Create clean uninstaller script
            uninstaller_bat = TARGET_DIR / "Uninstall.bat"
            uninstaller_bat.write_text(f"""@echo off
echo Dang go cai dat {APP_NAME}...
taskkill /F /IM NovaOffice.exe >nul 2>&1
taskkill /F /IM NovaOffice_Portable.exe >nul 2>&1
timeout /t 1 >nul
del /Q "{DESKTOP_DIR}\\\\{APP_NAME}.lnk" >nul 2>&1
rmdir /S /Q "{START_MENU_DIR}" >nul 2>&1
cd "%USERPROFILE%"
rmdir /S /Q "{TARGET_DIR}" >nul 2>&1
echo Da go cai dat thanh cong!
pause
""", encoding="utf-8")

            self.root.after(0, self.on_complete, exe_path)

        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("Lỗi Cài Đặt", f"Có lỗi xảy ra: {e}"))
            self.root.after(0, self.root.quit)

    def on_complete(self, exe_path):
        self.progress.stop()
        res = messagebox.askyesno(
            "Cài Đặt Thành Công",
            f"Chúc mừng! {APP_NAME} đã được cài đặt thành công trên máy tính.\\n\\nBạn có muốn khởi chạy {APP_NAME} ngay bây giờ không?"
        )
        if res:
            try:
                subprocess.Popen([str(exe_path)], cwd=str(TARGET_DIR))
            except Exception as e:
                print("Launch error:", e)
        self.root.quit()

if __name__ == "__main__":
    root = tk.Tk()
    app = InstallerApp(root)
    root.mainloop()
'''

    installer_file = Path("installer_gui.py")
    installer_file.write_text(installer_code, encoding="utf-8")

    print("[*] Compiling NovaOffice_Setup.exe via PyInstaller...")
    cmd = [
        "pyinstaller",
        "--noconfirm",
        "--onefile",
        "--windowed",
        "--name", "NovaOffice_Setup",
        "--icon", "app.ico",
        "--add-data", "installer_payload.zip;.",
        "--add-data", "app.ico;.",
        "installer_gui.py"
    ]
    res = subprocess.run(cmd)
    if res.returncode == 0:
        print("[*] Successfully built dist/NovaOffice_Setup.exe!")
        # Clean up temporary files
        if payload_zip.exists(): payload_zip.unlink()
        if installer_file.exists(): installer_file.unlink()
        return True
    else:
        print("[-] Failed to compile installer.")
        return False

if __name__ == "__main__":
    create_installer()
