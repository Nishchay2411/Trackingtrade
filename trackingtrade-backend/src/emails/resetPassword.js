// ============================================
// TrackingTrade — Email Template: Password Reset
// ============================================
const { wrapEmail } = require('./layout');

function resetPasswordTemplate({ name, resetLink }) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:18px;">Password Reset Request</h2>
    <p style="font-size:14px;line-height:1.6;">Hi ${name}, click below to reset your password:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${resetLink}" style="background:#7C5CFC;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">Reset Password</a>
    </div>
    <p style="font-size:12px;color:#6b7280;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `;

  return {
    subject: 'TrackingTrade Password Reset',
    html: wrapEmail(body)
  };
}

module.exports = { resetPasswordTemplate };
