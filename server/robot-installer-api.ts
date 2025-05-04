/**
 * Robot AI Installer API
 * 
 * This module provides API endpoints for remotely installing the Robot AI package
 * on robots, including uploading the installer file if needed.
 */

import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import type { Express } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Upload the Robot AI installer to the robot
 * 
 * @param serialNumber The robot's serial number
 * @param destinationPath The path to save the installer on the robot
 * @returns Object with success status and upload path
 */
export async function uploadInstallerToRobot(serialNumber: string, destinationPath: string = '/tmp/robot-ai-minimal-installer.py') {
  console.log(`Uploading Robot AI installer to robot ${serialNumber} at path ${destinationPath}`);
  
  try {
    // Read the installer file from the local filesystem
    const installerPath = path.join(process.cwd(), 'robot-ai-minimal-installer.py');
    if (!fs.existsSync(installerPath)) {
      throw new Error(`Installer file not found at ${installerPath}`);
    }
    
    const installerContent = fs.readFileSync(installerPath, 'utf8');
    console.log(`Read installer file (${installerContent.length} bytes)`);
    
    // Upload the installer to the robot using the file upload API
    console.log(`Uploading installer to robot at ${destinationPath}`);
    const uploadResponse = await fetch(`${ROBOT_API_URL}/files/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      body: JSON.stringify({
        path: destinationPath,
        content: installerContent
      })
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`Upload response error (${uploadResponse.status}): ${errorText}`);
      throw new Error(`Failed to upload installer: HTTP ${uploadResponse.status} - ${errorText}`);
    }
    
    console.log('Upload successful');
    
    return {
      success: true,
      message: `Successfully uploaded Robot AI installer to ${destinationPath}`,
      path: destinationPath
    };
  } catch (error) {
    console.error('Error uploading Robot AI installer:', error);
    return {
      success: false,
      message: `Error uploading Robot AI installer: ${error.message}`
    };
  }
}

/**
 * Execute the Robot AI installer script on a robot
 * 
 * @param serialNumber The robot's serial number
 * @param installerPath The path to the installer script on the robot
 * @returns Object with success status and message
 */
export async function executeInstaller(
  serialNumber: string, 
  installerPath: string = '/home/robot/robot-ai-minimal-installer.py', 
  skipUpload: boolean = true,
  useDirectPythonCommand: boolean = true
) {
  console.log(`Executing Robot AI installer on robot ${serialNumber} at path ${installerPath}`);
  console.log(`Robot API URL: ${ROBOT_API_URL}, Secret available: ${ROBOT_SECRET ? 'Yes' : 'No'}`);
  console.log(`Skip upload: ${skipUpload}`);
  
  try {
    // First verify that the file exists
    console.log(`Checking if installer exists at path: ${installerPath}`);
    const fileCheckResponse = await fetch(`${ROBOT_API_URL}/services/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      body: JSON.stringify({
        command: `test -f ${installerPath} && echo "exists" || echo "not exists"`
      })
    });
    
    if (!fileCheckResponse.ok) {
      console.error(`File check response error: ${fileCheckResponse.status}`);
    } else {
      const fileCheckResult = await fileCheckResponse.json();
      console.log('File check result:', fileCheckResult);
      
      if (fileCheckResult.stdout?.trim() !== 'exists') {
        console.warn(`Installer file not found at ${installerPath}`);
        
        // Try a different location
        installerPath = installerPath.includes('/home/robot') ? 
          '/tmp/robot-ai-minimal-installer.py' : 
          '/home/robot/robot-ai-minimal-installer.py';
          
        console.log(`Trying alternate installer location: ${installerPath}`);
        
        // Check if the alternate location exists
        const altFileCheckResponse = await fetch(`${ROBOT_API_URL}/services/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Secret ${ROBOT_SECRET}`
          },
          body: JSON.stringify({
            command: `test -f ${installerPath} && echo "exists" || echo "not exists"`
          })
        });
        
        if (altFileCheckResponse.ok) {
          const altFileCheckResult = await altFileCheckResponse.json();
          console.log('Alternate file check result:', altFileCheckResult);
          
          if (altFileCheckResult.stdout?.trim() !== 'exists') {
            console.error('Installer not found in either location');
            
            // If skipUpload is true but the file doesn't exist, we need to upload it
            skipUpload = false;
          }
        }
      }
    }
    
    // Upload the installer if needed (skipped by default)
    if (!skipUpload) {
      console.log("Uploading installer to robot...");
      const uploadResult = await uploadInstallerToRobot(serialNumber, installerPath);
      if (!uploadResult.success) {
        throw new Error(`Failed to upload installer: ${uploadResult.message}`);
      }
    } else {
      console.log("Skipping upload as requested - using existing installer on robot");
    }
    
    // Make the installer executable
    console.log(`Making installer executable: chmod +x ${installerPath}`);
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
      const errorText = await chmodResponse.text();
      console.error(`Chmod response error (${chmodResponse.status}): ${errorText}`);
      throw new Error(`Failed to make installer executable: HTTP ${chmodResponse.status} - ${errorText}`);
    }
    
    const chmodResult = await chmodResponse.json();
    console.log('Chmod result:', chmodResult);
    
    // Then execute the installer
    let pythonCommand = useDirectPythonCommand ? 
      `python3 ${installerPath}` : 
      `/usr/bin/env python3 ${installerPath}`;
      
    console.log(`Executing installer with command: ${pythonCommand}`);
    
    // Try both approaches one after another to improve chances of success
    let executeResponse;
    let errorMessage = '';
    
    try {
      executeResponse = await fetch(`${ROBOT_API_URL}/services/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Secret ${ROBOT_SECRET}`
        },
        body: JSON.stringify({
          command: pythonCommand
        })
      });
    } catch (error) {
      console.error('First execution attempt failed:', error);
      errorMessage += `First attempt failed: ${error.message}. `;
      
      // If first attempt fails, try alternate Python execution syntax
      pythonCommand = useDirectPythonCommand ? 
        `/usr/bin/env python3 ${installerPath}` : 
        `python3 ${installerPath}`;
        
      console.log(`Retrying with alternate command: ${pythonCommand}`);
      
      executeResponse = await fetch(`${ROBOT_API_URL}/services/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Secret ${ROBOT_SECRET}`
        },
        body: JSON.stringify({
          command: pythonCommand
        })
      });
    }
    
    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error(`Execute response error (${executeResponse.status}): ${errorText}`);
      throw new Error(`Failed to execute installer: HTTP ${executeResponse.status} - ${errorText}`);
    }
    
    const result = await executeResponse.json();
    console.log('Execution result:', result);
    
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
  // Test the robot connection API
  app.get('/api/robots/:serialNumber/test-connection', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      console.log(`Testing connection to robot ${serialNumber}`);
      
      const response = await fetch(`${ROBOT_API_URL}/device/info`, {
        method: 'GET',
        headers: {
          'Authorization': `Secret ${ROBOT_SECRET}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Robot connection error (${response.status}): ${errorText}`);
        res.status(response.status).json({
          success: false,
          message: `Failed to connect to robot: HTTP ${response.status} - ${errorText}`,
          status: response.status
        });
        return;
      }
      
      const deviceInfo = await response.json();
      console.log('Robot device info:', deviceInfo);
      
      res.json({
        success: true,
        message: 'Successfully connected to robot',
        deviceInfo
      });
    } catch (error: any) {
      console.error('Error testing robot connection:', error);
      res.status(500).json({
        success: false,
        message: `Error testing robot connection: ${error.message}`,
        error: error.stack
      });
    }
  });

  // Check for installer file existence
  app.get('/api/robots/:serialNumber/check-installer', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { path } = req.query;
      const installerPath = path?.toString() || '/home/robot/robot-ai-minimal-installer.py';
      
      console.log(`Checking for installer at ${installerPath} on robot ${serialNumber}`);
      
      const fileCheckResponse = await fetch(`${ROBOT_API_URL}/services/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Secret ${ROBOT_SECRET}`
        },
        body: JSON.stringify({
          command: `test -f ${installerPath} && echo "exists" || echo "not exists"`
        })
      });
      
      if (!fileCheckResponse.ok) {
        const errorText = await fileCheckResponse.text();
        console.error(`File check error (${fileCheckResponse.status}): ${errorText}`);
        res.status(fileCheckResponse.status).json({
          success: false,
          message: `Failed to check for installer: HTTP ${fileCheckResponse.status} - ${errorText}`,
          path: installerPath
        });
        return;
      }
      
      const fileCheckResult = await fileCheckResponse.json();
      console.log('File check result:', fileCheckResult);
      
      const fileExists = fileCheckResult.stdout?.trim() === 'exists';
      
      // Also check alternate location
      const altPath = installerPath.includes('/home/robot') ? 
        '/tmp/robot-ai-minimal-installer.py' : 
        '/home/robot/robot-ai-minimal-installer.py';
      
      const altCheckResponse = await fetch(`${ROBOT_API_URL}/services/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Secret ${ROBOT_SECRET}`
        },
        body: JSON.stringify({
          command: `test -f ${altPath} && echo "exists" || echo "not exists"`
        })
      });
      
      let altExists = false;
      if (altCheckResponse.ok) {
        const altCheckResult = await altCheckResponse.json();
        altExists = altCheckResult.stdout?.trim() === 'exists';
      }
      
      res.json({
        success: true,
        exists: fileExists,
        path: installerPath,
        alternativePath: altPath,
        alternativeExists: altExists,
        stdout: fileCheckResult.stdout,
        stderr: fileCheckResult.stderr
      });
    } catch (error: any) {
      console.error('Error checking for installer:', error);
      res.status(500).json({
        success: false,
        message: `Error checking for installer: ${error.message}`,
        error: error.stack
      });
    }
  });

  // Execute installer on robot
  app.post('/api/robots/:serialNumber/execute-installer', async (req: Request, res: Response) => {
    try {
      console.log('Received execute installer request:', req.params, req.body);
      const { serialNumber } = req.params;
      const { installerPath } = req.body || {};
      
      // Explicitly log all parameters 
      console.log(`Executing installer with: serialNumber=${serialNumber}, installerPath=${installerPath}`);
      console.log(`Robot API URL: ${ROBOT_API_URL}`);
      console.log(`Secret available: ${ROBOT_SECRET ? 'Yes' : 'No'}`);
      
      const result = await executeInstaller(serialNumber, installerPath);
      console.log('Installer execution result:', result);
      
      if (result.success) {
        res.json(result);
      } else {
        console.error('Installer execution failed:', result);
        res.status(500).json(result);
      }
    } catch (error: any) {
      console.error('Error executing installer:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        success: false, 
        message: `Error executing installer: ${error.message}`,
        stack: error.stack
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
  
  // Upload installer file to robot
  app.post('/api/robots/:serialNumber/upload-installer', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { destinationPath } = req.body || {};
      
      console.log(`Uploading installer to robot ${serialNumber} at path ${destinationPath}`);
      
      const result = await uploadInstallerToRobot(serialNumber, destinationPath);
      
      if (result.success) {
        res.json(result);
      } else {
        console.error('Installer upload failed:', result);
        res.status(500).json(result);
      }
    } catch (error: any) {
      console.error('Error uploading installer:', error);
      res.status(500).json({ 
        success: false, 
        message: `Error uploading installer: ${error.message}`,
        stack: error.stack
      });
    }
  });
}