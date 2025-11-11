// scripts/fix-user-ids.js
// 修复数据库中 id = null 的用户，为他们生成唯一的 id

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');

async function fixUserIds() {
  try {
    // 连接数据库
    console.log('正在连接数据库...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('数据库连接成功！\n');

    // 查找所有没有 id 或 id 为 null 的用户
    const usersWithoutId = await User.find({
      $or: [
        { id: null },
        { id: { $exists: false } }
      ]
    }).sort({ createdAt: 1 });  // 按创建时间排序

    console.log(`找到 ${usersWithoutId.length} 个需要修复的用户\n`);

    if (usersWithoutId.length === 0) {
      console.log('没有需要修复的用户！');
      await mongoose.disconnect();
      return;
    }

    // 查找当前最大的 id 号码
    const lastUserWithId = await User.findOne({ 
      id: { $exists: true, $ne: null } 
    }).sort({ id: -1 });

    let nextNum = 1;
    if (lastUserWithId && lastUserWithId.id) {
      const match = lastUserWithId.id.match(/^u(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    console.log(`开始从 u${String(nextNum).padStart(3, '0')} 分配 id...\n`);

    // 为每个用户生成唯一的 id
    let successCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutId) {
      try {
        const newId = `u${String(nextNum).padStart(3, '0')}`;
        
        // 直接更新数据库，绕过密码加密中间件
        await User.updateOne(
          { _id: user._id },
          { $set: { id: newId } }
        );

        console.log(`✓ 用户 ${user.username} (${user.email}) 已分配 id: ${newId}`);
        nextNum++;
        successCount++;
      } catch (error) {
        console.error(`✗ 修复用户 ${user.username} 失败:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n修复完成！`);
    console.log(`成功: ${successCount} 个用户`);
    console.log(`失败: ${errorCount} 个用户`);

    // 断开数据库连接
    await mongoose.disconnect();
    console.log('\n数据库连接已关闭');

  } catch (error) {
    console.error('发生错误:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// 运行脚本
fixUserIds();

