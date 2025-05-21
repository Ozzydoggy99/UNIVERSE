/**
 * Robot Settings API Module
 * 
 * Provides access to the robot's system settings and rack specifications
 * required for proper rack alignment operations.
 */

import axios from 'axios';
import { Request, Response } from 'express';
import { getRobotApiUrl, getAuthHeaders } from './robot-constants';

const DEFAULT_ROBOT_SERIAL = 'L382502104987ir';

/**
 * Fetch the complete robot system settings
 * These settings contain many configuration parameters for the robot
 * including rack specifications
 * @returns Complete system settings object
 */
export async function fetchRobotSystemSettings(): Promise<any> {
  try {
    console.log('Fetching robot system settings...');
    const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
    const headers = await getAuthHeaders(DEFAULT_ROBOT_SERIAL);
    const response = await axios.get(`${robotApiUrl}/system/settings/effective`, {
      headers
    });
    
    if (!response.data) {
      throw new Error('Invalid response from system settings endpoint');
    }
    
    console.log('Successfully retrieved robot system settings');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch robot system settings:', error.message);
    throw new Error(`Failed to fetch robot system settings: ${error.message}`);
  }
}

/**
 * Get rack specifications from the robot's system settings
 * These are required for proper rack alignment operations
 * @returns Rack specifications object
 */
export async function getRackSpecifications(): Promise<any> {
  try {
    const settings = await fetchRobotSystemSettings();
    
    // Log the keys at the root level to help debug
    console.log('Available settings keys:', Object.keys(settings));
    
    // Found out that the actual key is "rack.specs" (with a dot)
    let rackSpecs = null;
    
    // Try to find rack.specs as a top-level property (flattened dot notation)
    if (settings && settings["rack.specs"] && Array.isArray(settings["rack.specs"]) && settings["rack.specs"].length > 0) {
      console.log('Found rack.specs as a top-level property with dot notation');
      // Use the first spec in the array (most complete one)
      rackSpecs = settings["rack.specs"][0]; 
      console.log('Using rack spec:', rackSpecs);
    } 
    else if (settings && settings.rack && settings.rack.specs) {
      // Try the nested structure
      console.log('Found rack.specs in nested structure');
      rackSpecs = Array.isArray(settings.rack.specs) ? settings.rack.specs[0] : settings.rack.specs;
    }
    
    if (!rackSpecs) {
      // Look for any property that might contain rack specifications
      console.log('Searching for any property containing rack specs...');
      
      for (const key of Object.keys(settings)) {
        if (key.includes('rack') && settings[key]) {
          console.log(`Found potential rack-related key: ${key}`);
          
          // If it's an array, use the first element
          if (Array.isArray(settings[key]) && settings[key].length > 0) {
            console.log(`Key ${key} is an array with ${settings[key].length} items`);
            // If array elements have width and depth, it's likely the rack specs
            if (settings[key][0].width && settings[key][0].depth) {
              rackSpecs = settings[key][0];
              console.log(`Using array element from ${key}:`, rackSpecs);
              break;
            }
          }
          // If it's an object with width and depth directly
          else if (typeof settings[key] === 'object' && settings[key].width && settings[key].depth) {
            rackSpecs = settings[key];
            console.log(`Using object from ${key}:`, rackSpecs);
            break;
          }
        }
      }
    }
    
    if (!rackSpecs) {
      console.error('Rack specifications not found in system settings');
      throw new Error('Rack specifications not found in system settings');
    }
    
    // Ensure required fields are present
    if (!rackSpecs.width || !rackSpecs.depth) {
      console.error('Rack specifications incomplete - missing width or depth');
      throw new Error('Rack specifications incomplete - missing width or depth');
    }
    
    // Create a standardized rack specs object with defaults for missing fields
    return {
      width: rackSpecs.width,
      depth: rackSpecs.depth,
      leg_shape: rackSpecs.leg_shape || 'square',  // Default to square if not specified
      leg_size: rackSpecs.leg_size || 0.03,        // Default to 3cm if not specified
      margin: rackSpecs.margin || [0, 0, 0, 0],    // Default to no margin if not specified
      alignment: rackSpecs.alignment || 'center',  // Default to center alignment if not specified
      alignment_margin_back: rackSpecs.alignment_margin_back || 0.02 // Default to 2cm if not specified
    };
  } catch (error: any) {
    console.error('Failed to get rack specifications:', error.message);
    throw new Error(`Failed to get rack specifications: ${error.message}`);
  }
}

/**
 * Register API routes for robot settings
 */
export function registerRobotSettingsRoutes(app: any) {
  /**
   * GET /api/robot/settings
   * Get robot system settings
   */
  app.get('/api/robot/settings', async (req: Request, res: Response) => {
    try {
      const settings = await fetchRobotSystemSettings();
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching robot settings:', error.message);
      res.status(500).json({ error: `Failed to fetch robot settings: ${error.message}` });
    }
  });

  /**
   * GET /api/robot/settings/rack-specs
   * Get rack specifications for rack alignment operations
   */
  app.get('/api/robot/settings/rack-specs', async (req: Request, res: Response) => {
    try {
      const rackSpecs = await getRackSpecifications();
      res.json(rackSpecs);
    } catch (error: any) {
      console.error('Error fetching rack specifications:', error.message);
      res.status(500).json({ error: `Failed to fetch rack specifications: ${error.message}` });
    }
  });
}