import { FakeObjectStorage } from './fake-object-storage.js';

describe('FakeObjectStorage', () => {
  it('stores copies and deletes objects', async () => {
    const storage = new FakeObjectStorage();
    const body = Buffer.from('image');
    await storage.put('key', body, 'image/webp');
    body.fill(0);
    expect(storage.objects.get('key')?.body.toString()).toBe('image');
    await storage.delete('key');
    expect(storage.objects.has('key')).toBe(false);
  });

  it('can fail deterministic storage calls', async () => {
    const storage = new FakeObjectStorage();
    storage.failPutAt = 1;
    await expect(storage.put('key', Buffer.alloc(1), 'image/webp')).rejects.toThrow(/upload/);
  });
});
