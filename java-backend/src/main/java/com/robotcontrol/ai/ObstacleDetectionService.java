package com.robotcontrol.ai;

import com.robotcontrol.model.RobotPosition;
import com.robotcontrol.model.RobotSensorData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for detecting and learning about obstacles in the robot's environment
 */
@Service
@Slf4j
public class ObstacleDetectionService {
    
    // Store detection history by robot serial number
    private final Map<String, List<ObstacleEvent>> detectionHistory = new ConcurrentHashMap<>();
    
    // Store avoidance strategies by robot serial number
    private final Map<String, List<ObstacleAvoidanceStrategy>> avoidanceStrategies = new ConcurrentHashMap<>();
    
    // Obstacle map with grid cells (x,y,z -> obstacle data)
    private final Map<String, ObstacleEvent> obstacleMap = new ConcurrentHashMap<>();
    
    // Threshold for proximity sensors to consider obstacle detection
    private static final double PROXIMITY_THRESHOLD = 0.5; // meters
    
    /**
     * Process sensor data to detect obstacles
     * @param serialNumber Robot serial number
     * @param sensorData Current sensor data
     * @param position Current robot position
     * @return Detected obstacle event, or null if no obstacle detected
     */
    public ObstacleEvent processSensorData(String serialNumber, RobotSensorData sensorData, RobotPosition position) {
        if (sensorData == null || position == null) {
            return null;
        }
        
        // Process proximity sensor readings to detect obstacles
        double[] proximityReadings = sensorData.getProximity();
        if (proximityReadings == null || proximityReadings.length == 0) {
            return null;
        }
        
        // Find minimum proximity reading (closest object)
        double minDistance = Double.MAX_VALUE;
        int closestSensorIndex = -1;
        
        for (int i = 0; i < proximityReadings.length; i++) {
            if (proximityReadings[i] < minDistance && proximityReadings[i] > 0) {
                minDistance = proximityReadings[i];
                closestSensorIndex = i;
            }
        }
        
        // Check if any reading is below threshold
        if (minDistance < PROXIMITY_THRESHOLD && closestSensorIndex >= 0) {
            // Calculate approximate obstacle position based on robot position and sensor orientation
            Map<String, Double> obstaclePosition = calculateObstaclePosition(
                    position, closestSensorIndex, minDistance);
            
            // Create obstacle event
            ObstacleEvent event = createObstacleEvent(
                    serialNumber,
                    obstaclePosition.get("x"),
                    obstaclePosition.get("y"),
                    obstaclePosition.get("z"),
                    determineObstacleType(serialNumber, obstaclePosition, minDistance)
            );
            
            // Store in history
            detectionHistory.computeIfAbsent(serialNumber, k -> new ArrayList<>()).add(event);
            
            // Limit history size
            List<ObstacleEvent> history = detectionHistory.get(serialNumber);
            if (history.size() > 100) {
                history.subList(0, history.size() - 100).clear();
            }
            
            // Update obstacle map
            updateObstacleMap(event);
            
            return event;
        }
        
        return null;
    }
    
    /**
     * Calculate the approximate position of an obstacle based on robot position and sensor data
     * @param position Robot position
     * @param sensorIndex Index of the proximity sensor detecting the obstacle
     * @param distance Distance to the obstacle
     * @return Map containing x, y, z coordinates of the obstacle
     */
    private Map<String, Double> calculateObstaclePosition(RobotPosition position, int sensorIndex, double distance) {
        // Calculate sensor orientation based on sensor index
        // This is a simplified model - in reality would depend on precise sensor arrangement
        double sensorAngle = (sensorIndex * (360.0 / 8)) + position.getOrientation(); // Assume 8 sensors evenly spaced
        double radians = Math.toRadians(sensorAngle);
        
        // Calculate obstacle position
        double obstacleX = position.getX() + Math.cos(radians) * distance;
        double obstacleY = position.getY() + Math.sin(radians) * distance;
        double obstacleZ = position.getZ(); // Assume obstacle is at same height as robot
        
        Map<String, Double> result = new HashMap<>();
        result.put("x", obstacleX);
        result.put("y", obstacleY);
        result.put("z", obstacleZ);
        
        return result;
    }
    
