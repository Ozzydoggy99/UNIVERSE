const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const fs = require('fs');

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function writeToTempFile(content) {
  const tempFilePath = path.join(process.cwd(), 'temp-user-credentials.json');
  await fs.promises.writeFile(tempFilePath, JSON.stringify(content, null, 2));
  console.log(`Credentials written to ${tempFilePath}`);
}

async function createTestUser() {
  try {
    console.log('Generating credentials for test user...');
    
    // Create a test user with simple credentials
    const username = 'testuser';
    const password = 'test123';
    const hashedPassword = await hashPassword(password);
    
    // Write the credentials to a temp file that can be used in server code
    await writeToTempFile({
      username,
      password,
      hashedPassword
    });
    
    console.log('Test user credentials generated successfully');
    console.log('Username:', username);
    console.log('Password:', password);
    console.log('Use these credentials to log in to the application');
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

createTestUser();