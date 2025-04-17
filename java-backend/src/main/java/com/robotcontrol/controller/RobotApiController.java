package com.robotcontrol.controller;

import com.robotcontrol.model.RobotPosition;
import com.robotcontrol.model.RobotStatus;
import com.robotcontrol.model.RobotTemplateAssignment;
import com.robotcontrol.service.AxBotService;
import com.robotcontrol.service.NavigationService;
import com.robotcontrol.service.TemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Controller for robot API endpoints
 */
@RestController
@RequestMapping("/api/robots")
@RequiredArgsConstructor
@Slf4j
public class RobotApiController {

    private final AxBotService axBotService;
    private final NavigationService navigationService;
    private final TemplateService templateService;
    
    /**
     * Get all robot statuses
     * @return List of robot statuses
     */
    @GetMapping("/statuses")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<Map<String, Object>>> getAllRobotStatuses() {
        // Mock implementation - in a real scenario, we would get this from a database or service
        List<Map<String, Object>> statuses = new ArrayList<>();
        
        // Add some mock robot statuses
        statuses.add(createRobotStatusMap("AX-1001", "AxBot-5000", 92, "idle", "standard"));
        statuses.add(createRobotStatusMap("AX-1002", "AxBot-5000", 78, "moving", "eco"));
        statuses.add(createRobotStatusMap("AX-1003", "AxBot-6000", 85, "charging", "standard"));
        
        return ResponseEntity.ok(statuses);
    }
    
    /**
     * Get robot status by serial number
     * @param serialNumber Robot serial number
     * @return Robot status
     */
    @GetMapping("/status/{serialNumber}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getRobotStatus(@PathVariable String serialNumber) {
        RobotStatus status = axBotService.getRobotStatus(serialNumber);
        
        if (status == null) {
            // Fallback to a mock response for demonstration
            return ResponseEntity.ok(createRobotStatusMap(serialNumber, "AxBot-5000", 85, "idle", "standard"));
        }
        
        Map<String, Object> statusMap = new HashMap<>();
        statusMap.put("serialNumber", status.getSerialNumber());
        statusMap.put("model", status.getModel());
        statusMap.put("battery", status.getBattery());
        statusMap.put("status", status.getStatus());
        statusMap.put("mode", status.getMode());
        statusMap.put("lastUpdate", status.getLastUpdate().toString());
        
        return ResponseEntity.ok(statusMap);
    }
    
    /**
     * Get robot position by serial number
     * @param serialNumber Robot serial number
     * @return Robot position
     */
    @GetMapping("/position/{serialNumber}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getRobotPosition(@PathVariable String serialNumber) {
        RobotPosition position = axBotService.getRobotPosition(serialNumber);
        
        if (position == null) {
            // Fallback to a mock response for demonstration
            Map<String, Object> mockPosition = new HashMap<>();
            mockPosition.put("x", 42.5);
            mockPosition.put("y", 67.3);
            mockPosition.put("z", 0.0);
            mockPosition.put("orientation", 90.0);
            mockPosition.put("speed", 0.5);
            mockPosition.put("timestamp", new Date().toString());
            return ResponseEntity.ok(mockPosition);
        }
        
        Map<String, Object> positionMap = new HashMap<>();
        positionMap.put("x", position.getX());
        positionMap.put("y", position.getY());
        positionMap.put("z", position.getZ());
        positionMap.put("orientation", position.getOrientation());
        positionMap.put("speed", position.getSpeed());
        positionMap.put("floor", position.getFloor());
        positionMap.put("timestamp", position.getTimestamp().toString());
        
        return ResponseEntity.ok(positionMap);
    }
    
    /**
     * Get robot sensors data by serial number
     * @param serialNumber Robot serial number
     * @return Sensor data
     */
    @GetMapping("/sensors/{serialNumber}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getRobotSensors(@PathVariable String serialNumber) {
        // Mock implementation - in a real scenario, we would get this from AxBotService
        Map<String, Object> sensorData = new HashMap<>();
        sensorData.put("temperature", 23.5);
        sensorData.put("humidity", 42.0);
        sensorData.put("proximity", Arrays.asList(0.5, 1.2, 2.0, 1.8));
        sensorData.put("battery", 85);
        sensorData.put("timestamp", new Date().toString());
        
        return ResponseEntity.ok(sensorData);
    }
    
    /**
     * Get robot map data by serial number
     * @param serialNumber Robot serial number
     * @return Map data
     */
    @GetMapping("/map/{serialNumber}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getRobotMap(@PathVariable String serialNumber) {
        // Mock implementation - in a real scenario, this would come from a mapping service
        Map<String, Object> mapData = new HashMap<>();
        
        // Create a simple grid
        List<List<Integer>> grid = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            List<Integer> row = new ArrayList<>();
            for (int j = 0; j < 10; j++) {
                // 0 = free space, 1 = obstacle
                row.add(Math.random() > 0.8 ? 1 : 0);
            }
            grid.add(row);
        }
        
