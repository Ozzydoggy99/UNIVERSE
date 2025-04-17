package com.robotcontrol.ai;

import com.robotcontrol.model.RobotPosition;
import com.robotcontrol.model.RobotSensorData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for handling human-robot interactions
 */
@Service
@Slf4j
public class HumanInteractionService {
    
    // Store human detection events by robot serial number
    private final Map<String, List<HumanInteractionEvent>> interactionHistory = new ConcurrentHashMap<>();
    
    // Store learned human interaction behaviors by robot serial number
    private final Map<String, Map<String, Object>> behaviorParameters = new ConcurrentHashMap<>();
    
    // Running count of interactions by area (grid cells)
    private final Map<String, Integer> interactionHotspots = new ConcurrentHashMap<>();
    
    // Threshold distance for human proximity warning
    private static final double PROXIMITY_WARNING_THRESHOLD = 1.0; // meters
    
    // Threshold for minimum time between human interaction events
    private static final long MIN_INTERACTION_INTERVAL_MS = 5000; // 5 seconds
    
    // Last detection timestamp by robot
    private final Map<String, LocalDateTime> lastDetectionTime = new ConcurrentHashMap<>();
    
    /**
     * Process sensor data and obstacle events to detect human interactions
     * @param serialNumber Robot serial number
     * @param sensorData Current sensor data
     * @param position Current robot position
     * @param obstacleEvent Recent obstacle event (if any)
     * @return Human interaction event if detected, null otherwise
     */
    public HumanInteractionEvent processData(
            String serialNumber,
            RobotSensorData sensorData,
            RobotPosition position,
            ObstacleEvent obstacleEvent) {
        
        if (position == null) {
            return null;
        }
        
        // Check if enough time has passed since last detection
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime lastDetection = lastDetectionTime.get(serialNumber);
        if (lastDetection != null) {
            long msSinceLastDetection = Duration.between(lastDetection, now).toMillis();
            if (msSinceLastDetection < MIN_INTERACTION_INTERVAL_MS) {
                return null; // Prevent too frequent detections
            }
        }
        
        // Human detection primarily based on obstacle event type
        if (obstacleEvent != null && obstacleEvent.getType() == ObstacleEvent.Type.HUMAN) {
            HumanInteractionEvent event = createHumanInteractionEvent(
                    serialNumber, 
                    position, 
                    obstacleEvent,
                    determineInteractionType(obstacleEvent, position),
                    determineAppropriateResponse(obstacleEvent, position)
            );
            
            // Store in history
            storeInteractionEvent(event);
            
            // Update hotspot map
            updateInteractionHotspot(event);
            
            // Update last detection time
            lastDetectionTime.put(serialNumber, now);
            
            return event;
        }
        
        // Additional detection using sensor data patterns that might indicate human presence
        // even without obstacle detection
        if (sensorData != null && detectPotentialHumanFromSensors(sensorData)) {
            HumanInteractionEvent event = createHumanInteractionEvent(
                    serialNumber,
                    position,
                    null,
                    HumanInteractionEvent.InteractionType.DETECTION,
                    HumanInteractionEvent.ResponseType.NO_RESPONSE
            );
            
            // Store in history
            storeInteractionEvent(event);
            
            // Update last detection time
            lastDetectionTime.put(serialNumber, now);
            
            return event;
        }
        
        return null;
    }
    
    /**
     * Store an interaction event in history
     */
    private void storeInteractionEvent(HumanInteractionEvent event) {
        String serialNumber = event.getRobotSerialNumber();
        interactionHistory.computeIfAbsent(serialNumber, k -> new ArrayList<>()).add(event);
        
        // Limit history size
        List<HumanInteractionEvent> history = interactionHistory.get(serialNumber);
        if (history.size() > 100) {
            history.subList(0, history.size() - 100).clear();
        }
    }
    
