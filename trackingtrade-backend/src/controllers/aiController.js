const db = require('../config/database');
const OpenAI = require('openai');

const openai =
  process.env.OPENAI_API_KEY &&
  process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
    ? new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })
    : null;

// ============================================
// GET INSIGHTS
// ============================================
const getInsights = async (req, res) => {
  try {

    const [insights] = await db.query(
      `
      SELECT *
      FROM ai_insights
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [req.user.id]
    );

    const [[unread]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM ai_insights
      WHERE user_id = ?
      AND is_read = FALSE
      `,
      [req.user.id]
    );

    res.json({
      success: true,
      unread: unread.total,
      insights
    });

  } catch (err) {

    console.error('Get Insights Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================
// GENERATE AI INSIGHTS
// ============================================
const generateInsights = async (req, res) => {
  try {

    const [trades] = await db.query(
      `
      SELECT pair, type, pnl, strategy,
             session, rr_ratio, open_time
      FROM trades
      WHERE user_id = ?
      AND status = 'closed'
      ORDER BY open_time DESC
      LIMIT 50
      `,
      [req.user.id]
    );

    if (trades.length < 3) {
      return res.status(400).json({
        success: false,
        message:
          'You need at least 3 closed trades.'
      });
    }

    const wins =
      trades.filter(t => Number(t.pnl) > 0).length;

    const winRate =
      ((wins / trades.length) * 100).toFixed(1);

    const totalPnL = trades
      .reduce((sum, t) =>
        sum + Number(t.pnl || 0), 0)
      .toFixed(2);

    const pairStats = {};

    trades.forEach(t => {
      if (!pairStats[t.pair]) {
        pairStats[t.pair] = {
          wins: 0,
          total: 0
        };
      }

      pairStats[t.pair].total++;

      if (Number(t.pnl) > 0) {
        pairStats[t.pair].wins++;
      }
    });

    let insights = [];

    // MOCK MODE
    if (!openai) {

      insights = [
        {
          type: 'strength',
          title: 'Strong Win Rate',
          message:
            `Your win rate is ${winRate}%. Keep following your trading plan.`,
          impact: 'high'
        },
        {
          type: 'improvement',
          title: 'Review Losing Trades',
          message:
            'Analyze losing trades to identify recurring mistakes.',
          impact: 'medium'
        },
        {
          type: 'insight',
          title: 'Performance Summary',
          message:
            `You generated $${totalPnL} from ${trades.length} trades.`,
          impact: 'medium'
        },
        {
          type: 'warning',
          title: 'Risk Management',
          message:
            'Always use stop losses to protect your capital.',
          impact: 'high'
        }
      ];

    } else {

      const prompt = `
Analyze this trader:

Total Trades: ${trades.length}
Win Rate: ${winRate}%
Total PnL: ${totalPnL}

Pairs:
${Object.keys(pairStats).join(', ')}

Recent Trades:
${JSON.stringify(trades.slice(0, 10))}

Return ONLY JSON:

{
 "insights":[
   {
     "type":"strength",
     "title":"...",
     "message":"...",
     "impact":"high"
   }
 ]
}
`;

      const completion =
        await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a professional trading coach. Return only valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: {
            type: 'json_object'
          },
          max_tokens: 800
        });

      try {

        const content =
          completion.choices[0].message.content;

        const parsed =
          JSON.parse(content);

        insights =
          parsed.insights || [];

      } catch (err) {

        console.error(
          'AI Parse Error:',
          err
        );

        insights = [
          {
            type: 'insight',
            title: 'Trading Analysis',
            message:
              'Continue following your strategy consistently.',
            impact: 'medium'
          }
        ];
      }
    }

    // Remove old insights
    await db.query(
      'DELETE FROM ai_insights WHERE user_id = ?',
      [req.user.id]
    );

    // Save new insights
    for (const insight of insights) {

      await db.query(
        `
        INSERT INTO ai_insights
        (user_id,type,title,message,impact)
        VALUES (?,?,?,?,?)
        `,
        [
          req.user.id,
          insight.type,
          insight.title,
          insight.message,
          insight.impact
        ]
      );
    }

    res.json({
      success: true,
      message:
        'AI insights generated successfully!',
      insights
    });

  } catch (err) {

    console.error('AI Error:', err);

    res.status(500).json({
      success: false,
      message:
        'AI generation failed.'
    });
  }
};

// ============================================
// GET SCORES
// (Use your existing code - it is already good)
// ============================================

// ============================================
// MARK AS READ
// ============================================
const markRead = async (req, res) => {
  try {

    const [existing] = await db.query(
      `
      SELECT id
      FROM ai_insights
      WHERE id = ?
      AND user_id = ?
      `,
      [req.params.id, req.user.id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: 'Insight not found'
      });
    }

    await db.query(
      `
      UPDATE ai_insights
      SET is_read = TRUE
      WHERE id = ?
      `,
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Marked as read'
    });

  } catch (err) {

    console.error(
      'Mark Read Error:',
      err
    );

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getInsights,
  generateInsights,
  getScores, // keep your existing function
  markRead
};
