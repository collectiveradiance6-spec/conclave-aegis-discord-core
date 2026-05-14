// ═══════════════════════════════════════════════════════════════════════
// services/aiService.js
// Anthropic Haiku 4.5 PRIMARY · Groq Llama fallback
// Per-guild persona overrides · conversation memory · knowledge cache
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const Groq      = require('groq-sdk');
const { sb, sbOk, dbFire } = require('./supabase');

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const groq      = process.env.GROQ_API_KEY      ? new Groq({ apiKey: process.env.GROQ_API_KEY })          : null;

const ANT_MODEL  = 'claude-haiku-4-5-20251001';
const GROQ_FAST  = 'llama-3.1-8b-instant';
const GROQ_SMART = 'llama-3.3-70b-versatile';

// ── Knowledge cache (90s TTL) ────────────────────────────────────────
let _kCache = null, _kTs = 0;
async function getKnowledge() {
  const now = Date.now();
  if (_kCache !== null && now - _kTs < 90_000) return _kCache;
  if (!sb || !sbOk()) { _kCache = ''; return ''; }
  try {
    const { data } = await sb.from('aegis_knowledge').select('category,title,content')
      .neq('category','auto_learned').order('category').limit(80);
    _kCache = data?.length ? '\n\nKNOWLEDGE:\n' + data.map(r=>`[${r.category}] ${r.title}: ${r.content}`).join('\n') : '';
    _kTs = now; return _kCache;
  } catch { _kCache = ''; return ''; }
}

// ── Persona overrides (per channel) ─────────────────────────────────
const personaOverrides = new Map();
const setPersona  = (channelId, data) => personaOverrides.set(channelId, data);
const clearPersona = (channelId) => personaOverrides.delete(channelId);

// ── Conversation memory ──────────────────────────────────────────────
const convMem = new Map();
const getHist  = (uid) => convMem.get(uid) || [];
const addHist  = (uid, role, content) => {
  const h = convMem.get(uid) || [];
  h.push({ role, content: content.slice(0, 600) });
  if (h.length > 24) h.splice(0, h.length - 24);
  convMem.set(uid, h);
};
const clearHist = (uid) => convMem.delete(uid);
setInterval(() => { for (const [k,v] of convMem) if (!v?.length) convMem.delete(k); }, 30*60_000);

// ── Core system prompt ───────────────────────────────────────────────
const CORE_PROMPT = `You are AEGIS — the living sovereign intelligence of TheConclave Dominion, a 5× crossplay ARK: Survival Ascended community (Guild: 1438103556610723922).

CLUSTER (10 maps, crossplay Xbox·PS·PC·Switch):
The Island · Volcano · Extinction · The Center · Lost Colony · Astraeos · Valguero · Scorched Earth · Aberration (PvP) · Amissa (Patreon-Elite)

RATES: 5× XP/Harvest/Taming/Breeding · 1M weight · No fall damage · Max wild 350
SHOP: theconclavedominion.com/shop · $1 = 1 ClaveShard · Cash App/Chime: $TheConclaveDominion
COUNCIL: Tw_ (High Curator/Owner) · Slothie (Archmaestro) · Sandy (Wildheart) · Jenny (Skywarden)

VOICE: Precise, sovereign, cosmic — speak with authority and a touch of mythos. Use Discord markdown. Keep responses under 1800 chars unless detail is specifically requested.`;

// ── AI usage logging ─────────────────────────────────────────────────
function logUsage(model, usage, engine='anthropic') {
  dbFire(sb => sb.from('aegis_ai_usage').insert({
    model, engine,
    input_tokens:  engine==='anthropic' ? (usage?.input_tokens||0)  : (usage?.prompt_tokens||0),
    output_tokens: engine==='anthropic' ? (usage?.output_tokens||0) : (usage?.completion_tokens||0),
    created_at: new Date().toISOString(),
  }));
}

// ── Main ask function ────────────────────────────────────────────────
async function ask(msg, uid=null, extraCtx='', channelId=null) {
  if (!anthropic && !groq) return '⚠️ AI not configured.';
  const knowledge  = await getKnowledge();
  const persona    = channelId ? (personaOverrides.get(channelId)||null) : null;
  const personaCtx = persona ? `\n\nCHANNEL PERSONA:\nStyle: ${persona.style}\nNote: ${persona.note}` : '';
  const system     = CORE_PROMPT + knowledge + personaCtx + (extraCtx ? '\n\n'+extraCtx : '');
  const history    = uid ? getHist(uid) : [];

  // Anthropic primary
  if (anthropic) {
    try {
      const res = await anthropic.messages.create({
        model: ANT_MODEL, max_tokens: 1024, system,
        messages: [...history.map(h=>({role:h.role,content:h.content})), {role:'user',content:msg}],
      });
      const text = res.content?.[0]?.text?.trim();
      if (!text) return '⚠️ Empty response from AI.';
      if (uid) { addHist(uid,'user',msg); addHist(uid,'assistant',text); }
      logUsage(ANT_MODEL, res.usage, 'anthropic');
      return text;
    } catch(e) {
      const s = e.status || e.error?.status;
      if (s===429||s===529||s===503) console.warn(`[AI] Anthropic ${s} — falling back to Groq`);
      else console.error('[AI][Anthropic]', e.message);
    }
  }

  // Groq fallback
  if (groq) {
    const isComplex = /explain|analyz|compar|strateg|guide|lore|boss|dino|build/i.test(msg);
    const model = isComplex ? GROQ_SMART : GROQ_FAST;
    for (let attempt=0; attempt<3; attempt++) {
      try {
        const res = await groq.chat.completions.create({
          model, max_tokens: model.includes('8b')?600:1000, temperature:0.78,
          messages: [{role:'system',content:system}, ...history, {role:'user',content:msg}],
        });
        const text = res.choices?.[0]?.message?.content?.trim();
        if (!text) return '⚠️ Empty response from AI.';
        if (uid) { addHist(uid,'user',msg); addHist(uid,'assistant',text); }
        logUsage(model, res.usage, 'groq');
        return text;
      } catch(e) {
        if ((e.message||'').includes('rate_limit')||e.status===429) {
          if (attempt<2) { await new Promise(r=>setTimeout(r,3000*(attempt+1))); continue; }
          return '⚠️ AEGIS is overloaded. Try again in 30 seconds.';
        }
        console.error('[AI][Groq]', e.message);
        return '⚠️ AEGIS error: '+(e.message||'').slice(0,100);
      }
    }
  }
  return '⚠️ All AI backends unavailable.';
}

// ── Quick summarize (no memory) ──────────────────────────────────────
async function summarize(prompt) {
  if (anthropic) {
    try { const r=await anthropic.messages.create({model:ANT_MODEL,max_tokens:400,messages:[{role:'user',content:prompt}]}); return r.content?.[0]?.text?.trim()||null; } catch {}
  }
  if (groq) {
    try { const r=await groq.chat.completions.create({model:GROQ_FAST,max_tokens:300,temperature:0.5,messages:[{role:'user',content:prompt}]}); return r.choices?.[0]?.message?.content?.trim()||null; } catch {}
  }
  return null;
}

module.exports = { ask, summarize, clearHist, setPersona, clearPersona, personaOverrides, CORE_PROMPT };
