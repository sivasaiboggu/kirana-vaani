# KiranaVaani — a voice agent for kirana shops

A voice-first checkout agent for the neighbourhood kirana shop, built for the
[#BuildForIndia Paytm Hackathon](https://www.linkedin.com/) idea: a customer
speaks an order to the shop's soundbox in Tamil, Telugu, Hindi, Kannada,
English, Malayalam or Marathi — the agent checks stock, suggests a substitute when something is
out, keeps the running bill, and shows a UPI QR to pay. The shop owner gets a
dashboard: today's orders, revenue, low-stock alerts, restock signals, top
sellers and the full voice-session history.

**No build step, no keys, no paid APIs.** Plain HTML, CSS and JavaScript.
Open `index.html` (or run the server below) and it works.

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | SaaS landing page — hero with a live soundbox demo, how it works, the 7 languages, features, pricing (display only) |
| `dashboard.html` | Shop-owner dashboard — today's orders, revenue, low-stock alerts, restock signals, top sellers, voice-session history, multi-shop switcher |
| `counter.html` | **Live voice counter** — the call-like voice session (start from the dashboard or open directly) |
| `settings.html` | Shop name, UPI VPA, default language, voice speed, Sarvam API key |

## Quick start

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` in a browser (everything is relative; the QR code
loads from a CDN — see "A note on QR codes" below).

## The live voice session

From the dashboard click **Live voice counter** (or open `counter.html`).
Big **Start voice session** opens a call-like screen:

- **States:** idle → listening → thinking → speaking, with a live waveform,
  a pulsing ring while listening, and a session timer.
- **Continuous turn-taking:** after the agent speaks its reply it listens
  again automatically — no tapping the mic for every turn. The whole flow
  (order → stock → substitute → bill → QR) is completable by voice alone.
- **Barge-in:** speak over the agent mid-sentence and it stops, listens to
  the new input, and answers that instead. The **Interrupt** button does the
  same by hand.
- **Spoken confirmations** in the customer's language: the order read back,
  a substitute offered and accepted by saying "yes", the bill read out, and
  the QR announced ("scan the QR to pay ₹489").
- **Live transcript** of customer + agent turns with language tags, and a
  **session summary** at the end (items, total, restock signals captured).
  Ending a session saves it to the dashboard's voice-session history.
- **Typed fallback:** if the microphone is unavailable (or you just prefer
  typing), type in the box — it runs through the exact same state machine.

### Demo mode (no microphone needed)

Append `?demo=ta|te|hi|kn|en|ml|mr` to any page — the counter runs a scripted
order through the live session UI, so the whole flow is demonstrable
without a mic. Add `&fast=1` to speed it up (used for screenshots).

```
counter.html?demo=ta&fast=1     # Tamil demo: atta → basmati out → Ponni → sugar → bill ₹499 at Sri Lakshmi Stores (₹489 on base prices)
counter.html?demo=ml&fast=1     # Malayalam demo
counter.html?demo=mr&fast=1     # Marathi demo
counter.html?demo=te             # Telugu demo
dashboard.html?demo=te          # dashboard with a banner pointing at the Telugu demo
index.html?demo=hi               # landing page, Hindi demo banner
```

### Real-device voice test (needs you — no mic in this VM)

1. Open `counter.html` on a phone or a laptop with a microphone.
2. Click **Start voice session**, allow the microphone.
3. Say, in Tamil for example: *"ஆசீர்வாத் ஆட்டா 5 கிலோ குடுங்க"*,
   then *"பாஸ்மதி அரிசி 2 கிலோ"* — the agent offers Ponni rice; say
   *"சரி"* to accept; then *"பில்"* for the bill and the QR.
4. Try interrupting it mid-sentence — it should stop and listen.
5. **Chrome/Edge** work best (Web Speech API). If Sarvam is configured
   (below), the same session runs through Saaras → sarvam-105b → Bulbul.

## Languages

Tamil, Telugu, Hindi, Kannada, English, Malayalam, Marathi — native script
**and** transliteration (Tanglish / Hinglish / etc.) are understood in both
speech and text. The agent answers in the language the customer is using,
and keeps the politeness register the customer used: Tamil *"kudunga"*
gets a polite reply, *"kudu"* gets a plain one — same for Telugu
*ivvandi/ivvu*, Hindi *dijiye/do*, Kannada *kodi/kodu*, Malayalam
*tharoo/tharu*, Marathi *dya/de*, and English *please*.

Marathi and Hindi share the Devanagari script, so the detector
 disambiguates on Marathi-only words first — and a bare shared word like
"बिल" stays in the session language instead of flipping the conversation
to Hindi.

## Demo shops

Three demo shops, each with its own catalogue prices, stock levels, UPI VPA
and default language (switcher in the top bar):

| Shop | City | Language | VPA |
| --- | --- | --- | --- |
| Sri Lakshmi Stores | Chennai | Tamil | srilakshmi@okhdfcbank |
| Annapurna Kirana | Hyderabad | Telugu | annapurna@okhdfcbank |
| Sharma General Store | Bengaluru | Kannada | sharma@okhdfcbank |

Basmati rice, groundnut oil and coffee are out of stock in every shop (so
the substitute flow always works); atta, Ponni rice and sugar are always in
stock. Prices and stock differ per shop — e.g. sugar is ₹48 in Chennai
(₹45 at the other two shops), Ponni rice is ₹64 in Chennai and ₹60 in
Hyderabad.

## Sarvam AI (optional — real integration, key needed)

The voice pipeline is built exactly like the winning hackathon project:
**Saaras** speech-to-text → **sarvam-105b** conversation with tool calls →
**Bulbul** text-to-speech. When a key is configured, Sarvam is the primary
engine; without one, the free Web Speech API is the automatic fallback.
The counter shows which engine is active.

### Where to put your key (when you have one)

Three places, in priority order — pick **one**:

1. **Settings page** (`settings.html`) — paste the key, it is stored only
   in the browser's localStorage, never in the project files.
2. **`sarvam.config.js`** — copy `sarvam.config.example.js` to
   `sarvam.config.js` (same folder) and paste your key. It is gitignored;
   never commit it.
3. **Before the app loads**, set `window.SARVAM_API_KEY` in any script.

Get a key at https://dashboard.sarvam.ai (sign up → create an API key).
**No key is shipped or hardcoded** — the example file contains only a
placeholder. No real Sarvam call is ever made without a key you supplied.

> A browser key is visible in devtools, so for a real production shop,
> proxy Sarvam through a small server instead of shipping the key to the
> browser. `src/sarvam.js` is written so the same client can be moved
> server-side unchanged.

### What the Sarvam path does

- `src/sarvam.js` — config (base `https://api.sarvam.ai`, chat
  `POST /v1/chat/completions` with model `sarvam-105b`, STT
  `POST /speech-to-text` with `saaras:v3`, TTS `POST /text-to-speech`
  with `bulbul:v3`), key loading, and the client with an injectable fetch
  (so tests mock HTTP — no real key, no real network in tests).
