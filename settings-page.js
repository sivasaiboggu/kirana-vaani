// KiranaVaani — settings page.
// Shop name / UPI VPA / default language / voice speed (per shop), plus the
// Sarvam API key (shared, browser-localStorage only, never in the repo).

import { LANGUAGES } from './src/catalog.js';
import { getShop } from './src/shops.js';
import { getCurrentShopId, getSettings, saveSettings, getSarvamKey, setSarvamKey } from './src/store.js';
import { initShell, runLayoutCheck } from './src/shell.js';
import { loadSarvamKey, resolveVoiceEngine, SARVAM_CONFIG } from './src/sarvam.js';
import { webSpeechSupported } from './src/voice.js';

const $ = (id) => document.getElementById(id);

const { shop } = initShell({ active: 'settings' });
const settings = getSettings(shop);
runLayoutCheck();

$('shopSub').textContent = `${shop.name} · ${shop.city}, ${shop.state}`;

const langSelect = $('shopLang');
for (const [code, meta] of Object.entries(LANGUAGES)) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = `${meta.label} · ${meta.english}`;
  if (code === settings.defaultLang) opt.selected = true;
  langSelect.appendChild(opt);
}

$('shopName').value = settings.shopName;
$('shopVpa').value = settings.vpa;
$('voiceSpeed').value = String(settings.voiceSpeed || 1.0);
$('speedVal').textContent = `${Number(settings.voiceSpeed || 1.0).toFixed(1)}×`;
$('voiceSpeed').addEventListener('input', (e) => {
  $('speedVal').textContent = `${Number(e.target.value).toFixed(1)}×`;
});

$('shopForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const next = saveSettings(shop.id, {
    shopName: $('shopName').value.trim() || shop.name,
    vpa: $('shopVpa').value.trim() || shop.vpa,
    defaultLang: langSelect.value,
    voiceSpeed: Number($('voiceSpeed').value) || 1.0,
  });
  $('shopSaved').hidden = false;
  $('shopSub').textContent = `${next.shopName} · ${shop.city}, ${shop.state}`;
});

function renderEngineStatus() {
  const key = loadSarvamKey();
  const engine = resolveVoiceEngine({ apiKey: key, webSpeechSupported: webSpeechSupported() });
  const box = $('engineStatus');
  box.innerHTML = '';
  const line = document.createElement('p');
  line.innerHTML = '';
  const strong = document.createElement('strong');
  strong.textContent = engine === 'sarvam'
    ? 'Active engine: Sarvam AI (key configured)'
    : engine === 'webspeech'
      ? 'Active engine: Web Speech API (free fallback)'
      : 'Active engine: none — text only';
  line.appendChild(strong);
  const models = document.createElement('p');
  models.className = 'muted small';
  models.textContent = `Models: chat ${SARVAM_CONFIG.models.chat} · STT ${SARVAM_CONFIG.models.stt} · TTS ${SARVAM_CONFIG.models.tts} · Base ${SARVAM_CONFIG.baseUrl}`;
  box.append(line, models);
  $('keyState').textContent = key
    ? 'A key is saved in this browser (showing it back would expose it — paste a new one to replace it).'
    : 'No key saved.';
  const badge = $('engineBadge');
  if (badge) {
    badge.textContent = engine === 'sarvam'
      ? 'Sarvam AI voice'
      : engine === 'webspeech'
        ? 'Web Speech voice'
        : 'Text only';
  }
}

renderEngineStatus();

$('keyForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('sarvamKey').value.trim();
  if (v) {
    setSarvamKey(v);
    $('sarvamKey').value = '';
  }
  renderEngineStatus();
});

$('removeKeyBtn').addEventListener('click', () => {
  setSarvamKey(null);
  $('sarvamKey').value = '';
  renderEngineStatus();
});
