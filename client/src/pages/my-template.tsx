// client/src/pages/my-template.tsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useRobotMapData } from '@/hooks/use-robot-map-data';
import { useSimplifiedRobotTask } from '@/hooks/use-simplified-robot-task';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Point } from '@/types/robot';
import { Loader2, ListIcon, WifiOff, ShowerHead, Trash2, LogOut } from 'lucide-react';
import { MissionStatus } from '@/components/mission-status';

export default function MyTemplatePage() {
  const { data, loading, error } = useRobotMapData();
  const { assignTask, loading: taskLoading, error: taskError, success, isCharging, lastTaskResult, latestMissionId } = useSimplifiedRobotTask();
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  
  // If this is Phil's account, we want to use the new dynamic workflow
  useEffect(() => {
    // Check if user has templateId 1 (Phil's template)
    if (user && user.username === "Phil") {
      // Automatically redirect to new workflow page
      // Comment out to disable auto-redirect
      // navigate('/workflow');
    }
  }, [user, navigate]);
  
  const [mode, setMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [floor, setFloor] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<Point | null>(null);
  const [showMissionStatus, setShowMissionStatus] = useState<boolean>(false);
  
  // Navigate to new workflow
  const goToNewWorkflow = () => {
    navigate('/workflow');
  };
  
  // Modified point type to ensure name property exists
  const ensureName = (point: Point): Point => {
    return {
      ...point,
      name: point.name || `Point ${point.id}`
    };
  };

  if (loading) return <p className="p-4">Loading map data...</p>;
  if (error || !data) return <p className="p-4">Error loading map data: {error}</p>;

  const handleConfirm = async () => {
    if (!selectedShelf || !floor || !mode || !data.specialPoints) return;
    
    // Ensure that all required special points exist
    if (!data.specialPoints.pickup || !data.specialPoints.dropoff || !data.specialPoints.standby) {
      console.error("Missing required special points", data.specialPoints);
      return;
    }

    // Create fallback points in case some are missing (this should never happen, but prevents TypeScript errors)
    const defaultPoint: Point = { id: 'default', x: 0, y: 0, ori: 0 };
    
    // Use the actual points or fallbacks if somehow missing
    const pickupPoint = data.specialPoints.pickup || defaultPoint;
    const dropoffPoint = data.specialPoints.dropoff || defaultPoint;
    const standbyPoint = data.specialPoints.standby || defaultPoint;

    // Ensure all points have the required name property
    const taskRequest = {
      mode,
      shelf: ensureName(selectedShelf),
      pickup: ensureName(pickupPoint),
      dropoff: ensureName(dropoffPoint),
      standby: ensureName(standbyPoint),
    };

    console.log('Sending AutoXing task request:', taskRequest);
    await assignTask(taskRequest);
  };

  return (
    <div className="p-4 space-y-6 max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Robot Mission Control</h1>
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-sm">{user.username}</span>
            <button 
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5"
              onClick={() => logoutMutation.mutate()}
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      
      {/* New UI Workflow Button */}
      {user && user.username === "Phil" && (
        <Card className="p-4 bg-green-50 border-green-100">
          <h2 className="text-lg font-semibold text-green-700 mb-2">New Simplified Interface</h2>
          <p className="text-sm mb-3">Use our new step-by-step workflow interface designed to make robot control easier.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate('/workflow')}
              className="bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <ShowerHead className="h-5 w-5" />
              Laundry
            </Button>
            <Button
              onClick={() => navigate('/workflow')}
              className="bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Trash2 className="h-5 w-5" />
              Trash
            </Button>
          </div>
        </Card>
      )}

      {/* Step 1: Select Mode */}
      {!mode && (
        <Card className="p-4 flex flex-col gap-4">
          <h2 className="text-lg">Legacy Control Panel</h2>
          <Button onClick={() => setMode('pickup')}>Pickup</Button>
          <Button onClick={() => setMode('dropoff')}>Dropoff</Button>
        </Card>
      )}

      {/* Step 2: Select Floor */}
      {mode && !floor && (
        <Card className="p-4 flex flex-col gap-4">
          <h2 className="text-lg">Select Floor</h2>
          {data.allFloors.map(f => (
            <Button key={f} onClick={() => setFloor(f)}>
              Floor {f}
            </Button>
          ))}
        </Card>
      )}

      {/* Step 3: Select Shelf */}
      {mode && floor && !selectedShelf && (
        <Card className="p-4 flex flex-col gap-4">
          <h2 className="text-lg">Select Shelf</h2>
          {data.shelvesByFloor[floor]?.map(p => (
            <Button key={p.id} onClick={() => setSelectedShelf(p)}>
              Shelf {p.id}
            </Button>
          ))}
        </Card>
      )}

      {/* Step 4: Confirm Mission */}
      {mode && floor && selectedShelf && !success && (
        <Card className="p-4 flex flex-col gap-4">
          <h2 className="text-lg">Confirm Mission</h2>
          <p>Mode: <strong>{mode}</strong></p>
          <p>Floor: <strong>{floor}</strong></p>
          <p>Shelf: <strong>{selectedShelf.id}</strong></p>
          
          {isCharging && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 p-2 rounded-md mb-2">
              <p><strong>⚠️ Robot is currently charging</strong></p>
              <p className="text-sm">The mission will be completed in simplified mode without bin operations.</p>
            </div>
          )}
          
          {taskError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded-md mb-2">
              {taskError}
            </div>
          )}
          
          <Button 
            onClick={handleConfirm} 
            disabled={taskLoading}
          >
            {taskLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm & Launch'
            )}
          </Button>
        </Card>
      )}

      {/* Task submitted successfully */}
      {success && (
        <Card className="p-4 text-center">
          <h2 className="text-lg font-semibold">Task Submitted ✅</h2>
          
          {lastTaskResult && lastTaskResult.charging ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 p-2 rounded-md my-2 text-left">
              <p><strong>⚠️ Robot is charging</strong></p>
              <p>Task completed in simplified mode without bin operations.</p>
              {lastTaskResult.duration && (
                <p className="text-xs mt-1">Duration: {Math.round(lastTaskResult.duration / 1000)}s</p>
              )}
            </div>
          ) : (
            <p>Robot has started the mission.</p>
          )}
          
          {latestMissionId && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                <WifiOff className="h-4 w-4" />
                <span>Mission will continue even if robot leaves WiFi range</span>
              </div>
              
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={() => setShowMissionStatus(!showMissionStatus)}
              >
                <ListIcon className="h-4 w-4" />
                {showMissionStatus ? "Hide Mission Status" : "Show Mission Status"}
              </Button>
              
              {showMissionStatus && (
                <div className="mt-2">
                  <MissionStatus missionId={latestMissionId} />
                </div>
              )}
            </div>
          )}
          
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
          >
            Start New Task
          </Button>
        </Card>
      )}
    </div>
  );
}