package com.robotcontrol.controller;

import com.robotcontrol.ai.*;
import com.robotcontrol.model.RobotPosition;
import com.robotcontrol.model.RobotSensorData;
import com.robotcontrol.model.RobotStatus;
import com.robotcontrol.service.AxBotService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST API controller for robot AI functionality
 */
@RestController
@RequestMapping("/api/ai")
public class RobotAIController {
    
    @Autowired
    private RobotAIService aiService;
    
    @Autowired
    private SystemHealthMonitor healthMonitor;
    
    @Autowired
    private AxBotService axBotService;
    
    /**
     * Process sensor data and get AI recommendations
     * @param serialNumber Robot serial number
     * @param sensorData Sensor data
     * @return AI insights and recommendations
     */
    @PostMapping("/process/{serialNumber}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<Map<String, Object>> processData(
            @PathVariable String serialNumber,
            @RequestBody RobotSensorData sensorData) {
        
        // Record API request for monitoring
        String requestId = java.util.UUID.randomUUID().toString();
        healthMonitor.recordApiRequestStart(requestId);
        
        try {
            // Get current position and status from AxBot service
            RobotPosition position = axBotService.getRobotPosition(serialNumber);
            RobotStatus status = axBotService.getRobotStatus(serialNumber);
            
            // Process through AI service
            Map<String, Object> result = aiService.processSensorData(
                    serialNumber, sensorData, position, status);
            
            healthMonitor.recordApiRequestEnd(requestId, true);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            healthMonitor.recordApiRequestEnd(requestId, false);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Error processing sensor data: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }
    
    /**
     * Get optimized movement parameters for a robot
     * @param serialNumber Robot serial number
     * @return Movement parameters
     */
    @GetMapping("/movement/{serialNumber}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<Map<String, Object>> getMovementParameters(@PathVariable String serialNumber) {
        Map<String, Object> params = aiService.getOptimizedParameters(serialNumber);
        
        if (params == null || params.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        
        return ResponseEntity.ok(params);
    }
    
    /**
     * Get human interaction parameters for a robot
     * @param serialNumber Robot serial number
     * @return Human interaction parameters
     */
    @GetMapping("/human-interaction/{serialNumber}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<Map<String, Object>> getHumanInteractionParameters(@PathVariable String serialNumber) {
        Map<String, Object> params = aiService.getHumanAvoidanceParameters(serialNumber);
        
        if (params == null || params.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        
        return ResponseEntity.ok(params);
    }
    
    /**
     * Get obstacles in an area
     * @param x Center X coordinate
     * @param y Center Y coordinate
     * @param z Center Z coordinate
     * @param radius Search radius
     * @return List of obstacles
     */
    @GetMapping("/obstacles")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<List<ObstacleEvent>> getObstaclesInArea(
            @RequestParam double x,
            @RequestParam double y,
            @RequestParam double z,
            @RequestParam double radius) {
        
        List<ObstacleEvent> obstacles = aiService.getObstaclesInArea(x, y, z, radius);
        return ResponseEntity.ok(obstacles);
    }
    
    /**
     * Get learning data for a robot
     * @param serialNumber Robot serial number
     * @return Learning data summary
     */
    @GetMapping("/learning/{serialNumber}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getLearningData(@PathVariable String serialNumber) {
        RobotLearningData learningData = aiService.getLearningData(serialNumber);
        
        Map<String, Object> summary = new HashMap<>();
        summary.put("serialNumber", learningData.getSerialNumber());
        summary.put("totalPositionsLearned", learningData.getTotalPositionsLearned());
        summary.put("obstacleEventsCount", learningData.getObstacleEvents().size());
        summary.put("humanInteractionsCount", learningData.getHumanInteractions().size());
        summary.put("avoidanceStrategiesCount", learningData.getAvoidanceStrategies().size());
        summary.put("movementEfficiencyScore", learningData.getMovementEfficiencyScore());
        summary.put("lastUpdated", learningData.getLastUpdated().toString());
        summary.put("optimizedParameters", learningData.getOptimizedParameters());
        summary.put("humanAvoidanceParameters", learningData.getHumanAvoidanceParameters());
        
        return ResponseEntity.ok(summary);
    }
    
    /**
     * Get system health metrics
     * @return Current system health metrics
     */
    @GetMapping("/system-health")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SystemHealthMetrics> getSystemHealth() {
        SystemHealthMetrics metrics = aiService.getSystemHealthMetrics();
        return ResponseEntity.ok(metrics);
    }
    
    /**
     * Get active performance issues
     * @return List of active performance issues
     */
    @GetMapping("/performance-issues")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<PerformanceIssue>> getPerformanceIssues() {
        List<PerformanceIssue> issues = aiService.getActivePerformanceIssues();
        return ResponseEntity.ok(issues);
    }
    
    /**
     * Resolve a performance issue
     * @param issueId Issue ID
     * @return Success status
     */
    @PostMapping("/resolve-issue/{issueId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> resolveIssue(@PathVariable String issueId) {
        boolean resolved = healthMonitor.resolveIssue(issueId);
        
        Map<String, Object> result = new HashMap<>();
        result.put("resolved", resolved);
        
        return ResponseEntity.ok(result);
    }
}