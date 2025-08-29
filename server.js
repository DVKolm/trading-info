require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');
const multer = require("multer");
const winston = require('winston');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
require('winston-daily-rotate-file');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'trading-info-app' },
  transports: [
    // Write all logs with importance level of 'error' or less to 'error.log'
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),

    // Write all logs to app.log with daily rotation
    new winston.transports.DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    }),

    // Also create a simple app.log file for tail -f
    new winston.transports.File({ 
      filename: 'app.log',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    })
  ]
});

// If we're not in production then log to the console with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest })`
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
      })
    )
  }));
}

// Ensure logs directory exists
fs.ensureDirSync('logs');

// Middleware to log HTTP requests
const logRequests = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });

  next();
};

// Configure marked to suppress deprecated warnings
marked.setOptions({
  mangle: false,
  headerIds: false,
});

const app = express();
const PORT = process.env.PORT || 3001;

// Production environment check
const isProduction = process.env.NODE_ENV === 'production';

const authorizedUserIds = ['781182099', '5974666109'];
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function isValidTelegramData(initData) {
    const encoded = decodeURIComponent(initData);
    const data = new URLSearchParams(encoded);
    const hash = data.get('hash');
    data.delete('hash');

    const dataCheckArr = [];
    for (const [key, value] of data.entries()) {
        dataCheckArr.push(`${key}=${value}`);
    }
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN);
    const calculatedHash = crypto.createHmac('sha256', secretKey.digest()).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
        return { isValid: false, user: null };
    }

    const user = JSON.parse(data.get('user'));

    return { isValid: true, user };
}

app.use(cors());
app.use(express.json());
app.use(logRequests);

// Log server startup
logger.info('Starting Trading Info Server', {
  port: PORT,
  nodeEnv: process.env.NODE_ENV,
  isProduction
});


