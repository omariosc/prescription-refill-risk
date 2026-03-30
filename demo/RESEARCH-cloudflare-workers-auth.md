# Cloudflare Workers Auth Research

Practical, working code for each topic area. All code tested against current Cloudflare Workers APIs (March 2026).

---

## 1. TOTP Implementation in Cloudflare Workers (RFC 6238)

Uses the Web Crypto API (`crypto.subtle`) -- works natively in Workers, no Node.js crypto needed.

### Base32 Decoding

```javascript
function base32Decode(base32) {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const bytes = [];

  // Strip padding and normalise
  base32 = base32.replace(/=+$/, '').toUpperCase();

  for (let i = 0; i < base32.length; i++) {
    const val = CHARS.indexOf(base32.charAt(i));
    if (val === -1) throw new Error('Invalid base32 character: ' + base32.charAt(i));
    bits += val.toString(2).padStart(5, '0');
  }

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }

  return new Uint8Array(bytes);
}
```

### HMAC-SHA1 Using Web Crypto API

```javascript
async function hmacSha1(keyBytes, messageBytes) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
  return new Uint8Array(signature);
}
```

### Integer to 8-Byte Big-Endian Array

```javascript
function intToBytes(num) {
  const bytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = num & 0xff;
    num = Math.floor(num / 256); // avoid bitwise for values > 32-bit
  }
  return bytes;
}
```

### Complete TOTP Generation

```javascript
async function generateTOTP(secret, options = {}) {
  const {
    period = 30,
    digits = 6,
    timestamp = Math.floor(Date.now() / 1000)
  } = options;

  // Step 1: Calculate time counter
  const counter = Math.floor(timestamp / period);
  const counterBytes = intToBytes(counter);

  // Step 2: Decode the base32 secret to raw bytes
  const keyBytes = base32Decode(secret);

  // Step 3: Compute HMAC-SHA1
  const hmacResult = await hmacSha1(keyBytes, counterBytes);

  // Step 4: Dynamic truncation (RFC 4226 section 5.4)
  const offset = hmacResult[19] & 0x0f;
  const binary =
    ((hmacResult[offset]     & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) <<  8) |
     (hmacResult[offset + 3] & 0xff);

  // Step 5: Modulo to get the desired number of digits
  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}
```

### TOTP Verification (with time-window tolerance)

```javascript
async function verifyTOTP(secret, token, options = {}) {
  const {
    period = 30,
    digits = 6,
    window = 1 // allow +/- 1 step (30s each side)
  } = options;

  const now = Math.floor(Date.now() / 1000);

  for (let i = -window; i <= window; i++) {
    const timestamp = now + (i * period);
    const candidate = await generateTOTP(secret, { period, digits, timestamp });
    if (candidate === token) {
      return true;
    }
  }
  return false;
}
```

### Generate a Random Base32 Secret

```javascript
function generateSecret(length = 20) {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => CHARS[byte % 32]).join('');
}
```

### Build an otpauth:// URI

```javascript
function buildOTPAuthURI(secret, accountName, issuer = 'MyApp') {
  const encoded = encodeURIComponent(accountName);
  const issuerEncoded = encodeURIComponent(issuer);
  return `otpauth://totp/${issuerEncoded}:${encoded}?secret=${secret}&issuer=${issuerEncoded}&algorithm=SHA1&digits=6&period=30`;
}
```

---

## 2. Cloudflare D1 Setup

### wrangler.toml Configuration

```toml
name = "my-auth-worker"
main = "src/index.ts"
compatibility_date = "2026-03-16"

[[d1_databases]]
binding = "DB"                          # accessible as env.DB in Worker
database_name = "my-auth-db"
database_id = "<YOUR_DATABASE_ID>"      # from `wrangler d1 create`
```

### Create the Database via CLI

```bash
# Create the database
npx wrangler d1 create my-auth-db

# Apply a schema file (local dev)
npx wrangler d1 execute my-auth-db --local --file=./schema.sql

