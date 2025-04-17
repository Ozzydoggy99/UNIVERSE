package com.robotcontrol.ai.coordination;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service for coordinating multiple robots on complex tasks
 */
@Service
@Slf4j
public class MultiRobotCoordinationService {
    
    // Store coordination groups
    private final Map<String, CoordinationGroup> coordinationGroups = new ConcurrentHashMap<>();
    
    // Store robot data
    private final Map<String, Robot> robots = new ConcurrentHashMap<>();
    
    // Store tasks
    private final Map<String, Task> tasks = new ConcurrentHashMap<>();
    
    // Available coordination strategies
    private final List<CoordinationStrategy> strategies = new ArrayList<>();
    
    // Performance history by strategy type
    private final Map<CoordinationStrategy.StrategyType, List<Double>> strategyPerformance = new ConcurrentHashMap<>();
    
    @PostConstruct
    public void initialize() {
        log.info("Initializing Multi-Robot Coordination Service");
        
        // Initialize coordination strategies
        initializeStrategies();
    }
    
    /**
     * Initialize available coordination strategies
     */
    private void initializeStrategies() {
        strategies.add(CoordinationStrategy.createLeaderFollowerStrategy());
        strategies.add(CoordinationStrategy.createDistributedStrategy());
        strategies.add(CoordinationStrategy.createMarketBasedStrategy());
        strategies.add(CoordinationStrategy.createSwarmStrategy());
        
        log.info("Initialized {} coordination strategies", strategies.size());
    }
    
    /**
     * Register a robot with the coordination service
     * @param robot Robot to register
     */
    public void registerRobot(Robot robot) {
        robots.put(robot.getId(), robot);
        log.info("Registered robot: {}", robot.getId());
    }
    
    /**
     * Update robot status
     * @param robotId Robot ID
     * @param status New status
     * @param location Current location
     * @param batteryLevel Current battery level
     */
    public void updateRobotStatus(String robotId, Robot.RobotStatus status, 
            Task.Location location, double batteryLevel) {
        Robot robot = robots.get(robotId);
        if (robot == null) {
            log.warn("Attempted to update unknown robot: {}", robotId);
            return;
        }
        
        robot.setStatus(status);
        robot.setCurrentLocation(location);
        robot.setBatteryLevel(batteryLevel);
        
        // If robot is in a coordination group, update group status
        if (robot.isParticipatingInCoordination()) {
            CoordinationGroup group = coordinationGroups.get(robot.getCurrentCoordinationGroupId());
            if (group != null) {
                updateGroupStatus(group);
            }
        }
    }
    
    /**
     * Add a new task for potential multi-robot coordination
     * @param task Task to add
     * @return Task ID
     */
    public String addTask(Task task) {
        // Generate ID if not provided
        if (task.getId() == null || task.getId().isEmpty()) {
            task.setId(UUID.randomUUID().toString());
        }
        
        // Set creation time if not provided
        if (task.getCreatedAt() == null) {
            task.setCreatedAt(LocalDateTime.now());
        }
        
        // Store task
        tasks.put(task.getId(), task);
        log.info("Added task: {}", task.getId());
        
        return task.getId();
    }
    
    /**
     * Analyze task to determine if it requires coordination
     * @param taskId Task ID
     * @return True if task requires coordination
     */
    public boolean requiresCoordination(String taskId) {
        Task task = tasks.get(taskId);
        if (task == null) {
            return false;
        }
        
        // Task is explicitly marked as multi-robot
        if (task.isMultiRobot()) {
            return true;
        }
        
        // Large cleaning or surveillance tasks often benefit from coordination
        if ((task.getType() == Task.TaskType.CLEANING || task.getType() == Task.TaskType.SURVEILLANCE) &&
                task.getParameters() != null && task.getParameters().containsKey("areaSize")) {
            double areaSize = Double.parseDouble(task.getParameters().get("areaSize").toString());
            return areaSize > 100; // Large area threshold
        }
        
        // Heavy transport tasks might require multiple robots
        if (task.getType() == Task.TaskType.TRANSPORT &&
                task.getParameters() != null && task.getParameters().containsKey("weight")) {
            double weight = Double.parseDouble(task.getParameters().get("weight").toString());
            // Find max payload of any single robot
            double maxRobotPayload = robots.values().stream()
                    .mapToDouble(Robot::getMaxPayload)
                    .max()
                    .orElse(0);
            
            return weight > maxRobotPayload; // Too heavy for any single robot
        }
        
        return false;
    }
    
