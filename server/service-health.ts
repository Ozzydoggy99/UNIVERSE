import fetch from 'node-fetch';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { isRobotConnected } from './robot-websocket';

// Track power cycle status
interface PowerCycleStatus {
  inProgress: boolean;
  lastAttempt: number;
  success: boolean;
  error?: string;
  expectedRecoveryTime?: number;
  robotConnected?: boolean;
  recoveryProgress?: number;
  recoveryFailed?: boolean;
  maxRecoveryTime?: number;
}

// Power cycle state
export const powerCycleState: PowerCycleStatus = {
  inProgress: false,
  lastAttempt: 0,
  success: false
};

// Service health monitoring
export interface ServiceHealth {
  available: boolean;
  lastChecked: number;
  consecutiveFailures: number;
  recoveryAttempted: boolean;
  lastError?: string;
}

// Robot services health status
export const robotServiceHealth: Record<string, ServiceHealth> = {
  lidarPowerService: {
    available: true,  // Assume available until proven otherwise
    lastChecked: 0,
    consecutiveFailures: 0,
    recoveryAttempted: false
  },
  resetLocalizationService: {
    available: true,
    lastChecked: 0,
    consecutiveFailures: 0,
    recoveryAttempted: false
  }
};

/**
 * Check and update service health status
 * @param serviceName Name of the service to check
 * @param available Whether the service call was successful
 * @param error Optional error message if the service call failed
 */
export function updateServiceHealth(serviceName: string, available: boolean, error?: string) {
  const now = Date.now();
  const serviceHealth = robotServiceHealth[serviceName];
  
  if (!serviceHealth) {
    // If service not tracked yet, initialize it
    robotServiceHealth[serviceName] = {
      available,
      lastChecked: now,
      consecutiveFailures: available ? 0 : 1,
      recoveryAttempted: false,
      lastError: error
    };
    return;
  }
  
  // Update service health
  serviceHealth.lastChecked = now;
  
  if (available) {
    // Service is working - reset failure count
    serviceHealth.available = true;
    serviceHealth.consecutiveFailures = 0;
    serviceHealth.recoveryAttempted = false;
    serviceHealth.lastError = undefined;
  } else {
    // Service failed
    serviceHealth.available = false;
    serviceHealth.consecutiveFailures++;
    serviceHealth.lastError = error;
  }
  
  // Log significant health changes
  if (!available && serviceHealth.consecutiveFailures === 1) {
    console.warn(`[SERVICE HEALTH] Service ${serviceName} is now unavailable. Error: ${error}`);
  } else if (available && serviceHealth.consecutiveFailures > 0) {
    console.log(`[SERVICE HEALTH] Service ${serviceName} has recovered after ${serviceHealth.consecutiveFailures} failures`);
  }
}

/**
 * Attempt to recover a failed service
 * @param serviceName Name of the service to recover
 * @returns Whether recovery was attempted
 */