    /**
     * Create a human interaction event
     */
    private HumanInteractionEvent createHumanInteractionEvent(
            String serialNumber,
            RobotPosition position,
            ObstacleEvent obstacleEvent,
            HumanInteractionEvent.InteractionType interactionType,
            HumanInteractionEvent.ResponseType responseType) {
        
        // Calculate minimum distance if obstacle event is available
        double minimumDistance = 0;
        if (obstacleEvent != null) {
            minimumDistance = Math.sqrt(
                    Math.pow(obstacleEvent.getX() - position.getX(), 2) +
                    Math.pow(obstacleEvent.getY() - position.getY(), 2) +
                    Math.pow(obstacleEvent.getZ() - position.getZ(), 2)
            );
        }
        
        // Use robot's position if no obstacle data
        double eventX = (obstacleEvent != null) ? obstacleEvent.getX() : position.getX();
        double eventY = (obstacleEvent != null) ? obstacleEvent.getY() : position.getY();
        double eventZ = (obstacleEvent != null) ? obstacleEvent.getZ() : position.getZ();
        
        return HumanInteractionEvent.builder()
                .robotSerialNumber(serialNumber)
                .x(eventX)
                .y(eventY)
                .z(eventZ)
                .timestamp(LocalDateTime.now())
                .interactionType(interactionType)
                .responseType(responseType)
                .minimumDistance(minimumDistance)
                .durationSeconds(0) // Will be updated later if interaction continues
                .appropriateResponse(true) // Assume response was appropriate initially
                .interactionDetails(new HashMap<>())
                .humanResponseDetected(false)
                .build();
    }
    
    /**
     * Determine the type of human interaction based on obstacle event and position
     */
    private HumanInteractionEvent.InteractionType determineInteractionType(ObstacleEvent obstacleEvent, RobotPosition position) {
        if (obstacleEvent == null) {
            return HumanInteractionEvent.InteractionType.DETECTION;
        }
        
        // Calculate distance to obstacle
        double distance = Math.sqrt(
                Math.pow(obstacleEvent.getX() - position.getX(), 2) +
                Math.pow(obstacleEvent.getY() - position.getY(), 2) +
                Math.pow(obstacleEvent.getZ() - position.getZ(), 2)
        );
        
        // Determine interaction type based on distance and other factors
        if (distance < PROXIMITY_WARNING_THRESHOLD) {
            return HumanInteractionEvent.InteractionType.PROXIMITY_WARNING;
        }
        
        // Get history to check for following pattern
        List<HumanInteractionEvent> history = interactionHistory.getOrDefault(
                obstacleEvent.getRobotSerialNumber(), Collections.emptyList());
        
        if (detectFollowingPattern(history, obstacleEvent)) {
            return HumanInteractionEvent.InteractionType.FOLLOWING;
        }
        
        if (isBlockingPath(obstacleEvent, position)) {
            return HumanInteractionEvent.InteractionType.BLOCKING;
        }
        
        // Default to basic detection
        return HumanInteractionEvent.InteractionType.DETECTION;
    }
    
    /**
     * Determine appropriate response to human interaction
     */
    private HumanInteractionEvent.ResponseType determineAppropriateResponse(ObstacleEvent obstacleEvent, RobotPosition position) {
        if (obstacleEvent == null) {
            return HumanInteractionEvent.ResponseType.NO_RESPONSE;
        }
        
        // Calculate distance to obstacle
        double distance = Math.sqrt(
                Math.pow(obstacleEvent.getX() - position.getX(), 2) +
                Math.pow(obstacleEvent.getY() - position.getY(), 2) +
                Math.pow(obstacleEvent.getZ() - position.getZ(), 2)
        );
        
        // Different responses based on distance
        if (distance < 0.5) {
            return HumanInteractionEvent.ResponseType.STOP;
        } else if (distance < 1.0) {
            return HumanInteractionEvent.ResponseType.SLOW_DOWN;
        } else if (distance < 2.0) {
            return HumanInteractionEvent.ResponseType.SIGNAL;
        } else if (isInPath(obstacleEvent, position)) {
            return HumanInteractionEvent.ResponseType.REROUTE;
        }
        
        // Default if no specific response needed
        return HumanInteractionEvent.ResponseType.NO_RESPONSE;
    }
    
    /**
     * Detect if sensor data patterns might indicate human presence
     */
    private boolean detectPotentialHumanFromSensors(RobotSensorData sensorData) {
        // Simplified implementation - in reality would use more complex pattern recognition
        // This would analyze patterns of sensor readings over time
        
        if (sensorData.getProximity() == null || sensorData.getProximity().length == 0) {
            return false;
        }
        
        // Count how many proximity sensors detect something nearby
        int nearSensors = 0;
        for (double reading : sensorData.getProximity()) {
            if (reading > 0 && reading < 2.0) {
                nearSensors++;
            }
        }
        
        // If multiple sensors detect something, it might be a human
        return nearSensors >= 2;
    }
    
