import { useRobot } from "@/providers/robot-provider";
import { Button } from "@/components/ui/button";
import { AlertCircle, WifiOff, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ConnectionStatus() {
  const { connectionState, refreshData } = useRobot();

  // Don't display anything if connected
  if (connectionState === 'connected') return null;

  const handleRetryConnection = async () => {
    // Manually refresh the data
    await refreshData();
  };

  return (
    <Card className="mb-4 border-l-4 border-l-orange-500">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {connectionState === 'connecting' && (
              <>
                <Loader2 className="h-5 w-5 text-orange-500 animate-spin" />
                <span className="font-medium">Connecting to robot... This may take a moment.</span>
              </>
            )}
            
            {connectionState === 'disconnected' && (
              <>
                <WifiOff className="h-5 w-5 text-gray-500" />
                <span className="font-medium">Robot temporarily disconnected. Automatic reconnection in progress...</span>
              </>
            )}
            
            {connectionState === 'error' && (
              <>
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium">
                  Connection error. The robot may be offline or temporarily unreachable.
                  <br />
                  <span className="text-xs text-muted-foreground">
                    We'll continue trying to reconnect automatically.
                  </span>
                </span>
              </>
            )}
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRetryConnection}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}