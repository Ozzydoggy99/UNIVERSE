// client/src/pages/my-template.tsx
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogOut } from "lucide-react";
import { useSimplifiedRobotTask } from "@/hooks/use-simplified-robot-task";

export default function MyTemplate() {
  const [mode, setMode] = useState<"pickup" | "dropoff">("pickup");
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { user, logoutMutation } = useAuth();
  
  // Use our custom hook to manage robot tasks
  const { 
    floorMap, 
    isLoading, 
    error, 
    isRunning, 
    runTask 
  } = useSimplifiedRobotTask();

  // Handle the task execution
  const handleGo = async () => {
    if (!selectedShelf) return;
    
    setStatus("Running task...");
    
    try {
      // Use our custom hook to run the task
      runTask(mode, selectedShelf);
      setStatus("✅ Task completed successfully");
    } catch (err: any) {
      setStatus(`❌ Task failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Provide floor-specific colors for visual distinction
  const floorColor = (floor: string) => {
    const colors: Record<string, string> = {
      "1": "#ef4444", // Red
      "2": "#22c55e", // Green
      "3": "#3b82f6", // Blue
      "4": "#a855f7", // Purple
      "5": "#ec4899", // Pink
      "6": "#f97316", // Orange
    };
    return colors[floor] || "#6b7280"; // Default gray
  };

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show error if points couldn't be loaded
  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error 
              ? error.message 
              : "Failed to load map points from the robot"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header with mode selection and user info */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Robot Service</h1>
          <div className="flex gap-2">
            <Button
              variant={mode === "pickup" ? "default" : "outline"}
              onClick={() => setMode("pickup")}
            >
              Pickup
            </Button>
            <Button
              variant={mode === "dropoff" ? "default" : "outline"}
              onClick={() => setMode("dropoff")}
            >
              Dropoff
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{user?.username || "User"}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logoutMutation.mutate()}
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Floor selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Floor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.keys(floorMap).map((floor) => (
              <Button
                key={floor}
                onClick={() => {
                  setSelectedFloor(floor);
                  setSelectedShelf(null); // Clear shelf selection when floor changes
                }}
                variant={selectedFloor === floor ? "default" : "outline"}
                className={`px-6 py-8 text-lg`}
                style={{
                  backgroundColor: selectedFloor === floor ? floorColor(floor) : undefined,
                  borderColor: floorColor(floor),
                  color: selectedFloor === floor ? "white" : floorColor(floor),
                }}
              >
                Floor {floor}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Shelf selection (only shown if a floor is selected) */}
      {selectedFloor && (
        <Card>
          <CardHeader>
            <CardTitle>Select Shelf Point on Floor {selectedFloor}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {floorMap[selectedFloor]?.map((point) => (
                <Button
                  key={point.id}
                  onClick={() => setSelectedShelf(point.id)}
                  variant={selectedShelf === point.id ? "default" : "outline"}
                  className="py-6"
                >
                  {point.id}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm button (only shown if a shelf is selected) */}
      {selectedShelf && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center text-lg">
                {mode === "pickup" ? "Pick up from" : "Drop off at"} <strong>{selectedShelf}</strong>
              </div>
              <Button
                onClick={handleGo}
                disabled={isRunning}
                className="w-full py-6 text-lg"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Running Task...
                  </>
                ) : (
                  "Confirm and Run Task"
                )}
              </Button>

              {/* Show task status */}
              {status && (
                <div className={`text-center py-2 ${status.includes("✅") ? "text-green-600" : "text-red-600"}`}>
                  {status}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}