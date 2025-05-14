/**
 * Logger Helper
 * 
 * This module provides standardized logging functions that capture more details
 * about errors, including those from axios and other common sources.
 */

import fs from 'fs';
import path from 'path';

// Configure log files
const ERROR_LOG_PATH = 'robot-error.log';
const DEBUG_LOG_PATH = 'robot-debug.log';

/**
 * Enhanced error logging that extracts additional details from common error types
 */
export function logError(context: string, error: any): void {
  // Basic error message
  let errorMessage = `[${new Date().toISOString()}] [ERROR] [${context}] `;
  
  try {
    // Extract error message
    if (typeof error === 'string') {
      errorMessage += error;
    } else if (error instanceof Error) {
      errorMessage += `${error.name}: ${error.message}`;
      
      // Add stack trace if available
      if (error.stack) {
        errorMessage += `\nStack: ${error.stack}`;
      }
    } else if (error && typeof error === 'object') {
      // Handle Axios errors or similar API errors
      if (error.isAxiosError) {
        errorMessage += `Axios Error: ${error.message}`;
        
        // Add request details
        if (error.config) {
          errorMessage += `\nRequest: ${error.config.method?.toUpperCase() || 'UNKNOWN'} ${error.config.url || 'unknown-url'}`;
        }
        
        // Add response details if available
        if (error.response) {
          errorMessage += `\nStatus: ${error.response.status} ${error.response.statusText || ''}`;
          errorMessage += `\nResponse Data: ${JSON.stringify(error.response.data || {})}`;
        } else if (error.request) {
          errorMessage += '\nNo response received from server';
        }
      } else {
        // Generic object error
        errorMessage += JSON.stringify(error);
      }
    } else {
      // Fallback for unknown error types
      errorMessage += String(error);
    }
    
    // Log to console and file
    console.error(errorMessage);
    fs.appendFileSync(ERROR_LOG_PATH, errorMessage + '\n');
    
  } catch (loggingError) {
    // Fallback if our error logging itself fails
    console.error(`Failed to log error: ${loggingError}`);
    console.error('Original error:', error);
  }
}

/**
 * Debug logging function
 */
export function logDebug(context: string, message: string, data?: any): void {
  let logMessage = `[${new Date().toISOString()}] [DEBUG] [${context}] ${message}`;
  
  // Add data if provided
  if (data !== undefined) {
    try {
      if (typeof data === 'object') {
        logMessage += ` ${JSON.stringify(data, null, 2)}`;
      } else {
        logMessage += ` ${data}`;
      }
    } catch (error) {
      logMessage += ` [Error stringifying data: ${error}]`;
    }
  }
  
  // Log to console and file
  console.log(logMessage);
  fs.appendFileSync(DEBUG_LOG_PATH, logMessage + '\n');
}

/**
 * Info logging function
 */
export function logInfo(context: string, message: string, data?: any): void {
  let logMessage = `[${new Date().toISOString()}] [INFO] [${context}] ${message}`;
  
  // Add data if provided
  if (data !== undefined) {
    try {
      if (typeof data === 'object') {
        logMessage += ` ${JSON.stringify(data, null, 2)}`;
      } else {
        logMessage += ` ${data}`;
      }
    } catch (error) {
      logMessage += ` [Error stringifying data: ${error}]`;
    }
  }
  
  // Log to console and file (use the debug log for info too)
  console.log(logMessage);
  fs.appendFileSync(DEBUG_LOG_PATH, logMessage + '\n');
}

export default {
  logError,
  logDebug,
  logInfo
};