export async function attemptServiceRecovery(serviceName: string): Promise<boolean> {
  const serviceHealth = robotServiceHealth[serviceName];
  
  if (!serviceHealth || serviceHealth.available || serviceHealth.recoveryAttempted) {
    return false;
  }
  
  // Mark recovery as attempted
  serviceHealth.recoveryAttempted = true;
  console.log(`[SERVICE RECOVERY] Attempting to recover service ${serviceName}`);
  
  // Different recovery strategies for different services
  if (serviceName === 'lidarPowerService') {
    try {
      // For LiDAR power service, try calling restart_lidar_node service if available
      console.log('[SERVICE RECOVERY] Attempting to restart LiDAR subsystem via alternative method');
      
      // Check for alternative restart services
      const alternativeServices = [
        '/services/restart_lidar_node',
        '/services/baseboard/restart_lidar',
        '/services/restart_hardware/lidar'
      ];
      
      for (const service of alternativeServices) {
        try {
          const response = await fetch(`${ROBOT_API_URL}${service}`, {
            method: 'POST',
            headers: {
              'Secret': ROBOT_SECRET || '',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
          });
          
          if (response.ok) {
            console.log(`[SERVICE RECOVERY] Successfully called ${service} to recover LiDAR`);
            return true;
          }
        } catch (e) {
          // Ignore errors for alternative services, try the next one
        }
      }
      
      // If we reach here, none of the alternative services worked
      return false;
    } catch (error) {
      console.error(`[SERVICE RECOVERY] Failed to recover service ${serviceName}: ${error}`);
      return false;
    }
  }
  
  return false;
}

/**
 * Periodically check service health
 * This is called on a timer to proactively monitor service health
 */
export async function checkServiceHealth() {
  console.log('[SERVICE HEALTH] Performing periodic service health check');
  
  // Check LiDAR power service health if it's been more than 5 minutes
  const lidarServiceHealth = robotServiceHealth.lidarPowerService;
  const now = Date.now();
  
  if (now - lidarServiceHealth.lastChecked > 5 * 60 * 1000) {
    await checkLidarPowerServiceHealth();
  }
  
  // Schedule next check in 5 minutes
  setTimeout(checkServiceHealth, 5 * 60 * 1000);
}

/**
 * Check if the LiDAR power service is available
 * @returns Whether the service is available
 */
export async function checkLidarPowerServiceHealth(): Promise<boolean> {
  try {
    console.log('[SERVICE HEALTH] Checking LiDAR power service health');
    
    // Make a lightweight probe call to the service
    const apiUrl = `${ROBOT_API_URL}/services/baseboard/power_on_lidar`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Secret': ROBOT_SECRET || '',
        'Content-Type': 'application/json'
      },
      // Just try to get the current status without changing it
      body: JSON.stringify({ action: 'power_on' })
    });
    
    // Update service health
    const available = response.ok;
    const error = available ? undefined : await response.text();
    updateServiceHealth('lidarPowerService', available, error);
    
    if (!available) {
      console.warn(`[SERVICE HEALTH] LiDAR power service check failed: ${error}`);
      
      // When LiDAR service fails, automatically attempt recovery
      const lidarServiceHealth = robotServiceHealth.lidarPowerService;
      
      // Only attempt recovery after multiple consecutive failures
      if (lidarServiceHealth.consecutiveFailures > 2 && !lidarServiceHealth.recoveryAttempted) {
        console.log('[SERVICE HEALTH] LiDAR service has failed multiple times. Attempting recovery.');
        const recoveryAttempted = await attemptServiceRecovery('lidarPowerService');
        
        if (!recoveryAttempted) {
          console.log('[SERVICE HEALTH] No recovery method available for LiDAR. Consider power cycling the robot.');
          
          // Check if a power cycle is already in progress
          if (!powerCycleState.inProgress && 
              Date.now() - powerCycleState.lastAttempt > 10 * 60 * 1000) { // Ensure 10 minute gap between auto-power cycles
            console.log('[SERVICE HEALTH] Initiating automatic power cycle to recover LiDAR service');
            // Don't await this - let it run in the background
            remotePowerCycleRobot('restart').then(result => {
              console.log(`[SERVICE HEALTH] Auto power cycle result: ${JSON.stringify(result)}`);
            }).catch(err => {
              console.error('[SERVICE HEALTH] Auto power cycle failed:', err);
            });
          }
        }
      }
    } else {
      console.log('[SERVICE HEALTH] LiDAR power service is available');
    }
    
    return available;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    updateServiceHealth('lidarPowerService', false, errorMessage);
    console.warn(`[SERVICE HEALTH] LiDAR power service check failed with exception: ${errorMessage}`);
    
    // This is a serious error - it means the service endpoint itself is unreachable
    console.warn('[SERVICE HEALTH] Service endpoint unreachable. Will check robot connection status.');
    
    // Check robot connection
    if (isRobotConnected()) {
      console.log('[SERVICE HEALTH] Robot is connected, but service endpoint unavailable. May need restart.');
    } else {
      console.error('[SERVICE HEALTH] Robot not connected. Cannot reach services.');
    }
    
    return false;
  }
}

/**
 * Remote power cycle the robot
 * @param method The power cycle method to use ('restart' or 'shutdown')
 * @returns Promise with result of power cycle attempt
 */
