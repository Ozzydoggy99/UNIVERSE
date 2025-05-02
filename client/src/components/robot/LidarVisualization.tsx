import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2 } from 'lucide-react';

interface LidarData {
  ranges: number[];
  angle_min: number;
  angle_max: number;
  angle_increment: number;
  range_min: number;
  range_max: number;
  intensities?: number[];
  connectionStatus?: 'connected' | 'connecting' | 'disconnected';
  timestamp?: string;
}

interface LidarVisualizationProps {
  data: LidarData | null;
  loading?: boolean;
}

export function LidarVisualization({ data, loading = false }: LidarVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!data || !data.ranges || data.ranges.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set dimensions with fixed aspect ratio
    const size = Math.min(canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Calculate scaling factor based on range_max with a padding
    const maxRange = data.range_max || Math.max(...data.ranges.filter(r => isFinite(r)));
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

  if (!data || !data.ranges || data.ranges.length === 0) {
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
            <p className="text-xs text-muted-foreground mt-1">
              LiDAR data not supported on this robot model or topic not enabled
            </p>
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
  const validRanges = data.ranges.filter(r => isFinite(r) && r > 0);
  const avgRange = validRanges.length ? (validRanges.reduce((a, b) => a + b, 0) / validRanges.length).toFixed(2) : 'N/A';
  const minRange = validRanges.length ? Math.min(...validRanges).toFixed(2) : 'N/A';
  const maxRange = validRanges.length ? Math.max(...validRanges).toFixed(2) : 'N/A';
  const pointCount = validRanges.length;

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
        </div>
      </CardContent>
    </Card>
  );
}