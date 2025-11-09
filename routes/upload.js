// routes/upload.js
// 图片上传 API - 带简单认证

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置文件存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/images');
    
    // 确保目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 保持原始文件名
    cb(null, file.originalname);
  }
});

// 文件过滤 - 只允许图片
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件 (jpg, jpeg, png, webp)'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 限制
  }
});

module.exports = function (router) {
  
  // 简单的认证中间件
  const simpleAuth = (req, res, next) => {
    const authToken = req.headers['authorization'];
    const validToken = process.env.UPLOAD_TOKEN || 'recipe-upload-secret-2024';
    
    if (!authToken || authToken !== `Bearer ${validToken}`) {
      return res.status(401).json({ 
        message: '未授权访问',
        error: 'Invalid or missing authorization token' 
      });
    }
    
    next();
  };
  
  // POST /api/upload/image - 上传单张图片
  router.route('/upload/image')
    .post(simpleAuth, upload.single('image'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ 
            message: '没有上传文件',
            error: 'No file uploaded' 
          });
        }
        
        // 返回图片访问 URL
        const imageUrl = `/api/images/${path.parse(req.file.filename).name}`;
        
        return res.status(200).json({
          message: '上传成功',
          filename: req.file.filename,
          imageUrl: imageUrl,
          fullUrl: `${req.protocol}://${req.get('host')}${imageUrl}`,
          size: req.file.size
        });
      } catch (err) {
        return res.status(500).json({ 
          message: '上传失败',
          error: err.message 
        });
      }
    });
  
  // POST /api/upload/images - 批量上传图片
  router.route('/upload/images')
    .post(simpleAuth, upload.array('images', 100), async (req, res) => {
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ 
            message: '没有上传文件',
            error: 'No files uploaded' 
          });
        }
        
        const uploadedFiles = req.files.map(file => ({
          filename: file.filename,
          imageUrl: `/api/images/${path.parse(file.filename).name}`,
          fullUrl: `${req.protocol}://${req.get('host')}/api/images/${path.parse(file.filename).name}`,
          size: file.size
        }));
        
        return res.status(200).json({
          message: '批量上传成功',
          count: req.files.length,
          files: uploadedFiles
        });
      } catch (err) {
        return res.status(500).json({ 
          message: '上传失败',
          error: err.message 
        });
      }
    });
  
  // GET /api/upload/status - 检查上传状态
  router.route('/upload/status')
    .get(simpleAuth, async (req, res) => {
      try {
        const uploadDir = path.join(__dirname, '../uploads/images');
        
        if (!fs.existsSync(uploadDir)) {
          return res.status(200).json({
            message: 'OK',
            imagesCount: 0,
            storageUsed: '0 MB'
          });
        }
        
        const files = fs.readdirSync(uploadDir);
        const imageFiles = files.filter(f => 
          f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp')
        );
        
        // 计算总大小
        let totalSize = 0;
        imageFiles.forEach(file => {
          const stats = fs.statSync(path.join(uploadDir, file));
          totalSize += stats.size;
        });
        
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        
        return res.status(200).json({
          message: 'OK',
          imagesCount: imageFiles.length,
          storageUsed: `${sizeMB} MB`,
          uploadDir: uploadDir
        });
      } catch (err) {
        return res.status(500).json({ 
          message: '获取状态失败',
          error: err.message 
        });
      }
    });

  return router;
};

