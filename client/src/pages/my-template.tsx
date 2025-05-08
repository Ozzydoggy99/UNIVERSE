// client/src/pages/my-template.tsx
import { useState } from "react";
import { useSimplifiedRobotTask } from "@/hooks/use-simplified-robot-task";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export default function MyTemplate() {
  const { user, logoutMutation } = useAuth();
  const {
    mode,
    setMode,
    pointsByFloor,
    selectedPointId,
    setSelectedPointId,
    runTask,
    status,
    error,
    isRunning
  } = useSimplifiedRobotTask();

  const [step, setStep] = useState<"service" | "mode" | "floor" | "shelf" | "confirm">("service");
  const [selectedService, setSelectedService] = useState<"Laundry" | "Trash" | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);

  const floorColors: Record<string, string> = {
    "1": "bg-red-600",
    "2": "bg-green-600",
    "3": "bg-blue-500",
    "4": "bg-yellow-500",
  };

  const systemPoints = ["pick-up", "drop-off", "desk", "charging station"];

  const handleConfirm = async () => {
    if (!selectedPointId || isRunning) return;
    await runTask(mode, selectedPointId);
    setStep("service");
    setSelectedFloor(null);
    setSelectedPointId(null);
  };

  return (
    <div className="p-6 min-h-screen bg-white text-black flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Robot Service</h1>
        <div className="flex items-center gap-2">
          <span className="text-lg">{user?.username || "User"}</span>
          <button onClick={() => logoutMutation.mutate()}>
            <LogOut className="w-6 h-6 text-red-600" />
          </button>
        </div>
      </div>

      {/* Status */}
      {status && <div className="mb-4 p-4 bg-blue-100 text-blue-800 rounded text-center">{status}</div>}
      {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded text-center">{error}</div>}

      {/* Step-by-step UI */}
      {step === "service" && (
        <div className="flex flex-col items-center justify-center flex-grow gap-8">
          <h2 className="text-2xl font-semibold">Select Service</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-xl">
            <button onClick={() => { setSelectedService("Laundry"); setStep("mode"); }}
              className="bg-green-600 text-white text-2xl p-10 rounded-xl shadow w-full h-40">LAUNDRY</button>
            <button onClick={() => { setSelectedService("Trash"); setStep("mode"); }}
              className="bg-blue-700 text-white text-2xl p-10 rounded-xl shadow w-full h-40">TRASH</button>
          </div>
        </div>
      )}

      {step === "mode" && (
        <div className="flex flex-col items-center justify-center flex-grow gap-6">
          <h2 className="text-2xl font-semibold">{selectedService} Service</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-xl">
            <button onClick={() => { setMode("pickup"); setStep("floor"); }}
              className="bg-white border border-black text-black text-2xl rounded-xl h-40 shadow">Pickup</button>
            <button onClick={() => { setMode("dropoff"); setStep("floor"); }}
              className="bg-black text-white text-2xl rounded-xl h-40 shadow">Dropoff</button>
          </div>
        </div>
      )}

      {step === "floor" && (
        <div className="flex flex-col items-center justify-center flex-grow gap-8">
          <h2 className="text-2xl font-semibold">{mode === "pickup" ? "Pickup" : "Dropoff"} - Select Floor</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 w-full max-w-4xl">
            {Object.keys(pointsByFloor).map(floorId => (
              <button key={floorId}
                className={`rounded-xl text-white text-3xl font-bold h-40 shadow ${floorColors[floorId] || "bg-gray-500"}`}
                onClick={() => {
                  setSelectedFloor(floorId);
                  setStep("shelf");
                }}
              >
                {floorId}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "shelf" && selectedFloor && (
        <div className="flex flex-col items-center justify-center flex-grow gap-8">
          <h2 className="text-2xl font-semibold">Select Shelf Point on Floor {selectedFloor}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full max-w-5xl">
            {(pointsByFloor[selectedFloor] || [])
              .filter(p => !systemPoints.includes(p.id.toLowerCase()))
              .map(point => (
                <button key={point.id}
                  onClick={() => { setSelectedPointId(point.id); setStep("confirm"); }}
                  className={`rounded-xl text-2xl font-bold h-40 shadow
                    ${selectedPointId === point.id ? "bg-green-600 text-white" : "bg-black text-white"}`}
                >
                  {point.id}
                </button>
              ))}
          </div>
        </div>
      )}

      {step === "confirm" && selectedPointId && (
        <div className="flex flex-col items-center justify-center flex-grow gap-6">
          <p className="text-2xl text-center">Confirm point <strong>{selectedPointId}</strong> for {mode}</p>
          <button onClick={handleConfirm}
            className="bg-green-600 text-white text-2xl rounded-xl px-8 py-4 shadow">
            ✅ Confirm Selection
          </button>
          
          <Button
            variant="outline"
            onClick={async () => {
              const res = await fetch("/api/go-home", { method: "POST" });
              if (res.ok) {
                alert("Robot sent to charger ✅");
              } else {
                alert("⚠️ Failed to send robot home");
              }
            }}
            className="mt-4 w-full text-center"
          >
            🏠 Send Robot to Charger
          </Button>
        </div>
      )}

      <div className="fixed bottom-4 right-4">
        <button className="bg-violet-600 text-white px-4 py-2 rounded">View Static Map (No HMR)</button>
      </div>
    </div>
  );
}