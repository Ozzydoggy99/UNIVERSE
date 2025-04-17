package com.robotcontrol.ai;

import com.robotcontrol.model.RobotPosition;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Class to store learning data for a specific robot
 */
@Getter
public class RobotLearningData {
    
    private final String serialNumber;
    private final List<RobotPosition> positionHistory = new ArrayList<>();
    private final List<ObstacleEvent> obstacleEvents = new ArrayList<>();
    private final List<HumanInteractionEvent> humanInteractions = new ArrayList<>();
    private final List<ObstacleAvoidanceStrategy> avoidanceStrategies = new ArrayList<>();
    
    private Map<String, Object> optimizedParameters = new HashMap<>();
    private Map<String, Object> humanAvoidanceParameters = new HashMap<>();
    
    private double movementEfficiencyScore = 1.0;
    private int totalPositionsLearned = 0;
    private LocalDateTime lastUpdated = LocalDateTime.now();
    
    public RobotLearningData(String serialNumber) {
        this.serialNumber = serialNumber;
    }
    
    /**
     * Add position data for learning
     * @param positions Position data
     */
    public void addPositionData(List<RobotPosition> positions) {
        positionHistory.addAll(positions);
        totalPositionsLearned += positions.size();
        
        // Limit history size to prevent memory issues
        if (positionHistory.size() > 1000) {
            positionHistory.subList(0, positionHistory.size() - 1000).clear();
        }
        
        lastUpdated = LocalDateTime.now();
    }
    
    /**
     * Add obstacle event
     * @param event Obstacle event
     */
    public void addObstacleEvent(ObstacleEvent event) {
        obstacleEvents.add(event);
        
        // Limit history size
        if (obstacleEvents.size() > 100) {
            obstacleEvents.remove(0);
        }
        
        lastUpdated = LocalDateTime.now();
    }
    
    /**
     * Add human interaction event
     * @param event Human interaction event
     */
    public void addHumanInteraction(HumanInteractionEvent event) {
        humanInteractions.add(event);
        
        // Limit history size
        if (humanInteractions.size() > 100) {
            humanInteractions.remove(0);
        }
        
        lastUpdated = LocalDateTime.now();
    }
    
    /**
     * Add avoidance strategy
     * @param strategy Avoidance strategy
     */
    public void addAvoidanceStrategy(ObstacleAvoidanceStrategy strategy) {
        avoidanceStrategies.add(strategy);
        
        // Limit size
        if (avoidanceStrategies.size() > 50) {
            avoidanceStrategies.remove(0);
        }
        
        lastUpdated = LocalDateTime.now();
    }
    
    /**
     * Set optimized parameters
     * @param params Optimized parameters
     */
    public void setOptimizedParameters(Map<String, Object> params) {
        this.optimizedParameters = new HashMap<>(params);
        lastUpdated = LocalDateTime.now();
    }
    
    /**
     * Set human avoidance parameters
     * @param params Human avoidance parameters
     */
    public void setHumanAvoidanceParameters(Map<String, Object> params) {
        this.humanAvoidanceParameters = new HashMap<>(params);
        lastUpdated = LocalDateTime.now();
    }
    
    /**
     * Set movement efficiency score
     * @param score Efficiency score
     */
    public void setMovementEfficiencyScore(double score) {
        this.movementEfficiencyScore = score;
        lastUpdated = LocalDateTime.now();
    }
    
    /**
     * Find avoidance strategy for a specific location
     * @param x X coordinate
     * @param y Y coordinate
     * @param z Z coordinate
     * @param radius Search radius
     * @return Avoidance strategy or null if not found
     */
    public ObstacleAvoidanceStrategy findAvoidanceStrategyForLocation(double x, double y, double z, double radius) {
        for (ObstacleAvoidanceStrategy strategy : avoidanceStrategies) {
            double distance = calculateDistance(x, y, z, strategy.getObstacleX(), strategy.getObstacleY(), strategy.getObstacleZ());
            if (distance <= radius) {
                return strategy;
            }
        }
        return null;
    }
    
    /**
     * Calculate 3D distance between points
     */
    private double calculateDistance(double x1, double y1, double z1, double x2, double y2, double z2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2));
    }
}