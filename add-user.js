import { storage } from './server/storage.js';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

async function addUser() {
  try {
    // Get template 1
    const templates = await storage.getAllTemplates();
    const template1 = templates.find(t => t.name === "Template 1");
    
    if (!template1) {
      console.error("Template 1 not found");
      return;
    }
    
    // Check if user already exists
    const existingUser = await storage.getUserByUsername("Nana");
    if (existingUser) {
      console.log("User Nana already exists, updating template");
      await storage.updateUser(existingUser.id, { templateId: template1.id });
      console.log(`Updated Nana with Template 1 (id: ${template1.id})`);
      return;
    }
    
    // Create new user
    const hashedPassword = await hashPassword("Nana");
    const newUser = await storage.createUser({
      username: "Nana",
      password: hashedPassword,
      role: "user",
      templateId: template1.id
    });
    
    console.log(`Created new user Nana with Template 1 (id: ${template1.id})`);
  } catch (error) {
    console.error("Error adding user:", error);
  }
}

addUser();