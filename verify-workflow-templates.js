/**
 * Simplified script to verify workflow template structure
 * 
 * This script directly examines the workflow template files to validate
 * that reverseFromRack actions have been removed after jackDown steps.
 */

import fs from 'fs';
import path from 'path';

// Read and parse the workflow templates file
function validateWorkflowTemplates() {
  try {
    console.log('Validating workflow templates structure...');
    
    // Read the workflow-templates.ts file
    const templatesPath = path.join(process.cwd(), 'server', 'workflow-templates.ts');
    const templatesContent = fs.readFileSync(templatesPath, 'utf8');
    
    // Find all workflow template definitions
    const templateMatches = templatesContent.match(/export const \w+: WorkflowTemplate = {[^}]*}/gs) || [];
    
    console.log(`Found ${templateMatches.length} workflow template definitions`);
    
    // Analyze each template
    for (let i = 0; i < templateMatches.length; i++) {
      const template = templateMatches[i];
      
      // Extract template name and ID
      const nameMatch = template.match(/name: ['"]([^'"]+)['"]/);
      const idMatch = template.match(/id: ['"]([^'"]+)['"]/);
      
      const templateName = nameMatch ? nameMatch[1] : `Template ${i+1}`;
      const templateId = idMatch ? idMatch[1] : `template-${i+1}`;
      
      console.log(`\n🔍 Analyzing template: ${templateName} (${templateId})`);
      
      // Find toUnloadPoint usage
      const hasToUnloadPoint = template.includes("actionId: 'toUnloadPoint'");
      console.log(`- Has toUnloadPoint action: ${hasToUnloadPoint ? '✅ Yes' : '❌ No'}`);
      
      // Find jackDown actions
      const hasJackDown = template.includes("actionId: 'jackDown'");
      console.log(`- Has jackDown action: ${hasJackDown ? '✅ Yes' : '❌ No'}`);
      
      // Check if reverseFromRack is used after jackDown
      // We'll do this by analyzing the sequence array structure
      const sequenceMatch = template.match(/sequence: \[\s*([\s\S]*?)\s*\]/);
      if (sequenceMatch) {
        const sequence = sequenceMatch[1];
        
        // Split into steps by looking for actionId patterns
        const steps = sequence.split(/actionId: ['"]/).slice(1);
        
        // Extract action IDs in sequence
        const actionSequence = steps.map(step => {
          const actionIdMatch = step.match(/^([^'"]+)['"]/);
          return actionIdMatch ? actionIdMatch[1] : '';
        }).filter(id => id);
        
        console.log(`- Action sequence: ${actionSequence.join(' → ')}`);
        
        // Find jackDown in the sequence
        const jackDownIndex = actionSequence.indexOf('jackDown');
        if (jackDownIndex !== -1 && jackDownIndex < actionSequence.length - 1) {
          const nextAction = actionSequence[jackDownIndex + 1];
          console.log(`- Action after jackDown: ${nextAction}`);
          
          if (nextAction === 'reverseFromRack') {
            console.log(`❌ WARNING: Found reverseFromRack after jackDown in ${templateName}!`);
          } else if (nextAction === 'returnToCharger') {
            console.log(`✅ CORRECT: jackDown is followed by returnToCharger in ${templateName}`);
          } else {
            console.log(`⚠️ NOTE: jackDown is followed by ${nextAction} in ${templateName}`);
          }
        }
        
        // Check for any reverseFromRack usages
        const hasReverseFromRack = actionSequence.includes('reverseFromRack');
        console.log(`- Uses reverseFromRack anywhere: ${hasReverseFromRack ? '⚠️ Yes' : '✅ No'}`);
        
        // Find comments about removing reverseFromRack
        const hasRemovalComment = template.includes('/* Removed redundant reverseFromRack action');
        console.log(`- Has comment about removing reverseFromRack: ${hasRemovalComment ? '✅ Yes' : '❌ No'}`);
      }
    }
    
    console.log('\n✅ Workflow template validation complete!');
    
  } catch (error) {
    console.error('Error validating templates:', error);
  }
}

// Run the validation
validateWorkflowTemplates();