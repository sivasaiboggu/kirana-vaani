# Marigold shop bill review

Before is the merged `main` at `33134cb05d6bc2ef2a9e14878b462473ff0fa5ad`. Both revisions were built in production mode and used the same runner at 1440 × 1000 and 390 × 844. The counter shows the sample Tamil bill at ₹275.00. The final receipt and checkout show ₹499.00. The khata capture uses a separate typed bill of ₹96.00 and a ₹25.50 payment to show the ₹70.50 balance.

| View | Merged main | Marigold v2 |
| --- | --- | --- |
| Home | [Before](home-before.webp) | [After](home-after.webp) |
| Counter | [Before](counter-before.webp) | [After](counter-after.webp) |
| Dashboard | [Before](dashboard-before.webp) | [After](dashboard-after.webp) |
| Settings | [Before](settings-before.webp) | [After](settings-after.webp) |
| Receipt | [Before](receipt-before.webp) | [After](receipt-after.webp) |
| UPI checkout | [Before](checkout-before.webp) | [After](checkout-after.webp) |
| Customer khata | New in this PR | [After](khata-after.webp) |

[Dark counter](counter-dark.webp) · [Dark khata](khata-dark.webp) · [Screenshot runner](../../../scripts/shots.mjs)

```sh
npm run build
npm run preview -- --port 4181
CHROME_BIN=/usr/bin/chromium node scripts/shots.mjs http://127.0.0.1:4181/kirana-vaani/ screenshots/after
CHROME_BIN=/usr/bin/chromium node scripts/shots.mjs http://127.0.0.1:4181/kirana-vaani/ screenshots/after-dark dark
```

## Lighthouse mobile

Lighthouse 13.6.0, Chromium 156, default simulated mobile throttling against production previews. Public home SEO scored 100 in both runs. The counter, dashboard and settings carry `noindex` by design and score 60 for SEO. LCP, Total Blocking Time and CLS are lab values. [Recorded scores and metrics](lighthouse-mobile.json)

| Route | Performance before → after | Accessibility after | Best practices after | LCP after | CLS after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 99 → 100 | 100 | 100 | 1.07s | 0.0000 |
| Counter | 96 → 100 | 100 | 100 | 1.36s | 0.0000 |
| Dashboard | 83 → 100 | 100 | 100 | 1.01s | 0.0000 |
| Settings | 100 → 100 | 100 | 100 | 1.32s | 0.0000 |

```sh
CHROME_PATH=/usr/bin/chromium npx --yes lighthouse@13.6.0 \
  http://127.0.0.1:4181/kirana-vaani/counter.html \
  --chrome-flags='--headless=new --no-sandbox --disable-dev-shm-usage' \
  --output=json --output-path=screenshots/lighthouse-counter.json
```

The full suite has 118 passing tests. Browser coverage checks 320, 390, 768, 1280 and 1440px in both modes. Axe reports zero WCAG 2.2 AA violations across all seven routes in light and dark. The dark 320px checkout and populated khata were also checked with the default axe rule set. `npm audit` reported zero advisories. The active marigold reached 3.20% of the captured area. The measurement counted pixels with an HSV hue in 21–35, saturation at least 112 and value at least 213 on a 0–255 scale.
