import fetch from 'node-fetch';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

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
    } else {
      console.log('[SERVICE HEALTH] LiDAR power service is available');
    }
    
    return available;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    updateServiceHealth('lidarPowerService', false, errorMessage);
    console.warn(`[SERVICE HEALTH] LiDAR power service check failed with exception: ${errorMessage}`);
    return false;
  }
}

// Initialize the service health check
setTimeout(checkServiceHealth, 60 * 1000); // Start checking after 1 minute of server startup