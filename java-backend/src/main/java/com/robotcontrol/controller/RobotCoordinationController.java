package com.robotcontrol.controller;

import com.robotcontrol.ai.coordination.CoordinationGroup;
import com.robotcontrol.ai.coordination.MultiRobotCoordinationService;
import com.robotcontrol.ai.coordination.Robot;
import com.robotcontrol.ai.coordination.Task;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller for multi-robot coordination functionality
 */
@RestController
@RequestMapping("/api/coordination")
public class RobotCoordinationController {
    
    @Autowired
    private MultiRobotCoordinationService coordinationService;
    
    /**
     * Register a robot for coordination
     * @param robot Robot data
     * @return Success message
     */
    @PostMapping("/robots")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> registerRobot(@RequestBody Robot robot) {
        coordinationService.registerRobot(robot);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Robot registered successfully");
        response.put("robotId", robot.getId());
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Update robot status
     * @param robotId Robot ID
     * @param statusData Status data
     * @return Success message
     */
    @PutMapping("/robots/{robotId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<Map<String, Object>> updateRobotStatus(
            @PathVariable String robotId,
            @RequestBody Map<String, Object> statusData) {
        
        Robot.RobotStatus status = Robot.RobotStatus.valueOf(statusData.get("status").toString());
        
        // Parse location
        Task.Location location = null;
        if (statusData.containsKey("location")) {
            Map<String, Object> locationData = (Map<String, Object>) statusData.get("location");
            location = Task.Location.builder()
                    .x(Double.parseDouble(locationData.get("x").toString()))
                    .y(Double.parseDouble(locationData.get("y").toString()))
                    .z(Double.parseDouble(locationData.get("z").toString()))
                    .floor(locationData.get("floor").toString())
                    .building(locationData.get("building").toString())
                    .build();
        }
        
        double batteryLevel = Double.parseDouble(statusData.get("batteryLevel").toString());
        
        coordinationService.updateRobotStatus(robotId, status, location, batteryLevel);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Robot status updated");
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Add a task for potential coordination
     * @param task Task data
     * @return Task ID and analysis
     */
    @PostMapping("/tasks")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> addTask(@RequestBody Task task) {
        String taskId = coordinationService.addTask(task);
        boolean requiresCoordination = coordinationService.requiresCoordination(taskId);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("taskId", taskId);
        response.put("requiresCoordination", requiresCoordination);
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Create a coordination group for a task
     * @param taskId Task ID
     * @return Coordination group data
     */
    @PostMapping("/groups/create/{taskId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> createCoordinationGroup(@PathVariable String taskId) {
        CoordinationGroup group = coordinationService.createCoordinationGroup(taskId);
        
        if (group == null) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Failed to create coordination group");
            return ResponseEntity.badRequest().body(error);
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("groupId", group.getId());
        response.put("coordinatorId", group.getCoordinatorRobotId());
        response.put("memberCount", group.getMemberRobotIds().size());
        response.put("taskId", group.getPrimaryTaskId());
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Start a coordination group
     * @param groupId Group ID
     * @return Success status
     */
    @PostMapping("/groups/{groupId}/start")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> startCoordinationGroup(@PathVariable String groupId) {
        boolean success = coordinationService.startCoordinationGroup(groupId);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", success);
        
        if (success) {
            response.put("message", "Coordination group started successfully");
        } else {
            response.put("message", "Failed to start coordination group");
            return ResponseEntity.badRequest().body(response);
        }
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Update task progress in a coordination group
     * @param groupId Group ID
     * @param progressData Progress data
     * @return Success status
     */
    @PutMapping("/groups/{groupId}/progress")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<Map<String, Object>> updateTaskProgress(
            @PathVariable String groupId,
            @RequestBody Map<String, Object> progressData) {
        
        double progress = Double.parseDouble(progressData.get("progress").toString());
        boolean success = coordinationService.updateTaskProgress(groupId, progress);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", success);
        
        if (success) {
            response.put("message", "Progress updated");
        } else {
            response.put("message", "Failed to update progress");
            return ResponseEntity.badRequest().body(response);
        }
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Send a message in a coordination group
     * @param groupId Group ID
     * @param messageData Message data
     * @return Success status
     */
    @PostMapping("/groups/{groupId}/messages")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<Map<String, Object>> sendGroupMessage(
            @PathVariable String groupId,
            @RequestBody Map<String, Object> messageData) {
        
        String senderId = messageData.get("senderId").toString();
        String messageType = messageData.get("messageType").toString();
        Map<String, Object> content = (Map<String, Object>) messageData.get("content");
        
        boolean success = coordinationService.addGroupMessage(groupId, senderId, messageType, content);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", success);
        
        if (success) {
            response.put("message", "Message sent");
        } else {
            response.put("message", "Failed to send message");
            return ResponseEntity.badRequest().body(response);
        }
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get strategy parameters for a robot
     * @param robotId Robot ID
     * @return Strategy parameters
     */
    @GetMapping("/robots/{robotId}/strategy")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<Map<String, Object>> getRobotStrategyParameters(@PathVariable String robotId) {
        Map<String, Object> params = coordinationService.getRobotStrategyParameters(robotId);
        
        if (params == null) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Robot is not participating in coordination");
            return ResponseEntity.badRequest().body(error);
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("parameters", params);
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get active coordination groups
     * @return List of active groups
     */
    @GetMapping("/groups/active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<CoordinationGroup>> getActiveGroups() {
        List<CoordinationGroup> groups = coordinationService.getActiveGroups();
        return ResponseEntity.ok(groups);
    }
    
    /**
     * Get a specific coordination group
     * @param groupId Group ID
     * @return Coordination group
     */
    @GetMapping("/groups/{groupId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<CoordinationGroup> getGroup(@PathVariable String groupId) {
        CoordinationGroup group = coordinationService.getGroup(groupId);
        
        if (group == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(group);
    }
    
    /**
     * Get coordination groups for a robot
     * @param robotId Robot ID
     * @return List of coordination groups
     */
    @GetMapping("/robots/{robotId}/groups")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<List<CoordinationGroup>> getGroupsForRobot(@PathVariable String robotId) {
        List<CoordinationGroup> groups = coordinationService.getGroupsForRobot(robotId);
        return ResponseEntity.ok(groups);
    }
    
    /**
     * Get tasks for a coordination group
     * @param groupId Group ID
     * @return List of tasks
     */
    @GetMapping("/groups/{groupId}/tasks")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<List<Task>> getTasksForGroup(@PathVariable String groupId) {
        List<Task> tasks = coordinationService.getTasksForGroup(groupId);
        return ResponseEntity.ok(tasks);
    }
}