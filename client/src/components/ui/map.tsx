import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RobotPosition } from "@/types/robot";
import { useRobot } from "@/providers/robot-provider";
import { refreshAllData } from "@/lib/api";
import { ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ZoomInIcon, ZoomOutIcon, FocusIcon, RefreshCwIcon } from "lucide-react";

interface MapVisualizationProps {
  className?: string;
}

export function MapVisualization({ className }: MapVisualizationProps) {
  const { robotPosition, setRobotData } = useRobot();
  const [zoom, setZoom] = useState(1);
  const [showPath, setShowPath] = useState(true);
  const [showObstacles, setShowObstacles] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);

  // Robot position as state for visualization
  const [robotMarkerStyle, setRobotMarkerStyle] = useState({
    top: "45%",
    left: "25%",
  });

  // Update robot marker position when robot position changes
  useEffect(() => {
    if (robotPosition) {
      // Convert coordinates to percentage based on map container size
      // This is simplified; in a real app, you'd have proper coordinate mapping
      setRobotMarkerStyle({
        top: `${45 - (robotPosition.y / 100) * 20}%`,
        left: `${25 + (robotPosition.x / 100) * 35}%`,
      });
    }
  }, [robotPosition]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleCenterMap = () => {
    if (robotPosition && mapRef.current) {
      // Logic to center the map on the robot
      // In a real implementation, this would adjust the map's viewbox or scroll position
    }
  };

  const handleRefreshMap = async () => {
    try {
      const [status, position, sensorData, mapData] = await refreshAllData();
      setRobotData(status, position, sensorData, mapData);
    } catch (error) {
      console.error("Failed to refresh map data:", error);
    }
  };

  // Calculate distance to target
  const distanceToTarget = robotPosition?.destination 
    ? Math.sqrt(
        Math.pow(robotPosition.destination.x - robotPosition.x, 2) +
        Math.pow(robotPosition.destination.y - robotPosition.y, 2) +
        Math.pow(robotPosition.destination.z - robotPosition.z, 2)
      ).toFixed(1) + 'm' 
    : 'N/A';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Map & Position</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          ref={mapRef}
          className="map-container w-full h-80 bg-neutral-light border border-border rounded-md overflow-hidden"
          style={{ 
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`, 
            backgroundImage: "linear-gradient(to right, hsl(var(--muted)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--muted)) 1px, transparent 1px)",
            position: "relative"
          }}
        >
          {/* Robot Position Marker */}
          <div 
            className="robot-marker absolute" 
            style={{ 
              top: robotMarkerStyle.top, 
              left: robotMarkerStyle.left,
              transform: `scale(${zoom})`
            }}
          >
            <div className="w-4 h-4 bg-primary rounded-full"></div>
            <div className="absolute top-0 left-0 w-4 h-4 bg-primary rounded-full animate-ping opacity-25"></div>
            <div className="absolute -top-6 -left-8 bg-background text-xs p-1 rounded shadow font-mono">
              {robotPosition ? `X: ${robotPosition.x.toFixed(1)}, Y: ${robotPosition.y.toFixed(1)}` : 'Loading...'}
            </div>
          </div>
          
          {/* Destination Marker */}
          {robotPosition?.destination && (
            <div 
              className="absolute" 
              style={{ 
                top: "25%", 
                left: "60%",
                transform: `scale(${zoom})`
              }}
            >
              <div className="w-4 h-4 border-2 border-accent rounded-full"></div>
              <div className="absolute -top-6 -left-8 bg-background text-xs p-1 rounded shadow font-mono">
                X: {robotPosition.destination.x.toFixed(1)}, Y: {robotPosition.destination.y.toFixed(1)}
              </div>
            </div>
          )}
          
          {/* Path Line */}
          {showPath && (
            <svg className="absolute top-0 left-0 w-full h-full" style={{ zIndex: -1 }}>
              <path 
                d="M 25% 45% L 40% 35% L 60% 25%" 
                stroke="hsl(var(--accent))" 
                strokeWidth="2" 
                strokeDasharray="5,5" 
                fill="none" 
              />
            </svg>
          )}
          
          {/* Obstacles (Example) */}
          {showObstacles && (
            <div 
              className="absolute" 
              style={{ 
                top: "35%", 
                left: "40%", 
                width: `${30 * zoom}px`, 
                height: `${30 * zoom}px`, 
                backgroundColor: "rgba(244, 67, 54, 0.3)", 
                border: "1px solid rgba(244, 67, 54, 0.7)", 
                borderRadius: "3px"
              }}
            ></div>
          )}
        </div>
        
        <div className="mt-4 flex flex-wrap justify-between">
          {/* Map Controls */}
          <div className="flex space-x-2 mb-2">
            <Button variant="secondary" size="sm" onClick={handleZoomIn}>
              <ZoomInIcon className="h-4 w-4 mr-1" />
              Zoom In
            </Button>
            <Button variant="secondary" size="sm" onClick={handleZoomOut}>
              <ZoomOutIcon className="h-4 w-4 mr-1" />
              Zoom Out
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCenterMap}>
              <FocusIcon className="h-4 w-4 mr-1" />
              Center
            </Button>
          </div>
          
          {/* Map Options */}
          <div className="flex items-center space-x-4 mb-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="show-path" 
                checked={showPath} 
                onCheckedChange={(checked) => setShowPath(checked as boolean)}
              />
              <Label htmlFor="show-path" className="text-sm">Show Path</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="show-obstacles"
                checked={showObstacles}
                onCheckedChange={(checked) => setShowObstacles(checked as boolean)}
              />
              <Label htmlFor="show-obstacles" className="text-sm">Show Obstacles</Label>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefreshMap} className="text-primary hover:text-primary-dark">
              <RefreshCwIcon className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Coordinates Display */}
        <div className="mt-3 p-2 bg-secondary bg-opacity-10 rounded-md">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center">
              <span className="text-muted-foreground">Current:</span>
              <span className="ml-1 font-mono">
                {robotPosition 
                  ? `X: ${robotPosition.x.toFixed(1)}, Y: ${robotPosition.y.toFixed(1)}, Z: ${robotPosition.z.toFixed(1)}` 
                  : 'Loading...'}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-muted-foreground">Target:</span>
              <span className="ml-1 font-mono">
                {robotPosition?.destination 
                  ? `X: ${robotPosition.destination.x.toFixed(1)}, Y: ${robotPosition.destination.y.toFixed(1)}, Z: ${robotPosition.destination.z.toFixed(1)}` 
                  : 'N/A'}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-muted-foreground">Distance:</span>
              <span className="ml-1 font-mono">{distanceToTarget}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
