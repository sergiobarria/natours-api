import { createProcessApplication } from './process/process-application.js';
import { SchedulerAppModule } from './scheduler-app.module.js';

await createProcessApplication(SchedulerAppModule);
