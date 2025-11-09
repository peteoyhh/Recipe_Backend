// routes/favorites.js
const User = require('../models/user');
const Recipe = require('../models/recipe');
const { authenticate } = require('../middleware/auth');

module.exports = function (router) {

  // GET /api/favorites - 获取当前用户的收藏列表
  router.route('/favorites')
    .get(authenticate, async (req, res) => {
      try {
        const user = await User.findById(req.user.userId)
          .populate({
            path: 'favorites',
            select: 'id title imageName ingredients extractedIngredients instructions'
          });

        if (!user) {
          return res.status(404).json({ 
            message: 'User not found',
            success: false
          });
        }

        // 为每个食谱生成 imageUrl
        const baseUrl = process.env.RAILWAY_URL 
          ? `https://${process.env.RAILWAY_URL}` 
          : (req.protocol + '://' + req.get('host'));

        const favoritesWithUrls = user.favorites.map(recipe => {
          const recipeObj = recipe.toObject();
          if (recipeObj.imageName && !recipeObj.imageUrl) {
            recipeObj.imageUrl = `${baseUrl}/api/gridfs-images/${recipeObj.imageName}`;
          }
          return recipeObj;
        });

        res.json({
          message: 'Favorites fetched successfully',
          success: true,
          data: favoritesWithUrls,
          total: favoritesWithUrls.length
        });

      } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ 
          message: 'Server error fetching favorites',
          success: false,
          error: error.message 
        });
      }
    });

  // POST /api/favorites/:recipeId - 添加食谱到收藏
  router.route('/favorites/:recipeId')
    .post(authenticate, async (req, res) => {
      try {
        const { recipeId } = req.params;

        // 验证食谱是否存在
        const recipe = await Recipe.findById(recipeId);
        if (!recipe) {
          return res.status(404).json({ 
            message: 'Recipe not found',
            success: false
          });
        }

        // 查找用户
        const user = await User.findById(req.user.userId);
        if (!user) {
          return res.status(404).json({ 
            message: 'User not found',
            success: false
          });
        }

        // 检查是否已收藏
        if (user.favorites.includes(recipeId)) {
          return res.status(400).json({ 
            message: 'Recipe already in favorites',
            success: false
          });
        }

        // 添加到收藏
        user.favorites.push(recipeId);
        await user.save();

        res.json({
          message: 'Recipe added to favorites',
          success: true,
          data: {
            favorites: user.favorites
          }
        });

      } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({ 
          message: 'Server error adding to favorites',
          success: false,
          error: error.message 
        });
      }
    });

  // DELETE /api/favorites/:recipeId - 从收藏中移除食谱
  router.route('/favorites/:recipeId')
    .delete(authenticate, async (req, res) => {
      try {
        const { recipeId } = req.params;

        const user = await User.findById(req.user.userId);
        if (!user) {
          return res.status(404).json({ 
            message: 'User not found',
            success: false
          });
        }

        // 检查是否在收藏中
        if (!user.favorites.includes(recipeId)) {
          return res.status(400).json({ 
            message: 'Recipe not in favorites',
            success: false
          });
        }

        // 从收藏中移除
        user.favorites = user.favorites.filter(id => id.toString() !== recipeId);
        await user.save();

        res.json({
          message: 'Recipe removed from favorites',
          success: true,
          data: {
            favorites: user.favorites
          }
        });

      } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ 
          message: 'Server error removing from favorites',
          success: false,
          error: error.message 
        });
      }
    });

  // GET /api/favorites/check/:recipeId - 检查食谱是否已收藏
  router.route('/favorites/check/:recipeId')
    .get(authenticate, async (req, res) => {
      try {
        const { recipeId } = req.params;

        const user = await User.findById(req.user.userId);
        if (!user) {
          return res.status(404).json({ 
            message: 'User not found',
            success: false
          });
        }

        const isFavorited = user.favorites.includes(recipeId);

        res.json({
          message: 'Favorite status checked',
          success: true,
          data: {
            isFavorited
          }
        });

      } catch (error) {
        console.error('Check favorite error:', error);
        res.status(500).json({ 
          message: 'Server error checking favorite status',
          success: false,
          error: error.message 
        });
      }
    });

  return router;
};

