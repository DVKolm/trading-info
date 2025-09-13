const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const { validateTelegramAuth, requireAdmin } = require('../middleware/auth');
const { fixEncodingIssues, fixCorruptedRussianTextServer } = require('../utils/encoding');
const logger = require('../config/logger');
const db = require('../config/database');
const crypto = require('crypto');
const matter = require('gray-matter');
const marked = require('marked');

const LESSONS_DIR = path.join(__dirname, '../../lessons');
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to import lesson into database
async function importLessonToDatabase(lessonPath, targetFolder) {
    try {
        if (!db.isConnected) {
            logger.warn('⚠️ Database not connected, skipping lesson import to database');
            logger.warn('⚠️ Lesson will be saved to file system only');
            return false; // Return false to indicate database save failed
        }

        // Read the lesson file
        const fullPath = path.join(LESSONS_DIR, lessonPath);
        const content = await fs.readFile(fullPath, 'utf8');

        // Parse markdown
        const parsed = matter(content);
        const htmlContent = marked.parse(parsed.content);

        // Extract lesson info
        const fileName = path.basename(lessonPath);
        const title = parsed.data.title || fileName.replace('.md', '');
        const wordCount = parsed.content.split(/\s+/).filter(word => word.length > 0).length;

        // Generate slug from title
        const slug = title.toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove special chars
            .replace(/\s+/g, '-') // Replace spaces with -
            .replace(/--+/g, '-') // Replace multiple - with single -
            .trim();

        // Extract lesson number if present
        const lessonNumberMatch = title.match(/Урок\s+(\d+)/i);
        const lessonNumber = lessonNumberMatch ? parseInt(lessonNumberMatch[1], 10) : null;

        // Calculate file hash
        const fileHash = crypto.createHash('sha256').update(content).digest('hex');

        // Check if lesson already exists
        const existing = await db.query(
            'SELECT id, file_hash FROM lessons WHERE path = $1',
            [lessonPath]
        );

        if (existing.rows.length > 0) {
            // Update existing lesson if content changed
            if (existing.rows[0].file_hash !== fileHash) {
                await db.query(`
                    UPDATE lessons
                    SET title = $2, content = $3, html_content = $4,
                        frontmatter = $5, word_count = $6, parent_folder = $7,
                        lesson_number = $8, file_hash = $9, slug = $10, updated_at = CURRENT_TIMESTAMP
                    WHERE path = $1
                `, [lessonPath, title, parsed.content, htmlContent,
                    JSON.stringify(parsed.data), wordCount, targetFolder,
                    lessonNumber, fileHash, slug]);

                logger.info('📝 Updated lesson in database', { lessonPath, title });
            }
        } else {
            // Insert new lesson
            await db.query(`
                INSERT INTO lessons (path, title, content, html_content, frontmatter,
                                   word_count, parent_folder, lesson_number, file_hash, slug)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [lessonPath, title, parsed.content, htmlContent,
                JSON.stringify(parsed.data), wordCount, targetFolder,
                lessonNumber, fileHash, slug]);

            logger.info('➕ Added lesson to database', { lessonPath, title });
        }

        // Clear cache for this lesson
        if (db.isRedisConnected && db.redisClient) {
            const cacheKey = `lesson:content:${lessonPath}`;
            await db.redisClient.del(cacheKey);
        }

        return true; // Return true to indicate successful database save

    } catch (error) {
        logger.error('❌ Failed to import lesson to database', {
            error: error.message,
            lessonPath
        });
        return false; // Return false on error
    }
}

// Custom ZIP extraction function with proper encoding handling
async function extractZipWithProperEncoding(zip, targetDir) {
    const entries = zip.getEntries();
    
    for (const entry of entries) {
        try {
            // Get raw bytes of the entry name from the ZIP entry
            let rawBytes = null;
            try {
                if (entry.rawEntryName && Buffer.isBuffer(entry.rawEntryName)) {
                    rawBytes = Array.from(entry.rawEntryName);
                }
            } catch (rawError) {
                logger.debug('Could not access raw entry name bytes', { 
                    entryName: entry.entryName,
                    error: rawError.message 
                });
            }
            
            // Fix encoding issues in the entry name using raw bytes
            let fixedEntryName = fixEncodingIssues(entry.entryName, rawBytes);
            
            // Apply additional server-side text correction
            fixedEntryName = fixCorruptedRussianTextServer(fixedEntryName);
            
            // Use the fixed name for creating the entry path
            const entryPath = path.join(targetDir, fixedEntryName);
            
            // Ensure the directory structure exists
            if (entry.isDirectory) {
                await fs.ensureDir(entryPath);
            } else {
                // Ensure parent directory exists
                await fs.ensureDir(path.dirname(entryPath));
                
                // Extract file content
                const content = entry.getData();
                await fs.writeFile(entryPath, content);
            }
            
            logger.info('Extracted ZIP entry', {
                original: entry.entryName,
                fixed: fixedEntryName,
                isDirectory: entry.isDirectory,
                hasRawBytes: !!rawBytes
            });
            
        } catch (error) {
            logger.error('Error extracting ZIP entry', {
                entryName: entry.entryName,
                error: error.message,
                stack: error.stack
            });
        }
    }
}

// Upload lesson endpoint
router.post('/lesson', upload.single('lesson'), validateTelegramAuth, requireAdmin, async (req, res) => {
    const { targetFolder } = req.body;
    const user = req.telegramUser;

    logger.info('Upload lesson attempt', { 
        filename: req.file?.originalname,
        fileSize: req.file?.size,
        targetFolder,
        userId: user.id,
        username: user.username
    });

    if (!req.file) {
        logger.warn('Upload failed: No file uploaded');
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const originalName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    logger.info('Processing lesson upload', {
        filename: originalName,
        fileSize: fileBuffer.length,
        userId: user.id,
        username: user.username
    });

    try {
        if (path.extname(originalName) === '.zip') {
            const zip = new AdmZip(fileBuffer);
            const zipEntries = zip.getEntries();
            const mdFileEntry = zipEntries.find(entry => entry.entryName.endsWith('.md'));

            if (!mdFileEntry) {
                return res.status(400).json({ error: 'ZIP archive must contain one .md file.' });
            }

            const lessonName = path.basename(mdFileEntry.entryName, '.md');

            // Use selected folder or default to intermediate level
            const targetDir = targetFolder ? 
                path.join(LESSONS_DIR, targetFolder) : 
                path.join(LESSONS_DIR, 'Средний уровень (Подписка)');
            
            // Ensure target directory exists
            await fs.ensureDir(targetDir);
            
            // Custom extraction with proper encoding handling
            await extractZipWithProperEncoding(zip, targetDir);

            // Import all .md files from the extracted ZIP to database
            const mdFileName = path.basename(mdFileEntry.entryName);
            const lessonDir = path.join(targetDir, lessonName);
            const mdFilePath = path.join(lessonDir, mdFileName);

            if (await fs.pathExists(mdFilePath)) {
                const relativePath = path.relative(LESSONS_DIR, mdFilePath);
                const dbSuccess = await importLessonToDatabase(relativePath, targetFolder || 'Средний уровень (Подписка)');
                if (dbSuccess) {
                    logger.info('✅ Lesson imported to database successfully');
                } else {
                    logger.warn('⚠️ Lesson saved to file system only (database unavailable)');
                }
            }

        } else if (path.extname(originalName) === '.md') {
            const lessonName = path.basename(originalName, '.md');

            // Use selected folder or default to intermediate level
            const targetDir = targetFolder ?
                path.join(LESSONS_DIR, targetFolder) :
                path.join(LESSONS_DIR, 'Средний уровень (Подписка)');

            logger.info('Creating lesson directory', {
                lessonName,
                targetDir,
                targetFolder
            });

            // Ensure target directory exists
            await fs.ensureDir(targetDir);

            // Create a subfolder for the lesson
            const lessonDir = path.join(targetDir, lessonName);
            await fs.ensureDir(lessonDir);

            logger.info('Lesson directory created', {
                lessonDir,
                exists: await fs.pathExists(lessonDir)
            });

            const filePath = path.join(lessonDir, originalName);
            await fs.writeFile(filePath, fileBuffer);

            logger.info('Lesson file written', {
                filePath,
                size: fileBuffer.length
            });

            // Import lesson to database
            const relativePath = path.relative(LESSONS_DIR, filePath);
            const dbSuccess = await importLessonToDatabase(relativePath, targetFolder || 'Средний уровень (Подписка)');
            if (dbSuccess) {
                logger.info('✅ Lesson imported to database successfully');
            } else {
                logger.warn('⚠️ Lesson saved to file system only (database unavailable)');
            }

        } else {
            return res.status(400).json({ error: 'Unsupported file type. Please upload a .md or .zip file.' });
        }

        // Clear Redis cache after successful upload to reflect new lesson
        try {
            if (db.isRedisConnected && db.redisClient) {
                // Clear lesson structure cache
                const structureKey = 'lesson:structure';
                if (await db.redisClient.exists(structureKey)) {
                    await db.redisClient.del(structureKey);
                    logger.info('🗑️ Cleared lesson structure cache after upload');
                }

                // Clear all lesson list caches
                const lessonListKeys = await db.redisClient.keys('lessons:*');
                if (lessonListKeys.length > 0) {
                    await db.redisClient.del(lessonListKeys);
                    logger.info(`🗑️ Cleared ${lessonListKeys.length} lesson list cache entries after upload`);
                }

                // Log all current keys for debugging
                const allKeys = await db.redisClient.keys('*');
                logger.info('📊 Redis cache state after upload', {
                    totalKeys: allKeys.length,
                    keys: allKeys.slice(0, 10) // Show first 10 keys
                });
            }
        } catch (redisError) {
            logger.warn('⚠️ Could not clear Redis cache after upload', {
                error: redisError.message
            });
        }

        logger.info('Lesson uploaded successfully', {
            filename: originalName,
            targetFolder: targetFolder || 'Средний уровень (Подписка)',
            userId: user.id,
            username: user.username
        });
        res.status(200).json({ message: 'Lesson uploaded successfully.' });
    } catch (error) {
        logger.error('Error uploading lesson', {
            error: error.message,
            stack: error.stack,
            filename: originalName,
            userId: user?.id
        });
        res.status(500).json({ error: 'Failed to upload lesson.' });
    }
});

// Clear all Redis cache - admin only
router.post('/clear-cache', express.json(), validateTelegramAuth, requireAdmin, async (req, res) => {
    const user = req.telegramUser;

    logger.info('🧹 Admin requesting full cache clear', {
        userId: user.id,
        username: user.username
    });

    try {
        if (db.isRedisConnected && db.redisClient) {
            const keys = await db.redisClient.keys('*');
            if (keys.length > 0) {
                await db.redisClient.del(keys);
                logger.info(`✅ Cleared all ${keys.length} Redis cache entries`, {
                    userId: user.id,
                    username: user.username
                });
                res.json({ message: `Successfully cleared ${keys.length} cache entries` });
            } else {
                res.json({ message: 'Cache was already empty' });
            }
        } else {
            res.status(503).json({ error: 'Redis not connected' });
        }
    } catch (error) {
        logger.error('❌ Failed to clear cache', {
            error: error.message,
            userId: user.id
        });
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// Delete lesson endpoint
router.delete('/lesson', express.json(), validateTelegramAuth, requireAdmin, async (req, res) => {
    const { lessonPath } = req.body;
    const user = req.telegramUser;

    logger.info('Delete lesson attempt', { 
        lessonPath,
        userId: user.id,
        username: user.username
    });

    if (!lessonPath) {
        logger.warn('Delete failed: No lesson path provided');
        return res.status(400).json({ error: 'No lesson path provided.' });
    }

    try {
        const fullPath = path.join(LESSONS_DIR, lessonPath);

        // Security check - ensure the path is within lessons directory
        const resolvedPath = path.resolve(fullPath);
        const resolvedLessonsDir = path.resolve(LESSONS_DIR);

        if (!resolvedPath.startsWith(resolvedLessonsDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if it's a file or directory
        const stats = await fs.stat(fullPath);

        // Clean up database records for this lesson
        try {
            if (db.isConnected) {
                // Delete the lesson itself from database
                const lessonDeleteResult = await db.query(
                    'DELETE FROM lessons WHERE path = $1',
                    [lessonPath]
                );

                if (lessonDeleteResult.rowCount > 0) {
                    logger.info(`✅ Deleted lesson from database`, {
                        lessonPath,
                        userId: user.id
                    });
                }

                // Delete progress records for this lesson path
                const progressDeleteResult = await db.query(
                    'DELETE FROM user_progress WHERE lesson_path = $1',
                    [lessonPath]
                );

                if (progressDeleteResult.rowCount > 0) {
                    logger.info(`📊 Deleted ${progressDeleteResult.rowCount} progress records for lesson`, {
                        lessonPath,
                        userId: user.id
                    });
                }

                // Delete analytics events for this lesson
                const analyticsDeleteResult = await db.query(
                    'DELETE FROM analytics_events WHERE lesson_path = $1',
                    [lessonPath]
                );

                if (analyticsDeleteResult.rowCount > 0) {
                    logger.info(`📈 Deleted ${analyticsDeleteResult.rowCount} analytics events for lesson`, {
                        lessonPath,
                        userId: user.id
                    });
                }
            }
        } catch (dbError) {
            logger.warn('⚠️ Could not delete records from database', {
                error: dbError.message,
                lessonPath
            });
        }

        // Clear Redis cache for this lesson
        try {
            if (db.isRedisConnected && db.redisClient) {
                // Get all keys from Redis
                const allKeys = await db.redisClient.keys('*');

                // Filter keys that contain the lesson path
                const keysToDelete = [];
                for (const key of allKeys) {
                    // Check if key contains any part of the lesson path
                    // Handle both encoded and decoded versions
                    if (key.includes(lessonPath) ||
                        key.includes(encodeURIComponent(lessonPath)) ||
                        key.includes(lessonPath.replace(/\//g, ':')) ||
                        key.includes(lessonPath.replace(/\\/g, ':'))) {
                        keysToDelete.push(key);
                    }
                }

                // Delete specific lesson cache key
                const specificKey = `lesson:content:${lessonPath}`;
                if (allKeys.includes(specificKey)) {
                    keysToDelete.push(specificKey);
                }

                // Delete all found keys
                if (keysToDelete.length > 0) {
                    await db.redisClient.del(keysToDelete);
                    logger.info(`🗑️ Cleared ${keysToDelete.length} cache entries for lesson`, {
                        lessonPath,
                        keys: keysToDelete,
                        userId: user.id
                    });
                }

                // Clear lesson structure cache
                const structureKey = 'lesson:structure';
                if (await db.redisClient.exists(structureKey)) {
                    await db.redisClient.del(structureKey);
                    logger.info('🗑️ Cleared lesson structure cache');
                }

                // Clear all lesson list caches
                const lessonListKeys = await db.redisClient.keys('lessons:*');
                if (lessonListKeys.length > 0) {
                    await db.redisClient.del(lessonListKeys);
                    logger.info(`🗑️ Cleared ${lessonListKeys.length} lesson list cache entries`);
                }
            }
        } catch (redisError) {
            logger.warn('⚠️ Could not clear Redis cache', {
                error: redisError.message,
                lessonPath
            });
        }

        // Delete the actual file/directory
        logger.info('🗑️ Attempting to delete', {
            fullPath,
            isDirectory: stats.isDirectory(),
            lessonPath
        });

        if (stats.isDirectory()) {
            // List contents before deletion for debugging
            const contents = await fs.readdir(fullPath);
            logger.info('📁 Directory contents before deletion', {
                path: fullPath,
                files: contents
            });

            // Remove entire directory and all its contents
            await fs.remove(fullPath);

            // Verify deletion
            const stillExists = await fs.pathExists(fullPath);
            if (stillExists) {
                logger.error('❌ Directory still exists after deletion attempt', { fullPath });
                throw new Error('Failed to delete directory completely');
            }

            logger.info('✅ Directory deleted successfully', {
                lessonPath,
                userId: user.id,
                username: user.username
            });
        } else {
            await fs.unlink(fullPath);
            logger.info('✅ File deleted successfully', {
                lessonPath,
                userId: user.id,
                username: user.username
            });
        }

        res.status(200).json({ message: 'Lesson deleted successfully.' });
    } catch (error) {
        logger.error('Error deleting lesson', {
            error: error.message,
            stack: error.stack,
            lessonPath,
            userId: user?.id
        });
        
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Lesson not found.' });
        } else {
            res.status(500).json({ error: 'Failed to delete lesson.' });
        }
    }
});

module.exports = router;