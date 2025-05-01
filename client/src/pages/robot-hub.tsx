import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, Map, Bluetooth, Cpu } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { RobotTemplateAssignment } from '@shared/schema';
import { RobotStatus, RobotPosition, RobotSensorData as RobotSensor, MapData, CameraData } from '@/types/robot';

export default function RobotHub() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Fetch all robot assignments
  const { data: robotAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['/api/robot-assignments'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch all templates for dropdown
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/templates'],
  });

  // Fetch robot statuses
  const { data: robotStatuses, isLoading: statusesLoading } = useQuery<Record<string, RobotStatus>>({
    queryKey: ['/api/robots/statuses'],
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: !!robotAssignments,
  });

  // Determine if we're still loading data
  const isLoading = assignmentsLoading || templatesLoading || statusesLoading;
  
  // Navigate to unassigned robots page
  const handleViewUnassignedClick = () => {
    navigate('/unassigned-robots');
  };

  // Handle card click
  const handleRobotCardClick = (serialNumber: string) => {
    navigate(`/robot-details/${serialNumber}`);
  };

  // Get status color based on robot status
  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-500';
    
    switch (status.toLowerCase()) {
      case 'active':
      case 'running':
      case 'online':
        return 'bg-green-500';
      case 'idle':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-amber-500';
      case 'charging':
        return 'bg-purple-500';
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Add our physical robot status in case we need it
  const physicalRobotInfo = {
    serialNumber: 'L382502104987ir',
    model: 'AxBot Physical Robot (Live)'
  };

  // Special function to get status for the physical robot directly
  const { data: physicalRobotStatus, isLoading: isPhysicalRobotStatusLoading } = useQuery<RobotStatus>({
    queryKey: ['/api/robots/status', physicalRobotInfo.serialNumber],
    refetchInterval: 2000, // Faster refresh rate for more responsive UI
  });

  // Log robot status when available
  React.useEffect(() => {
    if (physicalRobotStatus) {
      console.log('Fetched robot data for', physicalRobotInfo.serialNumber, physicalRobotStatus);
    }
  }, [physicalRobotStatus]);

  // Get physical robot position for showing real-time coordinates
  const { data: physicalRobotPosition } = useQuery<RobotPosition>({
    queryKey: ['/api/robots/position', physicalRobotInfo.serialNumber],
    refetchInterval: 2000, // Faster refresh rate
  });

  // Get physical robot sensor data for complete information
  const { data: physicalRobotSensor } = useQuery<RobotSensor>({
    queryKey: ['/api/robots/sensors', physicalRobotInfo.serialNumber],
    refetchInterval: 2000, // Faster refresh rate
  });

  // If we're still loading data, show a loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Robot Management Dashboard</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleViewUnassignedClick}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium flex items-center gap-1.5"
          >
            <Bot className="h-4 w-4" />
            View Unassigned Robots
          </button>
          <Badge variant="outline" className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500"></span>
            Live Robot Data
          </Badge>
        </div>
      </div>

      {/* Physical Robot Card */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Cpu className="mr-2 h-5 w-5 text-primary" />
          Physical Robot (Live Connection)
        </h2>
        
        <Card className={`border-2 ${physicalRobotStatus ? 'border-primary' : 'border-red-500'} cursor-pointer hover:shadow-lg transition-shadow`}
              onClick={() => handleRobotCardClick(physicalRobotInfo.serialNumber)}>
          {!physicalRobotStatus && (
            <div className="absolute right-0 left-0 top-0 bg-red-500 text-white px-4 py-1 text-sm font-medium text-center">
              Robot Offline - Connection Issues
            </div>
          )}
          <CardHeader className={`pb-2 ${physicalRobotStatus ? 'bg-primary/10' : 'bg-red-500/10'}`}>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className={`h-5 w-5 ${physicalRobotStatus ? 'text-primary' : 'text-red-500'}`} />
                {physicalRobotInfo.model}
              </CardTitle>
              <Badge className={getStatusColor(physicalRobotStatus ? 'online' : 'offline')}>
                {physicalRobotStatus ? 'ONLINE' : 'OFFLINE'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Serial Number</div>
                  <div className="font-mono text-sm">{physicalRobotInfo.serialNumber}</div>
                </div>
                
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Status</div>
                  <div className={`font-medium ${!physicalRobotStatus && 'text-red-500'}`}>
                    {physicalRobotStatus ? 'Ready' : 'Unable to establish connection'}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Battery</div>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      {physicalRobotSensor && (
                        <div 
                          className={`h-2.5 rounded-full ${
                            physicalRobotSensor.power_supply_status === 'charging' ? 'bg-purple-500' :
                            Number(physicalRobotSensor.battery) > 60 ? 'bg-green-500' : 
                            Number(physicalRobotSensor.battery) > 30 ? 'bg-yellow-500' : 
                            'bg-red-500'
                          }`}
                          style={{ width: `${Number(physicalRobotSensor.battery) || 0}%` }}
                        ></div>
                      )}
                    </div>
                    <span className="text-xs font-medium">
                      {physicalRobotSensor ? (
                        <>
                          {Number(physicalRobotSensor.battery || 0).toFixed(0)}%
                          {physicalRobotSensor.power_supply_status === 'charging' && ' (Charging)'}
                        </>
                      ) : '0%'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Current Position</div>
                  <div className="font-mono text-sm">
                    {physicalRobotPosition ? (
                      <>
                        X: {Number(physicalRobotPosition.x).toFixed(3)}, 
                        Y: {Number(physicalRobotPosition.y).toFixed(3)}, 
                        Z: {Number(physicalRobotPosition.z || 0).toFixed(3)}
                      </>
                    ) : 'Position data unavailable'}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Orientation</div>
                  <div className="font-mono text-sm">
                    {physicalRobotPosition ? 
                      `${(Number(physicalRobotPosition.orientation) * (180/Math.PI)).toFixed(1)}°` : 
                      'Orientation unavailable'}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Sensors</div>
                  <div className="font-mono text-sm">
                    {physicalRobotSensor ? (
                      <>
                        Temp: {Number(physicalRobotSensor.temperature || 0).toFixed(1)}°C, 
                        Voltage: {Number(physicalRobotSensor.voltage || 0).toFixed(1)}V, 
                        Current: {Number(physicalRobotSensor.current || 0).toFixed(2)}A
                      </>
                    ) : 'Sensor data unavailable'}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-3 flex justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className={`flex h-2 w-2 rounded-full ${physicalRobotStatus ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>{physicalRobotStatus ? 'Live Data Connected' : 'Connection Failed'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Map className="h-3 w-3" />
              <span>View Detailed Dashboard</span>
            </div>
          </CardFooter>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mb-4">Assigned Robots</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.isArray(robotAssignments) && robotAssignments.length > 0 ? (
          robotAssignments.map((robot: RobotTemplateAssignment) => {
            // Get the template name
            const template = Array.isArray(templates) 
              ? templates.find((t: any) => t.id === robot.templateId) 
              : undefined;
            
            // Get the robot status from API with fallback for unknown robots
            const robotStatus: RobotStatus = (robotStatuses && typeof robotStatuses === 'object' && robotStatuses[robot.serialNumber]) 
              ? robotStatuses[robot.serialNumber] 
              : { 
                  model: robot.serialNumber === physicalRobotInfo.serialNumber ? physicalRobotInfo.model : 'Unknown Robot',
                  serialNumber: robot.serialNumber,
                  status: 'unknown', 
                  mode: 'unknown', 
                  battery: 0,
                  lastUpdate: new Date().toISOString()
                };
            
            return (
              <Card 
                key={robot.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-primary"
                onClick={() => handleRobotCardClick(robot.serialNumber)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      {robot.name}
                    </CardTitle>
                    <Badge className={getStatusColor(robotStatus.status)}>
                      {robotStatus.status?.toUpperCase() || 'UNKNOWN'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Serial Number:</span>
                      <span className="font-mono">{robot.serialNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Template:</span>
                      <span>{template?.name || `Template #${robot.templateId}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-mono">
                        {robotStatus.location ? 
                          `Floor ${robotStatus.location.floor || '?'} (${robotStatus.location.x || '?'}, ${robotStatus.location.y || '?'})` : 
                          'Location unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Task:</span>
                      <span className="font-medium">{robotStatus.task || robotStatus.mode || 'Unknown'}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-4 flex justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Bluetooth className="h-3 w-3" />
                    <span>Connected</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Map className="h-3 w-3" />
                    <span>View Details</span>
                  </div>
                </CardFooter>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full text-center py-10 border rounded-lg bg-gray-50">
            <Bot className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-600">No Robots Found</h3>
            <p className="text-gray-500 mt-1">
              There are no robot assignments configured in the system.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}