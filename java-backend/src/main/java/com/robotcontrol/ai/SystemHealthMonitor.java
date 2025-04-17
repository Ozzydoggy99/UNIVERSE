package com.robotcontrol.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.lang.management.ThreadMXBean;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Service for monitoring system health and performance
 */
@Service
@Slf4j
public class SystemHealthMonitor {
    
    private final Queue<SystemHealthMetrics> metricsHistory = new ConcurrentLinkedQueue<>();
    private final List<PerformanceIssue> activeIssues = new ArrayList<>();
    
    // Performance counters
    private final AtomicInteger apiRequestCount = new AtomicInteger(0);
    private final AtomicInteger apiErrorCount = new AtomicInteger(0);
    private final AtomicLong totalApiResponseTime = new AtomicLong(0);
    private final AtomicInteger apiRequestsCompleted = new AtomicInteger(0);
    
    // Robot communication metrics
    private final Map<String, Long> lastRobotCommandTimes = new HashMap<>();
    private final Map<String, Long> robotCommandLatencies = new HashMap<>();
    private final AtomicInteger activeRobotConnections = new AtomicInteger(0);
    private final AtomicInteger robotCommunicationErrors = new AtomicInteger(0);
    
    private boolean initialized = false;
    private JdbcTemplate jdbcTemplate;
    
    @Autowired(required = false)
    public void setDataSource(DataSource dataSource) {
        if (dataSource != null) {
            this.jdbcTemplate = new JdbcTemplate(dataSource);
        }
    }
    
    /**
     * Initialize the monitor
     */
    public void initialize() {
        log.info("Initializing System Health Monitor");
        initialized = true;
    }
    
    /**
     * Record start of an API request
     * @param requestId Unique request identifier
     */
    public void recordApiRequestStart(String requestId) {
        apiRequestCount.incrementAndGet();
        lastRobotCommandTimes.put(requestId, System.currentTimeMillis());
    }
    
    /**
     * Record completion of an API request
     * @param requestId Unique request identifier
     * @param successful Whether the request was successful
     */
    public void recordApiRequestEnd(String requestId, boolean successful) {
        Long startTime = lastRobotCommandTimes.remove(requestId);
        if (startTime != null) {
            long latency = System.currentTimeMillis() - startTime;
            totalApiResponseTime.addAndGet(latency);
            apiRequestsCompleted.incrementAndGet();
            
            if (!successful) {
                apiErrorCount.incrementAndGet();
            }
        }
    }
    
    /**
     * Record a robot connection
     * @param serialNumber Robot serial number
     */
    public void recordRobotConnection(String serialNumber) {
        activeRobotConnections.incrementAndGet();
    }
    
    /**
     * Record a robot disconnection
     * @param serialNumber Robot serial number
     */
    public void recordRobotDisconnection(String serialNumber) {
        activeRobotConnections.decrementAndGet();
    }
    
    /**
     * Record start of a robot command
     * @param commandId Unique command identifier
     * @param serialNumber Robot serial number
     */
    public void recordRobotCommandStart(String commandId, String serialNumber) {
        lastRobotCommandTimes.put(commandId, System.currentTimeMillis());
    }
    
    /**
     * Record completion of a robot command
     * @param commandId Unique command identifier
     * @param serialNumber Robot serial number
     * @param successful Whether the command was successful
     */
    public void recordRobotCommandEnd(String commandId, String serialNumber, boolean successful) {
        Long startTime = lastRobotCommandTimes.remove(commandId);
        if (startTime != null) {
            long latency = System.currentTimeMillis() - startTime;
            robotCommandLatencies.put(serialNumber, latency);
            
            if (!successful) {
                robotCommunicationErrors.incrementAndGet();
            }
        }
    }
    
    /**
     * Collect system health metrics periodically
     */
    @Scheduled(fixedRate = 60000) // Every minute
    public void collectMetrics() {
        if (!initialized) {
            return;
        }
        
        try {
            SystemHealthMetrics metrics = buildCurrentMetrics();
            metricsHistory.add(metrics);
            
            // Keep history size reasonable
            while (metricsHistory.size() > 60) { // Keep last hour
                metricsHistory.poll();
            }
            
            // Analyze metrics to detect issues
            List<PerformanceIssue> newIssues = analyzeMetrics(metrics);
            if (!newIssues.isEmpty()) {
                activeIssues.addAll(newIssues);
                for (PerformanceIssue issue : newIssues) {
                    log.warn("New performance issue detected: {} ({})", issue.getDescription(), issue.getSeverity());
                }
            }
            
        } catch (Exception e) {
            log.error("Error collecting system metrics", e);
        }
    }
    
