import React from "react";
import { MapDigitalTwin } from "@/components/robot-map/MapDigitalTwin";
import { useRobotData } from "@/hooks/use-robot-data";

const robotSerial = "L382502104987ir"; // Using the physical robot serial

export default function RobotMapsPage() {
  const { mapData, positionData, isLoading, error } = useRobotData(robotSerial);

  if (isLoading) return <p>Loading map...</p>;
  if (error) return <p>Error loading robot map: {error.message}</p>;

  return (
    <MapDigitalTwin
      robotSerial={robotSerial}
      mapData={mapData}
      positionData={positionData}
      showGridByDefault={true}
      showPathByDefault={true}
    />
  );
}
