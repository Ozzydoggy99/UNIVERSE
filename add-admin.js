import { storage } from './server/mem-storage.js';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

async function addAdmin() {
  try {
    // Check if admin already exists
    const existingUser = await storage.getUserByUsername("admin");
    if (existingUser) {
      console.log("Admin user already exists");
      return;
    }
    
    // Create new admin user
    const hashedPassword = await hashPassword("admin123");
    const newUser = await storage.createUser({
      username: "admin",
      password: hashedPassword,
      role: "admin"
    });
    
    console.log("Created new admin user");
  } catch (error) {
    console.error("Error adding admin user:", error);
  }
}

addAdmin();