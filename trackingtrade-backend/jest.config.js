module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  // FIX: `clearMocks` only clears call history — it does NOT clear
  // queued `mockResolvedValueOnce(...)` implementations. If a test makes
  // fewer db.query() calls than it queued values for (e.g. an early
  // return), the leftover queued value silently bleeds into the next
  // test and causes order-dependent failures. `resetMocks` clears the
  // implementation queue too, so every test starts from a clean jest.fn().
  resetMocks: true
};
