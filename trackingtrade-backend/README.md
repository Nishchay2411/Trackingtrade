# 📈 TrackingTrade Backend API

Complete REST API for TrackingTrade — AI Trading Journal & Analytics Platform

---

## 🚀 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Setup MySQL Database
```bash
mysql -u root -p < database.sql
```

### 3. Create .env file
```bash
cp .env.example .env
```
Fill in your MySQL password, JWT secret, and OpenAI API key.

### 4. Start server
```bash
npm run dev    # development
npm start      # production
```

Server runs at: **http://localhost:5001**

---

## 📋 All API Endpoints

### 🔐 Auth `/api/auth`
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Create account | ❌ |
| POST | `/login` | Login | ❌ |
| GET | `/me` | Get my profile | ✅ |
| PUT | `/update` | Update profile | ✅ |
| PUT | `/change-password` | Change password | ✅ |

### 📊 Trades `/api/trades`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all trades (with filters: pair, type, strategy, from, to) |
| GET | `/:id` | Get single trade |
| POST | `/` | Log new trade (auto-calculates P&L and RR) |
| PUT | `/:id` | Edit trade |
| DELETE | `/:id` | Delete trade |

### 📈 Analytics `/api/analytics`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/overview` | Total P&L, win rate, profit factor |
| GET | `/monthly` | Monthly P&L breakdown |
| GET | `/by-pair` | Performance per currency pair |
| GET | `/by-strategy` | Win rate per strategy |
| GET | `/by-session` | Performance per session |
| GET | `/calendar` | Daily P&L for calendar view |
| GET | `/equity-curve` | Cumulative equity over time |

### 🤖 AI Insights `/api/ai`
| Method | Endpoint | Description | Plan |
|--------|----------|-------------|------|
| GET | `/insights` | Get saved insights | All |
| POST | `/generate` | Generate new AI insights | Pro/Elite |
| GET | `/scores` | Get performance scores | All |
| PATCH | `/insights/:id/read` | Mark insight as read | All |

### 🏦 Accounts `/api/accounts`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get my broker accounts |
| POST | `/` | Connect new account |
| PUT | `/:id` | Update balance/equity |
| DELETE | `/:id` | Remove account |

### 🏆 Leaderboard `/api/leaderboard`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/?month=2025-05` | Get monthly rankings |
| POST | `/update` | Update my monthly stats |

---

## 🔐 Auth Header
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 📁 Folder Structure
```
trackingtrade-backend/
├── src/
│   ├── server.js
│   ├── config/database.js
│   ├── middleware/auth.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── tradeController.js      ← Auto P&L + RR calculation
│   │   ├── analyticsController.js  ← Equity curve, monthly, by-pair
│   │   ├── aiController.js         ← OpenAI integration
│   │   ├── accountController.js
│   │   └── leaderboardController.js
│   └── routes/
├── database.sql
├── .env.example
└── package.json
```

---

Built with ❤️ — Node.js + Express + MySQL + OpenAI
