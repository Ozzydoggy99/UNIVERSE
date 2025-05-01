import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { 
  AlertCircle, Save, Edit, MapPin, Layers, Trash, Copy, Plus, 
  Cloud, Upload, Download, Undo, Maximize, LocateFixed, 
  Zap, Compass, ZoomIn, ZoomOut, Navigation, ChevronLeft, ChevronRight,
  Check, Battery, Map as MapIcon, Move, ArrowRight, ChevronsRight,
  LayoutList, Settings, PanelRight, PanelLeft, Hand, ChevronDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  grid: any[] | string; // Can be an array of grid values or a base64 string for encoded map
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
  const [showRightPanel, setShowRightPanel] = useState(true);
  
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

  // Steps/locations for the right panel
  const sampleLocations = [
    { id: 101, name: "Unit 101", floor: "Ground Floor", x: 10, y: 20, z: 0 },
    { id: 102, name: "Unit 102", floor: "Ground Floor", x: 30, y: 40, z: 0 },
    { id: 103, name: "Unit 103", floor: "Ground Floor", x: 50, y: 60, z: 0 },
    { id: 201, name: "Unit 201", floor: "Second Floor", x: 10, y: 20, z: 1 },
    { id: 202, name: "Unit 202", floor: "Second Floor", x: 30, y: 40, z: 1 },
  ];
  
  const sampleSteps = [
    { id: 1, name: "Lobby Entrance", type: "start", x: 0, y: 0, z: 0 },
    { id: 2, name: "Elevator Ground Floor", type: "elevator", x: 10, y: 10, z: 0 },
    { id: 3, name: "Elevator Second Floor", type: "elevator", x: 10, y: 10, z: 1 },
    { id: 4, name: "Unit 201 Door", type: "destination", x: 20, y: 20, z: 1 },
  ];
  
  // Calculate scaling and transformations
  const calculateTransforms = useCallback((canvas: HTMLCanvasElement, mapData: MapData, robotPosition: RobotPosition) => {
    // If we have size and resolution, use that for proper scaling based on actual map data
    if (mapData.size && mapData.resolution && mapData.origin) {
      const [width, height] = mapData.size;
      const resolution = mapData.resolution;
      const [originX, originY] = mapData.origin;
      
      // Calculate world size in meters
      const worldWidth = width * resolution;
      const worldHeight = height * resolution;
      
      // Add padding to avoid edges
      const padding = 20; // pixels
      
      // Calculate scaling factors to fit the map in the canvas with padding
      const scaleX = (canvas.width - padding*2) / worldWidth;
      const scaleY = (canvas.height - padding*2) / worldHeight;
      const scale = Math.min(scaleX, scaleY); // Use smaller scale to maintain aspect ratio
      
      // Calculate the position to center the map in the canvas
      const offsetX = (canvas.width - worldWidth * scale) / 2;
      const offsetY = (canvas.height - worldHeight * scale) / 2;
      
      // Calculate transformations using the map's origin and resolution
      // Robot coordinate system (x, y) -> Canvas coordinate system (canvasX, canvasY)
      // In the robot coordinate system, +x is right and +y is up
      // In the canvas, +x is right and +y is down, so we need to flip y
      return {
        // From world (robot) coordinates to canvas coordinates
        transformX: (x: number) => {
          // Convert from robot coordinate to pixels
          // First adjust for origin offset
          const relX = x - originX;
          // Then scale and translate to center in canvas
          return offsetX + relX * scale;
        },
        transformY: (y: number) => {
          // Convert from robot coordinate to pixels
          // First adjust for origin offset 
          const relY = y - originY;
          // Then flip y-axis (robot +y is up, canvas +y is down),
          // scale, and translate to center in canvas
          return canvas.height - (offsetY + relY * scale);
        },
        // From canvas coordinates to world (robot) coordinates
        inverseTransformX: (canvasX: number) => {
          // Reverse the transform - first remove offset
          const relX = (canvasX - offsetX) / scale;
          // Then add back origin offset
          return relX + originX;
        },
        inverseTransformY: (canvasY: number) => {
          // Reverse the transform - first flip y and remove offset
          const relY = (canvas.height - canvasY - offsetY) / scale;
          // Then add back origin offset
          return relY + originY;
        },
        scale
      };
    }
    
    // Fallback to calculating based on points if we don't have map metadata
    const points = [
      // Convert robotPosition to MapPoint format
      { x: robotPosition.x, y: robotPosition.y, z: 0 },
      ...(mapData.obstacles || []),
      ...(mapData.paths || []).flatMap(path => path.points || [])
    ];
    
    if (points.length < 2) {
      // Not enough points, center on robot position
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const scale = 20; // Scale up a bit for visibility
      
      return {
        // Center the robot and scale nearby points
        transformX: (x: number) => centerX + (x - robotPosition.x) * scale,
        transformY: (y: number) => centerY - (y - robotPosition.y) * scale, // Flip y-axis
        inverseTransformX: (canvasX: number) => robotPosition.x + (canvasX - centerX) / scale,
        inverseTransformY: (canvasY: number) => robotPosition.y - (canvasY - centerY) / scale, // Flip y-axis
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
    const hasGridData = mapData.grid && 
      ((typeof mapData.grid === 'string' && mapData.grid.length > 0) || 
       (Array.isArray(mapData.grid) && mapData.grid.length > 0));
    const hasMapData = hasObstacles || hasPaths || hasGridData;
  
    // Draw map background
    ctx.fillStyle = '#e9f7ef';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    
    // Draw the grid based on the type of data we have
    if (hasGridData && mapData.size && mapData.resolution && mapData.origin) {
      // Check if the grid data is a base64 encoded image from the physical robot
      if (typeof mapData.grid === 'string' && mapData.grid.startsWith('iVBOR')) {
        console.log('Rendering base64 encoded PNG map from physical robot');
        
        // Create an image element to load the base64 data
        const img = new Image();
        img.onload = () => {
          if (!ctx || !canvasRef.current) return;
          
          // Once the image is loaded, draw it on the canvas
          const canvas = canvasRef.current;
          
          // Clear the background
          ctx.fillStyle = '#e9f7ef';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Get map dimensions and metadata
          const [width, height] = mapData.size || [0, 0];
          const resolution = mapData.resolution || 0.05;
          const [originX, originY] = mapData.origin || [0, 0];
          
          // Calculate world size in meters
          const worldWidth = width * resolution;
          const worldHeight = height * resolution;
          
          // Calculate the scale to fit the image in the canvas
          // while maintaining aspect ratio
          const scaleX = canvas.width / worldWidth;
          const scaleY = canvas.height / worldHeight;
          const imageScale = Math.min(scaleX, scaleY) * 0.9; // 90% to add margin
          
          // Calculate centered position
          const x = (canvas.width - worldWidth * imageScale) / 2;
          const y = (canvas.height - worldHeight * imageScale) / 2;
          
          console.log(`Map dimensions: ${width}x${height} pixels, ${worldWidth.toFixed(2)}x${worldHeight.toFixed(2)} meters`);
          console.log(`Map origin: (${originX.toFixed(2)}, ${originY.toFixed(2)})`);
          console.log(`Map resolution: ${resolution.toFixed(5)} meters/pixel`);
          console.log(`Canvas size: ${canvas.width}x${canvas.height} pixels`);
          console.log(`Image scale: ${imageScale.toFixed(3)}`);
          console.log(`Image position: (${x.toFixed(0)}, ${y.toFixed(0)})`);
          
          // Use a different approach to render the map correctly
          ctx.save();
          
          // Adjust the image to account for the map origin
          // In robot coordinate system, origin is at bottom-left
          // For canvas, we need to translate and flip the Y-axis
          
          // First translate to position where the map should be drawn,
          // accounting for the scaling and centering
          ctx.translate(x, y);
          
          // Then we flip the Y axis so the map is oriented correctly
          // with bottom-left origin instead of top-left
          ctx.scale(1, -1);
          
          // Adjust the position to account for the flip
          ctx.translate(0, -worldHeight * imageScale);
          
          // Draw the image
          ctx.drawImage(img, 0, 0, worldWidth * imageScale, worldHeight * imageScale);
          
          ctx.restore();
          
          // After drawing the map, overlay the robot position and paths
          drawRobotAndPaths();
        };
        
        // Set the source of the image to the base64 data
        img.src = `data:image/png;base64,${mapData.grid}`;
      } 
      // Draw numeric grid data (traditional array)
      else if (Array.isArray(mapData.grid)) {
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
              
              // Convert grid coordinates to world coordinates
              const worldX = i * resolution + mapData.origin[0];
              const worldY = j * resolution + mapData.origin[1];
              
              // Transform to canvas coordinates
              const canvasX = transformX(worldX);
              const canvasY = transformY(worldY);
              
              // Draw the cell
              if (value !== 0) {  // Skip unknown areas
                const cellSize = resolution * scale;
                ctx.fillStyle = colormap(value);
                ctx.fillRect(canvasX, canvasY - cellSize, cellSize, cellSize);
              }
            }
          }
        }
        
        // Draw robot and paths immediately since we don't need to wait for image loading
        drawRobotAndPaths();
      }
    } else {
      // No grid data, just draw robot and paths immediately
      drawRobotAndPaths();
    }
    
    // Helper function to draw robot and paths - extracted to avoid code duplication
    function drawRobotAndPaths() {
      if (!ctx) return;
    
      // Draw obstacles
      ctx.fillStyle = '#f44336';
      obstacles.forEach(obstacle => {
        const x = transformX(obstacle.x);
        const y = transformY(obstacle.y);
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // If editing, highlight the current point
        if (isEditing && currentPoint && 
            obstacle.x === currentPoint.x && 
            obstacle.y === currentPoint.y && 
            obstacle.z === currentPoint.z) {
          ctx.strokeStyle = '#f44336';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    
      // Draw paths
      paths.forEach((path, pathIndex) => {
        if (path.points.length > 0) {
          // Choose color based on path status
          let pathColor = '#3f51b5';  // Default blue
          if (path.status === 'completed') {
            pathColor = '#4caf50';  // Green for completed
          } else if (path.status === 'error') {
            pathColor = '#f44336';  // Red for error
          } else if (path.status === 'in-progress') {
            pathColor = '#ff9800';  // Orange for in-progress
          }
        
          ctx.strokeStyle = pathColor;
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          const firstPoint = path.points[0];
          const startX = transformX(firstPoint.x);
          const startY = transformY(firstPoint.y);
          ctx.moveTo(startX, startY);
          
          // Draw path lines
          for (let i = 1; i < path.points.length; i++) {
            const point = path.points[i];
            const x = transformX(point.x);
            const y = transformY(point.y);
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        
          // Draw points for each path
          path.points.forEach((point, pointIndex) => {
            const x = transformX(point.x);
            const y = transformY(point.y);
            
            // Start point is larger
            const radius = pointIndex === 0 ? 6 : 4;
            
            // Fill and stroke for each point
            ctx.fillStyle = pathColor;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // If editing, highlight the current point
            if (isEditing && currentPoint && 
                point.x === currentPoint.x && 
                point.y === currentPoint.y && 
                point.z === currentPoint.z) {
              ctx.strokeStyle = pathColor;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
              ctx.stroke();
            }
          });
        }
      });
    
      // Draw robot position
      const robotX = transformX(robotPosition.x);
      const robotY = transformY(robotPosition.y);
      
      // Draw a circle for the robot
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(robotX, robotY, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw orientation line
      const angle = (robotPosition.orientation * Math.PI) / 180;
      const orientationLength = 20;
      
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(robotX, robotY);
      ctx.lineTo(
        robotX + Math.cos(angle) * orientationLength,
        robotY - Math.sin(angle) * orientationLength
      );
      ctx.stroke();
      
      // Draw scale information
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
    
      // Add some labels for the map if available
      if (mapData.size && mapData.resolution && mapData.origin) {
        const [width, height] = mapData.size;
        const resolution = mapData.resolution;
        const [originX, originY] = mapData.origin;
        
        if (ctx) {
          ctx.fillStyle = '#000';
          ctx.font = '12px Arial';
          ctx.textAlign = 'left';
          
          // Only show these when debugging or if explicitly requested
          if (false) {
            ctx.fillText(`Resolution: ${resolution.toFixed(3)}m/px`, 10, 20);
            ctx.fillText(`Size: ${width}x${height} px (${(width * resolution).toFixed(1)}x${(height * resolution).toFixed(1)}m)`, 10, 40);
            ctx.fillText(`Origin: ${originX.toFixed(2)}, ${originY.toFixed(2)}`, 10, 60);
          }
        }
      }
    } // End of drawRobotAndPaths
    
  }, [
    localObstacles, 
    localPaths, 
    mapData, 
    robotPosition, 
    calculateTransforms, 
    isEditing, 
    currentPoint, 
    editable
  ]);
  
  // Redraw the map when any of these change
  useEffect(() => {
    drawMap();
  }, [
    drawMap, 
    localObstacles, 
    localPaths, 
    mapData, 
    robotPosition, 
    isEditing, 
    currentPoint
  ]);
  
  // Handle editing
  const startEditing = (mode: 'obstacles' | 'paths') => {
    setEditMode(mode);
    setIsEditing(true);
  };
  
  const endEditing = () => {
    setIsEditing(false);
    setCurrentPoint(null);
  };
  
  const resetMap = () => {
    setLocalObstacles(mapData.obstacles || []);
    setLocalPaths(mapData.paths || []);
    setHasLocalChanges(false);
    setCurrentPoint(null);
  };
  
  const saveMapChanges = () => {
    if (onMapUpdate) {
      const updatedMap: MapData = {
        ...mapData,
        obstacles: localObstacles,
        paths: localPaths
      };
      
      onMapUpdate(updatedMap);
      
      // Update the query client cache
      queryClient.setQueryData(['/api/robots/map', robotStatus.serialNumber], updatedMap);
      
      // Also send the update to the server
      apiRequest(`/api/robots/map/${robotStatus.serialNumber}`, {
        method: 'PUT',
        data: updatedMap
      })
        .then(() => {
          console.log('Map updated on server');
          setHasLocalChanges(false);
        })
        .catch(err => {
          console.error('Failed to update map on server', err);
        });
    }
  };
  
  const createNewPath = () => {
    if (editMode === 'paths') {
      const newPath: MapPath = {
        points: [],
        status: 'new'
      };
      
      setLocalPaths([...localPaths, newPath]);
    }
  };
  
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // Calculate the real-world coordinates using the inverse transform
    const { inverseTransformX, inverseTransformY } = calculateTransforms(canvas, mapData, robotPosition);
    
    const x = inverseTransformX(canvasX);
    const y = inverseTransformY(canvasY);
    const z = 0;  // Default to ground level
    
    // Create a new point at the click location
    const newPoint: MapPoint = {
      x,
      y,
      z
    };
    
    // Add the point to the appropriate collection
    if (editMode === 'obstacles') {
      setLocalObstacles([...localObstacles, newPoint]);
      setHasLocalChanges(true);
    } else if (editMode === 'paths') {
      // For paths, add to the last path or create a new one
      if (localPaths.length === 0) {
        const newPath: MapPath = {
          points: [newPoint],
          status: 'new'
        };
        
        setLocalPaths([newPath]);
      } else {
        const updatedPaths = [...localPaths];
        const lastPath = updatedPaths[updatedPaths.length - 1];
        lastPath.points.push(newPoint);
        
        setLocalPaths(updatedPaths);
      }
      
      setHasLocalChanges(true);
    }
  };
  
  const deleteLastPoint = () => {
    if (editMode === 'obstacles' && localObstacles.length > 0) {
      const updatedObstacles = localObstacles.slice(0, -1);
      setLocalObstacles(updatedObstacles);
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
    <div className="relative w-full h-full flex flex-col bg-[#e9f7ef]">
      {/* Top toolbar with business/area selection and actions */}
      <div className="flex items-center p-2 bg-white border-b">
        <div className="flex items-center space-x-1 mr-4">
          <div className="flex items-center">
            <span className="text-sm font-medium mr-2">Business:</span>
            <Select defaultValue="richtech">
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Select business" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="richtech">Richtech</SelectItem>
                <SelectItem value="other">Other Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center ml-4">
            <span className="text-sm font-medium mr-2">Area:</span>
            <Select defaultValue="basement">
              <SelectTrigger className="w-[180px] h-8 flex">
                <SelectValue placeholder="Select area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basement">Basement new</SelectItem>
                <SelectItem value="main">Main Floor</SelectItem>
                <SelectItem value="secondary">Secondary Floor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex-1" />
        
        {/* Map action buttons */}
        <div className="flex space-x-1">
          <Button size="sm" variant="secondary">
            <Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
          <Button size="sm" variant="secondary">
            <Plus className="h-4 w-4 mr-1" /> Create
          </Button>
          <Button size="sm" variant="secondary">
            <Cloud className="h-4 w-4 mr-1" /> Cloud Sync
          </Button>
          <Button size="sm" variant="secondary">
            <Upload className="h-4 w-4 mr-1" /> Continue Upload
          </Button>
          <Button size="sm" variant="secondary">
            <Trash className="h-4 w-4 mr-1" /> Delete
          </Button>
          <Button size="sm" variant="secondary">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button size="sm" variant="secondary">
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
        </div>
      </div>
      
      {/* Main content area with left tools, canvas, and right sidebar */}
      <div className="flex-1 flex">
        {/* Left side tools panel */}
        <div className="bg-white p-2 border-r flex flex-col space-y-4 items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-md">
                  <Maximize className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Full Screen
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Separator className="my-1" />
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={!isEditing ? "ghost" : "secondary"}
                  size="icon" 
                  onClick={() => setIsEditing(!isEditing)}
                  className="rounded-md"
                >
                  <Undo className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Undo
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-md"
                  onClick={() => startEditing('obstacles')}
                >
                  <Move className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Absorb
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={isEditing && editMode === 'obstacles' ? "secondary" : "ghost"}
                  size="icon" 
                  className="rounded-md"
                  onClick={() => startEditing('obstacles')}
                >
                  <Edit className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Edit
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-md">
                  <Compass className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Angle
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-md">
                  <Zap className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Charging Pile
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={isEditing && editMode === 'paths' ? "secondary" : "ghost"}
                  size="icon" 
                  className="rounded-md"
                  onClick={() => startEditing('paths')}
                >
                  <LocateFixed className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Current Location
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Separator className="my-1" />
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-md">
                  <MapPin className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Add Point
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-md">
                  <Layers className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Add Path
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-md">
                  <Trash className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Delete
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Main map canvas */}
        <div className="flex-1 relative overflow-hidden">
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            className="w-full h-full bg-[#e9f7ef]"
            onClick={handleCanvasClick}
          />
          
          {/* Zoom controls */}
          <div className="absolute bottom-4 left-4 flex flex-col bg-white rounded-md shadow">
            <Button variant="ghost" size="icon" className="rounded-t-md rounded-b-none border-b">
              <ZoomIn className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-t-none rounded-b-none border-b">
              <ZoomOut className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-t-none rounded-b-md">
              <Navigation className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Scale indicator */}
          <div className="absolute bottom-4 left-20 flex flex-col items-center">
            <div className="h-1 w-16 bg-black"></div>
            <span className="text-xs mt-1">5m</span>
          </div>
          
          {/* Save button when editing */}
          {isEditing && hasLocalChanges && (
            <div className="absolute top-2 right-2">
              <Button 
                size="sm" 
                variant="default" 
                onClick={saveMapChanges}
              >
                <Save className="h-4 w-4 mr-1" /> Save Changes
              </Button>
            </div>
          )}
          
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
        </div>
        
        {/* Right sidebar with steps/locations */}
        {showRightPanel && (
          <div className="w-64 bg-white border-l overflow-auto">
            <div className="p-2 border-b flex justify-between items-center">
              <h3 className="font-medium">Locations & Steps</h3>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => setShowRightPanel(false)}
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Tabs defaultValue="locations" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="locations">Locations</TabsTrigger>
                <TabsTrigger value="steps">Steps</TabsTrigger>
              </TabsList>
              
              <TabsContent value="locations" className="p-2">
                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium">Custom Locations</h4>
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  
                  <div className="border rounded-md">
                    <div className="p-2 border-b bg-muted/30 text-xs font-medium flex justify-between">
                      <span>Ground Floor</span>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                    
                    {sampleLocations
                      .filter(loc => loc.floor === "Ground Floor")
                      .map(location => (
                        <div key={location.id} className="p-2 border-b last:border-0 text-sm hover:bg-muted/20 flex justify-between items-center">
                          <div>
                            <div className="font-medium">{location.name}</div>
                            <div className="text-xs text-muted-foreground">
                              x: {location.x.toFixed(2)}, y: {location.y.toFixed(2)}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                  
                  <div className="border rounded-md">
                    <div className="p-2 border-b bg-muted/30 text-xs font-medium flex justify-between">
                      <span>Second Floor</span>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                    
                    {sampleLocations
                      .filter(loc => loc.floor === "Second Floor")
                      .map(location => (
                        <div key={location.id} className="p-2 border-b last:border-0 text-sm hover:bg-muted/20 flex justify-between items-center">
                          <div>
                            <div className="font-medium">{location.name}</div>
                            <div className="text-xs text-muted-foreground">
                              x: {location.x.toFixed(2)}, y: {location.y.toFixed(2)}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="steps" className="p-2">
                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium">Path Steps</h4>
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  
                  <div className="border rounded-md">
                    {sampleSteps.map((step, index) => (
                      <div key={step.id} className="relative p-3 border-b last:border-0 text-sm hover:bg-muted/20">
                        {/* Step connector line */}
                        {index < sampleSteps.length - 1 && (
                          <div className="absolute top-10 bottom-0 left-4 w-[1px] bg-muted-foreground/30 z-0"></div>
                        )}
                        
                        <div className="flex items-start relative z-10">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center mr-2 text-white
                            ${step.type === 'start' 
                              ? 'bg-green-500' 
                              : step.type === 'elevator'
                                ? 'bg-blue-500'
                                : 'bg-purple-500'
                            }`}
                          >
                            {step.type === 'start' 
                              ? <MapPin className="h-3 w-3" />
                              : step.type === 'elevator'
                                ? <ArrowRight className="h-3 w-3" />
                                : <Check className="h-3 w-3" />
                            }
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{step.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              x: {step.x.toFixed(2)}, y: {step.y.toFixed(2)}, z: {step.z}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
        
        {/* Toggle button for right panel when hidden */}
        {!showRightPanel && (
          <Button 
            variant="outline" 
            size="icon" 
            className="absolute top-2 right-2 z-10 h-8 w-8"
            onClick={() => setShowRightPanel(true)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
      </div>
      
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