// models/user.js
const mongoose = require('mongoose');

// Sub-schema for favorites array
const FavoriteSchema = new mongoose.Schema({
  recipe_id: { type: String, required: true }, // MongoDB ObjectId as string
  title: { type: String, required: true },
  saved_at: { type: Date, required: true }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  favorites: { type: [FavoriteSchema], default: [] }
}, {
  strict: false,  // Allow additional fields if JSON has extra data
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }  // Auto-manage timestamps
});

module.exports = mongoose.model('User', UserSchema);