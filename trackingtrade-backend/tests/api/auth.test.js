jest.mock('../../src/config/database', () => ({ query: jest.fn() }));

const request = require('supertest');
const bcrypt  = require('bcryptjs');
const db      = require('../../src/config/database');
const app     = require('../../src/app');

describe('POST /api/auth/register', () => {
  test('rejects a weak password before ever touching the DB', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Nishchay', email: 'n@example.com', password: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('rejects a duplicate email', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1 }]]); // existing user found
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Nishchay', email: 'taken@example.com', password: 'Strong1Pass!' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test('creates an account with valid input and does not block on the email send', async () => {
    db.query
      .mockResolvedValueOnce([[]])                 // no existing user
      .mockResolvedValueOnce([{ insertId: 42 }]);  // INSERT succeeds

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Nishchay', email: 'new@example.com', password: 'Strong1Pass!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/verify/i);
  });
});

describe('POST /api/auth/login', () => {
  test('rejects unknown email', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('rejects an unverified account', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 1, email: 'u@example.com', password: 'x', is_verified: 0, login_attempts: 0, lock_until: null
    }]]);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'u@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/verify your email/i);
  });

  test('rejects a Google-only account (no password set) with a helpful message', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 1, email: 'g@example.com', password: null, is_verified: 1, login_attempts: 0, lock_until: null
    }]]);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'g@example.com', password: 'whatever' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/google/i);
  });

  test('locks the account after 5 failed attempts', async () => {
    const hash = await bcrypt.hash('CorrectPass1!', 4); // low rounds for test speed
    db.query
      .mockResolvedValueOnce([[{
        id: 1, email: 'u@example.com', password: hash, is_verified: 1, login_attempts: 4, lock_until: null
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // the lock UPDATE

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'u@example.com', password: 'WrongPassword1!' });

    expect(res.status).toBe(423);
    expect(res.body.message).toMatch(/locked/i);
  });

  test('FIX regression guard: resets attempts once a previous lock has expired instead of instantly re-locking', async () => {
    // This is the exact bug that was fixed: lock_until in the past used
    // to NOT reset login_attempts, so the very next wrong password
    // pushed attempts straight past the threshold again.
    const hash = await bcrypt.hash('CorrectPass1!', 4);
    db.query
      .mockResolvedValueOnce([[{
        id: 1, email: 'u@example.com', password: hash, is_verified: 1,
        login_attempts: 5, lock_until: Date.now() - 1000 // lock already expired
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // reset login_attempts/lock_until
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // attempts=1 after this wrong password

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'u@example.com', password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/4 attempts remaining/i); // not re-locked
  });

  test('succeeds with correct credentials and sets a refresh-token cookie', async () => {
    const hash = await bcrypt.hash('CorrectPass1!', 4);
    db.query
      .mockResolvedValueOnce([[{
        id: 7, name: 'Nishchay', email: 'u@example.com', password: hash,
        plan: 'starter', timezone: 'UTC', currency: 'USD',
        is_verified: 1, login_attempts: 0, lock_until: null
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // last_login update
      .mockResolvedValueOnce([{ insertId: 1 }]);     // refresh token insert

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'u@example.com', password: 'CorrectPass1!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('u@example.com');
    expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=/);
  });
});

describe('POST /api/auth/refresh', () => {
  test('rejects when no refresh cookie is present', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no refresh token/i);
  });

  test('rejects an unknown/expired refresh token', async () => {
    db.query.mockResolvedValueOnce([[]]); // no matching row
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=some-fake-token']);

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me (protected route)', () => {
  test('rejects requests with no access token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('rejects a garbage access token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });
});
