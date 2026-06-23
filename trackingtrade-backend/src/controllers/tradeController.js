const db = require('../config/database');

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
const calcDuration = (open_time, close_time, res) => {
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

    if (pair)     { query += ' AND t.pair = ?';     params.push(pair); }
    if (type)     { query += ' AND t.type = ?';     params.push(type); }
    if (status)   { query += ' AND t.status = ?';   params.push(status); }
    if (strategy) { query += ' AND t.strategy = ?'; params.push(strategy); }
    if (session)  { query += ' AND t.session = ?';  params.push(session); }
    if (from)     { query += ' AND DATE(t.open_time) >= ?'; params.push(from); }
    if (to)       { query += ' AND DATE(t.open_time) <= ?'; params.push(to); }

    query += ' ORDER BY t.open_time DESC';

    const [trades] = await db.query(query, params);
    res.json({ success: true, count: trades.length, trades });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/trades/:id
const getTrade = async (req, res) => {
  try {
    const [trades] = await db.query(
      'SELECT * FROM trades WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!trades.length) return res.status(404).json({ success: false, message: 'Trade not found' });
    res.json({ success: true, trade: trades[0] });
  } catch (err) {  // FIX: was `catch {` — error was swallowed silently
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/trades
const createTrade = async (req, res) => {
  try {
    const { account_id, pair, type, lots, entry_price, exit_price, stop_loss, take_profit,
            open_time, close_time, strategy, session, notes } = req.body;

    if (!pair || !type || !lots || !entry_price || !open_time)
      return res.status(400).json({ success: false, message: 'Pair, type, lots, entry price and open time are required' });

// Trade validation
const validTypes = ['BUY', 'SELL'];
const validSessions = ['London', 'New York', 'Tokyo', 'Sydney'];

if (!validTypes.includes(type)) {
  return res.status(400).json({
    success: false,
    message: 'Invalid trade type'
  });
}

if (session && !validSessions.includes(session)) {
  return res.status(400).json({
    success: false,
    message: 'Invalid session'
  });
}

if (lots <= 0 || lots > 1000) {
  return res.status(400).json({
    success: false,
    message: 'Invalid lot size'
  });
}

if (entry_price <= 0) {
  return res.status(400).json({
    success: false,
    message: 'Entry price must be greater than zero'
  });
}

// Account ownership check
if (account_id) {
  const [accounts] = await db.query(
    'SELECT id FROM trading_accounts WHERE id=? AND user_id=?',
    [account_id, req.user.id]
  );

  if (!accounts.length) {
    return res.status(403).json({
      success: false,
      message: 'Invalid trading account'
    });
  }
}


    const status   = exit_price ? 'closed' : 'open';
    // FIX: was calcPnL(type, ...) — first arg must be `pair` for correct contract size
    const pnl      = exit_price ? calcPnL(pair, type, parseFloat(entry_price), parseFloat(exit_price), parseFloat(lots)) : 0;
    const rr_ratio = exit_price && stop_loss ? calcRR(type, parseFloat(entry_price), parseFloat(exit_price), parseFloat(stop_loss)) : null;

    // FIX: validate that close_time is not before open_time
    const { duration, error } = calcDuration(open_time, close_time);
    if (error) return res.status(400).json({ success: false, message: error });

    const [result] = await db.query(
      `INSERT INTO trades (user_id, account_id, pair, type, lots, entry_price, exit_price,
       stop_loss, take_profit, pnl, rr_ratio, duration, open_time, close_time,
       status, strategy, session, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, account_id || null, pair, type, lots, entry_price, exit_price || null,
       stop_loss || null, take_profit || null, pnl, rr_ratio, duration,
       open_time, close_time || null, status, strategy || 'Other', session || 'London', notes || '']
    );

    res.status(201).json({
      success: true,
      message: 'Trade logged successfully!',
      tradeId: result.insertId,
      pnl,
      rr_ratio,
      status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/trades/:id
const updateTrade = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT id FROM trades WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Trade not found' });

    const { account_id, pair, type, lots, entry_price, exit_price, stop_loss, take_profit,
            open_time, close_time, strategy, session, notes } = req.body;

    // FIX: was calcPnL(type, ...) — first arg must be `pair` for correct contract size
    const pnl      = exit_price ? calcPnL(pair, type, parseFloat(entry_price), parseFloat(exit_price), parseFloat(lots)) : 0;
    const rr_ratio = exit_price && stop_loss ? calcRR(type, parseFloat(entry_price), parseFloat(exit_price), parseFloat(stop_loss)) : null;
    const status   = exit_price ? 'closed' : 'open';

    // FIX: validate that close_time is not before open_time
    const { duration, error } = calcDuration(open_time, close_time);
    if (error) return res.status(400).json({ success: false, message: error });

    // FIX: added account_id to UPDATE — it was missing, so account couldn't be changed
    await db.query(
      `UPDATE trades SET pair=?, type=?, lots=?, entry_price=?, exit_price=?, stop_loss=?,
       take_profit=?, pnl=?, rr_ratio=?, duration=?, open_time=?, close_time=?,
       status=?, strategy=?, session=?, notes=?, account_id=? WHERE id=?`,
      [pair, type, lots, entry_price, exit_price || null, stop_loss || null, take_profit || null,
       pnl, rr_ratio, duration, open_time, close_time || null, status, strategy, session, notes,
       account_id || null, req.params.id]
    );

    res.json({ success: true, message: 'Trade updated!', pnl, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/trades/:id
const deleteTrade = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT id FROM trades WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Trade not found' });
    await db.query('DELETE FROM trades WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Trade deleted!' });
  } catch (err) {  // FIX: was `catch {` — error was swallowed silently
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAllTrades, getTrade, createTrade, updateTrade, deleteTrade };
