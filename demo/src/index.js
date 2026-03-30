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

import FRONTEND_HTML from './frontend.html';
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

    // ── Admin Endpoints (require auth + admin role) ────────────────

    if (pathname === '/api/admin/users') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      if (sessionUser.role !== 'admin') return jsonError('Admin access required', 403);
      if (method === 'GET') return handleListUsers(env);
      if (method === 'POST') return handleCreateUser(request, env);
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

    // ── Frontend (no auth required) ────────────────────────────────

    return serveFrontend(sessionUser);
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

  // Verify TOTP
  const valid = await verifyTOTP(user.totp_secret, code);
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

function serveFrontend(sessionUser) {
  const authState = JSON.stringify({
    user: sessionUser
      ? {
          name: sessionUser.name,
          email: sessionUser.email,
          role: sessionUser.role,
          organization: sessionUser.organization,
        }
      : null,
  });
  const html = FRONTEND_HTML.replace('/*__AUTH_STATE__*/', authState);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  });
}
