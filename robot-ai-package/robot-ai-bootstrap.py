#!/usr/bin/env python3
"""
Robot AI Bootstrap Script
This is a minimal script that extracts and runs the full installer from the robot-ai-v1.0.0.zip file.
Upload this single file to your robot to begin the installation process.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import time
import base64
import zipfile
import logging
import tempfile
import subprocess
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('robot-ai-bootstrap')

# The entire robot-ai-v1.0.0.zip file will be embedded here as a base64 encoded string
EMBEDDED_ZIP = """
# Base64-encoded content of robot-ai-v1.0.0.zip will be inserted here
"""

def print_banner():
    """Print installer banner"""
    print("=" * 60)
    print("Robot AI Bootstrap")
    print("=" * 60)
    print("This script will extract and run the Robot AI installer on your robot.")
    print("Version: 1.0.0")
    print("=" * 60)

def extract_zip():
    """Extract the embedded ZIP file"""
    logger.info("Extracting embedded ZIP file")
    
    try:
        # Create a temporary directory
        temp_dir = tempfile.mkdtemp(prefix="robot-ai-")
        logger.info(f"Using temporary directory: {temp_dir}")
        
        # Skip if the embed is just a placeholder
        if "# Base64-encoded content" in EMBEDDED_ZIP:
            logger.error("No embedded ZIP content found. This is just a placeholder file.")
            logger.info("Please encode the robot-ai-v1.0.0.zip file and insert it into this script.")
            return None
        
        # Decode the embedded ZIP
        zip_data = base64.b64decode(EMBEDDED_ZIP)
        zip_path = os.path.join(temp_dir, "robot-ai-v1.0.0.zip")
        
        # Write the ZIP file
        with open(zip_path, 'wb') as f:
            f.write(zip_data)
        
        logger.info(f"ZIP file written to: {zip_path}")
        
        # Extract the ZIP file
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        logger.info(f"ZIP contents extracted to: {temp_dir}")
        
        return temp_dir
    except Exception as e:
        logger.error(f"Failed to extract ZIP: {e}")
        return None

def run_installer(install_dir):
    """Run the onboard installer script"""
    logger.info("Running the onboard installer script")
    
    try:
        # Find the onboard installer
        installer_path = os.path.join(install_dir, "robot-ai-onboard-installer.py")
        
        if not os.path.exists(installer_path):
            logger.error(f"Installer script not found at: {installer_path}")
            return False
        
        # Make it executable
        os.chmod(installer_path, 0o755)
        
        # Run the installer
        logger.info(f"Executing: {installer_path}")
        subprocess.check_call([sys.executable, installer_path])
        
        logger.info("Installer executed successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to run installer: {e}")
        return False

def main():
    """Main bootstrap function"""
    print_banner()
    
    # Extract the ZIP file
    install_dir = extract_zip()
    if not install_dir:
        logger.error("Failed to extract ZIP file. Bootstrap aborted.")
        return False
    
    # Run the installer
    if not run_installer(install_dir):
        logger.error("Failed to run installer. Bootstrap aborted.")
        return False
    
    print("\nBootstrap completed successfully!")
    print("The Robot AI installer should now be running.")
    print("\nIf the installer did not start automatically, you can run it manually:")
    print(f"  python3 {os.path.join(install_dir, 'robot-ai-onboard-installer.py')}")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        # Keep the script running for a while to prevent immediate termination
        time.sleep(5)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nBootstrap cancelled by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        sys.exit(1)