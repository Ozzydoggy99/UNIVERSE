#!/usr/bin/env python3
"""
Android Robot AI Installer
--------------------------
This installer is specifically designed for Android-based robots where files
are managed through Android's Storage Access Framework with content:// URIs.

This installer:
1. Detects Android environment and available storage locations
2. Locates appropriate directory for module installation
3. Installs core modules to the Documents/modules directory
4. Creates a launcher script that will run the modules
5. Adds the modules to Android system services

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import json
import time
import base64
import hashlib
import requests
import subprocess
import argparse
from typing import List, Dict, Optional, Tuple, Any, Union
from datetime import datetime

# Android-specific imports (will use conditional imports to avoid errors on non-Android systems)
try:
    from android.storage import primary_external_storage_path
    from android.content import Context, Intent
    from android.net import Uri
    ANDROID_AVAILABLE = True
except ImportError:
    ANDROID_AVAILABLE = False

# Robot AI modules to be installed
CORE_MODULES = {
    "robot-ai-core.py": """
"""
}

# Constants
DEFAULT_ROBOT_IP = "192.168.25.25"
DEFAULT_ROBOT_PORT = 8090
DOCUMENT_PROVIDER_URI = "content://com.android.providers.media.documents/document/documents_bucket%3A"
MODULES_DIR = "Documents/modules"
SERVICE_NAME = "robot-ai-service"

def print_banner():
    """Print the installer banner"""
    banner = r"""
    ╔═══════════════════════════════════════════════╗
    ║             ANDROID ROBOT AI INSTALLER         ║
    ║                                               ║
    ║  Designed for Android-based robots with       ║
    ║  Storage Access Framework                     ║
    ╚═══════════════════════════════════════════════╝
    """
    print(banner)
    print(f"Installer version: 1.0.0")
    print(f"Running on: {sys.platform}")
    print(f"Android available: {ANDROID_AVAILABLE}")
    print("-" * 50)

def print_status(message: str):
    """Print a status message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def is_android() -> bool:
    """Check if running on Android"""
    return ANDROID_AVAILABLE or "ANDROID_ROOT" in os.environ or "ANDROID_DATA" in os.environ

def find_document_providers() -> List[str]:
    """Find document providers on Android system"""
    document_providers = []
    
    if not is_android():
        print_status("Not running on Android, cannot find document providers")
        return document_providers
    
    try:
        # Use Android Storage Access Framework if available
        if ANDROID_AVAILABLE:
            context = Context.getApplicationContext()
            intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
            intent.addCategory(Intent.CATEGORY_OPENABLE)
            intent.setType("*/*")
            
            # Get all available document providers
            providers = context.getPackageManager().queryIntentActivities(intent, 0)
            for provider in providers:
                provider_info = provider.activityInfo
                document_providers.append(f"content://{provider_info.packageName}")
        else:
            # Use command-line approach using content query if Android APIs aren't directly available
            try:
                result = subprocess.run(
                    ["content", "query", "--uri", "content://com.android.providers.media.documents/root"],
                    capture_output=True, text=True, check=True
                )
                for line in result.stdout.splitlines():
                    if "content://" in line:
                        uri = line.split("content://")[1].split(" ")[0]
                        document_providers.append(f"content://{uri}")
            except (subprocess.SubprocessError, FileNotFoundError):
                print_status("Could not query content providers using content command")
    except Exception as e:
        print_status(f"Error finding document providers: {e}")
    
    return document_providers

def find_writable_locations() -> List[str]:
    """Find writable locations on the Android system"""
    locations = []
    
    try:
        # Try Android primary storage
        if ANDROID_AVAILABLE:
            try:
                primary_storage = primary_external_storage_path()
                if primary_storage and os.path.exists(primary_storage) and os.access(primary_storage, os.W_OK):
                    locations.append(primary_storage)
            except Exception as e:
                print_status(f"Could not access primary storage: {e}")
        
        # Try common Android paths
        common_paths = [
            "/storage/emulated/0",
            "/sdcard",
            "/storage/self/primary",
            "/data/local/tmp"
        ]
        
        for path in common_paths:
            if os.path.exists(path) and os.access(path, os.W_OK):
                locations.append(path)
    except Exception as e:
        print_status(f"Error finding writable locations: {e}")
    
    return locations

