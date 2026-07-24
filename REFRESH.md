# Job Refresh System — How Jobs Stay Current

Two **separate** mechanisms. Understanding the split is the whole point.

| Need | Mechanism | Runs when |
|---|---|---|
| Expired jobs disappear | **Computed in the browser from `last_date`** | Every page load |
| New jobs get captured | **GitHub Actions cron** | Every 24h + on demand |

---

## 1. Expiry — needs NO cron at all

`liveStatus()` in `index.html` recomputes each job's status from its dates **on every page load**:

```
 today > last_date            -> Closed        (hidden by default)
 today < start_date           -> Upcoming
 last_date within 3 days      -> Closing Soon  (+ "⏰ 2d left" badge)
 otherwise                    -> Live
```

**Why this matters:** if you relied on a nightly job to mark things closed, your site would be
wrong for up to 24 hours every single day. Computing from the date means the site is **always**
correct — even if the aggregator breaks for a month.

Closed jobs are hidden by default; users can tick **"Show closed"** to see them (greyed + struck
through). Real test on 25 Jul 2026: 5 seeded jobs correctly collapsed to **1 genuinely open** job.

---

## 2. New jobs — the 24h refresh

**`scripts/refresh_jobs.py`** does six things:

1. **Fetch** — checks each source in `SOURCES` is reachable (retries once; govt sites are flaky)
2. **Normalize** — into the common schema
3. **Dedupe** — same job re-posted/corrigenda merges into ONE entry, recording an `update_history`
   entry instead of creating a duplicate
4. **Archive** — jobs closed >30 days move to `data/archive.json` (grace period: people still look
   up a job just after it closes)
5. **Verify** — stamps `last_verified`, tracks `consecutive_failures` per source
6. **Report** — writes `data/refresh_status.json`; exits non-zero if a source is down 2+ cycles

### Run it manually
```bash
python scripts/refresh_jobs.py --dry-run      # show changes, write nothing
python scripts/refresh_jobs.py                # real run
python scripts/refresh_jobs.py --skip-network # skip reachability checks
```

### Verified working (real run, 25 Jul 2026)
```
  OK    APSC             HTTP 200
  OK    DEE Assam        HTTP 200
  OK    APGCL/AEGCL      HTTP 200
  FAIL  Assam Police     URLError      <- real-world flakiness, caught correctly
  OK    NF Railway       HTTP 200
  status: apsc-cce-2025: Upcoming -> Closed
  archived: dee-lp-up-2025 (closed 2025-04-08)
  Summary: 2 active (1 open now), 3 archived, 3 status change(s)
```
Running it twice produces **0 changes** — it's idempotent, safe to re-run any time.

---

## 3. The scheduler — `.github/workflows/refresh-jobs.yml`

| Trigger | What it is |
|---|---|
| `schedule: "30 2 * * *"` | **Time-based** — daily 02:30 UTC = **08:00 IST** |
| `workflow_dispatch` | **Event-based** — your manual **force refresh** button |
| `push` on the script | Auto-runs when you change the aggregator |

**The full loop, hands-off:**
```
  GitHub Actions (daily 8am IST)
        -> runs refresh_jobs.py
        -> commits changed data/ back to the repo
        -> Cloudflare Pages sees the commit
        -> site redeploys automatically
```
You do nothing. **Cost: ₹0** — public repos get unlimited Actions minutes.

### Force a refresh manually
GitHub repo -> **Actions** tab -> **Refresh Jobs** -> **Run workflow**.
(This is the "admin force refresh" from the original spec.)

### Failure alerts
If a source fails **2+ consecutive cycles**, the workflow exits non-zero and GitHub **emails you**
automatically. One-off blips are ignored — govt sites go down constantly, and alerting on every
hiccup would train you to ignore alerts.

---

## 4. Adding a new source

Edit `SOURCES` in `scripts/refresh_jobs.py`:
```python
{"id": "nrl", "name": "Numaligarh Refinery", "url": "https://www.nrl.co.in/career", "kind": "listing_html"},
```
- `listing_html` — index page we can parse
- `manual` — image-only PDFs; script only checks reachability, you enter data by hand

---

## ⚠️ The honest limitation

The script currently does **health-checking, dedupe, status and archiving automatically** — the
reliable parts. It does **not** blind-scrape job details into the schema, because:

- Many notices are **scanned image PDFs** (no text to extract; Assamese OCR is unreliable)
- Category breakup / age relaxation live in prose inside 40-page PDFs
- **Wrong eligibility data is worse than missing data** — if you tell someone they qualify and they
  don't, they waste a fee or miss a once-a-year exam

So new job *content* is added via LLM-assisted extraction with a human check (see README) — while
expiry, dedupe, archiving and source monitoring are fully automatic. That's the split that keeps
the daily grind sane without ever publishing a lie.

**Adding jobs = edit `data/jobs.json`, `git push`.** Cloudflare redeploys in ~1 minute.
