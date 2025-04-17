package com.robotcontrol.ai;

import com.robotcontrol.model.RobotPosition;
import com.robotcontrol.model.RobotSensorData;
import com.robotcontrol.model.RobotStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Main service for robot AI functionality, integrating all AI components
 */
@Service
@Slf4j
public class RobotAIService {
    
    @Autowired
    private MovementOptimizer movementOptimizer;
    
    @Autowired
    private ObstacleDetectionService obstacleDetectionService;
    
    @Autowired
    private HumanInteractionService humanInteractionService;
    
    @Autowired
    private SystemHealthMonitor systemHealthMonitor;
    
    // Store learning data by robot serial number
    private final Map<String, RobotLearningData> robotLearningData = new ConcurrentHashMap<>();
    
    // Cache of recent sensor data by robot serial number
    private final Map<String, List<RobotSensorData>> recentSensorData = new ConcurrentHashMap<>();
    
    // Cache of recent position data by robot serial number
    private final Map<String, List<RobotPosition>> recentPositionData = new ConcurrentHashMap<>();
    
    // Cache of recent status data by robot serial number
    private final Map<String, List<RobotStatus>> recentStatusData = new ConcurrentHashMap<>();
    
    // Maximum history size to keep
    private static final int MAX_HISTORY_SIZE = 100;
    
    /**
     * Initialize the AI service
     */
    @PostConstruct
    public void initialize() {
        log.info("Initializing Robot AI Service");
        
        // Initialize components
        movementOptimizer.initialize();
        systemHealthMonitor.initialize();
    }
    
    /**
     * Process new sensor data from a robot
     * @param serialNumber Robot serial number
     * @param sensorData New sensor data
     * @param position Current robot position
     * @param status Current robot status
     * @return Map of AI insights and recommendations
     */
    public Map<String, Object> processSensorData(
            String serialNumber, 
            RobotSensorData sensorData, 
            RobotPosition position,
            RobotStatus status) {
        
        Map<String, Object> result = new HashMap<>();
        
        // Get or create learning data for this robot
        RobotLearningData learningData = getLearningData(serialNumber);
        
        // Store data in caches
        storeSensorData(serialNumber, sensorData);
        storePositionData(serialNumber, position);
        storeStatusData(serialNumber, status);
        
        // Process through obstacle detection
        ObstacleEvent obstacleEvent = obstacleDetectionService.processSensorData(
                serialNumber, sensorData, position);
        
        if (obstacleEvent != null) {
            result.put("obstacleDetected", true);
            result.put("obstacleType", obstacleEvent.getType().toString());
            result.put("obstacleLocation", Map.of(
                    "x", obstacleEvent.getX(),
                    "y", obstacleEvent.getY(),
                    "z", obstacleEvent.getZ()));
            
            // If there's an existing avoidance strategy for this obstacle
            ObstacleAvoidanceStrategy strategy = obstacleDetectionService.findBestAvoidanceStrategy(
                    serialNumber, obstacleEvent.getX(), obstacleEvent.getY(), obstacleEvent.getZ());
            
            if (strategy != null) {
                result.put("avoidanceStrategy", strategy.getWaypoints());
                result.put("navigationParameters", strategy.getNavigationParameters());
            } else {
                // Create a new strategy if needed
                // In a real system, this would integrate with path planning
                List<Map<String, Double>> waypoints = generateAvoidanceWaypoints(
                        position, obstacleEvent);
                
                strategy = obstacleDetectionService.createAvoidanceStrategy(obstacleEvent, waypoints);
                result.put("avoidanceStrategy", strategy.getWaypoints());
                result.put("navigationParameters", strategy.getNavigationParameters());
            }
            
            // Store obstacle event in learning data
            learningData.addObstacleEvent(obstacleEvent);
        } else {
            result.put("obstacleDetected", false);
        }
        
        // Process through human interaction detection
        HumanInteractionEvent interactionEvent = humanInteractionService.processData(
                serialNumber, sensorData, position, obstacleEvent);
        
        if (interactionEvent != null) {
            result.put("humanDetected", true);
            result.put("interactionType", interactionEvent.getInteractionType().toString());
            result.put("recommendedResponse", interactionEvent.getResponseType().toString());
            
            // Store human interaction in learning data
            learningData.addHumanInteraction(interactionEvent);
            
            // Generate behavior parameters if needed
            Map<String, Object> behaviorParams = humanInteractionService.generateBehaviorParameters(serialNumber);
            result.put("humanInteractionParameters", behaviorParams);
            
            // Store in learning data
            learningData.setHumanAvoidanceParameters(behaviorParams);
        } else {
            result.put("humanDetected", false);
        }
        
        // Process position data for movement optimization
        List<RobotPosition> positionHistory = getRecentPositionData(serialNumber);
        if (positionHistory.size() >= 10) {
            MovementAnalysis analysis = movementOptimizer.analyzeMovement(positionHistory);
            result.put("movementEfficiency", analysis.getEfficiencyScore());
            
            if (analysis.getEfficiencyScore() < 0.7) {
                result.put("movementRecommendations", analysis.getRecommendations());
            }
            
            // Generate optimized parameters if efficiency is low
            if (analysis.getEfficiencyScore() < 0.8) {
                Map<String, Object> optimizedParams = movementOptimizer.generateOptimizedParameters(analysis);
                result.put("optimizedMovementParameters", optimizedParams);
                
                // Store in learning data
                learningData.setOptimizedParameters(optimizedParams);
                learningData.setMovementEfficiencyScore(analysis.getEfficiencyScore());
            }
            
            // Add position data to learning storage
            learningData.addPositionData(positionHistory);
        }
        
        // Include system health status
        SystemHealthMetrics healthMetrics = systemHealthMonitor.getCurrentMetrics();
        if (healthMetrics != null) {
            Map<String, Object> healthStatus = new HashMap<>();
            healthStatus.put("systemLoad", healthMetrics.getSystemLoad());
            healthStatus.put("memoryUsage", healthMetrics.getMemoryUsagePercent());
            healthStatus.put("activeIssues", systemHealthMonitor.getActiveIssues().size());
            
            result.put("systemHealth", healthStatus);
        }
        
        return result;
    }
    
