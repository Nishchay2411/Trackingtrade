// ============================================
// TrackingTrade — Mailer (Brevo HTTP API)
// ============================================
const logger = require('./logger');

// The actual network call — kept `async` so callers who genuinely need
// to know the outcome (rare) still can `await` it directly.
async function sendBrevoMail({ to, subject, html }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept':       'application/json',
      'api-key':      process.env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender:      { name: 'TrackingTrade', email: process.env.EMAIL_FROM },
      to:          [{ email: to }],
      subject,
      htmlContent: html
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Brevo API error: ${errText}`);
  }

  return response.json();
}

// FIX (Item — Brevo failure ko non-blocking banana): every call site that
// sends a transactional email (register, resend-verification,
// forgot-password) used to `await sendBrevoMail(...)`, which meant the
// HTTP response to the user sat waiting on Brevo's round-trip (or its
// timeout, if Brevo is slow/down) before the request could complete.
// This wrapper is deliberately NOT awaited by callers — it fires the
// send in the background and swallows/logs any failure itself, so a
// slow or failing email provider can never add latency to, or fail, the
// user-facing request. Combine with the graceful "email failed, but your
// account is fine" messaging already in authController for the case
// where it does fail.
function sendMailAsync(mailOptions) {
  sendBrevoMail(mailOptions).catch((err) => {
    logger.error('Background email send failed', { to: mailOptions.to, subject: mailOptions.subject, err: err.message });
  });
}

module.exports = { sendBrevoMail, sendMailAsync };
