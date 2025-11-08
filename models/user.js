// models/user.js
const mongoose = require('mongoose');

// Sub-schema for favorites array
const FavoriteSchema = new mongoose.Schema({
  recipe_id: { type: Number, required: true },
  title: { type: String, required: true },
  saved_at: { type: Date, required: true }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  favorites: { type: [FavoriteSchema], default: [] },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  strict: false  // Allow additional fields if JSON has extra data
});

module.exports = mongoose.model('User', UserSchema);