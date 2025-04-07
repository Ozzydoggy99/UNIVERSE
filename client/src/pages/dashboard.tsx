import { useEffect } from "react";
import { ConnectionStatus } from "@/components/status/connection-status";
import { RobotStatusCard } from "@/components/robot/status-card";
import { RobotLocationCard } from "@/components/robot/location-card";
import { RobotSensorCard } from "@/components/robot/sensor-card";
import { MapVisualization } from "@/components/ui/map";
import { RobotControls } from "@/components/ui/robot-controls";
import { useRobot } from "@/providers/robot-provider";
import { useAuth } from "@/hooks/use-auth";
import { refreshAllData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const { setRobotData } = useRobot();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          const [status, position, sensorData, mapData] = await refreshAllData();
          setRobotData(status, position, sensorData, mapData);
        } catch (error) {
          toast({
            title: "Error Loading Data",
            description: error instanceof Error ? error.message : "Failed to load robot data",
            variant: "destructive",
          });
        }
      };

      fetchData();

      // Set up polling for updates
      const intervalId = setInterval(fetchData, 10000); // Poll every 10 seconds

      return () => clearInterval(intervalId);
    }
  }, [user, setRobotData, toast]);

  return (
    <>
      <ConnectionStatus />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <RobotStatusCard />
        <RobotLocationCard />
        <RobotSensorCard />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RobotControls />
        <MapVisualization />
      </div>
    </>
  );
}
