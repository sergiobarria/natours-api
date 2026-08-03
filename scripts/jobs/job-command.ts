import type { INestApplicationContext } from '@nestjs/common';
import { JobOperationsService } from '../../src/platform/jobs/job-operations.service.js';
import { createProcessApplication } from '../../src/process/process-application.js';
import { OperationsAppModule } from '../../src/operations-app.module.js';

export function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length);
}

export async function runJobCommand(
  command: (operations: JobOperationsService) => Promise<unknown>,
): Promise<void> {
  let app: INestApplicationContext | undefined;
  try {
    app = await createProcessApplication(OperationsAppModule);
    const result = await command(app.get(JobOperationsService));
    console.info(JSON.stringify(result, null, 2));
  } finally {
    await app?.close();
  }
}
