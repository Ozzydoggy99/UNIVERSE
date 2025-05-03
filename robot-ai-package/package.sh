#!/bin/bash
# Script to package the Robot AI files into a zip archive

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Define the output file name with version
VERSION="1.0.0"
OUTPUT_FILE="robot-ai-v${VERSION}.zip"

echo "Packaging Robot AI v${VERSION}..."

# Make sure output directory exists
mkdir -p dist

# Check if previous package exists
if [ -f "dist/$OUTPUT_FILE" ]; then
    echo "Removing existing package..."
    rm "dist/$OUTPUT_FILE"
fi

# Create a zip archive with all necessary files
zip -r "dist/$OUTPUT_FILE" \
    install.py \
    README.md \
    modules/ \
    www/

# Make the installer executable inside the zip
zip -r "dist/$OUTPUT_FILE" -X install.py

# Check if the package was created successfully
if [ -f "dist/$OUTPUT_FILE" ]; then
    echo "Package created successfully: dist/$OUTPUT_FILE"
    echo "Size: $(du -h "dist/$OUTPUT_FILE" | cut -f1)"
    echo ""
    echo "To install on a robot, extract the package and run:"
    echo "python3 install.py --robot-ip <ROBOT_IP> --robot-sn <ROBOT_SERIAL>"
else
    echo "Error: Failed to create package"
    exit 1
fi