    /**
     * Build current system health metrics
     * @return Current metrics
     */
    private SystemHealthMetrics buildCurrentMetrics() {
        // Get JVM and system metrics
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();
        
        double systemLoad = osBean.getSystemLoadAverage();
        if (systemLoad < 0) systemLoad = 0; // Not available on some platforms
        
        double memoryUsage = (double) memoryBean.getHeapMemoryUsage().getUsed() / 
                             memoryBean.getHeapMemoryUsage().getMax();
        
        // Database metrics - only if JDBC is configured
        int activeDbConnections = 0;
        double avgQueryTime = 0;
        double maxQueryTime = 0;
        
        if (jdbcTemplate != null) {
            try {
                activeDbConnections = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM pg_stat_activity", Integer.class);
                
                // Sample query to measure time
                long start = System.currentTimeMillis();
                jdbcTemplate.queryForList("SELECT 1");
                long queryTime = System.currentTimeMillis() - start;
                
                avgQueryTime = queryTime;
                maxQueryTime = queryTime;
            } catch (Exception e) {
                log.error("Error getting database metrics", e);
            }
        }
        
        // API metrics
        double apiResponseTime = 0;
        if (apiRequestsCompleted.get() > 0) {
            apiResponseTime = (double) totalApiResponseTime.get() / apiRequestsCompleted.get();
        }
        
        // Robot command latency
        double avgRobotLatency = robotCommandLatencies.values().stream()
                .mapToLong(Long::longValue)
                .average()
                .orElse(0);
        
        // Build component-specific metrics
        Map<String, Map<String, Object>> componentMetrics = new HashMap<>();
        
        // Add API component metrics
        Map<String, Object> apiMetrics = new HashMap<>();
        apiMetrics.put("requestCount", apiRequestCount.get());
        apiMetrics.put("errorCount", apiErrorCount.get());
        apiMetrics.put("avgResponseTime", apiResponseTime);
        componentMetrics.put("api", apiMetrics);
        
        // Add robot communication metrics
        Map<String, Object> robotMetrics = new HashMap<>();
        robotMetrics.put("activeConnections", activeRobotConnections.get());
        robotMetrics.put("communicationErrors", robotCommunicationErrors.get());
        robotMetrics.put("avgCommandLatency", avgRobotLatency);
        componentMetrics.put("robotCommunication", robotMetrics);
        
        // Build and return the metrics object
        return SystemHealthMetrics.builder()
                .timestamp(LocalDateTime.now())
                .systemLoad(systemLoad)
                .memoryUsagePercent(memoryUsage * 100)
                .diskUsagePercent(0) // Would need OS-specific code to get this
                .activeThreads(threadBean.getThreadCount())
                .activeDatabaseConnections(activeDbConnections)
                .avgQueryTimeMs(avgQueryTime)
                .maxQueryTimeMs(maxQueryTime)
                .apiResponseTimeMs(apiResponseTime)
                .apiRequestsPerMinute(apiRequestCount.getAndSet(0)) // Reset counter
                .apiErrorCount(apiErrorCount.getAndSet(0)) // Reset counter
                .robotCommandLatencyMs(avgRobotLatency)
                .activeRobotConnections(activeRobotConnections.get())
                .communicationErrors(robotCommunicationErrors.getAndSet(0)) // Reset counter
                .cacheHitRate(0) // Would come from cache implementation
                .cacheSize(0)
                .cacheEfficiency(0)
                .networkLatencyMs(0) // Would need network monitoring
                .packetLossPercent(0)
                .componentMetrics(componentMetrics)
                .build();
    }
    
