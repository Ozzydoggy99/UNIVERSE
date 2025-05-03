#!/usr/bin/env python3
"""
Robot AI Self-Extracting Installer

This is a single file that unpacks itself and installs all Robot AI modules
directly on the robot's file system. Upload just this one file to your robot
and run it to get full functionality.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import time
import json
import base64
import zipfile
import logging
import tempfile
import subprocess
import shutil
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('robot-ai-installer')

# Installation paths
HOME_DIR = os.path.expanduser("~")
INSTALL_DIR = os.path.join(HOME_DIR, "robot-ai")
MODULE_DIR = os.path.join(INSTALL_DIR, "modules")
LOG_DIR = os.path.join(INSTALL_DIR, "logs")
WEB_PORT = 8080

# The complete robot-ai-v1.0.0.zip file contents as a base64 string
EMBEDDED_ZIP = """
# Base64-encoded content of robot-ai-v1.0.0.zip will be inserted here
"""

def print_banner():
    """Print installer banner"""
    print("=" * 60)
    print("Robot AI Self-Extracting Installer")
    print("=" * 60)
    print("This script will unpack and install all Robot AI modules.")
    print("Version: 1.0.0")
    print("=" * 60)

def extract_embedded_zip():
    """Extract the embedded ZIP file"""
    logger.info("Extracting embedded ZIP file")
    
    try:
        # Skip if the embed is just a placeholder
        if "# Base64-encoded content" in EMBEDDED_ZIP:
            logger.error("No embedded ZIP content found. This is just a placeholder file.")
            return None
        
        # Create a temporary directory
        temp_dir = tempfile.mkdtemp(prefix="robot-ai-")
        logger.info(f"Using temporary directory: {temp_dir}")
        
        # Decode the embedded ZIP
        zip_data = base64.b64decode(EMBEDDED_ZIP)
        zip_path = os.path.join(temp_dir, "robot-ai-v1.0.0.zip")
        
        # Write the ZIP file
        with open(zip_path, 'wb') as f:
            f.write(zip_data)
        
        logger.info(f"ZIP file extracted to: {zip_path}")
        
        # Extract the ZIP file
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
            
        logger.info(f"ZIP contents extracted to: {temp_dir}")
        
        return temp_dir
    except Exception as e:
        logger.error(f"Failed to extract ZIP: {e}")
        return None

def create_installation_directories():
    """Create installation directories"""
    logger.info(f"Creating installation directories at {INSTALL_DIR}")
    
    try:
        # Create main directories
        os.makedirs(INSTALL_DIR, exist_ok=True)
        os.makedirs(MODULE_DIR, exist_ok=True)
        os.makedirs(LOG_DIR, exist_ok=True)
        
        logger.info("Directories created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create directories: {e}")
        return False

def install_modules(extract_dir):
    """Install Robot AI modules from the extracted files"""
    logger.info("Installing Robot AI modules")
    
    try:
        # Copy modules
        modules_source = os.path.join(extract_dir, "modules")
        if os.path.exists(modules_source):
            # Copy each file individually to better handle errors
            for module_file in os.listdir(modules_source):
                source_path = os.path.join(modules_source, module_file)
                dest_path = os.path.join(MODULE_DIR, module_file)
                
                if os.path.isfile(source_path):
                    shutil.copy2(source_path, dest_path)
                    logger.info(f"Installed module: {module_file}")
        
        # Copy dashboard
        dashboard_source = os.path.join(extract_dir, "dashboard.html")
        if os.path.exists(dashboard_source):
            dashboard_dest = os.path.join(INSTALL_DIR, "dashboard.html")
            shutil.copy2(dashboard_source, dashboard_dest)
            logger.info("Installed dashboard")
        
        # Copy README
        readme_source = os.path.join(extract_dir, "README.md")
        if os.path.exists(readme_source):
            readme_dest = os.path.join(INSTALL_DIR, "README.md")
            shutil.copy2(readme_source, readme_dest)
            logger.info("Installed documentation")
        
        logger.info("All modules installed successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to install modules: {e}")
        return False

def create_startup_script():
    """Create startup script"""
    logger.info("Creating startup script")
    
    try:
        startup_script = f"""#!/bin/bash
# Robot AI Startup Script
# Start the Robot AI service

SCRIPT_DIR="{INSTALL_DIR}"
LOG_DIR="{LOG_DIR}"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Start Python server for web dashboard
cd "$SCRIPT_DIR"
python3 -m http.server {WEB_PORT} > "$LOG_DIR/web.log" 2>&1 &
echo $! > "$SCRIPT_DIR/web.pid"

# Start core module
cd "$SCRIPT_DIR"
if [ -f "$SCRIPT_DIR/modules/core.py" ]; then
    python3 -m modules.core > "$LOG_DIR/core.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/core.pid"
