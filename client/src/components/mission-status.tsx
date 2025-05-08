// client/src/components/mission-status.tsx
import React from 'react';
import { useMissionStatus, Mission, MissionStep } from '@/hooks/use-mission-status';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertTriangle, WifiOff } from 'lucide-react';

interface MissionStatusProps {
  missionId?: string;
  onClose?: () => void;
}

export function MissionStatus({ missionId, onClose }: MissionStatusProps) {
  const { mission, activeMissions, loading, error, refetch } = useMissionStatus(missionId);
  
  // If specific mission ID provided, show just that mission
  if (missionId && mission) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {mission.name}
            {mission.offline && (
              <Badge variant="outline" className="flex items-center gap-1 bg-amber-100">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
            <StatusBadge status={mission.status} />
          </CardTitle>
          <CardDescription>
            Started: {new Date(mission.createdAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span>Progress: {mission.currentStepIndex} of {mission.steps.length} steps</span>
              <span>{Math.round((mission.currentStepIndex / mission.steps.length) * 100)}%</span>
            </div>
            <Progress value={(mission.currentStepIndex / mission.steps.length) * 100} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Steps:</h3>
            {mission.steps.map((step, index) => (
              <StepItem key={index} step={step} index={index} currentIndex={mission.currentStepIndex} />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={refetch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Refresh
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }
  
  // If no specific mission ID, show all active missions
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Active Missions</CardTitle>
        <CardDescription>
          {activeMissions.length} mission(s) in progress
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : activeMissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active missions at this time
          </div>
        ) : (
          <div className="space-y-4">
            {activeMissions.map(mission => (
              <div key={mission.id} className="border rounded-md p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">{mission.name}</h3>
                  <div className="flex items-center gap-2">
                    {mission.offline && (
                      <Badge variant="outline" className="flex items-center gap-1 bg-amber-100">
                        <WifiOff className="h-3 w-3" /> Offline
                      </Badge>
                    )}
                    <StatusBadge status={mission.status} />
                  </div>
                </div>
                
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress: {mission.currentStepIndex} of {mission.steps.length} steps</span>
                    <span>{Math.round((mission.currentStepIndex / mission.steps.length) * 100)}%</span>
                  </div>
                  <Progress value={(mission.currentStepIndex / mission.steps.length) * 100} className="h-1.5" />
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Started: {new Date(mission.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={refetch} disabled={loading} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Refresh Status
        </Button>
      </CardFooter>
    </Card>
  );
}

function StatusBadge({ status }: { status: Mission['status'] }) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="bg-blue-100">Pending</Badge>;
    case 'in_progress':
      return <Badge variant="outline" className="bg-yellow-100">In Progress</Badge>;
    case 'completed':
      return <Badge variant="outline" className="bg-green-100">Completed</Badge>;
    case 'failed':
      return <Badge variant="outline" className="bg-red-100">Failed</Badge>;
    default:
      return null;
  }
}

function StepItem({ step, index, currentIndex }: { step: MissionStep; index: number; currentIndex: number }) {
  const isActive = index === currentIndex;
  const isPast = index < currentIndex;
  const isFuture = index > currentIndex;
  
  return (
    <div className={`flex items-start gap-2 p-2 rounded ${isActive ? 'bg-blue-50' : ''}`}>
      <div className="mt-0.5">
        {isPast ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : isActive ? (
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        ) : step.errorMessage ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : (
          <div className="h-4 w-4 rounded-full border border-gray-300" />
        )}
      </div>
      
      <div className="flex-1">
        <div className={`text-sm font-medium ${isFuture ? 'text-gray-500' : ''}`}>
          {index + 1}. {step.type.replace('_', ' ')}
          {step.params.label && ` - ${step.params.label}`}
        </div>
        
        {step.errorMessage && (
          <div className="text-xs text-red-500 mt-1">{step.errorMessage}</div>
        )}
        
        {step.completed && (
          <div className="text-xs text-green-500 mt-1">Completed</div>
        )}
      </div>
    </div>
  );
}