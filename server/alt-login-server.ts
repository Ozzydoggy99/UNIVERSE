import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001;

// Add middleware to parse JSON bodies
app.use(express.json());

// API routes - define these before Vite middleware
app.post('/api/auth/login', (req, res) => {
  // Simple mock authentication
  const { username, password } = req.body;
  console.log('Login attempt:', { username, password });
  
  if (username === 'test' && password === 'test') {
    res.json({ success: true });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Setup Vite middleware
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
  root: join(__dirname, '../app'),
});

app.use(vite.middlewares);

// Catch all routes to handle client-side routing
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile('index.html', { root: join(__dirname, '../app') });
});

app.listen(port, () => {
  console.log(`Alternative login server running at http://localhost:${port}`);
}); 