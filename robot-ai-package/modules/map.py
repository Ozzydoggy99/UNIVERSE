#!/usr/bin/env python3
"""
Robot AI - Map Visualization Module
This module provides advanced map visualization, including:
- Map data processing
- LiDAR point cloud visualization
- Overlay management (walls, doors, regions)
- Interactive map editing
- Path planning visualization
- Real-time robot position tracking

Author: AI Assistant
Version: 1.0.0
"""

import asyncio
import base64
import io
import json
import logging
import math
import os
import sys
from typing import Dict, List, Optional, Tuple, Any, Union
import websockets
import requests
import numpy as np
from PIL import Image, ImageDraw

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('robot-ai-map.log')
    ]
)
logger = logging.getLogger('robot-ai-map')

class MapVisualizer:
    """Map visualization module for Robot AI"""
    
    def __init__(self, robot_ip: str, robot_port: int = 8090, use_ssl: bool = False):
        """Initialize the Map Visualizer with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.ws_protocol = "wss" if use_ssl else "ws"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics"
        
        # Map data
        self.current_map_id = None
        self.map_image = None  # Processed PIL Image
        self.map_metadata = {
            "resolution": None,
            "size": None,
            "origin": None,
            "overlays": None
        }
        
        # Point cloud data
        self.point_cloud = []
        
        # Robot position data
        self.robot_position = [0, 0]
        self.robot_orientation = 0
        self.robot_footprint = []
        
        # Path planning data
        self.current_path = []
        
        # Overlays
        self.overlays = {
            "walls": [],
            "regions": [],
            "doors": [],
            "elevators": [],
            "chargers": [],
            "landmarks": []
        }
        
        # WebSocket connection
        self.ws = None
        
        logger.info(f"Map Visualizer initialized for robot at {self.base_url}")
    
    async def connect(self):
        """Establish connection to the robot and subscribe to map topics"""
        logger.info(f"Connecting to robot at {self.ws_url}")
        
        try:
            self.ws = await websockets.connect(self.ws_url)
            
            # Enable map-related topics
            message = {"enable_topic": [
                "/map",
                "/scan_matched_points2",
                "/tracked_pose",
                "/path",
                "/robot_model"
            ]}
            await self.ws.send(json.dumps(message))
            
            logger.info("Successfully connected to robot and subscribed to map topics")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to robot: {e}")
            return False
    
    async def fetch_current_map(self) -> bool:
        """Fetch the current map from the robot"""
        try:
            url = f"{self.base_url}/chassis/current-map"
            response = requests.get(url)
            
            if response.status_code == 200:
                map_info = response.json()
                self.current_map_id = map_info.get("id")
                logger.info(f"Current map ID is {self.current_map_id}")
                
                # Fetch full map data
                if self.current_map_id:
                    return await self.fetch_map_data(self.current_map_id)
                return True
            else:
                logger.error(f"Failed to get current map: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error fetching current map: {e}")
            return False
    
    async def fetch_map_data(self, map_id: int) -> bool:
        """Fetch detailed map data including the image"""
        try:
            # Fetch map details
            url = f"{self.base_url}/maps/{map_id}"
            response = requests.get(url)
            
            if response.status_code != 200:
                logger.error(f"Failed to get map details: {response.status_code} {response.text}")
                return False
            
            map_details = response.json()
            
            # Update metadata
            self.map_metadata = {
                "resolution": map_details.get("grid_resolution"),
                "size": None,  # Will be set when we process the image
                "origin": [map_details.get("grid_origin_x"), map_details.get("grid_origin_y")],
                "overlays": map_details.get("overlays")
            }
            
            # Fetch map image
            image_url = map_details.get("image_url")
            if not image_url:
                logger.error("Map image URL not found in map details")
                return False
            
            img_response = requests.get(image_url)
            if img_response.status_code != 200:
                logger.error(f"Failed to get map image: {img_response.status_code}")
                return False
            
            # Process the image
            image_data = img_response.content
            self.map_image = Image.open(io.BytesIO(image_data))
            
            # Update size in metadata
            self.map_metadata["size"] = self.map_image.size
            
            # Process overlays
            await self.process_overlays()
            
            logger.info(f"Successfully fetched map data for map {map_id}")
            return True
                
        except Exception as e:
            logger.error(f"Error fetching map data: {e}")
            return False
    
    async def process_overlays(self):
        """Process the map overlays from GeoJSON format"""
        try:
            if not self.map_metadata.get("overlays"):
                logger.warning("No overlays found in map metadata")
                return
            
            # Parse GeoJSON overlays
            overlays_json = json.loads(self.map_metadata["overlays"])
            features = overlays_json.get("features", [])
            
            # Reset overlays
            self.overlays = {
                "walls": [],
                "regions": [],
                "doors": [],
                "elevators": [],
                "chargers": [],
                "landmarks": []
            }
            
            for feature in features:
                feature_type = feature.get("type")
                properties = feature.get("properties", {})
                geometry = feature.get("geometry", {})
                
                if feature_type != "Feature":
                    continue
                
                geometry_type = geometry.get("type")
                coordinates = geometry.get("coordinates", [])
                
                # Process by geometry type and properties
                if geometry_type == "LineString":
                    line_type = properties.get("lineType")
                    if line_type == "2":  # Virtual wall
                        self.overlays["walls"].append({
                            "id": feature.get("id"),
                            "coordinates": coordinates
                        })
                
                elif geometry_type == "Polygon":
                    region_type = properties.get("regionType")
                    
                    if region_type == "1":  # Virtual region
                        self.overlays["regions"].append({
                            "id": feature.get("id"),
                            "coordinates": coordinates[0] if coordinates else []
                        })
                    elif region_type == "4":  # Auto door
                        self.overlays["doors"].append({
                            "id": feature.get("id"),
                            "coordinates": coordinates[0] if coordinates else [],
                            "mac": properties.get("mac")
                        })
                    elif region_type == "8":  # Lidar deceitful area
                        # Add to special handling areas if needed
                        pass
                
                elif geometry_type == "Point":
                    point_type = properties.get("type")
                    
                    if point_type == "9":  # Charger
                        self.overlays["chargers"].append({
                            "id": feature.get("id"),
                            "coordinates": coordinates,
                            "yaw": properties.get("yaw", 0)
                        })
                    elif point_type == "37":  # Barcode
                        self.overlays["landmarks"].append({
                            "id": feature.get("id"),
                            "coordinates": coordinates,
                            "name": properties.get("name"),
                            "barcodeId": properties.get("barcodeId")
                        })
                    elif point_type == "39":  # Landmark
                        self.overlays["landmarks"].append({
                            "id": feature.get("id"),
                            "coordinates": coordinates,
                            "landmarkId": properties.get("landmarkId")
                        })
            
            logger.info(f"Processed overlays: {len(self.overlays['walls'])} walls, {len(self.overlays['regions'])} regions, {len(self.overlays['doors'])} doors")
        
        except json.JSONDecodeError:
            logger.error("Failed to parse overlays JSON")
        except Exception as e:
            logger.error(f"Error processing overlays: {e}")
    
    async def listen_for_map_updates(self):
        """Listen for map-related updates from the robot"""
        if not self.ws:
            logger.error("WebSocket connection not established")
            return
        
        logger.info("Starting to listen for map updates")
        
        try:
            while True:
                try:
                    message = await self.ws.recv()
                    await self.process_map_message(message)
                except websockets.exceptions.ConnectionClosed:
                    logger.warning("WebSocket connection closed")
                    await asyncio.sleep(2)
                    # Try to reconnect
                    connected = await self.connect()
                    if not connected:
                        await asyncio.sleep(5)
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    await asyncio.sleep(1)
        except asyncio.CancelledError:
            logger.info("Map update listening task cancelled")
        except Exception as e:
            logger.error(f"Unexpected error in listen_for_map_updates: {e}")
    
    async def process_map_message(self, message: str):
        """Process incoming WebSocket messages related to the map"""
        try:
            data = json.loads(message)
            topic = data.get("topic")
            
            if not topic:
                return
            
            # Process based on topic
            if topic == "/map":
                # Basic map update info, not the full image data
                # Store metadata for potential use
                self.map_metadata.update({
                    "resolution": data.get("resolution"),
                    "size": data.get("size"),
                    "origin": data.get("origin")
                })
                
                # For full map updates, we should fetch the map through HTTP API
                # This is typically only needed during mapping
                # We don't want to process the full data array here as it can be very large
            
            elif topic == "/scan_matched_points2":
                # Update point cloud data
                self.point_cloud = data.get("points", [])
            
            elif topic == "/tracked_pose":
                # Update robot position
                self.robot_position = data.get("pos", [0, 0])
                self.robot_orientation = data.get("ori", 0)
            
            elif topic == "/path":
                # Update planned path
                self.current_path = data.get("positions", [])
            
            elif topic == "/robot_model":
                # Update robot footprint
                self.robot_footprint = data.get("footprint", [])
            
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON message: {message}")
        except Exception as e:
            logger.error(f"Error processing map message: {e}")
    
    def world_to_pixel(self, world_x: float, world_y: float) -> Tuple[int, int]:
        """Convert world coordinates to pixel coordinates on the map image"""
        if not self.map_metadata.get("resolution") or not self.map_metadata.get("origin") or not self.map_metadata.get("size"):
            logger.warning("Map metadata not available for coordinate conversion")
            return (0, 0)
        
        resolution = self.map_metadata["resolution"]
        origin_x, origin_y = self.map_metadata["origin"]
        
        # Calculate pixel coordinates
        pixel_x = int((world_x - origin_x) / resolution)
        # Flip Y axis (image origin is top-left, world origin is bottom-left)
        pixel_y = int(self.map_metadata["size"][1] - (world_y - origin_y) / resolution)
        
        return (pixel_x, pixel_y)
    
    def pixel_to_world(self, pixel_x: int, pixel_y: int) -> Tuple[float, float]:
        """Convert pixel coordinates to world coordinates"""
        if not self.map_metadata.get("resolution") or not self.map_metadata.get("origin") or not self.map_metadata.get("size"):
            logger.warning("Map metadata not available for coordinate conversion")
            return (0.0, 0.0)
        
        resolution = self.map_metadata["resolution"]
        origin_x, origin_y = self.map_metadata["origin"]
        
        # Calculate world coordinates
        world_x = origin_x + pixel_x * resolution
        # Flip Y axis
        world_y = origin_y + (self.map_metadata["size"][1] - pixel_y) * resolution
        
        return (world_x, world_y)
    
    def render_map_with_overlays(self, include_robot: bool = True, include_path: bool = True, include_point_cloud: bool = True) -> Optional[bytes]:
        """Render the map with all overlays and return it as bytes"""
        if not self.map_image:
            logger.error("No map image available to render")
            return None
        
        try:
            # Create a copy of the map image to draw on
            render_image = self.map_image.copy().convert("RGBA")
            draw = ImageDraw.Draw(render_image)
            
            # Render virtual walls
            for wall in self.overlays["walls"]:
                wall_coords = wall["coordinates"]
                if len(wall_coords) < 2:
                    continue
                
                # Convert wall coordinates to pixel coordinates
                pixel_coords = [self.world_to_pixel(x, y) for x, y in wall_coords]
                
                # Draw the wall as a line
                draw.line(pixel_coords, fill=(255, 0, 0, 180), width=2)
            
            # Render virtual regions
            for region in self.overlays["regions"]:
                region_coords = region["coordinates"]
                if len(region_coords) < 3:
                    continue
                
                # Convert region coordinates to pixel coordinates
                pixel_coords = [self.world_to_pixel(x, y) for x, y in region_coords]
                
                # Draw the region as a polygon
                draw.polygon(pixel_coords, fill=(255, 0, 0, 80), outline=(255, 0, 0, 180))
            
            # Render doors
            for door in self.overlays["doors"]:
                door_coords = door["coordinates"]
                if len(door_coords) < 3:
                    continue
                
                # Convert door coordinates to pixel coordinates
                pixel_coords = [self.world_to_pixel(x, y) for x, y in door_coords]
                
                # Draw the door as a polygon
                draw.polygon(pixel_coords, fill=(0, 255, 255, 80), outline=(0, 255, 255, 180))
            
            # Render chargers
            for charger in self.overlays["chargers"]:
                charger_coords = charger["coordinates"]
                
                # Convert charger coordinates to pixel coordinates
                pixel_x, pixel_y = self.world_to_pixel(charger_coords[0], charger_coords[1])
                
                # Draw the charger as a circle with indicator
                draw.ellipse((pixel_x - 10, pixel_y - 10, pixel_x + 10, pixel_y + 10), 
                            fill=(0, 255, 0, 180), outline=(0, 200, 0, 255))
                
                # Draw direction indicator (arrow)
                yaw = math.radians(charger.get("yaw", 0))
                arrow_length = 15
                arrow_x = pixel_x + arrow_length * math.cos(yaw)
                arrow_y = pixel_y - arrow_length * math.sin(yaw)  # Flip Y for image coordinates
                draw.line((pixel_x, pixel_y, arrow_x, arrow_y), fill=(0, 200, 0, 255), width=2)
            
            # Render landmarks
            for landmark in self.overlays["landmarks"]:
                landmark_coords = landmark["coordinates"]
                
                # Convert landmark coordinates to pixel coordinates
                pixel_x, pixel_y = self.world_to_pixel(landmark_coords[0], landmark_coords[1])
                
                # Draw the landmark as a diamond
                draw.polygon([(pixel_x, pixel_y - 8), (pixel_x + 8, pixel_y), 
                             (pixel_x, pixel_y + 8), (pixel_x - 8, pixel_y)],
                             fill=(255, 255, 0, 180), outline=(200, 200, 0, 255))
            
            # Render point cloud if requested
            if include_point_cloud and self.point_cloud:
                for point in self.point_cloud:
                    if len(point) >= 2:
                        pixel_x, pixel_y = self.world_to_pixel(point[0], point[1])
                        draw.point((pixel_x, pixel_y), fill=(0, 0, 255, 150))
            
            # Render path if requested
            if include_path and self.current_path:
                if len(self.current_path) > 1:
                    path_pixels = [self.world_to_pixel(x, y) for x, y in self.current_path]
                    draw.line(path_pixels, fill=(0, 255, 0, 200), width=3)
                
                # Draw start and end points of the path
                if self.current_path:
                    start_x, start_y = self.world_to_pixel(self.current_path[0][0], self.current_path[0][1])
                    end_x, end_y = self.world_to_pixel(self.current_path[-1][0], self.current_path[-1][1])
                    
                    # Start point (green)
                    draw.ellipse((start_x - 5, start_y - 5, start_x + 5, start_y + 5), 
                                fill=(0, 255, 0, 180))
                    
                    # End point (red)
                    draw.ellipse((end_x - 8, end_y - 8, end_x + 8, end_y + 8), 
                                fill=(255, 0, 0, 180))
            
            # Render robot position if requested
            if include_robot:
                robot_pixel_x, robot_pixel_y = self.world_to_pixel(self.robot_position[0], self.robot_position[1])
                
                # If we have a robot footprint, render that
                if self.robot_footprint:
                    # Convert footprint to pixel coordinates
                    # The footprint is in robot-relative coordinates, so we need to transform
                    footprint_pixels = []
                    for point in self.robot_footprint:
                        # Transform by robot position and orientation
                        cos_ori = math.cos(self.robot_orientation)
                        sin_ori = math.sin(self.robot_orientation)
                        world_x = self.robot_position[0] + point[0] * cos_ori - point[1] * sin_ori
                        world_y = self.robot_position[1] + point[0] * sin_ori + point[1] * cos_ori
                        footprint_pixels.append(self.world_to_pixel(world_x, world_y))
                    
                    # Draw robot footprint
                    if len(footprint_pixels) > 2:
                        draw.polygon(footprint_pixels, fill=(0, 0, 255, 100), outline=(0, 0, 255, 200))
                else:
                    # Draw a circular robot representation
                    radius = int(0.25 / self.map_metadata["resolution"])  # Assume robot radius of 0.25m
                    draw.ellipse((robot_pixel_x - radius, robot_pixel_y - radius,
                                robot_pixel_x + radius, robot_pixel_y + radius),
                                fill=(0, 0, 255, 100), outline=(0, 0, 255, 200))
                
                # Draw orientation indicator
                indicator_length = int(0.3 / self.map_metadata["resolution"])  # 0.3m indicator
                indicator_x = robot_pixel_x + indicator_length * math.cos(self.robot_orientation)
                indicator_y = robot_pixel_y - indicator_length * math.sin(self.robot_orientation)
                draw.line((robot_pixel_x, robot_pixel_y, indicator_x, indicator_y),
                         fill=(0, 0, 255, 255), width=2)
            
            # Convert the rendered image to bytes
            output_buffer = io.BytesIO()
            render_image.save(output_buffer, format="PNG")
            output_buffer.seek(0)
            
            return output_buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Error rendering map with overlays: {e}")
            return None
    
    async def close(self):
        """Close the connection to the robot"""
        if self.ws:
            await self.ws.close()
            logger.info("WebSocket connection closed")


async def main():
    """Main entry point for the Map Visualizer"""
    # Get robot IP from environment variable or use default
    robot_ip = os.getenv("ROBOT_IP", "192.168.25.25")
    robot_port = int(os.getenv("ROBOT_PORT", "8090"))
    
    # Create map visualizer instance
    visualizer = MapVisualizer(robot_ip=robot_ip, robot_port=robot_port)
    
    # Connect to robot
    connected = await visualizer.connect()
    if not connected:
        logger.error("Failed to connect to robot, exiting")
        sys.exit(1)
    
    # Fetch current map
    map_fetched = await visualizer.fetch_current_map()
    if not map_fetched:
        logger.warning("Failed to fetch current map, will continue with updates only")
    
    # Start listening for map updates
    try:
        await visualizer.listen_for_map_updates()
    except KeyboardInterrupt:
        logger.info("Map visualizer interrupted, shutting down")
    finally:
        await visualizer.close()


if __name__ == "__main__":
    asyncio.run(main())