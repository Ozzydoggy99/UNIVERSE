// client/src/pages/robot-mission-page.tsx
import { FC } from "react";
import { useRobotMapData } from "@/hooks/use-robot-map-data";
import { usePointDisplayNames } from "@/hooks/use-point-display-names";
import MissionControl from "@/components/robot-mission/MissionControl";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const RobotMissionPage: FC = () => {
  const { allPoints, namedPoints, numericPoints, specialPoints, isLoading: pointsLoading, error: pointsError } = useRobotMapData();
  const { getDisplayName, isLoading: mappingsLoading, error: mappingsError } = usePointDisplayNames();

  // Create a shelf points array from numeric points for the mission control component
  const shelfPoints = numericPoints.map(point => point.id);
  
  // Combined loading and error states
  const isLoading = pointsLoading || mappingsLoading;
  const error = pointsError || mappingsError;

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
            <MissionControl shelfPoints={shelfPoints.map(id => ({ id }))} />
          </div>
          <div>
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Map Points Summary</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Pickup Point</h3>
                  <p>
                    {specialPoints.pickup ? (
                      <>
                        <strong>{getDisplayName(specialPoints.pickup.id)}</strong> ({specialPoints.pickup.x.toFixed(2)}, {specialPoints.pickup.y.toFixed(2)})
                        <div className="text-xs text-muted-foreground">Technical ID: {specialPoints.pickup.id}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">No pickup point defined</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Dropoff Point</h3>
                  <p>
                    {specialPoints.dropoff ? (
                      <>
                        <strong>{getDisplayName(specialPoints.dropoff.id)}</strong> ({specialPoints.dropoff.x.toFixed(2)}, {specialPoints.dropoff.y.toFixed(2)})
                        <div className="text-xs text-muted-foreground">Technical ID: {specialPoints.dropoff.id}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">No dropoff point defined</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Desk Point</h3>
                  <p>
                    {specialPoints.desk ? (
                      <>
                        {specialPoints.desk.id} ({specialPoints.desk.x.toFixed(2)}, {specialPoints.desk.y.toFixed(2)})
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">No desk point defined</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Available Numeric Points</h3>
                  {numericPoints.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {numericPoints.map((point) => (
                        <li key={point.id}>
                          {point.id} ({point.x.toFixed(2)}, {point.y.toFixed(2)})
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