import type { Redis } from 'ioredis';

export type RedisClient = Redis;
export type RedisBlockingClientFactory = () => Redis;
