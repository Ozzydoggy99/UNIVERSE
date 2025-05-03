@echo off
setlocal enabledelayedexpansion

echo =========================================
echo   Robot AI Remote Installer (Windows)
echo =========================================

set ROBOT_IP=192.168.4.31
set ROBOT_USER=robot
set ROBOT_SN=L382502104987ir
set ROBOT_SECRET=%ROBOT_SECRET%

echo Robot IP: %ROBOT_IP%
echo Robot User: %ROBOT_USER%
echo Robot SN: %ROBOT_SN%
echo Authentication: Will use secret key
echo =========================================

REM Create a temporary Python installer script that can handle the authentication
echo import os, sys, requests, urllib3, json, time > temp_installer.py
echo from urllib3.exceptions import InsecureRequestWarning >> temp_installer.py
echo urllib3.disable_warnings(InsecureRequestWarning) >> temp_installer.py
echo. >> temp_installer.py
echo ROBOT_IP = "%ROBOT_IP%" >> temp_installer.py
echo ROBOT_SN = "%ROBOT_SN%" >> temp_installer.py
echo ROBOT_SECRET = os.environ.get("ROBOT_SECRET", "") >> temp_installer.py
echo. >> temp_installer.py
echo def install_robot_ai(): >> temp_installer.py
echo     print("Connecting to robot at {} using secret authentication...".format(ROBOT_IP)) >> temp_installer.py
echo     try: >> temp_installer.py
echo         # Test connection with authentication >> temp_installer.py
echo         headers = {"Authorization": "Secret " + ROBOT_SECRET} >> temp_installer.py
echo         response = requests.get("http://{}/device/info".format(ROBOT_IP), >> temp_installer.py
echo                               headers=headers, verify=False, timeout=10) >> temp_installer.py
echo         if response.status_code != 200: >> temp_installer.py
echo             print("Error: Could not authenticate with the robot. Status code: {}".format(response.status_code)) >> temp_installer.py
echo             return False >> temp_installer.py
echo. >> temp_installer.py
echo         robot_info = response.json() >> temp_installer.py
echo         print("Successfully connected to robot.") >> temp_installer.py
echo         print("Robot name: {}".format(robot_info.get("name", "Unknown"))) >> temp_installer.py
echo         print("Robot serial: {}".format(robot_info.get("serial", "Unknown"))) >> temp_installer.py
echo         print("Robot version: {}".format(robot_info.get("version", "Unknown"))) >> temp_installer.py
echo         print() >> temp_installer.py
echo. >> temp_installer.py
echo         # Create and upload installer files >> temp_installer.py
echo         print("Installing Robot AI package...") >> temp_installer.py
echo. >> temp_installer.py
echo         # Create a simple web interface >> temp_installer.py
echo         html_content = """<!DOCTYPE html> >> temp_installer.py
echo <html lang="en"> >> temp_installer.py
echo <head> >> temp_installer.py
echo     <meta charset="UTF-8"> >> temp_installer.py
echo     <meta name="viewport" content="width=device-width, initial-scale=1.0"> >> temp_installer.py
echo     <title>Robot AI Dashboard</title> >> temp_installer.py
echo     <style> >> temp_installer.py
echo         body { >> temp_installer.py
echo             font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; >> temp_installer.py
echo             line-height: 1.6; >> temp_installer.py
echo             color: #333; >> temp_installer.py
echo             max-width: 1200px; >> temp_installer.py
echo             margin: 0 auto; >> temp_installer.py
echo             padding: 20px; >> temp_installer.py
echo             background-color: #f5f5f5; >> temp_installer.py
echo         } >> temp_installer.py
echo.         >> temp_installer.py
echo         .container { >> temp_installer.py
echo             background: white; >> temp_installer.py
echo             border-radius: 8px; >> temp_installer.py
echo             padding: 20px; >> temp_installer.py
echo             box-shadow: 0 2px 10px rgba(0,0,0,0.1); >> temp_installer.py
echo         } >> temp_installer.py
echo.         >> temp_installer.py
echo         h1 { >> temp_installer.py
echo             color: #2563EB; >> temp_installer.py
echo             margin-top: 0; >> temp_installer.py
echo         } >> temp_installer.py
echo.         >> temp_installer.py
echo         .grid { >> temp_installer.py
echo             display: grid; >> temp_installer.py
echo             grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); >> temp_installer.py
echo             gap: 20px; >> temp_installer.py
echo             margin-top: 20px; >> temp_installer.py
echo         } >> temp_installer.py
echo.         >> temp_installer.py
echo         .card { >> temp_installer.py
echo             background: white; >> temp_installer.py
echo             border-radius: 8px; >> temp_installer.py
echo             padding: 20px; >> temp_installer.py
echo             box-shadow: 0 2px 6px rgba(0,0,0,0.1); >> temp_installer.py
echo         } >> temp_installer.py
echo.         >> temp_installer.py
echo         .card-header { >> temp_installer.py
echo             display: flex; >> temp_installer.py
echo             justify-content: space-between; >> temp_installer.py
echo             align-items: center; >> temp_installer.py
echo             margin-bottom: 15px; >> temp_installer.py
echo             padding-bottom: 10px; >> temp_installer.py
echo             border-bottom: 1px solid #e5e7eb; >> temp_installer.py
echo         } >> temp_installer.py
echo.         >> temp_installer.py
echo         .card-title { >> temp_installer.py
echo             margin: 0; >> temp_installer.py
echo             font-size: 18px; >> temp_installer.py
echo             font-weight: 600; >> temp_installer.py
echo         } >> temp_installer.py
echo.         >> temp_installer.py
echo         .status-badge { >> temp_installer.py
echo             display: inline-block; >> temp_installer.py
echo             padding: 4px 8px; >> temp_installer.py
echo             border-radius: 9999px; >> temp_installer.py
echo             font-size: 12px; >> temp_installer.py
echo             font-weight: 500; >> temp_installer.py
echo         } >> temp_installer.py
echo.         >> temp_installer.py
echo         .status-online { >> temp_installer.py
echo             background-color: #d1fae5; >> temp_installer.py
echo             color: #065f46; >> temp_installer.py
echo         } >> temp_installer.py
echo.         >> temp_installer.py
echo         .status-offline { >> temp_installer.py
echo             background-color: #fee2e2; >> temp_installer.py
echo             color: #b91c1c; >> temp_installer.py
echo         } >> temp_installer.py
echo     </style> >> temp_installer.py
echo </head> >> temp_installer.py
echo <body> >> temp_installer.py
echo     <div class="container"> >> temp_installer.py
echo         <h1>Robot AI Dashboard</h1> >> temp_installer.py
echo         <p>Enhanced autonomous robot control system</p> >> temp_installer.py
echo.         >> temp_installer.py
echo         <div class="grid"> >> temp_installer.py
echo             <div class="card"> >> temp_installer.py
echo                 <div class="card-header"> >> temp_installer.py
echo                     <h2 class="card-title">Robot Status</h2> >> temp_installer.py
echo                     <span id="status-badge" class="status-badge status-offline">Connecting...</span> >> temp_installer.py
echo                 </div> >> temp_installer.py
echo                 <div> >> temp_installer.py
echo                     <p><strong>Robot SN:</strong> <span id="robot-sn">Loading...</span></p> >> temp_installer.py
echo                     <p><strong>IP Address:</strong> <span id="robot-ip">Loading...</span></p> >> temp_installer.py
echo                     <p><strong>Status:</strong> <span id="connection-status">Initializing...</span></p> >> temp_installer.py
echo                     <p><strong>Battery:</strong> <span id="battery-level">Loading...</span></p> >> temp_installer.py
echo                 </div> >> temp_installer.py
echo             </div> >> temp_installer.py
echo.             >> temp_installer.py
echo             <div class="card"> >> temp_installer.py
echo                 <div class="card-header"> >> temp_installer.py
echo                     <h2 class="card-title">Navigation</h2> >> temp_installer.py
echo                 </div> >> temp_installer.py
echo                 <div> >> temp_installer.py
echo                     <p><strong>Current Position:</strong> <span id="position">Loading...</span></p> >> temp_installer.py
echo                     <p><strong>Current Map:</strong> <span id="current-map">Loading...</span></p> >> temp_installer.py
echo                     <p><strong>Movement Status:</strong> <span id="movement-status">Loading...</span></p> >> temp_installer.py
echo                 </div> >> temp_installer.py
echo             </div> >> temp_installer.py
echo.             >> temp_installer.py
echo             <div class="card"> >> temp_installer.py
echo                 <div class="card-header"> >> temp_installer.py
echo                     <h2 class="card-title">Camera Feed</h2> >> temp_installer.py
echo                 </div> >> temp_installer.py
echo                 <div> >> temp_installer.py
echo                     <p>Camera feed is available through the robot's API.</p> >> temp_installer.py
echo                 </div> >> temp_installer.py
echo             </div> >> temp_installer.py
echo.             >> temp_installer.py
echo             <div class="card"> >> temp_installer.py
echo                 <div class="card-header"> >> temp_installer.py
echo                     <h2 class="card-title">Task Queue</h2> >> temp_installer.py
echo                 </div> >> temp_installer.py
echo                 <div> >> temp_installer.py
echo                     <p>No tasks currently in queue.</p> >> temp_installer.py
echo                 </div> >> temp_installer.py
echo             </div> >> temp_installer.py
echo         </div> >> temp_installer.py
echo     </div> >> temp_installer.py
echo.     >> temp_installer.py
echo     <script> >> temp_installer.py
echo         // Configuration >> temp_installer.py
echo         const config = { >> temp_installer.py
echo             robotSn: "{sn}", >> temp_installer.py
echo             robotIp: "{ip}", >> temp_installer.py
echo             robotSecret: localStorage.getItem('robotSecret') || "" >> temp_installer.py
echo         }; >> temp_installer.py
echo.         >> temp_installer.py
echo         // Update UI elements >> temp_installer.py
echo         document.getElementById('robot-sn').textContent = config.robotSn; >> temp_installer.py
echo         document.getElementById('robot-ip').textContent = config.robotIp; >> temp_installer.py
echo         document.getElementById('battery-level').textContent = "Loading..."; >> temp_installer.py
echo         document.getElementById('position').textContent = "Loading..."; >> temp_installer.py
echo         document.getElementById('current-map').textContent = "Loading..."; >> temp_installer.py
echo         document.getElementById('movement-status').textContent = "Loading..."; >> temp_installer.py
echo.         >> temp_installer.py
echo         // Function to check robot connection >> temp_installer.py
echo         async function checkRobotConnection() {{ >> temp_installer.py
echo             document.getElementById('connection-status').textContent = "Checking connection..."; >> temp_installer.py
echo             const statusBadge = document.getElementById('status-badge'); >> temp_installer.py
echo.             >> temp_installer.py
echo             try {{ >> temp_installer.py
echo                 const response = await fetch(`http://${{config.robotIp}}/device/info`, {{ >> temp_installer.py
echo                     headers: {{ >> temp_installer.py
echo                         'Authorization': `Secret ${{config.robotSecret}}` >> temp_installer.py
echo                     }} >> temp_installer.py
echo                 }}); >> temp_installer.py
echo.                 >> temp_installer.py
echo                 if (response.ok) {{ >> temp_installer.py
echo                     const data = await response.json(); >> temp_installer.py
echo                     document.getElementById('connection-status').textContent = "Connected"; >> temp_installer.py
echo                     statusBadge.textContent = "Online"; >> temp_installer.py
echo                     statusBadge.classList.remove('status-offline'); >> temp_installer.py
echo                     statusBadge.classList.add('status-online'); >> temp_installer.py
echo                     return true; >> temp_installer.py
echo                 }} else {{ >> temp_installer.py
echo                     throw new Error(`HTTP error: ${{response.status}}`); >> temp_installer.py
echo                 }} >> temp_installer.py
echo             }} catch (error) {{ >> temp_installer.py
echo                 console.error('Connection error:', error); >> temp_installer.py
echo                 document.getElementById('connection-status').textContent = "Disconnected"; >> temp_installer.py
echo                 statusBadge.textContent = "Offline"; >> temp_installer.py
echo                 statusBadge.classList.remove('status-online'); >> temp_installer.py
echo                 statusBadge.classList.add('status-offline'); >> temp_installer.py
echo                 return false; >> temp_installer.py
echo             }} >> temp_installer.py
echo         }} >> temp_installer.py
echo.         >> temp_installer.py
echo         // Check connection periodically >> temp_installer.py
echo         setInterval(checkRobotConnection, 5000); >> temp_installer.py
echo.         >> temp_installer.py
echo         // Initial connection check >> temp_installer.py
echo         checkRobotConnection(); >> temp_installer.py
echo         console.log("Robot AI Dashboard initialized"); >> temp_installer.py
echo     </script> >> temp_installer.py
echo </body> >> temp_installer.py
echo </html> >> temp_installer.py
echo """ >> temp_installer.py
echo. >> temp_installer.py
echo         # Replace placeholders with actual values >> temp_installer.py
echo         html_content = html_content.replace("{sn}", ROBOT_SN).replace("{ip}", ROBOT_IP) >> temp_installer.py
echo. >> temp_installer.py
echo         # Define the payload for the installation request >> temp_installer.py
echo         payload = {{ >> temp_installer.py
echo             "html_content": html_content, >> temp_installer.py
echo             "robot_sn": ROBOT_SN, >> temp_installer.py
echo             "robot_ip": ROBOT_IP, >> temp_installer.py
echo             "install_port": 8080 >> temp_installer.py
echo         }} >> temp_installer.py
echo. >> temp_installer.py
echo         # Send the installation request >> temp_installer.py
echo         print("Uploading installation package to robot...") >> temp_installer.py
echo         headers = {{"Authorization": "Secret " + ROBOT_SECRET, "Content-Type": "application/json"}} >> temp_installer.py
echo         install_response = requests.post( >> temp_installer.py
echo             "http://{}/api/custom/install".format(ROBOT_IP), >> temp_installer.py
echo             headers=headers, >> temp_installer.py
echo             json=payload, >> temp_installer.py
echo             verify=False, >> temp_installer.py
echo             timeout=30 >> temp_installer.py
echo         ) >> temp_installer.py
echo. >> temp_installer.py
echo         if install_response.status_code == 200: >> temp_installer.py
echo             print("Robot AI package installed successfully!") >> temp_installer.py
echo             print("Web interface available at: http://{}:8080".format(ROBOT_IP)) >> temp_installer.py
echo             print() >> temp_installer.py
echo             print("Opening web interface...") >> temp_installer.py
echo             try: >> temp_installer.py
echo                 import webbrowser >> temp_installer.py
echo                 webbrowser.open("http://{}:8080".format(ROBOT_IP)) >> temp_installer.py
echo             except: >> temp_installer.py
echo                 print("Could not automatically open browser. Please visit http://{}:8080 manually.".format(ROBOT_IP)) >> temp_installer.py
echo             return True >> temp_installer.py
echo         else: >> temp_installer.py
echo             print("Error installing Robot AI package. Status code: {}".format(install_response.status_code)) >> temp_installer.py
echo             print("Response: {}".format(install_response.text)) >> temp_installer.py
echo             return False >> temp_installer.py
echo. >> temp_installer.py
echo     except Exception as e: >> temp_installer.py
echo         print("Error: {}".format(str(e))) >> temp_installer.py
echo         return False >> temp_installer.py
echo. >> temp_installer.py
echo if __name__ == "__main__": >> temp_installer.py
echo     if not ROBOT_SECRET: >> temp_installer.py
echo         print("Error: ROBOT_SECRET environment variable is not set") >> temp_installer.py
echo         sys.exit(1) >> temp_installer.py
echo. >> temp_installer.py
echo     install_robot_ai() >> temp_installer.py
echo     input("Press Enter to exit...") >> temp_installer.py

echo =========================================
echo   Launching Robot AI Installer...
echo =========================================

REM Run the Python installer script with the secret
set ROBOT_SECRET=%ROBOT_SECRET%
python temp_installer.py

REM Clean up temporary script
del temp_installer.py

echo.
echo =========================================
echo   Installation process complete!
echo =========================================
pause