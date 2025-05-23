import type { Config } from 'drizzle-kit';

export default {
  schema: './server/db/schema.ts',
  dialect: 'sqlite',
  out: './server/db/migrations',
  dbCredentials: {
    url: './data/sqlite.db'
  },
  verbose: true,
  strict: true
} satisfies Config;
