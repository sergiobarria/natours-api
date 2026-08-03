import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import type { OpenAPIObject } from '@nestjs/swagger';
import { format, resolveConfig } from 'prettier';
import { createApplication } from '../../src/application.factory.js';
import { createOpenApiDocument } from '../../src/openapi/openapi.js';
import { OPENAPI_ARTIFACT_RELATIVE_PATH } from './openapi.constants.js';

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => normalizeValue(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeValue(entryValue)]),
    );
  }

  return value;
}

export async function normalizeOpenApiDocument(document: OpenAPIObject): Promise<string> {
  const prettierConfig = await resolveConfig(process.cwd());
  return format(JSON.stringify(normalizeValue(document)), {
    ...prettierConfig,
    parser: 'json',
  });
}

export async function generateOpenApiArtifact(outputPath: string): Promise<void> {
  const app = await createApplication({ registerDocumentation: false });

  try {
    await app.init();
    const artifact = await normalizeOpenApiDocument(createOpenApiDocument(app));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, artifact, 'utf8');
  } finally {
    await app.close();
  }
}

export function committedOpenApiArtifactPath(): string {
  return resolve(process.cwd(), OPENAPI_ARTIFACT_RELATIVE_PATH);
}

export async function checkOpenApiArtifact(): Promise<void> {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'natours-openapi-'));
  const generatedPath = resolve(temporaryDirectory, 'openapi.json');

  try {
    await generateOpenApiArtifact(generatedPath);
    const [committed, generated] = await Promise.all([
      readFile(committedOpenApiArtifactPath(), 'utf8'),
      readFile(generatedPath, 'utf8'),
    ]);

    if (committed !== generated) {
      throw new Error('OpenAPI contract drift detected. Run pnpm openapi:generate and review it.');
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
