// ═══════════════════════════════════════════════════════════════════════
// services/supabase.js — Supabase client + circuit breaker + dbFire helper
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { createClient } = require('@supabase/supabase-js');

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const sb = (SB_URL && SB_KEY)
  ? createClient(SB_URL, SB_KEY, {
      auth: {
        autoRefreshToken:  false,
        persistSession:    false,
        detectSessionInUrl:false,
      },
      // Force service role header on every request — bypasses all RLS
      global: {
        headers: { Authorization: `Bearer ${SB_KEY}` },
      },
    })
  : null;

if (!sb) console.warn('[Supabase] ⚠️  Client not initialized — check SUPABASE_URL + SUPABASE_SERVICE_KEY');

// ── Circuit Breaker ──────────────────────────────────────────────────
const CB = { failures:0, openUntil:0, threshold:5, resetMs:60_000 };
const sbOk   = () => Date.now() >= CB.openUntil;
const sbFail = () => { CB.failures++; if (CB.failures>=CB.threshold){ CB.openUntil=Date.now()+CB.resetMs; console.error('⚡ Supabase circuit breaker OPEN'); } };
const sbSucc = () => { CB.failures=0; CB.openUntil=0; };

// ── Main query wrapper ───────────────────────────────────────────────
async function sbQuery(fn) {
  if (!sb)     throw new Error('Supabase not configured.');
  if (!sbOk()) throw new Error('Database temporarily unavailable.');
  try   { const r=await fn(sb); sbSucc(); return r; }
  catch (e) { sbFail(); throw e; }
}

// ── Fire-and-forget (silently logged) ────────────────────────────────
function dbFire(fn) {
  if (!sb||!sbOk()) return;
  Promise.resolve().then(()=>fn(sb)).catch(e=>console.warn('[dbFire]',e?.message));
}

module.exports = { sb, sbOk, sbQuery, dbFire };
