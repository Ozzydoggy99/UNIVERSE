package com.robotcontrol.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Model class for robot status information
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RobotStatus {
    
    // Robot identification
    private String serialNumber;
    private String model;
    
    // Battery information
    private double battery; // percentage
    private String chargingStatus; // "charging", "discharging", "full"
    private double batteryTimeRemaining; // minutes
    
    // Operational status
    private String status; // "online", "offline", "error", "maintenance"
    private String mode; // "auto", "manual", "sleep", "diagnostic"
    
    // Timestamp of status update
    private LocalDateTime lastUpdate;
    
    // Current activity
    private String currentTask;
    private double taskProgress; // percentage
    
    // Error state
    private boolean error;
    private String errorCode;
    private String errorMessage;
    
    // Connection information
    private String connectionType; // "wifi", "cellular", "bluetooth"
    private int signalStrength; // percentage
    
    // Software versions
    private String firmwareVersion;
    private LocalDateTime lastFirmwareUpdate;
    
    // Maintenance information
    private LocalDateTime nextScheduledMaintenance;
    private int daysSinceLastMaintenance;
    
    // Additional custom status fields
    private Map<String, Object> additionalStatus;
}