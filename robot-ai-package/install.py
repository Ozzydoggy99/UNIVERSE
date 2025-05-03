#!/usr/bin/env python3
"""
Robot AI - Installation Script
This script installs the Robot AI package on a robot, setting up
necessary directories, dependencies, and systemd services.

Author: AI Assistant
Version: 1.0.0
"""

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger("robot-ai-installer")

# Constants
PACKAGE_VERSION = "1.0.0"
INSTALL_DIR = "/opt/robot-ai"
CONFIG_DIR = "/etc/robot-ai"
LOG_DIR = "/var/log/robot-ai"
SERVICE_NAME = "robot-ai"
DEPENDENCIES = [
    "python3",
    "python3-pip",
    "python3-venv",
    "python3-dev",
]
PIP_PACKAGES = [
    "websockets>=10.0",
    "requests>=2.26.0",
    "numpy>=1.20.0",
    "pillow>=8.3.0",
    "aiohttp>=3.8.0"
]

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Install Robot AI package')
    parser.add_argument('--robot-ip', default='127.0.0.1', help='Robot IP address')
    parser.add_argument('--robot-port', type=int, default=8090, help='Robot port')
    parser.add_argument('--robot-sn', default=None, help='Robot serial number')
    parser.add_argument('--use-ssl', action='store_true', help='Use SSL for connections')
    parser.add_argument('--no-systemd', action='store_true', help='Do not install systemd service')
    parser.add_argument('--dev-mode', action='store_true', help='Install in development mode')
    parser.add_argument('--uninstall', action='store_true', help='Uninstall Robot AI')
    
    return parser.parse_args()

def check_dependencies():
    """Check if dependencies are installed"""
    logger.info("Checking dependencies...")
    missing = []
    
    for dep in DEPENDENCIES:
        try:
            result = subprocess.run(['which', dep.split()[0]], 
                                    stdout=subprocess.PIPE, 
                                    stderr=subprocess.PIPE)
            if result.returncode != 0:
                missing.append(dep)
        except Exception as e:
            logger.error(f"Error checking dependency {dep}: {e}")
            missing.append(dep)
    
    return missing

def install_dependencies(missing_deps):
    """Install missing dependencies"""
    if not missing_deps:
        logger.info("All dependencies are already installed")
        return True
    
    logger.info(f"Installing missing dependencies: {', '.join(missing_deps)}")
    
    try:
        # Detect package manager
        if os.path.exists('/usr/bin/apt'):
            # Debian/Ubuntu
            logger.info("Using apt package manager")
            cmd = ['sudo', 'apt', 'update']
            subprocess.run(cmd, check=True)
            
            cmd = ['sudo', 'apt', 'install', '-y'] + missing_deps
            subprocess.run(cmd, check=True)
        elif os.path.exists('/usr/bin/yum'):
            # CentOS/RHEL
            logger.info("Using yum package manager")
            cmd = ['sudo', 'yum', 'install', '-y'] + missing_deps
            subprocess.run(cmd, check=True)
        elif os.path.exists('/usr/bin/dnf'):
            # Fedora
            logger.info("Using dnf package manager")
            cmd = ['sudo', 'dnf', 'install', '-y'] + missing_deps
            subprocess.run(cmd, check=True)
        else:
            logger.error("Unsupported package manager")
            return False
        
        logger.info("Dependencies installed successfully")
        return True
    except Exception as e:
        logger.error(f"Error installing dependencies: {e}")
        return False

def create_directories(args):
    """Create necessary directories"""
    logger.info("Creating directories...")
    
    dirs = [INSTALL_DIR, CONFIG_DIR, LOG_DIR]
    
    try:
        for dir_path in dirs:
            if args.dev_mode:
                os.makedirs(dir_path, exist_ok=True)
            else:
                cmd = ['sudo', 'mkdir', '-p', dir_path]
                subprocess.run(cmd, check=True)
        
        logger.info("Directories created successfully")
        return True
    except Exception as e:
        logger.error(f"Error creating directories: {e}")
        return False

