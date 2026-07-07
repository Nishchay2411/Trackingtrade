const CONFIG = {
  API_BASE_URL: 'https://trackingtrade-production.up.railway.app/api',
  APP_NAME: 'TrackingTrade',
  // Get this from https://console.cloud.google.com/apis/credentials
  // (same value as GOOGLE_CLIENT_ID in the backend .env — it's public by
  // design, safe to ship in frontend code, unlike the client secret).
  GOOGLE_CLIENT_ID: 'your_google_oauth_client_id_here.apps.googleusercontent.com'
};

// ── DEV OVERRIDE ──
// Uncomment the line below to point to your local backend during development:
// CONFIG.API_BASE_URL = 'http://localhost:5001/api';
