// Robot AI One-Click Installer
// This script will install the Robot AI package directly on your robot

console.log("Starting Robot AI installation...");

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  robotIp: "127.0.0.1",
  robotSn: "L382502104987ir",
  installDir: "/home/robot/robot-ai",
  devMode: true
};

// Create installation directory
console.log(`Creating installation directory: ${config.installDir}`);
try {
  fs.mkdirSync(config.installDir, { recursive: true });
  fs.mkdirSync(path.join(config.installDir, "logs"), { recursive: true });
} catch (err) {
  console.error(`Error creating directories: ${err.message}`);
}

// Copy files
console.log("Copying Robot AI files...");
try {
  // Copy modules directory
  copyDirectory("robot-ai-package/modules", path.join(config.installDir, "modules"));
  
  // Copy www directory
  copyDirectory("robot-ai-package/www", path.join(config.installDir, "www"));
  
  // Copy README file
  if (fs.existsSync("robot-ai-package/README.md")) {
    fs.copyFileSync("robot-ai-package/README.md", path.join(config.installDir, "README.md"));
  }
} catch (err) {
  console.error(`Error copying files: ${err.message}`);
}

// Create configuration file
console.log("Creating configuration file...");
try {
  const configJson = JSON.stringify({
    robot_ip: config.robotIp,
    robot_sn: config.robotSn,
    dev_mode: config.devMode,
    install_dir: config.installDir,
    installed_at: new Date().toISOString()
  }, null, 2);
  
  fs.writeFileSync(path.join(config.installDir, "config.json"), configJson);
} catch (err) {
  console.error(`Error creating config file: ${err.message}`);
}

// Create start script
console.log("Creating start script...");
try {
  const startScript = `#!/bin/bash
# Start the Robot AI

SCRIPT_DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Start the main Robot AI process
cd "$SCRIPT_DIR"
python3 "$SCRIPT_DIR/main.py" > "$LOG_DIR/robot-ai.log" 2>&1 &
echo $! > "$SCRIPT_DIR/robot-ai.pid"

# Start the web interface
python3 -m http.server 8080 --directory "$SCRIPT_DIR/www" > "$LOG_DIR/web-interface.log" 2>&1 &
echo $! > "$SCRIPT_DIR/web-interface.pid"

echo "Robot AI services started. Access web interface at http://localhost:8080"
`;
  
  fs.writeFileSync(path.join(config.installDir, "start.sh"), startScript);
  try {
    execSync(`chmod +x ${path.join(config.installDir, "start.sh")}`);
  } catch (err) {
    console.warn(`Warning: Could not make start.sh executable: ${err.message}`);
  }
} catch (err) {
  console.error(`Error creating start script: ${err.message}`);
}

// Create stop script
console.log("Creating stop script...");
try {
  const stopScript = `#!/bin/bash
# Stop the Robot AI services

SCRIPT_DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Stop the main Robot AI process
if [ -f "$SCRIPT_DIR/robot-ai.pid" ]; then
    kill $(cat "$SCRIPT_DIR/robot-ai.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/robot-ai.pid"
fi

# Stop the web interface
if [ -f "$SCRIPT_DIR/web-interface.pid" ]; then
    kill $(cat "$SCRIPT_DIR/web-interface.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/web-interface.pid"
fi

echo "Robot AI services stopped"
`;
  
  fs.writeFileSync(path.join(config.installDir, "stop.sh"), stopScript);
  try {
    execSync(`chmod +x ${path.join(config.installDir, "stop.sh")}`);
  } catch (err) {
    console.warn(`Warning: Could not make stop.sh executable: ${err.message}`);
  }
} catch (err) {
  console.error(`Error creating stop script: ${err.message}`);
}

// Create main.py
console.log("Creating main Python script...");
try {
  const mainPy = `#!/usr/bin/env python3
"""
Robot AI Main Module
This is the entry point for the Robot AI system.
"""

import os
import sys
import json
import logging
import signal
import time
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("Robot AI")

def load_config():
    """Load configuration from config.json"""
    config_path = Path(__file__).parent / "config.json"
    if not config_path.exists():
        logger.error(f"Configuration file not found at {config_path}")
        return None
    
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing configuration file: {e}")
        return None

def main():
    """Main entry point for the Robot AI system"""
    logger.info("Starting Robot AI system")
    
    # Load configuration
    config = load_config()
    if not config:
        logger.error("Failed to load configuration, exiting")
        return 1
    
    logger.info(f"Loaded configuration for robot {config.get('robot_sn', 'unknown')}")
    
    # Simulate initialization
    logger.info("Initializing Robot AI components...")
    time.sleep(2)
    
    logger.info("Robot AI system started successfully")
    
    # Keep the program running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received, shutting down")
    
    return 0

def handle_shutdown(sig=None, frame=None):
    """Handle graceful shutdown"""
    logger.info("Shutdown signal received, stopping Robot AI")
    sys.exit(0)

if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    # Run the main function
    sys.exit(main())
`;
  
  fs.writeFileSync(path.join(config.installDir, "main.py"), mainPy);
  try {
    execSync(`chmod +x ${path.join(config.installDir, "main.py")}`);
  } catch (err) {
    console.warn(`Warning: Could not make main.py executable: ${err.message}`);
  }
} catch (err) {
  console.error(`Error creating main Python script: ${err.message}`);
}

// Start the Robot AI services
console.log("Starting Robot AI services...");
try {
  execSync(`${path.join(config.installDir, "start.sh")}`);
  console.log("Robot AI services started successfully!");
  console.log(`Access the web interface at: http://localhost:8080`);
} catch (err) {
  console.error(`Error starting Robot AI services: ${err.message}`);
}

console.log("Installation complete!");

// Helper function to copy a directory recursively
function copyDirectory(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  // Copy each file/directory
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursive copy for directories
      copyDirectory(srcPath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
    }
  }
}