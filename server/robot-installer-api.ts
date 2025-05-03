/**
 * Robot AI Installer API
 * 
 * This module provides API endpoints for remotely installing the Robot AI package
 * on robots that have already had the installer uploaded to them.
 */

import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

/**
 * Execute the Robot AI installer script on a robot
 * 
 * @param serialNumber The robot's serial number
 * @param installerPath The path to the installer script on the robot
 * @returns Object with success status and message
 */
export async function executeInstaller(serialNumber: string, installerPath: string = '/tmp/robot-ai-minimal-installer.py') {
  console.log(`Executing Robot AI installer on robot ${serialNumber} at path ${installerPath}`);
  
  try {
    // First, make the installer executable
    const chmodResponse = await fetch(`${ROBOT_API_URL}/services/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      body: JSON.stringify({
        command: `chmod +x ${installerPath}`
      })
    });
    
    if (!chmodResponse.ok) {
      const error = await chmodResponse.text();
      throw new Error(`Failed to make installer executable: ${error}`);
    }
    
    // Then execute the installer
    const executeResponse = await fetch(`${ROBOT_API_URL}/services/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      body: JSON.stringify({
        command: `python3 ${installerPath}`
      })
    });
    
    if (!executeResponse.ok) {
      const error = await executeResponse.text();
      throw new Error(`Failed to execute installer: ${error}`);
    }
    
    const result = await executeResponse.json();
    
    return {
      success: true,
      message: 'Successfully started Robot AI installation',
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    console.error('Error executing Robot AI installer:', error);
    return {
      success: false,
      message: `Error executing Robot AI installer: ${error.message}`
    };
  }
}

/**
 * Check if Robot AI is installed and running on a robot
 * 
 * @param serialNumber The robot's serial number
 * @returns Object with status of Robot AI installation
 */
export async function checkRobotAIStatus(serialNumber: string) {
  console.log(`Checking Robot AI status on robot ${serialNumber}`);
  
  try {
    // Check if robot-ai service is running
    const response = await fetch(`${ROBOT_API_URL}/services/status`, {
      headers: {
        'Authorization': `Secret ${ROBOT_SECRET}`
      }
    });
    
    if (!response.ok) {
      return {
        installed: false,
        running: false,
        message: 'Failed to check service status'
      };
    }
    
    const services = await response.json();
    const robotAIService = services.find(s => s.name?.includes('robot-ai'));
    
    if (robotAIService) {
      // Robot AI service exists
      return {
        installed: true,
        running: robotAIService.status === 'running',
        message: `Robot AI is ${robotAIService.status === 'running' ? 'running' : 'installed but not running'}`
      };
    }
    
    // Check if Robot AI files exist
    const fileCheckResponse = await fetch(`${ROBOT_API_URL}/services/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      body: JSON.stringify({
        command: 'test -d /home/robot/robot-ai && echo "exists" || echo "not exists"'
      })
    });
    
    const fileCheckResult = await fileCheckResponse.json();
    const exists = fileCheckResult.stdout?.trim() === 'exists';
    
    return {
      installed: exists,
      running: false,
      message: exists ? 'Robot AI is installed but not running' : 'Robot AI is not installed'
    };
  } catch (error) {
    console.error('Error checking Robot AI status:', error);
    return {
      installed: false,
      running: false,
      message: `Error checking Robot AI status: ${error.message}`
    };
  }
}

/**
 * Register Robot AI Installer API routes
 */
export function registerRobotInstallerRoutes(app: Express) {
  // Execute installer on robot
  app.post('/api/robots/:serialNumber/execute-installer', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { installerPath } = req.body;
      
      const result = await executeInstaller(serialNumber, installerPath);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Error executing installer:', error);
      res.status(500).json({ 
        success: false, 
        message: `Error executing installer: ${error.message}` 
      });
    }
  });
  
  // Check Robot AI status
  app.get('/api/robots/:serialNumber/robot-ai-status', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const status = await checkRobotAIStatus(serialNumber);
      res.json(status);
    } catch (error) {
      console.error('Error checking Robot AI status:', error);
      res.status(500).json({ 
        success: false, 
        message: `Error checking Robot AI status: ${error.message}` 
      });
    }
  });
}