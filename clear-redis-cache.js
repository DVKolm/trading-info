#!/usr/bin/env node

/**
 * Redis Cache Clear Utility
 * Clears specific or all cache keys in Redis
 */

const redis = require('redis');
require('dotenv').config();

async function clearRedisCache(pattern = null) {
  const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  try {
    await client.connect();
    console.log('🔗 Connected to Redis');

    if (pattern) {
      // Clear specific pattern
      console.log(`🧹 Clearing cache keys matching pattern: ${pattern}`);
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        console.log('📭 No keys found matching the pattern');
        return;
      }

      console.log(`🔍 Found ${keys.length} keys to delete:`);
      keys.forEach(key => console.log(`  - ${key}`));

      for (const key of keys) {
        await client.del(key);
      }
      
      console.log(`✅ Deleted ${keys.length} keys`);
    } else {
      // Clear all cache
      console.log('🧹 Clearing ALL Redis cache...');
      await client.flushAll();
      console.log('✅ All Redis cache cleared');
    }
  } catch (error) {
    console.error('❌ Redis cache clear failed:', error.message);
    process.exit(1);
  } finally {
    await client.quit();
    console.log('👋 Disconnected from Redis');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const pattern = args[0];

// Available commands:
console.log('🚀 Redis Cache Clear Utility');
console.log('');

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage:');
  console.log('  node clear-redis-cache.js                 # Clear ALL cache');
  console.log('  node clear-redis-cache.js lesson:*        # Clear all lesson cache');
  console.log('  node clear-redis-cache.js lesson:structure # Clear structure cache');
  console.log('  node clear-redis-cache.js user:progress:* # Clear all user progress');
  console.log('  node clear-redis-cache.js analytics:*     # Clear analytics cache');
  console.log('');
  console.log('Examples:');
  console.log('  npm run clear-cache                       # Clear all');
  console.log('  npm run clear-cache lesson:*              # Clear lessons only');
  process.exit(0);
}

// Run the cache clear
clearRedisCache(pattern).catch(console.error);