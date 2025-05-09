# Zone 104 Bin Pickup Guide

This guide explains how to use the robot system to pick up a bin from Zone 104 and deliver it to the Drop-off point.

## Overview

The robot performs a complete bin operation with the following steps:
1. Navigate to Zone 104 (coordinates: x=-16.329, y=6.419)
2. Jack up (lift the bin)
3. Navigate to pickup position
4. Jack down (place the bin)
5. Return to the Drop-off point (coordinates: x=-3.067, y=2.578)

## Running the Pickup Task

### Method 1: Using the Shell Script

The easiest way to initiate a Zone 104 pickup is to use the provided shell script:

```bash
./test-104-pickup.sh
```

This script will start the pickup operation and display the progress in the console.

### Method 2: Using the NodeJS Script Directly

You can also run the NodeJS script directly:

```bash
node pickup-104-zone.js
```

### Method 3: Using the API Endpoint

For programmatic access, you can send a POST request to the API endpoint:

```bash
curl -X POST http://localhost:5000/api/robots/assign-task/local -H "Content-Type: application/json" -d '{
  "shelf": {
    "id": "zone-104",
    "x": -16.329,
    "y": 6.419,
    "ori": 0
  },
  "pickup": {
    "id": "zone-104-bin",
    "x": -16.329,
    "y": 6.419,
    "ori": 0
  },
  "standby": {
    "id": "drop-off",
    "x": -3.067,
    "y": 2.578,
    "ori": 0
  }
}'
```

## Monitoring Task Progress

### Viewing Active Missions

To see all currently active missions:

```bash
curl http://localhost:5000/api/missions/active
```

### Checking a Specific Mission

To check the status of a specific mission (replace `[MISSION_ID]` with the actual mission ID):

```bash
curl http://localhost:5000/api/missions/[MISSION_ID]
```

### Log Files

The system maintains several log files:

1. **Robot Debug Log**: `robot-debug.log` - Contains detailed information about robot operations
2. **Mission Log**: `robot-mission-log.json` - Contains logs of mission executions

## Troubleshooting

Common issues and solutions:

### Robot Not Moving

If the robot doesn't start moving:
- Check if the emergency stop button is pressed (this is checked automatically)
- Verify the robot is not in charging mode (this is checked automatically)
- Check the WebSocket connection status in the server logs

### Task Fails

If the task fails:
- Check the `robot-debug.log` file for error messages
- Verify that the coordinates for Zone 104 and Drop-off are correct
- Ensure that the robot has a clear path between the pickup and dropoff locations

## Coordinates Reference

The system uses the following coordinates:

- **Zone 104**: x=-16.329, y=6.419
- **Drop-off Point**: x=-3.067, y=2.578