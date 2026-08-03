import { readOption, runJobCommand } from './job-command.js';

const limit = Number(readOption('limit') ?? '20');
if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  throw new Error('--limit must be an integer between 1 and 100');
}

await runJobCommand(operations => operations.listFailed(limit));
