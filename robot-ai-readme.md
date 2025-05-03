# Robot AI Integration Package

This package installs an AI integration system on your AxBot robot, enabling direct on-robot intelligence with seamless connection to the central management platform.

## Benefits

- **Reduced latency**: Commands execute almost instantly without network delay
- **Enhanced reliability**: Robot continues working during network outages
- **Precision movement**: Direct access to low-level controls enables finer movements
- **Smarter navigation**: On-robot processing for immediate decision-making
- **Energy efficiency**: Reduces constant network data transmission
- **Local fallback**: Critical operations don't depend on external systems

## Installation Instructions

1. **Download the installer script** to your robot:

   ```bash
   wget https://your-server.com/robot-ai-installer.sh -O robot-ai-installer.sh
   chmod +x robot-ai-installer.sh
   ```

2. **Test installation** (optional - simulates installation without making changes):

   ```bash
   ./robot-ai-installer.sh --test
   ```

3. **Perform actual installation**:

   ```bash
   ./robot-ai-installer.sh
   ```

4. **Verify installation** by checking the service status:

   ```bash
   systemctl status robot-ai
   ```

5. **Connect to the web interface** to confirm setup:

   ```
   http://ROBOT_IP:8090
   ```

## Configuration

The AI system is configured to automatically connect to your central management platform. You can modify connection settings in the configuration file:

```bash
nano /etc/robot-ai/config.json
```

Main configuration options:

- `server_url`: URL of your central management server
- `robot_id`: Unique identifier for this robot (defaults to hostname)
- `secret_key`: Authentication token for secure communication
- `log_level`: Logging verbosity (debug, info, warning, error)

After changing configuration, restart the service:

```bash
systemctl restart robot-ai
```

## Logging

View real-time logs with:

```bash
tail -f /var/log/robot-ai.log
```

## Features

- **ROS Integration**: Directly interfaces with ROS topics and services
- **WebSocket API**: Real-time communication with the robot
- **Machine Learning**: On-robot intelligence for navigation and obstacle avoidance
- **Sensor Fusion**: Combines data from all robot sensors for better decision-making
- **Fallback Controls**: Continues functioning during network outages
- **Central Integration**: Maintains connection with your central management platform

## Updating

Updates are handled automatically when available. To manually trigger an update:

```bash
/opt/robot-ai/update.sh
```

## Troubleshooting

Common issues and solutions:

1. **Service won't start**:
   - Check logs: `journalctl -u robot-ai`
   - Verify ROS is running: `rosnode list`

2. **Cannot connect to web interface**:
   - Verify service is running: `systemctl status robot-ai`
   - Check firewall settings: `sudo ufw status`

3. **Connection issues with central server**:
   - Verify network connectivity: `ping your-server.com`
   - Check server URL in config: `/etc/robot-ai/config.json`

## Technical Architecture

The Robot AI system consists of:

1. **ROS Node**: Interfaces directly with robot hardware
2. **Web Server**: Provides API access and status dashboard
3. **ML Engine**: Processes sensor data and makes decisions
4. **Central Connector**: Maintains connection with management platform

## Support

For assistance, contact support at robot-ai-support@example.com or open an issue in the support portal.