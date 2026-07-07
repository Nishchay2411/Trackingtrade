const {
  isValidEmail,
  isValidPassword,
  validateRegisterInput,
  validateTradeInput,
  validateAccountInput
} = require('../../src/utils/validators');

describe('isValidEmail', () => {
  test('accepts a normal email', () => {
    expect(isValidEmail('trader@example.com')).toBe(true);
  });
  test('rejects missing @', () => {
    expect(isValidEmail('traderexample.com')).toBe(false);
  });
  test('rejects missing domain', () => {
    expect(isValidEmail('trader@')).toBe(false);
  });
  test('rejects non-string input', () => {
    expect(isValidEmail(12345)).toBe(false);
  });
});

describe('isValidPassword', () => {
  test('accepts a strong password', () => {
    expect(isValidPassword('Strong1Pass!')).toBe(true);
  });
  test('rejects a password missing a symbol', () => {
    expect(isValidPassword('Strong1Pass')).toBe(false);
  });
  test('rejects a password under 8 characters', () => {
    expect(isValidPassword('Str1!')).toBe(false);
  });
  test('rejects an all-lowercase password', () => {
    expect(isValidPassword('weakpassword1!')).toBe(false);
  });
});

describe('validateRegisterInput', () => {
  test('passes with valid input', () => {
    const result = validateRegisterInput({ name: 'Nishchay', email: 'n@example.com', password: 'Strong1Pass!' });
    expect(result.valid).toBe(true);
  });
  test('fails when a field is missing', () => {
    const result = validateRegisterInput({ name: '', email: 'n@example.com', password: 'Strong1Pass!' });
    expect(result.valid).toBe(false);
  });
  test('fails with a weak password', () => {
    const result = validateRegisterInput({ name: 'Nishchay', email: 'n@example.com', password: 'weak' });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/password/i);
  });
});

describe('validateTradeInput', () => {
  const validTrade = {
    pair: 'EURUSD', type: 'BUY', lots: 0.1, entry_price: 1.085,
    open_time: '2025-05-27T08:00:00Z'
  };

  test('passes with a minimal valid trade', () => {
    expect(validateTradeInput(validTrade).valid).toBe(true);
  });

  test('rejects a pair with lowercase/invalid characters', () => {
    // FIX (Item 8): pair previously accepted anything at all — this closes
    // that gap AND removes a chunk of the earlier XSS surface at the source.
    const result = validateTradeInput({ ...validTrade, pair: '<script>' });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/pair/i);
  });

  test('rejects an invalid trade type', () => {
    const result = validateTradeInput({ ...validTrade, type: 'HOLD' });
    expect(result.valid).toBe(false);
  });

  test('rejects zero or negative lot size', () => {
    expect(validateTradeInput({ ...validTrade, lots: 0 }).valid).toBe(false);
    expect(validateTradeInput({ ...validTrade, lots: -1 }).valid).toBe(false);
  });

  test('rejects missing required fields when not partial', () => {
    const result = validateTradeInput({ pair: 'EURUSD' });
    expect(result.valid).toBe(false);
  });

  test('allows missing fields when partial (update) mode', () => {
    const result = validateTradeInput({ notes: 'updated notes only' }, { partial: true });
    expect(result.valid).toBe(true);
  });

  test('rejects notes over 2000 characters', () => {
    const result = validateTradeInput({ ...validTrade, notes: 'a'.repeat(2001) });
    expect(result.valid).toBe(false);
  });
});

describe('validateAccountInput', () => {
  test('passes with valid input', () => {
    const result = validateAccountInput({ name: 'FTMO Challenge', broker: 'FTMO', platform: 'MT5', account_type: 'Prop Firm', balance: 1000 });
    expect(result.valid).toBe(true);
  });
  test('fails without a broker', () => {
    const result = validateAccountInput({ name: 'My Account' });
    expect(result.valid).toBe(false);
  });
  test('fails with an invalid platform', () => {
    const result = validateAccountInput({ name: 'Acc', broker: 'IC Markets', platform: 'RandomPlatform' });
    expect(result.valid).toBe(false);
  });
});
