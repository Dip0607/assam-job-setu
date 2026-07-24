# Security & Performance Audit — Assam Job Setu

Audited: 25 Jul 2026 · All findings fixed and re-verified in-browser.

---

## 🔒 Security

### Vulnerabilities found & fixed

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **HIGH** | **Stored XSS** — job data injected into `innerHTML` via template literals with no escaping. A poisoned source or a bad admin paste could run arbitrary JS in every visitor's browser. | `esc()` escapes `& < > " ' \` = /` on **every** field before it touches the DOM |
| 2 | **HIGH** | **`javascript:` URI injection** — `apply_link` / `official_pdf` went straight into `href`. A malicious link would execute on click. | `safeUrl()` parses the URL and allows **only** `http:`/`https:`; anything else becomes `#` |
| 3 | **MEDIUM** | **No Content-Security-Policy** — nothing constrained what could execute or load. | CSP meta tag: scripts/styles/fonts/connections locked to known origins |
| 4 | **MEDIUM** | **Clickjacking** — site could be framed by an attacker. | `frame-ancestors 'none'` (CSP) + `X-Frame-Options: DENY` (`_headers`) |
| 5 | **LOW** | Inline `onclick=` handlers everywhere — forces CSP to allow unsafe inline JS. | All replaced with `addEventListener`; **zero** inline handlers remain |
| 6 | **LOW** | `localStorage` unguarded — throws in private mode / when storage is blocked. | Wrapped in `try/catch` |

### Verified at runtime (real browser test)

```
esc('<img src=x onerror=alert(1)>')  ->  &lt;img src&#61;x onerror&#61;alert(1)&gt;   [neutralized]
safeUrl('javascript:alert(1)')       ->  #                                        [blocked]
safeUrl('https://apsc.nic.in')       ->  https://apsc.nic.in/                     [allowed]
```

### Audit scorecard — 11/11 PASS

```
PASS  XSS: escape() helper defined          PASS  No inline on* handlers (CSP-safe)
PASS  XSS: all card data escaped            PASS  Referrer policy
PASS  URL: safeUrl blocks javascript: URIs   PASS  localStorage wrapped in try/catch
PASS  CSP meta present                      PASS  _headers file (server headers)
PASS  CSP: frame-ancestors none             PASS  rel=noopener noreferrer on _blank
PASS  CSP: form-action none
```

### Server headers (`_headers`, applied by Cloudflare Pages)
`X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy` ·
`Permissions-Policy` (geolocation/mic/camera/payment off) · `HSTS` (1 year)

### Also confirmed
- **No secrets in the repo** — scanned for `service_role`, API keys, tokens. Clean.
- The Supabase **`anon` key is safe to commit** (designed for frontends); `service_role` must never be.
- External links carry `rel="noopener noreferrer nofollow"` (prevents tab-nabbing + SEO leakage).

### ⚠️ Still outstanding before public launch
1. **Privacy policy page** — required under India's DPDP Act once accounts store category/caste data.
2. **"Delete my data" button** — also legally required.
3. Enable **Supabase Row Level Security** (SQL is ready in `SETUP-AUTH.md`) *before* going live with auth.

---

## ⚡ Performance

Measured in-browser via the Performance API (local, cold-ish load):

| Metric | Result | Benchmark |
|---|---|---|
| **First Contentful Paint** | **84 ms** | Good < 1,800 ms ✅ |
| DOM Interactive | 115 ms | ✅ |
| Load complete | 133 ms | ✅ |
| **Total payload** | **~34 KB** | Typical job site: 2–5 MB ✅ |
| HTTP requests | 5 | ✅ |
| DOM nodes | 183 | Good < 1,500 ✅ |
| **Full re-render** (filter/search) | **0.87 ms** | Instant ✅ |

**Why it's this fast:** no framework, no build step, single HTML file, client-side filtering.
The entire app is smaller than one typical hero image.

### Optimisations applied
- `preconnect` to the font CDN (removes a DNS+TLS round-trip)
- `display=swap` on fonts — text renders immediately, never invisible
- Cache headers: HTML revalidates; `/data/*` cached 5 min (fresh job data without hammering)
- Sticky sidebar avoids layout thrash on scroll

### Honest caveat
This was measured with **2 jobs**. Client-side filtering is O(n) — it will stay fast to roughly
**1,000–2,000 listings**. Past that, add pagination or server-side search. That's a good problem
to have and is far away.

---

## 🎨 UI redesign

Rebuilt from "functional prototype" to a modern product UI. Independently reviewed: **8/10,
"reads as a competent product UI, not a template."**

**Changes:** teal/emerald gradient header with live KPI strip · Plus Jakarta Sans typography ·
soft-shadow cards with hover lift · eligible jobs get a gradient accent bar · metadata in a tinted
3-column inset grid · pill filter chips with active state · sticky sidebar · full mobile responsive.

**Bugs caught by visual review and fixed:**
- "1 jobs" → **"1 job"** (pluralization)
- "0 sources tracked" → wired up with a fallback count (**2**)
- Raw ISO dates `2026-08-23` → **"23 Aug 2026"**
- ~700 px of dead space → contextual **"Looking for more?"** tip box
- Hint copy said "clear a filter" when no filter was active → now context-aware
- Low-contrast "Clear" button looked disabled → bordered
- Footer text failed WCAG AA contrast → darkened

### Regression test (the thing that must never break)
After the full rewrite, the eligibility engine was re-verified:
```
Profile: age 30, Graduate, ST(P), Assam domicile
  APGCL Assistant Manager   -> ELIGIBLE
  NF Railway Apprentice     -> NOT ELIGIBLE ("Max age 29 (incl. +5)")
```
Correct: max age 24 + ST(P) relaxation 5 = 29, and 30 > 29. **Category-relaxation math intact.**
