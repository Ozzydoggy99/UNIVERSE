package com.robotcontrol.ai.task;

import com.robotcontrol.ai.maintenance.MaintenancePrediction;
import com.robotcontrol.ai.maintenance.PredictiveMaintenanceService;
import com.robotcontrol.model.RobotStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service for optimizing task scheduling and execution
 */
@Service
@Slf4j
public class TaskOptimizationService {
    
    @Autowired
    private PredictiveMaintenanceService maintenanceService;
    
    // Store tasks
    private final Map<String, Task> tasks = new ConcurrentHashMap<>();
    
    // Store robot capabilities and current assignments
    private final Map<String, RobotCapabilities> robotCapabilities = new ConcurrentHashMap<>();
    private final Map<String, List<Task>> robotAssignments = new ConcurrentHashMap<>();
    
    // Store performance metrics
    private final Map<String, TaskPerformanceStats> taskTypePerformance = new ConcurrentHashMap<>();
    private final Map<String, RobotPerformanceStats> robotPerformance = new ConcurrentHashMap<>();
    
    // Learning parameters
    private final Map<String, Map<String, Double>> taskTypeParameters = new ConcurrentHashMap<>();
    
    /**
     * Initialize service
     */
    public void initialize() {
        log.info("Initializing Task Optimization Service");
        
        // Initialize default task parameters
        initializeTaskParameters();
    }
    
    /**
     * Initialize default task parameters
     */
    private void initializeTaskParameters() {
        // PICKUP task parameters
        Map<String, Double> pickupParams = new HashMap<>();
        pickupParams.put("baseTime", 5.0); // minutes
        pickupParams.put("itemWeightFactor", 0.5); // minutes per kg
        pickupParams.put("distanceFactor", 0.1); // minutes per meter
        taskTypeParameters.put(Task.TaskType.PICKUP.toString(), pickupParams);
        
        // DELIVERY task parameters
        Map<String, Double> deliveryParams = new HashMap<>();
        deliveryParams.put("baseTime", 5.0);
        deliveryParams.put("itemWeightFactor", 0.3);
        deliveryParams.put("distanceFactor", 0.1);
        deliveryParams.put("floorChangeFactor", 3.0); // minutes per floor change
        taskTypeParameters.put(Task.TaskType.DELIVERY.toString(), deliveryParams);
        
        // CLEANING task parameters
        Map<String, Double> cleaningParams = new HashMap<>();
        cleaningParams.put("baseTime", 10.0);
        cleaningParams.put("areaSizeFactor", 0.05); // minutes per square meter
        cleaningParams.put("obstacleDensityFactor", 2.0); // minutes factor based on obstacle density
        taskTypeParameters.put(Task.TaskType.CLEANING.toString(), cleaningParams);
        
        // NAVIGATION task parameters
        Map<String, Double> navigationParams = new HashMap<>();
        navigationParams.put("baseTime", 1.0);
        navigationParams.put("distanceFactor", 0.1);
        navigationParams.put("floorChangeFactor", 3.0);
        navigationParams.put("obstacleDensityFactor", 1.5);
        taskTypeParameters.put(Task.TaskType.NAVIGATION.toString(), navigationParams);
    }
    
    /**
     * Register robot capabilities
     * @param serialNumber Robot serial number
     * @param capabilities Robot capabilities
     */
    public void registerRobotCapabilities(String serialNumber, RobotCapabilities capabilities) {
        robotCapabilities.put(serialNumber, capabilities);
        
        // Initialize empty assignment list
        if (!robotAssignments.containsKey(serialNumber)) {
            robotAssignments.put(serialNumber, new ArrayList<>());
        }
        
        // Initialize performance stats
        if (!robotPerformance.containsKey(serialNumber)) {
            robotPerformance.put(serialNumber, new RobotPerformanceStats(serialNumber));
        }
    }
    
