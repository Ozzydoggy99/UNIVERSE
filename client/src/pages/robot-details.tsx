import React, { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation, Link } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Bot, 
  Map as MapIcon, 
  BarChart, 
  AlertCircle,
  Laptop,
  RotateCw,
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  Thermometer,
  Droplets,
  Signal,
  Layers,
  Wifi,
  WifiOff,
  Loader2,
  Camera,
  Eye,
  EyeOff,
  MonitorPlay,
  PlayCircle,
  PauseCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth';
import { useRobot } from '@/providers/robot-provider';
import { Map as MapComponent } from '@/components/ui/map';
import { LiveMjpegStream } from '@/components/LiveMjpegStream';
import { RobotH264Stream } from '@/components/RobotH264Stream';
import { DirectionalControl } from '@/components/robot/DirectionalControl';
import { LidarVisualization } from '@/components/robot/LidarVisualization';
import { PowerCycleButton } from '@/components/robot/PowerCycleButton';

interface RobotStatus {
  model: string;
  serialNumber: string;
  battery: number;
  status: string;
  mode: string;
  lastUpdate: string;
}

interface RobotPosition {
  x: number;
  y: number;
  z: number;
  orientation: number;
  speed: number;
  timestamp: string;
}

interface RobotSensorData {
  temperature: number;
  humidity: number;
  proximity: number[];
  battery: number;
  timestamp: string;
}

interface CameraData {
  enabled: boolean;
  streamUrl: string;
  resolution: {
    width: number;
    height: number;
  };
  rotation: number;
  nightVision: boolean;
  timestamp: string;
}

interface LidarData {
  ranges: number[];
  angle_min: number;
  angle_max: number;
  angle_increment: number;
  range_min: number;
  range_max: number;
  intensities?: number[];
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
  timestamp?: string;
}

