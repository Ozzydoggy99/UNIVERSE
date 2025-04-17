package com.robotcontrol.ai.learning;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * Class to represent an action in a reinforcement learning context
 */
@Data
@Builder
public class Action {
    
    public enum ActionType {
        MOVE,              // Move in a direction
        ADJUST_SPEED,      // Change speed
        CHANGE_DIRECTION,  // Change orientation
        STOP,              // Full stop
        NAVIGATE_TO,       // Navigate to coordinates
        AVOID_OBSTACLE,    // Execute obstacle avoidance
        PICK_UP,           // Pick up an item
        DROP,              // Drop an item
        INTERACT,          // Interact with environment
        WAIT,              // Wait/idle
        CHARGE             // Go to charging station
    }
    
    // Action type
    private ActionType type;
    
    // Action parameters
    private Map<String, Object> parameters;
    
    // When action was taken
    private long timestamp;
    
    // Robot that took the action
    private String serialNumber;
    
    // State before action
    private State previousState;
    
    // Whether action was successful
    private boolean successful;
    
    // Action result details
    private String resultDescription;
    
    /**
     * Get a vector representation of the action for model input
     * @return Array of doubles representing the action
     */
    public double[] toVector() {
        // Create one-hot encoding of action type
        double[] vector = new double[ActionType.values().length];
        vector[type.ordinal()] = 1.0;
        return vector;
    }
    
    /**
     * Create a MOVE action
     * @param serialNumber Robot serial number
     * @param directionX X direction component (-1 to 1)
     * @param directionY Y direction component (-1 to 1)
     * @param speed Speed (0 to 1)
     * @param previousState Previous state
     * @return Action object
     */
    public static Action createMoveAction(String serialNumber, double directionX, double directionY, double speed, State previousState) {
        Map<String, Object> params = Map.of(
                "directionX", directionX,
                "directionY", directionY,
                "speed", speed
        );
        
        return Action.builder()
                .type(ActionType.MOVE)
                .parameters(params)
                .timestamp(System.currentTimeMillis())
                .serialNumber(serialNumber)
                .previousState(previousState)
                .build();
    }
    
    /**
     * Create an ADJUST_SPEED action
     * @param serialNumber Robot serial number
     * @param speed New speed (0 to 1)
     * @param previousState Previous state
     * @return Action object
     */
    public static Action createAdjustSpeedAction(String serialNumber, double speed, State previousState) {
        Map<String, Object> params = Map.of("speed", speed);
        
        return Action.builder()
                .type(ActionType.ADJUST_SPEED)
                .parameters(params)
                .timestamp(System.currentTimeMillis())
                .serialNumber(serialNumber)
                .previousState(previousState)
                .build();
    }
    
    /**
     * Create a CHANGE_DIRECTION action
     * @param serialNumber Robot serial number
     * @param orientation New orientation in degrees (0-359)
     * @param previousState Previous state
     * @return Action object
     */
    public static Action createChangeDirectionAction(String serialNumber, double orientation, State previousState) {
        Map<String, Object> params = Map.of("orientation", orientation);
        
        return Action.builder()
                .type(ActionType.CHANGE_DIRECTION)
                .parameters(params)
                .timestamp(System.currentTimeMillis())
                .serialNumber(serialNumber)
                .previousState(previousState)
                .build();
    }
    
    /**
     * Create a STOP action
     * @param serialNumber Robot serial number
     * @param previousState Previous state
     * @return Action object
     */
    public static Action createStopAction(String serialNumber, State previousState) {
        return Action.builder()
                .type(ActionType.STOP)
                .parameters(Map.of())
                .timestamp(System.currentTimeMillis())
                .serialNumber(serialNumber)
                .previousState(previousState)
                .build();
    }
    
    /**
     * Create a NAVIGATE_TO action
     * @param serialNumber Robot serial number
     * @param x Target X coordinate
     * @param y Target Y coordinate
     * @param z Target Z coordinate
     * @param floor Target floor
     * @param previousState Previous state
     * @return Action object
     */
    public static Action createNavigateToAction(String serialNumber, double x, double y, double z, String floor, State previousState) {
        Map<String, Object> params = Map.of(
                "x", x,
                "y", y,
                "z", z,
                "floor", floor
        );
        
        return Action.builder()
                .type(ActionType.NAVIGATE_TO)
                .parameters(params)
                .timestamp(System.currentTimeMillis())
                .serialNumber(serialNumber)
                .previousState(previousState)
                .build();
    }
    
    /**
     * Create an AVOID_OBSTACLE action
     * @param serialNumber Robot serial number
     * @param obstacleX Obstacle X coordinate
     * @param obstacleY Obstacle Y coordinate
     * @param obstacleZ Obstacle Z coordinate
     * @param avoidanceStrategy Avoidance strategy name
     * @param previousState Previous state
     * @return Action object
     */
    public static Action createAvoidObstacleAction(String serialNumber, double obstacleX, double obstacleY, double obstacleZ, String avoidanceStrategy, State previousState) {
        Map<String, Object> params = Map.of(
                "obstacleX", obstacleX,
                "obstacleY", obstacleY,
                "obstacleZ", obstacleZ,
                "avoidanceStrategy", avoidanceStrategy
        );
        
        return Action.builder()
                .type(ActionType.AVOID_OBSTACLE)
                .parameters(params)
                .timestamp(System.currentTimeMillis())
                .serialNumber(serialNumber)
                .previousState(previousState)
                .build();
    }
}