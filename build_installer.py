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

    if not Path("installer_gui.py").exists():
        print("Error: installer_gui.py not found!")
        return False

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
        if payload_zip.exists():
            payload_zip.unlink()
        return True
    else:
        print("[-] Failed to compile installer.")
        return False

if __name__ == "__main__":
    create_installer()
