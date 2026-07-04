// ============================================
// TrackingTrade — Auth Helper
// ============================================
const Auth = {
  login(token, user) {
    localStorage.setItem('tt_token', token);
    localStorage.setItem('tt_user', JSON.stringify(user));
  },

  logout() {
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
  },

  // Universal API request helper
  async fetch(url, options = {}) {
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Token expired or invalid
    if (response.status === 401) {
      alert('Session expired. Please login again.');
      this.logout();
      return null;
    }

    return response;
  }
};
// NOTE: Forgot/reset password logic lives in index.html (forgotPassword())
// and reset-password.html (doReset()) respectively, next to the markup
// they operate on. The duplicate doForgot()/doResetPassword() that used to
// live here were dead code — never called from anywhere — and one of them
// was silently overriding a same-named (also broken) function in
// index.html because of script load order. Removed to avoid this trap
// happening again.