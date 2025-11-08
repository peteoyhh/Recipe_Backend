// server.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const router = express.Router();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse incoming JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Connect to MongoDB
// IMPORTANT: Never hardcode MongoDB URI. Always use environment variables.
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI || mongoURI.trim() === '') {
  console.error('❌ No MongoDB connection string found in .env (MONGODB_URI)');
  console.error('   Please set MONGODB_URI in your .env file');
  process.exit(1);
}

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true  // Use createIndex instead of deprecated ensureIndex
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Import routes
require('./routes')(app, router);

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Recipe Management API</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f8f9fa;
          text-align: center;
          padding: 80px;
        }
        h1 {
          color: #2c3e50;
        }
        p {
          color: #555;
          font-size: 1.1rem;
        }
        .btn {
          display: inline-block;
          margin: 10px;
          padding: 10px 20px;
          background-color: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          transition: background-color 0.2s;
        }
        .btn:hover {
          background-color: #0056b3;
        }
      </style>
    </head>
    <body>
      <h1>Recipe Management API</h1>
      <p>Welcome! Choose an endpoint below:</p>
      <a class="btn" href="/api/users">View Users</a>
      <a class="btn" href="/api/recipes">View Recipes</a>
      <a class="btn" href="https://github.com/peteoyhh/Recipe_Backend" target="_blank">API Docs</a>
    </body>
    </html>
  `);
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});