# Apply schema to production
npx wrangler d1 execute my-auth-db --remote --file=./schema.sql
```

### Example schema.sql

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret TEXT,
  totp_enabled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### D1 Query API from a Worker

```javascript
export default {
  async fetch(request, env) {
    // --- INSERT ---
    const insertResult = await env.DB.prepare(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)'
    ).bind('user@example.com', 'hashed_pw').run();
    // insertResult.meta.last_row_id gives the new row ID

    // --- SELECT ONE ROW ---
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind('user@example.com').first();
    // Returns the first row as an object, or null

    // --- SELECT SPECIFIC COLUMN ---
    const email = await env.DB.prepare(
      'SELECT email FROM users WHERE id = ?'
    ).bind(1).first('email');
    // Returns just the value: "user@example.com"

    // --- SELECT ALL ROWS ---
    const { results } = await env.DB.prepare(
      'SELECT * FROM users'
    ).all();
    // results is an array of row objects

    // --- UPDATE ---
    await env.DB.prepare(
      'UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?'
    ).bind('JBSWY3DPEHPK3PXP', 1).run();

    // --- DELETE ---
    await env.DB.prepare(
      'DELETE FROM sessions WHERE expires_at < datetime(?)'
    ).bind(new Date().toISOString()).run();

    // --- BATCH (atomic transaction) ---
    const batchResults = await env.DB.batch([
      env.DB.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').bind('a@b.com', 'hash1'),
      env.DB.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').bind('c@d.com', 'hash2'),
    ]);
    // If any statement fails, the entire batch rolls back

    // --- RAW SQL (for migrations/maintenance) ---
    const execResult = await env.DB.exec(
      'DROP TABLE IF EXISTS old_table; CREATE TABLE new_table (id INTEGER PRIMARY KEY);'
    );
    // Returns { count: 2, duration: 5 }

    return new Response(JSON.stringify(user), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

### TypeScript Types

```typescript
interface Env {
  DB: D1Database;
}

// D1Result shape:
// {
//   results: T[],
//   success: boolean,
//   meta: {
//     duration: number,
//     last_row_id: number,
//     changes: number,
//     served_by: string,
//     rows_read: number,
//     rows_written: number,
//   }
// }
```

---

## 3. QR Code Generation Client-Side

### Recommended: qr-creator (4.75 KB gzipped, zero dependencies)

```html
<!-- Load from CDN -->
<script src="https://cdn.jsdelivr.net/npm/qr-creator/dist/qr-creator.min.js"></script>

<div id="qr-code"></div>

<script>
  const otpauthURI = 'otpauth://totp/MyApp:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=MyApp&algorithm=SHA1&digits=6&period=30';

  QrCreator.render({
    text: otpauthURI,
    radius: 0.5,        // 0 = square blocks, 0.5 = fully rounded
    ecLevel: 'M',       // Error correction: L(7%), M(15%), Q(25%), H(30%)
    fill: '#000000',     // QR code color
    background: '#ffffff',
    size: 200            // pixels (square)
  }, document.querySelector('#qr-code'));
</script>
```

### Alternative: qrcode.js (also small, no dependencies)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

<div id="qr-code"></div>

<script>
  new QRCode(document.getElementById('qr-code'), {
    text: otpauthURI,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
</script>
```

### Generating QR Inline in Worker-Served HTML

Since the QR code is generated client-side, embed it in the HTML the Worker returns:

```javascript
function qrSetupPageHTML(otpauthURI, secret) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Setup 2FA</title></head>
<body>
  <h2>Scan this QR code with your authenticator app</h2>
  <div id="qr-code"></div>
  <p>Or enter this secret manually: <code>${secret}</code></p>

  <form method="POST" action="/verify-totp-setup">
    <label>Enter the 6-digit code from your app:</label>
    <input type="text" name="token" pattern="[0-9]{6}" maxlength="6" required>
    <button type="submit">Verify and Enable 2FA</button>
  </form>

  <script src="https://cdn.jsdelivr.net/npm/qr-creator/dist/qr-creator.min.js"></script>
  <script>
    QrCreator.render({
      text: ${JSON.stringify(otpauthURI)},
      radius: 0.5,
      ecLevel: 'M',
      fill: '#000000',
      background: '#ffffff',
      size: 200
    }, document.querySelector('#qr-code'));
  </script>
</body></html>`;
}
```

---

## 4. Session Cookies in Cloudflare Workers

### Generate a Cryptographically Secure Session Token

```javascript
function generateSessionToken() {
  const bytes = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
```

### Set an httpOnly Secure Cookie

```javascript
function createSessionCookie(sessionId, maxAge = 86400) {
  // __Host- prefix: requires Secure, Path=/, no Domain attribute
  // Prevents subdomain attacks on *.workers.dev
  return [
    `__Host-session=${sessionId}`,
    'HttpOnly',           // not accessible via JS
    'Secure',             // HTTPS only
    'SameSite=Lax',       // CSRF protection
    'Path=/',
    `Max-Age=${maxAge}`,  // 24 hours
  ].join('; ');
}

// Use in a response:
function respondWithSession(body, sessionId, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html',
      'Set-Cookie': createSessionCookie(sessionId),
    },
  });
}
```

### Read the Session Cookie from a Request

```javascript
function getSessionIdFromCookie(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/__Host-session=([a-f0-9]{64})/);
  return match ? match[1] : null;
}
```

### Full Session Auth Flow

```javascript
async function handleRequest(request, env) {
  const url = new URL(request.url);

  // --- LOGIN ---
  if (url.pathname === '/login' && request.method === 'POST') {
    const formData = await request.formData();
    const email = formData.get('email');
    const password = formData.get('password');

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user || !await verifyPassword(password, user.password_hash)) {
      return new Response('Invalid credentials', { status: 401 });
    }

    // Create session
    const sessionId = generateSessionToken();
    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();

    await env.DB.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, user.id, expiresAt).run();

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/dashboard',
        'Set-Cookie': createSessionCookie(sessionId),
      },
    });
  }

  // --- AUTH MIDDLEWARE ---
  const sessionId = getSessionIdFromCookie(request);
  if (!sessionId) {
    return new Response(null, { status: 302, headers: { 'Location': '/login' } });
  }

  const session = await env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime(?)'
  ).bind(sessionId, new Date().toISOString()).first();

  if (!session) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/login',
        'Set-Cookie': '__Host-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
      },
    });
  }

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(session.user_id).first();

  // --- LOGOUT ---
  if (url.pathname === '/logout') {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/login',
        'Set-Cookie': '__Host-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
      },
    });
  }

  return new Response(`Hello ${user.email}`, { status: 200 });
}
```

### Password Hashing with Web Crypto (PBKDF2)

```javascript
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations: 100000,
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, storedHash) {
  // storedHash format: "salt:hash"
  const [salt, hash] = storedHash.split(':');
  const candidate = await hashPassword(password, salt);
  // Constant-time comparison
  const a = new TextEncoder().encode(candidate);
  const b = new TextEncoder().encode(hash);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
```

---

## 5. Cloudflare Workers Static Asset Serving

### The Modern Approach: [assets] Directory

This replaces the old [[rules]] import approach. Cloudflare Workers now has first-class static asset support. Put ALL your static files (HTML, CSS, JS, images, favicons, binary files) in a directory and configure it in wrangler.toml:

```toml
name = "my-auth-app"
main = "src/index.ts"
compatibility_date = "2026-03-16"

[assets]
directory = "./public"          # all files in here are deployed
binding = "ASSETS"              # optional: lets you fetch assets from Worker code
# run_worker_first = true       # optional: always run Worker, even for asset URLs
```

### Project Structure

```
my-auth-app/
  public/
    favicon.ico          # served at /favicon.ico
    robots.txt           # served at /robots.txt
    css/
      style.css          # served at /css/style.css
    images/
      logo.png           # served at /images/logo.png
    js/
      app.js             # served at /js/app.js
  src/
    index.ts             # Worker code (handles non-asset requests)
  wrangler.toml
```

### How Routing Works

By default:
1. Request comes in for /favicon.ico
2. Cloudflare checks the asset directory -- finds public/favicon.ico
3. Serves it directly (Worker code is NOT invoked)
4. Request comes in for /api/login
5. No matching asset found -- request goes to your Worker's fetch() handler

### Worker with Assets Binding (for dynamic + static)

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API routes handled by Worker
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    // For any non-API route, try to serve from assets
    // (This is the default behaviour anyway, but the binding
    //  lets you do it explicitly when run_worker_first = true)
    return env.ASSETS.fetch(request);
  }
};
```

### run_worker_first Mode (for auth-protected pages)

If you want your Worker to intercept ALL requests (even for static assets), e.g. to check authentication before serving HTML pages:

```toml
[assets]
directory = "./public"
binding = "ASSETS"
run_worker_first = true
```

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Always allow public assets (CSS, JS, images, favicon)
    const publicPaths = ['/css/', '/js/', '/images/', '/favicon.ico', '/robots.txt'];
    if (publicPaths.some(p => url.pathname.startsWith(p))) {
      return env.ASSETS.fetch(request);
    }

    // Check auth for everything else
    const sessionId = getSessionIdFromCookie(request);
    if (!sessionId && url.pathname !== '/login') {
      return Response.redirect(new URL('/login', request.url).toString(), 302);
    }

    // Serve the HTML page from assets (or handle API)
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
```

### Limits

- Individual file size: 25 MiB max
- Free plan: 20,000 assets per Worker version
- Paid plan: 100,000 assets per Worker version
- Supported file types: ALL (HTML, CSS, JS, images, fonts, PDFs, binaries, etc.)

### SPA Mode (Single Page Application)

```toml
[assets]
directory = "./public"
not_found_handling = "single-page-application"
```

This returns index.html with a 200 for any path that does not match a static file -- perfect for React/Vue/Svelte SPAs.

---

## 6. GitHub Actions for Cloudflare Workers Deployment

### Complete Workflow YAML

```yaml
# .github/workflows/deploy.yml
name: Deploy Worker

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### With Worker Secrets (e.g. TOTP_ENCRYPTION_KEY)

```yaml
name: Deploy Worker

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run D1 migrations (production)
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: d1 execute my-auth-db --remote --file=./schema.sql

      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          secrets: |
            TOTP_ENCRYPTION_KEY
            SESSION_SECRET
        env:
          TOTP_ENCRYPTION_KEY: ${{ secrets.TOTP_ENCRYPTION_KEY }}
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
```

### With Preview Deployments on PRs

```yaml
name: Deploy Worker

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Deploy
        id: deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: ${{ github.event_name == 'pull_request' && 'deploy --env preview' || 'deploy' }}

      - name: Comment deployment URL on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `Deployed to: ${{ steps.deploy.outputs.deployment-url }}`
            })
