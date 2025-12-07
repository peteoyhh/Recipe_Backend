// routes/chat.js - AI Chat API with Hugging Face
const axios = require('axios');
const { authenticate } = require('../middleware/auth');

// Usage tracking - simple in-memory counter (resets on server restart)
let globalUsageCount = 0;
const GLOBAL_LIMIT = 10000; // 1/3 of free tier (30k/month)
const userTotalUsage = new Map(); // userId -> total count
const USER_TOTAL_LIMIT = 200; // Total messages per user

// Get user total usage count
function getUserUsageCount(userId) {
  return userTotalUsage.get(userId) || 0;
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

        // Call Hugging Face API - using text generation
        const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
        
        // Use a simple, reliable text generation model
        const HF_MODEL = 'gpt2';

        const prompt = `You are a recipe assistant. User asks: ${message}\n\nAssistant:`;

        const response = await axios.post(
          `https://api-inference.huggingface.co/models/${HF_MODEL}`,
          {
            inputs: prompt,
            parameters: {
              max_new_tokens: 100,
              temperature: 0.7,
              return_full_text: false
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${HF_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        let aiResponse = '';
        if (response.data && Array.isArray(response.data) && response.data[0]?.generated_text) {
          aiResponse = response.data[0].generated_text.trim();
        } else {
          aiResponse = "I'm here to help with recipes! What would you like to cook?";
        }

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
