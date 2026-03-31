// Refill Risk Demo — Auth-aware Router (Cloudflare Worker)
// Routes requests to auth, prediction, admin, and frontend handlers.
// Business logic lives in auth.js and predict.js — this file is routing only.

import {
  verifyTOTP,
  generateSecret,
  generateSessionToken,
  buildOtpauthURI,
  createSession,
  validateSession,
  deleteSession,
  cleanExpiredSessions,
  getSessionCookie,
  setSessionCookie,
  clearSessionCookie,
} from './auth.js';

import { handlePredict, handleNdcSearch, handleQuestionnaireSchema, handleQuestionnairePredict, TEMPLATE_CSV, serveCsv, CORS } from './predict.js';

// Re-export Durable Object class for wrangler
export { EventHub } from './event-hub.js';

// Helper: get a user's EventHub Durable Object stub
function getEventHub(env, email) {
  const id = env.EVENT_HUB.idFromName(email.toLowerCase());
  return env.EVENT_HUB.get(id);
}

// Helper: broadcast to a user's connected WebSocket clients
async function broadcastToUser(env, email, message) {
  try {
    const hub = getEventHub(env, email);
    await hub.fetch(new Request('https://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify(message),
    }));
  } catch {
    // Silently fail if no DO or no connections — polling is the fallback
  }
}

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

    // Public: check if a pending_clinician has been approved (no auth needed)
    if (pathname === '/api/auth/approval-status' && method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }
      const email = (body.email || '').trim().toLowerCase();
      if (!email) return jsonError('Email required', 400);
      const user = await env.DB.prepare('SELECT role FROM users WHERE LOWER(email) = ?').bind(email).first();
      if (!user) return json({ status: 'not_found' });
      if (user.role === 'pending_clinician') return json({ status: 'pending' });
      if (user.role === 'clinician' || user.role === 'admin') return json({ status: 'approved' });
      return json({ status: 'other' });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      if (!sessionUser) return json({ user: null });
      return json({ user: { name: sessionUser.name, email: sessionUser.email, role: sessionUser.role, organization: sessionUser.organization } });
    }

    // Magic link: generate a short-lived token for QR code auto-login (requires existing session)
    if (pathname === '/api/auth/magic-link' && method === 'POST') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      return handleMagicLinkCreate(request, env, sessionUser);
    }

    // Magic link: redeem token → create session (no prior auth required)
    if (pathname === '/api/auth/magic-link/redeem' && method === 'GET') {
      return handleMagicLinkRedeem(env, url);
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

    if (pathname === '/api/questionnaire/schema' && method === 'GET') {
      return handleQuestionnaireSchema();
    }

    if (pathname === '/api/questionnaire/predict' && method === 'POST') {
      return handleQuestionnairePredict(request);
    }

    // ── Patient Notification Endpoints ───────────────────────────────

    if (pathname === '/api/patient/notifications' && method === 'GET') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      const { results } = await env.DB.prepare(
        'SELECT id, patient_email, type, message, from_name, created_at, read FROM notifications WHERE LOWER(patient_email) = ? AND read = 0 ORDER BY created_at DESC',
      ).bind(sessionUser.email.toLowerCase()).all();
      return json(results || []);
    }

    const notifReadMatch = pathname.match(/^\/api\/patient\/notifications\/read\/(\d+)$/);
    if (notifReadMatch && method === 'POST') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      const notifId = parseInt(notifReadMatch[1]);
      await env.DB.prepare(
        'UPDATE notifications SET read = 1 WHERE id = ? AND LOWER(patient_email) = ?',
      ).bind(notifId, sessionUser.email.toLowerCase()).run();
      return json({ success: true });
    }

    if (pathname === '/api/notifications/send' && method === 'POST') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      if (sessionUser.role !== 'admin' && sessionUser.role !== 'clinician') {
        return jsonError('Clinician or admin access required', 403);
      }
      let body;
      try { body = await request.json(); } catch { return jsonError('Invalid JSON body', 400); }
      const { patient_email, type, message } = body || {};
      if (!patient_email || !type || !message) {
        return jsonError('patient_email, type, and message are required', 400);
      }
      const validTypes = ['app_push', 'in_app_survey', 'phone_call', 'letter', 'gp_consultation'];
      if (!validTypes.includes(type)) {
        return jsonError('Invalid notification type', 400);
      }

      // Normalize email to lowercase to prevent case-mismatch bugs
      const normalizedEmail = patient_email.toLowerCase();

      // Create notification
      const result = await env.DB.prepare(
        'INSERT INTO notifications (patient_email, type, message, from_name) VALUES (?, ?, ?, ?)',
      ).bind(normalizedEmail, type, message, sessionUser.name).run();

      // If in-app survey: also create a pending questionnaire for the patient
      let questionnaireId = null;
      if (type === 'in_app_survey') {
        const drugName = body.drug_name || 'Medication';
        const drugNdc = body.drug_ndc || '';
        const today = new Date().toISOString().split('T')[0];
        const dueDate = today; // Due immediately
        const qResult = await env.DB.prepare(
          'INSERT INTO questionnaires (patient_email, patient_id, drug_name, drug_ndc, fill_date, due_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(normalizedEmail, body.patient_id || '', drugName, drugNdc, today, dueDate, 'pending').run();
        questionnaireId = qResult.meta?.last_row_id;
      }

      const now = new Date().toISOString();
      const notifId = result.meta?.last_row_id;

      // Broadcast to patient's WebSocket clients instantly
      await broadcastToUser(env, normalizedEmail, {
        type: 'notification',
        data: { id: notifId, patient_email: normalizedEmail, type, message, from_name: sessionUser.name, created_at: now, read: 0 },
      });
      if (type === 'in_app_survey' && questionnaireId) {
        await broadcastToUser(env, normalizedEmail, {
          type: 'questionnaire',
          data: { id: questionnaireId, patient_email: normalizedEmail, patient_id: body.patient_id || '', drug_name: body.drug_name || 'Medication', drug_ndc: body.drug_ndc || '', status: 'pending', due_at: now.split('T')[0], fill_date: now.split('T')[0] },
        });
      }

      return json({ success: true, id: result.meta?.last_row_id }, 201);
    }

    // ── Questionnaire Endpoints ─────────────────────────────────────

    if (pathname === '/api/patient/questionnaires' && method === 'GET') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      const { results } = await env.DB.prepare(
        'SELECT * FROM questionnaires WHERE LOWER(patient_email) = ? ORDER BY due_at DESC',
      ).bind(sessionUser.email.toLowerCase()).all();
      return json(results || []);
    }

    if (pathname === '/api/patient/questionnaires/submit' && method === 'POST') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      let body;
      try { body = await request.json(); } catch { return jsonError('Invalid JSON body', 400); }
      const { questionnaire_id: rawQId, responses } = body || {};
      if (!rawQId || !responses) return jsonError('questionnaire_id and responses required', 400);
      const questionnaire_id = parseInt(rawQId);

      // Calculate scores from responses (ensure numeric)
      const eff = (parseInt(responses.effectiveness) || 3) / 5;
      const se = 1 - ((parseInt(responses.side_effects) || 3) / 5); // invert: high side effects = low score
      const qol = (parseInt(responses.qol_impact) || 3) / 5;
      const ease = (parseInt(responses.ease_of_use) || 3) / 5;
      const wouldContinue = responses.would_continue ? 0.0 : 0.3;

      // Adherence risk: lower scores = higher risk of not refilling
      const adherenceRisk = Math.max(0, Math.min(1, 1 - (eff * 0.3 + se * 0.25 + qol * 0.2 + ease * 0.15 + (1 - wouldContinue) * 0.1)));

      // Determine intervention based on risk + side effects severity
      let intervention = 'app_push';
      if (responses.side_effects >= 4) intervention = 'gp_consultation';
      else if (responses.side_effects >= 3 || adherenceRisk > 0.5) intervention = 'phone_call';
      else if (adherenceRisk > 0.3) intervention = 'sms';

      const effRound = parseFloat(eff.toFixed(4));
      const seRound = parseFloat(se.toFixed(4));
      const qolRound = parseFloat(qol.toFixed(4));
      const riskRound = parseFloat(adherenceRisk.toFixed(4));

      await env.DB.prepare(
        `UPDATE questionnaires SET status='completed', completed_at=datetime('now'), responses=?, effectiveness_score=?, side_effects_score=?, quality_of_life_score=?, adherence_risk_score=?, recommended_intervention=? WHERE id=? AND LOWER(patient_email)=?`
      ).bind(JSON.stringify(responses), effRound, seRound, qolRound, riskRound, intervention, questionnaire_id, sessionUser.email.toLowerCase()).run();

      // Auto-send notification to patient if severe side effects
      if (responses.side_effects >= 4) {
        await env.DB.prepare(
          'INSERT INTO notifications (patient_email, type, message, from_name) VALUES (?, ?, ?, ?)'
        ).bind(sessionUser.email, 'gp_consultation', 'Based on your medication check-in responses, we have flagged your case for a GP review. You will be contacted shortly.', 'Pharmacy2U Care Team').run();
      }

      // Get the questionnaire details for the clinician notification
      const q = await env.DB.prepare('SELECT drug_name FROM questionnaires WHERE id = ?').bind(questionnaire_id).first();
      const drugLabel = q ? q.drug_name : 'their medication';
      const severity = responses.side_effects >= 4 ? 'severe' : responses.side_effects >= 3 ? 'moderate' : 'mild';

      // Notify all admins/clinicians that a questionnaire was completed (store as a system event)
      // We use a special admin notification endpoint that clinicians can poll
      await env.DB.prepare(
        'INSERT INTO notifications (patient_email, type, message, from_name) VALUES (?, ?, ?, ?)'
      ).bind(
        '__clinician_alerts__',
        'in_app_survey',
        `Patient ${sessionUser.name} (${sessionUser.email}) completed a check-in for ${drugLabel}. Side effects: ${severity}. Adherence risk: ${(adherenceRisk * 100).toFixed(0)}%.`,
        sessionUser.name
      ).run();

      // Broadcast clinician alert via WebSocket to all active clinicians/admins
      // Look up all non-patient users and push to each one's EventHub
      const alertMsg = {
        type: 'clinician_alert',
        data: { message: `Patient ${sessionUser.name} completed a check-in for ${drugLabel}. Side effects: ${severity}. Risk: ${(adherenceRisk * 100).toFixed(0)}%.`, from_name: sessionUser.name },
      };
      try {
        const clinicians = await env.DB.prepare(
          "SELECT email FROM users WHERE role IN ('admin', 'clinician') LIMIT 50"
        ).all();
        for (const c of (clinicians.results || [])) {
          broadcastToUser(env, c.email, alertMsg).catch(() => {});
        }
      } catch { /* ignore if users table not available */ }

      return json({ success: true, adherence_risk: adherenceRisk, intervention });
    }

    // Clinician: get notification & survey counts for a specific patient
    if (pathname === '/api/clinician/patient-status' && method === 'GET') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      if (sessionUser.role !== 'admin' && sessionUser.role !== 'clinician') {
        return jsonError('Clinician access required', 403);
      }
      const patientEmail = url.searchParams.get('email');
      if (!patientEmail) return jsonError('email query param required', 400);
      const normalizedEmail = patientEmail.toLowerCase();

      const nUnread = await env.DB.prepare(
        'SELECT COUNT(*) as cnt FROM notifications WHERE LOWER(patient_email) = ? AND read = 0',
      ).bind(normalizedEmail).first();
      const nTotal = await env.DB.prepare(
        'SELECT COUNT(*) as cnt FROM notifications WHERE LOWER(patient_email) = ?',
      ).bind(normalizedEmail).first();
      const nRead = (nTotal?.cnt || 0) - (nUnread?.cnt || 0);
      const qRes = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM questionnaires WHERE LOWER(patient_email) = ? AND status = 'pending'",
      ).bind(normalizedEmail).first();
      const completedRes = await env.DB.prepare(
        "SELECT id, drug_name, adherence_risk_score, recommended_intervention, side_effects_score, completed_at FROM questionnaires WHERE LOWER(patient_email) = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 5",
      ).bind(normalizedEmail).all();

      return json({
        unread_notifications: nUnread?.cnt || 0,
        read_notifications: nRead,
        total_notifications: nTotal?.cnt || 0,
        pending_surveys: qRes?.cnt || 0,
        completed_surveys: (completedRes.results || []),
      });
    }

    // Clinician: get questionnaire results for a patient
    if (pathname === '/api/questionnaires' && method === 'GET') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      const patientEmail = url.searchParams.get('patient_email');
      if (!patientEmail) return jsonError('patient_email query param required', 400);
      const { results } = await env.DB.prepare(
        'SELECT * FROM questionnaires WHERE LOWER(patient_email) = ? ORDER BY due_at DESC',
      ).bind(patientEmail.toLowerCase()).all();
      return json(results || []);
    }

    // Clinician: poll for alerts (questionnaire completions etc.)
    if (pathname === '/api/clinician/alerts' && method === 'GET') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      if (sessionUser.role !== 'admin' && sessionUser.role !== 'clinician') return jsonError('Forbidden', 403);
      const since = url.searchParams.get('since') || '2026-01-01';
      const { results } = await env.DB.prepare(
        "SELECT * FROM notifications WHERE patient_email = '__clinician_alerts__' AND created_at > ? ORDER BY created_at DESC LIMIT 20",
      ).bind(since).all();
      return json(results || []);
    }

    // ── WebSocket endpoint (Durable Objects) ─────────────────────────
    if (pathname === '/api/ws') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      const hub = getEventHub(env, sessionUser.email);
      // Forward the WebSocket upgrade to the Durable Object
      return hub.fetch(new Request('https://internal/ws', {
        headers: request.headers,
      }));
    }

    // Unified live events endpoint — returns all new events since a cursor
    // Used as fallback when WebSocket is not available
    if (pathname === '/api/events' && method === 'GET') {
      if (!sessionUser) return jsonError('Authentication required', 401);
      const since = url.searchParams.get('since') || '2026-01-01';
      const role = sessionUser.role;
      const email = sessionUser.email;

      let notifications = [];
      let questionnaires = [];
      let clinicianAlerts = [];

      // Normalize email for case-insensitive matching
      const normalizedEmail = email.toLowerCase();

      // Always check for patient-facing notifications and questionnaires for this user
      // (a user can be a clinician AND have notifications sent to them for demo purposes)
      // Return all unread notifications (read=0) — both new ones and any the patient hasn't dismissed yet
      // Using OR: either unread (regardless of cursor) or created after cursor
      const nr = await env.DB.prepare(
        'SELECT * FROM notifications WHERE LOWER(patient_email) = ? AND (read = 0 OR created_at > ?) ORDER BY created_at DESC LIMIT 20',
      ).bind(normalizedEmail, since).all();
      // Filter to only unread in results
      notifications = (nr.results || []).filter(n => n.read === 0);

      // Always include ALL pending questionnaires (regardless of cursor) so they appear immediately
      const qr = await env.DB.prepare(
        "SELECT * FROM questionnaires WHERE LOWER(patient_email) = ? AND (status = 'pending' OR completed_at > ?) ORDER BY due_at DESC LIMIT 10",
      ).bind(normalizedEmail, since).all();
      questionnaires = qr.results || [];

      // Clinician/admin also get clinician alerts
      if (role !== 'patient') {
        const ar = await env.DB.prepare(
          "SELECT * FROM notifications WHERE patient_email = '__clinician_alerts__' AND created_at > ? ORDER BY created_at DESC LIMIT 20",
        ).bind(since).all();
        clinicianAlerts = ar.results || [];
      }

      return json({
        notifications,
        questionnaires,
        clinician_alerts: clinicianAlerts,
        server_time: new Date().toISOString(),
      }, 200, { 'Cache-Control': 'no-cache, no-store' });
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

  const emailLower = email.trim().toLowerCase();

  // Look up user by email (case-insensitive)
  const user = await env.DB.prepare('SELECT * FROM users WHERE LOWER(email) = ?').bind(emailLower).first();
  if (!user) return jsonError('Account not found', 401);

  // Reject unverified accounts
  if (user.totp_secret.startsWith('PENDING:')) return jsonError('Account not yet verified — please complete registration first', 401);

  // Verify TOTP (test accounts accept hardcoded code)
  const testEmails = ['test@pharmacy2u.co.uk', 'o.choudhry@leeds.ac.uk'];
  const isTestAccount = testEmails.includes(emailLower) && code === '123456';
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

  const { name, email, organization, role } = body || {};
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(san(name)); }
  if (email !== undefined) { fields.push('email = ?'); values.push(san(email)); }
  if (organization !== undefined) { fields.push('organization = ?'); values.push(san(organization)); }
  if (role !== undefined) {
    const validRoles = ['admin', 'clinician', 'patient', 'pending_clinician'];
    if (!validRoles.includes(role)) return jsonError('Invalid role', 400);
    fields.push('role = ?'); values.push(role);
  }
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

  const { name, email, organization, role } = body || {};
  if (!name || !email) return jsonError('Name and email are required', 400);

  // Validate role — only 'patient' or 'clinician' allowed for self-registration (not 'admin')
  const requestedRole = role || 'patient';
  if (!['patient', 'clinician'].includes(requestedRole)) return jsonError('Invalid role', 400);

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

  // Determine the DB role: clinicians get 'pending_clinician' until admin-approved
  const dbRole = requestedRole === 'clinician' ? 'pending_clinician' : 'patient';

  // Store as pending (we use a temporary secret prefix to mark unverified)
  await env.DB.prepare(
    'INSERT INTO users (name, email, organization, totp_secret, role) VALUES (?, ?, ?, ?, ?)',
  ).bind(cleanName, cleanEmail, cleanOrg, 'PENDING:' + secret, dbRole).run();

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

  // For pending clinicians: don't auto-login, return pending_approval flag
  if (user.role === 'pending_clinician') {
    return json({ success: true, pending_approval: true });
  }

  // Auto-login for patients
  const token = await createSession(env.DB, user.id);
  return json(
    { success: true, user: { name: user.name, email: user.email, role: user.role, organization: user.organization } },
    200,
    { 'Set-Cookie': setSessionCookie(token) },
  );
}

