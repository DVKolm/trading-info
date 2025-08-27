require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');

const app = express();
const PORT = process.env.PORT || 3001;

// Production environment check
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

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
      console.log('File not found:', filePath);
      res.status(404).json({ error: 'File not found', path: filePath });
    }
  } catch (error) {
    console.error('Error serving lesson image:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Simple GET route for images using base64 encoded paths
app.get('/api/image/:encodedPath', async (req, res) => {
  try {
    const decodedPath = Buffer.from(req.params.encodedPath, 'base64').toString('utf8');
    const filePath = path.join(__dirname, 'lessons', decodedPath);
    
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
      console.log('File not found:', filePath);
      res.status(404).json({ error: 'File not found', path: filePath });
    }
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Server error' });
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
    
    // Sort items: folders first, then files, both alphabetically
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
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
    // Ensure lessons directory exists
    await fs.ensureDir(LESSONS_DIR);
    
    // Build lesson mapping for internal links
    lessonMap.clear();
    await buildLessonMap(LESSONS_DIR);
    
    const structure = await scanLessonsDirectory(LESSONS_DIR);
    res.json({ structure });
  } catch (error) {
    console.error('Error getting lessons structure:', error);
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


// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
  console.log(`Static files served from: ${path.join(__dirname, 'client/build')}`);
});