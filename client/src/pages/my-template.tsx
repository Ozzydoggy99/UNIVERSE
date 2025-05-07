// client/src/pages/my-template.tsx
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSimplifiedRobotTask } from "@/hooks/use-simplified-robot-task";
import { Point } from "@/hooks/use-simplified-robot-task";
import { LogOut, CheckCircle2, Loader2 } from "lucide-react";

export default function MyTemplate() {
  const { user, logoutMutation } = useAuth();
  const [mode, setMode] = useState<"pickup" | "dropoff">("pickup");
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  const { 
    pointsByFloor,
    error, 
    status,
    isRunning,
    runTask 
  } = useSimplifiedRobotTask();

  const floorColors: Record<string, string> = {
    "1": "bg-red-600",
    "2": "bg-green-600",
    "3": "bg-blue-500",
    "4": "bg-yellow-500",
  };

  const handleSubmit = async () => {
    if (!selectedShelf || isRunning) return;
    await runTask(mode, selectedShelf);
    setSelectedShelf(null);
    setSelectedFloor(null);
  };

  return (
    <div className="p-4 min-h-screen bg-white text-black">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Robot Service</h1>
        <div className="flex items-center gap-2">
          <span>{user?.username || "User"}</span>
          <button onClick={() => logoutMutation.mutate()}>
            <LogOut className="w-5 h-5 text-red-600" />
          </button>
        </div>
      </div>

      {/* Status Display */}
      {status && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-md">
          {status}
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-md">
          {error}
        </div>
      )}

      {/* Mode Selection */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMode("pickup")}
          className={`w-32 py-2 rounded shadow ${mode === "pickup" ? "bg-white text-black border border-black" : "bg-black text-white"}`}
        >
          Pickup
        </button>
        <button
          onClick={() => setMode("dropoff")}
          className={`w-32 py-2 rounded shadow ${mode === "dropoff" ? "bg-white text-black border border-black" : "bg-black text-white"}`}
        >
          Dropoff
        </button>
      </div>

      {/* Floor Selection */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Select Floor</h2>
        {Object.keys(pointsByFloor).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.keys(pointsByFloor).map((floorId) => (
              <button
                key={floorId}
                onClick={() => {
                  setSelectedFloor(floorId);
                  setSelectedShelf(null);
                }}
                className={`text-white text-xl font-bold rounded-lg p-6 shadow ${
                  selectedFloor === floorId ? "ring-4 ring-black" : ""
                } ${floorColors[floorId] || "bg-gray-400"}`}
              >
                {floorId}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-8 bg-gray-100 rounded-lg flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p>Loading map data from robot...</p>
          </div>
        )}
      </div>

      {/* Shelf Selection */}
      {selectedFloor && pointsByFloor[selectedFloor] && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            Select Shelf Point on Floor {selectedFloor}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {pointsByFloor[selectedFloor].map((point: Point) => (
              <button
                key={point.id}
                onClick={() => setSelectedShelf(point.id)}
                className={`rounded-lg p-6 text-white text-lg font-bold shadow transition ${
                  selectedShelf === point.id ? "bg-green-500 ring-4 ring-black" : "bg-black"
                }`}
              >
                {point.id}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Button */}
      {selectedShelf && (
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={isRunning}
            className="bg-green-600 text-white px-6 py-3 rounded-lg text-lg flex items-center gap-2 shadow"
          >
            <CheckCircle2 className="w-5 h-5" />
            Confirm Selection
          </button>
        </div>
      )}
    </div>
  );
}