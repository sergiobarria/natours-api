import { Injectable } from '@nestjs/common';
import type { JobDefinition } from './job.types.js';

@Injectable()
export class JobRegistry {
  private readonly definitions = new Map<string, JobDefinition>();

  register<T>(definition: JobDefinition<T>): void {
    if (this.definitions.has(definition.name)) {
      throw new Error(`Job definition is already registered: ${definition.name}`);
    }
    this.definitions.set(definition.name, definition);
  }

  get(name: string): JobDefinition {
    const definition = this.definitions.get(name);
    if (!definition) {
      throw new Error(`Unknown job type: ${name}`);
    }
    return definition;
  }

  list(): JobDefinition[] {
    return [...this.definitions.values()];
  }
}
