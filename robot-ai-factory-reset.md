# Robot AI Factory Reset Guide

This document provides instructions on how to perform a factory reset of your robot if the AI integration causes any issues.

## Prerequisites

- Physical access to the robot
- Developer mode enabled
- Admin credentials for the robot system

## When to Use Factory Reset

Use the factory reset procedure in the following situations:

1. The robot becomes unresponsive after AI installation
2. Abnormal behavior is observed that cannot be fixed by restarting
3. Network connectivity issues persist despite troubleshooting
4. System resource utilization (CPU/memory) is extremely high
5. Navigation or sensor systems are not functioning correctly

## Safety Precautions

Before performing a factory reset:

1. Ensure the robot is in a safe location away from stairs or obstacles
2. Connect the robot to its charging station if possible
3. Backup any custom maps or configurations if accessible
4. Make note of any custom settings that will need to be restored
5. Ensure no active tasks are running

## Factory Reset Procedure

### Method 1: Using Developer Mode UI

1. Access the robot's developer mode interface:
   - Power on the robot
   - Press and hold the power button for 5 seconds
   - When the LED flashes blue, release and quickly press the power button 3 times

2. Navigate to the developer menu:
   - On the touchscreen, tap the gear icon (Settings)
   - Scroll down and tap "Developer Options"
   - Enter your admin password when prompted

3. Perform the factory reset:
   - Scroll down to "Factory Reset"
   - Tap "Factory Reset"
   - Confirm by tapping "Yes, Reset"
   - Enter "CONFIRM" in the text field when prompted
   - Tap "Reset Now"

4. Wait for the reset process to complete:
   - Do not interrupt the power during this process
   - The robot will restart automatically when complete (typically 5-10 minutes)

### Method 2: Using SSH Access

If you have SSH access to the robot:

1. Connect to the robot via SSH:
   ```bash
   ssh admin@[robot-ip-address]
   ```

2. Navigate to the recovery directory:
   ```bash
   cd /opt/axbot/recovery
   ```

3. Run the factory reset script:
   ```bash
   sudo ./factory_reset.sh
   ```

4. Confirm the reset when prompted by typing "CONFIRM"

5. Wait for the process to complete and the robot to restart

### Method 3: Using Physical Reset Button

If the robot is unresponsive to software methods:

1. Locate the small reset pinhole on the underside of the robot
   (typically near the serial number sticker)

2. Using a paperclip or similar tool, press and hold the reset button for 10 seconds

3. Release when all LEDs flash simultaneously

4. The robot will initiate the factory reset procedure automatically

## After Factory Reset

After the factory reset completes:

1. The robot will restart and enter initial setup mode
2. Follow the standard setup procedure to reconfigure the robot
3. Reconnect to your network
4. Reinstall any official updates
5. Restore your maps if needed

## Troubleshooting

If factory reset fails:

1. Try an alternative reset method from those listed above
2. Ensure the robot has sufficient battery power (at least 50%)
3. If all methods fail, contact support with the following information:
   - Robot serial number
   - Description of the issue
   - Steps you've already attempted
   - Any error messages displayed

## Preventing Future Issues

To minimize the risk of needing factory resets in the future:

1. Always test AI module changes in simulation mode first
2. Enable automatic backups of robot configurations
3. Use the monitoring tools to detect issues early
4. Keep the robot's firmware updated
5. Implement gradual rollout of new features rather than all at once

## Contact Support

If you encounter any issues during the factory reset process or need additional assistance, contact support:

- Email: support@example.com
- Phone: 1-800-555-1234
- Support Portal: https://support.example.com