    /**
     * Detect if recent interaction history shows a following pattern
     */
    private boolean detectFollowingPattern(List<HumanInteractionEvent> history, ObstacleEvent currentObstacle) {
        if (history.size() < 3) {
            return false;
        }
        
        // Get recent events
        List<HumanInteractionEvent> recent = new ArrayList<>(history.subList(
                Math.max(0, history.size() - 5), history.size()));
        
        // Sort by timestamp
        recent.sort(Comparator.comparing(HumanInteractionEvent::getTimestamp));
        
        // Check if recent detections form a path following the robot
        double totalDistance = 0;
        HumanInteractionEvent previous = null;
        
        for (HumanInteractionEvent current : recent) {
            if (previous != null) {
                double distance = Math.sqrt(
                        Math.pow(current.getX() - previous.getX(), 2) +
                        Math.pow(current.getY() - previous.getY(), 2)
                );
                
                totalDistance += distance;
            }
            previous = current;
        }
        
        // If human has been consistently detected and moving, it might be following
        return totalDistance > 2.0 && totalDistance < 15.0;
    }
    
    /**
     * Determine if obstacle is blocking the robot's path
     */
    private boolean isBlockingPath(ObstacleEvent obstacle, RobotPosition position) {
        // Simple implementation - consider obstacle blocking if it's directly in front of robot
        double robotDirection = Math.toRadians(position.getOrientation());
        
        // Calculate vector from robot to obstacle
        double dx = obstacle.getX() - position.getX();
        double dy = obstacle.getY() - position.getY();
        
        // Calculate angle to obstacle
        double angleToObstacle = Math.atan2(dy, dx);
        
        // Calculate difference between robot's direction and angle to obstacle
        double angleDiff = Math.abs(normalizeAngle(angleToObstacle - robotDirection));
        
        // If obstacle is within 45 degrees of robot's facing direction and close, consider blocking
        return angleDiff < Math.PI/4 && calculateDistance(position, obstacle) < 2.0;
    }
    
    /**
     * Determine if obstacle is in the robot's path but not necessarily blocking
     */
    private boolean isInPath(ObstacleEvent obstacle, RobotPosition position) {
        // Similar to blocking check but with wider angle and distance
        double robotDirection = Math.toRadians(position.getOrientation());
        
        // Calculate vector from robot to obstacle
        double dx = obstacle.getX() - position.getX();
        double dy = obstacle.getY() - position.getY();
        
        // Calculate angle to obstacle
        double angleToObstacle = Math.atan2(dy, dx);
        
        // Calculate difference between robot's direction and angle to obstacle
        double angleDiff = Math.abs(normalizeAngle(angleToObstacle - robotDirection));
        
        // If obstacle is within 90 degrees of robot's facing direction and somewhat close
        return angleDiff < Math.PI/2 && calculateDistance(position, obstacle) < 4.0;
    }
    
    /**
     * Normalize angle to range [-PI, PI]
     */
    private double normalizeAngle(double angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }
    
    /**
     * Calculate distance between position and obstacle
     */
    private double calculateDistance(RobotPosition position, ObstacleEvent obstacle) {
        return Math.sqrt(
                Math.pow(obstacle.getX() - position.getX(), 2) +
                Math.pow(obstacle.getY() - position.getY(), 2) +
                Math.pow(obstacle.getZ() - position.getZ(), 2)
        );
    }
    
    /**
     * Update interaction hotspot map
     */
    private void updateInteractionHotspot(HumanInteractionEvent event) {
        // Generate grid cell key for hotspot map
        String cellKey = String.format("%.1f:%.1f:%.1f", 
                Math.floor(event.getX() * 10) / 10, 
                Math.floor(event.getY() * 10) / 10,
                Math.floor(event.getZ() * 10) / 10);
        
        // Increment counter for this cell
        interactionHotspots.compute(cellKey, (k, v) -> v == null ? 1 : v + 1);
    }
    
