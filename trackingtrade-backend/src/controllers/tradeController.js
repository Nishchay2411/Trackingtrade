const db = require('../config/database');
const logger = require('../utils/logger');
const { validateTradeInput } = require('../utils/validators');

// ── Helper: Calculate P&L ──
const calcPnL = (pair, type, entry, exit, lots) => {
  const diff = type === 'BUY'
    ? exit - entry
    : entry - exit;

  let contractSize = 100; // Default: Gold (XAUUSD)

  // Crypto
  if (pair === 'BTCUSD' || pair === 'ETHUSD') {
    contractSize = 1;
  }
  // Forex (anything that isn't Gold or Crypto)
  else if (pair !== 'XAUUSD') {
    contractSize = 100000;
  }

  return Number((diff * lots * contractSize).toFixed(2));
};

// ── Helper: Calculate RR ──
const calcRR = (type, entry, exit, sl) => {
  if (!sl) return null;
  const reward = type === 'BUY' ? exit - entry : entry - exit;
  const risk   = type === 'BUY' ? entry - sl   : sl - entry;
  if (risk <= 0) return null;
  return `1:${(reward / risk).toFixed(1)}`;
};

// ── Helper: Calculate Duration ──
const calcDuration = (open_time, close_time) => {
  if (!open_time || !close_time) return { duration: null, error: null };
  const ms = new Date(close_time) - new Date(open_time);
  if (ms < 0) {
    return { duration: null, error: 'close_time cannot be before open_time' };
  }
  const hrs  = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return { duration: `${hrs}h ${mins}m`, error: null };
};

// GET /api/trades  — with filters
const getAllTrades = async (req, res) => {
  try {
    const { pair, type, status, strategy, session, from, to } = req.query;
    let query = 'SELECT t.*, ta.name AS account_name FROM trades t LEFT JOIN trading_accounts ta ON t.account_id = ta.id WHERE t.user_id = ?';
    const params = [req.user.id];

    if (pair)     { query += ' AND t.pair = ?';                    params.push(pair); }
    if (type)     { query += ' AND t.type = ?';                    params.push(type); }
    if (status)   { query += ' AND t.status = ?';                  params.push(status); }
    if (strategy) { query += ' AND t.strategy = ?';                params.push(strategy); }
    if (session)  { query += ' AND t.session = ?';                 params.push(session); }
    if (from)     { query += ' AND DATE(t.open_time) >= ?';        params.push(from); }
    if (to)       { query += ' AND DATE(t.open_time) <= ?';        params.push(to); }

    query += ' ORDER BY t.open_time DESC';

    const [trades] = await db.query(query, params);
    res.success({ count: trades.length, trades });
  } catch (err) {
    logger.error('getAllTrades error:', err);
    res.fail('Server error', 500);
  }
};

