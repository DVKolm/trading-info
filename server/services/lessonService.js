const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');

const LESSONS_DIR = path.join(__dirname, '../../lessons');

// Cache for lesson mapping
let lessonMap = new Map();

/**
 * Lesson management service
 */
class LessonService {
    constructor() {
        // Configure marked to suppress deprecated warnings
        marked.setOptions({
            mangle: false,
            headerIds: false,
        });
    }

    /**
     * Build lesson name to path mapping
     */
    async buildLessonMap(dirPath = LESSONS_DIR, relativePath = '') {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true, encoding: 'utf8' });
            
            for (const entry of entries) {
                const safeName = Buffer.from(entry.name, 'utf8').toString('utf8');
                const fullPath = path.join(dirPath, safeName);
                const itemRelativePath = path.join(relativePath, safeName);
                
                if (entry.isDirectory()) {
                    await this.buildLessonMap(fullPath, itemRelativePath);
                } else if (safeName.endsWith('.md')) {
                    const content = await fs.readFile(fullPath, 'utf8');
                    const parsed = matter(content);
                    
                    let title = parsed.data.title || safeName.replace('.md', '');
                    const firstHeading = content.match(/^#\s+(.+)$/m);
                    if (firstHeading) {
                        title = firstHeading[1];
                    }
                    
                    // Store both the title and filename as possible keys
                    lessonMap.set(title, itemRelativePath.replace(/\\/g, '/'));
                    lessonMap.set(safeName.replace('.md', ''), itemRelativePath.replace(/\\/g, '/'));
                    
                    // Also store the directory name if it matches a lesson pattern
                    const dirName = path.basename(path.dirname(fullPath));
                    if (dirName.includes('Урок') || dirName.includes('Lesson')) {
                        lessonMap.set(dirName, itemRelativePath.replace(/\\/g, '/'));
                    }
                }
            }
        } catch (error) {
            console.error('Error building lesson map:', error);
        }
    }

    /**
     * Scan directory structure recursively
     */
    async scanLessonsDirectory(dirPath = LESSONS_DIR, relativePath = '') {
        const items = [];
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true, encoding: 'utf8' });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const itemRelativePath = path.join(relativePath, entry.name);
                const safeName = Buffer.from(entry.name, 'utf8').toString('utf8');
                
                if (entry.isDirectory()) {
                    const children = await this.scanLessonsDirectory(fullPath, itemRelativePath);
                    items.push({
                        id: itemRelativePath.replace(/\\/g, '/'),
                        name: safeName,
                        type: 'folder',
                        path: itemRelativePath.replace(/\\/g, '/'),
                        children: children
                    });
                } else if (entry.name.endsWith('.md')) {
                    let title = safeName.replace('.md', '');
                    try {
                        const content = await fs.readFile(fullPath, 'utf8');
                        const parsed = matter(content);
                        
                        if (parsed.data.title) {
                            title = parsed.data.title;
                        } else {
                            const firstHeading = content.match(/^#\s+(.+)$/m);
                            if (firstHeading) {
                                title = firstHeading[1];
                            }
                        }
                    } catch (error) {
                        console.warn(`Could not read file ${fullPath}:`, error.message);
                    }
                    
                    items.push({
                        id: itemRelativePath.replace(/\\/g, '/'),
                        name: title,
                        type: 'file',
                        path: itemRelativePath.replace(/\\/g, '/'),
                        filename: safeName
                    });
                }
            }
            
            // Sort items: folders first, then files, with proper numeric sorting for lessons
            items.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                }
                
                const getLessonNumber = (name) => {
                    const match = name.match(/Урок\s+(\d+)/i);
                    return match ? parseInt(match[1], 10) : 999;
                };
                
                const aLessonNum = getLessonNumber(a.name);
                const bLessonNum = getLessonNumber(b.name);
                
                if (aLessonNum !== 999 && bLessonNum !== 999) {
                    return aLessonNum - bLessonNum;
                }
                
                if (aLessonNum !== 999) return -1;
                if (bLessonNum !== 999) return 1;
                
                return a.name.localeCompare(b.name, 'ru');
            });
            
            return items;
        } catch (error) {
            console.error('Error scanning directory:', error);
            return [];
        }
    }

    /**
     * Get lesson structure
     */
    async getLessonStructure() {
        await fs.ensureDir(LESSONS_DIR);
        lessonMap.clear();
        await this.buildLessonMap();
        return await this.scanLessonsDirectory();
    }

    /**
     * Get lesson content
     */
    async getLessonContent(lessonPath) {
        const fullPath = path.join(LESSONS_DIR, lessonPath);
        
        // Security check
        const resolvedPath = path.resolve(fullPath);
        const resolvedLessonsDir = path.resolve(LESSONS_DIR);
        
        if (!resolvedPath.startsWith(resolvedLessonsDir)) {
            throw new Error('Access denied');
        }
        
        if (!await fs.pathExists(fullPath)) {
            throw new Error('Lesson not found');
        }
        
        const content = await fs.readFile(fullPath, 'utf8');
        const parsed = matter(content);
        
        // Convert markdown to HTML
        const htmlContent = marked(parsed.content);
        
        return {
            path: lessonPath,
            frontmatter: parsed.data,
            content: parsed.content,
            html: htmlContent
        };
    }

    /**
     * Search lessons
     */
    async searchLessons(query) {
        if (!query) return [];
        
        const structure = await this.scanLessonsDirectory();
        const results = [];
        
        const searchInStructure = (items) => {
            for (const item of items) {
                if (item.type === 'file' && item.name.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        id: item.id,
                        name: item.name,
                        path: item.path,
                        type: 'lesson'
                    });
                } else if (item.type === 'folder') {
                    if (item.name.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            id: item.id,
                            name: item.name,
                            path: item.path,
                            type: 'folder'
                        });
                    }
                    if (item.children) {
                        searchInStructure(item.children);
                    }
                }
            }
        };
        
        searchInStructure(structure);
        return results;
    }

    /**
     * Resolve internal lesson link
     */
    async resolveLessonLink(linkName) {
        // Build lesson map if it's empty
        if (lessonMap.size === 0) {
            await this.buildLessonMap();
        }
        
        let lessonPath = lessonMap.get(linkName);
        
        if (!lessonPath) {
            // Try partial matching
            for (const [key, value] of lessonMap.entries()) {
                if (key.toLowerCase().includes(linkName.toLowerCase()) || 
                    linkName.toLowerCase().includes(key.toLowerCase())) {
                    lessonPath = value;
                    break;
                }
            }
        }
        
        return lessonPath ? { found: true, path: lessonPath } : { found: false, suggestions: [] };
    }

    /**
     * Get lesson folders for upload
     */
    async getLessonFolders() {
        await fs.ensureDir(LESSONS_DIR);
        
        const folders = [];
        const entries = await fs.readdir(LESSONS_DIR, { withFileTypes: true, encoding: 'utf8' });
        
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const safeName = Buffer.from(entry.name, 'utf8').toString('utf8');
                folders.push({
                    name: safeName,
                    path: entry.name
                });
            }
        }
        
        folders.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        return folders;
    }
}

module.exports = new LessonService();