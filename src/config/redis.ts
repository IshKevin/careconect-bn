// import Redis from 'ioredis';
// import { config } from './env';

// // Create Redis client configuration
// const redisConfig: any = {
//   host: config.redis.host,
//   port: config.redis.port,
//   enableReadyCheck: false,
//   maxRetriesPerRequest: null,
//   lazyConnect: true,
//   keepAlive: 30000,
//   connectTimeout: 10000,
//   commandTimeout: 5000,
// };

// // Only add password if it exists
// if (config.redis.password) {
//   redisConfig.password = config.redis.password;
// }

// // Create Redis client
// export const redis = new Redis(redisConfig);

// // Redis event handlers
// redis.on('connect', () => {
//   console.log('Redis connected successfully');
// });

// redis.on('ready', () => {
//   console.log('Redis is ready to receive commands');
// });

// redis.on('error', (error) => {
//   console.error('Redis connection error:', error);
// });

// redis.on('close', () => {
//   console.log('Redis connection closed');
// });

// redis.on('reconnecting', () => {
//   console.log('Redis reconnecting...');
// });

// // Test Redis connection
// export const testRedisConnection = async (): Promise<boolean> => {
//   try {
//     await redis.ping();
//     return true;
//   } catch (error) {
//     console.error('Redis connection test failed:', error);
//     return false;
//   }
// };

// // Redis utility functions
// export const redisUtils = {
//   // Set with expiration
//   setex: async (key: string, value: string, ttl: number): Promise<void> => {
//     await redis.setex(key, ttl, value);
//   },

//   // Get value
//   get: async (key: string): Promise<string | null> => {
//     return await redis.get(key);
//   },

//   // Delete key
//   del: async (key: string): Promise<void> => {
//     await redis.del(key);
//   },

//   // Set hash field
//   hset: async (key: string, field: string, value: string): Promise<void> => {
//     await redis.hset(key, field, value);
//   },

//   // Get hash field
//   hget: async (key: string, field: string): Promise<string | null> => {
//     return await redis.hget(key, field);
//   },

//   // Get all hash fields
//   hgetall: async (key: string): Promise<Record<string, string>> => {
//     return await redis.hgetall(key);
//   },

//   // Delete hash field
//   hdel: async (key: string, field: string): Promise<void> => {
//     await redis.hdel(key, field);
//   },

//   // Check if key exists
//   exists: async (key: string): Promise<boolean> => {
//     const result = await redis.exists(key);
//     return result === 1;
//   },

//   // Set expiration
//   expire: async (key: string, ttl: number): Promise<void> => {
//     await redis.expire(key, ttl);
//   },

//   // Increment counter
//   incr: async (key: string): Promise<number> => {
//     return await redis.incr(key);
//   },

//   // Increment counter with expiration
//   incrWithExpire: async (key: string, ttl: number): Promise<number> => {
//     const pipeline = redis.pipeline();
//     pipeline.incr(key);
//     pipeline.expire(key, ttl);
//     const results = await pipeline.exec();
//     return results?.[0]?.[1] as number || 0;
//   },

//   // Add to set
//   sadd: async (key: string, member: string): Promise<void> => {
//     await redis.sadd(key, member);
//   },

//   // Remove from set
//   srem: async (key: string, member: string): Promise<void> => {
//     await redis.srem(key, member);
//   },

//   // Check if member exists in set
//   sismember: async (key: string, member: string): Promise<boolean> => {
//     const result = await redis.sismember(key, member);
//     return result === 1;
//   },

//   // Get all set members
//   smembers: async (key: string): Promise<string[]> => {
//     return await redis.smembers(key);
//   },

//   // Push to list
//   lpush: async (key: string, value: string): Promise<void> => {
//     await redis.lpush(key, value);
//   },

//   // Pop from list
//   rpop: async (key: string): Promise<string | null> => {
//     return await redis.rpop(key);
//   },

//   // Get list length
//   llen: async (key: string): Promise<number> => {
//     return await redis.llen(key);
//   },

//   // Get list range
//   lrange: async (key: string, start: number, stop: number): Promise<string[]> => {
//     return await redis.lrange(key, start, stop);
//   },
// };

// // Close Redis connection
// export const closeRedisConnection = async (): Promise<void> => {
//   await redis.quit();
// };
