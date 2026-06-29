const db = require('../config/database');

// ============================================
// GET LEADERBOARD
// GET /api/leaderboard?month=2026-06
// ============================================
const getLeaderboard = async (req, res) => {
  try {

    const month =
      req.query.month ||
      new Date().toISOString().slice(0, 7);

    // Validate YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format. Use YYYY-MM'
      });
    }

    const [rows] = await db.query(`
      SELECT
        l.*,
        u.name,
        u.avatar,
        ROW_NUMBER() OVER (
          ORDER BY l.points DESC
        ) AS rank_position
      FROM leaderboard l
      JOIN users u
      ON l.user_id = u.id
      WHERE l.month = ?
      ORDER BY l.points DESC
      LIMIT 50
    `, [month]);

    let myRank = null;

    if (req.user) {

      const [rankData] = await db.query(`
        SELECT rank_position
        FROM (
          SELECT
            user_id,
            ROW_NUMBER() OVER (
              ORDER BY points DESC
            ) AS rank_position
          FROM leaderboard
          WHERE month = ?
        ) ranked
        WHERE user_id = ?
      `, [month, req.user.id]);

      if (rankData.length) {
        myRank = rankData[0].rank_position;
      }
    }

    res.json({
      success: true,
      month,
      count: rows.length,
      leaderboard: rows,
      myRank
    });

  } catch (err) {

    console.error('Leaderboard Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================
// UPDATE USER LEADERBOARD STATS
// POST /api/leaderboard/update
// ============================================
const updateMyStats = async (req, res) => {
  try {

    const month =
      new Date().toISOString().slice(0, 7);

    const uid = req.user.id;

    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) AS total_trades,

        SUM(
          CASE
            WHEN pnl > 0
            THEN 1
            ELSE 0
          END
        ) AS wins,

        SUM(pnl) AS total_pnl,

        MIN(pnl) AS worst_trade,

        MAX(pnl) AS best_trade

      FROM trades

      WHERE user_id = ?
      AND status = 'closed'
      AND DATE_FORMAT(open_time,'%Y-%m') = ?
    `, [uid, month]);

    const totalTrades =
      Number(stats.total_trades || 0);

    const wins =
      Number(stats.wins || 0);

    const totalPnL =
      Number(stats.total_pnl || 0);

    const worstTrade =
      Number(stats.worst_trade || 0);

    const winRate =
      totalTrades > 0
        ? (wins / totalTrades) * 100
        : 0;

    // Assuming base capital = 10,000
    const roi =
      ((totalPnL / 10000) * 100);

    // Max drawdown estimate
    const maxDrawdown =
      worstTrade < 0
        ? Math.abs(worstTrade)
        : 0;

    // Improved points formula
    const points = Math.round(
      (
        (winRate * 0.4) +
        (Math.max(0, roi) * 2) +
        (totalTrades * 0.5) -
        (maxDrawdown / 100)
      ) * 10
    );

    await db.query(`
      INSERT INTO leaderboard (
        user_id,
        month,
        roi,
        win_rate,
        total_trades,
        max_drawdown,
        points
      )

      VALUES (?,?,?,?,?,?,?)

      ON DUPLICATE KEY UPDATE
        roi = VALUES(roi),
        win_rate = VALUES(win_rate),
        total_trades = VALUES(total_trades),
        max_drawdown = VALUES(max_drawdown),
        points = VALUES(points)
    `, [
      uid,
      month,
      roi.toFixed(2),
      winRate.toFixed(2),
      totalTrades,
      maxDrawdown.toFixed(2),
      points
    ]);

    res.json({
      success: true,
      message:
        'Leaderboard updated successfully!',

      stats: {
        roi: Number(roi.toFixed(2)),
        winRate: Number(winRate.toFixed(2)),
        totalTrades,
        maxDrawdown,
        points
      }
    });

  } catch (err) {

    console.error(
      'Update Leaderboard Error:',
      err
    );

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getLeaderboard,
  updateMyStats
};
