// demo/src/auth.js
// TOTP authentication + session management for Cloudflare Workers

const SESSION_MAX_AGE = 86400; // 24 hours in seconds
const TOTP_WINDOW = 1; // Accept codes from +/- 1 time step (30s each)

// ── Base32 Decode ───────────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input) {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of cleaned) {
    const val = BASE32_CHARS.indexOf(ch);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

// ── TOTP Generation ─────────────────────────────────────────────

async function hmacSha1(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, message);
  return new Uint8Array(sig);
}

function intToBytes(num) {
  const bytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = num & 0xff;
    num = Math.floor(num / 256);
  }
  return bytes;
}

export async function generateTOTP(secret, timeStep = 30, digits = 6, timestamp = null) {
  const time = timestamp || Math.floor(Date.now() / 1000);
  const counter = Math.floor(time / timeStep);
  const secretBytes = typeof secret === 'string' ? base32Decode(secret) : secret;
  const counterBytes = intToBytes(counter);
  const hmac = await hmacSha1(secretBytes, counterBytes);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % Math.pow(10, digits);
  return code.toString().padStart(digits, '0');
}

export async function verifyTOTP(secret, inputCode, timeStep = 30, digits = 6) {
  const now = Math.floor(Date.now() / 1000);
  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const timestamp = now + i * timeStep;
    const expected = await generateTOTP(secret, timeStep, digits, timestamp);
    if (expected === inputCode.toString().padStart(digits, '0')) return true;
  }
  return false;
}

// ── Secret Generation ───────────────────────────────────────────

export function generateSecret(length = 20) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let result = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    result += BASE32_CHARS[parseInt(bits.slice(i, i + 5), 2)];
  }
  return result;
}

export function buildOtpauthURI(secret, email, issuer = 'Pharmacy2U Refill Risk') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ── Session Management ──────────────────────────────────────────

export function generateSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(db, userId) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, expiresAt).run();
  return token;
}

export async function validateSession(db, token) {
  if (!token) return null;
  const row = await db.prepare(
    `SELECT s.user_id, u.name, u.email, u.organization, u.role
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first();
  return row || null;
}

export async function deleteSession(db, token) {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export async function cleanExpiredSessions(db) {
  await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

// ── Cookie Helpers ──────────────────────────────────────────────

export function getSessionCookie(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

export function setSessionCookie(token) {
  return `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearSessionCookie() {
  return `session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