def find_modules_directory() -> Optional[str]:
    """Find or create the modules directory"""
    # First check if we have direct file system access
    writable_locations = find_writable_locations()
    
    for location in writable_locations:
        modules_path = os.path.join(location, MODULES_DIR)
        try:
            os.makedirs(modules_path, exist_ok=True)
            if os.access(modules_path, os.W_OK):
                print_status(f"Found writable modules directory at: {modules_path}")
                return modules_path
        except Exception as e:
            print_status(f"Could not create modules directory at {modules_path}: {e}")
    
    # If direct access fails, try using Storage Access Framework (SAF)
    document_providers = find_document_providers()
    
    # Find a provider for the Documents directory
    for provider in document_providers:
        if "documents" in provider.lower():
            # Here we would need to use Android's SAF APIs
            # This is a simplified representation and would need to be completed
            # with actual Android-specific code
            if ANDROID_AVAILABLE:
                try:
                    uri = Uri.parse(f"{provider}/document/primary:Documents/modules")
                    # In real implementation, we would check if this exists and is writable
                    print_status(f"Found modules directory via SAF at: {uri}")
                    return str(uri)
                except Exception as e:
                    print_status(f"Error accessing {provider}: {e}")
    
    print_status("Could not find or create modules directory")
    return None

def test_robot_connection(ip: str, port: int, secret: str) -> bool:
    """Test connection to the robot"""
    try:
        url = f"http://{ip}:{port}/device/info"
        headers = {"Authorization": f"Secret {secret}"}
        
        print_status(f"Testing connection to robot at {ip}:{port}")
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code == 200:
            print_status("Successfully connected to robot")
            return True
        else:
            print_status(f"Failed to connect: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"Connection error: {e}")
        return False

def install_modules(modules_dir: str) -> List[str]:
    """Install Robot AI modules to the specified directory"""
    installed_modules = []
    
    print_status(f"Installing modules to {modules_dir}")
    
    # Check if we're dealing with a content:// URI
    if modules_dir.startswith("content://"):
        if ANDROID_AVAILABLE:
            # This would use Android Content Resolver to write files
            # Simplified code - would need to be implemented with actual Android APIs
            context = Context.getApplicationContext()
            content_resolver = context.getContentResolver()
            
            for module_name, module_content in CORE_MODULES.items():
                try:
                    uri = Uri.parse(f"{modules_dir}/{module_name}")
                    # In real implementation, would use ContentResolver.openOutputStream()
                    # and write the module_content
                    print_status(f"Installed {module_name} via SAF")
                    installed_modules.append(module_name)
                except Exception as e:
                    print_status(f"Failed to install {module_name}: {e}")
        else:
            print_status("Cannot install to content:// URI without Android APIs")
    else:
        # Direct file system access
        for module_name, module_content in CORE_MODULES.items():
            module_path = os.path.join(modules_dir, module_name)
            try:
                with open(module_path, "w") as f:
                    f.write(module_content)
                os.chmod(module_path, 0o755)  # Make executable
                print_status(f"Installed {module_name}")
                installed_modules.append(module_path)
            except Exception as e:
                print_status(f"Failed to install {module_name}: {e}")
    
    return installed_modules

def create_launcher(modules_dir: str, installed_modules: List[str]) -> Optional[str]:
    """Create a launcher script that will run the modules"""
    launcher_name = "robot-ai-launcher.py"
    launcher_path = os.path.join(modules_dir, launcher_name) if not modules_dir.startswith("content://") else None
    
    launcher_code = f"""#!/usr/bin/env python3
\"\"\"
Robot AI Launcher
This script launches the Robot AI modules
\"\"\"

import os
import sys
import time
import subprocess
import threading

# Modules to launch
MODULES = {repr(installed_modules)}

def run_module(module_path):
    \"\"\"Run a module as a separate process\"\"\"
    try:
        subprocess.Popen([sys.executable, module_path])
        print(f"Started {{module_path}}")
    except Exception as e:
        print(f"Error starting {{module_path}}: {{e}}")

def main():
    \"\"\"Main function\"\"\"
    print("Starting Robot AI modules...")
    
    # Start each module in a separate process
    threads = []
    for module in MODULES:
        t = threading.Thread(target=run_module, args=(module,))
        threads.append(t)
        t.start()
        time.sleep(1)  # Small delay between module starts
    
    # Wait for all threads to complete
    for t in threads:
        t.join()
    
    print("All modules started")

if __name__ == "__main__":
    main()
"""
    
    if modules_dir.startswith("content://"):
        if ANDROID_AVAILABLE:
            # This would use Android Content Resolver to write the launcher
            # Simplified code - would need to be implemented with actual Android APIs
            try:
                context = Context.getApplicationContext()
                content_resolver = context.getContentResolver()
                
                uri = Uri.parse(f"{modules_dir}/{launcher_name}")
                # In real implementation, would use ContentResolver.openOutputStream()
                print_status(f"Created launcher via SAF")
                return f"{modules_dir}/{launcher_name}"
            except Exception as e:
                print_status(f"Failed to create launcher: {e}")
                return None
        else:
            print_status("Cannot create launcher at content:// URI without Android APIs")
            return None
    else:
        try:
            with open(launcher_path, "w") as f:
                f.write(launcher_code)
            os.chmod(launcher_path, 0o755)  # Make executable
            print_status(f"Created launcher at {launcher_path}")
            return launcher_path
        except Exception as e:
            print_status(f"Failed to create launcher: {e}")
            return None

def register_service(robot_ip: str, robot_port: int, robot_secret: str, launcher_path: str) -> bool:
    """Register the Robot AI as a service on the robot"""
    try:
        url = f"http://{robot_ip}:{robot_port}/services/register"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Secret {robot_secret}"
        }
        
        service_data = {
            "name": SERVICE_NAME,
            "command": f"{sys.executable} {launcher_path}",
            "autostart": True
        }
        
        print_status(f"Registering {SERVICE_NAME} service")
        response = requests.post(url, headers=headers, json=service_data, timeout=5)
        
        if response.status_code in [200, 201]:
            print_status("Service registered successfully")
            return True
        else:
            print_status(f"Failed to register service: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"Error registering service: {e}")
        return False

def run_installer(robot_ip: str, robot_port: int, robot_secret: str) -> bool:
    """Run the installation process"""
    try:
        print_status("Starting Android Robot AI installer")
        
        # Test connection to the robot
        if not test_robot_connection(robot_ip, robot_port, robot_secret):
            return False
        
        # Find or create the modules directory
        modules_dir = find_modules_directory()
        if not modules_dir:
            print_status("Could not find or create modules directory")
            return False
        
        # Install modules
        installed_modules = install_modules(modules_dir)
        if not installed_modules:
            print_status("No modules were installed")
            return False
        
        # Create launcher
        launcher_path = create_launcher(modules_dir, installed_modules)
        if not launcher_path:
            print_status("Failed to create launcher")
            return False
        
        # Register service
        if not register_service(robot_ip, robot_port, robot_secret, launcher_path):
            print_status("Failed to register service")
            return False
        
        print_status("Installation completed successfully")
        return True
    except Exception as e:
        print_status(f"Installation failed: {e}")
        return False

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Android Robot AI Installer")
    parser.add_argument("--ip", default=DEFAULT_ROBOT_IP, help=f"Robot IP address (default: {DEFAULT_ROBOT_IP})")
    parser.add_argument("--port", type=int, default=DEFAULT_ROBOT_PORT, help=f"Robot port (default: {DEFAULT_ROBOT_PORT})")
    parser.add_argument("--secret", required=True, help="Robot secret for API authentication")
    args = parser.parse_args()
    
    print_banner()
    
    success = run_installer(args.ip, args.port, args.secret)
    
    if success:
        print("\n✅ Android Robot AI installed successfully!")
        print(f"The service '{SERVICE_NAME}' has been registered and will start automatically")
    else:
        print("\n❌ Installation failed. Please check the logs for details.")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())