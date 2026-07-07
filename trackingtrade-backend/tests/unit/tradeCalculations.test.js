const { calcPnL, calcRR, calcDuration } = require('../../src/utils/tradeCalculations');

describe('calcPnL', () => {
  test('BUY forex trade in profit', () => {
    // 0.10 lots EURUSD, entry 1.08450 -> exit 1.08920: diff=0.00470
    // 0.00470 * 0.10 lots * 100000 contract size = 47.00
    expect(calcPnL('EURUSD', 'BUY', 1.08450, 1.08920, 0.10)).toBeCloseTo(47.00, 1);
  });

  test('SELL forex trade in profit', () => {
    // price falls, SELL profits: (entry - exit) * lots * 100000
    // diff=0.00220, * 0.08 lots * 100000 = 17.60
    expect(calcPnL('GBPUSD', 'SELL', 1.27310, 1.27090, 0.08)).toBeCloseTo(17.60, 1);
  });

  test('BUY trade in loss is negative', () => {
    expect(calcPnL('GBPUSD', 'BUY', 1.27310, 1.27090, 0.08)).toBeLessThan(0);
  });

  test('XAUUSD uses contract size 100', () => {
    expect(calcPnL('XAUUSD', 'SELL', 2340.50, 2318.20, 0.05)).toBeCloseTo(111.50, 1);
  });

  test('BTCUSD uses contract size 1 (crypto)', () => {
    expect(calcPnL('BTCUSD', 'BUY', 67400, 68100, 0.01)).toBeCloseTo(7.00, 1);
  });

  test('zero movement produces zero P&L', () => {
    expect(calcPnL('EURUSD', 'BUY', 1.1000, 1.1000, 1)).toBe(0);
  });
});

describe('calcRR', () => {
  test('returns null when no stop loss provided', () => {
    expect(calcRR('BUY', 1.0800, 1.0850, null)).toBeNull();
  });

  test('calculates correct ratio for a BUY', () => {
    // reward = 1.0900-1.0800=0.0100, risk = 1.0800-1.0750=0.0050 -> 1:2.0
    expect(calcRR('BUY', 1.0800, 1.0900, 1.0750)).toBe('1:2.0');
  });

  test('calculates correct ratio for a SELL', () => {
    // reward = entry-exit = 1.0900-1.0800=0.0100, risk = sl-entry=1.0950-1.0900=0.0050 -> 1:2.0
    expect(calcRR('SELL', 1.0900, 1.0800, 1.0950)).toBe('1:2.0');
  });

  test('returns null when risk is zero or negative (bad stop placement)', () => {
    // For a BUY, a stop loss ABOVE entry means risk <= 0 — invalid setup.
    expect(calcRR('BUY', 1.0800, 1.0900, 1.0850)).toBeNull();
  });
});

describe('calcDuration', () => {
  test('returns nulls when either time is missing', () => {
    expect(calcDuration(null, '2025-01-01T10:00:00Z')).toEqual({ duration: null, error: null });
    expect(calcDuration('2025-01-01T10:00:00Z', null)).toEqual({ duration: null, error: null });
  });

  test('formats a same-day duration correctly', () => {
    const result = calcDuration('2025-05-27T08:00:00Z', '2025-05-27T12:20:00Z');
    expect(result.duration).toBe('4h 20m');
    expect(result.error).toBeNull();
  });

  test('rejects close_time before open_time', () => {
    const result = calcDuration('2025-05-27T12:00:00Z', '2025-05-27T08:00:00Z');
    expect(result.duration).toBeNull();
    expect(result.error).toMatch(/cannot be before/i);
  });

  test('handles a multi-day duration', () => {
    const result = calcDuration('2025-05-25T06:00:00Z', '2025-05-25T18:00:00Z');
    expect(result.duration).toBe('12h 0m');
  });
});
