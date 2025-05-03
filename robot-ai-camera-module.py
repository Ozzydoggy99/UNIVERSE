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
import io
import json
import logging
import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any, Union

import requests
import websockets
from PIL import Image, ImageDraw, ImageFont

# Try to import jmuxer for h264 decoding
try:
    import jmuxer
    JMUXER_AVAILABLE = True
except ImportError:
    JMUXER_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('robot-ai-camera.log')
    ]
)
logger = logging.getLogger('robot-ai-camera')

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
    
    def __init__(self, robot_ip: str, robot_port: int = 8090, use_ssl: bool = False):
        """Initialize the Camera Module with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.ws_protocol = "wss" if use_ssl else "ws"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics"
        
        # Camera state
        self.cameras = {
            CameraType.FRONT: {
                "state": CameraState.INACTIVE,
                "last_frame": None,
                "last_frame_time": None,
                "stream_format": CameraFormat.JPEG,
                "resolution": (320, 240),
                "fps": 0,
                "frames_received": 0,
                "errors": 0
            },
            CameraType.BACK: {
                "state": CameraState.INACTIVE,
                "last_frame": None,
                "last_frame_time": None,
                "stream_format": CameraFormat.JPEG,
                "resolution": (320, 240),
                "fps": 0,
                "frames_received": 0,
                "errors": 0
            },
            CameraType.DEPTH: {
                "state": CameraState.INACTIVE,
                "last_frame": None,
                "last_frame_time": None,
                "stream_format": CameraFormat.JPEG,
                "resolution": (320, 240),
                "fps": 0,
                "frames_received": 0,
                "errors": 0
            }
        }
        
        # WebSocket connection
        self.ws = None
        self.active_streams = set()
        
        # Frame processing callbacks
        self.frame_callbacks = []
        
        # Decoder for h264 streams
        self.decoder = None if not JMUXER_AVAILABLE else jmuxer.JMuxer(mode="video", flushingTime=0)
        
        # Storage for frames
        self.frame_storage_path = os.path.join(os.getcwd(), "camera_frames")
        os.makedirs(self.frame_storage_path, exist_ok=True)
        
        logger.info(f"Camera Module initialized for robot at {self.base_url}")
    
    async def connect(self):
        """Establish connection to the robot and start monitoring camera topics"""
        logger.info(f"Connecting to robot at {self.ws_url}")
        
        try:
            self.ws = await websockets.connect(self.ws_url)
            
            logger.info("Successfully connected to robot")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to robot: {e}")
            return False
    
    async def start_camera_stream(self, camera_type: CameraType, format: CameraFormat = CameraFormat.JPEG):
        """Start streaming from the specified camera"""
        if not self.ws or self.ws.closed:
            logger.error("Cannot start camera stream: WebSocket connection not established")
            return False
        
        try:
            # Update camera state
            camera = self.cameras[camera_type]
            camera["state"] = CameraState.CONNECTING
            camera["stream_format"] = format
            
            # Enable topics based on format and camera type
            topic = None
            if format == CameraFormat.H264:
                topic = f"/rgb_cameras/{camera_type.value}/video"
            elif format == CameraFormat.JPEG:
                topic = f"/rgb_cameras/{camera_type.value}/compressed"
            elif format == CameraFormat.RAW and camera_type == CameraType.DEPTH:
                topic = f"/depth_camera/{camera_type.value}/image"
            
            if not topic:
                logger.error(f"Unsupported combination: camera={camera_type.value}, format={format.value}")
                camera["state"] = CameraState.ERROR
                return False
            
            # Enable the topic
            message = {"enable_topic": topic}
            await self.ws.send(json.dumps(message))
            
            # Add to active streams
            self.active_streams.add(topic)
            
            logger.info(f"Started {format.value} stream from {camera_type.value} camera")
            camera["state"] = CameraState.STREAMING
            return True
            
        except Exception as e:
            logger.error(f"Error starting camera stream: {e}")
            self.cameras[camera_type]["state"] = CameraState.ERROR
            return False
    
    async def stop_camera_stream(self, camera_type: CameraType):
        """Stop streaming from the specified camera"""
        if not self.ws or self.ws.closed:
            logger.error("Cannot stop camera stream: WebSocket connection not established")
            return False
        
        try:
            # Get the active topic for this camera
            camera = self.cameras[camera_type]
            format = camera["stream_format"]
            
            # Determine the topic to disable
            topic = None
            if format == CameraFormat.H264:
                topic = f"/rgb_cameras/{camera_type.value}/video"
            elif format == CameraFormat.JPEG:
                topic = f"/rgb_cameras/{camera_type.value}/compressed"
            elif format == CameraFormat.RAW and camera_type == CameraType.DEPTH:
                topic = f"/depth_camera/{camera_type.value}/image"
            
            if not topic:
                logger.error(f"No active stream found for {camera_type.value} camera")
                return False
            
            # Disable the topic
            message = {"disable_topic": topic}
            await self.ws.send(json.dumps(message))
            
            # Remove from active streams
            if topic in self.active_streams:
                self.active_streams.remove(topic)
            
            # Update camera state
            camera["state"] = CameraState.INACTIVE
            
            logger.info(f"Stopped stream from {camera_type.value} camera")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping camera stream: {e}")
            return False
    
    async def listen_for_camera_updates(self):
        """Listen for camera updates from the robot via WebSocket"""
        if not self.ws or self.ws.closed:
            logger.error("Cannot listen for camera updates: WebSocket connection not established")
            return
        
        logger.info("Starting to listen for camera updates")
        
        try:
            while True:
                try:
                    message = await self.ws.recv()
                    await self.process_camera_message(message)
                except websockets.exceptions.ConnectionClosed:
                    logger.warning("WebSocket connection closed")
                    await asyncio.sleep(2)
                    # Try to reconnect
                    connected = await self.connect()
                    if not connected:
                        await asyncio.sleep(5)
                    else:
                        # Re-enable active streams
                        for topic in self.active_streams:
                            message = {"enable_topic": topic}
                            await self.ws.send(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error processing camera message: {e}")
                    await asyncio.sleep(1)
        except asyncio.CancelledError:
            logger.info("Camera listening task cancelled")
        except Exception as e:
            logger.error(f"Unexpected error in listen_for_camera_updates: {e}")
    
    async def process_camera_message(self, message: str):
        """Process incoming WebSocket messages related to cameras"""
        try:
            data = json.loads(message)
            topic = data.get("topic")
            
            if not topic:
                return
            
            # Process RGB video streams (H264)
            if topic.startswith("/rgb_cameras/") and topic.endswith("/video"):
                camera_name = topic.split("/")[2]
                camera_type = CameraType(camera_name) if camera_name in [ct.value for ct in CameraType] else None
                
                if not camera_type:
                    logger.warning(f"Unknown camera type in topic: {topic}")
                    return
                
                # Process H264 video data
                video_data = data.get("data")
                timestamp = data.get("stamp")
                
                if not video_data:
                    logger.warning(f"No video data in message for {camera_type.value} camera")
                    return
                
                # Decode base64 data
                try:
                    binary_data = base64.b64decode(video_data)
                    
                    # If jmuxer is available, decode the H264 data
                    if JMUXER_AVAILABLE and self.decoder:
                        self.decoder.feed({video: binary_data})
                    
                    # Update camera state
                    camera = self.cameras[camera_type]
                    camera["last_frame_time"] = timestamp
                    camera["frames_received"] += 1
                    
                    # Calculate FPS
                    current_time = time.time()
                    if not hasattr(self, f"last_fps_calc_{camera_type.value}"):
                        setattr(self, f"last_fps_calc_{camera_type.value}", current_time)
                        setattr(self, f"frames_since_last_calc_{camera_type.value}", 1)
                    else:
                        last_time = getattr(self, f"last_fps_calc_{camera_type.value}")
                        frames = getattr(self, f"frames_since_last_calc_{camera_type.value}") + 1
                        
                        if current_time - last_time >= 1.0:  # Calculate FPS every second
                            camera["fps"] = frames / (current_time - last_time)
                            setattr(self, f"last_fps_calc_{camera_type.value}", current_time)
                            setattr(self, f"frames_since_last_calc_{camera_type.value}", 0)
                        else:
                            setattr(self, f"frames_since_last_calc_{camera_type.value}", frames)
                    
                    # Run frame callbacks
                    for callback in self.frame_callbacks:
                        try:
                            callback(camera_type, "h264", binary_data, timestamp)
                        except Exception as cb_error:
                            logger.error(f"Error in frame callback: {cb_error}")
                
                except Exception as decode_error:
                    logger.error(f"Error decoding H264 data: {decode_error}")
                    self.cameras[camera_type]["errors"] += 1
            
            # Process RGB image streams (JPEG)
            elif topic.startswith("/rgb_cameras/") and topic.endswith("/compressed"):
                camera_name = topic.split("/")[2]
                camera_type = CameraType(camera_name) if camera_name in [ct.value for ct in CameraType] else None
                
                if not camera_type:
                    logger.warning(f"Unknown camera type in topic: {topic}")
                    return
                
                # Process JPEG image data
                image_data = data.get("data")
                timestamp = data.get("stamp")
                format = data.get("format", "jpeg")
                
                if not image_data or format.lower() != "jpeg":
                    logger.warning(f"Invalid image data in message for {camera_type.value} camera")
                    return
                
                # Decode base64 data
                try:
                    binary_data = base64.b64decode(image_data)
                    
                    # Create PIL Image from binary data
                    image = Image.open(io.BytesIO(binary_data))
                    
                    # Update camera state
                    camera = self.cameras[camera_type]
                    camera["last_frame"] = image
                    camera["last_frame_time"] = timestamp
                    camera["resolution"] = image.size
                    camera["frames_received"] += 1
                    
                    # Calculate FPS
                    current_time = time.time()
                    if not hasattr(self, f"last_fps_calc_{camera_type.value}"):
                        setattr(self, f"last_fps_calc_{camera_type.value}", current_time)
                        setattr(self, f"frames_since_last_calc_{camera_type.value}", 1)
                    else:
                        last_time = getattr(self, f"last_fps_calc_{camera_type.value}")
                        frames = getattr(self, f"frames_since_last_calc_{camera_type.value}") + 1
                        
                        if current_time - last_time >= 1.0:  # Calculate FPS every second
                            camera["fps"] = frames / (current_time - last_time)
                            setattr(self, f"last_fps_calc_{camera_type.value}", current_time)
                            setattr(self, f"frames_since_last_calc_{camera_type.value}", 0)
                        else:
                            setattr(self, f"frames_since_last_calc_{camera_type.value}", frames)
                    
                    # Run frame callbacks
                    for callback in self.frame_callbacks:
                        try:
                            callback(camera_type, "jpeg", image, timestamp)
                        except Exception as cb_error:
                            logger.error(f"Error in frame callback: {cb_error}")
                
                except Exception as decode_error:
                    logger.error(f"Error decoding JPEG data: {decode_error}")
                    self.cameras[camera_type]["errors"] += 1
            
            # Process depth camera images
            elif topic.startswith("/depth_camera/"):
                camera_part = topic.split("/")[2]
                if camera_part == "downward" or camera_part == "upward" or camera_part == "forward":
                    camera_type = CameraType.DEPTH
                else:
                    logger.warning(f"Unknown depth camera in topic: {topic}")
                    return
                
                # Process depth image data - the format can vary depending on the robot
                # This is a simplified implementation
                image_data = data.get("data")
                timestamp = data.get("stamp")
                
                if not image_data:
                    logger.warning(f"No depth image data in message")
                    return
                
                # Update camera state (we don't fully process depth images here)
                camera = self.cameras[camera_type]
                camera["last_frame_time"] = timestamp
                camera["frames_received"] += 1
                
                # Run frame callbacks for depth data
                for callback in self.frame_callbacks:
                    try:
                        callback(camera_type, "depth", image_data, timestamp)
                    except Exception as cb_error:
                        logger.error(f"Error in frame callback: {cb_error}")
        
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON message: {message}")
        except Exception as e:
            logger.error(f"Error processing camera message: {e}")
    
    def add_frame_callback(self, callback):
        """Add a callback function to process camera frames"""
        self.frame_callbacks.append(callback)
        logger.info(f"Added frame callback: {callback.__name__}")
    
    def remove_frame_callback(self, callback):
        """Remove a callback function"""
        if callback in self.frame_callbacks:
            self.frame_callbacks.remove(callback)
            logger.info(f"Removed frame callback: {callback.__name__}")
    
    def capture_frame(self, camera_type: CameraType, save_to_file: bool = False) -> Optional[Union[Image.Image, bytes]]:
        """Capture a single frame from the specified camera"""
        camera = self.cameras[camera_type]
        
        if camera["state"] != CameraState.STREAMING:
            logger.warning(f"Camera {camera_type.value} is not streaming")
            return None
        
        # Return the most recent frame
        if camera["last_frame"] is not None:
            frame = camera["last_frame"]
            
            # Save to file if requested
            if save_to_file:
                timestamp = int(time.time())
                filename = f"{camera_type.value}_frame_{timestamp}.jpg"
                filepath = os.path.join(self.frame_storage_path, filename)
                
                frame.save(filepath, "JPEG")
                logger.info(f"Saved frame to {filepath}")
            
            return frame
        else:
            logger.warning(f"No frame available for {camera_type.value} camera")
            return None
    
    def get_annotated_frame(self, camera_type: CameraType, annotations: Dict[str, Any] = None) -> Optional[Image.Image]:
        """Get the most recent frame with annotations"""
        camera = self.cameras[camera_type]
        
        if camera["state"] != CameraState.STREAMING or camera["last_frame"] is None:
            logger.warning(f"No frame available for {camera_type.value} camera")
            return None
        
        # Create a copy of the frame for annotation
        frame = camera["last_frame"].copy()
        
        # If no annotations, return the original frame
        if not annotations:
            return frame
        
        try:
            draw = ImageDraw.Draw(frame)
            
            # Add timestamp
            if "timestamp" in annotations and annotations["timestamp"]:
                timestamp = camera["last_frame_time"]
                if timestamp:
                    timestamp_str = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
                    draw.text((10, 10), timestamp_str, fill=(255, 255, 255))
            
            # Add FPS counter
            if "fps" in annotations and annotations["fps"]:
                fps = camera["fps"]
                draw.text((10, 30), f"FPS: {fps:.1f}", fill=(255, 255, 255))
            
            # Add bounding boxes
            if "boxes" in annotations and annotations["boxes"]:
                for box in annotations["boxes"]:
                    x1, y1, x2, y2 = box["coords"]
                    label = box.get("label", "")
                    confidence = box.get("confidence", 1.0)
                    
                    # Draw box
                    draw.rectangle((x1, y1, x2, y2), outline=(0, 255, 0), width=2)
                    
                    # Draw label
                    if label:
                        draw.text((x1, y1 - 15), f"{label} {confidence:.2f}", fill=(0, 255, 0))
            
            # Add custom text annotations
            if "text" in annotations and annotations["text"]:
                for text_item in annotations["text"]:
                    text = text_item["text"]
                    position = text_item.get("position", (10, 50))
                    color = text_item.get("color", (255, 255, 255))
                    
                    draw.text(position, text, fill=color)
            
            return frame
            
        except Exception as e:
            logger.error(f"Error adding annotations to frame: {e}")
            return camera["last_frame"]
    
    def get_camera_status(self, camera_type: CameraType) -> Dict[str, Any]:
        """Get the status of the specified camera"""
        camera = self.cameras[camera_type]
        
        return {
            "state": camera["state"].value,
            "format": camera["stream_format"].value,
            "resolution": camera["resolution"],
            "fps": camera["fps"],
            "frames_received": camera["frames_received"],
            "errors": camera["errors"],
            "last_frame_time": camera["last_frame_time"]
        }
    
    async def capture_video(self, camera_type: CameraType, duration: int, filename: str = None) -> bool:
        """Capture a video of specified duration from the camera"""
        camera = self.cameras[camera_type]
        
        if camera["state"] != CameraState.STREAMING:
            logger.warning(f"Camera {camera_type.value} is not streaming")
            return False
        
        # Generate filename if not provided
        if not filename:
            timestamp = int(time.time())
            filename = f"{camera_type.value}_video_{timestamp}.mp4"
        
        filepath = os.path.join(self.frame_storage_path, filename)
        
        logger.info(f"Starting video capture for {duration} seconds to {filepath}")
        
        # Create a video writer
        try:
            # For simplicity, we'll just save frames and compile them later
            frames = []
            start_time = time.time()
            
            while time.time() - start_time < duration:
                if camera["last_frame"] is not None:
                    frames.append(camera["last_frame"].copy())
                
                await asyncio.sleep(1.0 / max(1, camera["fps"]))
            
            if not frames:
                logger.warning(f"No frames captured during video recording")
                return False
            
            # Save frames as a video using ffmpeg if available
            try:
                # Save frames as temporary images
                temp_dir = os.path.join(self.frame_storage_path, "temp")
                os.makedirs(temp_dir, exist_ok=True)
                
                for i, frame in enumerate(frames):
                    frame_path = os.path.join(temp_dir, f"frame_{i:05d}.jpg")
                    frame.save(frame_path, "JPEG")
                
                # Use ffmpeg to create video
                ffmpeg_cmd = [
                    "ffmpeg",
                    "-y",  # Overwrite output file if it exists
                    "-framerate", str(camera["fps"]),
                    "-i", os.path.join(temp_dir, "frame_%05d.jpg"),
                    "-c:v", "libx264",
                    "-pix_fmt", "yuv420p",
                    filepath
                ]
                
                subprocess.run(ffmpeg_cmd, check=True)
                
                # Clean up temporary files
                for i in range(len(frames)):
                    os.remove(os.path.join(temp_dir, f"frame_{i:05d}.jpg"))
                
                logger.info(f"Video saved to {filepath}")
                return True
                
            except subprocess.CalledProcessError as e:
                logger.error(f"FFmpeg error: {e}")
                return False
            except Exception as e:
                logger.error(f"Error creating video: {e}")
                return False
            
        except Exception as e:
            logger.error(f"Error during video capture: {e}")
            return False
    
    async def close(self):
        """Close the connection to the robot"""
        # Stop all active streams
        for camera_type in CameraType:
            if self.cameras[camera_type]["state"] == CameraState.STREAMING:
                await self.stop_camera_stream(camera_type)
        
        # Close WebSocket connection
        if self.ws and not self.ws.closed:
            await self.ws.close()
            logger.info("WebSocket connection closed")
        
        logger.info("Camera Module closed")


async def main():
    """Main entry point for the Camera Module"""
    # Get robot IP from environment variable or use default
    robot_ip = os.getenv("ROBOT_IP", "192.168.25.25")
    robot_port = int(os.getenv("ROBOT_PORT", "8090"))
    
    # Create camera module instance
    camera_module = CameraModule(robot_ip=robot_ip, robot_port=robot_port)
    
    # Set up clean shutdown
    def handle_shutdown(sig=None, frame=None):
        logger.info("Shutdown signal received")
        asyncio.create_task(camera_module.close())
        sys.exit(0)
    
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    # Connect to robot
    connected = await camera_module.connect()
    if not connected:
        logger.error("Failed to connect to robot, exiting")
        sys.exit(1)
    
    # Start streaming from front camera
    stream_started = await camera_module.start_camera_stream(CameraType.FRONT, CameraFormat.JPEG)
    if not stream_started:
        logger.error("Failed to start camera stream, exiting")
        await camera_module.close()
        sys.exit(1)
    
    # Start listening for camera updates
    try:
        await camera_module.listen_for_camera_updates()
    except KeyboardInterrupt:
        logger.info("Camera module interrupted, shutting down")
    finally:
        await camera_module.close()


if __name__ == "__main__":
    asyncio.run(main())