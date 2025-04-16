package com.robotcontrol.model.navigation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Represents a path on the map
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MapPath {
    
    private List<MapPoint> points;
    private String status; // planned, active, completed, failed
    private String pathType; // direct, elevator, custom
    
    // For multi-floor paths
    private boolean multiFloor;
    private Integer startFloor;
    private Integer endFloor;
    
    // Elevator usage
    private List<ElevatorSegment> elevatorSegments;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ElevatorSegment {
        private Integer fromFloor;
        private Integer toFloor;
        private String elevatorId;
        private MapPoint entryPoint;
        private MapPoint exitPoint;
    }
}