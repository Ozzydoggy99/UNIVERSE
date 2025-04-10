import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, Map, Bluetooth, Cpu } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { RobotTemplateAssignment } from '@shared/schema';

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
  const { data: robotStatuses, isLoading: statusesLoading } = useQuery({
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

  // Generate placeholder data for development if needed
  const mockRobotStatuses = {
    'AX-2000-1': {
      status: 'active',
      task: 'Delivering packages',
      location: { x: 120, y: 80, floor: 2 },
    },
    'AX-2000-2': {
      status: 'idle',
      task: 'Awaiting instructions',
      location: { x: 85, y: 45, floor: 1 },
    },
    'AX-2000-3': {
      status: 'charging',
      task: 'Battery at 25%',
      location: { x: 220, y: 160, floor: 3 },
    },
  };

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
        <h1 className="text-2xl font-bold">Assigned Robots</h1>
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
            Live Status
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.isArray(robotAssignments) && robotAssignments.length > 0 ? (
          robotAssignments.map((robot: RobotTemplateAssignment) => {
            // Get the template name
            const template = Array.isArray(templates) 
              ? templates.find((t: any) => t.id === robot.templateId) 
              : undefined;
            
            // Get the robot status (either from API or use mock data)
            const robotStatus = (robotStatuses && typeof robotStatuses === 'object' && robot.serialNumber in robotStatuses) 
              ? robotStatuses[robot.serialNumber] 
              : (robot.serialNumber in mockRobotStatuses) 
                ? mockRobotStatuses[robot.serialNumber as keyof typeof mockRobotStatuses] 
                : { status: 'unknown', task: 'Status unknown', location: { x: 0, y: 0, floor: 0 } };
            
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