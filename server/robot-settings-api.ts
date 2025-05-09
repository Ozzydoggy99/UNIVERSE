// server/robot-settings-api.ts
/**
 * Robot Settings API Functions
 * 
 * This module provides functions to interact with the robot's system settings,
 * including retrieving rack specifications needed for proper rack alignment operations.
 */

import axios from 'axios';
import { ROBOT_API_URL, getAuthHeaders } from './robot-constants';

// Cache settings to reduce API calls
let systemSettingsCache: any = null;
let lastSettingsFetchTime = 0;
const SETTINGS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

/**
 * Fetch robot system settings from the API
 * @returns System settings
 */
export async function fetchRobotSystemSettings(): Promise<any> {
  try {
    // Check cache first
    const now = Date.now();
    if (systemSettingsCache && (now - lastSettingsFetchTime) < SETTINGS_CACHE_TTL) {
      console.log('Using cached system settings');
      return systemSettingsCache;
    }

    console.log('Fetching robot system settings...');
    
    // Fetch effective settings (combined default + user settings)
    const response = await axios.get(`${ROBOT_API_URL}/system/settings/effective`, {
      headers: getAuthHeaders()
    });
    
    if (!response.data) {
      throw new Error('Invalid system settings response');
    }
    
    console.log('Robot system settings fetched successfully');
    
    // Update cache
    systemSettingsCache = response.data;
    lastSettingsFetchTime = now;
    
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching robot system settings: ${error.message}`);
    
    // If we have cached settings, return them
    if (systemSettingsCache) {
      console.log('Using cached system settings due to fetch error');
      return systemSettingsCache;
    }
    
    // No simulated or mock data allowed - throw error if no cached data
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
    // Get the system settings
    const settings = await fetchRobotSystemSettings();
    
    // Look for rack.specs in the settings
    const rackSpecs = settings['rack.specs'];
    
    if (!rackSpecs || !Array.isArray(rackSpecs) || rackSpecs.length === 0) {
      throw new Error('Rack specifications not found in system settings');
    }
    
    console.log(`Found ${rackSpecs.length} rack specifications in system settings`);
    return rackSpecs[0]; // Use the first rack specification
  } catch (error: any) {
    console.error(`Error getting rack specifications: ${error.message}`);
    throw error;
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
  app.get('/api/robot/settings', async (req: any, res: any) => {
    try {
      const settings = await fetchRobotSystemSettings();
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching robot settings:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/robot/settings/rack-specs
   * Get rack specifications for rack alignment operations
   */
  app.get('/api/robot/settings/rack-specs', async (req: any, res: any) => {
    try {
      const rackSpecs = await getRackSpecifications();
      res.json(rackSpecs);
    } catch (error: any) {
      console.error('Error fetching rack specifications:', error);
      res.status(500).json({ error: error.message });
    }
  });
}