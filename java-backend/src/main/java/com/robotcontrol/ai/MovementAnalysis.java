package com.robotcontrol.ai;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Class to encapsulate the analysis of robot movement
 */
@Data
@Builder
public class MovementAnalysis {
    
    // Overall efficiency score from 0.0 to 1.0
    private double efficiencyScore;
    
    // Average speed during analysis period
    private double averageSpeed;
    
    // Time spent idle (not moving)
    private double idleTimePercentage;
    
    // Unnecessary path changes or direction shifts
    private int pathDeviations;
    
    // Average distance to obstacles during navigation
    private double averageObstacleDistance;
    
    // Whether robot took longer than optimal path
    private boolean suboptimalPathDetected;
    
    // Total distance traveled
    private double distanceTraveled;
    
    // Specific path segments with low efficiency
    private List<Map<String, Object>> problemSegments;
    
    // Recommended improvements
    private List<String> recommendations;
}