// client/src/hooks/use-robot-map-points.ts
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface Point {
  id: string;
  x: number;
  y: number;
  ori: number;
  description?: string;
}

interface CategorizedPoints {
  pickup: Point | null;
  dropoff: Point | null;
  standby: Point | null;
  shelves: Point[];
}

export function useRobotMapPoints() {
  const { data, isLoading, error } = useQuery<Point[], Error>({
    queryKey: ["/api/robots/points"],
    queryFn: getQueryFn(),
  });

  // Categorize points into types (pickup, dropoff, standby, shelves)
  const categorizePoints = (points: Point[] = []): CategorizedPoints => {
    let pickup = null;
    let dropoff = null;
    let standby = null;
    const shelves: Point[] = [];

    for (const point of points) {
      const label = point.id.toLowerCase();
      if (label.includes("pick")) {
        pickup = point;
      } else if (label.includes("drop")) {
        dropoff = point;
      } else if (label.includes("desk") || label.includes("standby")) {
        standby = point;
      } else {
        // Anything else is treated as a shelf/waypoint
        shelves.push(point);
      }
    }

    return { pickup, dropoff, standby, shelves };
  };

  const categorized = categorizePoints(data);

  return {
    points: data || [],
    categorized,
    isLoading,
    error,
  };
}