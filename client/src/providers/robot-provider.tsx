import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { RobotStatus, RobotPosition, RobotSensorData, MapData, CameraData, LidarData } from "@/types/robot";
import { 
  getRobotStatus, 
  getRobotPosition, 
  getRobotSensorData, 
  getMapData,
  getRobotCameraData,
  getLidarData,
  toggleRobotCamera
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface RobotContextType {
  robotStatus: RobotStatus | null;
  robotPosition: RobotPosition | null;
  robotSensorData: RobotSensorData | null;
  mapData: MapData | null;
  cameraData: CameraData | null;
  lidarData: LidarData | null;
  lastUpdated: Date | null;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  setRobotData: (
    status: RobotStatus | null, 
    position: RobotPosition | null, 
    sensorData: RobotSensorData | null,
    mapData: MapData | null,
    lidarData: LidarData | null,
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
  const [lidarData, setLidarData] = useState<LidarData | null>(null);
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
    
    // Track if we successfully fetched any data
    let fetchSuccess = false;
    
    try {
      // Use Promise.allSettled to handle multiple API calls gracefully
      const results = await Promise.allSettled([
        getRobotStatus(PUBLIC_ROBOT_SERIAL),
        getRobotPosition(PUBLIC_ROBOT_SERIAL),
        getRobotSensorData(PUBLIC_ROBOT_SERIAL),
        getMapData(PUBLIC_ROBOT_SERIAL),
        getLidarData(PUBLIC_ROBOT_SERIAL),
        getRobotCameraData(PUBLIC_ROBOT_SERIAL)
      ]);
      
      // Process results from each API call
      if (results[0].status === 'fulfilled' && results[0].value) {
        setRobotStatus(results[0].value);
        fetchSuccess = true;
      }
      
      if (results[1].status === 'fulfilled' && results[1].value) {
        setRobotPosition(results[1].value);
      }
      
      if (results[2].status === 'fulfilled' && results[2].value) {
        setRobotSensorData(results[2].value);
      }
      
      if (results[3].status === 'fulfilled' && results[3].value) {
        setMapData(results[3].value);
      }
      
      if (results[4].status === 'fulfilled' && results[4].value) {
        setLidarData(results[4].value);
      }
      
      if (results[5].status === 'fulfilled' && results[5].value) {
        setCameraData(results[5].value);
      }
      
      // Update the connection state based on data availability
      if (fetchSuccess) {
        setConnectionState('connected');
      } else {
        setConnectionState('error');
      }
    } catch (error) {
      // Only log critical errors, not expected API failures
      setConnectionState('error');
    }
    
    // Always update the timestamp to show we attempted a refresh
    updateTimestamp();
    
    return fetchSuccess;
  };

  // We're only using REST API polling for robot data updates
  
  // Use direct REST API polling instead of WebSocket
  useEffect(() => {
    if (!user) return;
    
    // Initially fetch data via REST
    fetchInitialData();
    
    // Set connection state to connecting
    setConnectionState('connecting');
    
    // Use a slightly longer interval (1200ms) to reduce error frequency
    const pollingInterval = 1200;
    
    // PUBLIC_ROBOT_SERIAL is our known physical robot
    const PUBLIC_ROBOT_SERIAL = 'L382502104987ir';
    
    // Track consecutive errors to help with reconnection logic
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10; // Increased to be more tolerant of network blips
    
    // Set up a polling interval to fetch data regularly
    const refreshInterval = setInterval(async () => {
      try {
        // Use Promise.allSettled instead of Promise.all to handle partial failures
        const results = await Promise.allSettled([
          getRobotStatus(PUBLIC_ROBOT_SERIAL),
          getRobotPosition(PUBLIC_ROBOT_SERIAL),
          getRobotSensorData(PUBLIC_ROBOT_SERIAL),
          getMapData(PUBLIC_ROBOT_SERIAL),
          getLidarData(PUBLIC_ROBOT_SERIAL),
          getRobotCameraData(PUBLIC_ROBOT_SERIAL)
        ]);
        
        // Process results even if some failed
        let hasSuccessfulData = false;
        let isConnecting = false;
        let isDisconnected = false;
        let connectionFailed = false;
        
        // Count how many successful responses we get
        let successfulResponses = 0;
        
        // Check each promise result and also look at the connectionStatus property
        if (results[0].status === 'fulfilled' && results[0].value) {
          const statusData = results[0].value;
          setRobotStatus(statusData);
          successfulResponses++;
          
          // Use the connectionStatus from the response to determine overall state
          if (statusData.connectionStatus === 'connected') {
            hasSuccessfulData = true;
          } else if (statusData.connectionStatus === 'connecting') {
            isConnecting = true;
          } else if (statusData.connectionStatus === 'disconnected') {
            isDisconnected = true;
          } else if (statusData.connectionStatus === 'error') {
            connectionFailed = true;
          }
        } else if (results[0].status === 'rejected') {
          // Skip logging to reduce console noise
          connectionFailed = true;
        }
        
        if (results[1].status === 'fulfilled' && results[1].value) {
          setRobotPosition(results[1].value);
          successfulResponses++;
        } else if (results[1].status === 'rejected') {
          // Skip logging to reduce console noise
        }
        
        if (results[2].status === 'fulfilled' && results[2].value) {
          setRobotSensorData(results[2].value);
          successfulResponses++;
        } else if (results[2].status === 'rejected') {
          // Skip logging to reduce console noise
        }
        
        if (results[3].status === 'fulfilled' && results[3].value) {
          setMapData(results[3].value);
          successfulResponses++;
        } else if (results[3].status === 'rejected') {
          // Skip logging to reduce console noise
        }
        
        if (results[4].status === 'fulfilled' && results[4].value) {
          setCameraData(results[4].value);
          successfulResponses++;
        } else if (results[4].status === 'rejected') {
          // Skip logging to reduce console noise
        }
        
        // Update connection state based on results and connection status
        // Consider the connection successful if we got any data at all
        if (successfulResponses > 0) {
          hasSuccessfulData = true;
          consecutiveErrors = 0; // Reset error counter on any successful response
          
          // Even partial data is better than no data - if we have any response,
          // we'll keep the previous data for other categories
        }
        
        if (hasSuccessfulData && !isDisconnected) {
          setConnectionState('connected');
        } else if (isConnecting) {
          setConnectionState('connecting');
        } else if (isDisconnected) {
          setConnectionState('disconnected');
        } else if (connectionFailed) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            setConnectionState('error');
          } else {
            // If we're having some intermittent errors, show connecting instead of error
            // to indicate we're trying to reconnect
            setConnectionState('connecting');
          }
        }
        
        // Always update timestamp when we try to fetch data
        updateTimestamp();
      } catch (error) {
        console.error('Error fetching robot data:', error);
        consecutiveErrors++;
        
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          setConnectionState('error');
        } else {
          setConnectionState('connecting');
        }
        
        // Even if there's an error, try again on the next interval
      }
    }, pollingInterval);
    
    // Clean up interval on unmount
    return () => {
      clearInterval(refreshInterval);
      setConnectionState('disconnected');
    };
  }, [user]);

  // Manual data refresh function - using direct REST API calls
  const refreshData = async () => {
    // Always use REST API for data fetching
    await fetchInitialData();
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
        // Provide dummy functions that match the interface but don't use WebSocket
        connectWebSocket: () => setConnectionState('connected'),
        disconnectWebSocket: () => setConnectionState('disconnected'),
        isConnected: () => connectionState === 'connected',
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
