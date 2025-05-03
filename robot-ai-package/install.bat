@echo off
echo =============================================================
echo Robot AI Installer (Windows)
echo =============================================================
echo This script will install the Robot AI dashboard on your system.
echo.

:: Check if Python is installed
echo Checking for Python installation...
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Python not found! Please install Python 3.6 or later.
    echo Visit https://www.python.org/downloads/ to download Python.
    pause
    exit /b 1
)

:: Install required Python packages
echo Installing required Python packages...
python -m pip install requests > nul 2>&1

:: Extract the dashboard.html file
echo Extracting dashboard.html...
if exist dashboard.html (
    echo Dashboard already exists.
) else (
    echo Copying dashboard from package...
    copy /Y modules\dashboard.html dashboard.html > nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo Could not extract dashboard. Please check file permissions.
        pause
        exit /b 1
    )
)

:: Check robot connection
echo.
echo Please enter your robot's IP address (default: 192.168.4.31):
set /p ROBOT_IP=^> 
if "%ROBOT_IP%"=="" set ROBOT_IP=192.168.4.31

echo Testing connection to robot at %ROBOT_IP%...
python -c "import requests; response = requests.get('http://%ROBOT_IP%:8090/device/info', timeout=5); print('Connected successfully!' if response.status_code == 200 else 'Could not connect to robot.')" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Could not connect to robot. Please check the IP address and ensure the robot is powered on.
)

echo.
echo Installation complete!
echo.
echo To use the Robot AI dashboard:
echo 1. Open dashboard.html in your web browser
echo 2. Enter your robot's IP address: %ROBOT_IP%
echo 3. Click "Connect" to begin controlling your robot
echo.

:: Ask if user wants to open dashboard now
echo Would you like to open the dashboard now? (Y/N)
set /p OPEN_NOW=^> 
if /i "%OPEN_NOW%"=="Y" (
    echo Opening dashboard...
    start dashboard.html
)

echo.
echo Thank you for installing Robot AI!
pause