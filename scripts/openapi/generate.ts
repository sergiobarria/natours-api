import { committedOpenApiArtifactPath, generateOpenApiArtifact } from './openapi-artifact.js';

const outputPath = committedOpenApiArtifactPath();
await generateOpenApiArtifact(outputPath);
console.info(`OpenAPI artifact written to ${outputPath}`);
