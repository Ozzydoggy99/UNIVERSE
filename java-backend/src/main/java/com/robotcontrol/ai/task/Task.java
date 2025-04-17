package com.robotcontrol.ai.task;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Class to represent a robot task
 */
@Data
@Builder
public class Task {
    
    public enum TaskType {
        PICKUP,          // Pick up item
        DELIVERY,        // Deliver item
        CLEANING,        // Clean area
        INSPECTION,      // Inspect area
        MAINTENANCE,     // Perform self-maintenance
        CHARGING,        // Charge battery
        NAVIGATION,      // Navigate to location
        ESCORT,          // Escort a person
        MONITORING,      // Monitor an area
        CUSTOM           // Custom task
    }
    
    public enum TaskStatus {
        PENDING,         // Not yet started
        ASSIGNED,        // Assigned to robot but not started
        IN_PROGRESS,     // Currently executing
        PAUSED,          // Temporarily paused
        COMPLETED,       // Successfully completed
        FAILED,          // Failed to complete
        CANCELLED        // Cancelled before completion
    }
    
    public enum TaskPriority {
        LOW,
        NORMAL,
        HIGH,
        URGENT
    }
    
    // Task identification
    private String id;
    private String title;
    private String description;
    
    // Task type and status
    private TaskType type;
    private TaskStatus status;
    private TaskPriority priority;
    
    // Assignment
    private String assignedRobot;
    private String assignedUser;
    
    // Timing
    private LocalDateTime createdAt;
    private LocalDateTime scheduledStartTime;
    private LocalDateTime actualStartTime;
    private LocalDateTime completedTime;
    private Integer estimatedDurationMinutes;
    private Integer actualDurationMinutes;
    
    // Location information
    private Double startX;
    private Double startY;
    private Double startZ;
    private String startFloor;
    private String startBuilding;
    
    private Double destinationX;
    private Double destinationY;
    private Double destinationZ;
    private String destinationFloor;
    private String destinationBuilding;
    
    // Task dependencies
    private List<String> dependsOnTaskIds;
    private boolean isBlocking;
    
    // Task details
    private Map<String, Object> taskParameters;
    
    // Result information
    private boolean successful;
    private String resultMessage;
    private Map<String, Object> resultData;
    
    // Energy usage
    private Double estimatedEnergyUsage;
    private Double actualEnergyUsage;
}