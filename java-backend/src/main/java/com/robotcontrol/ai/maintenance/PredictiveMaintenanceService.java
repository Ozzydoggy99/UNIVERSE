package com.robotcontrol.ai.maintenance;

import com.robotcontrol.model.RobotPosition;
import com.robotcontrol.model.RobotSensorData;
import com.robotcontrol.model.RobotStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for predicting robot maintenance needs
 */
@Service
@Slf4j
public class PredictiveMaintenanceService {
    
    // Store maintenance history and predictions by robot serial number
    private final Map<String, List<MaintenanceEvent>> maintenanceHistory = new ConcurrentHashMap<>();
    private final Map<String, MaintenancePrediction> predictions = new ConcurrentHashMap<>();
    
    // Cache of recent status data by robot serial number
    private final Map<String, List<RobotStatus>> statusHistory = new ConcurrentHashMap<>();
    private final Map<String, List<RobotSensorData>> sensorHistory = new ConcurrentHashMap<>();
    private final Map<String, List<RobotPosition>> positionHistory = new ConcurrentHashMap<>();
    
    // Component failure models (component name -> predicted lifespan in hours)
    private final Map<String, Map<String, Double>> componentModels = new HashMap<>();
    
    // Anomaly detection thresholds by sensor and robot model
    private final Map<String, Map<String, Double>> anomalyThresholds = new HashMap<>();
    
    // Maximum history size
    private static final int MAX_HISTORY_SIZE = 1000;
    
    /**
     * Initialize the service
     */
    public void initialize() {
        log.info("Initializing Predictive Maintenance Service");
        
        // Initialize component models based on manufacturer data
        initializeComponentModels();
        
        // Initialize anomaly detection thresholds
        initializeAnomalyThresholds();
    }
    
    /**
     * Initialize component failure models
     * In a real implementation, this would load from a database or configuration
     */
    private void initializeComponentModels() {
        // Model: AxBot 1000
        Map<String, Double> axbot1000Components = new HashMap<>();
        axbot1000Components.put("wheels", 5000.0); // Hours
        axbot1000Components.put("battery", 2000.0);
        axbot1000Components.put("motors", 7000.0);
        axbot1000Components.put("sensors", 10000.0);
        axbot1000Components.put("arm_joints", 3000.0);
        componentModels.put("AxBot-1000", axbot1000Components);
        
        // Model: AxBot 2000
        Map<String, Double> axbot2000Components = new HashMap<>();
        axbot2000Components.put("wheels", 8000.0);
        axbot2000Components.put("battery", 4000.0);
        axbot2000Components.put("motors", 9000.0);
        axbot2000Components.put("sensors", 12000.0);
        axbot2000Components.put("arm_joints", 5000.0);
        axbot2000Components.put("navigation_system", 10000.0);
        componentModels.put("AxBot-2000", axbot2000Components);
    }
    
    /**
     * Initialize anomaly detection thresholds
     */
    private void initializeAnomalyThresholds() {
        // Model: AxBot 1000
        Map<String, Double> axbot1000Thresholds = new HashMap<>();
        axbot1000Thresholds.put("temperature", 75.0); // Celsius
        axbot1000Thresholds.put("motor_current", 8.5); // Amps
        axbot1000Thresholds.put("vibration", 2.5); // G-force
        axbot1000Thresholds.put("noise", 75.0); // dB
        anomalyThresholds.put("AxBot-1000", axbot1000Thresholds);
        
        // Model: AxBot 2000
        Map<String, Double> axbot2000Thresholds = new HashMap<>();
        axbot2000Thresholds.put("temperature", 80.0);
        axbot2000Thresholds.put("motor_current", 10.0);
        axbot2000Thresholds.put("vibration", 3.0);
        axbot2000Thresholds.put("noise", 80.0);
        anomalyThresholds.put("AxBot-2000", axbot2000Thresholds);
    }
    
    /**
     * Process new status data from a robot
     * @param serialNumber Robot serial number
     * @param status Current robot status
     */
    public void processStatusData(String serialNumber, RobotStatus status) {
        if (status == null) return;
        
        // Store in history
        List<RobotStatus> history = statusHistory.computeIfAbsent(
                serialNumber, k -> new ArrayList<>());
        
        history.add(status);
        
        // Limit history size
        if (history.size() > MAX_HISTORY_SIZE) {
            history.remove(0);
        }
    }
    
