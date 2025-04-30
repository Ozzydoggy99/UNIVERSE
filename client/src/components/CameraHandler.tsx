import React, { useState, useEffect } from 'react';
import { useRobot } from '@/providers/robot-provider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveMjpegStream } from '@/components/LiveMjpegStream';

interface CameraHandlerProps {
  serialNumber?: string;
}

export const CameraHandler: React.FC<CameraHandlerProps> = ({ serialNumber }) => {
  const { cameraData, toggleCamera, refreshData } = useRobot();
  const [isLoading, setIsLoading] = useState(false);
  
  // Check camera data on mount and set up polling
  useEffect(() => {
    const pollCameraData = async () => {
      await refreshData();
    };
    
    // Initial poll
    pollCameraData();
    
    // Set up interval for polling (every 10 seconds)
    const interval = setInterval(pollCameraData, 10000);
    
    // Clean up on unmount
    return () => clearInterval(interval);
  }, [refreshData]);
  
  const handleToggleCamera = async () => {
    if (!cameraData) return;
    
    setIsLoading(true);
    try {
      await toggleCamera(!cameraData.enabled);
      // Refresh data to get updated camera state
      await refreshData();
    } catch (error) {
      console.error('Failed to toggle camera:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!cameraData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Camera Control</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No camera data available</p>
            <Button 
              onClick={refreshData} 
              variant="outline" 
              className="mt-4"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Camera Control</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="camera-toggle" className="flex-1">
              Camera Status
            </Label>
            <div className="flex items-center space-x-2">
              <Switch
                id="camera-toggle"
                checked={cameraData.enabled}
                onCheckedChange={handleToggleCamera}
                disabled={isLoading}
              />
              <span className={cameraData.enabled ? 'text-green-500' : 'text-gray-500'}>
                {cameraData.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
          
          {cameraData.enabled && cameraData.streamUrl && (
            <div className="mt-4">
              <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
                {/* Use dedicated LiveMjpegStream component for better performance */}
                <LiveMjpegStream 
                  streamUrl={`/api/camera-stream/${serialNumber || 'L382502104987ir'}?endpoint=/rgb_cameras/front/compressed`}
                  refreshInterval={2000} // Use longer interval to avoid overloading the camera 
                  className="w-full h-full"
                  title={`Live Camera Feed (${serialNumber === 'AX923701583RT' ? 'AxBot 5000 Pro' : 'Public Robot'})`}
                />
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 text-xs rounded">
                  {cameraData.resolution.width} x {cameraData.resolution.height}
                </div>
              </div>
              <div className="flex justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Live stream from physical robot
                </p>
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}
          
          {cameraData.enabled && !cameraData.streamUrl && (
            <div className="p-8 text-center border rounded-lg">
              <p className="text-muted-foreground">Camera is enabled but no stream is available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CameraHandler;