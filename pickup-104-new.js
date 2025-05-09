/**
 * Script to perform a pickup from zone 104 and delivery to the Drop-off point
 * Using the new point naming convention (x_Load, x_Load_docking)
 */
import axios from 'axios';

// API Constants
const API_BASE_URL = 'http://localhost:5000/api';

// Map Point IDs based on new naming convention
const PICKUP_ZONE = '104_Load';
const PICKUP_ZONE_DOCKING = '104_Load_docking';
const DROPOFF_POINT = 'Dropoff';
const DROPOFF_POINT_DOCKING = 'Dropoff_docking';

async function pickup104Bin() {
  try {
    console.log('🚀 Starting pickup mission from zone 104 to Dropoff point using new naming...');
    
    // Step 1: Get all map points
    console.log('1️⃣ Fetching map points...');
    const pointsResponse = await axios.get(`${API_BASE_URL}/robots/map-points`);
    const points = pointsResponse.data;
    
    if (!points || points.length === 0) {
      throw new Error('Failed to get map points from robot');
    }
    console.log(`Found ${points.length} map points`);
    
    // Step 2: Find our specific points
    const findPoint = (id) => points.find(p => p.id === id);
    
    const pickupPoint = findPoint(PICKUP_ZONE);
    const pickupDockingPoint = findPoint(PICKUP_ZONE_DOCKING);
    const dropoffPoint = findPoint(DROPOFF_POINT);
    const dropoffDockingPoint = findPoint(DROPOFF_POINT_DOCKING);
    
    // Validation
    if (!pickupPoint) throw new Error(`Could not find pickup point ${PICKUP_ZONE}`);
    if (!pickupDockingPoint) throw new Error(`Could not find pickup docking point ${PICKUP_ZONE_DOCKING}`);
    if (!dropoffPoint) throw new Error(`Could not find dropoff point ${DROPOFF_POINT}`);
    if (!dropoffDockingPoint) throw new Error(`Could not find dropoff docking point ${DROPOFF_POINT_DOCKING}`);
    
    console.log('✅ Found all required map points:');
    console.log(`- Pickup: ${PICKUP_ZONE} at (${pickupPoint.x}, ${pickupPoint.y})`);
    console.log(`- Pickup docking: ${PICKUP_ZONE_DOCKING} at (${pickupDockingPoint.x}, ${pickupDockingPoint.y})`);
    console.log(`- Dropoff: ${DROPOFF_POINT} at (${dropoffPoint.x}, ${dropoffPoint.y})`);
    console.log(`- Dropoff docking: ${DROPOFF_POINT_DOCKING} at (${dropoffDockingPoint.x}, ${dropoffDockingPoint.y})`);
    
    // Find standby point for the final position
    const standbyPoint = points.find(p => p.id.toLowerCase().includes('desk') || p.id.toLowerCase().includes('standby'));
    if (!standbyPoint) {
      console.warn('⚠️ No standby point found - will use dropoff position for final position');
    }
    
    // Step 3: Send pickup request
    console.log('2️⃣ Sending pickup task to robot...');
    const pickupResponse = await axios.post(`${API_BASE_URL}/robots/assign-task/local`, {
      mode: 'pickup',
      shelf: pickupPoint,
      pickup: pickupDockingPoint,
      standby: standbyPoint || dropoffPoint
    });
    
    const pickupMissionId = pickupResponse.data.missionId;
    console.log(`✅ Pickup task started with mission ID: ${pickupMissionId}`);
    
    // Step 4: Monitor pickup mission
    console.log('3️⃣ Monitoring pickup mission progress...');
    await monitorMission(pickupMissionId);
    
    // Add delay between missions
    console.log('⏳ Waiting 5 seconds before starting dropoff mission...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 5: Send dropoff request
    console.log('4️⃣ Sending dropoff task to robot...');
    const dropoffResponse = await axios.post(`${API_BASE_URL}/robots/assign-task/local-dropoff`, {
      mode: 'dropoff',
      shelf: dropoffPoint,
      pickup: dropoffDockingPoint,
      standby: standbyPoint || dropoffPoint
    });
    
    const dropoffMissionId = dropoffResponse.data.missionId;
    console.log(`✅ Dropoff task started with mission ID: ${dropoffMissionId}`);
    
    // Step 6: Monitor dropoff mission
    console.log('5️⃣ Monitoring dropoff mission progress...');
    await monitorMission(dropoffMissionId);
    
    console.log('🎉 Complete zone-104 pickup and dropoff workflow completed successfully!');
    
  } catch (error) {
    console.error('❌ Error executing pickup-dropoff mission:', error.response?.data || error.message);
  }
}

async function monitorMission(missionId, maxRetries = 120) {
  console.log(`Monitoring mission ${missionId}...`);
  
  let completed = false;
  let attempt = 0;
  
  while (!completed && attempt < maxRetries) {
    attempt++;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/missions/${missionId}`);
      const mission = response.data;
      
      if (mission.status === 'completed') {
        console.log(`✅ Mission ${missionId} completed successfully!`);
        completed = true;
      } else if (mission.status === 'failed') {
        throw new Error(`Mission ${missionId} failed: ${mission.errorMessage || 'Unknown error'}`);
      } else {
        // Calculate progress
        const totalSteps = mission.steps.length;
        const completedSteps = mission.steps.filter(s => s.completed).length;
        const progress = Math.round((completedSteps / totalSteps) * 100);
        
        console.log(`⏳ Mission in progress: ${progress}% complete (${completedSteps}/${totalSteps} steps) - Status: ${mission.status}`);
        
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`Error checking mission status: ${error.message}`);
      
      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (!completed) {
    throw new Error(`Timed out monitoring mission ${missionId} after ${maxRetries} attempts`);
  }
  
  return true;
}

// Run the pickup mission
pickup104Bin();