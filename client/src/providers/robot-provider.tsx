import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { RobotStatus, RobotPosition, RobotSensorData, MapData, CameraData } from "@/types/robot";
import { 
  getRobotStatus, 
  getRobotPosition, 
  getRobotSensorData, 
  getMapData,
  getRobotCameraData,
  toggleRobotCamera
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { robotWebSocket, RobotUpdateEvent, RobotUpdateListener } from "@/lib/robotWebSocket";

interface RobotContextType {
  robotStatus: RobotStatus | null;
  robotPosition: RobotPosition | null;
  robotSensorData: RobotSensorData | null;
  mapData: MapData | null;
  cameraData: CameraData | null;
  lastUpdated: Date | null;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  setRobotData: (
    status: RobotStatus | null, 
    position: RobotPosition | null, 
    sensorData: RobotSensorData | null,
    mapData: MapData | null,
    cameraData: CameraData | null
  ) => void;
  toggleCamera: (enabled: boolean) => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  isConnected: () => boolean;
  refreshData: () => Promise<void>;
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
  const [cameraData, setCameraData] = useState<CameraData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  
  const { user } = useAuth();
  
  // Helper to update the last updated timestamp
  const updateTimestamp = () => {
    setLastUpdated(new Date());
  };

  // Initial data fetch using REST API
  const fetchInitialData = async () => {
    // Use our publicly accessible robot serial number for direct data access
    const PUBLIC_ROBOT_SERIAL = 'L382502104987ir';
    
    // Only use real data from the robot, no mock or fallback data
    let status = null;
    let position = null;
    let sensorData = null;
    let map = null;
    let camera = null;
    let fetchSuccess = false;
    
    // Try to access the physical robot
    try {
      // Get status
      try {
        status = await getRobotStatus(PUBLIC_ROBOT_SERIAL);
        fetchSuccess = true;
      } catch (statusError) {
        console.warn("Could not fetch robot status:", statusError);
      }
      
      // Get position
      try {
        position = await getRobotPosition(PUBLIC_ROBOT_SERIAL);
      } catch (positionError) {
        console.warn("Could not fetch robot position:", positionError);
      }
      
      // Get sensor data
      try {
        sensorData = await getRobotSensorData(PUBLIC_ROBOT_SERIAL);
      } catch (sensorError) {
        console.warn("Could not fetch robot sensor data:", sensorError);
      }
      
      // Get map data
      try {
        map = await getMapData(PUBLIC_ROBOT_SERIAL);
      } catch (mapError) {
        console.warn("Could not fetch robot map data:", mapError);
      }
      
      // Also fetch camera data
      try {
        camera = await getRobotCameraData(PUBLIC_ROBOT_SERIAL);
      } catch (cameraError) {
        console.warn("Camera data not available:", cameraError);
      }
      
      console.log("Fetched robot data for", PUBLIC_ROBOT_SERIAL);
    } catch (error) {
      console.error("Error fetching robot data:", error);
    }
    
    // Set all the data we managed to get or create
    setRobotStatus(status);
    setRobotPosition(position);
    setRobotSensorData(sensorData);
    setMapData(map);
    setCameraData(camera);
    updateTimestamp();
    
    return fetchSuccess;
  };

  // WebSocket event handler
  const handleWebSocketUpdate = (event: RobotUpdateEvent) => {
    switch (event.type) {
      case 'status':
        setRobotStatus(event.data);
        updateTimestamp();
        break;
      case 'position':
        setRobotPosition(event.data);
        updateTimestamp();
        break;
      case 'sensors':
        setRobotSensorData(event.data);
        updateTimestamp();
        break;
      case 'map':
        setMapData(event.data);
        updateTimestamp();
        break;
      case 'camera':
        setCameraData(event.data);
        updateTimestamp();
        break;
      case 'connection':
        setConnectionState(event.state);
        break;
      case 'error':
        console.error('Robot WebSocket error:', event.message);
        break;
    }
  };
  
  // Use direct REST API polling instead of WebSocket
  useEffect(() => {
    if (!user) return;
    
    // Initially fetch data via REST
    fetchInitialData();
    
    // Set connection state to connecting
    setConnectionState('connecting');
    
    // Use a shorter interval (800ms) for more responsive updates
    const pollingInterval = 800;
    
    // PUBLIC_ROBOT_SERIAL is our known physical robot
    const PUBLIC_ROBOT_SERIAL = 'L382502104987ir';
    
    // Set up a polling interval to fetch data regularly
    const refreshInterval = setInterval(async () => {
      try {
        // Fetch all robot data in parallel for efficiency
        const [status, position, sensors, mapInfo, cameraInfo] = await Promise.all([
          getRobotStatus(PUBLIC_ROBOT_SERIAL),
          getRobotPosition(PUBLIC_ROBOT_SERIAL),
          getRobotSensorData(PUBLIC_ROBOT_SERIAL),
          getMapData(PUBLIC_ROBOT_SERIAL),
          getRobotCameraData(PUBLIC_ROBOT_SERIAL)
        ]);
        
        // Update state with fetched data
        if (status) setRobotStatus(status);
        if (position) setRobotPosition(position);
        if (sensors) setRobotSensorData(sensors);
        if (mapInfo) setMapData(mapInfo);
        if (cameraInfo) setCameraData(cameraInfo);
        
        // Mark connection as successful
        setConnectionState('connected');
        
        // Update the last updated timestamp
        updateTimestamp();
      } catch (error) {
        console.error('Error fetching robot data:', error);
        setConnectionState('error');
        
        // Even if there's an error, try again on the next interval
      }
    }, pollingInterval);
    
    // Clean up interval on unmount
    return () => {
      clearInterval(refreshInterval);
      setConnectionState('disconnected');
    };
  }, [user]);

  // Manual data refresh function
  const refreshData = async () => {
    if (robotWebSocket.isConnected()) {
      // If WebSocket is connected, request updates via WebSocket
      robotWebSocket.requestStatus();
      robotWebSocket.requestPosition();
      robotWebSocket.requestSensorData();
      robotWebSocket.requestMapData();
      robotWebSocket.requestCameraData(); // Add camera data request
      robotWebSocket.requestTaskInfo();
    } else {
      // Fallback to REST API if WebSocket is not connected
      await fetchInitialData();
    }
  };

  const handleSetRobotData = (
    status: RobotStatus | null, 
    position: RobotPosition | null, 
    sensorData: RobotSensorData | null,
    mapData: MapData | null,
    camera: CameraData | null
  ) => {
    if (status) setRobotStatus(status);
    if (position) setRobotPosition(position);
    if (sensorData) setRobotSensorData(sensorData);
    if (mapData) setMapData(mapData);
    if (camera) setCameraData(camera);
    
    updateTimestamp();
  };
  
  const handleToggleCamera = async (enabled: boolean): Promise<void> => {
    // Use our publicly accessible robot serial number for direct access
    const PUBLIC_ROBOT_SERIAL = 'L382502104987ir';
    
    try {
      // Try to use the real robot API
      const response = await toggleRobotCamera(PUBLIC_ROBOT_SERIAL, enabled);
      setCameraData(response);
      
      // If we're enabling the camera, also update the status to reflect this
      if (robotStatus && enabled !== (robotStatus.cameraEnabled || false)) {
        setRobotStatus({
          ...robotStatus,
          cameraEnabled: enabled
        });
      }
      
      updateTimestamp();
      console.log(`Successfully toggled robot camera to: ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error("Error toggling camera:", error);
      // No fallback data - only use real robot data
    }
  };

  return (
    <RobotContext.Provider
      value={{
        robotStatus,
        robotPosition,
        robotSensorData,
        mapData,
        cameraData,
        lastUpdated,
        connectionState,
        setRobotData: handleSetRobotData,
        toggleCamera: handleToggleCamera,
        connectWebSocket: robotWebSocket.connect.bind(robotWebSocket),
        disconnectWebSocket: robotWebSocket.disconnect.bind(robotWebSocket),
        isConnected: robotWebSocket.isConnected.bind(robotWebSocket),
        refreshData
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
