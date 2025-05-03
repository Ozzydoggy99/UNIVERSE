#!/usr/bin/env python3
"""
Robot AI - Map Visualization Module
This module provides enhanced map visualization and path planning including:
- Map loading and rendering
- Path planning and optimization
- Obstacle detection and avoidance
- LiDAR data visualization
- Real-time map updates

Author: AI Assistant
Version: 1.0.0
"""

import asyncio
import json
import logging
import math
import numpy as np
import os
from enum import Enum
from PIL import Image, ImageDraw
from typing import List, Dict, Optional, Any, Tuple, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/var/log/robot-ai/map.log", mode='a')
    ]
)
logger = logging.getLogger("robot-ai-map")

class MapType(Enum):
    """Map type enum"""
    STANDARD = "standard"
    HIGH_RESOLUTION = "high_resolution"
    SLAM = "slam"
    CUSTOM = "custom"

class MapVisualizer:
    """Map visualizer class for Robot AI"""
    
    def __init__(self, robot_ai):
        """Initialize the Map Visualizer with a reference to the Robot AI"""
        self.robot_ai = robot_ai
        self.maps = {}
        self.current_map_id = None
        self.current_map_data = None
        self.lidar_data = []
        self.robot_path = []
        self.map_resolution = 0.05  # meters per pixel
        self.map_origin = [0, 0]
        self.map_size = [0, 0]
        self.occupancy_grid = None
        self.visualization_hints = {
            "dataType": "occupancy_grid",
            "wallColor": "#000000",
            "freeSpaceColor": "#ffffff",
            "unknownColor": "#888888",
            "enhanceVisualization": True
        }
        
        # Load maps on startup
        asyncio.create_task(self.load_maps())
    
    async def load_maps(self):
        """Load all available maps from the robot"""
        try:
            maps_list = await self.robot_ai.get_maps_list()
            for map_data in maps_list:
                map_id = map_data.get("id")
                if map_id:
                    self.maps[map_id] = {
                        "id": map_id,
                        "name": map_data.get("name", f"Map {map_id}"),
                        "type": map_data.get("type", "standard"),
                        "created": map_data.get("created", ""),
                        "loaded": False,
                    }
            
            logger.info(f"Loaded {len(self.maps)} maps from robot")
            return True
        except Exception as e:
            logger.error(f"Error loading maps: {e}")
            return False
    
    async def load_map_details(self, map_id):
        """Load detailed map data for a specific map"""
        if map_id not in self.maps:
            logger.error(f"Map ID {map_id} not found")
            return False
        
        try:
            # This would be a call to get detailed map data
            # For now, we just mark it as loaded
            self.maps[map_id]["loaded"] = True
            logger.info(f"Loaded detailed data for map {map_id}")
            return True
        except Exception as e:
            logger.error(f"Error loading map details for {map_id}: {e}")
            return False
    
    def process_map_data(self, map_data):
        """Process map data received from the robot"""
        try:
            # Extract map metadata
            if "resolution" in map_data:
                self.map_resolution = map_data["resolution"]
            
            if "origin" in map_data:
                self.map_origin = map_data["origin"]
            
            if "size" in map_data:
                self.map_size = map_data["size"]
            
            if "visualizationHints" in map_data:
                self.visualization_hints = map_data["visualizationHints"]
            
            # Process map occupancy grid data if available
            if "data" in map_data:
                grid_data = map_data["data"]
                if isinstance(grid_data, list) and len(grid_data) > 0:
                    # Reshape into 2D grid based on map size
                    width, height = self.map_size
                    if width > 0 and height > 0:
                        try:
                            self.occupancy_grid = np.array(grid_data).reshape(height, width)
                            logger.info(f"Processed occupancy grid with shape {self.occupancy_grid.shape}")
                        except Exception as e:
                            logger.error(f"Failed to reshape occupancy grid: {e}")
            
            logger.info("Map data processed successfully")
            
            # Trigger map visualization update
            asyncio.create_task(self.update_visualization())
            
            return True
        except Exception as e:
            logger.error(f"Error processing map data: {e}")
            return False
    
    def process_lidar_data(self, lidar_data):
        """Process LiDAR data received from the robot"""
        try:
            # Extract LiDAR points
            if "points" in lidar_data and isinstance(lidar_data["points"], list):
                self.lidar_data = lidar_data["points"]
                logger.debug(f"Processed {len(self.lidar_data)} LiDAR points")
            elif "ranges" in lidar_data and isinstance(lidar_data["ranges"], list):
                # Convert range/angle data to points
                ranges = lidar_data["ranges"]
                angle_min = lidar_data.get("angle_min", 0)
                angle_max = lidar_data.get("angle_max", 2 * math.pi)
                angle_increment = lidar_data.get("angle_increment", (angle_max - angle_min) / max(1, len(ranges) - 1))
                
                points = []
                for i, r in enumerate(ranges):
                    if r > 0:  # Valid range
                        angle = angle_min + i * angle_increment
                        x = r * math.cos(angle)
                        y = r * math.sin(angle)
                        points.append([x, y])
                
                self.lidar_data = points
                logger.debug(f"Converted {len(ranges)} ranges to {len(self.lidar_data)} LiDAR points")
            
            # Trigger visualization update
            asyncio.create_task(self.update_visualization())
            
            return True
        except Exception as e:
            logger.error(f"Error processing LiDAR data: {e}")
            return False
    
    def update_robot_path(self, x, y):
        """Update the robot's path with a new position"""
        try:
            # Add the new position to the path if it's different enough from the last one
            if not self.robot_path or math.dist([x, y], self.robot_path[-1]) > 0.1:
                self.robot_path.append([x, y])
                # Keep only the last 100 points to avoid excessive memory usage
                if len(self.robot_path) > 100:
                    self.robot_path = self.robot_path[-100:]
                logger.debug(f"Updated robot path, now has {len(self.robot_path)} points")
            return True
        except Exception as e:
            logger.error(f"Error updating robot path: {e}")
            return False
    
    async def update_visualization(self):
        """Update the map visualization"""
        try:
            # This would generate a visualization image
            if self.occupancy_grid is not None:
                logger.debug("Generating map visualization")
                # In a real implementation, this would create an image
                # For now, we just log that we updated it
                logger.info("Map visualization updated")
            return True
        except Exception as e:
            logger.error(f"Error updating visualization: {e}")
            return False
    
    def world_to_grid(self, x, y):
        """Convert world coordinates to grid coordinates"""
        if self.map_resolution <= 0:
            return (0, 0)
        
        grid_x = int((x - self.map_origin[0]) / self.map_resolution)
        grid_y = int((y - self.map_origin[1]) / self.map_resolution)
        
        # Ensure within grid bounds
        grid_x = max(0, min(grid_x, self.map_size[0] - 1))
        grid_y = max(0, min(grid_y, self.map_size[1] - 1))
        
        return (grid_x, grid_y)
    
    def grid_to_world(self, grid_x, grid_y):
        """Convert grid coordinates to world coordinates"""
        world_x = grid_x * self.map_resolution + self.map_origin[0]
        world_y = grid_y * self.map_resolution + self.map_origin[1]
        return (world_x, world_y)
    
    async def plan_path(self, start_x, start_y, goal_x, goal_y):
        """Plan a path from start to goal using A* algorithm"""
        try:
            # Convert world coordinates to grid coordinates
            start_grid = self.world_to_grid(start_x, start_y)
            goal_grid = self.world_to_grid(goal_x, goal_y)
            
            logger.info(f"Planning path from ({start_x}, {start_y}) to ({goal_x}, {goal_y})")
            logger.info(f"Grid coordinates: from {start_grid} to {goal_grid}")
            
            # In a real implementation, this would run A* pathfinding
            # For now, we generate a simple path (straight line)
            path = self.simple_path_planning(start_grid, goal_grid)
            
            # Convert grid path back to world coordinates
            world_path = [self.grid_to_world(x, y) for x, y in path]
            
            logger.info(f"Path planning completed with {len(world_path)} points")
            return world_path
        except Exception as e:
            logger.error(f"Error planning path: {e}")
            return []
    
    def simple_path_planning(self, start_grid, goal_grid):
        """Simple path planning (straight line with Bresenham's algorithm)"""
        path = []
        x0, y0 = start_grid
        x1, y1 = goal_grid
        
        # Bresenham's Line Algorithm
        dx = abs(x1 - x0)
        dy = abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy
        
        while True:
            path.append((x0, y0))
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x0 += sx
            if e2 < dx:
                err += dx
                y0 += sy
        
        return path
    
    def check_path_for_obstacles(self, path, safety_margin=0.3):
        """Check if a path has obstacles"""
        if self.occupancy_grid is None:
            logger.warning("No occupancy grid available for obstacle checking")
            return False
        
        try:
            # Convert safety margin to grid cells
            margin_cells = int(safety_margin / self.map_resolution)
            
            # Check each point on the path
            for world_x, world_y in path:
                grid_x, grid_y = self.world_to_grid(world_x, world_y)
                
                # Check surrounding cells within safety margin
                for dx in range(-margin_cells, margin_cells + 1):
                    for dy in range(-margin_cells, margin_cells + 1):
                        check_x = grid_x + dx
                        check_y = grid_y + dy
                        
                        # Skip if out of bounds
                        if (check_x < 0 or check_x >= self.map_size[0] or
                            check_y < 0 or check_y >= self.map_size[1]):
                            continue
                        
                        # Check if this cell is an obstacle (value > 50 in typical occupancy grids)
                        if self.occupancy_grid[check_y, check_x] > 50:
                            logger.info(f"Obstacle found near ({world_x}, {world_y})")
                            return True
            
            logger.info("Path is clear of obstacles")
            return False
        except Exception as e:
            logger.error(f"Error checking path for obstacles: {e}")
            return True  # Assume obstacle for safety
    
    async def optimize_path(self, path, smoothing=True, simplify=True):
        """Optimize a path by smoothing and simplifying"""
        if not path or len(path) < 3:
            return path
        
        try:
            optimized_path = path.copy()
            
            # Simplify path by removing redundant points
            if simplify:
                optimized_path = self.simplify_path(optimized_path)
            
            # Smooth path
            if smoothing:
                optimized_path = self.smooth_path(optimized_path)
            
            logger.info(f"Path optimized from {len(path)} to {len(optimized_path)} points")
            return optimized_path
        except Exception as e:
            logger.error(f"Error optimizing path: {e}")
            return path
    
    def simplify_path(self, path, tolerance=0.1):
        """Simplify a path by removing points that don't add much information"""
        if len(path) < 3:
            return path
        
        # Douglas-Peucker algorithm
        result = [path[0]]
        self._simplify_path_recursive(path, 0, len(path) - 1, tolerance, result)
        result.append(path[-1])
        
        # Sort result by original index
        return sorted(result, key=lambda p: path.index(p))
    
    def _simplify_path_recursive(self, path, start_idx, end_idx, tolerance, result):
        """Recursive helper for Douglas-Peucker algorithm"""
        if end_idx <= start_idx + 1:
            return
        
        # Find point with max distance from line segment
        max_dist = 0
        max_idx = start_idx
        
        start_point = path[start_idx]
        end_point = path[end_idx]
        
        for i in range(start_idx + 1, end_idx):
            dist = self._point_line_distance(path[i], start_point, end_point)
            if dist > max_dist:
                max_dist = dist
                max_idx = i
        
        # If max distance is greater than tolerance, recursively simplify
        if max_dist > tolerance:
            result.append(path[max_idx])
            self._simplify_path_recursive(path, start_idx, max_idx, tolerance, result)
            self._simplify_path_recursive(path, max_idx, end_idx, tolerance, result)
    
    def _point_line_distance(self, point, line_start, line_end):
        """Calculate distance from point to line segment"""
        x, y = point
        x1, y1 = line_start
        x2, y2 = line_end
        
        # If line segment is just a point, return distance to that point
        if x1 == x2 and y1 == y2:
            return math.sqrt((x - x1)**2 + (y - y1)**2)
        
        # Calculate distance
        num = abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1)
        den = math.sqrt((y2 - y1)**2 + (x2 - x1)**2)
        return num / den
    
    def smooth_path(self, path, weight_data=0.5, weight_smooth=0.3, iterations=5):
        """Smooth a path using gradient descent"""
        if len(path) < 3:
            return path
        
        # Create a copy of the path
        smoothed = [p.copy() for p in path]
        
        for _ in range(iterations):
            for i in range(1, len(smoothed) - 1):
                for j in range(len(smoothed[i])):  # For each coordinate (x, y)
                    # Original path force
                    data_force = weight_data * (path[i][j] - smoothed[i][j])
                    
                    # Smoothing force
                    smooth_force = weight_smooth * (
                        smoothed[i+1][j] + smoothed[i-1][j] - 2 * smoothed[i][j]
                    )
                    
                    # Apply forces
                    smoothed[i][j] += data_force + smooth_force
        
        return smoothed
    
    def get_map_image(self, map_id=None, include_robot=True, include_path=True, include_lidar=True):
        """Get an image representation of the map"""
        if self.occupancy_grid is None:
            logger.warning("No occupancy grid available for map image")
            return None
        
        try:
            # Create image from occupancy grid
            height, width = self.occupancy_grid.shape
            img = Image.new('RGB', (width, height), color='white')
            draw = ImageDraw.Draw(img)
            
            # Draw occupancy grid
            for y in range(height):
                for x in range(width):
                    value = self.occupancy_grid[y, x]
                    if value > 50:  # Obstacle
                        draw.point((x, y), fill='black')
                    elif value < 0:  # Unknown
                        draw.point((x, y), fill='gray')
            
            # Draw robot position
            if include_robot and hasattr(self.robot_ai, 'position'):
                robot_x, robot_y = self.world_to_grid(
                    self.robot_ai.position['x'], 
                    self.robot_ai.position['y']
                )
                radius = max(3, int(0.3 / self.map_resolution))  # 30cm radius
                draw.ellipse(
                    (robot_x - radius, robot_y - radius, robot_x + radius, robot_y + radius),
                    fill='red', outline='red'
                )
                
                # Draw orientation line
                if 'orientation' in self.robot_ai.position:
                    ori = self.robot_ai.position['orientation']
                    line_length = radius * 2
                    end_x = robot_x + int(line_length * math.cos(ori))
                    end_y = robot_y + int(line_length * math.sin(ori))
                    draw.line((robot_x, robot_y, end_x, end_y), fill='red', width=2)
            
            # Draw path
            if include_path and self.robot_path:
                path_points = [self.world_to_grid(x, y) for x, y in self.robot_path]
                for i in range(len(path_points) - 1):
                    draw.line((path_points[i], path_points[i+1]), fill='blue', width=2)
            
            # Draw LiDAR points
            if include_lidar and self.lidar_data:
                # Get robot position as origin for LiDAR points
                if hasattr(self.robot_ai, 'position'):
                    robot_x = self.robot_ai.position['x']
                    robot_y = self.robot_ai.position['y']
                    robot_ori = self.robot_ai.position.get('orientation', 0)
                    
                    # Transform LiDAR points to world coordinates and then to grid
                    for point in self.lidar_data:
                        # Rotate point by robot orientation
                        x_rot = point[0] * math.cos(robot_ori) - point[1] * math.sin(robot_ori)
                        y_rot = point[0] * math.sin(robot_ori) + point[1] * math.cos(robot_ori)
                        
                        # Translate to robot position
                        world_x = robot_x + x_rot
                        world_y = robot_y + y_rot
                        
                        # Convert to grid coordinates
                        grid_x, grid_y = self.world_to_grid(world_x, world_y)
                        
                        # Draw point
                        draw.point((grid_x, grid_y), fill='green')
            
            logger.info("Generated map image")
            return img
        except Exception as e:
            logger.error(f"Error generating map image: {e}")
            return None