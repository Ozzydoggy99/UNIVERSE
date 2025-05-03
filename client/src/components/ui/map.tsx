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
  LayoutList, Settings, PanelRight, PanelLeft, Hand, ChevronDown, ChevronUp
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
  // Added for enhanced visualization
  visualizationHints?: {
    dataType?: string;
    wallColor?: string;
    freeSpaceColor?: string;
    unknownColor?: string;
    enhanceVisualization?: boolean;
    mapBounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
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
    
    // Process the map data
    if (hasGridData) {
      // Check if the grid data is a base64 encoded image (from physical robot)
      if (typeof mapData.grid === 'string' && mapData.grid.startsWith('iVBOR')) {
        console.log('Creating enhanced custom map visualization from robot data');
        
        // Draw a stylish background for the map
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw a subtle grid pattern
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 0.5;
        const gridSize = 20 * scale;
        
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
        
        // Create an image element to load the base64 data for analysis
        const img = new Image();
        img.onload = () => {
          if (!ctx) return;
          
          // Once the image is loaded, create a temporary canvas to extract pixel data
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
          if (!tempCtx) return;
          
          // Set dimensions to match the image
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          
          // Draw the image on the temp canvas
          tempCtx.drawImage(img, 0, 0);
          
          // Get the image data to process pixel-by-pixel
          const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
          const data = imageData.data;
          
          // Calculate the scale to fit the map in the canvas
          // while maintaining aspect ratio
          const scaleX = canvas.width / img.width;
          const scaleY = canvas.height / img.height;
          const mapScale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some margin
          
          // Calculate centered position
          const startX = (canvas.width - img.width * mapScale) / 2;
          const startY = (canvas.height - img.height * mapScale) / 2;
          
          // Define wall and space colors with enhanced visibility
          const wallColor = '#1a237e';  // Deep indigo for walls
          const spaceColor = 'rgba(252, 252, 252, 0.7)';  // Almost white for free space
          const unknownColor = 'rgba(200, 200, 200, 0.1)';  // Light gray for unknown
          
          // Process the image data to draw a more visually appealing map
          const cellSize = mapScale * 1.5;  // Slightly larger than pixel scale for better visibility
          
          for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
              const idx = (y * img.width + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];
              
              // Skip transparent pixels
              if (a === 0) continue;
              
              // Determine pixel type based on grayscale value
              // Typically dark pixels (r,g,b close to 0) are walls
              // White pixels (r,g,b close to 255) are free space
              // Gray pixels are unknown areas
              const brightness = (r + g + b) / 3;
              
              if (brightness < 100) {
                // Wall pixel (dark) - draw as a filled rectangle
                ctx.fillStyle = wallColor;
                ctx.fillRect(
                  startX + x * mapScale,
                  startY + y * mapScale,
                  cellSize,
                  cellSize
                );
              } else if (brightness > 200) {
                // Free space pixel (bright) - draw as a lighter rectangle
                ctx.fillStyle = spaceColor;
                ctx.fillRect(
                  startX + x * mapScale,
                  startY + y * mapScale,
                  cellSize,
                  cellSize
                );
              } else {
                // Unknown area (mid-gray) - either skip or draw very lightly
                ctx.fillStyle = unknownColor;
                ctx.fillRect(
                  startX + x * mapScale,
                  startY + y * mapScale,
                  cellSize,
                  cellSize
                );
              }
            }
          }
          
          // Add a border around the map
          ctx.strokeStyle = '#343a40';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            startX - 5, 
            startY - 5, 
            img.width * mapScale + 10, 
            img.height * mapScale + 10
          );
          
          // Add legend with a nice styled box
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillRect(10, 10, 130, 100);
          ctx.strokeStyle = '#343a40';
          ctx.lineWidth = 1;
          ctx.strokeRect(10, 10, 130, 100);
          
          // Add legend text
          ctx.font = 'bold 14px Arial';
          ctx.fillStyle = '#212529';
          ctx.fillText('Map Legend:', 20, 30);
          
          ctx.font = '12px Arial';
          // Wall indicator
          ctx.fillStyle = wallColor;
          ctx.fillRect(20, 40, 15, 15);
          ctx.fillStyle = '#212529';
          ctx.fillText('Walls/Obstacles', 45, 52);
          
          // Free space indicator
          ctx.fillStyle = spaceColor;
          ctx.fillRect(20, 65, 15, 15);
          ctx.fillStyle = '#212529';
          ctx.fillText('Free Space', 45, 77);
          
          // Unknown area indicator
          ctx.fillStyle = unknownColor;
          ctx.fillRect(20, 90, 15, 15);
          ctx.fillStyle = '#212529';
          ctx.fillText('Unknown Area', 45, 102);
          
          // Store map bounds for future reference
          mapData.visualizationHints = {
            ...mapData.visualizationHints,
            mapBounds: {
              x: startX,
              y: startY,
              width: img.width * mapScale,
              height: img.height * mapScale
            }
          };
        };
        
        // Set the source of the image to the base64 data
        img.src = `data:image/png;base64,${mapData.grid}`;
      } 
      // Handle numeric grid data (traditional array)
      else if (Array.isArray(mapData.grid) && mapData.size && mapData.resolution && mapData.origin) {
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
      }
    }
    
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
    
    // Draw robot position if robotPosition data is available
    if (robotPosition && robotPosition.x !== undefined && robotPosition.y !== undefined && robotPosition.orientation !== undefined) {
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
    }
    
    // Draw scale information
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    
    // Add some labels for the map if available
    if (ctx && mapData.size && mapData.resolution && mapData.origin) {
      const [width, height] = mapData.size;
      const resolution = mapData.resolution;
      const [originX, originY] = mapData.origin;
      
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
      queryClient.setQueryData([`/api/robots/map/${robotStatus.serialNumber || ''}`], updatedMap);
      
      // Also send the update to the server
      if (robotStatus.serialNumber) {
        fetch(`/api/robots/map/${robotStatus.serialNumber}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Secret': import.meta.env.VITE_ROBOT_SECRET || ''
          },
          body: JSON.stringify(updatedMap)
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to update map: ${response.status} ${response.statusText}`);
            }
            console.log('Map updated on server');
            setHasLocalChanges(false);
          })
          .catch(err => {
            console.error('Failed to update map on server', err);
          });
      }
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
  
  // State for mobile layout controls
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showTopToolbar, setShowTopToolbar] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);

  // Detect mobile view on component mount and window resize
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
      
      // Auto-hide panels on small screens
      if (window.innerWidth < 768) {
        setShowLeftPanel(false);
        setShowRightPanel(false);
        setShowTopToolbar(false);
      } else {
        setShowLeftPanel(true);
        setShowRightPanel(true);
        setShowTopToolbar(true);
      }
    };

    // Check initially
    checkMobileView();

    // Add resize listener
    window.addEventListener('resize', checkMobileView);
    
    // Clean up
    return () => window.removeEventListener('resize', checkMobileView);
  }, [setShowRightPanel]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#e9f7ef]">
      {/* Top toolbar with business/area selection and actions */}
      {showTopToolbar && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center p-2 bg-white border-b">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            <div className="flex items-center w-full sm:w-auto">
              <span className="text-sm font-medium mr-2 whitespace-nowrap">Business:</span>
              <Select defaultValue="richtech">
                <SelectTrigger className="w-full sm:w-[180px] h-8">
                  <SelectValue placeholder="Select business" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="richtech">Richtech</SelectItem>
                  <SelectItem value="other">Other Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center w-full sm:w-auto">
              <span className="text-sm font-medium mr-2 whitespace-nowrap">Area:</span>
              <Select defaultValue="basement">
                <SelectTrigger className="w-full sm:w-[180px] h-8">
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
          
          <div className="flex-1 hidden sm:block" />
          
          {/* Map action buttons - scrollable on mobile */}
          <div className="flex space-x-1 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto mt-2 sm:mt-0">
            <Button size="sm" variant="secondary" className="shrink-0">
              <Copy className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Copy</span>
            </Button>
            <Button size="sm" variant="secondary" className="shrink-0">
              <Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Create</span>
            </Button>
            <Button size="sm" variant="secondary" className="shrink-0">
              <Cloud className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Cloud Sync</span>
            </Button>
            <Button size="sm" variant="secondary" className="shrink-0">
              <Upload className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Upload</span>
            </Button>
            <Button size="sm" variant="secondary" className="shrink-0">
              <Trash className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Delete</span>
            </Button>
            <Button size="sm" variant="secondary" className="shrink-0">
              <Download className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Export</span>
            </Button>
            <Button size="sm" variant="secondary" className="shrink-0">
              <Upload className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Import</span>
            </Button>
          </div>
        </div>
      )}
      
      {/* Toggle toolbar button when hidden */}
      {!showTopToolbar && (
        <Button 
          variant="outline" 
          size="icon" 
          className="absolute top-2 left-[50%] z-10 h-8 w-8 -translate-x-1/2"
          onClick={() => setShowTopToolbar(true)}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
      
      {/* Main content area with left tools, canvas, and right sidebar */}
      <div className="flex-1 flex">
        {/* Left side tools panel - collapsible on mobile */}
        {showLeftPanel && (
          <div className="bg-white p-2 border-r flex flex-col space-y-4 items-center">
            <TooltipProvider delayDuration={700}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-md sm:hidden mb-2"
                    onClick={() => setShowLeftPanel(false)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Hide Tools
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider delayDuration={700}>
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
            
            <TooltipProvider delayDuration={700}>
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
            
            <TooltipProvider delayDuration={700}>
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
            
            <TooltipProvider delayDuration={700}>
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
            
            <TooltipProvider delayDuration={700}>
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
            
            <TooltipProvider delayDuration={700}>
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
            
            <TooltipProvider delayDuration={700}>
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
            
            <TooltipProvider delayDuration={700}>
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
            
            <TooltipProvider delayDuration={700}>
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
            
            <TooltipProvider delayDuration={700}>
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
        )}
        
        {/* Main map canvas */}
        <div className="flex-1 relative overflow-hidden">
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            className="w-full h-full bg-[#e9f7ef]"
            onClick={handleCanvasClick}
          />
          
          {/* Mobile floating controls */}
          {isMobileView && (
            <div className="absolute top-2 left-2 z-20 flex space-x-2">
              {!showLeftPanel && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="bg-white h-8 w-8 shadow-md"
                  onClick={() => setShowLeftPanel(true)}
                >
                  <PanelRight className="h-4 w-4" />
                </Button>
              )}
              
              {!showTopToolbar && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="bg-white h-8 w-8 shadow-md"
                  onClick={() => setShowTopToolbar(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              
              {showTopToolbar && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="bg-white h-8 w-8 shadow-md"
                  onClick={() => setShowTopToolbar(false)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          
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
            <div className="absolute bottom-4 right-4 md:top-2 md:right-2 md:bottom-auto flex flex-col space-y-2">
              {!isEditing ? (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="bg-white"
                          onClick={() => startEditing('obstacles')}
                        >
                          <MapPin className="h-4 w-4 mr-1" /> <span className={isMobileView ? "hidden" : ""}>Edit Obstacles</span>
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
                          className="bg-white"
                          onClick={() => startEditing('paths')}
                        >
                          <Layers className="h-4 w-4 mr-1" /> <span className={isMobileView ? "hidden" : ""}>Edit Paths</span>
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
                  <Badge variant="outline" className="mb-2 bg-white">
                    Editing {editMode === 'obstacles' ? 'Obstacles' : 'Paths'}
                  </Badge>
                  
                  {editMode === 'paths' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="bg-white"
                      onClick={createNewPath}
                    >
                      <Layers className="h-4 w-4 mr-1" /> <span className={isMobileView ? "hidden" : "New Path"}>New</span>
                    </Button>
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="bg-white"
                    onClick={deleteLastPoint}
                  >
                    <Trash className="h-4 w-4 mr-1" /> <span className={isMobileView ? "hidden" : "Delete Last"}>Delete</span>
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant={hasLocalChanges ? "default" : "outline"}
                    className={!hasLocalChanges ? "bg-white" : ""}
                    onClick={saveMapChanges}
                    disabled={!hasLocalChanges}
                  >
                    <Save className="h-4 w-4 mr-1" /> <span className={isMobileView ? "hidden" : "Save"}>Save</span>
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="bg-white"
                    onClick={resetMap}
                    disabled={!hasLocalChanges}
                  >
                    <AlertCircle className="h-4 w-4 mr-1" /> <span className={isMobileView ? "hidden" : "Reset"}>Reset</span>
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="bg-white"
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
          <div className={`bg-white border-l overflow-auto ${isMobileView ? 'fixed inset-0 z-50 w-full h-full' : 'w-64'}`}>
            <div className="p-2 border-b flex justify-between items-center sticky top-0 bg-white z-10">
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
              <TabsList className="w-full grid grid-cols-2 sticky top-[41px] z-10">
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
        {!showRightPanel && !isMobileView && (
          <Button 
            variant="outline" 
            size="icon" 
            className="absolute top-2 right-2 z-10 h-8 w-8"
            onClick={() => setShowRightPanel(true)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
        
        {/* Mobile floating action button for right panel */}
        {!showRightPanel && isMobileView && (
          <Button 
            variant="outline" 
            size="icon" 
            className="absolute bottom-20 right-4 z-10 h-10 w-10 rounded-full bg-white shadow-md"
            onClick={() => setShowRightPanel(true)}
          >
            <LayoutList className="h-5 w-5" />
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