#!/usr/bin/env python3
"""
Robot AI Package Installer
This script handles installation and setup of the Robot AI package on the robot.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import json
import time
import logging
import shutil
import subprocess
import argparse
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('robot-ai-install.log')
    ]
)
logger = logging.getLogger('robot-ai-installer')

# Installation paths
INSTALL_DIR = "/home/robot/robot-ai"
MODULE_DIR = f"{INSTALL_DIR}/modules"
LOG_DIR = f"{INSTALL_DIR}/logs"

def print_banner():
    """Print installer banner"""
    print("=" * 60)
    print("Robot AI Package Installer")
    print("=" * 60)
    print("This script will install the Robot AI package on your robot.")
    print("Version: 1.0.0")
    print("=" * 60)
    
def create_directories():
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

def install_modules():
    """Install Robot AI modules"""
    logger.info("Installing Robot AI modules")
    
    try:
        # Copy module files from package
        module_files = [
            "core.py",
            "camera.py",
            "door.py",
            "elevator.py",
            "map.py",
            "task_queue.py"
        ]
        
        package_dir = Path(__file__).parent
        
        for module in module_files:
            source = package_dir / "modules" / module
            destination = Path(MODULE_DIR) / module
            
            logger.info(f"Installing {module}")
            shutil.copy(source, destination)
        
        # Copy dashboard
        dashboard_source = package_dir / "dashboard.html"
        dashboard_dest = Path(INSTALL_DIR) / "dashboard.html"
        shutil.copy(dashboard_source, dashboard_dest)
        
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
python3 -m http.server 8080 > "$LOG_DIR/web.log" 2>&1 &
echo $! > "$SCRIPT_DIR/web.pid"

# Start core module
cd "$SCRIPT_DIR"
python3 -m modules.core > "$LOG_DIR/core.log" 2>&1 &
echo $! > "$SCRIPT_DIR/core.pid"

echo "Robot AI services started"
echo "Web dashboard available at: http://localhost:8080/dashboard.html"
"""
        
        startup_path = Path(INSTALL_DIR) / "start.sh"
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
        
        shutdown_path = Path(INSTALL_DIR) / "stop.sh"
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
            "web_port": 8080,
            "log_level": "INFO",
            "enable_camera": True,
            "enable_lidar": True,
            "enable_door_control": True,
            "enable_elevator_control": True,
            "enable_task_queue": True
        }
        
        config_path = Path(INSTALL_DIR) / "config.json"
        with open(config_path, "w") as f:
            json.dump(config, f, indent=4)
        
        logger.info("Configuration file created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create configuration file: {e}")
        return False

def start_services():
    """Start Robot AI services"""
    logger.info("Starting Robot AI services")
    
    try:
        startup_script = Path(INSTALL_DIR) / "start.sh"
        result = subprocess.run([str(startup_script)], check=True, shell=True)
        
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
    """Main installation function"""
    print_banner()
    
    # Create directories
    if not create_directories():
        logger.error("Failed to create directories. Installation aborted.")
        return False
    
    # Install modules
    if not install_modules():
        logger.error("Failed to install modules. Installation aborted.")
        return False
    
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
    print(f"Robot AI dashboard is available at: http://localhost:8080/dashboard.html")
    print(f"Installation directory: {INSTALL_DIR}")
    print("\nTo start Robot AI manually, run:")
    print(f"  {INSTALL_DIR}/start.sh")
    print("\nTo stop Robot AI, run:")
    print(f"  {INSTALL_DIR}/stop.sh")
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Robot AI Package Installer")
    parser.add_argument("--no-start", action="store_true", help="Do not start services after installation")
    args = parser.parse_args()
    
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nInstallation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        sys.exit(1)