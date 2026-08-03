import { createApplication } from './application.factory.js';
import { AppConfigService } from './config/app-config.service.js';

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const config = app.get(AppConfigService);

  await app.listen(config.port, config.host);
}

void bootstrap();
