// ═══════════════════════════════════════════════════════════════════════
// services/aiService.js — AEGIS v14 GLOBAL EDITION
// Dynamic per-guild system prompts. Game/topic agnostic.
// Any guild can configure their game, community, and AEGIS adapts fully.
// Anthropic Haiku 4.5 PRIMARY · Groq Llama FALLBACK
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

// ── Per-guild knowledge cache (90s TTL) ──────────────────────────────
const kCache = new Map(); // guildId → { data, ts }
const CACHE_TTL = 90_000;

async function getKnowledge(guildId) {
  if (!sb || !sbOk()) return '';
  const now    = Date.now();
  const cached = kCache.get(guildId || '__global__');
  if (cached && now - cached.ts < CACHE_TTL) return cached.data;

  try {
    // Pull global entries (null guild_id) + this guild's entries
    let query = sb.from('aegis_knowledge')
      .select('category,title,content,guild_id')
      .neq('category', 'auto_learned')
      .order('category')
      .limit(120);

    if (guildId) {
      query = query.or(`guild_id.is.null,guild_id.eq.${guildId}`);
    } else {
      query = query.is('guild_id', null);
    }

    const { data } = await query;
    const result = data?.length
      ? '\n\nKNOWLEDGE BASE:\n' + data.map(r =>
          `[${r.category.toUpperCase()}] ${r.title}: ${r.content}`
        ).join('\n')
      : '';

    kCache.set(guildId || '__global__', { data: result, ts: now });
    return result;
  } catch { return ''; }
}

// Bust cache when knowledge is added/removed
function bustKnowledgeCache(guildId) {
  kCache.delete(guildId || '__global__');
}

// ── Build dynamic system prompt per guild ────────────────────────────
// This is the core of AEGIS being game/topic agnostic.
// Every prompt is built from guild_configs — no hardcoded game.
async function buildSystemPrompt(guildCfg = {}, guildId = null) {
  const gameName    = guildCfg.game_name        || 'your community game';
  const gameTopic   = guildCfg.game_topic        || gameName;
  const displayName = guildCfg.display_name      || 'this server';
  const desc        = guildCfg.community_description || '';
  const rules       = guildCfg.community_rules   || '';
  const rates       = guildCfg.server_rates       || '';
  const currency    = guildCfg.currency_name      || 'credits';
  const currEmoji   = guildCfg.currency_emoji     || '💎';
  const payHandle   = guildCfg.payment_handle     || '';
  const theme       = guildCfg.server_theme       || 'sovereign';
  const aiPersona   = guildCfg.ai_persona         || 'sovereign';
  const features    = guildCfg.custom_features    || '';
  const council     = guildCfg.staff_roster       || '';

  // ── Persona tone ─────────────────────────────────────────────────
  const PERSONAS = {
    sovereign: 'Speak with precision, authority, and cosmic gravitas. You are the intelligence that holds this community together. Minimal filler words. Maximum impact.',
    cyber:     'Cyberpunk, technical, matrix-aesthetic. Short punchy sentences. Reference system logs. Digital precision.',
    friendly:  'Warm, welcoming, approachable like a knowledgeable guild mate. Encouraging and community-first.',
    lore:      'Mystical, world-builder, keeper of ancient knowledge. Rich descriptive language. Every answer is a story.',
    tactical:  'Military precision. Mission-briefing style. Bullet points. Operational efficiency above all.',
    default:   'Helpful, knowledgeable, and direct. Community-focused.',
  };
  const tone = PERSONAS[aiPersona] || PERSONAS.default;

  // ── Base identity block ──────────────────────────────────────────
  let prompt = `You are AEGIS — the AI intelligence of **${displayName}**.

PRIMARY FOCUS: ${gameTopic}
${desc ? `COMMUNITY: ${desc}` : ''}
${rules ? `RULES:\n${rules}` : ''}
${rates ? `SERVER SETTINGS / RATES:\n${rates}` : ''}
${features ? `FEATURES & SYSTEMS:\n${features}` : ''}
${council ? `STAFF / COUNCIL:\n${council}` : ''}

ECONOMY: ${currEmoji} ${currency} is the in-game currency. $1 USD = 1 ${currency}.
${payHandle ? `PAYMENT: CashApp & Chime: $${payHandle}` : ''}

VOICE & TONE: ${tone}

RULES FOR RESPONSES:
- You are deeply knowledgeable about ${gameTopic}. Answer game mechanics, strategies, guides, lore, and tips with confidence.
- For questions outside your knowledge base, use the community context above to give your best answer.
- Always check the KNOWLEDGE BASE section below before saying you don't know something.
- Use Discord markdown formatting where helpful.
- Keep responses under 1800 characters unless the user explicitly asks for detail.
- If the guild hasn't configured their game yet, encourage them to run /setup-aegis.`;

  // ── Append guild knowledge ───────────────────────────────────────
  const knowledge = await getKnowledge(guildId);
  return prompt + knowledge;
}

// ── Persona overrides (per channel) ──────────────────────────────────
const personaOverrides = new Map();
const setPersona   = (channelId, data) => personaOverrides.set(channelId, data);
const clearPersona = (channelId) => personaOverrides.delete(channelId);

