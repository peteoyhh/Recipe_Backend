// scripts/upload-images.js
// 批量上传图片到后端服务器的脚本

const fs = require('fs');
const path = require('path');

/**
 * 本地上传脚本 - 将图片复制到 uploads/images 目录
 * 
 * 使用方法:
 * 1. 确保 Food Images 文件夹在正确位置
 * 2. 运行: node scripts/upload-images.js
 */

const SOURCE_DIR = path.join(__dirname, '../../testing/Final/public/Food Images');
const TARGET_DIR = path.join(__dirname, '../uploads/images');

function uploadImages() {
  console.log('📸 开始上传图片...\n');
  
  // 检查源目录
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('❌ 源目录不存在:', SOURCE_DIR);
    console.log('   请确保 Food Images 文件夹在正确位置');
    process.exit(1);
  }
  
  // 创建目标目录
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    console.log('✅ 创建目标目录:', TARGET_DIR);
  }
  
  // 读取所有图片
  const files = fs.readdirSync(SOURCE_DIR);
  const imageFiles = files.filter(f => 
    f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')
  );
  
  console.log(`📊 找到 ${imageFiles.length} 张图片\n`);
  
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  
  // 复制每张图片
  imageFiles.forEach((file, index) => {
    const sourcePath = path.join(SOURCE_DIR, file);
    const targetPath = path.join(TARGET_DIR, file);
    
    try {
      // 检查目标文件是否已存在
      if (fs.existsSync(targetPath)) {
        skipped++;
        if (index % 100 === 0) {
          console.log(`⏭️  跳过已存在的图片 (${index + 1}/${imageFiles.length})`);
        }
      } else {
        fs.copyFileSync(sourcePath, targetPath);
        copied++;
        if (index % 100 === 0) {
          console.log(`✅ 已复制 ${index + 1}/${imageFiles.length} 张图片`);
        }
      }
    } catch (err) {
      failed++;
      console.error(`❌ 复制失败: ${file}`, err.message);
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 上传完成统计:');
  console.log(`   ✅ 新复制: ${copied} 张`);
  console.log(`   ⏭️  跳过: ${skipped} 张`);
  console.log(`   ❌ 失败: ${failed} 张`);
  console.log(`   📁 总计: ${imageFiles.length} 张`);
  console.log('='.repeat(50) + '\n');
  
  console.log('✨ 完成！图片已准备就绪，可以通过 API 访问');
  console.log(`   本地测试: http://localhost:3000/api/images/[imageName]`);
  console.log(`   生产环境: https://recipebackend-production-dc03.up.railway.app/api/images/[imageName]`);
}

// 运行上传
uploadImages();

