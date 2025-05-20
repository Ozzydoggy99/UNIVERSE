#!/usr/bin/env node

/**
 * Custom build script for local development
 * This script builds the project with path resolution fixes for local environments
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build frontend with Vite
console.log('Building frontend with Vite...');
execSync('npx vite build', { stdio: 'inherit' });

// Build backend with esbuild
console.log('Building backend with esbuild...');
execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
  stdio: 'inherit' 
});

// Path to the generated index.js file
const indexFilePath = path.join(__dirname, 'dist', 'index.js');

console.log('Patching path resolution in index.js...');
if (fs.existsSync(indexFilePath)) {
  let content = fs.readFileSync(indexFilePath, 'utf8');
  
  // Add a workaround for the path resolution issue
  const patchedContent = `
// Patched path resolution
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path resolution helper function
globalThis.__pathResolve = (p) => resolve(__dirname, p);

${content.replace(/path\.resolve\(([^,)]+)(?:,\s*['"]([^'"]*)['"])?\)/g, 
  (match, base, relativePath) => {
    if (relativePath) {
      return `__pathResolve("${relativePath}")`;
    }
    return match;
  }
)}`;

  fs.writeFileSync(indexFilePath, patchedContent, 'utf8');
  console.log('Successfully patched path resolution in index.js');
} else {
  console.error('Error: Could not find index.js file at', indexFilePath);
  process.exit(1);
}

console.log('Build completed successfully. Run with:');
console.log('  node --experimental-modules dist/index.js');