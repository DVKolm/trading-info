const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { marked } = require('marked');
const matter = require('gray-matter');
const db = require('../config/database');
const logger = require('../config/logger');

const LESSONS_DIR = path.join(__dirname, '../../lessons');

/**
 * Enhanced Lesson Service with PostgreSQL and Redis integration
 */
class EnhancedLessonService {
    constructor() {
        // Configure marked to suppress deprecated warnings
        marked.setOptions({
            mangle: false,
            headerIds: false,
        });
    }

    // ===============================
    // FILE SYSTEM TO DATABASE MIGRATION
    // ===============================

    /**
     * Import all lessons from file system to PostgreSQL
     */
    async importLessonsToDatabase(dirPath = LESSONS_DIR, relativePath = '') {
        logger.info('🔄 Starting lesson import to database...');
        let importCount = 0;

        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true, encoding: 'utf8' });
            
            for (const entry of entries) {
                const safeName = Buffer.from(entry.name, 'utf8').toString('utf8');
                const fullPath = path.join(dirPath, safeName);
                const itemRelativePath = path.join(relativePath, safeName);
                
                if (entry.isDirectory()) {
                    const subImports = await this.importLessonsToDatabase(fullPath, itemRelativePath);
                    importCount += subImports;
                } else if (safeName.endsWith('.md')) {
                    const success = await this.importSingleLesson(fullPath, itemRelativePath);
                    if (success) importCount++;
                }
            }
            
            logger.info(`✅ Imported ${importCount} lessons to database`);
            return importCount;
        } catch (error) {
            logger.error('❌ Error importing lessons:', error);
            throw error;
        }
    }

    /**
     * Import a single lesson file to database
     */
    async importSingleLesson(fullPath, relativePath) {
        try {
            const content = await fs.readFile(fullPath, 'utf8');
            const parsed = matter(content);
            const htmlContent = marked(parsed.content);
            
            // Calculate file hash for change detection
            const fileHash = crypto.createHash('sha256').update(content).digest('hex');
            
            // Extract lesson metadata
            let title = parsed.data.title || path.basename(relativePath, '.md');
            const firstHeading = content.match(/^#\s+(.+)$/m);
            if (firstHeading) {
                title = firstHeading[1];
            }

            const wordCount = this.getWordCount(parsed.content);
            const parentFolder = path.dirname(relativePath).replace(/\\/g, '/');
            const lessonNumber = this.extractLessonNumber(title);
            const lessonPath = relativePath.replace(/\\/g, '/');

            // Check if lesson already exists
            const existing = await db.query(
                'SELECT id, file_hash FROM lessons WHERE path = $1',
                [lessonPath]
            );

            if (existing.rows.length > 0) {
                // Update if file changed
                if (existing.rows[0].file_hash !== fileHash) {
                    await db.query(`
                        UPDATE lessons 
                        SET title = $1, content = $2, html_content = $3, 
                            frontmatter = $4, word_count = $5, parent_folder = $6,
                            lesson_number = $7, file_hash = $8, updated_at = CURRENT_TIMESTAMP
                        WHERE path = $9
                    `, [title, parsed.content, htmlContent, JSON.stringify(parsed.data), 
                        wordCount, parentFolder, lessonNumber, fileHash, lessonPath]);
                    
                    logger.info(`📝 Updated lesson: ${title}`);
                }
                return false; // Not a new import
            } else {
                // Insert new lesson
                await db.query(`
                    INSERT INTO lessons (path, title, content, html_content, frontmatter, 
                                       word_count, parent_folder, lesson_number, file_hash)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [lessonPath, title, parsed.content, htmlContent, JSON.stringify(parsed.data),
                    wordCount, parentFolder, lessonNumber, fileHash]);
                
                logger.info(`➕ Imported lesson: ${title}`);
                return true; // New import
            }
        } catch (error) {
            logger.error(`❌ Failed to import lesson ${relativePath}:`, error);
            return false;
        }
    }

    // ===============================
    // CACHED DATABASE OPERATIONS
    // ===============================

    /**
     * Get lesson structure with Redis caching
     */
    async getLessonStructure() {
        const cacheKey = 'lesson:structure';
        
        return await db.getCached(cacheKey, async () => {
            const result = await db.query(`
                SELECT id, path, title, parent_folder, lesson_number, word_count, updated_at
                FROM lessons 
                ORDER BY parent_folder, lesson_number, title
            `);
            
            return this.buildHierarchicalStructure(result.rows);
        }, 1800); // 30 minutes TTL
    }

    /**
     * Get lesson content with Redis caching
     */
    async getLessonContent(lessonPath) {
        const cacheKey = `lesson:content:${lessonPath}`;
        
        return await db.getCached(cacheKey, async () => {
            const result = await db.query(
                'SELECT * FROM lessons WHERE path = $1',
                [lessonPath]
            );
            
            if (result.rows.length === 0) {
                throw new Error('Lesson not found');
            }
            
            const lesson = result.rows[0];
            return {
                path: lesson.path,
                title: lesson.title,
                content: lesson.content,
                html: lesson.html_content,
                frontmatter: lesson.frontmatter,
                wordCount: lesson.word_count,
                updatedAt: lesson.updated_at
            };
        }, 3600); // 1 hour TTL
    }

    /**
     * Search lessons with full-text search and caching
     */
    async searchLessons(query) {
        if (!query) return [];
        
        const queryHash = crypto.createHash('md5').update(query).digest('hex');
        const cacheKey = `lesson:search:${queryHash}`;
        
        return await db.getCached(cacheKey, async () => {
            const result = await db.query(`
                SELECT path, title, parent_folder, 
                       ts_rank(to_tsvector('russian', title || ' ' || content), 
                              plainto_tsquery('russian', $1)) as rank
                FROM lessons 
                WHERE to_tsvector('russian', title || ' ' || content) @@ plainto_tsquery('russian', $1)
                ORDER BY rank DESC, lesson_number
                LIMIT 50
            `, [query]);
            
            return result.rows.map(row => ({
                id: row.path,
                name: row.title,
                path: row.path,
                type: 'lesson',
                rank: parseFloat(row.rank)
            }));
        }, 900); // 15 minutes TTL
    }

    // ===============================
    // USER PROGRESS TRACKING
    // ===============================

    /**
     * Update user progress with Redis caching
     */
    async updateUserProgress(telegramId, lessonPath, progressData) {
        try {
            // Ensure user exists
            const user = await this.getOrCreateUser(telegramId);
            
            // Update or insert progress
            await db.query(`
                INSERT INTO user_progress (user_id, lesson_path, time_spent, scroll_progress, 
                                         reading_speed, completion_score, visits, last_visited, 
                                         engagement_level, completed)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9)
                ON CONFLICT (user_id, lesson_path)
                DO UPDATE SET 
                    time_spent = GREATEST(user_progress.time_spent, EXCLUDED.time_spent),
                    scroll_progress = GREATEST(user_progress.scroll_progress, EXCLUDED.scroll_progress),
                    reading_speed = EXCLUDED.reading_speed,
                    completion_score = GREATEST(user_progress.completion_score, EXCLUDED.completion_score),
                    visits = user_progress.visits + 1,
                    last_visited = CURRENT_TIMESTAMP,
                    engagement_level = EXCLUDED.engagement_level,
                    completed = EXCLUDED.completed,
                    updated_at = CURRENT_TIMESTAMP
            `, [user.id, lessonPath, progressData.timeSpent, progressData.scrollProgress,
                progressData.readingSpeed, progressData.completionScore, progressData.visits || 1,
                progressData.engagementLevel, progressData.completed || false]);

            // Clear user progress cache
            await db.del(`user:progress:${telegramId}`);
            
            logger.info(`📊 Updated progress for user ${telegramId}, lesson ${lessonPath}`);
        } catch (error) {
            logger.error('❌ Error updating user progress:', error);
            throw error;
        }
    }

    /**
     * Get user progress with caching
     */
    async getUserProgress(telegramId, lessonPath = null) {
        const cacheKey = `user:progress:${telegramId}`;
        
        if (lessonPath) {
            // Get specific lesson progress
            const result = await db.query(`
                SELECT up.*, l.title as lesson_title
                FROM user_progress up
                JOIN users u ON up.user_id = u.id
                JOIN lessons l ON up.lesson_path = l.path
                WHERE u.telegram_id = $1 AND up.lesson_path = $2
            `, [telegramId, lessonPath]);
            
            return result.rows[0] || null;
        } else {
            // Get all user progress with caching
            return await db.getCached(cacheKey, async () => {
                const result = await db.query(`
                    SELECT up.*, l.title as lesson_title
                    FROM user_progress up
                    JOIN users u ON up.user_id = u.id
                    JOIN lessons l ON up.lesson_path = l.path
                    WHERE u.telegram_id = $1
                    ORDER BY up.last_visited DESC
                `, [telegramId]);
                
                return result.rows;
            }, 300); // 5 minutes TTL
        }
    }

    // ===============================
    // ANALYTICS
    // ===============================

    /**
     * Track analytics event
     */
    async trackEvent(telegramId, eventType, lessonPath, data = {}, sessionId = null) {
        try {
            const user = await this.getOrCreateUser(telegramId);
            
            await db.query(`
                INSERT INTO analytics_events (user_id, lesson_path, event_type, timestamp, data, session_id)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
            `, [user.id, lessonPath, eventType, JSON.stringify(data), sessionId]);
            
        } catch (error) {
            logger.error('❌ Error tracking event:', error);
            // Don't throw - analytics should not break the app
        }
    }

    /**
     * Get analytics summary
     */
    async getAnalyticsSummary(dateFrom = null, dateTo = null) {
        const cacheKey = `analytics:summary:${dateFrom || 'all'}:${dateTo || 'now'}`;
        
        return await db.getCached(cacheKey, async () => {
            let dateCondition = '';
            const params = [];
            
            if (dateFrom && dateTo) {
                dateCondition = 'WHERE timestamp BETWEEN $1 AND $2';
                params.push(dateFrom, dateTo);
            } else if (dateFrom) {
                dateCondition = 'WHERE timestamp >= $1';
                params.push(dateFrom);
            }
            
            const [events, users, lessons] = await Promise.all([
                db.query(`
                    SELECT event_type, COUNT(*) as count
                    FROM analytics_events ${dateCondition}
                    GROUP BY event_type
                    ORDER BY count DESC
                `, params),
                
                db.query(`
                    SELECT COUNT(DISTINCT user_id) as unique_users
                    FROM analytics_events ${dateCondition}
                `, params),
                
                db.query(`
                    SELECT lesson_path, COUNT(*) as views
                    FROM analytics_events 
                    WHERE event_type = 'open' ${dateCondition ? 'AND timestamp BETWEEN $1 AND $2' : ''}
                    GROUP BY lesson_path
                    ORDER BY views DESC
                    LIMIT 10
                `, params)
            ]);
            
            return {
                events: events.rows,
                uniqueUsers: users.rows[0].unique_users,
                topLessons: lessons.rows
            };
        }, 3600); // 1 hour TTL
    }

    // ===============================
    // USER MANAGEMENT
    // ===============================

    /**
     * Get or create user
     */
    async getOrCreateUser(telegramId) {
        let result = await db.query(
            'SELECT * FROM users WHERE telegram_id = $1',
            [telegramId]
        );
        
        if (result.rows.length === 0) {
            result = await db.query(`
                INSERT INTO users (telegram_id, created_at, last_active)
                VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
            `, [telegramId]);
            
            logger.info(`👤 Created new user: ${telegramId}`);
        } else {
            // Update last active
            await db.query(
                'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE telegram_id = $1',
                [telegramId]
            );
        }
        
        return result.rows[0];
    }

    // ===============================
    // UTILITY METHODS
    // ===============================

    /**
     * Build hierarchical structure from flat lesson list
     */
    buildHierarchicalStructure(lessons) {
        const folderMap = new Map();
        const items = [];
        
        // Group lessons by folder
        lessons.forEach(lesson => {
            const folder = lesson.parent_folder || '';
            if (!folderMap.has(folder)) {
                folderMap.set(folder, []);
            }
            folderMap.get(folder).push({
                id: lesson.path,
                name: lesson.title,
                type: 'file',
                path: lesson.path,
                filename: lesson.path.split('/').pop(),
                wordCount: lesson.word_count,
                updatedAt: lesson.updated_at
            });
        });
        
        // Build folder structure
        const folderStructure = new Map();
        folderMap.forEach((lessons, folderPath) => {
            if (folderPath) {
                const parts = folderPath.split('/').filter(p => p);
                let currentPath = '';
                
                parts.forEach((part, index) => {
                    const parentPath = currentPath;
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    
                    if (!folderStructure.has(currentPath)) {
                        folderStructure.set(currentPath, {
                            id: currentPath,
                            name: part,
                            type: 'folder',
                            path: currentPath,
                            children: []
                        });
                    }
                });
                
                // Add lessons to the deepest folder
                if (folderStructure.has(folderPath)) {
                    folderStructure.get(folderPath).children.push(...lessons);
                }
            } else {
                // Root level lessons
                items.push(...lessons);
            }
        });
        
        // Build hierarchy
        const rootFolders = [];
        folderStructure.forEach((folder, path) => {
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            if (parentPath && folderStructure.has(parentPath)) {
                folderStructure.get(parentPath).children.unshift(folder);
            } else {
                rootFolders.push(folder);
            }
        });
        
        items.unshift(...rootFolders);
        
        // Sort everything
        this.sortStructure(items);
        
        return items;
    }

    /**
     * Sort lesson structure hierarchically
     */
    sortStructure(items) {
        items.sort((a, b) => {
            // Folders first
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            
            // Try lesson number sorting
            const aNum = this.extractLessonNumber(a.name);
            const bNum = this.extractLessonNumber(b.name);
            
            if (aNum !== null && bNum !== null) {
                return aNum - bNum;
            }
            
            // Alphabetical fallback
            return a.name.localeCompare(b.name, 'ru');
        });
        
        // Recursively sort children
        items.forEach(item => {
            if (item.children) {
                this.sortStructure(item.children);
            }
        });
    }

    /**
     * Extract lesson number from title
     */
    extractLessonNumber(title) {
        const match = title.match(/Урок\s+(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Calculate word count
     */
    getWordCount(content) {
        return content.split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Health check for the service
     */
    async healthCheck() {
        try {
            const [dbHealth, lessonCount] = await Promise.all([
                db.healthCheck(),
                db.query('SELECT COUNT(*) as count FROM lessons')
            ]);
            
            return {
                database: dbHealth,
                lessonCount: parseInt(lessonCount.rows[0].count),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('❌ Health check failed:', error);
            return {
                database: { postgres: false, redis: false },
                lessonCount: 0,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = new EnhancedLessonService();