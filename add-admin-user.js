// Script to directly add a user to the database for admin access
// Uses hardcoded credentials for testing purposes only

import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function addAdminUser() {
  try {
    console.log('Creating admin user testuser...');
    
    // Create a test user with simple credentials
    const hashedPassword = await hashPassword('test123');
    
    // Insert directly into the database
    const [user] = await db
      .insert(users)
      .values({
        username: 'testuser',
        password: hashedPassword,
        role: 'admin'
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          password: hashedPassword
        }
      })
      .returning();
    
    console.log('Admin user created/updated successfully:', user);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    process.exit();
  }
}

addAdminUser();