// middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authenticate: verify JWT and attach user info
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'No token provided',
        success: false
      });
    }

    const token = authHeader.replace('Bearer ', '');

    const decoded = jwt.verify(token, JWT_SECRET);
    
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role || 'user'
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        success: false
      });
    }
    
    return res.status(401).json({ 
      message: 'Invalid token',
      success: false,
      error: error.message
    });
  }
}

// Optional authenticate: token may be absent
function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role || 'user'
      };
    }
    
    next();
  } catch (error) {
    // 忽略错误，继续执行
    next();
  }
}

// Authorize: ensure role is allowed
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Forbidden',
        success: false
      });
    }
    next();
  };
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize
};

