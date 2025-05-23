import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';
import * as fs from 'fs';
import * as path from 'path';

// Ensure migrations directory exists
const migrationsDir = './server/db/migrations';
const metaDir = path.join(migrationsDir, 'meta');

if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

if (!fs.existsSync(metaDir)) {
  fs.mkdirSync(metaDir, { recursive: true });
}

// Ensure journal file exists
const journalPath = path.join(metaDir, '_journal.json');
if (!fs.existsSync(journalPath)) {
  fs.writeFileSync(journalPath, JSON.stringify({
    version: "5",
    dialect: "sqlite",
    entries: []
  }, null, 2));
}

// Run migrations
console.log('Running migrations...');
migrate(db, { migrationsFolder: migrationsDir });
console.log('Migrations completed successfully!'); 