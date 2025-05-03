#!/usr/bin/env python3
"""
Robot AI Self-Unpacking Module Installer
This script unpacks all necessary AI modules to enhance your robot's capabilities.
Upload this single file to directly install all AI modules onto the robot.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import json
import base64
import time
import logging
import importlib.util
import subprocess
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

# Module contents (base64 encoded)
MODULE_CONTENTS = {
    "core.py": """
# This is where the base64-encoded content of modules/core.py will be placed
""",
    
    "camera.py": """
# This is where the base64-encoded content of modules/camera.py will be placed
""",
    
    "map.py": """
# This is where the base64-encoded content of modules/map.py will be placed
""",
    
    "door.py": """
# This is where the base64-encoded content of modules/door.py will be placed
""",
    
    "elevator.py": """
# This is where the base64-encoded content of modules/elevator.py will be placed
""",
    
    "task_queue.py": """
# This is where the base64-encoded content of modules/task_queue.py will be placed
""",
    
    "__init__.py": """
# Robot AI Modules Package
__version__ = "1.0.0"
"""
}

# Dashboard HTML content
DASHBOARD_HTML = """
# This is where the base64-encoded content of dashboard.html will be placed
"""

def print_banner():
    """Print installer banner"""
    print("=" * 60)
    print("Robot AI Self-Unpacking Module Installer")
    print("=" * 60)
    print("This script will unpack and install all Robot AI modules.")
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
        # Install each module
        for module_name, encoded_content in MODULE_CONTENTS.items():
            if "# This is where" in encoded_content:
                logger.warning(f"Module {module_name} has placeholder content - skipping")
                continue
                
            module_path = os.path.join(MODULE_DIR, module_name)
            
            try:
                # Decode and save module
                content = base64.b64decode(encoded_content).decode('utf-8')
                with open(module_path, 'w') as f:
                    f.write(content)
                logger.info(f"Installed module: {module_name}")
            except Exception as e:
                logger.error(f"Failed to install module {module_name}: {e}")
        
        # Install dashboard if available
        if "# This is where" not in DASHBOARD_HTML:
            dashboard_path = os.path.join(INSTALL_DIR, "dashboard.html")
            try:
                content = base64.b64decode(DASHBOARD_HTML).decode('utf-8')
                with open(dashboard_path, 'w') as f:
                    f.write(content)
                logger.info("Installed dashboard")
            except Exception as e:
                logger.error(f"Failed to install dashboard: {e}")
        
        logger.info("All available modules installed successfully")
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

# Start core module
cd "$SCRIPT_DIR"
PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH" python3 -m modules.core > "$LOG_DIR/core.log" 2>&1 &
echo $! > "$SCRIPT_DIR/core.pid"

echo "Robot AI core module started"
echo "Log file: $LOG_DIR/core.log"
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
            "robot_secret": "H3MN33L33E2CKNM37WQRZMR2KLAQECDD",
            "web_port": 8080,
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

def check_module_dependencies():
    """Check if required Python modules are installed"""
    required_modules = ["websockets", "requests", "numpy", "Pillow"]
    missing_modules = []
    
    for module_name in required_modules:
        if importlib.util.find_spec(module_name) is None:
            missing_modules.append(module_name)
    
    if missing_modules:
        logger.warning(f"Missing required Python modules: {', '.join(missing_modules)}")
        logger.info("Attempting to install missing modules...")
        
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing_modules)
            logger.info("Successfully installed missing modules")
        except Exception as e:
            logger.error(f"Failed to install modules: {e}")
            logger.error("Please install these modules manually: " + ", ".join(missing_modules))
            return False
    
    return True

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
    """Main installation function"""
    print_banner()
    
    # Check for module dependencies
    if not check_module_dependencies():
        logger.warning("Some dependencies are missing, but we'll continue anyway")
    
    # Create directories
    if not create_directories():
        logger.error("Failed to create directories. Installation aborted.")
        return False
    
    # Install modules
    if not install_modules():
        logger.warning("Some modules failed to install. Continuing with partial installation.")
    
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
    start_result = start_services()
    if not start_result:
        logger.warning("Failed to start services automatically. You can start them manually.")
    
    print("\nInstallation completed!")
    print(f"Robot AI modules installed to: {INSTALL_DIR}")
    print("\nTo manually start Robot AI, run:")
    print(f"  {INSTALL_DIR}/start.sh")
    print("\nTo stop Robot AI, run:")
    print(f"  {INSTALL_DIR}/stop.sh")
    
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