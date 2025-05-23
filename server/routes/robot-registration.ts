import express from 'express';
import { Router } from 'express';
import { storage } from '../mem-storage';

const router: Router = express.Router();

interface Robot {
  name: string;
  localIp: string;
  publicIp: string;
  secret: string;
  serialNumber: string;
  createdAt: Date;
}

// Get all registered robots
router.get('/', async (req, res) => {
  try {
    const robots = await storage.getRobots();
    res.json(robots);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch robots' });
  }
});

// Register a new robot
router.post('/register', async (req, res) => {
  try {
    const { name, localIp, publicIp, secret, serialNumber } = req.body;

    // Validate required fields
    if (!name || !localIp || !publicIp || !secret || !serialNumber) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if robot with this serial number already exists
    const existingRobot = await storage.getRobotBySerialNumber(serialNumber);
    if (existingRobot) {
      return res.status(400).json({ error: 'Robot with this serial number already exists' });
    }

    const robot: Robot = {
      name,
      localIp,
      publicIp,
      secret,
      serialNumber,
      createdAt: new Date()
    };

    await storage.saveRobot(robot);
    res.status(201).json(robot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register robot' });
  }
});

// Get a specific robot by serial number
router.get('/:serialNumber', async (req, res) => {
  try {
    const robot = await storage.getRobotBySerialNumber(req.params.serialNumber);
    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
    }
    res.json(robot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch robot' });
  }
});

// Update a robot
router.put('/:serialNumber', async (req, res) => {
  try {
    const { serialNumber } = req.params;
    const { name, localIp, publicIp, secret } = req.body;

    // Validate required fields
    if (!name || !localIp || !publicIp || !secret) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if robot exists
    const existingRobot = await storage.getRobotBySerialNumber(serialNumber);
    if (!existingRobot) {
      return res.status(404).json({ error: 'Robot not found' });
    }

    const updatedRobot: Robot = {
      ...existingRobot,
      name,
      localIp,
      publicIp,
      secret,
    };

    await storage.saveRobot(updatedRobot);
    res.json(updatedRobot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update robot' });
  }
});

// Delete a robot
router.delete('/:serialNumber', async (req, res) => {
  try {
    const { serialNumber } = req.params;

    // Check if robot exists
    const existingRobot = await storage.getRobotBySerialNumber(serialNumber);
    if (!existingRobot) {
      return res.status(404).json({ error: 'Robot not found' });
    }

    await storage.deleteRobot(serialNumber);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete robot' });
  }
});

export default router; 