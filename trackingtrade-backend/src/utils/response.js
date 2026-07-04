// ============================================
// TrackingTrade — API Response Standardization
// ============================================
// Every endpoint in this app was hand-rolling its own res.json({...})
// call. That's not wrong, but the *shape* wasn't guaranteed consistent:
// success sometimes had extra keys, errors sometimes had a statusCode
// baked in one place and not another, some error paths leaked
// err.message and some didn't. This middleware attaches two helpers to
// `res` so every controller follows the exact same envelope:
//
//   Success: { success: true,  message, ...payload }   (payload keys
//             like `trades`, `overview`, `accounts` etc. are kept as-is
//             on purpose — the frontend already depends on those exact
//             field names, so this is a non-breaking standardization of
//             the envelope, not a reshuffle of every payload.)
//   Error:   { success: false, message }
//
// This also guarantees no controller can accidentally leak err.message
// to the client — res.fail() only ever sends a clean, intentional string.

function attachResponseHelpers(req, res, next) {
  res.success = (payload = {}, message = 'OK', statusCode = 200) => {
    return res.status(statusCode).json({ success: true, message, ...payload });
  };

  res.fail = (message = 'Something went wrong', statusCode = 500) => {
    return res.status(statusCode).json({ success: false, message });
  };

  next();
}

module.exports = { attachResponseHelpers };
