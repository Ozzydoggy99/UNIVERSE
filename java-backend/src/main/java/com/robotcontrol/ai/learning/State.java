package com.robotcontrol.ai.learning;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Class to represent the state of a robot in a reinforcement learning context
 */
@Data
@Builder
public class State {
    
    // Robot identification
    private String serialNumber;
    
    // Snapshot timestamp
    private long timestamp;
    
    // Position information
    private double x;
    private double y;
    private double z;
    private double orientation;
    private String floor;
    private String building;
    
    // Battery and system status
    private double batteryLevel;
    private String operationalStatus;
    private String currentMode;
    
    // Task information
    private String currentTask;
    private double taskProgress;
    
    // Environment information
    private List<Map<String, Object>> nearbyObstacles;
    private List<Map<String, Object>> nearbyHumans;
    private Map<String, Object> environmentMetrics;
    
    // Movement parameters
    private double currentSpeed;
    private double targetSpeed;
    private double acceleration;
    
    // Additional features
    private Map<String, Object> additionalFeatures;
    
    /**
     * Get a vector representation of the state for model input
     * @return Array of doubles representing the state
     */
    public double[] toVector() {
        // This would return a normalized vector of the state for ML model input
        // Simplified implementation
        double[] vector = new double[10];
        
        // Position (normalized to -1 to 1 range assuming building scale)
        vector[0] = normalize(x, -100, 100);
        vector[1] = normalize(y, -100, 100);
        vector[2] = normalize(z, -10, 10);
        
        // Orientation (normalized to -1 to 1 range)
        vector[3] = normalize(orientation, 0, 360);
        
        // Battery (normalized to 0 to 1 range)
        vector[4] = normalize(batteryLevel, 0, 100);
        
        // Speed (normalized to 0 to 1 range)
        vector[5] = normalize(currentSpeed, 0, 2);
        vector[6] = normalize(targetSpeed, 0, 2);
        
        // Task progress (normalized to 0 to 1 range)
        vector[7] = normalize(taskProgress, 0, 100);
        
        // Nearby obstacles/humans (simplified as count)
        vector[8] = nearbyObstacles != null ? normalize(nearbyObstacles.size(), 0, 10) : 0;
        vector[9] = nearbyHumans != null ? normalize(nearbyHumans.size(), 0, 5) : 0;
        
        return vector;
    }
    
    /**
     * Normalize a value to range -1 to 1
     * @param value Value to normalize
     * @param min Minimum value in original range
     * @param max Maximum value in original range
     * @return Normalized value
     */
    private double normalize(double value, double min, double max) {
        return 2 * ((value - min) / (max - min)) - 1;
    }
}