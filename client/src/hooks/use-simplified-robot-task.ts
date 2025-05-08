// client/src/hooks/use-simplified-robot-task.ts
import { useState } from 'react';
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
}

/**
 * Hook for working with simplified robot tasks
 */
export function useSimplifiedRobotTask(): UseRobotTaskReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /**
   * Assign a task to the robot
   */
  const assignTask = async (params: TaskParams): Promise<void> => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log('Sending task assignment:', params);
      
      let response;
      // Choose the appropriate API endpoint based on task mode
      if (params.mode === 'pickup') {
        // Use local pickup endpoint for pickup operations
        response = await axios.post('/robots/assign-task/local/pickup', {
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
      
      setSuccess(true);
      
      toast({
        title: "Task assigned successfully",
        description: `The robot is now executing the ${params.mode} task`,
      });
    } catch (err: any) {
      console.error('Task assignment failed:', err);
      
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error';
      setError(errorMessage);
      
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
    success
  };
}