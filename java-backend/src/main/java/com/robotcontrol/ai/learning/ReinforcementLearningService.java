package com.robotcontrol.ai.learning;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Service for reinforcement learning
 */
@Service
@Slf4j
public class ReinforcementLearningService {
    
    @Value("${rl.model.path:models/rl}")
    private String modelPath;
    
    @Value("${rl.learning.rate:0.1}")
    private double learningRate;
    
    @Value("${rl.discount.factor:0.9}")
    private double discountFactor;
    
    @Value("${rl.exploration.rate:0.2}")
    private double explorationRate;
    
    // Store Q-tables by robot serial number and situation type
    private final Map<String, Map<String, QTable>> qTables = new ConcurrentHashMap<>();
    
    // Experience replay buffers by robot
    private final Map<String, ExperienceBuffer> experienceBuffers = new ConcurrentHashMap<>();
    
    // Current states by robot
    private final Map<String, State> currentStates = new ConcurrentHashMap<>();
    
    // Recent actions by robot
    private final Map<String, List<Action>> recentActions = new ConcurrentHashMap<>();
    
    // Policy models by robot and scenario
    private final Map<String, Map<String, PolicyModel>> policyModels = new ConcurrentHashMap<>();
    
    // Maximum size of experience buffer
    private static final int MAX_EXPERIENCE_BUFFER_SIZE = 1000;
    
    // Maximum size of recent actions list
    private static final int MAX_RECENT_ACTIONS_SIZE = 50;
    
    @PostConstruct
    public void initialize() {
        log.info("Initializing Reinforcement Learning Service");
        
        // Create model directory if it doesn't exist
        try {
            Path path = Paths.get(modelPath);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
                log.info("Created model directory: {}", path);
            }
        } catch (IOException e) {
            log.error("Failed to create model directory", e);
        }
        
