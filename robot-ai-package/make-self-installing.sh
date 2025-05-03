#!/bin/bash
# Creates a self-extracting, self-installing archive for the Robot AI package

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
OUTPUT_DIR="$PACKAGE_DIR/dist"
VERSION="1.0.0"
OUTPUT_FILE="robot-ai-installer-v${VERSION}.sh"

# Make sure output directory exists
mkdir -p "$OUTPUT_DIR"

# Check if previous installer exists
if [ -f "$OUTPUT_DIR/$OUTPUT_FILE" ]; then
    echo "Removing existing installer..."
    rm "$OUTPUT_DIR/$OUTPUT_FILE"
fi

echo "Creating self-installing archive for Robot AI v${VERSION}..."

# First, create a temporary directory
TMP_DIR=$(mktemp -d)
mkdir -p "$TMP_DIR/robot-ai"

# Copy all files to the temporary directory
cp -r "$PACKAGE_DIR/modules" "$TMP_DIR/robot-ai/"
cp -r "$PACKAGE_DIR/www" "$TMP_DIR/robot-ai/"
cp "$PACKAGE_DIR/README.md" "$TMP_DIR/robot-ai/"

# Create installation script
cat > "$TMP_DIR/install.sh" << 'EOF'
#!/bin/bash
# Robot AI Installer

# Default values
ROBOT_IP="127.0.0.1"
ROBOT_SN="L382502104987ir"
INSTALL_DIR="/home/robot/robot-ai"
DEV_MODE=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --robot-ip)
      ROBOT_IP="$2"
      shift 2
      ;;
    --robot-sn)
      ROBOT_SN="$2"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --no-dev-mode)
      DEV_MODE=false
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "==================================="
echo "   Robot AI Installer v1.0.0"
echo "==================================="
echo "Robot IP: $ROBOT_IP"
echo "Robot SN: $ROBOT_SN"
echo "Installation Directory: $INSTALL_DIR"
echo "Development Mode: $DEV_MODE"
echo "==================================="

# Create installation directory
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/logs"

# Copy files from extracted archive
cp -r robot-ai/* "$INSTALL_DIR/"

# Create configuration file
cat > "$INSTALL_DIR/config.json" << CONFIGEOF
{
  "robot_ip": "$ROBOT_IP",
  "robot_sn": "$ROBOT_SN",
  "dev_mode": $DEV_MODE,
  "install_dir": "$INSTALL_DIR",
  "installed_at": "$(date -Iseconds)"
}
CONFIGEOF

# Create start script
cat > "$INSTALL_DIR/start.sh" << 'STARTEOF'
#!/bin/bash
# Start the Robot AI

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
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
STARTEOF

# Create stop script
cat > "$INSTALL_DIR/stop.sh" << 'STOPEOF'
#!/bin/bash
# Stop the Robot AI services

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

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
STOPEOF

# Create main.py
cat > "$INSTALL_DIR/main.py" << 'MAINEOF'
#!/usr/bin/env python3
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
MAINEOF

# Make scripts executable
chmod +x "$INSTALL_DIR/start.sh"
chmod +x "$INSTALL_DIR/stop.sh"
chmod +x "$INSTALL_DIR/main.py"

echo "Installation complete!"
echo "The Robot AI has been installed to: $INSTALL_DIR"
echo ""
echo "To start the Robot AI, run:"
echo "  $INSTALL_DIR/start.sh"
echo ""
echo "To access the web interface, visit:"
echo "  http://localhost:8080"
echo ""

# Start the service automatically
echo "Starting Robot AI services..."
"$INSTALL_DIR/start.sh"

echo "Robot AI is now running!"
EOF

# Make the installation script executable
chmod +x "$TMP_DIR/install.sh"

# Create the self-extracting script
cat > "$OUTPUT_DIR/$OUTPUT_FILE" << 'HEADER'
#!/bin/bash
# Self-extracting installer for Robot AI

# Detect tmp directory
if [[ -d $TMPDIR ]]; then
    T=$TMPDIR
elif [[ -d /tmp ]]; then
    T=/tmp
else
    T=.
fi

# Create a temporary directory for extraction
TMPDIR=$(mktemp -d "$T/robot-ai-installer.XXXXXX")

# Make sure we clean up when the script exits
cleanup() {
    rm -rf "$TMPDIR"
}
trap cleanup EXIT

# Define the payload marker
PAYLOAD_LINE=$(awk '/^__PAYLOAD_BEGINS__/ { print NR + 1; exit 0; }' $0)

# Extract the payload to the temporary directory
tail -n+$PAYLOAD_LINE $0 | tar xz -C "$TMPDIR"

# Change to the temporary directory and run the installer
cd "$TMPDIR"
./install.sh "$@"

exit 0

__PAYLOAD_BEGINS__
HEADER

# Create the tar.gz archive of the installation files
(cd "$TMP_DIR" && tar czf - *) >> "$OUTPUT_DIR/$OUTPUT_FILE"

# Make the self-extracting script executable
chmod +x "$OUTPUT_DIR/$OUTPUT_FILE"

# Clean up
rm -rf "$TMP_DIR"

echo "Self-installing package created at: $OUTPUT_DIR/$OUTPUT_FILE"
echo "Size: $(du -h "$OUTPUT_DIR/$OUTPUT_FILE" | cut -f1)"
echo ""
echo "To use, download the file to your robot and run:"
echo "  chmod +x $OUTPUT_FILE"
echo "  ./$OUTPUT_FILE"
echo ""
echo "Or simply run it with bash:"
echo "  bash $OUTPUT_FILE"
echo ""