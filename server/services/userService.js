const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * User management service with session tracking
 */
class UserService {
    /**
     * Create or update user from Telegram data
     */
    async upsertUser(telegramData) {
        try {
            const { id, username, first_name, last_name, language_code, is_premium } = telegramData;
            
            const result = await db.query(`
                INSERT INTO users (telegram_id, username, first_name, last_name, language_code, is_premium, last_active)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
                ON CONFLICT (telegram_id)
                DO UPDATE SET 
                    username = EXCLUDED.username,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    language_code = EXCLUDED.language_code,
                    is_premium = EXCLUDED.is_premium,
                    last_active = CURRENT_TIMESTAMP
                RETURNING *
            `, [id, username, first_name, last_name, language_code, is_premium || false]);

            const user = result.rows[0];
            logger.info(`👤 User ${user.telegram_id} (${user.first_name}) authenticated`);
            
            return user;
        } catch (error) {
            logger.error('❌ Error upserting user:', error);
            throw error;
        }
    }

    /**
     * Get user by Telegram ID
     */
    async getUserByTelegramId(telegramId) {
        const result = await db.query(
            'SELECT * FROM users WHERE telegram_id = $1',
            [telegramId]
        );
        return result.rows[0] || null;
    }

    /**
     * Start a new learning session
     */
    async startSession(telegramId, lessonPath) {
        try {
            const user = await this.getUserByTelegramId(telegramId);
            if (!user) {
                throw new Error('User not found');
            }

            // End any existing active sessions for this user
            await db.query(`
                UPDATE user_sessions 
                SET is_active = false, end_time = CURRENT_TIMESTAMP 
                WHERE user_id = $1 AND is_active = true
            `, [user.id]);

            // Create new session
            const sessionId = uuidv4();
            const result = await db.query(`
                INSERT INTO user_sessions (id, user_id, lesson_path, start_time, is_active)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, true)
                RETURNING *
            `, [sessionId, user.id, lessonPath]);

            const session = result.rows[0];
            
            // Cache active session
            await db.set(`user:session:${sessionId}`, session, { ttl: 7200 }); // 2 hours
            
            logger.info(`🎯 Started session ${sessionId} for user ${telegramId}`);
            return session;
        } catch (error) {
            logger.error('❌ Error starting session:', error);
            throw error;
        }
    }

    /**
     * Update session progress
     */
    async updateSession(sessionId, progressData) {
        try {
            const { activeTime, scrollProgress, engagementPoints } = progressData;
            
            await db.query(`
                UPDATE user_sessions 
                SET active_time = $1, max_scroll_progress = GREATEST(max_scroll_progress, $2),
                    engagement_points = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $4 AND is_active = true
            `, [activeTime, scrollProgress, engagementPoints, sessionId]);

            // Update cache
            const cached = await db.get(`user:session:${sessionId}`);
            if (cached) {
                const session = JSON.parse(cached);
                session.active_time = activeTime;
                session.max_scroll_progress = Math.max(session.max_scroll_progress || 0, scrollProgress);
                session.engagement_points = engagementPoints;
                await db.set(`user:session:${sessionId}`, session, { ttl: 7200 });
            }

        } catch (error) {
            logger.error('❌ Error updating session:', error);
            throw error;
        }
    }

    /**
     * End a session
     */
    async endSession(sessionId) {
        try {
            const result = await db.query(`
                UPDATE user_sessions 
                SET is_active = false, end_time = CURRENT_TIMESTAMP
                WHERE id = $1 AND is_active = true
                RETURNING *
            `, [sessionId]);

            if (result.rows.length > 0) {
                const session = result.rows[0];
                const duration = new Date(session.end_time) - new Date(session.start_time);
                
                logger.info(`⏱️ Ended session ${sessionId}, duration: ${Math.round(duration / 1000)}s`);
                
                // Remove from cache
                await db.del(`user:session:${sessionId}`);
                
                return session;
            }
        } catch (error) {
            logger.error('❌ Error ending session:', error);
            throw error;
        }
    }

    /**
     * Get active session
     */
    async getActiveSession(sessionId) {
        try {
            // Try cache first
            const cached = await db.get(`user:session:${sessionId}`);
            if (cached) {
                return JSON.parse(cached);
            }

            // Fallback to database
            const result = await db.query(
                'SELECT * FROM user_sessions WHERE id = $1 AND is_active = true',
                [sessionId]
            );

            return result.rows[0] || null;
        } catch (error) {
            logger.error('❌ Error getting active session:', error);
            return null;
        }
    }

