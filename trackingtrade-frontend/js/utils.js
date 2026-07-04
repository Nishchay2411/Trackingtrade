// ============================================
// TrackingTrade — Utility Functions
// ============================================

// ── SECURITY: HTML ESCAPING ──
// FIX (Critical XSS): any user-supplied text (names, trade notes, pairs,
// account names, etc.) MUST be passed through this before being placed
// inside innerHTML. Without this, a malicious display name or trade note
// executes as JavaScript in every browser that renders it (e.g. the
// leaderboard renders every user's `name` field to every visitor).
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── THEME ──
function initTheme() {
  const saved = localStorage.getItem('tt_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn();
}
function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('tt_theme', next);
  updateThemeBtn();
}
function updateThemeBtn() {
  const btn = document.getElementById('theme-btn');
  const cur = document.documentElement.getAttribute('data-theme');
  if (btn) btn.textContent = cur === 'dark' ? '☀️' : '🌙';
}

// ── TOAST ──
function showToast(message, type = 'info') {
  const colors = { success:'var(--green)', error:'var(--red)', info:'var(--blue)', warning:'var(--amber)' };
  const icons  = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'tt-toast';
  toast.style.cssText = `border-left:3px solid ${colors[type]};`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── FORMATTERS ──
function formatCurrency(v, symbol = '$') {
  if (v === null || v === undefined) return '—';
  const abs = Math.abs(v);
  const str = abs >= 1000 ? (abs/1000).toFixed(1)+'K' : abs.toFixed(0);
  return (v >= 0 ? '' : '-') + symbol + str;
}
function formatPnL(v) {
  if (v === null || v === undefined) return '—';
  return (v >= 0 ? '+' : '') + '$' + Math.abs(v).toFixed(0);
}
function formatPercent(v) {
  if (v === null || v === undefined) return '—';
  return (v >= 0 ? '+' : '') + parseFloat(v).toFixed(1) + '%';
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}

// ── BADGES ──
function tradeBadge(type) {
  return `<span class="badge badge-${type==='BUY'?'buy':'sell'}">${type}</span>`;
}
function statusBadge(status) {
  const map = { Win:'win', Loss:'loss', Breakeven:'neutral', open:'open', closed:'closed' };
  return `<span class="badge badge-${map[status]||'neutral'}">${status}</span>`;
}
function pnlColor(v) {
  return v > 0 ? 'text-green' : v < 0 ? 'text-red' : 'text-muted';
}

// ── SIDEBAR ──
function initSidebar() {
  const toggle = document.getElementById('sb-toggle');
  const sb     = document.getElementById('sidebar');
  if (toggle && sb) toggle.addEventListener('click', () => sb.classList.toggle('mini'));

  document.querySelectorAll('.sb-item[data-page]').forEach(item => {
    item.addEventListener('click', () => switchPage(item.dataset.page));
  });
}

function switchPage(page) {
  document.querySelectorAll('.tt-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`.sb-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = {
    dashboard:'Dashboard', trades:'Trades', analytics:'Analytics',
    calendar:'Calendar', accounts:'Accounts', ai:'AI Insights',
    leaderboard:'Leaderboard', settings:'Settings'
  };
  const titleEl = document.getElementById('page-title');
  const bcEl    = document.getElementById('bc-page');
  if (titleEl) titleEl.textContent = titles[page] || page;
  if (bcEl)    bcEl.textContent    = '/ ' + (titles[page] || page);
  window.scrollTo(0, 0);
}

// ── USER INFO ──
function fillUserInfo() {
  const user = Auth.getUser();
  if (!user) return;
  const initials = user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'TT';
  document.querySelectorAll('.user-avatar').forEach(el => el.textContent = initials);
  document.querySelectorAll('.user-name').forEach(el  => el.textContent = user.name || '');
  document.querySelectorAll('.user-plan').forEach(el  => el.textContent = (user.plan || 'starter').toUpperCase());
}

// ── LOADER ──
function showLoader(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="tt-loader"><div class="tt-spinner"></div></div>`;
}
function showEmpty(id, icon, title, desc) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="tt-empty"><div class="tt-empty-icon">${icon}</div><h3>${title}</h3><p>${desc}</p></div>`;
}

// ── ALERT ──
function showAlert(msg, type='error', id='alert-box') {
  const el = document.getElementById(id);
  if (el) { el.className = `tt-alert tt-alert-${type}`; el.innerHTML = msg; el.style.display = 'flex'; }
}
function hideAlert(id='alert-box') {
  const el = document.getElementById(id); if (el) el.style.display = 'none';
}

// ── PROGRESS BAR ──
function animateProgress(el, value, delay = 0) {
  if (!el) return;
  setTimeout(() => { el.style.width = Math.min(100, Math.max(0, value)) + '%'; }, delay);
}

// ── GREETING ──
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
