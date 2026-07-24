# Login & Accounts — Setup Guide

**Short version:** the app works right now with **no login and no setup**. Your profile saves to the
browser. When you want accounts that sync across devices (and power job alerts), paste two keys into
`auth.js`. Total cost: **₹0**.

---

## Why not phone/SMS OTP?

I originally suggested phone-OTP (login = WhatsApp alert channel). **I checked the pricing and it's a trap:**

| Item | Cost |
|---|---|
| Supabase SMS OTP feature | **$75/month** just to enable — even with your own Twilio account |
| Twilio SMS to India | per-message charges on top + DLT sender registration |
| **Everything else (email/Google login, database, 50,000 users)** | **$0** |

So SMS is the *only* expensive part. Email magic-link and Google login are free. We use those.

---

## Mode 1 — No setup (what runs today)

Nothing to do. The profile is stored in the browser's `localStorage`.

- ✅ Works instantly, no signup wall — people can use the eligibility filter immediately
- ✅ Survives page reloads and browser restarts (verified)
- ❌ Doesn't sync across devices; lost if the user clears browser data
- ❌ Can't send alerts (you have no way to reach them)

**This is the correct default.** Never force signup before someone feels the magic of the filter.

---

## Mode 2 — Free accounts (Supabase) — when you want alerts & sync

### Step 1 — Create the project (PowerShell / browser)
1. Go to <https://supabase.com> → sign up (free) → **New Project**.
2. Pick a region close to India (e.g. Singapore/Mumbai) and set a DB password.
3. Wait ~2 min for it to provision.

### Step 2 — Get your keys
In the Supabase dashboard: **Project Settings → API**. Copy:
- **Project URL** → looks like `https://abcdefgh.supabase.co`
- **anon public** key → a long string

> The `anon` key is **safe to put in frontend code** — it's designed for that. Never paste the
> `service_role` key into the website.

### Step 3 — Paste them into `auth.js`
```js
const SUPABASE_URL  = "https://abcdefgh.supabase.co";
const SUPABASE_ANON = "eyJhbGciOi...your-anon-key...";
```
That's it — the Account panel switches from "this device only" to real login automatically.

### Step 4 — Create the profiles table
Supabase dashboard → **SQL Editor** → run this:

```sql
create table profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  birth_year  int,
  education   text,
  category    text,
  domicile    text,
  district    text,
  saved_jobs  jsonb default '[]',
  updated_at  timestamptz default now()
);

-- Row Level Security: each user can ONLY ever see/edit their own row.
alter table profiles enable row level security;

create policy "own profile read"   on profiles for select using (auth.uid() = user_id);
create policy "own profile write"  on profiles for insert with check (auth.uid() = user_id);
create policy "own profile update" on profiles for update using (auth.uid() = user_id);
```

**Do not skip the RLS policies.** Without them any user could read everyone else's caste/DOB data.

### Step 5 — Turn on the free login methods
Dashboard → **Authentication → Providers**:
- **Email** → enable (magic link works out of the box, free)
- **Google** → optional, enable and paste a Google OAuth client ID (free)
- **Phone** → leave OFF (this is the $75/mo one)

Then **Authentication → URL Configuration** → add your site URL
(`http://localhost:8777` for local, plus your `pages.dev` URL when deployed).

---

## ⚠️ Privacy / DPDP Act — read this

Your profile fields include **category (SC/ST/OBC/PwD) and age** — that's caste and disability data
about real people. Under India's DPDP Act you're legally responsible for it.

What this app already does right:
- Stores **`birth_year`, not full date of birth** (minimum necessary data)
- RLS means a user can only ever access their own row
- No data collected at all until someone chooses to sign in

What you still must do before launching accounts:
1. **Publish a privacy policy** — what you collect, why, how long, who else sees it (nobody).
2. **Offer account deletion** — a "delete my data" button that removes their row. Not optional.
3. **Never export or log this table casually.** No dumping users into a spreadsheet.
4. Only collect a field if a filter actually uses it. Don't collect name, address, or full DOB.

---

## What accounts unlock next

Once login works, the payoff is the alerts loop:

```
  user signs in (free)  →  profile saved in Supabase
            │
   daily job refresh  →  find users whose profile matches new jobs
            │
   free push: Telegram bot (₹0, unlimited) or email (Resend/SES free tier)
```

Telegram bot alerts cost nothing and reach aspirants where they already are — that's the growth
engine, not SMS.
