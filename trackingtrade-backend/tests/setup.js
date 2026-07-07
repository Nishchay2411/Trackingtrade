// ============================================
// TrackingTrade — Jest global test setup
// ============================================
// Runs before the test framework loads, so env vars are in place before
// any app module (which read process.env at require-time) gets imported.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_only_secret_do_not_use_in_prod';
process.env.ACCESS_TOKEN_EXPIRE = '15m';
process.env.REFRESH_TOKEN_EXPIRE_DAYS = '30';
process.env.FRONTEND_URL = 'https://trackingtrade.vercel.app';
process.env.CORS_ORIGINS = 'https://trackingtrade.vercel.app';
process.env.BREVO_API_KEY = 'test_brevo_key';
process.env.EMAIL_FROM = 'noreply@trackingtrade.com';
process.env.LOG_LEVEL = 'error'; // keep test output quiet

// Silence the logger's console output during tests except real failures
// the test itself wants to assert on — logger already respects LOG_LEVEL.

// The mailer (Brevo) fires emails in the background (non-blocking) and
// would otherwise try a real network call to api.brevo.com, which isn't
// reachable/allowed in a test sandbox anyway. Stub `fetch` globally so
// those calls resolve instantly and quietly instead of erroring.
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({}),
    text: async () => ''
  })
);
