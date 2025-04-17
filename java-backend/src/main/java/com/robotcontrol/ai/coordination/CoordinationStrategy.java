package com.robotcontrol.ai.coordination;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Class to represent a coordination strategy for multi-robot coordination
 */
@Data
@Builder
public class CoordinationStrategy {
    
    public enum StrategyType {
        LEADER_FOLLOWER,    // One robot leads, others follow
        DISTRIBUTED,         // Distributed coordination
        MARKET_BASED,        // Market-based task allocation
        CONSENSUS,           // Consensus-based decision making
        HIERARCHICAL,        // Hierarchical coordination
        SWARM                // Swarm-based coordination
    }
    
    // Strategy identification
    private String id;
    private String name;
    private StrategyType type;
    
    // Parameters
    private Map<String, Object> parameters;
    
    // Applicability criteria
    private int minRobots;
    private int maxRobots;
    private List<String> requiredCapabilities;
    private List<Task.TaskType> applicableTaskTypes;
    
    // Decision functions
    private String taskAllocationFunction;
    private String conflictResolutionFunction;
    private String communicationProtocol;
    
    // Performance metrics
    private double efficiencyRating;
    private double robustnessRating;
    private double communicationOverhead;
    
    /**
     * Check if strategy is applicable to a specific coordination scenario
     * @param task Primary task
     * @param robots Available robots
     * @return True if applicable
     */
    public boolean isApplicable(Task task, List<Robot> robots) {
        // Check number of robots
        if (robots.size() < minRobots || (maxRobots > 0 && robots.size() > maxRobots)) {
            return false;
        }
        
        // Check if task type is supported
        if (applicableTaskTypes != null && !applicableTaskTypes.contains(task.getType())) {
            return false;
        }
        
        // Check if robots have required capabilities
        if (requiredCapabilities != null && !requiredCapabilities.isEmpty()) {
            for (String capability : requiredCapabilities) {
                boolean anyRobotHasCapability = false;
                for (Robot robot : robots) {
                    if (robot.hasCapability(capability)) {
                        anyRobotHasCapability = true;
                        break;
                    }
                }
                
                if (!anyRobotHasCapability) {
                    return false; // No robot has this required capability
                }
            }
        }
        
        return true;
    }
    
    /**
     * Calculate a suitability score for this strategy for a specific coordination scenario
     * @param task Primary task
     * @param robots Available robots
     * @return Suitability score (0-100, higher is better)
     */
    public double calculateSuitabilityScore(Task task, List<Robot> robots) {
        if (!isApplicable(task, robots)) {
            return 0;
        }
        
        double score = 50; // Start with a neutral score
        
        // Adjust based on number of robots (prefer strategies optimized for the current number)
        double optimalRobots = (minRobots + (maxRobots > 0 ? maxRobots : minRobots * 2)) / 2.0;
        double robotCountFactor = 1.0 - (Math.abs(robots.size() - optimalRobots) / optimalRobots);
        score += 10 * Math.max(0, robotCountFactor);
        
        // Adjust based on task type suitability
        switch (task.getType()) {
            case TRANSPORT:
            case ESCORTING:
                // These benefit from leader-follower or hierarchical
                if (type == StrategyType.LEADER_FOLLOWER || type == StrategyType.HIERARCHICAL) {
                    score += 15;
                }
                break;
                
            case CLEANING:
            case SURVEILLANCE:
                // These benefit from distributed or swarm approaches
                if (type == StrategyType.DISTRIBUTED || type == StrategyType.SWARM) {
                    score += 15;
                }
                break;
                
            case PICKUP:
            case DELIVERY:
                // These benefit from market-based approaches
                if (type == StrategyType.MARKET_BASED) {
                    score += 15;
                }
                break;
        }
        
        // Adjust based on performance metrics
        score += 10 * efficiencyRating;
        score += 10 * robustnessRating;
        score -= 5 * communicationOverhead;
        
        // Cap score at 100
        return Math.min(100, Math.max(0, score));
    }
    
    /**
     * Get robot role in this coordination strategy
     * @param robotId Robot ID
     * @param group Coordination group
     * @return Role description
     */
    public String getRobotRole(String robotId, CoordinationGroup group) {
        switch (type) {
            case LEADER_FOLLOWER:
                if (robotId.equals(group.getCoordinatorRobotId())) {
                    return "LEADER";
                } else {
                    return "FOLLOWER";
                }
                
            case HIERARCHICAL:
                if (robotId.equals(group.getCoordinatorRobotId())) {
                    return "COORDINATOR";
                } else {
                    // In a real implementation, would determine hierarchy level
                    return "WORKER";
                }
                
            case DISTRIBUTED:
            case CONSENSUS:
                return "PEER";
                
            case MARKET_BASED:
                if (robotId.equals(group.getCoordinatorRobotId())) {
                    return "AUCTIONEER";
                } else {
                    return "BIDDER";
                }
                
            case SWARM:
                return "SWARM_MEMBER";
                
            default:
                return "PARTICIPANT";
        }
    }
    
