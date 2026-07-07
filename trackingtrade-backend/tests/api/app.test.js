jest.mock('../../src/config/database', () => ({ query: jest.fn() }));

const request = require('supertest');
const db = require('../../src/config/database');
const app = require('../../src/app');

describe('GET /', () => {
  test('returns API running message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /health', () => {
  test('reports healthy + connected when DB responds', async () => {
    db.query.mockResolvedValueOnce([[{ 1: 1 }]]);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
  });

  test('reports degraded (503) when DB ping fails', async () => {
    // FIX (Item 13): the old /health always returned 200 regardless of
    // DB state — this test locks in the fix so it can't silently regress.
    db.query.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.database).toBe('disconnected');
  });
});

describe('Unknown routes', () => {
  test('returns standardized 404 envelope', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: expect.stringContaining('not found') });
  });
});