    /**
     * Process new sensor data from a robot
     * @param serialNumber Robot serial number
     * @param sensorData Current sensor data
     */
    public void processSensorData(String serialNumber, RobotSensorData sensorData) {
        if (sensorData == null) return;
        
        // Store in history
        List<RobotSensorData> history = sensorHistory.computeIfAbsent(
                serialNumber, k -> new ArrayList<>());
        
        history.add(sensorData);
        
        // Limit history size
        if (history.size() > MAX_HISTORY_SIZE) {
            history.remove(0);
        }
        
        // Check for anomalies
        checkForSensorAnomalies(serialNumber, sensorData);
    }
    
    /**
     * Process new position data from a robot
     * @param serialNumber Robot serial number
     * @param position Current position
     */
    public void processPositionData(String serialNumber, RobotPosition position) {
        if (position == null) return;
        
        // Store in history
        List<RobotPosition> history = positionHistory.computeIfAbsent(
                serialNumber, k -> new ArrayList<>());
        
        history.add(position);
        
        // Limit history size
        if (history.size() > MAX_HISTORY_SIZE) {
            history.remove(0);
        }
    }
    
    /**
     * Check for anomalies in sensor data
     * @param serialNumber Robot serial number
     * @param sensorData Sensor data to check
     */
    private void checkForSensorAnomalies(String serialNumber, RobotSensorData sensorData) {
        // Need robot model to get thresholds
        String model = getModelForRobot(serialNumber);
        if (model == null) return;
        
        Map<String, Double> thresholds = anomalyThresholds.get(model);
        if (thresholds == null) return;
        
        // Check temperature
        if (sensorData.getTemperature() > thresholds.getOrDefault("temperature", 100.0)) {
            logAnomalyEvent(serialNumber, "temperature", sensorData.getTemperature(), 
                    thresholds.getOrDefault("temperature", 100.0));
        }
        
        // Check other sensors from additionalSensors map
        Map<String, Object> additionalSensors = sensorData.getAdditionalSensors();
        if (additionalSensors != null) {
            // Check motor current
            if (additionalSensors.containsKey("motor_current")) {
                double motorCurrent = Double.parseDouble(additionalSensors.get("motor_current").toString());
                if (motorCurrent > thresholds.getOrDefault("motor_current", 10.0)) {
                    logAnomalyEvent(serialNumber, "motor_current", motorCurrent,
                            thresholds.getOrDefault("motor_current", 10.0));
                }
            }
            
            // Check vibration
            if (additionalSensors.containsKey("vibration")) {
                double vibration = Double.parseDouble(additionalSensors.get("vibration").toString());
                if (vibration > thresholds.getOrDefault("vibration", 3.0)) {
                    logAnomalyEvent(serialNumber, "vibration", vibration,
                            thresholds.getOrDefault("vibration", 3.0));
                }
            }
        }
        
        // Check noise level
        if (sensorData.getNoiseLevel() > thresholds.getOrDefault("noise", 80.0)) {
            logAnomalyEvent(serialNumber, "noise", sensorData.getNoiseLevel(),
                    thresholds.getOrDefault("noise", 80.0));
        }
    }
    
    /**
     * Log an anomaly event
     */
    private void logAnomalyEvent(String serialNumber, String sensor, double value, double threshold) {
        log.warn("Anomaly detected for robot {}: {} value of {} exceeds threshold {}", 
                serialNumber, sensor, value, threshold);
        
        // Create maintenance event for this anomaly
        MaintenanceEvent event = MaintenanceEvent.builder()
                .serialNumber(serialNumber)
                .timestamp(LocalDateTime.now())
                .eventType(MaintenanceEvent.EventType.ANOMALY)
                .description("Anomaly detected: " + sensor + " value of " + value + " exceeds threshold " + threshold)
                .affectedComponent(mapSensorToComponent(sensor))
                .severity(MaintenanceEvent.Severity.WARNING)
                .build();
        
        // Add to history
        addMaintenanceEvent(event);
        
        // Update prediction
        updateMaintenancePrediction(serialNumber);
    }
    