    /**
     * Create a coordination group for a task
     * @param taskId Task ID
     * @return Created coordination group or null if not possible
     */
    public CoordinationGroup createCoordinationGroup(String taskId) {
        Task task = tasks.get(taskId);
        if (task == null) {
            log.warn("Attempted to create coordination group for unknown task: {}", taskId);
            return null;
        }
        
        // Find suitable robots for this task
        List<Robot> suitableRobots = findSuitableRobots(task);
        if (suitableRobots.isEmpty()) {
            log.warn("No suitable robots found for task: {}", taskId);
            return null;
        }
        
        // Select best coordination strategy
        CoordinationStrategy strategy = selectCoordinationStrategy(task, suitableRobots);
        if (strategy == null) {
            log.warn("No suitable coordination strategy found for task: {}", taskId);
            return null;
        }
        
        // Select coordinator robot (highest capability robot)
        Robot coordinator = selectCoordinator(suitableRobots);
        
        // Create coordination group
        String groupId = UUID.randomUUID().toString();
        List<String> memberIds = suitableRobots.stream()
                .map(Robot::getId)
                .filter(id -> !id.equals(coordinator.getId())) // Exclude coordinator
                .collect(Collectors.toList());
        
        CoordinationGroup group = CoordinationGroup.builder()
                .id(groupId)
                .name("Coordination for " + task.getTitle())
                .status(CoordinationGroup.GroupStatus.FORMING)
                .coordinatorRobotId(coordinator.getId())
                .memberRobotIds(memberIds)
                .primaryTaskId(taskId)
                .createdAt(LocalDateTime.now())
                .strategyType(strategy.getType().toString())
                .strategyParameters(strategy.getParameters())
                .estimatedDurationMinutes(task.getEstimatedDurationMinutes() != null ? 
                        task.getEstimatedDurationMinutes() : 30)
                .completionPercentage(0)
                .onSchedule(true)
                .build();
        
        // Store the group
        coordinationGroups.put(groupId, group);
        
        // Update robots with coordination information
        updateRobotCoordinationStatus(coordinator.getId(), groupId, true);
        for (String memberId : memberIds) {
            updateRobotCoordinationStatus(memberId, groupId, false);
        }
        
        // Update task with coordination information
        task.setIsMultiRobot(true);
        task.setCoordinatorRobotId(coordinator.getId());
        task.setParticipatingRobotIds(new ArrayList<>(memberIds));
        task.getParticipatingRobotIds().add(coordinator.getId());
        
        log.info("Created coordination group {} for task {} with {} robots", 
                groupId, taskId, suitableRobots.size());
        
        return group;
    }
    
    /**
     * Find suitable robots for a task
     * @param task Task
     * @return List of suitable robots
     */
    private List<Robot> findSuitableRobots(Task task) {
        // Filter robots by availability and capability
        return robots.values().stream()
                .filter(robot -> robot.getStatus() == Robot.RobotStatus.AVAILABLE || 
                                robot.getStatus() == Robot.RobotStatus.BUSY)
                .filter(robot -> !robot.isParticipatingInCoordination()) // Not already in coordination
                .filter(robot -> robot.calculateTaskSuitability(task) > 50) // Suitable for task
                .sorted(Comparator.comparing(robot -> robot.calculateTaskSuitability(task), Comparator.reverseOrder()))
                .limit(5) // Limit to top 5 most suitable robots
                .collect(Collectors.toList());
    }
    
    /**
     * Select the best coordination strategy for a task and robots
     * @param task Task
     * @param robots Available robots
     * @return Best strategy or null if none suitable
     */
    private CoordinationStrategy selectCoordinationStrategy(Task task, List<Robot> robots) {
        // Filter strategies that are applicable
        List<CoordinationStrategy> applicableStrategies = strategies.stream()
                .filter(strategy -> strategy.isApplicable(task, robots))
                .collect(Collectors.toList());
        
        if (applicableStrategies.isEmpty()) {
            return null;
        }
        
        // Calculate scores for each strategy
        Map<CoordinationStrategy, Double> scores = new HashMap<>();
        for (CoordinationStrategy strategy : applicableStrategies) {
            double suitabilityScore = strategy.calculateSuitabilityScore(task, robots);
            
            // Adjust score based on historical performance
            List<Double> history = strategyPerformance.get(strategy.getType());
            if (history != null && !history.isEmpty()) {
                double avgPerformance = history.stream().mapToDouble(Double::doubleValue).average().orElse(0.7);
                suitabilityScore *= avgPerformance;
            }
            
            scores.put(strategy, suitabilityScore);
        }
        
        // Return strategy with highest score
        return scores.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
    }
    
