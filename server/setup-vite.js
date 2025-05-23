import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function setupVite(app) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
    root: join(__dirname, '../app'),
  });

  app.use(vite.middlewares);

  return vite;
} 