    /**
     * Add a new task
     * @param task Task to add
     * @return Added task
     */
    public Task addTask(Task task) {
        // Generate ID if not provided
        if (task.getId() == null || task.getId().isEmpty()) {
            task.setId(UUID.randomUUID().toString());
        }
        
        // Set creation time if not provided
        if (task.getCreatedAt() == null) {
            task.setCreatedAt(LocalDateTime.now());
        }
        
        // Set initial status if not provided
        if (task.getStatus() == null) {
            task.setStatus(Task.TaskStatus.PENDING);
        }
        
        // Store task
        tasks.put(task.getId(), task);
        
        // Schedule task if assigned to a robot
        if (task.getAssignedRobot() != null && !task.getAssignedRobot().isEmpty()) {
            robotAssignments.computeIfAbsent(task.getAssignedRobot(), k -> new ArrayList<>()).add(task);
        }
        
        return task;
    }
    
    /**
     * Update a task
     * @param taskId Task ID
     * @param updates Updates to apply
     * @return Updated task
     */
    public Task updateTask(String taskId, Task updates) {
        Task existingTask = tasks.get(taskId);
        if (existingTask == null) {
            throw new IllegalArgumentException("Task not found: " + taskId);
        }
        
        // Check if robot assignment is changing
        String oldRobot = existingTask.getAssignedRobot();
        String newRobot = updates.getAssignedRobot();
        
        if (oldRobot != null && !oldRobot.equals(newRobot)) {
            // Remove from old robot's assignments
            List<Task> oldAssignments = robotAssignments.get(oldRobot);
            if (oldAssignments != null) {
                oldAssignments.removeIf(t -> t.getId().equals(taskId));
            }
        }
        
        // Apply updates
        if (updates.getTitle() != null) existingTask.setTitle(updates.getTitle());
        if (updates.getDescription() != null) existingTask.setDescription(updates.getDescription());
        if (updates.getType() != null) existingTask.setType(updates.getType());
        if (updates.getStatus() != null) existingTask.setStatus(updates.getStatus());
        if (updates.getPriority() != null) existingTask.setPriority(updates.getPriority());
        if (updates.getAssignedRobot() != null) existingTask.setAssignedRobot(updates.getAssignedRobot());
        if (updates.getAssignedUser() != null) existingTask.setAssignedUser(updates.getAssignedUser());
        if (updates.getScheduledStartTime() != null) existingTask.setScheduledStartTime(updates.getScheduledStartTime());
        if (updates.getActualStartTime() != null) existingTask.setActualStartTime(updates.getActualStartTime());
        if (updates.getCompletedTime() != null) existingTask.setCompletedTime(updates.getCompletedTime());
        if (updates.getEstimatedDurationMinutes() != null) existingTask.setEstimatedDurationMinutes(updates.getEstimatedDurationMinutes());
        if (updates.getActualDurationMinutes() != null) existingTask.setActualDurationMinutes(updates.getActualDurationMinutes());
        if (updates.getStartX() != null) existingTask.setStartX(updates.getStartX());
        if (updates.getStartY() != null) existingTask.setStartY(updates.getStartY());
        if (updates.getStartZ() != null) existingTask.setStartZ(updates.getStartZ());
        if (updates.getStartFloor() != null) existingTask.setStartFloor(updates.getStartFloor());
        if (updates.getStartBuilding() != null) existingTask.setStartBuilding(updates.getStartBuilding());
        if (updates.getDestinationX() != null) existingTask.setDestinationX(updates.getDestinationX());
        if (updates.getDestinationY() != null) existingTask.setDestinationY(updates.getDestinationY());
        if (updates.getDestinationZ() != null) existingTask.setDestinationZ(updates.getDestinationZ());
        if (updates.getDestinationFloor() != null) existingTask.setDestinationFloor(updates.getDestinationFloor());
        if (updates.getDestinationBuilding() != null) existingTask.setDestinationBuilding(updates.getDestinationBuilding());
        if (updates.getDependsOnTaskIds() != null) existingTask.setDependsOnTaskIds(updates.getDependsOnTaskIds());
        if (updates.getTaskParameters() != null) existingTask.setTaskParameters(updates.getTaskParameters());
        if (updates.getResultMessage() != null) existingTask.setResultMessage(updates.getResultMessage());
        if (updates.getResultData() != null) existingTask.setResultData(updates.getResultData());
        if (updates.getEstimatedEnergyUsage() != null) existingTask.setEstimatedEnergyUsage(updates.getEstimatedEnergyUsage());
        if (updates.getActualEnergyUsage() != null) existingTask.setActualEnergyUsage(updates.getActualEnergyUsage());
        
        // If task is now completed or failed, update performance metrics
        if ((updates.getStatus() == Task.TaskStatus.COMPLETED || updates.getStatus() == Task.TaskStatus.FAILED) &&
                existingTask.getActualStartTime() != null && existingTask.getCompletedTime() != null) {
            updatePerformanceMetrics(existingTask);
        }
        
        // Add to new robot's assignments if needed
        if (newRobot != null && !newRobot.equals(oldRobot)) {
            robotAssignments.computeIfAbsent(newRobot, k -> new ArrayList<>()).add(existingTask);
        }
        
        return existingTask;
    }
    