        // Load existing models
        loadModels();
    }
    
    /**
     * Update the current state for a robot
     * @param robotSerialNumber Robot serial number
     * @param state Current state
     */
    public void updateState(String robotSerialNumber, State state) {
        currentStates.put(robotSerialNumber, state);
    }
    
    /**
     * Record an action and its result
     * @param action Action taken
     * @param newState Resulting state
     * @param reward Reward received
     */
    public void recordAction(Action action, State newState, double reward) {
        String robotSerialNumber = action.getSerialNumber();
        
        // Add to experience buffer
        ExperienceBuffer buffer = experienceBuffers.computeIfAbsent(
                robotSerialNumber, k -> new ExperienceBuffer(MAX_EXPERIENCE_BUFFER_SIZE));
        
        Experience experience = new Experience(action.getPreviousState(), action, newState, reward);
        buffer.add(experience);
        
        // Add to recent actions
        List<Action> actions = recentActions.computeIfAbsent(
                robotSerialNumber, k -> new ArrayList<>());
        actions.add(action);
        
        // Limit size
        if (actions.size() > MAX_RECENT_ACTIONS_SIZE) {
            actions.remove(0);
        }
        
        // Update Q-table for this type of situation
        String situationType = determineSituationType(action.getPreviousState());
        updateQTable(robotSerialNumber, situationType, action.getPreviousState(), action, newState, reward);
        
        // Update current state
        currentStates.put(robotSerialNumber, newState);
    }
    
    /**
     * Determine the type of situation (context) from a state
     * @param state Robot state
     * @return Situation type identifier
     */
    private String determineSituationType(State state) {
        // Simplified situation type determination
        // In a real implementation, this would use more sophisticated clustering
        
        // Check for obstacle avoidance situation
        if (state.getNearbyObstacles() != null && !state.getNearbyObstacles().isEmpty()) {
            return "obstacle_avoidance";
        }
        
        // Check for human interaction situation
        if (state.getNearbyHumans() != null && !state.getNearbyHumans().isEmpty()) {
            return "human_interaction";
        }
        
        // Check for low battery situation
        if (state.getBatteryLevel() < 20) {
            return "low_battery";
        }
        
        // Default to navigation
        return "navigation";
    }
    
    /**
     * Get the recommended action for a robot in its current state
     * @param robotSerialNumber Robot serial number
     * @return Recommended action
     */
    public Action getRecommendedAction(String robotSerialNumber) {
        State currentState = currentStates.get(robotSerialNumber);
        if (currentState == null) {
            return null;
        }
        
        // Determine situation type
        String situationType = determineSituationType(currentState);
        
        // Decide whether to explore or exploit
        if (ThreadLocalRandom.current().nextDouble() < explorationRate) {
            // Exploration: choose a random action
            return generateRandomAction(robotSerialNumber, currentState);
        } else {
            // Exploitation: choose the best action according to the policy
            return getBestAction(robotSerialNumber, situationType, currentState);
        }
    }
    
    /**
     * Generate a random action for exploration
     * @param robotSerialNumber Robot serial number
     * @param state Current state
     * @return Random action
     */
    private Action generateRandomAction(String robotSerialNumber, State state) {
        Action.ActionType[] actionTypes = Action.ActionType.values();
        Action.ActionType randomType = actionTypes[ThreadLocalRandom.current().nextInt(actionTypes.length)];
        
        switch (randomType) {
            case MOVE:
                double dirX = ThreadLocalRandom.current().nextDouble(-1, 1);
                double dirY = ThreadLocalRandom.current().nextDouble(-1, 1);
                double speed = ThreadLocalRandom.current().nextDouble(0.2, 1);
                return Action.createMoveAction(robotSerialNumber, dirX, dirY, speed, state);
                
            case ADJUST_SPEED:
                speed = ThreadLocalRandom.current().nextDouble(0, 1);
                return Action.createAdjustSpeedAction(robotSerialNumber, speed, state);
                
            case CHANGE_DIRECTION:
                double orientation = ThreadLocalRandom.current().nextDouble(0, 360);
                return Action.createChangeDirectionAction(robotSerialNumber, orientation, state);
                
            case STOP:
                return Action.createStopAction(robotSerialNumber, state);
                
            case NAVIGATE_TO:
                double x = ThreadLocalRandom.current().nextDouble(-100, 100);
                double y = ThreadLocalRandom.current().nextDouble(-100, 100);
                double z = state.getZ(); // Keep same Z
                return Action.createNavigateToAction(robotSerialNumber, x, y, z, state.getFloor(), state);
                
            case AVOID_OBSTACLE:
                // Find an obstacle to avoid
                if (state.getNearbyObstacles() != null && !state.getNearbyObstacles().isEmpty()) {
                    Map<String, Object> obstacle = state.getNearbyObstacles().get(0);
                    double obsX = Double.parseDouble(obstacle.get("x").toString());
                    double obsY = Double.parseDouble(obstacle.get("y").toString());
                    double obsZ = Double.parseDouble(obstacle.get("z").toString());
                    return Action.createAvoidObstacleAction(robotSerialNumber, obsX, obsY, obsZ, "random", state);
                }
                // Fall through to MOVE if no obstacles
                
            default:
                // Default to a random move
                dirX = ThreadLocalRandom.current().nextDouble(-1, 1);
                dirY = ThreadLocalRandom.current().nextDouble(-1, 1);
                speed = ThreadLocalRandom.current().nextDouble(0.2, 1);
                return Action.createMoveAction(robotSerialNumber, dirX, dirY, speed, state);
        }
    }
    
    /**
     * Get the best action according to the policy
     * @param robotSerialNumber Robot serial number
     * @param situationType Situation type
     * @param state Current state
     * @return Best action
     */
    private Action getBestAction(String robotSerialNumber, String situationType, State state) {
        // Try to use policy model if available
        PolicyModel model = getPolicyModel(robotSerialNumber, situationType);
        if (model != null) {
            return model.predictBestAction(state);
        }
        
        // Fall back to Q-table approach
        QTable qTable = getQTable(robotSerialNumber, situationType);
        
        // Get all Q-values for the current state
        Map<String, Double> qValues = qTable.getActionsForState(stateToKey(state));
        
        if (qValues.isEmpty()) {
            // No prior experience, generate a random action
            return generateRandomAction(robotSerialNumber, state);
        }
        
        // Find action with highest Q-value
        String bestActionKey = qValues.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
        
        if (bestActionKey == null) {
            return generateRandomAction(robotSerialNumber, state);
        }
        
        // Convert action key back to an action
        return keyToAction(bestActionKey, robotSerialNumber, state);
    }
    
    /**
     * Update Q-table with new experience
     * @param robotSerialNumber Robot serial number
     * @param situationType Situation type
     * @param state Prior state
     * @param action Action taken
     * @param newState Resulting state
     * @param reward Reward received
     */
    private void updateQTable(String robotSerialNumber, String situationType, 
            State state, Action action, State newState, double reward) {
        
        QTable qTable = getQTable(robotSerialNumber, situationType);
        
        // Convert state and action to keys
        String stateKey = stateToKey(state);
        String actionKey = actionToKey(action);
        String newStateKey = stateToKey(newState);
        
        // Get current Q-value for the state-action pair
        double currentQ = qTable.getValue(stateKey, actionKey);
        
        // Find max Q-value for new state
        double maxFutureQ = qTable.getActionsForState(newStateKey).values().stream()
                .mapToDouble(d -> d)
                .max()
                .orElse(0.0);
        
        // Q-learning update formula: Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
        double newQ = currentQ + learningRate * (reward + discountFactor * maxFutureQ - currentQ);
        
        // Update Q-table
        qTable.setValue(stateKey, actionKey, newQ);
    }
    
    /**
     * Get Q-table for a robot and situation type, creating if needed
     * @param robotSerialNumber Robot serial number
     * @param situationType Situation type
     * @return Q-table
     */
    private QTable getQTable(String robotSerialNumber, String situationType) {
        Map<String, QTable> robotTables = qTables.computeIfAbsent(
                robotSerialNumber, k -> new ConcurrentHashMap<>());
        
        return robotTables.computeIfAbsent(situationType, k -> new QTable());
    }
    
    /**
     * Get policy model for a robot and situation type
     * @param robotSerialNumber Robot serial number
     * @param situationType Situation type
     * @return Policy model or null if not available
     */
    private PolicyModel getPolicyModel(String robotSerialNumber, String situationType) {
        Map<String, PolicyModel> robotModels = policyModels.get(robotSerialNumber);
        if (robotModels == null) {
            return null;
        }
        
        return robotModels.get(situationType);
    }
    
    /**
     * Convert state to string key for Q-table
     * @param state State to convert
     * @return String key
     */
    private String stateToKey(State state) {
        // Simplified implementation - in real system would use more sophisticated discretization
        int xBin = discretize(state.getX(), -100, 100, 10);
        int yBin = discretize(state.getY(), -100, 100, 10);
        int orientationBin = discretize(state.getOrientation(), 0, 360, 8);
        int batteryBin = discretize(state.getBatteryLevel(), 0, 100, 5);
        int obstaclesBin = state.getNearbyObstacles() == null ? 0 : 
                           Math.min(3, state.getNearbyObstacles().size());
        int humansBin = state.getNearbyHumans() == null ? 0 : 
                       Math.min(2, state.getNearbyHumans().size());
        
        return String.format("%d:%d:%d:%d:%d:%d:%s", 
                xBin, yBin, orientationBin, batteryBin, obstaclesBin, humansBin, state.getFloor());
    }
    
    /**
     * Discretize a continuous value into bins
     * @param value Value to discretize
     * @param min Minimum value
     * @param max Maximum value
     * @param bins Number of bins
     * @return Bin index (0 to bins-1)
     */
    private int discretize(double value, double min, double max, int bins) {
        // Clamp value to range
        double clampedValue = Math.max(min, Math.min(max, value));
        
        // Calculate bin
        double binSize = (max - min) / bins;
        int bin = (int) ((clampedValue - min) / binSize);
        
        // Handle edge case
        return Math.min(bin, bins - 1);
    }
    
    /**
     * Convert action to string key for Q-table
     * @param action Action to convert
     * @return String key
     */
    private String actionToKey(Action action) {
        StringBuilder key = new StringBuilder(action.getType().toString());
        
        // Add relevant parameters based on action type
        Map<String, Object> params = action.getParameters();
        switch (action.getType()) {
            case MOVE:
                key.append(":")
                   .append(discretize((double) params.get("directionX"), -1, 1, 5)).append(":")
                   .append(discretize((double) params.get("directionY"), -1, 1, 5)).append(":")
                   .append(discretize((double) params.get("speed"), 0, 1, 3));
                break;
                
            case ADJUST_SPEED:
                key.append(":").append(discretize((double) params.get("speed"), 0, 1, 5));
                break;
                
            case CHANGE_DIRECTION:
                key.append(":").append(discretize((double) params.get("orientation"), 0, 360, 8));
                break;
                
            case NAVIGATE_TO:
                key.append(":")
                   .append(discretize((double) params.get("x"), -100, 100, 5)).append(":")
                   .append(discretize((double) params.get("y"), -100, 100, 5));
                break;
                
            case AVOID_OBSTACLE:
                // No additional parameters for key
                break;
                
            default:
                // No parameters for other action types
                break;
        }
        
        return key.toString();
    }
    
    /**
     * Convert action key back to an action
     * @param actionKey Action key from Q-table
     * @param robotSerialNumber Robot serial number
     * @param currentState Current state
     * @return Action object
     */
    private Action keyToAction(String actionKey, String robotSerialNumber, State currentState) {
        String[] parts = actionKey.split(":");
        
        Action.ActionType type = Action.ActionType.valueOf(parts[0]);
        
        switch (type) {
            case MOVE:
                if (parts.length >= 4) {
                    double dirX = undiscretize(Integer.parseInt(parts[1]), -1, 1, 5);
                    double dirY = undiscretize(Integer.parseInt(parts[2]), -1, 1, 5);
                    double speed = undiscretize(Integer.parseInt(parts[3]), 0, 1, 3);
                    return Action.createMoveAction(robotSerialNumber, dirX, dirY, speed, currentState);
                }
                break;
                
            case ADJUST_SPEED:
                if (parts.length >= 2) {
                    double speed = undiscretize(Integer.parseInt(parts[1]), 0, 1, 5);
                    return Action.createAdjustSpeedAction(robotSerialNumber, speed, currentState);
                }
                break;
                
            case CHANGE_DIRECTION:
                if (parts.length >= 2) {
                    double orientation = undiscretize(Integer.parseInt(parts[1]), 0, 360, 8);
                    return Action.createChangeDirectionAction(robotSerialNumber, orientation, currentState);
                }
                break;
                
            case NAVIGATE_TO:
                if (parts.length >= 3) {
                    double x = undiscretize(Integer.parseInt(parts[1]), -100, 100, 5);
                    double y = undiscretize(Integer.parseInt(parts[2]), -100, 100, 5);
                    return Action.createNavigateToAction(robotSerialNumber, x, y, currentState.getZ(), currentState.getFloor(), currentState);
                }
                break;
                
            case STOP:
                return Action.createStopAction(robotSerialNumber, currentState);
                
            case AVOID_OBSTACLE:
                // Find closest obstacle
                if (currentState.getNearbyObstacles() != null && !currentState.getNearbyObstacles().isEmpty()) {
                    Map<String, Object> obstacle = currentState.getNearbyObstacles().get(0);
                    double obsX = Double.parseDouble(obstacle.get("x").toString());
                    double obsY = Double.parseDouble(obstacle.get("y").toString());
                    double obsZ = Double.parseDouble(obstacle.get("z").toString());
                    return Action.createAvoidObstacleAction(robotSerialNumber, obsX, obsY, obsZ, "learned", currentState);
                }
                break;
        }
        
        // Default action if parsing fails
        return Action.createStopAction(robotSerialNumber, currentState);
    }
    
    /**
     * Convert discretized bin back to continuous value
     * @param bin Bin index
     * @param min Minimum value
     * @param max Maximum value
     * @param bins Number of bins
     * @return Continuous value
     */
    private double undiscretize(int bin, double min, double max, int bins) {
        double binSize = (max - min) / bins;
        // Return middle of the bin
        return min + (bin * binSize) + (binSize / 2);
    }
    
    /**
     * Train policy models using collected experience
     */
    @Scheduled(fixedRate = 3600000) // Once per hour
    public void trainModels() {
        log.info("Training reinforcement learning models");
        
        for (Map.Entry<String, ExperienceBuffer> entry : experienceBuffers.entrySet()) {
            String robotSerialNumber = entry.getKey();
            ExperienceBuffer buffer = entry.getValue();
            
            if (buffer.size() < 100) {
                log.info("Not enough experience for robot {}: {} samples", robotSerialNumber, buffer.size());
                continue;
            }
            
            // Group experiences by situation type
            Map<String, List<Experience>> experiencesByType = new HashMap<>();
            
            for (Experience exp : buffer.getExperiences()) {
                String situationType = determineSituationType(exp.getState());
                experiencesByType.computeIfAbsent(situationType, k -> new ArrayList<>()).add(exp);
            }
            
            // Train model for each situation type
            for (Map.Entry<String, List<Experience>> typeEntry : experiencesByType.entrySet()) {
                String situationType = typeEntry.getKey();
                List<Experience> experiences = typeEntry.getValue();
                
                if (experiences.size() < 50) {
                    continue;
                }
                
                try {
                    trainModelForType(robotSerialNumber, situationType, experiences);
                } catch (Exception e) {
                    log.error("Error training model for robot {} situation {}", robotSerialNumber, situationType, e);
                }
            }
        }
        
        // Save models
        saveModels();
    }
    
    /**
     * Train model for a specific robot and situation type
     * @param robotSerialNumber Robot serial number
     * @param situationType Situation type
     * @param experiences Experiences for training
     */
    private void trainModelForType(String robotSerialNumber, String situationType, List<Experience> experiences) {
        log.info("Training model for robot {} situation {} with {} samples", 
                robotSerialNumber, situationType, experiences.size());
        
        // Get or create policy model
        Map<String, PolicyModel> robotModels = policyModels.computeIfAbsent(
                robotSerialNumber, k -> new ConcurrentHashMap<>());
        
        PolicyModel model = robotModels.computeIfAbsent(
                situationType, k -> new PolicyModel(situationType));
        
        // Train the model
        model.train(experiences);
        
        log.info("Completed training for robot {} situation {}", robotSerialNumber, situationType);
    }
    
    /**
     * Save models to disk
     */
    private void saveModels() {
        // Save policy models
        for (Map.Entry<String, Map<String, PolicyModel>> robotEntry : policyModels.entrySet()) {
            String robotSerialNumber = robotEntry.getKey();
            Map<String, PolicyModel> robotModels = robotEntry.getValue();
            
            for (Map.Entry<String, PolicyModel> modelEntry : robotModels.entrySet()) {
                String situationType = modelEntry.getKey();
                PolicyModel model = modelEntry.getValue();
                
                String fileName = String.format("%s/%s_%s_policy.model", 
                        modelPath, robotSerialNumber, situationType);
                
                try (FileOutputStream fos = new FileOutputStream(fileName)) {
                    model.save(fos);
                    log.info("Saved policy model: {}", fileName);
                } catch (IOException e) {
                    log.error("Error saving policy model", e);
                }
            }
        }
        
        // Save Q-tables
        for (Map.Entry<String, Map<String, QTable>> robotEntry : qTables.entrySet()) {
            String robotSerialNumber = robotEntry.getKey();
            Map<String, QTable> robotTables = robotEntry.getValue();
            
            for (Map.Entry<String, QTable> tableEntry : robotTables.entrySet()) {
                String situationType = tableEntry.getKey();
                QTable qTable = tableEntry.getValue();
                
                String fileName = String.format("%s/%s_%s_qtable.dat", 
                        modelPath, robotSerialNumber, situationType);
                
                try (FileOutputStream fos = new FileOutputStream(fileName)) {
                    qTable.save(fos);
                    log.info("Saved Q-table: {}", fileName);
                } catch (IOException e) {
                    log.error("Error saving Q-table", e);
                }
            }
        }
    }
    
    /**
     * Load models from disk
     */
    private void loadModels() {
        File modelDir = new File(modelPath);
        if (!modelDir.exists() || !modelDir.isDirectory()) {
            log.info("Model directory not found: {}", modelPath);
            return;
        }
        
        // Load policy models
        File[] policyFiles = modelDir.listFiles((dir, name) -> name.endsWith("_policy.model"));
        if (policyFiles != null) {
            for (File file : policyFiles) {
                String fileName = file.getName();
                String[] parts = fileName.split("_");
                if (parts.length >= 2) {
                    String robotSerialNumber = parts[0];
                    String situationType = parts[1];
                    
                    try (FileInputStream fis = new FileInputStream(file)) {
                        PolicyModel model = new PolicyModel(situationType);
                        model.load(fis);
                        
                        Map<String, PolicyModel> robotModels = policyModels.computeIfAbsent(
                                robotSerialNumber, k -> new ConcurrentHashMap<>());
                        robotModels.put(situationType, model);
                        
                        log.info("Loaded policy model: {}", fileName);
                    } catch (IOException e) {
                        log.error("Error loading policy model", e);
                    }
                }
            }
        }
        
        // Load Q-tables
        File[] qTableFiles = modelDir.listFiles((dir, name) -> name.endsWith("_qtable.dat"));
        if (qTableFiles != null) {
            for (File file : qTableFiles) {
                String fileName = file.getName();
                String[] parts = fileName.split("_");
                if (parts.length >= 2) {
                    String robotSerialNumber = parts[0];
                    String situationType = parts[1];
                    
                    try (FileInputStream fis = new FileInputStream(file)) {
                        QTable qTable = new QTable();
                        qTable.load(fis);
                        
                        Map<String, QTable> robotTables = qTables.computeIfAbsent(
                                robotSerialNumber, k -> new ConcurrentHashMap<>());
                        robotTables.put(situationType, qTable);
                        
                        log.info("Loaded Q-table: {}", fileName);
                    } catch (IOException e) {
                        log.error("Error loading Q-table", e);
                    }
                }
            }
        }
    }
    
    /**
     * Inner class for Q-table
     */
    private static class QTable {
        // Map of state -> (action -> value)
        private final Map<String, Map<String, Double>> table = new HashMap<>();
        
        /**
         * Get Q-value for state-action pair
         * @param stateKey State key
         * @param actionKey Action key
         * @return Q-value or 0 if not found
         */
        public double getValue(String stateKey, String actionKey) {
            Map<String, Double> actions = table.get(stateKey);
            if (actions == null) {
                return 0.0;
            }
            return actions.getOrDefault(actionKey, 0.0);
        }
        
        /**
         * Set Q-value for state-action pair
         * @param stateKey State key
         * @param actionKey Action key
         * @param value Q-value
         */
        public void setValue(String stateKey, String actionKey, double value) {
            Map<String, Double> actions = table.computeIfAbsent(stateKey, k -> new HashMap<>());
            actions.put(actionKey, value);
        }
        
        /**
         * Get all actions and Q-values for a state
         * @param stateKey State key
         * @return Map of action keys to Q-values
         */
        public Map<String, Double> getActionsForState(String stateKey) {
            return table.getOrDefault(stateKey, Collections.emptyMap());
        }
        
        /**
         * Save Q-table to output stream
         * @param os Output stream
         * @throws IOException If an I/O error occurs
         */
        public void save(FileOutputStream os) throws IOException {
            // Simple serialization - in a real system would use a more efficient format
            for (Map.Entry<String, Map<String, Double>> stateEntry : table.entrySet()) {
                String stateKey = stateEntry.getKey();
                Map<String, Double> actions = stateEntry.getValue();
                
                for (Map.Entry<String, Double> actionEntry : actions.entrySet()) {
                    String actionKey = actionEntry.getKey();
                    double value = actionEntry.getValue();
                    
                    String line = String.format("%s\t%s\t%f\n", stateKey, actionKey, value);
                    os.write(line.getBytes());
                }
            }
        }
        
        /**
         * Load Q-table from input stream
         * @param is Input stream
         * @throws IOException If an I/O error occurs
         */
        public void load(FileInputStream is) throws IOException {
            // Clear existing table
            table.clear();
            
            Scanner scanner = new Scanner(is);
            while (scanner.hasNextLine()) {
                String line = scanner.nextLine();
                String[] parts = line.split("\t");
                if (parts.length >= 3) {
                    String stateKey = parts[0];
                    String actionKey = parts[1];
                    double value = Double.parseDouble(parts[2]);
                    
                    setValue(stateKey, actionKey, value);
                }
            }
        }
    }
    
    /**
     * Inner class for experience replay buffer
     */
    private static class ExperienceBuffer {
        private final int maxSize;
        private final Deque<Experience> buffer = new ArrayDeque<>();
        
        public ExperienceBuffer(int maxSize) {
            this.maxSize = maxSize;
        }
        
        /**
         * Add experience to buffer
         * @param experience Experience to add
         */
        public void add(Experience experience) {
            if (buffer.size() >= maxSize) {
                buffer.removeFirst();
            }
            buffer.addLast(experience);
        }
        
        /**
         * Get current size of buffer
         * @return Buffer size
         */
        public int size() {
            return buffer.size();
        }
        
        /**
         * Get all experiences
         * @return List of experiences
         */
        public List<Experience> getExperiences() {
            return new ArrayList<>(buffer);
        }
        
        /**
         * Sample a random batch of experiences
         * @param batchSize Batch size
         * @return List of experiences
         */
        public List<Experience> sample(int batchSize) {
            if (buffer.size() <= batchSize) {
                return new ArrayList<>(buffer);
            }
            
            List<Experience> allExperiences = new ArrayList<>(buffer);
            Collections.shuffle(allExperiences);
            return allExperiences.subList(0, batchSize);
        }
    }
    
    /**
     * Inner class for a single experience
     */
    private static class Experience {
        private final State state;
        private final Action action;
        private final State nextState;
        private final double reward;
        
        public Experience(State state, Action action, State nextState, double reward) {
            this.state = state;
            this.action = action;
            this.nextState = nextState;
            this.reward = reward;
        }
        
        public State getState() {
            return state;
        }
        
        public Action getAction() {
            return action;
        }
        
        public State getNextState() {
            return nextState;
        }
        
        public double getReward() {
            return reward;
        }
    }
    
    /**
     * Inner class for policy model
     */
    private static class PolicyModel {
        private final String situationType;
        
        // This would be a real ML model in a full implementation
        // For simplicity, we're using a placeholder
        
        public PolicyModel(String situationType) {
            this.situationType = situationType;
        }
        
        /**
         * Train the model
         * @param experiences Training experiences
         */
        public void train(List<Experience> experiences) {
            // In a real implementation, this would use a library like DL4J or a custom neural network
            log.info("Training policy model for situation {}", situationType);
        }
        
        /**
         * Predict best action for a state
         * @param state Current state
         * @return Recommended action
         */
        public Action predictBestAction(State state) {
            // In a real implementation, this would use the trained model to predict
            // For now, return a simple heuristic action based on situation type
            String robotSerialNumber = state.getSerialNumber();
            
            switch (situationType) {
                case "obstacle_avoidance":
                    // Find closest obstacle
                    if (state.getNearbyObstacles() != null && !state.getNearbyObstacles().isEmpty()) {
                        Map<String, Object> obstacle = state.getNearbyObstacles().get(0);
                        double obsX = Double.parseDouble(obstacle.get("x").toString());
                        double obsY = Double.parseDouble(obstacle.get("y").toString());
                        double obsZ = Double.parseDouble(obstacle.get("z").toString());
                        
                        return Action.createAvoidObstacleAction(robotSerialNumber, obsX, obsY, obsZ, "model", state);
                    }
                    break;
                    
                case "human_interaction":
                    // Slow down for humans
                    return Action.createAdjustSpeedAction(robotSerialNumber, 0.3, state);
                    
                case "low_battery":
                    // Head to charging station
                    return Action.builder()
                            .type(Action.ActionType.CHARGE)
                            .parameters(Collections.emptyMap())
                            .timestamp(System.currentTimeMillis())
                            .serialNumber(robotSerialNumber)
                            .previousState(state)
                            .build();
                    
                case "navigation":
                    // Continue at normal speed
                    return Action.createAdjustSpeedAction(robotSerialNumber, 0.7, state);
            }
            
            // Default action
            return Action.createStopAction(robotSerialNumber, state);
        }
        
        /**
         * Save model to output stream
         * @param os Output stream
         * @throws IOException If an I/O error occurs
         */
        public void save(FileOutputStream os) throws IOException {
            // In a real implementation, this would serialize the model
            os.write(situationType.getBytes());
        }
        
        /**
         * Load model from input stream
         * @param is Input stream
         * @throws IOException If an I/O error occurs
         */
        public void load(FileInputStream is) throws IOException {
            // In a real implementation, this would deserialize the model
        }
    }
}