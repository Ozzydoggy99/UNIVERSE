// client/src/components/robot-mission/RobotBinTaskPanel.tsx
import { useState, useMemo } from "react";
import { useRobotMapData } from "@/hooks/use-robot-map-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface RobotBinTaskPanelProps {
  robotId: string;
}

export default function RobotBinTaskPanel({ robotId }: RobotBinTaskPanelProps) {
  const { numericPoints, isLoading, error } = useRobotMapData();
  
  // Create list of shelf points from numericPoints
  const shelfPoints = useMemo(() => {
    return numericPoints.map(point => point.id);
  }, [numericPoints]);

  // For compatibility with previous implementation
  const loading = isLoading;
  const [mode, setMode] = useState<"pickup" | "dropoff">("pickup");
  const [selectedShelf, setSelectedShelf] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const runTask = async () => {
    if (!selectedShelf) {
      toast({
        variant: "destructive",
        title: "Missing shelf selection",
        description: "Please select a shelf before starting the task"
      });
      return;
    }
    
    setStatus("Running task...");
    setIsRunning(true);

    try {
      const response = await apiRequest("/api/robot-task", {
        method: "POST",
        data: { mode, shelfId: selectedShelf }
      });

      const data = await response.json();
      
      if (data.success) {
        setStatus("✅ Task complete");
        toast({
          title: "Task completed",
          description: `Successfully completed the ${mode} task for shelf ${selectedShelf}`
        });
      } else {
        setStatus("❌ Task failed");
        toast({
          variant: "destructive",
          title: "Task failed",
          description: data.error || "Failed to complete the task"
        });
      }
    } catch (err: any) {
      setStatus("❌ Task failed");
      toast({
        variant: "destructive",
        title: "Task failed",
        description: err.message || "An error occurred while running the task"
      });
      console.error("Error running task:", err);
    } finally {
      setIsRunning(false);
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Robot Bin Task</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error.message || "Failed to load shelf points from the robot"}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Robot Bin Task</CardTitle>
        <CardDescription>Schedule pickup and dropoff tasks for robot {robotId}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Task Type</h3>
          <RadioGroup
            value={mode}
            onValueChange={(value) => setMode(value as "pickup" | "dropoff")}
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pickup" id="task-pickup" />
              <Label htmlFor="task-pickup" className="font-normal">
                Pick up from shelf
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dropoff" id="task-dropoff" />
              <Label htmlFor="task-dropoff" className="font-normal">
                Drop off to shelf
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium">Select Shelf</h3>
          <Select
            value={selectedShelf}
            onValueChange={setSelectedShelf}
            disabled={loading || isRunning}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a shelf point" />
            </SelectTrigger>
            <SelectContent>
              {loading ? (
                <SelectItem value="loading" disabled>
                  Loading shelves...
                </SelectItem>
              ) : shelfPoints.length > 0 ? (
                shelfPoints.map((point) => (
                  <SelectItem key={point} value={point}>
                    {point}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  No shelf points available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {status && (
          <Alert variant={status.includes("✅") ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Task Status</AlertTitle>
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={runTask}
          disabled={loading || isRunning || !selectedShelf}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Task...
            </>
          ) : (
            "Run Task"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}