package com.robotcontrol.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Model class for robot sensor data
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RobotSensorData {
    
    // Robot identifier
    private String serialNumber;
    
    // Basic environmental sensors
    private double temperature; // in Celsius
    private double humidity; // percentage
    
    // Battery level (percentage)
    private double battery;
    
    // Array of proximity sensor readings (in meters)
    private double[] proximity;
    
    // When readings were taken
    private LocalDateTime timestamp;
    
    // Light level (lux)
    private double lightLevel;
    
    // Noise level (dB)
    private double noiseLevel;
    
    // Air quality index
    private double airQuality;
    
    // Motion detection status
    private boolean motionDetected;
    
    // Additional custom sensor readings
    private Map<String, Object> additionalSensors;
}