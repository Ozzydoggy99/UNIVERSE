/**
 * Storage Service
 * 
 * Handles persistent storage of map data and other system state.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, '../data');
const MAP_DATA_FILE = path.join(STORAGE_DIR, 'map-data.json');

// Ensure storage directory exists
async function ensureStorageDir() {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Store map data
 */
export async function storeMapData(data: any) {
  await ensureStorageDir();
  await fs.writeFile(MAP_DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * Load map data
 */
export async function loadMapData(): Promise<any> {
  try {
    await ensureStorageDir();
    const data = await fs.readFile(MAP_DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export const storage = {
  storeMapData,
  loadMapData
};