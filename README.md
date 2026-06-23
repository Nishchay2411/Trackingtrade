# 📈 TrackingTrade

An AI-Powered Trading Journal & Analytics Platform that helps traders track, analyze, and improve their trading performance through intelligent insights, detailed analytics, and account management.

## 🚀 Features

### 🔐 Authentication

* User Registration
* Secure Login
* JWT Authentication
* Protected Routes

### 📊 Trade Management

* Add Trades
* Edit Trades
* Delete Trades
* Trade History Tracking
* Performance Monitoring

### 💼 Trading Accounts

* Multiple Trading Accounts
* Broker Management
* Account Performance Tracking
* Account-wise Analytics

### 📈 Analytics Dashboard

* Win Rate Analysis
* Profit & Loss Tracking
* Risk/Reward Analysis
* Trading Statistics
* Performance Metrics

### 🏆 Leaderboard

* Trader Rankings
* Performance Comparison
* Community Competition

### 🤖 AI Insights

* Trading Pattern Analysis
* Performance Recommendations
* Smart Trading Insights
* Data-Driven Suggestions

---

## 🛠️ Tech Stack

### Frontend

* HTML5
* CSS3
* JavaScript (ES6)

### Backend

* Node.js
* Express.js

### Database

* MySQL

### Authentication

* JSON Web Tokens (JWT)
* bcrypt.js

### Deployment

* Frontend: Vercel
* Backend: Railway
* Database: Railway MySQL

---

## 📂 Project Structure

```bash
TrackingTrade/
│
├── trackingtrade-frontend/
│   ├── css/
│   ├── js/
│   └── index.html
│
├── trackingtrade-backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── server.js
│   │
│   ├── database.sql
│   ├── package.json
│   └── .env.example
│
└── README.md
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/Nishchay2411/Trackingtrade.git
cd Trackingtrade
```

### Backend Setup

```bash
cd trackingtrade-backend
npm install
```

Create a `.env` file:

```env
PORT=5001

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=trackingtrade

JWT_SECRET=your_secret_key
```

Run Backend:

```bash
npm start
```

### Frontend Setup

Open:

```bash
trackingtrade-frontend/index.html
```

Or run using Live Server.

---

## 🗄️ Database Setup

Create MySQL database:

```sql
CREATE DATABASE trackingtrade;
```

Import:

```bash
database.sql
```

This will create:

* users
* trades
* trading_accounts
* leaderboard
* ai_insights

---

## 🌐 Live Demo

Frontend:
https://trackingtrade.vercel.app

Backend:
https://trackingtrade-production.up.railway.app

---

## 📸 Screenshots

Add screenshots here:

* Login Page
* Register Page
* Dashboard
* Trade History
* Analytics Dashboard
* Leaderboard

---

## 👨‍💻 Author

Nishchay Choudhary

* GitHub: https://github.com/Nishchay2411
* LinkedIn: https://www.linkedin.com/in/nishchay-choudhary-02b6b9372

---

## ⭐ Future Improvements

* Advanced AI Trade Analysis
* Trading Journal Export
* Portfolio Tracking
* Dark Mode
* Real-Time Market Integration
* TradingView Integration
* Mobile Application

---

## 📜 License

This project is licensed under the MIT License.
