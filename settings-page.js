import * as z from 'zod/mini';
import { LANGUAGES } from './src/catalog.js';
import { KEYS, getSettings, getSarvamKey, saveSettings, storeRemove, storeSet } from './src/store.js';
import { initShell } from './src/shell.js';
import { loadSarvamKey, resolveVoiceEngine, SARVAM_CONFIG } from './src/sarvam.js';
import { webSpeechSupported } from './src/voice.js';

const $ = (id) => document.getElementById(id);
const { shop } = initShell({ active: 'settings' });
const settings = getSettings(shop);

const fields = {
  shopName: ['shopName', 'nameError'],
  vpa: ['shopVpa', 'vpaError'],
  defaultLang: ['shopLang', 'languageError'],
  voiceSpeed: ['voiceSpeed', 'speedError'],
  key: ['sarvamKey', 'keyError'],
};

const shopSchema = z.object({
  shopName: z.string().check(z.maxLength(120, 'Use 120 characters or fewer.')),
  vpa: z.string().check(z.regex(/^[a-z0-9._+-]+@[a-z0-9.-]+$/i, 'Enter a UPI ID such as yourshop@bank.')),
  defaultLang: z.enum(Object.keys(LANGUAGES), 'Choose one of the seven languages.'),
  voiceSpeed: z.number().check(z.gte(0.5), z.lte(2)),
});
const keySchema = z.object({
  key: z.string().check(z.minLength(1, 'Paste your Sarvam API key.'), z.regex(/^\S*$/, 'Remove any spaces inside the key.')),
});

function updateShop(shopName) {
  $('shopSub').textContent = `${shopName} · ${shop.city}, ${shop.state}`;
  $('shopSelect').selectedOptions[0].textContent = shopName;
}

function setFieldError(name, message = '') {
  const [input, feedback] = fields[name];
  $(feedback).textContent = message;
  $(feedback).hidden = !message;
  if (message) $(input).setAttribute('aria-invalid', 'true');
  else $(input).removeAttribute('aria-invalid');
}

function reportIssues(issues) {
  for (const issue of issues) {
    const name = issue.path[0];
    if (Object.hasOwn(fields, name)) setFieldError(name, issue.message);
  }
  const first = issues[0]?.path[0];
  if (Object.hasOwn(fields, first)) $(fields[first][0]).focus();
}

for (const [name, [input]] of Object.entries(fields)) {
  $(input).addEventListener('input', () => {
    setFieldError(name);
    $(name === 'key' ? 'keyNotice' : 'shopSaved').textContent = '';
  });
}

updateShop(settings.shopName);
for (const [code, { label, english }] of Object.entries(LANGUAGES)) {
  const option = new Option(label === english ? english : `${label} · ${english}`, code);
  option.selected = code === settings.defaultLang;
  $('shopLang').add(option);
}
$('shopName').value = settings.shopName;
$('shopVpa').value = settings.vpa;
$('voiceSpeed').value = String(settings.voiceSpeed);
function renderSpeed() {
  $('speedVal').textContent = `${Number($('voiceSpeed').value).toFixed(1)}×`;
}
$('voiceSpeed').addEventListener('input', renderSpeed);
renderSpeed();

$('shopForm').addEventListener('submit', (event) => {
  event.preventDefault();
  for (const name of Object.keys(fields).filter((name) => name !== 'key')) setFieldError(name);
  const result = shopSchema.safeParse({
    shopName: $('shopName').value.trim() || shop.name,
    vpa: $('shopVpa').value.trim() || shop.vpa,
    defaultLang: $('shopLang').value,
    voiceSpeed: $('voiceSpeed').valueAsNumber,
  });
  if (!result.success) {
    reportIssues(result.error.issues);
    return;
  }
  const next = saveSettings(shop.id, result.data);
  if (!next) {
    $('shopSaved').textContent = 'Couldn’t save. Check that this browser allows site storage.';
    return;
  }
  $('shopName').value = next.shopName;
  $('shopVpa').value = next.vpa;
  updateShop(next.shopName);
  $('shopSaved').textContent = 'Shop details saved.';
});

function renderEngineStatus() {
  const engine = resolveVoiceEngine({ apiKey: loadSarvamKey(), webSpeechSupported: webSpeechSupported() });
  const label = { sarvam: 'Sarvam voice', webspeech: 'Browser voice', none: 'Text only' }[engine];
  $('engineBadge').textContent = label;
  const current = document.createElement('strong');
  current.textContent = `Active provider: ${label}`;
  const detail = document.createElement('p');
  detail.className = 'muted small';
  detail.textContent = engine === 'sarvam'
    ? `${SARVAM_CONFIG.models.stt} for listening, ${SARVAM_CONFIG.models.chat} for chat and ${SARVAM_CONFIG.models.tts} for speech.`
    : 'Typing works with any provider.';
  $('engineStatus').replaceChildren(current, detail);
  const hasSavedKey = Boolean(getSarvamKey());
  $('keyState').textContent = hasSavedKey ? 'Key saved on this device. Paste a new key to replace it.' : 'No key saved in this browser.';
  $('removeKeyBtn').disabled = !hasSavedKey;
}

$('keyForm').addEventListener('submit', (event) => {
  event.preventDefault();
  setFieldError('key');
  const result = keySchema.safeParse({ key: $('sarvamKey').value.trim() });
  if (!result.success) {
    reportIssues(result.error.issues);
    return;
  }
  if (!storeSet(KEYS.sarvamKey, result.data.key)) {
    $('keyNotice').textContent = 'Couldn’t save the key. Check that this browser allows site storage.';
    return;
  }
  $('sarvamKey').value = '';
  renderEngineStatus();
  $('keyNotice').textContent = 'Key saved.';
});

$('removeKeyBtn').addEventListener('click', () => {
  if (!storeRemove(KEYS.sarvamKey)) {
    $('keyNotice').textContent = 'Couldn’t remove the key. Check that this browser allows site storage.';
    return;
  }
  $('sarvamKey').value = '';
  setFieldError('key');
  renderEngineStatus();
  $('sarvamKey').focus();
  $('keyNotice').textContent = 'Saved key removed.';
});

renderEngineStatus();