- **Tool calls** — the model can call four tools, the same ones the local
  agent uses: `check_stock`, `suggest_substitute`, `update_bill`,
  `generate_qr` (full JSON schemas in `SHOP_TOOLS`). Results are fed back
  to the model for up to 3 rounds. A failed tool call returns an error
  object to the model instead of crashing; if the chat call itself fails,
  the session falls back to the local engine — and if tools already ran,
  the fallback reads the bill instead of re-processing, so an item is
  never added twice.
- **Voice pipeline** — `SarvamIO` records with `MediaRecorder`, stops
  after ~1.2 s of silence (20 s max), sends the audio to Saaras, and
  speaks the reply with Bulbul (pace from Settings). `voice.js` picks
  `SarvamIO` when a key is configured, `WebSpeechIO` otherwise.
- **Register** — `detectRegister()` reads the customer's politeness
  (`kudunga`/`kudu`, `ivvandi`/`ivvu`, `dijiye`/`do`, `kodi`/`kodu`,
  `tharoo`/`tharu`, `dya`/`de`, `please`) and `buildSystemPrompt()` tells
  the model to mirror it and to never invent a price, stock level or item.

## Catalogue

34 items with real-ish prices and stock: grains, pulses, oils, spices,
dairy, snacks, personal care and household. Out of stock today: Basmati
rice, groundnut oil, coffee — each has a substitute the agent offers
(Ponni rice, sunflower oil, tea powder).

## How the understanding works (no AI API — rules, fully testable)

- **Language detection:** Unicode script ranges (Tamil / Telugu / Devanagari /
  Kannada / Malayalam), falling back to transliterated cue words, then to
  the language selected in the UI. Marathi and Hindi share Devanagari:
  Marathi-only words are checked first, and a bare shared word keeps the
  session language.
- **Item matching:** every product has names in all seven languages plus Latin
  transliteration aliases. Matches are longest-first with spans claimed once,
  so "basmati rice" never also matches plain "rice".
- **Quantities:** Arabic digits, Indic digits (௫, ५, ൨…), number words in all
  seven languages ("two", "rendu", "do", "ondu", "அரை", "രണ്ട്",
  "दोन"…), `g → kg` and `ml → litre` conversion, and dozen handling
  ("2 dozen banana", "1 dozen eggs" = 12 pieces).
- **Actions:** add / remove / bill / checkout / yes / no / greet / repeat,
  from keywords in all seven languages. "Same again" and "2 more" re-add
  the last item from memory, without re-asking.

