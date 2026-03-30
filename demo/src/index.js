// Refill Risk Demo — Auth-aware Router (Cloudflare Worker)
// Routes requests to auth, prediction, admin, and frontend handlers.
// Business logic lives in auth.js and predict.js — this file is routing only.

import {
  verifyTOTP,
  generateSecret,
  buildOtpauthURI,
  createSession,
  validateSession,
  deleteSession,
  cleanExpiredSessions,
  getSessionCookie,
  setSessionCookie,
  clearSessionCookie,
} from './auth.js';

import { handlePredict, handleNdcSearch, TEMPLATE_CSV, serveCsv, CORS } from './predict.js';

import DOCS_HTML from './docs.html';

// ── Helpers ────────────────────────────────────────────────────────

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function jsonError(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Static Asset Patterns ──────────────────────────────────────────

const STATIC_ASSET_RE = /^\/(favicon\.ico|favicon-.*\.png|apple-touch-icon\.png|mstile-.*\.png)$/;

// ── Worker Entry ───────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // ── CORS Preflight ─────────────────────────────────────────────
    if (method === 'OPTIONS' && pathname.startsWith('/api/')) {
      return new Response(null, { headers: CORS });
    }

    // ── Static Assets (no auth) ────────────────────────────────────
    if (STATIC_ASSET_RE.test(pathname)) {
      return env.ASSETS.fetch(request);
    }

    // ── Resolve Session (used by multiple routes) ──────────────────
    const sessionToken = getSessionCookie(request);
    const sessionUser = await validateSession(env.DB, sessionToken);

    // Probabilistic cleanup: ~1% of requests
    if (Math.random() < 0.01) {
      // Fire and forget — don't block the response
      env.DB && cleanExpiredSessions(env.DB).catch(() => {});
    }

    // ── Auth Endpoints (no auth required) ──────────────────────────

    if (pathname === '/api/auth/login' && method === 'POST') {
      return handleLogin(request, env, sessionUser);
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      return handleLogout(env, sessionToken);
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
      return handleRegister(request, env);
    }

    if (pathname === '/api/auth/register/verify' && method === 'POST') {
      return handleRegisterVerify(request, env);
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      if (!sessionUser) return json({ user: null });
      return json({ user: { name: sessionUser.name, email: sessionUser.email, role: sessionUser.role, organization: sessionUser.organization } });
    }

    // ── Admin Endpoints (require auth + admin role) ────────────────

    if (pathname === '/api/admin/users') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      if (sessionUser.role !== 'admin') return jsonError('Admin access required', 403);
      if (method === 'GET') return handleListUsers(env);
      if (method === 'POST') return handleCreateUser(request, env);
      return jsonError('Method not allowed', 405);
    }

    // Individual user management: /api/admin/users/:id
    const userMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
    if (userMatch) {
      if (!sessionUser) return jsonError('Authentication required', 401);
      if (sessionUser.role !== 'admin') return jsonError('Admin access required', 403);
      const userId = parseInt(userMatch[1]);
      if (method === 'PUT') return handleUpdateUser(request, env, userId);
      if (method === 'DELETE') return handleDeleteUser(env, userId, sessionUser);
      return jsonError('Method not allowed', 405);
    }

    // ── API Endpoints (require auth, any role) ─────────────────────

    if (pathname === '/api/predict' && method === 'POST') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      return handlePredict(request);
    }

    if (pathname === '/api/template' && method === 'GET') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      return serveCsv(TEMPLATE_CSV, 'refill_risk_template.csv');
    }

    if (pathname === '/api/ndc-search' && method === 'GET') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      return handleNdcSearch(url);
    }

    // ── Unknown API paths ──────────────────────────────────────────

    if (pathname.startsWith('/api/')) {
      return jsonError('Not found', 404);
    }

    // ── API Docs (no auth required) ─────────────────────────────────

    if (pathname === '/docs') {
      return new Response(DOCS_HTML, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ── Frontend (React SPA via static assets) ─────────────────────

    return env.ASSETS.fetch(request);
  },
};

// ── Route Handlers ─────────────────────────────────────────────────

