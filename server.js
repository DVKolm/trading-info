require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import configuration and middleware
const logger = require('./server/config/logger');
const db = require('./server/config/database');
const { logRequests } = require('./server/middleware/logging');

// Import routes
const lessonsRouter = require('./server/routes/lessons');
const subscriptionRouter = require('./server/routes/subscription');
const uploadRouter = require('./server/routes/upload');
const imageRouter = require('./server/routes/image');

const app = express();
const PORT = process.env.PORT || 3001;

// Production environment check
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(logRequests);

// Log server startup
logger.info('Starting Trading Info Server', {
  port: PORT,
  nodeEnv: process.env.NODE_ENV,
  isProduction
});

// API Routes
app.use('/api/lessons', lessonsRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/image', imageRouter);

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

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: isProduction ? 'Something went wrong' : error.message
  });
});

// Initialize database connection and start server
async function startServer() {
  let databaseStatus = 'Disabled';
  
  try {
    // Try to initialize database connection
    logger.info('🔧 Initializing database connection...');
    await db.initialize();
    logger.info('✅ Database connection established');
    databaseStatus = 'Connected';
  } catch (error) {
    logger.warn('⚠️ Database connection failed, continuing with file-based operation:', error.message);
    databaseStatus = 'File-based fallback';
  }

  // Start the server regardless of database status
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
    console.log(`Static files served from: ${path.join(__dirname, 'client/build')}`);
    console.log(`Database status: ${databaseStatus}`);
    
    logger.info('🚀 Server started successfully', {
      port: PORT,
      environment: isProduction ? 'Production' : 'Development',
      database: databaseStatus
    });
  });
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully');
  await db.close();
  process.exit(0);
});

// Start the server
startServer();