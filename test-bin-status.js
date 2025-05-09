/**
 * Test script to check bin status at both pickup and dropoff locations
 */

import axios from 'axios';

async function checkBinStatus() {
  try {
    console.log('🔍 Checking bin status at key locations...');
    
    // Check pickup location (104_Load)
    const pickupRes = await axios.get('http://localhost:5000/api/bins/status?location=104_Load');
    console.log(`\n📦 PICKUP (104_Load) STATUS:`);
    console.log(`Status: ${pickupRes.data.binPresent ? '🟥 OCCUPIED (has bin)' : '🟩 CLEAR (no bin)'}`);
    console.log(`Source: ${pickupRes.data.source}`);
    if (pickupRes.data.coordinates) {
      console.log(`Coordinates: (${pickupRes.data.coordinates.x}, ${pickupRes.data.coordinates.y})`);
    }
    
    // Check dropoff location (Drop-off_Load)
    const dropoffRes = await axios.get('http://localhost:5000/api/bins/status?location=Drop-off_Load');
    console.log(`\n📦 DROPOFF (Drop-off_Load) STATUS:`);
    console.log(`Status: ${dropoffRes.data.binPresent ? '🟥 OCCUPIED (has bin)' : '🟩 CLEAR (no bin)'}`);
    console.log(`Source: ${dropoffRes.data.source}`);
    if (dropoffRes.data.coordinates) {
      console.log(`Coordinates: (${dropoffRes.data.coordinates.x}, ${dropoffRes.data.coordinates.y})`);
    }
    
    // If dropoff is occupied, offer to clear it
    if (dropoffRes.data.binPresent) {
      console.log('\n⚠️ Dropoff location is occupied. Use test-clear-dropoff.js to clear it.');
    } else {
      console.log('\n✅ Dropoff location is clear and ready for delivery.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkBinStatus();