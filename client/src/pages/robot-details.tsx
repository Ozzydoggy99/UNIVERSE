import React, { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
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
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth';
import { useRobot } from '@/providers/robot-provider';
import { Map } from '@/components/ui/map';

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
    connectionState, 
    connectWebSocket, 
    disconnectWebSocket, 
    isConnected,
    refreshData
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

  // Handle back button click
  const handleBack = () => {
    navigate('/robot-hub');
  };

  // Request data refresh if we detect the data is missing
  useEffect(() => {
    // If WebSocket is connected, periodically request fresh data
    const intervalId = setInterval(() => {
      if (isConnected()) {
        refreshData();
      }
    }, 5000);
    
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
        <Button variant="outline" className="mb-6" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Robot Hub
        </Button>
        
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

  // Fallback data for development/display purposes
  const mockStatus: RobotStatus = {
    model: 'AxBot 2000',
    serialNumber: serialNumber || 'AX-2000-1',
    battery: 78,
    status: 'charging',  // Changed to charging for testing
    mode: 'autonomous',
    lastUpdate: new Date().toISOString()
  };

  const mockPosition: RobotPosition = {
    x: 120,
    y: 80,
    z: 0,
    orientation: 90,
    speed: 1.2,
    timestamp: new Date().toISOString()
  };

  const mockSensorData: RobotSensorData = {
    temperature: 23.5,
    humidity: 48,
    proximity: [0.5, 1.2, 2.5, 1.8],
    battery: 78,
    timestamp: new Date().toISOString()
  };

  const mockMapData = {
    grid: [],
    obstacles: [
      { x: 50, y: 50, z: 0 },
      { x: 100, y: 120, z: 0 },
      { x: 200, y: 80, z: 0 }
    ],
    paths: [
      {
        points: [
          { x: 50, y: 50, z: 0 },
          { x: 75, y: 75, z: 0 },
          { x: 100, y: 100, z: 0 },
          { x: 120, y: 80, z: 0 }
        ],
        status: 'active'
      }
    ]
  };

  // Prioritize WebSocket data, then REST API data, then fallback to cached or mock data
  const status = wsRobotStatus || restRobotStatus || mockStatus;
  const position = wsRobotPosition || restRobotPosition || mockPosition;
  const sensors = wsSensorData || restSensorData || mockSensorData;
  const mapDataToUse = wsMapData || restMapData || mockMapData;
  
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
      <Button variant="outline" className="mb-6" onClick={handleBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Robot Hub
      </Button>

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
                <Badge className={getStatusColor(status.status)}>
                  {status.status?.toUpperCase() || 'UNKNOWN'}
                </Badge>
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
                  <span>{status.model}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mode:</span>
                  <Badge variant="outline">{status.mode?.toUpperCase() || 'UNKNOWN'}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Update:</span>
                  <span>{formatTimeSince(status.lastUpdate)}</span>
                </div>
              </div>

              <Separator />

              {/* Battery Status */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="flex items-center gap-1 text-sm">
                    {status.status?.toLowerCase() === 'charging' ? (
                      <BatteryCharging className="h-4 w-4 text-purple-500" />
                    ) : sensors.battery >= 90 ? (
                      <BatteryFull className="h-4 w-4 text-green-500" />
                    ) : sensors.battery >= 50 ? (
                      <BatteryMedium className="h-4 w-4 text-green-500" />
                    ) : sensors.battery >= 20 ? (
                      <BatteryLow className="h-4 w-4 text-amber-500" />
                    ) : (
                      <BatteryWarning className="h-4 w-4 text-red-500" />
                    )}
                    Battery
                  </span>
                  <span className="font-medium flex items-center gap-1">
                    {sensors.battery}%
                    {status.status?.toLowerCase() === 'charging' ? (
                      <span className="inline-flex items-center">
                        <span className="inline-block w-3.5 h-3.5 rounded-full bg-purple-500 animate-pulse"></span>
                        <span className="ml-1 text-xs text-purple-500">Charging</span>
                      </span>
                    ) : status.status?.toLowerCase() === 'working' || status.status?.toLowerCase() === 'active' ? (
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
                      status.status?.toLowerCase() === 'charging' ? "bg-purple-500" :
                      status.status?.toLowerCase() === 'working' || status.status?.toLowerCase() === 'active' ? "bg-blue-500" :
                      sensors.battery >= 50 ? "bg-green-500" : 
                      sensors.battery >= 20 ? "bg-amber-500" : 
                      "bg-red-500"
                    }`}
                    style={{ width: `${sensors.battery}%` }}
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
                  <span className="font-mono">({position.x}, {position.y}, {position.z})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Orientation:</span>
                  <span>{position.orientation}°</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Speed:</span>
                  <span>{position.speed} m/s</span>
                </div>
              </div>
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
                <span className="font-medium">{sensors.temperature}°C</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-sm">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  Humidity
                </span>
                <span className="font-medium">{sensors.humidity}%</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-sm">
                  <Signal className="h-4 w-4 text-amber-500" />
                  Proximity
                </span>
                <span className="font-medium">{formatProximity(sensors.proximity)}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Last Sensor Update:</span>
                <span>{formatTimeSince(sensors.timestamp)}</span>
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
                </TabsList>
                
                <div className="h-[calc(100%-50px)]">
                  <TabsContent value="map" className="h-full m-0">
                    <div className="h-full relative border rounded-md p-1 bg-gray-50">
                      {/* Map Component */}
                      <Map 
                        robotStatus={status} 
                        robotPosition={position} 
                        sensorData={sensors} 
                        mapData={mapDataToUse} 
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
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}