    /**
     * Create a new obstacle event
     */
    private ObstacleEvent createObstacleEvent(String serialNumber, double x, double y, double z, ObstacleEvent.Type type) {
        return ObstacleEvent.builder()
                .robotSerialNumber(serialNumber)
                .x(x)
                .y(y)
                .z(z)
                .type(type)
                .timestamp(LocalDateTime.now())
                .description("Obstacle detected by proximity sensors")
                .occurrenceCount(countPreviousOccurrences(serialNumber, x, y, z, 0.5) + 1)
                .estimatedWidth(0.5) // Default estimation
                .estimatedHeight(1.0) // Default estimation
                .successfullyAvoided(false) // To be updated later
                .build();
    }
    
    /**
     * Determine the type of obstacle based on detection patterns
     */
    private ObstacleEvent.Type determineObstacleType(String serialNumber, Map<String, Double> position, double distance) {
        // Get detection history for this robot
        List<ObstacleEvent> history = detectionHistory.getOrDefault(serialNumber, Collections.emptyList());
        
        // Check if this obstacle has been seen before in approximately the same location
        int occurrences = countPreviousOccurrences(
                serialNumber, position.get("x"), position.get("y"), position.get("z"), 0.5);
        
        if (occurrences > 5) {
            return ObstacleEvent.Type.RECURRING;
        }
        
        // Check for movement patterns in recent history that might indicate a human
        boolean potentialHuman = checkForHumanMovementPattern(history);
        if (potentialHuman) {
            return ObstacleEvent.Type.HUMAN;
        }
        
        // Default to TEMPORARY for now - more advanced classification would be implemented here
        return ObstacleEvent.Type.TEMPORARY;
    }
    
    /**
     * Count how many times an obstacle has been detected at approximately the same location
     */
    private int countPreviousOccurrences(String serialNumber, double x, double y, double z, double radius) {
        List<ObstacleEvent> history = detectionHistory.getOrDefault(serialNumber, Collections.emptyList());
        int count = 0;
        
        for (ObstacleEvent event : history) {
            double distance = Math.sqrt(
                    Math.pow(event.getX() - x, 2) +
                    Math.pow(event.getY() - y, 2) +
                    Math.pow(event.getZ() - z, 2)
            );
            
            if (distance <= radius) {
                count++;
            }
        }
        
        return count;
    }
    
    /**
     * Check if recent obstacle detections match movement patterns typical of humans
     */
    private boolean checkForHumanMovementPattern(List<ObstacleEvent> history) {
        if (history.size() < 3) {
            return false;
        }
        
        // Get most recent detections
        List<ObstacleEvent> recent = new ArrayList<>(history.subList(Math.max(0, history.size() - 5), history.size()));
        
        // Sort by timestamp
        recent.sort(Comparator.comparing(ObstacleEvent::getTimestamp));
        
        // Check for continuous movement
        double totalMovement = 0;
        ObstacleEvent previous = null;
        
        for (ObstacleEvent current : recent) {
            if (previous != null) {
                double distance = Math.sqrt(
                        Math.pow(current.getX() - previous.getX(), 2) +
                        Math.pow(current.getY() - previous.getY(), 2)
                );
                
                totalMovement += distance;
            }
            previous = current;
        }
        
        // If obstacle has moved a significant distance in a short time, it might be a human
        return totalMovement > 1.0;
    }
    
    /**
     * Update the obstacle map with new detection
     */
    private void updateObstacleMap(ObstacleEvent event) {
        // Generate grid cell key: rounded coordinates to create grid cells
        String cellKey = String.format("%.1f:%.1f:%.1f", 
                Math.floor(event.getX() * 10) / 10, 
                Math.floor(event.getY() * 10) / 10,
                Math.floor(event.getZ() * 10) / 10);
        
        // Update or add to map
        obstacleMap.put(cellKey, event);
    }
    
