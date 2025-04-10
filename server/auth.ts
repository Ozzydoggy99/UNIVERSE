import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "../shared/schema";
import memorystore from "memorystore";

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
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

// Function to create predefined users, templates, and assign templates to users
async function createPredefinedUsers() {
  try {
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
    let adminUser = await storage.getUserByUsername("Ozzydog");
    if (!adminUser) {
      const hashedPassword = await hashPassword("Ozzydog");
      adminUser = await storage.createUser({
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
    
    // Create robot template assignments if they don't exist
    const robotAssignments = await storage.getAllRobotTemplateAssignments();
    if (robotAssignments.length === 0 && template1 && template2) {
      // Create assignment for robot 1
      await storage.createRobotTemplateAssignment({
        name: "Floor Robot 1",
        description: "Main floor service robot",
        serialNumber: "AX-2000-1",
        templateId: template1.id,
        isActive: true
      });
      
      // Create assignment for robot 2
      await storage.createRobotTemplateAssignment({
        name: "Floor Robot 2",
        description: "Secondary floor service robot",
        serialNumber: "AX-2000-2",
        templateId: template1.id,
        isActive: true
      });
      
      // Create assignment for robot 3
      await storage.createRobotTemplateAssignment({
        name: "Storage Robot",
        description: "Inventory management robot",
        serialNumber: "AX-2000-3",
        templateId: template2.id,
        isActive: true
      });
      
      console.log("Created 3 robot template assignments");
    }
  } catch (error) {
    console.error("Error creating predefined users and templates:", error);
  }
}

export async function setupAuth(app: Express) {
  const MemoryStore = memorystore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "skytech-automated-secret",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    cookie: {
      maxAge: 86400000, // 24 hours
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

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user || null);
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