    /**
     * Update performance metrics when a task is completed
     */
    private void updatePerformanceMetrics(Task task) {
        if (task.getType() == null || task.getAssignedRobot() == null) {
            return;
        }
        
        // Calculate actual duration
        long durationMinutes = ChronoUnit.MINUTES.between(
                task.getActualStartTime(), task.getCompletedTime());
        
        // Update task type performance
        String taskType = task.getType().toString();
        TaskPerformanceStats typeStats = taskTypePerformance.computeIfAbsent(
                taskType, k -> new TaskPerformanceStats(taskType));
        
        typeStats.addTaskResult(durationMinutes, task.isSuccessful());
        
        // Update robot performance
        RobotPerformanceStats robotStats = robotPerformance.computeIfAbsent(
                task.getAssignedRobot(), k -> new RobotPerformanceStats(task.getAssignedRobot()));
        
        robotStats.addTaskResult(taskType, durationMinutes, task.isSuccessful());
        
        // If there is significant difference between estimated and actual time,
        // update task parameters for better future estimates
        if (task.getEstimatedDurationMinutes() != null && 
                Math.abs(durationMinutes - task.getEstimatedDurationMinutes()) > 5) {
            
            adjustTaskParameters(task, durationMinutes);
        }
    }
    
    /**
     * Adjust task parameters based on actual performance
     */
    private void adjustTaskParameters(Task task, long actualDurationMinutes) {
        Map<String, Double> params = taskTypeParameters.get(task.getType().toString());
        if (params == null) return;
        
        // Extract task-specific factors
        double distance = calculateDistance(task);
        double floorChanges = calculateFloorChanges(task);
        Map<String, Object> taskParams = task.getTaskParameters();
        
        // Create learning rate - smaller for more established parameters
        TaskPerformanceStats typeStats = taskTypePerformance.get(task.getType().toString());
        double learningRate = 0.1 / Math.max(1, (typeStats != null ? typeStats.getTotalTasks() : 0) / 10.0);
        
        // Adjust parameters based on the specific task type
        switch (task.getType()) {
            case PICKUP:
            case DELIVERY:
                if (taskParams != null && taskParams.containsKey("weight")) {
                    double weight = Double.parseDouble(taskParams.get("weight").toString());
                    adjustParameter(params, "baseTime", actualDurationMinutes, distance, weight, floorChanges, learningRate);
                    adjustParameter(params, "itemWeightFactor", actualDurationMinutes, distance, weight, floorChanges, learningRate);
                    adjustParameter(params, "distanceFactor", actualDurationMinutes, distance, weight, floorChanges, learningRate);
                }
                break;
                
            case CLEANING:
                if (taskParams != null && taskParams.containsKey("areaSize")) {
                    double areaSize = Double.parseDouble(taskParams.get("areaSize").toString());
                    double obstacleDensity = taskParams.containsKey("obstacleDensity") ? 
                            Double.parseDouble(taskParams.get("obstacleDensity").toString()) : 0.5;
                    
                    adjustParameter(params, "baseTime", actualDurationMinutes, areaSize, obstacleDensity, 0, learningRate);
                    adjustParameter(params, "areaSizeFactor", actualDurationMinutes, areaSize, obstacleDensity, 0, learningRate);
                    adjustParameter(params, "obstacleDensityFactor", actualDurationMinutes, areaSize, obstacleDensity, 0, learningRate);
                }
                break;
                
            case NAVIGATION:
                adjustParameter(params, "baseTime", actualDurationMinutes, distance, 0, floorChanges, learningRate);
                adjustParameter(params, "distanceFactor", actualDurationMinutes, distance, 0, floorChanges, learningRate);
                adjustParameter(params, "floorChangeFactor", actualDurationMinutes, distance, 0, floorChanges, learningRate);
                break;
        }
    }
    