        // Ensure edges are obstacles
        for (int i = 0; i < 10; i++) {
            grid.get(0).set(i, 1);
            grid.get(9).set(i, 1);
            grid.get(i).set(0, 1);
            grid.get(i).set(9, 1);
        }
        
        // Create some obstacles
        List<Map<String, Double>> obstacles = new ArrayList<>();
        obstacles.add(Map.of("x", 2.0, "y", 3.0, "z", 0.0));
        obstacles.add(Map.of("x", 5.0, "y", 7.0, "z", 0.0));
        obstacles.add(Map.of("x", 8.0, "y", 2.0, "z", 0.0));
        
        // Create a path
        Map<String, Object> path = new HashMap<>();
        List<Map<String, Double>> points = new ArrayList<>();
        points.add(Map.of("x", 1.0, "y", 1.0, "z", 0.0));
        points.add(Map.of("x", 3.0, "y", 4.0, "z", 0.0));
        points.add(Map.of("x", 6.0, "y", 8.0, "z", 0.0));
        path.put("points", points);
        path.put("status", "active");
        
        mapData.put("grid", grid);
        mapData.put("obstacles", obstacles);
        mapData.put("paths", Collections.singletonList(path));
        
        return ResponseEntity.ok(mapData);
    }
    
    /**
     * Get robot template assignment by serial number
     * @param serialNumber Robot serial number
     * @return Template assignment
     */
    @GetMapping("/robot-assignments/by-serial/{serialNumber}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getRobotAssignment(@PathVariable String serialNumber) {
        Optional<RobotTemplateAssignment> assignmentOpt = templateService.getAssignmentByRobot(serialNumber);
        
        if (assignmentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        RobotTemplateAssignment assignment = assignmentOpt.get();
        
        Map<String, Object> response = new HashMap<>();
        response.put("id", assignment.getId());
        response.put("serialNumber", assignment.getSerialNumber());
        response.put("templateId", assignment.getTemplate().getId());
        response.put("templateName", assignment.getTemplate().getName());
        response.put("customization", assignment.getCustomization());
        response.put("isActive", assignment.getIsActive());
        response.put("assignedAt", assignment.getAssignedAt().toString());
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get current task for robot
     * @param serialNumber Robot serial number
     * @return Task information
     */
    @GetMapping("/task/{serialNumber}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getRobotTask(@PathVariable String serialNumber) {
        // Mock implementation - in a real scenario, this would come from a task service
        Map<String, Object> task = new HashMap<>();
        task.put("id", UUID.randomUUID().toString());
        task.put("type", "delivery");
        task.put("status", "in_progress");
        task.put("progress", 65);
        task.put("startTime", new Date(System.currentTimeMillis() - 300000).toString());
        task.put("estimatedCompletionTime", new Date(System.currentTimeMillis() + 180000).toString());
        
        Map<String, Object> details = new HashMap<>();
        details.put("destination", "Room 302");
        details.put("item", "Package #4782");
        details.put("priority", "medium");
        
        task.put("details", details);
        
        return ResponseEntity.ok(task);
    }
    
    /**
     * Navigate robot to a specified location
     * @param serialNumber Robot serial number
     * @param destination Destination coordinates
     * @return Navigation response
     */
    @PostMapping("/navigate/{serialNumber}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> navigateRobot(
            @PathVariable String serialNumber,
            @RequestBody Map<String, Object> destination) {
        
        boolean success = axBotService.sendNavigationCommand(serialNumber, destination);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", success);
        
        if (success) {
            response.put("message", "Navigation command sent successfully");
            response.put("taskId", UUID.randomUUID().toString());
        } else {
            response.put("message", "Failed to send navigation command");
            response.put("error", "Robot might be unavailable or destination is invalid");
        }
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Plan a path to a specific unit
     * @param serialNumber Robot serial number
     * @param requestBody Request containing unit ID
     * @return Path information
     */
    @PostMapping("/plan-path/{serialNumber}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> planPath(
            @PathVariable String serialNumber,
            @RequestBody Map<String, Object> requestBody) {
        
        Long unitId = Long.valueOf(requestBody.get("unitId").toString());
        
        Map<String, Object> pathInfo = navigationService.planPath(serialNumber, unitId);
        
        if (pathInfo == null) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Failed to plan path");
            return ResponseEntity.badRequest().body(errorResponse);
        }
        
        pathInfo.put("success", true);
        return ResponseEntity.ok(pathInfo);
    }
    
    /**
     * Create a robot status map for testing
     */
    private Map<String, Object> createRobotStatusMap(String serialNumber, String model, int battery, String status, String mode) {
        Map<String, Object> robotStatus = new HashMap<>();
        robotStatus.put("serialNumber", serialNumber);
        robotStatus.put("model", model);
        robotStatus.put("battery", battery);
        robotStatus.put("status", status);
        robotStatus.put("mode", mode);
        robotStatus.put("lastUpdate", new Date().toString());
        return robotStatus;
    }
}