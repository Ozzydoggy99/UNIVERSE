package com.robotcontrol.ai;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Class to represent a detected system performance issue
 */
@Data
@Builder
public class PerformanceIssue {
    
    public enum Severity {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }
    
    public enum Category {
        CPU,
        MEMORY,
        DISK,
        NETWORK,
        DATABASE,
        API,
        CACHE,
        ROBOT_COMMUNICATION,
        SECURITY,
        OTHER
    }
    
    // Basic information
    private String id;
    private String description;
    private Severity severity;
    private Category category;
    
    // When the issue was detected
    private LocalDateTime detectedAt;
    
    // Related metrics that led to detection
    private Map<String, Object> relatedMetrics;
    
    // Whether automatic resolution is available
    private boolean automaticResolutionAvailable;
    
    // Description of automatic resolution
    private String resolutionDescription;
    
    // Potential impact if not resolved
    private String potentialImpact;
    
    // Recommended manual actions
    private List<String> recommendedActions;
    
    // Resolution history for this issue (if recurring)
    private List<Map<String, Object>> resolutionHistory;
}