    /**
     * Get all known obstacles in a specific area
     * @param centerX Center X coordinate
     * @param centerY Center Y coordinate
     * @param centerZ Center Z coordinate
     * @param radius Search radius
     * @return List of obstacle events in the area
     */
    public List<ObstacleEvent> getObstaclesInArea(double centerX, double centerY, double centerZ, double radius) {
        List<ObstacleEvent> result = new ArrayList<>();
        
        for (ObstacleEvent event : obstacleMap.values()) {
            double distance = Math.sqrt(
                    Math.pow(event.getX() - centerX, 2) +
                    Math.pow(event.getY() - centerY, 2) +
                    Math.pow(event.getZ() - centerZ, 2)
            );
            
            if (distance <= radius) {
                result.add(event);
            }
        }
        
        return result;
    }
    
    /**
     * Create an avoidance strategy for an obstacle
     * @param event Obstacle event
     * @param waypoints Waypoints to navigate around the obstacle
     * @return Created avoidance strategy
     */
    public ObstacleAvoidanceStrategy createAvoidanceStrategy(ObstacleEvent event, List<Map<String, Double>> waypoints) {
        ObstacleAvoidanceStrategy strategy = ObstacleAvoidanceStrategy.builder()
                .robotSerialNumber(event.getRobotSerialNumber())
                .obstacleX(event.getX())
                .obstacleY(event.getY())
                .obstacleZ(event.getZ())
                .applicableRadius(1.0) // Default radius
                .createdAt(LocalDateTime.now())
                .lastUsed(LocalDateTime.now())
                .successCount(0)
                .failureCount(0)
                .successRate(0.0)
                .waypoints(waypoints)
                .navigationParameters(createDefaultNavigationParameters())
                .sourceEvent(event)
                .build();
        
        // Store strategy
        avoidanceStrategies.computeIfAbsent(event.getRobotSerialNumber(), k -> new ArrayList<>()).add(strategy);
        
        return strategy;
    }
    
    /**
     * Create default navigation parameters for obstacle avoidance
     */
    private Map<String, Object> createDefaultNavigationParameters() {
        Map<String, Object> params = new HashMap<>();
        params.put("avoidanceDistance", 0.5);
        params.put("approachSpeed", 0.5);
        params.put("pathSmoothingFactor", 0.7);
        return params;
    }
    
    /**
     * Find the best avoidance strategy for an obstacle
     * @param serialNumber Robot serial number
     * @param x X coordinate
     * @param y Y coordinate
     * @param z Z coordinate
     * @return Best available strategy or null if none found
     */
    public ObstacleAvoidanceStrategy findBestAvoidanceStrategy(String serialNumber, double x, double y, double z) {
        List<ObstacleAvoidanceStrategy> strategies = avoidanceStrategies.getOrDefault(serialNumber, Collections.emptyList());
        
        ObstacleAvoidanceStrategy bestStrategy = null;
        double bestScore = -1;
        
        for (ObstacleAvoidanceStrategy strategy : strategies) {
            double distance = Math.sqrt(
                    Math.pow(strategy.getObstacleX() - x, 2) +
                    Math.pow(strategy.getObstacleY() - y, 2) +
                    Math.pow(strategy.getObstacleZ() - z, 2)
            );
            
            if (distance <= strategy.getApplicableRadius()) {
                // Calculate a score based on success rate and proximity
                double score = strategy.getSuccessRate() * (1 - distance / strategy.getApplicableRadius());
                
                if (score > bestScore) {
                    bestScore = score;
                    bestStrategy = strategy;
                }
            }
        }
        
        return bestStrategy;
    }
    
    /**
     * Update the success status of an avoidance strategy
     * @param strategy Strategy to update
     * @param success Whether the strategy was successful
     */
    public void updateStrategySuccess(ObstacleAvoidanceStrategy strategy, boolean success) {
        strategy.updateStatistics(success);
    }
}