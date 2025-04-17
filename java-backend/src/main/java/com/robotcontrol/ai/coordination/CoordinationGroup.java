package com.robotcontrol.ai.coordination;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Class to represent a coordination group for multi-robot tasks
 */
@Data
@Builder
public class CoordinationGroup {
    
    public enum GroupStatus {
        FORMING,       // Group is being assembled
        PLANNING,      // Planning the coordination strategy
        ACTIVE,        // Actively coordinating
        COMPLETED,     // Task completed
        FAILED,        // Task failed
        CANCELLED      // Task cancelled
    }
    
    // Group identification
    private String id;
    private String name;
    
    // Status
    private GroupStatus status;
    private String statusMessage;
    
    // Membership
    private String coordinatorRobotId;
    private List<String> memberRobotIds;
    
    // Task information
    private String primaryTaskId;
    private List<String> subtaskIds;
    
    // Timing
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private int estimatedDurationMinutes;
    
    // Coordination strategy
    private String strategyType;
    private Map<String, Object> strategyParameters;
    
    // Communication
    private List<Message> messageLog;
    
    // Performance metrics
    private double completionPercentage;
    private boolean onSchedule;
    private List<String> issues;
    
    /**
     * Inner class to represent a message in the coordination group
     */
    @Data
    @Builder
    public static class Message {
        private String senderId;
        private List<String> receiverIds;
        private LocalDateTime timestamp;
        private String messageType;
        private Map<String, Object> content;
        private boolean acknowledged;
    }
    
    /**
     * Add a robot to the group
     * @param robotId Robot ID to add
     * @return True if added successfully
     */
    public boolean addRobot(String robotId) {
        if (memberRobotIds.contains(robotId)) {
            return false; // Already a member
        }
        
        memberRobotIds.add(robotId);
        return true;
    }
    
    /**
     * Remove a robot from the group
     * @param robotId Robot ID to remove
     * @return True if removed successfully
     */
    public boolean removeRobot(String robotId) {
        if (robotId.equals(coordinatorRobotId)) {
            return false; // Can't remove coordinator
        }
        
        return memberRobotIds.remove(robotId);
    }
    
    /**
     * Change the coordinator
     * @param newCoordinatorId New coordinator robot ID
     * @return True if changed successfully
     */
    public boolean changeCoordinator(String newCoordinatorId) {
        if (!memberRobotIds.contains(newCoordinatorId)) {
            return false; // Not a member
        }
        
        // Add old coordinator to regular members if not already there
        if (!memberRobotIds.contains(coordinatorRobotId)) {
            memberRobotIds.add(coordinatorRobotId);
        }
        
        // Remove new coordinator from regular members
        memberRobotIds.remove(newCoordinatorId);
        
        // Set new coordinator
        coordinatorRobotId = newCoordinatorId;
        
        return true;
    }
    
    /**
     * Add a message to the log
     * @param message Message to add
     */
    public void addMessage(Message message) {
        if (messageLog == null) {
            messageLog = new java.util.ArrayList<>();
        }
        
        messageLog.add(message);
    }
    
    /**
     * Update completion percentage
     * @param percentage New completion percentage
     */
    public void updateCompletion(double percentage) {
        this.completionPercentage = percentage;
        
        // Update status if completed
        if (percentage >= 100) {
            status = GroupStatus.COMPLETED;
            completedAt = LocalDateTime.now();
        }
    }
    
    /**
     * Add an issue to the list
     * @param issue Issue description
     */
    public void addIssue(String issue) {
        if (issues == null) {
            issues = new java.util.ArrayList<>();
        }
        
        issues.add(issue);
    }
    
    /**
     * Check if the group is behind schedule
     * @return True if behind schedule
     */
    public boolean isBehindSchedule() {
        if (startedAt == null || estimatedDurationMinutes <= 0) {
            return false;
        }
        
        // Calculate expected completion percentage based on elapsed time
        LocalDateTime now = LocalDateTime.now();
        long elapsedMinutes = java.time.Duration.between(startedAt, now).toMinutes();
        double expectedCompletion = Math.min(100, (elapsedMinutes * 100.0) / estimatedDurationMinutes);
        
        // Behind schedule if actual completion is significantly less than expected
        return completionPercentage < (expectedCompletion - 10);
    }
}