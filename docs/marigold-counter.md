# KiranaVaani v2 shop counter

KiranaVaani helps a kirana shopkeeper take an order in seven languages, check the shelf, make a UPI QR or put the bill on a customer’s khata. Open the sample counter to see a working bill without signing in, submitting a key or granting microphone access.

## Design decisions

The signature is a printed shop bill. Two ink-green rules mark the start of the slip and the line above its total. The home page runs a broad sample slip across the masthead. The counter gives shelf, order and bill their own working areas. The dashboard puts today’s sales on a dark ink panel and credit entries on an inset ledger.

| Accent considered | Decision |
| --- | --- |
| Marigold `#f4b93f` | Selected. It recalls shop signage, distinguishes actions and still gives ink-green text strong contrast. |
| Pale saffron `#e9c87a` | Readable with ink green, with less separation between field surfaces and actions. |
| Rust `#a74929` | Suits a printed stamp and competes with the out-of-stock and validation states. |

- The 12-step neutral ramp moves from warm paper to green ink. The solid marigold is reserved for actions, the shop mark and chart progress. Tinted paper supports the sample order and the active language. Error, warning and stock states use visible text with semantic color.
- Baloo 2 is used for both display and body text. Latin, Latin Extended and Devanagari are served as variable WOFF2 subsets from Fontsource 5.3.0. Noto Sans provides Tamil, Telugu, Kannada and Malayalam. System mono is used for timers and identifiers. Display and body scale with `clamp()`. Body uses 16–18px at 1.6 line height and long copy stops at 68ch.
- Spacing starts with 4px. Use 4–8px inside rows, 12–16px inside panels and 24–48px between sections. Paper slips use square corners and their own ruled edges. Interactive corners are 4px. Inputs and primary controls are at least 44px tall. The three depth levels are an inset paper rule, a short working-surface shadow and a deeper sample-bill shadow. Grain stays behind the sample slip.
- Motion uses opacity and transforms. Controls respond in 160ms, totals in 200ms, slips and transcript rows in 240ms and sales bars in 320ms. Adjacent new bill lines can enter 40ms apart. Cross-document transitions follow OS motion settings, as do list entry, chart fill and total movement. Playback starts on request.

[CSS variables](../theme/tokens.css) · [Tailwind v4 theme](../theme/tailwind.css) · [Machine-readable tokens](../tokens.json) · [Subset licenses](../assets/fonts/) · [Verification and capture gallery](review/v2/README.md)

## Reference study

