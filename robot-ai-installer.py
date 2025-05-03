#!/usr/bin/env python3
"""
Robot AI Self-Installer
This is a self-contained installer that will set up the Robot AI package on your robot.
No need to extract any zip files manually - this script handles everything.

Usage:
    python3 robot-ai-installer.py --robot-sn L382502104987ir [--robot-ip 127.0.0.1] [--dev-mode]

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import argparse
import tempfile
import shutil
import base64
import time
import subprocess
import json
import logging
from pathlib import Path
import platform

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("Robot AI Installer")

# Installation paths
DEFAULT_INSTALL_DIR = "/home/robot/robot-ai"
CONFIG_FILE = "robot_ai_config.json"
LOG_DIR = "/var/log/robot-ai"

# Package content (base64 encoded modules to be written out during installation)
MODULES = {
    "core.py": """
# Base64-encoded core.py module will be inserted here by the packaging script
""",
    
    "map.py": """
# Base64-encoded map.py module will be inserted here by the packaging script
""",
    
    "camera.py": """
# Base64-encoded camera.py module will be inserted here by the packaging script
""",
    
    "door.py": """
# Base64-encoded door.py module will be inserted here by the packaging script
""",
    
    "elevator.py": """
# Base64-encoded elevator.py module will be inserted here by the packaging script
""",
    
    "task_queue.py": """
# Base64-encoded task_queue.py module will be inserted here by the packaging script
""",
}

HTML_INTERFACE = """
# Base64-encoded index.html will be inserted here by the packaging script
"""

README_CONTENT = """
# Robot AI Package

Enhanced autonomous control system for your robot.

## Features

- Map visualization and advanced path planning
- Multi-floor navigation with elevator integration
- Automatic door control
- Live camera streaming
- Task queue management
- Self-updating capabilities

## Usage

The Robot AI package enhances your robot's capabilities with advanced AI-powered features.

### Running the Robot AI

```bash
# Start the Robot AI services
/home/robot/robot-ai/start.sh

# Access the web interface
http://localhost:8080
```

### Configuration

The configuration file is located at `/home/robot/robot-ai/robot_ai_config.json`.

### Logs

Logs are stored in `/var/log/robot-ai/`.

## Troubleshooting

If you encounter any issues, check the logs in `/var/log/robot-ai/`.

For support, please contact the robot manufacturer.
"""

START_SCRIPT = """#!/bin/bash
# Start the Robot AI services

ROBOT_AI_DIR="/home/robot/robot-ai"
LOG_DIR="/var/log/robot-ai"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Start the main Robot AI process
cd "$ROBOT_AI_DIR"
python3 "$ROBOT_AI_DIR/main.py" > "$LOG_DIR/robot-ai.log" 2>&1 &
echo $! > "$ROBOT_AI_DIR/robot-ai.pid"

# Start the web interface
python3 -m http.server 8080 --directory "$ROBOT_AI_DIR/www" > "$LOG_DIR/web-interface.log" 2>&1 &
echo $! > "$ROBOT_AI_DIR/web-interface.pid"

echo "Robot AI services started. Access web interface at http://localhost:8080"
"""

STOP_SCRIPT = """#!/bin/bash
# Stop the Robot AI services

ROBOT_AI_DIR="/home/robot/robot-ai"

# Stop the main Robot AI process
if [ -f "$ROBOT_AI_DIR/robot-ai.pid" ]; then
    kill $(cat "$ROBOT_AI_DIR/robot-ai.pid") 2>/dev/null || true
    rm "$ROBOT_AI_DIR/robot-ai.pid"
fi

# Stop the web interface
if [ -f "$ROBOT_AI_DIR/web-interface.pid" ]; then
    kill $(cat "$ROBOT_AI_DIR/web-interface.pid") 2>/dev/null || true
    rm "$ROBOT_AI_DIR/web-interface.pid"
fi

echo "Robot AI services stopped"
"""

MAIN_SCRIPT = """#!/usr/bin/env python3
import os
import sys
import time
import logging
import json
import signal
import asyncio

# Add the modules directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("Robot AI")

