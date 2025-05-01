import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { AlertCircle, Save, Edit, MapPin, Layers, Trash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/queryClient';

// Simple map visualization component for pages that don't have full robot data
export function MapVisualization({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw a grid
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Draw sample obstacles
    ctx.fillStyle = '#f44336';
    const obstacles = [
      { x: 50, y: 50 },
      { x: 150, y: 120 },
      { x: 250, y: 80 },
    ];
    
    obstacles.forEach(obstacle => {
      ctx.beginPath();
      ctx.arc(obstacle.x, obstacle.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw sample path
    ctx.strokeStyle = '#3f51b5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 50);
    ctx.lineTo(100, 70);
    ctx.lineTo(150, 100);
    ctx.lineTo(200, 150);
    ctx.stroke();
    
    // Draw sample robot
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(100, 70, 8, 0, Math.PI * 2);
    ctx.fill();
    
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      width={800} 
      height={600} 
      className={`w-full h-full bg-white rounded-md ${className}`}
    />
  );
}

interface MapPoint {
  x: number;
  y: number;
  z: number;
}

interface MapPath {
  points: MapPoint[];
  status: string;
}

export interface MapData {
  grid: any[];
  obstacles: MapPoint[];
  paths: MapPath[];
  size?: [number, number];
  resolution?: number;
  origin?: [number, number];
  stamp?: number;
  originalData?: any;
  connectionStatus?: string;
}

export interface RobotStatus {
  model: string;
  serialNumber: string;
  battery: number;
  status: string;
  mode: string;
  lastUpdate: string;
}

export interface RobotPosition {
  x: number;
  y: number;
  z: number;
  orientation: number;
  speed: number;
  timestamp: string;
}

export interface RobotSensorData {
  temperature: number;
  voltage?: number;
  current?: number;
  battery: number;
  power_supply_status?: string;
  timestamp: string;
  charging?: boolean;
  connectionStatus?: string;
  humidity?: number;
  proximity?: number[];
}

interface MapProps {
  robotStatus: RobotStatus;
  robotPosition: RobotPosition;
  sensorData: RobotSensorData;
  mapData: MapData;
  editable?: boolean;
  onMapUpdate?: (updatedMap: MapData) => void;
}

export function Map({ 
  robotStatus, 
  robotPosition, 
  sensorData, 
  mapData, 
  editable = false,
  onMapUpdate
}: MapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentPoint, setCurrentPoint] = useState<MapPoint | null>(null);
  const [editMode, setEditMode] = useState<'obstacles' | 'paths'>('obstacles');
  
  // Store any local edits
  const [localObstacles, setLocalObstacles] = useState<MapPoint[]>([]);
  const [localPaths, setLocalPaths] = useState<MapPath[]>([]);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  
  // Initialize local data from map data
  useEffect(() => {
    if (mapData) {
      setLocalObstacles(mapData.obstacles || []);
      setLocalPaths(mapData.paths || []);
      setHasLocalChanges(false);
    }
  }, [mapData]);
  
  // Calculate scaling and transformations
  const calculateTransforms = useCallback((canvas: HTMLCanvasElement, mapData: MapData, robotPosition: RobotPosition) => {
    // If we have size and resolution, use that for proper scaling
    if (mapData.size && mapData.resolution && mapData.origin) {
      const [width, height] = mapData.size;
      const resolution = mapData.resolution;
      const [originX, originY] = mapData.origin;
      
      // Calculate world size in meters
      const worldWidth = width * resolution;
      const worldHeight = height * resolution;
      
      // Calculate scaling factors to fit the map in the canvas
      const scaleX = canvas.width / worldWidth;
      const scaleY = canvas.height / worldHeight;
      const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some margin
      
      // Calculate transformations using the map's origin and resolution
      return {
        transformX: (x: number) => (x - originX) * scale + canvas.width / 2 - (worldWidth * scale) / 2,
        transformY: (y: number) => canvas.height - ((y - originY) * scale + canvas.height / 2 - (worldHeight * scale) / 2),
        inverseTransformX: (canvasX: number) => (canvasX - canvas.width / 2 + (worldWidth * scale) / 2) / scale + originX,
        inverseTransformY: (canvasY: number) => (canvas.height - canvasY - canvas.height / 2 + (worldHeight * scale) / 2) / scale + originY,
        scale
      };
    }
    
    // Fallback to calculating based on points if we don't have map metadata
    const points = [
      robotPosition,
      ...(mapData.obstacles || []),
      ...(mapData.paths || []).flatMap(path => path.points || [])
    ];
    
    if (points.length < 2) {
      // Not enough points, center on robot position
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const scale = 1;
      
      return {
        transformX: (x: number) => centerX + (x - robotPosition.x) * 20,
        transformY: (y: number) => centerY - (y - robotPosition.y) * 20,
        inverseTransformX: (canvasX: number) => robotPosition.x + (canvasX - centerX) / 20,
        inverseTransformY: (canvasY: number) => robotPosition.y - (canvasY - centerY) / 20,
        scale
      };
    }
    
    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    
    const mapWidth = maxX - minX + 50;  // Add margin
    const mapHeight = maxY - minY + 50;  // Add margin
    
    const scaleX = canvas.width / mapWidth;
    const scaleY = canvas.height / mapHeight;
    const scale = Math.min(scaleX, scaleY);
    
    return {
      transformX: (x: number) => (x - minX + 25) * scale,
      transformY: (y: number) => canvas.height - (y - minY + 25) * scale,
      inverseTransformX: (canvasX: number) => canvasX / scale + minX - 25,
      inverseTransformY: (canvasY: number) => (canvas.height - canvasY) / scale + minY - 25,
      scale
    };
  }, []);

  // Draw map with updated data
  const drawMap = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Use actual obstacles and paths (might be local edits)
    const obstacles = localObstacles || [];
    const paths = localPaths || [];
    
    // Check if we have any map data
    const hasObstacles = obstacles.length > 0;
    const hasPaths = paths.length > 0;
    const hasGridData = mapData.grid && mapData.grid.length > 0;
    const hasMapData = hasObstacles || hasPaths || hasGridData;

    // If we don't have map data, draw a simple grid and the robot's position
    if (!hasMapData) {
      // Draw a simple grid
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 0.5;
      const gridSize = 20;
      
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Draw robot at center of canvas
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Draw robot
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw orientation line
      const angle = (robotPosition.orientation * Math.PI) / 180;
      const orientationLength = 20;
      
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angle) * orientationLength,
        centerY - Math.sin(angle) * orientationLength
      );
      ctx.stroke();
      
      // Draw "No Map Data" message
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No map data available', canvas.width / 2, canvas.height - 20);
      
      if (editable && isEditing) {
        ctx.fillStyle = '#3f51b5';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Click to add obstacles or path points', canvas.width / 2, canvas.height - 40);
      }
      
      return;
    }
    
    // We have map data, calculate transformations
    const { transformX, transformY, scale } = calculateTransforms(canvas, mapData, robotPosition);
    
    // Draw the grid as a heatmap if we have grid data
    if (hasGridData && mapData.size && mapData.resolution && mapData.origin) {
      const [width, height] = mapData.size;
      const resolution = mapData.resolution;
      
      // Create a custom colormap for the grid data
      const colormap = (value: number) => {
        if (value < 0) return 'rgba(255, 0, 0, 0.5)';  // Red for negative values (occupied)
        if (value > 0) return 'rgba(0, 255, 0, 0.2)';  // Green for positive values (free)
        return 'rgba(200, 200, 200, 0.1)';             // Gray for unknown
      };
      
      // Draw the grid cells
      for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
          const idx = j * width + i;
          if (idx < mapData.grid.length) {
            const value = mapData.grid[idx];
            
            // Calculate the position of this cell in world coordinates
            const worldX = mapData.origin[0] + i * resolution;
            const worldY = mapData.origin[1] + j * resolution;
            
            // Transform to canvas coordinates
            const canvasX = transformX(worldX);
            const canvasY = transformY(worldY);
            
            // Calculate cell size on canvas
            const cellSize = resolution * scale;
            
            // Draw the cell
            ctx.fillStyle = colormap(value);
            ctx.fillRect(canvasX, canvasY - cellSize, cellSize, cellSize);
          }
        }
      }
    } else {
      // Draw a grid (optional)
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 0.5;
      const gridSize = 20;
      
      // Calculate grid based on map data if available
      let gridWorldSize = gridSize;
      if (mapData.resolution) {
        gridWorldSize = Math.max(1, Math.round(gridSize * mapData.resolution));
      }
      
      // Draw grid
      for (let x = -1000; x <= 1000; x += gridWorldSize) {
        ctx.beginPath();
        ctx.moveTo(transformX(x), transformY(-1000));
        ctx.lineTo(transformX(x), transformY(1000));
        ctx.stroke();
      }
      
      for (let y = -1000; y <= 1000; y += gridWorldSize) {
        ctx.beginPath();
        ctx.moveTo(transformX(-1000), transformY(y));
        ctx.lineTo(transformX(1000), transformY(y));
        ctx.stroke();
      }
    }
    
    // Draw obstacles
    ctx.fillStyle = '#f44336';
    obstacles.forEach(obstacle => {
      ctx.beginPath();
      ctx.arc(transformX(obstacle.x), transformY(obstacle.y), 5, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw paths
    paths.forEach(path => {
      if (path.points && path.points.length > 1) {
        ctx.strokeStyle = '#3f51b5';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(transformX(path.points[0].x), transformY(path.points[0].y));
        
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(transformX(path.points[i].x), transformY(path.points[i].y));
        }
        
        ctx.stroke();
        
        // Draw points along the path
        ctx.fillStyle = '#3f51b5';
        path.points.forEach(point => {
          ctx.beginPath();
          ctx.arc(transformX(point.x), transformY(point.y), 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
    
    // Draw robot position
    const robotX = transformX(robotPosition.x);
    const robotY = transformY(robotPosition.y);
    
    // Draw robot
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(robotX, robotY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw robot orientation line
    const angle = (robotPosition.orientation * Math.PI) / 180;
    const orientationLength = 15;
    
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(robotX, robotY);
    ctx.lineTo(
      robotX + Math.cos(angle) * orientationLength,
      robotY - Math.sin(angle) * orientationLength
    );
    ctx.stroke();
    
    // Draw proximity sensors if available (visualization based on proximity data)
    if (sensorData.proximity && sensorData.proximity.length > 0) {
      ctx.strokeStyle = 'rgba(255, 152, 0, 0.5)';
      ctx.fillStyle = 'rgba(255, 152, 0, 0.2)';
      
      const sensorAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]; // Assuming 4 sensors
      
      sensorData.proximity.forEach((proximity, index) => {
        if (index < sensorAngles.length) {
          const sensorAngle = angle + sensorAngles[index];
          const sensorRange = proximity * scale * 20; // Scale up for visibility
          
          ctx.beginPath();
          ctx.moveTo(robotX, robotY);
          ctx.lineTo(
            robotX + Math.cos(sensorAngle) * sensorRange,
            robotY - Math.sin(sensorAngle) * sensorRange
          );
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(
            robotX + Math.cos(sensorAngle) * sensorRange,
            robotY - Math.sin(sensorAngle) * sensorRange,
            2, 0, Math.PI * 2
          );
          ctx.fill();
        }
      });
    }
    
    // Draw edit mode indicator when in edit mode
    if (isEditing) {
      ctx.fillStyle = '#333';
      ctx.font = '14px Arial';
      ctx.textAlign = 'start';
      ctx.fillText(`Editing: ${editMode === 'obstacles' ? 'Obstacles' : 'Paths'}`, 10, 20);
      ctx.fillText('Click to add points', 10, 40);
      
      // Draw the current point being edited if any
      if (currentPoint) {
        ctx.fillStyle = editMode === 'obstacles' ? '#f44336' : '#3f51b5';
        ctx.beginPath();
        ctx.arc(transformX(currentPoint.x), transformY(currentPoint.y), 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw a highlight circle
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(transformX(currentPoint.x), transformY(currentPoint.y), 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    
  }, [robotPosition, sensorData, mapData, localObstacles, localPaths, isEditing, editMode, currentPoint, calculateTransforms]);
  
  // Draw the map whenever data changes
  useEffect(() => {
    drawMap();
  }, [drawMap]);
  
  // Handle canvas clicks to add or edit points
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate the actual world coordinates using the inverse transformation
    const { inverseTransformX, inverseTransformY } = calculateTransforms(canvas, mapData, robotPosition);
    
    const worldX = inverseTransformX(x);
    const worldY = inverseTransformY(y);
    
    // Create a new point at the clicked location
    const newPoint: MapPoint = {
      x: worldX,
      y: worldY,
      z: 0 // Assuming flat map for simplicity
    };
    
    if (editMode === 'obstacles') {
      // Add a new obstacle
      const updatedObstacles = [...localObstacles, newPoint];
      setLocalObstacles(updatedObstacles);
      setHasLocalChanges(true);
    } else if (editMode === 'paths') {
      // If we don't have any paths yet, create one
      if (localPaths.length === 0) {
        const newPath: MapPath = {
          points: [newPoint],
          status: 'editing'
        };
        setLocalPaths([newPath]);
      } else {
        // Add to the last path
        const updatedPaths = [...localPaths];
        const lastPath = updatedPaths[updatedPaths.length - 1];
        lastPath.points = [...lastPath.points, newPoint];
        setLocalPaths(updatedPaths);
      }
      setHasLocalChanges(true);
    }
    
    setCurrentPoint(newPoint);
  }, [isEditing, editMode, localObstacles, localPaths, mapData, robotPosition, calculateTransforms]);
  
  // Save map changes
  const saveMapChanges = async () => {
    // Create updated map data
    const updatedMapData = {
      ...mapData,
      obstacles: localObstacles,
      paths: localPaths
    };
    
    try {
      // Call the API to update the map
      const response = await apiRequest(`/api/robots/map/${robotStatus.serialNumber}`, {
        method: 'POST',
        data: updatedMapData
      });
      
      if (response.ok) {
        console.log('Map updated successfully');
        setHasLocalChanges(false);
        
        // Invalidate the map data cache to refetch
        queryClient.invalidateQueries({ queryKey: [`/api/robots/map/${robotStatus.serialNumber}`] });
        
        // Call the callback if provided
        if (onMapUpdate) {
          onMapUpdate(updatedMapData);
        }
      } else {
        console.error('Failed to update map:', await response.text());
      }
    } catch (error) {
      console.error('Error saving map changes:', error);
    }
  };
  
  // Reset the map to original data
  const resetMap = () => {
    setLocalObstacles(mapData.obstacles || []);
    setLocalPaths(mapData.paths || []);
    setHasLocalChanges(false);
    setCurrentPoint(null);
  };
  
  // Create a new path
  const createNewPath = () => {
    const newPath: MapPath = {
      points: [],
      status: 'new'
    };
    setLocalPaths([...localPaths, newPath]);
  };
  
  // Start edit mode
  const startEditing = (mode: 'obstacles' | 'paths') => {
    setIsEditing(true);
    setEditMode(mode);
  };
  
  // End edit mode
  const endEditing = () => {
    setIsEditing(false);
    setCurrentPoint(null);
  };
  
  // Delete the most recent point
  const deleteLastPoint = () => {
    if (editMode === 'obstacles' && localObstacles.length > 0) {
      setLocalObstacles(localObstacles.slice(0, -1));
      setHasLocalChanges(true);
    } else if (editMode === 'paths' && localPaths.length > 0) {
      const updatedPaths = [...localPaths];
      const lastPath = updatedPaths[updatedPaths.length - 1];
      if (lastPath.points.length > 1) {
        lastPath.points = lastPath.points.slice(0, -1);
      } else {
        updatedPaths.pop(); // Remove the whole path if only 1 point
      }
      setLocalPaths(updatedPaths);
      setHasLocalChanges(true);
    }
    setCurrentPoint(null);
  };
  
  return (
    <div className="relative w-full h-full">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={600} 
        className="w-full h-full bg-white rounded-md"
        onClick={handleCanvasClick}
      />
      
      {editable && (
        <div className="absolute top-2 right-2 flex flex-col space-y-2">
          {!isEditing ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => startEditing('obstacles')}
                    >
                      <MapPin className="h-4 w-4 mr-1" /> Edit Obstacles
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Add or edit obstacles on the map
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => startEditing('paths')}
                    >
                      <Layers className="h-4 w-4 mr-1" /> Edit Paths
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Add or edit paths on the map
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <Badge variant="outline" className="mb-2">
                Editing {editMode === 'obstacles' ? 'Obstacles' : 'Paths'}
              </Badge>
              
              {editMode === 'paths' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={createNewPath}
                >
                  <Layers className="h-4 w-4 mr-1" /> New Path
                </Button>
              )}
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={deleteLastPoint}
              >
                <Trash className="h-4 w-4 mr-1" /> Delete Last
              </Button>
              
              <Button 
                size="sm" 
                variant={hasLocalChanges ? "default" : "outline"}
                onClick={saveMapChanges}
                disabled={!hasLocalChanges}
              >
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                onClick={resetMap}
                disabled={!hasLocalChanges}
              >
                <AlertCircle className="h-4 w-4 mr-1" /> Reset
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                onClick={endEditing}
              >
                Done
              </Button>
            </>
          )}
        </div>
      )}
      
      {/* Edit Point Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Point</DialogTitle>
            <DialogDescription>
              Adjust the coordinates for this point.
            </DialogDescription>
          </DialogHeader>
          
          {currentPoint && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="x" className="text-right">X</Label>
                <Input 
                  id="x" 
                  type="number" 
                  value={currentPoint.x}
                  onChange={(e) => setCurrentPoint({
                    ...currentPoint,
                    x: parseFloat(e.target.value)
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="y" className="text-right">Y</Label>
                <Input 
                  id="y" 
                  type="number" 
                  value={currentPoint.y}
                  onChange={(e) => setCurrentPoint({
                    ...currentPoint,
                    y: parseFloat(e.target.value)
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="z" className="text-right">Z</Label>
                <Input 
                  id="z" 
                  type="number" 
                  value={currentPoint.z}
                  onChange={(e) => setCurrentPoint({
                    ...currentPoint,
                    z: parseFloat(e.target.value)
                  })}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              // Update the point in the appropriate collection
              if (currentPoint && editMode === 'obstacles') {
                // For obstacles, find and replace the obstacle
                const index = localObstacles.findIndex(o => 
                  o.x === currentPoint.x && o.y === currentPoint.y && o.z === currentPoint.z);
                
                if (index !== -1) {
                  const updatedObstacles = [...localObstacles];
                  updatedObstacles[index] = currentPoint;
                  setLocalObstacles(updatedObstacles);
                  setHasLocalChanges(true);
                }
              } else if (currentPoint && editMode === 'paths') {
                // For paths, we need to find the path and update the point
                const updatedPaths = [...localPaths];
                for (const path of updatedPaths) {
                  const index = path.points.findIndex(p => 
                    p.x === currentPoint.x && p.y === currentPoint.y && p.z === currentPoint.z);
                  
                  if (index !== -1) {
                    path.points[index] = currentPoint;
                    setLocalPaths(updatedPaths);
                    setHasLocalChanges(true);
                    break;
                  }
                }
              }
              
              setShowEditDialog(false);
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}