// GET /api/trades/:id
const getTrade = async (req, res) => {
  try {
    const [trades] = await db.query(
      'SELECT * FROM trades WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!trades.length) return res.fail('Trade not found', 404);
    res.success({ trade: trades[0] });
  } catch (err) {
    logger.error('getTrade error:', err);
    res.fail('Server error', 500);
  }
};

// POST /api/trades
const createTrade = async (req, res) => {
  try {
    const {
      account_id, pair, type, lots, entry_price, exit_price,
      stop_loss, take_profit, open_time, close_time,
      strategy, session, notes
    } = req.body;

    // FIX (Item 8 — Input Validation): centralized validation, including
    // a real format check on `pair` which previously accepted any string
    // at all (also closes off part of the earlier XSS surface at the source).
    const check = validateTradeInput(req.body);
    if (!check.valid) return res.fail(check.message, 400);

    const normalizedPair = String(pair).toUpperCase();

    // Account ownership check
    if (account_id) {
      const [accounts] = await db.query(
        'SELECT id FROM trading_accounts WHERE id=? AND user_id=?',
        [account_id, req.user.id]
      );
      if (!accounts.length) {
        return res.fail('Invalid trading account', 403);
      }
    }

    const status   = exit_price ? 'closed' : 'open';
    const pnl      = exit_price ? calcPnL(normalizedPair, type, parseFloat(entry_price), parseFloat(exit_price), parseFloat(lots)) : 0;
    const rr_ratio = exit_price && stop_loss ? calcRR(type, parseFloat(entry_price), parseFloat(exit_price), parseFloat(stop_loss)) : null;

    const { duration, error } = calcDuration(open_time, close_time);
    if (error) return res.fail(error, 400);

    const [result] = await db.query(
      `INSERT INTO trades (user_id, account_id, pair, type, lots, entry_price, exit_price,
       stop_loss, take_profit, pnl, rr_ratio, duration, open_time, close_time,
       status, strategy, session, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id, account_id || null, normalizedPair, type, lots, entry_price,
        exit_price || null, stop_loss || null, take_profit || null,
        pnl, rr_ratio, duration, open_time, close_time || null,
        status, strategy || 'Other', session || 'London', notes || ''
      ]
    );

    res.success({ tradeId: result.insertId, pnl, rr_ratio, status }, 'Trade logged successfully!', 201);
  } catch (err) {
    logger.error('createTrade error:', err);
    res.fail('Server error', 500);
  }
};

// PUT /api/trades/:id
const updateTrade = async (req, res) => {
  try {
    const [existing] = await db.query(
      'SELECT id FROM trades WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    );
    if (!existing.length) return res.fail('Trade not found', 404);

    const {
      account_id, pair, type, lots, entry_price, exit_price,
      stop_loss, take_profit, open_time, close_time,
      strategy, session, notes
    } = req.body;

    const check = validateTradeInput(req.body, { partial: true });
    if (!check.valid) return res.fail(check.message, 400);

    const normalizedPair = pair !== undefined ? String(pair).toUpperCase() : pair;

    // Account ownership check
    if (account_id) {
      const [accounts] = await db.query(
        'SELECT id FROM trading_accounts WHERE id=? AND user_id=?',
        [account_id, req.user.id]
      );
      if (!accounts.length) {
        return res.fail('Invalid trading account', 403);
      }
    }

    const pnl      = exit_price ? calcPnL(normalizedPair, type, parseFloat(entry_price), parseFloat(exit_price), parseFloat(lots)) : 0;
    const rr_ratio = exit_price && stop_loss ? calcRR(type, parseFloat(entry_price), parseFloat(exit_price), parseFloat(stop_loss)) : null;
    const status   = exit_price ? 'closed' : 'open';

    const { duration, error } = calcDuration(open_time, close_time);
    if (error) return res.fail(error, 400);

    await db.query(
      `UPDATE trades SET pair=?, type=?, lots=?, entry_price=?, exit_price=?, stop_loss=?,
       take_profit=?, pnl=?, rr_ratio=?, duration=?, open_time=?, close_time=?,
       status=?, strategy=?, session=?, notes=?, account_id=? WHERE id=?`,
      [
        normalizedPair, type, lots, entry_price, exit_price || null, stop_loss || null,
        take_profit || null, pnl, rr_ratio, duration, open_time, close_time || null,
        status, strategy, session, notes, account_id || null, req.params.id
      ]
    );

    res.success({ pnl, status }, 'Trade updated!');
  } catch (err) {
    logger.error('updateTrade error:', err);
    res.fail('Server error', 500);
  }
};

// DELETE /api/trades/:id
const deleteTrade = async (req, res) => {
  try {
    const [existing] = await db.query(
      'SELECT id FROM trades WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    );
    if (!existing.length) return res.fail('Trade not found', 404);
    await db.query('DELETE FROM trades WHERE id=?', [req.params.id]);
    res.success({}, 'Trade deleted!');
  } catch (err) {
    logger.error('deleteTrade error:', err);
    res.fail('Server error', 500);
  }
};

module.exports = { getAllTrades, getTrade, createTrade, updateTrade, deleteTrade };
