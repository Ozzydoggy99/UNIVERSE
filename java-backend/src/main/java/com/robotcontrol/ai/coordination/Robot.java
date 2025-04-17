package com.robotcontrol.ai.coordination;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Class to represent a robot in the coordination system
 */
@Data
@Builder
public class Robot {
    
    public enum RobotStatus {
        AVAILABLE,
        BUSY,
        CHARGING,
        MAINTENANCE,
        OFFLINE,
        ERROR
    }
    
    // Robot identification
    private String id;
    private String serialNumber;
    private String model;
    private String name;
    
    // Status information
    private RobotStatus status;
    private double batteryLevel;
    private String errorMessage;
    
    // Location information
    private Task.Location currentLocation;
    
    // Capabilities
    private List<String> capabilities;
    private double maxPayload;
    private double maxSpeed;
    private double maxOperatingTime;
    
    // Current task
    private String currentTaskId;
    private double taskProgress;
    
    // Schedule
    private List<String> scheduledTaskIds;
    private LocalDateTime nextAvailableTime;
    
    // Performance metrics
    private int completedTaskCount;
    private int failedTaskCount;
    private double averageTaskCompletionTime;
    private double efficiencyRating;
    
    // For coordination
    private boolean participatingInCoordination;
    private String currentCoordinationGroupId;
    private boolean isCoordinator;
    
    // Additional data
    private Map<String, Object> additionalData;
    
    /**
     * Calculate estimated availability for a new task
     * @param estimatedTaskDuration Estimated duration of new task in minutes
     * @return Estimated start time for the new task
     */
    public LocalDateTime calculateAvailability(int estimatedTaskDuration) {
        // If robot is available now, return current time
        if (status == RobotStatus.AVAILABLE) {
            return LocalDateTime.now();
        }
        
        // If robot has a next available time, return that
        if (nextAvailableTime != null && nextAvailableTime.isAfter(LocalDateTime.now())) {
            return nextAvailableTime;
        }
        
        // Otherwise, estimate based on current task progress
        if (status == RobotStatus.BUSY && currentTaskId != null && taskProgress > 0) {
            // Estimate completion time based on progress
            // This is a simplified calculation - in reality would use more sophisticated estimation
            double remainingProgress = 100 - taskProgress;
            double minutesRemaining = remainingProgress * 0.5; // Assuming 0.5 minutes per 1% progress
            
            return LocalDateTime.now().plusMinutes((long) minutesRemaining);
        }
        
        // Default to now + 30 minutes if we can't make a better estimate
        return LocalDateTime.now().plusMinutes(30);
    }
    
    /**
     * Check if robot has a specific capability
     * @param capability Capability to check
     * @return True if robot has the capability
     */
    public boolean hasCapability(String capability) {
        return capabilities != null && capabilities.contains(capability);
    }
    
    /**
     * Check if robot has sufficient battery for a task
     * @param estimatedTaskDuration Estimated duration of task in minutes
     * @return True if battery is sufficient
     */
    public boolean hasSufficientBattery(int estimatedTaskDuration) {
        // Estimate battery usage per minute
        double usagePerMinute = 0.2; // 0.2% per minute
        
        // Calculate required battery
        double requiredBattery = estimatedTaskDuration * usagePerMinute;
        
        // Add safety margin of 10%
        requiredBattery += 10;
        
        // Check if current battery level is sufficient
        return batteryLevel >= requiredBattery;
    }
    
    /**
     * Calculate suitability score for a task
     * @param task Task to evaluate
     * @return Suitability score (0-100, higher is better)
     */
    public double calculateTaskSuitability(Task task) {
        double score = 50; // Start with a neutral score
        
        // Check basic requirements
        if (status != RobotStatus.AVAILABLE && status != RobotStatus.BUSY) {
            return 0; // Robot not available
        }
        
        // Check capabilities
        switch (task.getType()) {
            case PICKUP:
            case DELIVERY:
                if (!hasCapability("ARM")) {
                    return 0; // Need arm capability for pickup/delivery
                }
                score += 10;
                break;
                
            case CLEANING:
                if (!hasCapability("CLEANING")) {
                    return 0; // Need cleaning capability
                }
                score += 10;
                break;
                
            case SURVEILLANCE:
                if (!hasCapability("CAMERA")) {
                    return 0; // Need camera capability
                }
                score += 10;
                break;
                
            case TRANSPORT:
                // Check payload capacity
                if (task.getParameters() != null && task.getParameters().containsKey("weight")) {
                    double weight = Double.parseDouble(task.getParameters().get("weight").toString());
                    if (weight > maxPayload) {
                        return 0; // Too heavy
                    }
                    // Better score for robots with appropriate payload capacity
                    score += 10 * (1 - (weight / maxPayload));
                }
                break;
        }
        
        // Check battery
        if (task.getEstimatedDurationMinutes() != null) {
            if (!hasSufficientBattery(task.getEstimatedDurationMinutes())) {
                return 0; // Insufficient battery
            }
            
            // Better score for robots with more battery
            score += 10 * (batteryLevel / 100.0);
        }
        
        // Check location proximity
        if (currentLocation != null && task.getStartLocation() != null) {
            double distance = currentLocation.distanceTo(task.getStartLocation());
            
            // Better score for closer robots
            double distanceFactor = Math.min(1.0, distance / 100.0);
            score += 20 * (1 - distanceFactor);
            
            // Penalty for different floors
            if (!currentLocation.isSameFloor(task.getStartLocation())) {
                score -= 10;
            }
        }
        
        // Adjust based on performance metrics
        if (completedTaskCount > 0) {
            double successRate = (double) completedTaskCount / (completedTaskCount + failedTaskCount);
            score += 10 * successRate;
        }
        
        // Cap score at 100
        return Math.min(100, score);
    }
}