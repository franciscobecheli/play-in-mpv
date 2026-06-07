@echo off
setlocal
cd /d "%~dp0"
python install.py %*
if %errorlevel% neq 0 (
    echo.
    echo Installation failed.
    pause
    exit /b %errorlevel%
)
echo.
echo Press any key to exit...
pause >nul
