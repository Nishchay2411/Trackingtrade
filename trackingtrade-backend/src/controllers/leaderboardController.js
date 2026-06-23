const db = require('../config/database');

// GET /api/leaderboard?month=2025-05
const getLeaderboard = async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const [rows] = await db.query(`
      SELECT l.*, u.name, u.avatar
      FROM leaderboard l
      JOIN users u ON l.user_id = u.id
      WHERE l.month = ?
      ORDER BY l.points DESC
      LIMIT 50
    `, [month]);

    // Find current user's rank
    let myRank = null;
    if (req.user) {
      const myEntry = rows.find(r => r.user_id === req.user.id);
      if (myEntry) myRank = rows.indexOf(myEntry) + 1;
    }

    res.json({ success: true, month, leaderboard: rows, myRank });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/leaderboard/update — update or insert current user's monthly stats
const updateMyStats = async (req, res) => {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const uid   = req.user.id;

    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) AS total_trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS wins,
        SUM(pnl) AS total_pnl,
        MIN(pnl) AS worst_trade
      FROM trades
      WHERE user_id=? AND status='closed' AND DATE_FORMAT(open_time,'%Y-%m')=?
    `, [uid, month]);

    const winRate = stats.total_trades > 0 ? ((stats.wins / stats.total_trades) * 100) : 0;
    const roi     = ((stats.total_pnl || 0) / 10000) * 100; // assuming 10k base
    const points  = Math.round((winRate * 0.4 + Math.max(0, roi) * 2 + stats.total_trades * 0.5) * 10);

    await db.query(`
      INSERT INTO leaderboard (user_id, month, roi, win_rate, total_trades, points)
      VALUES (?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE roi=?, win_rate=?, total_trades=?, points=?
    `, [uid, month, roi.toFixed(2), winRate.toFixed(2), stats.total_trades, points,
        roi.toFixed(2), winRate.toFixed(2), stats.total_trades, points]);

    res.json({ success: true, message: 'Leaderboard stats updated!', points });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getLeaderboard, updateMyStats };
