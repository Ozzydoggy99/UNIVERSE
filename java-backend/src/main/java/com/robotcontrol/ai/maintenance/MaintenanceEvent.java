package com.robotcontrol.ai.maintenance;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Class to represent a maintenance-related event
 */
@Data
@Builder
public class MaintenanceEvent {
    
    public enum EventType {
        SCHEDULED,      // Scheduled maintenance
        UNSCHEDULED,    // Unscheduled maintenance
        ANOMALY,        // Anomaly detection
        FAILURE,        // Component failure
        MAINTENANCE,    // Maintenance performed
        REPAIR          // Repair performed
    }
    
    public enum Severity {
        INFORMATION,    // Informational only
        WARNING,        // Warning level
        ERROR,          // Error level
        CRITICAL        // Critical level
    }
    
    // Robot identification
    private String serialNumber;
    
    // When event occurred
    private LocalDateTime timestamp;
    
    // Type of event
    private EventType eventType;
    
    // Human-readable description
    private String description;
    
    // Component(s) affected
    private String affectedComponent;
    
    // Severity level
    private Severity severity;
    
    // Maintenance notes (if applicable)
    private String notes;
    
    // User who performed maintenance (if applicable)
    private String maintenanceUser;
    
    // Time spent (for maintenance events)
    private Integer minutesSpent;
    
    // Parts replaced (for maintenance events)
    private String partsReplaced;
}