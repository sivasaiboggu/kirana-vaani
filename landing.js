// KiranaVaani — landing page.
// Animated playback of a real Tamil session inside the hero soundbox, and
// ?demo=… handling (the demo itself lives on the live counter).
// The nav carries the same shop switcher + engine badge as the app pages,
// and the hero soundbox names the current shop.

import { LANGUAGES } from './src/catalog.js';
import { listShops, getShop } from './src/shops.js';
import { getCurrentShopId, setCurrentShopId } from './src/store.js';
import { runLayoutCheck } from './src/shell.js';
import { loadSarvamKey, resolveVoiceEngine } from './src/sarvam.js';
import { webSpeechSupported } from './src/voice.js';

// Nav: shop switcher + engine badge, same as the app shell.
const currentShop = getShop(getCurrentShopId());
const shopSelect = document.getElementById('shopSelect');
for (const s of listShops()) {
  const opt = document.createElement('option');
  opt.value = s.id;
  opt.textContent = `${s.name} — ${s.city}`;
  if (s.id === currentShop.id) opt.selected = true;
  shopSelect.appendChild(opt);
}
shopSelect.addEventListener('change', () => {
  if (setCurrentShopId(shopSelect.value)) window.location.reload();
});
const engine = resolveVoiceEngine({ apiKey: loadSarvamKey(), webSpeechSupported: webSpeechSupported() });
document.getElementById('engineBadge').textContent = engine === 'sarvam'
  ? 'Sarvam AI voice'
  : engine === 'webspeech'
    ? 'Web Speech voice'
    : 'Text only';

// Hero soundbox names the current shop, not a hardcoded one. It is a
// playback of a recorded session, so it says so — never "LIVE".
document.getElementById('heroShopLabel').textContent =
  `Played back · ${currentShop.name}, ${currentShop.city}`;

runLayoutCheck();

const LINES = [
  { who: 'user', text: 'ஆசீர்வாத் ஆட்டா 5 கிலோ இருக்கா?', bill: '₹0.00' },
  { who: 'agent', text: '5 கிலோ ஆசீர்வாத் ஆட்டா சேர்த்தாச்சு — ₹275.00.', bill: '₹275.00' },
  { who: 'user', text: 'பாஸ்மதி அரிசி 2 கிலோ', bill: '₹275.00' },
  { who: 'agent', text: 'பாஸ்மதி அரிசி ஸ்டாக் இல்லை. அதுக்கு பதிலா பொன்னி அரிசி சேர்க்கவா?', bill: '₹275.00' },
  { who: 'user', text: 'சரி', bill: '₹275.00' },
  { who: 'agent', text: 'சரி — 2 கிலோ பொன்னி அரிசி சேர்த்துட்டேன். இப்ப பில்: ₹403.00.', bill: '₹403.00' },
  { who: 'user', text: '2 கிலோ சர்க்கரை', bill: '₹403.00' },
  { who: 'agent', text: '2 கிலோ சர்க்கரை சேர்த்தாச்சு — ₹96.00. இதுவரை பில்: ₹499.00.', bill: '₹499.00' },
];

const box = document.getElementById('heroTranscript');
const billEl = document.getElementById('heroBill');
const timerEl = document.getElementById('heroTimer');
let seconds = 0;
setInterval(() => {
  seconds += 1;
  timerEl.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}, 1000);

let i = 0;
function showNext() {
  if (i >= LINES.length) {
    setTimeout(() => {
      box.innerHTML = '';
      billEl.textContent = '₹0.00';
      i = 0;
      showNext();
    }, 4500);
    return;
  }
  const line = LINES[i];
  const div = document.createElement('div');
  div.className = `hero-line ${line.who}`;
  const who = document.createElement('span');
  who.className = 'hero-who';
  who.textContent = line.who === 'user' ? 'Customer' : 'Agent';
  div.append(who, document.createTextNode(line.text));
  box.appendChild(div);
  billEl.textContent = line.bill;
  i += 1;
  setTimeout(showNext, line.who === 'user' ? 1400 : 2100);
}
showNext();

// ?demo=ta|te|hi|kn|en — the demo runs on the live counter; point at it.
const params = new URLSearchParams(window.location.search);
const demoLang = params.get('demo');
if (demoLang && LANGUAGES[demoLang]) {
  const banner = document.getElementById('demoBanner');
  banner.hidden = false;
  document.getElementById('demoBannerText').textContent =
    `Demo order available in ${LANGUAGES[demoLang].english} — watch it run on the live voice counter.`;
  document.getElementById('demoBannerLink').href = `counter.html?demo=${demoLang}`;
}
