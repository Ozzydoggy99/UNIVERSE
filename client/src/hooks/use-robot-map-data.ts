import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Point } from '../types/robot';

// Type definitions for map points
export interface MapPoint {
  id: string;
  name?: string;
  x: number;
  y: number;
  floorId?: string;
  ori?: number;
  type?: string;
  description?: string;
}

export interface CategorizedMapPoints {
  byFloor: Record<string, MapPoint[]>;
  allPoints: MapPoint[];
  namedPoints: MapPoint[];
  numericPoints: MapPoint[];
  specialPoints: {
    pickup?: MapPoint;
    dropoff?: MapPoint;
    desk?: MapPoint;
    [key: string]: MapPoint | undefined;
  }
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch shelf points (numeric points) from the new dedicated API endpoint
 * This simplifies access to just the shelf points for simpler UIs
 */
export function useRobotShelfPoints() {
  const [shelfPoints, setShelfPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchShelfPoints() {
      try {
        setLoading(true);
        const res = await fetch('/api/robots/points/shelves');
        if (!res.ok) throw new Error(`Failed to fetch shelf points: ${res.status}`);
        const data = await res.json();
        setShelfPoints(data);
      } catch (err: any) {
        console.error('❌ Error fetching shelf points:', err);
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchShelfPoints();
  }, []);

  return { shelfPoints, loading, error };
}

/**
 * Hook to fetch and categorize all robot map points
 * Provides more detailed categorization compared to useRobotShelfPoints
 */
export function useRobotMapData(): CategorizedMapPoints {
  const [categorized, setCategorized] = useState<CategorizedMapPoints>({
    byFloor: {},
    allPoints: [],
    namedPoints: [],
    numericPoints: [],
    specialPoints: {},
    isLoading: true,
    error: null
  });

  // Use React Query to fetch all points from our new API
  const { data: pointsData, isLoading, error } = useQuery<MapPoint[]>({
    queryKey: ['/api/robots/points']
  });

  useEffect(() => {
    if (isLoading || error) return;
    
    try {
      if (!pointsData) {
        throw new Error('No points data available');
      }

      // Process the points
      const processedPoints = pointsData.map(point => ({
        ...point,
        floorId: point.floorId || "1" // Default to floor "1" if not specified
      }));
      
      // Organize points by floor
      const byFloor: Record<string, MapPoint[]> = {};
      processedPoints.forEach((point: MapPoint) => {
        if (!byFloor[point.floorId!]) {
          byFloor[point.floorId!] = [];
        }
        byFloor[point.floorId!].push(point);
      });
      
      // Split into named vs numeric points
      const namedPoints = processedPoints.filter((p: MapPoint) => 
        isNaN(parseInt(p.id)) && p.id.trim() !== ''
      );
      
      const numericPoints = processedPoints.filter((p: MapPoint) => 
        !isNaN(parseInt(p.id))
      );
      
      // Find special points like pickup, dropoff, etc.
      const specialPoints: Record<string, MapPoint | undefined> = {};
      
      // Look for pickup point variations
      const pickupPoint = processedPoints.find((p: MapPoint) => 
        p.id.toLowerCase().includes('pick') || 
        p.name?.toLowerCase()?.includes('pick')
      );
      if (pickupPoint) specialPoints.pickup = pickupPoint;
      
      // Look for dropoff point variations
      const dropoffPoint = processedPoints.find((p: MapPoint) => 
        p.id.toLowerCase().includes('drop') || 
        p.name?.toLowerCase()?.includes('drop')
      );
      if (dropoffPoint) specialPoints.dropoff = dropoffPoint;
      
      // Look for desk point variations
      const deskPoint = processedPoints.find((p: MapPoint) => 
        p.id.toLowerCase().includes('desk') || 
        p.name?.toLowerCase()?.includes('desk')
      );
      if (deskPoint) specialPoints.desk = deskPoint;

      // Set the categorized data
      setCategorized({
        byFloor,
        allPoints: processedPoints,
        namedPoints,
        numericPoints,
        specialPoints,
        isLoading: false,
        error: null
      });
    } catch (err) {
      console.error('Error processing map points:', err);
      setCategorized(prev => ({
        ...prev, 
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err))
      }));
    }
  }, [pointsData, isLoading, error]);

  return categorized;
}