import type { INestApplicationContext, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

export async function createProcessApplication(
  rootModule: Type<unknown>,
): Promise<INestApplicationContext> {
  const app = await NestFactory.createApplicationContext(rootModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  return app;
}
