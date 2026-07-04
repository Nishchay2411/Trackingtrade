// ============================================
// TrackingTrade — Input Validation
// ============================================
// Kept dependency-free (no joi/zod) on purpose — these are small,
// well-scoped checks and the app doesn't need a schema library yet.
// Each function returns { valid: boolean, message?: string }.

const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE  = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
// FIX: `pair` had no server-side format check at all — any string was
// accepted and written straight into the trades table, which also fed
// the earlier XSS surface. Real trading pairs are short, uppercase,
// alphanumeric symbols (EURUSD, XAUUSD, BTCUSD, US30, etc).
const PAIR_RE       = /^[A-Z0-9]{2,10}$/;
const VALID_TYPES    = ['BUY', 'SELL'];
const VALID_SESSIONS = ['Asian', 'London', 'New York', 'London/NY', 'Asian/London'];
const VALID_STRATEGIES = ['Trend Follow', 'Breakout', 'Reversal', 'Scalp', 'Swing', 'Other'];
const VALID_PLATFORMS = ['MT4', 'MT5', 'cTrader', 'TradeLocker'];
const VALID_ACCOUNT_TYPES = ['Live', 'Demo', 'Prop Firm'];

const ok = () => ({ valid: true });
const bad = (message) => ({ valid: false, message });

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email) && email.length <= 100;
}

function isValidPassword(password) {
  return typeof password === 'string' && PASSWORD_RE.test(password);
}

function validateRegisterInput({ name, email, password }) {
  if (!name || !email || !password) return bad('Name, email and password are required');
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return bad('Name must be between 2 and 100 characters');
  }
  if (!isValidEmail(email)) return bad('Please enter a valid email address');
  if (!isValidPassword(password)) {
    return bad('Password must be 8+ chars with uppercase, lowercase, number and special character');
  }
  return ok();
}

function validateTradeInput(body, { partial = false } = {}) {
  const { pair, type, lots, entry_price, exit_price, stop_loss, take_profit, session, strategy, open_time, close_time, notes } = body;

  if (!partial) {
    if (!pair || !type || lots === undefined || entry_price === undefined || !open_time) {
      return bad('Pair, type, lots, entry price and open time are required');
    }
  }

  if (pair !== undefined && !PAIR_RE.test(String(pair).toUpperCase())) {
    return bad('Pair must be 2-10 uppercase letters/numbers (e.g. EURUSD, XAUUSD, BTCUSD)');
  }
  if (type !== undefined && !VALID_TYPES.includes(type)) {
    return bad('Invalid trade type');
  }
  if (session !== undefined && session && !VALID_SESSIONS.includes(session)) {
    return bad('Invalid session');
  }
  if (strategy !== undefined && strategy && !VALID_STRATEGIES.includes(strategy)) {
    return bad('Invalid strategy');
  }
  if (lots !== undefined && (isNaN(lots) || lots <= 0 || lots > 1000)) {
    return bad('Lot size must be between 0 and 1000');
  }
  if (entry_price !== undefined && (isNaN(entry_price) || entry_price <= 0)) {
    return bad('Entry price must be greater than zero');
  }
  if (exit_price !== undefined && exit_price !== null && exit_price !== '' && (isNaN(exit_price) || exit_price < 0)) {
    return bad('Exit price must be a positive number');
  }
  if (stop_loss !== undefined && stop_loss !== null && stop_loss !== '' && isNaN(stop_loss)) {
    return bad('Stop loss must be a number');
  }
  if (take_profit !== undefined && take_profit !== null && take_profit !== '' && isNaN(take_profit)) {
    return bad('Take profit must be a number');
  }
  if (notes !== undefined && notes && String(notes).length > 2000) {
    return bad('Notes must be under 2000 characters');
  }
  if (open_time !== undefined && isNaN(new Date(open_time).getTime())) {
    return bad('Invalid open time');
  }
  if (close_time && isNaN(new Date(close_time).getTime())) {
    return bad('Invalid close time');
  }

  return ok();
}

function validateAccountInput({ name, broker, platform, account_type, balance }) {
  if (!name || !broker) return bad('Name and broker are required');
  if (String(name).length > 100 || String(broker).length > 100) {
    return bad('Name and broker must be under 100 characters');
  }
  if (platform && !VALID_PLATFORMS.includes(platform)) return bad('Invalid platform');
  if (account_type && !VALID_ACCOUNT_TYPES.includes(account_type)) return bad('Invalid account type');
  if (balance !== undefined && balance !== null && balance !== '' && isNaN(balance)) {
    return bad('Balance must be a number');
  }
  return ok();
}

module.exports = {
  isValidEmail,
  isValidPassword,
  validateRegisterInput,
  validateTradeInput,
  validateAccountInput,
  VALID_TYPES,
  VALID_SESSIONS,
  VALID_STRATEGIES,
};
