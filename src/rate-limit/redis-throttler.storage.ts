import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { AppConfigService } from '../config/app-config.service.js';
import { REDIS_CLIENT } from '../platform/redis/redis.constants.js';
import type { RedisClient } from '../platform/redis/redis.types.js';

const incrementScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
local blocked = 0
local block_ttl = 0
if current > tonumber(ARGV[2]) then
  blocked = 1
  if redis.call('EXISTS', KEYS[2]) == 0 then redis.call('SET', KEYS[2], '1', 'PX', ARGV[3]) end
  block_ttl = redis.call('PTTL', KEYS[2])
elseif redis.call('EXISTS', KEYS[2]) == 1 then
  blocked = 1
  block_ttl = redis.call('PTTL', KEYS[2])
end
return {current, ttl, blocked, block_ttl}
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly config: AppConfigService,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const root = `${this.config.redisKeyPrefix}:rate:${throttlerName}:${key}`;
    const result = (await this.redis.eval(
      incrementScript,
      2,
      root,
      `${root}:blocked`,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];
    return {
      totalHits: Number(result[0]),
      timeToExpire: Math.max(0, Math.ceil(Number(result[1]) / 1000)),
      isBlocked: Number(result[2]) === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(Number(result[3]) / 1000)),
    };
  }
}