    /**
     * Map sensor type to component
     */
    private String mapSensorToComponent(String sensor) {
        switch (sensor) {
            case "temperature":
                return "motors";
            case "motor_current":
                return "motors";
            case "vibration":
                return "wheels";
            case "noise":
                return "motors";
            default:
                return "unknown";
        }
    }
    
    /**
     * Get model for a robot
     */
    private String getModelForRobot(String serialNumber) {
        // Get from status history if available
        List<RobotStatus> history = statusHistory.get(serialNumber);
        if (history != null && !history.isEmpty()) {
            return history.get(history.size() - 1).getModel();
        }
        
        // Default to basic model if not found
        return "AxBot-1000";
    }
    
    /**
     * Add a maintenance event
     * @param event Maintenance event
     */
    public void addMaintenanceEvent(MaintenanceEvent event) {
        String serialNumber = event.getSerialNumber();
        maintenanceHistory.computeIfAbsent(serialNumber, k -> new ArrayList<>()).add(event);
        
        // Limit history size
        List<MaintenanceEvent> history = maintenanceHistory.get(serialNumber);
        if (history.size() > 100) {
            history.subList(0, history.size() - 100).clear();
        }
    }
    
    /**
     * Register completed maintenance
     * @param serialNumber Robot serial number
     * @param components List of components that were serviced
     * @param notes Maintenance notes
     */
    public void registerMaintenance(String serialNumber, List<String> components, String notes) {
        MaintenanceEvent event = MaintenanceEvent.builder()
                .serialNumber(serialNumber)
                .timestamp(LocalDateTime.now())
                .eventType(MaintenanceEvent.EventType.MAINTENANCE)
                .description("Scheduled maintenance completed: " + String.join(", ", components))
                .affectedComponent(String.join(",", components))
                .severity(MaintenanceEvent.Severity.INFORMATION)
                .notes(notes)
                .build();
        
        addMaintenanceEvent(event);
        
        // Reset component wear for maintained components
        resetComponentWear(serialNumber, components);
        
        // Update prediction
        updateMaintenancePrediction(serialNumber);
    }
    
    /**
     * Reset component wear after maintenance
     */
    private void resetComponentWear(String serialNumber, List<String> components) {
        // This would reset the wear counters or models for specific components
        // In a real implementation, this would update a database or component wear model
        log.info("Reset wear counters for robot {} components: {}", 
                serialNumber, String.join(", ", components));
    }
    
    /**
     * Schedule maintenance analysis to run periodically
     */
    @Scheduled(cron = "0 0 * * * *") // Run once every hour
    public void scheduledMaintenanceAnalysis() {
        log.info("Running scheduled maintenance analysis");
        
        // Get all robots with history
        Set<String> allRobots = new HashSet<>();
        allRobots.addAll(statusHistory.keySet());
        allRobots.addAll(sensorHistory.keySet());
        allRobots.addAll(positionHistory.keySet());
        
        // Update predictions for all robots
        for (String serialNumber : allRobots) {
            try {
                updateMaintenancePrediction(serialNumber);
            } catch (Exception e) {
                log.error("Error updating maintenance prediction for robot {}", serialNumber, e);
            }
        }
    }
    
