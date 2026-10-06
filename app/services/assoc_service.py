import os
import sys
from pathlib import Path

def get_default_exe_path() -> str:
    """Returns the most appropriate path to NovaOffice executable."""
    if getattr(sys, 'frozen', False):
        return sys.executable
    
    local_app_exe = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "NovaOffice" / "NovaOffice.exe"
    if local_app_exe.exists():
        return str(local_app_exe)
    
    dist_exe = Path("dist/NovaOffice/NovaOffice.exe")
    if dist_exe.exists():
        return str(dist_exe.resolve())
        
    portable_exe = Path("dist/NovaOffice_Portable.exe")
    if portable_exe.exists():
        return str(portable_exe.resolve())
        
    return sys.executable

def notify_shell_change():
    """Notifies Windows Explorer to reload icons and file association cache."""
    try:
        import ctypes
        # SHCNE_ASSOCCHANGED = 0x08000000, SHCNF_IDLIST = 0x0000
        ctypes.windll.shell32.SHChangeNotify(0x08000000, 0x0000, None, None)
    except Exception:
        pass

def register_file_associations(exe_path: str = None) -> bool:
    """
    Registers NovaOffice file associations and right-click context menu
    in HKEY_CURRENT_USER\\Software\\Classes (requires zero admin rights).
    """
    if sys.platform != "win32":
        return False

    try:
        import winreg
    except ImportError:
        return False

    if not exe_path:
        exe_path = get_default_exe_path()
        
    exe_str = str(Path(exe_path).resolve())
    quoted_exe = f'"{exe_str}"'
    open_cmd = f'{quoted_exe} "%1"'

    prog_ids = {
        "NovaOffice.Doc": ("Tài liệu Word (NovaOffice)", [".docx", ".doc", ".txt", ".md"]),
        "NovaOffice.Sheet": ("Bảng tính Excel (NovaOffice)", [".xlsx", ".xls", ".csv"]),
        "NovaOffice.Slide": ("Trình chiếu PowerPoint (NovaOffice)", [".pptx", ".ppt"]),
        "NovaOffice.PDF": ("Tài liệu PDF (NovaOffice)", [".pdf"]),
    }

    try:
        # 1. Register ProgIDs under HKCU\Software\Classes
        for prog_id, (desc, exts) in prog_ids.items():
            # Class root
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"Software\Classes\{prog_id}") as key:
                winreg.SetValue(key, "", winreg.REG_SZ, desc)

            # Icon
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"Software\Classes\{prog_id}\DefaultIcon") as key:
                winreg.SetValue(key, "", winreg.REG_SZ, f'{quoted_exe},0')

            # Open command
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"Software\Classes\{prog_id}\shell\open\command") as key:
                winreg.SetValue(key, "", winreg.REG_SZ, open_cmd)

            # Associate file extensions under OpenWithProgids
            for ext in exts:
                with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"Software\Classes\{ext}\OpenWithProgids") as key:
                    winreg.SetValueEx(key, prog_id, 0, winreg.REG_NONE, b"")

        # 2. Register Right-click Context Menu ("Mở bằng NovaOffice") on all files (*)
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Classes\*\shell\NovaOffice") as key:
            winreg.SetValue(key, "", winreg.REG_SZ, "Mở bằng NovaOffice")
            winreg.SetValueEx(key, "Icon", 0, winreg.REG_SZ, exe_str)

        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Classes\*\shell\NovaOffice\command") as key:
            winreg.SetValue(key, "", winreg.REG_SZ, open_cmd)

        # 3. Register Application ProgID
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Classes\Applications\NovaOffice.exe\shell\open\command") as key:
            winreg.SetValue(key, "", winreg.REG_SZ, open_cmd)

        notify_shell_change()
        return True
    except Exception as e:
        print(f"Error registering file associations: {e}")
        return False

def unregister_file_associations() -> bool:
    """Removes NovaOffice file associations and context menu from HKCU."""
    if sys.platform != "win32":
        return False

    try:
        import winreg
    except ImportError:
        return False

    def delete_key_tree(root, path):
        try:
            with winreg.OpenKey(root, path, 0, winreg.KEY_ALL_ACCESS) as key:
                while True:
                    try:
                        sub = winreg.EnumKey(key, 0)
                        delete_key_tree(root, f"{path}\\{sub}")
                    except OSError:
                        break
            winreg.DeleteKey(root, path)
        except OSError:
            pass

    try:
        # Delete context menu
        delete_key_tree(winreg.HKEY_CURRENT_USER, r"Software\Classes\*\shell\NovaOffice")
        delete_key_tree(winreg.HKEY_CURRENT_USER, r"Software\Classes\Applications\NovaOffice.exe")

        # Delete ProgIDs
        for prog_id in ["NovaOffice.Doc", "NovaOffice.Sheet", "NovaOffice.Slide", "NovaOffice.PDF"]:
            delete_key_tree(winreg.HKEY_CURRENT_USER, rf"Software\Classes\{prog_id}")

        # Delete OpenWithProgids entries
        for ext in [".docx", ".doc", ".xlsx", ".xls", ".csv", ".pptx", ".ppt", ".pdf", ".txt", ".md"]:
            try:
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, rf"Software\Classes\{ext}\OpenWithProgids", 0, winreg.KEY_ALL_ACCESS) as key:
                    for prog_id in ["NovaOffice.Doc", "NovaOffice.Sheet", "NovaOffice.Slide", "NovaOffice.PDF"]:
                        try:
                            winreg.DeleteValue(key, prog_id)
                        except OSError:
                            pass
            except OSError:
                pass

        notify_shell_change()
        return True
    except Exception as e:
        print(f"Error unregistering file associations: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--unregister":
        success = unregister_file_associations()
        print("Unregistered file associations:", success)
    else:
        path = sys.argv[1] if len(sys.argv) > 1 else None
        success = register_file_associations(path)
        print("Registered file associations:", success)
