# ♻️ Recycle-Digi — Sealed Bid Auction Platform
### Digi Store Theme × Recycle BD Features

A full-stack sealed-bid auction platform for Bangladesh, built with the Digi Store visual layout.

---

## 📁 Project Structure

```
recycle-digi/
├── server.js                    ← Main server (Express + Socket.IO)
├── package.json
├── .env.example                 ← Copy to .env
│
├── prisma/
│   └── schema.prisma            ← All 6 DB models (PostgreSQL)
│
├── backend/
│   ├── seed.js                  ← Demo data seeder
│   ├── middleware/
│   │   └── auth.js              ← JWT protect / adminOnly / sellerOnly
│   ├── controllers/
│   │   ├── authController.js    ← Register, login, profile
│   │   ├── auctionController.js ← CRUD + seller dashboard + expiry
│   │   └── bidChatController.js ← Bids, watchlist, chat, notifications
│   └── routes/
│       ├── auth.js
│       ├── auctions.js
│       ├── features.js          ← Bids, watchlist, chat, notifications
│       └── upload.js            ← Single + multi image upload
│
└── frontend/
    ├── index.html               ← SPA (all views in one file)
    ├── styles.css               ← Digi theme + auction styles
    ├── app.js                   ← All frontend logic
    ├── placeholder.svg          ← Default image
    └── uploads/                 ← Uploaded images saved here
```

---

## ⚙️ Requirements

- **Node.js** v18+ → https://nodejs.org
- **PostgreSQL** v14+ → https://www.postgresql.org/download/

---

## 🚀 Setup & Run (Step by Step)

### Step 1 — Install PostgreSQL & create database

```bash
# Open psql
psql -U postgres

# Create database
CREATE DATABASE recycle_digi;
\q
```

### Step 2 — Extract project & install packages

```bash
cd recycle-digi
npm install
```

### Step 3 — Configure environment

```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

Open `.env` in VS Code and set:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/recycle_digi"
JWT_SECRET=any_long_random_string_here_minimum_32_characters
PORT=5000
```

### Step 4 — Push database schema

```bash
npm run db:push
```

You should see: `Your database is now in sync with your Prisma schema.`

### Step 5 — Seed demo data

```bash
npm run db:seed
```

You'll see:
```
✅ Connected to MongoDB
👥 Users created: 5
🏷  Auctions created: 8
💰 Bids created: 10
❤️  Watchlist entries: 4
```

### Step 6 — Start the server

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### Step 7 — Open in browser

```
http://localhost:5000
```

---

## 🔑 Demo Login Credentials

| Role   | Email                    | Password   |
|--------|--------------------------|------------|
| Admin  | admin@recycledigi.com    | admin123   |
| Seller | rahim@example.com        | seller123  |
| Seller | karim@example.com        | seller123  |
| Buyer  | sumon@example.com        | buyer123   |
| Buyer  | nadia@example.com        | buyer123   |

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint                    | Auth     | Description          |
|--------|-----------------------------|----------|----------------------|
| POST   | /api/auth/register          | Public   | Create account       |
| POST   | /api/auth/login             | Public   | Login                |
| GET    | /api/auth/me                | Required | Get my profile       |
| PUT    | /api/auth/me                | Required | Update profile       |
| PUT    | /api/auth/change-password   | Required | Change password      |

### Auctions
| Method | Endpoint                    | Auth     | Description          |
|--------|-----------------------------|----------|----------------------|
| GET    | /api/auctions               | Optional | List/filter auctions |
| GET    | /api/auctions/:id           | Optional | Get single auction   |
| POST   | /api/auctions               | Seller   | Create auction       |
| PUT    | /api/auctions/:id           | Owner    | Update auction       |
| DELETE | /api/auctions/:id           | Owner    | Delete auction       |
| GET    | /api/auctions/seller/mine   | Seller   | My auctions + stats  |
| GET    | /api/auctions/categories/list| Public  | Category list        |

### Bids
| Method | Endpoint     | Auth     | Description          |
|--------|--------------|----------|----------------------|
| POST   | /api/bids    | Required | Place sealed bid     |
| GET    | /api/bids/my | Required | My bid history       |

### Watchlist
| Method | Endpoint                 | Auth     | Description          |
|--------|--------------------------|----------|----------------------|
| POST   | /api/watchlist/toggle    | Required | Save/unsave auction  |
| GET    | /api/watchlist           | Required | My saved auctions    |

### Chat
| Method | Endpoint                    | Auth     | Description          |
|--------|-----------------------------|----------|----------------------|
| GET    | /api/chat                   | Required | My chat list         |
| GET    | /api/chat/:id               | Owner    | Chat thread          |
| POST   | /api/chat/:id/message       | Owner    | Send message         |
| POST   | /api/chat/open              | Seller   | Open winner chat     |

### Notifications
| Method | Endpoint                       | Auth     | Description          |
|--------|--------------------------------|----------|----------------------|
| GET    | /api/notifications             | Required | My notifications     |
| PUT    | /api/notifications/read-all    | Required | Mark all read        |

### Upload
| Method | Endpoint              | Auth   | Description          |
|--------|-----------------------|--------|----------------------|
| POST   | /api/upload           | Admin  | Upload single image  |
| POST   | /api/upload/multiple  | Admin  | Upload up to 5       |

---

## 🏆 Features

- ✅ Sealed-bid auctions (bids hidden until expiry)
- ✅ Real-time bid updates via Socket.IO
- ✅ Auto-expiry (every 5 min + on page load)
- ✅ Seller dashboard with stats
- ✅ Buyer watchlist & bid history
- ✅ Post-auction winner chat
- ✅ Push notifications (in-app)
- ✅ Bangladesh cities & Dhaka areas
- ✅ Multi-image upload (up to 5)
- ✅ JWT auth with role-based access (BUYER/SELLER/BOTH/ADMIN)
- ✅ Search, filter by category/condition/city/price
- ✅ Ending Soon filter
- ✅ Live countdown timers
- ✅ All prices in Bangladeshi Taka (৳)
- ✅ Responsive design (Digi Store theme)

---

## 🌍 Deploy to Live Server (VPS / Cloud)

```bash
# Install PM2 process manager
npm install -g pm2

# Start app
pm2 start server.js --name recycle-digi

# Auto-restart on reboot
pm2 startup
pm2 save
```

For Nginx reverse proxy, point port 80 → 5000.

---

## 📞 Support

Built with Express + Prisma + PostgreSQL + Socket.IO + Vanilla JS
