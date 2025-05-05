import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ZoomIn, ZoomOut, Crosshair, MousePointer, Grid, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Slider } from "@/components/ui/slider";

type Point = {
  x: number;
  y: number;
};

interface MapDigitalTwinProps {
  robotSerial: string;
  mapId?: string;
  showControls?: boolean;
  showGridByDefault?: boolean;
  showPathByDefault?: boolean;
}

// Define proper type for map data
interface MapData {
  grid: string; // base64 encoded image
  resolution: number; // meters per pixel
  origin: [number, number]; // [x, y] in meters
  size: [number, number]; // [width, height] in pixels
  stamp: number; // timestamp
  originalData?: any; // original data from robot API
  visualizationHints?: {
    dataType: string;
    wallColor: string;
    freeSpaceColor: string;
    unknownColor: string;
    enhanceVisualization: boolean;
  };
}

// Define proper type for LiDAR data
interface LidarData {
  ranges: number[]; // range measurements in meters
  angle_min: number; // start angle in radians
  angle_max: number; // end angle in radians
  angle_increment: number; // angular distance between measurements in radians
  range_min: number; // minimum range value in meters
  range_max: number; // maximum range value in meters
  points?: {x: number, y: number}[]; // if point cloud data is available
}

// Define proper type for position data
interface PositionData {
  x: number; // meters
  y: number; // meters
  z: number; // meters
  theta: number; // radians
  orientation: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
}

