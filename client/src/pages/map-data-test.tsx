// client/src/pages/map-data-test.tsx
import { useRobotMapData } from '@/hooks/use-robot-map-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function MapDataTestPage() {
  const { data, loading, error } = useRobotMapData();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading map data...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-destructive">
        <h2 className="text-lg font-bold">Error loading map data</h2>
        <p>{error || 'Unknown error'}</p>
      </div>
    );
  }

  const { shelvesByFloor, specialPoints, allFloors } = data;

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Robot Map Data Test</h1>
        <p className="text-muted-foreground">
          This page displays the data from our new /api/robots/points/full endpoint
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Special Points */}
        <Card>
          <CardHeader>
            <CardTitle>Special Points</CardTitle>
            <CardDescription>Non-numeric labeled points on the map</CardDescription>
          </CardHeader>
          <CardContent>
            {specialPoints.pickup && (
              <div className="mb-2">
                <h3 className="font-semibold">Pickup Point</h3>
                <p>ID: {specialPoints.pickup.id}</p>
                <p>Coordinates: ({specialPoints.pickup.x.toFixed(2)}, {specialPoints.pickup.y.toFixed(2)})</p>
                <p>Orientation: {specialPoints.pickup.ori}°</p>
              </div>
            )}
            
            {specialPoints.dropoff && (
              <div className="mb-2">
                <h3 className="font-semibold">Dropoff Point</h3>
                <p>ID: {specialPoints.dropoff.id}</p>
                <p>Coordinates: ({specialPoints.dropoff.x.toFixed(2)}, {specialPoints.dropoff.y.toFixed(2)})</p>
                <p>Orientation: {specialPoints.dropoff.ori}°</p>
              </div>
            )}
            
            {specialPoints.standby && (
              <div className="mb-2">
                <h3 className="font-semibold">Standby Point</h3>
                <p>ID: {specialPoints.standby.id}</p>
                <p>Coordinates: ({specialPoints.standby.x.toFixed(2)}, {specialPoints.standby.y.toFixed(2)})</p>
                <p>Orientation: {specialPoints.standby.ori}°</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Floors */}
        <Card>
          <CardHeader>
            <CardTitle>Available Floors</CardTitle>
            <CardDescription>Floors detected in the map</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5">
              {allFloors.map(floor => (
                <li key={floor}>Floor {floor}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Shelves by Floor */}
      <div className="mt-6">
        <h2 className="text-2xl font-bold mb-4">Shelves by Floor</h2>
        
        {allFloors.map(floor => (
          <Card key={floor} className="mb-4">
            <CardHeader>
              <CardTitle>Floor {floor}</CardTitle>
              <CardDescription>
                {shelvesByFloor[floor]?.length || 0} shelf points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {shelvesByFloor[floor]?.map(point => (
                  <div key={point.id} className="border rounded p-3">
                    <h3 className="font-bold">Shelf #{point.id}</h3>
                    <p>X: {point.x.toFixed(2)}</p>
                    <p>Y: {point.y.toFixed(2)}</p>
                    <p>Orientation: {point.ori}°</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Raw Data */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Raw Map Data</CardTitle>
          <CardDescription>Complete JSON response from API</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}