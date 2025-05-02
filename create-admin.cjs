// Using CommonJS modules to match the server implementation
const { storage } = require('./server/mem-storage');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdmin() {
  try {
    // Check if admin user exists
    const existingUser = await storage.getUserByUsername("admin");
    if (existingUser) {
      console.log("Admin user already exists");
      return;
    }
    
    // Create admin user
    const hashedPassword = await hashPassword("password");
    const newUser = await storage.createUser({
      username: "admin",
      password: hashedPassword,
      role: "admin"
    });
    
    console.log("Created admin user with username 'admin' and password 'password'");
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
}

createAdmin();