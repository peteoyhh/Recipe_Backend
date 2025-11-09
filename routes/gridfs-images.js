// routes/gridfs-images.js
// 使用 MongoDB GridFS 存储和访问图片

const mongoose = require('mongoose');
const multer = require('multer');

let bucket;

// 初始化 GridFS bucket
mongoose.connection.once('open', () => {
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'recipeImages'
  });
  console.log('✅ GridFS bucket initialized for recipe images');
});

// 配置 multer 内存存储
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允许图片格式 (jpg, jpeg, png, webp)'), false);
    }
  }
});

module.exports = function (router) {
  
  // GET /api/gridfs-images/:filename - 从 MongoDB 获取图片
  router.route('/gridfs-images/:filename')
    .get(async (req, res) => {
      try {
        if (!bucket) {
          return res.status(500).json({ 
            message: 'GridFS not initialized',
            error: 'Database connection not ready' 
          });
        }

        const filename = req.params.filename;
        
        // 查找文件
        const files = await bucket.find({ filename: filename }).toArray();
        
        if (!files || files.length === 0) {
          // 如果没有扩展名，尝试加 .jpg
          const filenameWithExt = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
          const filesWithExt = await bucket.find({ filename: filenameWithExt }).toArray();
          
          if (!filesWithExt || filesWithExt.length === 0) {
            return res.status(404).json({ 
              message: 'Image not found',
              filename: filename
            });
          }
          
          // 找到文件，返回图片
          const file = filesWithExt[0];
          res.set('Content-Type', file.contentType || 'image/jpeg');
          res.set('Cache-Control', 'public, max-age=31536000');
          
          const downloadStream = bucket.openDownloadStream(file._id);
          downloadStream.pipe(res);
          return;
        }
        
        // 找到文件，返回图片
        const file = files[0];
        res.set('Content-Type', file.contentType || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=31536000');
        
        const downloadStream = bucket.openDownloadStream(file._id);
        downloadStream.pipe(res);
        
      } catch (err) {
        return res.status(500).json({ 
          message: 'Error retrieving image',
          error: err.message 
        });
      }
    });

  // POST /api/gridfs-images/upload - 上传图片到 MongoDB
  router.route('/gridfs-images/upload')
    .post(upload.single('image'), async (req, res) => {
      try {
        if (!bucket) {
          return res.status(500).json({ 
            message: 'GridFS not initialized',
            error: 'Database connection not ready' 
          });
        }

        if (!req.file) {
          return res.status(400).json({ 
            message: '没有上传文件',
            error: 'No file uploaded' 
          });
        }

        const filename = req.file.originalname;
        
        // 检查文件是否已存在
        const existingFiles = await bucket.find({ filename: filename }).toArray();
        if (existingFiles && existingFiles.length > 0) {
          // 删除旧文件
          await bucket.delete(existingFiles[0]._id);
        }

        // 创建上传流
        const uploadStream = bucket.openUploadStream(filename, {
          contentType: req.file.mimetype,
          metadata: {
            uploadDate: new Date(),
            size: req.file.size
          }
        });

        // 写入文件数据
        uploadStream.end(req.file.buffer);

        uploadStream.on('finish', () => {
          const imageUrl = `/api/gridfs-images/${filename.replace('.jpg', '')}`;
          return res.status(200).json({
            message: '上传成功',
            filename: filename,
            imageUrl: imageUrl,
            fullUrl: `${req.protocol}://${req.get('host')}${imageUrl}`,
            fileId: uploadStream.id,
            size: req.file.size
          });
        });

        uploadStream.on('error', (err) => {
          return res.status(500).json({ 
            message: '上传失败',
            error: err.message 
          });
        });

      } catch (err) {
        return res.status(500).json({ 
          message: '上传失败',
          error: err.message 
        });
      }
    });

  // POST /api/gridfs-images/batch-upload - 批量上传
  router.route('/gridfs-images/batch-upload')
    .post(upload.array('images', 100), async (req, res) => {
      try {
        if (!bucket) {
          return res.status(500).json({ 
            message: 'GridFS not initialized',
            error: 'Database connection not ready' 
          });
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ 
            message: '没有上传文件',
            error: 'No files uploaded' 
          });
        }

        const uploadPromises = req.files.map(file => {
          return new Promise((resolve, reject) => {
            const uploadStream = bucket.openUploadStream(file.originalname, {
              contentType: file.mimetype,
              metadata: {
                uploadDate: new Date(),
                size: file.size
              }
            });

            uploadStream.end(file.buffer);

            uploadStream.on('finish', () => {
              resolve({
                filename: file.originalname,
                imageUrl: `/api/gridfs-images/${file.originalname.replace('.jpg', '')}`,
                fileId: uploadStream.id,
                size: file.size
              });
            });

            uploadStream.on('error', (err) => {
              reject(err);
            });
          });
        });

        const results = await Promise.all(uploadPromises);

        return res.status(200).json({
          message: '批量上传成功',
          count: results.length,
          files: results
        });

      } catch (err) {
        return res.status(500).json({ 
          message: '批量上传失败',
          error: err.message 
        });
      }
    });

  // GET /api/gridfs-images - 列出所有图片
  router.route('/gridfs-images')
    .get(async (req, res) => {
      try {
        if (!bucket) {
          return res.status(500).json({ 
            message: 'GridFS not initialized',
            error: 'Database connection not ready' 
          });
        }

        const limit = parseInt(req.query.limit) || 100;
        const files = await bucket.find().limit(limit).toArray();
        
        const fileList = files.map(file => ({
          filename: file.filename,
          size: file.length,
          uploadDate: file.uploadDate,
          contentType: file.contentType,
          imageUrl: `/api/gridfs-images/${file.filename.replace('.jpg', '')}`
        }));

        return res.status(200).json({
          message: 'OK',
          count: files.length,
          files: fileList
        });

      } catch (err) {
        return res.status(500).json({ 
          message: 'Error listing images',
          error: err.message 
        });
      }
    });

  return router;
};

