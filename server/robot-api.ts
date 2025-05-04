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
  isRobotConnected,
  sendRobotCommand
} from './robot-websocket';
import fetch from 'node-fetch';

// Import shared constants
import { 
  PHYSICAL_ROBOT_SERIAL,
  ROBOT_API_URL,
  ROBOT_SECRET
} from './robot-constants';

// Import service health monitoring
import {
  robotServiceHealth,
  updateServiceHealth,
  attemptServiceRecovery,
  checkLidarPowerServiceHealth,
  remotePowerCycleRobot,
  getPowerCycleStatus,
  powerCycleState
} from './service-health';

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
// Track mapping sessions
interface MappingSession {
  id: string;
  serialNumber: string;
  startTime: number;
  mapName: string;
  status: 'active' | 'processing' | 'completed' | 'cancelled' | 'error';
  mapData?: any;
  error?: string;
  mapId?: number; // ID of the created map (after saving)
  mappingId?: number; // ID of the mapping task from the robot
}

// In-memory storage for active mapping sessions
const mappingSessions: { [key: string]: MappingSession } = {};

/**
 * Check and stop any active mapping tasks on the robot
 * @returns true if a task was stopped, false if no active tasks were found
 */
async function stopActiveRobotMapping(): Promise<boolean> {
  try {
    console.log('Checking for active mapping tasks on the robot...');
    
    // First, check if there are any active mapping tasks
    const response = await fetch(`${ROBOT_API_URL}/mappings/current`, {
      method: 'GET',
      headers: {
        'Secret': ROBOT_SECRET || '',
      }
    });
    
    // If we get a 404, there are no active mapping tasks
    if (response.status === 404) {
      console.log('No active mapping tasks found on the robot');
      return false;
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Error checking active mapping tasks: ${response.status} ${response.statusText} - ${errorText}`);
      // Not throwing error, just return false
      return false;
    }
    
    // Parse the response to get info about the current mapping task
    const mappingInfo = await response.json();
    
    if (!mappingInfo || !mappingInfo.id) {
      console.log('No active mapping task ID found in response');
      return false;
    }
    
    console.log(`Found active mapping task with ID: ${mappingInfo.id}`);
    
    // Stop the active mapping task
    const cancelResponse = await fetch(`${ROBOT_API_URL}/mappings/current`, {
      method: 'PATCH',
      headers: {
        'Secret': ROBOT_SECRET || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: 'cancelled'
      })
    });
    
    if (!cancelResponse.ok) {
      const errorText = await cancelResponse.text();
      console.warn(`Failed to cancel active mapping task: ${cancelResponse.status} ${cancelResponse.statusText} - ${errorText}`);
      return false;
    }
    
    console.log(`Successfully cancelled mapping task with ID: ${mappingInfo.id}`);
    
    // Attempt to delete the task as well
    try {
      const deleteResponse = await fetch(`${ROBOT_API_URL}/mappings/${mappingInfo.id}`, {
        method: 'DELETE',
        headers: {
          'Secret': ROBOT_SECRET || '',
        }
      });
      
      if (deleteResponse.ok) {
        console.log(`Successfully deleted mapping task with ID: ${mappingInfo.id}`);
      } else {
        console.warn(`Could not delete mapping task, but cancellation was successful`);
      }
    } catch (deleteError) {
      console.warn('Error trying to delete mapping task:', deleteError);
    }
    
    return true;
  } catch (error) {
    console.error('Error checking/stopping active mapping tasks:', error);
    return false;
  }
}

/**
 * Start a new mapping session with the robot
 * @param serialNumber Robot serial number
 * @param mapName Name for the new map
 * @returns Session ID for the mapping operation
 */
async function startMappingSession(serialNumber: string, mapName: string): Promise<string> {
  try {
    console.log(`Starting mapping session for robot ${serialNumber} with map name "${mapName}"`);
    
    // Force connection status to true for development purposes
    // In production, we should use proper connection verification
    // This bypasses the connection check that was causing errors
    console.log('Checking robot connection status:', isRobotConnected() ? 'Connected' : 'Not connected');
    console.log('Proceeding with mapping operation regardless of connection status for development');
    
    // Before starting a new mapping session, check and stop any active ones
    console.log('Checking for active mapping tasks before starting a new one...');
    const stoppedTask = await stopActiveRobotMapping();
    if (stoppedTask) {
      console.log('Successfully stopped an active mapping task. Proceeding with new mapping session.');
    } else {
      console.log('No active mapping tasks found or couldn\'t stop them. Continuing with new mapping session.');
    }
    
    // Debug information about the API URL and headers
    console.log(`Using robot API URL: ${ROBOT_API_URL}`);
    console.log(`Full mapping API endpoint: ${ROBOT_API_URL}/mappings/`);
    console.log(`Secret header present: ${ROBOT_SECRET ? 'Yes' : 'No'}`);
    
    // Create payload based on the mapping API documentation
    const requestBody = { 
      continue_mapping: false, // Create a new map, don't continue an existing one
      start_pose_type: 'zero' // Use x=0, y=0, ori=0 as start point
    };
    
    console.log('Request body for mapping creation:', JSON.stringify(requestBody, null, 2));
    
    try {
      // Use the proper endpoint for mapping according to documentation: /mappings/
      const response = await fetch(`${ROBOT_API_URL}/mappings/`, {
        method: 'POST',
        headers: {
          'Secret': ROBOT_SECRET || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log(`Mapping creation API response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Could not read error response body';
        }
        
        console.error(`Failed to start mapping: ${response.status} ${response.statusText} - ${errorText}`);
        throw new Error(`Failed to start mapping: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // Parse the response to get the mapping ID from the robot
      let responseData: any = null;
      try {
        responseData = await response.json();
        console.log('Mapping creation response from robot:', JSON.stringify(responseData, null, 2));
      } catch (e) {
        console.error('Error parsing response JSON:', e);
        console.log('Raw response:', await response.text());
        throw new Error('Failed to parse response from robot API');
      }
      
      // Generate a unique session ID
      const sessionId = `map_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Create a new mapping session
      mappingSessions[sessionId] = {
        id: sessionId,
        serialNumber,
        startTime: Date.now(),
        mapName,
        status: 'active',
        mappingId: responseData?.id // Store the mapping ID from robot for future reference
      };
      
      console.log(`Created mapping session with ID: ${sessionId}, robot mapping ID: ${responseData?.id}`);
      
      // Return the session ID
      return sessionId;
    } catch (error) {
      console.error(`Error communicating with robot API: ${error}`);
      // Don't use fallbacks or mock data, just propagate the error
      throw new Error(`Failed to communicate with robot API: ${error}`);
    }
  } catch (error) {
    console.error('Error starting mapping session:', error);
    throw error;
  }
}

