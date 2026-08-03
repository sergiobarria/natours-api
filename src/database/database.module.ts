import { Global, Module, Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service.js';
import { DATABASE, DATABASE_POOL } from './database.constants.js';
import { DatabaseLifecycle } from './database.lifecycle.js';
import type { Database } from './database.types.js';
import { DatabaseUnitOfWork } from './database-unit-of-work.js';
import * as schema from './schema/index.js';

const poolProvider: Provider<Pool> = {
  provide: DATABASE_POOL,
  inject: [AppConfigService],
  useFactory(config: AppConfigService): Pool {
    return new Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: config.databasePoolConnectionTimeoutMs,
      idleTimeoutMillis: config.databasePoolIdleTimeoutMs,
      max: config.databasePoolMax,
    });
  },
};

const databaseProvider: Provider<Database> = {
  provide: DATABASE,
  inject: [DATABASE_POOL],
  useFactory(pool: Pool): Database {
    return drizzle({ client: pool, schema });
  },
};

@Global()
@Module({
  providers: [poolProvider, databaseProvider, DatabaseLifecycle, DatabaseUnitOfWork],
  exports: [DATABASE, DATABASE_POOL, DatabaseUnitOfWork],
})
export class DatabaseModule {}
