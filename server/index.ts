import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./api-routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import robotPointsMap from "./map-adapter.js";
import http from "http";
import { setupRobotWebSocketServer } from './robot-websocket.js';
import { startMapSync, mapSyncEvents, getCurrentMapData } from './map-sync-service.js';
import { setupMapWebSocketServer } from './map-websocket.js';
import session from 'express-session';
import passport from 'passport';
import SQLiteStore from 'connect-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './auth/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const SQLiteStoreSession = SQLiteStore(session);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  store: new SQLiteStoreSession({
    db: 'sessions.db',
    dir: path.join(__dirname, '../data'),
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
  },
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

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
    
    // Start the map sync service
    try {
      console.log('Starting map sync service...');
      await startMapSync();
      console.log('Map sync service started successfully');
      
      // Log current map data
      const mapData = getCurrentMapData();
      console.log('\nCurrent Maps:');
      console.log(JSON.stringify(mapData.maps, null, 2));
      
      console.log('\nPoints by Map:');
      for (const [mapId, points] of Object.entries(mapData.points)) {
        console.log(`\nMap ${mapId} Points:`);
        console.log(JSON.stringify(points, null, 2));
      }
      
      // Set up event listeners for map/point changes
      mapSyncEvents.on('mapsChanged', (changes) => {
        console.log('[SERVER] Map changes detected:', changes);
      });
      
      mapSyncEvents.on('pointsChanged', (data) => {
        console.log('[SERVER] Point changes detected:', data);
      });
    } catch (error) {
      console.error('Error starting map sync service:', error);
      // Continue starting the server even if map sync fails
    }

    console.log("Registering routes...");
    const server = await registerRoutes(app);
    console.log("Routes registered.");

    // Set up WebSocket servers
    setupRobotWebSocketServer(server);
    setupMapWebSocketServer(server);

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

    // Routes
    app.use('/api/auth', authRoutes);

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
      app.use(express.static(path.join(__dirname, '../dist')));
      app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
      });
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