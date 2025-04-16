package com.robotcontrol.model.navigation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Represents map data for robot navigation
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MapData {
    
    private List<List<Integer>> grid; // 2D grid of map cells (0 = free, 1 = obstacle, etc.)
    private List<MapPoint> obstacles; // List of obstacle coordinates
    private List<MapPath> paths;      // Pre-calculated paths
    private int floorId;              // Floor this map belongs to
    private double gridResolution;    // Size of each grid cell in meters
    private MapPoint origin;          // Origin point (0,0) in real-world coordinates
    
    // Elevator locations on the map
    private List<MapPoint> elevatorPoints;
    
    // Special waypoints for navigation
    private List<MapPoint> waypoints;
}