    /**
     * Generate waypoints to avoid an obstacle
     * This is a simplified implementation - in a real system this would 
     * integrate with more sophisticated path planning algorithms
     */
    private List<Map<String, Double>> generateAvoidanceWaypoints(
            RobotPosition position, ObstacleEvent obstacle) {
        
        List<Map<String, Double>> waypoints = new ArrayList<>();
        
        // Calculate vector from robot to obstacle
        double dx = obstacle.getX() - position.getX();
        double dy = obstacle.getY() - position.getY();
        
        // Calculate distance
        double distance = Math.sqrt(dx * dx + dy * dy);
        
        // Normalize direction vector
        if (distance > 0) {
            dx /= distance;
            dy /= distance;
        }
        
        // Calculate perpendicular vector for avoidance
        double perpX = -dy;
        double perpY = dx;
        
        // Determine which side to avoid to (right or left)
        // For simplicity, always go right in this example
        double avoidX = perpX;
        double avoidY = perpY;
        
        // Create waypoints: 
        // 1. Move slightly back
        // 2. Move perpendicular to avoid obstacle
        // 3. Move forward past obstacle
        // 4. Move back toward original path
        
        // Current position
        waypoints.add(Map.of(
                "x", position.getX(),
                "y", position.getY(),
                "z", position.getZ()));
        
        // Step 1: Move slightly back
        waypoints.add(Map.of(
                "x", position.getX() - dx * 0.5,
                "y", position.getY() - dy * 0.5,
                "z", position.getZ()));
        
        // Step 2: Move perpendicular
        waypoints.add(Map.of(
                "x", position.getX() - dx * 0.3 + avoidX * 1.2,
                "y", position.getY() - dy * 0.3 + avoidY * 1.2,
                "z", position.getZ()));
        
        // Step 3: Move forward past obstacle
        waypoints.add(Map.of(
                "x", position.getX() + dx * 1.5 + avoidX * 1.0,
                "y", position.getY() + dy * 1.5 + avoidY * 1.0,
                "z", position.getZ()));
        
        // Step 4: Back toward original path
        waypoints.add(Map.of(
                "x", position.getX() + dx * 2.0,
                "y", position.getY() + dy * 2.0,
                "z", position.getZ()));
        
        return waypoints;
    }
    
    /**
     * Get learning data for a specific robot
     * @param serialNumber Robot serial number
     * @return Robot learning data
     */
    public RobotLearningData getLearningData(String serialNumber) {
        return robotLearningData.computeIfAbsent(serialNumber, RobotLearningData::new);
    }
    