// ── Conversation memory ───────────────────────────────────────────────
const convMem  = new Map();
const getHist  = (uid) => convMem.get(uid) || [];
const addHist  = (uid, role, content) => {
  const h = convMem.get(uid) || [];
  h.push({ role, content: content.slice(0, 600) });
  if (h.length > 24) h.splice(0, h.length - 24);
  convMem.set(uid, h);
};
const clearHist = (uid) => convMem.delete(uid);
setInterval(() => { for (const [k,v] of convMem) if (!v?.length) convMem.delete(k); }, 30*60_000);

// ── AI usage logging ──────────────────────────────────────────────────
function logUsage(model, usage, engine = 'anthropic', guildId = null) {
  dbFire(sb => sb.from('aegis_ai_usage').insert({
    guild_id:      guildId || null,
    model, engine,
    input_tokens:  engine === 'anthropic' ? (usage?.input_tokens  || 0) : (usage?.prompt_tokens     || 0),
    output_tokens: engine === 'anthropic' ? (usage?.output_tokens || 0) : (usage?.completion_tokens || 0),
    created_at: new Date().toISOString(),
  }));
}

// ── Main ask — fully guild-aware ─────────────────────────────────────
async function ask(msg, uid = null, extraCtx = '', channelId = null, guildId = null, guildCfg = null) {
  if (!anthropic && !groq) return '⚠️ AI not configured. Add ANTHROPIC_API_KEY in your environment.';

  // Load guild config if not already passed
  if (!guildCfg && guildId) {
    try {
      const gm = require('../managers/guildManager');
      guildCfg = await gm.getConfig(guildId);
    } catch {}
  }

  const systemBase = await buildSystemPrompt(guildCfg || {}, guildId);
  const persona    = channelId ? (personaOverrides.get(channelId) || null) : null;
  const personaCtx = persona ? `\n\nCHANNEL PERSONA OVERRIDE:\nStyle: ${persona.style}\nNote: ${persona.note}` : '';
  const system     = systemBase + personaCtx + (extraCtx ? '\n\n' + extraCtx : '');
  const history    = uid ? getHist(uid) : [];

  // ── Anthropic primary ─────────────────────────────────────────────
  if (anthropic) {
    try {
      const res = await anthropic.messages.create({
        model: ANT_MODEL, max_tokens: 1024, system,
        messages: [...history.map(h => ({ role: h.role, content: h.content })), { role: 'user', content: msg }],
      });
      const text = res.content?.[0]?.text?.trim();
      if (!text) return '⚠️ Empty response from AI.';
      if (uid) { addHist(uid, 'user', msg); addHist(uid, 'assistant', text); }
      logUsage(ANT_MODEL, res.usage, 'anthropic', guildId);
      return text;
    } catch (e) {
      const s = e.status || e.error?.status;
      if (s === 429 || s === 529 || s === 503) console.warn(`[AI] Anthropic ${s} — falling back to Groq`);
      else console.error('[AI][Anthropic]', e.message);
    }
  }

  // ── Groq fallback ─────────────────────────────────────────────────
  if (groq) {
    const isComplex = /explain|analyz|compar|strateg|guide|lore|boss|how|what|why|help|build|craft|tame|fight|best|worst|where|when/i.test(msg);
    const model = isComplex ? GROQ_SMART : GROQ_FAST;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await groq.chat.completions.create({
          model, max_tokens: model.includes('8b') ? 600 : 1000, temperature: 0.78,
          messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: msg }],
        });
        const text = res.choices?.[0]?.message?.content?.trim();
        if (!text) return '⚠️ Empty response from AI.';
        if (uid) { addHist(uid, 'user', msg); addHist(uid, 'assistant', text); }
        logUsage(model, res.usage, 'groq', guildId);
        return text;
      } catch (e) {
        if ((e.message || '').includes('rate_limit') || e.status === 429) {
          if (attempt < 2) { await new Promise(r => setTimeout(r, 3000 * (attempt + 1))); continue; }
          return '⚠️ AEGIS is overloaded right now. Try again in 30 seconds.';
        }
        console.error('[AI][Groq]', e.message);
        return '⚠️ AEGIS error: ' + (e.message || '').slice(0, 100);
      }
    }
  }
  return '⚠️ All AI backends unavailable. Try again shortly.';
}

// ── Quick summarize (no memory, no guild context) ─────────────────────
async function summarize(prompt) {
  if (anthropic) {
    try {
      const r = await anthropic.messages.create({ model: ANT_MODEL, max_tokens: 400, messages: [{ role: 'user', content: prompt }] });
      return r.content?.[0]?.text?.trim() || null;
    } catch {}
  }
  if (groq) {
    try {
      const r = await groq.chat.completions.create({ model: GROQ_FAST, max_tokens: 300, temperature: 0.5, messages: [{ role: 'user', content: prompt }] });
      return r.choices?.[0]?.message?.content?.trim() || null;
    } catch {}
  }
  return null;
}

module.exports = {
  ask, summarize, clearHist,
  setPersona, clearPersona,
  buildSystemPrompt, getKnowledge, bustKnowledgeCache,
  personaOverrides,
};