    /**
     * Select the best robot to be coordinator
     * @param robots Available robots
     * @return Best coordinator robot
     */
    private Robot selectCoordinator(List<Robot> robots) {
        // Select robot with highest battery and best performance metrics
        return robots.stream()
                .sorted(Comparator
                        .comparing(Robot::getBatteryLevel, Comparator.reverseOrder())
                        .thenComparing(Robot::getEfficiencyRating, Comparator.reverseOrder()))
                .findFirst()
                .orElse(robots.get(0));
    }
    
    /**
     * Update robot coordination status
     * @param robotId Robot ID
     * @param groupId Coordination group ID
     * @param isCoordinator Whether this robot is the coordinator
     */
    private void updateRobotCoordinationStatus(String robotId, String groupId, boolean isCoordinator) {
        Robot robot = robots.get(robotId);
        if (robot == null) {
            return;
        }
        
        robot.setParticipatingInCoordination(true);
        robot.setCurrentCoordinationGroupId(groupId);
        robot.setCoordinator(isCoordinator);
    }
    
    /**
     * Start a coordination group
     * @param groupId Group ID
     * @return True if started successfully
     */
    public boolean startCoordinationGroup(String groupId) {
        CoordinationGroup group = coordinationGroups.get(groupId);
        if (group == null) {
            log.warn("Attempted to start unknown coordination group: {}", groupId);
            return false;
        }
        
        // Update group status
        group.setStatus(CoordinationGroup.GroupStatus.ACTIVE);
        group.setStartedAt(LocalDateTime.now());
        
        // Update task status
        Task task = tasks.get(group.getPrimaryTaskId());
        if (task != null) {
            task.setStatus(Task.TaskStatus.IN_PROGRESS);
            task.setActualStartTime(LocalDateTime.now());
        }
        
        log.info("Started coordination group: {}", groupId);
        return true;
    }
    
    /**
     * Update coordination group status based on robot statuses
     * @param group Coordination group
     */
    private void updateGroupStatus(CoordinationGroup group) {
        if (group.getStatus() != CoordinationGroup.GroupStatus.ACTIVE) {
            return;
        }
        
        // Check coordinator status
        Robot coordinator = robots.get(group.getCoordinatorRobotId());
        if (coordinator == null || coordinator.getStatus() == Robot.RobotStatus.OFFLINE || 
                coordinator.getStatus() == Robot.RobotStatus.ERROR) {
            
            // Need to reassign coordinator
            log.warn("Coordinator {} is unavailable, selecting new coordinator for group {}", 
                    group.getCoordinatorRobotId(), group.getId());
            
            List<Robot> availableMembers = group.getMemberRobotIds().stream()
                    .map(robots::get)
                    .filter(Objects::nonNull)
                    .filter(r -> r.getStatus() != Robot.RobotStatus.OFFLINE && 
                                r.getStatus() != Robot.RobotStatus.ERROR)
                    .collect(Collectors.toList());
            
            if (availableMembers.isEmpty()) {
                // No available robots, fail the group
                group.setStatus(CoordinationGroup.GroupStatus.FAILED);
                group.setStatusMessage("All robots unavailable");
                
                // Update task status
                Task task = tasks.get(group.getPrimaryTaskId());
                if (task != null) {
                    task.setStatus(Task.TaskStatus.FAILED);
                }
                
                log.error("Failed coordination group {} due to all robots being unavailable", group.getId());
                return;
            }
            
            // Select new coordinator
            Robot newCoordinator = selectCoordinator(availableMembers);
            String oldCoordinatorId = group.getCoordinatorRobotId();
            
            // Update group and robots
            group.changeCoordinator(newCoordinator.getId());
            updateRobotCoordinationStatus(newCoordinator.getId(), group.getId(), true);
            
            log.info("Changed coordinator for group {} from {} to {}", 
                    group.getId(), oldCoordinatorId, newCoordinator.getId());
            
            // Add issue to group log
            group.addIssue("Coordinator " + oldCoordinatorId + " failed, reassigned to " + newCoordinator.getId());
        }
        
        // Check if task completed
        Task task = tasks.get(group.getPrimaryTaskId());
        if (task != null && task.getStatus() == Task.TaskStatus.COMPLETED) {
            group.setStatus(CoordinationGroup.GroupStatus.COMPLETED);
            group.setCompletedAt(LocalDateTime.now());
            group.setCompletionPercentage(100);
            
            // Record performance for this strategy type
            recordStrategyPerformance(group);
            
            log.info("Completed coordination group: {}", group.getId());
        }
    }
    
