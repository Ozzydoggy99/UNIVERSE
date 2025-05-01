import React, { useEffect, useState, useRef } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface RobotStreamViewProps {
  serialNumber?: string;
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function RobotH264Stream({ 
  serialNumber, 
  width = '100%', 
  height = 'auto',
  className = ''
}: RobotStreamViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!serialNumber) {
      setError('No robot serial number provided');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Function to fetch the latest camera frame
    const fetchCameraFrame = () => {
      // Add timestamp to prevent caching
      const frameUrl = `/api/robot-video-frame/${serialNumber}?t=${Date.now()}`;
      
      // Update the image URL which will cause the image to reload
      setImageUrl(frameUrl);
      setTimestamp(Date.now());
    };

    // Initial fetch
    fetchCameraFrame();

    // Set up polling interval for frequent updates (approximately 5fps)
    intervalRef.current = setInterval(fetchCameraFrame, 200);

    // Clean up interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [serialNumber]);

  // Function to handle manual refresh
  const handleRefresh = () => {
    if (serialNumber) {
      setTimestamp(Date.now());
      // Force reload with new timestamp
      setImageUrl(`/api/robot-video-frame/${serialNumber}?t=${Date.now()}`);
    }
  };

  // Handle image load success
  const handleImageLoaded = () => {
    setIsLoading(false);
    setError(null);
  };

  // Handle image load error
  const handleImageError = () => {
    setIsLoading(false);
    setError('Camera feed unavailable. The robot may be disconnected or the camera is turned off.');
    
    // Try again after a few seconds
    setTimeout(() => {
      if (serialNumber && !error) {
        setTimestamp(Date.now());
        setImageUrl(`/api/robot-video-frame/${serialNumber}?t=${Date.now()}`);
      }
    }, 5000);
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="p-0 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading camera feed...</span>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 p-4">
            <p className="text-destructive font-medium mb-2">Camera Error</p>
            <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
            <button 
              className="flex items-center px-3 py-2 rounded bg-primary text-primary-foreground text-sm"
              onClick={handleRefresh}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Retry Connection
            </button>
          </div>
        )}
        
        {imageUrl && (
          <img 
            src={imageUrl}
            alt="Robot Camera Feed"
            style={{ 
              width, 
              height, 
              objectFit: 'cover',
              display: error ? 'none' : 'block'
            }}
            onLoad={handleImageLoaded}
            onError={handleImageError}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default RobotH264Stream;