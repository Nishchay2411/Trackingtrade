// ============================================
// TrackingTrade — Email Template: Verify Email
// ============================================
// FIX (Item 2 — Email Templates): this used to be an inline template
// literal buried inside authController.js. Pulled out so templates can
// be edited/designed without touching auth logic, and reused for both
// register() and resendVerification().
const { wrapEmail } = require('./layout');

function verifyEmailTemplate({ name, verifyLink }) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:18px;">Welcome to TrackingTrade 🚀</h2>
    <p style="font-size:14px;line-height:1.6;">Hi ${name}, please verify your email by clicking the button below:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${verifyLink}" style="background:#7C5CFC;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">Verify Email</a>
    </div>
    <p style="font-size:12px;color:#6b7280;">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
  `;

  return {
    subject: 'Verify your TrackingTrade account',
    html: wrapEmail(body)
  };
}

module.exports = { verifyEmailTemplate };
