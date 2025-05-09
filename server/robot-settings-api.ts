/**
 * Robot Settings API Module
 * 
 * Provides access to the robot's system settings and rack specifications
 * required for proper rack alignment operations.
 */

import axios from 'axios';
import { Request, Response } from 'express';
import { ROBOT_API_URL, getAuthHeaders } from './robot-constants';

/**
 * Fetch the complete robot system settings
 * These settings contain many configuration parameters for the robot
 * including rack specifications
 * @returns Complete system settings object
 */
export async function fetchRobotSystemSettings(): Promise<any> {
  try {
    console.log('Fetching robot system settings...');
    const response = await axios.get(`${ROBOT_API_URL}/system/settings/effective`, {
      headers: getAuthHeaders()
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
    
    // Navigate to the rack.specs in the settings object
    // Handle different possible paths in the settings hierarchy
    let rackSpecs = null;
    
    if (settings && settings.rack && settings.rack.specs) {
      // Direct path
      rackSpecs = settings.rack.specs;
    } else if (settings && settings.system && settings.system.rack && settings.system.rack.specs) {
      // Nested under system
      rackSpecs = settings.system.rack.specs;
    } else if (settings && settings.schema && settings.schema.rack && settings.schema.rack.specs) {
      // Nested under schema
      rackSpecs = settings.schema.rack.specs;
    }
    
    if (!rackSpecs) {
      // Look for any property that might contain rack specifications
      const rackKeys = Object.keys(settings).filter(key => 
        key.toLowerCase().includes('rack') || 
        (settings[key] && typeof settings[key] === 'object' && 
          Object.keys(settings[key]).some(subKey => subKey.toLowerCase().includes('rack')))
      );
      
      if (rackKeys.length > 0) {
        // Try first matching key
        const firstKey = rackKeys[0];
        if (settings[firstKey] && settings[firstKey].specs) {
          rackSpecs = settings[firstKey].specs;
        } else if (settings[firstKey] && settings[firstKey].rack && settings[firstKey].rack.specs) {
          rackSpecs = settings[firstKey].rack.specs;
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
    
    return {
      width: rackSpecs.width,
      depth: rackSpecs.depth,
      leg_shape: rackSpecs.leg_shape || 'rectangular',  // Default to rectangular if not specified
      hole_diameter: rackSpecs.hole_diameter || 0       // Default to 0 if not specified
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