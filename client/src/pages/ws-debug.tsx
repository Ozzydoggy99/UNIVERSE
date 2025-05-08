import { useMultiRobotWebSockets } from "@/hooks/use-multi-robot-websockets";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCw, CheckCircle, AlertCircle, XCircle } from "lucide-react";

export default function WsDebugPage() {
  const connectionData = useMultiRobotWebSockets();
  const [serverTime, setServerTime] = useState<string>("Loading...");

  // Update the server time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setServerTime(new Date().toLocaleTimeString());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Helper function to determine badge color based on connection status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" /> Connected
          </Badge>
        );
      case "connecting":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600">
            <RotateCw className="h-3 w-3 mr-1 animate-spin" /> Connecting
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-500 hover:bg-red-600">
            <AlertCircle className="h-3 w-3 mr-1" /> Error
          </Badge>
        );
      case "disconnected":
      default:
        return (
          <Badge className="bg-slate-500 hover:bg-slate-600">
            <XCircle className="h-3 w-3 mr-1" /> Disconnected
          </Badge>
        );
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">🤖 Robot WebSocket Monitor</h1>
        <div className="text-sm text-muted-foreground">
          Server time: {serverTime}
        </div>
      </div>
      
      <Separator />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(connectionData).map(([label, { status, lastMessage, connectionAttempts, lastError }]) => (
          <Card key={label} className="overflow-hidden">
            <div className="p-4 bg-muted/50">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-medium">{label}</h2>
                {getStatusBadge(status)}
              </div>
              
              {connectionAttempts > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Connection attempts: {connectionAttempts}
                </div>
              )}
              
              {lastError && (
                <div className="text-xs text-red-500 mt-1">
                  {lastError}
                </div>
              )}
            </div>
            
            <ScrollArea className="h-60 p-4 bg-black/5">
              <div className="font-mono text-xs whitespace-pre-wrap break-words">
                {lastMessage || "Waiting for messages..."}
              </div>
            </ScrollArea>
          </Card>
        ))}
      </div>
      
      <div className="bg-muted p-4 rounded-lg">
        <h3 className="text-sm font-medium mb-2">Debug Information</h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>• WebSocket connections will automatically reconnect with exponential backoff</li>
          <li>• Messages are displayed as they are received (newest at bottom)</li>
          <li>• JSON messages are automatically formatted for better readability</li>
          <li>• All connections go through our secure server proxy with authentication</li>
          <li>• The robot API WebSocket provides direct control and command responses</li>
          <li>• The position relay WebSocket provides real-time position updates</li>
          <li>• The camera feed WebSocket provides video streaming data</li>
        </ul>
      </div>
    </div>
  );
}