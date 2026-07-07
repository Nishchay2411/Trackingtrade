// ============================================
// TrackingTrade — Auth Helper
// ============================================
const Auth = {
  login(token, user) {
    localStorage.setItem('tt_token', token);
    localStorage.setItem('tt_user', JSON.stringify(user));
  },

  // Used by the silent-refresh flow in api.js to swap in a new access
  // token without touching the stored user object.
  setToken(token) {
    localStorage.setItem('tt_token', token);
  },

  async logout() {
    // FIX (Refresh Tokens): logging out used to only clear localStorage —
    // the refresh token cookie (and its row in the DB) stayed valid, so a
    // copy of that cookie could still mint new access tokens after
    // "logout". Tell the server to revoke it too. Best-effort: if this
    // fails (offline, etc.) we still clear local state and redirect.
    try {
      await API.auth.logout();
    } catch (e) {
      console.warn('Server logout call failed (continuing with local logout):', e.message);
    }
    localStorage.removeItem('tt_token');
    localStorage.removeItem('tt_user');
    window.location.href = 'index.html';
  },

  getToken() {
    return localStorage.getItem('tt_token');
  },

  getUser() {
    const u = localStorage.getItem('tt_user');
    return u ? JSON.parse(u) : null;
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }
};
// NOTE: Forgot/reset password logic lives in index.html (forgotPassword())
// and reset-password.html (doReset()) respectively, next to the markup
// they operate on.
//
// The old Auth.fetch() universal request helper was removed — it was
// dead code (never called from anywhere; the app uses API.request() from
// api.js instead) and its own separate 401-handling logic would have
// conflicted with the silent-refresh-and-retry logic now in api.js.
