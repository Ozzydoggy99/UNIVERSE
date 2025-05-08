// client/src/hooks/use-simplified-robot-task.ts
import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from "@/hooks/use-toast";

// Use the Point interface from our types
import { Point } from '@/types/robot';

// Task parameters interface
interface TaskParams {
  mode: 'pickup' | 'dropoff';
  shelf: Point;
  pickup: Point;
  dropoff: Point;
  standby: Point;
}

// Hook return interface
interface UseRobotTaskReturn {
  assignTask: (params: TaskParams) => Promise<void>;
  loading: boolean;
  error: string | null;
  success: boolean;
  isCharging: boolean; // Indicates if the robot is charging (affects bin operations)
  lastTaskResult: {
    success: boolean;
    charging: boolean;
    message: string;
    duration?: number;
    missionId?: string;
  } | null;
}

/**
 * Hook for working with simplified robot tasks
 */
export function useSimplifiedRobotTask(): UseRobotTaskReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [lastTaskResult, setLastTaskResult] = useState<{
    success: boolean;
    charging: boolean;
    message: string;
    duration?: number;
    missionId?: string;
  } | null>(null);
  
  // Check robot charging status when the hook loads
  useEffect(() => {
    const checkChargingStatus = async () => {
      try {
        const response = await axios.get('/api/robot/charging-status');
        if (response.data && typeof response.data.charging === 'boolean') {
          setIsCharging(response.data.charging);
          console.log('Robot charging status:', response.data.charging ? 'Charging' : 'Not charging');
        }
      } catch (error) {
        console.error('Failed to check robot charging status:', error);
      }
    };
    
    // Check immediately on load
    checkChargingStatus();
    
    // Then check every 30 seconds
    const interval = setInterval(checkChargingStatus, 30000);
    
    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);

  /**
   * Assign a task to the robot
   */
  const assignTask = async (params: TaskParams): Promise<void> => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Check charging status before starting the task
      try {
        const chargingResponse = await axios.get('/api/robot/charging-status');
        if (chargingResponse.data && typeof chargingResponse.data.charging === 'boolean') {
          setIsCharging(chargingResponse.data.charging);
          console.log('Pre-task robot charging status:', chargingResponse.data.charging ? 'Charging' : 'Not charging');
        }
      } catch (chargingError) {
        // Continue with the task even if we can't get charging status
        console.warn('Could not check charging status before task:', chargingError);
      }
      
      console.log('Sending task assignment:', params);
      
      let response;
      // Choose the appropriate API endpoint based on task mode
      if (params.mode === 'pickup') {
        // Use local pickup endpoint for pickup operations
        response = await axios.post('/robots/assign-task/local', {
          shelf: params.shelf,
          pickup: params.pickup,
          standby: params.standby
        });
        console.log('Local pickup task assignment successful:', response.data);
      } else if (params.mode === 'dropoff') {
        // Use local dropoff endpoint for dropoff operations
        response = await axios.post('/robots/assign-task/local/dropoff', {
          shelf: params.shelf,
          pickup: params.pickup,
          standby: params.standby
        });
        console.log('Local dropoff task assignment successful:', response.data);
      } else {
        // Fallback to general task assignment
        response = await axios.post('/robots/assign-task', params);
        console.log('General task assignment successful:', response.data);
      }
      
      // Store the task result
      setLastTaskResult({
        success: true,
        charging: !!response.data.charging,
        message: response.data.message,
        duration: response.data.duration
      });
      
      // Update charging state
      setIsCharging(!!response.data.charging);
      setSuccess(true);
      
      // Show appropriate toast message based on charging status
      if (response.data.charging) {
        toast({
          title: "Task completed in simplified mode",
          description: `The robot is charging. Completed ${params.mode} task without bin operations.`,
        });
      } else {
        toast({
          title: "Task assigned successfully",
          description: `The robot has completed the ${params.mode} task`,
        });
      }
    } catch (err: any) {
      console.error('Task assignment failed:', err);
      
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error';
      setError(errorMessage);
      
      // Reset last task result with failure
      setLastTaskResult({
        success: false,
        charging: false,
        message: errorMessage
      });
      
      toast({
        title: "Task assignment failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    assignTask,
    loading,
    error,
    success,
    isCharging,
    lastTaskResult,
    // The latest mission ID that was created
    latestMissionId: lastTaskResult?.missionId
  };
}