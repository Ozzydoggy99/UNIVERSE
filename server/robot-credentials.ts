import { Router } from 'express';
import { 
  updateRobotCredentials, 
  deleteRobotCredentials, 
  listRobotCredentials 
} from './robot-constants.js';
import { z } from 'zod';

const router = Router();

// Schema for robot credentials
const robotCredentialsSchema = z.object({
  serialNumber: z.string(),
  ipAddress: z.string().ip(),
  port: z.number().int().min(1).max(65535).default(8090),
  secret: z.string().min(1)
});

// Add/Update robot credentials
router.post('/credentials', async (req, res) => {
  try {
    const credentials = robotCredentialsSchema.parse(req.body);
    await updateRobotCredentials(
      credentials.serialNumber,
      credentials.ipAddress,
      credentials.port,
      credentials.secret
    );
    res.json({ success: true, message: 'Robot credentials updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
    } else {
      res.status(500).json({ success: false, error: 'Failed to update robot credentials' });
    }
  }
});

// Delete robot credentials
router.delete('/credentials/:serialNumber', async (req, res) => {
  try {
    const { serialNumber } = req.params;
    await deleteRobotCredentials(serialNumber);
    res.json({ success: true, message: 'Robot credentials deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete robot credentials' });
  }
});

// List all robot credentials
router.get('/credentials', async (req, res) => {
  try {
    const credentials = await listRobotCredentials();
    res.json({ success: true, credentials });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to list robot credentials' });
  }
});

export default router; 