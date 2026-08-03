import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const startupObservationMs = 750;
const shutdownTimeoutMs = 5_000;
const entries = ['main', 'worker'] as const;

interface ProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

async function checkProcess(entry: (typeof entries)[number], port: number): Promise<void> {
  const child = spawn(process.execPath, [`dist/${entry}.js`], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', chunk => {
    output += String(chunk);
  });
  child.stderr?.on('data', chunk => {
    output += String(chunk);
  });

  await delay(startupObservationMs);
  if (child.exitCode !== null || child.signalCode !== null) {
    throw new Error(
      `${entry} exited during startup with code=${child.exitCode} signal=${child.signalCode}: ${output}`,
    );
  }

  const exitPromise = new Promise<ProcessExit>(resolve =>
    child.once('exit', (code, signal) => resolve({ code, signal })),
  );
  child.kill('SIGTERM');
  const result = await Promise.race([exitPromise, delay(shutdownTimeoutMs).then(() => undefined)]);
  if (result === undefined) {
    child.kill('SIGKILL');
    throw new Error(`${entry} did not stop within ${shutdownTimeoutMs}ms`);
  }
  if (result.code !== 0 && result.signal !== 'SIGTERM') {
    throw new Error(`${entry} exited with code=${result.code} signal=${result.signal}: ${output}`);
  }
}

for (const [index, entry] of entries.entries()) {
  await checkProcess(entry, 31_00 + index);
}

console.info('API and worker started and stopped cleanly.');
