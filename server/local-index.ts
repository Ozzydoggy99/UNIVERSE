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
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./api-routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import robotPointsMap from "./map-adapter.js";
import http from "http";
import { setupRobotWebSocketServer } from './robot-websocket.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add test endpoint BEFORE server setup
app.get('/api/test', (req, res) => {
  console.log('[TEST] Server is running');
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    websocket: {
      url: 'ws://47.180.91.99:8090/ws/v2/topics',
      headers: {
        'APPCODE': '667a51a4d948433081a272c78d10a8a4'
      }
    }
  });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

console.log("SERVER ENTRY REACHED");
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Single server startup function
async function startServer() {
  try {
    console.log("Starting server setup...");
    
    // Initialize robot points map on startup
    try {
      console.log('Initializing robot points map...');
      await robotPointsMap.refreshPointsFromRobot();
      console.log('Robot points map initialized successfully');
      
      // Set up periodic refresh (every 5 minutes)
      const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
      setInterval(async () => {
        try {
          console.log('Performing scheduled refresh of robot points...');
          await robotPointsMap.refreshPointsFromRobot();
          
          // Log the currently available point sets
          const pointSets = robotPointsMap.getPointSets();
          console.log(`Available point sets after refresh: ${pointSets.map((set: {id: string}) => set.id).join(', ')}`);
        } catch (refreshError) {
          console.error('Error during scheduled robot points refresh:', refreshError);
        }
      }, REFRESH_INTERVAL);
      console.log(`Scheduled automatic refresh of robot points every ${REFRESH_INTERVAL/60000} minutes`);
    } catch (error) {
      console.error('Error initializing robot points map:', error);
      // Continue starting the server even if point refresh fails
    }

    console.log("Registering routes...");
    const server = await registerRoutes(app);
    console.log("Routes registered.");

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Try multiple ports starting with 5000
    const startPort = 5000;
    const maxPortAttempts = 10; // Try ports 5000-5009
    
    function tryPort(portNumber: number, attempt: number) {
      server.listen({
        port: portNumber,
        host: "0.0.0.0",
        reusePort: false,
      }, () => {
        log(`[SERVER] Server running on port ${portNumber}`);
        log('[SERVER] Test endpoint available at /api/test');
      }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE' && attempt < maxPortAttempts) {
          const nextPort = portNumber + 1;
          log(`Port ${portNumber} is in use, trying port ${nextPort}...`);
          tryPort(nextPort, attempt + 1);
        } else {
          log(`Failed to start server: ${err.message}`);
          throw err;
        }
      });
    }
    
    // Start trying ports
    tryPort(startPort, 0);
  } catch (error) {
    console.error('[SERVER] Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 
