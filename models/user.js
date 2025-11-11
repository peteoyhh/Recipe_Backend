// models/user.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true  // 允许多个 null 值存在，但非 null 值必须唯一
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }],
  createdRecipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 自动生成用户 id 中间件
UserSchema.pre('save', async function(next) {
  // 只在新用户且没有 id 时生成
  if (this.isNew && !this.id) {
    try {
      // 查找最后一个用户的 id
      const lastUser = await this.constructor.findOne({ id: { $exists: true, $ne: null } }).sort({ id: -1 });
      
      if (lastUser && lastUser.id) {
        // 从 "u001" 中提取数字部分
        const match = lastUser.id.match(/^u(\d+)$/);
        if (match) {
          const nextNum = parseInt(match[1]) + 1;
          this.id = `u${String(nextNum).padStart(3, '0')}`;
        } else {
          this.id = 'u001';  // 如果格式不匹配，从 u001 开始
        }
      } else {
        this.id = 'u001';  // 如果没有找到用户，从 u001 开始
      }
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// 密码加密中间件
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 验证密码方法
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// 转换为 JSON 时移除敏感信息
UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
