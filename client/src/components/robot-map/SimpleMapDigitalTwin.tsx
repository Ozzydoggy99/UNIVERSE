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
  
  // Calculate position on map
  const getPositionStyle = () => {
    if (!mapData || !positionData) return {};
    
    const [originX, originY] = mapData.origin;
    const resolution = mapData.resolution;
    
    // Convert from world coordinates to pixel coordinates
    const pixelX = (positionData.x - originX) / resolution;
    const pixelY = (originY - positionData.y) / resolution; // Flip Y axis
    
    // Apply percentage-based positioning to work with responsive design
    const [mapWidth, mapHeight] = mapData.size;
    const percentX = (pixelX / mapWidth) * 100;
    const percentY = (pixelY / mapHeight) * 100;
    
    return {
      left: `${percentX}%`,
      top: `${percentY}%`,
      transform: `translate(-50%, -50%) rotate(${positionData.theta}rad)`
    };
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
      <CardContent className="p-4 relative">
        <div className="relative h-[500px] w-full border rounded-md overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading map data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 text-destructive">
              <div className="text-center max-w-md p-4">
                <p className="font-semibold mb-2">Error loading map</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Direct rendering of map image and robot position */}
              <div className="relative w-full h-full">
                {mapData?.grid ? (
                  <div className="relative w-full h-full" style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
                    <img
                      src={`data:image/png;base64,${mapData.grid}`}
                      alt="Robot Map"
                      className="w-full h-full object-contain"
                      style={{ 
                        imageRendering: 'pixelated'
                      }}
                    />
                    
                    {/* Robot position marker */}
                    {positionData && (
                      <div
                        className="absolute w-5 h-5 bg-red-500 rounded-full shadow-md z-10"
                        style={getPositionStyle()}
                      >
                        {/* Direction indicator */}
                        <div 
                          className="absolute top-1/2 left-1/2 w-4 h-0.5 bg-white"
                          style={{ 
                            transform: 'translateY(-50%)', 
                            transformOrigin: '0 0' 
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p>No map data available</p>
                  </div>
                )}
              </div>
              
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
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}