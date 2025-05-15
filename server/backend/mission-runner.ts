// FINAL PATCH: Clean mission-runner.ts using real robot task polling (no timers)

import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET, getAuthHeaders } from "../robot-constants";
import { Point } from "../types";
import { appendLog } from "../debug-log";

// Using correct AutoXing API authentication format
const headers = getAuthHeaders();

interface RobotTaskRequest {
  shelfId: string;
  uiMode: "pickup" | "dropoff";
  points: Point[];
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForMoveComplete(): Promise<void> {
  let retries = 0;
  while (retries < 60) { // 60 * 2s = 2 minutes max
    try {
      const res = await axios.get(`${ROBOT_API_URL}/chassis/moves/latest`, { headers });
      const { state } = res.data;
      appendLog(`🔄 Robot move status: ${state}`);
      if (state === "succeeded") return;
      if (state === "failed") throw new Error("❌ Robot move failed");
    } catch (err: any) {
      appendLog(`⚠️ Status check error: ${err.message}`);
    }
    await wait(2000); // poll every 2 seconds
    retries++;
  }
  throw new Error("⏱ Robot did not report arrival within timeout");
}

export async function runMission({ shelfId, uiMode, points }: RobotTaskRequest) {
  const normalize = (val: string) => String(val).trim().toLowerCase();
  const find = (id: string) => points.find(p => normalize(p.id) === normalize(id));

  const pickup = find("pick-up");
  const dropoff = find("drop-off");
  const standby = find("desk") || find("standby");
  const shelf = find(shelfId);

  if (!pickup || !dropoff || !standby || !shelf) {
    throw new Error("❌ Required point(s) not found: pickup, dropoff, desk/standby, shelf");
  }

  const sequence = uiMode === "pickup"
    ? [shelf, dropoff, standby]
    : [standby, pickup, shelf, standby];

  appendLog("\n[MISSION START]");
  appendLog(`Mode: ${uiMode}`);
  appendLog(`Shelf: ${shelf.id} → (${shelf.x}, ${shelf.y})`);
  appendLog(`pickup: ${pickup.id} → (${pickup.x}, ${pickup.y})`);
  appendLog(`drop-off: ${dropoff.id} → (${dropoff.x}, ${dropoff.y})`);
  appendLog(`Standby: ${standby.id} → (${standby.x}, ${standby.y})`);

  for (const point of sequence) {
    try {
      appendLog(`➡️ Sending robot to: ${point.id} (${point.x}, ${point.y})`);
      const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
        action: "move_to",
        target_x: point.x,
        target_y: point.y
      }, { headers });

      appendLog(`✅ Move to ${point.id} started (MoveID: ${response.data?.id})`);
      await waitForMoveComplete();
      appendLog(`🏁 Arrived at ${point.id}`);
    } catch (err: any) {
      appendLog(`❌ Move to ${point.id} failed: ${err.message}`);
      throw new Error(`Move failed: ${point.id}`);
    }
  }

  appendLog("[MAIN MISSION TASKS COMPLETE]");
  
  // Now initiate return to charger using our robust multi-method approach
  try {
    appendLog("🔋 Initiating return to charger...");
    
    // Method 1: Try services/return_to_charger API endpoint (newest method)
    try {
      appendLog("🔋 METHOD 1: Using services API to return to charger");
      const serviceResponse = await axios.post(`${ROBOT_API_URL}/services/return_to_charger`, {}, { headers });
      appendLog("✅ Return to charger command sent via services API");
      
      // Wait a moment for the command to take effect
      await wait(5000);
      appendLog("✅ Return to charger operation initiated successfully via services API");
      appendLog("[MISSION COMPLETE WITH CHARGER RETURN]\n");
      
      return {
        mission: `Auto-${uiMode}-${shelfId}-${Date.now()}`,
        status: "completed",
        sequence: [...sequence.map(p => p.id), "charger-via-services-api"]
      };
    } 
    catch (serviceError: any) {
      appendLog(`⚠️ Services API method failed: ${serviceError.message}`);
      // Fall through to next method
    }
    
    // Method 2: Fall back to task API with runType 25 (charging task type)
    try {
      appendLog("🔋 METHOD 2: Using task API with runType 25 (charging task)");
      const chargingTask = {
        runType: 25, // Charging task type
        name: `Return to Charger (${new Date().toISOString()})`,
        robotSn: 'L382502104987ir',
        taskPriority: 10, // High priority for charging
        isLoop: false
      };
      
      const taskResponse = await axios.post(`${ROBOT_API_URL}/api/v2/task`, chargingTask, { headers });
      appendLog("✅ Return to charger command sent via task API");
      
      // Wait a moment for the task to be processed
      await wait(3000);
      appendLog("✅ Return to charger operation initiated successfully via task API");
      appendLog("[MISSION COMPLETE WITH CHARGER RETURN]\n");
      
      return {
        mission: `Auto-${uiMode}-${shelfId}-${Date.now()}`,
        status: "completed",
        sequence: [...sequence.map(p => p.id), "charger-via-task-api"]
      };
    } 
    catch (taskError: any) {
      appendLog(`⚠️ Task API method failed: ${taskError.message}`);
      // Fall through to next method
    }
    
    // Method 3: Fall back to the v1 charging API
    try {
      appendLog("🔋 METHOD 3: Using basic charge API endpoint");
      const chargingResponse = await axios.post(`${ROBOT_API_URL}/charge`, {}, { headers });
      appendLog("✅ Return to charger command sent via charge API");
      
      // Wait a moment for the command to take effect
      await wait(3000);
      appendLog("✅ Return to charger operation initiated successfully via charge API");
      appendLog("[MISSION COMPLETE WITH CHARGER RETURN]\n");
      
      return {
        mission: `Auto-${uiMode}-${shelfId}-${Date.now()}`,
        status: "completed",
        sequence: [...sequence.map(p => p.id), "charger-via-charge-api"]
      };
    } 
    catch (chargeError: any) {
      appendLog(`⚠️ Charge API method failed: ${chargeError.message}`);
      // All methods failed, just return with warning
      appendLog("⚠️ All return to charger methods failed. Robot may not return to charger automatically.");
    }
  }
  catch (error: any) {
    appendLog(`❌ ERROR during return to charger: ${error.message}`);
    // Continue despite return to charger error
  }

  appendLog("[MISSION COMPLETE WITHOUT CHARGER RETURN]\n");
  
  return {
    mission: `Auto-${uiMode}-${shelfId}-${Date.now()}`,
    status: "completed",
    sequence: sequence.map(p => p.id)
  };
}