// client/src/hooks/use-simplified-robot-task.ts
import { useState } from 'react';
import axios from 'axios';
import { toast } from "@/hooks/use-toast";

// Define the Point interface matching server-side
interface Point {
  id: string;
  name: string;
  x: number;
  y: number;
  z?: number;
  ori?: number;
  robotId?: string;
  type?: string;
  floor?: string;
  floorId?: string;
}

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
      
      const response = await axios.post('/api/robots/assign-task', params);
      
      console.log('Task assignment successful:', response.data);
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