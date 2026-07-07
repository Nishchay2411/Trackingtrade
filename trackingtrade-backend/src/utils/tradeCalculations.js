// ============================================
// TrackingTrade — Pure Trade Calculation Helpers
// ============================================
// Pulled out of tradeController.js so they can be unit tested in
// isolation (no Express req/res, no DB) — see tests/unit/tradeCalculations.test.js.

// ── Calculate P&L ──
function calcPnL(pair, type, entry, exit, lots) {
  const diff = type === 'BUY'
    ? exit - entry
    : entry - exit;

  let contractSize = 100; // Default: Gold (XAUUSD)

  if (pair === 'BTCUSD' || pair === 'ETHUSD') {
    contractSize = 1;
  } else if (pair !== 'XAUUSD') {
    contractSize = 100000;
  }

  return Number((diff * lots * contractSize).toFixed(2));
}

// ── Calculate RR ──
function calcRR(type, entry, exit, sl) {
  if (!sl) return null;
  const reward = type === 'BUY' ? exit - entry : entry - exit;
  const risk   = type === 'BUY' ? entry - sl   : sl - entry;
  if (risk <= 0) return null;
  return `1:${(reward / risk).toFixed(1)}`;
}

// ── Calculate Duration ──
function calcDuration(open_time, close_time) {
  if (!open_time || !close_time) return { duration: null, error: null };
  const ms = new Date(close_time) - new Date(open_time);
  if (ms < 0) {
    return { duration: null, error: 'close_time cannot be before open_time' };
  }
  const hrs  = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return { duration: `${hrs}h ${mins}m`, error: null };
}

module.exports = { calcPnL, calcRR, calcDuration };
