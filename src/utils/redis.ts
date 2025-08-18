import { ENV } from '../config/env';
import Redis from 'ioredis';

export const redisClient = new Redis({
  host: ENV.redis.host,
  port: ENV.redis.port,
  password: ENV.redis.password,
});