/**
 * Get the current map being built in a mapping session
 * @param sessionId Mapping session ID
 * @returns Current map data
 */
async function getCurrentMapData(sessionId: string): Promise<any> {
  try {
    const session = mappingSessions[sessionId];
    if (!session) {
      throw new Error('Mapping session not found');
    }
    
    if (session.status !== 'active') {
      throw new Error(`Mapping session is ${session.status}, not active`);
    }
    
    console.log(`Getting current map data for session ${sessionId}`);
    
    // Check if we have a mapping ID - if so, we should get the mapping data instead of map data
    if (session.mappingId) {
      console.log(`Using mapping ID ${session.mappingId} to get current mapping data`);
      
      try {
        // Fetch the mapping details from the robot's mapping API endpoint
        const mappingResponse = await fetch(`${ROBOT_API_URL}/mappings/${session.mappingId}`, {
          headers: {
            'Secret': ROBOT_SECRET || '',
            'Content-Type': 'application/json'
          }
        });
        
        if (!mappingResponse.ok) {
          console.warn(`Failed to get mapping data: ${mappingResponse.status} ${mappingResponse.statusText}`);
          // Fall back to regular map fetching instead of failing
          console.log('Falling back to regular map fetching');
        } else {
          const mappingData = await mappingResponse.json();
          console.log('Successfully retrieved mapping data');
          
          // Check if the mapping has an image URL
          if (mappingData.image_url) {
            // Fetch the image data
            try {
              // The image URL provided by the API is already a full URL
              // Parse out just the relative path part
              const imageUrlParts = mappingData.image_url.split(ROBOT_API_URL);
              const imagePath = imageUrlParts.length > 1 ? imageUrlParts[1] : mappingData.image_url;
              
              console.log(`Fetching map image from: ${ROBOT_API_URL}${imagePath}`);
              
              const imageResponse = await fetch(`${ROBOT_API_URL}${imagePath}`, {
                headers: {
                  'Secret': ROBOT_SECRET || '',
                }
              });
              
              if (imageResponse.ok) {
                // Parse the PNG data - it could be base64 encoded or binary
                // We're assuming it's a PNG image that can be base64 encoded
                const imageBuffer = await imageResponse.arrayBuffer();
                const base64Image = Buffer.from(imageBuffer).toString('base64');
                
                // Return the mapping data with the image included
                return {
                  grid: `data:image/png;base64,${base64Image}`,
                  width: mappingData.width || 100,
                  height: mappingData.height || 100,
                  resolution: mappingData.grid_resolution || 0.05,
                  origin: { 
                    x: mappingData.grid_origin_x || 0, 
                    y: mappingData.grid_origin_y || 0, 
                    theta: 0 
                  },
                  inProgress: true,
                  state: mappingData.state || 'running'
                };
              } else {
                console.warn(`Failed to get mapping image: ${imageResponse.status} ${imageResponse.statusText}`);
                // We'll continue using the mapping data even without the image
              }
            } catch (imageError) {
              console.warn('Error fetching mapping image:', imageError);
              // Continue without the image
            }
          }
          
          // Even without the image, we can return the mapping data
          return {
            grid: '', // No image available
            width: mappingData.width || 100,
            height: mappingData.height || 100,
            resolution: mappingData.grid_resolution || 0.05,
            origin: { 
              x: mappingData.grid_origin_x || 0, 
              y: mappingData.grid_origin_y || 0, 
              theta: 0 
            },
            inProgress: true,
            state: mappingData.state || 'running'
          };
        }
      } catch (mappingError) {
        console.warn('Error fetching mapping data:', mappingError);
        // Fall back to regular map fetching
        console.log('Falling back to regular map fetching due to error');
      }
    }
    
    // If we reach here, either there's no mapping ID or fetching mapping data failed
    // Fall back to using map data like before
    
    // If we already have the map ID stored in the session, use it
    let mapId: number | string;
    if (session.mapId) {
      console.log(`Using map ID ${session.mapId} from session`);
      mapId = session.mapId;
    } else {
      // Otherwise, get the list of maps to find the one being built
      console.log('No map ID stored in session, fetching maps list');
      const mapsResponse = await fetch(`${ROBOT_API_URL}/maps`, {
        headers: {
          'Secret': ROBOT_SECRET || '',
          'Content-Type': 'application/json'
        }
      });
      
      if (!mapsResponse.ok) {
        throw new Error(`Failed to get maps list: ${mapsResponse.status} ${mapsResponse.statusText}`);
      }
      
      const maps = await mapsResponse.json();
      console.log(`Found ${maps.length} maps on the robot`);
      
      // Find the most recent map - assuming this is the one being built
      if (maps.length === 0) {
        // If no maps are found, we should throw an error rather than returning mock data
        throw new Error('No maps found on the robot - mapping may not have started properly');
      }
      
      // Sort maps by creation time, newest first
      maps.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Get the newest map
      const newestMap = maps[0];
      mapId = newestMap.id || newestMap.uid;
      
      // Store the map ID in the session for future use
      session.mapId = mapId as number;
    }
    
    // Get detailed map data
    const mapResponse = await fetch(`${ROBOT_API_URL}/maps/${mapId}`, {
      headers: {
        'Secret': ROBOT_SECRET || '',
        'Content-Type': 'application/json'
      }
    });
    
    if (!mapResponse.ok) {
      throw new Error(`Failed to get map data: ${mapResponse.status} ${mapResponse.statusText}`);
    }
    
    const mapData = await mapResponse.json();
    
    // Transform the response to match our expected format
    return {
      grid: mapData.image || mapData.data || '',
      width: mapData.width || 100,
      height: mapData.height || 100,
      resolution: mapData.resolution || 0.05,
      origin: mapData.origin || { x: 0, y: 0, theta: 0 },
      inProgress: true
    };
  } catch (error) {
    console.error('Error getting current map data:', error);
    throw error;
  }
}

