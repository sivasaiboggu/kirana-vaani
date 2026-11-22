# KiranaVaani redesign

KiranaVaani is a browser-based order counter for Indian kirana shops. Customers can speak or type in seven languages, and the shop can check the running bill, stock requests and past sessions. The first order should be easy to try without a microphone or a key.

## Visual direction

The signature is a **ruled shop ledger**. A dashed rule separates the item lines from the total on the sample bill, running bill and final receipt. On the dashboard it closes the daily totals; in settings a straight rule separates the shop details from the voice provider. The home page sets a receipt against a dark plate. Inside the app, the bill and the owner’s numbers get more room than secondary controls.

Three accent options were considered.

| Option | Reason |
| --- | --- |
| Stamp blue `#2f43a0` | Selected. It recalls blue register ink, reads crisply on warm paper and can shift to a lighter tint in dark mode. |
| Brick red `#953b30` | Familiar on receipt stamps, though it would compete with the out-of-stock and form error colors. |
| Bottle green `#28533d` | A natural fit for shop signage, though too close to the positive stock state and the previous palette. |

A 12-step warm neutral ramp carries the surfaces. Blue is reserved for primary actions, active selection, focus, links and chart bars, with a target below 10% of the visible screen. Across the Chromium capture set, pixels in the blue family covered up to 4.13% in light mode and 4.18% in dark mode. Red and amber are semantic and always have text labels. Both themes use the same roles and hierarchy. The theme follows the operating system until the user chooses a preference in the header.

- [CSS variables](../theme/tokens.css) include sRGB hex fallbacks, OKLCH values, role mappings and both modes.
- [Tailwind v4 theme](../theme/tailwind.css) exposes the same colors, type, spacing, radii and elevation for utility consumers.
- [Token JSON](../tokens.json) includes source values, alias maps, motion, and the full set of measured text and non-text pairs.
- Bricolage Grotesque is the display and body family. The self-hosted Latin subsets and five script-specific Noto Sans subsets cover English, Tamil, Telugu, Hindi, Kannada, Malayalam and Marathi. System mono is limited to timers and machine strings. Numbers use tabular spacing for totals. Body type scales from 16px to 18px at 1.6 leading, with a 68ch maximum prose measure.
- Spacing follows a 4px base with 8px multiples for wider gaps. Inputs and buttons share a 4px radius and 44px minimum height. Sheets have square corners, an inset 1px rule and a short shadow. The three depth levels cover ruled surfaces, working bills and the projected bill. Grain is confined to the playback plate.
- New conversation lines enter with a 240ms opacity and position change. Press feedback and voice-state bars use 160–240ms eased transforms. Sample playback starts on request and can pause. Reduced motion removes visual animation. Totals appear immediately so they remain easy to compare.

## Sitemap and screen plan

| Route | Applied layout and hierarchy | Flow and states |
| --- | --- | --- |
| Home `/` | Offset headline and receipt playback. Ruled rows explain the order steps, list the seven language demos and show the actual cost. | Try a sample order without mic access or pick a language. Play, pause and replay the Tamil preview. The sample label identifies the shop whose prices are shown. |
| Voice counter `/counter.html` | Session controls and a ruled conversation on the left, a running ticket and stock on the right. On phones there is a direct jump to the bill. | Start, interrupt and end voice, or type immediately. Idle, listening, thinking, speaking, ended, and voice failure have visible copy. Prompts, substitutions and item quantities use the existing flow. The shelf disclosure holds all 34 items. |
| Checkout and receipt `/counter.html` | The bill and localized receipt share the same totals rule. The UPI QR keeps its white quiet area in either theme. | Pay becomes available when the bill has items. The QR is tied to the displayed total and clears when the amount changes. The completed receipt lists items, total, session details and restock notes. |
| Dashboard `/dashboard.html` | Today’s billed total leads a single ledger. Sales and expandable session history get the wider column. Stock and restock requests share the narrower column. | Switch between the three shops, open the counter, review the language split and expand transcripts. Empty sales, stock lists and session history say what is missing. Bills are recorded when the session ends. |
| Settings `/settings.html` | Section titles sit beside the forms on wide screens and above them on phones. The active voice provider appears near the key controls. | Edit shop details, choose a language and speed, or save and remove an optional Sarvam key. Errors are announced through field descriptions, focus moves to the first invalid field, and successful saves are confirmed in place. |
| Privacy `/privacy.html` | Plain text with short, ruled sections. | Look up where shop data, speech and UPI details go and how to remove local data. |
| Errors `/404.html`, `/500.html` | Static recovery pages with links to home and the counter. | The host serves `404.html` on unknown routes. Hosts that support a server error document can map `500.html`. |

The simplest first order is Home → Try a sample order → live counters and bill → localized receipt. The owner path is Dashboard → Open voice counter → End session → Recent sessions. Settings are reachable from either path.

## Engineering decisions

The app keeps HTML, CSS, ES modules and the existing Node-tested business logic. A Vite multipage build suits this browser-local product and gives every screen a direct URL. Zod Mini validates shop and key forms; the voice, catalogue, substitutions, billing and payment payload remain browser modules. Local storage uses the existing shop, session and key records. No database migration is required.

The shell owns navigation and theme choice. The page modules render application data in semantic HTML. `src/` owns the tested catalogue, parsing, voice providers and billing logic. `theme/` owns visual roles. Fonts and privacy copy are served locally. The production service worker only handles same-origin static routes and assets. Copy uses real catalogue examples and states which data are sample data.

