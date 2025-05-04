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
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
    // Try multiple possible locations for the installer file
    const possiblePaths = [
      path.join(process.cwd(), 'robot-ai-minimal-installer.py'),
      path.join(process.cwd(), 'robot-ai-package', 'robot-ai-minimal-installer.py'),
      path.join(process.cwd(), '..', 'robot-ai-minimal-installer.py'),
      './robot-ai-minimal-installer.py'
    ];
    
    let installerContent = '';
    let foundPath = '';
    
    // Try each path until we find the file
    for (const possiblePath of possiblePaths) {
      console.log(`Checking for installer at ${possiblePath}`);
      if (fs.existsSync(possiblePath)) {
        installerContent = fs.readFileSync(possiblePath, 'utf8');
        foundPath = possiblePath;
        console.log(`Found installer at ${foundPath} (${installerContent.length} bytes)`);
        break;
      }
    }
    
    // If not found in standard locations, create a minimal installer from scratch
    if (!installerContent) {
      console.log('Installer file not found in standard locations, creating minimal installer');
      installerContent = `#!/usr/bin/env python3
"""
Robot AI Minimal Installer
This script installs the Robot AI package on the robot.

Version: 1.0.0
"""
import os
import sys
import time
import json
import subprocess
import tempfile

def create_core_module():
    """Create a simple test module"""
    content = '''
#!/usr/bin/env python3
"""
Robot AI Core Module
Basic test version
"""
import os
import time

def main():
    print("Robot AI Core Module started")
    # Create a status file to indicate the core is running
    with open("/tmp/robot-ai-status.txt", "w") as f:
        f.write(f"Running since {time.ctime()}")
    
    # Keep running
    while True:
        time.sleep(5)
        with open("/tmp/robot-ai-status.txt", "w") as f:
            f.write(f"Running since {time.ctime()}, last update: {time.ctime()}")

if __name__ == "__main__":
    main()
'''
    return content

def create_start_script():
    """Create a start script"""
    return '#!/bin/sh\\npython3 /tmp/robot-ai-core.py &'

def main():
    """Main installer function"""
    print("Robot AI Minimal Installer")
    print("=========================")
    
    # Create the core module
    core_module = create_core_module()
    core_path = "/tmp/robot-ai-core.py"
    with open(core_path, "w") as f:
        f.write(core_module)
    os.chmod(core_path, 0o755)
    
    # Create start script
    start_script = create_start_script()
    start_path = "/tmp/start-robot-ai.sh"
    with open(start_path, "w") as f:
        f.write(start_script)
    os.chmod(start_path, 0o755)
    
    # Start the service
    print("Starting Robot AI service...")
    subprocess.Popen(["sh", start_path])
    
    print("Robot AI installer completed successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main())
`;
      console.log(`Created minimal installer (${installerContent.length} bytes)`);
      foundPath = 'generated-minimal-installer.py';
    }
    
    console.log(`Using installer content (${installerContent.length} bytes)`);
    
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
 * Find existing modules on the robot using the execute-robot-modules.py script
 * 
 * @param serialNumber The robot's serial number
 * @returns Object with list of found modules
 */
export async function findRobotModules(serialNumber: string) {
  console.log(`Finding modules on robot ${serialNumber}`);
  
  try {
    // Set environment variables for the script
    process.env.ROBOT_API_URL = ROBOT_API_URL;
    process.env.ROBOT_SECRET = ROBOT_SECRET;
    
    // Execute the script with --check flag to only find modules
    const { stdout, stderr } = await execAsync(`python3 execute-robot-modules.py --ip ${ROBOT_API_URL.replace(/^https?:\/\//, '')} --check`);
    
    console.log('Module search output:', stdout);
    if (stderr) console.error('Module search errors:', stderr);
    
    // Parse the output to extract found modules
    const moduleLines = stdout.split('\n')
      .filter(line => line.includes('Found module:'))
      .map(line => {
        const match = line.match(/Found module: (.+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    
    return {
      success: true,
      modules: moduleLines,
      message: `Found ${moduleLines.length} modules on the robot`,
      stdout,
      stderr
    };
  } catch (error: any) {
    console.error('Error finding robot modules:', error);
    return {
      success: false,
      modules: [],
      message: `Error finding robot modules: ${error.message}`,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

/**
 * Execute a specific module on the robot using the execute-robot-modules.py script
 * 
 * @param serialNumber The robot's serial number
 * @param modulePath Path to the module to execute
 * @returns Object with execution status
 */
export async function executeRobotModule(serialNumber: string, modulePath: string) {
  console.log(`Executing module ${modulePath} on robot ${serialNumber}`);
  
  try {
    // Set environment variables for the script
    process.env.ROBOT_API_URL = ROBOT_API_URL;
    process.env.ROBOT_SECRET = ROBOT_SECRET;
    
    // Execute the script with --module flag to execute a specific module
    const { stdout, stderr } = await execAsync(`python3 execute-robot-modules.py --ip ${ROBOT_API_URL.replace(/^https?:\/\//, '')} --module "${modulePath}"`);
    
    console.log('Module execution output:', stdout);
    if (stderr) console.error('Module execution errors:', stderr);
    
    // Check if the execution was successful
    const success = stdout.includes('Module execution started') && !stdout.includes('Module execution failed');
    
    return {
      success,
      message: success ? `Successfully executed module ${modulePath}` : `Failed to execute module ${modulePath}`,
      modulePath,
      stdout,
      stderr
    };
  } catch (error: any) {
    console.error(`Error executing module ${modulePath}:`, error);
    return {
      success: false,
      message: `Error executing module ${modulePath}: ${error.message}`,
      modulePath,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
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
  
  // Find modules on robot
  app.get('/api/robots/:serialNumber/find-modules', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      console.log(`Finding modules on robot ${serialNumber}`);
      
      const result = await findRobotModules(serialNumber);
      res.json(result);
    } catch (error: any) {
      console.error('Error finding modules:', error);
      res.status(500).json({
        success: false,
        message: `Error finding modules: ${error.message}`,
        stack: error.stack
      });
    }
  });
  
  // Execute a specific module on robot
  app.post('/api/robots/:serialNumber/execute-module', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { modulePath } = req.body || {};
      
      if (!modulePath) {
        res.status(400).json({
          success: false,
          message: 'Module path is required'
        });
        return;
      }
      
      console.log(`Executing module ${modulePath} on robot ${serialNumber}`);
      
      const result = await executeRobotModule(serialNumber, modulePath);
      
      if (result.success) {
        res.json(result);
      } else {
        console.error('Module execution failed:', result);
        res.status(500).json(result);
      }
    } catch (error: any) {
      console.error('Error executing module:', error);
      res.status(500).json({
        success: false,
        message: `Error executing module: ${error.message}`,
        stack: error.stack
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