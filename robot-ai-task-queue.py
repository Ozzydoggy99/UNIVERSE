#!/usr/bin/env python3
"""
Robot AI - Task Queue Management Module
This module provides task queue management for the robot, including:
- Task creation and prioritization
- FIFO queue management
- Task scheduling and execution
- Progress tracking and reporting
- Error handling and recovery

Author: AI Assistant
Version: 1.0.0
"""

import asyncio
import json
import logging
import os
import signal
import sys
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any, Union, Callable
import requests
import websockets

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('robot-ai-tasks.log')
    ]
)
logger = logging.getLogger('robot-ai-tasks')

class TaskState(Enum):
    """Task state enum"""
    QUEUED = "queued"
    PREPARING = "preparing"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TaskPriority(Enum):
    """Task priority enum"""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3

class TaskType(Enum):
    """Task type enum"""
    MOVE = "move"
    MAPPING = "mapping"
    ELEVATOR = "elevator"
    DOOR = "door"
    JACK_UP = "jack_up"
    JACK_DOWN = "jack_down"
    CHARGE = "charge"
    FOLLOW_ROUTE = "follow_route"
    CUSTOM = "custom"

@dataclass
class Task:
    """Task data class"""
    id: str
    type: TaskType
    params: Dict[str, Any]
    priority: TaskPriority
    state: TaskState
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    progress: float = 0.0
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    dependencies: List[str] = field(default_factory=list)
    callbacks: List[Callable] = field(default_factory=list)
    retry_count: int = 0
    max_retries: int = 3
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary for serialization"""
        result = {
            "id": self.id,
            "type": self.type.value,
            "params": self.params,
            "priority": self.priority.value,
            "state": self.state.value,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "progress": self.progress,
            "error": self.error,
            "result": self.result,
            "dependencies": self.dependencies,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries
        }
        # Callbacks can't be serialized, so we exclude them
        return result

class TaskQueueManager:
    """Task Queue Manager for Robot AI"""
    
    def __init__(self, robot_ip: str, robot_port: int = 8090, robot_sn: str = None, use_ssl: bool = False):
        """Initialize the Task Queue Manager with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.robot_sn = robot_sn
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.ws_protocol = "wss" if use_ssl else "ws"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics"
        
        # Task queues
        self.task_queue: List[Task] = []  # FIFO queue
        self.current_task: Optional[Task] = None
        self.completed_tasks: List[Task] = []
        self.failed_tasks: List[Task] = []
        
        # Queue processing
        self.processing_enabled = False
        self.queue_processing_interval = 1.0  # seconds
        
        # Task execution handlers
        self.task_handlers = {
            TaskType.MOVE: self._handle_move_task,
            TaskType.MAPPING: self._handle_mapping_task,
            TaskType.ELEVATOR: self._handle_elevator_task,
            TaskType.DOOR: self._handle_door_task,
            TaskType.JACK_UP: self._handle_jack_task,
            TaskType.JACK_DOWN: self._handle_jack_task,
            TaskType.CHARGE: self._handle_charge_task,
            TaskType.FOLLOW_ROUTE: self._handle_follow_route_task,
            TaskType.CUSTOM: self._handle_custom_task
        }
        
        # Robot state
        self.robot_position = [0, 0]
        self.robot_orientation = 0
        self.battery_state = {"percentage": 0, "power_supply_status": "unknown"}
        
        # WebSocket connection
        self.ws = None
        
        # Background tasks
        self.queue_processor = None
        self.websocket_listener = None
        
        logger.info(f"Task Queue Manager initialized for robot at {self.base_url}")
    
    async def connect(self):
        """Establish connection to the robot"""
        logger.info(f"Connecting to robot at {self.ws_url}")
        
        try:
            self.ws = await websockets.connect(self.ws_url)
            
            # Enable essential topics
            message = {"enable_topic": [
                "/tracked_pose",
                "/battery_state",
                "/planning_state"
            ]}
            await self.ws.send(json.dumps(message))
            
            logger.info("Successfully connected to robot")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to robot: {e}")
            return False
    
    async def start(self):
        """Start the task queue manager"""
        # Connect to robot if not already connected
        if not self.ws or self.ws.closed:
            connected = await self.connect()
            if not connected:
                logger.error("Failed to connect to robot, can't start task queue manager")
                return False
        
        # Start WebSocket listener
        self.websocket_listener = asyncio.create_task(self._websocket_listener())
        
        # Enable queue processing
        self.processing_enabled = True
        self.queue_processor = asyncio.create_task(self._process_queue())
        
        logger.info("Task Queue Manager started")
        return True
    
    async def stop(self):
        """Stop the task queue manager"""
        # Disable queue processing
        self.processing_enabled = False
        
        # Cancel background tasks
        if self.queue_processor and not self.queue_processor.done():
            self.queue_processor.cancel()
        
        if self.websocket_listener and not self.websocket_listener.done():
            self.websocket_listener.cancel()
        
        # Close WebSocket connection
        if self.ws and not self.ws.closed:
            await self.ws.close()
            logger.info("WebSocket connection closed")
        
        logger.info("Task Queue Manager stopped")
    
    async def _websocket_listener(self):
        """Listen for WebSocket messages and update robot state"""
        try:
            while True:
                try:
                    message = await self.ws.recv()
                    await self._process_websocket_message(message)
                except websockets.exceptions.ConnectionClosed:
                    logger.warning("WebSocket connection closed")
                    await asyncio.sleep(2)
                    # Try to reconnect
                    connected = await self.connect()
                    if not connected:
                        await asyncio.sleep(5)
                except Exception as e:
                    logger.error(f"Error processing WebSocket message: {e}")
                    await asyncio.sleep(1)
        except asyncio.CancelledError:
            logger.info("WebSocket listener cancelled")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in websocket_listener: {e}")
    
    async def _process_websocket_message(self, message: str):
        """Process incoming WebSocket messages"""
        try:
            data = json.loads(message)
            topic = data.get("topic")
            
            if not topic:
                return
            
            # Process based on topic
            if topic == "/tracked_pose":
                # Update robot position
                self.robot_position = data.get("pos", [0, 0])
                self.robot_orientation = data.get("ori", 0)
                
            elif topic == "/battery_state":
                # Update battery state
                self.battery_state = {
                    "percentage": data.get("percentage", 0),
                    "power_supply_status": data.get("power_supply_status", "unknown"),
                    "voltage": data.get("voltage", 0),
                    "current": data.get("current", 0)
                }
                
            elif topic == "/planning_state":
                # Update movement state
                if not self.current_task:
                    return
                
                move_state = data.get("move_state")
                action_id = data.get("action_id")
                
                # Only process updates for move-related tasks
                if self.current_task.type not in [TaskType.MOVE, TaskType.FOLLOW_ROUTE, 
                                                  TaskType.ELEVATOR, TaskType.CHARGE]:
                    return
                
                # Check if this update is for our current task
                task_action_id = self.current_task.params.get("action_id")
                if not task_action_id or task_action_id != action_id:
                    return
                
                if move_state == "moving":
                    # Update progress based on remaining distance
                    remaining_distance = data.get("remaining_distance", 0)
                    if "total_distance" in self.current_task.params:
                        total_distance = self.current_task.params["total_distance"]
                        progress = max(0, min(1, 1 - (remaining_distance / total_distance)))
                        self.current_task.progress = progress
                
                elif move_state == "succeeded":
                    await self._complete_current_task({"status": "success"})
                
                elif move_state == "failed":
                    fail_reason = data.get("fail_reason_str", "Unknown")
                    await self._fail_current_task(f"Move action failed: {fail_reason}")
                
                elif move_state == "cancelled":
                    await self._cancel_current_task("Move action cancelled")
        
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON message: {message}")
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {e}")
    
    async def _process_queue(self):
        """Process the task queue"""
        try:
            while self.processing_enabled:
                # If there's no current task and the queue is not empty, start the next task
                if not self.current_task and self.task_queue:
                    # Sort queue by priority (higher value = higher priority)
                    self.task_queue.sort(key=lambda t: t.priority.value, reverse=True)
                    
                    # Get next task that has all dependencies satisfied
                    next_task = None
                    for task in self.task_queue:
                        # Check if all dependencies are completed
                        deps_satisfied = True
                        for dep_id in task.dependencies:
                            # Check if dependency is in completed tasks
                            if not any(t.id == dep_id and t.state == TaskState.COMPLETED 
                                      for t in self.completed_tasks):
                                deps_satisfied = False
                                break
                        
                        if deps_satisfied:
                            next_task = task
                            break
                    
                    if next_task:
                        # Remove from queue and set as current task
                        self.task_queue.remove(next_task)
                        self.current_task = next_task
                        
                        # Start task execution
                        self.current_task.state = TaskState.PREPARING
                        self.current_task.started_at = time.time()
                        
                        # Execute task in a separate task to avoid blocking the queue processor
                        asyncio.create_task(self._execute_task(self.current_task))
                
                await asyncio.sleep(self.queue_processing_interval)
                
        except asyncio.CancelledError:
            logger.info("Queue processor cancelled")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in process_queue: {e}")
    
    async def _execute_task(self, task: Task):
        """Execute a task"""
        logger.info(f"Executing task {task.id} of type {task.type.value}")
        
        try:
            # Set task state to in progress
            task.state = TaskState.IN_PROGRESS
            
            # Call the appropriate handler for this task type
            if task.type in self.task_handlers:
                handler = self.task_handlers[task.type]
                await handler(task)
            else:
                await self._fail_current_task(f"No handler for task type {task.type.value}")
                
        except Exception as e:
            logger.error(f"Error executing task {task.id}: {e}")
            await self._fail_current_task(str(e))
    
    async def _complete_current_task(self, result: Dict[str, Any] = None):
        """Complete the current task"""
        if not self.current_task:
            return
        
        task = self.current_task
        task.state = TaskState.COMPLETED
        task.completed_at = time.time()
        task.progress = 1.0
        task.result = result
        
        logger.info(f"Task {task.id} completed")
        
        # Call task callbacks
        for callback in task.callbacks:
            try:
                callback(task)
            except Exception as e:
                logger.error(f"Error in task callback: {e}")
        
        # Move to completed tasks
        self.completed_tasks.append(task)
        self.current_task = None
    
    async def _fail_current_task(self, error: str):
        """Fail the current task"""
        if not self.current_task:
            return
        
        task = self.current_task
        task.error = error
        
        # Check if we should retry
        if task.retry_count < task.max_retries:
            logger.info(f"Task {task.id} failed, retrying ({task.retry_count + 1}/{task.max_retries}): {error}")
            
            # Increment retry count and requeue
            task.retry_count += 1
            task.state = TaskState.QUEUED
            self.task_queue.append(task)
            self.current_task = None
        else:
            logger.error(f"Task {task.id} failed after {task.retry_count} retries: {error}")
            
            task.state = TaskState.FAILED
            task.completed_at = time.time()
            
            # Call task callbacks
            for callback in task.callbacks:
                try:
                    callback(task)
                except Exception as e:
                    logger.error(f"Error in task callback: {e}")
            
            # Move to failed tasks
            self.failed_tasks.append(task)
            self.current_task = None
    
    async def _cancel_current_task(self, reason: str):
        """Cancel the current task"""
        if not self.current_task:
            return
        
        task = self.current_task
        task.state = TaskState.CANCELLED
        task.completed_at = time.time()
        task.error = reason
        
        logger.info(f"Task {task.id} cancelled: {reason}")
        
        # Call task callbacks
        for callback in task.callbacks:
            try:
                callback(task)
            except Exception as e:
                logger.error(f"Error in task callback: {e}")
        
        # Move to failed tasks (cancelled tasks are also considered failed)
        self.failed_tasks.append(task)
        self.current_task = None
    
    async def create_task(self, 
                        task_type: TaskType, 
                        params: Dict[str, Any], 
                        priority: TaskPriority = TaskPriority.NORMAL,
                        dependencies: List[str] = None,
                        callbacks: List[Callable] = None,
                        max_retries: int = 3) -> str:
        """
        Create a new task and add it to the queue
        
        Args:
            task_type: Type of task to create
            params: Parameters for the task
            priority: Priority level for the task
            dependencies: List of task IDs that must complete before this task
            callbacks: List of callback functions to call when task completes or fails
            max_retries: Maximum number of times to retry the task on failure
            
        Returns:
            str: ID of the created task
        """
        task_id = str(uuid.uuid4())
        
        task = Task(
            id=task_id,
            type=task_type,
            params=params,
            priority=priority,
            state=TaskState.QUEUED,
            created_at=time.time(),
            dependencies=dependencies or [],
            callbacks=callbacks or [],
            max_retries=max_retries
        )
        
        self.task_queue.append(task)
        logger.info(f"Created task {task_id} of type {task_type.value} with priority {priority.value}")
        
        return task_id
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID"""
        # Check current task
        if self.current_task and self.current_task.id == task_id:
            return self.current_task
        
        # Check queued tasks
        for task in self.task_queue:
            if task.id == task_id:
                return task
        
        # Check completed tasks
        for task in self.completed_tasks:
            if task.id == task_id:
                return task
        
        # Check failed tasks
        for task in self.failed_tasks:
            if task.id == task_id:
                return task
        
        return None
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get the status of a task"""
        task = self.get_task(task_id)
        
        if not task:
            return {"error": f"Task {task_id} not found"}
        
        return task.to_dict()
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get the status of the task queue"""
        return {
            "current_task": self.current_task.to_dict() if self.current_task else None,
            "queue_length": len(self.task_queue),
            "completed_tasks": len(self.completed_tasks),
            "failed_tasks": len(self.failed_tasks),
            "processing_enabled": self.processing_enabled
        }
    
    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a task by ID"""
        # Check if it's the current task
        if self.current_task and self.current_task.id == task_id:
            # For move tasks, we need to cancel the robot's move action
            if self.current_task.type in [TaskType.MOVE, TaskType.FOLLOW_ROUTE, 
                                         TaskType.ELEVATOR, TaskType.CHARGE]:
                await self._cancel_robot_move()
            
            await self._cancel_current_task("Cancelled by user")
            return True
        
        # Check queued tasks
        for task in self.task_queue:
            if task.id == task_id:
                task.state = TaskState.CANCELLED
                task.completed_at = time.time()
                task.error = "Cancelled by user"
                
                # Call task callbacks
                for callback in task.callbacks:
                    try:
                        callback(task)
                    except Exception as e:
                        logger.error(f"Error in task callback: {e}")
                
                # Remove from queue and add to failed tasks
                self.task_queue.remove(task)
                self.failed_tasks.append(task)
                
                logger.info(f"Cancelled queued task {task_id}")
                return True
        
        logger.warning(f"Task {task_id} not found for cancellation")
        return False
    
    async def pause_queue(self) -> bool:
        """Pause the task queue"""
        if not self.processing_enabled:
            logger.warning("Task queue is already paused")
            return False
        
        self.processing_enabled = False
        logger.info("Task queue paused")
        return True
    
    async def resume_queue(self) -> bool:
        """Resume the task queue"""
        if self.processing_enabled:
            logger.warning("Task queue is already running")
            return False
        
        self.processing_enabled = True
        
        # Restart queue processor if needed
        if not self.queue_processor or self.queue_processor.done():
            self.queue_processor = asyncio.create_task(self._process_queue())
        
        logger.info("Task queue resumed")
        return True
    
    async def clear_queue(self) -> int:
        """Clear all queued tasks"""
        count = len(self.task_queue)
        
        # Cancel all queued tasks
        for task in self.task_queue:
            task.state = TaskState.CANCELLED
            task.completed_at = time.time()
            task.error = "Queue cleared"
            
            # Call task callbacks
            for callback in task.callbacks:
                try:
                    callback(task)
                except Exception as e:
                    logger.error(f"Error in task callback: {e}")
            
            # Add to failed tasks
            self.failed_tasks.append(task)
        
        # Clear the queue
        self.task_queue = []
        
        logger.info(f"Cleared {count} tasks from queue")
        return count
    
    async def _cancel_robot_move(self) -> bool:
        """Cancel the current robot move action"""
        try:
            url = f"{self.base_url}/chassis/moves/current"
            response = requests.patch(url, json={"state": "cancelled"})
            
            if response.status_code == 200:
                logger.info("Successfully cancelled robot move action")
                return True
            else:
                logger.error(f"Failed to cancel move: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error cancelling robot move: {e}")
            return False
    
    # Task handlers
    async def _handle_move_task(self, task: Task):
        """Handle a move task"""
        params = task.params
        
        # Extract parameters
        target_x = params.get("target_x")
        target_y = params.get("target_y")
        target_ori = params.get("target_ori")  # Optional
        move_type = params.get("move_type", "standard")
        
        if target_x is None or target_y is None:
            await self._fail_current_task("Missing target coordinates")
            return
        
        try:
            # Create move action
            url = f"{self.base_url}/chassis/moves"
            
            payload = {
                "creator": "task-manager",
                "type": move_type,
                "target_x": target_x,
                "target_y": target_y
            }
            
            if target_ori is not None:
                payload["target_ori"] = target_ori
                
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                action_id = result.get("id")
                logger.info(f"Created move action {action_id} to ({target_x}, {target_y})")
                
                # Store action ID in task params for tracking
                task.params["action_id"] = action_id
                
                # Calculate approximate total distance for progress tracking
                current_x, current_y = self.robot_position
                distance = ((target_x - current_x) ** 2 + (target_y - current_y) ** 2) ** 0.5
                task.params["total_distance"] = distance
                
                # The task will be completed by the WebSocket message handler
                # when the move action succeeds or fails
            else:
                await self._fail_current_task(f"Failed to create move action: {response.status_code} {response.text}")
                
        except Exception as e:
            await self._fail_current_task(f"Error creating move action: {e}")
    
    async def _handle_mapping_task(self, task: Task):
        """Handle a mapping task"""
        params = task.params
        
        # Extract parameters
        continue_mapping = params.get("continue_mapping", False)
        map_name = params.get("map_name")
        
        try:
            # Start mapping
            url = f"{self.base_url}/mappings/"
            payload = {"continue_mapping": continue_mapping}
            
            start_response = requests.post(url, json=payload)
            
            if start_response.status_code != 200:
                await self._fail_current_task(f"Failed to start mapping: {start_response.status_code} {start_response.text}")
                return
            
            mapping_result = start_response.json()
            mapping_id = mapping_result.get("id")
            logger.info(f"Started mapping task {mapping_id}")
            
            # Store mapping ID in task params
            task.params["mapping_id"] = mapping_id
            
            # Wait for mapping to complete (this would be controlled by the user in reality)
            # Here we use a timeout as a safety measure
            timeout = params.get("timeout", 300)  # 5 minutes default
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                # Check if task was cancelled
                if task.state == TaskState.CANCELLED:
                    return
                
                # Update progress based on elapsed time
                progress = min(0.99, (time.time() - start_time) / timeout)
                task.progress = progress
                
                # Check for mapping completion signal
                if params.get("_mapping_completed", False):
                    break
                
                await asyncio.sleep(1)
            
            # Finish mapping
            url = f"{self.base_url}/mappings/current"
            finish_response = requests.patch(url, json={"state": "finished"})
            
            if finish_response.status_code != 200:
                await self._fail_current_task(f"Failed to finish mapping: {finish_response.status_code} {finish_response.text}")
                return
            
            # Save as map if requested
            if map_name:
                save_url = f"{self.base_url}/maps/"
                save_payload = {
                    "map_name": map_name,
                    "mapping_id": mapping_id
                }
                
                save_response = requests.post(save_url, json=save_payload)
                
                if save_response.status_code == 200:
                    map_result = save_response.json()
                    map_id = map_result.get("id")
                    logger.info(f"Saved mapping {mapping_id} as map {map_id}")
                    
                    await self._complete_current_task({
                        "mapping_id": mapping_id,
                        "map_id": map_id,
                        "map_name": map_name
                    })
                else:
                    await self._fail_current_task(f"Failed to save map: {save_response.status_code} {save_response.text}")
            else:
                await self._complete_current_task({"mapping_id": mapping_id})
                
        except Exception as e:
            await self._fail_current_task(f"Error during mapping: {e}")
    
    async def _handle_elevator_task(self, task: Task):
        """Handle an elevator task"""
        params = task.params
        
        # Extract parameters
        elevator_id = params.get("elevator_id")
        target_floor = params.get("target_floor")
        
        if not elevator_id or target_floor is None:
            await self._fail_current_task("Missing elevator ID or target floor")
            return
        
        try:
            # Create multi-floor navigation sequence
            # This would involve a sequence of move actions and API calls
            # For demonstration, we'll use a move action to simulate elevator navigation
            url = f"{self.base_url}/chassis/moves"
            
            # Use target coordinates from params if available,
            # otherwise use a placeholder destination
            target_x = params.get("target_x", 0.0)
            target_y = params.get("target_y", 0.0)
            
            payload = {
                "creator": "task-manager",
                "type": "standard",  # In reality, would use elevator-specific move types
                "target_x": target_x,
                "target_y": target_y
            }
                
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                action_id = result.get("id")
                logger.info(f"Created elevator navigation action {action_id} to floor {target_floor}")
                
                # Store action ID in task params for tracking
                task.params["action_id"] = action_id
                
                # The task will be completed by the WebSocket message handler
                # when the move action succeeds or fails
            else:
                await self._fail_current_task(f"Failed to create elevator navigation: {response.status_code} {response.text}")
                
        except Exception as e:
            await self._fail_current_task(f"Error creating elevator navigation: {e}")
    
    async def _handle_door_task(self, task: Task):
        """Handle a door task"""
        params = task.params
        
        # Extract parameters
        door_id = params.get("door_id")
        
        if not door_id:
            await self._fail_current_task("Missing door ID")
            return
        
        try:
            # Send door open command via ESP-NOW
            # This would require integration with the IoT module
            # For demonstration, we'll simulate success
            logger.info(f"Requesting door {door_id} to open")
            
            # Simulate door open request
            await asyncio.sleep(1)
            
            # Complete the task
            await self._complete_current_task({"door_id": door_id, "status": "opening"})
                
        except Exception as e:
            await self._fail_current_task(f"Error requesting door to open: {e}")
    
    async def _handle_jack_task(self, task: Task):
        """Handle a jack up/down task"""
        jack_action = "jack_up" if task.type == TaskType.JACK_UP else "jack_down"
        
        try:
            # Call jack service
            url = f"{self.base_url}/services/{jack_action}"
            response = requests.post(url)
            
            if response.status_code == 200:
                logger.info(f"Successfully initiated {jack_action} operation")
                
                # Wait for jack operation to complete
                max_wait = 30  # seconds
                start_time = time.time()
                
                while time.time() - start_time < max_wait:
                    # Check if task was cancelled
                    if task.state == TaskState.CANCELLED:
                        return
                    
                    # Update progress based on elapsed time
                    progress = min(0.99, (time.time() - start_time) / max_wait)
                    task.progress = progress
                    
                    # In reality, we would check the jack state from WebSocket
                    # Here we'll just wait a bit
                    await asyncio.sleep(1)
                
                await self._complete_current_task({"action": jack_action, "status": "completed"})
            else:
                await self._fail_current_task(f"Failed to {jack_action}: {response.status_code} {response.text}")
                
        except Exception as e:
            await self._fail_current_task(f"Error during {jack_action}: {e}")
    
    async def _handle_charge_task(self, task: Task):
        """Handle a charge task"""
        params = task.params
        
        try:
            # Create charge move action
            url = f"{self.base_url}/chassis/moves"
            
            payload = {
                "creator": "task-manager",
                "type": "charge"
            }
            
            # Add optional parameters if provided
            if "charge_retry_count" in params:
                payload["charge_retry_count"] = params["charge_retry_count"]
                
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                action_id = result.get("id")
                logger.info(f"Created charge action {action_id}")
                
                # Store action ID in task params for tracking
                task.params["action_id"] = action_id
                
                # The task will be completed by the WebSocket message handler
                # when the move action succeeds or fails
            else:
                await self._fail_current_task(f"Failed to create charge action: {response.status_code} {response.text}")
                
        except Exception as e:
            await self._fail_current_task(f"Error creating charge action: {e}")
    
    async def _handle_follow_route_task(self, task: Task):
        """Handle a follow route task"""
        params = task.params
        
        # Extract parameters
        coordinates = params.get("coordinates")
        detour_tolerance = params.get("detour_tolerance", 0.5)
        
        if not coordinates or len(coordinates) < 2:
            await self._fail_current_task("Invalid route coordinates")
            return
        
        try:
            # Convert coordinates to the required format (comma-separated string)
            route_coords = []
            for point in coordinates:
                if len(point) >= 2:
                    route_coords.extend([point[0], point[1]])
            
            route_coordinates = ", ".join(map(str, route_coords))
            
            # Create move action
            url = f"{self.base_url}/chassis/moves"
            
            payload = {
                "creator": "task-manager",
                "type": "along_given_route",
                "route_coordinates": route_coordinates,
                "detour_tolerance": detour_tolerance
            }
                
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                action_id = result.get("id")
                logger.info(f"Created route following action {action_id} with {len(coordinates)} points")
                
                # Store action ID in task params for tracking
                task.params["action_id"] = action_id
                
                # Calculate approximate total distance for progress tracking
                total_distance = 0
                for i in range(len(coordinates) - 1):
                    x1, y1 = coordinates[i]
                    x2, y2 = coordinates[i + 1]
                    segment_distance = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
                    total_distance += segment_distance
                
                task.params["total_distance"] = total_distance
                
                # The task will be completed by the WebSocket message handler
                # when the move action succeeds or fails
            else:
                await self._fail_current_task(f"Failed to create route following action: {response.status_code} {response.text}")
                
        except Exception as e:
            await self._fail_current_task(f"Error creating route following action: {e}")
    
    async def _handle_custom_task(self, task: Task):
        """Handle a custom task"""
        params = task.params
        
        # Extract parameters
        handler_function = params.get("handler")
        
        if not handler_function or not callable(handler_function):
            await self._fail_current_task("Invalid custom task handler")
            return
        
        try:
            # Call the custom handler function
            result = await handler_function(task, self)
            
            if result.get("success", False):
                await self._complete_current_task(result)
            else:
                await self._fail_current_task(result.get("error", "Custom task failed"))
                
        except Exception as e:
            await self._fail_current_task(f"Error executing custom task: {e}")


