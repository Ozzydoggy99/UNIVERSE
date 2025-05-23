import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as schema from './schema.js';

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite database connection
const sqlite = new Database(path.join(dataDir, 'sqlite.db'));

// Create drizzle database instance
export const db = drizzle(sqlite, { schema });

// Export types
export type DbType = typeof db; 