    /**
     * Update maintenance prediction for a robot
     * @param serialNumber Robot serial number
     */
    public void updateMaintenancePrediction(String serialNumber) {
        String model = getModelForRobot(serialNumber);
        if (model == null) return;
        
        // Get component models for this robot model
        Map<String, Double> components = componentModels.get(model);
        if (components == null) return;
        
        // Calculate component wear
        Map<String, MaintenancePrediction.ComponentStatus> componentStatus = new HashMap<>();
        List<MaintenancePrediction.MaintenanceFactor> factors = new ArrayList<>();
        
        // Calculate wear for each component
        for (Map.Entry<String, Double> entry : components.entrySet()) {
            String component = entry.getKey();
            double expectedLife = entry.getValue();
            
            // Calculate wear percentage and remaining life
            double wearPercentage = calculateComponentWear(serialNumber, component);
            double remainingLifeHours = expectedLife * (1 - wearPercentage / 100.0);
            
            // Determine status based on wear
            String status;
            String action;
            if (wearPercentage < 50) {
                status = "good";
                action = "No action needed";
            } else if (wearPercentage < 75) {
                status = "fair";
                action = "Monitor during next inspection";
            } else if (wearPercentage < 90) {
                status = "poor";
                action = "Plan for replacement soon";
            } else {
                status = "critical";
                action = "Replace immediately";
            }
            
            // Create component status
            componentStatus.put(component, MaintenancePrediction.ComponentStatus.builder()
                    .name(component)
                    .status(status)
                    .wearPercentage(wearPercentage)
                    .remainingLifeHours(remainingLifeHours)
                    .recommendedAction(action)
                    .build());
            
            // Add as factor if significant wear
            if (wearPercentage > 50) {
                factors.add(MaintenancePrediction.MaintenanceFactor.builder()
                        .factorName(component + " wear")
                        .description(component + " component wear level")
                        .contribution(wearPercentage / 100.0)
                        .currentValue(wearPercentage)
                        .threshold(90.0)
                        .trend(getComponentWearTrend(serialNumber, component))
                        .build());
            }
        }
        
        // Add anomaly events as factors
        addAnomalyFactors(serialNumber, factors);
        
        // Calculate overall failure probability
        double failureProbability = calculateFailureProbability(componentStatus, factors);
        
        // Determine urgency based on probability
        MaintenancePrediction.MaintenanceUrgency urgency;
        LocalDateTime recommendedDate;
        
        if (failureProbability > 0.8) {
            urgency = MaintenancePrediction.MaintenanceUrgency.CRITICAL;
            recommendedDate = LocalDateTime.now().plusDays(3);
        } else if (failureProbability > 0.6) {
            urgency = MaintenancePrediction.MaintenanceUrgency.HIGH;
            recommendedDate = LocalDateTime.now().plusDays(10);
        } else if (failureProbability > 0.4) {
            urgency = MaintenancePrediction.MaintenanceUrgency.MEDIUM;
            recommendedDate = LocalDateTime.now().plusDays(20);
        } else {
            urgency = MaintenancePrediction.MaintenanceUrgency.LOW;
            recommendedDate = LocalDateTime.now().plusDays(45);
        }
        
        // Calculate estimated time to maintenance
        double estimatedHours = calculateEstimatedTimeToMaintenance(componentStatus);
        
        // Generate recommended actions
        List<String> recommendedActions = generateRecommendedActions(componentStatus, factors);
        
        // Create prediction
        MaintenancePrediction prediction = MaintenancePrediction.builder()
                .serialNumber(serialNumber)
                .model(model)
                .predictionTimestamp(LocalDateTime.now())
                .urgency(urgency)
                .recommendedMaintenanceDate(recommendedDate)
                .componentStatus(componentStatus)
                .failureProbability(failureProbability)
                .estimatedTimeToMaintenance(estimatedHours)
                .predictionConfidence(calculatePredictionConfidence(serialNumber))
                .maintenanceFactors(factors)
                .recommendedActions(recommendedActions)
                .build();
        
        // Store prediction
        predictions.put(serialNumber, prediction);
        
        // Log if high urgency
        if (urgency == MaintenancePrediction.MaintenanceUrgency.HIGH || 
                urgency == MaintenancePrediction.MaintenanceUrgency.CRITICAL) {
            log.warn("High urgency maintenance needed for robot {}: failure probability {}, recommended by {}", 
                    serialNumber, String.format("%.2f", failureProbability), recommendedDate);
        }
    }
    
    /**
     * Calculate component wear percentage
     */
    private double calculateComponentWear(String serialNumber, String component) {
        // In a real implementation, this would be based on:
        // 1. Hours of operation since last maintenance
        // 2. Operational conditions (load, environment)
        // 3. Anomaly events
        // 4. Component-specific wear models
        
        // Simplified implementation based on operational hours and anomalies
        double baseWear = calculateOperationalHoursWear(serialNumber, component);
        double anomalyFactor = calculateAnomalyFactor(serialNumber, component);
        
        return Math.min(100, baseWear * anomalyFactor);
    }
    
