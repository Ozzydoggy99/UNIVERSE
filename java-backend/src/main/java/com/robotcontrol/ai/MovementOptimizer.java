package com.robotcontrol.ai;

import com.robotcontrol.model.RobotPosition;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Component for analyzing and optimizing robot movement
 */
@Component
@Slf4j
public class MovementOptimizer {
    
    // Statistics for optimal path calculations
    private final Map<String, Map<String, Double>> robotPerformanceBaselines = new HashMap<>();
    
    /**
     * Initialize the movement optimizer
     */
    public void initialize() {
        log.info("Initializing Movement Optimizer");
    }
    
    /**
     * Analyze robot movement based on position history
     * @param positions Recent position history
     * @return Movement analysis
     */
    public MovementAnalysis analyzeMovement(List<RobotPosition> positions) {
        if (positions.isEmpty()) {
            log.warn("No positions to analyze");
            return MovementAnalysis.builder()
                    .efficiencyScore(1.0)
                    .averageSpeed(0)
                    .idleTimePercentage(0)
                    .pathDeviations(0)
                    .averageObstacleDistance(0)
                    .suboptimalPathDetected(false)
                    .distanceTraveled(0)
                    .problemSegments(List.of())
                    .recommendations(List.of())
                    .build();
        }
        
        // Sort positions by timestamp
        positions.sort(Comparator.comparing(RobotPosition::getTimestamp));
        
        // Calculate metrics
        double totalDistance = calculateTotalDistance(positions);
        double averageSpeed = calculateAverageSpeed(positions);
        double idleTime = calculateIdleTime(positions);
        int pathChanges = detectPathChanges(positions);
        List<Map<String, Object>> problemSegments = identifyProblemSegments(positions);
        
        // Check if path was optimal
        boolean suboptimalPath = isPathSuboptimal(positions, totalDistance);
        
        // Generate recommendations
        List<String> recommendations = generateRecommendations(
                averageSpeed, idleTime, pathChanges, suboptimalPath, problemSegments);
        
        // Calculate overall efficiency score (0.0 to 1.0)
        double efficiencyScore = calculateEfficiencyScore(
                averageSpeed, idleTime, pathChanges, suboptimalPath, problemSegments);
        
        // Create and return the analysis
        return MovementAnalysis.builder()
                .efficiencyScore(efficiencyScore)
                .averageSpeed(averageSpeed)
                .idleTimePercentage(idleTime)
                .pathDeviations(pathChanges)
                .averageObstacleDistance(10.0) // Placeholder, would come from sensor data
                .suboptimalPathDetected(suboptimalPath)
                .distanceTraveled(totalDistance)
                .problemSegments(problemSegments)
                .recommendations(recommendations)
                .build();
    }
    
    /**
     * Generate optimized movement parameters based on analysis
     * @param analysis Movement analysis
     * @return Optimized parameters
     */
    public Map<String, Object> generateOptimizedParameters(MovementAnalysis analysis) {
        Map<String, Object> params = new HashMap<>();
        
        // Set optimal speed
        if (analysis.getAverageSpeed() < 0.5) {
            // Robot is moving too slowly
            params.put("speed", Math.min(analysis.getAverageSpeed() * 1.2, 1.0));
        } else if (analysis.getPathDeviations() > 5) {
            // Too many path changes, reduce speed for better control
            params.put("speed", Math.max(analysis.getAverageSpeed() * 0.9, 0.5));
        } else {
            // Normal operation, use baseline speed
            params.put("speed", 0.8);
        }
        
        // Set acceleration based on path characteristics
        if (analysis.isSuboptimalPathDetected()) {
            // More gradual acceleration for better path following
            params.put("acceleration", 0.6);
        } else {
            // Normal acceleration
            params.put("acceleration", 0.8);
        }
        
        // Set turning parameters
        params.put("turnSpeedFactor", 0.7);
        
        // Distance to maintain from obstacles
        params.put("obstacleMargin", 0.5);
        
        // Path smoothing factor
        if (analysis.getPathDeviations() > 3) {
            // More path smoothing
            params.put("pathSmoothingFactor", 0.8);
        } else {
            // Default smoothing
            params.put("pathSmoothingFactor", 0.5);
        }
        
        // Add timestamp for reference
        params.put("generatedAt", LocalDateTime.now().toString());
        
        return params;
    }
    
