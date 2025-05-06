// client/src/pages/robot-mission-page.tsx
import { FC } from "react";
import { useRobotMapPoints } from "@/hooks/use-robot-map-points";
import MissionControl from "@/components/robot-mission/MissionControl";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const RobotMissionPage: FC = () => {
  const { categorized, isLoading, error } = useRobotMapPoints();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Robot Mission Control</h1>
        <p className="text-muted-foreground">Schedule pickup and dropoff tasks for the robot</p>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading map points...</span>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading map points</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load map points from the robot."}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <MissionControl shelfPoints={categorized.shelves} />
          </div>
          <div>
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Map Points Summary</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Pickup Point</h3>
                  <p>
                    {categorized.pickup ? (
                      <>
                        {categorized.pickup.id} ({categorized.pickup.x.toFixed(2)}, {categorized.pickup.y.toFixed(2)})
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">No pickup point defined</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Dropoff Point</h3>
                  <p>
                    {categorized.dropoff ? (
                      <>
                        {categorized.dropoff.id} ({categorized.dropoff.x.toFixed(2)}, {categorized.dropoff.y.toFixed(2)})
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">No dropoff point defined</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Standby Point</h3>
                  <p>
                    {categorized.standby ? (
                      <>
                        {categorized.standby.id} ({categorized.standby.x.toFixed(2)}, {categorized.standby.y.toFixed(2)})
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">No standby point defined</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Available Shelf Points</h3>
                  {categorized.shelves.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {categorized.shelves.map((shelf) => (
                        <li key={shelf.id}>
                          {shelf.id} ({shelf.x.toFixed(2)}, {shelf.y.toFixed(2)})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground italic">No shelf points available</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default RobotMissionPage;