export const MapDigitalTwin: React.FC<MapDigitalTwinProps> = ({ 
  robotSerial, 
  mapId,
  showControls = true,
  showGridByDefault = true,
  showPathByDefault = true
}) => {
  // Updated with enhanced visualization on May 5, 2025
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [showLidar, setShowLidar] = useState<boolean>(true);
  const [showPath, setShowPath] = useState<boolean>(showPathByDefault);
  const [showGrid, setShowGrid] = useState<boolean>(showGridByDefault);
  const [showObstacles, setShowObstacles] = useState<boolean>(true);
  const [pointSize, setPointSize] = useState<number>(2);
  
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [lidarData, setLidarData] = useState<LidarData | null>(null);
  const [positionData, setPositionData] = useState<PositionData | null>(null);
  const [positionHistory, setPositionHistory] = useState<PositionData[]>([]);
  const [pickupPoint, setPickupPoint] = useState<Point | null>(null);
  const [dropoffPoint, setDropoffPoint] = useState<Point | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // For debug purposes
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
  const [worldCursorPosition, setWorldCursorPosition] = useState<Point | null>(null);
  
  // Add position to history when it changes significantly
  useEffect(() => {
    if (!positionData) return;
    
    // Only add position if it's different enough from the last one
    const lastPosition = positionHistory[positionHistory.length - 1];
    if (!lastPosition) {
      setPositionHistory([positionData]);
      return;
    }
    
    // Calculate distance between current position and last recorded position
    const dx = positionData.x - lastPosition.x;
    const dy = positionData.y - lastPosition.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // Only add to history if moved more than 10cm
    if (distance > 0.1) {
      // Limit history to 100 points to avoid performance issues
      setPositionHistory(prev => [...prev.slice(-99), positionData]);
    }
  }, [positionData, positionHistory]);
  
  // State for tracking if we need to sync with robot
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // Function to fetch robot data
  const fetchData = useCallback(async () => {
    try {
      setIsSyncing(true);
      
      // Fetch map data - use mapId if provided
      const mapUrl = mapId 
        ? `/api/robots/map/${robotSerial}?mapId=${mapId}` 
        : `/api/robots/map/${robotSerial}`;
      const mapResponse = await fetch(mapUrl);
      if (!mapResponse.ok) throw new Error('Failed to fetch map data');
      const mapJson = await mapResponse.json();
      setMapData(mapJson);
      
      // Fetch LiDAR data
      const lidarResponse = await fetch(`/api/robots/lidar/${robotSerial}?_preferTopic=/scan_matched_points2&_nocache=${Date.now()}`);
      if (!lidarResponse.ok) throw new Error('Failed to fetch LiDAR data');
      const lidarJson = await lidarResponse.json();
      setLidarData(lidarJson);
      
      // Fetch position data
      const positionResponse = await fetch(`/api/robots/position/${robotSerial}`);
      if (!positionResponse.ok) throw new Error('Failed to fetch position data');
      const positionJson = await positionResponse.json();
      setPositionData(positionJson);
      
      // Fetch active task data to get pickup/dropoff points
      try {
        const taskResponse = await fetch(`/api/robots/active-task/${robotSerial}`);
        if (taskResponse.ok) {
          const taskData = await taskResponse.json();
          
          // If there's an active task with pickup/dropoff coordinates
          if (taskData && taskData.pickup && taskData.pickup.x !== undefined && taskData.pickup.y !== undefined) {
            setPickupPoint({ x: taskData.pickup.x, y: taskData.pickup.y });
          }
          
          if (taskData && taskData.dropoff && taskData.dropoff.x !== undefined && taskData.dropoff.y !== undefined) {
            setDropoffPoint({ x: taskData.dropoff.x, y: taskData.dropoff.y });
          }
        }
      } catch (taskErr) {
        console.warn('Failed to fetch pickup/dropoff points:', taskErr);
        // Don't fail the whole map render if just the task data fails
      }
      
      setLastSyncTime(new Date());
      setIsLoading(false);
      setIsSyncing(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [robotSerial, mapId]);
  
  // Initial data fetch on component mount
  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  // Handle zoom in/out
  const handleZoom = (direction: 'in' | 'out') => {
    setScale(prevScale => {
      const newScale = direction === 'in' 
        ? Math.min(prevScale * 1.2, 5) 
        : Math.max(prevScale / 1.2, 0.5);
      return newScale;
    });
  };

  // Reset view to center
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Function to convert from world (meters) to pixel coordinates
  const worldToPixel = useCallback((worldX: number, worldY: number, mapData: MapData): Point => {
    if (!mapData) return { x: 0, y: 0 };
    
    // Get the map's origin point and resolution
    const [originX, originY] = mapData.origin;
    const resolution = mapData.resolution;
    
    // Calculate the pixel coordinates
    // World coordinates are in meters relative to the map origin
    // Pixel coordinates are in pixels relative to the map image origin
    // x-axis: positive is right, y-axis: positive is down in pixel coordinates
    // x-axis: positive is right, y-axis: positive is up in world coordinates
    
    // Calculate pixels from origin
    const pixelX = (worldX - originX) / resolution;
    const pixelY = (originY - worldY) / resolution; // Flip Y axis
    
    return { x: pixelX, y: pixelY };
  }, []);
  
  // Function to convert from pixel to world coordinates
  const pixelToWorld = useCallback((pixelX: number, pixelY: number, mapData: MapData): Point => {
    if (!mapData) return { x: 0, y: 0 };
    
    // Get the map's origin point and resolution
    const [originX, originY] = mapData.origin;
    const resolution = mapData.resolution;
    
    // Calculate the world coordinates
    const worldX = pixelX * resolution + originX;
    const worldY = originY - pixelY * resolution; // Flip Y axis
    
    return { x: worldX, y: worldY };
  }, []);
  
  // Track mouse position for coordinate debugging
  const handleMouseMoveCoords = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !mapData || !canvasRef.current) return;
    
    const container = containerRef.current;
    const canvas = canvasRef.current;
    
    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursorPosition({ x, y });
    
    // Convert to map coordinates
    const centerX = canvas.width / 2 + offset.x;
    const centerY = canvas.height / 2 + offset.y;
    
    // Reverse the drawing transformations to get map pixel coordinates
    const mapPixelX = (x - centerX) / scale;
    const mapPixelY = (y - centerY) / scale;
    
    // Convert map pixel coordinates to world coordinates
    if (mapData) {
      const worldCoords = pixelToWorld(mapPixelX, mapPixelY, mapData);
      setWorldCursorPosition(worldCoords);
    }
  }, [mapData, offset, scale, pixelToWorld]);
  
  // Draw the map on the canvas
  useEffect(() => {
    if (!canvasRef.current || !mapData) return; // We don't make this depend on positionData

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    // Set canvas size to match container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    console.log("Creating BOLD map visualization from robot data", new Date().toISOString());
    // Force animation by using requestAnimationFrame
    const animate = () => {
      if (canvasRef.current && mapData) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        console.log("Animation frame rendering...");
        // Redraw the canvas
        // We'll just request a new frame to keep the animation loop going
        requestAnimationFrame(animate);
      }
    };
    
    // Start the animation loop regardless of LiDAR data
    // This ensures we show visual effects even when LiDAR data is not available
    console.log("Starting animation loop for enhanced visualization effects...");
    requestAnimationFrame(animate);
    
    // Calculate map dimensions based on grid data
    const mapImage = new Image();
    mapImage.onload = () => {
      console.log("Map image loaded successfully - dimensions:", mapImage.width, "x", mapImage.height);
      
      // Calculate center position
      const centerX = canvas.width / 2 + offset.x;
      const centerY = canvas.height / 2 + offset.y;
      
      // Draw the map
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      
      // Background layer for clarity
      ctx.fillStyle = '#f5f5f5';
      const mapWidthPixels = mapData.size[0];
      const mapHeightPixels = mapData.size[1];
      ctx.fillRect(-mapWidthPixels/2, -mapHeightPixels/2, mapWidthPixels, mapHeightPixels);
      
      // Draw grid if enabled
      if (showGrid) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 100, 200, 0.3)'; // More visible grid color
        ctx.lineWidth = 1;
        
        // Draw grid lines for each meter
        const resolution = mapData.resolution;
        const gridSpacingPixels = 1 / resolution; // 1 meter in pixels
        
        // Ensure gridSpacingPixels is at least 20 pixels for visibility
        const minGridSpacing = 20;
        const effectiveGridSpacing = Math.max(gridSpacingPixels, minGridSpacing);
        
        // Calculate grid bounds with some margin
        const startX = Math.floor(-mapWidthPixels/2) - effectiveGridSpacing;
        const endX = Math.ceil(mapWidthPixels/2) + effectiveGridSpacing;
        const startY = Math.floor(-mapHeightPixels/2) - effectiveGridSpacing;
        const endY = Math.ceil(mapHeightPixels/2) + effectiveGridSpacing;
        
        // Vertical lines (ensure we're using the actual grid spacing)
        for (let x = Math.ceil(startX / effectiveGridSpacing) * effectiveGridSpacing; 
             x <= endX; 
             x += effectiveGridSpacing) {
          ctx.moveTo(x, startY);
          ctx.lineTo(x, endY);
        }
        
        // Horizontal lines
        for (let y = Math.ceil(startY / effectiveGridSpacing) * effectiveGridSpacing; 
             y <= endY; 
             y += effectiveGridSpacing) {
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
        }
        
        ctx.stroke();
        
        // Add meter markings for better understanding
        ctx.fillStyle = 'rgba(0, 100, 200, 0.7)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        // X-axis marks (every 5 meters)
        for (let x = Math.ceil(startX / (effectiveGridSpacing * 5)) * (effectiveGridSpacing * 5); 
             x <= endX; 
             x += effectiveGridSpacing * 5) {
          const worldX = (x / gridSpacingPixels).toFixed(0);
          ctx.fillText(`${worldX}m`, x, 10);
        }
        
        // Y-axis marks (every 5 meters)
        ctx.textAlign = 'right';
        for (let y = Math.ceil(startY / (effectiveGridSpacing * 5)) * (effectiveGridSpacing * 5); 
             y <= endY; 
             y += effectiveGridSpacing * 5) {
          const worldY = (y / gridSpacingPixels).toFixed(0);
          ctx.fillText(`${worldY}m`, -10, y);
        }
      }
      
      // Draw the base map image FIRST (everything else goes ON TOP)
      ctx.drawImage(
        mapImage, 
        -mapImage.width / 2, 
        -mapImage.height / 2
      );
      
      // Draw robot position with accurate footprint
      if (positionData) {
        // Convert robot coordinates to pixel coordinates using our utility function
        const robotPos = worldToPixel(positionData.x, positionData.y, mapData);
        
        // Calculate position offset from map origin
        const mapOriginX = -mapImage.width / 2;
        const mapOriginY = -mapImage.height / 2;
        
        // Robot dimensions in meters - based on actual robot specs
        // The AxBot is roughly 46cm wide and 74cm long
        const robotWidth = 0.46; // meters
        const robotLength = 0.74; // meters
        
        // Convert dimensions to pixels
        const robotWidthPixels = robotWidth / mapData.resolution;
        const robotLengthPixels = robotLength / mapData.resolution;
        
        // Save the current context for transformations
        ctx.save();
        
        // Translate to robot position
        ctx.translate(robotPos.x + mapOriginX, robotPos.y + mapOriginY);
        
        // Rotate to match robot orientation - make it highly visible in a bright color
        // Using full rotation to make angle correct - theta is in radians
        // The Y axis is flipped in canvas coordinates
        ctx.rotate(positionData.theta);
        
        // Draw shadow for 3D effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(
          -robotWidthPixels / 2 + 3, 
          -robotLengthPixels / 2 + 3, 
          robotWidthPixels, 
          robotLengthPixels
        );
        
        // Draw robot body with rounded corners
        const radius = robotWidthPixels / 6; // Rounded corner radius
        
        // Create rounded rectangle path
        ctx.beginPath();
        ctx.moveTo(-robotWidthPixels/2 + radius, -robotLengthPixels/2);
        ctx.lineTo(robotWidthPixels/2 - radius, -robotLengthPixels/2);
        ctx.arcTo(robotWidthPixels/2, -robotLengthPixels/2, robotWidthPixels/2, -robotLengthPixels/2 + radius, radius);
        ctx.lineTo(robotWidthPixels/2, robotLengthPixels/2 - radius);
        ctx.arcTo(robotWidthPixels/2, robotLengthPixels/2, robotWidthPixels/2 - radius, robotLengthPixels/2, radius);
        ctx.lineTo(-robotWidthPixels/2 + radius, robotLengthPixels/2);
        ctx.arcTo(-robotWidthPixels/2, robotLengthPixels/2, -robotWidthPixels/2, robotLengthPixels/2 - radius, radius);
        ctx.lineTo(-robotWidthPixels/2, -robotLengthPixels/2 + radius);
        ctx.arcTo(-robotWidthPixels/2, -robotLengthPixels/2, -robotWidthPixels/2 + radius, -robotLengthPixels/2, radius);
        ctx.closePath();
        
        // Fill robot body with a highly visible gradient
        const gradient = ctx.createLinearGradient(
          -robotWidthPixels/2, 
          -robotLengthPixels/2, 
          robotWidthPixels/2, 
          robotLengthPixels/2
        );
        gradient.addColorStop(0, '#FF4500');  // Orange-red for high visibility
        gradient.addColorStop(0.5, '#FF6347'); // Tomato
        gradient.addColorStop(1, '#FF8C00');  // Dark orange
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Add highlight edge for better contrast against map
        ctx.strokeStyle = '#FFFFFF'; // White border
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Robot outline
        ctx.strokeStyle = '#0F172A'; // Dark blue outline
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw robot details - sensors and lights
        
        // Top sensor dome
        ctx.beginPath();
        ctx.arc(0, -robotLengthPixels/3, robotWidthPixels/6, 0, Math.PI * 2);
        ctx.fillStyle = '#60A5FA'; // Light blue for sensors
        ctx.fill();
        ctx.strokeStyle = '#1E40AF';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Front direction indicator (arrow)
        ctx.beginPath();
        ctx.moveTo(0, -robotLengthPixels/2 - robotWidthPixels/4); // Arrow tip
        ctx.lineTo(-robotWidthPixels/3, -robotLengthPixels/2 - robotWidthPixels/12);
        ctx.lineTo(robotWidthPixels/3, -robotLengthPixels/2 - robotWidthPixels/12);
        ctx.closePath();
        ctx.fillStyle = '#FBBF24'; // Amber yellow
        ctx.fill();
        ctx.strokeStyle = '#D97706'; // Darker amber
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Direction beam
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)'; // Semi-transparent amber
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 4]);
        ctx.moveTo(0, -robotLengthPixels/2 - robotWidthPixels/4);
        ctx.lineTo(0, -robotLengthPixels/2 - robotLengthPixels/2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash
        
        // Position highlight ring
        ctx.beginPath();
        ctx.arc(0, 0, robotWidthPixels/1.8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
        ctx.lineWidth = 6;
        ctx.stroke();
        
        // Center dot (position indicator)
        ctx.beginPath();
        ctx.arc(0, 0, robotWidthPixels/7, 0, Math.PI * 2);
        ctx.fillStyle = '#FBBF24'; // Amber center
        ctx.fill();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Restore context to undo transformations
        ctx.restore();
        
        // Also draw the path from last known positions if enabled
        if (showPath && positionHistory.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 3]); // Dotted line pattern
          
          // Draw lines connecting position history points
          let start = true;
          for (const pos of positionHistory) {
            const pixelPos = worldToPixel(pos.x, pos.y, mapData);
            if (start) {
              ctx.moveTo(pixelPos.x + mapOriginX, pixelPos.y + mapOriginY);
              start = false;
            } else {
              ctx.lineTo(pixelPos.x + mapOriginX, pixelPos.y + mapOriginY);
            }
          }
          
          ctx.stroke();
          ctx.setLineDash([]); // Reset line dash pattern
        }
      }
      
      // Draw robot path if enabled - enhanced with gradient and glow
      if (showPath && positionHistory.length > 1) {
        const mapOriginX = -mapImage.width / 2;
        const mapOriginY = -mapImage.height / 2;
        
        // Create a beautiful gradient for the path with enhanced visual effects
        const startPos = worldToPixel(positionHistory[0].x, positionHistory[0].y, mapData);
        const endPos = worldToPixel(
          positionHistory[positionHistory.length-1].x, 
          positionHistory[positionHistory.length-1].y, 
          mapData
        );
        
        // Draw a glow effect under the path
        ctx.save();
        ctx.shadowColor = 'rgba(255, 100, 50, 0.6)';
        ctx.shadowBlur = 15;
        
        // Create gradient for the path with vibrant colors
        const pathGradient = ctx.createLinearGradient(
          startPos.x + mapOriginX, 
          startPos.y + mapOriginY,
          endPos.x + mapOriginX, 
          endPos.y + mapOriginY
        );
        
        // Use bright, highly visible color gradient for the path
        pathGradient.addColorStop(0, 'rgba(255, 0, 0, 0.9)');     // Bright red (newest)
        pathGradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.9)'); // Orange (middle)
        pathGradient.addColorStop(1, 'rgba(255, 215, 0, 0.9)');   // Gold (oldest)
        
        // First, draw path glow for effect
        ctx.beginPath();
        const firstPos = worldToPixel(positionHistory[0].x, positionHistory[0].y, mapData);
        ctx.moveTo(firstPos.x + mapOriginX, firstPos.y + mapOriginY);
        
        for (let i = 1; i < positionHistory.length; i++) {
          const pos = worldToPixel(positionHistory[i].x, positionHistory[i].y, mapData);
          ctx.lineTo(pos.x + mapOriginX, pos.y + mapOriginY);
        }
        
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.5)'; // Light blue glow
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        // Draw main path with gradient
        ctx.beginPath();
        ctx.moveTo(firstPos.x + mapOriginX, firstPos.y + mapOriginY);
        
        for (let i = 1; i < positionHistory.length; i++) {
          const pos = worldToPixel(positionHistory[i].x, positionHistory[i].y, mapData);
          ctx.lineTo(pos.x + mapOriginX, pos.y + mapOriginY);
        }
        
        ctx.strokeStyle = pathGradient;
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Draw waypoint markers with fading effect
        positionHistory.forEach((historyPos, index) => {
          // Skip the latest position as it's rendered as the robot
          if (index === positionHistory.length - 1) return;
          
          const pos = worldToPixel(historyPos.x, historyPos.y, mapData);
          
          // Calculate marker size and opacity based on position in history
          // Older points are smaller and more transparent
          const opacity = 0.4 + (0.6 * index / positionHistory.length);
          const size = 2 + (3 * index / positionHistory.length);
          
          // Draw point with bright glow effect
          ctx.beginPath();
          ctx.arc(
            pos.x + mapOriginX, 
            pos.y + mapOriginY, 
            size + 3, 0, 2 * Math.PI
          );
          ctx.fillStyle = `rgba(255, 255, 0, ${opacity * 0.5})`;
          ctx.fill();
          
          // Draw main point with enhanced visibility
          ctx.beginPath();
          ctx.arc(
            pos.x + mapOriginX, 
            pos.y + mapOriginY, 
            size, 0, 2 * Math.PI
          );
          // Use a bright color that matches the path gradient
          const pointRed = Math.floor(255 * (1 - index / positionHistory.length));
          const pointGreen = Math.floor(215 * (index / positionHistory.length));
          ctx.fillStyle = `rgba(${pointRed}, ${pointGreen}, 0, ${opacity + 0.2})`;
          ctx.fill();
        });
      }
      
      // Draw LiDAR data if available and enabled - with enhanced visual effects
      // Always render visualization if LiDAR is enabled, even without actual LiDAR data
      if (showLidar && positionData) {
        // Get the robot position in pixel coordinates
        const robotPos = worldToPixel(positionData.x, positionData.y, mapData);
        const mapOriginX = -mapImage.width / 2;
        const mapOriginY = -mapImage.height / 2;
        
        // Draw an advanced scan circle effect around the robot with pulse animation
        const now = Date.now();
        const pulsePhase = (now % 3000) / 3000; // 3-second pulse cycle
        const pulseSize = 50 + Math.sin(pulsePhase * Math.PI * 2) * 10; // Size oscillates between 40-60
        
        // Create animated pulse effect
        ctx.beginPath();
        ctx.arc(
          robotPos.x + mapOriginX,
          robotPos.y + mapOriginY,
          pulseSize, 0, 2 * Math.PI
        );
        
        // Use a high-tech looking gradient with multiple color stops
        const scanGradient = ctx.createRadialGradient(
          robotPos.x + mapOriginX,
          robotPos.y + mapOriginY,
          0,
          robotPos.x + mapOriginX,
          robotPos.y + mapOriginY,
          pulseSize
        );
        
        // Cyan to green gradient for a more futuristic look
        scanGradient.addColorStop(0, 'rgba(0, 255, 225, 0.15)');
        scanGradient.addColorStop(0.4, 'rgba(0, 255, 170, 0.12)');
        scanGradient.addColorStop(0.7, 'rgba(0, 255, 85, 0.07)');
        scanGradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
        
        ctx.fillStyle = scanGradient;
        ctx.fill();
        
        // Add a subtle pulsing circle outline
        ctx.beginPath();
        ctx.arc(
          robotPos.x + mapOriginX,
          robotPos.y + mapOriginY,
          pulseSize, 0, 2 * Math.PI
        );
        ctx.strokeStyle = `rgba(0, 255, 170, ${0.3 + Math.sin(pulsePhase * Math.PI * 2) * 0.2})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Add an animated scanner effect that works even without LiDAR data
        const scannerTime = Date.now() / 1000;
        const scannerAngle = (scannerTime % 4) * Math.PI / 2; // Complete rotation every 4 seconds
        
        // Draw a rotating scanner line
        ctx.beginPath();
        ctx.moveTo(robotPos.x + mapOriginX, robotPos.y + mapOriginY);
        const scannerLength = 100; // Length of scanner beam
        ctx.lineTo(
          robotPos.x + mapOriginX + Math.cos(scannerAngle) * scannerLength,
          robotPos.y + mapOriginY + Math.sin(scannerAngle) * scannerLength
        );
        
        // Create line gradient
        const lineGradient = ctx.createLinearGradient(
          robotPos.x + mapOriginX, 
          robotPos.y + mapOriginY,
          robotPos.x + mapOriginX + Math.cos(scannerAngle) * scannerLength,
          robotPos.y + mapOriginY + Math.sin(scannerAngle) * scannerLength
        );
        lineGradient.addColorStop(0, 'rgba(0, 255, 255, 0.9)');
        lineGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
        
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw scan arc for the current angle
        ctx.beginPath();
        ctx.arc(
          robotPos.x + mapOriginX, 
          robotPos.y + mapOriginY,
          scannerLength * 0.8, 
          scannerAngle - 0.1, 
          scannerAngle + 0.1
        );
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Render point cloud data if available with improved styling
        if (lidarData && lidarData.points && lidarData.points.length) {
          // Draw points with gradient colors based on distance from robot
          lidarData.points.forEach(point => {
            const pointPixel = worldToPixel(point.x, point.y, mapData);
            
            // Calculate distance from robot to point (in pixels)
            const dx = pointPixel.x - robotPos.x;
            const dy = pointPixel.y - robotPos.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Normalize distance to get color gradient
            // Closer points will be more yellow, farther points more green
            const maxDistance = 500; // pixels
            const normalizedDistance = Math.min(distance / maxDistance, 1);
            
            // Create color that transitions from yellow to green
            const r = Math.floor(180 * (1 - normalizedDistance));
            const g = 220;
            const b = Math.floor(20 * normalizedDistance);
            const alpha = 0.7;
            
            // Draw outer glow
            ctx.beginPath();
            ctx.arc(
              pointPixel.x + mapOriginX, 
              pointPixel.y + mapOriginY, 
              pointSize + 2, 0, 2 * Math.PI
            );
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
            ctx.fill();
            
            // Draw main point
            ctx.beginPath();
            ctx.arc(
              pointPixel.x + mapOriginX, 
              pointPixel.y + mapOriginY, 
              pointSize, 0, 2 * Math.PI
            );
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fill();
          });
        } 
        // Fall back to range-based rendering if no point cloud - with improved styling
        else if (lidarData && lidarData.ranges && lidarData.ranges.length) {
          const { ranges, angle_min, angle_increment } = lidarData;
          
          // First, draw connecting lines to create a "radar sweep" effect
          if (ranges.length > 10) {
            ctx.beginPath();
            let firstValid = true;
            
            ranges.forEach((range: number, index: number) => {
              if (range > 0) {
                const angle = angle_min + index * angle_increment;
                
                // Convert to world coordinates first
                const worldX = positionData.x + range * Math.cos(angle + positionData.theta);
                const worldY = positionData.y + range * Math.sin(angle + positionData.theta);
                
                // Then convert to pixel coordinates
                const pointPixel = worldToPixel(worldX, worldY, mapData);
                
                if (firstValid) {
                  ctx.moveTo(pointPixel.x + mapOriginX, pointPixel.y + mapOriginY);
                  firstValid = false;
                } else {
                  ctx.lineTo(pointPixel.x + mapOriginX, pointPixel.y + mapOriginY);
                }
              }
            });
            
            // Close path back to first point to create filled polygon
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          
          // Then draw individual points with distance-based coloring
          ranges.forEach((range: number, index: number) => {
            if (range > 0) { // Only draw valid ranges
              const angle = angle_min + index * angle_increment;
              
              // Convert to world coordinates first
              const worldX = positionData.x + range * Math.cos(angle + positionData.theta);
              const worldY = positionData.y + range * Math.sin(angle + positionData.theta);
              
              // Then convert to pixel coordinates
              const pointPixel = worldToPixel(worldX, worldY, mapData);
              
              // Use distance to adjust color (normalize to 0-1 range)
              const normalizedRange = Math.min(range / 10, 1); // 10 meters as max for color scaling
              
              // Create color that transitions from yellow to green
              const r = Math.floor(180 * (1 - normalizedRange));
              const g = 220;
              const b = Math.floor(20 * normalizedRange);
              
              // Draw point with glow
              ctx.beginPath();
              ctx.arc(
                pointPixel.x + mapOriginX, 
                pointPixel.y + mapOriginY, 
                pointSize + 1, 0, 2 * Math.PI
              );
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
              ctx.fill();
              
              // Draw main point
              ctx.beginPath();
              ctx.arc(
                pointPixel.x + mapOriginX, 
                pointPixel.y + mapOriginY, 
                pointSize, 0, 2 * Math.PI
              );
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
              ctx.fill();
            }
          });
        }
      }
      
      // Draw pickup and dropoff points
      if (pickupPoint || dropoffPoint) {
        const mapOriginX = -mapImage.width / 2;
        const mapOriginY = -mapImage.height / 2;
        
        // Draw pickup point with animated pulse effect
        if (pickupPoint) {
          const pickupPos = worldToPixel(pickupPoint.x, pickupPoint.y, mapData);
          
          // Create animated pulse for pickup
          const now = Date.now();
          const pulsePhase = (now % 2000) / 2000; // 2-second pulse cycle
          const pulseSize = 12 + Math.sin(pulsePhase * Math.PI * 2) * 4; // Size oscillates between 8-16
          
          // Draw outer glow for pickup
          ctx.beginPath();
          ctx.arc(
            pickupPos.x + mapOriginX, 
            pickupPos.y + mapOriginY, 
            pulseSize + 6, 0, 2 * Math.PI
          );
          ctx.fillStyle = `rgba(0, 200, 0, ${0.2 + Math.sin(pulsePhase * Math.PI * 2) * 0.1})`;
          ctx.fill();
          
          // Draw pickup circle
          ctx.beginPath();
          ctx.arc(
            pickupPos.x + mapOriginX, 
            pickupPos.y + mapOriginY, 
            pulseSize, 0, 2 * Math.PI
          );
          ctx.fillStyle = "rgba(0, 200, 0, 0.7)";
          ctx.fill();
          
          // Draw pickup icon
          ctx.fillStyle = "#fff";
          ctx.font = "bold 14px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("P", pickupPos.x + mapOriginX, pickupPos.y + mapOriginY);
          
          // Add label
          ctx.fillStyle = "#000";
          ctx.font = "12px Arial";
          ctx.fillText("Pickup", pickupPos.x + mapOriginX, pickupPos.y + mapOriginY + 20);
        }
        
        // Draw dropoff point with animated pulse effect
        if (dropoffPoint) {
          const dropoffPos = worldToPixel(dropoffPoint.x, dropoffPoint.y, mapData);
          
          // Slightly offset pulse phase for dropoff
          const now = Date.now();
          const pulsePhase = ((now + 1000) % 2000) / 2000; // Offset by 1 second
          const pulseSize = 12 + Math.sin(pulsePhase * Math.PI * 2) * 4;
          
          // Draw outer glow for dropoff
          ctx.beginPath();
          ctx.arc(
            dropoffPos.x + mapOriginX, 
            dropoffPos.y + mapOriginY, 
            pulseSize + 6, 0, 2 * Math.PI
          );
          ctx.fillStyle = `rgba(0, 100, 200, ${0.2 + Math.sin(pulsePhase * Math.PI * 2) * 0.1})`;
          ctx.fill();
          
          // Draw dropoff circle
          ctx.beginPath();
          ctx.arc(
            dropoffPos.x + mapOriginX, 
            dropoffPos.y + mapOriginY, 
            pulseSize, 0, 2 * Math.PI
          );
          ctx.fillStyle = "rgba(0, 100, 200, 0.7)";
          ctx.fill();
          
          // Draw dropoff icon
          ctx.fillStyle = "#fff";
          ctx.font = "bold 14px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("D", dropoffPos.x + mapOriginX, dropoffPos.y + mapOriginY);
          
          // Add label
          ctx.fillStyle = "#000";
          ctx.font = "12px Arial";
          ctx.fillText("Dropoff", dropoffPos.x + mapOriginX, dropoffPos.y + mapOriginY + 20);
        }
        
        // If both pickup and dropoff points exist, draw a path between them
        if (pickupPoint && dropoffPoint) {
          const pickupPos = worldToPixel(pickupPoint.x, pickupPoint.y, mapData);
          const dropoffPos = worldToPixel(dropoffPoint.x, dropoffPoint.y, mapData);
          
          // Create gradient path
          const pathGradient = ctx.createLinearGradient(
            pickupPos.x + mapOriginX,
            pickupPos.y + mapOriginY,
            dropoffPos.x + mapOriginX,
            dropoffPos.y + mapOriginY
          );
          
          pathGradient.addColorStop(0, "rgba(0, 200, 0, 0.6)");   // Green at pickup
          pathGradient.addColorStop(1, "rgba(0, 100, 200, 0.6)"); // Blue at dropoff
          
          // Draw path with dashed line
          ctx.beginPath();
          ctx.moveTo(pickupPos.x + mapOriginX, pickupPos.y + mapOriginY);
          ctx.lineTo(dropoffPos.x + mapOriginX, dropoffPos.y + mapOriginY);
          ctx.setLineDash([8, 4]); // Dashed line
          ctx.strokeStyle = pathGradient;
          ctx.lineWidth = 3;
          ctx.stroke();
          
          // Reset dash pattern
          ctx.setLineDash([]);
        }
      }
      
      // Restore context
      ctx.restore();
    };
    
    // Convert base64 map data to image
    // Add error handling for the image
    mapImage.onerror = (err) => {
      console.error("Error loading map image:", err);
      console.log("Map data received:", { 
        gridLength: mapData.grid?.length, 
        gridType: typeof mapData.grid,
        gridPrefix: mapData.grid?.substring(0, 50) + '...' 
      });
    };
    
    console.log("Setting map image source with data length:", mapData.grid?.length);
    mapImage.src = `data:image/png;base64,${mapData.grid}`;
    
  }, [mapData, lidarData, positionData, positionHistory, scale, offset, showLidar, showGrid, showPath, pointSize, worldToPixel]);

  // Apply cursor style based on drag state
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = isDragging ? 'grabbing' : 'grab';
    }
  }, [isDragging]);

  if (isLoading) {
    return (
      <Card className="w-full h-[500px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="ml-2">Loading map data...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-[500px] flex items-center justify-center">
        <div className="text-destructive">Error loading map data: {error.message}</div>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-0">
        <div className="flex flex-col">
          <div className="p-3 flex justify-between items-center border-b bg-slate-100">
            <div className="font-semibold text-blue-600">Enhanced Robot Digital Twin Map</div>
            {showControls && (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleZoom('in')}
                  title="Zoom In"
                  className="bg-blue-50 hover:bg-blue-100"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleZoom('out')}
                  title="Zoom Out"
                  className="bg-blue-50 hover:bg-blue-100"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={resetView}
                  title="Reset View"
                  className="bg-blue-50 hover:bg-blue-100"
                >
                  <Crosshair className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchData}
                  title="Sync with Robot"
                  className={`bg-blue-50 hover:bg-blue-100 ${isSyncing ? "opacity-50" : ""}`}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex">
            <div
              ref={containerRef}
              className="relative w-full h-[500px] overflow-hidden"
              onMouseDown={handleMouseDown}
              onMouseMove={(e) => {
                handleMouseMove(e);
                handleMouseMoveCoords(e);
              }}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
              
              {!mapData && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <p>No map data available</p>
                </div>
              )}
            </div>
            
            {showControls && (
              <div className="w-64 border-l p-3 flex flex-col space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Map Layers</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">LiDAR Points</span>
                    <Toggle
                      pressed={showLidar}
                      onPressedChange={setShowLidar}
                      aria-label="Toggle LiDAR"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Meter Grid</span>
                    <Toggle
                      pressed={showGrid}
                      onPressedChange={setShowGrid}
                      aria-label="Toggle Grid"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Robot Path</span>
                    <Toggle
                      pressed={showPath}
                      onPressedChange={setShowPath}
                      aria-label="Toggle Path"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">LiDAR Point Size</div>
                <Slider 
                  value={[pointSize]} 
                  min={1} 
                  max={5} 
                  step={0.5} 
                  onValueChange={(value) => setPointSize(value[0])} 
                />
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">Position Info</div>
                {positionData && (
                  <div className="space-y-1">
                    <div className="text-xs">
                      Robot: X: {positionData.x.toFixed(2)}, Y: {positionData.y.toFixed(2)}
                    </div>
                    <div className="text-xs">
                      Rotation: {(positionData.theta * (180/Math.PI)).toFixed(2)}°
                    </div>
                    {worldCursorPosition && (
                      <>
                        <div className="text-xs mt-2">
                          Cursor: X: {worldCursorPosition.x.toFixed(2)}, Y: {worldCursorPosition.y.toFixed(2)}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">Map Info</div>
                {mapData && (
                  <div className="space-y-1">
                    <div className="text-xs">
                      Size: {mapData.size[0]} x {mapData.size[1]} px
                    </div>
                    <div className="text-xs">
                      Resolution: {mapData.resolution.toFixed(3)} m/px
                    </div>
                    <div className="text-xs">
                      Origin: {mapData.origin[0].toFixed(2)}, {mapData.origin[1].toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Export is now done via named export above