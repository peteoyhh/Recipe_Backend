// scripts/upload-to-mongodb.js
// 将本地图片上传到 MongoDB GridFS

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// 配置
const API_URL = process.env.API_URL || 'http://localhost:3000';
const IMAGES_DIR = path.join(__dirname, '../uploads/images');
const BATCH_SIZE = 5; // 每批上传5张
const DELAY_MS = 1000; // 每批延迟1秒

/**
 * 批量上传图片到 MongoDB GridFS
 */
async function uploadBatch(files) {
  const form = new FormData();
  
  files.forEach(file => {
    form.append('images', fs.createReadStream(file.path), file.name);
  });
  
  try {
    const response = await axios.post(`${API_URL}/api/gridfs-images/batch-upload`, form, {
      headers: form.getHeaders(),
      timeout: 120000, // 120秒超时
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    return { success: true, data: response.data };
  } catch (err) {
    return { 
      success: false, 
      error: err.response?.data?.message || err.message 
    };
  }
}

/**
 * 检查服务器状态
 */
async function checkStatus() {
  try {
    const response = await axios.get(`${API_URL}/api/gridfs-images?limit=1`);
    return { success: true, data: response.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 主上传流程
 */
async function main() {
  console.log('📸 开始上传图片到 MongoDB GridFS...\n');
  console.log(`🌐 服务器: ${API_URL}`);
  console.log(`📁 图片目录: ${IMAGES_DIR}\n`);
  
  // 检查图片目录
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error('❌ 图片目录不存在:', IMAGES_DIR);
    console.log('   请先运行: node scripts/upload-images.js');
    process.exit(1);
  }
  
  // 检查服务器连接
  console.log('🔍 检查服务器状态...');
  const status = await checkStatus();
  if (status.success) {
    console.log(`✅ 服务器在线`);
    console.log(`   MongoDB GridFS 已连接\n`);
  } else {
    console.error('❌ 无法连接到服务器:', status.error);
    console.log('   请确保后端服务器正在运行：npm start');
    process.exit(1);
  }
  
  // 读取所有图片
  const files = fs.readdirSync(IMAGES_DIR);
  const imageFiles = files.filter(f => 
    f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')
  );
  
  console.log(`📊 找到 ${imageFiles.length} 张图片需要上传\n`);
  
  if (imageFiles.length === 0) {
    console.log('✅ 没有图片需要上传');
    return;
  }
  
  // 确认上传
  console.log('⚠️  即将开始上传到 MongoDB...');
  console.log(`   批次大小: ${BATCH_SIZE} 张/批`);
  console.log(`   批次间隔: ${DELAY_MS}ms`);
  console.log(`   预计批次: ${Math.ceil(imageFiles.length / BATCH_SIZE)} 批\n`);
  
  // 批量上传
  let uploaded = 0;
  let failed = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(imageFiles.length / BATCH_SIZE);
    const batch = imageFiles.slice(i, i + BATCH_SIZE);
    
    console.log(`📤 批次 ${batchNum}/${totalBatches} (${batch.length} 张)...`);
    
    const batchFiles = batch.map(name => ({
      name: name,
      path: path.join(IMAGES_DIR, name)
    }));
    
    const result = await uploadBatch(batchFiles);
    
    if (result.success) {
      uploaded += batch.length;
      console.log(`   ✅ 成功 ${batch.length} 张`);
      
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = uploaded / elapsed;
      const remaining = imageFiles.length - uploaded;
      const eta = Math.ceil(remaining / rate / 60);
      
      console.log(`   进度: ${uploaded}/${imageFiles.length} (${((uploaded / imageFiles.length) * 100).toFixed(1)}%) 预计剩余: ${eta}分钟\n`);
    } else {
      failed += batch.length;
      console.error(`   ❌ 失败: ${result.error}\n`);
    }
    
    // 批次间延迟
    if (i + BATCH_SIZE < imageFiles.length) {
      await delay(DELAY_MS);
    }
  }
  
  // 最终统计
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 上传完成:');
  console.log(`   ✅ 成功: ${uploaded} 张`);
  console.log(`   ❌ 失败: ${failed} 张`);
  console.log(`   ⏱️  用时: ${totalTime} 分钟`);
  console.log('='.repeat(60) + '\n');
  
  console.log('✨ 完成！所有图片现在存储在 MongoDB GridFS 中');
}

// 运行
main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});

