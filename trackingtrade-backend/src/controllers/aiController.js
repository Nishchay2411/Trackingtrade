const db     = require('../config/database');
const OpenAI = require('openai');
const logger = require('../utils/logger');

// GET /api/ai/insights
const getInsights = async (req, res) => {
  try {
    const [insights] = await db.query(
      'SELECT * FROM ai_insights WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.user.id]
    );
    res.success({ insights });
  } catch (err) {
    logger.error(err);
    res.fail('Server error', 500);
  }
};

// POST /api/ai/generate
const generateInsights = async (req, res) => {
  try {
    const [trades] = await db.query(`
      SELECT pair, type, pnl, strategy, session, rr_ratio, open_time
      FROM trades
      WHERE user_id = ? AND status = 'closed'
      ORDER BY open_time DESC LIMIT 50
    `, [req.user.id]);

    if (trades.length < 3) {
      return res.fail('You need at least 3 closed trades to generate AI insights.', 400);
    }

    const wins     = trades.filter(t => t.pnl > 0).length;
    const losses   = trades.filter(t => t.pnl < 0).length;
    const winRate  = ((wins / trades.length) * 100).toFixed(1);
    const totalPnL = trades.reduce((s, t) => s + parseFloat(t.pnl), 0).toFixed(2);

    const pairStats = {};
    trades.forEach(t => {
      if (!pairStats[t.pair]) pairStats[t.pair] = { wins: 0, total: 0 };
      pairStats[t.pair].total++;
      if (t.pnl > 0) pairStats[t.pair].wins++;
    });

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      const mockInsights = [
        { type: 'strength',    title: 'STRENGTH',  message: `Your win rate is ${winRate}% which is above average. Keep following your system.`,         impact: 'high'   },
        { type: 'improvement', title: 'IMPROVE',   message: 'Consider reviewing your losing trades to find common patterns to avoid.',                  impact: 'medium' },
        { type: 'insight',     title: 'INSIGHT',   message: `You have logged ${trades.length} trades with a total P&L of $${totalPnL}. Great consistency!`, impact: 'low' },
        { type: 'warning',     title: 'WARNING',   message: 'Always use stop losses on every trade to protect your capital.',                           impact: 'high'   },
      ];

      for (const insight of mockInsights) {
        await db.query(
          'INSERT INTO ai_insights (user_id, type, title, message, impact) VALUES (?,?,?,?,?)',
          [req.user.id, insight.type, insight.title, insight.message, insight.impact]
        );
      }

      return res.success({ insights: mockInsights }, 'Insights generated!');
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are an expert trading coach. Analyze this trader's performance data and give 4 specific insights:

Trade Summary:
- Total trades: ${trades.length}
- Win rate: ${winRate}%
- Total P&L: $${totalPnL}
- Pairs traded: ${Object.keys(pairStats).join(', ')}
- Pair win rates: ${Object.entries(pairStats).map(([p, s]) => `${p}: ${((s.wins / s.total) * 100).toFixed(0)}%`).join(', ')}
- Recent trades sample: ${JSON.stringify(trades.slice(0, 10))}

Return ONLY a JSON array with 4 objects, each having: type (strength/improvement/warning/insight), title, message, impact (high/medium/low). No extra text.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    });

    let insights;
    try {
      insights = JSON.parse(completion.choices[0].message.content);
    } catch (parseErr) {
      logger.error('AI parse error:', parseErr);
      return res.fail('Could not parse AI response', 500);
    }

    for (const insight of insights) {
      await db.query(
        'INSERT INTO ai_insights (user_id, type, title, message, impact) VALUES (?,?,?,?,?)',
        [req.user.id, insight.type, insight.title, insight.message, insight.impact]
      );
    }

    res.success({ insights }, 'AI insights generated!');

  } catch (err) {
    logger.error('AI error:', err);
    res.fail('AI generation failed. Please try again.', 500);
  }
};

// GET /api/ai/scores
const getScores = async (req, res) => {
  try {
    const [trades] = await db.query(
      'SELECT pnl, rr_ratio, stop_loss FROM trades WHERE user_id=? AND status="closed"',
      [req.user.id]
    );

    if (!trades.length) {
      return res.success({ scores: { overall: 0, discipline: 0, riskManagement: 0, consistency: 0 } });
    }

    const wins        = trades.filter(t => t.pnl > 0).length;
    const winRate     = (wins / trades.length) * 100;
    const hasSlPct    = (trades.filter(t => t.stop_loss).length / trades.length) * 100;
    const hasRrPct    = (trades.filter(t => t.rr_ratio).length / trades.length) * 100;
    const pnls        = trades.map(t => parseFloat(t.pnl));
    const avgPnl      = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance    = pnls.reduce((s, p) => s + Math.pow(p - avgPnl, 2), 0) / pnls.length;
    const consistency = Math.max(0, Math.min(100, 100 - (Math.sqrt(variance) / Math.abs(avgPnl || 1)) * 10));

    const discipline     = Math.round((hasSlPct * 0.5) + (hasRrPct * 0.5));
    const riskManagement = Math.round(hasSlPct);
    const overall        = Math.round((winRate * 0.4) + (discipline * 0.3) + (consistency * 0.3));

    res.success({
      scores: {
        overall:        Math.min(100, overall),
        discipline:     Math.min(100, discipline),
        riskManagement: Math.min(100, riskManagement),
        consistency:    Math.min(100, Math.round(consistency)),
      }
    });
  } catch (err) {
    logger.error(err);
    res.fail('Server error', 500);
  }
};

// PATCH /api/ai/insights/:id/read
const markRead = async (req, res) => {
  try {
    await db.query(
      'UPDATE ai_insights SET is_read=TRUE WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    );
    res.success({}, 'Marked as read');
  } catch (err) {
    logger.error(err);
    res.fail('Server error', 500);
  }
};

module.exports = { getInsights, generateInsights, getScores, markRead };
