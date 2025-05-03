#!/bin/bash

echo "============================================================="
echo "Robot AI Installer (Linux/macOS)"
echo "============================================================="
echo "This script will install the Robot AI dashboard on your system."
echo ""

# Check if Python is installed
echo "Checking for Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "Python not found! Please install Python 3.6 or later."
    echo "Visit https://www.python.org/downloads/ to download Python."
    exit 1
fi

# Install required Python packages
echo "Installing required Python packages..."
python3 -m pip install requests > /dev/null 2>&1

# Extract the dashboard.html file
echo "Extracting dashboard.html..."
if [ -f "dashboard.html" ]; then
    echo "Dashboard already exists."
else
    echo "Copying dashboard from package..."
    cp modules/dashboard.html dashboard.html 2> /dev/null
    if [ $? -ne 0 ]; then
        echo "Could not extract dashboard. Please check file permissions."
        exit 1
    fi
fi

# Check robot connection
echo ""
echo "Please enter your robot's IP address (default: 192.168.4.31):"
read -p "> " ROBOT_IP
ROBOT_IP=${ROBOT_IP:-192.168.4.31}

echo "Testing connection to robot at $ROBOT_IP..."
if python3 -c "import requests; response = requests.get(f'http://$ROBOT_IP:8090/device/info', timeout=5); print('Connected successfully!' if response.status_code == 200 else 'Could not connect to robot.')" 2> /dev/null; then
    echo "Connection test successful."
else
    echo "Could not connect to robot. Please check the IP address and ensure the robot is powered on."
fi

echo ""
echo "Installation complete!"
echo ""
echo "To use the Robot AI dashboard:"
echo "1. Open dashboard.html in your web browser"
echo "2. Enter your robot's IP address: $ROBOT_IP"
echo "3. Click \"Connect\" to begin controlling your robot"
echo ""

# Ask if user wants to open dashboard now
echo "Would you like to open the dashboard now? (Y/N)"
read -p "> " OPEN_NOW
if [[ $OPEN_NOW == "Y" || $OPEN_NOW == "y" ]]; then
    echo "Opening dashboard..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open dashboard.html
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v xdg-open &> /dev/null; then
            xdg-open dashboard.html
        elif command -v gnome-open &> /dev/null; then
            gnome-open dashboard.html
        else
            echo "Could not automatically open the dashboard. Please open it manually."
        fi
    else
        echo "Could not automatically open the dashboard. Please open it manually."
    fi
fi

echo ""
echo "Thank you for installing Robot AI!"