def copy_files(args):
    """Copy files to installation directory"""
    logger.info("Copying files...")
    
    try:
        # Get current directory (where install.py is located)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Create module directory
        module_dir = os.path.join(INSTALL_DIR, 'modules')
        if args.dev_mode:
            os.makedirs(module_dir, exist_ok=True)
        else:
            cmd = ['sudo', 'mkdir', '-p', module_dir]
            subprocess.run(cmd, check=True)
        
        # Copy module files
        module_files = [
            os.path.join(current_dir, 'modules', 'core.py'),
            os.path.join(current_dir, 'modules', 'map.py'),
            os.path.join(current_dir, 'modules', 'camera.py'),
            os.path.join(current_dir, 'modules', 'door.py'),
            os.path.join(current_dir, 'modules', 'elevator.py'),
            os.path.join(current_dir, 'modules', 'task_queue.py')
        ]
        
        for file_path in module_files:
            if args.dev_mode:
                shutil.copy(file_path, os.path.join(module_dir, os.path.basename(file_path)))
            else:
                cmd = ['sudo', 'cp', file_path, os.path.join(module_dir, os.path.basename(file_path))]
                subprocess.run(cmd, check=True)
        
        # Create config
        config = {
            "robot_ip": args.robot_ip,
            "robot_port": args.robot_port,
            "robot_sn": args.robot_sn,
            "use_ssl": args.use_ssl,
            "version": PACKAGE_VERSION,
            "installed_at": time.time()
        }
        
        config_path = os.path.join(CONFIG_DIR, 'config.json')
        if args.dev_mode:
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
        else:
            # Write config to a temporary file then move it
            with open('/tmp/robot-ai-config.json', 'w') as f:
                json.dump(config, f, indent=2)
            
            cmd = ['sudo', 'mv', '/tmp/robot-ai-config.json', config_path]
            subprocess.run(cmd, check=True)
            
            # Set permissions
            cmd = ['sudo', 'chmod', '644', config_path]
            subprocess.run(cmd, check=True)
        
        logger.info("Files copied successfully")
        return True
    except Exception as e:
        logger.error(f"Error copying files: {e}")
        return False

def create_virtual_env(args):
    """Create Python virtual environment"""
    logger.info("Creating virtual environment...")
    
    try:
        venv_path = os.path.join(INSTALL_DIR, 'venv')
        
        # Create virtual environment
        if args.dev_mode:
            cmd = [sys.executable, '-m', 'venv', venv_path]
        else:
            cmd = ['sudo', sys.executable, '-m', 'venv', venv_path]
        
        subprocess.run(cmd, check=True)
        
        # Install requirements
        pip_path = os.path.join(venv_path, 'bin', 'pip')
        
        for package in PIP_PACKAGES:
            if args.dev_mode:
                cmd = [pip_path, 'install', package]
            else:
                cmd = ['sudo', pip_path, 'install', package]
            
            subprocess.run(cmd, check=True)
        
        logger.info("Virtual environment created successfully")
        return True
    except Exception as e:
        logger.error(f"Error creating virtual environment: {e}")
        return False

def create_startup_script(args):
    """Create startup script"""
    logger.info("Creating startup script...")
    
    try:
        script_path = os.path.join(INSTALL_DIR, 'start.sh')
        script_content = f"""#!/bin/bash
# Robot AI startup script
cd {INSTALL_DIR}
source {INSTALL_DIR}/venv/bin/activate

# Set environment variables
export ROBOT_IP="{args.robot_ip}"
export ROBOT_PORT="{args.robot_port}"
export ROBOT_SERIAL="{args.robot_sn or 'L382502104987ir'}"
export USE_SSL="{1 if args.use_ssl else 0}"

# Start the Robot AI
python -m modules.core
"""
        
        if args.dev_mode:
            with open(script_path, 'w') as f:
                f.write(script_content)
            os.chmod(script_path, 0o755)
        else:
            # Write script to a temporary file then move it
            with open('/tmp/robot-ai-start.sh', 'w') as f:
                f.write(script_content)
            
            cmd = ['sudo', 'mv', '/tmp/robot-ai-start.sh', script_path]
            subprocess.run(cmd, check=True)
            
            # Set permissions
            cmd = ['sudo', 'chmod', '755', script_path]
            subprocess.run(cmd, check=True)
        
        logger.info("Startup script created successfully")
        return True
    except Exception as e:
        logger.error(f"Error creating startup script: {e}")
        return False

