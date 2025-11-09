// middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 认证中间件 - 验证 JWT token
function authenticate(req, res, next) {
  try {
    // 从 header 中获取 token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'No token provided',
        success: false
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // 验证 token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 将用户信息添加到请求对象
    req.user = {
      userId: decoded.userId,
      username: decoded.username
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

// 可选认证中间件 - token 可以不存在
function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        userId: decoded.userId,
        username: decoded.username
      };
    }
    
    next();
  } catch (error) {
    // 忽略错误，继续执行
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuthenticate
};

