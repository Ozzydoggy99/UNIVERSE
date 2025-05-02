import { storage } from './server/mem-storage.js';
import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Create a test user with simple credentials
    const hashedPassword = await hashPassword('test123');
    
    // Check if user already exists
    let testUser = await storage.getUserByUsername('testuser');
    
    if (!testUser) {
      testUser = await storage.createUser({
        username: 'testuser',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Created test user with ID:', testUser.id);
    } else {
      console.log('Test user already exists with ID:', testUser.id);
      
      // Update the password to ensure it's correct
      await storage.updateUser(testUser.id, {
        ...testUser,
        password: hashedPassword
      });
      console.log('Updated test user password');
    }
    
    console.log('Test user created/updated successfully');
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

createTestUser();