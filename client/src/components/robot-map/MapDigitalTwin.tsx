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

const MapDigitalTwin: React.FC<MapDigitalTwinProps> = ({ robotSerial }) => {
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // For debug purposes
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
  const [worldCursorPosition, setWorldCursorPosition] = useState<Point | null>(null);
  
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
      ctx.drawImage(
        mapImage, 
        -mapImage.width / 2, 
        -mapImage.height / 2
      );
      
      // Draw robot position
      if (positionData) {
        // Convert robot coordinates to pixel coordinates
        // This conversion depends on the map scale and resolution
        const mapResolution = mapData.resolution || 0.05; // meters per pixel
        const pixelX = positionData.x / mapResolution;
        const pixelY = -positionData.y / mapResolution; // Y is inverted in canvas
        
        // Draw robot as a circle with direction indicator
        ctx.beginPath();
        ctx.arc(pixelX, pixelY, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
        
        // Draw direction indicator
        const theta = positionData.theta;
        ctx.beginPath();
        ctx.moveTo(pixelX, pixelY);
        ctx.lineTo(
          pixelX + 20 * Math.cos(theta),
          pixelY - 20 * Math.sin(theta)
        );
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      // Draw LiDAR data if available and enabled
      if (lidarData && showLidar) {
        const { ranges, angle_min, angle_increment } = lidarData;
        
        // Convert robot coordinates to pixel coordinates
        const mapResolution = mapData.resolution || 0.05; // meters per pixel
        const robotX = positionData.x / mapResolution;
        const robotY = -positionData.y / mapResolution; // Y is inverted in canvas
        
        ctx.beginPath();
        ranges.forEach((range: number, index: number) => {
          if (range > 0) { // Only draw valid ranges
            const angle = angle_min + index * angle_increment;
            // Calculate point position relative to robot
            const x = robotX + (range / mapResolution) * Math.cos(angle + positionData.theta);
            const y = robotY - (range / mapResolution) * Math.sin(angle + positionData.theta);
            
            // Draw point
            ctx.beginPath();
            ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
            ctx.fill();
          }
        });
      }
      
      // Restore context
      ctx.restore();
    };
    
    // Convert base64 map data to image
    mapImage.src = `data:image/png;base64,${mapData.grid}`;
    
  }, [mapData, lidarData, positionData, scale, offset, showLidar, pointSize]);

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
              onMouseMove={handleMouseMove}
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
                    <span className="text-sm">Robot Path</span>
                    <Toggle
                      pressed={showPath}
                      onPressedChange={setShowPath}
                      aria-label="Toggle Path"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Obstacles</span>
                    <Toggle
                      pressed={showObstacles}
                      onPressedChange={setShowObstacles}
                      aria-label="Toggle Obstacles"
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
                <div className="text-sm font-medium mb-2">Map Info</div>
                {positionData && (
                  <div className="space-y-1">
                    <div className="text-xs">
                      Position: X: {positionData.x.toFixed(2)}, Y: {positionData.y.toFixed(2)}
                    </div>
                    <div className="text-xs">
                      Rotation: {(positionData.theta * (180/Math.PI)).toFixed(2)}°
                    </div>
                    {mapData && (
                      <>
                        <div className="text-xs">
                          Map Size: {mapData.width || 'N/A'} x {mapData.height || 'N/A'}
                        </div>
                        <div className="text-xs">
                          Resolution: {mapData.resolution || 'N/A'} m/pixel
                        </div>
                      </>
                    )}
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

export default MapDigitalTwin;