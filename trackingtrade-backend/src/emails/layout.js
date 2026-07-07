// ============================================
// TrackingTrade — Shared Email Layout
// ============================================
// Small shared wrapper so every transactional email has the same
// branding/footer without repeating markup in every template file.

function wrapEmail(bodyHtml) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1a1a2e;">
      <div style="padding:24px 0 8px;text-align:center;">
        <span style="font-size:20px;font-weight:800;color:#7C5CFC;">TrackingTrade</span>
      </div>
      <div style="background:#ffffff;border:1px solid #eee;border-radius:12px;padding:28px;">
        ${bodyHtml}
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:18px;">
        © ${new Date().getFullYear()} TrackingTrade. You're receiving this because an action was taken on your account.
      </p>
    </div>
  `;
}

module.exports = { wrapEmail };
