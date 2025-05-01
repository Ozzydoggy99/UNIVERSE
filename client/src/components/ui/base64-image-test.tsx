import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { MapData } from './map-fixed';
import { MapPin, Navigation } from 'lucide-react';

// Interface for robot position data
interface RobotPosition {
  x: number;
  y: number;
  z: number;
  orientation: number;
  speed: number;
  timestamp: string;
}

// Enhanced component to render base64 image map with robot position overlay
export function Base64ImageTest({ serialNumber = 'L382502104987ir' }: { serialNumber?: string }) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [mapMetadata, setMapMetadata] = useState<{resolution: number, origin: [number, number], size: [number, number]}>({
    resolution: 0.05,
    origin: [0, 0],
    size: [0, 0]
  });
  const [robotPosition, setRobotPosition] = useState<RobotPosition | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // Fetch map data from the API (kept for compatibility)
  const { data: mapData, isLoading } = useQuery<MapData>({
    queryKey: ['/api/robots/map', serialNumber],
    enabled: !!serialNumber,
    refetchInterval: 15000, // Refresh every 15 seconds,
    placeholderData: {} as MapData, // Provide empty placeholder to prevent TypeScript errors
  });
  
  // Fetch robot position data
  const { data: positionData } = useQuery<RobotPosition>({
    queryKey: ['/api/robots/position', serialNumber],
    enabled: !!serialNumber,
    refetchInterval: 1000, // Refresh every second for real-time tracking
  });
  
  // Function to convert robot position to pixel coordinates on the map
  const convertPositionToPixels = (x: number, y: number): { pixelX: number, pixelY: number } => {
    try {
      // The map origin is at the bottom left of the image, but in the DOM, (0,0) is at the top left
      // So we need to flip the Y coordinate
      
      // Check if we have all the required data
      if (!mapMetadata.resolution || !mapMetadata.origin || !mapMetadata.size) {
        console.warn('Missing map metadata for conversion:', mapMetadata);
        return { pixelX: 0, pixelY: 0 };
      }
      
      // Calculate pixels from physical coordinates
      // Step 1: Adjust for map origin offset
      const adjustedX = x - mapMetadata.origin[0];
      const adjustedY = y - mapMetadata.origin[1];
      
      // Step 2: Convert to pixel coordinates using resolution
      // Note: we need to invert the Y axis since image coordinates have (0,0) at top-left
      const pixelX = adjustedX / mapMetadata.resolution;
      const pixelY = mapMetadata.size[1] - (adjustedY / mapMetadata.resolution);
      
      return { pixelX, pixelY };
    } catch (error) {
      console.error('Error converting position to pixels:', error);
      return { pixelX: 0, pixelY: 0 };
    }
  };
  
  // Update robot position when position data changes
  useEffect(() => {
    if (positionData) {
      setRobotPosition(positionData);
    }
  }, [positionData]);

  // Make a direct API call to get the raw map data and metadata
  useEffect(() => {
    const fetchMapDirectly = async () => {
      try {
        // Make a direct fetch call to bypass the query client error handling
        const response = await fetch(`/api/robots/map/${serialNumber}`, {
          headers: {
            'Secret': import.meta.env.VITE_ROBOT_SECRET as string || '',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Log all data for debugging
          console.log('Full map data from server:', {
            ...data,
            grid: data.grid ? `${data.grid.substring(0, 20)}... (${data.grid.length} chars)` : null
          });
          
          // Check for valid base64 data
          if (data?.grid && typeof data.grid === 'string' && data.grid.startsWith('iVBOR')) {
            console.log('Got base64 map data directly, length:', data.grid.length);
            setImageData(data.grid.trim());
            
            // Also save the map metadata for positioning
            if (data.resolution && data.origin && data.size) {
              console.log('Map metadata received:', {
                resolution: data.resolution,
                origin: data.origin,
                size: data.size
              });
              
              setMapMetadata({
                resolution: data.resolution, 
                origin: data.origin as [number, number],
                size: data.size as [number, number]
              });
            }
          } else {
            console.log('Direct API call - No valid base64 data:', {
              hasData: !!data,
              hasGrid: !!(data?.grid),
              gridType: data?.grid ? typeof data.grid : 'undefined',
              keysInData: data ? Object.keys(data) : []
            });
            setImageData(null);
          }
        } else {
          console.error('Failed to fetch map data directly:', response.status);
          setImageData(null);
        }
      } catch (error) {
        console.error('Error making direct map fetch:', error);
        setImageData(null);
      }
    };
    
    // Also fetch the position data directly
    const fetchPositionDirectly = async () => {
      try {
        const response = await fetch(`/api/robots/position/${serialNumber}`, {
          headers: {
            'Secret': import.meta.env.VITE_ROBOT_SECRET as string || '',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Robot position data:', data);
          
          if (data && typeof data.x === 'number' && typeof data.y === 'number') {
            // Calculate pixel coordinates for debugging
            const pixels = convertPositionToPixels(data.x, data.y);
            console.log('Converted to pixel coordinates:', pixels);
            
            setRobotPosition(data);
          } else {
            console.warn('Invalid position data structure:', data);
          }
        } else {
          console.error('Failed to fetch position data:', response.status);
        }
      } catch (error) {
        console.error('Error getting robot position:', error);
      }
    };
    
    // Fetch data directly
    fetchMapDirectly();
    fetchPositionDirectly();
    
    // Set up intervals for refreshing
    const mapIntervalId = setInterval(fetchMapDirectly, 10000);
    const positionIntervalId = setInterval(fetchPositionDirectly, 1000);
    
    // Clean up intervals on component unmount
    return () => {
      clearInterval(mapIntervalId);
      clearInterval(positionIntervalId);
    };
  }, [serialNumber]);

  // Handle image load error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Image failed to load:', e);
    setImageError('Failed to load image from base64 data');
  };

  // Calculate robot marker position with safety checks
  const robotMarkerPosition = robotPosition && robotPosition.x !== undefined ? 
    convertPositionToPixels(robotPosition.x, robotPosition.y) : 
    { pixelX: 0, pixelY: 0 };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Robot Map with Real-time Position</CardTitle>
        <CardDescription>
          {robotPosition && robotPosition.x !== undefined && (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="bg-green-50">
                Robot Position: X: {robotPosition.x.toFixed(4)}, Y: {robotPosition.y.toFixed(4)}
              </Badge>
              <Badge variant="outline" className="bg-blue-50">
                Orientation: {(robotPosition.orientation * (180/Math.PI)).toFixed(1)}°
              </Badge>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[400px] bg-slate-100 rounded-md">
            <div className="animate-pulse">Loading map data...</div>
          </div>
        ) : !imageData ? (
          <div className="flex items-center justify-center h-[400px] bg-slate-100 rounded-md">
            <div className="text-gray-500">No valid base64 map data available</div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {imageError && (
              <div className="bg-red-50 text-red-800 p-3 rounded-md">
                {imageError}
              </div>
            )}
            
            <div className="bg-slate-100 p-4 rounded-md">
              <div className="font-mono text-sm overflow-hidden text-ellipsis">
                <p>Map resolution: {mapMetadata.resolution} m/pixel</p>
                <p>Map size: {mapMetadata.size[0]} x {mapMetadata.size[1]} pixels</p>
              </div>
            </div>
            
            <div 
              ref={mapContainerRef}
              className="border rounded-md overflow-hidden h-[500px] relative flex items-center justify-center"
            >
              {/* Map background image */}
              <img 
                src={`data:image/png;base64,${imageData}`}
                alt="Robot map data" 
                className="max-w-full max-h-full"
                onError={handleImageError}
              />
              
              {/* Robot position marker */}
              {robotPosition && robotPosition.x !== undefined && (
                <div 
                  className="absolute pointer-events-none"
                  style={{
                    // Position the robot marker - adjust as needed based on the marker's size
                    left: `calc(${robotMarkerPosition.pixelX}px - 10px)`,
                    top: `calc(${robotMarkerPosition.pixelY}px - 10px)`,
                    transform: `rotate(${robotPosition.orientation || 0}rad)`,
                    transition: 'all 0.5s ease-out',
                  }}
                >
                  <Navigation className="h-5 w-5 text-green-600" />
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}