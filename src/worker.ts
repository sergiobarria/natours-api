import { createProcessApplication } from './process/process-application.js';
import { WorkerAppModule } from './worker-app.module.js';

await createProcessApplication(WorkerAppModule);
