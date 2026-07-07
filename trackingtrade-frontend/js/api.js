// ============================================
// TrackingTrade — API Helper
// ============================================
const API = {
  async request(endpoint, method = 'GET', body = null, _isRetry = false) {
    const token   = Auth.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = {
      method,
      headers,
      // FIX (Refresh Tokens): the refresh token lives in an httpOnly
      // cookie, which the browser only sends/accepts cross-site if the
      // request opts in with credentials:'include' (and the backend CORS
      // config allows it — already set to credentials:true there).
      credentials: 'include'
    };
    if (body) options.body = JSON.stringify(body);

    const res  = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // FIX: access tokens are now short-lived (15m) instead of 7 days,
      // so they expire mid-session far more often. Rather than kicking
      // the user out every 15 minutes, try one silent refresh (using the
      // httpOnly cookie) and transparently retry the original request.
      // Skip this for the auth endpoints that would otherwise create a
      // retry loop or make no sense to retry (login/register/google
      // failures are real credential errors, not expiry).
      const skipRetryFor = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/google', '/auth/logout'];
      const shouldTryRefresh = res.status === 401 && token && !_isRetry && !skipRetryFor.includes(endpoint);

      if (shouldTryRefresh) {
        const refreshed = await API._silentRefresh();
        if (refreshed) {
          return API.request(endpoint, method, body, true);
        }
        // Refresh also failed — the session is truly over.
        Auth.logout();
        return Promise.reject(new Error('Session expired. Please login again.'));
      }

      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  },

  // Calls /auth/refresh directly (bypassing API.request to avoid
  // recursion) and, on success, stores the new access token.
  async _silentRefresh() {
    try {
      const res  = await fetch(`${CONFIG.API_BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        Auth.setToken(data.token);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  // ── AUTH ──
  auth: {
    register:           (d) => API.request('/auth/register',            'POST', d),
    login:              (d) => API.request('/auth/login',               'POST', d),
    google:             (d) => API.request('/auth/google',              'POST', d),
    logout:             ()  => API.request('/auth/logout',              'POST'),
    me:                 ()  => API.request('/auth/me'),
    update:             (d) => API.request('/auth/update',              'PUT',  d),
    changePassword:     (d) => API.request('/auth/change-password',     'PUT',  d),
    forgotPassword:     (d) => API.request('/auth/forgot-password',     'POST', d),
    resetPassword:      (d) => API.request('/auth/reset-password',      'POST', d),
    resendVerification: (d) => API.request('/auth/resend-verification', 'POST', d),
  },

  // ── TRADES ──
  trades: {
    getAll:  (q='') => API.request(`/trades${q}`),
    getOne:  (id)   => API.request(`/trades/${id}`),
    create:  (d)    => API.request('/trades',        'POST',   d),
    update:  (id,d) => API.request(`/trades/${id}`,  'PUT',    d),
    delete:  (id)   => API.request(`/trades/${id}`,  'DELETE'),
  },

  // ── ANALYTICS ──
  analytics: {
    overview:    () => API.request('/analytics/overview'),
    monthly:     () => API.request('/analytics/monthly'),
    byPair:      () => API.request('/analytics/by-pair'),
    byStrategy:  () => API.request('/analytics/by-strategy'),
    bySession:   () => API.request('/analytics/by-session'),
    calendar:    (m) => API.request(`/analytics/calendar${m?'?month='+m:''}`),
    equityCurve: () => API.request('/analytics/equity-curve'),
  },

  // ── AI ──
  ai: {
    insights:  ()  => API.request('/ai/insights'),
    generate:  ()  => API.request('/ai/generate',  'POST'),
    scores:    ()  => API.request('/ai/scores'),
    markRead:  (id)=> API.request(`/ai/insights/${id}/read`, 'PATCH'),
  },

  // ── ACCOUNTS ──
  accounts: {
    getAll:  ()      => API.request('/accounts'),
    create:  (d)     => API.request('/accounts',        'POST',   d),
    update:  (id, d) => API.request(`/accounts/${id}`,  'PUT',    d),
    delete:  (id)    => API.request(`/accounts/${id}`,  'DELETE'),
  },

  // ── LEADERBOARD ──
  leaderboard: {
    get:    (m) => API.request(`/leaderboard${m?'?month='+m:''}`),
    update: ()  => API.request('/leaderboard/update', 'POST'),
  },
};
