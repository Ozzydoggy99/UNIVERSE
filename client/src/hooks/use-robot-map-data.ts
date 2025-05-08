import { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

// Type definitions for map points
export interface MapPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  floorId: string;
  type?: string;
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
 * Hook to fetch and categorize robot map points using the new WebSocket-based architecture
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

  // Use the REST API to get map points
  const { data: mapsData, isLoading: mapsLoading, error: mapsError } = useQuery<any[]>({
    queryKey: ['/api/robot/maps']
  });

  useEffect(() => {
    const fetchPoints = async () => {
      if (!mapsData || mapsLoading || mapsError) return;
      
      try {
        // Get the first available map
        const maps = mapsData;
        if (!maps.length) {
          throw new Error('No maps available');
        }

        const mapId = maps[0].uid;
        
        // Fetch points for this map
        const pointsResponse = await axios.get(`/api/robot/maps/${mapId}/points`);
        const points = pointsResponse.data || [];
        
        // Extract floor ID from map name if available (naming convention: floor_X_mapname)
        const floorMatch = maps[0].name.match(/floor[_\s]*(\d+)/i);
        const floorId = floorMatch ? floorMatch[1] : "1";  // Default to "1" if no floor number
        
        // Add floor ID to all points if they don't have one
        const processedPoints = points.map((point: any) => ({
          ...point,
          floorId: point.floorId || floorId
        }));
        
        // Organize points by floor
        const byFloor: Record<string, MapPoint[]> = {};
        processedPoints.forEach((point: MapPoint) => {
          if (!byFloor[point.floorId]) {
            byFloor[point.floorId] = [];
          }
          byFloor[point.floorId].push(point);
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
          p.name?.toLowerCase().includes('pick')
        );
        if (pickupPoint) specialPoints.pickup = pickupPoint;
        
        // Look for dropoff point variations
        const dropoffPoint = processedPoints.find((p: MapPoint) => 
          p.id.toLowerCase().includes('drop') || 
          p.name?.toLowerCase().includes('drop')
        );
        if (dropoffPoint) specialPoints.dropoff = dropoffPoint;
        
        // Look for desk point variations
        const deskPoint = processedPoints.find((p: MapPoint) => 
          p.id.toLowerCase().includes('desk') || 
          p.name?.toLowerCase().includes('desk')
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
    };

    fetchPoints();
  }, [mapsData, mapsLoading, mapsError]);

  return categorized;
}