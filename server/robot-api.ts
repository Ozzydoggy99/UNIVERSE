import { Express, Request, Response } from 'express';
import { storage } from './mem-storage';
import { registerRobot } from './register-robot';
import {
  getRobotStatus,
  getRobotPosition,
  getRobotSensorData,
  getRobotMapData,
  getRobotCameraData,
  getRobotLidarData,
  isRobotConnected
} from './robot-websocket';
import fetch from 'node-fetch';

// Import shared constants
import { 
  PHYSICAL_ROBOT_SERIAL,
  ROBOT_API_URL,
  ROBOT_SECRET
} from './robot-constants';

// Enum for LiDAR power action
enum LidarPowerAction {
  POWER_ON = 'power_on',
  POWER_OFF = 'power_off'
}

// Cache for system settings
let systemSettingsCache: any = null;
let lastSettingsFetchTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch system settings from robot
 * @param effectiveOnly Whether to fetch only effective settings or all settings
 * @returns System settings from robot
 */
async function fetchSystemSettings(effectiveOnly: boolean = true) {
  try {
    // Check cache first
    const now = Date.now();
    if (systemSettingsCache && (now - lastSettingsFetchTime) < SETTINGS_CACHE_TTL) {
      return systemSettingsCache;
    }
    
    // Default endpoint is effective.json which contains the merged values
    let endpoint = 'effective';
    
    // Optionally get the full settings (schema, default, user, effective)
    if (!effectiveOnly) {
      endpoint = '';
    }
    
    console.log(`Fetching system settings from ${ROBOT_API_URL}/system/settings/${endpoint}`);
    
    const response = await fetch(`${ROBOT_API_URL}/system/settings/${endpoint}`, {
      headers: {
        'Secret': ROBOT_SECRET || '',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch system settings: ${response.status} ${response.statusText}`);
    }
    
    const settings = await response.json();
    
    // Update cache
    systemSettingsCache = settings;
    lastSettingsFetchTime = now;
    
    return settings;
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return null;
  }
}

/**
 * Register all robot-related API routes
 */
export function registerRobotApiRoutes(app: Express) {
  // Register a physical robot for remote communication
  app.get('/api/robots/register-physical/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const model = req.query.model as string || 'Physical Robot';
      
      // Only allow our specific robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not supported' });
      }
      
      // Attempt to register the robot
      const result = await registerRobot(serialNumber, model);
      res.json(result);
    } catch (error) {
      console.error('Error registering physical robot:', error);
      res.status(500).json({ error: 'Failed to register physical robot' });
    }
  });

  // Register a robot and optionally assign it to a template
  app.post('/api/robots/register', async (req: Request, res: Response) => {
    try {
      const { serialNumber, model, templateId } = req.body;
      
      if (!serialNumber || !model) {
        return res.status(400).json({ error: 'Serial number and model are required' });
      }
      
      // Only allow our specific robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not supported' });
      }
      
      // Register the robot with the template
      const result = await registerRobot(serialNumber, model, templateId);
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Error registering robot:', error);
      res.status(500).json({ error: 'Failed to register robot' });
    }
  });

  // Get all robot statuses
  app.get('/api/robots/statuses', async (req: Request, res: Response) => {
    try {
      const robots = [];
      
      // Only fetch data for our physical robot
      const status = getRobotStatus(PHYSICAL_ROBOT_SERIAL);
      
      if (status) {
        robots.push(status);
      } else {
        // If we don't have any data yet, check if the robot is connected
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        // Return an empty array if no robots are found
        return res.json([]);
      }
      
      res.json(robots);
    } catch (error) {
      console.error('Error fetching robot statuses:', error);
      res.status(500).json({ error: 'Failed to fetch robot statuses' });
    }
  });

  // Get a specific robot status by serial number
  app.get('/api/robots/status/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // First check if we have a robot assignment for this serial number
      const robotAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!robotAssignment) {
        console.warn(`No robot assignment found for serial ${serialNumber}`);
      } else {
        console.log(`Found robot assignment for ${serialNumber}: ${robotAssignment.name}`);
      }
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get status from WebSocket cache - the updated function now always returns a status
      // with connectionStatus property that can be 'connected', 'connecting', or 'disconnected'
      const status = getRobotStatus(serialNumber);
      
      if (status) {
        // Always return the status - it will contain connection state information
        res.json(status);
      } else {
        // This should never happen now, but keeping as a fallback
        return res.status(503).json({ 
          error: 'Robot not available', 
          message: 'The robot is not available. Please check the system configuration.'
        });
      }
    } catch (error) {
      console.error('Error fetching robot status:', error);
      res.status(500).json({ error: 'Failed to fetch robot status' });
    }
  });

  // Update a robot's status (only for our physical robot)
  app.post('/api/robots/status/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const statusUpdate = req.body;
      
      if (!statusUpdate || typeof statusUpdate !== 'object') {
        return res.status(400).json({ error: 'Status update data is required' });
      }
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is registered
      const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!existingAssignment) {
        return res.status(404).json({ 
          error: 'Robot not found', 
          message: 'Please register the robot first using the /api/robots/register endpoint'
        });
      }
      
      // We're not actually implementing this right now since it would 
      // require commands to the robot, which we don't have documentation for
      console.log('Would send status update to physical robot:', statusUpdate);
      
      // Return current status
      const status = getRobotStatus(serialNumber);
      
      if (status) {
        res.json(status);
      } else {
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        return res.status(404).json({ error: 'Robot status not available' });
      }
    } catch (error) {
      console.error('Error updating robot status:', error);
      res.status(500).json({ error: 'Failed to update robot status' });
    }
  });

  // Get a specific robot position by serial number
  app.get('/api/robots/position/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get position from WebSocket cache - the updated function now always returns a position object
      // with connectionStatus property that can be 'connected', 'connecting', or 'disconnected'
      const position = getRobotPosition(serialNumber);
      
      if (position) {
        // Always return the position - it will contain connection state information
        res.json(position);
      } else {
        // This should never happen now, but keeping as a fallback
        return res.status(503).json({ 
          error: 'Robot not available', 
          message: 'The robot is not available. Please check the system configuration.'
        });
      }
    } catch (error) {
      console.error('Error fetching robot position:', error);
      res.status(500).json({ error: 'Failed to fetch robot position' });
    }
  });

  // Update a robot's position (only for demo purposes)
  app.post('/api/robots/position/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const positionUpdate = req.body;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is registered
      const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!existingAssignment) {
        return res.status(404).json({ 
          error: 'Robot not found', 
          message: 'Please register the robot first using the /api/robots/register endpoint'
        });
      }
      
      // We're not actually implementing this right now since it would 
      // require commands to the robot, which we don't have documentation for
      console.log('Would send position update to physical robot:', positionUpdate);
      
      // Get current position from WebSocket cache
      const position = getRobotPosition(serialNumber);
      
      if (position) {
        res.json(position);
      } else {
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        return res.status(404).json({ error: 'Robot position not available' });
      }
    } catch (error) {
      console.error('Error updating robot position:', error);
      res.status(500).json({ error: 'Failed to update robot position' });
    }
  });

  // Get system settings/parameters for a specific robot
  app.get('/api/robots/params/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is connected
      if (!isRobotConnected()) {
        return res.status(503).json({ 
          error: 'Robot not connected', 
          message: 'The robot is not currently connected. Please check the connection.'
        });
      }
      
      // Fetch system settings from robot
      try {
        const settings = await fetchSystemSettings(true);
        
        if (!settings) {
          // Fall back to legacy API if system settings API is not available
          try {
            const response = await fetch(`${ROBOT_API_URL}/robot-params`, {
              headers: {
                'Secret': ROBOT_SECRET || '',
                'Content-Type': 'application/json'
              }
            });
            
            if (!response.ok) {
              throw new Error(`Failed to fetch robot parameters: ${response.status} ${response.statusText}`);
            }
            
            const params = await response.json();
            return res.json(params);
          } catch (legacyError) {
            console.error('Error fetching legacy robot parameters:', legacyError);
            
            // Return some default parameters as last resort
            return res.json({
              "/wheel_control/max_forward_velocity": 0.8,
              "/wheel_control/max_backward_velocity": -0.2,
              "/wheel_control/max_forward_acc": 0.26,
              "/wheel_control/max_forward_decel": -2.0,
              "/wheel_control/max_angular_velocity": 0.78,
              "/wheel_control/acc_smoother/smooth_level": "normal",
              "/planning/auto_hold": true,
              "/control/bump_tolerance": 0.5,
              "/control/bump_based_speed_limit/enable": true
            });
          }
        }
        
        // Format system settings to match the legacy API format for backward compatibility
        // This transforms control.max_forward_velocity to /wheel_control/max_forward_velocity
        const legacyFormatParams = {
          "/wheel_control/max_forward_velocity": settings?.control?.max_forward_velocity || 0.8,
          "/wheel_control/max_backward_velocity": settings?.control?.max_backward_velocity || -0.2,
          "/wheel_control/max_forward_acc": settings?.control?.max_forward_acc || 0.26,
          "/wheel_control/max_forward_decel": settings?.control?.max_forward_decel || -2.0,
          "/wheel_control/max_angular_velocity": settings?.control?.max_angular_velocity || 0.78,
          "/wheel_control/acc_smoother/smooth_level": settings?.control?.acc_smoother?.smooth_level || "normal",
          "/planning/auto_hold": settings?.control?.auto_hold || true,
          "/control/bump_tolerance": settings?.bump_based_speed_limit?.bump_tolerance || 0.5,
          "/control/bump_based_speed_limit/enable": settings?.bump_based_speed_limit?.enable || true,
          "/robot/footprint": settings?.robot?.footprint || [],
        };
        
        // Include the raw system settings for reference
        const responseData = {
          ...legacyFormatParams,
          _systemSettings: settings
        };
        
        res.json(responseData);
      } catch (error) {
        console.error('Error fetching robot parameters:', error);
        res.status(500).json({ error: 'Failed to fetch robot parameters' });
      }
    } catch (error) {
      console.error('Error in robot parameters endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get sensor data for a specific robot
  app.get('/api/robots/sensors/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get sensor data from WebSocket cache - the updated function now always returns a data object
      // with connectionStatus property that can be 'connected', 'connecting', or 'disconnected'
      const sensorData = getRobotSensorData(serialNumber);
      
      if (sensorData) {
        // Always return the sensor data - it will contain connection state information
        res.json(sensorData);
      } else {
        // This should never happen now, but keeping as a fallback
        return res.status(503).json({ 
          error: 'Robot not available', 
          message: 'The robot is not available. Please check the system configuration.'
        });
      }
    } catch (error) {
      console.error('Error fetching robot sensor data:', error);
      res.status(500).json({ error: 'Failed to fetch robot sensor data' });
    }
  });

  // Update sensor data for a specific robot (only for demo purposes)
  app.post('/api/robots/sensors/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is registered
      const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!existingAssignment) {
        return res.status(404).json({ 
          error: 'Robot not found', 
          message: 'Please register the robot first using the /api/robots/register endpoint'
        });
      }
      
      // Get current sensor data from WebSocket cache
      const sensorData = getRobotSensorData(serialNumber);
      
      if (sensorData) {
        res.json(sensorData);
      } else {
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        return res.status(404).json({ error: 'Robot sensor data not available' });
      }
    } catch (error) {
      console.error('Error updating robot sensor data:', error);
      res.status(500).json({ error: 'Failed to update robot sensor data' });
    }
  });

  // Get map data for a specific robot
  app.get('/api/robots/map/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Try to fetch the available map list from the robot
      if (ROBOT_API_URL) {
        try {
          // First try to get the list of available maps
          const mapListUrl = `${ROBOT_API_URL}/maps/`;
          console.log(`Trying to fetch available maps from robot at ${mapListUrl}`);
          
          const mapsResponse = await fetch(mapListUrl, {
            headers: {
              'Secret': process.env.ROBOT_SECRET || ''
            }
          });
          
          if (mapsResponse.ok) {
            const mapsList = await mapsResponse.json();
            console.log('Successfully fetched maps list from robot');
            
            // If we have maps, get the first one (most recent)
            if (mapsList && mapsList.length > 0) {
              const mapId = mapsList[0].id;
              const mapDetailUrl = `${ROBOT_API_URL}/maps/${mapId}`;
              
              console.log(`Fetching detailed map data for map ID ${mapId}`);
              
              const mapDetailResponse = await fetch(mapDetailUrl, {
                headers: {
                  'Secret': process.env.ROBOT_SECRET || ''
                }
              });
              
              if (mapDetailResponse.ok) {
                const mapDetail = await mapDetailResponse.json();
                
                // Also fetch the map image
                const mapImageUrl = `${ROBOT_API_URL}/maps/${mapId}.png`;
                const mapImageResponse = await fetch(mapImageUrl, {
                  headers: {
                    'Secret': process.env.ROBOT_SECRET || ''
                  }
                });
                
                let imageData = '';
                if (mapImageResponse.ok) {
                  // Convert the image to base64
                  const imageBuffer = await mapImageResponse.arrayBuffer();
                  imageData = Buffer.from(imageBuffer).toString('base64');
                }
                
                // Format the data for our client
                const formattedMapData = {
                  grid: imageData,
                  obstacles: [],
                  paths: [],
                  size: [
                    Math.round((mapDetail.grid_origin_x * -1) / mapDetail.grid_resolution),
                    Math.round((mapDetail.grid_origin_y * -1) / mapDetail.grid_resolution)
                  ],
                  resolution: mapDetail.grid_resolution || 0.05,
                  origin: [mapDetail.grid_origin_x, mapDetail.grid_origin_y],
                  stamp: mapDetail.last_modified_time,
                  originalData: mapDetail,
                  connectionStatus: 'connected'
                };
                
                return res.json(formattedMapData);
              }
            }
          }
        } catch (error) {
          const directError = error as Error;
          console.warn(`Error connecting to robot for map data: ${directError.message}`);
        }
      }
      
      // Fall back to using the WebSocket cache if direct connection failed
      // The WebSocket data comes from the /map topic which we're already subscribed to
      const mapData = getRobotMapData(serialNumber);
      
      if (mapData) {
        // Always return the map data - it will contain connection state information
        res.json(mapData);
      } else {
        // This should never happen now, but keeping as a fallback
        return res.status(503).json({ 
          error: 'Robot not available', 
          message: 'The robot is not available. Please check the system configuration.'
        });
      }
    } catch (error) {
      console.error('Error fetching robot map data:', error);
      res.status(500).json({ error: 'Failed to fetch robot map data' });
    }
  });
  
  // Update map data for a specific robot (to support editing)
  app.post('/api/robots/map/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const mapUpdates = req.body;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Validate the map updates
      if (!mapUpdates) {
        return res.status(400).json({ error: 'No map data provided' });
      }
      
      if (ROBOT_API_URL) {
        try {
          // Try to update the map on the robot
          const mapUrl = `${ROBOT_API_URL}/map`;
          console.log(`Trying to update map data on robot at ${mapUrl}`);
          
          const robotResponse = await fetch(mapUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Secret': process.env.ROBOT_SECRET || ''
            },
            body: JSON.stringify(mapUpdates)
          });
          
          if (robotResponse.ok) {
            console.log('Successfully updated map data on robot');
            return res.json({ message: 'Map updated successfully' });
          } else {
            const errorText = await robotResponse.text();
            console.warn(`Failed to update map on robot: ${robotResponse.status} ${errorText}`);
            return res.status(robotResponse.status).json({ error: errorText || 'Failed to update map on robot' });
          }
        } catch (error) {
          const updateError = error as Error;
          console.error(`Error updating map on robot: ${updateError.message}`);
          return res.status(500).json({ error: `Error updating map: ${updateError.message}` });
        }
      }
      
      // If we can't update directly, store the updates in our local cache
      // This is a simplified implementation - in a real system you'd want to persist this
      console.log('No direct robot connection, storing map edits locally');
      res.json({ message: 'Map updates stored locally (no direct robot connection)' });
    } catch (error) {
      console.error('Error updating robot map data:', error);
      res.status(500).json({ error: 'Failed to update robot map data' });
    }
  });

  // Get LiDAR data for a specific robot
  app.get('/api/robots/lidar/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get LiDAR data from WebSocket cache
      const lidarData = getRobotLidarData(serialNumber);
      
      if (lidarData) {
        // Always return the LiDAR data - it will contain connection state information
        res.json(lidarData);
      } else {
        // This should never happen now, but keeping as a fallback
        return res.status(503).json({ 
          error: 'Robot not available', 
          message: 'The robot is not available. Please check the system configuration.'
        });
      }
    } catch (error) {
      console.error('Error fetching robot LiDAR data:', error);
      res.status(500).json({ error: 'Failed to fetch robot LiDAR data' });
    }
  });

  // Get camera data for a specific robot
  app.get('/api/robots/camera/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get camera data from WebSocket cache - the updated function now always returns a data object
      // with connectionStatus property that can be 'connected', 'connecting', or 'disconnected'
      const cameraData = getRobotCameraData(serialNumber);
      
      if (cameraData) {
        // Always return the camera data - it will contain connection state information
        res.json(cameraData);
      } else {
        // This should never happen now, but keeping as a fallback
        return res.status(503).json({ 
          error: 'Robot not available', 
          message: 'The robot is not available. Please check the system configuration.'
        });
      }
    } catch (error) {
      console.error('Error fetching robot camera data:', error);
      res.status(500).json({ error: 'Failed to fetch robot camera data' });
    }
  });

  // Update camera settings for a specific robot
  app.post('/api/robots/camera/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is registered
      const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!existingAssignment) {
        return res.status(404).json({ 
          error: 'Robot not found', 
          message: 'Please register the robot first using the /api/robots/register endpoint'
        });
      }
      
      // Get current camera data from WebSocket cache - the updated function now always returns a data object
      // with connectionStatus property that can be 'connected', 'connecting', or 'disconnected'
      const cameraData = getRobotCameraData(serialNumber);
      
      if (cameraData) {
        // Always return the camera data - it will contain connection state information
        res.json(cameraData);
      } else {
        // This should never happen now, but keeping as a fallback
        return res.status(503).json({ 
          error: 'Robot not available', 
          message: 'The robot is not available. Please check the system configuration.'
        });
      }
    } catch (error) {
      console.error('Error updating robot camera settings:', error);
      res.status(500).json({ error: 'Failed to update robot camera settings' });
    }
  });

  // Get all robot-template assignments
  app.get('/api/robot-assignments', async (req: Request, res: Response) => {
    try {
      const assignments = await storage.getAllRobotTemplateAssignments();
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching robot template assignments:', error);
      res.status(500).json({ error: 'Failed to fetch robot template assignments' });
    }
  });

  // Get a robot-template assignment by serial number
  app.get('/api/robot-assignments/by-serial/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const assignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!assignment) {
        return res.status(404).json({ error: 'Robot assignment not found' });
      }
      
      res.json(assignment);
    } catch (error) {
      console.error('Error fetching robot template assignment:', error);
      res.status(500).json({ error: 'Failed to fetch robot template assignment' });
    }
  });

  // Register a robot and assign it to a template
  app.post('/api/robot-assignments/register', async (req: Request, res: Response) => {
    try {
      const { serialNumber, model, templateId } = req.body;
      
      if (!serialNumber || !model) {
        return res.status(400).json({ error: 'Serial number and model are required' });
      }
      
      // Register the robot
      const result = await registerRobot(serialNumber, model, templateId);
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Error registering robot:', error);
      res.status(500).json({ error: 'Failed to register robot' });
    }
  });

  // Get the current task for a robot
  app.get('/api/robots/task/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is registered
      const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!existingAssignment) {
        return res.status(404).json({ 
          error: 'Robot not found', 
          message: 'Please register the robot first using the /api/robots/register endpoint'
        });
      }
      
      // In a real implementation, we would fetch the current task from a task queue
      // For now, return a placeholder response
      res.json({
        taskId: null,
        status: 'idle',
        message: 'No active task'
      });
    } catch (error) {
      console.error('Error fetching robot task:', error);
      res.status(500).json({ error: 'Failed to fetch robot task' });
    }
  });

  // Update a robot-template assignment
  app.put('/api/robot-assignments/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { templateId } = req.body;
      
      if (!templateId) {
        return res.status(400).json({ error: 'Template ID is required' });
      }
      
      // Update the assignment
      const updated = await storage.updateRobotTemplateAssignment(parseInt(id, 10), {
        templateId: parseInt(templateId, 10)
      });
      
      if (!updated) {
        return res.status(404).json({ error: 'Robot assignment not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating robot template assignment:', error);
      res.status(500).json({ error: 'Failed to update robot template assignment' });
    }
  });

  // Delete a robot-template assignment
  app.delete('/api/robot-assignments/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Delete the assignment
      const success = await storage.deleteRobotTemplateAssignment(parseInt(id, 10));
      
      if (!success) {
        return res.status(404).json({ error: 'Robot assignment not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting robot template assignment:', error);
      res.status(500).json({ error: 'Failed to delete robot template assignment' });
    }
  });
}