// routes/chat.js - AI Chat API with DeepSeek
const axios = require('axios');
const { authenticate } = require('../middleware/auth');
const Recipe = require('../models/recipe');

// Usage tracking
let globalUsageCount = 0;
const GLOBAL_LIMIT = 1000;
const userTotalUsage = new Map();
const USER_TOTAL_LIMIT = 200;

function getUserUsageCount(userId) {
  return userTotalUsage.get(userId) || 0;
}

// cache recipe list (refresh every 10 minutes)
let recipeCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

async function getRecipeContext() {
  const now = Date.now();
  
  // use cache if valid
  if (recipeCache && (now - lastCacheTime) < CACHE_DURATION) {
    return recipeCache;
  }
  
  try {
    // get recipes from database (limit to 200 for performance)
    const recipes = await Recipe.find({}, 'title ingredients').limit(200);
    
    // format recipe info for AI (only title + top 3 ingredients)
    const recipeList = recipes.map(r => ({
      title: r.title,
      ingredients: r.ingredients?.slice(0, 3).join(', ') || 'N/A'
    }));
    
    recipeCache = recipeList;
    lastCacheTime = now;
    
    return recipeList;
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return [];
  }
}

module.exports = function(router) {
  
  // POST /api/chat - Send message to AI
  router.route('/chat')
    .post(authenticate, async (req, res) => {
      try {
        const { messages } = req.body;
        const userId = req.user.userId;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'Messages are required' 
          });
        }

        // Check global limit
        if (globalUsageCount >= GLOBAL_LIMIT) {
          return res.status(429).json({ 
            success: false, 
            message: 'Service limit reached. Please try again later.' 
          });
        }

        // Check user total limit
        const userCount = getUserUsageCount(userId);
        if (userCount >= USER_TOTAL_LIMIT) {
          return res.status(429).json({ 
            success: false, 
            message: `User limit reached (${USER_TOTAL_LIMIT} messages total). Contact support for more.` 
          });
        }

        // Get recipe context from database
        const recipes = await getRecipeContext();
        
        // Create recipe context string (sample 50 random recipes)
        const sampleSize = Math.min(50, recipes.length);
        const sampledRecipes = recipes
          .sort(() => 0.5 - Math.random())
          .slice(0, sampleSize);
        
        const recipeContext = sampledRecipes
          .map(r => `- ${r.title} (${r.ingredients})`)
          .join('\n');

        // Call DeepSeek API with full conversation history
        const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
        const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

        const systemMessage = {
          role: 'system',
          content: `You are RecipeGenie's AI assistant.

RULES:
1. GREETING: Say "Hi! I'm RecipeGenie's AI assistant. What would you like to eat today?"

2. REMEMBER CONTEXT: Always remember ALL previous user requirements. If user said "chicken" earlier, ONLY recommend chicken recipes.

3. RECOMMEND: When user gives 2+ requirements (ingredient + taste/style), recommend EXACTLY 2-3 recipes. NO MORE.

4. MATCH ALL: Only show recipes matching ALL user requirements from conversation history.

RECIPES:
${recipeContext}

Keep under 60 words. Use exact titles.`
        };

        const response = await axios.post(
          DEEPSEEK_API_URL,
          {
            model: 'deepseek-chat',
            messages: [systemMessage, ...messages],
            max_tokens: 120,
            temperature: 0.7
          },
          {
            headers: {
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        const aiResponse = response.data.choices[0].message.content;

        // Update usage counters
        globalUsageCount++;
        const newUserCount = userCount + 1;
        userTotalUsage.set(userId, newUserCount);

        res.json({
          success: true,
          data: {
            message: aiResponse,
            userRemaining: USER_TOTAL_LIMIT - newUserCount,
            globalRemaining: GLOBAL_LIMIT - globalUsageCount
          }
        });

      } catch (error) {
        console.error('Chat error:', error.response?.data || error.message);
        
        if (error.response?.status === 429) {
          return res.status(429).json({
            success: false,
            message: 'AI service is busy. Please try again in a moment.'
          });
        }

        res.status(500).json({
          success: false,
          message: 'Failed to process chat request'
        });
      }
    });

  // GET /api/chat/stats - Get usage statistics
  router.route('/chat/stats')
    .get(authenticate, (req, res) => {
      const userId = req.user.userId;
      const userCount = getUserUsageCount(userId);

      res.json({
        success: true,
        data: {
          userRemaining: USER_TOTAL_LIMIT - userCount,
          globalRemaining: GLOBAL_LIMIT - globalUsageCount,
          userTotalLimit: USER_TOTAL_LIMIT,
          globalLimit: GLOBAL_LIMIT
        }
      });
    });

  return router;
};
