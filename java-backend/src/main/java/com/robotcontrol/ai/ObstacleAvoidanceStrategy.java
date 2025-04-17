package com.robotcontrol.ai;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Class to represent a learned strategy for avoiding an obstacle
 */
@Data
@Builder
public class ObstacleAvoidanceStrategy {
    
    // Robot that created this strategy
    private String robotSerialNumber;
    
    // Obstacle location
    private double obstacleX;
    private double obstacleY;
    private double obstacleZ;
    
    // Radius around obstacle to which this strategy applies
    private double applicableRadius;
    
    // When this strategy was created
    private LocalDateTime createdAt;
    
    // When this strategy was last used/validated
    private LocalDateTime lastUsed;
    
    // Number of times this strategy was successfully used
    private int successCount;
    
    // Number of times this strategy failed
    private int failureCount;
    
    // Calculated success rate
    private double successRate;
    
    // Waypoints to navigate around the obstacle
    private List<Map<String, Double>> waypoints;
    
    // Additional parameters for navigation around this obstacle
    private Map<String, Object> navigationParameters;
    
    // Reference to the original obstacle event
    private ObstacleEvent sourceEvent;
    
    /**
     * Update success/failure statistics
     * @param success Whether the strategy was successful
     */
    public void updateStatistics(boolean success) {
        if (success) {
            successCount++;
        } else {
            failureCount++;
        }
        
        successRate = (double) successCount / (successCount + failureCount);
        lastUsed = LocalDateTime.now();
    }
}