    /**
     * Record performance metrics for a strategy
     * @param group Completed coordination group
     */
    private void recordStrategyPerformance(CoordinationGroup group) {
        if (group.getStrategyType() == null || group.getStartedAt() == null || group.getCompletedAt() == null) {
            return;
        }
        
        try {
            CoordinationStrategy.StrategyType strategyType = CoordinationStrategy.StrategyType.valueOf(group.getStrategyType());
            
            // Calculate performance score (0.0-1.0)
            double score;
            
            // If task failed, low score
            if (group.getStatus() == CoordinationGroup.GroupStatus.FAILED) {
                score = 0.3;
            } else {
                // Base score on completion time vs estimated time
                long estimatedMinutes = group.getEstimatedDurationMinutes();
                long actualMinutes = java.time.Duration.between(group.getStartedAt(), group.getCompletedAt()).toMinutes();
                
                if (estimatedMinutes > 0) {
                    // Score based on time efficiency
                    double timeRatio = (double) estimatedMinutes / actualMinutes;
                    score = Math.min(1.0, Math.max(0.5, timeRatio));
                } else {
                    score = 0.7; // Default if no estimate
                }
            }
            
            // Record the score
            List<Double> performance = strategyPerformance.computeIfAbsent(
                    strategyType, k -> new ArrayList<>());
            performance.add(score);
            
            // Limit history size
            if (performance.size() > 100) {
                performance.remove(0);
            }
            
            log.info("Recorded performance score {} for strategy {}", score, strategyType);
        } catch (Exception e) {
            log.error("Error recording strategy performance", e);
        }
    }
    
    /**
     * Update task progress in a coordination group
     * @param groupId Group ID
     * @param progress Progress percentage (0-100)
     * @return True if updated successfully
     */
    public boolean updateTaskProgress(String groupId, double progress) {
        CoordinationGroup group = coordinationGroups.get(groupId);
        if (group == null) {
            log.warn("Attempted to update unknown coordination group: {}", groupId);
            return false;
        }
        
        // Update group completion
        group.updateCompletion(progress);
        
        // Update task progress
        Task task = tasks.get(group.getPrimaryTaskId());
        if (task != null) {
            task.setTaskProgress(progress);
            
            // If completed
            if (progress >= 100) {
                task.setStatus(Task.TaskStatus.COMPLETED);
                task.setCompletedTime(LocalDateTime.now());
            }
        }
        
        return true;
    }
    
    /**
     * Add a message to a coordination group
     * @param groupId Group ID
     * @param senderId Sender robot ID
     * @param messageType Message type
     * @param content Message content
     * @return True if added successfully
     */
    public boolean addGroupMessage(String groupId, String senderId, String messageType, Map<String, Object> content) {
        CoordinationGroup group = coordinationGroups.get(groupId);
        if (group == null) {
            log.warn("Attempted to add message to unknown coordination group: {}", groupId);
            return false;
        }
        
        // Create message
        CoordinationGroup.Message message = CoordinationGroup.Message.builder()
                .senderId(senderId)
                .receiverIds(group.getMemberRobotIds())
                .timestamp(LocalDateTime.now())
                .messageType(messageType)
                .content(content)
                .acknowledged(false)
                .build();
        
        // Add to group
        group.addMessage(message);
        
        return true;
    }
    
