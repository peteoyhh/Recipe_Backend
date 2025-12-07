// routes/chat.js - AI Chat API with simple recipe assistant
const { authenticate } = require('../middleware/auth');

// Usage tracking - simple in-memory counter (resets on server restart)
let globalUsageCount = 0;
const GLOBAL_LIMIT = 10000;
const userTotalUsage = new Map(); // userId -> total count
const USER_TOTAL_LIMIT = 200; // Total messages per user

// Get user total usage count
function getUserUsageCount(userId) {
  return userTotalUsage.get(userId) || 0;
}

// Simple rule-based recipe assistant
function generateRecipeResponse(userMessage) {
  const msg = userMessage.toLowerCase();
  
  // greetings
  if (msg.match(/^(hi|hello|hey|greetings)/)) {
    return "Hello! I'm your recipe assistant. I can help you find recipes based on ingredients, dietary preferences, or meal types. What are you looking for today?";
  }
  
  // ingredient-based queries
  if (msg.includes('chicken')) {
    return "Great choice! Try searching for 'Grilled Chicken', 'Chicken Curry', or 'Chicken Stir-fry'. Use the ingredient filter to find recipes with chicken!";
  }
  if (msg.includes('vegetarian') || msg.includes('vegan')) {
    return "Looking for plant-based options? Try 'Veggie Buddha Bowl', 'Lentil Soup', or 'Mushroom Risotto'. Filter by vegetables in the gallery view!";
  }
  if (msg.includes('pasta')) {
    return "Pasta lovers unite! Check out 'Carbonara', 'Aglio e Olio', or 'Pesto Pasta'. Browse our pasta recipes in the list view!";
  }
  if (msg.includes('dessert') || msg.includes('sweet')) {
    return "Sweet tooth? Try 'Chocolate Cake', 'Tiramisu', or 'Fruit Tart'. Search for 'dessert' to see all options!";
  }
  if (msg.includes('quick') || msg.includes('easy') || msg.includes('fast')) {
    return "Need something quick? Look for recipes with fewer ingredients in the gallery view. Most pasta and stir-fry dishes are ready in 30 minutes!";
  }
  if (msg.includes('healthy')) {
    return "Healthy eating! Try salads, grilled proteins, or veggie-based dishes. Use the vegetable filter to find nutritious options!";
  }
  
  // meal type queries
  if (msg.includes('breakfast')) {
    return "Breakfast ideas: Try searching for 'Pancakes', 'Omelette', or 'Smoothie Bowl'. Start your day right!";
  }
  if (msg.includes('lunch')) {
    return "Lunch suggestions: 'Salad', 'Sandwich', or 'Soup' are great options. Browse the list view for more!";
  }
  if (msg.includes('dinner')) {
    return "Dinner time! Consider 'Roasted Chicken', 'Salmon', or 'Stir-fry'. Check out the gallery for inspiration!";
  }
  
  // default helpful response
  return "I'm here to help you discover delicious recipes! Try telling me what ingredients you have, or what type of meal you're planning. You can also use the 'Browse Recipes' or 'By Ingredients' buttons to explore!";
}

module.exports = function(router) {
  
  // POST /api/chat - Send message to AI
  router.route('/chat')
    .post(authenticate, async (req, res) => {
      try {
        const { message } = req.body;
        const userId = req.user.userId;

        if (!message || !message.trim()) {
          return res.status(400).json({ 
            success: false, 
            message: 'Message is required' 
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

        // Simple rule-based recipe assistant (no external API needed)
        const aiResponse = generateRecipeResponse(message.toLowerCase());

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
        
        // Handle rate limiting from Hugging Face
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
