import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  out: './test/database/fixtures/migrations',
  schema: './test/database/fixtures/schema.ts',
  strict: true,
  verbose: true,
});
