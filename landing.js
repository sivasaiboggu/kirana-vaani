import { LANGUAGES } from './src/catalog.js';
import { initShell, demoLink } from './src/shell.js';
import { icon } from './src/icons.js';
import { loadSarvamKey, resolveVoiceEngine } from './src/sarvam.js';
import { webSpeechSupported } from './src/voice.js';

const $ = (id) => document.getElementById(id);
initShell({ active: 'home' });
const engine = resolveVoiceEngine({ apiKey: loadSarvamKey(), webSpeechSupported: webSpeechSupported() });
$('engineBadge').textContent = engine === 'sarvam' ? 'Sarvam voice' : engine === 'webspeech' ? 'Browser voice' : 'Text only';
$('heroShopLabel').textContent = `Played back · ${LANGUAGES.ta.english}`;
$('heroLocation').textContent = 'Sri Lakshmi Stores, Chennai';

const examples = {
  ta: 'ஆசீர்வாத் ஆட்டா 5 கிலோ இருக்கா?',
  te: 'ఆశీర్వాద్ గోధుమ పిండి 5 కిలోలు',
  hi: 'आशीर्वाद आटा 5 किलो',
  kn: 'ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು 5 ಕಿಲೋ',
  en: 'Aashirvaad atta 5 kg please',
  ml: 'ആശിർവാദ് ആട്ട 5 കിലോ ഉണ്ടോ?',
  mr: 'आशीर्वाद आटा 5 किलो पाहिजे',
};

for (const [code, { label, english }] of Object.entries(LANGUAGES)) {
  const row = document.createElement('li');
  const link = document.createElement('a');
  link.href = demoLink(code);
  const name = document.createElement('strong');
  name.lang = code;
  name.textContent = label;
  const translation = document.createElement('span');
  translation.className = 'muted';
  translation.textContent = label === english ? '' : english;
  const example = document.createElement('span');
  example.className = 'language-example';
  example.lang = code;
  example.textContent = examples[code];
  const arrow = document.createElement('span');
  arrow.className = 'language-arrow';
  arrow.innerHTML = icon('arrow');
  link.append(name, translation, example, arrow);
  row.append(link);
  $('languageList').append(row);
}

const lines = [
  ['Customer', examples.ta, '₹0.00'],
  ['Shop', '5 கிலோ ஆசீர்வாத் ஆட்டா சேர்த்தாச்சு. ₹275.00.', '₹275.00'],
  ['Customer', 'பாஸ்மதி அரிசி 2 கிலோ', '₹275.00'],
  ['Shop', 'பாஸ்மதி அரிசி ஸ்டாக் இல்லை. பொன்னி அரிசி சேர்க்கவா?', '₹275.00'],
  ['Customer', 'சரி', '₹275.00'],
  ['Shop', '2 கிலோ பொன்னி அரிசி சேர்த்தாச்சு. மொத்தம் ₹403.00.', '₹403.00'],
  ['Customer', '2 கிலோ சர்க்கரை', '₹403.00'],
  ['Shop', 'சர்க்கரை சேர்த்தாச்சு. மொத்தம் ₹499.00.', '₹499.00'],
];

const transcript = $('heroTranscript');
const control = $('playbackControl');
let nextLine = 2;
let elapsed = 0;
let playback;

function showLine(index) {
  const [sender, text, amount] = lines[index];
  const line = document.createElement('div');
  line.className = 'hero-line';
  const label = document.createElement('span');
  label.className = 'hero-who';
  label.textContent = sender;
  const message = document.createElement('span');
  message.lang = 'ta';
  message.textContent = text;
  line.append(label, message);
  transcript.append(line);
  $('heroBill').textContent = amount;
  transcript.scrollTop = transcript.scrollHeight;
}

function updatePlayback() {
  elapsed += 1;
  $('heroTimer').textContent = `00:${String(elapsed).padStart(2, '0')}`;
  if (elapsed % 2 === 0) showLine(nextLine++);
  if (nextLine === lines.length) {
    clearInterval(playback);
    playback = null;
    control.textContent = 'Replay order';
  }
}

showLine(0);
showLine(1);

control.addEventListener('click', () => {
  if (playback) {
    clearInterval(playback);
    playback = null;
    control.textContent = 'Resume playback';
    return;
  }
  if (nextLine === lines.length) {
    transcript.replaceChildren();
    nextLine = 2;
    elapsed = 0;
    $('heroTimer').textContent = '00:00';
    showLine(0);
    showLine(1);
  }
  control.textContent = 'Pause playback';
  playback = setInterval(updatePlayback, 1000);
});

const demoLang = new URLSearchParams(location.search).get('demo');
if (Object.hasOwn(examples, demoLang)) {
  $('demoBanner').hidden = false;
  $('demoBannerText').textContent = `A sample order is available in ${LANGUAGES[demoLang].english}.`;
  $('demoBannerLink').href = demoLink(demoLang);
}
