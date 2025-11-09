// routes/images.js
const path = require('path');
const fs = require('fs');

module.exports = function (router) {
  
  // GET image by name
  router.route('/images/:imageName')
    .get(async (req, res) => {
      try {
        const imageName = req.params.imageName;
        
        // 支持带扩展名或不带扩展名
        const imageNameWithExt = imageName.endsWith('.jpg') ? imageName : `${imageName}.jpg`;
        
        // 图片存储路径（可以是本地或挂载的云存储）
        const imagePath = path.join(__dirname, '../uploads/images', imageNameWithExt);
        
        // 检查文件是否存在
        if (fs.existsSync(imagePath)) {
          // 设置正确的 Content-Type
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存1年
          
          // 发送文件
          return res.sendFile(imagePath);
        } else {
          // 图片不存在，返回404或默认占位图
          return res.status(404).json({ 
            message: 'Image not found',
            imageName: imageNameWithExt 
          });
        }
      } catch (err) {
        return res.status(500).json({ 
          message: 'Error serving image',
          error: err.message 
        });
      }
    });

  // GET all available images (可选的管理接口)
  router.route('/images')
    .get(async (req, res) => {
      try {
        const imagesDir = path.join(__dirname, '../uploads/images');
        
        if (!fs.existsSync(imagesDir)) {
          return res.status(200).json({ 
            message: 'Images directory not found',
            count: 0,
            images: [] 
          });
        }
        
        const files = fs.readdirSync(imagesDir);
        const imageFiles = files.filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'));
        
        return res.status(200).json({ 
          message: 'OK',
          count: imageFiles.length,
          images: imageFiles.slice(0, 100) // 只返回前100个，避免响应过大
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