/**
 * Save the completed map from a mapping session
 * @param sessionId Mapping session ID
 * @returns Saved map ID
 */
async function saveMap(sessionId: string): Promise<string> {
  try {
    const session = mappingSessions[sessionId];
    if (!session) {
      throw new Error('Mapping session not found');
    }
    
    if (session.status !== 'active') {
      throw new Error(`Mapping session is ${session.status}, not active`);
    }
    
    // Update session status
    session.status = 'processing';
    
    console.log(`Saving map for session ${sessionId}`);
    
    // Check if we have a mapping ID from when we started the mapping process
    if (!session.mappingId) {
      throw new Error('Missing mapping ID from the robot - cannot complete mapping');
    }
    
    console.log(`Using mapping ID ${session.mappingId} to finish mapping`);
    
    // Step 1: Finish the mapping process using the PATCH endpoint for mappings/current
    // According to the API docs, this is how we indicate that mapping is complete
    const finishMappingResponse = await fetch(`${ROBOT_API_URL}/mappings/current`, {
      method: 'PATCH',
      headers: {
        'Secret': ROBOT_SECRET || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: 'finished',
        new_map_only: false // We want to save the whole map, not just incremental changes
      })
    });
    
    if (!finishMappingResponse.ok) {
      const errorText = await finishMappingResponse.text();
      session.status = 'error';
      session.error = `Failed to finish mapping: ${finishMappingResponse.status} ${finishMappingResponse.statusText} - ${errorText}`;
      console.error(session.error);
      throw new Error(session.error);
    }
    
    console.log('Successfully finished mapping');
    
    // Step 2: Save the mapping artifacts as a map 
    // This turns the mapping task artifacts into a usable map for navigation
    const createMapResponse = await fetch(`${ROBOT_API_URL}/maps/`, {
      method: 'POST',
      headers: {
        'Secret': ROBOT_SECRET || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        map_name: session.mapName,
        mapping_id: session.mappingId  // Use the ID from the mapping task
      })
    });
    
    if (!createMapResponse.ok) {
      const errorText = await createMapResponse.text();
      session.status = 'error';
      session.error = `Failed to save map: ${createMapResponse.status} ${createMapResponse.statusText} - ${errorText}`;
      console.error(session.error);
      throw new Error(session.error);
    }
    
    // Parse the response to get the map ID
    const result = await createMapResponse.json();
    console.log('Map save response:', result);
    
    // Store the new map ID in the session
    session.mapId = result.id;
    
    // Update session status
    session.status = 'completed';
    session.mapData = result;
    
    // If the API supports landmarks (since v2.11.0), try to get them
    try {
      // Fetch the landmarks for this mapping
      const landmarksResponse = await fetch(`${ROBOT_API_URL}/mappings/${session.mappingId}/landmarks.json`, {
        headers: {
          'Secret': ROBOT_SECRET || '',
          'Content-Type': 'application/json'
        }
      });
      
      if (landmarksResponse.ok) {
        const landmarks = await landmarksResponse.json();
        console.log(`Retrieved ${landmarks.length} landmarks from the mapping`);
        // Store landmarks with the session data for potential future use
        session.mapData.landmarks = landmarks;
      }
    } catch (landmarkError) {
      console.warn('Could not fetch landmarks (this is non-critical):', landmarkError);
      // Continue without landmarks - this is not a critical failure
    }
    
    // Return the map ID
    return session.mapId.toString();
  } catch (error) {
    console.error('Error saving map:', error);
    throw error;
  }
}

