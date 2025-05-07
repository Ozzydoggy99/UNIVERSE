// client/src/hooks/use-simplified-robot-task.ts
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
  const [allPoints, setAllPoints] = useState<Point[]>([]);
  const [floorMap, setFloorMap] = useState<Record<string, Point[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        // Try the simplified API endpoint
        const res = await fetch("/api/fetch-points");
        if (!res.ok) {
          throw new Error(`Failed to fetch points: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        
        // Filter out special-purpose points like Standby and Charging Station
        const validPoints = (data.points || []).filter((p: Point) => {
          const label = p.id?.toLowerCase();
          return (
            label &&
            !label.includes("standby") &&
            !label.includes("charging") &&
            !label.includes("drop") &&
            !label.includes("pick")
          );
        });

        console.log("Filtered points:", validPoints);

        // Organize points by floor number (from the first digit of the ID)
        const buckets: Record<string, Point[]> = {};
        // Ensure floor 1 always exists
        buckets["1"] = [];

        for (const point of validPoints) {
          // Extract the floor number from the point ID
          const floorMatch = point.id.match(/^(\d+)/);
          const floorId = floorMatch ? floorMatch[1] : "1"; // Default to floor 1
          
          // Create the floor bucket if it doesn't exist
          if (!buckets[floorId]) buckets[floorId] = [];
          
          // Add the point to its floor bucket
          buckets[floorId].push(point);
        }

        console.log("Organized into floors:", buckets);

        setAllPoints(validPoints);
        setFloorMap(buckets);
        setError(null);
      } catch (err: any) {
        console.error("Error loading points:", err);
        setError(err instanceof Error ? err : new Error(err?.message || "Unknown error"));
      }
      setIsLoading(false);
    };

    load();
  }, []);

  async function runTask(mode: "pickup" | "dropoff", shelfId: string) {
    setIsRunning(true);
    try {
      const res = await fetch("/api/robot-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, shelfId }),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || "Task failed");
      }
      
      toast({
        title: "Task Completed",
        description: `Successfully completed ${mode} task for shelf ${shelfId}`,
      });
    } catch (err: any) {
      console.error("❌ runTask failed:", err.message);
      toast({
        variant: "destructive",
        title: "Task Failed",
        description: err.message || "Failed to complete the task",
      });
    }
    setIsRunning(false);
  }

  return {
    points: allPoints,
    floorMap,
    isLoading,
    error,
    isRunning,
    runTask
  };
}