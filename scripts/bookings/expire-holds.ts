import { BookingsService } from '../../src/bookings/bookings.service.js';
import { BookingsModule } from '../../src/bookings/bookings.module.js';
import { createProcessApplication } from '../../src/process/process-application.js';

const app = await createProcessApplication(BookingsModule);
try {
  const service = app.get(BookingsService);
  const result = process.argv.includes('--dry-run')
    ? { inspected: await service.inspectDueHolds(), changed: 0, dryRun: true }
    : await service.expireDue();
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await app.close();
}