fi

echo "Robot AI services started"
echo "Web dashboard available at: http://localhost:{WEB_PORT}/dashboard.html"
"""
        
        startup_path = os.path.join(INSTALL_DIR, "start.sh")
        with open(startup_path, "w") as f:
            f.write(startup_script)
        
        # Make executable
        os.chmod(startup_path, 0o755)
        
        logger.info("Startup script created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create startup script: {e}")
        return False

def create_shutdown_script():
    """Create shutdown script"""
    logger.info("Creating shutdown script")
    
    try:
        shutdown_script = f"""#!/bin/bash
# Robot AI Shutdown Script
# Stop the Robot AI service

SCRIPT_DIR="{INSTALL_DIR}"

# Stop web server
if [ -f "$SCRIPT_DIR/web.pid" ]; then
    kill $(cat "$SCRIPT_DIR/web.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/web.pid"
fi

# Stop core module
if [ -f "$SCRIPT_DIR/core.pid" ]; then
    kill $(cat "$SCRIPT_DIR/core.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/core.pid"
fi

echo "Robot AI services stopped"
"""
        
        shutdown_path = os.path.join(INSTALL_DIR, "stop.sh")
        with open(shutdown_path, "w") as f:
            f.write(shutdown_script)
        
        # Make executable
        os.chmod(shutdown_path, 0o755)
        
        logger.info("Shutdown script created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create shutdown script: {e}")
        return False

def create_config():
    """Create configuration file"""
    logger.info("Creating configuration file")
    
    try:
        config = {
            "version": "1.0.0",
            "robot_ip": "localhost",
            "robot_port": 8090,
            "use_ssl": False,
            "web_port": WEB_PORT,
            "log_level": "INFO",
            "enable_camera": True,
            "enable_lidar": True,
            "enable_door_control": True,
            "enable_elevator_control": True,
            "enable_task_queue": True
        }
        
        config_path = os.path.join(INSTALL_DIR, "config.json")
        with open(config_path, "w") as f:
            json.dump(config, f, indent=4)
        
        logger.info("Configuration file created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create configuration file: {e}")
        return False
    
def create_robot_ai_init():
    """Create __init__.py for modules to make them importable"""
    logger.info("Creating module __init__.py file")
    
    try:
        init_path = os.path.join(MODULE_DIR, "__init__.py")
        with open(init_path, "w") as f:
            f.write("""# Robot AI Modules Package
__version__ = "1.0.0"
""")
        
        logger.info("Created __init__.py file successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create __init__.py file: {e}")
        return False

def start_services():
    """Start Robot AI services"""
    logger.info("Starting Robot AI services")
    
    try:
        startup_script = os.path.join(INSTALL_DIR, "start.sh")
        result = subprocess.run([startup_script], check=True, shell=True)
        
        if result.returncode == 0:
            logger.info("Robot AI services started successfully")
            return True
        else:
            logger.error(f"Failed to start services: Return code {result.returncode}")
            return False
    except Exception as e:
        logger.error(f"Failed to start services: {e}")
        return False

def main():
    """Main installer function"""
    print_banner()
    
    # Extract embedded ZIP
    extract_dir = extract_embedded_zip()
    if not extract_dir:
        logger.error("Failed to extract embedded ZIP. Installation aborted.")
        return False
    
    # Create installation directories
    if not create_installation_directories():
        logger.error("Failed to create installation directories. Installation aborted.")
        return False
    
    # Install modules
    if not install_modules(extract_dir):
        logger.error("Failed to install modules. Installation aborted.")
        return False
    
    # Create __init__.py for modules
    if not create_robot_ai_init():
        logger.warning("Failed to create __init__.py file. Some modules may not import correctly.")
    
    # Create startup script
    if not create_startup_script():
        logger.error("Failed to create startup script. Installation aborted.")
        return False
    
    # Create shutdown script
    if not create_shutdown_script():
        logger.error("Failed to create shutdown script. Installation aborted.")
        return False
    
    # Create configuration file
    if not create_config():
        logger.error("Failed to create configuration file. Installation aborted.")
        return False
    
    # Start services
    start_services()
    
    print("\nInstallation completed successfully!")
    print(f"Robot AI modules installed to: {INSTALL_DIR}")
    print(f"Dashboard is available at: http://localhost:{WEB_PORT}/dashboard.html")
    print("\nTo manually start Robot AI, run:")
    print(f"  {INSTALL_DIR}/start.sh")
    print("\nTo stop Robot AI, run:")
    print(f"  {INSTALL_DIR}/stop.sh")
    
    # Clean up
    try:
        shutil.rmtree(extract_dir)
        logger.info("Temporary files cleaned up")
    except Exception as e:
        logger.warning(f"Failed to clean up temporary files: {e}")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nInstallation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        sys.exit(1)