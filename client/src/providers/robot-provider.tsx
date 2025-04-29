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
    try {
      // Use our publicly accessible robot serial number for direct data access
      const PUBLIC_ROBOT_SERIAL = 'L382502104987ir';
      
      // First try to access the public robot
      try {
        // Get data directly from the public robot
        const status = await getRobotStatus(PUBLIC_ROBOT_SERIAL);
        const position = await getRobotPosition(PUBLIC_ROBOT_SERIAL);
        const sensorData = await getRobotSensorData(PUBLIC_ROBOT_SERIAL);
        const map = await getMapData(PUBLIC_ROBOT_SERIAL);
        
        // Also fetch camera data
        try {
          const camera = await getRobotCameraData(PUBLIC_ROBOT_SERIAL);
          setCameraData(camera);
        } catch (cameraError) {
          console.warn("Camera data not available for public robot:", cameraError);
        }
        
        console.log("Successfully fetched PUBLIC robot data for", PUBLIC_ROBOT_SERIAL, status);
        
        setRobotStatus(status);
        setRobotPosition(position);
        setRobotSensorData(sensorData);
        setMapData(map);
        updateTimestamp();
        return; // Exit early if public robot data was retrieved successfully
      } catch (publicError) {
        console.warn("Could not connect to public robot, falling back to local robot:", publicError);
      }
      
      // Fall back to the local robot if public robot not accessible
      const LOCAL_ROBOT_SERIAL = 'L382502104988is';
      
      // Get data from the local robot
      const status = await getRobotStatus(LOCAL_ROBOT_SERIAL);
      const position = await getRobotPosition(LOCAL_ROBOT_SERIAL);
      const sensorData = await getRobotSensorData(LOCAL_ROBOT_SERIAL);
      const map = await getMapData(LOCAL_ROBOT_SERIAL);
      
      // Also fetch camera data
      try {
        const camera = await getRobotCameraData(LOCAL_ROBOT_SERIAL);
        setCameraData(camera);
      } catch (cameraError) {
        console.warn("Camera data not available for local robot:", cameraError);
      }
      
      console.log("Successfully fetched LOCAL robot data for", LOCAL_ROBOT_SERIAL, status);
      
      setRobotStatus(status);
      setRobotPosition(position);
      setRobotSensorData(sensorData);
      setMapData(map);
      updateTimestamp();
    } catch (error) {
      console.error("Error fetching initial robot data:", error);
    }
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
  
  // Connect to WebSocket when user is authenticated
  useEffect(() => {
    if (!user) return;
    
    // First fetch data via REST
    fetchInitialData();
    
    // Then subscribe to WebSocket events
    const unsubscribe = robotWebSocket.subscribe(handleWebSocketUpdate);
    
    // Establish connection
    robotWebSocket.connect();
    
    // Request initial data via WebSocket
    setTimeout(() => {
      if (robotWebSocket.isConnected()) {
        robotWebSocket.requestStatus();
        robotWebSocket.requestPosition();
        robotWebSocket.requestSensorData();
        robotWebSocket.requestMapData();
        robotWebSocket.requestTaskInfo();
        robotWebSocket.requestCameraData(); // Add camera data request
      }
    }, 1000); // Small delay to ensure connection is established
    
    // Set up automatic refresh every 1 second for more frequent updates
    const refreshInterval = setInterval(() => {
      if (robotWebSocket.isConnected()) {
        console.log('Auto-refreshing robot data (1s interval)');
        // Update timestamp on server response instead of here
        robotWebSocket.requestStatus();
        robotWebSocket.requestPosition();
        robotWebSocket.requestSensorData();
        robotWebSocket.requestMapData();
        robotWebSocket.requestCameraData();
        robotWebSocket.requestTaskInfo();
      } else {
        // Auto-reconnect if the connection was dropped
        console.warn('WebSocket disconnected - attempting to reconnect...');
        robotWebSocket.connect();
        
        // After a short delay, attempt to request data again
        setTimeout(() => {
          if (robotWebSocket.isConnected()) {
            robotWebSocket.requestStatus();
            robotWebSocket.requestPosition();
            robotWebSocket.requestSensorData();
            robotWebSocket.requestMapData();
            robotWebSocket.requestCameraData();
            robotWebSocket.requestTaskInfo();
          }
        }, 500);
      }
    }, 1000);
    
    // Clean up subscription and interval on unmount
    return () => {
      unsubscribe();
      robotWebSocket.disconnect();
      clearInterval(refreshInterval);
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
      // First try public robot
      try {
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
        console.log(`Successfully toggled PUBLIC robot camera to: ${enabled ? 'enabled' : 'disabled'}`);
        return; // Exit early if successful
      } catch (publicError) {
        console.warn("Could not toggle public robot camera, falling back to local robot:", publicError);
      }
      
      // Fall back to the local robot if needed
      const LOCAL_ROBOT_SERIAL = 'L382502104988is';
      const response = await toggleRobotCamera(LOCAL_ROBOT_SERIAL, enabled);
      setCameraData(response);
      
      // If we're enabling the camera, also update the status to reflect this
      if (robotStatus && enabled !== (robotStatus.cameraEnabled || false)) {
        setRobotStatus({
          ...robotStatus,
          cameraEnabled: enabled
        });
      }
      
      updateTimestamp();
      console.log(`Successfully toggled LOCAL robot camera to: ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error("Error toggling camera:", error);
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
