import { storage } from './mem-storage';
import { InsertRobotTemplateAssignment } from '@shared/schema';

/**
 * Registers a physical robot in the system and optionally assigns it to a template
 * 
 * @param serialNumber The serial number of the robot
 * @param model The model name of the robot
 * @param templateId Optional template ID to assign the robot to
 * @returns The created robot template assignment or null if no template is assigned
 */
export async function registerRobot(
  serialNumber: string, 
  model: string,
  templateId?: number
): Promise<any> {
  try {
    // First, check if the robot is already registered
    const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
    
    if (existingAssignment) {
      console.log(`Robot ${serialNumber} is already registered with template ID: ${existingAssignment.templateId}`);
      
      // If a new template ID is provided and it's different, update the assignment
      if (templateId !== undefined && templateId !== existingAssignment.templateId) {
        console.log(`Updating template assignment for robot ${serialNumber} from ${existingAssignment.templateId} to ${templateId}`);
        const updatedAssignment = await storage.updateRobotTemplateAssignment(existingAssignment.id, {
          templateId
        });
        return updatedAssignment;
      }
      
      return existingAssignment;
    }
    
    // If the robot doesn't exist and a template ID is provided, create a new assignment
    if (templateId !== undefined) {
      console.log(`Registering new robot ${serialNumber} with template ID: ${templateId}`);
      
      const newAssignment: InsertRobotTemplateAssignment = {
        serialNumber,
        robotModel: model,
        templateId,
        name: `${model} (${serialNumber})`,
        location: 'Main Floor'
      };
      
      const assignment = await storage.createRobotTemplateAssignment(newAssignment);
      return assignment;
    }
    
    // Register the robot without a template assignment
    console.log(`Registering new robot ${serialNumber} without template assignment`);
    return { serialNumber, model, registered: true };
    
  } catch (error) {
    console.error(`Error registering robot ${serialNumber}:`, error);
    throw error;
  }
}