async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { email, code } = body || {};
  if (!email || !code) return jsonError('Email and code are required', 400);

  // Look up user by email
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user) return jsonError('Account not found', 401);

  // Reject unverified accounts
  if (user.totp_secret.startsWith('PENDING:')) return jsonError('Account not yet verified — please complete registration first', 401);

  // Verify TOTP (test account accepts hardcoded code)
  const isTestAccount = user.email === 'test@pharmacy2u.co.uk' && code === '123456';
  const valid = isTestAccount || await verifyTOTP(user.totp_secret, code);
  if (!valid) return jsonError('Invalid code', 401);

  // Create session and set cookie
  const token = await createSession(env.DB, user.id);
  const cookie = setSessionCookie(token);

  return json(
    {
      success: true,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization,
      },
    },
    200,
    { 'Set-Cookie': cookie },
  );
}

async function handleLogout(env, sessionToken) {
  if (sessionToken) {
    await deleteSession(env.DB, sessionToken);
  }
  const cookie = clearSessionCookie();
  return json({ success: true }, 200, { 'Set-Cookie': cookie });
}

async function handleListUsers(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, email, organization, role, created_at FROM users',
  ).all();
  return json(results || []);
}

async function handleCreateUser(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { name, email, organization } = body || {};
  if (!name || !email || !organization) {
    return jsonError('name, email, and organization are required', 400);
  }

  const secret = generateSecret();

  const result = await env.DB.prepare(
    'INSERT INTO users (name, email, organization, totp_secret) VALUES (?, ?, ?, ?)',
  )
    .bind(name, email, organization, secret)
    .run();

  const userId = result.meta?.last_row_id;

  return json(
    {
      user: { id: userId, name, email, organization },
      totp_secret: secret,
      otpauth_uri: buildOtpauthURI(secret, email),
    },
    201,
  );
}

async function handleUpdateUser(request, env, userId) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body', 400); }

  const { name, email, organization } = body || {};
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(san(name)); }
  if (email !== undefined) { fields.push('email = ?'); values.push(san(email)); }
  if (organization !== undefined) { fields.push('organization = ?'); values.push(san(organization)); }
  if (fields.length === 0) return jsonError('No fields to update', 400);

  values.push(userId);
  await env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  const updated = await env.DB.prepare('SELECT id, name, email, organization, role, created_at FROM users WHERE id = ?').bind(userId).first();
  if (!updated) return jsonError('User not found', 404);
  return json(updated);
}

async function handleDeleteUser(env, userId, sessionUser) {
  if (userId === sessionUser.user_id) return jsonError('Cannot delete your own account', 400);
  const user = await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
  if (!user) return jsonError('User not found', 404);
  // Delete their sessions first, then the user
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return json({ success: true });
}

async function handleRegister(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body', 400); }

  const { name, email, organization } = body || {};
  if (!name || !email) return jsonError('Name and email are required', 400);

  const cleanName = san(name).slice(0, 100);
  const cleanEmail = san(email).toLowerCase().slice(0, 200);
  const cleanOrg = san(organization || '').slice(0, 200);

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return jsonError('Invalid email format', 400);

  // Check if email already exists
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(cleanEmail).first();
  if (existing) return jsonError('An account with this email already exists', 409);

  // Generate TOTP secret
  const secret = generateSecret();
  const otpauthUri = buildOtpauthURI(secret, cleanEmail);

  // Store as pending (we use a temporary secret prefix to mark unverified)
  await env.DB.prepare(
    'INSERT INTO users (name, email, organization, totp_secret, role) VALUES (?, ?, ?, ?, ?)',
  ).bind(cleanName, cleanEmail, cleanOrg, 'PENDING:' + secret, 'clinician').run();

  return json({ email: cleanEmail, totp_secret: secret, otpauth_uri: otpauthUri }, 201);
}

async function handleRegisterVerify(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body', 400); }

  const { email, code } = body || {};
  if (!email || !code) return jsonError('Email and code are required', 400);

  const cleanEmail = san(email).toLowerCase();
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail).first();
  if (!user) return jsonError('Account not found', 404);
  if (!user.totp_secret.startsWith('PENDING:')) return jsonError('Account already verified — please log in', 400);

  const actualSecret = user.totp_secret.replace('PENDING:', '');
  const valid = await verifyTOTP(actualSecret, code);
  if (!valid) return jsonError('Invalid code — please check your authenticator app and try again', 401);

  // Activate the account
  await env.DB.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').bind(actualSecret, user.id).run();

  // Auto-login
  const token = await createSession(env.DB, user.id);
  return json(
    { success: true, user: { name: user.name, email: user.email, role: user.role, organization: user.organization } },
    200,
    { 'Set-Cookie': setSessionCookie(token) },
  );
}

function san(s) {
  return String(s || '').replace(/[<>"'&]/g, '').trim();
}

