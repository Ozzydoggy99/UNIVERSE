import React, { useState, useEffect } from "react";
import { SimpleMapDigitalTwin } from "@/components/robot-map/SimpleMapDigitalTwin";
import { useRobotData } from "@/hooks/use-robot-data";
import { useRobotPosition } from "@/hooks/use-robot-position";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const robotSerial = "L382502104987ir"; // Using the physical robot serial

// Define the PositionData interface for proper type checking
interface PositionData {
  x: number;
  y: number;
  z: number;
  theta: number;
  orientation: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
}

export default function RobotMapsPage() {
  // Get map data from the REST API
  const { mapData, isLoading: mapLoading, error: mapError, refetch } = useRobotData(robotSerial);
  
  // Get real-time position data from the WebSocket
  const websocketPosition = useRobotPosition();
  
  // Convert websocket position to the format expected by SimpleMapDigitalTwin
  const [positionData, setPositionData] = useState<PositionData | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);

  // Update position data when websocket data changes
  useEffect(() => {
    if (websocketPosition) {
      console.log("Received websocket position update:", websocketPosition);
      
      // Convert the format to what SimpleMapDigitalTwin expects
      const formattedPosition: PositionData = {
        x: websocketPosition.x,
        y: websocketPosition.y,
        z: 0, // Z is usually 0 for 2D maps
        theta: websocketPosition.theta,
        orientation: websocketPosition.orientation || {
          x: 0,
          y: 0,
          z: 0,
          w: 1
        }
      };
      
      setPositionData(formattedPosition);
      
      // Update the last update time
      setLastUpdateTime(new Date().toLocaleTimeString());
    }
  }, [websocketPosition]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (mapLoading) {
    return (
      <div className="flex justify-center items-center h-[500px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading robot map data...</p>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="p-6 text-center text-destructive">
        <h2 className="text-xl font-semibold mb-2">Error loading robot map</h2>
        <p>{mapError.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Robot Map</h1>
          <div className="flex items-center gap-2">
            {websocketPosition && lastUpdateTime && (
              <Badge variant="outline" className="flex gap-2 items-center">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                <span>Live Position Updated: {lastUpdateTime}</span>
              </Badge>
            )}
            {!websocketPosition && (
              <Badge variant="outline" className="flex gap-2 items-center bg-amber-50">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span>Connecting to robot via WebSocket relay...</span>
              </Badge>
            )}
          </div>
        </div>
        <p className="text-muted-foreground">
          Live digital twin visualization for robot {robotSerial} with direct WebSocket position tracking
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Note: WebSocket connection is established through a secure relay server to ensure HTTPS compatibility
        </p>
      </div>
      
      <SimpleMapDigitalTwin
        robotSerial={robotSerial}
        mapData={mapData}
        positionData={positionData}
        onRefresh={handleRefresh}
      />
      
      {refreshing && (
        <div className="mt-2 text-sm text-muted-foreground flex items-center">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Refreshing map data...
        </div>
      )}
    </div>
  );
}
