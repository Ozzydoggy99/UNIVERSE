import { useState, useEffect, useCallback } from 'react';

interface RobotData {
  mapData: any;
  lidarData: any;
  positionData: any;
  sensorData: any;
  statusData: any;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRobotData(robotSerial: string): RobotData {
  const [mapData, setMapData] = useState<any>(null);
  const [lidarData, setLidarData] = useState<any>(null);
  const [positionData, setPositionData] = useState<any>(null);
  const [sensorData, setSensorData] = useState<any>(null);
  const [statusData, setStatusData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Create a reusable fetchData function
  const fetchData = useCallback(async () => {
    if (!robotSerial) return;
    
    try {
      setIsLoading(true);
      
      // Fetch map data
      const mapResponse = await fetch(`/api/robots/map/${robotSerial}`);
      if (!mapResponse.ok) throw new Error('Failed to fetch map data');
      const mapJson = await mapResponse.json();
      
      // Fetch LiDAR data
      const lidarResponse = await fetch(`/api/robots/lidar/${robotSerial}?_preferTopic=/scan_matched_points2`);
      if (!lidarResponse.ok) throw new Error('Failed to fetch LiDAR data');
      const lidarJson = await lidarResponse.json();
      
      // Fetch position data
      const positionResponse = await fetch(`/api/robots/position/${robotSerial}`);
      if (!positionResponse.ok) throw new Error('Failed to fetch position data');
      const positionJson = await positionResponse.json();
      
      // Fetch sensor data
      const sensorResponse = await fetch(`/api/robots/sensors/${robotSerial}`);
      if (!sensorResponse.ok) throw new Error('Failed to fetch sensor data');
      const sensorJson = await sensorResponse.json();
      
      // Fetch status data
      const statusResponse = await fetch(`/api/robots/status/${robotSerial}`);
      if (!statusResponse.ok) throw new Error('Failed to fetch status data');
      const statusJson = await statusResponse.json();
      
      // Update state with fetched data
      setMapData(mapJson);
      setLidarData(lidarJson);
      setPositionData(positionJson);
      setSensorData(sensorJson);
      setStatusData(statusJson);
      setIsLoading(false);
      setError(null);
      
      console.log('Robot data retrieved successfully');
    } catch (err) {
      console.error('Error fetching robot data:', err);
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      setIsLoading(false);
    }
  }, [robotSerial]);
  
  // Function for manually triggering a data refresh
  const refetch = useCallback(async () => {
    console.log('Manually refreshing robot data...');
    await fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout;
    
    // Initial data fetch
    fetchData().then(() => {
      if (isMounted) {
        // Set up polling for real-time updates (only after initial fetch)
        intervalId = setInterval(fetchData, 10000); // Reduced frequency to 10s to avoid overwhelming the robot API
      }
    });
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [fetchData]);
  
  return {
    mapData,
    lidarData,
    positionData,
    sensorData,
    statusData,
    isLoading,
    error,
    refetch
  };
}