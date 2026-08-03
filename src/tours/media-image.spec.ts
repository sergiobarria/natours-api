import sharp from 'sharp';
import { MAX_MEDIA_FILE_SIZE, processTourImage } from './media-image.js';

describe('processTourImage', () => {
  it.each(['jpeg', 'png', 'webp'] as const)(
    'accepts real %s content and creates WebP variants',
    async format => {
      const image = sharp({
        create: { width: 30, height: 20, channels: 3, background: '#228833' },
      });
      const buffer = await image.toFormat(format).toBuffer();
      const result = await processTourImage(buffer);
      expect(result.format).toBe(format);
      await expect(sharp(result.card).metadata()).resolves.toMatchObject({
        format: 'webp',
        width: 1200,
        height: 800,
      });
      await expect(sharp(result.thumbnail).metadata()).resolves.toMatchObject({
        format: 'webp',
        width: 480,
        height: 320,
      });
    },
  );

  it('rejects spoofed and oversized content', async () => {
    await expect(processTourImage(Buffer.from('not an image'))).rejects.toThrow(/decoded/);
    await expect(processTourImage(Buffer.alloc(MAX_MEDIA_FILE_SIZE + 1))).rejects.toThrow(/10 MB/);
  });
});