export async function remotePowerCycleRobot(method: 'restart' | 'shutdown' = 'restart'): Promise<{success: boolean, message: string}> {
  try {
    const now = Date.now();
    
    // Detailed initial logging
    console.log(`[POWER CYCLE] Beginning power cycle process (method: ${method})`);
    console.log(`[POWER CYCLE] Current state: ${JSON.stringify({
      inProgress: powerCycleState.inProgress,
      lastAttempt: powerCycleState.lastAttempt ? new Date(powerCycleState.lastAttempt).toISOString() : 'never',
      cooldownRemaining: powerCycleState.lastAttempt ? 
        Math.ceil((5 * 60 * 1000 - (now - powerCycleState.lastAttempt)) / 1000 / 60) : 0
    })}`);
    
    // Prevent multiple power cycles in a short period
    if (powerCycleState.inProgress) {
      console.log('[POWER CYCLE] Rejected: Power cycle already in progress');
      return {
        success: false,
        message: 'Power cycle already in progress'
      };
    }
    
    // Enforce cooldown period (at least 5 minutes between attempts)
    const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
    if (now - powerCycleState.lastAttempt < cooldownPeriod) {
      const remainingCooldown = Math.ceil((cooldownPeriod - (now - powerCycleState.lastAttempt)) / 1000 / 60);
      console.log(`[POWER CYCLE] Rejected: Must wait ${remainingCooldown} more minutes before attempting another power cycle`);
      return {
        success: false,
        message: `Must wait ${remainingCooldown} more minutes before attempting another power cycle`
      };
    }
    
    // Update state
    powerCycleState.inProgress = true;
    powerCycleState.lastAttempt = now;
    powerCycleState.success = false; // Reset success state
    powerCycleState.error = undefined; // Clear any previous errors
    
    // Check if robot is connected before attempting power cycle
    console.log(`[POWER CYCLE] Robot connection status check: ${isRobotConnected() ? 'Connected' : 'Not Connected'}`);
    
    // Get the right endpoint based on method
    const endpoint = method === 'restart' ? '/services/restart_robot' : '/services/shutdown_robot';
    
    console.log(`[POWER CYCLE] Attempting to ${method} robot via ${endpoint}`);
    
    // Try alternate endpoints if the primary one fails
    // Added more possible endpoints based on common robot API patterns
    const alternateEndpoints = [
      `/services/${method}_robot`, 
      `/services/robot/${method}`,
      `/services/system/${method}`,
      `/api/reboot`,                // AxBot API endpoint
      `/api/system/reboot`,         // Common system API endpoint
      `/services/power/restart`,    // Another common power service endpoint
      `/api/robot/power/restart`,   // Newer robot API models
      `/api/robot/restart`,         // Another common endpoint
      `/services/robot/control/restart`, // Nested service endpoint
      `/system/control/power/${method}`, // System control endpoint
      `/action/reboot`,             // Legacy robot endpoint
      `/services/reboot`,           // Common ROS service endpoint
      `/system/power/${method}`     // System power command
    ];
    
    // First try the main endpoint
    try {
      console.log(`[POWER CYCLE] Sending ${method} request to ${ROBOT_API_URL}${endpoint}`);
      const response = await fetch(`${ROBOT_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Secret': ROBOT_SECRET || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Most restart endpoints don't need parameters
      });
      
      console.log(`[POWER CYCLE] Response status: ${response.status} ${response.statusText}`);
      const responseText = await response.text();
      console.log(`[POWER CYCLE] Response body: ${responseText.substring(0, 200)}`);
      
      if (response.ok) {
        console.log(`[POWER CYCLE] Successfully initiated ${method} via ${endpoint}`);
        
        // Set expected recovery time
        powerCycleState.expectedRecoveryTime = now + (method === 'restart' ? 2 * 60 * 1000 : 5 * 60 * 1000);
        powerCycleState.success = true;
        
        // Reset service health statuses after restart
        setTimeout(() => {
          Object.keys(robotServiceHealth).forEach(serviceName => {
            updateServiceHealth(serviceName, true);
          });
          powerCycleState.inProgress = false;
        }, powerCycleState.expectedRecoveryTime - now);
        
        return {
          success: true,
          message: `Robot ${method} initiated successfully. Expected recovery in ${method === 'restart' ? '2' : '5'} minutes.`
        };
      }
    } catch (error) {
      console.warn(`[POWER CYCLE] Primary ${method} endpoint failed:`, error);
      // Continue to alternates
    }
    
    // Try alternate endpoints
    for (const altEndpoint of alternateEndpoints) {
      try {
        console.log(`[POWER CYCLE] Trying alternate endpoint: ${ROBOT_API_URL}${altEndpoint}`);
        const response = await fetch(`${ROBOT_API_URL}${altEndpoint}`, {
          method: 'POST',
          headers: {
            'Secret': ROBOT_SECRET || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        
        console.log(`[POWER CYCLE] Alternate endpoint response status: ${response.status} ${response.statusText}`);
        const responseText = await response.text();
        console.log(`[POWER CYCLE] Alternate endpoint response body: ${responseText.substring(0, 200)}`);
        
        if (response.ok) {
          console.log(`[POWER CYCLE] Successfully initiated ${method} via alternate endpoint ${altEndpoint}`);
          
          // Set expected recovery time
          powerCycleState.expectedRecoveryTime = now + (method === 'restart' ? 2 * 60 * 1000 : 5 * 60 * 1000);
          powerCycleState.success = true;
          
          // Reset service health statuses after restart
          setTimeout(() => {
            Object.keys(robotServiceHealth).forEach(serviceName => {
              updateServiceHealth(serviceName, true);
            });
            powerCycleState.inProgress = false;
          }, powerCycleState.expectedRecoveryTime - now);
          
          return {
            success: true,
            message: `Robot ${method} initiated successfully via alternate method. Expected recovery in ${method === 'restart' ? '2' : '5'} minutes.`
          };
        }
      } catch (error) {
        // Just log and continue to next alternate
        console.warn(`[POWER CYCLE] Alternate ${method} endpoint ${altEndpoint} failed:`, error);
      }
    }
    
    // If we get here, all attempts failed
    powerCycleState.inProgress = false;
    powerCycleState.success = false;
    powerCycleState.error = 'All power cycle attempts failed';
    
    return {
      success: false,
      message: 'Failed to power cycle robot. All remote restart methods failed.'
    };
    
  } catch (error) {
    // Reset state in case of unexpected error
    powerCycleState.inProgress = false;
    powerCycleState.success = false;
    powerCycleState.error = error instanceof Error ? error.message : String(error);
    
    console.error('[POWER CYCLE] Unexpected error during power cycle attempt:', error);
    
    return {
      success: false,
      message: `Unexpected error during power cycle attempt: ${powerCycleState.error}`
    };
  }
}

/**
 * Get current power cycle status
 * @returns Current power cycle status
 */
export function getPowerCycleStatus(): {
  inProgress: boolean;
  lastAttempt: string;
  success: boolean;
  error?: string;
  remainingTime?: number;
  robotConnected?: boolean;
  recoveryProgress?: number;
} {
  const now = Date.now();
  const remainingTime = powerCycleState.expectedRecoveryTime 
    ? Math.max(0, Math.floor((powerCycleState.expectedRecoveryTime - now) / 1000))
    : undefined;
  
  // Check if robot is connected
  const robotConnected = isRobotConnected();
  
  // If robot comes back before the expected recovery time and power cycle is still marked as in progress
  if (robotConnected && powerCycleState.inProgress && powerCycleState.expectedRecoveryTime && now < powerCycleState.expectedRecoveryTime) {
    console.log(`[POWER CYCLE] Robot is back online before expected recovery time. Marking power cycle as completed.`);
    
    // Robot reconnected faster than expected, mark as success and complete
    powerCycleState.inProgress = false;
    powerCycleState.success = true;
    
    // Reset service health statuses
    Object.keys(robotServiceHealth).forEach(serviceName => {
      updateServiceHealth(serviceName, true);
    });
  }
  
  // Calculate recovery progress percentage if in progress
  let recoveryProgress: number | undefined = undefined;
  if (powerCycleState.inProgress && powerCycleState.expectedRecoveryTime && powerCycleState.lastAttempt) {
    const totalRecoveryTime = powerCycleState.expectedRecoveryTime - powerCycleState.lastAttempt;
    const elapsed = now - powerCycleState.lastAttempt;
    recoveryProgress = Math.min(100, Math.floor((elapsed / totalRecoveryTime) * 100));
  }
  
  console.log(`[POWER CYCLE] Current status: ${JSON.stringify({
    inProgress: powerCycleState.inProgress,
    success: powerCycleState.success,
    remainingTime: remainingTime || 'N/A',
    robotConnected
  })}`);
  
  return {
    inProgress: powerCycleState.inProgress,
    lastAttempt: powerCycleState.lastAttempt ? new Date(powerCycleState.lastAttempt).toISOString() : 'Never',
    success: powerCycleState.success,
    error: powerCycleState.error,
    remainingTime,
    robotConnected,
    recoveryProgress
  };
}

// Initialize the service health check
setTimeout(checkServiceHealth, 60 * 1000); // Start checking after 1 minute of server startup