/**
 * Test script to validate workflow template changes
 * 
 * This script inspects the workflow templates to confirm that:
 * 1. toUnloadPoint action is being used for shelf drops
 * 2. No redundant reverseFromRack actions follow jackDown actions
 */

import fs from 'fs';
import path from 'path';

// Read the workflow templates file
async function validateWorkflowTemplates() {
  try {
    console.log('Validating workflow template changes...');
    
    // Read the workflow templates file
    const templatesPath = path.join(process.cwd(), 'server', 'workflow-templates.ts');
    const fileContent = fs.readFileSync(templatesPath, 'utf8');
    
    // Count number of workflow templates
    const templateMatches = fileContent.match(/export const \w+: WorkflowTemplate = {/g) || [];
    console.log(`Found ${templateMatches.length} workflow templates`);
    
    // Check for toUnloadPoint usage
    const toUnloadPointMatches = fileContent.match(/actionId: 'toUnloadPoint'/g) || [];
    console.log(`Found ${toUnloadPointMatches.length} toUnloadPoint actions`);
    
    // Check for instances where reverseFromRack follows jackDown
    const jackDownFollowedByReverse = fileContent.includes("jackDown',\n      params") && 
                                      fileContent.includes("reverseFromRack',\n      params");
    
    if (jackDownFollowedByReverse) {
      console.log('⚠️ Found potential instances where reverseFromRack may follow jackDown');
      
      // Extract sections where jackDown is followed by anything
      const jackDownSections = [];
      const lines = fileContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("actionId: 'jackDown'")) {
          // Collect the next 15 lines to analyze the sequence
          const section = lines.slice(i, i + 15).join('\n');
          jackDownSections.push(section);
        }
      }
      
      // Analyze each section
      for (let i = 0; i < jackDownSections.length; i++) {
        const section = jackDownSections[i];
        console.log(`\nAnalyzing jackDown section ${i+1}:`);
        
        if (section.includes("actionId: 'reverseFromRack'")) {
          console.log('❌ Found reverseFromRack after jackDown!');
          console.log(section);
        } else if (section.includes('/* Removed redundant reverseFromRack action')) {
          console.log('✅ Found comment indicating reverseFromRack was removed');
        } else if (section.includes("actionId: 'returnToCharger'")) {
          console.log('✅ jackDown is correctly followed by returnToCharger');
        } else {
          console.log('⚠️ Unclear what follows jackDown in this section');
          console.log(section);
        }
      }
    } else {
      console.log('✅ No instances found where reverseFromRack follows jackDown');
    }
    
    // Check for comment explaining the removal
    const removalComments = fileContent.match(/\/\* Removed redundant reverseFromRack action/g) || [];
    console.log(`Found ${removalComments.length} comments explaining reverseFromRack removal`);
    
    // Overall assessment
    if (toUnloadPointMatches.length >= templateMatches.length && 
        !jackDownFollowedByReverse && 
        removalComments.length >= templateMatches.length) {
      console.log('\n✅ Validation PASSED: All workflow templates appear to be correctly updated');
    } else {
      console.log('\n⚠️ Validation WARNING: Some workflow templates may need updating');
    }
    
  } catch (error) {
    console.error('Error validating workflow templates:', error);
  }
}

// Run the validation
validateWorkflowTemplates();