    /**
     * Calculate wear based on operational hours
     */
    private double calculateOperationalHoursWear(String serialNumber, String component) {
        // Get last maintenance for this component
        LocalDateTime lastMaintenance = getLastMaintenanceTime(serialNumber, component);
        
        // Calculate hours since last maintenance
        long hoursSinceLastMaintenance;
        if (lastMaintenance != null) {
            hoursSinceLastMaintenance = ChronoUnit.HOURS.between(lastMaintenance, LocalDateTime.now());
        } else {
            // If no maintenance record, assume 500 hours of operation
            hoursSinceLastMaintenance = 500;
        }
        
        // Get expected lifespan for this component and model
        String model = getModelForRobot(serialNumber);
        double expectedLife = componentModels
                .getOrDefault(model, Collections.emptyMap())
                .getOrDefault(component, 5000.0);
        
        // Calculate wear percentage
        return (hoursSinceLastMaintenance / expectedLife) * 100;
    }
    
    /**
     * Calculate factor to multiply wear by based on anomalies
     */
    private double calculateAnomalyFactor(String serialNumber, String component) {
        // Count recent anomalies for this component
        List<MaintenanceEvent> events = maintenanceHistory.getOrDefault(serialNumber, Collections.emptyList());
        long anomalyCount = events.stream()
                .filter(e -> e.getEventType() == MaintenanceEvent.EventType.ANOMALY)
                .filter(e -> e.getAffectedComponent().equals(component))
                .filter(e -> e.getTimestamp().isAfter(LocalDateTime.now().minusDays(7)))
                .count();
        
        // Each anomaly increases wear by 10%
        return 1.0 + (anomalyCount * 0.1);
    }
    
    /**
     * Get trend in component wear
     */
    private String getComponentWearTrend(String serialNumber, String component) {
        // This would compare recent wear to older wear measurements
        // Simplified implementation
        Random random = new Random(serialNumber.hashCode() + component.hashCode());
        int trend = random.nextInt(3);
        
        switch (trend) {
            case 0: return "improving";
            case 1: return "stable";
            default: return "worsening";
        }
    }
    
    /**
     * Add anomaly factors to the list
     */
    private void addAnomalyFactors(String serialNumber, List<MaintenancePrediction.MaintenanceFactor> factors) {
        // Get recent anomalies
        List<MaintenanceEvent> events = maintenanceHistory.getOrDefault(serialNumber, Collections.emptyList());
        Map<String, Integer> anomalyCounts = new HashMap<>();
        
        for (MaintenanceEvent event : events) {
            if (event.getEventType() == MaintenanceEvent.EventType.ANOMALY && 
                    event.getTimestamp().isAfter(LocalDateTime.now().minusDays(14))) {
                
                String sensor = event.getDescription().contains("temperature") ? "temperature" :
                               event.getDescription().contains("motor_current") ? "motor_current" :
                               event.getDescription().contains("vibration") ? "vibration" :
                               event.getDescription().contains("noise") ? "noise" : "other";
                
                anomalyCounts.put(sensor, anomalyCounts.getOrDefault(sensor, 0) + 1);
            }
        }
        
        // Add factors for anomalies
        for (Map.Entry<String, Integer> entry : anomalyCounts.entrySet()) {
            String sensor = entry.getKey();
            int count = entry.getValue();
            
            if (count > 0) {
                factors.add(MaintenancePrediction.MaintenanceFactor.builder()
                        .factorName(sensor + " anomalies")
                        .description(count + " " + sensor + " anomalies detected in last 14 days")
                        .contribution(Math.min(0.8, count * 0.1))
                        .currentValue(count)
                        .threshold(3)
                        .trend(count > 3 ? "worsening" : "stable")
                        .build());
            }
        }
    }
    
    /**
     * Calculate overall failure probability
     */
    private double calculateFailureProbability(
            Map<String, MaintenancePrediction.ComponentStatus> componentStatus,
            List<MaintenancePrediction.MaintenanceFactor> factors) {
        
        // Start with base probability
        double baseProbability = 0.1;
        
        // Add component contributions
        for (MaintenancePrediction.ComponentStatus status : componentStatus.values()) {
            // Higher wear gives higher probability
            baseProbability += (status.getWearPercentage() / 100.0) * 0.3;
        }
        
        // Add factor contributions
        for (MaintenancePrediction.MaintenanceFactor factor : factors) {
            baseProbability += factor.getContribution() * 0.5;
        }
        
        // Ensure result is between 0 and 1
        return Math.min(1.0, Math.max(0.0, baseProbability));
    }
    
