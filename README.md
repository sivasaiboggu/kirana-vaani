# KiranaVaani — billing and khata for kirana shops

A voice-first checkout agent for the neighbourhood kirana shop, built for the
[#BuildForIndia Paytm Hackathon](https://www.linkedin.com/) idea: a customer
speaks an order to the shop's soundbox in Tamil, Telugu, Hindi, Kannada,
English, Malayalam or Marathi — the agent checks stock, suggests a substitute when something is
out, keeps the running bill, and shows a UPI QR to pay. The shop owner gets a
dashboard with orders, low stock, recent sessions and customer khata.
The counter also supports direct shelf picking, bill edits and optional review of
what the microphone heard before it reaches the bill.

**The sample counter runs without a key.** The app is plain HTML, CSS and JavaScript, with a static production build. See the [marigold shop-bill design and verification notes](docs/marigold-counter.md).

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Product introduction, sample order playback, seven language demos and cost |
| `dashboard.html` | Shop-owner dashboard — today's orders, revenue, low-stock alerts, restock signals, top sellers, voice-session history, multi-shop switcher |
| `counter.html` | **Open voice counter** — the call-like voice session (start from the dashboard or open directly) |
| `settings.html` | Shop name, UPI VPA, default language, voice speed, Sarvam API key |
| `privacy.html` | Browser storage, voice providers and payment data |
| `404.html`, `500.html` | Static recovery pages |

## Project brief (master prompt, Section 1)

- **Name:** KiranaVaani
- **Type:** web app — a voice agent for kirana (corner) shops. Plain
  HTML/CSS/JS with a static Vite build.
- **What it does (1 sentence):** a customer speaks an order in one of
  seven Indian languages; the agent checks stock, suggests a substitute,
  keeps the running bill, and shows a UPI QR to pay.
- **Target user and biggest pain:** a small kirana shop owner in India.
  Customers speak a different language than the owner, and the counter
  slows down while the owner checks stock and totals by hand.
- **Core promise:** a customer speaks, the shop understands, the bill is
  right.
- **Tone:** warm, plain, shopkeeper-human.
- **Colours:** warm paper, dark ink, one stamp blue accent.
- **Reference sites:** Mobbin (real counter and voice flows), Land-book
  (editorial landing), Refero (design-system discipline).
- **Platforms:** web — desktop and phone, via GitHub Pages.
- **Must-haves:** 7-language voice agent, stock check + substitutes,
  running bill, UPI QR, restock signals, owner dashboard, settings that
  persist, Sarvam AI optional on the owner's own key.

## Design system

The signature is a ruled shop ledger, from the sample bill through to the sale receipt and daily totals. [Redesign notes](docs/redesign.md) cover every screen, the measured light and dark contrast table, screen flows and the launch checklist. The source values live in [tokens.json](tokens.json), [CSS variables](theme/tokens.css) and the [Tailwind theme](theme/tailwind.css).

## Quick start

Use Node.js 24.22.3 and npm. The lockfile pins the frontend dependencies.

```sh
npm ci
npm start
```

Open `http://127.0.0.1:8000/`. The browser demo needs no environment variables.

```sh
npm run build
npm run preview
```

The default production base is `/kirana-vaani/`. Publish `dist/` on the static host and use HTTPS for voice and the offline shell. Set `KIRANA_BASE=/` for a root deployment and use the same value for build and preview.

## The live voice session

From the dashboard click **Open voice counter** (or open `counter.html`).
Big **Start voice session** opens a call-like screen:

- **States:** idle → listening → thinking → speaking, with a live waveform,
  a state label and a session timer.
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

For a local pilot, save your key in Settings. The browser keeps it in localStorage. A self-hosted integration can define `window.SARVAM_API_KEY` or `window.SARVAM_CONFIG.apiKey` before the app module loads. A host-supplied value takes precedence. See `sarvam.config.example.js` for the expected shape.

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

```sh
npx playwright install chromium
npm test
```

Set `CHROME_BIN` to use an installed Chromium instead. `npm test` builds the app and runs the Node and browser suites.

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
- `tests/receipt.test.js` — the session receipt in all seven languages,
  including item names in the receipt language
- `tests/upi.test.js` — the UPI link round-trips (merchant, amount,
  currency, note) exactly as the QR encodes it
- `tests/layout.test.js` — built pages on phone and desktop in both modes, axe, typed ordering through receipt and history, settings validation and offline navigation.

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

[Review images](docs/review/) compare the prior and redesigned screens. To reproduce the capture, run the preview server and then:

```sh
node scripts/shots.mjs http://127.0.0.1:4173/kirana-vaani/ screenshots/light
node scripts/shots.mjs http://127.0.0.1:4173/kirana-vaani/ screenshots/dark dark
```

## Files

```
index.html  landing.js           # landing page
dashboard.html  dashboard-page.js
counter.html  counter.js         # live voice counter
settings.html  settings-page.js
styles.css                       # screen layouts and components
theme/                           # CSS roles, fonts and Tailwind theme
tokens.json                      # design tokens: OKLCH palette, type, contrast table
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
tests/          # logic, accessibility and browser flow checks
public/         # manifest, brand marks and social sharing image
scripts/shots.mjs  # real headless-Chrome renders of every screen
vendor/qrcode.js  # qrcode-generator 1.4.4 (MIT)
```

## Status

- v3.2.0 — Master-prompt polish (round 10). Logic, all found by testing
  rather than assumed: quantities in multi-item orders now attach to the
  item they sit next to ("basmati rice 2 kg and groundnut oil 1 litre"
  used to order groundnut oil as 2 litres); two out-of-stock offers in
  one turn are now a queue, so "yes" adds them in order instead of
  silently dropping the first; the shelf really depletes as items are
  added and comes back on remove (the same 50 kg of sugar could be sold
  forever); a repeat that short-fills says so; starting a new session
  starts a fresh bill (the old bill used to carry over); receipt item
  names are in the receipt language (they were always English); the
  scripted demo waits for each reply to finish, so demo receipts no
  longer record five interruptions that never happened. Design: colours
  are OKLCH with hex fallbacks (`tokens.json` + contrast table, all AA —
  muted text darkened, mic on the deeper marigold); mono type for machine
  strings; steps and features are ledger rows under rules, not identical
  cards; the landing nav fits one row at 1280px. 110 tests (was 97).
- v3.1.0 — Craft pass: one deliberate identity ("the printed shop
  bill" — flat paper, solid ink-green, serif signboard type, dashed
  receipt rules, tabular numerals); every gradient, glow, glass panel,
  shimmer and staggered entrance removed; copy rewritten in a plain
  human voice with no clichés or decorative symbols (guarded by
  tests/copy.test.js); the invented pricing tiers replaced with an
  honest "What it costs"; the hero playback labelled as played back,
  never live; the receipt restock line localised in all seven
  languages; layout tests fixed for this VM's Chrome (file:// +
  WebGL policy) and a screenshot script added.
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
