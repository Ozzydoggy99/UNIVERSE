// client/src/pages/robot-dashboard.tsx
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Battery, 
  Wifi, 
  Map as MapIcon, 
  RotateCw, 
  Box, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Activity,
  Compass,
  LocateFixed,
  Cpu,
  Gauge,
  Truck,
  Navigation,
  Cog,
  MapPin
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface RobotData {
  type: string;
  category?: string;
  topic?: string;
  status?: string;
  data?: any;
  error?: string;
  timestamp: number;
}

interface BatteryState {
  percentage: number;
  charging: boolean;
  voltage: number;
  current: number;
  temperature: number;
  lastUpdated: number;
}

interface PositionState {
  x: number;
  y: number;
  theta: number;
  floorId?: string;
  mapName?: string;
  lastUpdated: number;
}

interface StatusState {
  connected: boolean;
  status: string;
  state: string;
  mode: string;
  lastUpdated: number;
}

interface WheelState {
  angularVelocities: number[];
  speeds: number[];
  lastUpdated: number;
}

interface SlamState {
  status: string;
  isLocalized: boolean;
  matchingScore?: number;
  qualityScore?: number;
  lastUpdated: number;
}

interface TaskState {
  status: string;
  taskId?: string;
  current?: string;
  progress?: number;
  lastUpdated: number;
}

export default function RobotDashboardPage() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<RobotData[]>([]);
  const [batteryState, setBatteryState] = useState<BatteryState>({
    percentage: 0,
    charging: false,
    voltage: 0,
    current: 0,
    temperature: 0,
    lastUpdated: 0
  });
  const [positionState, setPositionState] = useState<PositionState>({
    x: 0,
    y: 0,
    theta: 0,
    floorId: '',
    mapName: '',
    lastUpdated: 0
  });
  const [statusState, setStatusState] = useState<StatusState>({
    connected: false,
    status: 'unknown',
    state: 'unknown',
    mode: 'unknown',
    lastUpdated: 0
  });
  const [wheelState, setWheelState] = useState<WheelState>({
    angularVelocities: [0, 0, 0, 0],
    speeds: [0, 0, 0, 0],
    lastUpdated: 0
  });
  const [slamState, setSlamState] = useState<SlamState>({
    status: 'unknown',
    isLocalized: false,
    matchingScore: 0,
    qualityScore: 0,
    lastUpdated: 0
  });
  const [taskState, setTaskState] = useState<TaskState>({
    status: 'idle',
    taskId: '',
    current: '',
    progress: 0,
    lastUpdated: 0
  });

  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/robot-ws`);
    
    socket.onopen = () => {
      console.log('Connected to robot WebSocket');
      setConnected(true);
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Store the last 20 messages 
        setMessages(prev => [message, ...prev.slice(0, 19)]);
        
        // Process specific message types
        if (message.type === 'data') {
          // Handle battery data
          if (message.category === 'status' && message.topic === '/battery_state') {
            const batteryData = message.data;
            if (batteryData && typeof batteryData.percentage === 'number') {
              setBatteryState({
                percentage: batteryData.percentage * 100,
                charging: batteryData.charging || false,
                voltage: batteryData.voltage || 0,
                current: batteryData.current || 0,
                temperature: batteryData.temperature || 0,
                lastUpdated: Date.now()
              });
            }
          }
          
          // Handle position data
          if (message.category === 'pose' && message.topic === '/tracked_pose') {
            const positionData = message.data;
            if (positionData && Array.isArray(positionData.pos) && positionData.pos.length >= 2) {
              setPositionState({
                x: positionData.pos[0],
                y: positionData.pos[1],
                theta: positionData.ori || 0,
                lastUpdated: Date.now()
              });
            }
          }
        }
        
        // Handle connection status
        if (message.type === 'connection') {
          setStatusState(prev => ({
            ...prev,
            connected: message.status === 'connected',
            status: message.status,
            lastUpdated: Date.now()
          }));
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      setConnected(false);
    };
    
    socket.onclose = () => {
      console.log('WebSocket connection closed');
      setConnected(false);
    };
    
    // Cleanup function
    return () => {
      socket.close();
    };
  }, []);

  const formatTime = (timestamp: number): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };
  
  const getTimeSince = (timestamp: number): string => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Robot Dashboard</h1>
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Battery Status Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Battery className="mr-2 h-4 w-4" /> Battery Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{batteryState.percentage.toFixed(1)}%</span>
              {batteryState.charging && (
                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                  Charging
                </Badge>
              )}
            </div>
            <Progress value={batteryState.percentage} className="h-2 mb-4" />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Voltage: {batteryState.voltage.toFixed(2)}V</div>
              <div>Current: {batteryState.current.toFixed(2)}A</div>
              <div>Temp: {batteryState.temperature.toFixed(1)}°C</div>
              <div>Updated: {getTimeSince(batteryState.lastUpdated)}</div>
            </div>
          </CardContent>
        </Card>
        
        {/* Position Data Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Compass className="mr-2 h-4 w-4" /> Position Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">X</div>
                <div className="text-lg font-medium">{positionState.x.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Y</div>
                <div className="text-lg font-medium">{positionState.y.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">θ</div>
                <div className="text-lg font-medium">{(positionState.theta * (180/Math.PI)).toFixed(1)}°</div>
              </div>
            </div>
            <div className="text-sm text-right text-muted-foreground">
              Updated: {getTimeSince(positionState.lastUpdated)}
            </div>
          </CardContent>
        </Card>
        
        {/* Connection Status Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Wifi className="mr-2 h-4 w-4" /> Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center mb-4">
              {connected ? (
                <CheckCircle2 className="h-8 w-8 text-green-500 mr-3" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500 mr-3" />
              )}
              <div>
                <div className="font-medium">{statusState.status || (connected ? 'Connected' : 'Disconnected')}</div>
                <div className="text-sm text-muted-foreground">State: {statusState.state || 'unknown'}</div>
              </div>
            </div>
            <div className="text-sm text-right text-muted-foreground">
              Updated: {getTimeSince(statusState.lastUpdated)}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="recent">
        <TabsList className="mb-4">
          <TabsTrigger value="recent">Recent Messages</TabsTrigger>
          <TabsTrigger value="taskStatus">Task Status</TabsTrigger>
        </TabsList>
        
        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent WebSocket Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages received yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg, i) => (
                      <div key={i} className="rounded border p-3 text-sm">
                        <div className="flex justify-between">
                          <div className="font-medium">
                            Type: {msg.type}
                            {msg.category && ` / ${msg.category}`}
                            {msg.topic && ` / ${msg.topic}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatTime(msg.timestamp)}
                          </div>
                        </div>
                        <div className="mt-1 break-all">
                          {msg.error ? (
                            <span className="text-red-500">{msg.error}</span>
                          ) : (
                            <code className="text-xs">
                              {JSON.stringify(msg.data || msg).slice(0, 150)}
                              {JSON.stringify(msg.data || msg).length > 150 ? '...' : ''}
                            </code>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="taskStatus">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Task Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Activity className="mx-auto h-8 w-8 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Robot Task Monitor</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  View real-time task execution status from the robot.
                </p>
                <div className="text-center">
                  <a href="/admin-tasks" className="text-primary hover:underline">
                    Open Task Monitor
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}