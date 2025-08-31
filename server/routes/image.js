const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const logger = require('../config/logger');

// GET route for images - search by filename in all lesson directories  
router.get('/:encodedPath', async (req, res) => {
    try {
        const filename = Buffer.from(req.params.encodedPath, 'base64').toString('utf8');
        
        // Recursive search for the file in all lesson directories
        const lessonsDir = path.join(__dirname, '../../lessons');
        
        const searchRecursively = async (dir) => {
            const entries = await fs.readdir(dir, { withFileTypes: true, encoding: 'utf8' });
            
            for (const entry of entries) {
                // Ensure proper UTF-8 handling for Russian text
                const safeName = Buffer.from(entry.name, 'utf8').toString('utf8');
                const fullPath = path.join(dir, safeName);
                
                if (entry.isDirectory()) {
                    // Search in subdirectory
                    const result = await searchRecursively(fullPath);
                    if (result) return result;
                } else if (safeName === filename) {
                    // Found the file
                    return fullPath;
                }
            }
            return null;
        };
        
        const foundFilePath = await searchRecursively(lessonsDir);
        
        if (!foundFilePath) {
            return res.status(404).json({ error: 'File not found', filename });
        }
        
        // Security check
        const resolvedPath = path.resolve(foundFilePath);
        const resolvedLessonsDir = path.resolve(lessonsDir);
        
        if (!resolvedPath.startsWith(resolvedLessonsDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.sendFile(resolvedPath);
    } catch (error) {
        logger.error('Error serving image:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API route to serve lesson images by POST with JSON body to avoid URL encoding issues
router.post('/lesson-image', express.json(), async (req, res) => {
    try {
        const { lessonPath, imageName } = req.body;
        
        const filePath = path.join(__dirname, '../../lessons', lessonPath, imageName);
        
        // Security check
        const resolvedPath = path.resolve(filePath);
        const resolvedLessonsDir = path.resolve(path.join(__dirname, '../../lessons'));
        
        if (!resolvedPath.startsWith(resolvedLessonsDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Check if file exists
        if (await fs.pathExists(filePath)) {
            res.sendFile(resolvedPath);
        } else {
            res.status(404).json({ error: 'File not found', path: filePath });
        }
    } catch (error) {
        logger.error('Error serving lesson image:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;