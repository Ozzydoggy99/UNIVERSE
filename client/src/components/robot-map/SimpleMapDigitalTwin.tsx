import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Point {
  x: number;
  y: number;
}

interface MapData {
  grid: string; // base64 encoded image
  resolution: number; // meters per pixel
  origin: [number, number]; // [x, y] in meters
  size: [number, number]; // [width, height] in pixels
  stamp: number; // timestamp
  visualizationHints?: {
    dataType: string;
    wallColor: string;
    freeSpaceColor: string;
    unknownColor: string;
    enhanceVisualization: boolean;
  };
}

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

interface SimpleMapDigitalTwinProps {
  robotSerial: string;
  mapData?: MapData;
  positionData?: PositionData;
  onRefresh?: () => void;
}

export function SimpleMapDigitalTwin({ 
  robotSerial, 
  mapData, 
  positionData,
  onRefresh 
}: SimpleMapDigitalTwinProps) {
  const [isLoading, setIsLoading] = useState<boolean>(!mapData);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);
  
  // Debug logging for position data
  console.log("Live robot position:", positionData);
  
  // Convert robot position from world coordinates (meters) to pixel coordinates
  const getPositionPixels = () => {
    if (!mapData || !positionData) return { x: 0, y: 0 };
    
    const [originX, originY] = mapData.origin;
    const resolution = mapData.resolution;
    
    // Convert from world coordinates to pixel coordinates
    // World coordinates are in meters relative to the map origin
    // Pixel coordinates are in pixels relative to the top-left of the map image
    const pixelX = (positionData.x - originX) / resolution;
    const pixelY = (originY - positionData.y) / resolution; // Flip Y axis for screen coordinates
        
    console.log("Robot position calculation: ", {
      worldX: positionData.x, 
      worldY: positionData.y,
      pixelX,
      pixelY,
      mapOrigin: mapData.origin,
      resolution
    });
    
    return { x: pixelX, y: pixelY };
  };
  
  // Handle zoom in/out
  const handleZoom = (direction: 'in' | 'out') => {
    setScale(prevScale => {
      const newScale = direction === 'in' 
        ? Math.min(prevScale * 1.2, 5) 
        : Math.max(prevScale / 1.2, 0.5);
      return newScale;
    });
  };

  return (
    <Card className="w-full">
      <CardContent className="relative p-0 overflow-hidden">
        {isLoading ? (
          <div className="h-[500px] flex items-center justify-center bg-gray-100/50">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading map data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="h-[500px] flex items-center justify-center bg-gray-100/50 text-destructive">
            <div className="text-center max-w-md p-4">
              <p className="font-semibold mb-2">Error loading map</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <div className="relative h-[500px]">
            {/* MAP IMAGE */}
            {mapData?.grid ? (
              <img
                src={`data:image/png;base64,${mapData.grid}`}
                alt="Digital Twin Map"
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  imageRendering: "pixelated",
                  transform: `scale(${scale})`,
                  transformOrigin: 'center'
                }}
              />
            ) : (
              <p className="p-4 text-center text-muted-foreground">No map available</p>
            )}

            {/* ROBOT POSITION MARKER */}
            {positionData && mapData?.resolution && (
              <div
                style={{
                  position: "absolute",
                  top: `${getPositionPixels().y}px`,
                  left: `${getPositionPixels().x}px`,
                  width: "20px",
                  height: "20px",
                  backgroundColor: "red",
                  border: "2px solid white",
                  borderRadius: "50%",
                  transform: `translate(-50%, -50%) rotate(${positionData.theta}rad)`,
                  zIndex: 9999,
                  pointerEvents: "none",
                  boxShadow: "0 0 8px 2px rgba(255, 0, 0, 0.7)"
                }}
              >
                {/* Direction indicator */}
                <div 
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: "12px",
                    height: "3px",
                    backgroundColor: "white",
                    transform: "translateY(-50%)",
                    transformOrigin: "0 0"
                  }}
                />
              </div>
            )}
            
            {/* Controls */}
            <div className="absolute bottom-4 right-4 flex gap-2 bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-md border">
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
                onClick={onRefresh}
                title="Refresh Map Data"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Coordinates display */}
            {positionData && (
              <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-md text-xs font-mono border">
                <div>X: {positionData.x.toFixed(3)}m</div>
                <div>Y: {positionData.y.toFixed(3)}m</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}