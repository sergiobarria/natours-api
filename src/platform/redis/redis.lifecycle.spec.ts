import { EventEmitter } from 'node:events';
import { RedisLifecycle } from './redis.lifecycle.js';
import type { RedisClient } from './redis.types.js';

class RedisClientFake extends EventEmitter {
  status: 'wait' | 'connecting' | 'ready' | 'end' = 'wait';
  connectCalls = 0;
  quitCalls = 0;

  connect(): Promise<void> {
    this.connectCalls += 1;
    this.status = 'ready';
    return Promise.resolve();
  }

  quit(): Promise<'OK'> {
    this.quitCalls += 1;
    return Promise.resolve('OK');
  }
}

describe('RedisLifecycle', () => {
  it('connects a client that has not been started', async () => {
    const client = new RedisClientFake();
    const lifecycle = new RedisLifecycle(client as unknown as RedisClient);

    await lifecycle.onModuleInit();

    expect(client.connectCalls).toBe(1);
  });

  it('waits for an in-progress connection instead of connecting twice', async () => {
    const client = new RedisClientFake();
    client.status = 'connecting';
    const lifecycle = new RedisLifecycle(client as unknown as RedisClient);

    const initialization = lifecycle.onModuleInit();
    client.status = 'ready';
    client.emit('ready');
    await initialization;

    expect(client.connectCalls).toBe(0);
  });
});