export default function RobotDetails() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams();
  const serialNumber = params.serialNumber;
  
  const [activeTab, setActiveTab] = useState('map');
  // Data stability flags
  const [isStable, setIsStable] = useState(false);
  const [notFoundCount, setNotFoundCount] = useState(0);
  const [lastSuccessTime, setLastSuccessTime] = useState<number | null>(null);
  const stableCountRef = useRef(0);
  
  // Prevent flashing by keeping previously loaded data
  const [cachedAssignment, setCachedAssignment] = useState<any>(null);
  const [cachedTemplate, setCachedTemplate] = useState<any>(null);
  
  // Fetch robot template assignment with stability measures
  const { data: assignment, isLoading: assignmentLoading, error: assignmentError } = useQuery({
    queryKey: ['/api/robot-assignments/by-serial', serialNumber],
    enabled: !!serialNumber,
    refetchInterval: 60000, // Refresh every minute
    retry: 5,
    retryDelay: 1000,
    staleTime: 30000, // Keep data fresh for 30 seconds
    refetchOnWindowFocus: false, // Don't refetch when window gets focus
    gcTime: 120000, // Keep unused data in memory for 2 minutes
  });

  // Fetch template with stability measures
  const { data: template, isLoading: templateLoading, error: templateError } = useQuery({
    queryKey: ['/api/templates', cachedAssignment?.templateId || assignment?.templateId],
    enabled: !!(cachedAssignment?.templateId || assignment?.templateId),
    retry: 5,
    retryDelay: 1000,
    staleTime: 60000, // Keep data fresh for 1 minute
    refetchOnWindowFocus: false, // Don't refetch when window gets focus
    gcTime: 120000, // Keep unused data in memory for 2 minutes
  });

  // Get robot WebSocket state from context
  const { 
    robotStatus: wsRobotStatus,
    robotPosition: wsRobotPosition,
    robotSensorData: wsSensorData,
    mapData: wsMapData,
    cameraData: wsCameraData,
    lidarData: wsLidarData,
    connectionState, 
    connectWebSocket, 
    disconnectWebSocket, 
    isConnected,
    refreshData,
    toggleCamera
  } = useRobot();

  // Get data from WebSocket provider OR use fallback queries
  
  // Fetch robot status as fallback to WebSocket
  const { data: restRobotStatus, isLoading: statusLoading } = useQuery<RobotStatus>({
    queryKey: ['/api/robots/status', serialNumber],
    enabled: !!serialNumber && !wsRobotStatus,
    refetchInterval: connectionState !== 'connected' ? 8000 : false, // Only poll when WebSocket is not available
    retry: 5,
    retryDelay: 1000,
    staleTime: 10000,
    refetchOnWindowFocus: false,
    gcTime: 60000
  });

  // Fetch robot position as fallback to WebSocket
  const { data: restRobotPosition, isLoading: positionLoading } = useQuery<RobotPosition>({
    queryKey: ['/api/robots/position', serialNumber],
    enabled: !!serialNumber && !wsRobotPosition,
    refetchInterval: connectionState !== 'connected' ? 5000 : false, // Only poll when WebSocket is not available
    retry: 5,
    retryDelay: 1000,
    staleTime: 10000,
    refetchOnWindowFocus: false,
    gcTime: 60000
  });

  // Fetch robot sensor data as fallback to WebSocket
  const { data: restSensorData, isLoading: sensorLoading } = useQuery<RobotSensorData>({
    queryKey: ['/api/robots/sensors', serialNumber],
    enabled: !!serialNumber && !wsSensorData,
    refetchInterval: connectionState !== 'connected' ? 10000 : false, // Only poll when WebSocket is not available
    retry: 5,
    retryDelay: 1000,
    staleTime: 10000,
    refetchOnWindowFocus: false,
    gcTime: 60000
  });

  // Fetch map data as fallback to WebSocket
  const { data: restMapData, isLoading: mapLoading } = useQuery({
    queryKey: ['/api/robots/map', serialNumber],
    enabled: !!serialNumber && !wsMapData,
    refetchInterval: connectionState !== 'connected' ? 15000 : false, // Only poll when WebSocket is not available
    retry: 5,
    retryDelay: 1000, 
    staleTime: 10000,
    refetchOnWindowFocus: false,
    gcTime: 60000
  });
  
  // Fetch camera data as fallback to WebSocket
  const { data: restCameraData, isLoading: cameraLoading } = useQuery<CameraData>({
    queryKey: ['/api/robots/camera', serialNumber],
    enabled: !!serialNumber && !wsCameraData,
    refetchInterval: connectionState !== 'connected' ? 20000 : false, // Only poll when WebSocket is not available
    retry: 5,
    retryDelay: 1000,
    staleTime: 10000,
    refetchOnWindowFocus: false,
    gcTime: 60000
  });
  
  // Fetch LiDAR data as fallback to WebSocket - high frequency updates
  const { data: restLidarData, isLoading: lidarLoading } = useQuery<LidarData>({
    queryKey: ['/api/robots/lidar', serialNumber],
    enabled: !!serialNumber,
    refetchInterval: 500, // Poll every 500ms for maximum responsiveness
    retry: 3,
    retryDelay: 500,
    staleTime: 1000, // Consider data fresh for just 1 second
    refetchOnWindowFocus: false,
    gcTime: 10000
  });

  // Handle back button click
  const handleBack = () => {
    navigate('/robot-hub');
  };

  // Request data refresh at high frequency for smooth real-time updates
  useEffect(() => {
    // High-frequency data refresh for real-time updates
    const intervalId = setInterval(() => {
      if (isConnected()) {
        refreshData();
      }
    }, 250); // Poll every 250ms for smoother updates
    
    return () => clearInterval(intervalId);
  }, [isConnected, refreshData]);

  // Cache valid data to prevent flickering
  useEffect(() => {
    if (assignment) {
      setCachedAssignment(assignment);
      setLastSuccessTime(Date.now());
      setNotFoundCount(0);
      stableCountRef.current++;
    } else if (!assignmentLoading && !assignment) {
      setNotFoundCount(prev => prev + 1);
    }
    
    if (template) {
      setCachedTemplate(template);
    }
    
    // Mark the UI as stable after a few successful loads
    if (stableCountRef.current >= 3 && !isStable) {
      setIsStable(true);
    }
  }, [assignment, template, assignmentLoading, isStable]);
  
  // Determine if we should render loading state
  const initialLoading = !isStable && (
    assignmentLoading || 
    templateLoading || 
    (connectionState === 'connecting' && (!wsRobotStatus && !restRobotStatus))
  );
  
  // Determine if we should render "not found" state
  // Only show the error after multiple consecutive failures and some time has passed
  const shouldShowNotFound = !initialLoading && 
    !cachedAssignment && 
    notFoundCount >= 5 && 
    (!lastSuccessTime || (Date.now() - lastSuccessTime) > 10000);

  // Show loading state initially
  if (initialLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Robot Hub
          </Button>
          
          <Button 
            variant="outline" 
            asChild
          >
            <Link href={`/layered-map/${serialNumber}`}>
              <Layers className="h-4 w-4 mr-1" />
              Layered Map
            </Link>
          </Button>
        </div>
        
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium">Loading robot data...</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Show robot not found only after multiple confirmed errors
  if (shouldShowNotFound) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="outline" className="mb-6" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Robot Hub
        </Button>
        
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Robot Not Found
            </CardTitle>
            <CardDescription>
              The robot with serial number <span className="font-mono">{serialNumber}</span> could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="default" className="w-full" onClick={handleBack}>
              Return to Robot Hub
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prioritize WebSocket data, then REST API data
  const status = wsRobotStatus || restRobotStatus || null;
  const position = wsRobotPosition || restRobotPosition || null;
  const sensors = wsSensorData || restSensorData || null;
  const mapDataToUse = wsMapData || restMapData || null;
  const cameraDataToUse = wsCameraData || restCameraData || null;
  const lidarDataToUse = wsLidarData || restLidarData || null;
  
  // Create default data objects if needed
  const createDefaultStatus = () => ({
    model: 'AxBot Physical Robot',
    serialNumber: serialNumber || 'L382502104987ir',
    battery: 80,
    status: 'online',
    mode: 'ready',
    lastUpdate: new Date().toISOString()
  });
  
  const createDefaultPosition = () => ({
    x: 150,
    y: 95,
    z: 0,
    orientation: 180,
    speed: 0,
    timestamp: new Date().toISOString()
  });
  
  const createDefaultSensorData = () => ({
    temperature: 22,
    humidity: 45,
    proximity: [20, 30, 25, 15],
    battery: 80,
    timestamp: new Date().toISOString()
  });
  
  const createDefaultMapData = () => ({
    grid: [],
    obstacles: [],
    paths: [],
    waypoints: [],  // Add these fields for the enhanced map
    pickupPoints: [],
    dropoffPoints: [],
    size: [0, 0],
    resolution: 0.05,
    origin: [0, 0],
    connectionStatus: 'unknown',
    mapId: "1"  // Default map ID
  });
  
  const createDefaultCameraData = () => ({
    enabled: false,
    streamUrl: `${window.location.protocol}//${window.location.host}/api/camera-stream/${serialNumber || 'L382502104987ir'}`,
    resolution: {
      width: 1280,
      height: 720
    },
    rotation: 0,
    nightVision: false,
    timestamp: new Date().toISOString()
  });
  
  const createDefaultLidarData = () => ({
    ranges: Array(360).fill(0),
    angle_min: 0,
    angle_max: 6.28,
    angle_increment: 0.0174533,
    range_min: 0.15,
    range_max: 25.0,
    intensities: [],
    connectionStatus: 'disconnected',
    timestamp: new Date().toISOString()
  });
  
  // Use default data objects if real data isn't available
  const finalStatus = status || createDefaultStatus();
  const finalPosition = position || createDefaultPosition();
  const finalSensors = sensors || createDefaultSensorData();
  const finalMapData = mapDataToUse || createDefaultMapData();
  const finalCameraData = cameraDataToUse || createDefaultCameraData();
  const finalLidarData = lidarDataToUse || createDefaultLidarData();
  
  // Use cached data for assignment and template
  const displayAssignment = cachedAssignment || assignment;
  const displayTemplate = cachedTemplate || template;

  // Format time difference
  const formatTimeSince = (timestamp: string) => {
    const past = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - past) / 1000);
    
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    return `${Math.floor(diff / 3600)} hours ago`;
  };

  // Format sensor proximity data
  const formatProximity = (proximity: number[] | undefined) => {
    if (!proximity || !Array.isArray(proximity) || proximity.length === 0) return 'No data';
    return `${proximity.map(p => Number(p).toFixed(1)).join('m, ')}m`;
  };

  // Get status color based on robot status
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'running':
        return 'bg-green-500';
      case 'idle':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-amber-500';
      case 'charging':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Robot Hub
          </Button>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              asChild
            >
              <Link href={`/layered-map/${serialNumber}`}>
                <Layers className="h-4 w-4 mr-1" />
                Layered Map
              </Link>
            </Button>
            
            <Button 
              variant="default" 
              onClick={() => navigate(`/map-test/${serialNumber}`)}
              className="bg-primary text-white hover:bg-primary/90"
            >
              <MapIcon className="h-4 w-4 mr-2" />
              Map Test
            </Button>
          </div>
        </div>
        
        {/* Robot Power Control Section */}
        <div className="w-full p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Robot System Control
              </h3>
              <p className="text-sm text-muted-foreground">
                Control robot power state and system services
              </p>
            </div>
            
            <div className="flex gap-2">
              <PowerCycleButton 
                serialNumber={serialNumber || ''} 
                variant="destructive"
                buttonText="Restart Robot"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-1/3 space-y-6">
          {/* Robot Info Card */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  {displayAssignment?.name || `Robot ${serialNumber}`}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <PowerCycleButton serialNumber={serialNumber} size="sm" />
                  <Badge className={getStatusColor(finalStatus.status)}>
                    {finalStatus.status?.toUpperCase() || 'UNKNOWN'}
                  </Badge>
                </div>
              </div>
              <CardDescription>
                {displayTemplate?.name || `Template #${displayAssignment?.templateId}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Serial Number:</span>
                  <span className="font-mono">{serialNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Model:</span>
                  <span>{finalStatus.model}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mode:</span>
                  <Badge variant="outline">{finalStatus.mode?.toUpperCase() || 'UNKNOWN'}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Update:</span>
                  <span>{formatTimeSince(finalStatus.lastUpdate)}</span>
                </div>
              </div>

              <Separator />

              {/* Battery Status */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="flex items-center gap-1 text-sm">
                    {finalStatus.status?.toLowerCase() === 'charging' || 
                     finalSensors?.charging === true || 
                     finalSensors?.power_supply_status === 'charging' ? (
                      <BatteryCharging className="h-4 w-4 text-purple-500" />
                    ) : finalSensors.battery >= 90 ? (
                      <BatteryFull className="h-4 w-4 text-green-500" />
                    ) : finalSensors.battery >= 50 ? (
                      <BatteryMedium className="h-4 w-4 text-green-500" />
                    ) : finalSensors.battery >= 20 ? (
                      <BatteryLow className="h-4 w-4 text-amber-500" />
                    ) : (
                      <BatteryWarning className="h-4 w-4 text-red-500" />
                    )}
                    Battery
                  </span>
                  <span className="font-medium flex items-center gap-1">
                    {finalSensors.battery}%
                    {finalStatus.status?.toLowerCase() === 'charging' || 
                     finalSensors?.charging === true || 
                     finalSensors?.power_supply_status === 'charging' ? (
                      <span className="inline-flex items-center">
                        <span className="inline-block w-3.5 h-3.5 rounded-full bg-purple-500 animate-pulse"></span>
                        <span className="ml-1 text-xs text-purple-500">Charging</span>
                      </span>
                    ) : finalStatus.status?.toLowerCase() === 'working' || finalStatus.status?.toLowerCase() === 'active' ? (
                      <span className="inline-flex items-center">
                        <span className="inline-block w-3.5 h-3.5 rounded-full bg-blue-500 animate-pulse"></span>
                        <span className="ml-1 text-xs text-blue-500">In-Use</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center">
                        <span className="inline-block w-3.5 h-3.5 rounded-full bg-gray-400"></span>
                        <span className="ml-1 text-xs text-gray-500">Not Charging</span>
                      </span>
                    )}
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div 
                    className={`h-full transition-all ${
                      finalStatus.status?.toLowerCase() === 'charging' || 
                      finalSensors?.charging === true || 
                      finalSensors?.power_supply_status === 'charging' ? "bg-purple-500" :
                      finalStatus.status?.toLowerCase() === 'working' || finalStatus.status?.toLowerCase() === 'active' ? "bg-blue-500" :
                      finalSensors.battery >= 50 ? "bg-green-500" : 
                      finalSensors.battery >= 20 ? "bg-amber-500" : 
                      "bg-red-500"
                    }`}
                    style={{ width: `${finalSensors.battery}%` }}
                  ></div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-1">
                  <MapIcon className="h-4 w-4 text-blue-500" />
                  Current Location
                </h3>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Coordinates:</span>
                  <span className="font-mono">({finalPosition.x}, {finalPosition.y}, {finalPosition.z})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Orientation:</span>
                  <span>{finalPosition.orientation}°</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Speed:</span>
                  <span>{finalPosition.speed} m/s</span>
                </div>
              </div>

              {/* Manual Control moved to a separate card */}
            </CardContent>
          </Card>

          {/* Sensor Data Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Laptop className="h-5 w-5 text-primary" />
                Sensor Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-sm">
                  <Thermometer className="h-4 w-4 text-red-500" />
                  Temperature
                </span>
                <span className="font-medium">{finalSensors.temperature}°C</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-sm">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  Humidity
                </span>
                <span className="font-medium">{finalSensors.humidity}%</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-sm">
                  <Signal className="h-4 w-4 text-amber-500" />
                  Proximity
                </span>
                <span className="font-medium">{formatProximity(finalSensors.proximity)}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Last Sensor Update:</span>
                <span>{formatTimeSince(finalSensors.timestamp)}</span>
              </div>
              
              {/* WebSocket Connection Status */}
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="flex items-center gap-1 text-sm">
                    {connectionState === 'connected' ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-red-500" />
                    )}
                    WebSocket Status
                  </span>
                  <span className="font-medium">
                    {connectionState === 'connected' ? (
                      <span className="text-green-500">Connected</span>
                    ) : connectionState === 'connecting' ? (
                      <span className="text-amber-500">Connecting...</span>
                    ) : connectionState === 'error' ? (
                      <span className="text-red-500">Error</span>
                    ) : (
                      <span className="text-gray-500">Disconnected</span>
                    )}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant={connectionState === 'connected' ? 'outline' : 'default'} 
                    className="w-full" 
                    onClick={connectWebSocket}
                    disabled={connectionState === 'connected' || connectionState === 'connecting'}
                  >
                    <Wifi className="h-4 w-4 mr-1" />
                    Connect
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full" 
                    onClick={disconnectWebSocket}
                    disabled={connectionState === 'disconnected'}
                  >
                    <WifiOff className="h-4 w-4 mr-1" />
                    Disconnect
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LiDAR Visualization Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                LiDAR Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LidarVisualization 
                data={finalLidarData} 
                loading={lidarLoading} 
                serialNumber={serialNumber}
                robotPosition={finalPosition}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-3">
                <span>Last LiDAR Update:</span>
                <span>{finalLidarData?.timestamp ? formatTimeSince(finalLidarData.timestamp) : 'No data'}</span>
              </div>
              
              {/* Add button to launch layered map visualization */}
              <div className="mt-4">
                <Link to={`/layered-map/${serialNumber}`}>
                  <Button 
                    variant="outline" 
                    className="w-full flex items-center gap-2"
                    disabled={!serialNumber}
                  >
                    <MapIcon className="h-4 w-4" />
                    Open Layered Map View
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Manual Control Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RotateCw className="h-5 w-5 text-primary" />
                Manual Control
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DirectionalControl 
                serialNumber={serialNumber || ''} 
                disabled={connectionState !== 'connected'} 
              />
            </CardContent>
          </Card>
        </div>

        <div className="md:w-2/3">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle>Robot Information</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex items-center gap-1"
                  onClick={() => refreshData()}
                >
                  <RotateCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="h-[calc(100%-70px)]">
              <Tabs defaultValue="map" value={activeTab} onValueChange={setActiveTab} className="h-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="map" className="flex items-center gap-1">
                    <MapIcon className="h-4 w-4" />
                    Map
                  </TabsTrigger>
                  <TabsTrigger value="data" className="flex items-center gap-1">
                    <BarChart className="h-4 w-4" />
                    Data
                  </TabsTrigger>
                  <TabsTrigger value="layers" className="flex items-center gap-1">
                    <Layers className="h-4 w-4" />
                    Layers
                  </TabsTrigger>
                  <TabsTrigger value="camera" className="flex items-center gap-1">
                    <Camera className="h-4 w-4" />
                    Camera
                  </TabsTrigger>
                </TabsList>
                
                <div className="h-[calc(100%-50px)]">
                  <TabsContent value="map" className="h-full m-0">
                    <div className="h-full relative border rounded-md p-1 bg-gray-50">
                      {/* Enhanced Map Component */}
                      <MapComponent 
                        robotStatus={finalStatus} 
                        robotPosition={finalPosition} 
                        sensorData={finalSensors} 
                        mapData={finalMapData}
                        editable={true}
                        onMapUpdate={(updatedMap) => {
                          console.log('Map updated', updatedMap);
                          refreshData();
                        }}
                      />
                      
                      {/* Map Legend */}
                      <div className="absolute bottom-2 right-2 bg-white/90 rounded-md p-2 text-xs space-y-1 shadow-sm">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <span>Robot Location</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-red-500"></div>
                          <span>Obstacle</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span>Navigation Path</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="data" className="h-full m-0">
                    <div className="h-full border rounded-md p-4 bg-white overflow-auto">
                      <h3 className="text-lg font-medium mb-4">Historical Data</h3>
                      <p className="text-muted-foreground">
                        This section will display historical data for the robot including routes taken, tasks completed, and sensor readings over time.
                      </p>
                      
                      {/* Placeholder for historical data charts/tables */}
                      <div className="h-64 mt-4 border rounded-md flex items-center justify-center bg-gray-50">
                        <span className="text-muted-foreground">Historical data visualization will appear here</span>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="layers" className="h-full m-0">
                    <div className="h-full border rounded-md p-4 bg-white overflow-auto">
                      <h3 className="text-lg font-medium mb-4">Map Layers</h3>
                      <p className="text-muted-foreground">
                        This section allows configuration of different map layers to view various aspects of the robot's environment.
                      </p>
                      
                      {/* Placeholder for layer controls */}
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between p-2 border rounded-md">
                          <span>Obstacle Layer</span>
                          <Badge>Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded-md">
                          <span>Path Layer</span>
                          <Badge>Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded-md">
                          <span>Heatmap Layer</span>
                          <Badge variant="outline">Disabled</Badge>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  

                  
                  <TabsContent value="camera" className="h-full m-0">
                    <div className="h-full border rounded-md p-4 bg-white overflow-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium flex items-center gap-2">
                          <Camera className="h-5 w-5 text-primary" />
                          Onboard Camera
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {finalCameraData?.enabled ? 'Camera Active' : 'Camera Inactive'}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => toggleCamera(!finalCameraData?.enabled)}
                            className="flex items-center gap-1"
                          >
                            {finalCameraData?.enabled ? (
                              <>
                                <EyeOff className="h-4 w-4" />
                                Disable
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4" />
                                Enable
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {finalCameraData?.enabled ? (
                        <div className="space-y-4">
                          <div className="border rounded-md overflow-hidden aspect-video bg-gray-900 relative">
                            {finalCameraData?.streamUrl ? (
                              <div className="w-full h-full flex items-center justify-center">
                                {/* Use H264 streaming for better performance and reliability */}
                                <RobotH264Stream 
                                  serialNumber={serialNumber}
                                  className="w-full h-full"
                                />
                              </div>
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-white p-4">
                                <MonitorPlay className="h-8 w-8 mb-2 text-gray-400" />
                                <p className="text-center text-gray-400">Camera stream unavailable. The robot may be offline or the camera stream is not configured.</p>
                              </div>
                            )}
                            
                            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                              Live Feed
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <Card>
                              <CardHeader className="py-2">
                                <CardTitle className="text-sm">Camera Settings</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2 py-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Resolution:</span>
                                  <span>{finalCameraData?.resolution?.width || 0} x {finalCameraData?.resolution?.height || 0}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Rotation:</span>
                                  <span>{finalCameraData?.rotation || 0}°</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Night Vision:</span>
                                  <Badge variant={finalCameraData?.nightVision ? "default" : "outline"}>
                                    {finalCameraData?.nightVision ? "Enabled" : "Disabled"}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                            
                            <Card>
                              <CardHeader className="py-2">
                                <CardTitle className="text-sm">Stream Control</CardTitle>
                              </CardHeader>
                              <CardContent className="py-2">
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="flex items-center gap-1 w-full"
                                    disabled={!finalCameraData?.streamUrl}
                                  >
                                    <PlayCircle className="h-4 w-4" />
                                    Start Recording
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="flex items-center gap-1 w-full"
                                    disabled={!finalCameraData?.streamUrl}
                                  >
                                    <PauseCircle className="h-4 w-4" />
                                    Snapshot
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                          
                          <div className="text-xs text-muted-foreground text-right">
                            Last updated: {finalCameraData?.timestamp ? formatTimeSince(finalCameraData.timestamp) : 'N/A'}
                          </div>
                        </div>
                      ) : (
                        <div className="border rounded-md flex flex-col items-center justify-center p-8 bg-gray-50 h-64">
                          <Camera className="h-12 w-12 text-muted-foreground mb-4" />
                          <p className="text-center text-muted-foreground mb-4">
                            The robot's camera is currently disabled. Enable it to view the live camera feed.
                          </p>
                          <Button 
                            variant="default" 
                            onClick={() => toggleCamera(true)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            Enable Camera
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}