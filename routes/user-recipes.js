// routes/user-recipes.js
const Recipe = require('../models/recipe');
const User = require('../models/user');
const { authenticate } = require('../middleware/auth');

module.exports = function (router) {

  // GET /api/user-recipes - 获取当前用户创建的所有食谱
  router.route('/user-recipes')
    .get(authenticate, async (req, res) => {
      try {
        const user = await User.findById(req.user.userId)
          .populate({
            path: 'createdRecipes',
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

        const recipesWithUrls = user.createdRecipes.map(recipe => {
          const recipeObj = recipe.toObject();
          if (recipeObj.imageName && !recipeObj.imageUrl) {
            recipeObj.imageUrl = `${baseUrl}/api/gridfs-images/${recipeObj.imageName}`;
          }
          recipeObj.isUserCreated = true;
          recipeObj.createdBy = req.user.username;
          return recipeObj;
        });

        res.json({
          message: 'User recipes fetched successfully',
          success: true,
          data: recipesWithUrls,
          total: recipesWithUrls.length
        });

      } catch (error) {
        console.error('Get user recipes error:', error);
        res.status(500).json({ 
          message: 'Server error fetching user recipes',
          success: false,
          error: error.message 
        });
      }
    });

  // POST /api/user-recipes - 创建新的食谱
  router.route('/user-recipes')
    .post(authenticate, async (req, res) => {
      try {
        const { title, ingredients, instructions, extractedIngredients, imageName } = req.body;

        // 验证必填字段
        if (!title) {
          return res.status(400).json({ 
            message: 'Title is required',
            success: false
          });
        }

        // 获取下一个 ID
        const lastRecipe = await Recipe.findOne().sort({ id: -1 });
        const nextId = lastRecipe ? lastRecipe.id + 1 : 10000;

        // 创建新食谱
        const recipe = new Recipe({
          id: nextId,
          title,
          ingredients: ingredients || [],
          instructions: instructions || '',
          extractedIngredients: extractedIngredients || [],
          imageName: imageName || '',
          createdBy: req.user.userId,
          isUserCreated: true
        });

        await recipe.save();

        // 添加到用户的创建列表
        await User.findByIdAndUpdate(
          req.user.userId,
          { $push: { createdRecipes: recipe._id } }
        );

        // 生成 imageUrl
        const baseUrl = process.env.RAILWAY_URL 
          ? `https://${process.env.RAILWAY_URL}` 
          : (req.protocol + '://' + req.get('host'));
        
        const recipeObj = recipe.toObject();
        if (recipeObj.imageName) {
          recipeObj.imageUrl = `${baseUrl}/api/gridfs-images/${recipeObj.imageName}`;
        }

        res.status(201).json({
          message: 'Recipe created successfully',
          success: true,
          data: recipeObj
        });

      } catch (error) {
        console.error('Create recipe error:', error);
        res.status(500).json({ 
          message: 'Server error creating recipe',
          success: false,
          error: error.message 
        });
      }
    });

  // PUT /api/user-recipes/:recipeId - 更新食谱
  router.route('/user-recipes/:recipeId')
    .put(authenticate, async (req, res) => {
      try {
        const { recipeId } = req.params;
        const { title, ingredients, instructions, extractedIngredients, imageName } = req.body;

        // 查找食谱
        const recipe = await Recipe.findById(recipeId);
        
        if (!recipe) {
          return res.status(404).json({ 
            message: 'Recipe not found',
            success: false
          });
        }

        // 验证权限：只有创建者可以编辑
        if (recipe.createdBy?.toString() !== req.user.userId) {
          return res.status(403).json({ 
            message: 'You do not have permission to edit this recipe',
            success: false
          });
        }

        // 更新字段
        if (title !== undefined) recipe.title = title;
        if (ingredients !== undefined) recipe.ingredients = ingredients;
        if (instructions !== undefined) recipe.instructions = instructions;
        if (extractedIngredients !== undefined) recipe.extractedIngredients = extractedIngredients;
        if (imageName !== undefined) recipe.imageName = imageName;

        await recipe.save();

        // 生成 imageUrl
        const baseUrl = process.env.RAILWAY_URL 
          ? `https://${process.env.RAILWAY_URL}` 
          : (req.protocol + '://' + req.get('host'));
        
        const recipeObj = recipe.toObject();
        if (recipeObj.imageName) {
          recipeObj.imageUrl = `${baseUrl}/api/gridfs-images/${recipeObj.imageName}`;
        }

        res.json({
          message: 'Recipe updated successfully',
          success: true,
          data: recipeObj
        });

      } catch (error) {
        console.error('Update recipe error:', error);
        res.status(500).json({ 
          message: 'Server error updating recipe',
          success: false,
          error: error.message 
        });
      }
    });

  // DELETE /api/user-recipes/:recipeId - 删除食谱
  router.route('/user-recipes/:recipeId')
    .delete(authenticate, async (req, res) => {
      try {
        const { recipeId } = req.params;

        // 查找食谱
        const recipe = await Recipe.findById(recipeId);
        
        if (!recipe) {
          return res.status(404).json({ 
            message: 'Recipe not found',
            success: false
          });
        }

        // 验证权限：只有创建者可以删除
        if (recipe.createdBy?.toString() !== req.user.userId) {
          return res.status(403).json({ 
            message: 'You do not have permission to delete this recipe',
            success: false
          });
        }

        // 从用户的创建列表中移除
        await User.findByIdAndUpdate(
          req.user.userId,
          { $pull: { createdRecipes: recipeId } }
        );

        // 删除食谱
        await Recipe.findByIdAndDelete(recipeId);

        res.json({
          message: 'Recipe deleted successfully',
          success: true
        });

      } catch (error) {
        console.error('Delete recipe error:', error);
        res.status(500).json({ 
          message: 'Server error deleting recipe',
          success: false,
          error: error.message 
        });
      }
    });

  return router;
};