    /**
     * Analyze metrics to detect performance issues
     * @param metrics Current metrics
     * @return List of new performance issues detected
     */
    private List<PerformanceIssue> analyzeMetrics(SystemHealthMetrics metrics) {
        List<PerformanceIssue> newIssues = new ArrayList<>();
        
        // Check CPU load
        if (metrics.getSystemLoad() > 0.8) {
            PerformanceIssue issue = PerformanceIssue.builder()
                    .id(UUID.randomUUID().toString())
                    .description("High system load: " + String.format("%.2f", metrics.getSystemLoad()))
                    .severity(PerformanceIssue.Severity.HIGH)
                    .category(PerformanceIssue.Category.CPU)
                    .detectedAt(LocalDateTime.now())
                    .relatedMetrics(Map.of("systemLoad", metrics.getSystemLoad()))
                    .automaticResolutionAvailable(false)
                    .potentialImpact("Reduced performance and increased response times")
                    .recommendedActions(List.of(
                            "Review resource-intensive processes",
                            "Consider scaling up server resources",
                            "Optimize database queries"))
                    .build();
            newIssues.add(issue);
        }
        
        // Check memory usage
        if (metrics.getMemoryUsagePercent() > 85) {
            PerformanceIssue issue = PerformanceIssue.builder()
                    .id(UUID.randomUUID().toString())
                    .description("High memory usage: " + String.format("%.1f%%", metrics.getMemoryUsagePercent()))
                    .severity(PerformanceIssue.Severity.MEDIUM)
                    .category(PerformanceIssue.Category.MEMORY)
                    .detectedAt(LocalDateTime.now())
                    .relatedMetrics(Map.of("memoryUsagePercent", metrics.getMemoryUsagePercent()))
                    .automaticResolutionAvailable(false)
                    .potentialImpact("Potential out-of-memory errors")
                    .recommendedActions(List.of(
                            "Check for memory leaks",
                            "Increase JVM heap size",
                            "Review large object allocations"))
                    .build();
            newIssues.add(issue);
        }
        
        // Check API errors
        if (metrics.getApiErrorCount() > 10) {
            PerformanceIssue issue = PerformanceIssue.builder()
                    .id(UUID.randomUUID().toString())
                    .description("High API error rate: " + metrics.getApiErrorCount() + " errors")
                    .severity(PerformanceIssue.Severity.HIGH)
                    .category(PerformanceIssue.Category.API)
                    .detectedAt(LocalDateTime.now())
                    .relatedMetrics(Map.of("apiErrorCount", metrics.getApiErrorCount()))
                    .automaticResolutionAvailable(false)
                    .potentialImpact("Degraded user experience and potential data inconsistency")
                    .recommendedActions(List.of(
                            "Check API logs for error patterns",
                            "Verify external services connectivity",
                            "Check for client-side errors"))
                    .build();
            newIssues.add(issue);
        }
        
        // Check database connection pool
        if (metrics.getActiveDatabaseConnections() > 20) {
            PerformanceIssue issue = PerformanceIssue.builder()
                    .id(UUID.randomUUID().toString())
                    .description("High database connection usage: " + metrics.getActiveDatabaseConnections() + " connections")
                    .severity(PerformanceIssue.Severity.MEDIUM)
                    .category(PerformanceIssue.Category.DATABASE)
                    .detectedAt(LocalDateTime.now())
                    .relatedMetrics(Map.of("activeDatabaseConnections", metrics.getActiveDatabaseConnections()))
                    .automaticResolutionAvailable(false)
                    .potentialImpact("Potential connection pool exhaustion")
                    .recommendedActions(List.of(
                            "Check for connection leaks",
                            "Increase connection pool size",
                            "Review transaction management"))
                    .build();
            newIssues.add(issue);
        }
        
        // Check robot communication errors
        if (metrics.getCommunicationErrors() > 5) {
            PerformanceIssue issue = PerformanceIssue.builder()
                    .id(UUID.randomUUID().toString())
                    .description("Multiple robot communication errors: " + metrics.getCommunicationErrors() + " errors")
                    .severity(PerformanceIssue.Severity.HIGH)
                    .category(PerformanceIssue.Category.ROBOT_COMMUNICATION)
                    .detectedAt(LocalDateTime.now())
                    .relatedMetrics(Map.of("communicationErrors", metrics.getCommunicationErrors()))
                    .automaticResolutionAvailable(false)
                    .potentialImpact("Robots may not respond to commands or report inaccurate status")
                    .recommendedActions(List.of(
                            "Check network connectivity to robots",
                            "Verify robot API endpoints",
                            "Check for robot firmware issues"))
                    .build();
            newIssues.add(issue);
        }
        
        return newIssues;
    }
    
    /**
     * Get the current system health metrics
     * @return Latest metrics
     */
    public SystemHealthMetrics getCurrentMetrics() {
        return metricsHistory.isEmpty() ? buildCurrentMetrics() : metricsHistory.peek();
    }
    
    /**
     * Get metrics history
     * @param limit Maximum number of entries to return
     * @return Recent metrics history
     */
    public List<SystemHealthMetrics> getMetricsHistory(int limit) {
        List<SystemHealthMetrics> result = new ArrayList<>(metricsHistory);
        if (result.size() > limit) {
            return result.subList(result.size() - limit, result.size());
        }
        return result;
    }
    
    /**
     * Get active performance issues
     * @return List of active issues
     */
    public List<PerformanceIssue> getActiveIssues() {
        return new ArrayList<>(activeIssues);
    }
    
    /**
     * Mark an issue as resolved
     * @param issueId Issue ID
     * @return True if issue was found and resolved
     */
    public boolean resolveIssue(String issueId) {
        Iterator<PerformanceIssue> iterator = activeIssues.iterator();
        while (iterator.hasNext()) {
            PerformanceIssue issue = iterator.next();
            if (issue.getId().equals(issueId)) {
                iterator.remove();
                return true;
            }
        }
        return false;
    }
}