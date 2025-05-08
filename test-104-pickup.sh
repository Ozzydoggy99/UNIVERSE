#!/bin/bash

# Send robot to pick up bin from 104 zone
echo "🤖 Sending robot to pick up bin from zone 104 and drop at Drop-off point..."

RESPONSE=$(curl -s -X POST "http://localhost:5000/robots/assign-task/local" \
  -H "Content-Type: application/json" \
  -d '{
    "shelf": {
      "id": "104", 
      "x": -16.329171529605446, 
      "y": 6.419632917129547, 
      "ori": 0
    },
    "pickup": {
      "id": "Drop-off", 
      "x": -3.067094531843395, 
      "y": 2.5788015960870325, 
      "ori": 0
    },
    "standby": {
      "id": "Desk", 
      "x": 0.09001154779753051, 
      "y": 4.615265033436344, 
      "ori": 0
    }
  }')

echo "API Response: $RESPONSE"

# Check active missions
echo "Checking active missions..."
curl -s http://localhost:5000/api/missions/active | grep -v "DOCTYPE"

# Wait a moment for the mission to start
sleep 5

# Check active missions again
echo "Active missions after 5 seconds:"
curl -s http://localhost:5000/api/missions/active | grep -v "DOCTYPE"