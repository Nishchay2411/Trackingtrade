const db = require('../config/database');
const logger = require('../utils/logger');
const { validateAccountInput } = require('../utils/validators');

// GET /api/accounts
const getAccounts = async (req, res) => {
  try {
    const [accounts] = await db.query(
      'SELECT * FROM trading_accounts WHERE user_id=? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.success({ count: accounts.length, accounts });
  } catch (err) {
    logger.error('getAccounts error:', err);
    res.fail('Server error', 500);
  }
};

// POST /api/accounts
const createAccount = async (req, res) => {
  try {
    const { name, broker, platform, account_number, account_type, balance, currency } = req.body;

    const check = validateAccountInput(req.body);
    if (!check.valid) return res.fail(check.message, 400);

    const [result] = await db.query(
      'INSERT INTO trading_accounts (user_id, name, broker, platform, account_number, account_type, balance, equity, currency) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.user.id, name.trim(), broker.trim(), platform || 'MT5', account_number || '', account_type || 'Demo', balance || 0, balance || 0, currency || 'USD']
    );
    res.success({ accountId: result.insertId }, 'Account connected!', 201);
  } catch (err) {
    logger.error('createAccount error:', err);
    res.fail('Server error', 500);
  }
};

// PUT /api/accounts/:id
const updateAccount = async (req, res) => {
  try {
    const { balance, equity } = req.body;

    if (balance !== undefined && isNaN(balance)) return res.fail('Balance must be a number', 400);
    if (equity  !== undefined && isNaN(equity))  return res.fail('Equity must be a number', 400);

    const [result] = await db.query(
      'UPDATE trading_accounts SET balance=?, equity=? WHERE id=? AND user_id=?',
      [balance, equity, req.params.id, req.user.id]
    );

    // FIX: previously returned "Account updated!" even if the account
    // didn't exist or belonged to someone else (0 rows affected).
    if (result.affectedRows === 0) return res.fail('Account not found', 404);

    res.success({}, 'Account updated!');
  } catch (err) {
    logger.error('updateAccount error:', err);
    res.fail('Server error', 500);
  }
};

// DELETE /api/accounts/:id
const deleteAccount = async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM trading_accounts WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) return res.fail('Account not found', 404);

    res.success({}, 'Account removed!');
  } catch (err) {
    logger.error('deleteAccount error:', err);
    res.fail('Server error', 500);
  }
};

module.exports = { getAccounts, createAccount, updateAccount, deleteAccount };