def create_systemd_service(args):
    """Create systemd service"""
    if args.no_systemd or args.dev_mode:
        logger.info("Skipping systemd service installation")
        return True
    
    logger.info("Creating systemd service...")
    
    try:
        service_path = f"/etc/systemd/system/{SERVICE_NAME}.service"
        service_content = f"""[Unit]
Description=Robot AI Service
After=network.target

[Service]
Type=simple
User=root
ExecStart={INSTALL_DIR}/start.sh
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=robot-ai

[Install]
WantedBy=multi-user.target
"""
        
        # Write service to a temporary file then move it
        with open('/tmp/robot-ai.service', 'w') as f:
            f.write(service_content)
        
        cmd = ['sudo', 'mv', '/tmp/robot-ai.service', service_path]
        subprocess.run(cmd, check=True)
        
        # Reload systemd, enable and start service
        cmd = ['sudo', 'systemctl', 'daemon-reload']
        subprocess.run(cmd, check=True)
        
        cmd = ['sudo', 'systemctl', 'enable', SERVICE_NAME]
        subprocess.run(cmd, check=True)
        
        cmd = ['sudo', 'systemctl', 'start', SERVICE_NAME]
        subprocess.run(cmd, check=True)
        
        logger.info("Systemd service created and started successfully")
        return True
    except Exception as e:
        logger.error(f"Error creating systemd service: {e}")
        return False

def uninstall(args):
    """Uninstall Robot AI"""
    logger.info("Uninstalling Robot AI...")
    
    try:
        # Stop and disable service if it exists
        if not args.dev_mode and os.path.exists(f"/etc/systemd/system/{SERVICE_NAME}.service"):
            try:
                cmd = ['sudo', 'systemctl', 'stop', SERVICE_NAME]
                subprocess.run(cmd, check=True)
                
                cmd = ['sudo', 'systemctl', 'disable', SERVICE_NAME]
                subprocess.run(cmd, check=True)
                
                cmd = ['sudo', 'rm', f"/etc/systemd/system/{SERVICE_NAME}.service"]
                subprocess.run(cmd, check=True)
                
                cmd = ['sudo', 'systemctl', 'daemon-reload']
                subprocess.run(cmd, check=True)
                
                logger.info("Systemd service removed")
            except Exception as e:
                logger.error(f"Error removing systemd service: {e}")
        
        # Remove directories
        if args.dev_mode:
            if os.path.exists(INSTALL_DIR):
                shutil.rmtree(INSTALL_DIR)
            if os.path.exists(CONFIG_DIR):
                shutil.rmtree(CONFIG_DIR)
            # Keep logs in case user wants to review them
        else:
            if os.path.exists(INSTALL_DIR):
                cmd = ['sudo', 'rm', '-rf', INSTALL_DIR]
                subprocess.run(cmd, check=True)
            
            if os.path.exists(CONFIG_DIR):
                cmd = ['sudo', 'rm', '-rf', CONFIG_DIR]
                subprocess.run(cmd, check=True)
            
            # Keep logs in case user wants to review them
        
        logger.info("Robot AI uninstalled successfully")
        return True
    except Exception as e:
        logger.error(f"Error uninstalling Robot AI: {e}")
        return False

def main():
    """Main entry point"""
    args = parse_args()
    
    logger.info(f"Robot AI Installer v{PACKAGE_VERSION}")
    logger.info(f"Target robot: {args.robot_ip}:{args.robot_port}")
    
    if args.robot_sn:
        logger.info(f"Robot serial number: {args.robot_sn}")
    
    if args.uninstall:
        return uninstall(args)
    
    # Check and install dependencies
    missing_deps = check_dependencies()
    if missing_deps and not install_dependencies(missing_deps):
        logger.error("Failed to install dependencies")
        return False
    
    # Create directories
    if not create_directories(args):
        logger.error("Failed to create directories")
        return False
    
    # Copy files
    if not copy_files(args):
        logger.error("Failed to copy files")
        return False
    
    # Create virtual environment
    if not create_virtual_env(args):
        logger.error("Failed to create virtual environment")
        return False
    
    # Create startup script
    if not create_startup_script(args):
        logger.error("Failed to create startup script")
        return False
    
    # Create systemd service
    if not args.no_systemd and not args.dev_mode:
        if not create_systemd_service(args):
            logger.error("Failed to create systemd service")
            return False
    
    logger.info(f"Robot AI v{PACKAGE_VERSION} installed successfully")
    
    if args.dev_mode or args.no_systemd:
        logger.info(f"To start Robot AI, run: {INSTALL_DIR}/start.sh")
    else:
        logger.info("Robot AI service is running")
        logger.info("To check status: sudo systemctl status robot-ai")
        logger.info("To stop: sudo systemctl stop robot-ai")
        logger.info("To start: sudo systemctl start robot-ai")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)