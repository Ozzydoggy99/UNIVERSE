package com.robotcontrol.ai;

import lombok.Builder;
import lombok.Data;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * Class to represent an obstacle detection event
 */
@Data
@Builder
public class ObstacleEvent {
    
    public enum Type {
        STATIC,       // Fixed obstacle like wall or furniture
        TEMPORARY,    // Temporary obstacle that may be moved
        MOVING,       // Moving obstacle (not human)
        HUMAN,        // Human obstacle
        RECURRING     // Obstacle encountered multiple times
    }
    
    // Robot that encountered the obstacle
    private String robotSerialNumber;
    
    // Location of the obstacle
    private double x;
    private double y;
    private double z;
    
    // Type of obstacle
    private Type type;
    
    // Time when obstacle was detected
    private LocalDateTime timestamp;
    
    // Free-form description
    private String description;
    
    // How many times this obstacle has been encountered
    private int occurrenceCount;
    
    // Estimated size
    private double estimatedWidth;
    private double estimatedHeight;
    
    // Whether the robot was able to navigate around it
    private boolean successfullyAvoided;
    
    // Method used to avoid (if successful)
    private String avoidanceMethod;
}