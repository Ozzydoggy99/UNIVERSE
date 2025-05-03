# Robot AI Factory Reset and Safety Documentation

This document provides important safety information regarding the factory reset procedure for the Robot AI package. Please read carefully before performing any reset operations.

## ⚠️ WARNING

A factory reset will permanently erase all user data, maps, configurations, and custom settings from the Robot AI package. This operation cannot be undone. Always back up important data before proceeding with a factory reset.

## Factory Reset Procedure

The factory reset procedure should only be performed when absolutely necessary, such as:
- When transferring the robot to a new owner
- When experiencing persistent software issues that cannot be resolved through normal troubleshooting
- When instructed to do so by authorized support personnel

### Prerequisites
- Ensure the robot is fully charged or connected to a power source
- Ensure the robot is in a safe, stationary position
- Ensure you have backed up any important data

### Method 1: Using the Web Interface

1. Access the Robot AI web interface at http://<robot-ip>:8080
2. Navigate to the System Settings page
3. Scroll down to the "Factory Reset" section
4. Enter the robot's serial number to confirm
5. Click the "Factory Reset" button
6. Follow the on-screen instructions

### Method 2: Using the Command Line

1. SSH into the robot or access a terminal session
2. Navigate to the Robot AI installation directory:
   ```
   cd /opt/robot-ai
   ```
3. Run the factory reset script with the required confirmation parameter:
   ```
   sudo ./scripts/factory-reset.sh --confirm-serial-number=<robot-serial-number>
   ```
4. Follow the prompts to complete the reset process

## Safety Precautions

### Before Reset
- Ensure the robot is in a safe location away from stairs, edges, or hazards
- Disconnect any additional peripherals or custom hardware
- Notify all users that the robot will be unavailable during the reset process

### During Reset
- Do not power off the robot during the reset process
- Do not disconnect the robot from its network
- Do not attempt to use the robot during the reset process

### After Reset
- After the reset completes, the robot will restart automatically
- You will need to reconfigure all settings and reinstall any custom modules
- Maps will need to be recreated
- IoT device connections (elevators, doors) will need to be reestablished

## Developer Mode Safety

When operating the Robot AI package in developer mode, additional safety considerations apply:

### Developer Mode Limitations
- Developer mode disables certain safety features to allow for testing and development
- The robot may respond differently to commands compared to normal operation
- Automatic obstacle detection may be modified or disabled

### Developer Safety Guidelines
1. Always operate in a controlled environment
2. Maintain a physical emergency stop button within reach
3. Do not test new features in areas with people, animals, or valuable items
4. Always supervise the robot during testing
5. Implement proper version control for your code changes
6. Document all modifications and test results

## Recovery From Failed Reset

If the factory reset procedure fails or is interrupted, follow these steps:

1. Do not power off the robot
2. Check the reset logs at `/opt/robot-ai/logs/factory-reset.log`
3. If the robot is responsive, attempt the reset procedure again
4. If the robot is unresponsive, wait 10 minutes for any automatic recovery processes to complete
5. If no recovery occurs, contact authorized support personnel

## Support Contact Information

If you encounter any issues during the factory reset process, contact:

- Technical Support: support@robotmanufacturer.com
- Emergency Hotline: +1-800-ROBOT-HELP

## Compliance Information

The factory reset procedure is designed to comply with data protection regulations and ensure complete removal of user data. After a factory reset, all personal data, usage history, and custom configurations will be permanently deleted.

---

By proceeding with a factory reset, you acknowledge that you have read and understood the information in this document, and accept the risk of permanent data loss.

Document Version: 1.0.0
Last Updated: 2025-05-03