    /**
     * Adjust a specific parameter based on observed performance
     */
    private void adjustParameter(Map<String, Double> params, String paramName, 
            double actualDuration, double factor1, double factor2, double factor3,
            double learningRate) {
        
        if (!params.containsKey(paramName)) return;
        
        double currentValue = params.get(paramName);
        // Simplified adjustment - in a real system would use more sophisticated algorithms
        double expectedValue = currentValue;
        double error = actualDuration - expectedValue;
        
        // Update parameter
        double newValue = currentValue + (error * learningRate);
        // Ensure parameter stays positive
        newValue = Math.max(0.1, newValue);
        
        params.put(paramName, newValue);
    }
    
    /**
     * Calculate distance between start and destination points
     */
    private double calculateDistance(Task task) {
        if (task.getStartX() == null || task.getStartY() == null || 
                task.getDestinationX() == null || task.getDestinationY() == null) {
            return 0;
        }
        
        return Math.sqrt(
                Math.pow(task.getDestinationX() - task.getStartX(), 2) +
                Math.pow(task.getDestinationY() - task.getStartY(), 2));
    }
    
    /**
     * Calculate number of floor changes required
     */
    private double calculateFloorChanges(Task task) {
        if (task.getStartFloor() == null || task.getDestinationFloor() == null) {
            return 0;
        }
        
        return task.getStartFloor().equals(task.getDestinationFloor()) ? 0 : 1;
    }
    
    /**
     * Find the best robot for a task
     * @param task Task to assign
     * @return Best robot serial number or null if no suitable robot found
     */
    public String findBestRobotForTask(Task task) {
        List<String> eligibleRobots = findEligibleRobots(task);
        if (eligibleRobots.isEmpty()) {
            return null;
        }
        
        // Calculate score for each eligible robot
        Map<String, Double> robotScores = new HashMap<>();
        
        for (String robotSerial : eligibleRobots) {
            double score = calculateRobotTaskScore(robotSerial, task);
            robotScores.put(robotSerial, score);
        }
        
        // Find robot with highest score
        return robotScores.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
    }
    
    /**
     * Find all robots eligible for a task
     * @param task Task to assign
     * @return List of eligible robot serial numbers
     */
    private List<String> findEligibleRobots(Task task) {
        List<String> eligible = new ArrayList<>();
        
        for (Map.Entry<String, RobotCapabilities> entry : robotCapabilities.entrySet()) {
            String serialNumber = entry.getKey();
            RobotCapabilities capabilities = entry.getValue();
            
            // Check if robot has necessary capabilities
            if (!hasRequiredCapabilities(capabilities, task)) {
                continue;
            }
            
            // Check maintenance status
            MaintenancePrediction maintenance = maintenanceService.getMaintenancePrediction(serialNumber);
            if (maintenance != null && (
                    maintenance.getUrgency() == MaintenancePrediction.MaintenanceUrgency.CRITICAL ||
                    maintenance.getUrgency() == MaintenancePrediction.MaintenanceUrgency.HIGH)) {
                continue;
            }
            
            // Check battery level (should be above 20% for new tasks)
            RobotStatus status = getRobotStatus(serialNumber);
            if (status != null && status.getBattery() < 20) {
                continue;
            }
            
            eligible.add(serialNumber);
        }
        
        return eligible;
    }
    
    /**
     * Check if a robot has the required capabilities for a task
     * @param capabilities Robot capabilities
     * @param task Task to check
     * @return True if robot has required capabilities
     */
    private boolean hasRequiredCapabilities(RobotCapabilities capabilities, Task task) {
        switch (task.getType()) {
            case PICKUP:
            case DELIVERY:
                // Need arm capability for picking up/delivering items
                return capabilities.isHasArm();
                
            case CLEANING:
                // Need cleaning capability
                return capabilities.isHasCleaning();
                
            case INSPECTION:
                // Need camera capability
                return capabilities.isHasCamera();
                
            default:
                // For other tasks, basic capabilities are sufficient
                return true;
        }
    }
    
