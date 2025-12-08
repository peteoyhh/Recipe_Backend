// models/recipe.js
const mongoose = require('mongoose');

const RecipeSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  ingredients: { type: [String], default: [] },
  instructions: { type: String },
  imageName: { type: String },
  extractedIngredients: { type: [String], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isUserCreated: { type: Boolean, default: false }
}, {
  strict: false
});

module.exports = mongoose.model('Recipe', RecipeSchema);
