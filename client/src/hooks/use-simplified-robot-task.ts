import { useState, useEffect } from "react";

export interface Point {
  id: string;
  description?: string;
  floorId?: string;
  x: number;
  y: number;
  ori: number;
}

export const useSimplifiedRobotTask = () => {
  const [mode, setMode] = useState<"pickup" | "dropoff">("pickup");
  const [pointsByFloor, setPointsByFloor] = useState<Record<string, Point[]>>({});
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    console.log("Fetching mission points data...");
    // Use the mission-points endpoint to get points grouped by floor
    fetch("/api/mission-points")
      .then(res => res.json())
      .then(data => {
        console.log("Received map points:", data);
        if (data.pointsByFloor) {
          setPointsByFloor(data.pointsByFloor);
          setError(null);
        } else {
          // If we just got a flat array, organize by floor
          const points = data.points || [];
          const byFloor: Record<string, Point[]> = {};
          
          points.forEach((point: Point) => {
            const floorId = point.floorId || '1';
            if (!byFloor[floorId]) {
              byFloor[floorId] = [];
            }
            byFloor[floorId].push(point);
          });
          
          setPointsByFloor(byFloor);
          setError(null);
        }
      })
      .catch(err => {
        console.error("❌ Failed to fetch points:", err);
        setError("Failed to fetch points");
      });
  }, []);

  const runTask = async (taskMode: "pickup" | "dropoff" = mode, shelfId?: string) => {
    // Use the provided shelfId or fall back to the selected point ID
    const targetShelfId = shelfId || selectedPointId;
    
    if (!targetShelfId) {
      setError("No shelf point selected");
      return;
    }

    try {
      setIsRunning(true);
      setStatus("Sending task to robot...");
      const res = await fetch("/api/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uiMode: taskMode,
          shelfId: targetShelfId
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setStatus(`✅ Mission started: ${result?.message || "Success"}`);
        setError(null);
      } else {
        throw new Error(result?.error || "Unknown failure");
      }
    } catch (err: any) {
      console.error("🚨 Mission error:", err);
      setError(err.message || "Task failed");
      setStatus(null);
    } finally {
      setIsRunning(false);
    }
  };

  return {
    mode,
    setMode,
    pointsByFloor,
    selectedPointId,
    setSelectedPointId,
    runTask,
    status,
    error,
    isRunning,
  };
};