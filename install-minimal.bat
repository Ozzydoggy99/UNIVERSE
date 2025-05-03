@echo off
echo ============================================================
echo Minimal Robot AI Installer - Windows Batch File
echo ============================================================
echo This script will install Python dependencies and run the minimal installer
echo.

echo Checking if Python is installed...
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not found in PATH.
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

echo Installing required packages...
pip install requests
if %errorlevel% neq 0 (
    echo Failed to install required packages.
    pause
    exit /b 1
)

echo.
echo Running the Minimal Robot AI installer...
echo.
python minimal-installer.py

echo.
if %errorlevel% neq 0 (
    echo Installation failed.
) else (
    echo Installation completed!
)

pause