    /**
     * Store sensor data in cache
     */
    private void storeSensorData(String serialNumber, RobotSensorData sensorData) {
        if (sensorData == null) return;
        
        List<RobotSensorData> history = recentSensorData.computeIfAbsent(
                serialNumber, k -> new ArrayList<>());
        
        history.add(sensorData);
        
        // Limit history size
        if (history.size() > MAX_HISTORY_SIZE) {
            history.remove(0);
        }
    }
    
    /**
     * Store position data in cache
     */
    private void storePositionData(String serialNumber, RobotPosition position) {
        if (position == null) return;
        
        List<RobotPosition> history = recentPositionData.computeIfAbsent(
                serialNumber, k -> new ArrayList<>());
        
        history.add(position);
        
        // Limit history size
        if (history.size() > MAX_HISTORY_SIZE) {
            history.remove(0);
        }
    }
    
    /**
     * Store status data in cache
     */
    private void storeStatusData(String serialNumber, RobotStatus status) {
        if (status == null) return;
        
        List<RobotStatus> history = recentStatusData.computeIfAbsent(
                serialNumber, k -> new ArrayList<>());
        
        history.add(status);
        
        // Limit history size
        if (history.size() > MAX_HISTORY_SIZE) {
            history.remove(0);
        }
    }
    
    /**
     * Get recent sensor data for a robot
     */
    public List<RobotSensorData> getRecentSensorData(String serialNumber) {
        return new ArrayList<>(recentSensorData.getOrDefault(
                serialNumber, Collections.emptyList()));
    }
    
    /**
     * Get recent position data for a robot
     */
    public List<RobotPosition> getRecentPositionData(String serialNumber) {
        return new ArrayList<>(recentPositionData.getOrDefault(
                serialNumber, Collections.emptyList()));
    }
    
    /**
     * Get recent status data for a robot
     */
    public List<RobotStatus> getRecentStatusData(String serialNumber) {
        return new ArrayList<>(recentStatusData.getOrDefault(
                serialNumber, Collections.emptyList()));
    }
    
    /**
     * Get optimized movement parameters for a robot
     */
    public Map<String, Object> getOptimizedParameters(String serialNumber) {
        RobotLearningData data = getLearningData(serialNumber);
        return data.getOptimizedParameters();
    }
    
    /**
     * Get human avoidance parameters for a robot
     */
    public Map<String, Object> getHumanAvoidanceParameters(String serialNumber) {
        RobotLearningData data = getLearningData(serialNumber);
        return data.getHumanAvoidanceParameters();
    }
    
    /**
     * Get obstacles detected in an area
     */
    public List<ObstacleEvent> getObstaclesInArea(double x, double y, double z, double radius) {
        return obstacleDetectionService.getObstaclesInArea(x, y, z, radius);
    }
    
    /**
     * Get system health metrics
     */
    public SystemHealthMetrics getSystemHealthMetrics() {
        return systemHealthMonitor.getCurrentMetrics();
    }
    
    /**
     * Get active performance issues
     */
    public List<PerformanceIssue> getActivePerformanceIssues() {
        return systemHealthMonitor.getActiveIssues();
    }
    
    /**
     * Run periodic learning analysis to update AI models
     * This would be more sophisticated in a real implementation, possibly
     * using machine learning libraries for model training
     */
    @Scheduled(fixedRate = 3600000) // Every hour
    public void runPeriodicLearning() {
        log.info("Running periodic AI learning analysis");
        
        for (String serialNumber : robotLearningData.keySet()) {
            try {
                RobotLearningData data = robotLearningData.get(serialNumber);
                
                // Analyze past obstacle events to improve avoidance strategies
                analyzeObstaclePatterns(serialNumber, data);
                
                // Analyze human interactions to improve behavior
                analyzeHumanInteractions(serialNumber, data);
                
                // Analyze movement efficiency
                analyzeMovementEfficiency(serialNumber, data);
                
                log.info("Completed learning analysis for robot: {}", serialNumber);
            } catch (Exception e) {
                log.error("Error in learning analysis for robot: {}", serialNumber, e);
            }
        }
    }
    
