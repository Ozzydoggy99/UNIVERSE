import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./mem-storage";
import { User as SelectUser } from "../shared/schema";
import memorystore from "memorystore";

// Middleware to ensure user is authenticated
export function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Authentication required' });
}

// Middleware to ensure authenticated user is an admin
export function ensureAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user && (req.user as SelectUser).role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Admin privileges required' });
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.error("Invalid stored password format");
      return false;
    }
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    
    // Log buffer lengths to help debug
    console.log(`Password buffer lengths - Stored: ${hashedBuf.length}, Supplied: ${suppliedBuf.length}`);
    
    // Handle potential length mismatch by comparing string versions if buffers are different lengths
    if (hashedBuf.length !== suppliedBuf.length) {
      console.log("Buffer length mismatch, comparing string versions");
      return hashedBuf.toString("hex") === suppliedBuf.toString("hex");
    }
    
    // If lengths match, use timingSafeEqual for secure comparison
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

// Function to create predefined users, templates, and assign templates to users
async function createPredefinedUsers() {
  try {
    console.log("Creating predefined users and templates...");
    
    // Create admin user if it doesn't exist
    let adminUser = await storage.getUserByUsername("admin");
    if (!adminUser) {
      console.log("Creating admin user...");
      const hashedPassword = await hashPassword("admin");
      adminUser = await storage.createUser({
        username: "admin",
        password: hashedPassword,
        role: "admin"
      });
      console.log("Created admin user with ID:", adminUser.id);
    } else {
      console.log("Admin user already exists with ID:", adminUser.id);
    }
    
    // Create UI templates if they don't exist
    const templates = await storage.getAllTemplates();
    
    // Create template 1 with green theme if it doesn't exist
    let template1 = templates.find(t => t.name === "Template 1");
    if (!template1) {
      template1 = await storage.createTemplate({
        name: "Template 1",
        description: "Default template with green theme",
        layout: JSON.stringify({
          primaryColor: "#228B22", // Forest Green
          secondaryColor: "#000000", // Black
          components: [
            { type: "header", content: "Skytech Automated", position: "top" },
            { 
              type: "rectangle", 
              color: "#228B22", 
              height: 150, 
              position: "top",
              icon: "laundry",
              label: "LAUNDRY",
              floors: 6 // Default to 6 laundry floors (2x3 grid)
            },
            { 
              type: "rectangle", 
              color: "#0047AB", 
              height: 150, 
              position: "middle",
              icon: "trash",
              label: "TRASH",
              floors: 10 // Default to 10 trash floors (2x5 grid)
            }
          ]
        }),
        isActive: true
      });
      console.log("Created Template 1");
    }
    
    // Create template 2 with blue theme if it doesn't exist
    let template2 = templates.find(t => t.name === "Template 2");
    if (!template2) {
      template2 = await storage.createTemplate({
        name: "Template 2",
        description: "Alternative template with blue theme",
        layout: JSON.stringify({
          primaryColor: "#0047AB", // Cobalt Blue
          secondaryColor: "#000000", // Black
          components: [
            { type: "header", content: "Skytech Automated", position: "top" },
            { 
              type: "rectangle", 
              color: "#228B22", 
              height: 150, 
              position: "top",
              icon: "laundry",
              label: "LAUNDRY",
              floors: 10 // Default to 10 laundry floors (2x5 grid)
            },
            { 
              type: "rectangle", 
              color: "#0047AB", 
              height: 150, 
              position: "middle",
              icon: "trash",
              label: "TRASH",
              floors: 10 // Default to 10 trash floors (2x5 grid)
            }
          ]
        }),
        isActive: true
      });
      console.log("Created Template 2");
    }

    // Check if Ozzydog exists, if not create admin user
    let ozzydogUser = await storage.getUserByUsername("Ozzydog");
    if (!ozzydogUser) {
      const hashedPassword = await hashPassword("Ozzydog");
      ozzydogUser = await storage.createUser({
        username: "Ozzydog",
        password: hashedPassword,
        role: "admin"
      });
      console.log("Created admin user: Ozzydog");
    }

    // Check if Phil exists, if not create regular user with template 1
    let philUser = await storage.getUserByUsername("Phil");
    if (!philUser) {
      const hashedPassword = await hashPassword("Phil");
      philUser = await storage.createUser({
        username: "Phil",
        password: hashedPassword,
        role: "user"
      });
      console.log("Created regular user: Phil");
    }
    
    // Check if Isabella exists, if not create regular user with template 2
    let isabellaUser = await storage.getUserByUsername("Isabella");
    if (!isabellaUser) {
      const hashedPassword = await hashPassword("Isabella");
      isabellaUser = await storage.createUser({
        username: "Isabella",
        password: hashedPassword,
        role: "user"
      });
      console.log("Created regular user: Isabella");
    }
    
    // Assign templates if needed
    if (template1 && philUser && !philUser.templateId) {
      await storage.updateUser(philUser.id, { templateId: template1.id });
      console.log("Assigned Template 1 to Phil");
    }
    
    if (template2 && isabellaUser && !isabellaUser.templateId) {
      await storage.updateUser(isabellaUser.id, { templateId: template2.id });
      console.log("Assigned Template 2 to Isabella");
    }
    
    // Check if Nana exists, if not create regular user with template 1
    let nanaUser = await storage.getUserByUsername("Nana");
    if (!nanaUser) {
      const hashedPassword = await hashPassword("Nana");
      nanaUser = await storage.createUser({
        username: "Nana",
        password: hashedPassword,
        role: "user"
      });
      console.log("Created regular user: Nana");
    }
    
    // Assign template 1 to Nana if needed
    if (template1 && nanaUser && !nanaUser.templateId) {
      await storage.updateUser(nanaUser.id, { templateId: template1.id });
      console.log("Assigned Template 1 to Nana");
    }
    
    // Check if Papa exists, if not create regular user with template 1
    let papaUser = await storage.getUserByUsername("Papa");
    if (!papaUser) {
      const hashedPassword = await hashPassword("Papa");
      papaUser = await storage.createUser({
        username: "Papa",
        password: hashedPassword,
        role: "user"
      });
      console.log("Created regular user: Papa");
    }
    
    // Assign template 1 to Papa if needed
    if (template1 && papaUser && !papaUser.templateId) {
      await storage.updateUser(papaUser.id, { templateId: template1.id });
      console.log("Assigned Template 1 to Papa");
    }
    
    // Create robot template assignments if they don't exist
    const robotAssignments = await storage.getAllRobotTemplateAssignments();
    if (robotAssignments.length === 0 && template1 && template2) {
      // Create assignment for robot 1
      await storage.createRobotTemplateAssignment({
        name: "Floor Robot 1",
        location: "Main Floor",
        serialNumber: "AX-2000-1",
        templateId: template1.id,
        robotModel: "AX-2000",
        isActive: true
      });
      
      // Create assignment for robot 2
      await storage.createRobotTemplateAssignment({
        name: "Floor Robot 2",
        location: "Secondary Floor",
        serialNumber: "AX-2000-2",
        templateId: template1.id,
        robotModel: "AX-2000",
        isActive: true
      });
      
      // Create assignment for robot 3
      await storage.createRobotTemplateAssignment({
        name: "Storage Robot",
        location: "Storage Area",
        serialNumber: "AX-2000-3",
        templateId: template2.id,
        robotModel: "AX-2000",
        isActive: true
      });
      
      console.log("Created 3 robot template assignments");
    }
  } catch (error) {
    console.error("Error creating predefined users and templates:", error);
  }
}