Browser testing caught a shop-ID bug in session recording. The typed-order test now verifies that the dashboard sees the completed session. A key-loading test covers the fix for JSON-stored Sarvam keys. The code also prevents a previously generated QR from remaining visible after the bill amount changes.

## Measured contrast

Ratios are WCAG 2.2 relative luminance on the sRGB fallbacks. Those exact colors also supply the OKLCH representations. Text requires 4.50:1 and control boundaries and focus indicators require 3.00:1. The tests recompute the ratios from the hex values.

| Pair | Light | Dark | Minimum |
| --- | ---: | ---: | ---: |
| ink / canvas | 16.11:1 | 16.11:1 | 4.50:1 |
| ink / paper | 17.40:1 | 13.66:1 | 4.50:1 |
| ink / surface | 14.91:1 | 9.56:1 | 4.50:1 |
| muted / canvas | 6.26:1 | 8.66:1 | 4.50:1 |
| muted / paper | 6.75:1 | 7.34:1 | 4.50:1 |
| muted / surface | 5.79:1 | 5.14:1 | 4.50:1 |
| accent / canvas | 7.87:1 | 9.86:1 | 4.50:1 |
| accent / paper | 8.50:1 | 8.35:1 | 4.50:1 |
| accent / surface | 7.28:1 | 5.85:1 | 4.50:1 |
| danger / canvas | 6.76:1 | 9.60:1 | 4.50:1 |
| danger / paper | 7.30:1 | 8.14:1 | 4.50:1 |
| danger / surface | 6.26:1 | 5.70:1 | 4.50:1 |
| warning / canvas | 7.16:1 | 10.44:1 | 4.50:1 |
| warning / paper | 7.73:1 | 8.85:1 | 4.50:1 |
| warning / surface | 6.62:1 | 6.19:1 | 4.50:1 |
| success / canvas | 6.63:1 | 10.33:1 | 4.50:1 |
| success / paper | 7.16:1 | 8.75:1 | 4.50:1 |
| success / surface | 6.13:1 | 6.13:1 | 4.50:1 |
| ink / stripe | 13.27:1 | 9.56:1 | 4.50:1 |
| muted / stripe | 5.15:1 | 5.14:1 | 4.50:1 |
| ink / accent-wash | 15.48:1 | 11.50:1 | 4.50:1 |
| accent / accent-wash | 7.56:1 | 7.03:1 | 4.50:1 |
| on-accent / accent | 8.50:1 | 10.35:1 | 4.50:1 |
| on-accent / accent-press | 11.05:1 | 12.40:1 | 4.50:1 |
| on-panel / ink-panel | 16.11:1 | 16.93:1 | 4.50:1 |
| panel-muted / ink-panel | 8.66:1 | 9.10:1 | 4.50:1 |

| Pair | Light | Dark | Minimum |
| --- | ---: | ---: | ---: |
| edge / canvas | 4.06:1 | 5.30:1 | 3.00:1 |
| edge / paper | 4.38:1 | 4.49:1 | 3.00:1 |
| edge / surface | 3.75:1 | 3.14:1 | 3.00:1 |
| edge / stripe | 3.34:1 | 3.14:1 | 3.00:1 |
| accent / canvas | 7.87:1 | 9.86:1 | 3.00:1 |
| accent / paper | 8.50:1 | 8.35:1 | 3.00:1 |
| accent / surface | 7.28:1 | 5.85:1 | 3.00:1 |
| on-panel / ink-panel | 16.11:1 | 16.93:1 | 3.00:1 |

## Launch checklist

- [x] Build the static frontend and run the Node and Chromium suites against it.
- [x] Check keyboard order, focus, both color modes, reduced motion, and 320px and desktop layouts.
- [x] Verify that a typed order, a substitution, the UPI amount and receipt, and the saved dashboard transcript agree.
- [x] Verify that a previously installed shell loads offline and opens the local counter and dashboard.
- [ ] Publish `dist/` through the approved Pages workflow and check URLs, the 404 response, the social image and HTTPS in the deployed environment.
- [ ] Test microphone permissions, interruption and pronunciation on real phones in each language. Test Sarvam with a valid, scoped key.
- [ ] Set and independently verify the shop’s UPI ID. Scan the QR on a real phone and confirm the displayed payee and amount before use.
- [ ] For production shop use, agree on data retention and put the Sarvam key behind a server-side proxy. Add provider limits and alerts there.

**Risks.** Web Speech availability and voice quality vary by device. The browser keeps transcripts and pilot keys in its local profile. A real pilot needs a decision on shared-device access and transcript retention. A UPI QR requests a transfer; the demo has no settlement confirmation. Shop inventory still follows the catalogue and the existing per-counter depletion rules. Static deployment must publish the build output because the settings validation is bundled at build time.

## Suggested work for v2

1. Test recognition quality and pronunciation with shop staff in all seven languages.
2. Add a server-side Sarvam proxy with rate limits and per-shop limits.
3. Add UPI payment confirmation and reconciliation.
4. Sync inventory and record stock adjustments across counters.
5. Give owners date filters for sales and voice sessions.
6. Export the ledger for inventory and bookkeeping.
7. Add a receipt print and share flow.
8. Localize the full interface and review it with native speakers.
9. Add configurable transcript retention and a one-click data export and deletion flow.
10. Establish cross-browser visual baselines and opt-in performance monitoring for a pilot.