async def main():
    """Main entry point for the Task Queue Manager"""
    # Get robot IP and SN from environment variables or use defaults
    robot_ip = os.getenv("ROBOT_IP", "192.168.25.25")
    robot_port = int(os.getenv("ROBOT_PORT", "8090"))
    robot_sn = os.getenv("ROBOT_SN", "L382502104987ir")
    
    # Create task queue manager instance
    manager = TaskQueueManager(robot_ip=robot_ip, robot_port=robot_port, robot_sn=robot_sn)
    
    # Set up clean shutdown
    def handle_shutdown(sig=None, frame=None):
        logger.info("Shutdown signal received")
        asyncio.create_task(manager.stop())
        sys.exit(0)
    
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    # Start the task queue manager
    started = await manager.start()
    if not started:
        logger.error("Failed to start task queue manager, exiting")
        sys.exit(1)
    
    # Create example tasks
    move_task_id = await manager.create_task(
        task_type=TaskType.MOVE,
        params={
            "target_x": 1.0,
            "target_y": 2.0
        },
        priority=TaskPriority.NORMAL
    )
    
    # Wait for tasks to complete
    try:
        while True:
            # Check if there are any tasks still in the queue or in progress
            if (not manager.task_queue and 
                not manager.current_task and 
                len(manager.completed_tasks) > 0):
                logger.info("All tasks completed")
                
                # In a real application, we would keep running or wait for new tasks
                # Here we'll exit after a short delay
                await asyncio.sleep(2)
                break
            
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("Task Queue Manager interrupted, shutting down")
    finally:
        await manager.stop()


if __name__ == "__main__":
    asyncio.run(main())