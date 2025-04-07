import { Card, CardContent } from "@/components/ui/card";
import { Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useRobot } from "@/providers/robot-provider";
import { formatDistance } from "date-fns";

export function ConnectionStatus() {
  const { isAuthenticated, apiEndpoint } = useAuth();
  const { lastUpdated } = useRobot();
  
  const lastUpdateText = lastUpdated 
    ? formatDistance(lastUpdated, new Date(), { addSuffix: true })
    : "Never";

  const connectionStatus = isAuthenticated ? "Connected" : "Disconnected";
  const statusColor = isAuthenticated ? "text-success" : "text-destructive";
  const StatusIcon = isAuthenticated ? Wifi : WifiOff;
  
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center mb-2 md:mb-0">
            <StatusIcon className={`mr-2 h-5 w-5 ${statusColor}`} />
            <span className="font-medium">API Connection Status:</span>
            <span className={`ml-2 ${statusColor}`}>{connectionStatus}</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground mr-2">Last Update:</span>
              <span className="text-sm font-mono">{lastUpdateText}</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground mr-2">API Key:</span>
              <span className="text-sm font-mono">•••••••••••••</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
