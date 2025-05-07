// client/src/hooks/use-simplified-robot-task.ts
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

// Point type returned from API
export interface Point {
  id: string;
  x: number;
  y: number;
  ori: number;
  description?: string;
}

// Type for our task execution parameters
export interface TaskParams {
  mode: "pickup" | "dropoff";
  shelfId: string;
}

/**
 * Custom hook for simplified robot task UI
 * - Fetches map points and groups them by floor
 * - Provides mutations for running a task
 */
export function useSimplifiedRobotTask() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);

  // Attempt to fetch points from both the old endpoint (/api/robots/points)
  // and the new simplified endpoint (/api/fetch-points)
  const {
    data: pointsData,
    isLoading,
    error,
    refetch,
  } = useQuery<{ points: Point[] } | Point[], Error>({
    queryKey: ["/api/fetch-points"],
    queryFn: async () => {
      try {
        // Try the simplified API endpoint first
        const response = await fetch("/api/fetch-points");
        
        if (response.ok) {
          const data = await response.json();
          // The simplified API returns { points: [...] }
          return data;
        }
        
        // Fall back to the original endpoint
        const oldResponse = await fetch("/api/robots/points");
        if (!oldResponse.ok) {
          throw new Error("Failed to fetch points from both endpoints");
        }
        
        // Original endpoint returns points array directly
        const points = await oldResponse.json();
        return points;
      } catch (err: any) {
        console.error("Error fetching points:", err);
        throw new Error(err.message || "Failed to fetch points");
      }
    },
  });

  // Extract points array regardless of API format
  const points = Array.isArray(pointsData) 
    ? pointsData                 // Original API format
    : pointsData?.points || [];  // Simplified API format

  // Group points by floor
  const floorMap: Record<string, Point[]> = {};
  
  // Ensure floor 1 always exists even if we don't have points yet
  floorMap["1"] = [];
  
  for (const point of points) {
    // Skip special points like Charging Station and Standby
    if (point.id.toLowerCase().includes("charging") || 
        point.id.toLowerCase().includes("standby")) {
      continue;
    }
    
    // Regular numbered shelf points like "1", "101"
    // First character is considered the floor (e.g., "1" for point "101")
    let floor = "1"; // Default to floor 1
    
    if (/^\d/.test(point.id)) {
      // If the ID starts with a digit, use that as the floor
      floor = point.id.charAt(0);
    }
    
    // Ensure the floor exists in our map
    if (!floorMap[floor]) {
      floorMap[floor] = [];
    }
    
    floorMap[floor].push(point);
  }
  
  // If we have no points at all, add a placeholder for floor 1
  if (Object.keys(floorMap).length === 0) {
    floorMap["1"] = [];
  }

  // Mutation for running a task
  const taskMutation = useMutation({
    mutationFn: async (params: TaskParams) => {
      setIsRunning(true);
      
      const response = await fetch("/api/robot-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to execute task");
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Task Completed",
        description: `Successfully completed ${variables.mode} task for shelf ${variables.shelfId}`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Task Failed",
        description: error.message || "Failed to complete the task",
      });
    },
    onSettled: () => {
      setIsRunning(false);
    }
  });

  // Helper method to run a task
  const runTask = (mode: "pickup" | "dropoff", shelfId: string) => {
    taskMutation.mutate({ mode, shelfId });
  };

  return {
    points,
    floorMap,
    isLoading,
    error,
    isRunning: isRunning || taskMutation.isPending,
    runTask,
    refetchPoints: refetch,
  };
}