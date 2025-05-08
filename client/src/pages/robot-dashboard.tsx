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
              setPositionState(prev => ({
                ...prev,
                x: positionData.pos[0],
                y: positionData.pos[1],
                theta: positionData.ori || 0,
                floorId: positionData.floor_id || prev.floorId,
                mapName: positionData.map_name || prev.mapName,
                lastUpdated: Date.now()
              }));
            }
          }
          
          // Handle wheel state data
          if (message.category === 'status' && message.topic === '/wheel_state') {
            const wheelData = message.data;
            if (wheelData) {
              setWheelState({
                angularVelocities: Array.isArray(wheelData.angular_velocities) 
                  ? wheelData.angular_velocities 
                  : [0, 0, 0, 0],
                speeds: Array.isArray(wheelData.speeds) 
                  ? wheelData.speeds 
                  : [0, 0, 0, 0],
                lastUpdated: Date.now()
              });
            }
          }
          
          // Handle SLAM state data
          if (message.category === 'status' && message.topic === '/slam/state') {
            const slamData = message.data;
            if (slamData) {
              setSlamState({
                status: slamData.status || 'unknown',
                isLocalized: !!slamData.is_localized,
                matchingScore: slamData.matching_score,
                qualityScore: slamData.quality_score,
                lastUpdated: Date.now()
              });
            }
          }
          
          // Handle robot state changes
          if (message.category === 'status' && (message.topic === '/status' || message.topic === '/state')) {
            const statusData = message.data;
            if (statusData) {
              setStatusState(prev => ({
                ...prev,
                state: statusData.state || prev.state,
                mode: statusData.mode || prev.mode,
                lastUpdated: Date.now()
              }));
            }
          }
          
          // Handle task status updates
          if (message.category === 'task' || 
             (message.category === 'status' && message.topic === '/task_status')) {
            const taskData = message.data;
            if (taskData) {
              setTaskState({
                status: taskData.status || 'idle',
                taskId: taskData.task_id || taskData.id,
                current: taskData.current_action || taskData.action,
                progress: taskData.progress || 0,
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
        
        // Handle task notification messages
        if (message.type === 'task') {
          setTaskState(prev => ({
            ...prev,
            status: message.status || prev.status,
            taskId: message.taskId || message.id || prev.taskId,
            current: message.action || prev.current,
            progress: message.progress !== undefined ? message.progress : prev.progress,
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
            <div className="grid grid-cols-3 gap-4 mb-2">
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
            
            <div className="text-xs flex justify-between items-center mt-2 mb-1">
              <div>
                {positionState.floorId && (
                  <span className="inline-flex items-center mr-2">
                    <MapPin className="h-3 w-3 mr-1" />
                    Floor: {positionState.floorId}
                  </span>
                )}
              </div>
              <div className="text-right text-muted-foreground">
                Updated: {getTimeSince(positionState.lastUpdated)}
              </div>
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
                <div className="text-sm text-muted-foreground">
                  State: {statusState.state || 'unknown'} 
                  {statusState.mode && ` / ${statusState.mode}`}
                </div>
              </div>
            </div>
            <div className="text-sm text-right text-muted-foreground">
              Updated: {getTimeSince(statusState.lastUpdated)}
            </div>
          </CardContent>
        </Card>

        {/* SLAM State Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <LocateFixed className="mr-2 h-4 w-4" /> SLAM Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center mb-3">
              {slamState.isLocalized ? (
                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 mb-2">
                  Localized
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200 mb-2">
                  Not Localized
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
              <div>Status: {slamState.status || 'Unknown'}</div>
              <div>Match: {(slamState.matchingScore || 0).toFixed(2)}</div>
              <div>Quality: {(slamState.qualityScore || 0).toFixed(2)}</div>
              <div>Updated: {getTimeSince(slamState.lastUpdated)}</div>
            </div>
          </CardContent>
        </Card>
        
        {/* Wheel State Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Cog className="mr-2 h-4 w-4" /> Wheel Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Angular Velocities</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {wheelState.angularVelocities.map((v, i) => (
                    <div key={`ang-${i}`} className="flex justify-between">
                      <span>W{i+1}:</span>
                      <span>{v.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Wheel Speeds</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {wheelState.speeds.map((s, i) => (
                    <div key={`spd-${i}`} className="flex justify-between">
                      <span>S{i+1}:</span> 
                      <span>{s.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-xs text-right text-muted-foreground">
              Updated: {getTimeSince(wheelState.lastUpdated)}
            </div>
          </CardContent>
        </Card>
        
        {/* Task Status Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Activity className="mr-2 h-4 w-4" /> Current Task
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">
                  {taskState.status === 'idle' ? 'No Active Task' : taskState.status}
                </span>
                {taskState.taskId && (
                  <Badge variant="outline" className="text-xs">
                    ID: {taskState.taskId}
                  </Badge>
                )}
              </div>
              {taskState.current && (
                <div className="text-sm">
                  Action: {taskState.current}
                </div>
              )}
            </div>
            
            {typeof taskState.progress === 'number' && taskState.progress > 0 && (
              <div className="my-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>Progress</span>
                  <span>{taskState.progress}%</span>
                </div>
                <Progress value={typeof taskState.progress === 'number' ? taskState.progress : 0} className="h-1.5" />
              </div>
            )}
            
            <div className="text-xs text-right text-muted-foreground mt-2">
              Updated: {getTimeSince(taskState.lastUpdated)}
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
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Task Status</CardTitle>
              <CardDescription>Current and recent robot task activities</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Current Task Status */}
              <div className="mb-6 p-4 border rounded-lg">
                <h3 className="text-sm font-semibold mb-2 flex items-center">
                  <Activity className="h-4 w-4 mr-2" /> Current Task Status
                </h3>
                
                {taskState.status === 'idle' || !taskState.taskId ? (
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    <div className="text-center">
                      <div className="mb-2">No Active Task</div>
                      <div className="text-xs">Robot is waiting for new assignments</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <div className="font-medium">{taskState.status}</div>
                        {taskState.current && (
                          <div className="text-sm text-muted-foreground">
                            {taskState.current}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline">
                        ID: {taskState.taskId}
                      </Badge>
                    </div>
                    
                    {typeof taskState.progress === 'number' && taskState.progress > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Progress</span>
                          <span>{taskState.progress}%</span>
                        </div>
                        <Progress value={typeof taskState.progress === 'number' ? taskState.progress : 0} className="h-2" />
                      </div>
                    )}
                    
                    <div className="text-right text-xs text-muted-foreground">
                      Last Updated: {getTimeSince(taskState.lastUpdated)}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Task Info */}
              <div className="mb-3">
                <h3 className="text-sm font-semibold mb-2">Task Monitoring Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="border rounded-lg p-3 hover:bg-accent transition-colors">
                    <div className="font-medium mb-1 flex items-center">
                      <Truck className="h-4 w-4 mr-2" /> Pickup/Dropoff Tasks
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Monitor and manage shelf service tasks
                    </p>
                    <a href="/admin-tasks" className="text-xs text-primary hover:underline">
                      Open Task Monitor →
                    </a>
                  </div>
                  
                  <div className="border rounded-lg p-3 hover:bg-accent transition-colors">
                    <div className="font-medium mb-1 flex items-center">
                      <Navigation className="h-4 w-4 mr-2" /> Map-Based Control
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      View map points and send the robot to specific locations
                    </p>
                    <a href="/map-data-test" className="text-xs text-primary hover:underline">
                      Open Map Interface →
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 text-xs text-center text-muted-foreground">
                <p>
                  The robot is actively subscribing to topics including position, battery, 
                  wheel state, SLAM state, and tasks.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}