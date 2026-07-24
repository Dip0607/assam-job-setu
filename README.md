# Assam Job Setu — MVP

**One-liner:** *Tell us your profile once → see only the government jobs you actually qualify for.*
Assam teaching + APSC + PSU + central govt jobs, with a real eligibility engine and Assamese/English toggle.

This is the **MVP** built around the proven moat: the **"Am I Eligible?" engine**. Zero backend — pure
static site, deploys free to Cloudflare Pages (`pages.dev`) like your portfolio.

## Run locally
```bash
cd assam-job-setu
python -m http.server 8777
# open http://localhost:8777
```
(Must be served over HTTP, not file://, because it fetches data/jobs.json.)

## What works (verified in-browser)
- **Eligibility engine** — enter age + education + category + domicile → filters to only jobs you qualify
  for. Correctly applies **category-wise age relaxation** (e.g. ST(P) +5 yrs) and education-level gating.
  Verified: age-30 ST(P) graduate correctly excludes the NF Railway apprentice (max age 24+5=29).
- **Stackable filters** — job type, sector, education level, deadline, status + free-text search.
- **Bilingual** — full অসমীয়া / English toggle (UI + job titles + departments), Noto Sans Bengali font.
- **Job cards** — vacancies, age, pay, domicile, deadline, "closing in Nd" urgency, status badges.
- **Save/bookmark** (localStorage), deep-link to official apply portal, official PDF link.
- **Trust** — "last refreshed" timestamp, per-card source + verified date, aggregator disclaimer.

## Files
```
index.html        # the whole app (UI + eligibility engine)
data/jobs.json    # structured job data (5 real seeded listings)
```

## Data pipeline (how jobs.json gets filled)
Proven in Phase 0: feed a real notification (from aggregators like assamcareer.com, which are already
semi-structured) to an LLM → it extracts into this schema → **human checks → append to jobs.json**.
Always keep `source_url` + `official_pdf` + `last_verified`. Category-wise vacancy is often deferred by
the govt itself — that's an honest gap, not a bug.

## Next steps (roadmap)
1. **WhatsApp/Telegram bot** — the real growth engine. Push matching jobs to a user's DM (bypasses the
   SEO moat the incumbents own). The eligibility engine here is the brain; the bot is the mouth.
2. Admin ingest page (paste URL → LLM pre-fills → approve → publish).
3. Expand sources: more APSC + all Assam education dept + top PSUs.
4. Email digest + saved-search alerts.
5. Deploy to Cloudflare Pages.

## Deploy (when ready)
```bash
npx wrangler pages deploy . --project-name assam-job-setu
# or drag the folder into Cloudflare Pages dashboard
```
