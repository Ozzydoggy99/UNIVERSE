/**
 * Test script for workflow execution
 * This will test the dynamic workflow execution using the 'central-to-shelf' workflow
 */

const axios = require('axios');

async function testWorkflow() {
  try {
    console.log('Testing central-to-shelf workflow with shelf 104...');
    
    const response = await axios.post('http://localhost:5000/api/workflows/template', {
      workflowId: 'central-to-shelf',
      inputs: {
        dropoffShelf: '104'
      }
    });
    
    console.log('Workflow execution result:', response.data);
    
    if (response.data.workflowId) {
      console.log('✅ Successfully created workflow with ID:', response.data.workflowId);
      
      // Now let's check if a mission was created
      const missionResponse = await axios.get('http://localhost:5000/api/mission/queue/status');
      console.log('Mission queue status:', missionResponse.data);
    }
  } catch (error) {
    console.error('Error testing workflow:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
  }
}

testWorkflow();
