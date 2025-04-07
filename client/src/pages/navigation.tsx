import { ConnectionStatus } from "@/components/status/connection-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapVisualization } from "@/components/ui/map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RobotLocationCard } from "@/components/robot/location-card";
import { useRobot } from "@/providers/robot-provider";
import { useState } from "react";
import { sendCustomCommand } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Navigation as NavigationIcon, RotateCcw, Save, Upload, Download } from "lucide-react";

export default function Navigation() {
  const { robotPosition } = useRobot();
  const { toast } = useToast();
  
  const [targetX, setTargetX] = useState("");
  const [targetY, setTargetY] = useState("");
  const [targetZ, setTargetZ] = useState("0");
  
  const [waypointName, setWaypointName] = useState("");
  const [waypoints, setWaypoints] = useState<{name: string, x: number, y: number, z: number}[]>([
    { name: "Home Base", x: 0, y: 0, z: 0 },
    { name: "Charging Station", x: 45, y: 30, z: 0 },
    { name: "Work Area A", x: 23.5, y: 42.1, z: 0.3 }
  ]);

  const handleNavigateTo = () => {
    if (!targetX || !targetY) {
      toast({
        title: "Missing Coordinates",
        description: "Please provide X and Y coordinates",
        variant: "destructive",
      });
      return;
    }

    const x = parseFloat(targetX);
    const y = parseFloat(targetY);
    const z = parseFloat(targetZ || "0");

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      toast({
        title: "Invalid Coordinates",
        description: "Coordinates must be valid numbers",
        variant: "destructive",
      });
      return;
    }

    // In a real app, this would call the API to navigate to the coordinates
    const command = `navigate ${x} ${y} ${z}`;
    toast({
      title: "Navigation Started",
      description: `Navigating to coordinates (${x}, ${y}, ${z})`,
    });
    
    sendCustomCommand(command).catch(error => {
      toast({
        title: "Navigation Failed",
        description: error instanceof Error ? error.message : "Failed to navigate to coordinates",
        variant: "destructive",
      });
    });
  };

  const handleSaveWaypoint = () => {
    if (!waypointName || !robotPosition) {
      toast({
        title: "Cannot Save Waypoint",
        description: waypointName ? "Robot position unavailable" : "Please provide a waypoint name",
        variant: "destructive",
      });
      return;
    }

    const newWaypoint = {
      name: waypointName,
      x: robotPosition.x,
      y: robotPosition.y,
      z: robotPosition.z
    };

    setWaypoints([...waypoints, newWaypoint]);
    setWaypointName("");
    
    toast({
      title: "Waypoint Saved",
      description: `Saved current position as "${waypointName}"`,
    });
  };

  const handleNavigateToWaypoint = (waypoint: {name: string, x: number, y: number, z: number}) => {
    setTargetX(waypoint.x.toString());
    setTargetY(waypoint.y.toString());
    setTargetZ(waypoint.z.toString());
    
    // Automatically navigate to the waypoint
    const command = `navigate ${waypoint.x} ${waypoint.y} ${waypoint.z}`;
    toast({
      title: "Navigation Started",
      description: `Navigating to waypoint "${waypoint.name}"`,
    });
    
    sendCustomCommand(command).catch(error => {
      toast({
        title: "Navigation Failed",
        description: error instanceof Error ? error.message : "Failed to navigate to waypoint",
        variant: "destructive",
      });
    });
  };

  return (
    <>
      <ConnectionStatus />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <RobotLocationCard />
        
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Navigation Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-3">Navigate to Coordinates</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <Label htmlFor="target-x">X Coordinate</Label>
                    <Input 
                      id="target-x" 
                      value={targetX} 
                      onChange={(e) => setTargetX(e.target.value)}
                      placeholder="X"
                    />
                  </div>
                  <div>
                    <Label htmlFor="target-y">Y Coordinate</Label>
                    <Input 
                      id="target-y" 
                      value={targetY} 
                      onChange={(e) => setTargetY(e.target.value)}
                      placeholder="Y"
                    />
                  </div>
                  <div>
                    <Label htmlFor="target-z">Z Coordinate</Label>
                    <Input 
                      id="target-z" 
                      value={targetZ} 
                      onChange={(e) => setTargetZ(e.target.value)}
                      placeholder="Z (optional)"
                    />
                  </div>
                </div>
                <Button onClick={handleNavigateTo} className="w-full">
                  <NavigationIcon className="h-4 w-4 mr-2" />
                  Navigate to Coordinates
                </Button>
              </div>
              
              <div>
                <h3 className="font-medium mb-3">Save Current Position</h3>
                <div className="flex space-x-2 mb-3">
                  <div className="flex-1">
                    <Label htmlFor="waypoint-name">Waypoint Name</Label>
                    <Input 
                      id="waypoint-name" 
                      value={waypointName} 
                      onChange={(e) => setWaypointName(e.target.value)}
                      placeholder="Enter waypoint name"
                    />
                  </div>
                  <div className="pt-7">
                    <Button onClick={handleSaveWaypoint}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button variant="outline" className="flex-1">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Waypoints
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Export Waypoints
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="font-medium mb-3">Saved Waypoints</h3>
              <div className="border rounded-md overflow-hidden">
                <div className="grid grid-cols-4 gap-4 p-3 bg-muted font-medium text-sm">
                  <div>Name</div>
                  <div>X</div>
                  <div>Y</div>
                  <div>Action</div>
                </div>
                <div className="divide-y">
                  {waypoints.map((waypoint, index) => (
                    <div key={index} className="grid grid-cols-4 gap-4 p-3 items-center">
                      <div>{waypoint.name}</div>
                      <div>{waypoint.x.toFixed(1)}</div>
                      <div>{waypoint.y.toFixed(1)}</div>
                      <div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleNavigateToWaypoint(waypoint)}
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Navigate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <MapVisualization className="w-full" />
    </>
  );
}
