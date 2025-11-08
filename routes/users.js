// routes/users.js
const mongoose = require('mongoose');
const User = require('../models/user');
const Recipe = require('../models/recipe');
const { buildQuery } = require('./utils');

module.exports = function (router) {

  router.route('/users')
    // GET all users or count
    .get(async (req, res) => {
      try {
        if (req.query.count === 'true') {
          const count = await buildQuery(User, req).countDocuments();
          return res.status(200).json({ message: 'OK', data: count });
        }

        const result = await buildQuery(User, req).exec();
        const data = Array.isArray(result) ? result : [result];
        return res.status(200).json({ message: 'OK', data });
      } catch (err) {
        return res.status(400).json({ message: err.message, data: [] });
      }
    })

    // POST create new user
    .post(async (req, res) => {
      try {
        const { id, username, email, password, favorites } = req.body;
        if (!username || !email || !password)
          return res.status(400).json({ message: 'Username, email, and password are required', data: [] });

        // Check if id is provided, if not generate one
        let userId = id;
        if (!userId) {
          // Generate a simple ID if not provided (e.g., "u001", "u002")
          const lastUser = await User.findOne().sort({ id: -1 });
          if (lastUser && lastUser.id) {
            const lastNum = parseInt(lastUser.id.replace('u', '')) || 0;
            userId = `u${String(lastNum + 1).padStart(3, '0')}`;
          } else {
            userId = 'u001';
          }
        }

        // Check for duplicate id or email
        const existingId = await User.findOne({ id: userId });
        if (existingId)
          return res.status(400).json({ message: 'User ID already exists', data: [] });

        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail)
          return res.status(400).json({ message: 'Email already exists', data: [] });

        // Validate favorites structure if provided
        let validFavorites = [];
        if (Array.isArray(favorites)) {
          validFavorites = favorites.filter(fav => 
            fav && typeof fav.recipe_id === 'number' && fav.title && fav.saved_at
          );
        }

        const now = new Date();
        const newUser = new User({
          id: userId,
          username,
          email: email.toLowerCase(),
          password,
          favorites: validFavorites,
          created_at: now,
          updated_at: now
        });

        const savedUser = await newUser.save();
        return res.status(201).json({ message: 'User created', data: savedUser });
      } catch (err) {
        return res.status(500).json({ message: 'Server error creating user', data: err.message });
      }
    });

  // POST add favorite recipe (must be before /users/:id to avoid route conflict)
  router.route('/users/:id/favorites')
    .post(async (req, res) => {
      const id = req.params.id.trim();
      try {
        const { recipe_id, title } = req.body;

        // Validate recipe_id
        if (recipe_id === undefined || recipe_id === null) {
          return res.status(400).json({ message: 'recipe_id is required', data: [] });
        }

        // Find user
        const user = await User.findById(id);
        if (!user) {
          return res.status(404).json({ message: 'User not found', data: [] });
        }

        // Find recipe to get title if not provided
        const recipe = await Recipe.findOne({ id: recipe_id });
        if (!recipe) {
          return res.status(404).json({ message: 'Recipe not found', data: [] });
        }

        // Use provided title or recipe title
        const recipeTitle = title || recipe.title;

        // Check if already favorited
        const existingFavorite = user.favorites.find(
          fav => fav.recipe_id === recipe_id
        );
        if (existingFavorite) {
          return res.status(400).json({ message: 'Recipe already in favorites', data: [] });
        }

        // Add to favorites
        const newFavorite = {
          recipe_id: recipe_id,
          title: recipeTitle,
          saved_at: new Date()
        };
        user.favorites.push(newFavorite);
        user.updated_at = new Date();

        const savedUser = await user.save();
        return res.status(201).json({ message: 'Favorite added', data: savedUser });
      } catch (err) {
        return res.status(500).json({ message: 'Server error adding favorite', data: err.message });
      }
    });

  // DELETE remove favorite recipe (must be before /users/:id to avoid route conflict)
  router.route('/users/:id/favorites/:recipe_id')
    .delete(async (req, res) => {
      const id = req.params.id.trim();
      const recipe_id = parseInt(req.params.recipe_id);
      try {
        // Validate recipe_id
        if (isNaN(recipe_id)) {
          return res.status(400).json({ message: 'Invalid recipe_id', data: [] });
        }

        // Find user
        const user = await User.findById(id);
        if (!user) {
          return res.status(404).json({ message: 'User not found', data: [] });
        }

        // Find favorite in user's favorites array
        const favoriteIndex = user.favorites.findIndex(
          fav => fav.recipe_id === recipe_id
        );

        if (favoriteIndex === -1) {
          return res.status(404).json({ message: 'Favorite not found', data: [] });
        }

        // Remove favorite
        user.favorites.splice(favoriteIndex, 1);
        user.updated_at = new Date();

        const savedUser = await user.save();
        return res.status(200).json({ message: 'Favorite removed', data: savedUser });
      } catch (err) {
        return res.status(500).json({ message: 'Server error removing favorite', data: err.message });
      }
    });

  // GET / PUT / DELETE by id
  router.route('/users/:id')
    .get(async (req, res) => {
      const id = req.params.id.trim();
      try {
        const select = req.query.select ? JSON.parse(req.query.select) : null;
        const user = await User.findById(id, select || undefined).lean();
    
        if (!user)
          return res.status(404).json({ message: 'User not found', data: [] });
    
        // enforce field order for response
        const orderedUser = {
          _id: user._id,
          id: user.id,
          username: user.username,
          email: user.email,
          password: user.password,
          favorites: user.favorites || [],
          created_at: user.created_at,
          updated_at: user.updated_at
        };
    
        return res.status(200).json({ message: 'OK', data: orderedUser });
      } catch {
        return res.status(400).json({ message: 'Invalid request', data: [] });
      }
    })

    .put(async (req, res) => {
      const id = req.params.id.trim();
      try {
        const { username, email, password, favorites } = req.body;
        if (!username || !email)
          return res.status(400).json({ message: 'Username and email are required', data: [] });

        const user = await User.findById(id);
        if (!user)
          return res.status(404).json({ message: 'User not found', data: [] });

        // Check for email conflict
        const conflict = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
        if (conflict)
          return res.status(400).json({ message: 'Email already exists', data: [] });

        // Update fields
        user.username = username;
        user.email = email.toLowerCase();
        if (password) {
          user.password = password;
        }

        // Validate and update favorites if provided
        if (favorites !== undefined) {
          if (Array.isArray(favorites)) {
            // Filter and validate favorites structure
            user.favorites = favorites.filter(fav => 
              fav && typeof fav.recipe_id === 'number' && fav.title && fav.saved_at
            );
          } else {
            user.favorites = [];
          }
        }

        // Update timestamp
        user.updated_at = new Date();

        const savedUser = await user.save();
        return res.status(200).json({ message: 'User updated', data: savedUser });
      } catch (err) {
        return res.status(500).json({ message: 'Server error updating user', data: err.message });
      }
    })

    .delete(async (req, res) => {
      const id = req.params.id.trim();
      try {
        const user = await User.findById(id);
        if (!user)
          return res.status(404).json({ message: 'User not found', data: [] });

        await user.deleteOne();
        return res.status(200).json({ message: 'User deleted', data: [] });
      } catch (err) {
        return res.status(500).json({ message: 'Server error deleting user', data: err.message });
      }
    });

  return router;
};