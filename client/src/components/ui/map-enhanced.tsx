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
  LayoutList, Settings, PanelRight, PanelLeft, Hand, ChevronDown, ChevronUp,
  Flag, Target, MapPinOff, CornerUpRight, CornerDownRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

// Define point types for pickup and dropoff locations
export enum MapPointType {
  REGULAR = 'regular',
  PICKUP = 'pickup',
  DROPOFF = 'dropoff',
  WAYPOINT = 'waypoint',
  OBSTACLE = 'obstacle'
}

export interface MapPoint {
  x: number;
  y: number;
  z: number;
  type?: MapPointType;
  name?: string;
  id?: string;
}

export interface MapPath {
  points: MapPoint[];
  status: string;
  name?: string;
  id?: string;
}

export interface MapData {
  grid: any[] | string; // Can be an array of grid values or a base64 string for encoded map
  obstacles: MapPoint[];
  paths: MapPath[];
  waypoints: MapPoint[]; // New: Specific waypoints for navigation
  pickupPoints: MapPoint[]; // New: Dedicated pickup locations
  dropoffPoints: MapPoint[]; // New: Dedicated dropoff locations
  size?: [number, number];
  resolution?: number;
  origin?: [number, number];
  stamp?: number;
  originalData?: any;
  connectionStatus?: string;
  mapId?: string | number; // ID of the current map from the robot
  enhancedVisualization?: boolean; // Whether to use enhanced visualization
  visualTheme?: { // Color theme for map visualization
    obstacles?: string;
    pathways?: string;
    unknown?: string;
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
  availableMaps?: Array<{id: string | number, name: string}>;
  onMapChange?: (mapId: string | number) => void;
}

export function MapEnhanced({ 
  robotStatus, 
  robotPosition, 
  sensorData, 
  mapData, 
  editable = false,
  onMapUpdate,
  availableMaps = [],
  onMapChange
}: MapProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentPoint, setCurrentPoint] = useState<MapPoint | null>(null);
  const [currentPointType, setCurrentPointType] = useState<MapPointType>(MapPointType.WAYPOINT);
  const [currentPathIndex, setCurrentPathIndex] = useState<number>(-1);
  const [editMode, setEditMode] = useState<'obstacles' | 'paths'>('paths');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [pointDialogOpen, setPointDialogOpen] = useState(false);
  const [newPointName, setNewPointName] = useState('');
  const [selectedMapId, setSelectedMapId] = useState<string | number | null>(null);
  
  // Store any local edits
  const [localObstacles, setLocalObstacles] = useState<MapPoint[]>([]);
  const [localPaths, setLocalPaths] = useState<MapPath[]>([]);
  const [localWaypoints, setLocalWaypoints] = useState<MapPoint[]>([]);
  const [localPickupPoints, setLocalPickupPoints] = useState<MapPoint[]>([]);
  const [localDropoffPoints, setLocalDropoffPoints] = useState<MapPoint[]>([]);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  
  // Animation
  const animationRef = useRef<number>();
  const lastRobotPosition = useRef<RobotPosition>(robotPosition);
  const smoothedPosition = useRef<{x: number, y: number, orientation: number}>({
    x: robotPosition.x,
    y: robotPosition.y,
    orientation: robotPosition.orientation
  });
  
  // Initialize local data from map data
  useEffect(() => {
    if (mapData) {
      setLocalObstacles(mapData.obstacles || []);
      setLocalPaths(mapData.paths || []);
      setLocalWaypoints(mapData.waypoints || []);
      setLocalPickupPoints(mapData.pickupPoints || []);
      setLocalDropoffPoints(mapData.dropoffPoints || []);
      setHasLocalChanges(false);
      
      // If map has an ID, set it as selected
      if (mapData.mapId && selectedMapId !== mapData.mapId) {
        setSelectedMapId(mapData.mapId);
      }
    }
  }, [mapData]);

