import type { ObjectStorage } from './object-storage.js';

export class FakeObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  failPutAt?: number;
  failDeleteAt?: number;
  private puts = 0;
  private deletes = 0;

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.puts += 1;
    if (this.puts === this.failPutAt) {
      return Promise.reject(new Error('Configured fake upload failure.'));
    }
    this.objects.set(key, { body: Buffer.from(body), contentType });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.deletes += 1;
    if (this.deletes === this.failDeleteAt) {
      return Promise.reject(new Error('Configured fake delete failure.'));
    }
    this.objects.delete(key);
    return Promise.resolve();
  }
}
