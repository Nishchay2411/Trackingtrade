const db = require('../config/database');

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

        ABS(AVG(CASE WHEN status='closed' AND pnl < 0 THEN pnl END)) AS avg_loss,

        SUM(CASE WHEN status='closed' AND pnl > 0 THEN pnl ELSE 0 END) AS gross_profit,

        ABS(SUM(CASE WHEN status='closed' AND pnl < 0 THEN pnl ELSE 0 END)) AS gross_loss

      FROM trades
      WHERE user_id = ?
    `, [uid]);

    const wins = Number(kpi.wins || 0);
    const losses = Number(kpi.losses || 0);

    const totalClosedTrades = wins + losses;

    const winRate = totalClosedTrades > 0
      ? ((wins / totalClosedTrades) * 100).toFixed(1)
      : 0;

    const profitFactor =
      Number(kpi.gross_loss) > 0
        ? (kpi.gross_profit / kpi.gross_loss).toFixed(2)
        : 0;

    res.json({
      success: true,
      overview: {
        total_trades: Number(kpi.total_trades || 0),
        wins,
        losses,
        win_rate: parseFloat(winRate),

        total_pnl: Number(kpi.total_pnl || 0),

        best_trade: Number(kpi.best_trade || 0),

        worst_trade: Number(kpi.worst_trade || 0),

        avg_win: Number(kpi.avg_win || 0),

        avg_loss: Number(kpi.avg_loss || 0),

        profit_factor: parseFloat(profitFactor)
      }
    });

  } catch (err) {
    console.error('Overview Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
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
      WHERE user_id = ?
      AND status = 'closed'
      GROUP BY month
      ORDER BY month ASC
    `, [req.user.id]);

    const data = rows.map(r => ({
      ...r,

      total_pnl: Number(r.total_pnl || 0),

      win_rate:
        r.trades > 0
          ? Number(((r.wins / r.trades) * 100).toFixed(1))
          : 0
    }));

    res.json({
      success: true,
      monthly: data
    });

  } catch (err) {
    console.error('Monthly Analytics Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
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
  pair: r.pair,
  total_trades: Number(r.total_trades || 0),
  total_pnl: Number(r.total_pnl || 0),
  wins: Number(r.wins || 0),
  avg_pnl: Number(r.avg_pnl || 0),
  win_rate:
    Number(r.total_trades) > 0
      ? Number(((r.wins / r.total_trades) * 100).toFixed(1))
      : 0
}));

    res.json({ success: true, by_pair: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
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
  strategy: r.strategy,
  total_trades: Number(r.total_trades || 0),
  total_pnl: Number(r.total_pnl || 0),
  wins: Number(r.wins || 0),
  win_rate:
    Number(r.total_trades) > 0
      ? Number(((r.wins / r.total_trades) * 100).toFixed(1))
      : 0
}));

    res.json({ success: true, by_strategy: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
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
  session: r.session,
  total_trades: Number(r.total_trades || 0),
  total_pnl: Number(r.total_pnl || 0),
  wins: Number(r.wins || 0),
  win_rate:
    Number(r.total_trades) > 0
      ? Number(((r.wins / r.total_trades) * 100).toFixed(1))
      : 0
}));
    res.json({ success: true, by_session: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/analytics/calendar
const getCalendar = async (req, res) => {
  try {

    const { month } = req.query;

    if (
      month &&
      !/^\d{4}-\d{2}$/.test(month)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format. Use YYYY-MM'
      });
    }

    let query = `
      SELECT
        DATE(open_time) AS date,
        SUM(pnl) AS daily_pnl,
        COUNT(*) AS trades
      FROM trades
      WHERE user_id = ?
      AND status = 'closed'
    `;

    const params = [req.user.id];

    if (month) {
      query += `
        AND DATE_FORMAT(open_time, '%Y-%m') = ?
      `;
      params.push(month);
    }

    query += `
      GROUP BY date
      ORDER BY date ASC
    `;

    const [rows] = await db.query(query, params);

    res.json({
  success: true,
  calendar: rows.map(r => ({
    date: r.date,
    daily_pnl: Number(r.daily_pnl || 0),
    trades: Number(r.trades || 0)
  }))
});

  } catch (err) {
    console.error('Calendar Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// GET /api/analytics/equity-curve
const getEquityCurve = async (req, res) => {
  try {

    const [[account]] = await db.query(`
      SELECT SUM(balance) AS balance
      FROM trading_accounts
      WHERE user_id = ?
    `, [req.user.id]);

    let equity = Number(account.balance || 10000);

    const [rows] = await db.query(`
      SELECT id, close_time, pnl
      FROM trades
      WHERE user_id = ?
      AND status = 'closed'
      AND close_time IS NOT NULL
      ORDER BY close_time ASC, id ASC
    `, [req.user.id]);

    const curve = rows.map(r => {

      equity += Number(r.pnl || 0);

      return {
        date: r.close_time,
        equity: Number(equity.toFixed(2)),
        pnl: Number(r.pnl || 0)
      };

    });

    res.json({
      success: true,
      equity_curve: curve
    });

  } catch (err) {
    console.error('Equity Curve Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
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
