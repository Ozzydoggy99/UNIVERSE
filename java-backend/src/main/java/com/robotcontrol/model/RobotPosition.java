package com.robotcontrol.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Model class for robot position data
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RobotPosition {
    
    // Robot identifier
    private String serialNumber;
    
    // 3D position coordinates
    private double x;
    private double y;
    private double z;
    
    // Orientation in degrees (0-359)
    private double orientation;
    
    // Current movement speed
    private double speed;
    
    // When position was recorded
    private LocalDateTime timestamp;
    
    // Floor or level identifier
    private String floor;
    
    // Building identifier
    private String building;
    
    // Navigation status (e.g., "moving", "stopped")
    private String navigationStatus;
}