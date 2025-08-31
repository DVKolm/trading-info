const express = require('express');
const router = express.Router();
const lessonService = require('../services/lessonService');
const enhancedLessonService = require('../services/lessonService.enhanced');
const userService = require('../services/userService');
const logger = require('../config/logger');

// Get lesson folders for upload
router.get('/folders', async (req, res) => {
    try {
        logger.info('Getting lesson folders for upload');
        const folders = await lessonService.getLessonFolders();
        
        logger.info('Lesson folders retrieved successfully', {
            folderCount: folders.length
        });
        
        res.json({ folders });
    } catch (error) {
        logger.error('Error getting lesson folders', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to get lesson folders' });
    }
});

// Get lessons structure (with database fallback)
router.get('/structure', async (req, res) => {
    try {
        logger.info('Getting lessons structure');
        
        // Try enhanced service first (database), fallback to file system
        let structure;
        try {
            structure = await enhancedLessonService.getLessonStructure();
            
            // If database returns empty structure, use file system
            if (!structure || structure.length === 0) {
                logger.info('Database returned empty structure, falling back to file system');
                structure = await lessonService.getLessonStructure();
                logger.info('✅ Using file system for lesson structure');
            } else {
                logger.info('✅ Using database for lesson structure');
            }
        } catch (dbError) {
            logger.warn('Database unavailable, falling back to file system:', dbError.message);
            structure = await lessonService.getLessonStructure();
            logger.info('✅ Using file system for lesson structure (error fallback)');
        }
        
        logger.info('Lessons structure retrieved successfully', {
            itemCount: structure.length,
            source: structure.length > 0 ? 'database/filesystem' : 'unknown'
        });
        
        res.json({ structure });
    } catch (error) {
        logger.error('Error getting lessons structure', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to get lessons structure' });
    }
});

// Get specific lesson content (with database fallback)
router.get('/content/*', async (req, res) => {
    try {
        const lessonPath = req.params[0];
        const telegramId = req.headers['x-telegram-user-id'];
        
        // Try enhanced service first (database), fallback to file system
        let lessonData;
        try {
            lessonData = await enhancedLessonService.getLessonContent(lessonPath);
            logger.info('✅ Using database for lesson content');
            
            // Track lesson open event if user ID available
            if (telegramId) {
                await enhancedLessonService.trackEvent(telegramId, 'open', lessonPath, {
                    title: lessonData.title,
                    wordCount: lessonData.wordCount
                });
            }
        } catch (dbError) {
            logger.warn('Database unavailable, falling back to file system:', dbError.message);
            lessonData = await lessonService.getLessonContent(lessonPath);
        }
        
        res.json(lessonData);
    } catch (error) {
        if (error.message === 'Access denied') {
            return res.status(403).json({ error: 'Access denied' });
        }
        if (error.message === 'Lesson not found') {
            return res.status(404).json({ error: 'Lesson not found' });
        }
        
        logger.error('Error getting lesson content:', error);
        res.status(500).json({ error: 'Failed to get lesson content' });
    }
});

// Resolve internal lesson link
router.get('/resolve', async (req, res) => {
    try {
        const linkName = req.query.name;
        
        if (!linkName) {
            return res.status(400).json({ error: 'Link name is required' });
        }
        
        logger.info('Resolving internal link:', linkName);
        const result = await lessonService.resolveLessonLink(linkName);
        res.json(result);
    } catch (error) {
        logger.error('Error resolving internal link:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: `Failed to resolve link`
        });
    }
});

// Search lessons (with database fallback)
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q?.toLowerCase();
        
        // Try enhanced service first (database), fallback to file system
        let results;
        try {
            results = await enhancedLessonService.searchLessons(query);
            logger.info('✅ Using database for lesson search');
        } catch (dbError) {
            logger.warn('Database unavailable, falling back to file system:', dbError.message);
            results = await lessonService.searchLessons(query);
        }
        
        res.json({ results });
    } catch (error) {
        logger.error('Error searching lessons:', error);
        res.status(500).json({ error: 'Failed to search lessons' });
    }
});

// ===============================
// NEW DATABASE-POWERED ENDPOINTS
// ===============================

// Import lessons from file system to database
router.post('/import', async (req, res) => {
    try {
        logger.info('🔄 Starting lesson import to database...');
        const importCount = await enhancedLessonService.importLessonsToDatabase();
        
        logger.info('✅ Lesson import completed', { importCount });
        res.json({ 
            success: true, 
            message: `Successfully imported ${importCount} lessons to database`,
            importCount 
        });
    } catch (error) {
        logger.error('❌ Error importing lessons:', error);
        res.status(500).json({ 
            error: 'Failed to import lessons to database',
            message: error.message
        });
    }
});

