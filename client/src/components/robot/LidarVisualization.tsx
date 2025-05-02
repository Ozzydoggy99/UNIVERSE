import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, PowerIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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
  const [powerCycleInProgress, setPowerCycleInProgress] = useState(false);
  const [errorClearInProgress, setErrorClearInProgress] = useState(false);
  
  // Power cycle mutation (first power off, then power on)
  const powerCycleMutation = useMutation({
    mutationFn: async () => {
      if (!serialNumber) {
        throw new Error('Serial number is required to power cycle LiDAR');
      }
      
      // First power off
      await apiRequest(`/api/robots/lidar/${serialNumber}/power`, {
        method: 'POST',
        data: { action: LidarPowerAction.POWER_OFF }
      });
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Then power on
      return apiRequest(`/api/robots/lidar/${serialNumber}/power`, {
        method: 'POST',
        data: { action: LidarPowerAction.POWER_ON }
      });
    },
    onMutate: () => {
      setPowerCycleInProgress(true);
      toast({
        title: 'Power cycling LiDAR',
        description: 'The LiDAR is being power cycled. This may take a few seconds.',
      });
    },
    onSuccess: () => {
      toast({
        title: 'LiDAR power cycled',
        description: 'The LiDAR has been successfully power cycled. It might take a moment to start sending data.',
      });
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
      
      return apiRequest(
        'POST', 
        `/api/robots/lidar/${serialNumber}/clear_zero_error`
      );
    },
    onMutate: () => {
      setErrorClearInProgress(true);
      toast({
        title: 'Clearing LiDAR zero error',
        description: 'Attempting to clear LiDAR range data all zero error.',
      });
    },
    onSuccess: () => {
      toast({
        title: 'LiDAR error cleared',
        description: 'The LiDAR range data all zero error has been cleared. Data should start flowing shortly.',
      });
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

    // Draw LiDAR points
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    
    // First try to render range data if available
    if (data.ranges && data.ranges.length > 0) {
      const { angle_min, angle_increment } = data;
      
      data.ranges.forEach((range, i) => {
        if (!isFinite(range) || range <= 0) return;
        
        // Calculate the angle for this range reading
        const angle = angle_min + (angle_increment * i);
        
        // Convert to canvas coordinates
        // Note: Adjusting for canvas Y-axis being flipped compared to standard coordinate system
        // and adjusting for robot's forward direction (0 radians) pointing upward
        const x = centerX + Math.sin(angle) * range * scale;
        const y = centerY - Math.cos(angle) * range * scale;
        
        // Draw point
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    } 
    // Then try to render point cloud data if available
    else if (data.points && data.points.length > 0) {
      // Draw points directly from the point cloud
      data.points.forEach(point => {
        if (!point || point.length < 2) return;
        
        const [x, y] = point;
        
        // Convert to canvas coordinates 
        const canvasX = centerX + x * scale;
        const canvasY = centerY - y * scale; // Flip Y for canvas coordinates
        
        // Draw point
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // Finally check for binary format data (since 2.12.0)
    else if (data.fields && data.data) {
      // This is binary encoded point cloud data
      // We can't decode binary data directly in the browser, so
      // display a placeholder visualization for now
      
      // Draw a pattern of dots to represent the data
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 18) {
        for (let dist = 1; dist <= 5; dist++) {
          const x = centerX + Math.cos(angle) * dist * scale;
          const y = centerY + Math.sin(angle) * dist * scale;
          
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Draw a note about binary data
      ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Binary point cloud data', centerX, centerY - 30);
      ctx.fillText('Topic: ' + (data.topic || 'unknown'), centerX, centerY - 15);
    }

    // Draw a front direction indicator
    ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY - size/2 * 0.2);
    ctx.stroke();
    
    // Add a small arrowhead
    ctx.fillStyle = 'rgba(0, 100, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size/2 * 0.25);
    ctx.lineTo(centerX - 5, centerY - size/2 * 0.2);
    ctx.lineTo(centerX + 5, centerY - size/2 * 0.2);
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
  else if (data.points && data.points.length > 0) {
    pointCount = data.points.length;
    
    // Calculate ranges from point cloud data
    const distances = data.points
      .filter(p => p && p.length >= 2)
      .map(p => Math.sqrt(p[0]*p[0] + p[1]*p[1]));
    
    if (distances.length > 0) {
      avgRange = (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(2);
      minRange = Math.min(...distances).toFixed(2);
      maxRange = Math.max(...distances).toFixed(2);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex justify-between items-center">
          <span className="flex items-center gap-2">LiDAR Data</span>
          {getConnectionBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={400}
            height={300}
            className="border border-border rounded-md bg-white"
          />
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
        
        {/* LiDAR Management Controls - Only show if serial number is provided */}
        {serialNumber && (
          <div className="flex flex-col gap-2 mt-4 border-t pt-4">
            <div className="text-sm font-medium mb-1">LiDAR Controls</div>
            <div className="flex gap-2">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}