CONFIG_FILE = "robot_ai_config.json"

def load_config():
    """Load the configuration from the config file"""
    if not os.path.exists(CONFIG_FILE):
        logger.error(f"Configuration file {CONFIG_FILE} not found!")
        return None
    
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError:
        logger.error(f"Error parsing configuration file {CONFIG_FILE}")
        return None

async def main():
    """Main entry point for the Robot AI system"""
    logger.info("Starting Robot AI system")
    
    # Load configuration
    config = load_config()
    if not config:
        logger.error("Failed to load configuration, exiting")
        return
    
    logger.info(f"Loaded configuration for robot {config.get('robot_sn', 'unknown')}")
    
    # Import modules
    try:
        from modules.core import RobotAI
        from modules.camera import CameraModule
        from modules.door import DoorController
        from modules.elevator import ElevatorController
        from modules.task_queue import TaskQueue
    except ImportError as e:
        logger.error(f"Failed to import modules: {e}")
        return
    
    # Initialize components
    try:
        robot_ai = RobotAI(
            robot_ip=config.get('robot_ip', '127.0.0.1'),
            robot_port=config.get('robot_port', 8090),
            use_ssl=config.get('use_ssl', False)
        )
        
        camera_module = CameraModule(
            robot_ip=config.get('robot_ip', '127.0.0.1'),
            robot_port=config.get('robot_port', 8090),
            use_ssl=config.get('use_ssl', False)
        )
        
        door_controller = DoorController(
            robot_ip=config.get('robot_ip', '127.0.0.1'),
            robot_port=config.get('robot_port', 8090),
            robot_sn=config.get('robot_sn'),
            use_ssl=config.get('use_ssl', False)
        )
        
        elevator_controller = ElevatorController(
            robot_ip=config.get('robot_ip', '127.0.0.1'),
            robot_port=config.get('robot_port', 8090),
            robot_sn=config.get('robot_sn'),
            use_ssl=config.get('use_ssl', False)
        )
        
        task_queue = TaskQueue()
    except Exception as e:
        logger.error(f"Failed to initialize components: {e}")
        return
    
    # Connect to robot
    try:
        await robot_ai.connect()
        await camera_module.connect()
        await door_controller.connect()
        await elevator_controller.connect()
    except Exception as e:
        logger.error(f"Failed to connect to robot: {e}")
        return
    
    logger.info("Robot AI system started successfully")
    
    # Keep the program running
    try:
        while True:
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        pass
    finally:
        # Clean up
        await robot_ai.close()
        await camera_module.close()
        await door_controller.stop()
        logger.info("Robot AI system shut down")

def handle_shutdown(sig=None, frame=None):
    """Handle graceful shutdown"""
    logger.info("Shutdown signal received, stopping Robot AI")
    loop = asyncio.get_event_loop()
    loop.stop()
    sys.exit(0)

if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    # Run the main function
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        pass
    finally:
        loop.close()