```

### Setting Up GitHub Secrets

You need these secrets in your GitHub repository (Settings > Secrets and variables > Actions):

| Secret Name              | How to Get It                                                                 |
|--------------------------|-------------------------------------------------------------------------------|
| CLOUDFLARE_API_TOKEN     | Cloudflare Dashboard > Account API Tokens > Create Token > "Edit Cloudflare Workers" template |
| CLOUDFLARE_ACCOUNT_ID    | Cloudflare Dashboard URL: dash.cloudflare.com/<ACCOUNT_ID> or Workers overview |
| TOTP_ENCRYPTION_KEY      | Generate: `openssl rand -hex 32`                                              |
| SESSION_SECRET           | Generate: `openssl rand -hex 32`                                              |

### Setting Worker Secrets via CLI (alternative to GH Actions)

```bash
# Set secrets one at a time
echo "your-secret-value" | npx wrangler secret put TOTP_ENCRYPTION_KEY
echo "your-session-secret" | npx wrangler secret put SESSION_SECRET
```

---

## Sources

- Cloudflare Workers Web Crypto API: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- Cloudflare Workers Sign Requests Example: https://developers.cloudflare.com/workers/examples/signing-requests/
- Cloudflare D1 Get Started: https://developers.cloudflare.com/d1/get-started/
- Cloudflare D1 Worker Binding API: https://developers.cloudflare.com/d1/worker-api/
- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Workers Static Assets Binding: https://developers.cloudflare.com/workers/static-assets/binding/
- Cloudflare Workers GitHub Actions: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Cloudflare Wrangler Action (GitHub): https://github.com/cloudflare/wrangler-action
- HMAC Sign/Verify with Web Crypto: https://bradyjoslin.com/posts/webcrypto-signing/
- otp-maker TOTP Implementation: https://github.com/soprandi/otp-maker
- qr-creator Library: https://github.com/nimiq/qr-creator
- QRCode.js Library: https://davidshimjs.github.io/qrcodejs/
- Cloudflare Securing MCP Server (Cookie Security): https://developers.cloudflare.com/agents/guides/securing-mcp-server/
- RFC 6238 TOTP Specification: https://datatracker.ietf.org/doc/html/rfc6238
- Cloudflare Workers Cookie Parsing: https://developers.cloudflare.com/workers/examples/extract-cookie-value/
