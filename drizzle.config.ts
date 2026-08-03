import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { ENVIRONMENT_VARIABLES } from './src/config/config.constants.js';

const databaseUrl = process.env[ENVIRONMENT_VARIABLES.databaseUrl];

if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required');
}

export default defineConfig({
  dbCredentials: {
    url: databaseUrl,
  },
  dialect: 'postgresql',
  out: './drizzle',
  schema: './src/database/schema/index.ts',
  strict: true,
  verbose: true,
});
