import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { FakeObjectStorage } from './fake-object-storage.js';
import { OBJECT_STORAGE } from './object-storage.js';
import { R2ObjectStorage } from './r2-object-storage.js';

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        config.objectStorageProvider === 'r2'
          ? new R2ObjectStorage(config)
          : new FakeObjectStorage(),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
