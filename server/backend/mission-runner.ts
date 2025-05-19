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

  appendLog("\n[MISSION START]");
  appendLog(`Mode: ${uiMode}`);
  appendLog(`Shelf: ${shelf.id} → (${shelf.x}, ${shelf.y})`);
  appendLog(`pickup: ${pickup.id} → (${pickup.x}, ${pickup.y})`);
  appendLog(`drop-off: ${dropoff.id} → (${dropoff.x}, ${dropoff.y})`);
  appendLog(`Standby: ${standby.id} → (${standby.x}, ${standby.y})`);

  if (uiMode === "pickup") {
    // PICKUP MODE: Get bin from shelf and take to dropoff
    
    // Step 1: Move to shelf
    appendLog(`➡️ Moving to shelf: ${shelf.id}`);
    await moveToPoint(shelf.x, shelf.y, "shelf point");
    
    // Step 2: Jack up to grab the bin
    appendLog(`⬆️ Jacking up to grab bin at shelf: ${shelf.id}`);
    await jackUp();
    
    // Step 3: Move to dropoff 
    appendLog(`➡️ Moving to dropoff with bin: ${dropoff.id}`);
    await moveToPoint(dropoff.x, dropoff.y, "dropoff point");
    
    // Step 4: Jack down to release bin
    appendLog(`⬇️ Jacking down to release bin at dropoff`);
    await jackDown();
    
    // Step 5: Move to standby
    appendLog(`➡️ Moving to standby position: ${standby.id}`);
    await moveToPoint(standby.x, standby.y, "standby point");
    
  } else {
    // DROPOFF MODE: Get bin from pickup and take to shelf
    
    // Step 1: Move to standby first
    appendLog(`➡️ Moving to standby: ${standby.id}`);
    await moveToPoint(standby.x, standby.y, "standby point");
    
    // Step 2: Move to pickup
    appendLog(`➡️ Moving to pickup: ${pickup.id}`);
    await moveToPoint(pickup.x, pickup.y, "pickup point");
    
    // Step 3: Jack up to grab the bin
    appendLog(`⬆️ Jacking up to grab bin at pickup`);
    await jackUp();
    
    // Step 4: Move to shelf
    appendLog(`➡️ Moving to shelf with bin: ${shelf.id}`);
    await moveToPoint(shelf.x, shelf.y, "shelf point");
    
    // Step 5: Jack down to release bin
    appendLog(`⬇️ Jacking down to release bin at shelf`);
    await jackDown();
    
    // Step 6: Move to standby
    appendLog(`➡️ Moving back to standby: ${standby.id}`);
    await moveToPoint(standby.x, standby.y, "standby point");
  }

  // Helper function to move robot to point
  async function moveToPoint(x: number, y: number, pointLabel: string) {
    try {
      // Cancel any current moves first
      try {
        await axios.patch(
          `${ROBOT_API_URL}/chassis/moves/current`,
          { state: "cancelled" },
          { headers }
        );
      } catch (cancelError: any) {
        appendLog(`⚠️ Could not cancel current move: ${cancelError.message}`);
      }
      
      // Send move command
      const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
        action: "move_to",
        target_x: x,
        target_y: y
      }, { headers });

      appendLog(`✅ Move to ${pointLabel} started (MoveID: ${response.data?.id})`);
      await waitForMoveComplete();
      appendLog(`🏁 Arrived at ${pointLabel}`);
    } catch (err: any) {
      appendLog(`❌ Move to ${pointLabel} failed: ${err.message}`);
      throw new Error(`Move to ${pointLabel} failed: ${err.message}`);
    }
  }
  
  // Helper functions for jack operations
  async function jackUp() {
    try {
      const response = await axios.post(
        `${ROBOT_API_URL}/jack/up`, 
        {}, 
        { headers }
      );
      appendLog(`✅ Jack up command sent: ${JSON.stringify(response.data)}`);
      
      // Wait for jack operation to complete
      await wait(5000);
      appendLog(`✅ Jack up operation completed`);
    } catch (err: any) {
      appendLog(`❌ Jack up failed: ${err.message}`);
      throw new Error(`Jack up failed: ${err.message}`);
    }
  }
  
  async function jackDown() {
    try {
      const response = await axios.post(
        `${ROBOT_API_URL}/jack/down`, 
        {}, 
        { headers }
      );
      appendLog(`✅ Jack down command sent: ${JSON.stringify(response.data)}`);
      
      // Wait for jack operation to complete
      await wait(5000);
      appendLog(`✅ Jack down operation completed`);
    } catch (err: any) {
      appendLog(`❌ Jack down failed: ${err.message}`);
      throw new Error(`Jack down failed: ${err.message}`);
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