Malicious Chrome Extension POC
==============================

This project demonstrates how a malicious Chrome extension can:
1) capture keystrokes on a login form (keylogger), and
2) steal an HttpOnly session cookie using the chrome.cookies API,
then use it for session hijacking.

*Do not use this on real systems or without explicit permission.


Project structure
-----------------
final project/
  - victim-server/        (Bank website, port 3000)
  - attacker-server/      (C&C server, port 4000)
  - extension/            (Manifest V3 extension)

Prerequisites
-------------
- Node.js + npm (recommended: Node LTS)
  Check:
    node -v
    npm -v
- Google Chrome (for loading the unpacked extension)


Install & run (2 terminals)
---------------------------
Terminal 1: Victim "Bank" server (http://localhost:3000)
  cd victim-server
  npm install
  npm start

Terminal 2: Attacker C&C server (http://localhost:4000)
  cd attacker-server
  npm install
  npm start


Load the extension (Chrome)
---------------------------
1) Open: chrome://extensions
2) Enable "Developer mode"
3) Click "Load unpacked"
4) Select the folder: extension/
