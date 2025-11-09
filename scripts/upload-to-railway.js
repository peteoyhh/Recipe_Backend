// scripts/upload-to-railway.js
// 批量上传图片到 Railway 的脚本

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 配置
const API_URL = process.env.RAILWAY_URL || 'https://recipebackend-production-dc03.up.railway.app';
const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN || 'recipe-upload-secret-2024';
const IMAGES_DIR = path.join(__dirname, '../uploads/images');
const BATCH_SIZE = 10; // 每批上传10张图片
const DELAY_MS = 1000; // 每批之间延迟1秒

/**
 * 上传单张图片
 */
async function uploadImage(filePath, filename) {
  const form = new FormData();
  form.append('image', fs.createReadStream(filePath), filename);
  
  try {
    const response = await axios.post(`${API_URL}/api/upload/image`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${UPLOAD_TOKEN}`
      },
      timeout: 30000 // 30秒超时
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
 * 批量上传图片
 */
async function uploadBatch(files) {
  const form = new FormData();
  
  files.forEach(file => {
    form.append('images', fs.createReadStream(file.path), file.name);
  });
  
  try {
    const response = await axios.post(`${API_URL}/api/upload/images`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${UPLOAD_TOKEN}`
      },
      timeout: 60000 // 60秒超时
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
 * 检查上传状态
 */
async function checkStatus() {
  try {
    const response = await axios.get(`${API_URL}/api/upload/status`, {
      headers: {
        'Authorization': `Bearer ${UPLOAD_TOKEN}`
      }
    });
    return response.data;
  } catch (err) {
    console.error('❌ 无法连接到服务器:', err.message);
    return null;
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
  console.log('📸 开始上传图片到 Railway...\n');
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
  if (status) {
    console.log(`✅ 服务器在线`);
    console.log(`   已有图片: ${status.imagesCount} 张`);
    console.log(`   存储使用: ${status.storageUsed}\n`);
  } else {
    console.error('❌ 无法连接到服务器，请检查：');
    console.log('   1. Railway 服务是否正常运行');
    console.log('   2. API_URL 是否正确');
    console.log('   3. UPLOAD_TOKEN 是否正确');
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
  console.log('⚠️  即将开始上传，这可能需要较长时间...');
  console.log(`   批次大小: ${BATCH_SIZE} 张/批`);
  console.log(`   批次间隔: ${DELAY_MS}ms`);
  console.log(`   预计批次: ${Math.ceil(imageFiles.length / BATCH_SIZE)} 批\n`);
  
  // 批量上传
  let uploaded = 0;
  let failed = 0;
  let skipped = 0;
  
  for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(imageFiles.length / BATCH_SIZE);
    const batch = imageFiles.slice(i, i + BATCH_SIZE);
    
    console.log(`📤 上传批次 ${batchNum}/${totalBatches} (${batch.length} 张图片)...`);
    
    const batchFiles = batch.map(name => ({
      name: name,
      path: path.join(IMAGES_DIR, name)
    }));
    
    const result = await uploadBatch(batchFiles);
    
    if (result.success) {
      uploaded += batch.length;
      console.log(`   ✅ 成功上传 ${batch.length} 张`);
      console.log(`   进度: ${uploaded}/${imageFiles.length} (${((uploaded / imageFiles.length) * 100).toFixed(1)}%)\n`);
    } else {
      failed += batch.length;
      console.error(`   ❌ 批次失败: ${result.error}`);
      console.log(`   尝试单独上传这些图片...\n`);
      
      // 逐个上传失败的图片
      for (const file of batchFiles) {
        const singleResult = await uploadImage(file.path, file.name);
        if (singleResult.success) {
          uploaded++;
          console.log(`      ✅ ${file.name}`);
        } else {
          failed++;
          console.error(`      ❌ ${file.name}: ${singleResult.error}`);
        }
        await delay(200); // 单个上传间隔200ms
      }
      console.log();
    }
    
    // 批次间延迟
    if (i + BATCH_SIZE < imageFiles.length) {
      await delay(DELAY_MS);
    }
  }
  
  // 最终统计
  console.log('\n' + '='.repeat(50));
  console.log('📊 上传完成统计:');
  console.log(`   ✅ 成功: ${uploaded} 张`);
  console.log(`   ❌ 失败: ${failed} 张`);
  console.log(`   📁 总计: ${imageFiles.length} 张`);
  console.log('='.repeat(50) + '\n');
  
  // 最终状态检查
  console.log('🔍 检查最终状态...');
  const finalStatus = await checkStatus();
  if (finalStatus) {
    console.log(`✅ 服务器图片总数: ${finalStatus.imagesCount} 张`);
    console.log(`   存储使用: ${finalStatus.storageUsed}`);
  }
  
  console.log('\n✨ 上传完成！');
  console.log(`   可以通过以下地址访问图片：`);
  console.log(`   ${API_URL}/api/images/[imageName]`);
}

// 运行主流程
main().catch(err => {
  console.error('❌ 上传过程出错:', err);
  process.exit(1);
});