    /**
     * Calculate a score for how suitable a robot is for a task
     * @param serialNumber Robot serial number
     * @param task Task to assign
     * @return Score (higher is better)
     */
    private double calculateRobotTaskScore(String serialNumber, Task task) {
        double score = 100.0;
        
        // Check current workload
        List<Task> currentTasks = robotAssignments.getOrDefault(serialNumber, Collections.emptyList());
        int pendingTasks = (int) currentTasks.stream()
                .filter(t -> t.getStatus() == Task.TaskStatus.PENDING || 
                             t.getStatus() == Task.TaskStatus.ASSIGNED ||
                             t.getStatus() == Task.TaskStatus.IN_PROGRESS)
                .count();
        
        // Penalize for each pending task
        score -= pendingTasks * 10;
        
        // Check performance history for this task type
        RobotPerformanceStats performance = robotPerformance.get(serialNumber);
        if (performance != null) {
            double taskSuccessRate = performance.getTaskTypeSuccessRate(task.getType().toString());
            double taskEfficiency = performance.getTaskTypeEfficiency(task.getType().toString());
            
            // Reward for high success rate and efficiency
            score += taskSuccessRate * 20;
            score += taskEfficiency * 10;
        }
        
        // Check distance to task start point
        RobotStatus status = getRobotStatus(serialNumber);
        if (status != null && task.getStartX() != null && task.getStartY() != null) {
            double distance = Math.sqrt(
                    Math.pow(task.getStartX() - status.getCurrentX(), 2) +
                    Math.pow(task.getStartY() - status.getCurrentY(), 2));
            
            // Penalize for distance, but less important than other factors
            score -= Math.min(30, distance / 10.0);
        }
        
        // Check battery level
        if (status != null) {
            // Prefer robots with higher battery
            score += status.getBattery() * 0.3;
        }
        
        // Check maintenance prediction
        MaintenancePrediction maintenance = maintenanceService.getMaintenancePrediction(serialNumber);
        if (maintenance != null) {
            switch (maintenance.getUrgency()) {
                case LOW:
                    break; // No penalty
                case MEDIUM:
                    score -= 10;
                    break;
                case HIGH:
                    score -= 30;
                    break;
                case CRITICAL:
                    score -= 100; // Effectively disqualifies robot
                    break;
            }
        }
        
        return Math.max(0, score);
    }
    
    /**
     * Get robot status (would be implemented by another service)
     */
    private RobotStatus getRobotStatus(String serialNumber) {
        // This is a placeholder - in a real implementation would get from a service
        return null;
    }
    
    /**
     * Estimate task duration based on learned parameters
     * @param task Task to estimate
     * @return Estimated duration in minutes
     */
    public int estimateTaskDuration(Task task) {
        Map<String, Double> params = taskTypeParameters.get(task.getType().toString());
        if (params == null) {
            // Default estimate if no parameters available
            return 15;
        }
        
        double baseTime = params.getOrDefault("baseTime", 5.0);
        double estimate = baseTime;
        
        // Add task-specific factors
        switch (task.getType()) {
            case PICKUP:
            case DELIVERY:
                double weight = 1.0;
                if (task.getTaskParameters() != null && task.getTaskParameters().containsKey("weight")) {
                    weight = Double.parseDouble(task.getTaskParameters().get("weight").toString());
                }
                
                double distance = calculateDistance(task);
                double floorChanges = calculateFloorChanges(task);
                
                estimate += weight * params.getOrDefault("itemWeightFactor", 0.5);
                estimate += distance * params.getOrDefault("distanceFactor", 0.1);
                
                if (task.getType() == Task.TaskType.DELIVERY) {
                    estimate += floorChanges * params.getOrDefault("floorChangeFactor", 3.0);
                }
                break;
                
            case CLEANING:
                double areaSize = 10.0;
                double obstacleDensity = 0.5;
                
                if (task.getTaskParameters() != null) {
                    if (task.getTaskParameters().containsKey("areaSize")) {
                        areaSize = Double.parseDouble(task.getTaskParameters().get("areaSize").toString());
                    }
                    if (task.getTaskParameters().containsKey("obstacleDensity")) {
                        obstacleDensity = Double.parseDouble(task.getTaskParameters().get("obstacleDensity").toString());
                    }
                }
                
                estimate += areaSize * params.getOrDefault("areaSizeFactor", 0.05);
                estimate += obstacleDensity * params.getOrDefault("obstacleDensityFactor", 2.0);
                break;
                
            case NAVIGATION:
                distance = calculateDistance(task);
                floorChanges = calculateFloorChanges(task);
                
                estimate += distance * params.getOrDefault("distanceFactor", 0.1);
                estimate += floorChanges * params.getOrDefault("floorChangeFactor", 3.0);
                break;
        }
        
        return (int) Math.ceil(estimate);
    }
    
