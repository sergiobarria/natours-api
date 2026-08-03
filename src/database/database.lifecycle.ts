import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { Pool } from 'pg';
import { DATABASE_POOL } from './database.constants.js';

@Injectable()
export class DatabaseLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseLifecycle.name);
  private readonly handlePoolError = (error: Error): void => {
    this.logger.error('Unexpected PostgreSQL pool error', error.stack);
  };

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  onModuleInit(): void {
    this.pool.on('error', this.handlePoolError);
  }

  async onApplicationShutdown(): Promise<void> {
    this.pool.off('error', this.handlePoolError);
    await this.pool.end();
  }
}
