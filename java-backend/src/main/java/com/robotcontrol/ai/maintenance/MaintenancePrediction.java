package com.robotcontrol.ai.maintenance;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Class to represent a maintenance prediction for a robot
 */
@Data
@Builder
public class MaintenancePrediction {
    
    public enum MaintenanceUrgency {
        LOW,        // Maintenance recommended within 30+ days
        MEDIUM,     // Maintenance recommended within 14-30 days
        HIGH,       // Maintenance recommended within 7-14 days
        CRITICAL    // Maintenance required within 7 days
    }
    
    // Robot identification
    private String serialNumber;
    private String model;
    
    // When prediction was made
    private LocalDateTime predictionTimestamp;
    
    // Predicted maintenance needs
    private MaintenanceUrgency urgency;
    private LocalDateTime recommendedMaintenanceDate;
    
    // Component predictions
    private Map<String, ComponentStatus> componentStatus;
    
    // Failure probability (0.0 to 1.0)
    private double failureProbability;
    
    // Estimated remaining operational time (hours)
    private double estimatedTimeToMaintenance;
    
    // Confidence in prediction (0.0 to 1.0)
    private double predictionConfidence;
    
    // Factors contributing to prediction
    private List<MaintenanceFactor> maintenanceFactors;
    
    // Recommended actions
    private List<String> recommendedActions;
    
    /**
     * Nested class to represent component status
     */
    @Data
    @Builder
    public static class ComponentStatus {
        private String name;
        private String status; // "good", "fair", "poor", "critical"
        private double wearPercentage;
        private double remainingLifeHours;
        private String recommendedAction;
    }
    
    /**
     * Nested class to represent maintenance factors
     */
    @Data
    @Builder
    public static class MaintenanceFactor {
        private String factorName;
        private String description;
        private double contribution; // How much this factor contributes to prediction (0.0 to 1.0)
        private double currentValue;
        private double threshold;
        private String trend; // "improving", "stable", "worsening"
    }
}