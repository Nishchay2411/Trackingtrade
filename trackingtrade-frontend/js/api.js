// ============================================
// TrackingTrade — API Helper
// ============================================
const API = {
  async request(endpoint, method = 'GET', body = null) {
    const token   = Auth.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    try {
      const res  = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong');
      return data;
    } catch (err) { throw err; }
  },

  // ── AUTH ──
  auth: {
    register:       (d) => API.request('/auth/register',        'POST', d),
    login:          (d) => API.request('/auth/login',           'POST', d),
    me:             ()  => API.request('/auth/me'),
    update:         (d) => API.request('/auth/update',          'PUT',  d),
    changePassword: (d) => API.request('/auth/change-password', 'PUT',  d),
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