    /**
     * Estimate energy usage for a task
     * @param task Task to estimate
     * @return Estimated energy usage as percentage of battery
     */
    public double estimateTaskEnergyUsage(Task task) {
        int durationMinutes = task.getEstimatedDurationMinutes() != null ?
                task.getEstimatedDurationMinutes() : estimateTaskDuration(task);
        
        // Base energy usage per minute
        double baseUsagePerMinute = 0.2; // percentage points per minute
        
        // Additional factors based on task type
        double taskTypeFactor = 1.0;
        switch (task.getType()) {
            case PICKUP:
            case DELIVERY:
                taskTypeFactor = 1.2; // Using arm increases energy usage
                break;
            case CLEANING:
                taskTypeFactor = 1.5; // Cleaning uses more energy
                break;
            case NAVIGATION:
                taskTypeFactor = 0.8; // Just moving uses less energy
                break;
        }
        
        // Distance factor
        double distance = calculateDistance(task);
        double distanceFactor = distance * 0.01; // 1% per 100 meters
        
        // Floor change factor
        double floorChanges = calculateFloorChanges(task);
        double floorChangeFactor = floorChanges * 1.0; // 1% per floor change
        
        // Calculate total
        return durationMinutes * baseUsagePerMinute * taskTypeFactor + distanceFactor + floorChangeFactor;
    }
    
    /**
     * Optimize task assignments for all robots
     * This redistributes tasks to optimize overall system performance
     */
    @Scheduled(fixedRate = 300000) // Every 5 minutes
    public void optimizeTaskAssignments() {
        log.info("Running task assignment optimization");
        
        // Get all pending tasks
        List<Task> pendingTasks = tasks.values().stream()
                .filter(t -> t.getStatus() == Task.TaskStatus.PENDING || 
                             t.getStatus() == Task.TaskStatus.ASSIGNED && 
                             t.getActualStartTime() == null)
                .collect(Collectors.toList());
        
        if (pendingTasks.isEmpty()) {
            return;
        }
        
        // Sort tasks by priority and creation time
        pendingTasks.sort((t1, t2) -> {
            int priorityCompare = t2.getPriority().compareTo(t1.getPriority()); // Higher priority first
            if (priorityCompare != 0) {
                return priorityCompare;
            }
            return t1.getCreatedAt().compareTo(t2.getCreatedAt()); // Older first
        });
        
        // Clear current assignments for pending tasks
        for (Task task : pendingTasks) {
            if (task.getAssignedRobot() != null) {
                String robot = task.getAssignedRobot();
                List<Task> assignments = robotAssignments.get(robot);
                if (assignments != null) {
                    assignments.removeIf(t -> t.getId().equals(task.getId()));
                }
                task.setAssignedRobot(null);
            }
        }
        
        // Reassign tasks
        for (Task task : pendingTasks) {
            String bestRobot = findBestRobotForTask(task);
            if (bestRobot != null) {
                task.setAssignedRobot(bestRobot);
                robotAssignments.computeIfAbsent(bestRobot, k -> new ArrayList<>()).add(task);
                
                log.info("Assigned task {} to robot {}", task.getId(), bestRobot);
            } else {
                log.warn("No suitable robot found for task {}", task.getId());
            }
        }
    }
    
