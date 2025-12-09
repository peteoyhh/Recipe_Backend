# Recipe Management API

Backend for RecipeGenie built with **Node.js**, **Express**, and **Mongoose**. Features JWT auth with email verification, CRUD for recipes, user favorites and personal recipes, GridFS image storage, and an AI chat endpoint powered by DeepSeek.

---

## Getting Started

1) Install dependencies  
```bash
npm install
```
2) Create `.env` in the project root:
```
MONGODB_URI=mongodb+srv://...
PORT=3000
JWT_SECRET=choose-a-strong-secret
SENDGRID_API_KEY=your-sendgrid-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
RAILWAY_URL=your-railway-subdomain  # optional, used to build image URLs
UPLOAD_TOKEN=recipe-upload-secret-2024  # only needed if you wire up /upload routes
```
3) Start the server  
```bash
npm start        # production
npm run dev      # with nodemon
```

MongoDB Atlas/URI must be reachable; server exits early if `MONGODB_URI` is missing.

---

## Models (Mongoose)

- `User`: `username` (unique), `email` (unique), `password` (hashed), `emailVerified`, `favorites` (ObjectId refs), `createdRecipes` (ObjectId refs), auto-generated `id` like `u001`.
- `Recipe`: numeric `id`, `title`, `ingredients[]`, `instructions`, `imageName`, `extractedIngredients[]`, `createdBy` (user), `isUserCreated`.

---

## Authentication & Email Verification

- `POST /api/auth/send-code` — send a 6-digit code via SendGrid (fails if email already registered).  
- `POST /api/auth/verify-code` — validate code (10-minute expiry).  
- `POST /api/auth/check-verification` — returns `{ verified: boolean }`.  
- `POST /api/auth/register` — requires a verified email; creates user, returns JWT.  
- `POST /api/auth/login` — returns JWT.  
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`, returns user with favorites/created recipes populated.
- Roles: default `user`; `dfsgds@gmail.com` is treated as `admin`.

### How to call (curl & Postman)

**curl (login then use token)**
```bash
# 1) login to get token
curl -X POST "https://recipebackend-production-5f88.up.railway.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"your@example.com","password":"yourpassword"}'

# 2) copy data.token and call protected endpoints
curl "https://recipebackend-production-5f88.up.railway.app/api/users" \
  -H "Authorization: Bearer <paste_token_here>"
```

**Postman**
1) Create a Collection (e.g., “Recipe API”).  
2) Add a login request `POST /api/auth/login`, Body raw JSON as above; send and copy `data.token`.  
3) In Collection → Variables add `token` with that JWT value.  
4) In Collection → Authorization set Type = “Bearer Token”, Token = `{{token}}`, save.  
5) Requests in this Collection (e.g., `GET /api/users`, `GET /api/favorites`) will auto-include `Authorization: Bearer {{token}}`.  
6) When the token expires, log in again and update the variable; to auto-update, add in the login request Tests:
```javascript
const res = pm.response.json();
if (res?.data?.token) pm.collectionVariables.set("token", res.data.token);
```

---

## Core API

> Unless noted, all paths are under `/api`. Auth = requires `Authorization: Bearer <token>`.

### Users (admin/maintenance; all routes require auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List users with query helpers `where`, `sort`, `select`, `skip`, `limit`, `count`. Passwords and verification fields are omitted. |
| POST | `/users` | Create user (validates unique email). |
| GET | `/users/:id` | Fetch user by Mongo `_id`; returns masked email unless requesting own profile. |
| PUT | `/users/:id` | Update own profile (username/email/password, favorites). |
| DELETE | `/users/:id` | Delete own account. |
| POST | `/users/:id/favorites` | Add favorite by `recipe_id` in body. |
| POST | `/users/:id/favorites/:recipe_id` | Add favorite by URL param. |
| DELETE | `/users/:id/favorites/:recipe_id` | Remove favorite by URL param. |

> Note: `/users` requires admin. `/users/:id` allows admin or the same user; others are forbidden.

### Recipes
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/recipes` | Public | List recipes with `where`, `sort`, `select`, `skip`, `limit`, `count`; default limit 100. |
| POST | `/recipes` | Public | Create recipe; numeric `id` auto-increments if omitted. |
| GET | `/recipes/:id` | Public | Fetch by Mongo `_id` (not the numeric `id`). |
| PUT | `/recipes/:id` | Public | Update recipe fields; rejects duplicate numeric `id`. |
| DELETE | `/recipes/:id` | Public | Delete recipe by Mongo `_id`. |

### Favorites (uses ObjectId references)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/favorites` | Required | Return current user's favorites with `imageUrl` constructed from `RAILWAY_URL` or host. |
| POST | `/favorites/:recipeId` | Required | Add recipe to favorites. |
| DELETE | `/favorites/:recipeId` | Required | Remove recipe from favorites. |
| GET | `/favorites/check/:recipeId` | Required | Returns `isFavorited`. |

### User Recipes (owned content)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/user-recipes` | Required | Recipes created by current user (adds `imageUrl`, `isUserCreated`, `createdBy`). |
| POST | `/user-recipes` | Required | Create recipe; uses next numeric `id` (starts at 10000 if no recipes). |
| PUT | `/user-recipes/:recipeId` | Required | Edit own recipe only. |
| DELETE | `/user-recipes/:recipeId` | Required | Delete own recipe and unlink from user. |

### Images (MongoDB GridFS)
Bucket `recipeImages` initializes on DB connection.
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/gridfs-images/:filename` | Public | Stream image by filename (tries with and without `.jpg`). |
| GET | `/gridfs-images` | Public | List up to 100 stored images. |
| POST | `/gridfs-images/upload` | Public | Upload single image (`image` field, jpg/png/webp, ≤10MB). Replaces existing filename. |
| POST | `/gridfs-images/batch-upload` | Public | Upload up to 100 images at once. |

### AI Chat (DeepSeek)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/chat` | Required | `{"messages":[{role,content}]}`; injects recipe context, returns AI reply plus remaining quotas. Limits: global 1000 requests, 200 per user. |
| GET | `/chat/stats` | Required | Remaining quota snapshot. |

### Root
`GET /` and `GET /api/` return simple HTML/health info.

---

## Query Helper Examples

- `/api/recipes?where={"title":"Chicken"}`
- `/api/users?sort={"username":1}`  
- `/api/recipes?skip=20&limit=10`  
- `/api/users?select={"_id":0,"email":1}`  
- `/api/recipes?count=true`

---

## Responses

Most endpoints return `{ message, success?, data }`. Auth/favorites/chat also include `success` and quota fields. Errors use standard HTTP codes (400 validation, 401/403 auth, 404 missing, 500 server).

---

## Image Storage Notes

- ~13k recipe images live in MongoDB GridFS.  
- `imageName` on a recipe corresponds to `/api/gridfs-images/:imageName`.  
- Uploads accept jpg/png/webp up to 10MB and respond with `imageUrl` and `fullUrl`.

---

## Useful Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server. |
| `npm run dev` | Start with nodemon. |
| `npm run fix-user-ids` | Normalize user IDs (script provided). |
| `node scripts/upload-images.js` | Helper to push local images to uploads dir. |
| `node scripts/upload-to-mongodb.js` | Helper to bulk upload images to GridFS. |
| `node scripts/upload-to-railway.js` | Helper to publish dataset to Railway. |
