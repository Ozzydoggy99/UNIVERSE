#!/usr/bin/env node

// This is a wrapper script to properly handle path resolution for local development
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set environment variables that might be needed
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Resolve the path to the built index.js file
const indexPath = resolve(__dirname, 'dist', 'index.js');

// Run the server with proper path resolution
const server = spawn('node', ['--experimental-specifier-resolution=node', indexPath], {
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