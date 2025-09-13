const logger = require('../config/logger');

/**
 * Middleware to log HTTP requests
 */
const logRequests = (req, res, next) => {
  const start = Date.now();

  // Capture request body for POST/PUT/DELETE if exists
  let requestBody = {};
  if (req.body && Object.keys(req.body).length > 0) {
    // Filter sensitive data
    const { initData, ...safeBody } = req.body;
    requestBody = safeBody;
  }

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Determine log level based on status code
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    // Build log message based on endpoint
    let logMessage = `${req.method} ${req.url}`;

    // Add specific context for important endpoints
    if (req.url.includes('/upload/lesson')) {
      logMessage = req.method === 'POST' ? '📤 Uploading lesson' : '🗑️ Deleting lesson';
    } else if (req.url.includes('/lessons')) {
      logMessage = '📚 Fetching lessons';
    } else if (req.url.includes('/subscription')) {
      logMessage = '💳 Subscription operation';
    }

    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    };

    // Add request body for relevant methods
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && Object.keys(requestBody).length > 0) {
      logData.body = requestBody;
    }

    // Only include user agent for errors or slow requests
    if (res.statusCode >= 400 || duration > 1000) {
      logData.userAgent = req.get('User-Agent');
    }

    logger[logLevel](logMessage, logData);
  });

  next();
};

module.exports = { logRequests };