    /**
     * Calculate total distance traveled
     * @param positions Position history
     * @return Total distance in meters
     */
    private double calculateTotalDistance(List<RobotPosition> positions) {
        double distance = 0;
        RobotPosition previous = null;
        
        for (RobotPosition current : positions) {
            if (previous != null) {
                distance += calculateDistanceBetweenPositions(previous, current);
            }
            previous = current;
        }
        
        return distance;
    }
    
    /**
     * Calculate average movement speed
     * @param positions Position history
     * @return Average speed in meters per second
     */
    private double calculateAverageSpeed(List<RobotPosition> positions) {
        if (positions.size() < 2) {
            return 0;
        }
        
        double totalDistance = calculateTotalDistance(positions);
        
        // Calculate duration between first and last position
        LocalDateTime start = positions.get(0).getTimestamp();
        LocalDateTime end = positions.get(positions.size() - 1).getTimestamp();
        long durationSeconds = Duration.between(start, end).getSeconds();
        
        // Avoid division by zero
        if (durationSeconds == 0) {
            return 0;
        }
        
        return totalDistance / durationSeconds;
    }
    
    /**
     * Calculate percentage of time robot was idle (not moving)
     * @param positions Position history
     * @return Idle time percentage
     */
    private double calculateIdleTime(List<RobotPosition> positions) {
        if (positions.size() < 2) {
            return 0;
        }
        
        long totalTimeSeconds = Duration.between(
                positions.get(0).getTimestamp(),
                positions.get(positions.size() - 1).getTimestamp()
        ).getSeconds();
        
        if (totalTimeSeconds == 0) {
            return 0;
        }
        
        long idleTimeSeconds = 0;
        RobotPosition previous = null;
        
        for (RobotPosition current : positions) {
            if (previous != null) {
                double distance = calculateDistanceBetweenPositions(previous, current);
                Duration duration = Duration.between(previous.getTimestamp(), current.getTimestamp());
                
                // If moving less than 0.05 meters per second, consider idle
                double speed = distance / Math.max(duration.getSeconds(), 1);
                if (speed < 0.05) {
                    idleTimeSeconds += duration.getSeconds();
                }
            }
            previous = current;
        }
        
        return (double) idleTimeSeconds / totalTimeSeconds * 100;
    }
    
    /**
     * Detect significant changes in movement direction
     * @param positions Position history
     * @return Number of significant direction changes
     */
    private int detectPathChanges(List<RobotPosition> positions) {
        if (positions.size() < 3) {
            return 0;
        }
        
        int changes = 0;
        RobotPosition p1 = null;
        RobotPosition p2 = null;
        
        for (RobotPosition p3 : positions) {
            if (p1 != null && p2 != null) {
                // Calculate vectors between points
                double[] v1 = {p2.getX() - p1.getX(), p2.getY() - p1.getY()};
                double[] v2 = {p3.getX() - p2.getX(), p3.getY() - p2.getY()};
                
                // Normalize vectors
                double len1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
                double len2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
                
                if (len1 > 0.1 && len2 > 0.1) { // Only consider significant movements
                    v1[0] /= len1;
                    v1[1] /= len1;
                    v2[0] /= len2;
                    v2[1] /= len2;
                    
                    // Calculate dot product to find angle
                    double dotProduct = v1[0] * v2[0] + v1[1] * v2[1];
                    double angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
                    
                    // Consider angles > 30 degrees as significant direction changes
                    if (angle > Math.PI / 6) {
                        changes++;
                    }
                }
            }
            
            p1 = p2;
            p2 = p3;
        }
        
        return changes;
    }
    
