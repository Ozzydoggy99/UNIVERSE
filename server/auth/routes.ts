import { Router } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { users } from '../db/schema.js';
import { isAuthenticated, isNotAuthenticated } from './middleware.js';

const router = Router();

// Validation schemas
const userSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

// Login route
router.post('/login', isNotAuthenticated, (req, res, next) => {
  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (!user) {
      return res.status(401).json({ message: info.message || 'Authentication failed' });
    }
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Internal server error' });
      }
      return res.json({ user });
    });
  })(req, res, next);
});

// Signup route
router.post('/signup', isNotAuthenticated, async (req, res) => {
  try {
    // Validate input
    const { username, password } = userSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, username)
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const [user] = await db.insert(users).values({
      username,
      passwordHash,
    }).returning({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
    });

    // Log in the user
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Internal server error' });
      }
      return res.status(201).json({ user });
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout route
router.post('/logout', isAuthenticated, (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user route
router.get('/me', isAuthenticated, (req, res) => {
  res.json({ user: req.user });
});

export default router; 