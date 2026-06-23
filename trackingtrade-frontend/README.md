# 📈 TrackingTrade Frontend

Premium Fintech SaaS Trading Journal — Single HTML file, fully connected to backend.

---

## 📁 File Structure

```
trackingtrade-frontend/
├── index.html        ← Complete app (Landing + Auth + All 10 pages)
├── css/
│   └── style.css     ← Premium fintech design + Dark/Light theme
└── js/
    ├── config.js     ← API URL (change this when deploying)
    ├── auth.js       ← JWT auth helpers
    ├── api.js        ← All backend API calls
    └── utils.js      ← Toast, formatters, theme, charts helpers
```

---

## 🚀 How to Run

### Step 1 — Start Backend
```bash
cd trackingtrade-backend
cp .env.example .env   # fill in DB + JWT details
npm install
npm run dev
# Running on http://localhost:5001
```

### Step 2 — Open Frontend
Open `index.html` with **VS Code Live Server**
Or just double-click the file.

### Step 3 — Register & Use
- Go to http://localhost:5500/index.html (or Live Server URL)
- Click **Get Started** → Register
- Start adding trades!

---

## 🎨 Pages Included

| Page | Features |
|---|---|
| Landing | Hero, Features, Pricing, FAQ, CTA |
| Login | JWT auth, redirect on login |
| Register | Create account, validation |
| Dashboard | KPIs, Equity chart, Monthly P&L, Recent trades |
| Trades | Table, Add/Edit/Delete, Filters, Search, Drawer |
| Analytics | Equity curve, Win/Loss, Asset chart, Strategy, Session |
| Calendar | Daily P&L calendar, Monthly stats |
| Accounts | Connect MT4/MT5/cTrader, Balance tracking |
| AI Insights | Scores, Recommendations, Best hours |
| Leaderboard | Global rankings, Points system |
| Settings | Profile, Notifications, Security, Plan |

---

## 🔌 API Connection

All calls go through `js/api.js`. Change the URL in `js/config.js`:

```js
const CONFIG = {
  API_BASE_URL: 'http://localhost:5001/api', // ← Change for production
};
```

---

## 🌐 Deploy

### Frontend → Netlify
1. Go to netlify.com
2. Drag & drop the `trackingtrade-frontend` folder
3. Done! Get URL like: `https://trackingtrade.netlify.app`

### Backend → Railway
1. Push backend to GitHub
2. Connect to Railway
3. Add MySQL + environment variables
4. Update `js/config.js` with Railway URL

---

## ✅ No Hardcoded Data
- All data comes from real backend APIs
- No demo/mock data in the frontend
- Register a real account to use it

---

Built with HTML5 · CSS3 · Vanilla JS · Chart.js · Connected to Node.js + MySQL Backend