| Reference | Application |
| --- | --- |
| [21st.dev Command Menu](https://21st.dev/%40pmalay694/components/command-menu) | Kept the idea of keyboard-first local search and a direct action on each result. The shelf search also matches catalogue aliases. |
| [React Bits Animated List](https://reactbits.dev/components/animated-list) | Applied short entry motion to new bill and conversation lines. Existing rows stay visually stable. |
| [Magic UI Number Ticker](https://magicui.design/docs/components/number-ticker) | Adapted the idea of drawing attention to a changed total. The updated amount appears immediately with a quick position and opacity transition. |
| [Uiverse buttons](https://uiverse.io/buttons) | Used a short lift and a tight press with a persistent inset edge on the primary button. |
| [Mobbin mobile screens](https://mobbin.com/explore/mobile/screens) | Used the familiar checkout sequence of item review, amount and payment action. On a phone the current bill has a direct jump link. |
| [Refero Styles, Ramp](https://styles.refero.design/style/b38702a0-75ab-474c-9106-00b624535825) and [Seline](https://styles.refero.design/style/7967c6d9-e50c-42b5-b4d1-74003ba41781) | Used ink-like rules for transaction grouping and a single focal number for the daily view. |
| [Designeer](https://designeer.xyz/) and [Inspora](https://inspora.design/) | Both were attempted through the web connector and direct HTTPS. Neither was reachable in this environment. |

## Sitemap and behaviour

| Route | Main path |
| --- | --- |
| `/` | Play or pause the sample order, enter a sample counter in one of seven languages, or go to shop accounts. |
| `/counter.html` | Find a stocked item, speak or type. Review microphone text if enabled. Edit exact quantities, remove lines, accept substitutes, open the QR or save a credit bill. |
| `/dashboard.html` | Review sales, stock signals and sessions. Jump to khata, open a customer account, and record part or all of the outstanding balance. The account keeps charge and payment dates after settlement. |
| `/settings.html` | Change shop details, the default order language, UPI ID and voice provider. |
| `/privacy.html` | Read how browser data, khata, recordings and UPI are handled and how to clear local data. |
| `/404.html`, `/500.html` | Navigate back home or open the counter from static recovery pages. |

## Implementation and local run

The existing Vite multipage build gives every route a direct URL and supports the established offline shell. Native HTML forms, Zod Mini for settings and small ES modules suit a browser-local shop tool. The existing GitHub Actions workflow builds the preview and runs Node and Chromium coverage. No server migration or additional production dependency is required.

`counter.js` and `dashboard-page.js` handle rendering. `src/agent.js`, `src/session.js` and `src/voice.js` manage the bill and the microphone. `src/khata.js` folds append-only shop entries into customer balances. Each credit entry stores its receipt in the same write, and the dashboard reads that receipt alongside older sessions. Existing settings and session keys still work. Customers are grouped within each shop by normalized name. Web Locks serialize simultaneous khata writes in browsers that support them. Normal UPI links still use the selected shop name, UPI ID and exact bill amount.

```sh
npm ci
npx playwright install chromium
npm test
npm run build
npm run preview
```

Use Node `24.22.3` as pinned in CI. Registry versions checked for this pass were Vite `8.3.8`, Zod `4.6.7`, Playwright `1.65.1` and `@axe-core/playwright` `4.14.0`. The optional `KIRANA_BASE` build variable defaults to `/kirana-vaani/`. `CHROME_BIN` points tests and screenshot capture at a system Chromium when needed. A Sarvam key is optional and can be added per browser in Settings. See [environment setup](../sarvam.config.example.js).

## Measured contrast

Ratios were calculated from the sRGB equivalents of the OKLCH tokens. Text uses the WCAG AA 4.50:1 threshold. Control edges and focus indicators use 3.00:1. Tests recompute these values.

| Pair | Light | Dark | Minimum |
| --- | ---: | ---: | ---: |
| ink / canvas | 10.76:1 | 13.37:1 | 4.50:1 |
| ink / paper | 11.91:1 | 11.42:1 | 4.50:1 |
| ink / surface | 9.91:1 | 8.98:1 | 4.50:1 |
| muted / canvas | 6.01:1 | 6.97:1 | 4.50:1 |
| muted / paper | 6.65:1 | 5.96:1 | 4.50:1 |
| muted / surface | 5.53:1 | 4.68:1 | 4.50:1 |
| action / canvas | 10.76:1 | 10.70:1 | 4.50:1 |
| action / paper | 11.91:1 | 9.14:1 | 4.50:1 |
| action / surface | 9.91:1 | 7.19:1 | 4.50:1 |
| danger / canvas | 6.51:1 | 9.03:1 | 4.50:1 |
| danger / paper | 7.20:1 | 7.71:1 | 4.50:1 |
| danger / surface | 5.99:1 | 6.06:1 | 4.50:1 |
| warning / canvas | 6.90:1 | 10.78:1 | 4.50:1 |
| warning / paper | 7.64:1 | 9.21:1 | 4.50:1 |
| warning / surface | 6.35:1 | 7.24:1 | 4.50:1 |
| success / canvas | 6.53:1 | 9.63:1 | 4.50:1 |
| success / paper | 7.23:1 | 8.22:1 | 4.50:1 |
| success / surface | 6.01:1 | 6.47:1 | 4.50:1 |
| ink / stripe | 8.90:1 | 8.98:1 | 4.50:1 |
| muted / stripe | 4.97:1 | 4.68:1 | 4.50:1 |
| ink / accent-wash | 10.26:1 | 9.24:1 | 4.50:1 |
| action / accent-wash | 10.26:1 | 7.40:1 | 4.50:1 |
| muted / accent-wash | 5.73:1 | 4.82:1 | 4.50:1 |
| on-accent / accent | 7.00:1 | 8.70:1 | 4.50:1 |
| on-accent / accent-press | 8.61:1 | 10.70:1 | 4.50:1 |
| on-panel / ink-panel | 11.91:1 | 14.80:1 | 4.50:1 |
| panel-muted / ink-panel | 7.36:1 | 6.97:1 | 4.50:1 |
| edge / canvas | 4.38:1 | 4.80:1 | 3.00:1 |
| edge / paper | 4.85:1 | 4.10:1 | 3.00:1 |
| edge / surface | 4.03:1 | 3.22:1 | 3.00:1 |
| edge / stripe | 3.62:1 | 3.22:1 | 3.00:1 |
| edge / accent-wash | 4.18:1 | 3.32:1 | 3.00:1 |
| focus / canvas | 10.76:1 | 10.70:1 | 3.00:1 |
| focus / paper | 11.91:1 | 9.14:1 | 3.00:1 |
| focus / surface | 9.91:1 | 7.19:1 | 3.00:1 |
| focus / stripe | 8.90:1 | 7.19:1 | 3.00:1 |
| focus / accent-wash | 10.26:1 | 7.40:1 | 3.00:1 |
| on-panel / ink-panel | 11.91:1 | 14.80:1 | 3.00:1 |

## Launch checklist

- [x] Verify the production build and the offline counter on Chromium.
- [x] Exercise stock, bill edits, QR invalidation, voice draft review and khata repayment.
- [x] Check light and dark layouts, keyboard operation, reduced motion, axe and mobile Lighthouse.
- [ ] Deploy the approved build through Pages and check HTTPS, social sharing and host-level error handling.
- [ ] Try microphone permission, pronunciation and interruptions on a real phone and run Sarvam with a scoped key.
- [ ] Verify the shop’s real UPI details and scan a test QR on a payment device.

Khata and receipts are tied to the browser profile. Clearing site data removes them. Customers with the same normalized name share one account. Counter stock depletes within an open counter. A fresh tab starts from the shop catalogue. UPI settlement and microphone quality require device checks. Paid Sarvam usage and key protection remain launch concerns for a shop pilot.

## Ten follow-up ideas

1. Customer identifiers to distinguish shoppers with the same name.
2. Khata statement export and backup.
3. Inventory persistence with manual receiving and adjustments.
4. Register synchronization across shop devices.
5. Receipt print layout and shareable text.
6. Date ranges and ledger reconciliation.
7. UPI settlement confirmation with a supported payment provider.
8. A server-side voice proxy with usage limits.
9. Full interface localization and field testing in seven languages.
10. Browser-profile retention, export and deletion controls.
