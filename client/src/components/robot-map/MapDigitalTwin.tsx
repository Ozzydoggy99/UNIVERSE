import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ZoomIn, ZoomOut, Crosshair, MousePointer, Grid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Slider } from "@/components/ui/slider";

type Point = {
  x: number;
  y: number;
};

interface MapDigitalTwinProps {
  robotSerial: string;
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

export const MapDigitalTwin: React.FC<MapDigitalTwinProps> = ({ robotSerial }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [showLidar, setShowLidar] = useState<boolean>(true);
  const [showPath, setShowPath] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showObstacles, setShowObstacles] = useState<boolean>(true);
  const [pointSize, setPointSize] = useState<number>(2);
  
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [lidarData, setLidarData] = useState<LidarData | null>(null);
  const [positionData, setPositionData] = useState<PositionData | null>(null);
  const [positionHistory, setPositionHistory] = useState<PositionData[]>([]);
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
  
  // Get robot data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch map data
        const mapResponse = await fetch(`/api/robots/map/${robotSerial}`);
        if (!mapResponse.ok) throw new Error('Failed to fetch map data');
        const mapJson = await mapResponse.json();
        setMapData(mapJson);
        
        // Fetch LiDAR data
        const lidarResponse = await fetch(`/api/robots/lidar/${robotSerial}?_preferTopic=/scan_matched_points2`);
        if (!lidarResponse.ok) throw new Error('Failed to fetch LiDAR data');
        const lidarJson = await lidarResponse.json();
        setLidarData(lidarJson);
        
        // Fetch position data
        const positionResponse = await fetch(`/api/robots/position/${robotSerial}`);
        if (!positionResponse.ok) throw new Error('Failed to fetch position data');
        const positionJson = await positionResponse.json();
        setPositionData(positionJson);
        
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Set up interval to fetch data regularly
    const intervalId = setInterval(fetchData, 1000);
    
    return () => clearInterval(intervalId);
  }, [robotSerial]);

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
    if (!canvasRef.current || !mapData || !positionData) return;

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
    
    console.log("Creating BOLD map visualization from robot data");
    
    // Calculate map dimensions based on grid data
    const mapImage = new Image();
    mapImage.onload = () => {
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
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.lineWidth = 0.5;
        
        // Draw grid lines for each meter
        const resolution = mapData.resolution;
        const gridSpacingPixels = 1 / resolution; // 1 meter in pixels
        
        // Calculate grid bounds
        const startX = Math.floor(-mapWidthPixels/2);
        const endX = Math.ceil(mapWidthPixels/2);
        const startY = Math.floor(-mapHeightPixels/2);
        const endY = Math.ceil(mapHeightPixels/2);
        
        // Vertical lines
        for (let x = startX; x <= endX; x += gridSpacingPixels) {
          ctx.moveTo(x, startY);
          ctx.lineTo(x, endY);
        }
        
        // Horizontal lines
        for (let y = startY; y <= endY; y += gridSpacingPixels) {
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
        }
        
        ctx.stroke();
      }
      
      // Now draw the map image
      ctx.drawImage(
        mapImage, 
        -mapImage.width / 2, 
        -mapImage.height / 2
      );
      
      // Draw robot position
      if (positionData) {
        // Convert robot coordinates to pixel coordinates using our utility function
        const robotPos = worldToPixel(positionData.x, positionData.y, mapData);
        
        // Calculate position offset from map origin
        const mapOriginX = -mapImage.width / 2;
        const mapOriginY = -mapImage.height / 2;
        
        // Draw robot as a circle with direction indicator
        ctx.beginPath();
        ctx.arc(robotPos.x + mapOriginX, robotPos.y + mapOriginY, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
        
        // Robot footprint - approximation based on real dimensions
        ctx.beginPath();
        ctx.arc(robotPos.x + mapOriginX, robotPos.y + mapOriginY, 18, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw direction indicator
        const theta = positionData.theta;
        ctx.beginPath();
        ctx.moveTo(robotPos.x + mapOriginX, robotPos.y + mapOriginY);
        ctx.lineTo(
          robotPos.x + mapOriginX + 20 * Math.cos(theta),
          robotPos.y + mapOriginY + 20 * Math.sin(theta)
        );
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      // Draw robot path if enabled
      if (showPath && positionHistory.length > 1) {
        const mapOriginX = -mapImage.width / 2;
        const mapOriginY = -mapImage.height / 2;
        
        ctx.beginPath();
        
        // Get the first position
        const firstPos = worldToPixel(positionHistory[0].x, positionHistory[0].y, mapData);
        ctx.moveTo(firstPos.x + mapOriginX, firstPos.y + mapOriginY);
        
        // Draw line through all positions
        for (let i = 1; i < positionHistory.length; i++) {
          const pos = worldToPixel(positionHistory[i].x, positionHistory[i].y, mapData);
          ctx.lineTo(pos.x + mapOriginX, pos.y + mapOriginY);
        }
        
        ctx.strokeStyle = 'rgba(30, 144, 255, 0.8)'; // Dodger blue with some transparency
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw points at each position
        ctx.fillStyle = 'rgba(30, 144, 255, 0.6)';
        positionHistory.forEach((historyPos, index) => {
          // Skip the latest position as it's rendered as the robot
          if (index === positionHistory.length - 1) return;
          
          const pos = worldToPixel(historyPos.x, historyPos.y, mapData);
          ctx.beginPath();
          ctx.arc(
            pos.x + mapOriginX, 
            pos.y + mapOriginY, 
            2, 0, 2 * Math.PI
          );
          ctx.fill();
        });
      }
      
      // Draw LiDAR data if available and enabled
      if (lidarData && showLidar && positionData) {
        // Get the robot position in pixel coordinates
        const robotPos = worldToPixel(positionData.x, positionData.y, mapData);
        const mapOriginX = -mapImage.width / 2;
        const mapOriginY = -mapImage.height / 2;
        
        // Render point cloud data if available
        if (lidarData.points && lidarData.points.length) {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
          lidarData.points.forEach(point => {
            const pointPixel = worldToPixel(point.x, point.y, mapData);
            ctx.beginPath();
            ctx.arc(
              pointPixel.x + mapOriginX, 
              pointPixel.y + mapOriginY, 
              pointSize, 0, 2 * Math.PI
            );
            ctx.fill();
          });
        } 
        // Fall back to range-based rendering if no point cloud
        else if (lidarData.ranges && lidarData.ranges.length) {
          const { ranges, angle_min, angle_increment } = lidarData;
          
          ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
          ranges.forEach((range: number, index: number) => {
            if (range > 0) { // Only draw valid ranges
              const angle = angle_min + index * angle_increment;
              
              // Convert to world coordinates first
              const worldX = positionData.x + range * Math.cos(angle + positionData.theta);
              const worldY = positionData.y + range * Math.sin(angle + positionData.theta);
              
              // Then convert to pixel coordinates
              const pointPixel = worldToPixel(worldX, worldY, mapData);
              
              // Draw point
              ctx.beginPath();
              ctx.arc(
                pointPixel.x + mapOriginX, 
                pointPixel.y + mapOriginY, 
                pointSize, 0, 2 * Math.PI
              );
              ctx.fill();
            }
          });
        }
      }
      
      // Restore context
      ctx.restore();
    };
    
    // Convert base64 map data to image
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
          <div className="p-3 flex justify-between items-center border-b">
            <div className="font-semibold">Robot Digital Twin Map</div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleZoom('in')}
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleZoom('out')}
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={resetView}
                title="Reset View"
              >
                <Crosshair className="h-4 w-4" />
              </Button>
            </div>
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Export is now done via named export above