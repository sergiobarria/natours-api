import { readOption, runJobCommand } from './job-command.js';

const id = readOption('id');
if (!id) {
  throw new Error('--id is required');
}

await runJobCommand(async operations => {
  const job = await operations.inspect(id);
  if (!job) {
    throw new Error(`Job not found: ${id}`);
  }
  return job;
});
