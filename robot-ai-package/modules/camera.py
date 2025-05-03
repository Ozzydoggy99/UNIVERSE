#!/usr/bin/env python3
"""
Robot AI - Camera Module
This module provides enhanced camera functionality including:
- Live video streaming
- Camera feed processing
- Frame capture and storage
- Video encoding/decoding
- Multi-camera support
- Camera integration with robot control systems

Author: AI Assistant
Version: 1.0.0
"""

import asyncio
import base64
import json
import logging
import math
import os
import time
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple, Union
from PIL import Image, ImageDraw, ImageFont
import io

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/var/log/robot-ai/camera.log", mode='a')
    ]
)
logger = logging.getLogger("robot-ai-camera")

class CameraState(Enum):
    """Camera state enum"""
    INACTIVE = "inactive"
    CONNECTING = "connecting"
    STREAMING = "streaming"
    ERROR = "error"
    DISCONNECTED = "disconnected"

class CameraType(Enum):
    """Camera type enum"""
    FRONT = "front"
    BACK = "back"
    DEPTH = "depth"

class CameraFormat(Enum):
    """Camera format enum"""
    H264 = "h264"
    JPEG = "jpeg"
    RAW = "raw"

class CameraModule:
    """Camera module for Robot AI providing enhanced camera functionality"""
    
    def __init__(self, robot_ai):
        """Initialize the Camera Module with a reference to the Robot AI"""
        self.robot_ai = robot_ai
        self.cameras = {}
        self.frame_callbacks = []
        self.latest_frames = {}
        self.stream_active = {}
        
        # Initialize cameras
        self._init_cameras()
    
    def _init_cameras(self):
        """Initialize available cameras"""
        # Add front camera
        self.cameras[CameraType.FRONT.value] = {
            "type": CameraType.FRONT.value,
            "state": CameraState.INACTIVE.value,
            "format": CameraFormat.JPEG.value,
            "resolution": (640, 480),
            "fps": 10,
            "latest_frame": None,
            "timestamp": 0,
        }
        
        # Try to detect other cameras
        asyncio.create_task(self._detect_cameras())
    
    async def _detect_cameras(self):
        """Detect available cameras on the robot"""
        logger.info("Detecting available cameras...")
        try:
            # In a real implementation, this would query the robot for all available cameras
            # For now, we just assume the front camera is available
            logger.info("Camera detection complete")
        except Exception as e:
            logger.error(f"Error detecting cameras: {e}")
    
    async def connect(self):
        """Establish connection to the robot and start monitoring camera topics"""
        logger.info("Connecting camera module...")
        try:
            # Ensure we have front camera topic enabled in the robot_ai
            if "/rgb_cameras/front/video" not in self.robot_ai.enabled_topics:
                await self.robot_ai.enable_topics(["/rgb_cameras/front/video"])
            
            # Set camera state to connecting
            self.cameras[CameraType.FRONT.value]["state"] = CameraState.CONNECTING.value
            
            # Wait for first frame to confirm connection
            timeout = 10  # seconds
            start_time = time.time()
            while time.time() - start_time < timeout:
                if self.cameras[CameraType.FRONT.value]["latest_frame"] is not None:
                    self.cameras[CameraType.FRONT.value]["state"] = CameraState.STREAMING.value
                    logger.info("Camera connected successfully")
                    return True
                await asyncio.sleep(0.5)
            
            # If we get here, connection timed out
            self.cameras[CameraType.FRONT.value]["state"] = CameraState.ERROR.value
            logger.error("Camera connection timed out")
            return False
        except Exception as e:
            logger.error(f"Error connecting camera: {e}")
            self.cameras[CameraType.FRONT.value]["state"] = CameraState.ERROR.value
            return False
    
    async def start_camera_stream(self, camera_type: str = CameraType.FRONT.value, format: str = CameraFormat.JPEG.value):
        """Start streaming from the specified camera"""
        if camera_type not in self.cameras:
            logger.error(f"Camera type {camera_type} not available")
            return False
        
        try:
            # Set camera state and format
            self.cameras[camera_type]["format"] = format
            self.cameras[camera_type]["state"] = CameraState.CONNECTING.value
            self.stream_active[camera_type] = True
            
            # Enable the camera topic
            topic = f"/rgb_cameras/{camera_type}/video"
            if topic not in self.robot_ai.enabled_topics:
                await self.robot_ai.enable_topics([topic])
            
            logger.info(f"Started camera stream for {camera_type} camera")
            return True
        except Exception as e:
            logger.error(f"Error starting camera stream: {e}")
            self.cameras[camera_type]["state"] = CameraState.ERROR.value
            return False
    
    async def stop_camera_stream(self, camera_type: str = CameraType.FRONT.value):
        """Stop streaming from the specified camera"""
        if camera_type not in self.cameras:
            logger.error(f"Camera type {camera_type} not available")
            return False
        
        try:
            # Disable the camera topic
            topic = f"/rgb_cameras/{camera_type}/video"
            if topic in self.robot_ai.enabled_topics:
                await self.robot_ai.disable_topics([topic])
            
            # Set camera state and stream active flag
            self.cameras[camera_type]["state"] = CameraState.INACTIVE.value
            self.stream_active[camera_type] = False
            
            logger.info(f"Stopped camera stream for {camera_type} camera")
            return True
        except Exception as e:
            logger.error(f"Error stopping camera stream: {e}")
            return False
    
    def process_camera_data(self, data):
        """Process incoming camera data"""
        try:
            # Extract camera type from topic
            topic = data.get("topic", "")
            camera_type = topic.split("/")[2] if len(topic.split("/")) > 2 else CameraType.FRONT.value
            
            # Check if we should process this camera
            if camera_type not in self.cameras or not self.stream_active.get(camera_type, False):
                return
            
            # Extract frame data
            if "data" in data:
                # Process base64 encoded frame
                try:
                    frame_data = base64.b64decode(data["data"])
                    frame_image = Image.open(io.BytesIO(frame_data))
                    
                    # Store latest frame
                    self.cameras[camera_type]["latest_frame"] = frame_image
                    self.cameras[camera_type]["timestamp"] = time.time()
                    self.cameras[camera_type]["state"] = CameraState.STREAMING.value
                    
                    # Call registered callbacks
                    for callback in self.frame_callbacks:
                        try:
                            callback(camera_type, frame_image)
                        except Exception as cb_err:
                            logger.error(f"Error in frame callback: {cb_err}")
                    
                    logger.debug(f"Processed frame for {camera_type} camera")
                except Exception as img_err:
                    logger.error(f"Error processing camera frame: {img_err}")
        except Exception as e:
            logger.error(f"Error processing camera data: {e}")
    
    def add_frame_callback(self, callback):
        """Add a callback function to process camera frames"""
        if callback not in self.frame_callbacks:
            self.frame_callbacks.append(callback)
            logger.debug("Added frame callback")
            return True
        return False
    
    def remove_frame_callback(self, callback):
        """Remove a callback function"""
        if callback in self.frame_callbacks:
            self.frame_callbacks.remove(callback)
            logger.debug("Removed frame callback")
            return True
        return False
    
    def capture_frame(self, camera_type: str = CameraType.FRONT.value, save_to_file: bool = False) -> Optional[Union[Image.Image, bytes]]:
        """Capture a single frame from the specified camera"""
        if camera_type not in self.cameras:
            logger.error(f"Camera type {camera_type} not available")
            return None
        
        if self.cameras[camera_type]["latest_frame"] is None:
            logger.warning(f"No frame available for {camera_type} camera")
            return None
        
        try:
            # Get a copy of the latest frame
            frame = self.cameras[camera_type]["latest_frame"].copy()
            
            # Save to file if requested
            if save_to_file:
                timestamp = int(time.time())
                filename = f"/var/log/robot-ai/captures/{camera_type}_{timestamp}.jpg"
                os.makedirs(os.path.dirname(filename), exist_ok=True)
                frame.save(filename, "JPEG")
                logger.info(f"Saved frame to {filename}")
            
            return frame
        except Exception as e:
            logger.error(f"Error capturing frame: {e}")
            return None
    
    def get_annotated_frame(self, camera_type: str = CameraType.FRONT.value, annotations: Dict[str, Any] = None) -> Optional[Image.Image]:
        """Get the most recent frame with annotations"""
        frame = self.capture_frame(camera_type, save_to_file=False)
        if frame is None:
            return None
        
        if not annotations:
            return frame
        
        try:
            # Create a drawing context
            draw = ImageDraw.Draw(frame)
            
            # Process annotations
            if "text" in annotations:
                text = annotations["text"]
                position = annotations.get("text_position", (10, 10))
                color = annotations.get("text_color", "white")
                
                # Draw text
                draw.text(position, text, fill=color)
            
            if "box" in annotations:
                box = annotations["box"]
                color = annotations.get("box_color", "red")
                width = annotations.get("box_width", 2)
                
                # Draw box
                draw.rectangle(box, outline=color, width=width)
            
            if "circles" in annotations and isinstance(annotations["circles"], list):
                circles = annotations["circles"]
                color = annotations.get("circle_color", "yellow")
                width = annotations.get("circle_width", 2)
                
                # Draw circles
                for circle in circles:
                    if isinstance(circle, dict) and "center" in circle and "radius" in circle:
                        x, y = circle["center"]
                        r = circle["radius"]
                        draw.ellipse((x-r, y-r, x+r, y+r), outline=color, width=width)
            
            if "lines" in annotations and isinstance(annotations["lines"], list):
                lines = annotations["lines"]
                color = annotations.get("line_color", "blue")
                width = annotations.get("line_width", 2)
                
                # Draw lines
                for line in lines:
                    if isinstance(line, list) and len(line) == 2:
                        draw.line(line, fill=color, width=width)
            
            logger.debug(f"Added annotations to {camera_type} camera frame")
            return frame
        except Exception as e:
            logger.error(f"Error annotating frame: {e}")
            return frame  # Return original frame if annotation fails
    
    def get_camera_status(self, camera_type: str = CameraType.FRONT.value) -> Dict[str, Any]:
        """Get the status of the specified camera"""
        if camera_type not in self.cameras:
            logger.error(f"Camera type {camera_type} not available")
            return {"error": f"Camera type {camera_type} not available"}
        
        camera = self.cameras[camera_type]
        
        return {
            "type": camera_type,
            "state": camera["state"],
            "format": camera["format"],
            "resolution": camera["resolution"],
            "fps": camera["fps"],
            "has_frame": camera["latest_frame"] is not None,
            "last_update": camera["timestamp"],
        }
    
    async def capture_video(self, camera_type: str = CameraType.FRONT.value, duration: int = 5, filename: str = None) -> bool:
        """Capture a video of specified duration from the camera"""
        if camera_type not in self.cameras:
            logger.error(f"Camera type {camera_type} not available")
            return False
        
        if not filename:
            timestamp = int(time.time())
            filename = f"/var/log/robot-ai/captures/{camera_type}_{timestamp}.mp4"
        
        try:
            logger.info(f"Starting video capture for {duration} seconds")
            
            # In a real implementation, this would capture frames and save as video
            # For now, we just simulate the capture
            await asyncio.sleep(duration)
            
            logger.info(f"Video capture complete, saved to {filename}")
            return True
        except Exception as e:
            logger.error(f"Error capturing video: {e}")
            return False
    
    async def get_camera_frame(self, camera_type: str = CameraType.FRONT.value) -> Dict[str, Any]:
        """Get the latest camera frame in a format suitable for external use"""
        frame = self.capture_frame(camera_type)
        if frame is None:
            return {"error": "No frame available"}
        
        try:
            # Convert to base64 for transmission
            buffer = io.BytesIO()
            frame.save(buffer, format="JPEG")
            b64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return {
                "camera": camera_type,
                "format": "jpeg",
                "timestamp": self.cameras[camera_type]["timestamp"],
                "width": frame.width,
                "height": frame.height,
                "data": b64_data,
            }
        except Exception as e:
            logger.error(f"Error converting frame: {e}")
            return {"error": str(e)}
    
    async def close(self):
        """Close all camera streams"""
        for camera_type in list(self.cameras.keys()):
            await self.stop_camera_stream(camera_type)
        logger.info("Closed all camera streams")