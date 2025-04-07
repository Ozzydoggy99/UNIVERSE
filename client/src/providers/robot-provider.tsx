import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { RobotStatus, RobotPosition, RobotSensorData, MapData } from "@/types/robot";
import { 
  getRobotStatus, 
  getRobotPosition, 
  getRobotSensorData, 
  getMapData 
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface RobotContextType {
  robotStatus: RobotStatus | null;
  robotPosition: RobotPosition | null;
  robotSensorData: RobotSensorData | null;
  mapData: MapData | null;
  lastUpdated: Date | null;
  setRobotData: (
    status: RobotStatus | null, 
    position: RobotPosition | null, 
    sensorData: RobotSensorData | null,
    mapData: MapData | null
  ) => void;
}

const RobotContext = createContext<RobotContextType | undefined>(undefined);

interface RobotProviderProps {
  children: ReactNode;
}

export function RobotProvider({ children }: RobotProviderProps) {
  const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null);
  const [robotPosition, setRobotPosition] = useState<RobotPosition | null>(null);
  const [robotSensorData, setRobotSensorData] = useState<RobotSensorData | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const { user } = useAuth();
  
  // Poll for robot data when authenticated
  useEffect(() => {
    if (!user) return;
    
    async function fetchRobotData() {
      try {
        const status = await getRobotStatus();
        const position = await getRobotPosition();
        const sensorData = await getRobotSensorData();
        const map = await getMapData();
        
        setRobotStatus(status);
        setRobotPosition(position);
        setRobotSensorData(sensorData);
        setMapData(map);
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Error fetching robot data:", error);
      }
    }
    
    // Initial fetch
    fetchRobotData();
    
    // Set up interval for polling
    const interval = setInterval(fetchRobotData, 10000); // Poll every 10 seconds
    
    return () => clearInterval(interval);
  }, [user]);

  const handleSetRobotData = (
    status: RobotStatus | null, 
    position: RobotPosition | null, 
    sensorData: RobotSensorData | null,
    mapData: MapData | null
  ) => {
    if (status) setRobotStatus(status);
    if (position) setRobotPosition(position);
    if (sensorData) setRobotSensorData(sensorData);
    if (mapData) setMapData(mapData);
    
    setLastUpdated(new Date());
  };

  return (
    <RobotContext.Provider
      value={{
        robotStatus,
        robotPosition,
        robotSensorData,
        mapData,
        lastUpdated,
        setRobotData: handleSetRobotData,
      }}
    >
      {children}
    </RobotContext.Provider>
  );
}

export function useRobot() {
  const context = useContext(RobotContext);
  if (context === undefined) {
    throw new Error("useRobot must be used within a RobotProvider");
  }
  return context;
}
