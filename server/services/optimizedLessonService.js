const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');
const marked = require('marked');
const db = require('../config/database');
const logger = require('../config/logger');

const LESSONS_DIR = path.join(__dirname, '../../lessons');
const CACHE_DIR = path.join(__dirname, '../../.cache/lessons');

class OptimizedLessonService {
    constructor() {
        // Ensure cache directory exists
        fs.ensureDirSync(CACHE_DIR);
    }

    /**
     * Import lesson with optimized storage
     * Stores metadata in DB, content in filesystem
     */
    async importLesson(lessonPath, targetFolder) {
        try {
            const fullPath = path.join(LESSONS_DIR, lessonPath);
            const content = await fs.readFile(fullPath, 'utf8');

            // Parse markdown for metadata
            const parsed = matter(content);
            const stats = await fs.stat(fullPath);

            // Extract metadata
            const metadata = {
                path: lessonPath,
                title: parsed.data.title || path.basename(lessonPath, '.md'),
                contentPreview: content.substring(0, 500),
                wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
                fileSize: stats.size,
                fileHash: crypto.createHash('sha256').update(content).digest('hex'),
                parentFolder: targetFolder,
                readingTime: Math.ceil(content.split(/\s+/).length / 200), // 200 words per minute
                hasImages: /!\[.*?\]\(.*?\)/.test(content),
                hasVideos: /<video|youtube|vimeo/i.test(content),
                tags: this.extractTags(parsed.data, content),
                difficultyLevel: parsed.data.difficulty || this.detectDifficulty(targetFolder),
                frontmatter: parsed.data
            };

            // Store metadata in database
            const result = await this.saveMetadataToDatabase(metadata);

            // Generate and cache HTML separately
            await this.cacheProcessedContent(lessonPath, parsed.content);

            // Extract and register assets
            await this.extractAndRegisterAssets(result.id, content, lessonPath);

            return result;
        } catch (error) {
            logger.error('Failed to import lesson optimally:', error);
            throw error;
        }
    }

    /**
     * Save lesson metadata to database (without full content)
     */
    async saveMetadataToDatabase(metadata) {
        const query = `
            INSERT INTO lessons (
                path, title, content_preview, word_count, file_size,
                file_hash, parent_folder, reading_time, has_images,
                has_videos, tags, difficulty_level, frontmatter
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (path) DO UPDATE SET
                title = EXCLUDED.title,
                content_preview = EXCLUDED.content_preview,
                word_count = EXCLUDED.word_count,
                file_size = EXCLUDED.file_size,
                file_hash = EXCLUDED.file_hash,
                reading_time = EXCLUDED.reading_time,
                has_images = EXCLUDED.has_images,
                has_videos = EXCLUDED.has_videos,
                tags = EXCLUDED.tags,
                difficulty_level = EXCLUDED.difficulty_level,
                frontmatter = EXCLUDED.frontmatter,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, path
        `;

        const result = await db.query(query, [
            metadata.path,
            metadata.title,
            metadata.contentPreview,
            metadata.wordCount,
            metadata.fileSize,
            metadata.fileHash,
            metadata.parentFolder,
            metadata.readingTime,
            metadata.hasImages,
            metadata.hasVideos,
            metadata.tags,
            metadata.difficultyLevel,
            JSON.stringify(metadata.frontmatter)
        ]);

        return result.rows[0];
    }

    /**
     * Cache processed HTML content to filesystem
     */
    async cacheProcessedContent(lessonPath, markdownContent) {
        const cacheKey = crypto.createHash('md5').update(lessonPath).digest('hex');
        const cachePath = path.join(CACHE_DIR, `${cacheKey}.html`);

        // Generate HTML
        const htmlContent = marked.parse(markdownContent);

        // Save to cache
        await fs.writeFile(cachePath, htmlContent, 'utf8');

        // Also save metadata about cache
        const metaPath = path.join(CACHE_DIR, `${cacheKey}.meta.json`);
        await fs.writeJson(metaPath, {
            lessonPath,
            cachedAt: new Date().toISOString(),
            size: Buffer.byteLength(htmlContent, 'utf8')
        });

        return cachePath;
    }

