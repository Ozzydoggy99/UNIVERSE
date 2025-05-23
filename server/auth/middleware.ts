import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';

// Configure passport local strategy
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    // Find user in database
    const user = await db.query.users.findFirst({
      where: eq(users.username, username)
    });

    if (!user) {
      return done(null, false, { message: 'Incorrect username.' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return done(null, false, { message: 'Incorrect password.' });
    }

    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = user;
    return done(null, userWithoutPassword);
  } catch (err) {
    return done(err);
  }
}));

// Serialize user for the session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id)
    });
    if (!user) {
      return done(null, false);
    }
    const { passwordHash, ...userWithoutPassword } = user;
    done(null, userWithoutPassword);
  } catch (err) {
    done(err);
  }
});

// Middleware to check if user is authenticated
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Not authenticated' });
};

// Middleware to check if user is not authenticated
export const isNotAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.status(403).json({ message: 'Already authenticated' });
}; 