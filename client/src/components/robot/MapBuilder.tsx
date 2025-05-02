import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
  Map as MapIcon, 
  Save, 
  Play, 
  Square, 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  RotateCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DirectionalControl } from './DirectionalControl';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MAP_BUILDING_STATUS = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  BUILDING: 'building',
  PROCESSING: 'processing',
  SAVING: 'saving',
  COMPLETED: 'completed',
  ERROR: 'error'
};

interface MapBuilderProps {
  serialNumber: string;
  onMapBuilt?: (mapId: string) => void;
}

export default function MapBuilder({ serialNumber, onMapBuilt }: MapBuilderProps) {
  const [mapStatus, setMapStatus] = useState(MAP_BUILDING_STATUS.IDLE);
  const [mapProgress, setMapProgress] = useState(0);
  const [mapName, setMapName] = useState(`New Map ${new Date().toLocaleDateString()}`);
  const [mappingSessionId, setMappingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get current map data (LiDAR and position) to display while mapping
  const { data: lidarData } = useQuery({
    queryKey: ['/api/robots/lidar', serialNumber],
    refetchInterval: mapStatus === MAP_BUILDING_STATUS.BUILDING ? 1000 : false,
    enabled: !!serialNumber && mapStatus === MAP_BUILDING_STATUS.BUILDING
  });
  
  const { data: positionData } = useQuery({
    queryKey: ['/api/robots/position', serialNumber],
    refetchInterval: mapStatus === MAP_BUILDING_STATUS.BUILDING ? 1000 : false,
    enabled: !!serialNumber && mapStatus === MAP_BUILDING_STATUS.BUILDING
  });
  
  // Get the current map being built
  const { data: currentMapData, refetch: refetchMapData } = useQuery({
    queryKey: ['/api/robots/current-map', serialNumber, mappingSessionId],
    refetchInterval: mapStatus === MAP_BUILDING_STATUS.BUILDING ? 2000 : false,
    enabled: !!serialNumber && !!mappingSessionId && mapStatus === MAP_BUILDING_STATUS.BUILDING
  });
  
  // Update the map canvas when data changes
  useEffect(() => {
    if (canvasRef.current && currentMapData?.grid) {
      drawMapOnCanvas(currentMapData);
    }
  }, [currentMapData, canvasRef.current]);
  
  // Simulate progress update
  useEffect(() => {
    if (mapStatus === MAP_BUILDING_STATUS.BUILDING) {
      intervalRef.current = setInterval(() => {
        setMapProgress(prev => {
          const newProgress = prev + (Math.random() * 0.5);
          return newProgress > 95 ? 95 : newProgress;
        });
      }, 3000);
    } else if (mapStatus === MAP_BUILDING_STATUS.PROCESSING) {
      setMapProgress(96);
      
      intervalRef.current = setInterval(() => {
        setMapProgress(prev => {
          const newProgress = prev + (Math.random() * 0.5);
          return newProgress > 99 ? 99 : newProgress;
        });
      }, 1000);
    } else if (mapStatus === MAP_BUILDING_STATUS.SAVING) {
      setMapProgress(99.5);
    } else if (mapStatus === MAP_BUILDING_STATUS.COMPLETED) {
      setMapProgress(100);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mapStatus]);
  
  // Function to draw map data on canvas
  const drawMapOnCanvas = (mapData: any) => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData?.grid) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the map grid
    const imgData = new Image();
    imgData.onload = () => {
      canvas.width = imgData.width;
      canvas.height = imgData.height;
      ctx.drawImage(imgData, 0, 0);
      
      // Draw robot position if available
      if (positionData) {
        const scale = mapData.resolution;
        const originX = mapData.origin[0];
        const originY = mapData.origin[1];
        
        // Convert robot position to pixel coordinates
        const robotX = (positionData.x - originX) / scale;
        const robotY = canvas.height - (positionData.y - originY) / scale;
        
        // Draw robot position
        ctx.beginPath();
        ctx.arc(robotX, robotY, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
        
        // Draw robot orientation line
        ctx.beginPath();
        ctx.moveTo(robotX, robotY);
        const orientation = positionData.orientation || 0;
        const lineLength = 20;
        const endX = robotX + lineLength * Math.cos(orientation);
        const endY = robotY - lineLength * Math.sin(orientation);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    };
    
    imgData.src = `data:image/png;base64,${mapData.grid}`;
  };
  
  // Start building a new map
  const startMapBuilding = async () => {
    try {
      setMapStatus(MAP_BUILDING_STATUS.PREPARING);
      setError(null);
      setMapProgress(0);
      
      // Start a new mapping session
      const response = await apiRequest('POST', `/api/robots/start-mapping/${serialNumber}`, {
        mapName: mapName
      });
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      setMappingSessionId(data.sessionId);
      setMapStatus(MAP_BUILDING_STATUS.BUILDING);
      
      toast({
        title: "Map building started",
        description: "Drive the robot around to create a map of the environment.",
      });
    } catch (err: any) {
      setError(err.message || 'Failed to start mapping session');
      setMapStatus(MAP_BUILDING_STATUS.ERROR);
      
      toast({
        title: "Error starting map building",
        description: err.message || 'Something went wrong',
        variant: "destructive"
      });
    }
  };
  
  // Save the current map
  const saveMap = async () => {
    if (!mappingSessionId) {
      toast({
        title: "Error saving map",
        description: "No active mapping session found",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setMapStatus(MAP_BUILDING_STATUS.SAVING);
      
      // Call API to finalize and save the map
      const response = await apiRequest('POST', `/api/robots/save-map/${serialNumber}`, {
        sessionId: mappingSessionId,
        mapName: mapName
      });
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      setMapStatus(MAP_BUILDING_STATUS.COMPLETED);
      
      // Invalidate map-related queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ['/api/robots/map', serialNumber]
      });
      
      if (onMapBuilt) {
        onMapBuilt(data.mapId);
      }
      
      toast({
        title: "Map saved successfully",
        description: `Map "${mapName}" has been saved and is ready to use.`
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save map');
      setMapStatus(MAP_BUILDING_STATUS.ERROR);
      
      toast({
        title: "Error saving map",
        description: err.message || 'Something went wrong',
        variant: "destructive"
      });
    }
  };
  
  // Cancel map building
  const cancelMapBuilding = async () => {
    if (!mappingSessionId) return;
    
    try {
      // Call API to cancel the mapping session
      await apiRequest('POST', `/api/robots/cancel-mapping/${serialNumber}`, {
        sessionId: mappingSessionId
      });
      
      setMapStatus(MAP_BUILDING_STATUS.IDLE);
      setMappingSessionId(null);
      setMapProgress(0);
      
      toast({
        title: "Map building cancelled",
        description: "The mapping session has been cancelled."
      });
    } catch (err: any) {
      toast({
        title: "Error cancelling map building",
        description: err.message || 'Something went wrong',
        variant: "destructive"
      });
    }
  };
  
  // Reset the map builder
  const resetMapBuilder = () => {
    setMapStatus(MAP_BUILDING_STATUS.IDLE);
    setMappingSessionId(null);
    setMapProgress(0);
    setError(null);
    setMapName(`New Map ${new Date().toLocaleDateString()}`);
  };
  
  // Get status badge color
  const getStatusBadgeColor = () => {
    switch (mapStatus) {
      case MAP_BUILDING_STATUS.PREPARING:
      case MAP_BUILDING_STATUS.BUILDING:
        return 'bg-blue-500';
      case MAP_BUILDING_STATUS.PROCESSING:
      case MAP_BUILDING_STATUS.SAVING:
        return 'bg-amber-500';
      case MAP_BUILDING_STATUS.COMPLETED:
        return 'bg-green-500';
      case MAP_BUILDING_STATUS.ERROR:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  // Get user-friendly status text
  const getStatusText = () => {
    switch (mapStatus) {
      case MAP_BUILDING_STATUS.IDLE:
        return 'Ready to start';
      case MAP_BUILDING_STATUS.PREPARING:
        return 'Preparing...';
      case MAP_BUILDING_STATUS.BUILDING:
        return 'Building map...';
      case MAP_BUILDING_STATUS.PROCESSING:
        return 'Processing map data...';
      case MAP_BUILDING_STATUS.SAVING:
        return 'Saving map...';
      case MAP_BUILDING_STATUS.COMPLETED:
        return 'Map completed';
      case MAP_BUILDING_STATUS.ERROR:
        return 'Error';
      default:
        return 'Unknown';
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-primary" />
              Map Builder
            </div>
            <Badge className={getStatusBadgeColor()}>
              {getStatusText()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mapStatus === MAP_BUILDING_STATUS.IDLE && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="map-name">Map Name</Label>
                <Input 
                  id="map-name" 
                  value={mapName} 
                  onChange={(e) => setMapName(e.target.value)} 
                  placeholder="Enter a name for your map"
                />
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Map Building Instructions</AlertTitle>
                <AlertDescription>
                  <p className="mt-1">
                    <strong>IMPORTANT:</strong> Always start and end mapping from a charging station for proper localization.
                  </p>
                  <p className="mt-1">
                    Click "Start Building Map" and drive the robot around to map the environment. Try to cover all accessible areas for the best results.
                  </p>
                  <p className="mt-1">
                    When finished, return to the charging station before clicking "Save Map" to ensure accurate map alignment.
                  </p>
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={startMapBuilding} 
                className="w-full flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Start Building Map
              </Button>
            </div>
          )}
          
          {mapStatus !== MAP_BUILDING_STATUS.IDLE && mapStatus !== MAP_BUILDING_STATUS.ERROR && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Building: {mapName}</span>
                  <span>{mapProgress.toFixed(1)}%</span>
                </div>
                <Progress value={mapProgress} className="h-2" />
              </div>
              
              {mapStatus === MAP_BUILDING_STATUS.BUILDING && (
                <div className="border rounded-md bg-gray-50 p-1 aspect-video relative overflow-hidden">
                  <canvas 
                    ref={canvasRef} 
                    className="w-full h-full object-contain"
                  />
                  
                  {!currentMapData?.grid && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin text-gray-400" />
                        <p className="text-sm text-gray-500">Waiting for map data...</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute bottom-2 right-2 bg-white/80 rounded text-xs p-1">
                    Drive the robot to build map
                  </div>
                </div>
              )}
              
              {mapStatus === MAP_BUILDING_STATUS.BUILDING && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <DirectionalControl 
                      serialNumber={serialNumber} 
                      disabled={false} 
                      compact={true}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">
                        Drive the robot around to all areas you want to map
                      </p>
                      <div className="text-xs font-medium text-amber-600 mb-2 bg-amber-50 p-1 rounded">
                        Remember to return to the charging station before saving
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => refetchMapData()}
                        className="flex items-center gap-1"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        Refresh Map
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={saveMap} 
                        className="flex items-center gap-1"
                        variant="default"
                      >
                        <Save className="h-4 w-4" />
                        Save Map
                      </Button>
                      <Button 
                        onClick={cancelMapBuilding} 
                        className="flex items-center gap-1"
                        variant="outline"
                      >
                        <Square className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {(mapStatus === MAP_BUILDING_STATUS.PROCESSING || 
                mapStatus === MAP_BUILDING_STATUS.SAVING) && (
                <div className="text-center py-6">
                  <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                  <p>
                    {mapStatus === MAP_BUILDING_STATUS.PROCESSING ? 
                      'Processing map data...' : 'Saving map...'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This may take a moment. Please do not refresh the page.
                  </p>
                </div>
              )}
              
              {mapStatus === MAP_BUILDING_STATUS.COMPLETED && (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
                  <p className="text-lg font-medium">Map Created Successfully!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your new map "{mapName}" is ready to use
                  </p>
                </div>
              )}
              
              {(mapStatus === MAP_BUILDING_STATUS.COMPLETED || 
               mapStatus === MAP_BUILDING_STATUS.PROCESSING || 
               mapStatus === MAP_BUILDING_STATUS.SAVING) && (
                <Button 
                  onClick={resetMapBuilder} 
                  className="w-full"
                  variant={mapStatus === MAP_BUILDING_STATUS.COMPLETED ? 'default' : 'outline'}
                  disabled={mapStatus !== MAP_BUILDING_STATUS.COMPLETED}
                >
                  {mapStatus === MAP_BUILDING_STATUS.COMPLETED ? 'Start a New Map' : 'Building Map...'}
                </Button>
              )}
            </div>
          )}
          
          {mapStatus === MAP_BUILDING_STATUS.ERROR && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Building Map</AlertTitle>
                <AlertDescription>
                  {error || 'Something went wrong while building the map.'}
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={resetMapBuilder} 
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}