// routes/recipes.js
const mongoose = require('mongoose');
const Recipe = require('../models/recipe');
const { buildQuery } = require('./utils');

module.exports = function (router) {

  router.route('/recipes')
    // GET all recipes or count
    .get(async (req, res) => {
      try {
        if (req.query.count === 'true') {
          const count = await buildQuery(Recipe, req).countDocuments();
          return res.status(200).json({ message: 'OK', data: count });
        }

        const result = await buildQuery(Recipe, req).exec();
        const data = Array.isArray(result) ? result : [result];
        return res.status(200).json({ message: 'OK', data });
      } catch (err) {
        return res.status(400).json({ message: err.message, data: [] });
      }
    })

    // POST create new recipe
    .post(async (req, res) => {
      try {
        const { id, title, ingredients, instructions, imageName, extractedIngredients } = req.body;
        if (!title)
          return res.status(400).json({ message: 'Title is required', data: [] });

        // Check if id is provided, if not generate one
        let recipeId = id;
        if (recipeId === undefined || recipeId === null) {
          // Generate a numeric ID if not provided (0, 1, 2...)
          const lastRecipe = await Recipe.findOne().sort({ id: -1 });
          if (lastRecipe && lastRecipe.id !== undefined) {
            recipeId = lastRecipe.id + 1;
          } else {
            recipeId = 0;
          }
        }

        // Check for duplicate id
        const existingId = await Recipe.findOne({ id: recipeId });
        if (existingId)
          return res.status(400).json({ message: 'Recipe ID already exists', data: [] });

        // Validate arrays
        const validIngredients = Array.isArray(ingredients) ? ingredients : [];
        const validExtractedIngredients = Array.isArray(extractedIngredients) ? extractedIngredients : [];

        const newRecipe = new Recipe({
          id: recipeId,
          title,
          ingredients: validIngredients,
          instructions: instructions || '',
          imageName: imageName || '',
          extractedIngredients: validExtractedIngredients
        });

        const savedRecipe = await newRecipe.save();
        return res.status(201).json({ message: 'Recipe created', data: savedRecipe });
      } catch (err) {
        return res.status(500).json({ message: 'Server error creating recipe', data: err.message });
      }
    });

  // GET / PUT / DELETE by id (MongoDB _id)
  router.route('/recipes/:id')
    .get(async (req, res) => {
      const id = req.params.id.trim();
      try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({ message: 'Invalid recipe ID format', data: [] });
        }

        const select = req.query.select ? JSON.parse(req.query.select) : null;
        const recipe = await Recipe.findById(id, select || undefined).lean();
    
        if (!recipe)
          return res.status(404).json({ message: 'Recipe not found', data: [] });
    
        // enforce field order for response
        const orderedRecipe = {
          _id: recipe._id,
          id: recipe.id,
          title: recipe.title,
          ingredients: recipe.ingredients || [],
          instructions: recipe.instructions || '',
          imageName: recipe.imageName || '',
          extractedIngredients: recipe.extractedIngredients || []
        };
    
        return res.status(200).json({ message: 'OK', data: orderedRecipe });
      } catch (err) {
        return res.status(400).json({ message: 'Invalid request', data: [] });
      }
    })

    .put(async (req, res) => {
      const id = req.params.id.trim();
      try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({ message: 'Invalid recipe ID format', data: [] });
        }

        const { id: recipeId, title, ingredients, instructions, imageName, extractedIngredients } = req.body;
        if (!title)
          return res.status(400).json({ message: 'Title is required', data: [] });

        const recipe = await Recipe.findById(id);
        if (!recipe)
          return res.status(404).json({ message: 'Recipe not found', data: [] });

        // Check for id conflict if id is being changed
        if (recipeId !== undefined && recipeId !== recipe.id) {
          const conflict = await Recipe.findOne({ id: recipeId, _id: { $ne: recipe._id } });
          if (conflict)
            return res.status(400).json({ message: 'Recipe ID already exists', data: [] });
          recipe.id = recipeId;
        }

        // Update fields
        recipe.title = title;
        recipe.instructions = instructions !== undefined ? instructions : recipe.instructions;
        recipe.imageName = imageName !== undefined ? imageName : recipe.imageName;

        // Update arrays if provided
        if (ingredients !== undefined) {
          recipe.ingredients = Array.isArray(ingredients) ? ingredients : [];
        }
        if (extractedIngredients !== undefined) {
          recipe.extractedIngredients = Array.isArray(extractedIngredients) ? extractedIngredients : [];
        }

        const savedRecipe = await recipe.save();
        return res.status(200).json({ message: 'Recipe updated', data: savedRecipe });
      } catch (err) {
        return res.status(500).json({ message: 'Server error updating recipe', data: err.message });
      }
    })

    .delete(async (req, res) => {
      const id = req.params.id.trim();
      try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({ message: 'Invalid recipe ID format', data: [] });
        }

        const recipe = await Recipe.findById(id);
        if (!recipe)
          return res.status(404).json({ message: 'Recipe not found', data: [] });

        await recipe.deleteOne();
        return res.status(200).json({ message: 'Recipe deleted', data: [] });
      } catch (err) {
        return res.status(500).json({ message: 'Server error deleting recipe', data: err.message });
      }
    });

  return router;
};