    /**
     * Identify segments of the path that have efficiency problems
     * @param positions Position history
     * @return List of problem segments
     */
    private List<Map<String, Object>> identifyProblemSegments(List<RobotPosition> positions) {
        if (positions.size() < 5) {
            return Collections.emptyList();
        }
        
        List<Map<String, Object>> problemSegments = new ArrayList<>();
        
        // Divide positions into segments of 5 positions
        for (int i = 0; i < positions.size() - 5; i += 5) {
            List<RobotPosition> segment = positions.subList(i, i + 5);
            
            // Check for problems in this segment
            double segmentDistance = calculateTotalDistance(segment);
            double directDistance = calculateDistanceBetweenPositions(
                    segment.get(0), segment.get(segment.size() - 1));
            
            // If actual path is much longer than direct path, flag as problem
            if (segmentDistance > directDistance * 1.5 && directDistance > 1.0) {
                Map<String, Object> problem = new HashMap<>();
                problem.put("startIndex", i);
                problem.put("endIndex", i + 5);
                problem.put("startPosition", Map.of(
                        "x", segment.get(0).getX(),
                        "y", segment.get(0).getY(),
                        "z", segment.get(0).getZ()));
                problem.put("endPosition", Map.of(
                        "x", segment.get(segment.size() - 1).getX(),
                        "y", segment.get(segment.size() - 1).getY(),
                        "z", segment.get(segment.size() - 1).getZ()));
                problem.put("actualDistance", segmentDistance);
                problem.put("directDistance", directDistance);
                problem.put("efficiency", directDistance / segmentDistance);
                problem.put("timestamp", segment.get(0).getTimestamp().toString());
                
                problemSegments.add(problem);
            }
        }
        
        return problemSegments;
    }
    
    /**
     * Determine if the path taken was suboptimal
     * @param positions Position history
     * @param totalDistance Total distance traveled
     * @return True if path was suboptimal
     */
    private boolean isPathSuboptimal(List<RobotPosition> positions, double totalDistance) {
        if (positions.size() < 2) {
            return false;
        }
        
        // Calculate straight-line distance between start and end
        double directDistance = calculateDistanceBetweenPositions(
                positions.get(0), positions.get(positions.size() - 1));
        
        // If total distance is significantly larger than direct distance,
        // consider the path suboptimal (allowing for some necessary deviation)
        return totalDistance > directDistance * 1.4 && directDistance > 2.0;
    }
    
    /**
     * Generate recommendations based on analysis
     */
    private List<String> generateRecommendations(
            double averageSpeed, double idleTime, int pathChanges,
            boolean suboptimalPath, List<Map<String, Object>> problemSegments) {
        
        List<String> recommendations = new ArrayList<>();
        
        if (averageSpeed < 0.5) {
            recommendations.add("Increase default movement speed");
        }
        
        if (idleTime > 20) {
            recommendations.add("Reduce idle time during navigation");
        }
        
        if (pathChanges > 5) {
            recommendations.add("Smooth path planning to reduce unnecessary direction changes");
        }
        
        if (suboptimalPath) {
            recommendations.add("Improve path planning to find more direct routes");
        }
        
        if (!problemSegments.isEmpty()) {
            recommendations.add("Review and optimize navigation in problem areas");
        }
        
        return recommendations;
    }
    
    /**
     * Calculate an overall efficiency score
     */
    private double calculateEfficiencyScore(
            double averageSpeed, double idleTime, int pathChanges,
            boolean suboptimalPath, List<Map<String, Object>> problemSegments) {
        
        // Start with perfect score
        double score = 1.0;
        
        // Penalize for low speed (if robot is capable of moving faster)
        if (averageSpeed < 0.7) {
            score -= (0.7 - averageSpeed) * 0.3;
        }
        
        // Penalize for excessive idle time
        score -= Math.min(idleTime / 100, 0.3);
        
        // Penalize for excessive path changes
        score -= Math.min(pathChanges * 0.02, 0.2);
        
        // Penalize for suboptimal path
        if (suboptimalPath) {
            score -= 0.2;
        }
        
        // Penalize for problem segments
        score -= Math.min(problemSegments.size() * 0.05, 0.2);
        
        // Ensure score stays between 0 and 1
        return Math.max(0, Math.min(1, score));
    }
    
    /**
     * Calculate distance between two positions
     * @param p1 First position
     * @param p2 Second position
     * @return Distance in meters
     */
    private double calculateDistanceBetweenPositions(RobotPosition p1, RobotPosition p2) {
        return Math.sqrt(
                Math.pow(p2.getX() - p1.getX(), 2) +
                Math.pow(p2.getY() - p1.getY(), 2) +
                Math.pow(p2.getZ() - p1.getZ(), 2)
        );
    }
}