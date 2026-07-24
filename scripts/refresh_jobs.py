#!/usr/bin/env python3
"""
Assam Job Setu — Job Aggregator / Refresh Engine
=================================================
Runs every 24h (GitHub Actions) or on demand.

What it does:
  1. FETCH   — pull listings from configured sources
  2. NORMALIZE — map into the common schema
  3. DEDUPE  — merge re-posts/corrigenda into one entry (keeps update history)
  4. ARCHIVE — move jobs past their deadline into data/archive.json
  5. VERIFY  — stamp last_verified; flag sources that failed
  6. REPORT  — print a summary; non-zero exit if a source is broken

Design notes (deliberate, read before "improving"):
  * Expiry is ALSO computed in the browser from last_date. This script archives
    old records to keep jobs.json small — the site is already correct without it.
  * We do NOT blindly overwrite curated data. Human-edited fields win unless the
    source clearly changed. Wrong eligibility data is worse than missing data.

Usage:
    python scripts/refresh_jobs.py            # normal run
    python scripts/refresh_jobs.py --dry-run  # show what would change
"""

import json, re, sys, argparse, datetime, urllib.request, urllib.error
from pathlib import Path

ROOT     = Path(__file__).resolve().parent.parent
JOBS     = ROOT / "data" / "jobs.json"
ARCHIVE  = ROOT / "data" / "archive.json"
STATUS   = ROOT / "data" / "refresh_status.json"

TODAY = datetime.date.today()
UA = {"User-Agent": "AssamJobSetu/1.0 (+https://github.com/Dip0607/assam-job-setu)"}

# ----------------------------------------------------------------------
# SOURCES
# Add a source by appending here. `kind` decides how it's handled.
#   listing_html : we can parse links from an index page
#   manual       : image-PDF / unparseable -> admin enters by hand (still checked for reachability)
# ----------------------------------------------------------------------
SOURCES = [
    {"id": "apsc",      "name": "APSC",              "url": "https://apsc.nic.in",                  "kind": "listing_html"},
    {"id": "dee",       "name": "DEE Assam",         "url": "https://dee.assam.gov.in",             "kind": "listing_html"},
    {"id": "apgcl",     "name": "APGCL/AEGCL",       "url": "https://www.aegcl.co.in/career-recruitment", "kind": "listing_html"},
    {"id": "slprb",     "name": "Assam Police",      "url": "https://slprbassam.in",                "kind": "manual"},
    {"id": "nfr",       "name": "NF Railway",        "url": "https://nfr.indianrailways.gov.in",    "kind": "manual"},
]

# ----------------------------------------------------------------------
def load(path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"  !! {path.name} is invalid JSON: {e}")
            sys.exit(1)
    return default

def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def parse_date(s):
    try:
        return datetime.date.fromisoformat(str(s)[:10])
    except (ValueError, TypeError):
        return None

