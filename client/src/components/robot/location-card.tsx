import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRobot } from "@/providers/robot-provider";

export function RobotLocationCard() {
  const { robotPosition } = useRobot();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location & Movement</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Current Position:</span>
            <span className="font-mono text-sm">
              {robotPosition 
                ? `X: ${robotPosition.x.toFixed(1)}, Y: ${robotPosition.y.toFixed(1)}, Z: ${robotPosition.z.toFixed(1)}` 
                : "Unknown"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Orientation:</span>
            <span className="font-mono text-sm">
              {robotPosition?.orientation !== undefined 
                ? `${robotPosition.orientation.toFixed(1)}°` 
                : "Unknown"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Speed:</span>
            <span className="font-medium">
              {robotPosition?.speed !== undefined 
                ? `${robotPosition.speed.toFixed(1)} m/s` 
                : "Unknown"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Current Task:</span>
            <span className="font-medium">
              {robotPosition?.currentTask || "None"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Destination:</span>
            <span className="font-mono text-sm">
              {robotPosition?.destination 
                ? `X: ${robotPosition.destination.x.toFixed(1)}, Y: ${robotPosition.destination.y.toFixed(1)}, Z: ${robotPosition.destination.z.toFixed(1)}` 
                : "None"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
