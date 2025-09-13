const { Pool } = require('pg');
const redis = require('redis');
const logger = require('./logger');

// PostgreSQL connection pool - use config object for better control
const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'trading_info',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'secretpassword',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    maxUses: 7500,
});

// Redis client
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout: 10000,
        lazyConnect: true,
    },
    retry_strategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection attempt ${times}, retrying in ${delay}ms`);
        return delay;
    }
});

// Database connection management
class DatabaseManager {
    constructor() {
        this.pgPool = pgPool;
        this.redisClient = redisClient;
        this.isConnected = false;
        this.isRedisConnected = false;
    }

    async initialize() {
        let postgresOk = false;
        let redisOk = false;

        // Test PostgreSQL connection
        try {
            await this.pgPool.query('SELECT NOW()');
            this.isConnected = true;
            postgresOk = true;
            logger.info('✅ PostgreSQL connected successfully');
        } catch (pgError) {
            logger.error('❌ PostgreSQL connection failed:', pgError.message);
            this.isConnected = false;
        }

        // Connect to Redis (don't fail if Redis is down)
        try {
            await this.redisClient.connect();
            this.isRedisConnected = true;
            redisOk = true;
            logger.info('✅ Redis connected successfully');
        } catch (redisError) {
            logger.warn('⚠️ Redis connection failed (will work without cache):', redisError.message);
            this.isRedisConnected = false;
        }

        // Set up error handlers
        this.setupErrorHandlers();

        // Only throw error if PostgreSQL fails (Redis is optional)
        if (!postgresOk) {
            throw new Error('PostgreSQL connection required but failed');
        }

        return true;
    }

    setupErrorHandlers() {
        // PostgreSQL error handling
        this.pgPool.on('error', (err) => {
            logger.error('PostgreSQL pool error:', err);
            this.isConnected = false;
        });

        // Redis error handling
        this.redisClient.on('error', (err) => {
            logger.error('Redis client error:', err);
            this.isRedisConnected = false;
        });

        this.redisClient.on('reconnecting', () => {
            logger.info('Redis reconnecting...');
        });

        this.redisClient.on('ready', () => {
            logger.info('✅ Redis reconnected');
            this.isRedisConnected = true;
        });
    }

    // PostgreSQL query method with error handling
    async query(text, params = []) {
        if (!this.isConnected) {
            throw new Error('PostgreSQL is not connected');
        }

        const start = Date.now();
        try {
            const res = await this.pgPool.query(text, params);
            const duration = Date.now() - start;
            
            if (duration > 1000) {
                logger.warn(`Slow query executed in ${duration}ms:`, text.substring(0, 100));
            }
            
            return res;
        } catch (error) {
            logger.error('PostgreSQL query error:', error);
            logger.error('Query:', text);
            logger.error('Params:', params);
            throw error;
        }
    }

    // Redis methods with error handling
    async get(key) {
        if (!this.isRedisConnected) {
            logger.warn('Redis not connected, skipping cache read for:', key);
            return null;
        }
        
        try {
            return await this.redisClient.get(key);
        } catch (error) {
            logger.error('Redis GET error:', error);
            return null;
        }
    }

    async set(key, value, options = {}) {
        if (!this.isRedisConnected) {
            logger.warn('Redis not connected, skipping cache write for:', key);
            return false;
        }

        try {
            const serialized = typeof value === 'string' ? value : JSON.stringify(value);
            
            if (options.ttl) {
                await this.redisClient.setEx(key, options.ttl, serialized);
            } else {
                await this.redisClient.set(key, serialized);
            }
            
            return true;
        } catch (error) {
            logger.error('Redis SET error:', error);
            return false;
        }
    }

    async del(key) {
        if (!this.isRedisConnected) {
            return false;
        }

        try {
            await this.redisClient.del(key);
            return true;
        } catch (error) {
            logger.error('Redis DEL error:', error);
            return false;
        }
    }

    async exists(key) {
        if (!this.isRedisConnected) {
            return false;
        }

        try {
            const result = await this.redisClient.exists(key);
            return result === 1;
        } catch (error) {
            logger.error('Redis EXISTS error:', error);
            return false;
        }
    }

    // Cache helper methods
    async getCached(key, fallback, ttl = 3600) {
        try {
            const cached = await this.get(key);
            if (cached) {
                return JSON.parse(cached);
            }

            const data = await fallback();
            await this.set(key, data, { ttl });
            return data;
        } catch (error) {
            logger.error('Cache fallback error:', error);
            return await fallback();
        }
    }

    // Health check
    async healthCheck() {
        const health = {
            postgres: false,
            redis: false,
            timestamp: new Date().toISOString()
        };

        try {
            await this.pgPool.query('SELECT 1');
            health.postgres = true;
        } catch (error) {
            logger.error('PostgreSQL health check failed:', error);
        }

        try {
            await this.redisClient.ping();
            health.redis = true;
        } catch (error) {
            logger.error('Redis health check failed:', error);
        }

        return health;
    }

    // Graceful shutdown
    async close() {
        try {
            await this.pgPool.end();
            await this.redisClient.quit();
            logger.info('Database connections closed gracefully');
        } catch (error) {
            logger.error('Error closing database connections:', error);
        }
    }
}

const db = new DatabaseManager();

module.exports = db;