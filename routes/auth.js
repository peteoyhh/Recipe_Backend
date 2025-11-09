// routes/auth.js
const User = require('../models/user');
const jwt = require('jsonwebtoken');

// JWT Secret - 在生产环境中应该使用环境变量
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token 有效期 7 天

module.exports = function (router) {

  // POST /api/auth/register - 用户注册
  router.route('/auth/register')
    .post(async (req, res) => {
      try {
        const { username, email, password } = req.body;

        // 验证输入
        if (!username || !email || !password) {
          return res.status(400).json({ 
            message: 'Please provide username, email and password',
            success: false
          });
        }

        // 检查用户是否已存在
        const existingUser = await User.findOne({ 
          $or: [{ email }, { username }] 
        });

        if (existingUser) {
          return res.status(400).json({ 
            message: existingUser.email === email 
              ? 'Email already registered' 
              : 'Username already taken',
            success: false
          });
        }

        // 创建新用户
        const user = new User({
          username,
          email,
          password
        });

        await user.save();

        // 生成 JWT token
        const token = jwt.sign(
          { userId: user._id, username: user.username },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(201).json({
          message: 'User registered successfully',
          success: true,
          data: {
            user: {
              _id: user._id,
              username: user.username,
              email: user.email
            },
            token
          }
        });

      } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
          message: 'Server error during registration',
          success: false,
          error: error.message 
        });
      }
    });

  // POST /api/auth/login - 用户登录
  router.route('/auth/login')
    .post(async (req, res) => {
      try {
        const { email, password } = req.body;

        // 验证输入
        if (!email || !password) {
          return res.status(400).json({ 
            message: 'Please provide email and password',
            success: false
          });
        }

        // 查找用户
        const user = await User.findOne({ email });

        if (!user) {
          return res.status(401).json({ 
            message: 'Invalid email or password',
            success: false
          });
        }

        // 验证密码
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
          return res.status(401).json({ 
            message: 'Invalid email or password',
            success: false
          });
        }

        // 生成 JWT token
        const token = jwt.sign(
          { userId: user._id, username: user.username },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
          message: 'Login successful',
          success: true,
          data: {
            user: {
              _id: user._id,
              username: user.username,
              email: user.email,
              favorites: user.favorites,
              createdRecipes: user.createdRecipes
            },
            token
          }
        });

      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
          message: 'Server error during login',
          success: false,
          error: error.message 
        });
      }
    });

  // GET /api/auth/me - 获取当前用户信息（需要认证）
  router.route('/auth/me')
    .get(async (req, res) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return res.status(401).json({ 
            message: 'No token provided',
            success: false
          });
        }

        // 验证 token
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId)
          .select('-password')
          .populate('favorites', 'id title imageName')
          .populate('createdRecipes', 'id title imageName');

        if (!user) {
          return res.status(404).json({ 
            message: 'User not found',
            success: false
          });
        }

        res.json({
          message: 'User fetched successfully',
          success: true,
          data: user
        });

      } catch (error) {
        console.error('Auth verification error:', error);
        res.status(401).json({ 
          message: 'Invalid or expired token',
          success: false,
          error: error.message 
        });
      }
    });

  return router;
};

