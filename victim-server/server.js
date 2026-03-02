/*
 * victim server (Port 3000)
 * simulates a vulnerable Bank website:
 * - serves a login page.
 * - issues an HttpOnly session cookie after successful login.
 * - protects the dashboard with session validation.
 * - uses an in-memory session store for POC.
 */

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const APP_PORT = process.env.APP_PORT ? Number(process.env.APP_PORT) : 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'poc-bank-secret-change-in-production';

// in-memory session store
const sessionStore = new Map();

const app = express();

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// session middleware with HttpOnly cookie
  // the flag we will bypass with the extension
app.use(
  session({
    name: 'bank.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,   // JavaScript can't read this cookie (extension can bypass)
      secure: false,    // set true over HTTPS
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// POC credentials
const VALID_USERS = {
  alice: 'password123',
  bob: 'bank2024',
};

// middleware: require authenticated session for protected routes
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/');
}

// routes

// GET / - login page
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Secure Bank — Login</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
    .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); width: 100%; max-width: 380px; }
    h1 { margin: 0 0 1.5rem 0; font-size: 1.5rem; color: #f8fafc; }
    label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; color: #94a3b8; }
    input { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #e2e8f0; font-size: 1rem; }
    input:focus { outline: none; border-color: #3b82f6; }
    button { width: 100%; padding: 0.75rem; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .error { color: #f87171; font-size: 0.9rem; margin-top: 0.5rem; }
    .hint { color: #64748b; font-size: 0.8rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🏦 Secure Bank</h1>
    <p style="color:#94a3b8; margin-bottom: 1rem;">Sign in to your account</p>
    <form method="POST" action="/login" id="loginForm">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" autocomplete="username" required placeholder="e.g. alice">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required placeholder="••••••••">
      ${req.query.error ? '<p class="error">Invalid username or password.</p>' : ''}
      <button type="submit">Sign in</button>
    </form>
    <p class="hint">POC: Try alice / password123 or bob / bank2024</p>
  </div>
</body>
</html>
  `);
});

// POST /login - authenticate and set HttpOnly session cookie
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const expectedPassword = VALID_USERS[username];

  if (!username || !password || expectedPassword !== password) {
    return res.redirect('/?error=1');
  }

  req.session.user = username;
  req.session.createdAt = Date.now();
  return res.redirect('/dashboard');
});

// GET /dashboard - protected area (requires valid session cookie)
app.get('/dashboard', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Secure Bank</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; margin: 0; padding: 2rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    h1 { margin: 0; font-size: 1.5rem; }
    a { color: #60a5fa; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .card { background: #1e293b; padding: 1.5rem; border-radius: 12px; margin-bottom: 1rem; max-width: 480px; }
    .balance { font-size: 1.75rem; color: #4ade80; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏦 Secure Bank — Dashboard</h1>
    <a href="/logout">Sign out</a>
  </div>
  <div class="card">
    <p style="color:#94a3b8;">Logged in as <strong>${escapeHtml(req.session.user)}</strong></p>
    <p>Account balance: <span class="balance">$12,450.00</span></p>
    <p style="color:#64748b; font-size: 0.9rem;">This page is protected by an HttpOnly session cookie.</p>
  </div>
</body>
</html>
  `);
});

// GET /logout - destroy session and clear cookie
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// GET /api/me — Optional JSON endpoint to verify session.
// Use when: testing login/cookie in browser or curl, or when the extension needs to confirm a hijacked session works.
app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user, ok: true });
  }
  res.status(401).json({ ok: false });
});

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

// ----- Start server -----
app.listen(APP_PORT, () => {
  console.log(`[Victim Server] Bank site running at http://localhost:${APP_PORT}`);
  console.log('[Victim Server] Login: alice / password123 or bob / bank2024');
});
