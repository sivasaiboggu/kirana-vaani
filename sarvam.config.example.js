// Sarvam AI key for KiranaVaani — OPTIONAL, self-hosted deploys only.
//
// 1. Copy this file to `sarvam.config.js` (same folder) and paste your key.
// 2. Get a key at https://dashboard.sarvam.ai — sign up, create an API key.
// 3. NEVER commit sarvam.config.js — it is gitignored. It is loaded before
//    the app scripts (see index.html / counter.html if you wire it in), and
//    the app reads window.SARVAM_API_KEY from it.
//
// You do NOT need this file to try the app: without a key the live counter
// uses the free Web Speech API automatically. You can also paste the key in
// the app's Settings page instead — it is stored only in the browser's
// localStorage, never in the project files.
//
// A browser key is visible in devtools, so for a real production shop,
// proxy Sarvam through a small server instead of shipping the key to the
// browser.

window.SARVAM_API_KEY = 'PASTE_YOUR_SARVAM_API_KEY_HERE';