// API route to serve lesson images by POST with JSON body to avoid URL encoding issues
app.post('/api/lesson-image', express.json(), async (req, res) => {
  try {
    const { lessonPath, imageName } = req.body;
    
    const filePath = path.join(__dirname, 'lessons', lessonPath, imageName);
    
    // Security check
    const resolvedPath = path.resolve(filePath);
    const resolvedLessonsDir = path.resolve(path.join(__dirname, 'lessons'));
    
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
    console.error('Error serving lesson image:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload-lesson', upload.single('lesson'), async (req, res) => {
    const { initData } = req.body;

    logger.info('Upload lesson attempt', { 
      filename: req.file?.originalname,
      hasInitData: !!initData,
      fileSize: req.file?.size
    });

    if (!initData) {
        logger.warn('Upload failed: No initData provided');
        return res.status(401).json({ error: 'Unauthorized: No initData provided' });
    }

    const { isValid, user } = await isValidTelegramData(initData);

    if (!isValid || !authorizedUserIds.includes(String(user.id))) {
        logger.warn('Upload failed: Unauthorized user', { userId: user?.id, isValid });
        return res.status(403).json({ error: 'Forbidden: Invalid user' });
    }

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

            // Default to intermediate level folder for zip uploads
            const intermediateLevelDir = path.join(LESSONS_DIR, 'Средний уровень');
            
            // Ensure intermediate level directory exists
            await fs.ensureDir(intermediateLevelDir);
            
            // Extract directly to intermediate level folder
            // The zip should contain a folder with the lesson files
            zip.extractAllTo(intermediateLevelDir, true);

        } else if (path.extname(originalName) === '.md') {
            const lessonName = path.basename(originalName, '.md');

            // Default to intermediate level folder for .md uploads
            const intermediateLevelDir = path.join(LESSONS_DIR, 'Средний уровень');
            
            // Ensure intermediate level directory exists
            await fs.ensureDir(intermediateLevelDir);
            
            // Create a subfolder for the lesson
            const lessonDir = path.join(intermediateLevelDir, lessonName);
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


// GET route for images - search by filename in all lesson directories  
app.get('/api/image/:encodedPath', async (req, res) => {
  try {
    const filename = Buffer.from(req.params.encodedPath, 'base64').toString('utf8');
    
    // Recursive search for the file in all lesson directories
    const lessonsDir = path.join(__dirname, 'lessons');
    
    const searchRecursively = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Search in subdirectory
          const result = await searchRecursively(fullPath);
          if (result) return result;
        } else if (entry.name === filename) {
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
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Lessons directory
const LESSONS_DIR = path.join(__dirname, 'lessons');

// Cache for lesson mapping
let lessonMap = new Map();

// Function to build lesson name to path mapping
async function buildLessonMap(dirPath, relativePath = '') {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const itemRelativePath = path.join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        await buildLessonMap(fullPath, itemRelativePath);
      } else if (entry.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf8');
        const parsed = matter(content);
        
        let title = parsed.data.title || entry.name.replace('.md', '');
        const firstHeading = content.match(/^#\s+(.+)$/m);
        if (firstHeading) {
          title = firstHeading[1];
        }
        
        // Store both the title and filename as possible keys
        lessonMap.set(title, itemRelativePath.replace(/\\/g, '/'));
        lessonMap.set(entry.name.replace('.md', ''), itemRelativePath.replace(/\\/g, '/'));
        
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

// Function to get all lessons for upload logic
async function getLessons() {
  const lessons = [];
  
  async function scanRecursively(dirPath, relativePath = '') {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const itemRelativePath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          await scanRecursively(fullPath, itemRelativePath);
        } else if (entry.name.endsWith('.md')) {
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            const parsed = matter(content);
            
            let title = parsed.data.title || entry.name.replace('.md', '');
            const firstHeading = content.match(/^#\s+(.+)$/m);
            if (firstHeading) {
              title = firstHeading[1];
            }
            
            lessons.push({
              title,
              fullPath,
              relativePath: itemRelativePath.replace(/\\/g, '/'),
              filename: entry.name
            });
          } catch (error) {
            console.warn(`Could not read file ${fullPath}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', error);
    }
  }
  
  await scanRecursively(LESSONS_DIR);
  return lessons;
}

// Function to scan directory structure
async function scanLessonsDirectory(dirPath, relativePath = '') {
  const items = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const itemRelativePath = path.join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        const children = await scanLessonsDirectory(fullPath, itemRelativePath);
        items.push({
          id: itemRelativePath.replace(/\\/g, '/'),
          name: entry.name,
          type: 'folder',
          path: itemRelativePath.replace(/\\/g, '/'),
          children: children
        });
      } else if (entry.name.endsWith('.md')) {
        // Read markdown file to extract title from frontmatter or first heading
        let title = entry.name.replace('.md', '');
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          const parsed = matter(content);
          
          if (parsed.data.title) {
            title = parsed.data.title;
          } else {
            // Try to extract title from first heading
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
          filename: entry.name
        });
      }
    }
    
    // Sort items: folders first, then files, with proper numeric sorting for lessons
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      
      // Extract lesson numbers for proper numeric sorting
      const getLessonNumber = (name) => {
        const match = name.match(/Урок\s+(\d+)/i);
        return match ? parseInt(match[1], 10) : 999;
      };
      
      const aLessonNum = getLessonNumber(a.name);
      const bLessonNum = getLessonNumber(b.name);
      
      // If both are lessons, sort by number
      if (aLessonNum !== 999 && bLessonNum !== 999) {
        return aLessonNum - bLessonNum;
      }
      
      // If only one is a lesson, lessons go first
      if (aLessonNum !== 999) return -1;
      if (bLessonNum !== 999) return 1;
      
      // Otherwise, sort alphabetically
      return a.name.localeCompare(b.name, 'ru');
    });
    
    return items;
  } catch (error) {
    console.error('Error scanning directory:', error);
    return [];
  }
}

// API Routes

// Get lessons structure
app.get('/api/lessons/structure', async (req, res) => {
  try {
    logger.info('Getting lessons structure');

    // Ensure lessons directory exists
    await fs.ensureDir(LESSONS_DIR);

    // Build lesson mapping for internal links
    lessonMap.clear();
    await buildLessonMap(LESSONS_DIR);

    const structure = await scanLessonsDirectory(LESSONS_DIR);

    logger.info('Lessons structure retrieved successfully', {
      itemCount: structure.length
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

// Get specific lesson content
app.get('/api/lessons/content/*', async (req, res) => {
  try {
    const lessonPath = req.params[0];
    const fullPath = path.join(LESSONS_DIR, lessonPath);
    
    // Security check - ensure the path is within lessons directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedLessonsDir = path.resolve(LESSONS_DIR);
    
    if (!resolvedPath.startsWith(resolvedLessonsDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    
    const content = await fs.readFile(fullPath, 'utf8');
    const parsed = matter(content);
    
    // Convert markdown to HTML
    const htmlContent = marked(parsed.content);
    
    res.json({
      path: lessonPath,
      frontmatter: parsed.data,
      content: parsed.content,
      html: htmlContent
    });
  } catch (error) {
    console.error('Error getting lesson content:', error);
    res.status(500).json({ error: 'Failed to get lesson content' });
  }
});

// Resolve internal lesson link
app.get('/api/lessons/resolve/:linkName', async (req, res) => {
  try {
    const linkName = decodeURIComponent(req.params.linkName);
    
    // Try to find the lesson by various possible names
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
    
    if (lessonPath) {
      res.json({ found: true, path: lessonPath });
    } else {
      res.json({ found: false, suggestions: [] });
    }
  } catch (error) {
    console.error('Error resolving internal link:', error);
    res.status(500).json({ error: 'Failed to resolve internal link' });
  }
});

// Search lessons
app.get('/api/lessons/search', async (req, res) => {
  try {
    const query = req.query.q?.toLowerCase();
    if (!query) {
      return res.json({ results: [] });
    }
    
    const structure = await scanLessonsDirectory(LESSONS_DIR);
    const results = [];
    
    function searchInStructure(items, currentPath = '') {
      for (const item of items) {
        if (item.type === 'file' && item.name.toLowerCase().includes(query)) {
          results.push({
            id: item.id,
            name: item.name,
            path: item.path,
            type: 'lesson'
          });
        } else if (item.type === 'folder') {
          if (item.name.toLowerCase().includes(query)) {
            results.push({
              id: item.id,
              name: item.name,
              path: item.path,
              type: 'folder'
            });
          }
          if (item.children) {
            searchInStructure(item.children, item.path);
          }
        }
      }
    }
    
    searchInStructure(structure);
    
    res.json({ results });
  } catch (error) {
    console.error('Error searching lessons:', error);
    res.status(500).json({ error: 'Failed to search lessons' });
  }
});

// Subscription verification endpoint
app.post('/api/subscription/verify', async (req, res) => {
  try {
    const { telegram_user_id, verified } = req.body;
    
    console.log(`Subscription verification request for user ${telegram_user_id}`);
    
    // Проверяем режим разработки
    if (process.env.DEVELOPMENT_MODE === 'true') {
      console.log('Development mode: skipping real subscription check');
      return res.json({ 
        verified: true,
        message: 'Development mode: subscription verified automatically',
        development: true
      });
    }
    
    // Реальная проверка через Telegram Bot API
    const telegram_bot_token = process.env.TELEGRAM_BOT_TOKEN;
    const telegram_channel_id = process.env.TELEGRAM_CHANNEL_ID;
    
    if (!telegram_bot_token) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return res.status(500).json({ 
        error: 'Telegram bot not configured',
        verified: false 
      });
    }
    
    if (!telegram_channel_id) {
      console.error('TELEGRAM_CHANNEL_ID not configured');
      return res.status(500).json({ 
        error: 'Telegram channel not configured',
        verified: false 
      });
    }
    
    if (!telegram_user_id) {
      console.error('Telegram user ID not provided');
      return res.status(400).json({ 
        error: 'User ID required for verification',
        verified: false 
      });
    }
    
    try {
      // Проверяем подписку через Telegram Bot API
      const response = await fetch(`https://api.telegram.org/bot${telegram_bot_token}/getChatMember`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegram_channel_id,
          user_id: telegram_user_id
        })
      });
      
      const result = await response.json();
      
      if (result.ok) {
        const member_status = result.result.status;
        const is_subscribed = ['member', 'administrator', 'creator'].includes(member_status);
        
        console.log(`User ${telegram_user_id} subscription status: ${member_status}, subscribed: ${is_subscribed}`);
        
        return res.json({ 
          verified: is_subscribed,
          status: member_status,
          message: is_subscribed ? 'Subscription verified successfully' : 'User is not subscribed to the channel'
        });
      } else {
        console.error('Telegram API error:', result);
        
        // Если пользователь не найден в чате, значит не подписан
        if (result.error_code === 400 && result.description.includes('user not found')) {
          return res.json({
            verified: false,
            message: 'User is not subscribed to the channel',
            status: 'not_member'
          });
        }
        
        // Другие ошибки API
        return res.status(500).json({ 
          error: 'Failed to check subscription via Telegram API',
          verified: false,
          telegram_error: result.description
        });
      }
    } catch (apiError) {
      console.error('Error calling Telegram API:', apiError);
      return res.status(500).json({ 
        error: 'Failed to verify subscription',
        verified: false,
        details: apiError.message
      });
    }
  } catch (error) {
    console.error('Error verifying subscription:', error);
    res.status(500).json({ 
      error: 'Internal server error during subscription verification',
      verified: false
    });
  }
});

// Check subscription status
app.get('/api/subscription/status/:telegram_user_id', async (req, res) => {
  try {
    const { telegram_user_id } = req.params;
    
    console.log(`Checking subscription status for user ${telegram_user_id}`);
    
    // Проверяем режим разработки
    if (process.env.DEVELOPMENT_MODE === 'true') {
      console.log('Development mode: returning subscribed status');
      return res.json({ 
        subscribed: true,
        message: 'Development mode: user is considered subscribed',
        development: true
      });
    }
    
    // Реальная проверка через Telegram Bot API
    const telegram_bot_token = process.env.TELEGRAM_BOT_TOKEN;
    const telegram_channel_id = process.env.TELEGRAM_CHANNEL_ID;
    
    if (!telegram_bot_token || !telegram_channel_id) {
      console.log('Bot not configured, returning unsubscribed status');
      return res.json({ 
        subscribed: false,
        message: 'Please verify your subscription' 
      });
    }
    
    try {
      const response = await fetch(`https://api.telegram.org/bot${telegram_bot_token}/getChatMember`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegram_channel_id,
          user_id: telegram_user_id
        })
      });
      
      const result = await response.json();
      
      if (result.ok) {
        const member_status = result.result.status;
        const is_subscribed = ['member', 'administrator', 'creator'].includes(member_status);
        
        return res.json({ 
          subscribed: is_subscribed,
          status: member_status,
          message: is_subscribed ? 'User is subscribed' : 'Please verify your subscription'
        });
      } else {
        // Если ошибка, возвращаем как неподписанного
        return res.json({ 
          subscribed: false,
          message: 'Please verify your subscription' 
        });
      }
    } catch (apiError) {
      console.error('Error checking subscription via API:', apiError);
      return res.json({ 
        subscribed: false,
        message: 'Please verify your subscription' 
      });
    }
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

// Serve static files AFTER API routes
app.use(express.static(path.join(__dirname, 'client/build')));

// Serve React app for all NON-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
  console.log(`Static files served from: ${path.join(__dirname, 'client/build')}`);
});