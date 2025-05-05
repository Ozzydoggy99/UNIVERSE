import React, { useState } from "react";
import { SimpleMapDigitalTwin } from "@/components/robot-map/SimpleMapDigitalTwin";
import { useRobotData } from "@/hooks/use-robot-data";
import { Loader2 } from "lucide-react";

const robotSerial = "L382502104987ir"; // Using the physical robot serial

export default function RobotMapsPage() {
  const { mapData, positionData, isLoading, error, refetch } = useRobotData(robotSerial);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[500px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading robot map data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        <h2 className="text-xl font-semibold mb-2">Error loading robot map</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Robot Map</h1>
        <p className="text-muted-foreground">
          Live digital twin visualization for robot {robotSerial}
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
