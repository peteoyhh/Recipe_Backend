const mongoose = require('mongoose');
const User = require('../models/user');
const Recipe = require('../models/recipe');
const { buildQuery } = require('./utils');
const { authenticate } = require('../middleware/auth');

const maskEmail = (email) => {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
};

const sanitizeUser = (user, showFullEmail = false) => {
  const obj = user.toObject ? user.toObject() : user;
  return {
    _id: obj._id,
    id: obj.id,
    username: obj.username,
    email: showFullEmail ? obj.email : maskEmail(obj.email),
    favorites: obj.favorites || [],
    createdRecipes: obj.createdRecipes || [],
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

module.exports = function (router) {

  router.route('/users')
    .get(authenticate, async (req, res) => {
      try {
        if (req.query.count === 'true') {
          const count = await buildQuery(User, req).countDocuments();
          return res.status(200).json({ message: 'OK', data: count });
        }

        const result = await buildQuery(User, req).select('-password -verificationCode -verificationExpires').exec();
        const users = Array.isArray(result) ? result : [result];
        const data = users.map(u => sanitizeUser(u));
        return res.status(200).json({ message: 'OK', data });
      } catch (err) {
        return res.status(400).json({ message: err.message, data: [] });
      }
    })

    .post(authenticate, async (req, res) => {
      try {
        const { username, email, password, favorites } = req.body;
        if (!username || !email)
          return res.status(400).json({ message: 'Username and email are required', data: [] });

        const normalizedEmail = email.toLowerCase().trim();
        const existingEmail = await User.findOne({ email: normalizedEmail });
        if (existingEmail)
          return res.status(400).json({ message: 'Email already exists', data: [] });

        let validFavorites = [];
        if (Array.isArray(favorites)) {
          validFavorites = favorites.filter(fav => 
            fav && typeof fav.recipe_id === 'string' && mongoose.Types.ObjectId.isValid(fav.recipe_id) && fav.title && fav.saved_at
          );
        }

        const newUser = new User({
          username,
          email: normalizedEmail,
          ...(password && { password }),
          favorites: validFavorites
        });

        const savedUser = await newUser.save();
        return res.status(201).json({ message: 'User created', data: sanitizeUser(savedUser, true) });
      } catch (err) {
        return res.status(500).json({ message: 'Server error creating user', data: err.message });
      }
    });

  // Helper functions for favorites operations
  function validateObjectId(id, errorMessage = 'Invalid ObjectId format') {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { error: true, message: errorMessage };
    }
    return { error: false };
  }

  async function findUserById(userId) {
    return await User.findById(userId);
  }

  async function findRecipeById(recipeId) {
    if (!mongoose.Types.ObjectId.isValid(recipeId)) {
      return null;
    }
    return await Recipe.findById(recipeId);
  }

  function isRecipeFavorited(user, recipeObjectId) {
    // Optimized: use some() for existence check, ensure string comparison
    const recipeIdStr = String(recipeObjectId);
    return user.favorites.some(fav => String(fav.recipe_id) === recipeIdStr);
  }

  function createFavoriteObject(recipe, title = null) {
    return {
      recipe_id: recipe._id.toString(),
      title: title || recipe.title,
      saved_at: new Date()
    };
  }

  async function validateAndFindResources(userId, recipeId) {
    // Validate user id format
    const userValidation = validateObjectId(userId, 'Invalid user id format. Must be a valid MongoDB ObjectId');
    if (userValidation.error) {
      return { error: true, status: 400, message: userValidation.message };
    }

    // Validate recipe_id format
    const recipeValidation = validateObjectId(recipeId, 'Invalid recipe_id format. Must be a valid MongoDB ObjectId');
    if (recipeValidation.error) {
      return { error: true, status: 400, message: recipeValidation.message };
    }

    // Find user
    const user = await findUserById(userId);
    if (!user) {
      return { error: true, status: 404, message: 'User not found' };
    }

    // Find recipe
    const recipe = await findRecipeById(recipeId);
    if (!recipe) {
      return { error: true, status: 404, message: 'Recipe not found' };
    }

    return { error: false, user, recipe };
  }

  // POST/DELETE favorite recipe via URL parameter (must be before /users/:id/favorites)
  router.route('/users/:id/favorites/:recipe_id')
    .post(async (req, res) => {
      const id = req.params.id.trim();
      const recipe_id_param = req.params.recipe_id.trim();

      const userValidation = validateObjectId(id, 'Invalid user id format. Must be a valid MongoDB ObjectId');
      if (userValidation.error) {
        return res.status(400).json({ message: userValidation.message, data: [] });
      }

      try {
        // Validate recipe_id format
        const recipeValidation = validateObjectId(recipe_id_param, 'Invalid recipe_id format. Must be a valid MongoDB ObjectId');
        if (recipeValidation.error) {
          return res.status(400).json({ message: recipeValidation.message, data: [] });
        }

        // Find recipe
        const recipe = await findRecipeById(recipe_id_param);
        if (!recipe) {
          return res.status(404).json({ message: 'Recipe not found', data: [] });
        }

        const recipeObjectId = recipe._id.toString();
        const newFavorite = createFavoriteObject(recipe);

        // Check if already favorited and add in one operation using findOneAndUpdate
        // Mongoose timestamps will automatically update updated_at
        const updatedUser = await User.findOneAndUpdate(
          {
            _id: id,
            'favorites.recipe_id': { $ne: recipeObjectId } // Only update if not already favorited
          },
          {
            $push: { favorites: newFavorite }
          },
          {
            new: true, // Return updated document
            runValidators: true
          }
        );

        if (!updatedUser) {
          // Either user not found or already favorited - check which one
          const user = await findUserById(id);
          if (!user) {
            return res.status(404).json({ message: 'User not found', data: [] });
          }
          if (isRecipeFavorited(user, recipeObjectId)) {
            return res.status(400).json({ message: 'Recipe already in favorites', data: [] });
          }
          return res.status(404).json({ message: 'User not found', data: [] });
        }

        return res.status(201).json({ message: 'Favorite added', data: updatedUser });
      } catch (err) {
        return res.status(500).json({ message: 'Server error adding favorite', data: err.message });
      }
    })
    .delete(async (req, res) => {
      const id = req.params.id.trim();
      const recipe_id_param = req.params.recipe_id.trim();

      const userValidation = validateObjectId(id, 'Invalid user id format. Must be a valid MongoDB ObjectId');
      if (userValidation.error) {
        return res.status(400).json({ message: userValidation.message, data: [] });
      }

      try {
        // Validate recipe_id format
        const recipeValidation = validateObjectId(recipe_id_param, 'Invalid recipe_id format. Must be a valid MongoDB ObjectId');
        if (recipeValidation.error) {
          return res.status(400).json({ message: recipeValidation.message, data: [] });
        }

        // Find recipe to get ObjectId
        const recipe = await findRecipeById(recipe_id_param);
        if (!recipe) {
          return res.status(404).json({ message: 'Recipe not found', data: [] });
        }

        const recipeObjectId = recipe._id.toString();

        // Remove favorite using findOneAndUpdate
        // Mongoose timestamps will automatically update updated_at
        const updatedUser = await User.findOneAndUpdate(
          {
            _id: id,
            'favorites.recipe_id': recipeObjectId // Only update if favorite exists
          },
          {
            $pull: { favorites: { recipe_id: recipeObjectId } }
          },
          {
            new: true, // Return updated document
            runValidators: true
          }
        );

        if (!updatedUser) {
          // Either user not found or favorite not found - check which one
          const user = await findUserById(id);
          if (!user) {
            return res.status(404).json({ message: 'User not found', data: [] });
          }
          if (!isRecipeFavorited(user, recipeObjectId)) {
            return res.status(404).json({ message: 'Favorite not found', data: [] });
          }
          return res.status(404).json({ message: 'User not found', data: [] });
        }

        return res.status(200).json({ message: 'Favorite removed', data: updatedUser });
      } catch (err) {
        return res.status(500).json({ message: 'Server error removing favorite', data: err.message });
      }
    });

  // POST add favorite recipe via body (must be before /users/:id to avoid route conflict)
  router.route('/users/:id/favorites')
    .post(async (req, res) => {
      const id = req.params.id.trim();
      try {
        const userValidation = validateObjectId(id, 'Invalid user id format. Must be a valid MongoDB ObjectId');
        if (userValidation.error) {
          return res.status(400).json({ message: userValidation.message, data: [] });
        }

        const { recipe_id, recipeId, title = null } = req.body;
        const incomingRecipeId = (recipe_id ?? recipeId);

        // Validate recipe id presence
        if (incomingRecipeId === undefined || incomingRecipeId === null) {
          return res.status(400).json({ message: 'recipe_id is required', data: [] });
        }

        // Validate recipe_id format
        const recipeValidation = validateObjectId(String(incomingRecipeId).trim(), 'Invalid recipe_id format. Must be a valid MongoDB ObjectId');
        if (recipeValidation.error) {
          return res.status(400).json({ message: recipeValidation.message, data: [] });
        }

        // Find recipe
        const recipe = await findRecipeById(String(incomingRecipeId).trim());
        if (!recipe) {
          return res.status(404).json({ message: 'Recipe not found', data: [] });
        }

        const recipeObjectId = String(recipe._id);
        const newFavorite = createFavoriteObject(recipe, title);

        // Check if already favorited and add in one operation using findOneAndUpdate
        // Mongoose timestamps will automatically update updated_at
        const updatedUser = await User.findOneAndUpdate(
          {
            _id: id,
            'favorites.recipe_id': { $ne: recipeObjectId } // Only update if not already favorited
          },
          {
            $push: { favorites: newFavorite }
          },
          {
            new: true, // Return updated document
            runValidators: true
          }
        );

        if (!updatedUser) {
          // Either user not found or already favorited - check which one
          const user = await findUserById(id);
          if (!user) {
            return res.status(404).json({ message: 'User not found', data: [] });
          }
          if (isRecipeFavorited(user, recipeObjectId)) {
            return res.status(400).json({ message: 'Recipe already in favorites', data: [] });
          }
          return res.status(404).json({ message: 'User not found', data: [] });
        }

        return res.status(201).json({ message: 'Favorite added', data: updatedUser });
      } catch (err) {
        return res.status(500).json({ message: 'Server error adding favorite', data: err.message });
      }
    });


  router.route('/users/:id')
    .get(authenticate, async (req, res) => {
      const id = req.params.id.trim();
      try {
        const userValidation = validateObjectId(id, 'Invalid user id format. Must be a valid MongoDB ObjectId');
        if (userValidation.error) {
          return res.status(400).json({ message: userValidation.message, data: [] });
        }

        const user = await User.findById(id).select('-password -verificationCode -verificationExpires').lean();
    
        if (!user)
          return res.status(404).json({ message: 'User not found', data: [] });
    
        const isOwnProfile = req.user.userId === id;
        return res.status(200).json({ message: 'OK', data: sanitizeUser(user, isOwnProfile) });
      } catch {
        return res.status(400).json({ message: 'Invalid request', data: [] });
      }
    })

    .put(authenticate, async (req, res) => {
      const id = req.params.id.trim();
      try {
        if (req.user.userId !== id) {
          return res.status(403).json({ message: 'You can only update your own profile', data: [] });
        }

        const userValidation = validateObjectId(id, 'Invalid user id format. Must be a valid MongoDB ObjectId');
        if (userValidation.error) {
          return res.status(400).json({ message: userValidation.message, data: [] });
        }

        const { username, email, password, favorites } = req.body;
        if (!username || !email)
          return res.status(400).json({ message: 'Username and email are required', data: [] });

        const normalizedEmail = email.toLowerCase().trim();

        const conflict = await User.findOne({ email: normalizedEmail, _id: { $ne: id } });
        if (conflict)
          return res.status(400).json({ message: 'Email already exists', data: [] });

        const updateFields = {
          username,
          email: normalizedEmail
        };

        if (password) {
          updateFields.password = password;
        }

        if (favorites !== undefined) {
          if (Array.isArray(favorites)) {
            updateFields.favorites = favorites.filter(fav => 
              fav && typeof fav.recipe_id === 'string' && mongoose.Types.ObjectId.isValid(fav.recipe_id) && fav.title && fav.saved_at
            );
          } else {
            updateFields.favorites = [];
          }
        }

        const updatedUser = await User.findOneAndUpdate(
          { _id: id },
          { $set: updateFields },
          { new: true, runValidators: true }
        ).select('-password -verificationCode -verificationExpires');

        if (!updatedUser) {
          return res.status(404).json({ message: 'User not found', data: [] });
        }

        return res.status(200).json({ message: 'User updated', data: sanitizeUser(updatedUser, true) });
      } catch (err) {
        return res.status(500).json({ message: 'Server error updating user', data: err.message });
      }
    })

    .delete(authenticate, async (req, res) => {
      const id = req.params.id.trim();
      try {
        if (req.user.userId !== id) {
          return res.status(403).json({ message: 'You can only delete your own account', data: [] });
        }

        const userValidation = validateObjectId(id, 'Invalid user id format. Must be a valid MongoDB ObjectId');
        if (userValidation.error) {
          return res.status(400).json({ message: userValidation.message, data: [] });
        }

        const user = await findUserById(id);
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