    /**
     * Get coordination strategy parameters for a robot
     * @param robotId Robot ID
     * @return Strategy parameters or null if not in a coordination group
     */
    public Map<String, Object> getRobotStrategyParameters(String robotId) {
        Robot robot = robots.get(robotId);
        if (robot == null || !robot.isParticipatingInCoordination()) {
            return null;
        }
        
        CoordinationGroup group = coordinationGroups.get(robot.getCurrentCoordinationGroupId());
        if (group == null) {
            return null;
        }
        
        // Find strategy
        CoordinationStrategy strategy = strategies.stream()
                .filter(s -> s.getType().toString().equals(group.getStrategyType()))
                .findFirst()
                .orElse(null);
        
        if (strategy == null) {
            return null;
        }
        
        // Get role
        String role = strategy.getRobotRole(robotId, group);
        
        // Get parameters
        return strategy.getDecisionParameters(robotId, role);
    }
    
    /**
     * Schedule coordination monitoring and updates
     */
    @Scheduled(fixedRate = 60000) // Every minute
    public void monitorCoordinationGroups() {
        log.debug("Monitoring coordination groups");
        
        for (CoordinationGroup group : coordinationGroups.values()) {
            if (group.getStatus() == CoordinationGroup.GroupStatus.ACTIVE) {
                // Check for issues
                checkForCoordinationIssues(group);
                
                // Update status based on robot statuses
                updateGroupStatus(group);
                
                // Check if behind schedule
                if (group.isBehindSchedule()) {
                    log.warn("Coordination group {} is behind schedule", group.getId());
                    group.setOnSchedule(false);
                    group.addIssue("Group is behind schedule");
                }
            }
        }
    }
    
    /**
     * Check for issues in a coordination group
     * @param group Coordination group
     */
    private void checkForCoordinationIssues(CoordinationGroup group) {
        // Check for offline or error robots
        List<String> problemRobots = new ArrayList<>();
        
        // Check coordinator
        Robot coordinator = robots.get(group.getCoordinatorRobotId());
        if (coordinator != null && (coordinator.getStatus() == Robot.RobotStatus.OFFLINE || 
                                  coordinator.getStatus() == Robot.RobotStatus.ERROR)) {
            problemRobots.add(coordinator.getId());
        }
        
        // Check members
        for (String memberId : group.getMemberRobotIds()) {
            Robot member = robots.get(memberId);
            if (member != null && (member.getStatus() == Robot.RobotStatus.OFFLINE || 
                                 member.getStatus() == Robot.RobotStatus.ERROR)) {
                problemRobots.add(member.getId());
            }
        }
        
        if (!problemRobots.isEmpty()) {
            log.warn("Coordination group {} has problem robots: {}", group.getId(), problemRobots);
            group.addIssue("Problem robots: " + String.join(", ", problemRobots));
        }
    }
    
    /**
     * Get active coordination groups
     * @return List of active coordination groups
     */
    public List<CoordinationGroup> getActiveGroups() {
        return coordinationGroups.values().stream()
                .filter(g -> g.getStatus() == CoordinationGroup.GroupStatus.ACTIVE ||
                           g.getStatus() == CoordinationGroup.GroupStatus.FORMING)
                .collect(Collectors.toList());
    }
    
    /**
     * Get a specific coordination group
     * @param groupId Group ID
     * @return Coordination group or null if not found
     */
    public CoordinationGroup getGroup(String groupId) {
        return coordinationGroups.get(groupId);
    }
    
    /**
     * Get coordination groups for a robot
     * @param robotId Robot ID
     * @return List of coordination groups
     */
    public List<CoordinationGroup> getGroupsForRobot(String robotId) {
        return coordinationGroups.values().stream()
                .filter(g -> g.getCoordinatorRobotId().equals(robotId) || 
                           g.getMemberRobotIds().contains(robotId))
                .collect(Collectors.toList());
    }
    
    /**
     * Get tasks for a coordination group
     * @param groupId Group ID
     * @return List of tasks
     */
    public List<Task> getTasksForGroup(String groupId) {
        CoordinationGroup group = coordinationGroups.get(groupId);
        if (group == null) {
            return Collections.emptyList();
        }
        
        List<Task> groupTasks = new ArrayList<>();
        
        // Add primary task
        Task primaryTask = tasks.get(group.getPrimaryTaskId());
        if (primaryTask != null) {
            groupTasks.add(primaryTask);
        }
        
        // Add subtasks
        if (group.getSubtaskIds() != null) {
            for (String subtaskId : group.getSubtaskIds()) {
                Task subtask = tasks.get(subtaskId);
                if (subtask != null) {
                    groupTasks.add(subtask);
                }
            }
        }
        
        return groupTasks;
    }
}