import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_BYPASS_METADATA, RATE_LIMIT_POLICY_METADATA } from './rate-limit.constants.js';

export const RateLimitPolicy = (policy: string) => SetMetadata(RATE_LIMIT_POLICY_METADATA, policy);
export const BypassRateLimit = () => SetMetadata(RATE_LIMIT_BYPASS_METADATA, true);
