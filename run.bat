@echo off
title NovaOffice Suite
echo ========================================================
echo          NOVAOFFICE SUITE - HE THONG VAN PHONG
echo ========================================================
echo Dang kiem tra moi truong Python...

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Python! Vui long cai dat Python 3.10+ de tiep tuc.
    pause
    exit /b 1
)

echo Dang khoi dong NovaOffice...
python main.py
pause
