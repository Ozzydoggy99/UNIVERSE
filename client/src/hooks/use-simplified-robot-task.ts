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

  // Fetch all map points
  const {
    data: points,
    isLoading,
    error,
    refetch,
  } = useQuery<Point[], Error>({
    queryKey: ["/api/robots/points"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Group points by floor
  const floorMap: Record<string, Point[]> = {};
  
  if (points) {
    for (const point of points) {
      const id = point.id.toLowerCase();
      
      // Skip special points like pickup, dropoff, desk, standby
      if (id.includes("pick") || id.includes("drop") || id.includes("desk") || id.includes("standby")) {
        continue;
      }
      
      // First character of ID is considered as floor number
      const floor = point.id.slice(0, 1);
      if (!floorMap[floor]) {
        floorMap[floor] = [];
      }
      floorMap[floor].push(point);
    }
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