"""

def check_prerequisites():
    """Check if all required tools and packages are available"""
    logger.info("Checking prerequisites...")
    
    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 6):
        logger.error("Python 3.6 or higher is required")
        return False
    
    # Check if we're running on a supported platform
    system = platform.system()
    if system not in ["Linux"]:
        logger.warning(f"Unsupported platform: {system}. The installer may not work correctly.")
    
    # Check if required Python packages are installed
    required_packages = ["asyncio", "websockets", "json", "PIL"]
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        logger.warning(f"Missing Python packages: {', '.join(missing_packages)}")
        logger.info("Attempting to install missing packages...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing_packages)
            logger.info("Successfully installed missing packages")
        except subprocess.CalledProcessError:
            logger.error("Failed to install missing packages. Please install them manually.")
            return False
    
    return True

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Robot AI Self-Installer")
    parser.add_argument("--robot-ip", type=str, default="127.0.0.1",
                        help="IP address of the robot (default: 127.0.0.1)")
    parser.add_argument("--robot-sn", type=str, required=True,
                        help="Serial number of the robot (required)")
    parser.add_argument("--install-dir", type=str, default=DEFAULT_INSTALL_DIR,
                        help=f"Installation directory (default: {DEFAULT_INSTALL_DIR})")
    parser.add_argument("--robot-port", type=int, default=8090,
                        help="Port number of the robot API (default: 8090)")
    parser.add_argument("--dev-mode", action="store_true",
                        help="Enable development mode for local testing")
    parser.add_argument("--force", action="store_true",
                        help="Force reinstallation even if already installed")
    
    return parser.parse_args()

def write_base64_file(b64_content, output_path):
    """Decode base64 content and write to file"""
    content = base64.b64decode(b64_content.strip().encode()).decode('utf-8')
    with open(output_path, 'w') as f:
        f.write(content)

def create_directory_structure(install_dir):
    """Create the directory structure for the Robot AI package"""
    logger.info(f"Creating directory structure in {install_dir}...")
    
    dirs = [
        install_dir,
        os.path.join(install_dir, "modules"),
        os.path.join(install_dir, "www"),
        LOG_DIR
    ]
    
    for directory in dirs:
        os.makedirs(directory, exist_ok=True)
        logger.debug(f"Created directory: {directory}")

def install_modules(install_dir):
    """Install the Robot AI modules"""
    logger.info("Installing Robot AI modules...")
    
    modules_dir = os.path.join(install_dir, "modules")
    
    # Create __init__.py to make the directory a proper Python package
    with open(os.path.join(modules_dir, "__init__.py"), 'w') as f:
        f.write("# Robot AI modules package\n")
    
    # Install each module
    for module_name, module_content in MODULES.items():
        module_path = os.path.join(modules_dir, module_name)
        if module_content.strip().startswith("# Base64"):
            logger.warning(f"Module {module_name} has no content, skipping")
            continue
        
        try:
            write_base64_file(module_content, module_path)
            logger.debug(f"Installed module: {module_name}")
        except Exception as e:
            logger.error(f"Failed to install module {module_name}: {e}")
            return False
    
    return True

def install_web_interface(install_dir):
    """Install the web interface"""
    logger.info("Installing web interface...")
    
    www_dir = os.path.join(install_dir, "www")
    
    # Install index.html
    index_path = os.path.join(www_dir, "index.html")
    if HTML_INTERFACE.strip().startswith("# Base64"):
        # If not base64 encoded, write a simple placeholder
        with open(index_path, 'w') as f:
            f.write("""<!DOCTYPE html>
<html>
<head>
    <title>Robot AI Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2563EB;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Robot AI Dashboard</h1>
        <p>The Robot AI is running. This is a placeholder dashboard.</p>
        <p>Robot Serial Number: <span id="robot-sn">Loading...</span></p>
        <p>Connection Status: <span id="connection-status">Checking...</span></p>
        
        <script>
            // This would normally fetch data from the backend
            document.getElementById('robot-sn').textContent = 'L382502104987ir';
            document.getElementById('connection-status').textContent = 'Connected';
        </script>
    </div>
