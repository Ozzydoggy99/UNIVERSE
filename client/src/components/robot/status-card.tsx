import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RobotStatus } from "@/types/robot";
import { useRobot } from "@/providers/robot-provider";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, WifiOff, Loader2 } from "lucide-react";

export function RobotStatusCard() {
  const { robotStatus, connectionState } = useRobot();

  const getConnectionStatusDisplay = () => {
    switch (connectionState) {
      case 'connected':
        return null; // Don't show anything when connected
      case 'connecting':
        return (
          <div className="flex items-center space-x-2 mt-2 p-2 bg-orange-100 text-orange-800 rounded-md">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Connecting to robot...</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center space-x-2 mt-2 p-2 bg-gray-100 text-gray-800 rounded-md">
            <WifiOff className="h-4 w-4" />
            <span className="text-xs">Robot disconnected. Attempting to reconnect...</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center space-x-2 mt-2 p-2 bg-red-100 text-red-800 rounded-md">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">Connection error. Check robot power and network.</span>
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return "bg-muted";
    
    switch (status.toLowerCase()) {
      case 'online':
        return "bg-success";
      case 'offline':
        return "bg-destructive";
      case 'warning':
        return "bg-warning";
      case 'error':
        return "bg-destructive";
      default:
        return "bg-muted";
    }
  };
  
  const getBatteryColor = (level?: number) => {
    if (level === undefined) return "bg-muted";
    
    if (level > 70) return "bg-success";
    if (level > 30) return "bg-warning";
    return "bg-destructive";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Robot Status</CardTitle>
          <Badge variant="outline" className={`${getStatusColor(robotStatus?.status)} text-white`}>
            {robotStatus?.status || "Unknown"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Model:</span>
            <span className="font-medium">{robotStatus?.model || "Unknown"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Serial Number:</span>
            <span className="font-mono text-sm">{robotStatus?.serialNumber || "Unknown"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Battery:</span>
            <div className="flex items-center">
              <div className="w-24 mr-2">
                <Progress 
                  value={robotStatus?.battery} 
                  className={`h-2 ${getBatteryColor(robotStatus?.battery)}`} 
                />
              </div>
              <span className="text-sm font-medium">{robotStatus?.battery ? `${robotStatus.battery}%` : "Unknown"}</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status:</span>
            <span className="font-medium">{robotStatus?.operationalStatus || "Unknown"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Uptime:</span>
            <span className="font-medium">{robotStatus?.uptime || "Unknown"}</span>
          </div>
          
          {/* Display connection status information */}
          {getConnectionStatusDisplay()}
        </div>
      </CardContent>
    </Card>
  );
}
