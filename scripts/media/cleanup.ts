import 'dotenv/config';
import { DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { createStandaloneDatabase } from '../database/database-command.js';
import { tourMedia } from '../../src/database/schema/tours.js';

export function assertCleanupAllowed(environment: string | undefined, execute: boolean): void {
  if (execute && !['development', 'test'].includes(environment ?? '')) {
    throw new Error('Media cleanup execution is restricted to development and test.');
  }
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  assertCleanupAllowed(process.env.NODE_ENV, execute);
  const connection = createStandaloneDatabase();
  try {
    const pending = await connection.database
      .select()
      .from(tourMedia)
      .where(inArray(tourMedia.state, ['pending_upload', 'pending_delete']));
    console.info(
      JSON.stringify(
        {
          dryRun: !execute,
          candidates: pending.map(row => ({
            id: row.id,
            state: row.state,
            keyPrefix: row.keyPrefix,
          })),
        },
        null,
        2,
      ),
    );
    if (!execute || pending.length === 0) return;
    if (process.env.OBJECT_STORAGE_PROVIDER !== 'r2') {
      throw new Error('Executable cleanup requires OBJECT_STORAGE_PROVIDER=r2.');
    }
    const required = [
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET',
      'R2_ENDPOINT',
    ] as const;
    for (const key of required) if (!process.env[key]) throw new Error(`${key} is required.`);
    const client = new S3Client({
      endpoint: process.env.R2_ENDPOINT,
      region: process.env.R2_REGION ?? 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    const affectedTours = new Set<string>();
    for (const row of pending) {
      const extension = row.originalFormat === 'jpeg' ? 'jpg' : row.originalFormat;
      for (const key of [
        `${row.keyPrefix}/original.${extension}`,
        `${row.keyPrefix}/card.webp`,
        `${row.keyPrefix}/thumbnail.webp`,
      ]) {
        await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
        await assertObjectMissing(client, process.env.R2_BUCKET!, key);
      }
      await connection.database.delete(tourMedia).where(eq(tourMedia.id, row.id));
      affectedTours.add(row.tourId);
      console.info(JSON.stringify({ cleaned: row.id }));
    }
    for (const tourId of affectedTours) {
      const rows = await connection.database
        .select({ id: tourMedia.id, position: tourMedia.position })
        .from(tourMedia)
        .where(
          and(eq(tourMedia.tourId, tourId), inArray(tourMedia.state, ['active', 'pending_upload'])),
        )
        .orderBy(asc(tourMedia.position));
      for (const [index, row] of rows.entries()) {
        if (row.position !== index + 1) {
          await connection.database
            .update(tourMedia)
            .set({ position: index + 1, updatedAt: new Date() })
            .where(eq(tourMedia.id, row.id));
        }
      }
    }
  } finally {
    await connection.pool.end();
  }
}

async function assertObjectMissing(client: S3Client, bucket: string, key: string): Promise<void> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    const metadata =
      error && typeof error === 'object'
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        : undefined;
    if (metadata?.httpStatusCode === 404) {
      return;
    }
    throw error;
  }
  throw new Error(`R2 object still exists after deletion: ${key}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
