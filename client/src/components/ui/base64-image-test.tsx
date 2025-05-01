import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { MapData } from './map-fixed';

// Simple component to test rendering a base64 image from the robot's map data
export function Base64ImageTest({ serialNumber = 'L382502104987ir' }: { serialNumber?: string }) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  
  // Fetch map data from the API
  const { data: mapData, isLoading } = useQuery<MapData>({
    queryKey: ['/api/robots/map', serialNumber],
    enabled: !!serialNumber,
    refetchInterval: 15000, // Refresh every 15 seconds,
    placeholderData: {} as MapData, // Provide empty placeholder to prevent TypeScript errors
  });
  
  // Make a direct API call to get the raw map data
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
          console.log('Directly fetched map data:', data);
          
          // Check for valid base64 data
          if (data?.grid && typeof data.grid === 'string' && data.grid.startsWith('iVBOR')) {
            console.log('Got base64 map data directly, length:', data.grid.length);
            setImageData(data.grid.trim());
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
    
    // Fetch map data directly
    fetchMapDirectly();
    
    // Set up interval to refresh every 10 seconds
    const intervalId = setInterval(fetchMapDirectly, 10000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [serialNumber]);

  // Handle image load error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Image failed to load:', e);
    setImageError('Failed to load image from base64 data');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Map Base64 Image Test</CardTitle>
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
                <p>Base64 data length: {imageData.length}</p>
                <p>Starting characters: {imageData.substring(0, 30)}...</p>
              </div>
            </div>
            
            <div className="border rounded-md overflow-hidden h-[400px] flex items-center justify-center">
              <img 
                src={`data:image/png;base64,${imageData}`}
                alt="Robot map data" 
                className="max-w-full max-h-full"
                onError={handleImageError}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}