// Update user progress
router.post('/progress', async (req, res) => {
    try {
        const { lessonPath, progress } = req.body;
        const telegramId = req.headers['x-telegram-user-id'];
        
        if (!telegramId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        await enhancedLessonService.updateUserProgress(telegramId, lessonPath, progress);
        
        logger.info('📊 Progress updated', { 
            userId: telegramId, 
            lessonPath,
            completionScore: progress.completionScore
        });
        
        res.json({ success: true, message: 'Progress updated successfully' });
    } catch (error) {
        logger.error('❌ Error updating progress:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

// Get user progress
router.get('/progress', async (req, res) => {
    try {
        const telegramId = req.headers['x-telegram-user-id'];
        const lessonPath = req.query.lesson;
        
        if (!telegramId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        const progress = await enhancedLessonService.getUserProgress(telegramId, lessonPath);
        res.json({ progress });
    } catch (error) {
        logger.error('❌ Error getting progress:', error);
        res.status(500).json({ error: 'Failed to get progress' });
    }
});

// Track analytics event
router.post('/analytics/event', async (req, res) => {
    try {
        const { eventType, lessonPath, data, sessionId } = req.body;
        const telegramId = req.headers['x-telegram-user-id'];
        
        if (!telegramId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        await enhancedLessonService.trackEvent(telegramId, eventType, lessonPath, data, sessionId);
        
        // Don't log every event to avoid noise
        if (eventType === 'complete') {
            logger.info('🎯 Lesson completed', { userId: telegramId, lessonPath });
        }
        
        res.json({ success: true });
    } catch (error) {
        logger.error('❌ Error tracking event:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

// Get analytics summary
router.get('/analytics/summary', async (req, res) => {
    try {
        const { dateFrom, dateTo } = req.query;
        const summary = await enhancedLessonService.getAnalyticsSummary(dateFrom, dateTo);
        
        res.json({ summary });
    } catch (error) {
        logger.error('❌ Error getting analytics:', error);
        res.status(500).json({ error: 'Failed to get analytics summary' });
    }
});

// Start learning session
router.post('/session/start', async (req, res) => {
    try {
        const { lessonPath } = req.body;
        const telegramId = req.headers['x-telegram-user-id'];
        
        if (!telegramId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        const session = await userService.startSession(telegramId, lessonPath);
        
        logger.info('🎯 Session started', { 
            sessionId: session.id,
            userId: telegramId, 
            lessonPath 
        });
        
        res.json({ session: { id: session.id, startTime: session.start_time } });
    } catch (error) {
        logger.error('❌ Error starting session:', error);
        res.status(500).json({ error: 'Failed to start session' });
    }
});

// Update session progress
router.put('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const progressData = req.body;
        
        await userService.updateSession(sessionId, progressData);
        res.json({ success: true });
    } catch (error) {
        logger.error('❌ Error updating session:', error);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

// End learning session
router.post('/session/:sessionId/end', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await userService.endSession(sessionId);
        
        if (session) {
            logger.info('⏱️ Session ended', { 
                sessionId,
                duration: new Date(session.end_time) - new Date(session.start_time)
            });
        }
        
        res.json({ success: true, session });
    } catch (error) {
        logger.error('❌ Error ending session:', error);
        res.status(500).json({ error: 'Failed to end session' });
    }
});

// Get user statistics
router.get('/user/stats', async (req, res) => {
    try {
        const telegramId = req.headers['x-telegram-user-id'];
        
        if (!telegramId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        const stats = await userService.getUserStats(telegramId);
        res.json({ stats });
    } catch (error) {
        logger.error('❌ Error getting user stats:', error);
        res.status(500).json({ error: 'Failed to get user statistics' });
    }
});

// Get user learning streak
router.get('/user/streak', async (req, res) => {
    try {
        const telegramId = req.headers['x-telegram-user-id'];
        
        if (!telegramId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        const streak = await userService.getUserStreak(telegramId);
        res.json({ streak });
    } catch (error) {
        logger.error('❌ Error getting user streak:', error);
        res.status(500).json({ error: 'Failed to get user streak' });
    }
});

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const health = await enhancedLessonService.healthCheck();
        const status = health.database.postgres && health.database.redis ? 200 : 503;
        
        res.status(status).json({
            status: status === 200 ? 'healthy' : 'unhealthy',
            ...health
        });
    } catch (error) {
        logger.error('❌ Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;