    /**
     * Get user statistics
     */
    async getUserStats(telegramId) {
        const cacheKey = `user:stats:${telegramId}`;
        
        return await db.getCached(cacheKey, async () => {
            const user = await this.getUserByTelegramId(telegramId);
            if (!user) return null;

            const [progress, sessions, events] = await Promise.all([
                // Progress stats
                db.query(`
                    SELECT 
                        COUNT(*) as lessons_visited,
                        COUNT(*) FILTER (WHERE completed = true) as lessons_completed,
                        AVG(completion_score) as avg_completion,
                        SUM(time_spent) as total_time,
                        AVG(reading_speed) as avg_reading_speed
                    FROM user_progress WHERE user_id = $1
                `, [user.id]),
                
                // Session stats
                db.query(`
                    SELECT 
                        COUNT(*) as total_sessions,
                        AVG(active_time) as avg_session_time,
                        SUM(active_time) as total_active_time,
                        MAX(max_scroll_progress) as max_scroll
                    FROM user_sessions WHERE user_id = $1
                `, [user.id]),
                
                // Event stats
                db.query(`
                    SELECT event_type, COUNT(*) as count
                    FROM analytics_events 
                    WHERE user_id = $1 
                    GROUP BY event_type
                `, [user.id])
            ]);

            return {
                user: {
                    telegram_id: user.telegram_id,
                    first_name: user.first_name,
                    is_premium: user.is_premium,
                    created_at: user.created_at,
                    last_active: user.last_active
                },
                progress: progress.rows[0],
                sessions: sessions.rows[0],
                events: events.rows.reduce((acc, row) => {
                    acc[row.event_type] = parseInt(row.count);
                    return acc;
                }, {})
            };
        }, 600); // 10 minutes TTL
    }

    /**
     * Get user learning streak
     */
    async getUserStreak(telegramId) {
        const user = await this.getUserByTelegramId(telegramId);
        if (!user) return { current: 0, longest: 0 };

        const result = await db.query(`
            WITH daily_activity AS (
                SELECT DISTINCT DATE(timestamp) as activity_date
                FROM analytics_events 
                WHERE user_id = $1 AND event_type IN ('open', 'complete')
                ORDER BY activity_date DESC
            ),
            streaks AS (
                SELECT 
                    activity_date,
                    activity_date - INTERVAL '1 day' * ROW_NUMBER() OVER (ORDER BY activity_date DESC) as streak_group
                FROM daily_activity
            ),
            current_streak AS (
                SELECT COUNT(*) as days
                FROM streaks
                WHERE streak_group = (SELECT streak_group FROM streaks ORDER BY activity_date DESC LIMIT 1)
            ),
            longest_streak AS (
                SELECT MAX(streak_length) as days
                FROM (
                    SELECT COUNT(*) as streak_length
                    FROM streaks
                    GROUP BY streak_group
                ) s
            )
            SELECT 
                COALESCE(cs.days, 0) as current_streak,
                COALESCE(ls.days, 0) as longest_streak
            FROM current_streak cs
            CROSS JOIN longest_streak ls
        `, [user.id]);

        const streak = result.rows[0] || { current_streak: 0, longest_streak: 0 };
        
        return {
            current: parseInt(streak.current_streak),
            longest: parseInt(streak.longest_streak)
        };
    }

    /**
     * Get active users count
     */
    async getActiveUsersCount(hours = 24) {
        const result = await db.query(`
            SELECT COUNT(DISTINCT user_id) as count
            FROM analytics_events 
            WHERE timestamp > NOW() - INTERVAL '${hours} hours'
        `);
        
        return parseInt(result.rows[0].count);
    }

    /**
     * Clean up old sessions
     */
    async cleanupOldSessions(olderThanHours = 24) {
        try {
            const result = await db.query(`
                UPDATE user_sessions 
                SET is_active = false, end_time = COALESCE(end_time, updated_at)
                WHERE is_active = true 
                AND updated_at < NOW() - INTERVAL '${olderThanHours} hours'
                RETURNING id
            `);

            if (result.rows.length > 0) {
                logger.info(`🧹 Cleaned up ${result.rows.length} old sessions`);
                
                // Remove from cache
                for (const row of result.rows) {
                    await db.del(`user:session:${row.id}`);
                }
            }
        } catch (error) {
            logger.error('❌ Error cleaning up old sessions:', error);
        }
    }
}

module.exports = new UserService();