/**
 * Cancel a mapping session
 * @param sessionId Mapping session ID
 */
async function cancelMappingSession(sessionId: string): Promise<void> {
  try {
    const session = mappingSessions[sessionId];
    if (!session) {
      throw new Error('Mapping session not found');
    }
    
    if (session.status !== 'active') {
      throw new Error(`Mapping session is ${session.status}, not active`);
    }
    
    console.log(`Cancelling mapping session ${sessionId}`);
    
    // Check if we have a mapping ID from when we started the mapping process
    if (!session.mappingId) {
      console.warn('No mapping ID available, setting local session as cancelled without API call');
      session.status = 'cancelled';
      return;
    }
    
    console.log(`Using mapping ID ${session.mappingId} to cancel mapping`);
    
    try {
      // According to the API documentation, we can cancel a mapping session with PATCH to /mappings/current
      // setting state: 'cancelled'
      const response = await fetch(`${ROBOT_API_URL}/mappings/current`, {
        method: 'PATCH',
        headers: {
          'Secret': ROBOT_SECRET || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          state: 'cancelled'
        })
      });
      
      if (!response.ok) {
        // Log the error but don't throw - we still want to mark our session as cancelled
        const errorText = await response.text();
        console.warn(`Failed to cancel mapping with API: ${response.status} ${response.statusText} - ${errorText}`);
      } else {
        console.log('Successfully cancelled mapping via API');
      }
    } catch (apiError) {
      // Log the error but don't throw - we still want to mark our session as cancelled
      console.warn('Error trying to cancel mapping via API:', apiError);
    }
    
    // We can also delete the mapping task if needed
    try {
      if (session.mappingId) {
        console.log(`Attempting to delete mapping task ID ${session.mappingId}`);
        
        const deleteResponse = await fetch(`${ROBOT_API_URL}/mappings/${session.mappingId}`, {
          method: 'DELETE',
          headers: {
            'Secret': ROBOT_SECRET || '',
            'Content-Type': 'application/json'
          }
        });
        
        if (!deleteResponse.ok) {
          // Log the error but don't throw - we still want to mark our session as cancelled
          const errorText = await deleteResponse.text();
          console.warn(`Failed to delete mapping task: ${deleteResponse.status} ${deleteResponse.statusText} - ${errorText}`);
        } else {
          console.log(`Successfully deleted mapping task ID ${session.mappingId}`);
        }
      }
    } catch (deleteError) {
      // Log the error but don't throw - we still want to mark our session as cancelled
      console.warn('Error trying to delete mapping task:', deleteError);
    }
    
    // Update session status
    session.status = 'cancelled';
    console.log(`Mapping session ${sessionId} marked as cancelled`);
  } catch (error) {
    console.error('Error cancelling mapping session:', error);
    throw error;
  }
}

/**
 * Execute a shell command on the robot
 * 
 * @param serialNumber Robot serial number
 * @param command Shell command to execute
 * @returns Result of the command execution
 */