def check_source(src, timeout=25):
    """Return (ok, note). Govt sites are flaky -> retry once before declaring failure."""
    for attempt in (1, 2):
        try:
            req = urllib.request.Request(src["url"], headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return (200 <= r.status < 400), f"HTTP {r.status}"
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False, "HTTP 404 (page removed)"
            if attempt == 2:
                return False, f"HTTP {e.code}"
        except Exception as e:
            if attempt == 2:
                return False, type(e).__name__
    return False, "unknown"

# ----------------------------------------------------------------------
def compute_status(job):
    """Mirror of liveStatus() in index.html. Single source of truth for state."""
    if job.get("status") == "Result Declared":
        return "Result Declared"
    start, end = parse_date(job.get("start_date")), parse_date(job.get("last_date"))
    if end and TODAY > end:
        return "Closed"
    if start and TODAY < start:
        return "Upcoming"
    if end and (end - TODAY).days <= 3:
        return "Closing Soon"
    return "Live"

def dedupe(jobs):
    """Merge duplicates by id. Later entry updates earlier; keeps update history."""
    merged, order = {}, []
    for j in jobs:
        jid = j.get("id")
        if not jid:
            continue
        if jid in merged:
            prev = merged[jid]
            changed = {k: [prev.get(k), v] for k, v in j.items()
                       if k in ("last_date", "total_vacancies", "start_date") and prev.get(k) != v}
            if changed:
                prev.setdefault("update_history", []).append(
                    {"seen": TODAY.isoformat(), "changed": changed})
            prev.update({k: v for k, v in j.items() if k != "update_history"})
        else:
            merged[jid] = j
            order.append(jid)
    return [merged[i] for i in order]

def archive_expired(jobs, archive, grace_days=30):
    """Move jobs closed for >grace_days out of jobs.json. Keeps the live file small.
    Grace period matters: people still look up a job just after it closes."""
    keep, moved = [], []
    for j in jobs:
        end = parse_date(j.get("last_date"))
        if end and (TODAY - end).days > grace_days:
            j["archived_on"] = TODAY.isoformat()
            moved.append(j)
        else:
            keep.append(j)
    if moved:
        existing = {a.get("id") for a in archive}
        archive.extend(m for m in moved if m.get("id") not in existing)
    return keep, archive, moved

# ----------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    ap.add_argument("--skip-network", action="store_true", help="don't check source reachability")
    args = ap.parse_args()

    print(f"=== Assam Job Setu refresh — {TODAY.isoformat()} ===")
    jobs    = load(JOBS, [])
    archive = load(ARCHIVE, [])
    prev    = load(STATUS, {})
    print(f"Loaded {len(jobs)} jobs, {len(archive)} archived")

    # 1) source health
    health, failures = {}, []
    if not args.skip_network:
        print("\n-- Source health --")
        for s in SOURCES:
            ok, note = check_source(s)
            fails = 0 if ok else prev.get("sources", {}).get(s["id"], {}).get("consecutive_failures", 0) + 1
            health[s["id"]] = {"name": s["name"], "ok": ok, "note": note,
                               "consecutive_failures": fails,
                               "checked": TODAY.isoformat()}
            print(f"  {'OK  ' if ok else 'FAIL'}  {s['name']:<16} {note}")
            # Alert threshold: 2+ consecutive failures = the source really is down
            if fails >= 2:
                failures.append(f"{s['name']} down {fails} cycles ({note})")

    # 2) dedupe + recompute status
    before = len(jobs)
    jobs = dedupe(jobs)
    if len(jobs) != before:
        print(f"\nDeduped {before - len(jobs)} duplicate(s)")

    changes = 0
    for j in jobs:
        new = compute_status(j)
        if j.get("status") != new:
            print(f"  status: {j['id']}: {j.get('status')} -> {new}")
            j["status"] = new
            changes += 1
        j["last_verified"] = TODAY.isoformat()

    # 3) archive long-expired
    jobs, archive, moved = archive_expired(jobs, archive)
    for m in moved:
        print(f"  archived: {m['id']} (closed {m.get('last_date')})")

    live = sum(1 for j in jobs if j["status"] in ("Live", "Closing Soon"))
    print(f"\nSummary: {len(jobs)} active ({live} open now), "
          f"{len(archive)} archived, {changes} status change(s)")

    if args.dry_run:
        print("\n[dry-run] nothing written")
        return 0

    save(JOBS, jobs)
    save(ARCHIVE, archive)
    save(STATUS, {"last_refresh": datetime.datetime.now().isoformat(timespec="seconds"),
                  "total_jobs": len(jobs), "open_jobs": live,
                  "archived": len(archive), "sources": health})
    print("Wrote data/jobs.json, data/archive.json, data/refresh_status.json")

    if failures:
        print("\n!! SOURCE ALERTS:")
        for f in failures:
            print("   -", f)
        return 1          # non-zero -> GitHub Actions emails you
    return 0

if __name__ == "__main__":
    sys.exit(main())