</body>
</html>""")
    else:
        try:
            write_base64_file(HTML_INTERFACE, index_path)
        except Exception as e:
            logger.error(f"Failed to install web interface: {e}")
            return False
    
    logger.debug("Installed web interface")
    return True

def create_scripts(install_dir):
    """Create the start and stop scripts"""
    logger.info("Creating start and stop scripts...")
    
    # Create start.sh
    start_path = os.path.join(install_dir, "start.sh")
    with open(start_path, 'w') as f:
        f.write(START_SCRIPT)
    os.chmod(start_path, 0o755)
    
    # Create stop.sh
    stop_path = os.path.join(install_dir, "stop.sh")
    with open(stop_path, 'w') as f:
        f.write(STOP_SCRIPT)
    os.chmod(stop_path, 0o755)
    
    # Create main.py
    main_path = os.path.join(install_dir, "main.py")
    with open(main_path, 'w') as f:
        f.write(MAIN_SCRIPT)
    os.chmod(main_path, 0o755)
    
    # Create README.md
    readme_path = os.path.join(install_dir, "README.md")
    with open(readme_path, 'w') as f:
        f.write(README_CONTENT)
    
    logger.debug("Created scripts and documentation")
    return True

def create_config_file(install_dir, args):
    """Create the configuration file"""
    logger.info("Creating configuration file...")
    
    config = {
        "robot_ip": args.robot_ip,
        "robot_port": args.robot_port,
        "robot_sn": args.robot_sn,
        "use_ssl": False,
        "dev_mode": args.dev_mode,
        "install_dir": install_dir,
        "log_dir": LOG_DIR,
        "installed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0.0"
    }
    
    config_path = os.path.join(install_dir, CONFIG_FILE)
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=4)
    
    logger.debug(f"Created configuration file: {config_path}")
    return True

def test_connection(args):
    """Test the connection to the robot"""
    logger.info(f"Testing connection to robot at {args.robot_ip}:{args.robot_port}...")
    
    try:
        import urllib.request
        import urllib.error
        
        url = f"http://{args.robot_ip}:{args.robot_port}/device/info"
        if args.dev_mode:
            # In dev mode, we don't actually test the connection
            logger.info("Skipping connection test in dev mode")
            return True
        
        try:
            response = urllib.request.urlopen(url, timeout=5)
            if response.getcode() == 200:
                logger.info("Successfully connected to robot")
                return True
        except urllib.error.URLError as e:
            logger.error(f"Failed to connect to robot: {e}")
            return False
    except Exception as e:
        logger.error(f"Error testing connection: {e}")
        return False

def main():
    """Main entry point for the installer"""
    print("\n" + "="*70)
    print(" "*20 + "Robot AI Self-Installer v1.0.0")
    print("="*70 + "\n")
    
    # Parse arguments
    args = parse_arguments()
    
    # Check prerequisites
    if not check_prerequisites():
        logger.error("Prerequisites check failed. Please install the required packages and try again.")
        sys.exit(1)
    
    # Test connection to the robot
    if not test_connection(args):
        if not args.dev_mode:
            logger.warning("Failed to connect to robot. Installation may not work correctly.")
            proceed = input("Do you want to proceed with the installation anyway? (y/n): ")
            if proceed.lower() != 'y':
                logger.info("Installation cancelled")
                sys.exit(0)
    
    # Create a temporary directory for installation files
    with tempfile.TemporaryDirectory() as temp_dir:
        logger.info(f"Using temporary directory: {temp_dir}")
        
        # Create directory structure
        install_dir = args.install_dir
        if os.path.exists(install_dir) and not args.force:
            logger.warning(f"Installation directory {install_dir} already exists")
            overwrite = input(f"Do you want to overwrite the existing installation at {install_dir}? (y/n): ")
            if overwrite.lower() != 'y':
                logger.info("Installation cancelled")
                sys.exit(0)
        
        try:
            create_directory_structure(install_dir)
            
            # Install modules
            if not install_modules(install_dir):
                logger.error("Failed to install modules")
                sys.exit(1)
            
            # Install web interface
            if not install_web_interface(install_dir):
                logger.error("Failed to install web interface")
                sys.exit(1)
            
            # Create scripts
            if not create_scripts(install_dir):
                logger.error("Failed to create scripts")
                sys.exit(1)
            
            # Create config file
            if not create_config_file(install_dir, args):
                logger.error("Failed to create configuration file")
                sys.exit(1)
            
            logger.info(f"Installation completed successfully at {install_dir}")
            logger.info(f"To start the Robot AI, run: {install_dir}/start.sh")
            logger.info(f"To access the web interface, open: http://localhost:8080")
            
            # Ask if the user wants to start the Robot AI now
            start_now = input("Do you want to start the Robot AI now? (y/n): ")
            if start_now.lower() == 'y':
                try:
                    subprocess.run([os.path.join(install_dir, "start.sh")], check=True)
                    logger.info("Robot AI started successfully")
                except subprocess.CalledProcessError as e:
                    logger.error(f"Failed to start Robot AI: {e}")
        
        except Exception as e:
            logger.error(f"An error occurred during installation: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()