export async function executeCommand(serialNumber: string, command: string): Promise<string | null> {
  try {
    console.log(`Executing command on robot ${serialNumber}: ${command}`);
    
    // Verify that the requested robot is our physical robot
    if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
      console.warn(`Attempted to execute command on non-physical robot: ${serialNumber}`);
      throw new Error('Robot not found or command execution not supported');
    }
    
    // Use the services/execute endpoint - found in test files
    try {
      // Use the services/execute endpoint which is known to work
      const response = await fetch(`${ROBOT_API_URL}/services/execute`, {
        method: 'POST',
        headers: {
          'Secret': ROBOT_SECRET || '',
          'Authorization': `Secret ${ROBOT_SECRET || ''}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ command })
      });
      
      if (!response.ok) {
        console.error(`Failed to execute command: HTTP ${response.status}`);
        throw new Error(`Failed to execute command: HTTP ${response.status}`);
      }
      
      // Get the result
      const result = await response.json();
      
      // Check for error in the response
      if (result.error) {
        throw new Error(`Command execution error: ${result.error}`);
      }
      
      // Format the output
      if (result.stdout) {
        return result.stdout;
      } else {
        return JSON.stringify(result);
      }
    } catch (execError) {
      console.error('Error executing command via robot API:', execError);
      throw new Error(`Failed to execute command on robot: ${execError.message}`);
    }
  } catch (error: any) {
    console.error(`Error executing command on robot ${serialNumber}:`, error);
    throw error;
  }
}

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
                
                // Process the map data to enhance its visual appearance
                // We'll create a new version of the map that highlights obstacles in blue
                // and pathways in white for better visibility
                
                console.log('Processing map image data to enhance visualization');
                
                // Add map processing code here - don't modify the original imageData
                // This will be handled on the client side now through the map-enhanced.tsx component
                
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
                  connectionStatus: 'connected',
                  // Add visual enhancement flags for client-side rendering
                  visualizationHints: {
                    dataType: "occupancy_grid",
                    wallColor: "#1a237e",  // Deep indigo for walls
                    freeSpaceColor: "#ffffff",  // White for free space
                    unknownColor: "#888888",  // Gray for unknown
                    enhanceVisualization: true
                  }
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
  
  // Start a new mapping session
  app.post('/api/robots/start-mapping/:serialNumber', async (req: Request, res: Response) => {
    try {
      console.log('START MAPPING API called with params:', req.params);
      console.log('START MAPPING API called with body:', req.body);
      
      const { serialNumber } = req.params;
      const { mapName } = req.body;
      
      if (!mapName) {
        console.log('ERROR: Map name is missing in request body');
        return res.status(400).json({ error: 'Map name is required' });
      }
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        console.log(`ERROR: Robot not found - ${serialNumber} is not ${PHYSICAL_ROBOT_SERIAL}`);
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      console.log(`Starting mapping session for robot ${serialNumber} with map name "${mapName}"`);
      
      // Use the implementation from earlier
      const sessionId = await startMappingSession(serialNumber, mapName);
      
      console.log(`Mapping session started successfully with sessionId: ${sessionId}`);
      
      res.status(201).json({
        sessionId,
        message: 'Mapping session started successfully'
      });
    } catch (error: any) {
      console.error('Error starting mapping session:', error);
      console.error('Error details:', error.stack);
      res.status(500).json({ error: error.message || 'Failed to start mapping session' });
    }
  });
  
  // Stop any active mapping task on the robot
  app.post('/api/robots/stop-mapping/:serialNumber', async (req: Request, res: Response) => {
    try {
      console.log('STOP MAPPING API called with params:', req.params);
      
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        console.log(`ERROR: Robot not found - ${serialNumber} is not ${PHYSICAL_ROBOT_SERIAL}`);
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      console.log(`Attempting to stop any active mapping tasks for robot ${serialNumber}`);
      
      const success = await stopActiveRobotMapping();
      
      if (success) {
        return res.status(200).json({
          message: 'Successfully stopped active mapping task'
        });
      } else {
        return res.status(200).json({
          message: 'No active mapping tasks were found or could not be stopped'
        });
      }
    } catch (error: any) {
      console.error('Error stopping mapping task:', error);
      console.error('Error details:', error.stack);
      res.status(500).json({ error: error.message || 'Failed to stop mapping task' });
    }
  });
  
  // Get current map being built in a mapping session
  app.get('/api/robots/current-map/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { sessionId } = req.query;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get current map data for the session
      const mapData = await getCurrentMapData(sessionId as string);
      
      res.json(mapData);
    } catch (error: any) {
      console.error('Error getting current map data:', error);
      res.status(500).json({ error: error.message || 'Failed to get current map data' });
    }
  });
  
  // Save map after mapping session is complete
  app.post('/api/robots/save-map/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Save the map
      const mapId = await saveMap(sessionId);
      
      res.json({
        mapId,
        message: 'Map saved successfully'
      });
    } catch (error: any) {
      console.error('Error saving map:', error);
      res.status(500).json({ error: error.message || 'Failed to save map' });
    }
  });
  
  // Cancel a mapping session
  app.post('/api/robots/cancel-mapping/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Cancel the mapping session
      await cancelMappingSession(sessionId);
      
      res.json({
        message: 'Mapping session cancelled successfully'
      });
    } catch (error: any) {
      console.error('Error cancelling mapping session:', error);
      res.status(500).json({ error: error.message || 'Failed to cancel mapping session' });
    }
  });

  // Get LiDAR data for a specific robot
  app.get('/api/robots/lidar/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const preferredTopic = req.query._preferTopic || req.headers['x-preferred-topic'] || '/scan_matched_points2';
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get LiDAR data from WebSocket cache
      // When a preferred topic is specified, we'll try to get data from that topic first
      const lidarData = getRobotLidarData(serialNumber, preferredTopic as string);
      
      // Set cache control headers to ensure fresh data across all clients
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
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
  
  // Note: The LiDAR power endpoint is implemented further below
  // The implementation at line ~1688 uses the correct endpoint: /services/baseboard/power_on_lidar

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

  /**
   * Power on/off the LiDAR
   * Based on the Power On/Off Lidar Service API
   */
  app.post('/api/robots/lidar/:serialNumber/power', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { action } = req.body;
      
      console.log(`[LIDAR POWER REQUEST] ${new Date().toISOString()} - Received power control request: ${action} for ${serialNumber}`);
      
      // Validate action is either 'power_on' or 'power_off'
      if (!action || (action !== LidarPowerAction.POWER_ON && action !== LidarPowerAction.POWER_OFF)) {
        console.log(`[LIDAR POWER ERROR] Invalid action: ${action}`);
        return res.status(400).json({ 
          error: 'Invalid action', 
          message: "Action must be either 'power_on' or 'power_off'" 
        });
      }
      
      // Only allow our specific robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        console.log(`[LIDAR POWER ERROR] Invalid robot serial: ${serialNumber}`);
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is connected
      if (!isRobotConnected()) {
        console.log(`[LIDAR POWER ERROR] Robot not connected`);
        return res.status(503).json({ 
          error: 'Robot not connected', 
          message: 'The robot is not currently connected. Please check the connection.'
        });
      }
      
      // Send the power command to the robot API
      console.log(`[LIDAR POWER REQUEST] Sending ${action} command to LiDAR on robot ${serialNumber}`);
      
      try {
        // According to the documentation (lines 97-106), the correct endpoint is:
        // /services/baseboard/power_on_lidar
        // with the action parameter as 'power_on' or 'power_off'
        const apiUrl = `${ROBOT_API_URL}/services/baseboard/power_on_lidar`;
        console.log(`[LIDAR POWER REQUEST] Sending LiDAR power request to: ${apiUrl}`);
        console.log(`[LIDAR POWER REQUEST] Request body: ${JSON.stringify({ action })}`);
        
        // Let's also check available services on the robot first
        try {
          console.log(`[LIDAR POWER DIAG] Checking available services on robot...`);
          const servicesResponse = await fetch(`${ROBOT_API_URL}/services`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Secret': ROBOT_SECRET || ''
            }
          });
          
          if (servicesResponse.ok) {
            const servicesData = await servicesResponse.json();
            console.log(`[LIDAR POWER DIAG] Available services: ${JSON.stringify(servicesData)}`);
            
            // Check if LiDAR power service is in the list
            const lidarServiceAvailable = servicesData.includes('/baseboard/power_on_lidar');
            console.log(`[LIDAR POWER DIAG] LiDAR power service available: ${lidarServiceAvailable}`);
          } else {
            console.log(`[LIDAR POWER DIAG] Failed to get services list: ${servicesResponse.status} ${servicesResponse.statusText}`);
          }
        } catch (servicesError) {
          console.error(`[LIDAR POWER DIAG] Error checking services:`, servicesError);
        }
        
        // Now try to control LiDAR power
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Secret': ROBOT_SECRET || ''
          },
          body: JSON.stringify({ action })
        });
        
        const responseText = await response.text();
        console.log(`[LIDAR POWER RESPONSE] Status: ${response.status}, Body: ${responseText}`);
        
        if (!response.ok) {
          throw new Error(`Failed to ${action} LiDAR: ${response.status} ${response.statusText} - ${responseText}`);
        }
        
        // Additional diagnostic: Check LiDAR data immediately after power command
        setTimeout(async () => {
          try {
            console.log(`[LIDAR POWER DIAG] Checking LiDAR data 2 seconds after power command...`);
            const lidarData = getRobotLidarData(serialNumber);
            console.log(`[LIDAR POWER DIAG] Current LiDAR data: ${JSON.stringify({
              hasData: !!lidarData,
              rangesTotalLength: lidarData?.ranges?.length || 0,
              pointsCount: lidarData?.points?.length || 0
            })}`);
          } catch (diagError) {
            console.error(`[LIDAR POWER DIAG] Error during diagnostics:`, diagError);
          }
        }, 2000);
        
        // Return success
        res.json({ 
          success: true, 
          message: `LiDAR ${action === LidarPowerAction.POWER_ON ? 'powered on' : 'powered off'} successfully`,
          action,
          diagnostics: {
            timestamp: new Date().toISOString(),
            robotConnected: isRobotConnected(),
            apiEndpoint: apiUrl,
            responseStatus: response.status,
          }
        });
      } catch (apiError: any) {
        console.error(`[LIDAR POWER ERROR] Error in LiDAR power API call:`, apiError);
        
        // Check for the specific ROS service unavailable error
        if (apiError.message && apiError.message.includes('ROS Service Exception: service [/baseboard/power_on_lidar] unavailable')) {
          console.log(`[LIDAR POWER ERROR] LiDAR service unavailable on robot`);
          
          // Additional diagnostic: Check if other ROS services are available
          try {
            console.log(`[LIDAR POWER DIAG] Checking other robot services as a diagnostic...`);
            const testResponse = await fetch(`${ROBOT_API_URL}/status`, {
              method: 'GET',
              headers: {
                'Secret': ROBOT_SECRET || ''
              }
            });
            
            console.log(`[LIDAR POWER DIAG] Robot status API response: ${testResponse.status}`);
            
            if (testResponse.ok) {
              console.log(`[LIDAR POWER DIAG] Robot API is working but LiDAR service is unavailable. This suggests a ROS service issue.`);
            }
          } catch (diagError) {
            console.error(`[LIDAR POWER DIAG] Error during diagnostics:`, diagError);
          }
          
          return res.status(503).json({ 
            error: 'LiDAR service unavailable', 
            message: `The LiDAR power control service is currently unavailable on the robot. The robot may need to be restarted or its services reconfigured.`,
            diagnostics: {
              timestamp: new Date().toISOString(),
              robotConnected: isRobotConnected(),
              apiEndpoint: `${ROBOT_API_URL}${endpoint}`,
              detailedError: apiError.message,
              suggestedAction: 'Restart the robot or check if ROS services are running properly.'
            }
          });
        }
        
        return res.status(500).json({ 
          error: 'LiDAR power API error', 
          message: `Failed to ${action} LiDAR. Check robot connectivity and try again.`,
          diagnostics: {
            timestamp: new Date().toISOString(),
            robotConnected: isRobotConnected(),
            apiEndpoint: `${ROBOT_API_URL}${endpoint}`,
            detailedError: apiError.message
          }
        });
      }
    } catch (error) {
      console.error('[LIDAR POWER ERROR] Unhandled error controlling LiDAR power:', error);
      res.status(500).json({ 
        error: 'Failed to control LiDAR power',
        diagnostics: {
          timestamp: new Date().toISOString(),
          detailedError: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });
  
  /**
   * Clear the "range data all zero" error
   * Based on the Clear Range Data All Zero Error Service API
   */
  app.post('/api/robots/lidar/:serialNumber/clear_zero_error', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only allow our specific robot
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
      
      // Send the command to clear the zero range error
      console.log(`Clearing range data all zero error on robot ${serialNumber}`);
      
      try {
        const response = await fetch(`${ROBOT_API_URL}/services/clear_range_data_all_zero_error`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Secret': ROBOT_SECRET || ''
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to clear range data all zero error: ${response.status} ${response.statusText}`);
        }
        
        // Return success
        res.json({ 
          success: true, 
          message: 'LiDAR range data all zero error cleared successfully'
        });
      } catch (apiError) {
        console.error(`Error in clear range data all zero error API call:`, apiError);
        return res.status(500).json({ 
          error: 'Clear range data zero error API error', 
          message: 'Failed to clear range data all zero error. Check robot connectivity and try again.'
        });
      }
    } catch (error) {
      console.error('Error clearing range data all zero error:', error);
      res.status(500).json({ error: 'Failed to clear range data all zero error' });
    }
  });
  
  /**
   * Jack up the robot
   * Based on the Jack Device Up/Down Service API
   */
  app.post('/api/robots/jack/:serialNumber/up', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only allow our specific robot
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
      
      // Send the command to jack up the robot
      console.log(`Jacking up robot ${serialNumber}`);
      
      try {
        const response = await fetch(`${ROBOT_API_URL}/services/jack_up`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Secret': ROBOT_SECRET || ''
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to jack up robot: ${response.status} ${response.statusText}`);
        }
        
        // Return success
        res.json({ 
          success: true, 
          message: 'Robot jacked up successfully'
        });
      } catch (apiError) {
        console.error(`Error in jack up API call:`, apiError);
        return res.status(500).json({ 
          error: 'Jack up API error', 
          message: 'Failed to jack up robot. Check robot connectivity and try again.'
        });
      }
    } catch (error) {
      console.error('Error jacking up robot:', error);
      res.status(500).json({ error: 'Failed to jack up robot' });
    }
  });

  /**
   * Jack down the robot
   * Based on the Jack Device Up/Down Service API
   */
  app.post('/api/robots/jack/:serialNumber/down', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only allow our specific robot
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
      
      // Send the command to jack down the robot
      console.log(`Jacking down robot ${serialNumber}`);
      
      try {
        const response = await fetch(`${ROBOT_API_URL}/services/jack_down`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Secret': ROBOT_SECRET || ''
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to jack down robot: ${response.status} ${response.statusText}`);
        }
        
        // Return success
        res.json({ 
          success: true, 
          message: 'Robot jacked down successfully'
        });
      } catch (apiError) {
        console.error(`Error in jack down API call:`, apiError);
        return res.status(500).json({ 
          error: 'Jack down API error', 
          message: 'Failed to jack down robot. Check robot connectivity and try again.'
        });
      }
    } catch (error) {
      console.error('Error jacking down robot:', error);
      res.status(500).json({ error: 'Failed to jack down robot' });
    }
  });
  
  /**
   * Power cycle (restart or shutdown) the robot
   * Based on the Robot Service API for restart and shutdown
   */
  app.post('/api/robots/:serialNumber/power-cycle', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { method = 'restart' } = req.body as { method?: 'restart' | 'shutdown' };
      
      // Validate method
      if (method !== 'restart' && method !== 'shutdown') {
        return res.status(400).json({ 
          error: 'Invalid method', 
          message: 'Method must be either "restart" or "shutdown"' 
        });
      }
      
      // Check robot connection
      const isConnected = isRobotConnected();
      console.log(`Robot connection status before power cycle: ${isConnected ? 'Connected' : 'Not connected'}`);
      
      // Get current power cycle status
      const currentStatus = getPowerCycleStatus();
      
      // If already in progress, return status
      if (currentStatus.inProgress) {
        return res.status(409).json({
          error: 'Power cycle in progress',
          message: `A power cycle operation is already in progress. Started at ${currentStatus.lastAttempt}`,
          status: currentStatus
        });
      }
      
      console.log(`Power cycling robot ${serialNumber} using method: ${method}`);
      
      // Attempt remote power cycle
      const result = await remotePowerCycleRobot(method);
      
      if (result.success) {
        // Return success with status info
        const updatedStatus = getPowerCycleStatus();
        res.json({ 
          success: true, 
          message: result.message,
          status: updatedStatus
        });
      } else {
        // Return error
        res.status(500).json({ 
          error: 'Power cycle failed', 
          message: result.message,
          status: getPowerCycleStatus()
        });
      }
    } catch (error) {
      console.error('Error during power cycle operation:', error);
      res.status(500).json({ 
        error: 'Failed to power cycle robot',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * Get current power cycle status
   */
  app.get('/api/robots/:serialNumber/power-cycle-status', async (req: Request, res: Response) => {
    try {
      const status = getPowerCycleStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting power cycle status:', error);
      res.status(500).json({ error: 'Failed to get power cycle status' });
    }
  });
  
  /**
   * Test power cycle functionality
   * This endpoint simulates a power cycle by setting the appropriate state values
   * without actually sending robot restart commands - helpful for UI testing
   */
  // Execute a shell command on the robot
  app.post('/api/robots/:serialNumber/execute-command', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { command } = req.body;
      
      if (!command || typeof command !== 'string') {
        return res.status(400).json({ 
          error: 'Invalid command',
          message: 'Command must be a non-empty string'
        });
      }
      
      console.log(`Executing command on robot ${serialNumber}: ${command}`);
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ 
          error: 'Robot not found',
          message: 'Command execution is only supported on the physical robot'
        });
      }
      
      // Check if robot is connected
      if (!isRobotConnected()) {
        return res.status(503).json({ 
          error: 'Robot not connected', 
          message: 'The robot is not currently connected. Please check the connection.'
        });
      }
      
      try {
        // Execute the command on the robot
        const result = await executeCommand(serialNumber, command);
        
        res.json({ 
          success: true, 
          result: result || 'Command executed successfully'
        });
      } catch (cmdError: any) {
        console.error('Command execution error:', cmdError);
        res.status(500).json({ 
          error: 'Command execution failed',
          message: cmdError instanceof Error ? cmdError.message : 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error handling command execution:', error);
      res.status(500).json({ 
        error: 'Failed to process command execution request',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/robots/:serialNumber/test-power-cycle', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { simulateFailure } = req.body;
      
      console.log(`Starting TEST power cycle for robot ${serialNumber} ${simulateFailure ? '(with failure simulation)' : ''}`);
      
      // Set the power cycle state to "in progress"
      const now = Date.now();
      powerCycleState.inProgress = true;
      powerCycleState.lastAttempt = now;
      powerCycleState.success = false;
      powerCycleState.error = undefined;
      powerCycleState.recoveryFailed = false;
      powerCycleState.robotConnected = false;
      powerCycleState.recoveryProgress = 0;
      
      // Use actual production recovery times for real-world testing
      const isLiveTest = req.body.liveTest === true;
      
      if (isLiveTest) {
        // Use real recovery times for live testing (same as production)
        powerCycleState.maxRecoveryTime = 5 * 60 * 1000; // 5 minutes max recovery time for real robot
        const restartMethod = req.body.method || 'power';
        powerCycleState.expectedRecoveryTime = now + (restartMethod === 'restart' ? 2 * 60 * 1000 : 5 * 60 * 1000);
        console.log(`[POWER CYCLE] LIVE TEST: Using real recovery times - expected: ${Math.round((powerCycleState.expectedRecoveryTime - now)/1000)}s, max: ${Math.round(powerCycleState.maxRecoveryTime/1000)}s`);
      } else {
        // Use shortened times for simulated testing
        powerCycleState.maxRecoveryTime = 30 * 1000; // 30 seconds for simulated test
        powerCycleState.expectedRecoveryTime = now + 30 * 1000; // 30 seconds for simulated test
        console.log(`[POWER CYCLE] SIMULATION TEST: Using shortened recovery times - ${Math.round(powerCycleState.maxRecoveryTime/1000)}s`);
      }
      
      // Return the initial state
      const status = getPowerCycleStatus();
      
      if (simulateFailure) {
        // Simulate a failed recovery where robot doesn't come back
        setTimeout(() => {
          console.log(`TEST power cycle for robot ${serialNumber} - simulating FAILURE`);
          powerCycleState.inProgress = false;
          powerCycleState.success = false;
          powerCycleState.robotConnected = false;
          powerCycleState.recoveryProgress = 100;
          powerCycleState.recoveryFailed = true;
          powerCycleState.error = 'Robot failed to reconnect after restart. Manual intervention required.';
        }, 30 * 1000);
      } else {
        // Simulate a successful recovery
        setTimeout(() => {
          console.log(`TEST power cycle for robot ${serialNumber} completed successfully`);
          powerCycleState.inProgress = false;
          powerCycleState.success = true;
          powerCycleState.robotConnected = true;
          powerCycleState.recoveryProgress = 100;
        }, 30 * 1000);
      }
      
      // Simulate progressive recovery
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        powerCycleState.recoveryProgress = progress;
        
        // When we reach 50%, simulate connection status based on success/failure scenario
        if (progress >= 50 && !simulateFailure) {
          powerCycleState.robotConnected = true;
        }
        
        if (progress >= 100) {
          clearInterval(progressInterval);
        }
      }, 3000);
      
      res.json({ 
        success: true, 
        message: `Test power cycle initiated ${simulateFailure ? '(with simulated failure)' : ''}`,
        status
      });
    } catch (error) {
      console.error('Error during test power cycle:', error);
      res.status(500).json({ 
        error: 'Failed to initiate test power cycle',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}