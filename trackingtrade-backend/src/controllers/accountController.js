const db = require('../config/database');

// GET /api/accounts
const getAccounts = async (req, res) => {
  try {
    const [accounts] = await db.query(
      'SELECT * FROM trading_accounts WHERE user_id=? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, count: accounts.length, accounts });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/accounts
const createAccount = async (req, res) => {
  try {
    const { name, broker, platform, account_number, account_type, balance, currency } = req.body;
    if (!name || !broker) return res.status(400).json({ success: false, message: 'Name and broker are required' });

    const [result] = await db.query(
      'INSERT INTO trading_accounts (user_id, name, broker, platform, account_number, account_type, balance, equity, currency) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.user.id, name, broker, platform||'MT5', account_number||'', account_type||'Demo', balance||0, balance||0, currency||'USD']
    );
    res.status(201).json({ success: true, message: 'Account connected!', accountId: result.insertId });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/accounts/:id
const updateAccount = async (req, res) => {
  try {
    const { balance, equity } = req.body;
    await db.query('UPDATE trading_accounts SET balance=?, equity=? WHERE id=? AND user_id=?',
      [balance, equity, req.params.id, req.user.id]);
    res.json({ success: true, message: 'Account updated!' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/accounts/:id
const deleteAccount = async (req, res) => {
  try {
    await db.query('DELETE FROM trading_accounts WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Account removed!' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAccounts, createAccount, updateAccount, deleteAccount };
