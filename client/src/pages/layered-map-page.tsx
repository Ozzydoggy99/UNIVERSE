import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Toggle } from '@/components/ui/toggle';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChevronLeft, 
  Layers, 
  Map as MapIcon, 
  Route, 
  Target, 
  Home, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  Save, 
  Undo,
  RotateCcw 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { fetcher } from '@/lib/fetcher';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RobotStatus, RobotPosition, RobotSensorData, MapData, LidarData } from '@/types/robot';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';

// Type definitions for our layered map system
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

const DEFAULT_LAYERS: MapLayer[] = [
  {
    id: 'base',
    name: 'Base Map',
    visible: true,
    type: 'base',
    color: '#ffffff',
    data: null
  },
  {
    id: 'lidar',
    name: 'LiDAR Data',
    visible: true,
    type: 'lidar',
    color: '#ff0000',
    data: []
  },
  {
    id: 'path',
    name: 'Path History',
    visible: true,
    type: 'path',
    color: '#00ff00',
    data: []
  },
  {
    id: 'obstacles',
    name: 'Detected Obstacles',
    visible: true,
    type: 'obstacle',
    color: '#ff00ff',
    data: []
  }
];

const LayeredMapPage: React.FC = () => {
  const { serialNumber } = useParams<{ serialNumber: string }>();
  const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null);
  const [robotPosition, setRobotPosition] = useState<RobotPosition | null>(null);
  const [sensors, setSensors] = useState<RobotSensorData | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [lidarData, setLidarData] = useState<LidarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [layers, setLayers] = useState<MapLayer[]>(DEFAULT_LAYERS);
  const [selectedLayer, setSelectedLayer] = useState<string>('lidar');
  const [pathHistory, setPathHistory] = useState<PathPoint[]>([]);
  const [refreshInterval, setRefreshInterval] = useState<number>(1000);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Fetch robot data
  useEffect(() => {
    if (!serialNumber) return;

    const fetchData = async () => {
      try {
        const [status, position, sensorData, map, lidar] = await Promise.all([
          fetcher(`/api/robots/status/${serialNumber}`),
          fetcher(`/api/robots/position/${serialNumber}`),
          fetcher(`/api/robots/sensors/${serialNumber}`),
          fetcher(`/api/robots/map/${serialNumber}`),
          fetcher(`/api/robots/lidar/${serialNumber}`)
        ]);

        setRobotStatus(status);
        setRobotPosition(position);
        setSensors(sensorData);
        setMapData(map);
        setLidarData(lidar);

        // Add position to path history
        if (position && position.x !== undefined && position.y !== undefined) {
          setPathHistory(prev => {
            // Only add if position has changed
            const lastPoint = prev[prev.length - 1];
            if (!lastPoint || lastPoint.x !== position.x || lastPoint.y !== position.y) {
              return [...prev, { 
                x: position.x, 
                y: position.y, 
                timestamp: new Date().toISOString() 
              }];
            }
            return prev;
          });
        }

        // Update layer data
        setLayers(currentLayers => {
          return currentLayers.map(layer => {
            if (layer.id === 'base' && map) {
              return { ...layer, data: map };
            }
            if (layer.id === 'lidar' && lidar) {
              return { ...layer, data: lidar };
            }
            if (layer.id === 'path') {
              return { ...layer, data: pathHistory };
            }
            return layer;
          });
        });

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching robot data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch robot data.',
          variant: 'destructive',
        });
      }
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    
    return () => clearInterval(interval);
  }, [serialNumber, refreshInterval, toast]);

  // Draw the map with all visible layers
  useEffect(() => {
    if (!canvasRef.current || !mapData || !robotPosition) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base map layer if visible
    const baseLayer = layers.find(layer => layer.id === 'base');
    if (baseLayer && baseLayer.visible && mapData.grid) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawOtherLayers();
      };
      img.src = `data:image/png;base64,${mapData.grid}`;
    } else {
      drawOtherLayers();
    }

    function drawOtherLayers() {
      // Draw LiDAR data if visible
      const lidarLayer = layers.find(layer => layer.id === 'lidar');
      if (lidarLayer && lidarLayer.visible && lidarData) {
        ctx.save();
        ctx.strokeStyle = lidarLayer.color;
        
        // Find center of canvas in map coordinates
        const mapWidth = mapData.size[0] * mapData.resolution;
        const mapHeight = mapData.size[1] * mapData.resolution;
        const canvasCenterX = canvas.width / 2;
        const canvasCenterY = canvas.height / 2;
        
        // Calculate scale factors
        const scaleX = canvas.width / mapWidth;
        const scaleY = canvas.height / mapHeight;
        
        // Draw LiDAR points relative to robot position
        if (lidarData.ranges && lidarData.ranges.length > 0) {
          const angleIncrement = lidarData.angle_increment;
          let startAngle = lidarData.angle_min;
          
          ctx.beginPath();
          
          lidarData.ranges.forEach((range, i) => {
            if (range > 0 && range < lidarData.range_max) {
              // Calculate point position
              const angle = startAngle + i * angleIncrement;
              const x = robotPosition.x + range * Math.cos(angle);
              const y = robotPosition.y + range * Math.sin(angle);
              
              // Convert to canvas coordinates
              const canvasX = (x - mapData.origin[0]) * scaleX;
              const canvasY = canvas.height - (y - mapData.origin[1]) * scaleY;
              
              ctx.moveTo(
                (robotPosition.x - mapData.origin[0]) * scaleX,
                canvas.height - (robotPosition.y - mapData.origin[1]) * scaleY
              );
              ctx.lineTo(canvasX, canvasY);
            }
          });
          
          ctx.stroke();
        }
        ctx.restore();
      }
      
      // Draw robot position
      const robotX = (robotPosition.x - mapData.origin[0]) * (canvas.width / (mapData.size[0] * mapData.resolution));
      const robotY = canvas.height - (robotPosition.y - mapData.origin[1]) * (canvas.height / (mapData.size[1] * mapData.resolution));
      
      ctx.save();
      ctx.fillStyle = 'blue';
      ctx.beginPath();
      ctx.arc(robotX, robotY, 10, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw robot orientation
      ctx.strokeStyle = 'blue';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(robotX, robotY);
      ctx.lineTo(
        robotX + 20 * Math.cos(robotPosition.orientation || 0),
        robotY - 20 * Math.sin(robotPosition.orientation || 0)
      );
      ctx.stroke();
      ctx.restore();
      
      // Draw path history if visible
      const pathLayer = layers.find(layer => layer.id === 'path');
      if (pathLayer && pathLayer.visible && pathHistory.length > 1) {
        ctx.save();
        ctx.strokeStyle = pathLayer.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        const firstPoint = pathHistory[0];
        const firstX = (firstPoint.x - mapData.origin[0]) * (canvas.width / (mapData.size[0] * mapData.resolution));
        const firstY = canvas.height - (firstPoint.y - mapData.origin[1]) * (canvas.height / (mapData.size[1] * mapData.resolution));
        
        ctx.moveTo(firstX, firstY);
        
        for (let i = 1; i < pathHistory.length; i++) {
          const point = pathHistory[i];
          const x = (point.x - mapData.origin[0]) * (canvas.width / (mapData.size[0] * mapData.resolution));
          const y = canvas.height - (point.y - mapData.origin[1]) * (canvas.height / (mapData.size[1] * mapData.resolution));
          
          ctx.lineTo(x, y);
        }
        
        ctx.stroke();
        ctx.restore();
      }
    }
  }, [mapData, robotPosition, lidarData, layers, pathHistory]);

  // Handle layer visibility toggle
  const toggleLayerVisibility = (layerId: string) => {
    setLayers(prevLayers => 
      prevLayers.map(layer => 
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  // Add a custom layer
  const addCustomLayer = () => {
    const newLayer: MapLayer = {
      id: `custom-${Date.now()}`,
      name: `Custom Layer ${layers.filter(l => l.type === 'custom').length + 1}`,
      visible: true,
      type: 'custom',
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      data: []
    };
    
    setLayers([...layers, newLayer]);
    setSelectedLayer(newLayer.id);
    
    toast({
      title: 'Layer Added',
      description: `Added new ${newLayer.name}`,
    });
  };

  // Delete a layer
  const deleteLayer = (layerId: string) => {
    if (['base', 'lidar', 'path', 'obstacles'].includes(layerId)) {
      toast({
        title: 'Cannot Delete',
        description: 'System layers cannot be deleted.',
        variant: 'destructive',
      });
      return;
    }
    
    setLayers(prevLayers => prevLayers.filter(layer => layer.id !== layerId));
    if (selectedLayer === layerId) {
      setSelectedLayer('lidar');
    }
    
    toast({
      title: 'Layer Deleted',
      description: 'Layer has been removed',
    });
  };

  // Clear path history
  const clearPathHistory = () => {
    setPathHistory([]);
    
    toast({
      title: 'Path Cleared',
      description: 'Path history has been cleared',
    });
  };

  // Export the layered map
  const exportMap = () => {
    if (!canvasRef.current) return;
    
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `robot-map-${serialNumber}-${new Date().toISOString()}.png`;
      link.click();
      
      toast({
        title: 'Map Exported',
        description: 'Map has been exported as PNG',
      });
    } catch (error) {
      console.error('Error exporting map:', error);
      toast({
        title: 'Export Failed',
        description: 'Could not export map',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/robots/${serialNumber}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Robot
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center">
            <Layers className="h-6 w-6 mr-2" />
            Layered Map Builder
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportMap}>
            <Save className="h-4 w-4 mr-1" />
            Export Map
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar with controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Target className="h-4 w-4 mr-2" />
                Robot Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <div className="font-semibold">Serial:</div>
                  <div>{serialNumber}</div>
                  <div className="font-semibold">Model:</div>
                  <div>{robotStatus?.model || 'N/A'}</div>
                  <div className="font-semibold">Status:</div>
                  <div>
                    <Badge variant={robotStatus?.status === 'active' ? 'success' : 'secondary'}>
                      {robotStatus?.status || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="font-semibold">Position:</div>
                  <div>
                    {robotPosition ? 
                      `(${robotPosition.x.toFixed(2)}, ${robotPosition.y.toFixed(2)})` : 
                      'Unknown'}
                  </div>
                  <div className="font-semibold">Battery:</div>
                  <div>{sensors?.battery || 'N/A'}%</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Layers className="h-4 w-4 mr-2" />
                Map Layers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {layers.map(layer => (
                  <div key={layer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id={`layer-${layer.id}`}
                        checked={layer.visible}
                        onCheckedChange={() => toggleLayerVisibility(layer.id)}
                      />
                      <Label 
                        htmlFor={`layer-${layer.id}`} 
                        className="flex items-center cursor-pointer"
                      >
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: layer.color }}
                        ></div>
                        {layer.name}
                      </Label>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => deleteLayer(layer.id)}
                      disabled={['base', 'lidar', 'path', 'obstacles'].includes(layer.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-3" size="sm" onClick={addCustomLayer}>
                <Plus className="h-4 w-4 mr-1" />
                Add Custom Layer
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Route className="h-4 w-4 mr-2" />
                Path Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full" 
                    onClick={clearPathHistory}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Clear Path
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      // Reset path to last 2 points
                      if (pathHistory.length > 1) {
                        setPathHistory(pathHistory.slice(-2));
                      }
                    }}
                  >
                    <Undo className="h-4 w-4 mr-1" />
                    Reset Path
                  </Button>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="refresh-rate">Refresh Rate: {refreshInterval}ms</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[500, 1000, 2000].map(interval => (
                      <Button 
                        key={interval}
                        variant={refreshInterval === interval ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRefreshInterval(interval)}
                      >
                        {interval}ms
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main map canvas area */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <MapIcon className="h-4 w-4 mr-2" />
                Interactive Layered Map
              </CardTitle>
              <CardDescription>
                View and manage multiple layers of map data
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              {isLoading ? (
                <div className="w-full h-[600px] bg-muted rounded flex items-center justify-center">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full h-[600px] border rounded"
                />
              )}
              <div className="absolute top-2 right-2 space-x-1">
                {layers.map(layer => (
                  <Toggle
                    key={layer.id}
                    variant="outline"
                    size="sm"
                    pressed={layer.visible}
                    onClick={() => toggleLayerVisibility(layer.id)}
                    title={`Toggle ${layer.name}`}
                  >
                    {layer.visible ? (
                      <Eye className="h-4 w-4" style={{ color: layer.color }} />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Toggle>
                ))}
              </div>
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
              {pathHistory.length > 0 && (
                <div>
                  Path points: {pathHistory.length} | 
                  Latest position: ({robotPosition?.x.toFixed(2)}, {robotPosition?.y.toFixed(2)})
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LayeredMapPage;