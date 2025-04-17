package com.robotcontrol.ai;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Class to store system health metrics
 */
@Data
@Builder
public class SystemHealthMetrics {
    
    // When metrics were collected
    private LocalDateTime timestamp;
    
    // Server resources
    private double systemLoad;
    private double memoryUsagePercent;
    private double diskUsagePercent;
    private int activeThreads;
    
    // Database metrics
    private int activeDatabaseConnections;
    private double avgQueryTimeMs;
    private double maxQueryTimeMs;
    
    // API performance
    private double apiResponseTimeMs;
    private int apiRequestsPerMinute;
    private int apiErrorCount;
    
    // Robot communication
    private double robotCommandLatencyMs;
    private int activeRobotConnections;
    private int communicationErrors;
    
    // Cache statistics
    private double cacheHitRate;
    private int cacheSize;
    private double cacheEfficiency;
    
    // Network health
    private double networkLatencyMs;
    private double packetLossPercent;
    
    // Detailed metrics by component
    private Map<String, Map<String, Object>> componentMetrics;
}