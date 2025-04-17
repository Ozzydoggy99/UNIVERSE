package com.robotcontrol.ai.coordination;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Class to represent a task in the coordination system
 * (This is a simplified version of the task model from the task package)
 */
@Data
@Builder
public class Task {
    
    public enum TaskType {
        PICKUP,          // Pick up item
        DELIVERY,        // Deliver item
        CLEANING,        // Clean area
        SURVEILLANCE,    // Monitor area
        TRANSPORT,       // Transport objects or people
        ESCORTING,       // Escort a person
        MAINTENANCE,     // Self-maintenance task
        CHARGING,        // Charging task
        CUSTOM           // Custom task
    }
    
    public enum TaskStatus {
        UNASSIGNED,      // Not yet assigned to any robot
        ASSIGNED,        // Assigned but not started
        IN_PROGRESS,     // Currently being executed
        PAUSED,          // Temporarily paused
        COMPLETED,       // Successfully completed
        FAILED,          // Failed to complete
        CANCELLED,       // Cancelled before completion
        WAITING          // Waiting for a dependency or condition
    }
    
    public enum TaskPriority {
        LOW,
        NORMAL,
        HIGH,
        CRITICAL
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
    private String assignedRobotId;
    private LocalDateTime assignedTime;
    
    // Timing
    private LocalDateTime createdAt;
    private LocalDateTime scheduledStartTime;
    private LocalDateTime actualStartTime;
    private LocalDateTime completedTime;
    private Integer estimatedDurationMinutes;
    
    // Location information
    private Location startLocation;
    private Location targetLocation;
    
    // Task dependencies
    private List<String> dependsOnTaskIds;
    private boolean isBlocking;
    
    // Task details
    private Map<String, Object> parameters;
    
    // For multi-robot tasks
    private boolean isMultiRobot;
    private List<String> participatingRobotIds;
    private String coordinatorRobotId;
    
    // For task decomposition
    private String parentTaskId;
    private List<String> subtaskIds;
    
    // For reporting
    private Map<String, Object> resultData;
    
    /**
     * Inner class for location information
     */
    @Data
    @Builder
    public static class Location {
        private double x;
        private double y;
        private double z;
        private String floor;
        private String building;
        private String locationName;
        
        /**
         * Calculate distance to another location
         * @param other Other location
         * @return Distance in meters (ignoring floors)
         */
        public double distanceTo(Location other) {
            return Math.sqrt(
                    Math.pow(other.x - x, 2) +
                    Math.pow(other.y - y, 2) +
                    Math.pow(other.z - z, 2)
            );
        }
        
        /**
         * Check if locations are on the same floor
         * @param other Other location
         * @return True if on same floor
         */
        public boolean isSameFloor(Location other) {
            return floor != null && floor.equals(other.floor) &&
                   building != null && building.equals(other.building);
        }
    }
}