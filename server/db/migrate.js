const fs = require('fs-extra');
const path = require('path');
const db = require('../config/database');
const logger = require('../config/logger');

class DatabaseMigrator {
    constructor() {
        this.migrationsDir = path.join(__dirname, 'migrations');
        this.migrationTable = 'schema_migrations';
    }

    async initialize() {
        try {
            await db.initialize();
            await this.createMigrationsTable();
            logger.info('✅ Database migrator initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize database migrator:', error);
            throw error;
        }
    }

    async createMigrationsTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        await db.query(query);
    }

    async getAppliedMigrations() {
        const result = await db.query(
            `SELECT filename FROM ${this.migrationTable} ORDER BY applied_at`
        );
        return result.rows.map(row => row.filename);
    }

    async getPendingMigrations() {
        const applied = await this.getAppliedMigrations();
        const files = await fs.readdir(this.migrationsDir);
        
        const sqlFiles = files
            .filter(file => file.endsWith('.sql'))
            .sort();

        return sqlFiles.filter(file => !applied.includes(file));
    }

    async runMigration(filename) {
        const filePath = path.join(this.migrationsDir, filename);
        const sql = await fs.readFile(filePath, 'utf8');

        logger.info(`📄 Running migration: ${filename}`);

        // Start transaction
        const client = await db.pgPool.connect();
        try {
            await client.query('BEGIN');
            
            // Execute migration SQL
            await client.query(sql);
            
            // Record migration as applied
            await client.query(
                `INSERT INTO ${this.migrationTable} (filename) VALUES ($1)`,
                [filename]
            );
            
            await client.query('COMMIT');
            logger.info(`✅ Migration completed: ${filename}`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`❌ Migration failed: ${filename}`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    async runAllPendingMigrations() {
        const pending = await this.getPendingMigrations();
        
        if (pending.length === 0) {
            logger.info('✅ No pending migrations');
            return;
        }

        logger.info(`📋 Found ${pending.length} pending migration(s)`);

        for (const migration of pending) {
            await this.runMigration(migration);
        }

        logger.info('🎉 All migrations completed successfully');
    }

    async rollbackLastMigration() {
        const applied = await this.getAppliedMigrations();
        
        if (applied.length === 0) {
            logger.warn('⚠️  No migrations to rollback');
            return;
        }

        const lastMigration = applied[applied.length - 1];
        
        // Check if rollback file exists
        const rollbackFile = lastMigration.replace('.sql', '.rollback.sql');
        const rollbackPath = path.join(this.migrationsDir, rollbackFile);
        
        if (!await fs.pathExists(rollbackPath)) {
            logger.error(`❌ No rollback file found: ${rollbackFile}`);
            return;
        }

        const sql = await fs.readFile(rollbackPath, 'utf8');

        logger.info(`🔄 Rolling back migration: ${lastMigration}`);

        const client = await db.pgPool.connect();
        try {
            await client.query('BEGIN');
            
            // Execute rollback SQL
            await client.query(sql);
            
            // Remove migration record
            await client.query(
                `DELETE FROM ${this.migrationTable} WHERE filename = $1`,
                [lastMigration]
            );
            
            await client.query('COMMIT');
            logger.info(`✅ Rollback completed: ${lastMigration}`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`❌ Rollback failed: ${lastMigration}`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getStatus() {
        const applied = await this.getAppliedMigrations();
        const pending = await this.getPendingMigrations();
        
        return {
            applied: applied.length,
            pending: pending.length,
            appliedMigrations: applied,
            pendingMigrations: pending
        };
    }
}

// CLI interface
if (require.main === module) {
    const migrator = new DatabaseMigrator();
    
    const command = process.argv[2] || 'migrate';
    
    (async () => {
        try {
            await migrator.initialize();
            
            switch (command) {
                case 'migrate':
                case 'up':
                    await migrator.runAllPendingMigrations();
                    break;
                    
                case 'rollback':
                case 'down':
                    await migrator.rollbackLastMigration();
                    break;
                    
                case 'status':
                    const status = await migrator.getStatus();
                    console.log('📊 Migration Status:');
                    console.log(`   Applied: ${status.applied}`);
                    console.log(`   Pending: ${status.pending}`);
                    if (status.pendingMigrations.length > 0) {
                        console.log('   Pending migrations:');
                        status.pendingMigrations.forEach(m => console.log(`   - ${m}`));
                    }
                    break;
                    
                default:
                    console.log('Usage: node migrate.js [migrate|rollback|status]');
                    process.exit(1);
            }
            
            await db.close();
            process.exit(0);
        } catch (error) {
            logger.error('Migration command failed:', error);
            process.exit(1);
        }
    })();
}

module.exports = DatabaseMigrator;