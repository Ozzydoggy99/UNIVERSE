// server/robot-constants.ts
/**
 * Robot API constants file
 * Contains configuration for connecting to the robot's API
 */
import dotenv from "dotenv";
import { db } from "./db";
import { robotCredentials } from "../shared/schema";
import { eq } from "drizzle-orm";
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Schema for robot credentials
const robotCredentialsSchema = z.object({
  serialNumber: z.string(),
  ipAddress: z.string().ip(),
  port: z.number().int().min(1).max(65535).default(8090),
  secret: z.string().min(1)
});

type RobotCredentials = z.infer<typeof robotCredentialsSchema>;

const CREDENTIALS_FILE = path.join(__dirname, 'robot-credentials.json');

// Default robot configuration
const DEFAULT_ROBOT = {
  serialNumber: 'L382502104987ir',
  ipAddress: '192.168.4.31',
  port: 8090,
  secret: '667a51a4d948433081a272c78d10a8a4'
};

// Default robot serial number
const DEFAULT_ROBOT_SERIAL = 'L382502104987ir';
const ROBOT_API_URL = 'http://192.168.4.31:8090';
const ROBOT_SECRET = '667a51a4d948433081a272c78d10a8a4';
const ROBOT_SERIAL = 'L382502104987ir';

// In-memory storage for robot credentials
const robotCredentialCache = new Map<string, {
  ipAddress: string;
  port: number;
  secret: string;
}>();

// Initialize with default robot
robotCredentialCache.set(ROBOT_SERIAL, {
  ipAddress: '192.168.4.31',
  port: 8090,
  secret: ROBOT_SECRET
});

// Initialize credentials file if it doesn't exist
async function initializeCredentialsFile() {
  try {
    await fs.access(CREDENTIALS_FILE);
  } catch {
    // Initialize with default robot if file doesn't exist
    await fs.writeFile(CREDENTIALS_FILE, JSON.stringify({
      [DEFAULT_ROBOT.serialNumber]: DEFAULT_ROBOT
    }, null, 2));
  }
}

// Read credentials from file
async function readCredentials(): Promise<Record<string, RobotCredentials>> {
  await initializeCredentialsFile();
  const data = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
  return JSON.parse(data);
}

// Write credentials to file
async function writeCredentials(credentials: Record<string, RobotCredentials>) {
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
}

// Function to get robot credentials
async function getRobotCredentials(serialNumber: string = DEFAULT_ROBOT_SERIAL) {
  // Check cache first
  const cachedCreds = robotCredentialCache.get(serialNumber);
  if (cachedCreds) {
    return cachedCreds;
  }

  // Read from file
  const credentials = await readCredentials();
  const robotConfig = credentials[serialNumber];
  if (!robotConfig) {
    throw new Error(`No credentials found for robot ${serialNumber}`);
  }

  // Update cache
  const creds = {
    ipAddress: robotConfig.ipAddress,
    port: robotConfig.port || 8090,
    secret: robotConfig.secret
  };
  robotCredentialCache.set(serialNumber, creds);
  return creds;
}

// Get robot API URL
async function getRobotApiUrl(serialNumber: string = ROBOT_SERIAL): Promise<string> {
  const credentials = await getRobotCredentials(serialNumber);
  return `http://${credentials.ipAddress}:${credentials.port}`;
}

// Get robot WebSocket URL
async function getRobotWsUrl(serialNumber: string = ROBOT_SERIAL): Promise<string> {
  const credentials = await getRobotCredentials(serialNumber);
  return `ws://${credentials.ipAddress}:${credentials.port}/ws/v2/topics`;
}

// Get robot secret
async function getRobotSecret(serialNumber: string = ROBOT_SERIAL): Promise<string> {
  const credentials = await getRobotCredentials(serialNumber);
  return credentials.secret;
}

// Get auth headers
async function getAuthHeaders(serialNumber: string = ROBOT_SERIAL): Promise<Record<string, string>> {
  const secret = await getRobotSecret(serialNumber);
  return {
    'APPCODE': secret,
    'Content-Type': 'application/json'
  };
}

// Update robot credentials
async function updateRobotCredentials(
  serialNumber: string,
  ipAddress: string,
  port: number,
  secret: string
): Promise<void> {
  // Update cache
  robotCredentialCache.set(serialNumber, { ipAddress, port, secret });

  // Update file
  const credentials = await readCredentials();
  credentials[serialNumber] = {
    serialNumber,
    ipAddress,
    port,
    secret
  };
  await writeCredentials(credentials);
}

// Delete robot credentials
async function deleteRobotCredentials(serialNumber: string): Promise<void> {
  // Remove from cache
  robotCredentialCache.delete(serialNumber);

  // Remove from file
  const credentials = await readCredentials();
  delete credentials[serialNumber];
  await writeCredentials(credentials);
}

// List all robot credentials
async function listRobotCredentials(): Promise<Array<{
  serialNumber: string;
  ipAddress: string;
  port: number;
}>> {
  const credentials = await readCredentials();
  return Object.values(credentials).map(({ serialNumber, ipAddress, port }) => ({
    serialNumber,
    ipAddress,
    port
  }));
}

export {
  DEFAULT_ROBOT_SERIAL,
  ROBOT_API_URL,
  ROBOT_SECRET,
  ROBOT_SERIAL,
  getRobotApiUrl,
  getRobotWsUrl,
  getRobotSecret,
  getAuthHeaders,
  updateRobotCredentials,
  deleteRobotCredentials,
  listRobotCredentials
};