export async function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "skytech-automated-secret",
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    cookie: {
      maxAge: 86400000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Create predefined users if they don't exist
  await createPredefinedUsers();

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`Attempting login for username: ${username}`);
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          console.log(`User not found: ${username}`);
          return done(null, false);
        }
        
        console.log(`User found, checking password: ${username}`);
        const passwordValid = await comparePasswords(password, user.password);
        
        if (!passwordValid) {
          console.log(`Invalid password for user: ${username}`);
          return done(null, false);
        }
        
        console.log(`Login successful for user: ${username}, role: ${user.role}`);
        return done(null, user);
      } catch (error) {
        console.error(`Login error for ${username}:`, error);
        return done(error);
      }
    }),
  );

  // Serialize and deserialize users
  passport.serializeUser((user: Express.User, done) => {
    // Access the id with proper type casting
    const typedUser = user as unknown as { id: number };
    done(null, typedUser.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (error) {
      console.error('Error deserializing user:', error);
      done(error, null);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    // Check if the user is authenticated and is an admin
    if (!req.isAuthenticated() || (req.user as SelectUser).role !== "admin") {
      return res.status(403).json({ message: "Only admin users can register new users" });
    }
    
    const { username, password, role = "user" } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    
    try {
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: role
      });
      
      // Don't return password in response
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error during registration" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        // Don't return password in response
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    // Don't return password in response
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.json(userWithoutPassword);
  });
}