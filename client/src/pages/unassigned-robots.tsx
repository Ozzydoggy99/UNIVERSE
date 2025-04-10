import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, Map, Bluetooth, Cpu, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { RobotTemplateAssignment } from '@shared/schema';
import { RobotStatus } from '@/types/robot';

export default function UnassignedRobots() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Fetch all robot assignments to determine which robots are already assigned
  const { data: robotAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['/api/robot-assignments'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch all robot statuses
  const { data: robotStatuses, isLoading: statusesLoading } = useQuery<Record<string, RobotStatus>>({
    queryKey: ['/api/robots/statuses'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Determine if we're still loading data
  const isLoading = assignmentsLoading || statusesLoading;

  // Navigate back to robot hub
  const handleBackClick = () => {
    navigate('/robot-hub');
  };

  // Handle card click
  const handleRobotCardClick = (serialNumber?: string) => {
    if (serialNumber) {
      navigate(`/robot-details/${serialNumber}`);
    }
  };

  // Filter out robots that are already assigned to templates
  const unassignedRobots = useMemo<RobotStatus[]>(() => {
    if (!robotStatuses || !robotAssignments) return [];

    const assignedSerialNumbers = Array.isArray(robotAssignments)
      ? robotAssignments.map((assignment: RobotTemplateAssignment) => assignment.serialNumber)
      : [];

    return Object.entries(robotStatuses)
      .filter(([serialNumber]) => !assignedSerialNumbers.includes(serialNumber))
      .map(([serialNumber, status]) => ({ 
        serialNumber, 
        ...status 
      }));
  }, [robotStatuses, robotAssignments]);

  // Get status color based on robot status
  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-500';
    
    switch (status.toLowerCase()) {
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
        <h1 className="text-2xl font-bold">Unassigned Robots</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBackClick}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium flex items-center gap-1.5"
          >
            <Bot className="h-4 w-4" />
            View Assigned Robots
          </button>
          <Badge variant="outline" className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500"></span>
            Live Status
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {unassignedRobots.length > 0 ? (
          unassignedRobots.map((robot) => robot.serialNumber && (
            <Card 
              key={robot.serialNumber} 
              className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-gray-400"
              onClick={() => handleRobotCardClick(robot.serialNumber as string)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5 text-gray-500" />
                    {robot.model || 'Unknown Model'}
                  </CardTitle>
                  <Badge className={getStatusColor(robot.status)}>
                    {robot.status?.toUpperCase() || 'UNKNOWN'}
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
                    <span className="text-amber-600 font-medium">Not Assigned</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Battery Level:</span>
                    <span className="font-medium">{robot.battery ? `${robot.battery}%` : 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mode:</span>
                    <span className="font-medium">{robot.mode || 'Unknown'}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-between">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card click when clicking button
                    navigate('/robot-assignments');
                  }}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Assign to Template
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-10 border rounded-lg bg-gray-50">
            <Bot className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-600">No Unassigned Robots</h3>
            <p className="text-gray-500 mt-1">
              All detected robots are currently assigned to templates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}