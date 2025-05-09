/**
 * Test script to clear the Drop-off_Load location
 * This is used to test the full Zone 104 workflow
 */

import axios from 'axios';

async function clearDropoffLocation() {
  try {
    console.log('🧹 Sending request to clear dropoff location (Drop-off_Load)...');
    
    // First check current status
    const statusRes = await axios.get('http://localhost:5000/api/bins/status?location=Drop-off_Load');
    console.log(`Current dropoff status: ${statusRes.data.binPresent ? 'OCCUPIED' : 'CLEAR'}`);
    
    if (!statusRes.data.binPresent) {
      console.log('✅ Dropoff location is already clear! Nothing to do.');
      return;
    }
    
    // Send request to clear the dropoff location
    const response = await axios.post('http://localhost:5000/api/bins/clear', {
      location: 'Drop-off_Load',
      clearAction: 'manual_removal'
    });
    
    if (response.data.success) {
      console.log('✅ Successfully cleared dropoff location! The bin has been manually removed.');
    } else {
      console.log(`❌ Failed to clear dropoff location: ${response.data.message}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

clearDropoffLocation();