    /**
     * Calculate estimated time to maintenance need
     */
    private double calculateEstimatedTimeToMaintenance(
            Map<String, MaintenancePrediction.ComponentStatus> componentStatus) {
        
        // Find component with lowest remaining life
        double lowestRemainingLife = Double.MAX_VALUE;
        
        for (MaintenancePrediction.ComponentStatus status : componentStatus.values()) {
            if (status.getRemainingLifeHours() < lowestRemainingLife) {
                lowestRemainingLife = status.getRemainingLifeHours();
            }
        }
        
        return lowestRemainingLife == Double.MAX_VALUE ? 1000 : lowestRemainingLife;
    }
    
    /**
     * Calculate confidence in prediction
     */
    private double calculatePredictionConfidence(String serialNumber) {
        // Confidence increases with more data
        List<RobotStatus> status = statusHistory.getOrDefault(serialNumber, Collections.emptyList());
        List<RobotSensorData> sensors = sensorHistory.getOrDefault(serialNumber, Collections.emptyList());
        List<MaintenanceEvent> events = maintenanceHistory.getOrDefault(serialNumber, Collections.emptyList());
        
        double dataPoints = status.size() + sensors.size() + events.size();
        
        // Scale to 0.5-0.95 range
        return 0.5 + Math.min(0.45, dataPoints / 1000.0 * 0.45);
    }
    
    /**
     * Generate recommended maintenance actions
     */
    private List<String> generateRecommendedActions(
            Map<String, MaintenancePrediction.ComponentStatus> componentStatus,
            List<MaintenancePrediction.MaintenanceFactor> factors) {
        
        List<String> actions = new ArrayList<>();
        
        // Add component-specific actions
        for (Map.Entry<String, MaintenancePrediction.ComponentStatus> entry : componentStatus.entrySet()) {
            String component = entry.getKey();
            MaintenancePrediction.ComponentStatus status = entry.getValue();
            
            if (status.getStatus().equals("critical")) {
                actions.add("Replace " + component + " immediately");
            } else if (status.getStatus().equals("poor")) {
                actions.add("Plan for " + component + " replacement at next maintenance");
            } else if (status.getStatus().equals("fair")) {
                actions.add("Inspect " + component + " at next maintenance");
            }
        }
        
        // Add factor-based actions
        for (MaintenancePrediction.MaintenanceFactor factor : factors) {
            if (factor.getFactorName().contains("anomalies") && factor.getCurrentValue() > 3) {
                actions.add("Investigate repeated " + factor.getFactorName() + " - possible system fault");
            }
        }
        
        // Add general recommendations
        if (actions.isEmpty()) {
            actions.add("Perform regular maintenance as scheduled");
        }
        
        return actions;
    }
    
    /**
     * Get last maintenance time for a component
     */
    private LocalDateTime getLastMaintenanceTime(String serialNumber, String component) {
        List<MaintenanceEvent> events = maintenanceHistory.getOrDefault(serialNumber, Collections.emptyList());
        
        // Find most recent maintenance event for this component
        return events.stream()
                .filter(e -> e.getEventType() == MaintenanceEvent.EventType.MAINTENANCE)
                .filter(e -> e.getAffectedComponent().contains(component))
                .map(MaintenanceEvent::getTimestamp)
                .max(LocalDateTime::compareTo)
                .orElse(null);
    }
    
    /**
     * Get current maintenance prediction for a robot
     * @param serialNumber Robot serial number
     * @return Maintenance prediction or null if not available
     */
    public MaintenancePrediction getMaintenancePrediction(String serialNumber) {
        return predictions.get(serialNumber);
    }
    
    /**
     * Get maintenance history for a robot
     * @param serialNumber Robot serial number
     * @param limit Maximum number of events to return
     * @return Recent maintenance events
     */
    public List<MaintenanceEvent> getMaintenanceHistory(String serialNumber, int limit) {
        List<MaintenanceEvent> history = maintenanceHistory.getOrDefault(serialNumber, Collections.emptyList());
        
        // Sort by timestamp (newest first)
        List<MaintenanceEvent> sorted = new ArrayList<>(history);
        sorted.sort((e1, e2) -> e2.getTimestamp().compareTo(e1.getTimestamp()));
        
        // Return up to limit entries
        return sorted.subList(0, Math.min(limit, sorted.size()));
    }
}