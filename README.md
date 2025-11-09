# MP3: Recipe Management API

**Course:** CS 409 Fall 2025  
**Author:** Pete Chen  
**Project:** MP #3 — Recipe Management REST API

---

## Overview

This project implements a fully functional RESTful API for a recipe management application built using **Node.js**, **Express**, and **Mongoose**.

The API supports CRUD operations for both **Users** and **Recipes**, complete with query string filtering, pagination, and user favorites management.

---

## Deployment

- **Railway URL:** [https://recipebackend-production-dc03.up.railway.app](https://recipebackend-production-dc03.up.railway.app)
- **MongoDB Atlas Cluster:** Connected remotely (IP Whitelist: Allow access from anywhere)
- **Image Storage:** MongoDB GridFS (13,582 images stored in cloud)

---

## Endpoints

### 🧍 Users
| Method | Endpoint | Description |
|---------|-----------|-------------|
| GET | `/api/users` | Get all users (supports `where`, `sort`, `select`, `skip`, `limit`, `count`) |
| POST | `/api/users` | Create a new user |
| GET | `/api/users/:id` | Get details of a specific user (by MongoDB `_id`) |
| PUT | `/api/users/:id` | Update user details and favorites |
| DELETE | `/api/users/:id` | Delete user |

### 🍳 Recipes
| Method | Endpoint | Description |
|---------|-----------|-------------|
| GET | `/api/recipes` | Get all recipes (supports `where`, `sort`, `select`, `skip`, `limit`, `count`, default limit: 100) |
| POST | `/api/recipes` | Create a new recipe |
| GET | `/api/recipes/:id` | Get details of a specific recipe (by MongoDB `_id`) |
| PUT | `/api/recipes/:id` | Update recipe fields |
| DELETE | `/api/recipes/:id` | Delete recipe |

### 🔐 Authentication
| Method | Endpoint | Description |
|---------|-----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current user info (requires auth) |

### ❤️ User Favorites
| Method | Endpoint | Description |
|---------|-----------|-------------|
| GET | `/api/favorites` | Get user's favorite recipes (requires auth) |
| POST | `/api/favorites/:recipeId` | Add recipe to favorites (requires auth) |
| DELETE | `/api/favorites/:recipeId` | Remove from favorites (requires auth) |
| GET | `/api/favorites/check/:recipeId` | Check if recipe is favorited (requires auth) |

### 📝 User Created Recipes
| Method | Endpoint | Description |
|---------|-----------|-------------|
| GET | `/api/user-recipes` | Get recipes created by current user (requires auth) |
| POST | `/api/user-recipes` | Create new recipe (requires auth) |
| PUT | `/api/user-recipes/:recipeId` | Update user's recipe (requires auth) |
| DELETE | `/api/user-recipes/:recipeId` | Delete user's recipe (requires auth) |

### 📸 Recipe Images (MongoDB GridFS)
| Method | Endpoint | Description |
|---------|-----------|-------------|
| GET | `/api/gridfs-images/:imageName` | Get recipe image from MongoDB GridFS (public access) |
| GET | `/api/gridfs-images` | List all stored images (up to 100) |
| POST | `/api/gridfs-images/upload` | Upload single image (requires authentication) |
| POST | `/api/gridfs-images/batch-upload` | Upload multiple images (requires authentication) |

---

## Example Queries

| Query | Description |
|--------|--------------|
| `/api/recipes?where={"title":"Chicken"}` | Get all recipes with "Chicken" in title |
| `/api/users?sort={"username":1}` | Get users sorted alphabetically by username |
| `/api/recipes?skip=20&limit=10` | Paginate recipes (recipes #21–30) |
| `/api/users?select={"_id":0,"email":1}` | Get only user emails |
| `/api/recipes?where={"id":12}` | Get recipe with numeric id 12 |
| `/api/recipes?count=true` | Get count of all recipes |

---

## Validation Rules

### Users
- Must include `username`, `email`, and `password`
- Email must be unique
- User `id` is auto-generated (format: `u001`, `u002`, etc.) if not provided
- Automatically adds `created_at` and `updated_at` timestamps
- `favorites` is an array of objects with `recipe_id`, `title`, and `saved_at`

### Recipes
- Must include `title`
- Recipe `id` is auto-generated (numeric: 0, 1, 2, etc.) if not provided
- `id` must be unique
- Default values:
  - `ingredients`: `[]`
  - `instructions`: `""`
  - `imageName`: `""`
  - `extractedIngredients`: `[]`
- Default limit for GET `/api/recipes` is 100

---

## HTTP Response Format

All responses follow the same structure:
```json
{
  "message": "OK",
  "data": {...}
}
```

Example (GET `/api/recipes/:id`):
```json
{
  "message": "OK",
  "data": {
    "_id": "64f993a2d7a64f01ec47b1a9",
    "id": 12,
    "title": "Miso-Butter Roast Chicken",
    "ingredients": ["chicken", "butter", "miso"],
    "instructions": "Cook the chicken...",
    "imageName": "miso-butter-roast-chicken",
    "extractedIngredients": ["chicken", "butter", "miso"]
  }
}
```

Example (GET `/api/users/:id`):
```json
{
  "message": "OK",
  "data": {
    "_id": "64f993a2d7a64f01ec47b1a9",
    "id": "u001",
    "username": "Alice Chen",
    "email": "alice@example.com",
    "password": "password123",
    "favorites": [
      {
        "recipe_id": 12,
        "title": "Miso Butter Roast Chicken",
        "saved_at": "2025-11-06T14:23:00Z"
      }
    ],
    "created_at": "2025-10-28T12:00:00Z",
    "updated_at": "2025-11-07T09:15:00Z"
  }
}
```

---

## Status Codes

| Code | Meaning |
|------|----------|
| 200 | Success |
| 201 | Resource created |
| 400 | Bad request |
| 404 | Not found |
| 500 | Server error |

---

## Scripts

| Command | Description |
|----------|-------------|
| `npm install` | Install dependencies |
| `npm start` | Start server locally |
| `npm run dev` | Start with nodemon (for development) |

---

## Tech Stack
- **Node.js**
- **Express**
- **MongoDB Atlas**
- **Mongoose**
- **MongoDB GridFS** (for image storage)
- **Multer** (for file uploads)
- **JWT** (user authentication)
- **bcryptjs** (password hashing)
- **Railway** (deployment - updated from Render)

---

## Notes
- `.env` file contains:
  ```
  MONGODB_URI=your_connection_string_here
  PORT=3000
  JWT_SECRET=your_jwt_secret_here
  UPLOAD_TOKEN=recipe-upload-secret-2024  # For image upload authentication
  ```
- `.env` is listed in `.gitignore` to prevent accidental exposure.
- Recipe queries default to a limit of 100 results to prevent overwhelming responses.
- User IDs are auto-generated in format `u001`, `u002`, etc. if not provided.
- Recipe IDs are auto-generated as numeric values (0, 1, 2, etc.) if not provided.
- **User authentication** uses JWT tokens with bcrypt password hashing
- **Protected routes** require `Authorization: Bearer <token>` header

### Image Storage
- **All 13,582 recipe images** are stored in **MongoDB GridFS** (cloud-based storage)
- Images are served through `/api/gridfs-images/:imageName` endpoint
- Recipe documents include `imageName` field (e.g., "chicken-recipe") and auto-generated `imageUrl` field
- Each recipe automatically gets a full `imageUrl` when fetched from the API
- Image uploads require Bearer Token authentication for security
- Public image access does not require authentication

---

**Deployed & Verified:** All endpoints tested via Postman and Render (200/201/404/500 verified).  
