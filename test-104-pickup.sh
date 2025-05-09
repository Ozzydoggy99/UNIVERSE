#!/bin/bash
# Script to execute a robot pickup task from zone 104 to drop-off point

echo "🤖 Starting zone 104 bin pickup and delivery mission..."
node pickup-104-zone.js

echo ""
echo "To check mission status use:"
echo "curl http://localhost:5000/api/missions/active"