    /**
     * Get all tasks, optionally filtered
     * @param status Optional status filter
     * @param robotSerial Optional robot filter
     * @return List of matching tasks
     */
    public List<Task> getTasks(Task.TaskStatus status, String robotSerial) {
        Stream<Task> taskStream = tasks.values().stream();
        
        if (status != null) {
            taskStream = taskStream.filter(t -> t.getStatus() == status);
        }
        
        if (robotSerial != null) {
            taskStream = taskStream.filter(t -> robotSerial.equals(t.getAssignedRobot()));
        }
        
        return taskStream.collect(Collectors.toList());
    }
    
    /**
     * Get a specific task
     * @param taskId Task ID
     * @return Task or null if not found
     */
    public Task getTask(String taskId) {
        return tasks.get(taskId);
    }
    
    /**
     * Get current assignments for a robot
     * @param serialNumber Robot serial number
     * @return List of assigned tasks
     */
    public List<Task> getRobotAssignments(String serialNumber) {
        return robotAssignments.getOrDefault(serialNumber, Collections.emptyList());
    }
    
    /**
     * Get performance statistics for task types
     * @return Map of task type to performance stats
     */
    public Map<String, TaskPerformanceStats> getTaskTypePerformance() {
        return new HashMap<>(taskTypePerformance);
    }
    
    /**
     * Get performance statistics for robots
     * @return Map of robot serial number to performance stats
     */
    public Map<String, RobotPerformanceStats> getRobotPerformance() {
        return new HashMap<>(robotPerformance);
    }
    
    /**
     * Inner class for task type performance statistics
     */
    @Data
    public static class TaskPerformanceStats {
        private final String taskType;
        private long totalTasks = 0;
        private long successfulTasks = 0;
        private double avgDurationMinutes = 0;
        private double minDurationMinutes = Double.MAX_VALUE;
        private double maxDurationMinutes = 0;
        
        public TaskPerformanceStats(String taskType) {
            this.taskType = taskType;
        }
        
        public void addTaskResult(long durationMinutes, boolean successful) {
            totalTasks++;
            if (successful) {
                successfulTasks++;
            }
            
            // Update min/max
            minDurationMinutes = Math.min(minDurationMinutes, durationMinutes);
            maxDurationMinutes = Math.max(maxDurationMinutes, durationMinutes);
            
            // Update average using running average formula
            avgDurationMinutes = avgDurationMinutes + (durationMinutes - avgDurationMinutes) / totalTasks;
        }
        
        public double getSuccessRate() {
            return totalTasks > 0 ? (double) successfulTasks / totalTasks : 0;
        }
    }
    
    /**
     * Inner class for robot performance statistics
     */
    @Data
    public static class RobotPerformanceStats {
        private final String serialNumber;
        private long totalTasks = 0;
        private long successfulTasks = 0;
        private Map<String, TaskPerformanceStats> taskTypeStats = new HashMap<>();
        
        public RobotPerformanceStats(String serialNumber) {
            this.serialNumber = serialNumber;
        }
        
        public void addTaskResult(String taskType, long durationMinutes, boolean successful) {
            totalTasks++;
            if (successful) {
                successfulTasks++;
            }
            
            // Update task type specific stats
            TaskPerformanceStats typeStats = taskTypeStats.computeIfAbsent(
                    taskType, TaskPerformanceStats::new);
            typeStats.addTaskResult(durationMinutes, successful);
        }
        
        public double getOverallSuccessRate() {
            return totalTasks > 0 ? (double) successfulTasks / totalTasks : 0;
        }
        
        public double getTaskTypeSuccessRate(String taskType) {
            TaskPerformanceStats stats = taskTypeStats.get(taskType);
            return stats != null ? stats.getSuccessRate() : 0;
        }
        
        public double getTaskTypeEfficiency(String taskType) {
            TaskPerformanceStats stats = taskTypeStats.get(taskType);
            TaskPerformanceStats globalStats = taskTypePerformance.get(taskType);
            
            if (stats == null || globalStats == null || globalStats.getAvgDurationMinutes() == 0) {
                return 1.0;
            }
            
            // Efficiency is the ratio of this robot's average duration to global average
            // Lower duration = higher efficiency
            return globalStats.getAvgDurationMinutes() / stats.getAvgDurationMinutes();
        }
    }
}