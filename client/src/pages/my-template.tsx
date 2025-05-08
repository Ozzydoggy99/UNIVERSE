// client/src/pages/my-template.tsx
import React, { useState } from 'react';
import { useRobotMapData } from '@/hooks/use-robot-map-data';
import { useSimplifiedRobotTask } from '@/hooks/use-simplified-robot-task';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Point } from '@/types/robot';
import { Loader2 } from 'lucide-react';

export default function MyTemplatePage() {
  const { data, loading, error } = useRobotMapData();
  const { assignTask, loading: taskLoading, error: taskError, success } = useSimplifiedRobotTask();
  
  const [mode, setMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [floor, setFloor] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<Point | null>(null);

  if (loading) return <p className="p-4">Loading map data...</p>;
  if (error || !data) return <p className="p-4">Error loading map data: {error}</p>;

  const handleConfirm = async () => {
    if (!selectedShelf || !floor || !mode || !data.specialPoints) return;

    const taskRequest = {
      mode,
      shelf: selectedShelf,
      pickup: data.specialPoints.pickup,
      dropoff: data.specialPoints.dropoff,
      standby: data.specialPoints.standby,
    };

    console.log('Sending AutoXing task request:', taskRequest);
    await assignTask(taskRequest);
  };

  return (
    <div className="p-4 space-y-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold text-center">Robot Mission Control</h1>

      {/* Step 1: Select Mode */}
      {!mode && (
        <Card className="p-4 flex flex-col gap-4">
          <h2 className="text-lg">Select Mode</h2>
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
          <p>Robot is on the move...</p>
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