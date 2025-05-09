# Robot Safety Guidelines for Bin Transport Operations

## Critical Safety Requirements

### Jack Up/Down Operations
- **❗ CRITICAL**: Robot MUST be completely stopped before ANY jack up/down operations
- **❗ CRITICAL**: Never attempt to jack up/down while robot is in motion
- **❗ CRITICAL**: Ensure a clear 3-foot perimeter around the robot during jack operations

### Bin Detection
- Always verify bin presence at pickup location before attempting pickup
- Always verify dropoff location is clear before attempting dropoff
- Never stack bins (the system now prevents this automatically)

### Movement Safety
- Robot should move at reduced speed (≤0.5 m/s) when approaching bin positions
- Robot should pause briefly after arrival at a position before jack operations
- Maintain at least 5 feet of clearance around robot movement paths

## Zone-104 Workflow Safety Protocols

The Zone-104 workflow has been enhanced with the following safety features:

1. **Automatic Bin Detection**:
   - Checks for bin presence at pickup point
   - Checks if dropoff location is already occupied
   - Prevents unsafe stacking of bins

2. **Enhanced Movement Safety**:
   - Precise approach to pickup and dropoff locations
   - Two-phase movement (dock first, then precise positioning)
   - Reduced speed to ensure accuracy

3. **Critical Pause Timing**:
   - 3-second safety pause after movement, before jack up/down
   - 3-second safety pause after jack operation before next movement
   - Additional safety pauses between mission steps

## Emergency Procedures

1. **Emergency Stop**:
   - Press the physical emergency stop button on the robot if:
     - Robot makes unexpected movements
     - Robot is about to collide with a person or object
     - Jack operation is occurring with a person too close
     - Any unsafe condition is observed

2. **Recovery After Emergency Stop**:
   - Ensure the area around the robot is clear
   - Reset the emergency stop button by twisting it
   - Use the admin panel to send the robot to a safe position
   - Re-initiate the mission if necessary

## Administrator Responsibilities

1. **Before Each Mission**:
   - Verify the path is clear of obstacles
   - Ensure pickup location has a bin (if expected)
   - Ensure dropoff location is clear
   - Verify no emergency stop conditions exist

2. **During Missions**:
   - Monitor robot movement and progress
   - Be prepared to press emergency stop if needed
   - Keep personnel away from active robot paths
   - Watch for unexpected robot behavior

3. **After Mission Completion**:
   - Verify bin was successfully transported
   - Check robot position
   - Ensure robot is ready for next mission

## Technical Safety Implementations

1. **Motion Control**:
   ```
   properties: {
     max_trans_vel: 0.5,  // Maximum translational velocity (m/s)
     max_rot_vel: 0.5,    // Maximum rotational velocity (rad/s)
     acc_lim_x: 0.5,      // Maximum acceleration (m/s²)
     acc_lim_theta: 0.5,  // Maximum angular acceleration (rad/s²)
     planning_mode: "directional"
   }
   ```

2. **Error Detection**:
   - Connectivity monitoring
   - Movement completion verification
   - Emergency stop detection
   - Safe error recovery

3. **Pauses for Safety**:
   ```javascript
   // SAFETY pause before jack operations
   console.log(`⚠️ SAFETY PAUSE: Ensuring robot is COMPLETELY STOPPED`);
   await new Promise(resolve => setTimeout(resolve, 3000));
   ```

## Safety Check Flowchart

```
START MISSION
  ↓
CHECK BIN AT PICKUP?
  ↓
  YES → CHECK DROPOFF CLEAR?
    ↓
    YES → PROCEED WITH MISSION
      ↓
      MOVE TO PICKUP DOCKING
        ↓
        SAFETY PAUSE (2s)
          ↓
          MOVE TO PICKUP POSITION
            ↓
            SAFETY PAUSE (3s) ← CRITICAL
              ↓
              JACK UP
                ↓
                SAFETY PAUSE (3s)
                  ↓
                  MOVE TO DROPOFF DOCKING
                    ↓
                    SAFETY PAUSE (2s)
                      ↓
                      MOVE TO DROPOFF POSITION
                        ↓
                        SAFETY PAUSE (3s) ← CRITICAL
                          ↓
                          JACK DOWN
                            ↓
                            SAFETY PAUSE (3s)
                              ↓
                              RETURN TO STANDBY
                                ↓
                                END MISSION
    NO → ABORT (DROPOFF OCCUPIED)
  NO → SKIP TO STANDBY (NO BIN TO PICKUP)
```

Remember: Safety is our highest priority. No bin transport is so urgent that we cannot take the time to do it safely.

## Communication During Operations

1. **Clear Announcements**: Verbally announce when starting a robot mission
2. **Radio Contact**: Maintain radio contact during critical operations
3. **Signage**: Place temporary "Robot in Operation" signs in active areas
4. **Training**: Ensure all personnel are trained on robot safety procedures

---

Last updated: May 9, 2025