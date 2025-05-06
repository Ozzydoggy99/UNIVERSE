// client/src/hooks/useRobotPoints.ts
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface Point {
  id: string;
  x: number;
  y: number;
  ori: number;
  description?: string;
}

export function useRobotPoints(robotId: string = "L382502104987ir") {
  const queryKey = robotId ? ["/api/robots/points", robotId] : ["/api/robots/points"];
  
  const { data, isLoading, error } = useQuery<Point[], Error>({
    queryKey,
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Filter points that appear to be shelves (not pickup, dropoff, or standby points)
  const shelfPoints = data 
    ? data.filter(point => {
        const id = point.id.toLowerCase();
        return !id.includes("pick") && !id.includes("drop") && !id.includes("desk") && !id.includes("standby");
      }).map(point => point.id)
    : [];

  return { 
    shelfPoints, 
    loading: isLoading,
    error
  };
}