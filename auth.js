// ============================================================
//  Assam Job Setu — Auth + Profile Sync
//  FREE auth: email magic-link + Google (Supabase free tier,
//  50,000 monthly active users at ₹0). No SMS = no $75/mo fee.
//
//  Works with ZERO setup: falls back to localStorage-only mode.
//  Paste your Supabase keys below to switch on real accounts.
// ============================================================

// Publishable key = safe to expose in frontend code (that is its purpose).
// NEVER put the `service_role` / secret key here.
const SUPABASE_URL  = "https://mwbjtpqhlomxgtyvanhg.supabase.co";
const SUPABASE_ANON = "sb_publishable_oBA0genK5yLB6n8G8h4bng_S0Aa5DYy";

// ---- state ----
let sb = null, USER = null;
const CLOUD = () => !!(SUPABASE_URL && SUPABASE_ANON && sb);

// ---- init ----
async function initAuth(){
  if (SUPABASE_URL && SUPABASE_ANON && window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data:{ session } } = await sb.auth.getSession();
    USER = session?.user || null;
    sb.auth.onAuthStateChange((_e, s) => { USER = s?.user || null; onAuthChange(); });
  }
  await loadProfile();
  renderAuthUI();
}

// ---- login methods (both FREE) ----
async function loginEmail(){
  const email = document.getElementById('auth_email').value.trim();
  if(!email) return toast('Enter your email');
  if(!CLOUD()) return toast('Cloud accounts not configured — see README');
  const { error } = await sb.auth.signInWithOtp({
    email, options:{ emailRedirectTo: window.location.href }
  });
  toast(error ? ('Error: '+error.message)
              : '✉️ Magic link sent! Check your email and click it to sign in.');
}

async function loginGoogle(){
  if(!CLOUD()) return toast('Cloud accounts not configured — see README');
  await sb.auth.signInWithOAuth({
    provider:'google', options:{ redirectTo: window.location.href }
  });
}

async function logout(){
  if(CLOUD()) await sb.auth.signOut();
  USER = null; onAuthChange();
}

function onAuthChange(){ renderAuthUI(); loadProfile(); }

// ---- profile: cloud when logged in, localStorage otherwise ----
// Privacy (DPDP): we store birth_year, NOT full DOB. Minimum data only.
async function saveProfile(p){
  localStorage.setItem('profile', JSON.stringify(p));   // always keep local copy
  if(CLOUD() && USER){
    const { error } = await sb.from('profiles').upsert({
      user_id: USER.id, birth_year: p.birth_year, education: p.edu,
      category: p.cat, domicile: p.domi, updated_at: new Date().toISOString()
    });
    if(error) console.warn('cloud save failed, kept local:', error.message);
    else toast('✅ Profile saved to your account');
  }
}

async function loadProfile(){
  let p = null;
  if(CLOUD() && USER){
    const { data } = await sb.from('profiles').select('*').eq('user_id', USER.id).maybeSingle();
    if(data) p = { birth_year:data.birth_year, edu:data.education,
                   category:data.category, domi:data.domicile };
  }
  if(!p) { try{ p = JSON.parse(localStorage.getItem('profile')||'null'); }catch(e){} }
  if(p && typeof applyStoredProfile === 'function') applyStoredProfile(p);
  return p;
}

// ---- saved/bookmarked jobs sync ----
async function syncSaved(ids){
  localStorage.setItem('saved', JSON.stringify(ids));
  if(CLOUD() && USER)
    await sb.from('profiles').upsert({ user_id:USER.id, saved_jobs:ids });
}

// ---- UI ----
async function deleteMyData(){
  if(!confirm('Delete your profile and saved jobs permanently? This cannot be undone.')) return;
  try{ localStorage.removeItem('profile'); localStorage.removeItem('saved'); }catch(e){}
  if(CLOUD() && USER){
    const { error } = await sb.from('profiles').delete().eq('user_id', USER.id);
    if(error){ toast('Could not delete: '+error.message); return; }
    await sb.auth.signOut();
  }
  USER=null; if(typeof clearProfile==='function') clearProfile();
  onAuthChange(); toast('Your data has been deleted.');
}

function renderAuthUI(){
  const box = document.getElementById('authbox'); if(!box) return;
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(USER){
    const who = esc(USER.email || 'Signed in');
    box.innerHTML = `<div class="authed">👤 <b>${who}</b>
      <div class="authnote">Profile & saved jobs sync across your devices.</div>
      <button class="btn sec" id="btn_logout">Sign out</button>
      <button class="btn danger" id="btn_delete">Delete my data</button></div>`;
    document.getElementById('btn_logout').addEventListener('click',logout);
    document.getElementById('btn_delete').addEventListener('click',deleteMyData);
  } else if (!CLOUD()) {
    box.innerHTML = `<div class="authnote">
      💾 Your profile is saved <b>on this device only</b>.<br>
      Add Supabase keys in <code>auth.js</code> to enable free accounts &amp; sync.</div>`;
  } else {
    box.innerHTML = `
      <div class="authnote">Sign in free to sync your profile and get job alerts.</div>
      <input type="email" id="auth_email" placeholder="you@email.com">
      <button class="btn" id="btn_email">✉️ Email me a login link</button>
      <div class="authnote" style="margin-top:6px">No password needed. We only store what the
        eligibility filter needs — never your name or address.
        <a href="privacy.html" style="color:var(--brand)">Privacy</a></div>`;
    document.getElementById('btn_email').addEventListener('click',loginEmail);
  }
}

function toast(msg){
  let t = document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className='show';
  clearTimeout(window._tt); window._tt=setTimeout(()=>t.className='',4200);
}

window.addEventListener('DOMContentLoaded', initAuth);
