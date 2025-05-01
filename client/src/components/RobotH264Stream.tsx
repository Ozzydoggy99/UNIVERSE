import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, RefreshCcw, Camera } from 'lucide-react';
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
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [lastSuccessTime, setLastSuccessTime] = useState<number>(Date.now());
  
  // Use refs to manage intervals
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // Check health status of connection
  const [isHealthy, setIsHealthy] = useState(true);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // More robust frame fetching with error handling
  const fetchCameraFrame = useCallback(() => {
    if (!serialNumber) return;
    
    // Generate a unique timestamp to prevent caching
    const now = Date.now();
    const frameUrl = `/api/robot-video-frame/${serialNumber}?t=${now}`;
    
    // Update the image URL which will cause the image to reload
    setImageUrl(frameUrl);
    setTimestamp(now);
  }, [serialNumber]);

  // Health check function to monitor connection stability
  const checkConnectionHealth = useCallback(() => {
    const now = Date.now();
    // If it's been more than 2 seconds since a successful frame load
    if (now - lastSuccessTime > 2000 && isHealthy) {
      console.log('Camera connection health check failed, connection may be unstable');
      setIsHealthy(false);
      
      // Try to restart the connection if health check fails
      restartConnection();
    }
  }, [lastSuccessTime, isHealthy]);

  // Function to restart the connection
  const restartConnection = useCallback(() => {
    console.log('Restarting camera connection...');
    
    // Clear existing intervals first
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    // Set loading state
    setIsLoading(true);
    
    // Wait a moment before trying to reconnect
    setTimeout(() => {
      // Fetch a new frame
      fetchCameraFrame();
      
      // Create a new interval with a slightly longer delay (reduces server load)
      frameIntervalRef.current = setInterval(fetchCameraFrame, 250);
      
      setConnectionRetries(prev => prev + 1);
      setIsHealthy(true);
    }, 500);
  }, [fetchCameraFrame]);

  // Initialize the camera feed
  useEffect(() => {
    if (!serialNumber) {
      setError('No robot serial number provided');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsHealthy(true);
    setConnectionRetries(0);

    // Initial fetch
    fetchCameraFrame();

    // Set up polling interval for frequent updates (approximately 4fps)
    // This is slightly slower than the original 5fps to reduce load
    frameIntervalRef.current = setInterval(fetchCameraFrame, 250);
    
    // Set up a health check interval
    healthCheckIntervalRef.current = setInterval(checkConnectionHealth, 3000);

    // Clean up all intervals on unmount
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [serialNumber, fetchCameraFrame, checkConnectionHealth]);

  // Function to handle manual refresh
  const handleRefresh = useCallback(() => {
    if (serialNumber) {
      setError(null);
      setIsLoading(true);
      restartConnection();
    }
  }, [serialNumber, restartConnection]);

  // Handle image load success
  const handleImageLoaded = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setLastSuccessTime(Date.now());
    setIsHealthy(true);
    setConnectionRetries(0); // Reset retries counter on success
  }, []);

  // Handle image load error, with multiple retry strategies
  const handleImageError = useCallback(() => {
    setIsLoading(false);
    
    // Increment retry counter
    const newRetryCount = connectionRetries + 1;
    setConnectionRetries(newRetryCount);
    
    // Only show error after multiple retries
    if (newRetryCount > 3) {
      setError('Camera feed unavailable. The robot may be disconnected or the camera is turned off.');
    }
    
    // Set unhealthy status
    setIsHealthy(false);
    
    // Different retry strategies based on retry count
    let retryDelay = 1000; // Start with 1 second
    
    if (newRetryCount > 10) {
      retryDelay = 5000; // Slow down to 5 seconds after 10 retries
    } else if (newRetryCount > 5) {
      retryDelay = 2000; // Try every 2 seconds after 5 retries
    }
    
    // Schedule retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    retryTimeoutRef.current = setTimeout(() => {
      if (serialNumber) {
        // Try a fresh connection
        restartConnection();
      }
    }, retryDelay);
  }, [serialNumber, connectionRetries, restartConnection]);

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
        
        {!isHealthy && !error && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full flex items-center">
            <Camera className="w-3 h-3 mr-1" />
            Reconnecting...
          </div>
        )}
        
        {imageUrl && (
          <img 
            ref={imageRef}
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
        
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
          Live Feed
        </div>
      </CardContent>
    </Card>
  );
}

export default RobotH264Stream;