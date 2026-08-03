import { readOption, runJobCommand } from './job-command.js';

const id = readOption('id');
const state = readOption('state');
if (!id) {
  throw new Error('--id is required');
}
if (state !== 'failed' && state !== 'completed') {
  throw new Error('--state must be failed or completed');
}

await runJobCommand(async operations => {
  await operations.replay(id, state);
  return { id, replayedFrom: state };
});
