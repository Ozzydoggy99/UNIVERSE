package com.robotcontrol.model.navigation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a point on the map
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MapPoint {
    
    private double x;
    private double y;
    private double z;
    
    // Optional properties
    private String name;         // Named points like "Elevator 1"
    private String type;         // Point type (waypoint, obstacle, elevator, etc.)
    private double orientation;  // Orientation in degrees
}