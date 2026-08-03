import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_MEDIA_FILE_SIZE = 10 * 1024 * 1024;
const acceptedFormats = new Set(['jpeg', 'png', 'webp']);

export interface ProcessedImage {
  format: 'jpeg' | 'png' | 'webp';
  size: number;
  width: number;
  height: number;
  original: Buffer;
  card: Buffer;
  thumbnail: Buffer;
}

export async function processTourImage(buffer: Buffer): Promise<ProcessedImage> {
  if (buffer.length < 1 || buffer.length > MAX_MEDIA_FILE_SIZE) {
    throw new BadRequestException('Each image must be no larger than 10 MB.');
  }
  try {
    const metadata = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: 100_000_000,
    }).metadata();
    if (
      !metadata.format ||
      !acceptedFormats.has(metadata.format) ||
      !metadata.width ||
      !metadata.height
    ) {
      throw new BadRequestException('Only valid JPEG, PNG, and WebP images are accepted.');
    }
    const format = metadata.format as ProcessedImage['format'];
    const card = await sharp(buffer)
      .resize(1200, 800, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toBuffer();
    const thumbnail = await sharp(buffer)
      .resize(480, 320, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer();
    return {
      format,
      size: buffer.length,
      width: metadata.width,
      height: metadata.height,
      original: buffer,
      card,
      thumbnail,
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Image content could not be decoded.');
  }
}
