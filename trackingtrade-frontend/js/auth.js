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
// ============================================
// FORGOT PASSWORD
// ============================================

async function doForgot() {
  const email = document.getElementById('forgot-email').value.trim();

  if (!email) {
    return alert('Please enter your email');
  }

  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/auth/forgot-password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      }
    );

    const data = await response.json();

    alert(data.message);

    if (data.success) {
      showPage('login');
    }

  } catch (err) {
    console.error(err);
    alert('Something went wrong');
  }
}

// ============================================
// RESET PASSWORD
// ============================================

async function doResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const password =
    document.getElementById('reset-password').value;

  if (!password) {
    return alert('Please enter new password');
  }

  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/auth/reset-password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          password
        })
      }
    );

    const data = await response.json();

    alert(data.message);

    if (data.success) {
      window.location.href = 'index.html';
    }

  } catch (err) {
    console.error(err);
    alert('Something went wrong');
  }
}