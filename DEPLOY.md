# Deploy Guide — Assam Job Setu (100% Free Tier)

**Status:** ✅ Code is on GitHub → <https://github.com/Dip0607/assam-job-setu>
**Next:** connect Cloudflare Pages (one-time, ~3 minutes) → auto-deploys forever after.

---

## What the free tier gives you

| Service | Free allowance | Enough for you? |
|---|---|---|
| **Cloudflare Pages** (hosting) | Unlimited bandwidth, unlimited sites, 500 builds/month, free SSL, global CDN | ✅ Massively |
| **Supabase** (accounts, optional) | 50,000 monthly active users, 500 MB DB | ✅ Massively |
| **Telegram Bot API** (alerts, later) | Unlimited messages | ✅ Free forever |
| ❌ SMS / phone OTP | — | **$75/mo — skip it** |

**Total monthly cost: ₹0.**

---

## STEP 1 — Connect Cloudflare Pages (browser, one time)

> Window: **your web browser**, not PowerShell.

1. Go to <https://dash.cloudflare.com> and sign in (same account as `dipankarnath.pages.dev`).
2. Left sidebar → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**.
3. Click **Connect GitHub** → authorize Cloudflare → choose **`Dip0607/assam-job-setu`** → **Begin setup**.
4. Fill the build settings **exactly** like this — this is where people get it wrong:

   | Field | Value |
   |---|---|
   | Project name | `assam-job-setu` |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | **leave completely empty** |
   | Build output directory | `/` (just a forward slash) |

   > ⚠️ It's a plain static site — there is **no build step**. If you put anything in
   > "Build command", the deploy will fail. Leave it blank.

5. Click **Save and Deploy**. Wait ~60 seconds.

**Your site is live at:** `https://assam-job-setu.pages.dev`

---

## STEP 2 — Verify it works

Open your live URL and check:
- [ ] Job cards load (if the list is empty, `data/jobs.json` didn't deploy — check output dir is `/`)
- [ ] Set a profile (age/education/category) → "Only eligible" filters the list
- [ ] Reload the page → your profile is still there
- [ ] Click **অসমীয়া** → UI switches to Assamese, text renders properly (no boxes)
- [ ] Open it on your phone → layout is responsive

---

## STEP 3 — Auto-deploy from now on

You never touch the Cloudflare dashboard again. To update the live site:

```bash
cd ~/Projects/assam-job-setu
git add -A
git commit -m "Add 5 new APSC jobs"
git push
```

Cloudflare rebuilds and redeploys automatically in under a minute.
**Adding new jobs = editing `data/jobs.json` and pushing.** That's your whole publishing workflow.

---

## STEP 4 (optional) — Turn on free accounts

Only needed when you want profiles to sync across devices and to send alerts.
Full instructions in **`SETUP-AUTH.md`**. Summary:

1. Create a free project at <https://supabase.com> (region: Singapore or Mumbai).
2. **Project Settings → API** → copy **Project URL** + **anon public** key.
3. Paste both into the top of `auth.js`, then `git push`.
4. Run the SQL from `SETUP-AUTH.md` (creates the `profiles` table **with Row Level Security**).
5. **Authentication → Providers**: enable **Email** (magic link) and optionally **Google**.
   Leave **Phone** OFF — that's the $75/mo one.
6. **Authentication → URL Configuration** → add `https://assam-job-setu.pages.dev` to
   *Site URL* and *Redirect URLs*, or login will bounce back with an error.

> The `anon` key is designed to be public in frontend code — safe to commit.
> The `service_role` key is NOT — never put it in this repo.

---

## STEP 5 (optional) — Custom domain

If you buy e.g. `assamjobsetu.in`:
Cloudflare Pages project → **Custom domains** → **Set up a domain** → follow the DNS steps.
Free SSL is automatic. (A `.in` domain costs roughly ₹500–900/year — the only thing that ever costs money here.)

---

## ⚠️ Before you promote this publicly

You're publishing job eligibility info that people act on, and (once accounts are on) storing
caste/disability data. Do these first:

1. **Privacy policy page** — required under India's DPDP Act once you collect user data.
2. **"Delete my data" button** — also required.
3. **Keep the disclaimer visible** — it's already in the footer: always verify on the official PDF.
4. **Keep `last_verified` honest** — a stale aggregator is worse than none. Trust is the product.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank page / "Could not load jobs.json" | Build output directory must be `/`, build command must be empty |
| Deploy failed instantly | You put something in "Build command" — clear it and retry |
| Assamese shows as boxes | Google Fonts blocked; hard-refresh (Ctrl+Shift+R) |
| Login redirect error | Add your `pages.dev` URL to Supabase → Auth → URL Configuration |
| Changes not showing | Hard refresh (Ctrl+Shift+R); check the deploy finished in the CF dashboard |