async function handleMagicLinkCreate(request, env, sessionUser) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const rawBase = String(body.base_url || '').trim().slice(0, 256);
  if (!rawBase) return jsonError('base_url is required', 400);

  // Only allow http(s) URLs to prevent open-redirect abuse
  if (!/^https?:\/\//i.test(rawBase)) return jsonError('Invalid base_url', 400);

  const user = await env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = ?')
    .bind(sessionUser.email.toLowerCase()).first();
  if (!user) return jsonError('User not found', 404);

  // 5-minute single-use token stored with MAGIC: prefix to distinguish from sessions
  const magicToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind('MAGIC:' + magicToken, user.id, expiresAt).run();

  return json({ url: `${rawBase}?magic=${magicToken}` });
}

async function handleMagicLinkRedeem(env, url) {
  const magicToken = url.searchParams.get('magic') || '';
  // Validate token format (64 hex chars from generateSessionToken)
  if (!/^[0-9a-f]{64}$/.test(magicToken)) return jsonError('Invalid magic token', 400);

  const row = await env.DB.prepare(
    `SELECT s.user_id, u.name, u.email, u.organization, u.role
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind('MAGIC:' + magicToken).first();
  if (!row) return jsonError('Invalid or expired magic link', 401);

  // Single-use: delete the magic token before creating the real session
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind('MAGIC:' + magicToken).run();

  const token = await createSession(env.DB, row.user_id);
  return json(
    { success: true, user: { name: row.name, email: row.email, role: row.role, organization: row.organization } },
    200,
    { 'Set-Cookie': setSessionCookie(token) },
  );
}

function san(s) {
  return String(s || '').replace(/[<>"'&]/g, '').trim();
}

