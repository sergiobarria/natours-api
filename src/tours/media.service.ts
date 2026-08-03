import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DrizzleAuditRecorder } from '../audit/drizzle-audit-recorder.js';
import { AppConfigService } from '../config/app-config.service.js';
import { DatabaseUnitOfWork } from '../database/database-unit-of-work.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseTransaction } from '../database/database.types.js';
import { tourMedia, tours } from '../database/schema/tours.js';
import { TourPolicyError } from './tour.errors.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage.js';
import { processTourImage, type ProcessedImage } from './media-image.js';

const MAX_FILES = 10;
type IdentifiedImage = ProcessedImage & { id: string };

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly config: AppConfigService,
    private readonly unitOfWork: DatabaseUnitOfWork,
    private readonly audit: DrizzleAuditRecorder,
  ) {}

  async publicList(tourId: string) {
    const rows = await this.database
      .select({
        id: tourMedia.id,
        position: tourMedia.position,
        keyPrefix: tourMedia.keyPrefix,
        originalFormat: tourMedia.originalFormat,
        width: tourMedia.width,
        height: tourMedia.height,
      })
      .from(tourMedia)
      .where(and(eq(tourMedia.tourId, tourId), eq(tourMedia.state, 'active')))
      .orderBy(asc(tourMedia.position), asc(tourMedia.id));
    return rows.map(row => this.present(row));
  }

  async upload(actorId: string, tourId: string, files: Express.Multer.File[], requestId?: string) {
    if (files.length === 0 || files.length > MAX_FILES) {
      throw new BadRequestException('Upload between one and ten images.');
    }
    const processed = await Promise.all(
      files.map(async file => ({ id: randomUUID(), ...(await processTourImage(file.buffer)) })),
    );
    const reserved = await this.reserve(tourId, processed);
    const uploaded: string[] = [];
    try {
      for (const item of reserved) {
        const image = processed.find(candidate => candidate.id === item.id)!;
        const keys = objectKeys(item.keyPrefix, image.format);
        await this.storage.put(keys.original, image.original, mimeType(image.format));
        uploaded.push(keys.original);
        await this.storage.put(keys.card, image.card, 'image/webp');
        uploaded.push(keys.card);
        await this.storage.put(keys.thumbnail, image.thumbnail, 'image/webp');
        uploaded.push(keys.thumbnail);
      }
    } catch (error) {
      const compensated = await this.compensate(uploaded, requestId);
      if (compensated)
        await this.removePendingUploads(
          tourId,
          reserved.map(row => row.id),
        );
      this.logger.error(
        { error: errorMessage(error), requestId, tourId, uploaded, compensated },
        'Media upload failed',
      );
      throw new ServiceUnavailableException('Media storage operation failed.');
    }

    return this.unitOfWork.transaction(async transaction => {
      await this.lockTour(transaction, tourId);
      const rows = await transaction
        .update(tourMedia)
        .set({ state: 'active', updatedAt: new Date() })
        .where(
          inArray(
            tourMedia.id,
            reserved.map(row => row.id),
          ),
        )
        .returning({
          id: tourMedia.id,
          position: tourMedia.position,
          keyPrefix: tourMedia.keyPrefix,
          originalFormat: tourMedia.originalFormat,
          width: tourMedia.width,
          height: tourMedia.height,
        });
      await this.audit.record(transaction, {
        action: 'tour.media_changed',
        actor: { type: 'user', userId: actorId },
        after: { status: 'uploaded', count: rows.length },
        eventKey: randomUUID(),
        requestId,
        targetId: tourId,
        targetType: 'tour',
      });
      return rows
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(row => this.present(row));
    });
  }

  async delete(
    actorId: string,
    tourId: string,
    imageId: string,
    requestId?: string,
  ): Promise<void> {
    const image = await this.markPendingDelete(tourId, imageId);
    const keys = objectKeys(image.keyPrefix, image.originalFormat);
    try {
      for (const key of Object.values(keys)) await this.storage.delete(key);
    } catch (error) {
      this.logger.error(
        { error: errorMessage(error), imageId, requestId, tourId, keys },
        'Media deletion failed',
      );
      throw new ServiceUnavailableException('Media deletion is pending storage recovery.');
    }
    await this.unitOfWork.transaction(async transaction => {
      await this.lockTour(transaction, tourId);
      await transaction
        .delete(tourMedia)
        .where(
          and(
            eq(tourMedia.id, imageId),
            eq(tourMedia.tourId, tourId),
            eq(tourMedia.state, 'pending_delete'),
          ),
        );
      await this.audit.record(transaction, {
        action: 'tour.media_changed',
        actor: { type: 'user', userId: actorId },
        after: { status: 'deleted' },
        eventKey: randomUUID(),
        requestId,
        targetId: imageId,
        targetType: 'tour_media',
      });
    });
  }

  async deleteAllForTour(actorId: string, tourId: string, requestId?: string): Promise<void> {
    const rows = await this.database
      .select({
        id: tourMedia.id,
        state: tourMedia.state,
        keyPrefix: tourMedia.keyPrefix,
        originalFormat: tourMedia.originalFormat,
      })
      .from(tourMedia)
      .where(eq(tourMedia.tourId, tourId))
      .orderBy(asc(tourMedia.position), asc(tourMedia.id));
    for (const row of rows) {
      if (row.state === 'pending_upload') {
        try {
          for (const key of Object.values(objectKeys(row.keyPrefix, row.originalFormat))) {
            await this.storage.delete(key);
          }
          await this.removePendingUploads(tourId, [row.id]);
        } catch (error) {
          this.logger.error(
            { error: errorMessage(error), imageId: row.id, requestId, tourId },
            'Pending upload cleanup blocked tour deletion',
          );
          throw new ServiceUnavailableException('Tour media cleanup failed.');
        }
      } else {
        await this.delete(actorId, tourId, row.id, requestId);
      }
    }
  }

  private reserve(tourId: string, images: IdentifiedImage[]) {
    return this.unitOfWork.transaction(async transaction => {
      await this.lockTour(transaction, tourId);
      const [current] = await transaction
        .select({ count: count() })
        .from(tourMedia)
        .where(
          and(eq(tourMedia.tourId, tourId), inArray(tourMedia.state, ['active', 'pending_upload'])),
        );
      const existing = current?.count ?? 0;
      if (existing + images.length > MAX_FILES) {
        throw new TourPolicyError(
          'TOUR_MEDIA_LIMIT_EXCEEDED',
          'A tour may have at most ten images.',
        );
      }
      return transaction
        .insert(tourMedia)
        .values(
          images.map((image, index) => ({
            id: image.id,
            tourId,
            position: existing + index + 1,
            state: 'pending_upload' as const,
            keyPrefix: `${this.config.environment}/tours/${tourId}/images/${image.id}`,
            originalFormat: image.format,
            originalSize: image.size,
            width: image.width,
            height: image.height,
          })),
        )
        .returning({ id: tourMedia.id, keyPrefix: tourMedia.keyPrefix });
    });
  }

  private markPendingDelete(tourId: string, imageId: string) {
    return this.unitOfWork.transaction(async transaction => {
      await this.lockTour(transaction, tourId);
      const [image] = await transaction
        .select()
        .from(tourMedia)
        .where(and(eq(tourMedia.id, imageId), eq(tourMedia.tourId, tourId)))
        .for('update')
        .limit(1);
      if (!image) throw new NotFoundException('Tour image not found.');
      if (image.state === 'pending_upload') {
        throw new TourPolicyError('TOUR_MEDIA_UPLOAD_PENDING', 'Image upload is still pending.');
      }
      if (image.state === 'active') {
        const removedPosition = image.position!;
        await transaction
          .update(tourMedia)
          .set({ state: 'pending_delete', position: null, updatedAt: new Date() })
          .where(eq(tourMedia.id, imageId));
        await this.compactPositions(transaction, tourId, removedPosition);
      }
      return image;
    });
  }

  private async removePendingUploads(tourId: string, ids: string[]): Promise<void> {
    await this.unitOfWork.transaction(async transaction => {
      await this.lockTour(transaction, tourId);
      const rows = await transaction
        .select({ id: tourMedia.id, position: tourMedia.position })
        .from(tourMedia)
        .where(and(eq(tourMedia.tourId, tourId), inArray(tourMedia.id, ids)))
        .orderBy(asc(tourMedia.position));
      await transaction.delete(tourMedia).where(inArray(tourMedia.id, ids));
      for (const row of rows.reverse()) {
        if (row.position) await this.compactPositions(transaction, tourId, row.position);
      }
    });
  }

  private async compensate(keys: string[], requestId?: string): Promise<boolean> {
    try {
      for (const key of [...keys].reverse()) await this.storage.delete(key);
      return true;
    } catch (error) {
      this.logger.error(
        { error: errorMessage(error), keys, requestId },
        'Media upload compensation failed',
      );
      return false;
    }
  }

  private async compactPositions(
    transaction: DatabaseTransaction,
    tourId: string,
    removedPosition: number,
  ): Promise<void> {
    const rows = await transaction
      .select({ id: tourMedia.id, position: tourMedia.position })
      .from(tourMedia)
      .where(
        and(eq(tourMedia.tourId, tourId), inArray(tourMedia.state, ['active', 'pending_upload'])),
      )
      .orderBy(asc(tourMedia.position));
    for (const row of rows) {
      if (row.position && row.position > removedPosition) {
        await transaction
          .update(tourMedia)
          .set({ position: row.position - 1, updatedAt: new Date() })
          .where(eq(tourMedia.id, row.id));
      }
    }
  }

  private async lockTour(transaction: DatabaseTransaction, tourId: string): Promise<void> {
    const [tour] = await transaction
      .select({ id: tours.id })
      .from(tours)
      .where(and(eq(tours.id, tourId), isNull(tours.deletedAt)))
      .for('update')
      .limit(1);
    if (!tour) throw new NotFoundException('Tour not found.');
  }

  private present(row: {
    id: string;
    position: number | null;
    keyPrefix: string;
    originalFormat: string;
    width: number;
    height: number;
  }) {
    const keys = objectKeys(row.keyPrefix, row.originalFormat);
    const url = (key: string) => `${this.config.r2PublicUrl}/${key}`;
    return {
      id: row.id,
      position: row.position,
      width: row.width,
      height: row.height,
      urls: { original: url(keys.original), card: url(keys.card), thumbnail: url(keys.thumbnail) },
    };
  }
}

function objectKeys(prefix: string, format: string) {
  const extension = format === 'jpeg' ? 'jpg' : format;
  return {
    original: `${prefix}/original.${extension}`,
    card: `${prefix}/card.webp`,
    thumbnail: `${prefix}/thumbnail.webp`,
  };
}

function mimeType(format: string): string {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown storage failure';
}
