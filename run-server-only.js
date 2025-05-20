#!/usr/bin/env node

/**
 * Server-only runner for local development
 * This bypasses Vite entirely and runs only the server portion
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a patched version of the server index file that fixes path resolution
const createPatchedServerFile = () => {
  const serverIndexPath = path.join(__dirname, 'server', 'index.ts');
  const patchedIndexPath = path.join(__dirname, 'server', 'local-index.ts');
  
  // Read the original file
  const content = fs.readFileSync(serverIndexPath, 'utf8');
  
  // Create a patched version that properly handles paths
  const patchedContent = `
// This is a patched version for local development only
import path from 'path';
import { fileURLToPath } from 'url';

// Fix path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
globalThis.__basedir = path.resolve(__dirname, '..');

// Add path resolution helper to global object
globalThis.__resolveServerPath = (p) => {
  if (!p) return undefined;
  return path.resolve(globalThis.__basedir, p);
};

// Original content with path fix
${content}
`;

  // Write the patched file
  fs.writeFileSync(patchedIndexPath, patchedContent, 'utf8');
  console.log('Created patched server file for local development');
  
  return patchedIndexPath;
};

// Create patched file
const patchedServerFile = createPatchedServerFile();

// Environment variables
process.env.NODE_ENV = 'development';
process.env.SERVER_ONLY = 'true';

// Run the server directly with tsx, bypassing Vite
console.log('Starting server-only mode...');
const server = spawn('npx', ['tsx', patchedServerFile], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--experimental-specifier-resolution=node'
  }
});

// Handle process events
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