  // Create a continuous animation loop for smooth robot position updates
  useEffect(() => {
    const animate = () => {
      // Update smoothed position with lerp (linear interpolation)
      const lerpFactor = 0.1; // Adjust for smoother or more responsive movement
      
      smoothedPosition.current = {
        x: smoothedPosition.current.x + (robotPosition.x - smoothedPosition.current.x) * lerpFactor,
        y: smoothedPosition.current.y + (robotPosition.y - smoothedPosition.current.y) * lerpFactor,
        orientation: smoothedPosition.current.orientation + 
          (robotPosition.orientation - smoothedPosition.current.orientation) * lerpFactor
      };
      
      // Redraw the map with the smoothed position
      drawMap();
      
      // Continue animation
      animationRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation
    animationRef.current = requestAnimationFrame(animate);
    
    // Store the current position for comparison
    lastRobotPosition.current = robotPosition;
    
    // Clean up animation on unmount
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [robotPosition]);
  
  // Scale adjustment for panning and zooming
  const adjustForPanZoom = useCallback((coordsObj: {x: number, y: number}) => {
    return {
      x: coordsObj.x * zoom + panOffset.x,
      y: coordsObj.y * zoom + panOffset.y
    };
  }, [zoom, panOffset]);

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
      const scale = Math.min(scaleX, scaleY) * zoom; // Apply zoom factor
      
      // Calculate the position to center the map in the canvas
      const offsetX = (canvas.width - worldWidth * scale) / 2 + panOffset.x;
      const offsetY = (canvas.height - worldHeight * scale) / 2 + panOffset.y;
      
      return {
        // From world (robot) coordinates to canvas coordinates
        transformX: (x: number) => {
          // Convert from robot coordinate to pixels
          const relX = x - originX;
          return offsetX + relX * scale;
        },
        transformY: (y: number) => {
          // Convert from robot coordinate to pixels 
          const relY = y - originY;
          // Flip y-axis (robot +y is up, canvas +y is down)
          return canvas.height - (offsetY + relY * scale);
        },
        // From canvas coordinates to world (robot) coordinates
        inverseTransformX: (canvasX: number) => {
          const relX = (canvasX - offsetX) / scale;
          return relX + originX;
        },
        inverseTransformY: (canvasY: number) => {
          // Flip y axis and adjust for scale and offset
          const relY = (canvas.height - canvasY - offsetY) / scale;
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
      ...(mapData.paths || []).flatMap(path => path.points || []),
      ...(mapData.waypoints || []),
      ...(mapData.pickupPoints || []),
      ...(mapData.dropoffPoints || [])
    ];
    
    if (points.length < 2) {
      // Not enough points, center on robot position
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const scale = 20 * zoom; // Apply zoom factor
      
      return {
        // Center the robot and scale nearby points
        transformX: (x: number) => centerX + (x - robotPosition.x) * scale + panOffset.x,
        transformY: (y: number) => centerY - (y - robotPosition.y) * scale + panOffset.y, // Flip y-axis
        inverseTransformX: (canvasX: number) => robotPosition.x + (canvasX - centerX - panOffset.x) / scale,
        inverseTransformY: (canvasY: number) => robotPosition.y - (canvasY - centerY - panOffset.y) / scale, // Flip y-axis
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
    const scale = Math.min(scaleX, scaleY) * zoom; // Apply zoom factor
    
    return {
      transformX: (x: number) => (x - minX + 25) * scale + panOffset.x,
      transformY: (y: number) => canvas.height - (y - minY + 25) * scale + panOffset.y,
      inverseTransformX: (canvasX: number) => (canvasX - panOffset.x) / scale + minX - 25,
      inverseTransformY: (canvasY: number) => (canvas.height - canvasY - panOffset.y) / scale + minY - 25,
      scale
    };
  }, [zoom, panOffset]);

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
    const waypoints = localWaypoints || [];
    const pickupPoints = localPickupPoints || [];
    const dropoffPoints = localDropoffPoints || [];
    
    // Check if we have any map data
    const hasObstacles = obstacles.length > 0;
    const hasPaths = paths.length > 0;
    const hasWaypoints = waypoints.length > 0;
    const hasPickupPoints = pickupPoints.length > 0;
    const hasDropoffPoints = dropoffPoints.length > 0;
    const hasGridData = mapData.grid && 
      ((typeof mapData.grid === 'string' && mapData.grid.length > 0) || 
       (Array.isArray(mapData.grid) && mapData.grid.length > 0));
    const hasMapData = hasObstacles || hasPaths || hasGridData || 
                       hasWaypoints || hasPickupPoints || hasDropoffPoints;
  
    // Draw map background
    ctx.fillStyle = '#e9f7ef';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // If we don't have map data, draw a simple grid and the robot's position
    if (!hasMapData) {
      // Draw a simple grid
      if (showGridLines) {
        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 0.5;
        const gridSize = 20 * zoom;
        
        for (let x = panOffset.x % gridSize; x <= canvas.width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        
        for (let y = panOffset.y % gridSize; y <= canvas.height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
      }
      
      // Draw robot at center of canvas
      const centerX = canvas.width / 2 + panOffset.x;
      const centerY = canvas.height / 2 + panOffset.y;
      
      // Draw robot
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10 * zoom, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw orientation line
      const angle = (smoothedPosition.current.orientation * Math.PI) / 180;
      const orientationLength = 20 * zoom;
      
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
          const imageScale = Math.min(scaleX, scaleY) * 0.9 * zoom; // Apply zoom factor
          
          // Calculate centered position
          const x = (canvas.width - worldWidth * imageScale) / 2 + panOffset.x;
          const y = (canvas.height - worldHeight * imageScale) / 2 + panOffset.y;
          
          // Use a temporary canvas to process the image colors
          try {
            // Create a temporary canvas for image processing
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            
            if (tempCtx) {
              // Draw the original image to the temp canvas
              tempCtx.drawImage(img, 0, 0);
              
              // Get the image data for processing
              const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
              const data = imageData.data;
              
              // Check if we have visual theme data from the server
              console.log("Checking for visual theme data:", mapData.visualTheme);
              const useEnhancedVisualization = mapData.enhancedVisualization === true;
              
              // Get theme colors if available - FORCE STRONGER COLORS
              const obstacleColor = { r: 30, g: 87, b: 255, a: 255 }; // Bright blue for obstacles
              const pathwayColor = { r: 255, g: 255, b: 255, a: 255 }; // Pure white for pathways
              const unknownColor = { r: 220, g: 220, b: 220, a: 180 }; // Light gray for unknown
                
              console.log("USING FORCED COLOR ENHANCEMENT FOR MAP VISUALIZATION");
              console.log("Obstacle color:", obstacleColor);
              console.log("Pathway color:", pathwayColor);
              console.log("Unknown color:", unknownColor);
              
              // Create a completely new image with our desired colors
              let allBlack = true;
              
              // Process each pixel to match the reference image colors
              for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                if (r > 30 || g > 30 || b > 30) {
                  allBlack = false;
                }
                
                // Dark areas (obstacles/walls) to strong blue
                if (r < 128 && g < 128 && b < 128) {
                  data[i] = obstacleColor.r;      // R
                  data[i + 1] = obstacleColor.g;  // G
                  data[i + 2] = obstacleColor.b;  // B
                  data[i + 3] = obstacleColor.a;  // Alpha
                }
                // Gray areas (unknown) to light gray
                else if (r >= 128 && r < 220 && g >= 128 && g < 220 && b >= 128 && b < 220) {
                  data[i] = unknownColor.r;     // R
                  data[i + 1] = unknownColor.g;  // G
                  data[i + 2] = unknownColor.b;  // B
                  data[i + 3] = unknownColor.a;  // Alpha (semi-transparent)
                }
                // White areas (free space) to pure white
                else {
                  data[i] = pathwayColor.r;     // R
                  data[i + 1] = pathwayColor.g;  // G
                  data[i + 2] = pathwayColor.b;  // B
                  data[i + 3] = pathwayColor.a;  // Alpha
                }
              }
              
              // Apply the processed image data
              tempCtx.putImageData(imageData, 0, 0);
              
              // Draw the processed image to the main canvas
              ctx.drawImage(tempCanvas, x, y, worldWidth * imageScale, worldHeight * imageScale);
            } else {
              // Fallback to original image if temp context fails
              ctx.drawImage(img, x, y, worldWidth * imageScale, worldHeight * imageScale);
            }
          } catch (error) {
            console.error('Error processing map image:', error);
            // Fallback to original image if processing fails
            ctx.drawImage(img, x, y, worldWidth * imageScale, worldHeight * imageScale);
          }
          
          // Draw the points, paths, and robot on top
          drawPointsAndPaths();
        };
        
        // Set the source of the image to the base64 data
        img.src = `data:image/png;base64,${mapData.grid}`;
      } 
      // Handle numeric grid data (traditional array)
      else if (Array.isArray(mapData.grid)) {
        const [width, height] = mapData.size;
        const resolution = mapData.resolution;
        
        if (showGridLines) {
          // Draw a light grid for reference
          ctx.strokeStyle = '#ddd';
          ctx.lineWidth = 0.5;
          const gridSpacing = Math.max(20, scale * resolution * 10); // Grid every 1 meter of robot space
          
          // Draw vertical grid lines
          for (let x = 0; x < canvas.width; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }
          
          // Draw horizontal grid lines
          for (let y = 0; y < canvas.height; y += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
          }
        }
        
        // Create a custom colormap for the grid data matching the reference image
        // Use the EXACT same colors as in the forced image processing above
        const colormap = (value: number) => {
          if (value < 0) return 'rgba(30, 87, 255, 1.0)';  // Bright blue for obstacles/walls (occupied)
          if (value > 0) return 'rgba(255, 255, 255, 1.0)';  // Pure white for free space (pathways)
          return 'rgba(220, 220, 220, 0.7)';                 // Light gray for unknown with higher opacity
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
        
        // Draw the points, paths, and robot
        drawPointsAndPaths();
      }
    } else {
      // Draw grid lines for reference
      if (showGridLines) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 0.5;
        const gridSize = 20 * zoom;
        
        for (let x = panOffset.x % gridSize; x <= canvas.width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        
        for (let y = panOffset.y % gridSize; y <= canvas.height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
      }
      
      // Draw the points, paths, and robot
      drawPointsAndPaths();
    }
    
    // Helper function to draw all points, paths, and robot position
    function drawPointsAndPaths() {
      if (!ctx) return;
    
      // Draw obstacles
      ctx.fillStyle = '#f44336';
      obstacles.forEach(obstacle => {
        const x = transformX(obstacle.x);
        const y = transformY(obstacle.y);
        
        ctx.beginPath();
        ctx.arc(x, y, 5 * zoom, 0, Math.PI * 2);
        ctx.fill();
        
        // If editing, highlight the current point
        if (isEditing && currentPoint && 
            obstacle.x === currentPoint.x && 
            obstacle.y === currentPoint.y && 
            obstacle.z === currentPoint.z) {
          ctx.strokeStyle = '#f44336';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 8 * zoom, 0, Math.PI * 2);
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
          
          // Highlight current path being edited
          const isCurrentPath = pathIndex === currentPathIndex;
          
          // Draw the path lines
          ctx.strokeStyle = pathColor;
          ctx.lineWidth = isCurrentPath ? 3 : 2;
          
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
            const radius = pointIndex === 0 ? 6 * zoom : 4 * zoom;
            
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
              ctx.arc(x, y, radius + 3 * zoom, 0, Math.PI * 2);
              ctx.stroke();
            }
            
            // Draw point label if it has a name
            if (point.name) {
              ctx.fillStyle = '#333';
              ctx.font = `${12 * zoom}px Arial`;
              ctx.textAlign = 'center';
              ctx.fillText(point.name, x, y - (radius + 5 * zoom));
            }
          });
          
          // Draw path name if available
          if (path.name) {
            const midPointIndex = Math.floor(path.points.length / 2);
            if (midPointIndex < path.points.length) {
              const midPoint = path.points[midPointIndex];
              const x = transformX(midPoint.x);
              const y = transformY(midPoint.y);
              
              ctx.fillStyle = '#333';
              ctx.font = `${12 * zoom}px Arial`;
              ctx.textAlign = 'center';
              ctx.fillText(path.name, x, y - 15 * zoom);
            }
          }
        }
      });
      
      // Draw waypoints
      waypoints.forEach(waypoint => {
        const x = transformX(waypoint.x);
        const y = transformY(waypoint.y);
        
        // Draw waypoint with unique style
        ctx.fillStyle = '#9c27b0';  // Purple for waypoints
        ctx.beginPath();
        ctx.arc(x, y, 5 * zoom, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw waypoint icon (diamond shape)
        ctx.strokeStyle = '#9c27b0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 7 * zoom);
        ctx.lineTo(x + 7 * zoom, y);
        ctx.lineTo(x, y + 7 * zoom);
        ctx.lineTo(x - 7 * zoom, y);
        ctx.closePath();
        ctx.stroke();
        
        // If editing, highlight the current point
        if (isEditing && currentPoint && 
            waypoint.x === currentPoint.x && 
            waypoint.y === currentPoint.y && 
            waypoint.z === currentPoint.z) {
          ctx.strokeStyle = '#9c27b0';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 10 * zoom, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Draw waypoint label if it has a name
        if (waypoint.name) {
          ctx.fillStyle = '#333';
          ctx.font = `${12 * zoom}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(waypoint.name, x, y - 12 * zoom);
        }
      });
      
      // Draw pickup points
      pickupPoints.forEach(point => {
        const x = transformX(point.x);
        const y = transformY(point.y);
        
        // Draw pickup point with unique style
        ctx.fillStyle = '#2196f3';  // Blue for pickup
        ctx.beginPath();
        ctx.arc(x, y, 6 * zoom, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw pickup icon
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 5 * zoom, y - 5 * zoom);
        ctx.lineTo(x + 5 * zoom, y - 5 * zoom);
        ctx.lineTo(x, y + 5 * zoom);
        ctx.closePath();
        ctx.stroke();
        
        // If editing, highlight the current point
        if (isEditing && currentPoint && 
            point.x === currentPoint.x && 
            point.y === currentPoint.y && 
            point.z === currentPoint.z) {
          ctx.strokeStyle = '#2196f3';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 10 * zoom, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Draw pickup label if it has a name
        if (point.name) {
          ctx.fillStyle = '#333';
          ctx.font = `${12 * zoom}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(point.name, x, y - 12 * zoom);
        }
      });
      
      // Draw dropoff points
      dropoffPoints.forEach(point => {
        const x = transformX(point.x);
        const y = transformY(point.y);
        
        // Draw dropoff point with unique style
        ctx.fillStyle = '#ff9800';  // Orange for dropoff
        ctx.beginPath();
        ctx.arc(x, y, 6 * zoom, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw dropoff icon
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 5 * zoom, y + 5 * zoom);
        ctx.lineTo(x + 5 * zoom, y + 5 * zoom);
        ctx.lineTo(x, y - 5 * zoom);
        ctx.closePath();
        ctx.stroke();
        
        // If editing, highlight the current point
        if (isEditing && currentPoint && 
            point.x === currentPoint.x && 
            point.y === currentPoint.y && 
            point.z === currentPoint.z) {
          ctx.strokeStyle = '#ff9800';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 10 * zoom, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Draw dropoff label if it has a name
        if (point.name) {
          ctx.fillStyle = '#333';
          ctx.font = `${12 * zoom}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(point.name, x, y - 12 * zoom);
        }
      });
    
      // Draw robot position with smooth animation
      const robotX = transformX(smoothedPosition.current.x);
      const robotY = transformY(smoothedPosition.current.y);
      
      // Draw robot footprint/body
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(robotX, robotY, 10 * zoom, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw orientation line
      const angle = (smoothedPosition.current.orientation * Math.PI) / 180;
      const orientationLength = 20 * zoom;
      
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(robotX, robotY);
      ctx.lineTo(
        robotX + Math.cos(angle) * orientationLength,
        robotY - Math.sin(angle) * orientationLength
      );
      ctx.stroke();
      
      // Draw a label for the robot
      ctx.fillStyle = '#333';
      ctx.font = `${12 * zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(robotStatus.serialNumber, robotX, robotY - 15 * zoom);
      
      // Draw scale information and coordinates
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
    
      // Add some labels for the map if available
      if (mapData.size && mapData.resolution && mapData.origin) {
        // Scale bar in the corner showing 1 meter
        const scaleBarLength = 1 / mapData.resolution * scale; // 1 meter in pixels
        const scaleBarX = 30;
        const scaleBarY = canvas.height - 20;
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(scaleBarX, scaleBarY);
        ctx.lineTo(scaleBarX + scaleBarLength, scaleBarY);
        ctx.stroke();
        
        // Scale label
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('1m', scaleBarX + scaleBarLength/2, scaleBarY - 5);
        
        // Robot coordinates
        ctx.textAlign = 'left';
        ctx.fillText(`Robot: (${robotPosition.x.toFixed(2)}, ${robotPosition.y.toFixed(2)})`, 10, 20);
        
        // Only show these when debugging or if explicitly requested
        const showDebugInfo = false; // Set to true to enable debug info
        if (showDebugInfo && ctx) {
          // Map metadata
          const [width, height] = mapData.size;
          const resolution = mapData.resolution;
          const [originX, originY] = mapData.origin;
          
          // These are now safe since we checked ctx is not null
          ctx.fillText(`Resolution: ${resolution.toFixed(3)}m/px`, 10, 40);
          ctx.fillText(`Size: ${width}x${height} px (${(width * resolution).toFixed(1)}x${(height * resolution).toFixed(1)}m)`, 10, 60);
          ctx.fillText(`Origin: ${originX.toFixed(2)}, ${originY.toFixed(2)}`, 10, 80);
        }
      }
    } // End of drawPointsAndPaths
  }, [
    calculateTransforms, 
    robotStatus, 
    robotPosition, 
    mapData, 
    localObstacles, 
    localPaths, 
    localWaypoints,
    localPickupPoints,
    localDropoffPoints,
    currentPoint, 
    currentPathIndex,
    isEditing, 
    zoom, 
    panOffset,
    showGridLines
  ]);

  // Handlers for user interactions
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isEditing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const { inverseTransformX, inverseTransformY } = calculateTransforms(canvas, mapData, robotPosition);
    
    const worldX = inverseTransformX(x);
    const worldY = inverseTransformY(y);
    
    if (editMode === 'obstacles') {
      // Add obstacle at clicked position
      const newObstacle: MapPoint = { x: worldX, y: worldY, z: 0, type: MapPointType.OBSTACLE };
      setLocalObstacles([...localObstacles, newObstacle]);
      setCurrentPoint(newObstacle);
      setHasLocalChanges(true);
    } else if (editMode === 'paths') {
      // If a path is selected and we have a current point type
      if (currentPathIndex >= 0 && currentPathIndex < localPaths.length) {
        // Add point to the current path
        const updatedPaths = [...localPaths];
        const newPoint: MapPoint = { 
          x: worldX, 
          y: worldY, 
          z: 0, 
          type: currentPointType 
        };
        
        updatedPaths[currentPathIndex].points.push(newPoint);
        setLocalPaths(updatedPaths);
        setCurrentPoint(newPoint);
        setHasLocalChanges(true);
        
        // Open dialog to name the point
        setPointDialogOpen(true);
        setNewPointName('');
      } else if (currentPointType === MapPointType.WAYPOINT) {
        // Add a standalone waypoint
        const newWaypoint: MapPoint = { 
          x: worldX, 
          y: worldY, 
          z: 0, 
          type: MapPointType.WAYPOINT 
        };
        setLocalWaypoints([...localWaypoints, newWaypoint]);
        setCurrentPoint(newWaypoint);
        setHasLocalChanges(true);
        
        // Open dialog to name the waypoint
        setPointDialogOpen(true);
        setNewPointName('');
      } else if (currentPointType === MapPointType.PICKUP) {
        // Add a pickup point
        const newPickup: MapPoint = { 
          x: worldX, 
          y: worldY, 
          z: 0, 
          type: MapPointType.PICKUP 
        };
        setLocalPickupPoints([...localPickupPoints, newPickup]);
        setCurrentPoint(newPickup);
        setHasLocalChanges(true);
        
        // Open dialog to name the pickup point
        setPointDialogOpen(true);
        setNewPointName('');
      } else if (currentPointType === MapPointType.DROPOFF) {
        // Add a dropoff point
        const newDropoff: MapPoint = { 
          x: worldX, 
          y: worldY, 
          z: 0, 
          type: MapPointType.DROPOFF 
        };
        setLocalDropoffPoints([...localDropoffPoints, newDropoff]);
        setCurrentPoint(newDropoff);
        setHasLocalChanges(true);
        
        // Open dialog to name the dropoff point
        setPointDialogOpen(true);
        setNewPointName('');
      } else {
        // Create a new path
        const newPath: MapPath = {
          points: [{ x: worldX, y: worldY, z: 0, type: MapPointType.WAYPOINT }],
          status: 'new'
        };
        setLocalPaths([...localPaths, newPath]);
        setCurrentPathIndex(localPaths.length);
        setCurrentPoint(newPath.points[0]);
        setHasLocalChanges(true);
        
        // Open dialog to name the path
        setPointDialogOpen(true);
        setNewPointName('');
      }
    }
    
    // Redraw the map
    drawMap();
  }, [
    isEditing, 
    editMode, 
    calculateTransforms, 
    mapData, 
    robotPosition, 
    localObstacles, 
    localPaths,
    localWaypoints,
    localPickupPoints,
    localDropoffPoints,
    currentPathIndex,
    currentPointType,
    drawMap
  ]);
  
  // Handle pan start
  const handlePanStart = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editable) return;
    
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, [editable]);
  
  // Handle pan move
  const handlePanMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanning) return;
    
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    
    setPanOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    setLastMousePos({ x: e.clientX, y: e.clientY });
  }, [isPanning, lastMousePos]);
  
  // Handle pan end
  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!editable) return;
    
    e.preventDefault();
    
    // Calculate zoom center (mouse position)
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Zoom factor
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    
    // Calculate new zoom
    const newZoom = Math.max(0.1, Math.min(10, zoom * zoomFactor));
    
    // Adjust pan offset to zoom toward/from mouse position
    const newPanOffset = {
      x: mouseX - (mouseX - panOffset.x) * (newZoom / zoom),
      y: mouseY - (mouseY - panOffset.y) * (newZoom / zoom)
    };
    
    setZoom(newZoom);
    setPanOffset(newPanOffset);
  }, [editable, zoom, panOffset]);
  
  // Reset view
  const handleResetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);
  
  // Save edits
  const handleSaveEdits = useCallback(() => {
    if (!onMapUpdate || !hasLocalChanges) return;
    
    const updatedMapData: MapData = {
      ...mapData,
      obstacles: localObstacles,
      paths: localPaths,
      waypoints: localWaypoints,
      pickupPoints: localPickupPoints,
      dropoffPoints: localDropoffPoints
    };
    
    onMapUpdate(updatedMapData);
    setHasLocalChanges(false);
    setIsEditing(false);
    
    toast({
      title: "Map Updated",
      description: "Your map changes have been saved.",
      variant: "default",
    });
  }, [
    mapData, 
    localObstacles, 
    localPaths, 
    localWaypoints,
    localPickupPoints,
    localDropoffPoints,
    onMapUpdate, 
    hasLocalChanges,
    toast
  ]);
  
  // Toggle edit mode
  const handleToggleEdit = useCallback(() => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      // Entering edit mode
      toast({
        title: "Edit Mode Enabled",
        description: "Click on the map to add points or obstacles.",
        variant: "default",
      });
    }
  }, [isEditing, toast]);
  
  // Create new path
  const handleNewPath = useCallback(() => {
    const newPath: MapPath = {
      points: [],
      status: 'new',
      name: `Path ${localPaths.length + 1}`
    };
    
    setLocalPaths([...localPaths, newPath]);
    setCurrentPathIndex(localPaths.length);
    setCurrentPoint(null);
    setHasLocalChanges(true);
  }, [localPaths]);
  
  // Handle point naming confirmation
  const handleNamePoint = useCallback(() => {
    if (!currentPoint) return;
    
    // Update the name based on the point type
    if (currentPathIndex >= 0 && currentPathIndex < localPaths.length) {
      // Update path point
      const updatedPaths = [...localPaths];
      const pointIndex = updatedPaths[currentPathIndex].points.findIndex(
        p => p.x === currentPoint.x && p.y === currentPoint.y && p.z === currentPoint.z
      );
      
      if (pointIndex >= 0) {
        updatedPaths[currentPathIndex].points[pointIndex].name = newPointName;
        
        // If it's the first point and the path doesn't have a name, use this name for the path too
        if (pointIndex === 0 && !updatedPaths[currentPathIndex].name) {
          updatedPaths[currentPathIndex].name = newPointName;
        }
        
        setLocalPaths(updatedPaths);
      }
    } else if (currentPoint.type === MapPointType.WAYPOINT) {
      // Update waypoint
      const updatedWaypoints = [...localWaypoints];
      const index = updatedWaypoints.findIndex(
        p => p.x === currentPoint.x && p.y === currentPoint.y && p.z === currentPoint.z
      );
      
      if (index >= 0) {
        updatedWaypoints[index].name = newPointName;
        setLocalWaypoints(updatedWaypoints);
      }
    } else if (currentPoint.type === MapPointType.PICKUP) {
      // Update pickup point
      const updatedPickups = [...localPickupPoints];
      const index = updatedPickups.findIndex(
        p => p.x === currentPoint.x && p.y === currentPoint.y && p.z === currentPoint.z
      );
      
      if (index >= 0) {
        updatedPickups[index].name = newPointName;
        setLocalPickupPoints(updatedPickups);
      }
    } else if (currentPoint.type === MapPointType.DROPOFF) {
      // Update dropoff point
      const updatedDropoffs = [...localDropoffPoints];
      const index = updatedDropoffs.findIndex(
        p => p.x === currentPoint.x && p.y === currentPoint.y && p.z === currentPoint.z
      );
      
      if (index >= 0) {
        updatedDropoffs[index].name = newPointName;
        setLocalDropoffPoints(updatedDropoffs);
      }
    }
    
    setPointDialogOpen(false);
    setNewPointName('');
    setHasLocalChanges(true);
  }, [
    currentPoint, 
    currentPathIndex, 
    newPointName, 
    localPaths,
    localWaypoints,
    localPickupPoints,
    localDropoffPoints
  ]);
  
  // Handle map selection change
  const handleMapChange = useCallback((mapId: string | number) => {
    setSelectedMapId(mapId);
    if (onMapChange) {
      onMapChange(mapId);
    }
  }, [onMapChange]);

  // Trigger the initial map draw and subsequent redraws
  useEffect(() => {
    drawMap();
  }, [drawMap]);
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 px-1">
        <div className="flex items-center gap-2">
          {availableMaps.length > 0 && (
            <Select
              value={selectedMapId?.toString() || ''}
              onValueChange={(value) => handleMapChange(value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a map" />
              </SelectTrigger>
              <SelectContent>
                {availableMaps.map((map) => (
                  <SelectItem key={map.id} value={map.id.toString()}>
                    {map.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {editable && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleToggleEdit}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle Edit Mode</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {isEditing && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleSaveEdits}
                          disabled={!hasLocalChanges}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Save Changes</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleNewPath}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add New Path</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <Select
                    value={currentPointType}
                    onValueChange={(value) => setCurrentPointType(value as MapPointType)}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Point Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MapPointType.WAYPOINT}>Waypoint</SelectItem>
                      <SelectItem value={MapPointType.PICKUP}>Pickup</SelectItem>
                      <SelectItem value={MapPointType.DROPOFF}>Dropoff</SelectItem>
                      <SelectItem value={MapPointType.OBSTACLE}>Obstacle</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </>
          )}
          
          {/* Map controls */}
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setZoom(prev => Math.min(10, prev * 1.1))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Zoom In</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setZoom(prev => Math.max(0.1, prev * 0.9))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Zoom Out</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleResetView}>
                    <Maximize className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowGridLines(!showGridLines)}
                >
                  <Layers className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showGridLines ? 'Hide Grid' : 'Show Grid'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowRightPanel(!showRightPanel)}
                >
                  {showRightPanel ? <PanelRight className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showRightPanel ? 'Hide Panel' : 'Show Panel'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <div className="flex-1 flex">
        <div className={`flex-1 ${showRightPanel ? 'mr-4' : ''}`}>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-full bg-white rounded-md border"
            onClick={handleCanvasClick}
            onMouseDown={handlePanStart}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            onWheel={handleWheel}
            style={{ cursor: isEditing ? 'crosshair' : isPanning ? 'grabbing' : 'grab' }}
          />
        </div>
        
        {showRightPanel && (
          <div className="w-64 border rounded-md overflow-auto flex flex-col">
            <div className="p-3 border-b bg-muted/20">
              <h3 className="text-lg font-medium mb-2">Map Details</h3>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Robot:</span>{' '}
                  <span className="text-muted-foreground">{robotStatus.serialNumber}</span>
                </div>
                <div>
                  <span className="font-medium">Position:</span>{' '}
                  <span className="text-muted-foreground">
                    ({robotPosition.x.toFixed(2)}, {robotPosition.y.toFixed(2)})
                  </span>
                </div>
                <div>
                  <span className="font-medium">Orientation:</span>{' '}
                  <span className="text-muted-foreground">{robotPosition.orientation.toFixed(1)}°</span>
                </div>
              </div>
            </div>
            
            <Tabs defaultValue="paths" className="flex-1 flex flex-col">
              <TabsList className="px-3 pt-3 justify-start grid grid-cols-3 gap-2 bg-transparent">
                <TabsTrigger value="paths">Paths</TabsTrigger>
                <TabsTrigger value="points">Points</TabsTrigger>
                <TabsTrigger value="layers">Layers</TabsTrigger>
              </TabsList>
              
              <TabsContent value="paths" className="flex-1 overflow-auto p-3 space-y-2">
                {localPaths.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No paths defined yet.
                    {isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 mx-auto"
                        onClick={handleNewPath}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add New Path
                      </Button>
                    )}
                  </div>
                )}
                
                {localPaths.map((path, index) => (
                  <div 
                    key={index}
                    className={`border rounded-md p-2 ${currentPathIndex === index ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => isEditing && setCurrentPathIndex(index)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{path.name || `Path ${index + 1}`}</span>
                      <Badge variant="outline">{path.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {path.points.length} points
                    </div>
                    {path.points.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {path.points.map((point, pointIndex) => (
                          <div 
                            key={pointIndex}
                            className="text-xs flex justify-between"
                          >
                            <span>
                              {point.name || `Point ${pointIndex + 1}`}
                            </span>
                            <span className="text-muted-foreground">
                              ({point.x.toFixed(1)}, {point.y.toFixed(1)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>
              
              <TabsContent value="points" className="flex-1 overflow-auto p-3">
                <div className="space-y-3">
                  {/* Waypoints */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center">
                      <Target className="h-3 w-3 mr-1" />
                      Waypoints
                    </h4>
                    
                    {localWaypoints.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No waypoints defined</div>
                    ) : (
                      <div className="space-y-1">
                        {localWaypoints.map((point, index) => (
                          <div key={index} className="text-xs flex justify-between">
                            <span>{point.name || `Waypoint ${index + 1}`}</span>
                            <span className="text-muted-foreground">
                              ({point.x.toFixed(1)}, {point.y.toFixed(1)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Pickup Points */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center">
                      <CornerUpRight className="h-3 w-3 mr-1" />
                      Pickup Points
                    </h4>
                    
                    {localPickupPoints.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No pickup points defined</div>
                    ) : (
                      <div className="space-y-1">
                        {localPickupPoints.map((point, index) => (
                          <div key={index} className="text-xs flex justify-between">
                            <span>{point.name || `Pickup ${index + 1}`}</span>
                            <span className="text-muted-foreground">
                              ({point.x.toFixed(1)}, {point.y.toFixed(1)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Dropoff Points */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center">
                      <CornerDownRight className="h-3 w-3 mr-1" />
                      Dropoff Points
                    </h4>
                    
                    {localDropoffPoints.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No dropoff points defined</div>
                    ) : (
                      <div className="space-y-1">
                        {localDropoffPoints.map((point, index) => (
                          <div key={index} className="text-xs flex justify-between">
                            <span>{point.name || `Dropoff ${index + 1}`}</span>
                            <span className="text-muted-foreground">
                              ({point.x.toFixed(1)}, {point.y.toFixed(1)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="layers" className="flex-1 overflow-auto p-3">
                <h3 className="text-sm font-medium mb-4">Map Layers</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary"></div>
                    <span className="text-sm">Robot Location</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span className="text-sm">Obstacles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <span className="text-sm">Path</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                    <span className="text-sm">Waypoints</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <span className="text-sm">Pickup Points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                    <span className="text-sm">Dropoff Points</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
      
      {/* Dialog for naming points */}
      <Dialog open={pointDialogOpen} onOpenChange={setPointDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name this point</DialogTitle>
            <DialogDescription>
              Give this point a descriptive name to easily identify it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Point Name</Label>
              <Input
                id="name"
                placeholder="e.g., Front Desk, Loading Area"
                value={newPointName}
                onChange={(e) => setNewPointName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleNamePoint}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}