import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import robotPointsMap from "./robot-points-map";
import http from "http";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

(async () => {
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
        console.log(`Available point sets after refresh: ${pointSets.map(set => set.id).join(', ')}`);
      } catch (refreshError) {
        console.error('Error during scheduled robot points refresh:', refreshError);
      }
    }, REFRESH_INTERVAL);
    console.log(`Scheduled automatic refresh of robot points every ${REFRESH_INTERVAL/60000} minutes`);
  } catch (error) {
    console.error('Error initializing robot points map:', error);
    // Continue starting the server even if point refresh fails
  }

  const server = await registerRoutes(app);

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
  // this serves both the API and the client.
  const startPort = 5000;
  const maxPortAttempts = 10; // Try ports 5000-5009
  
  // To avoid port conflicts, we need to ensure any existing server is properly closed
  // before attempting to start a new one
  function tryPort(portNumber: number, attempt: number) {
    // Add better error handling and port availability checking
    server.listen({
      port: portNumber,
      host: "0.0.0.0",
      // Setting reusePort to false to ensure we don't try to share a port that might be
      // in use by another server instance - this is more compatible with various platforms
      reusePort: false,
    }, () => {
      log(`serving on port ${portNumber}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && attempt < maxPortAttempts) {
        // Port is in use, try the next one
        const nextPort = portNumber + 1;
        log(`Port ${portNumber} is in use, trying port ${nextPort}...`);
        tryPort(nextPort, attempt + 1);
      } else {
        // Either we've exhausted all port attempts or hit a different error
        log(`Failed to start server: ${err.message}`);
        throw err;
      }
    });
  }
  
  // Start trying ports
  tryPort(startPort, 0);
})();
