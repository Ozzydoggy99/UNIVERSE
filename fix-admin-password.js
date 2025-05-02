import { storage } from './server/mem-storage.js';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

async function fixAdminPassword() {
  try {
    // Fix admin password
    const adminUser = await storage.getUserByUsername("admin");
    
    if (adminUser) {
      console.log("Found admin user, fixing password...");
      const hashedPassword = await hashPassword("admin123");
      
      // Update admin user
      await storage.updateUser(adminUser.id, {
        ...adminUser,
        password: hashedPassword
      });
      
      console.log("Updated admin password successfully");
      return;
    } else {
      console.log("Admin user not found, creating new admin...");
      const hashedPassword = await hashPassword("admin123");
      
      // Create new admin
      const newAdmin = await storage.createUser({
        username: "admin",
        password: hashedPassword,
        role: "admin"
      });
      
      console.log("Created new admin user:", newAdmin);
    }
  } catch (error) {
    console.error("Error fixing admin password:", error);
  }
}

fixAdminPassword();