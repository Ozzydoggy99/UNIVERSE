// client/src/components/robot-mission/MissionControl.tsx
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface MissionControlProps {
  shelfPoints: Array<{ id: string; name?: string; description?: string }>;
}

export function MissionControl({ shelfPoints }: MissionControlProps) {
  const [mode, setMode] = useState<"pickup" | "dropoff">("pickup");
  const [selectedShelf, setSelectedShelf] = useState<string>("");

  // Mission execution mutation
  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: async (data: { mode: "pickup" | "dropoff"; shelfId: string }) => {
      const response = await apiRequest("POST", "/api/robot-task", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mission started",
        description: `Robot is now executing the ${mode} mission for shelf ${selectedShelf}`,
      });
    },
    onError: (err: Error) => {
      console.error("Mission execution error:", err);
      toast({
        variant: "destructive",
        title: "Mission failed",
        description: err.message || "Could not start the robot mission",
      });
    },
  });

  // Handle form submission
  const handleSubmit = () => {
    if (!selectedShelf) {
      toast({
        variant: "destructive",
        title: "Missing shelf selection",
        description: "Please select a shelf before starting the mission",
      });
      return;
    }

    mutate({ mode, shelfId: selectedShelf });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Robot Mission Control</CardTitle>
        <CardDescription>
          Schedule a pickup or dropoff task for the robot
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Mission Type</h3>
            <RadioGroup
              value={mode}
              onValueChange={(value) => setMode(value as "pickup" | "dropoff")}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pickup" id="pickup" />
                <Label htmlFor="pickup" className="font-normal">
                  Pickup (Robot moves to shelf → dropoff → standby)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dropoff" id="dropoff" />
                <Label htmlFor="dropoff" className="font-normal">
                  Dropoff (Robot moves to pickup → shelf → standby)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-medium">Select Shelf</h3>
            <Select
              value={selectedShelf}
              onValueChange={setSelectedShelf}
              disabled={isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a shelf" />
              </SelectTrigger>
              <SelectContent>
                {shelfPoints.length > 0 ? (
                  shelfPoints.map((point) => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.name || point.description || point.id}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="loading" disabled>
                    No shelves available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error?.message || "Failed to start the mission"}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleSubmit}
          disabled={isPending || !selectedShelf}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting Mission...
            </>
          ) : (
            "Start Mission"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default MissionControl;