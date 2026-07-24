/* ============================================================
   Assam Job Setu — Auth Gate
   Full login wall: nothing is visible until the user signs in.

   SECURITY NOTE (important, read before trusting this):
   This gate hides the UI on the client. Because the app is a
   static site, data/jobs.json is still fetchable by anyone who
   knows the URL. That is fine here (job listings are public
   information anyway), but it means this wall is an ACCESS
   CONTROL FOR CONVENIENCE / SIGNUP CAPTURE, not a security
   boundary. Real secrets must never be put in the static bundle.
   User PROFILE data is genuinely protected — by Supabase RLS.
   ============================================================ */

const GATE = {
  show(){ document.documentElement.classList.remove('authed'); },
  hide(){ document.documentElement.classList.add('authed'); }
};

function gateEmailLogin(){
  const email = (document.getElementById('gate_email').value||'').trim();
  const msg = document.getElementById('gate_msg');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    msg.className='gmsg err'; msg.textContent='Please enter a valid email address.'; return;
  }
  if(!CLOUD()){
    msg.className='gmsg err'; msg.textContent='Login is not configured yet (see SETUP-AUTH.md).'; return;
  }
  const btn=document.getElementById('gate_btn');
  btn.disabled=true; btn.textContent='Sending…';
  msg.className='gmsg'; msg.textContent='';
  sb.auth.signInWithOtp({ email, options:{ emailRedirectTo: window.location.origin } })
   .then(({error})=>{
     if(error){ msg.className='gmsg err'; msg.textContent=error.message; }
     else{ msg.className='gmsg ok';
           msg.innerHTML='✉️ <b>Check your email.</b> We sent a sign-in link to '
             + email.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
             + '. Click it to continue — no password needed.'; }
   })
   .catch(e=>{ msg.className='gmsg err'; msg.textContent=String(e && e.message || e); })
   .finally(()=>{ btn.disabled=false; btn.textContent='✉️ Email me a sign-in link'; });
}

function gateGoogle(){
  if(!CLOUD()) return;
  sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});
}

/* Decide gate visibility whenever auth state changes */
function applyGate(){
  if(USER) GATE.hide(); else GATE.show();
}
