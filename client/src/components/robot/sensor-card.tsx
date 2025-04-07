import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRobot } from "@/providers/robot-provider";

export function RobotSensorCard() {
  const { robotSensorData } = useRobot();

  const getProximityColor = (proximity?: number) => {
    if (proximity === undefined) return "bg-muted";
    
    if (proximity > 5) return "bg-success";
    if (proximity > 2) return "bg-warning";
    return "bg-destructive";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sensor Data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Temperature:</span>
            <span className="font-medium">
              {robotSensorData?.temperature !== undefined 
                ? `${robotSensorData.temperature.toFixed(1)}°C` 
                : "Unknown"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Humidity:</span>
            <span className="font-medium">
              {robotSensorData?.humidity !== undefined 
                ? `${robotSensorData.humidity}%` 
                : "Unknown"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Proximity:</span>
            <div className="flex items-center">
              <div className="w-24 mr-2">
                <Progress 
                  value={robotSensorData?.proximity ? Math.min(100, (robotSensorData.proximity / 10) * 100) : 0} 
                  className={`h-2 ${getProximityColor(robotSensorData?.proximity)}`} 
                />
              </div>
              <span className="text-sm font-medium">
                {robotSensorData?.proximity !== undefined 
                  ? `${robotSensorData.proximity.toFixed(1)}m` 
                  : "Unknown"}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Light Level:</span>
            <span className="font-medium">
              {robotSensorData?.light !== undefined 
                ? `${robotSensorData.light} lux` 
                : "Unknown"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Noise Level:</span>
            <span className="font-medium">
              {robotSensorData?.noise !== undefined 
                ? `${robotSensorData.noise} dB` 
                : "Unknown"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
