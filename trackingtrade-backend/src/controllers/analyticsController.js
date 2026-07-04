const db = require('../config/database');
const logger = require('../utils/logger');

// GET /api/analytics/overview
const getOverview = async (req, res) => {
  try {
    const uid = req.user.id;

    const [[kpi]] = await db.query(`
      SELECT
        COUNT(*) AS total_trades,
        SUM(CASE WHEN status='closed' AND pnl > 0 THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN status='closed' AND pnl < 0 THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN status='closed' THEN pnl ELSE 0 END) AS total_pnl,
        MAX(pnl) AS best_trade,
        MIN(pnl) AS worst_trade,
        AVG(CASE WHEN status='closed' AND pnl > 0 THEN pnl END) AS avg_win,
        ABS(AVG(CASE WHEN status='closed' AND pnl < 0 THEN pnl END)) AS avg_loss
      FROM trades WHERE user_id = ?
    `, [uid]);

    const totalClosedTrades = (kpi.wins || 0) + (kpi.losses || 0);
    const winRate = totalClosedTrades > 0
      ? ((kpi.wins / totalClosedTrades) * 100).toFixed(1)
      : 0;
    const profitFactor = kpi.avg_loss > 0 ? (kpi.avg_win / kpi.avg_loss).toFixed(2) : 0;

    res.success({
      overview: {
        total_trades:  kpi.total_trades,
        wins:          kpi.wins,
        losses:        kpi.losses,
        win_rate:      parseFloat(winRate),
        total_pnl:     kpi.total_pnl || 0,
        best_trade:    kpi.best_trade || 0,
        worst_trade:   kpi.worst_trade || 0,
        avg_win:       kpi.avg_win || 0,
        avg_loss:      kpi.avg_loss || 0,
        profit_factor: parseFloat(profitFactor),
      }
    });
  } catch (err) {
    logger.error(err);
    res.fail('Server error', 500);
  }
};

// GET /api/analytics/monthly
const getMonthlyPnL = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(open_time, '%Y-%m') AS month,
        SUM(pnl) AS total_pnl,
        COUNT(*) AS trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS wins
      FROM trades
      WHERE user_id = ? AND status = 'closed'
      GROUP BY month
      ORDER BY month ASC
    `, [req.user.id]);

    res.success({ monthly: rows });
  } catch (err) {
    logger.error(err);
    res.fail('Server error', 500);
  }
};

// GET /api/analytics/by-pair
const getByPair = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        pair,
        COUNT(*) AS total_trades,
        SUM(pnl) AS total_pnl,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS wins,
        AVG(pnl) AS avg_pnl
      FROM trades
      WHERE user_id = ? AND status = 'closed'
      GROUP BY pair
      ORDER BY total_pnl DESC
    `, [req.user.id]);

    const data = rows.map(r => ({
      ...r,
      win_rate: r.total_trades > 0 ? ((r.wins / r.total_trades) * 100).toFixed(1) : 0
    }));

    res.success({ by_pair: data });
  } catch (err) {
    logger.error(err);
    res.fail('Server error', 500);
  }
};

// GET /api/analytics/by-strategy
const getByStrategy = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        strategy,
        COUNT(*) AS total_trades,
        SUM(pnl) AS total_pnl,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS wins
      FROM trades
      WHERE user_id = ? AND status = 'closed'
      GROUP BY strategy
      ORDER BY total_pnl DESC
    `, [req.user.id]);

    const data = rows.map(r => ({
      ...r,
      win_rate: r.total_trades > 0 ? ((r.wins / r.total_trades) * 100).toFixed(1) : 0
    }));

    res.success({ by_strategy: data });
  } catch (err) {
    logger.error(err);
    res.fail('Server error', 500);
  }
};

// GET /api/analytics/by-session
const getBySession = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        session,
        COUNT(*) AS total_trades,
        SUM(pnl) AS total_pnl,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS wins
      FROM trades
      WHERE user_id = ? AND status = 'closed'
      GROUP BY session
    `, [req.user.id]);

    const data = rows.map(r => ({
      ...r,
      win_rate: r.total_trades > 0 ? ((r.wins / r.total_trades) * 100).toFixed(1) : 0
    }));

    res.success({ by_session: data });
  } catch (err) {
    logger.error(err);
    res.fail('Server error', 500);
  }
};

// GET /api/analytics/calendar
const getCalendar = async (req, res) => {
  try {
    const { month } = req.query; // e.g. '2025-05'
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.fail('Invalid month format, expected YYYY-MM', 400);
    }
    let query = `
      SELECT
        DATE(open_time) AS date,
        SUM(pnl) AS daily_pnl,
        COUNT(*) AS trades
      FROM trades
      WHERE user_id = ? AND status = 'closed'
    `;
    const params = [req.user.id];
    if (month) { query += ' AND DATE_FORMAT(open_time, "%Y-%m") = ?'; params.push(month); }
    query += ' GROUP BY date ORDER BY date ASC';

    const [rows] = await db.query(query, params);
    res.success({ calendar: rows });
  } catch (err) {
    logger.error(err);
    res.fail('Server error', 500);
  }
};

// GET /api/analytics/equity-curve
const getEquityCurve = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, close_time, pnl
      FROM trades
      WHERE user_id = ? AND status = 'closed' AND close_time IS NOT NULL
      ORDER BY close_time ASC, id ASC
    `, [req.user.id]);

    let equity = 10000;

    const curve = rows.map(r => {
      equity += parseFloat(r.pnl || 0);
      return {
        date: r.close_time,
        equity: Math.round(equity * 100) / 100,
        pnl: r.pnl
      };
    });

    res.success({ equity_curve: curve });
  } catch (err) {
    logger.error(err);
    res.fail('Server error', 500);
  }
};

// FIX Bug 4: Removed duplicate aiController.js code that was pasted here.
// module.exports must only export analytics functions.
module.exports = {
  getOverview,
  getMonthlyPnL,
  getByPair,
  getByStrategy,
  getBySession,
  getCalendar,
  getEquityCurve
};
