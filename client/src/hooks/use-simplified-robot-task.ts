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
        
        // Get all available points
        const allAvailablePoints = data.points || [];
        console.log("All available points:", allAvailablePoints.map((p: Point) => p.id));

        // Filter out special-purpose points for our shelf selection UI
        const validPoints = allAvailablePoints.filter((p: Point) => {
          const label = p.id?.toLowerCase();
          // Skip points that don't have an ID
          if (!label) return false;
          
          // Skip special purpose points, they're not shelf locations to show in UI
          const isSpecialPoint = 
            label.includes("standby") || 
            label.includes("charging") || 
            label.includes("drop") || 
            label.includes("pick");
            
          return !isSpecialPoint;
        });

        console.log("Filtered points for UI:", validPoints.map((p: Point) => p.id));

        // Organize points by floor number 
        const buckets: Record<string, Point[]> = {};
        
        for (const point of validPoints) {
          // First, try to extract a floor number from the beginning of the ID
          let floorId = "1"; // Default to floor 1
          
          // Check if the ID is a simple number (like "1", "2", etc.)
          if (/^\d+$/.test(point.id)) {
            floorId = point.id; // Use the number itself as the floor
          } 
          // If it starts with a number followed by other chars (like "1-A", "2_shelf", etc.)
          else if (/^(\d+)/.test(point.id)) {
            const floorMatch = point.id.match(/^(\d+)/);
            if (floorMatch) floorId = floorMatch[1];
          }
          // If it has a number with a space after "floor" or "level"
          else if (/floor\s+(\d+)/i.test(point.id) || /level\s+(\d+)/i.test(point.id)) {
            const floorMatch = point.id.match(/(?:floor|level)\s+(\d+)/i);
            if (floorMatch) floorId = floorMatch[1];
          }
          
          // Create the floor bucket if it doesn't exist
          if (!buckets[floorId]) buckets[floorId] = [];
          
          // Add the point to its floor bucket
          buckets[floorId].push(point);
        }
        
        // Make sure we have at least one floor bucket
        if (Object.keys(buckets).length === 0) {
          buckets["1"] = validPoints;
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