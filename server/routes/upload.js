const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const { validateTelegramAuth, requireAdmin } = require('../middleware/auth');
const { fixEncodingIssues, fixCorruptedRussianTextServer } = require('../utils/encoding');
const logger = require('../config/logger');

const LESSONS_DIR = path.join(__dirname, '../../lessons');
const upload = multer({ storage: multer.memoryStorage() });

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

        } else if (path.extname(originalName) === '.md') {
            const lessonName = path.basename(originalName, '.md');

            // Use selected folder or default to intermediate level
            const targetDir = targetFolder ? 
                path.join(LESSONS_DIR, targetFolder) : 
                path.join(LESSONS_DIR, 'Средний уровень (Подписка)');
            
            // Ensure target directory exists
            await fs.ensureDir(targetDir);
            
            // Create a subfolder for the lesson
            const lessonDir = path.join(targetDir, lessonName);
            await fs.ensureDir(lessonDir);

            await fs.writeFile(path.join(lessonDir, originalName), fileBuffer);
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Please upload a .md or .zip file.' });
        }

        logger.info('Lesson uploaded successfully', {
            filename: originalName,
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