    /**
     * Get decision parameters for a robot in this strategy
     * @param robotId Robot ID
     * @param role Robot role
     * @return Decision parameters
     */
    public Map<String, Object> getDecisionParameters(String robotId, String role) {
        Map<String, Object> decisionParams = new java.util.HashMap<>();
        
        // Base parameters from strategy parameters
        if (parameters != null) {
            decisionParams.putAll(parameters);
        }
        
        // Add role-specific parameters
        switch (role) {
            case "LEADER":
            case "COORDINATOR":
            case "AUCTIONEER":
                decisionParams.put("isDecisionMaker", true);
                decisionParams.put("communicationPriority", "high");
                decisionParams.put("decisionAuthority", "high");
                break;
                
            case "FOLLOWER":
            case "WORKER":
            case "BIDDER":
                decisionParams.put("isDecisionMaker", false);
                decisionParams.put("communicationPriority", "medium");
                decisionParams.put("decisionAuthority", "low");
                break;
                
            case "PEER":
                decisionParams.put("isDecisionMaker", true);
                decisionParams.put("communicationPriority", "high");
                decisionParams.put("decisionAuthority", "medium");
                decisionParams.put("consensusThreshold", 0.7);
                break;
                
            case "SWARM_MEMBER":
                decisionParams.put("isDecisionMaker", false);
                decisionParams.put("communicationPriority", "low");
                decisionParams.put("decisionAuthority", "low");
                decisionParams.put("localRulesBased", true);
                break;
        }
        
        return decisionParams;
    }
    
    /**
     * Create a Leader-Follower strategy
     * @return Leader-Follower strategy
     */
    public static CoordinationStrategy createLeaderFollowerStrategy() {
        return CoordinationStrategy.builder()
                .id("leader-follower")
                .name("Leader-Follower Coordination")
                .type(StrategyType.LEADER_FOLLOWER)
                .minRobots(2)
                .maxRobots(10)
                .applicableTaskTypes(List.of(
                        Task.TaskType.TRANSPORT,
                        Task.TaskType.ESCORTING,
                        Task.TaskType.DELIVERY
                ))
                .parameters(Map.of(
                        "leaderDecisionWeight", 0.8,
                        "followerDeviationTolerance", 0.2,
                        "communicationFrequency", "high"
                ))
                .efficiencyRating(0.8)
                .robustnessRating(0.6)
                .communicationOverhead(0.7)
                .build();
    }
    
    /**
     * Create a Distributed strategy
     * @return Distributed strategy
     */
    public static CoordinationStrategy createDistributedStrategy() {
        return CoordinationStrategy.builder()
                .id("distributed")
                .name("Distributed Coordination")
                .type(StrategyType.DISTRIBUTED)
                .minRobots(2)
                .maxRobots(20)
                .applicableTaskTypes(List.of(
                        Task.TaskType.CLEANING,
                        Task.TaskType.SURVEILLANCE,
                        Task.TaskType.CUSTOM
                ))
                .parameters(Map.of(
                        "territoryAssignment", "dynamic",
                        "overlapTolerance", 0.1,
                        "communicationFrequency", "medium"
                ))
                .efficiencyRating(0.9)
                .robustnessRating(0.8)
                .communicationOverhead(0.5)
                .build();
    }
    
    /**
     * Create a Market-Based strategy
     * @return Market-Based strategy
     */
    public static CoordinationStrategy createMarketBasedStrategy() {
        return CoordinationStrategy.builder()
                .id("market-based")
                .name("Market-Based Coordination")
                .type(StrategyType.MARKET_BASED)
                .minRobots(3)
                .maxRobots(50)
                .applicableTaskTypes(List.of(
                        Task.TaskType.PICKUP,
                        Task.TaskType.DELIVERY,
                        Task.TaskType.TRANSPORT,
                        Task.TaskType.CLEANING
                ))
                .parameters(Map.of(
                        "biddingFunction", "distanceAndCapability",
                        "auctionType", "sequential",
                        "reallocationThreshold", 0.3
                ))
                .efficiencyRating(0.85)
                .robustnessRating(0.7)
                .communicationOverhead(0.6)
                .build();
    }
    
    /**
     * Create a Swarm strategy
     * @return Swarm strategy
     */
    public static CoordinationStrategy createSwarmStrategy() {
        return CoordinationStrategy.builder()
                .id("swarm")
                .name("Swarm Coordination")
                .type(StrategyType.SWARM)
                .minRobots(5)
                .maxRobots(100)
                .applicableTaskTypes(List.of(
                        Task.TaskType.CLEANING,
                        Task.TaskType.SURVEILLANCE
                ))
                .parameters(Map.of(
                        "localRules", "emergentBehavior",
                        "neighborhoodRadius", 10.0,
                        "communicationFrequency", "low"
                ))
                .efficiencyRating(0.75)
                .robustnessRating(0.9)
                .communicationOverhead(0.3)
                .build();
    }
}