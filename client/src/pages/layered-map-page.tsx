import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { 
  ArrowLeft, 
  Map as MapIcon,
  Layers,
  Crosshair,
  Eye,
  EyeOff,
  Save,
  Download,
  Upload,
  Trash2,
  Plus,
  Minus,
  RotateCw,
  Bot,
  Pencil,
  Eraser, 
  Square,
  Building2,
  Navigation
} from 'lucide-react';
import { useRobot } from '@/providers/robot-provider';
import { useToast } from "@/hooks/use-toast";
import MapBuilder from '@/components/robot/MapBuilder';

interface Point {
  x: number;
  y: number;
}

interface PathPoint extends Point {
  timestamp: string;
}

interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  type: 'base' | 'lidar' | 'path' | 'obstacle' | 'annotation' | 'custom';
  color: string;
  data: any;
}

interface LayeredMap {
  id: string;
  name: string;
  resolution: number;
  origin: [number, number];
  size: [number, number];
  layers: MapLayer[];
}

export default function LayeredMapPage() {
  const params = useParams();
  const serialNumber = params.serialNumber;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapData, setMapData] = useState<LayeredMap | null>(null);
  const [robotPosition, setRobotPosition] = useState<Point | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTool, setEditTool] = useState<'pencil' | 'eraser' | 'line' | 'rectangle'>('pencil');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editSize, setEditSize] = useState(5);
  const [showGrid, setShowGrid] = useState(true);
  const [followRobot, setFollowRobot] = useState(true);
  const [showMapBuilder, setShowMapBuilder] = useState(false);
  const { toast } = useToast();

  // Get robot WebSocket state from context
  const { 
    robotPosition: wsRobotPosition,
    lidarData: wsLidarData,
    mapData: wsMapData,
    refreshData,
    connectionState,
    connectWebSocket,
    disconnectWebSocket,
    isConnected
  } = useRobot();

  // Initialize map with layers when data is available
  useEffect(() => {
    if (serialNumber && (wsMapData || wsLidarData)) {
      const baseMapData = wsMapData || { 
        grid: '',
        obstacles: [],
        paths: [],
        size: [1000, 1000],
        resolution: 0.05,
        origin: [0, 0],
        connectionStatus: 'unknown',
      };

      let initialMap: LayeredMap = {
        id: `map-${serialNumber}`,
        name: `${serialNumber} Map`,
        resolution: baseMapData.resolution || 0.05,
        origin: baseMapData.origin ? [baseMapData.origin[0], baseMapData.origin[1]] as [number, number] : [0, 0] as [number, number],
        size: baseMapData.size ? [baseMapData.size[0], baseMapData.size[1]] as [number, number] : [1000, 1000] as [number, number],
        layers: [
          {
            id: 'base-layer',
            name: 'Base Map',
            visible: true,
            type: 'base',
            color: '#1a56db',
            data: baseMapData.grid
          },
          {
            id: 'lidar-layer',
            name: 'LiDAR Data',
            visible: true,
            type: 'lidar',
            color: '#ef4444',
            data: wsLidarData?.ranges || []
          },
          {
            id: 'path-layer',
            name: 'Path History',
            visible: true,
            type: 'path',
            color: '#10b981',
            data: []
          },
          {
            id: 'obstacle-layer',
            name: 'Obstacles',
            visible: true,
            type: 'obstacle',
            color: '#f59e0b',
            data: baseMapData.obstacles || []
          },
          {
            id: 'annotation-layer',
            name: 'Annotations',
            visible: true,
            type: 'annotation',
            color: '#8b5cf6',
            data: []
          }
        ]
      };

      setMapData(initialMap);
      setActiveLayer('annotation-layer');
    }
  }, [serialNumber, wsMapData, wsLidarData]);

  // Update robot position when it changes
  useEffect(() => {
    if (wsRobotPosition) {
      const newPosition: Point & { orientation?: number } = {
        x: wsRobotPosition.x,
        y: wsRobotPosition.y,
        orientation: wsRobotPosition.orientation // Store orientation with the position
      };
      
      setRobotPosition(newPosition);
      
      // If we have an existing path layer, add the position to it
      if (mapData) {
        const pathLayer = mapData.layers.find(l => l.id === 'path-layer');
        if (pathLayer) {
          const pathData = [...pathLayer.data];
          
          // Add position to path if it differs from the previous one
          const lastPoint = pathData[pathData.length - 1];
          const minDistance = 0.1; // Minimum distance in meters to add a new point
          
          if (!lastPoint || 
              Math.sqrt(Math.pow(lastPoint.x - newPosition.x, 2) + 
                      Math.pow(lastPoint.y - newPosition.y, 2)) > minDistance) {
            pathData.push({
              ...newPosition,
              timestamp: new Date().toISOString()
            });
            
            // Update the path layer
            const updatedLayers = mapData.layers.map(layer => {
              if (layer.id === 'path-layer') {
                return { ...layer, data: pathData };
              }
              return layer;
            });
            
            setMapData({
              ...mapData,
              layers: updatedLayers
            });
          }
        }
      }
    }
  }, [wsRobotPosition, mapData]);

  // Connect to WebSocket when component mounts
  useEffect(() => {
    if (serialNumber) {
      // Connect to WebSocket for this specific robot
      connectWebSocket();
      
      // Set up periodic data refresh
      const refreshInterval = setInterval(() => {
        if (isConnected()) {
          refreshData();
        }
      }, 2000);
      
      // Clean up on unmount
      return () => {
        clearInterval(refreshInterval);
        disconnectWebSocket();
      };
    }
  }, [serialNumber, connectWebSocket, disconnectWebSocket, isConnected, refreshData]);
  
  // Update LiDAR layer when data changes
  useEffect(() => {
    if (wsLidarData && mapData) {
      const updatedLayers = mapData.layers.map(layer => {
        if (layer.id === 'lidar-layer') {
          return { ...layer, data: wsLidarData.ranges || [] };
        }
        return layer;
      });
      
      setMapData({
        ...mapData,
        layers: updatedLayers
      });
    }
  }, [wsLidarData, mapData]);

  // Draw map layers to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData || !mapData.layers) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set canvas size based on map size and zoom
    const canvasWidth = Math.floor(mapData.size[0] / mapData.resolution) * zoom;
    const canvasHeight = Math.floor(mapData.size[1] / mapData.resolution) * zoom;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Draw background (white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid if enabled
    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height, 50 * zoom);
    }
    
    // Draw each visible layer
    mapData.layers.filter(layer => layer.visible).forEach(layer => {
      switch (layer.type) {
        case 'base':
          drawBaseLayer(ctx, layer);
          break;
        case 'lidar':
          drawLidarLayer(ctx, layer);
          break;
        case 'path':
          drawPathLayer(ctx, layer);
          break;
        case 'obstacle':
          drawObstacleLayer(ctx, layer);
          break;
        case 'annotation':
          drawAnnotationLayer(ctx, layer);
          break;
        default:
          drawCustomLayer(ctx, layer);
      }
    });
    
    // Draw robot position
    if (robotPosition) {
      drawRobot(ctx, robotPosition);
    }
    
  }, [mapData, robotPosition, zoom, showGrid]);

  // Draw grid with given spacing
  function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, spacing: number) {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x <= width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // Convert robot coordinates to pixel coordinates
  function worldToPixel(point: Point): Point {
    if (!mapData) return { x: 0, y: 0 };
    
    // Calculate pixel positions based on robot coordinates, map origin, and resolution
    const pixelX = (point.x - mapData.origin[0]) / mapData.resolution * zoom;
    const pixelY = (mapData.size[1] - (point.y - mapData.origin[1])) / mapData.resolution * zoom;
    
    return { x: pixelX, y: pixelY };
  }

  // Draw robot as a triangle pointing in the direction of travel
  function drawRobot(ctx: CanvasRenderingContext2D, position: Point & { orientation?: number }) {
    const pixelPos = worldToPixel(position);
    
    // Robot size in pixels
    const robotSize = 10 * zoom;
    
    // Save canvas state before transformations
    ctx.save();
    
    // Draw robot circle
    ctx.beginPath();
    ctx.arc(pixelPos.x, pixelPos.y, robotSize, 0, Math.PI * 2);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();
    
    // The orientation is already in radians (API returns 1.57 which is pi/2 or 90 degrees)
    // Default to 0 if not provided
    const orientationRadians = position.orientation || 0;
    
    // Add 90 degrees (π/2 radians) to rotate arrow clockwise
    const adjustedOrientation = orientationRadians + Math.PI/2;
    
    // Apply transformations to draw orientation triangle
    ctx.translate(pixelPos.x, pixelPos.y);
    ctx.rotate(-adjustedOrientation); // Negative because canvas Y is flipped
    
    // Draw orientation triangle
    ctx.fillStyle = '#00796b'; // Darker green for orientation
    ctx.beginPath();
    ctx.moveTo(0, -robotSize - 5); // Point at the top (robot's front)
    ctx.lineTo(-robotSize/2, -robotSize/2); // Bottom left corner
    ctx.lineTo(robotSize/2, -robotSize/2); // Bottom right corner
    ctx.closePath();
    ctx.fill();
    
    // Draw outline for better visibility
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Restore canvas state
    ctx.restore();
    
    // Draw robot label (after restore so it's not rotated)
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', pixelPos.x, pixelPos.y);
  }

  // Draw base map layer
  function drawBaseLayer(ctx: CanvasRenderingContext2D, layer: MapLayer) {
    if (layer.data && typeof layer.data === 'string' && layer.data.startsWith('data:image')) {
      // Draw base map image if it's a base64 data URL
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
      };
      img.src = layer.data;
    } else {
      // Draw a placeholder grid if no image is available
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      
      // Draw a border
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(5, 5, canvasRef.current!.width - 10, canvasRef.current!.height - 10);
      
      // Add a "No map data" label
      ctx.fillStyle = '#9ca3af';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No base map data', canvasRef.current!.width / 2, canvasRef.current!.height / 2);
    }
  }

  // Draw LiDAR data
  function drawLidarLayer(ctx: CanvasRenderingContext2D, layer: MapLayer) {
    if (!robotPosition || !Array.isArray(layer.data) || layer.data.length === 0) return;
    
    const pixelRobot = worldToPixel(robotPosition);
    ctx.fillStyle = layer.color;
    
    // Robot orientation is already in radians
    const robotOrientationRad = robotPosition.orientation || 0;
    
    // Add 90 degrees (π/2 radians) to rotate LiDAR points consistently with robot arrow
    const adjustedOrientation = robotOrientationRad + Math.PI/2;
    
    // Draw each LiDAR point
    const ranges = layer.data;
    const numRanges = ranges.length;
    
    if (numRanges > 0) {
      // Use full 360° visualization
      let angleMin = 0;
      let angleMax = 2 * Math.PI;
      let angleIncrement = (angleMax - angleMin) / numRanges;
      
      console.log(`Rendering ${numRanges} LiDAR points with angle range ${angleMin} to ${angleMax}`);
      
      // Save the current canvas state
      ctx.save();
      
      // Translate to robot position and apply rotation for all LiDAR points
      ctx.translate(pixelRobot.x, pixelRobot.y);
      ctx.rotate(-adjustedOrientation); // Use the adjusted orientation with 90° rotation
      
      for (let i = 0; i < numRanges; i++) {
        const range = ranges[i];
        if (range <= 0) continue; // Skip invalid ranges
        
        const angle = angleMin + i * angleIncrement;
        const distance = range * 20 * zoom; // Scale for visualization
        
        // Calculate points in robot's coordinate frame, where 0° is robot's forward direction
        // With the canvas translation and rotation applied, we're drawing relative to the robot's
        // position and orientation now
        const x = Math.sin(angle) * distance;
        const y = -Math.cos(angle) * distance; // Negative because canvas Y is flipped
        
        // Draw LiDAR point
        ctx.beginPath();
        ctx.arc(x, y, 2 * zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Restore the canvas state
      ctx.restore();
    }
  }

  // Draw path history
  function drawPathLayer(ctx: CanvasRenderingContext2D, layer: MapLayer) {
    if (!Array.isArray(layer.data) || layer.data.length < 2) return;
    
    const pathPoints = layer.data as PathPoint[];
    const pixelPoints = pathPoints.map(worldToPixel);
    
    // Draw path line
    ctx.beginPath();
    ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
    
    for (let i = 1; i < pixelPoints.length; i++) {
      ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
    }
    
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = 2 * zoom;
    ctx.stroke();
    
    // Draw small circles at each point
    pixelPoints.forEach((point, index) => {
      // Only draw points every few steps to avoid clutter
      if (index % 5 === 0) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3 * zoom, 0, Math.PI * 2);
        ctx.fillStyle = layer.color;
        ctx.fill();
      }
    });
  }

  // Draw obstacles
  function drawObstacleLayer(ctx: CanvasRenderingContext2D, layer: MapLayer) {
    if (!Array.isArray(layer.data)) return;
    
    const obstacles = layer.data as Point[];
    
    obstacles.forEach(obstacle => {
      const pixelPos = worldToPixel(obstacle);
      
      ctx.beginPath();
      ctx.arc(pixelPos.x, pixelPos.y, 5 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = layer.color;
      ctx.fill();
      
      // Draw X through obstacle
      const size = 5 * zoom;
      ctx.beginPath();
      ctx.moveTo(pixelPos.x - size, pixelPos.y - size);
      ctx.lineTo(pixelPos.x + size, pixelPos.y + size);
      ctx.moveTo(pixelPos.x + size, pixelPos.y - size);
      ctx.lineTo(pixelPos.x - size, pixelPos.y + size);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * zoom;
      ctx.stroke();
    });
  }

  // Draw annotations
  function drawAnnotationLayer(ctx: CanvasRenderingContext2D, layer: MapLayer) {
    if (!Array.isArray(layer.data)) return;
    
    // Annotations could be of different types (points, lines, polygons, text)
    // For simplicity, we'll just draw points for now
    layer.data.forEach((annotation: any) => {
      if (annotation.type === 'point') {
        const pixelPos = worldToPixel(annotation.position);
        
        ctx.beginPath();
        ctx.arc(pixelPos.x, pixelPos.y, annotation.size || 5 * zoom, 0, Math.PI * 2);
        ctx.fillStyle = annotation.color || layer.color;
        ctx.fill();
        
        if (annotation.label) {
          ctx.fillStyle = '#000000';
          ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
          ctx.fillText(annotation.label, pixelPos.x, pixelPos.y - 15 * zoom);
        }
      }
    });
  }

  // Draw custom layer (placeholder)
  function drawCustomLayer(ctx: CanvasRenderingContext2D, layer: MapLayer) {
    // This is a placeholder for any custom layer types you want to add later
  }

  // Add a new layer to the map
  function addLayer() {
    if (!mapData) return;
    
    const newLayer: MapLayer = {
      id: `custom-${Date.now()}`,
      name: `Custom Layer ${mapData.layers.length + 1}`,
      visible: true,
      type: 'custom',
      color: '#6366f1',
      data: []
    };
    
    setMapData({
      ...mapData,
      layers: [...mapData.layers, newLayer]
    });
    
    setActiveLayer(newLayer.id);
  }

  // Toggle layer visibility
  function toggleLayerVisibility(layerId: string) {
    if (!mapData) return;
    
    const updatedLayers = mapData.layers.map(layer => {
      if (layer.id === layerId) {
        return { ...layer, visible: !layer.visible };
      }
      return layer;
    });
    
    setMapData({
      ...mapData,
      layers: updatedLayers
    });
  }

  // Delete a layer
  function deleteLayer(layerId: string) {
    if (!mapData || mapData.layers.length <= 1) return;
    
    // Don't delete essential layers
    if (['base-layer', 'lidar-layer', 'path-layer'].includes(layerId)) {
      toast({
        title: "Cannot Delete Layer",
        description: "Essential layers cannot be deleted.",
        variant: "destructive"
      });
      return;
    }
    
    const updatedLayers = mapData.layers.filter(layer => layer.id !== layerId);
    
    setMapData({
      ...mapData,
      layers: updatedLayers
    });
    
    if (activeLayer === layerId) {
      setActiveLayer(updatedLayers[0].id);
    }
  }

  // Zoom in
  function zoomIn() {
    setZoom(prev => Math.min(prev + 0.2, 5));
  }

  // Zoom out
  function zoomOut() {
    setZoom(prev => Math.max(prev - 0.2, 0.2));
  }

  // Reset zoom
  function resetZoom() {
    setZoom(1);
  }

  // Save map as image
  function saveAsImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Create a link element
    const link = document.createElement('a');
    link.download = `${mapData?.name || 'robot-map'}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Map Saved",
      description: "Map has been saved as an image."
    });
  }

  // Export map data as JSON
  function exportMapData() {
    if (!mapData) return;
    
    const dataStr = JSON.stringify(mapData, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const link = document.createElement('a');
    link.download = `${mapData.name || 'robot-map'}.json`;
    link.href = dataUri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Map Data Exported",
      description: "Map data has been exported as JSON."
    });
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Link href={`/robot-details/${serialNumber}`}>
          <Button variant="outline" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Robot Details
          </Button>
        </Link>
        
        <div className="flex items-center gap-3">
          <Badge className={`${
              connectionState === 'connected' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
              connectionState === 'connecting' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' : 
              'bg-red-100 text-red-800 hover:bg-red-100'
            }`}>
            <div className={`h-2 w-2 rounded-full mr-1 ${
              connectionState === 'connected' ? 'bg-green-500' : 
              connectionState === 'connecting' ? 'bg-yellow-500' : 
              'bg-red-500'
            }`}></div>
            {connectionState === 'connected' ? 'Connected' : 
             connectionState === 'connecting' ? 'Connecting...' : 
             'Disconnected'}
          </Badge>
          
          <Badge variant="outline" className="flex items-center gap-1">
            <Bot className="h-3.5 w-3.5" />
            {serialNumber || 'No Robot Selected'}
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Robot Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Position:</span>
                <span className="font-mono text-sm">
                  ({robotPosition?.x.toFixed(2) || '0.00'}, {robotPosition?.y.toFixed(2) || '0.00'})
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={refreshData} className="flex items-center justify-center gap-1">
                  <RotateCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={saveAsImage} className="flex items-center justify-center gap-1">
                  <Download className="h-3.5 w-3.5" />
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={exportMapData} className="flex items-center justify-center gap-1">
                  <Save className="h-3.5 w-3.5" />
                  Export
                </Button>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <Label htmlFor="show-grid">Show Grid</Label>
                <Switch id="show-grid" checked={showGrid} onCheckedChange={setShowGrid} />
              </div>
              
              <div className="flex justify-between items-center">
                <Label htmlFor="follow-robot">Follow Robot</Label>
                <Switch id="follow-robot" checked={followRobot} onCheckedChange={setFollowRobot} />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label>Zoom: {zoom.toFixed(1)}x</Label>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={zoomOut}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={resetZoom}>
                      <RotateCw className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={zoomIn}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Slider value={[zoom]} min={0.2} max={5} step={0.1} onValueChange={(value) => setZoom(value[0])} />
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-3">
          <Card className="w-full h-[60vh]">
            <CardHeader className="p-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center">
                  <Layers className="h-4 w-4 mr-2" />
                  {showMapBuilder ? 'Map Builder' : 'Layered Map'}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant={showMapBuilder ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setShowMapBuilder(true)}
                  >
                    <Building2 className="h-3.5 w-3.5 mr-1" />
                    Map Builder
                  </Button>
                  <Button 
                    variant={!showMapBuilder ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setShowMapBuilder(false)}
                  >
                    <Navigation className="h-3.5 w-3.5 mr-1" />
                    Viewer
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 h-full">
              {showMapBuilder ? (
                <div className="h-full">
                  {serialNumber && <MapBuilder serialNumber={serialNumber} />}
                </div>
              ) : (
                <div className="relative w-full h-full overflow-auto">
                  {!mapData && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
                      <div className="text-center">
                        <RotateCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                        <p className="text-sm text-gray-600">Loading map data...</p>
                      </div>
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    className="min-w-full min-h-full"
                  ></canvas>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="p-3">
              <CardTitle className="text-base flex items-center">
                <Layers className="h-4 w-4 mr-2" />
                Map Layers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mapData?.layers.map(layer => (
                <div key={layer.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center">
                    <Checkbox 
                      id={`layer-${layer.id}`}
                      checked={layer.visible}
                      onCheckedChange={() => toggleLayerVisibility(layer.id)}
                      className="mr-2"
                    />
                    <Label 
                      htmlFor={`layer-${layer.id}`}
                      className={activeLayer === layer.id ? "font-bold" : ""}
                      onClick={() => setActiveLayer(layer.id)}
                    >
                      {layer.name}
                    </Label>
                  </div>
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: layer.color }}
                  ></div>
                </div>
              ))}
              
              <Button 
                variant="outline" 
                size="sm"
                className="w-full mt-2" 
                onClick={addLayer}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Layer
              </Button>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-3">
          <Card>
            <CardHeader className="p-3">
              <CardTitle className="text-base flex items-center">
                <Pencil className="h-4 w-4 mr-2" />
                Editing Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="enable-editing">Enable Editing</Label>
                <Switch 
                  id="enable-editing" 
                  checked={isEditing}
                  onCheckedChange={setIsEditing}
                />
              </div>
              
              {isEditing && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Tools</Label>
                    <div className="flex flex-wrap gap-1">
                      <Button 
                        variant={editTool === 'pencil' ? 'secondary' : 'outline'} 
                        size="sm"
                        onClick={() => setEditTool('pencil')}
                        className="flex-1"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Pencil
                      </Button>
                      <Button 
                        variant={editTool === 'eraser' ? 'secondary' : 'outline'} 
                        size="sm"
                        onClick={() => setEditTool('eraser')}
                        className="flex-1"
                      >
                        <Eraser className="h-3.5 w-3.5 mr-1" />
                        Eraser
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="grid grid-cols-5 gap-1">
                      {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'].map(color => (
                        <button
                          key={color}
                          className={`w-5 h-5 rounded-full ${editColor === color ? 'ring-2 ring-offset-1 ring-black' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setEditColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2 col-span-2">
                    <Label>Size: {editSize}px</Label>
                    <Slider 
                      value={[editSize]}
                      min={1}
                      max={20}
                      step={1}
                      onValueChange={(value) => setEditSize(value[0])}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}