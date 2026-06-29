const db = require('../config/database');

const validPlatforms = [
  'MT4',
  'MT5',
  'cTrader',
  'TradeLocker'
];

const validAccountTypes = [
  'Live',
  'Demo',
  'Prop Firm'
];

// ============================================
// GET ALL ACCOUNTS
// GET /api/accounts
// ============================================
const getAccounts = async (req, res) => {
  try {

    const [accounts] = await db.query(
      `
      SELECT *
      FROM trading_accounts
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    res.json({
      success: true,
      count: accounts.length,
      accounts
    });

  } catch (err) {

    console.error('Get Accounts Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================
// CREATE ACCOUNT
// POST /api/accounts
// ============================================
const createAccount = async (req, res) => {
  try {

    const {
      name,
      broker,
      platform,
      account_number,
      account_type,
      balance,
      currency
    } = req.body;

    if (!name || !broker) {
      return res.status(400).json({
        success: false,
        message: 'Name and broker are required'
      });
    }

    if (
      platform &&
      !validPlatforms.includes(platform)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid platform'
      });
    }

    if (
      account_type &&
      !validAccountTypes.includes(account_type)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account type'
      });
    }

    if (
      balance &&
      Number(balance) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Balance cannot be negative'
      });
    }

    // Prevent duplicate account numbers
    if (account_number) {

      const [existing] = await db.query(
        `
        SELECT id
        FROM trading_accounts
        WHERE account_number = ?
        AND user_id = ?
        `,
        [account_number, req.user.id]
      );

      if (existing.length) {
        return res.status(400).json({
          success: false,
          message: 'Account number already exists'
        });
      }
    }

    const [result] = await db.query(
      `
      INSERT INTO trading_accounts
      (
        user_id,
        name,
        broker,
        platform,
        account_number,
        account_type,
        balance,
        equity,
        currency
      )
      VALUES (?,?,?,?,?,?,?,?,?)
      `,
      [
        req.user.id,
        name.trim(),
        broker.trim(),
        platform || 'MT5',
        account_number || '',
        account_type || 'Demo',
        Number(balance) || 0,
        Number(balance) || 0,
        currency || 'USD'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Account connected successfully!',
      accountId: result.insertId
    });

  } catch (err) {

    console.error('Create Account Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================
// UPDATE ACCOUNT
// PUT /api/accounts/:id
// ============================================
const updateAccount = async (req, res) => {
  try {

    const { balance, equity } = req.body;

    const [existing] = await db.query(
      `
      SELECT id
      FROM trading_accounts
      WHERE id = ?
      AND user_id = ?
      `,
      [req.params.id, req.user.id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    if (
      balance !== undefined &&
      Number(balance) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid balance'
      });
    }

    if (
      equity !== undefined &&
      Number(equity) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid equity'
      });
    }

    await db.query(
      `
      UPDATE trading_accounts
      SET
        balance = ?,
        equity = ?
      WHERE id = ?
      AND user_id = ?
      `,
      [
        Number(balance) || 0,
        Number(equity) || 0,
        req.params.id,
        req.user.id
      ]
    );

    res.json({
      success: true,
      message: 'Account updated successfully!'
    });

  } catch (err) {

    console.error('Update Account Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================
// DELETE ACCOUNT
// DELETE /api/accounts/:id
// ============================================
const deleteAccount = async (req, res) => {
  try {

    const [existing] = await db.query(
      `
      SELECT id
      FROM trading_accounts
      WHERE id = ?
      AND user_id = ?
      `,
      [req.params.id, req.user.id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    await db.query(
      `
      DELETE FROM trading_accounts
      WHERE id = ?
      AND user_id = ?
      `,
      [req.params.id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Account removed successfully!'
    });

  } catch (err) {

    console.error('Delete Account Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount
};