    /**
     * Get most frequent human interaction areas
     * @param limit Maximum number of hotspots to return
     * @return List of hotspot locations with interaction counts
     */
    public List<Map<String, Object>> getInteractionHotspots(int limit) {
        List<Map<String, Object>> result = new ArrayList<>();
        
        // Convert map to list of entries
        List<Map.Entry<String, Integer>> entries = new ArrayList<>(interactionHotspots.entrySet());
        
        // Sort by count (descending)
        entries.sort((e1, e2) -> e2.getValue().compareTo(e1.getValue()));
        
        // Convert top entries to result format
        for (int i = 0; i < Math.min(limit, entries.size()); i++) {
            Map.Entry<String, Integer> entry = entries.get(i);
            String[] coords = entry.getKey().split(":");
            
            Map<String, Object> hotspot = new HashMap<>();
            hotspot.put("x", Double.parseDouble(coords[0]));
            hotspot.put("y", Double.parseDouble(coords[1]));
            hotspot.put("z", Double.parseDouble(coords[2]));
            hotspot.put("count", entry.getValue());
            
            result.add(hotspot);
        }
        
        return result;
    }
    
    /**
     * Generate recommended behavior parameters for human interactions
     * @param serialNumber Robot serial number
     * @return Map of behavior parameters
     */
    public Map<String, Object> generateBehaviorParameters(String serialNumber) {
        // Get interaction history for this robot
        List<HumanInteractionEvent> history = interactionHistory.getOrDefault(serialNumber, Collections.emptyList());
        
        // Default parameters
        Map<String, Object> params = new HashMap<>();
        params.put("proximitySlowdownDistance", 2.0);
        params.put("proximityStopDistance", 0.8);
        params.put("approachSpeed", 0.4);
        params.put("signalDistance", 3.0);
        params.put("pathRerouteDistance", 2.5);
        params.put("waitTimeBeforeReroute", 5.0); // seconds
        
        // If we have enough history, adjust parameters based on learned patterns
        if (history.size() >= 10) {
            // Calculate average minimum distance in proximity warnings
            double avgMinDistance = history.stream()
                    .filter(e -> e.getInteractionType() == HumanInteractionEvent.InteractionType.PROXIMITY_WARNING)
                    .mapToDouble(HumanInteractionEvent::getMinimumDistance)
                    .average()
                    .orElse(1.0);
            
            // Adjust parameters based on historical interactions
            params.put("proximitySlowdownDistance", Math.max(1.5, avgMinDistance * 1.5));
            params.put("proximityStopDistance", Math.max(0.5, avgMinDistance * 0.7));
            
            // Count response types to see which were most effective
            long stopCount = countResponseType(history, HumanInteractionEvent.ResponseType.STOP);
            long slowCount = countResponseType(history, HumanInteractionEvent.ResponseType.SLOW_DOWN);
            long rerouteCount = countResponseType(history, HumanInteractionEvent.ResponseType.REROUTE);
            
            // Prefer more frequently successful responses
            if (stopCount > slowCount && stopCount > rerouteCount) {
                params.put("preferredResponse", "STOP");
            } else if (slowCount > stopCount && slowCount > rerouteCount) {
                params.put("preferredResponse", "SLOW_DOWN");
            } else if (rerouteCount > 0) {
                params.put("preferredResponse", "REROUTE");
            } else {
                params.put("preferredResponse", "SIGNAL");
            }
        }
        
        // Store the generated parameters
        behaviorParameters.put(serialNumber, new HashMap<>(params));
        
        return params;
    }
    
    /**
     * Count occurrences of a specific response type in history
     */
    private long countResponseType(List<HumanInteractionEvent> history, HumanInteractionEvent.ResponseType type) {
        return history.stream()
                .filter(e -> e.getResponseType() == type && e.isAppropriateResponse())
                .count();
    }
    
    /**
     * Get recent interaction history for a robot
     * @param serialNumber Robot serial number
     * @param limit Maximum number of entries to return
     * @return Recent interaction events
     */
    public List<HumanInteractionEvent> getRecentInteractions(String serialNumber, int limit) {
        List<HumanInteractionEvent> history = interactionHistory.getOrDefault(serialNumber, Collections.emptyList());
        
        // Sort by timestamp (newest first)
        List<HumanInteractionEvent> sorted = new ArrayList<>(history);
        sorted.sort((e1, e2) -> e2.getTimestamp().compareTo(e1.getTimestamp()));
        
        // Return up to limit entries
        return sorted.subList(0, Math.min(limit, sorted.size()));
    }
}