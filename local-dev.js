#!/usr/bin/env node

/**
 * Simple local development script
 * This will run the development server directly using tsx
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set environment variables 
process.env.NODE_ENV = 'development';

// Create tsconfig for local development if it doesn't exist
const localTsConfigPath = resolve(__dirname, 'tsconfig.local.json');
if (!fs.existsSync(localTsConfigPath)) {
  const tsConfig = {
    "compilerOptions": {
      "target": "ES2020",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "esModuleInterop": true,
      "baseUrl": ".",
      "paths": {
        "*": ["*"]
      }
    },
    "include": ["server/**/*", "shared/**/*"],
    "exclude": ["node_modules"]
  };
  
  fs.writeFileSync(localTsConfigPath, JSON.stringify(tsConfig, null, 2), 'utf8');
  console.log('Created local TypeScript config at tsconfig.local.json');
}

// Run the dev server with tsx (which handles TypeScript directly)
console.log('Starting development server with tsx...');
const server = spawn('npx', ['tsx', '--tsconfig', 'tsconfig.local.json', 'server/index.ts'], {
  stdio: 'inherit',
  env: process.env
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});

server.on('exit', (code) => {
  process.exit(code);
});