    /**
     * Get lesson content (from filesystem, not database)
     */
    async getLessonContent(lessonPath) {
        try {
            // Get metadata from database
            const metaResult = await db.query(
                'SELECT * FROM lessons WHERE path = $1',
                [lessonPath]
            );

            if (metaResult.rows.length === 0) {
                throw new Error('Lesson not found');
            }

            const metadata = metaResult.rows[0];

            // Read actual content from filesystem
            const fullPath = path.join(LESSONS_DIR, lessonPath);
            const content = await fs.readFile(fullPath, 'utf8');

            // Parse markdown
            const parsed = matter(content);

            // Check cache for HTML
            const cacheKey = crypto.createHash('md5').update(lessonPath).digest('hex');
            const cachePath = path.join(CACHE_DIR, `${cacheKey}.html`);

            let htmlContent;
            if (await fs.pathExists(cachePath)) {
                // Use cached HTML
                htmlContent = await fs.readFile(cachePath, 'utf8');
            } else {
                // Generate and cache HTML
                htmlContent = marked.parse(parsed.content);
                await this.cacheProcessedContent(lessonPath, parsed.content);
            }

            return {
                ...metadata,
                content: parsed.content,
                htmlContent,
                frontmatter: parsed.data
            };
        } catch (error) {
            logger.error('Failed to get lesson content:', error);
            throw error;
        }
    }

    /**
     * Extract tags from content and frontmatter
     */
    extractTags(frontmatter, content) {
        const tags = [];

        // From frontmatter
        if (frontmatter.tags) {
            if (Array.isArray(frontmatter.tags)) {
                tags.push(...frontmatter.tags);
            } else if (typeof frontmatter.tags === 'string') {
                tags.push(...frontmatter.tags.split(',').map(t => t.trim()));
            }
        }

        // Auto-detect from content
        if (/стратеги/i.test(content)) tags.push('strategy');
        if (/индикатор/i.test(content)) tags.push('indicators');
        if (/риск/i.test(content)) tags.push('risk-management');
        if (/психолог/i.test(content)) tags.push('psychology');

        return [...new Set(tags)]; // Remove duplicates
    }

    /**
     * Detect difficulty based on folder or content
     */
    detectDifficulty(folder) {
        if (/начина|beginner|basic/i.test(folder)) return 'beginner';
        if (/средн|intermediate/i.test(folder)) return 'intermediate';
        if (/продвин|advanced|expert/i.test(folder)) return 'advanced';
        return 'intermediate';
    }

    /**
     * Extract and register lesson assets (images, videos)
     */
    async extractAndRegisterAssets(lessonId, content, lessonPath) {
        const assets = [];

        // Extract images
        const imageRegex = /!\[.*?\]\((.*?)\)/g;
        let match;
        while ((match = imageRegex.exec(content)) !== null) {
            const assetPath = match[1];
            if (!assetPath.startsWith('http')) {
                assets.push({
                    lessonId,
                    assetType: 'image',
                    filePath: assetPath
                });
            }
        }

        // Save assets to database
        for (const asset of assets) {
            await db.query(
                `INSERT INTO lesson_assets (lesson_id, asset_type, file_path)
                 VALUES ($1, $2, $3)
                 ON CONFLICT DO NOTHING`,
                [asset.lessonId, asset.assetType, asset.filePath]
            );
        }
    }

    /**
     * Search lessons with optimized query
     */
    async searchLessons(query) {
        // Search in database metadata first
        const result = await db.query(`
            SELECT id, path, title, content_preview, reading_time, difficulty_level, tags
            FROM lessons
            WHERE
                title ILIKE $1 OR
                content_preview ILIKE $1 OR
                $2 = ANY(tags)
            ORDER BY
                CASE
                    WHEN title ILIKE $1 THEN 1
                    WHEN content_preview ILIKE $1 THEN 2
                    ELSE 3
                END,
                updated_at DESC
            LIMIT 20
        `, [`%${query}%`, query.toLowerCase()]);

        return result.rows;
    }

    /**
     * Clean up old cache files
     */
    async cleanupCache(maxAgeHours = 24) {
        const now = Date.now();
        const maxAge = maxAgeHours * 60 * 60 * 1000;

        const files = await fs.readdir(CACHE_DIR);
        for (const file of files) {
            if (file.endsWith('.meta.json')) {
                const metaPath = path.join(CACHE_DIR, file);
                const meta = await fs.readJson(metaPath);
                const age = now - new Date(meta.cachedAt).getTime();

                if (age > maxAge) {
                    // Remove cache files
                    const cacheKey = file.replace('.meta.json', '');
                    await fs.remove(path.join(CACHE_DIR, `${cacheKey}.html`));
                    await fs.remove(metaPath);
                }
            }
        }
    }
}

module.exports = new OptimizedLessonService();