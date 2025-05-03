import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, PowerIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface LidarData {
  // Legacy 2D range-based LiDAR data format
  ranges: number[];  
  angle_min: number;
  angle_max: number;
  angle_increment: number;
  range_min: number;
  range_max: number;
  intensities?: number[];
  
  // Modern 3D point cloud data format (from /scan_matched_points2 topic)
  points?: number[][]; // 3D point cloud data [x,y,z]
  
  // Binary format for individual device topics (since 2.12.0)
  fields?: Array<{name: string, data_type: string}>;
  data?: string; // base64 encoded binary data
  stamp?: number; // timestamp
  
  // Metadata
  topic?: string;      // Topic the data came from
  source?: string;     // Source of the data (websocket, http, etc.)
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
  timestamp?: string;
}

interface LidarVisualizationProps {
  data: LidarData | null;
  loading?: boolean;
  serialNumber?: string;
}

// LiDAR power action enum - must match server-side enum
enum LidarPowerAction {
  POWER_ON = 'power_on',
  POWER_OFF = 'power_off'
}

export function LidarVisualization({ data, loading = false, serialNumber }: LidarVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  
  // Track loading states for our API mutations
  const [powerOnInProgress, setPowerOnInProgress] = useState(false);
  const [powerOffInProgress, setPowerOffInProgress] = useState(false);
  const [powerCycleInProgress, setPowerCycleInProgress] = useState(false);
  const [errorClearInProgress, setErrorClearInProgress] = useState(false);
  
  // Import query client for cache invalidation
  const queryClient = useQueryClient();
  
  // Power on mutation
  const powerOnMutation = useMutation({
    mutationFn: async () => {
      if (!serialNumber) {
        throw new Error('Serial number is required to power on LiDAR');
      }
      
      // Send power on command
      console.log(`Sending power on command to LiDAR on robot ${serialNumber}`);
      try {
        const result = await fetch(`/api/robots/lidar/${serialNumber}/power`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Secret': import.meta.env.VITE_ROBOT_SECRET || ''
          },
          body: JSON.stringify({ action: LidarPowerAction.POWER_ON })
        });
        console.log('Power on response:', result);
        return result;
      } catch (error) {
        console.error("Error in power on fetch:", error);
        throw error;
      }
    },
    onMutate: () => {
      setPowerOnInProgress(true);
      toast({
        title: 'Powering on LiDAR',
        description: 'The LiDAR is being powered on. This may take a few seconds.',
      });
    },
    onSuccess: (response) => {
      console.log('Power on success, response:', response);
      toast({
        title: 'LiDAR powered on',
        description: 'The LiDAR has been successfully powered on. It might take a moment to start sending data.',
      });
      // Invalidate lidar data query to refresh
      if (serialNumber) {
        queryClient.invalidateQueries({ queryKey: [`/api/robots/lidar/${serialNumber}`] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error powering on LiDAR',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setPowerOnInProgress(false);
    },
  });
  
  // Power off mutation
  const powerOffMutation = useMutation({
    mutationFn: async () => {
      if (!serialNumber) {
        throw new Error('Serial number is required to power off LiDAR');
      }
      
      // Send power off command
      console.log(`Sending power off command to LiDAR on robot ${serialNumber}`);
      try {
        const result = await fetch(`/api/robots/lidar/${serialNumber}/power`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Secret': import.meta.env.VITE_ROBOT_SECRET || ''
          },
          body: JSON.stringify({ action: LidarPowerAction.POWER_OFF })
        });
        console.log('Power off response:', result);
        return result;
      } catch (error) {
        console.error("Error in power off fetch:", error);
        throw error;
      }
    },
    onMutate: () => {
      setPowerOffInProgress(true);
      toast({
        title: 'Powering off LiDAR',
        description: 'The LiDAR is being powered off.',
      });
    },
    onSuccess: (response) => {
      console.log('Power off success, response:', response);
      toast({
        title: 'LiDAR powered off',
        description: 'The LiDAR has been successfully powered off.',
      });
      // Invalidate lidar data query to refresh
      if (serialNumber) {
        queryClient.invalidateQueries({ queryKey: [`/api/robots/lidar/${serialNumber}`] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error powering off LiDAR',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setPowerOffInProgress(false);
    },
  });
  
  // Power cycle mutation (first power off, then power on)
  const powerCycleMutation = useMutation({
    mutationFn: async () => {
      if (!serialNumber) {
        throw new Error('Serial number is required to power cycle LiDAR');
      }
      
      // First power off
      try {
        console.log(`Power cycling LiDAR: step 1 - sending power off command to robot ${serialNumber}`);
        await fetch(`/api/robots/lidar/${serialNumber}/power`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Secret': import.meta.env.VITE_ROBOT_SECRET || ''
          },
          body: JSON.stringify({ action: LidarPowerAction.POWER_OFF })
        });
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Then power on
        console.log(`Power cycling LiDAR: step 2 - sending power on command to robot ${serialNumber}`);
        const result = await fetch(`/api/robots/lidar/${serialNumber}/power`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Secret': import.meta.env.VITE_ROBOT_SECRET || ''
          },
          body: JSON.stringify({ action: LidarPowerAction.POWER_ON })
        });
        
        console.log('Power cycle complete response:', result);
        return result;
      } catch (error) {
        console.error("Error in power cycle fetch:", error);
        throw error;
      }
    },
    onMutate: () => {
      setPowerCycleInProgress(true);
      toast({
        title: 'Power cycling LiDAR',
        description: 'The LiDAR is being power cycled. This may take a few seconds.',
      });
    },
    onSuccess: (response) => {
      console.log('Power cycle success, response:', response);
      toast({
        title: 'LiDAR power cycled',
        description: 'The LiDAR has been successfully power cycled. It might take a moment to start sending data.',
      });
      // Invalidate lidar data query to refresh
      if (serialNumber) {
        queryClient.invalidateQueries({ queryKey: [`/api/robots/lidar/${serialNumber}`] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error power cycling LiDAR',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setPowerCycleInProgress(false);
    },
  });
  
  // Clear range data all zero error mutation
  const clearZeroErrorMutation = useMutation({
    mutationFn: async () => {
      if (!serialNumber) {
        throw new Error('Serial number is required to clear LiDAR zero error');
      }
      
      console.log(`Sending clear zero error command to LiDAR on robot ${serialNumber}`);
      try {
        const result = await fetch(`/api/robots/lidar/${serialNumber}/clear_zero_error`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Secret': import.meta.env.VITE_ROBOT_SECRET || ''
          }
        });
        console.log('Clear zero error response:', result);
        return result;
      } catch (error) {
        console.error("Error in clear zero error fetch:", error);
        throw error;
      }
    },
    onMutate: () => {
      setErrorClearInProgress(true);
      toast({
        title: 'Clearing LiDAR zero error',
        description: 'Attempting to clear LiDAR range data all zero error.',
      });
    },
    onSuccess: (response) => {
      console.log('Clear zero error success, response:', response);
      toast({
        title: 'LiDAR error cleared',
        description: 'The LiDAR range data all zero error has been cleared. Data should start flowing shortly.',
      });
      // Invalidate lidar data query to refresh
      if (serialNumber) {
        queryClient.invalidateQueries({ queryKey: [`/api/robots/lidar/${serialNumber}`] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error clearing LiDAR error',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setErrorClearInProgress(false);
    },
  });

  useEffect(() => {
    if (!data || (!data.ranges || data.ranges.length === 0) && (!data.points || data.points.length === 0) || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set dimensions with fixed aspect ratio
    const size = Math.min(canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Calculate scaling factor based on range_max or available data
    let maxRange = 10; // Default max range
    if (data.ranges && data.ranges.length > 0) {
      maxRange = data.range_max || Math.max(...data.ranges.filter(r => isFinite(r))) || 10;
    } else if (data.points && data.points.length > 0) {
      // Calculate max range from point cloud data
      const distances = data.points.map(p => Math.sqrt(p[0]*p[0] + p[1]*p[1]));
      maxRange = Math.max(...distances) || 10;
    }
    
    const scale = (size / 2) * 0.8 / maxRange;

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2 * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Draw range circles
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
    ctx.lineWidth = 1;
    
    // Draw range circles at 1m, 2m, etc.
    const rangeCircles = Math.ceil(maxRange);
    for (let i = 1; i <= rangeCircles; i++) {
      const radius = i * scale;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Add range labels
      ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`${i}m`, centerX + radius + 2, centerY);
    }

    // Draw orientation axes
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
    ctx.lineWidth = 1;
    // Draw X axis
    ctx.beginPath();
    ctx.moveTo(centerX - size/2 * 0.8, centerY);
    ctx.lineTo(centerX + size/2 * 0.8, centerY);
    ctx.stroke();
    // Draw Y axis
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size/2 * 0.8);
    ctx.lineTo(centerX, centerY + size/2 * 0.8);
    ctx.stroke();

    // Draw robot at center
    ctx.fillStyle = 'rgba(25, 113, 194, 0.8)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw LiDAR points - high performance rendering with enhanced visuals
    ctx.fillStyle = 'rgba(255, 50, 50, 0.8)'; // Brighter, more vibrant red
    
    // First try to render range data if available
    if (data.ranges && data.ranges.length > 0) {
      // For full 360° visualization, we need to handle the angle calculation properly
      
      // Get angle parameters from data or use defaults for a full 360° view
      const angle_min = data.angle_min !== undefined ? data.angle_min : 0;
      const angle_max = data.angle_max !== undefined ? data.angle_max : 2 * Math.PI;
      const angle_increment = data.angle_increment !== undefined ? 
                              data.angle_increment : 
                              (angle_max - angle_min) / data.ranges.length;
      
      console.log(`Rendering ${data.ranges.length} LiDAR points with angle range ${angle_min} to ${angle_max}`);
      
      // Batch all points in a single path for maximum performance
      ctx.beginPath();
      
      // Use loop instead of forEach for better performance
      for (let i = 0; i < data.ranges.length; i++) {
        const range = data.ranges[i];
        if (!isFinite(range) || range <= 0) continue;
        
        // Calculate the angle for this range reading
        const angle = angle_min + (angle_increment * i);
        
        // Convert to canvas coordinates with robot's orientation
        // Front of robot (angle 0) should be facing left on screen 
        // We rotate by -π/2 to make 0 point to the left instead of up
        const adjustedAngle = angle - Math.PI/2;
        const x = centerX + Math.cos(adjustedAngle) * range * scale;
        const y = centerY + Math.sin(adjustedAngle) * range * scale;
        
        // Add to the current path instead of creating a new path for each point
        ctx.moveTo(x + 2, y);
        ctx.arc(x, y, 2, 0, Math.PI * 2);
      }
      
      // Fill all points at once
      ctx.fill();
    } 
    // Then try to render point cloud data if available
    else if (data.points && data.points.length > 0) {
      // Batch all points in a single path for maximum performance
      ctx.beginPath();
      
      // Draw points directly from the point cloud
      // Point cloud data from the robot is in its coordinate frame
      // where +X is forward, +Y is left, +Z is up
      
      // Use loop instead of forEach for better performance
      for (let i = 0; i < data.points.length; i++) {
        const point = data.points[i];
        if (!point || point.length < 2) continue;
        
        const [x, y] = point;
        
        // Convert to canvas coordinates - optimized transformation
        // The robot points are displayed with the robot facing LEFT on screen
        const canvasX = centerX - x * scale; // Robot forward (X) looks left on screen
        const canvasY = centerY - y * scale; // Robot left (Y) is up on screen
        
        // Add to the current path instead of creating a new path for each point
        ctx.moveTo(canvasX + 2, canvasY);
        ctx.arc(canvasX, canvasY, 2, 0, Math.PI * 2);
      }
      
      // Fill all points at once
      ctx.fill();
    }
    // Finally check for binary format data (since 2.12.0)
    else if (data.fields && data.data) {
      // This is binary encoded point cloud data
      // We can't decode binary data directly in the browser, so
      // display a placeholder visualization for now
      
      // Batch draw all placeholder points for better performance
      ctx.beginPath();
      
      // Draw a pattern of dots to represent the data
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 18) {
        for (let dist = 1; dist <= 5; dist++) {
          const x = centerX + Math.cos(angle) * dist * scale;
          const y = centerY + Math.sin(angle) * dist * scale;
          
          // Add to the current path instead of creating a new path for each point
          ctx.moveTo(x + 2, y);
          ctx.arc(x, y, 2, 0, Math.PI * 2);
        }
      }
      
      // Fill all points at once
      ctx.fill();
      
      // Draw a note about binary data
      ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Binary point cloud data', centerX, centerY - 30);
      ctx.fillText('Topic: ' + (data.topic || 'unknown'), centerX, centerY - 15);
    }

    // Draw a front direction indicator
    // Robot forward is facing right (opposite of data points)
    ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + size/2 * 0.2, centerY); // Arrow pointing right
    ctx.stroke();
    
    // Add a small arrowhead
    ctx.fillStyle = 'rgba(0, 100, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(centerX + size/2 * 0.25, centerY); // Tip of arrow pointing right
    ctx.lineTo(centerX + size/2 * 0.2, centerY - 5); // Top of arrow
    ctx.lineTo(centerX + size/2 * 0.2, centerY + 5); // Bottom of arrow
    ctx.closePath();
    ctx.fill();

  }, [data]);

  // Handle different states
  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex justify-between items-center">
            <span className="flex items-center gap-2">LiDAR Data</span>
            <Badge variant="outline" className="bg-blue-500 text-white">Loading</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading LiDAR data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || 
      (!data.ranges || data.ranges.length === 0) && 
      (!data.points || data.points.length === 0) &&
      (!data.fields || !data.data) &&
      (!data.topic || (!data.topic.includes('/maps/') && !data.topic.includes('/costmap')))) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex justify-between items-center">
            <span className="flex items-center gap-2">LiDAR Data</span>
            <Badge variant="outline" className="bg-amber-500 text-white">No Data</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p className="text-sm text-muted-foreground">No LiDAR data available</p>
            {data && (
              <>
                <p className="text-xs text-muted-foreground mt-1">
                  Topic: {data.topic || 'None'} - Source: {data.source || 'None'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last update: {data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Never'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Connection: {data.connectionStatus || 'Unknown'}
                </p>
              </>
            )}
            
            {/* LiDAR Management Controls - Show even when no data is available */}
            <div className="flex flex-col gap-2 mt-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium mb-1">LiDAR Controls</div>
                {serialNumber ? (
                  <Badge variant="outline" className="text-xs">
                    Connected to LiDAR
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-destructive">
                    No LiDAR Connected
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Button 
                  variant="default" 
                  size="sm"
                  className="flex-1"
                  onClick={() => powerOnMutation.mutate()}
                  disabled={powerOnInProgress || !serialNumber}
                >
                  {powerOnInProgress ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PowerIcon className="h-4 w-4 mr-2" />
                  )}
                  Power On
                </Button>
                
                <Button 
                  variant="default" 
                  size="sm"
                  className="flex-1"
                  onClick={() => powerOffMutation.mutate()}
                  disabled={powerOffInProgress || !serialNumber}
                >
                  {powerOffInProgress ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PowerIcon className="h-4 w-4 mr-2" />
                  )}
                  Power Off
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                  onClick={() => powerCycleMutation.mutate()}
                  disabled={powerCycleInProgress || !serialNumber}
                >
                  {powerCycleInProgress ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PowerIcon className="h-4 w-4 mr-2" />
                  )}
                  Power Cycle
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                  onClick={() => clearZeroErrorMutation.mutate()}
                  disabled={errorClearInProgress || !serialNumber}
                >
                  {errorClearInProgress ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Clear Zero Error
                </Button>
              </div>
              
              <div className="text-xs text-amber-500 mt-1">
                LiDAR data not available. Try power cycling the LiDAR or clearing the zero error.
              </div>
              
              <div className="text-xs text-muted-foreground mt-1">
                Serial: {serialNumber || 'Not connected'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connection status badge
  const getConnectionBadge = () => {
    if (!data.connectionStatus || data.connectionStatus === 'disconnected') {
      return <Badge variant="outline" className="bg-red-500 text-white">Disconnected</Badge>;
    }
    if (data.connectionStatus === 'connecting') {
      return <Badge variant="outline" className="bg-amber-500 text-white">Connecting</Badge>;
    }
    return <Badge variant="outline" className="bg-green-500 text-white">Connected</Badge>;
  };

  // Calculate stats
  let pointCount = 0;
  let avgRange = 'N/A';
  let minRange = 'N/A';
  let maxRange = 'N/A';

  // First check if we have range data
  if (data.ranges && data.ranges.length > 0) {
    const validRanges = data.ranges.filter(r => isFinite(r) && r > 0);
    avgRange = validRanges.length ? (validRanges.reduce((a, b) => a + b, 0) / validRanges.length).toFixed(2) : 'N/A';
    minRange = validRanges.length ? Math.min(...validRanges).toFixed(2) : 'N/A';
    maxRange = validRanges.length ? Math.max(...validRanges).toFixed(2) : 'N/A';
    pointCount = validRanges.length;
  } 
  // Otherwise check if we have point cloud data
  else if (data.points && Array.isArray(data.points) && data.points.length > 0) {
    pointCount = data.points.length;
    
    try {
      // Calculate ranges from point cloud data - safer with better error handling
      const distances = data.points
        .filter(p => Array.isArray(p) && p.length >= 2 && 
                typeof p[0] === 'number' && typeof p[1] === 'number')
        .map(p => Math.sqrt(p[0]*p[0] + p[1]*p[1]));
      
      if (distances.length > 0) {
        avgRange = (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(2);
        minRange = Math.min(...distances).toFixed(2);
        maxRange = Math.max(...distances).toFixed(2);
      }
    } catch (error) {
      console.error("Error processing point cloud data:", error);
      // Keep default values if there's an error
    }
  }

  // Check if LiDAR data exists but ranges are empty
  const hasEmptyRanges = data && data.ranges && data.ranges.length === 0;
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex justify-between items-center">
          <span className="flex items-center gap-2">LiDAR Data</span>
          {getConnectionBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show warning and power controls if ranges are empty */}
        {hasEmptyRanges && (
          <div className="rounded-md bg-yellow-50 p-4 mb-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
              <h3 className="text-sm font-medium text-yellow-800">LiDAR Data Unavailable</h3>
            </div>
            <div className="mt-2 text-xs text-yellow-700">
              <p>The LiDAR is not returning any data points. This could be because the LiDAR is powered off or experiencing an error.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => powerOnMutation.mutate()}
                  disabled={powerOnInProgress}
                  className="flex items-center gap-1"
                >
                  {powerOnInProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : <PowerIcon className="h-3 w-3" />}
                  Power On
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => powerCycleMutation.mutate()}
                  disabled={powerCycleInProgress}
                  className="flex items-center gap-1"
                >
                  {powerCycleInProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Power Cycle
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => clearZeroErrorMutation.mutate()}
                  disabled={errorClearInProgress}
                  className="flex items-center gap-1"
                >
                  {errorClearInProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}
                  Clear Error
                </Button>
              </div>
            </div>
          </div>
        )}
      
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={600}
            height={450}
            className="border border-border rounded-md bg-white w-full h-auto"
          />
        </div>
        
        {/* Power controls always available at the bottom for admin functionality */}
        <div className="flex flex-wrap gap-2 mt-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => powerOnMutation.mutate()}
            disabled={powerOnInProgress}
            className="flex items-center gap-1"
          >
            {powerOnInProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : <PowerIcon className="h-3 w-3" />}
            Power On
          </Button>
          <Button 
            size="sm"
            variant="outline"
            onClick={() => powerOffMutation.mutate()}
            disabled={powerOffInProgress}
            className="flex items-center gap-1"
          >
            {powerOffInProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : <PowerIcon className="h-3 w-3" />}
            Power Off
          </Button>
          <Button 
            size="sm"
            variant="outline"
            onClick={() => powerCycleMutation.mutate()}
            disabled={powerCycleInProgress}
            className="flex items-center gap-1"
          >
            {powerCycleInProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Power Cycle
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="text-muted-foreground">Points:</div>
          <div className="font-medium">{pointCount}</div>
          
          <div className="text-muted-foreground">Avg Range:</div>
          <div className="font-medium">{avgRange} m</div>
          
          <div className="text-muted-foreground">Min Range:</div>
          <div className="font-medium">{minRange} m</div>
          
          <div className="text-muted-foreground">Max Range:</div>
          <div className="font-medium">{maxRange} m</div>

          <div className="text-muted-foreground">Topic:</div>
          <div className="font-medium text-xs truncate">{data.topic || 'None'}</div>
          
          <div className="text-muted-foreground">Source:</div>
          <div className="font-medium">{data.source || 'Unknown'}</div>
          
          <div className="text-muted-foreground">Updated:</div>
          <div className="font-medium">{data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Never'}</div>
        </div>
        
        {/* LiDAR Management Controls - Always show buttons with disabled state based on serialNumber */}
        <div className="flex flex-col gap-2 mt-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium mb-1">LiDAR Controls</div>
            {serialNumber ? (
              <Badge variant="outline" className="text-xs">
                Connected to LiDAR
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-destructive">
                No LiDAR Connected
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Button 
              variant="default" 
              size="sm"
              className="flex-1"
              onClick={() => powerOnMutation.mutate()}
              disabled={powerOnInProgress || !serialNumber}
            >
              {powerOnInProgress ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PowerIcon className="h-4 w-4 mr-2" />
              )}
              Power On
            </Button>
            
            <Button 
              variant="default" 
              size="sm"
              className="flex-1"
              onClick={() => powerOffMutation.mutate()}
              disabled={powerOffInProgress || !serialNumber}
            >
              {powerOffInProgress ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PowerIcon className="h-4 w-4 mr-2" />
              )}
              Power Off
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1"
              onClick={() => powerCycleMutation.mutate()}
              disabled={powerCycleInProgress || !serialNumber}
            >
              {powerCycleInProgress ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PowerIcon className="h-4 w-4 mr-2" />
              )}
              Power Cycle
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1"
              onClick={() => clearZeroErrorMutation.mutate()}
              disabled={errorClearInProgress || !serialNumber}
            >
              {errorClearInProgress ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Clear Zero Error
            </Button>
          </div>
          
          {(pointCount === 0) && (
            <div className="text-xs text-amber-500 mt-1">
              No points detected. Try power cycling the LiDAR or clearing the zero error.
            </div>
          )}
          
          <div className="text-xs text-muted-foreground mt-1">
            Serial: {serialNumber || 'Not connected'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}