    /**
     * Analyze obstacle patterns to improve avoidance strategies
     */
    private void analyzeObstaclePatterns(String serialNumber, RobotLearningData data) {
        List<ObstacleEvent> events = data.getObstacleEvents();
        if (events.isEmpty()) {
            return;
        }
        
        // Group obstacles by location
        Map<String, List<ObstacleEvent>> obstaclesByLocation = new HashMap<>();
        
        for (ObstacleEvent event : events) {
            // Create location key with reduced precision to group nearby obstacles
            String locationKey = String.format("%.1f:%.1f", 
                    Math.floor(event.getX() * 10) / 10, 
                    Math.floor(event.getY() * 10) / 10);
            
            obstaclesByLocation.computeIfAbsent(locationKey, k -> new ArrayList<>()).add(event);
        }
        
        // Analyze each location group to identify recurring obstacles
        for (Map.Entry<String, List<ObstacleEvent>> entry : obstaclesByLocation.entrySet()) {
            List<ObstacleEvent> locationEvents = entry.getValue();
            
            if (locationEvents.size() >= 3) {
                // This appears to be a recurring obstacle
                // Could update obstacle type, implement specialized avoidance strategies, etc.
                log.info("Recurring obstacle identified at location {} for robot {}, {} occurrences", 
                        entry.getKey(), serialNumber, locationEvents.size());
            }
        }
    }
    
    /**
     * Analyze human interactions to improve behavior
     */
    private void analyzeHumanInteractions(String serialNumber, RobotLearningData data) {
        List<HumanInteractionEvent> events = data.getHumanInteractions();
        if (events.isEmpty()) {
            return;
        }
        
        // Count response types and their success rates
        Map<HumanInteractionEvent.ResponseType, Integer> responseCounts = new HashMap<>();
        Map<HumanInteractionEvent.ResponseType, Integer> successCounts = new HashMap<>();
        
        for (HumanInteractionEvent event : events) {
            HumanInteractionEvent.ResponseType response = event.getResponseType();
            
            responseCounts.put(response, responseCounts.getOrDefault(response, 0) + 1);
            
            if (event.isAppropriateResponse()) {
                successCounts.put(response, successCounts.getOrDefault(response, 0) + 1);
            }
        }
        
        // Find most successful response type
        HumanInteractionEvent.ResponseType bestResponse = null;
        double bestSuccessRate = 0;
        
        for (Map.Entry<HumanInteractionEvent.ResponseType, Integer> entry : responseCounts.entrySet()) {
            HumanInteractionEvent.ResponseType response = entry.getKey();
            int total = entry.getValue();
            int successes = successCounts.getOrDefault(response, 0);
            
            double successRate = (double) successes / total;
            
            if (successRate > bestSuccessRate && total >= 3) {
                bestSuccessRate = successRate;
                bestResponse = response;
            }
        }
        
        // Update human avoidance parameters if we found a good response type
        if (bestResponse != null) {
            Map<String, Object> currentParams = data.getHumanAvoidanceParameters();
            if (currentParams.isEmpty()) {
                currentParams = new HashMap<>();
            }
            
            currentParams.put("preferredResponseType", bestResponse.toString());
            currentParams.put("successRate", bestSuccessRate);
            currentParams.put("lastUpdated", LocalDateTime.now().toString());
            
            data.setHumanAvoidanceParameters(currentParams);
            
            log.info("Updated human interaction parameters for robot {}, preferred response: {} (success rate: {})", 
                    serialNumber, bestResponse, String.format("%.2f", bestSuccessRate));
        }
    }
    
    /**
     * Analyze movement efficiency to improve navigation
     */
    private void analyzeMovementEfficiency(String serialNumber, RobotLearningData data) {
        List<RobotPosition> positions = data.getPositionHistory();
        if (positions.size() < 20) {
            return;
        }
        
        // Analyze movement patterns
        MovementAnalysis analysis = movementOptimizer.analyzeMovement(positions);
        
        // Update efficiency score
        data.setMovementEfficiencyScore(analysis.getEfficiencyScore());
        
        // Generate and store optimized parameters
        if (analysis.getEfficiencyScore() < 0.9) {
            Map<String, Object> optimizedParams = movementOptimizer.generateOptimizedParameters(analysis);
            data.setOptimizedParameters(optimizedParams);
            
            log.info("Updated movement parameters for robot {}, efficiency: {}", 
                    serialNumber, String.format("%.2f", analysis.getEfficiencyScore()));
        }
    }
}