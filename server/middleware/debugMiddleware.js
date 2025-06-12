// middleware/debugMiddleware.js
/**
 * Enhanced debug middleware for LTI requests
 */
const debugMiddleware = (req, res, next) => {
  // Log basic request info
  // console.log(`\n====== ${new Date().toISOString()} ======`);
  // console.log(`${req.method} ${req.url}`);
  
  // Log headers (useful for LTI)
  // console.log('Headers:');
  const headers = { ...req.headers };
  
  // Mask sensitive headers
  if (headers.authorization) {
    headers.authorization = '[MASKED]';
  }
  if (headers.cookie) {
    headers.cookie = '[MASKED]';
  }
  
  // console.log(JSON.stringify(headers, null, 2));
  
  // Log query parameters
  if (Object.keys(req.query).length > 0) {
    console.log('Query parameters:');
    console.log(JSON.stringify(req.query, null, 2));
  }
  
  // For POST requests, log the body (except for sensitive fields)
  if (req.method === 'POST' && req.body) {
    console.log('Body:');
    const body = { ...req.body };
    
    // Mask sensitive fields
    if (body.id_token) {
      body.id_token = '[JWT TOKEN - MASKED]';
    }
    if (body.password) {
      body.password = '[MASKED]';
    }
    
    console.log(JSON.stringify(body, null, 2));
  }
  
  // Log session info if available
  if (req.session) {
    console.log('Session ID:', req.sessionID);
    
    // Don't log the entire session for security
    const sessionKeys = Object.keys(req.session);
    if (sessionKeys.length > 0) {
      console.log('Session contains keys:', sessionKeys);
    }
  }
  
  console.log('==============================\n');
  
  // Add response logging
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`Response ${res.statusCode}:`, 
      typeof body === 'string' && body.length > 500 
        ? body.substring(0, 500) + '... [truncated]' 
        : body);
    return originalSend.apply(this, arguments);
  };
  
  next();
};

module.exports = debugMiddleware;