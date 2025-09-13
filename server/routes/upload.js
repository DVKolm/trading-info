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
            logger.warn('⚠️ Database not connected, skipping lesson import');
            return;
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
                        lesson_number = $8, file_hash = $9, updated_at = CURRENT_TIMESTAMP
                    WHERE path = $1
                `, [lessonPath, title, parsed.content, htmlContent,
                    JSON.stringify(parsed.data), wordCount, targetFolder,
                    lessonNumber, fileHash]);

                logger.info('📝 Updated lesson in database', { lessonPath, title });
            }
        } else {
            // Insert new lesson
            await db.query(`
                INSERT INTO lessons (path, title, content, html_content, frontmatter,
                                   word_count, parent_folder, lesson_number, file_hash)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [lessonPath, title, parsed.content, htmlContent,
                JSON.stringify(parsed.data), wordCount, targetFolder,
                lessonNumber, fileHash]);

            logger.info('➕ Added lesson to database', { lessonPath, title });
        }

        // Clear cache for this lesson
        if (db.isRedisConnected && db.redisClient) {
            const cacheKey = `lesson:content:${lessonPath}`;
            await db.redisClient.del(cacheKey);
        }

    } catch (error) {
        logger.error('❌ Failed to import lesson to database', {
            error: error.message,
            lessonPath
        });
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
                await importLessonToDatabase(relativePath, targetFolder || 'Средний уровень (Подписка)');
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
            await importLessonToDatabase(relativePath, targetFolder || 'Средний уровень (Подписка)');

        } else {
            return res.status(400).json({ error: 'Unsupported file type. Please upload a .md or .zip file.' });
        }

        // Clear Redis cache after successful upload to reflect new lesson
        try {
            if (db.isRedisConnected && db.redisClient) {
                // Clear lesson list cache since structure changed
                const lessonListPattern = 'lessons:*';
                const lessonListKeys = await db.redisClient.keys(lessonListPattern);
                if (lessonListKeys.length > 0) {
                    await db.redisClient.del(lessonListKeys);
                    logger.info('Cleared lesson list cache after upload');
                }
            }
        } catch (redisError) {
            logger.warn('Could not clear Redis cache after upload', {
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
            // Delete progress records for this lesson path
            if (db.isConnected) {
                const deleteResult = await db.query(
                    'DELETE FROM user_progress WHERE lesson_path = $1',
                    [lessonPath]
                );

                if (deleteResult.rowCount > 0) {
                    logger.info(`Deleted ${deleteResult.rowCount} progress records for lesson`, {
                        lessonPath,
                        userId: user.id
                    });
                }
            }
        } catch (dbError) {
            logger.warn('Could not delete progress records from database', {
                error: dbError.message,
                lessonPath
            });
        }

        // Clear Redis cache for this lesson
        try {
            if (db.isRedisConnected && db.redisClient) {
                // Find and delete all cache keys related to this lesson
                const pattern = `*:${lessonPath.replace(/[\/\\]/g, ':')}*`;
                const keys = await db.redisClient.keys(pattern);

                if (keys.length > 0) {
                    await db.redisClient.del(keys);
                    logger.info(`Cleared ${keys.length} cache entries for lesson`, {
                        lessonPath,
                        userId: user.id
                    });
                }

                // Also clear lesson list cache since structure changed
                const lessonListPattern = 'lessons:*';
                const lessonListKeys = await db.redisClient.keys(lessonListPattern);
                if (lessonListKeys.length > 0) {
                    await db.redisClient.del(lessonListKeys);
                    logger.info('Cleared lesson list cache');
                }
            }
        } catch (redisError) {
            logger.warn('Could not clear Redis cache', {
                error: redisError.message,
                lessonPath
            });
        }

        // Delete the actual file/directory
        if (stats.isDirectory()) {
            await fs.remove(fullPath);
            logger.info('Directory deleted successfully', {
                lessonPath,
                userId: user.id,
                username: user.username
            });
        } else {
            await fs.unlink(fullPath);
            logger.info('File deleted successfully', {
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