## Tests

```bash
npm test        # 92 tests, all green
```

- `tests/agent.test.js`, `tests/intent.test.js`, `tests/billing.test.js` — the
  original 46 (intent parsing in all languages, billing maths,
  substitutes, UPI link format, full agent conversations)
- `tests/session.test.js` — the turn-taking state machine: start → listen →
  think → speak → listen, continuous turns, barge-in (speech + Interrupt
  button), session summary, demo driver, typed fallback
- `tests/shops.test.js` — the 3 demo shops, catalogue overrides, settings
  round-trip, dashboard summary maths (revenue, top sellers, low stock)
- `tests/sarvam.test.js` — the Sarvam client with **mocked HTTP** (endpoint,
  auth header, model, payload), tool-call routing in Tamil and English,
  chat-failure fallback without double-billing, politeness register in all
  7 languages
- `tests/languages.test.js` — Malayalam + Marathi end to end (catalogue,
  detection incl. Marathi-vs-Hindi, demo flows, register), confirmation
  variety, unclear-speech recovery, repeat orders
- `tests/receipt.test.js` — the session receipt in all seven languages
- `tests/layout.test.js` — every page in headless Chrome over CDP: zero
  horizontal overflow at a true 390px phone width and at 1280px desktop

The QR payload was also verified end-to-end: the exact UPI string for a
₹489.00 bill was encoded with the vendored library and decoded back to the
identical string with a QR reader.

## A note on QR codes

The QR image is generated by the `qrcode-generator` library (`vendor/qrcode.js`,
MIT) running locally in the browser — the payment string is a standard
UPI payload (`upi://pay?pa=…&pn=…&am=…&cu=INR`) that any UPI app can scan.
The demo merchant VPA is `kirana@okhdfcbank` — swap it in Settings (or
per shop) for the real shop's VPA before using it with real money.

## Screenshots

- `screenshots/landing.png` — landing page
- `screenshots/dashboard.png` — owner dashboard (Chennai shop)
- `screenshots/session-ta-mid.png` — Tamil voice session, mid-call
- `screenshots/session-ta.png` — Tamil session ended, bill ₹499 + QR
- `screenshots/session-te.png` — Telugu session ended
- `screenshots/session-ml.png` — Malayalam session ended, bill ₹499 + QR
- `screenshots/session-mr.png` — Marathi session ended, bill ₹499 + QR
- `screenshots/receipt-ta.png` — session summary as a paper receipt (Tamil)
- `screenshots/settings.png` — settings page
- `screenshots/landing-mobile.png` — landing page at 390px

## Files

```
index.html  landing.js           # landing page
dashboard.html  dashboard-page.js
counter.html  counter.js         # live voice counter
settings.html  settings-page.js
styles.css                       # whole design system
src/agent.js    # shop brain: orders, stock, substitutes, bill, QR
src/catalog.js  # 34-item catalogue + substitutes
src/intent.js   # language detection + multilingual intent parsing
src/billing.js  # cart, line totals, ₹ formatting
src/upi.js      # UPI link builder (demo merchant VPA)
src/session.js  # voice session state machine + demo driver
src/receipt.js  # session summary as a paper receipt (all 7 languages)
src/shops.js    # 3 demo shops + catalogue overrides
src/store.js    # localStorage persistence (settings, sessions)
src/dashboard.js # dashboard maths (pure functions)
src/sarvam.js   # Sarvam AI client + tools + conversation + register
src/voice.js    # WebSpeechIO / SarvamIO / SilentIO
src/shell.js    # shared top bar (nav + shop switcher + engine badge)
sarvam.config.example.js  # copy to sarvam.config.js, paste your key
tests/          # 92 tests (node --test)
screenshots/
vendor/qrcode.js  # qrcode-generator 1.4.4 (MIT)
```

## Status

- v3.0.0 — KiranaVaani: renamed from Kirana Commerce; Malayalam + Marathi
  (7 languages); the agent sounds human (varied confirmations, unclear-
  speech recovery, repeat orders, receipt summary); UI polished into one
  coherent SaaS product (design tokens, bento grid, shimmer CTA, SVG icons,
  count-up stats, layout tests at 390px).
- v2.0.0 — SaaS product: landing page, dashboard, 3 demo shops, live voice
  counter with barge-in, Sarvam AI integration with Web Speech fallback.
- **Not pushed to GitHub yet** — the repo `kirana-vaani` needs to be
  created first (public, no README), then this folder can be pushed and
  GitHub Pages enabled.
- **Voice not exercised on a real microphone yet** — the demo/text path is
  verified end-to-end through the same state machine (see "Real-device
  voice test" above); the live mic path needs a real device.
