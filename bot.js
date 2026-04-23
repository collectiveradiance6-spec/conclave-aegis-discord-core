// ═══════════════════════════════════════════════════════════════════════
<<<<<<< HEAD
// CONCLAVE AEGIS BOT — v11.0 SOVEREIGN EDITION
// TheConclave Dominion · 5× Crossplay ARK: Survival Ascended
// ─────────────────────────────────────────────────────────────────────
// ✅ Groq Free AI · llama-3.3-70b + llama-3.1-8b
// ✅ Full ClaveShard economy — wallet, bank, ledger, auto-deduct orders
// ✅ Shop v2 — shard verification, receipt DM, order audit log
// ✅ Giveaway v2 — shard-entry giveaways
// ✅ Auto-mod — link filter, caps flood, repeat spam
// ✅ Mod log — persistent structured logging to channel
// ✅ Wipe tracker — countdown + announcement
// ✅ Tribe registry — lightweight tribe + member tracking
// ✅ AEGIS Persona mode — per-channel style override
// ✅ Bulk admin ops — bulk grant/deduct, audit trail
// ✅ Server vote — community voting system
// ✅ Enhanced AEGIS AI — smarter routing, context injection, search
=======
// CONCLAVE AEGIS BOT — v10.1 SOVEREIGN EDITION
// TheConclave Dominion · 5× Crossplay ARK: Survival Ascended
// Groq Free AI (llama-3.3-70b) · Zero API cost · Full economy
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
// ═══════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

<<<<<<< HEAD
=======
let musicRuntime = null;
if (process.env.MUSIC_RUNTIME_ENABLED !== 'false') {
  try { musicRuntime = require('./music.js'); console.log('🎵 Music runtime v3 loaded'); }
  catch (e) { console.warn('⚠️  Music runtime not loaded:', e.message); }
}

>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
const http = require('http');
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  EmbedBuilder, PermissionFlagsBits, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType,
} = require('discord.js');
<<<<<<< HEAD
const Groq  = require('groq-sdk');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const P = require('./panels.js');

// ══════════════════════════════════════════════════════════════════════
// ENV + CLIENTS
// ══════════════════════════════════════════════════════════════════════
const {
  DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID,
  ROLE_OWNER_ID, ROLE_ADMIN_ID, ROLE_HELPER_ID,
  GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
=======
const Groq   = require('groq-sdk');
const axios  = require('axios');
const { createClient } = require('@supabase/supabase-js');
const P = require('./panels.js'); // AEGIS Visual Panel System v3.0

// ── ENV ──────────────────────────────────────────────────────────────
const {
  DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID,
  ROLE_OWNER_ID, ROLE_ADMIN_ID, ROLE_HELPER_ID,
  GROQ_API_KEY,
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
  AEGIS_CHANNEL_ID,
} = process.env;

if (!DISCORD_BOT_TOKEN) { console.error('❌ DISCORD_BOT_TOKEN missing'); process.exit(1); }

const BOT_PORT    = parseInt(process.env.BOT_PORT || '3001');
<<<<<<< HEAD
const MODEL_FAST  = 'llama-3.1-8b-instant';
const MODEL_SMART = 'llama-3.3-70b-versatile';
const MUSIC_API   = (process.env.MUSIC_API_URL || 'https://api.theconclavedominion.com').replace(/\/$/, '');

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
const sb   = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
=======

// ── GROQ MODEL ROUTING ─────────────────────────────────────────────
// Both models are FREE on Groq — no cost ever
const MODEL_FAST  = 'llama-3.1-8b-instant';     // ~fastest model alive, replaces Haiku
const MODEL_SMART = 'llama-3.3-70b-versatile';  // frontier quality, replaces Sonnet

const MUSIC_API = (process.env.MUSIC_API_URL || 'https://api.theconclavedominion.com').replace(/\/$/, '');

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const sb = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
<<<<<<< HEAD
    GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
  ],
  rest: { timeout: 15000 },
  allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
});

// ══════════════════════════════════════════════════════════════════════
// PERMISSION HELPERS
// ══════════════════════════════════════════════════════════════════════
=======
    GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ],
  rest: { timeout: 15000 },
  allowedMentions: { parse: ['users','roles'], repliedUser: false },
});

// ── PERMISSION HELPERS ──────────────────────────────────────────────
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
const isOwner = m => m?.roles?.cache?.has(ROLE_OWNER_ID) || m?.permissions?.has(PermissionFlagsBits.Administrator);
const isAdmin = m => isOwner(m) || m?.roles?.cache?.has(ROLE_ADMIN_ID);
const isMod   = m => isAdmin(m) || m?.roles?.cache?.has(ROLE_HELPER_ID) || m?.permissions?.has(PermissionFlagsBits.ModerateMembers);

<<<<<<< HEAD
// ══════════════════════════════════════════════════════════════════════
// RATE LIMITER
// ══════════════════════════════════════════════════════════════════════
const rates = new Map();
function checkRate(uid, ms = 8000) {
  const l = rates.get(uid) || 0, n = Date.now();
  if (n - l < ms) return Math.ceil((ms - (n - l)) / 1000);
  rates.set(uid, n); return 0;
}
setInterval(() => { const cut = Date.now() - 120_000; for (const [k, v] of rates) if (v < cut) rates.delete(k); }, 5 * 60_000);

// ══════════════════════════════════════════════════════════════════════
// SUPABASE CIRCUIT BREAKER
// ══════════════════════════════════════════════════════════════════════
const CB = { failures: 0, openUntil: 0, threshold: 5, resetMs: 60_000 };
const sbOk   = () => Date.now() >= CB.openUntil;
function sbFail() { CB.failures++; if (CB.failures >= CB.threshold) { CB.openUntil = Date.now() + CB.resetMs; console.error('⚡ Supabase CB OPEN'); } }
function sbSucc() { CB.failures = 0; CB.openUntil = 0; }
async function sbQuery(fn) {
  if (!sb) throw new Error('Supabase not configured');
  if (!sbOk()) throw new Error('Database temporarily unavailable');
  try { const r = await fn(sb); sbSucc(); return r; }
  catch (e) { sbFail(); throw e; }
}

// ══════════════════════════════════════════════════════════════════════
// MOD LOG ENGINE
// ══════════════════════════════════════════════════════════════════════
const MOD_LOG_CHANNEL = process.env.MOD_LOG_CHANNEL_ID || null;

async function modLog(guild, action, target, actor, reason, extra = {}) {
  const chId = MOD_LOG_CHANNEL || process.env.MONITOR_ACTIVITY_CHANNEL_ID;
  if (!chId || !guild) return;
  try {
    const ch = guild.channels.cache.get(chId);
    if (!ch) return;
    const COLORS = { warn: 0xFFB800, ban: 0xFF4500, timeout: 0xFF8C00, kick: 0xFF4500, mute: 0xFFB800, note: 0x00D4FF, automod: 0xFF4CD2 };
    const emb = new EmbedBuilder()
      .setColor(COLORS[action] || 0x7B2FFF)
      .setTitle(`🔒 ${action.toUpperCase()} · ${target?.username || target}`)
      .setThumbnail(target?.displayAvatarURL?.({ size: 64 }) || null)
      .addFields(
        { name: '👤 Target', value: target?.id ? `<@${target.id}> \`${target.id}\`` : String(target), inline: true },
        { name: '👮 Actor',  value: actor?.id  ? `<@${actor.id}>`                   : String(actor || 'SYSTEM'), inline: true },
        { name: '📋 Reason', value: reason?.slice(0, 256) || 'No reason', inline: false },
        ...Object.entries(extra).map(([k, v]) => ({ name: k, value: String(v).slice(0, 256), inline: true })),
      )
      .setFooter({ text: 'AEGIS Mod Log · TheConclave Dominion' })
      .setTimestamp();
    await ch.send({ embeds: [emb] });
    if (sb && sbOk()) sb.from('aegis_mod_log').insert({
      guild_id: guild.id, action, target_id: target?.id || String(target), target_tag: target?.username || String(target),
      actor_id: actor?.id || 'SYSTEM', actor_tag: actor?.username || 'SYSTEM', reason, extra: JSON.stringify(extra), created_at: new Date().toISOString(),
    }).catch(() => {});
  } catch {}
}

// ══════════════════════════════════════════════════════════════════════
// AUTO-MOD ENGINE
// ══════════════════════════════════════════════════════════════════════
const AUTOMOD = {
  linkFilter:  process.env.AUTOMOD_LINK_FILTER  !== 'false',
  capsThresh:  parseInt(process.env.AUTOMOD_CAPS_PCT  || '70'),
  capsMinLen:  parseInt(process.env.AUTOMOD_CAPS_LEN  || '20'),
  spamWindow:  parseInt(process.env.AUTOMOD_SPAM_MS   || '5000'),
  spamCount:   parseInt(process.env.AUTOMOD_SPAM_MAX  || '5'),
};
const msgHistory = new Map(); // uid → [timestamps]

async function runAutoMod(msg) {
  if (!msg.guild || msg.author.bot) return;
  const member = msg.member;
  if (isAdmin(member) || isMod(member)) return;

  const content = msg.content;
  const violations = [];

  // 1. LINK FILTER — block invite / non-whitelisted links for non-mods
  if (AUTOMOD.linkFilter && /discord\.gg\/|discord\.com\/invite\//i.test(content)) {
    violations.push('Discord invite link');
  }

  // 2. CAPS FLOOD
  if (content.length >= AUTOMOD.capsMinLen) {
    const upper = (content.match(/[A-Z]/g) || []).length;
    const alpha = (content.match(/[a-zA-Z]/g) || []).length;
    if (alpha > 0 && (upper / alpha) * 100 >= AUTOMOD.capsThresh) violations.push('Caps flood');
  }

  // 3. SPAM (repeated messages in short window)
  const now = Date.now();
  const hist = (msgHistory.get(msg.author.id) || []).filter(t => now - t < AUTOMOD.spamWindow);
  hist.push(now);
  msgHistory.set(msg.author.id, hist);
  if (hist.length >= AUTOMOD.spamCount) violations.push('Message spam');

  if (!violations.length) return;

  try {
    await msg.delete();
    const warning = await msg.channel.send(`⚠️ <@${msg.author.id}> — AutoMod: **${violations.join(', ')}**. This is a warning.`);
    setTimeout(() => warning.delete().catch(() => {}), 8000);
    await addWarn(msg.guildId, msg.author.id, msg.author.username, `AutoMod: ${violations.join(', ')}`, 'SYSTEM', 'AEGIS AutoMod');
    await modLog(msg.guild, 'automod', msg.author, { id: 'SYSTEM', username: 'AEGIS AutoMod' }, violations.join(', '), { Channel: `<#${msg.channelId}>` });
  } catch {}
}
setInterval(() => { const cut = Date.now() - 60_000; for (const [k, v] of msgHistory) if (!v.some(t => t > cut)) msgHistory.delete(k); }, 2 * 60_000);

// ══════════════════════════════════════════════════════════════════════
// AI — GROQ ENGINE v2 (smarter routing + context injection)
// ══════════════════════════════════════════════════════════════════════
function pickModel(q) {
  const complex = /explain|analyz|compar|strateg|build|design|how does|why does|write|creat|detail|comprehensiv|lore|history|guide|ark|dino|server|admin|trade|tribe/i.test(q);
  return { model: complex ? MODEL_SMART : MODEL_FAST };
}

let _kCache = null, _kTs = 0;
async function getKnowledge() {
  const now = Date.now();
  if (_kCache !== null && now - _kTs < 90_000) return _kCache;
  if (!sb || !sbOk()) { _kCache = ''; return ''; }
  try {
    const { data } = await sb.from('aegis_knowledge').select('category,title,content').neq('category', 'auto_learned').order('category').limit(80);
    _kCache = data?.length ? '\n\nKNOWLEDGE:\n' + data.map(r => `[${r.category}] ${r.title}: ${r.content}`).join('\n') : '';
    _kTs = now; return _kCache;
  } catch { _kCache = ''; return ''; }
}

// Per-channel persona overrides: channelId → { persona, style }
const personaOverrides = new Map();

const CORE_PROMPT = `You are AEGIS — the living sovereign intelligence of TheConclave Dominion, a 5× crossplay ARK: Survival Ascended community (Guild: 1438103556610723922) run by Tw_ (High Curator/Owner) with co-owners Slothie (Archmaestro) and Sandy (Wildheart).

CLUSTER (10 maps, crossplay Xbox·PS·PC):
The Island 217.114.196.102:5390 · Volcano 217.114.196.59:5050 · Extinction 31.214.196.102:6440
The Center 31.214.163.71:5120 · Lost Colony 217.114.196.104:5150 · Astraeos 217.114.196.9:5320
Valguero 85.190.136.141:5090 · Scorched Earth 217.114.196.103:5240
Aberration 217.114.196.80:5540 (PvP) · Amissa 217.114.196.80:5180 (Patreon-Elite exclusive)

RATES: 5× XP/Harvest/Taming/Breeding · 1M weight · No fall damage · Max wild 350
MODS: Death Inventory Keeper · ARKomatic · Awesome Spyglass · Teleporter
SHOP: theconclavedominion.com/shop · $1 = 1 ClaveShard
PAYMENTS: CashApp $TheConclaveDominion · Chime $ANLIKESEF
MINECRAFT: 134.255.214.44:10090 (Bedrock)
PATREON: patreon.com/theconclavedominion · Amissa access at Elite ($20/mo)
COUNCIL: Tw_ (High Curator) · Slothie (Archmaestro) · Sandy (Wildheart) · Jenny (Skywarden) · Arbanion (Oracle of Veils) · Okami (Hazeweaver) · Rookiereaper (Gatekeeper) · Icyreaper (Veilcaster) · Jake (ForgeSmith) · CredibleDevil (Iron Vanguard)

CLAVESHARD TIERS:
T1(1)=L600 Vanilla Dino+Max XP+3 Stacks Ammo+Full Coloring+100 Kibble/Cakes/Beer+100% Imprint+500 Non-Tek Structures+Cryofridge+120 Pods+50k EchoCoins+2500 Materials+10 Tributes+Boss Artifact+Non-Tek Blueprint+Revival Token 48hr
T2(2)=Modded L600+60 Dedicated Storage+L600 Yeti+L600 Polar Bear+450 Random Shiny+Shiny Shoulder
T3(3)=Tek Blueprint+Shiny Essence+200% Imprint+450 T1 Special Shiny
T5(5)=Boss Defeat Command+Bronto/Dread+Saddle+Astral Dino+L1000 Basilisk/Rock Elemental/Karkinos+50 Raw Shiny Essence+450 T2 Shiny+Small Bundle+2500 Imprint Kibble
T6(6)=Boss Ready Bundle+300% Imprint+Max XP
T8(8)=Medium Bundle+100k Resources (No Element)
T10(10)=Tek Suit+Platform+Combo Shinies+Dino Color Party+Breeding Pair
T12(12)=Large Bundle+200k Resources
T15(15)=30k Element+L900 Rhynio/Reaper/Aureliax+XLarge Bundle 300k
T20(20)=Behemoth Gate Expansion (10/max)
T30(30)=2 Dedicated Storage Admin Refill+1.6M Resources
DINO INSURANCE=One Time Use+Must Be Named+One Per Dino

VOICE: Precise, sovereign, cosmic — speak with authority and a touch of mythos. Use Discord markdown. Keep responses under 1800 chars unless detail is specifically requested.`;

const convMem = new Map();
function getHist(uid) { return convMem.get(uid) || []; }
function addHist(uid, role, content) {
  const h = convMem.get(uid) || [];
  h.push({ role, content: content.slice(0, 600) });
  if (h.length > 24) h.splice(0, h.length - 24);
  convMem.set(uid, h);
}
function clearHist(uid) { convMem.delete(uid); }
setInterval(() => { for (const [k, v] of convMem) if (!v?.length) convMem.delete(k); }, 30 * 60_000);

async function askAegis(msg, uid = null, extraCtx = '', channelId = null) {
=======
// ── RATE LIMITER ──────────────────────────────────────────────────
const rates = new Map();
function checkRate(uid, ms=8000) { const l=rates.get(uid)||0,n=Date.now(); if(n-l<ms)return Math.ceil((ms-(n-l))/1000); rates.set(uid,n); return 0; }
setInterval(()=>{ const cut=Date.now()-120_000; for(const[k,v]of rates)if(v<cut)rates.delete(k); },5*60_000);

// ── SUPABASE CIRCUIT BREAKER ──────────────────────────────────────
const CB = { failures:0, openUntil:0, threshold:5, resetMs:60_000 };
const sbOk  = ()=>Date.now()>=CB.openUntil;
function sbFail(){CB.failures++;if(CB.failures>=CB.threshold){CB.openUntil=Date.now()+CB.resetMs;console.error('⚡ Supabase CB OPEN');}}
function sbSucc(){CB.failures=0;CB.openUntil=0;}
async function sbQuery(fn){if(!sb)throw new Error('Supabase not configured');if(!sbOk())throw new Error('Database temporarily unavailable');try{const r=await fn(sb);sbSucc();return r;}catch(e){sbFail();throw e;}}

// ── AI MODEL ROUTING ──────────────────────────────────────────────
function pickModel(q) {
  const complex = /explain|analyze|compare|strategy|build|design|how does|why does|write|create|detailed|comprehensive|lore|history|guide/i.test(q);
  return { model: complex ? MODEL_SMART : MODEL_FAST };
}

// ── KNOWLEDGE CACHE ───────────────────────────────────────────────
let _kCache=null, _kTs=0;
async function getKnowledge(){
  const now=Date.now();
  if(_kCache!==null&&now-_kTs<90_000)return _kCache;
  if(!sb||!sbOk()){_kCache='';return '';}
  try{
    const{data}=await sb.from('aegis_knowledge').select('category,title,content').neq('category','auto_learned').order('category').limit(80);
    _kCache=data?.length?'\n\nKNOWLEDGE:\n'+data.map(r=>`[${r.category}] ${r.title}: ${r.content}`).join('\n'):'';
    _kTs=now;
    return _kCache;
  }catch{_kCache='';return '';}
}

// ── CORE PROMPT ───────────────────────────────────────────────────
const CORE = `You are AEGIS — the living intelligence of TheConclave Dominion, a 5× crossplay ARK: Survival Ascended community (Guild ID: 1438103556610723922) run by Tw_ (High Curator/Owner) with co-owners Slothie (Archmaestro) and Sandy (Wildheart).

SERVERS (10 maps, all crossplay Xbox·PS·PC):
The Island 217.114.196.102:5390 · Volcano 217.114.196.59:5050 · Extinction 31.214.196.102:6440
The Center 31.214.163.71:5120 · Lost Colony 217.114.196.104:5150 · Astraeos 217.114.196.9:5320
Valguero 85.190.136.141:5090 · Scorched Earth 217.114.196.103:5240
Aberration 217.114.196.80:5540 (PvP) · Amissa 217.114.196.80:5180 (Patreon-exclusive)

RATES: 5× XP/Harvest/Taming/Breeding · 1M weight · No fall damage · Max wild 350
MODS: Death Inventory Keeper · ARKomatic · Awesome Spyglass · Teleporter
SHOP: theconclavedominion.com/shop · Donations only ($1 = 1 shard)
PAYMENTS: CashApp $TheConclaveDominion · Chime $ANLIKESEF
MINECRAFT: 134.255.214.44:10090 (Bedrock)
PATREON: patreon.com/theconclavedominion — Amissa at Elite $20/mo
COUNCIL: Tw_ · Slothie · Sandy · Jenny · Arbanion · Okami · Rookiereaper · Icyreaper · Jake · CredibleDevil

CLAVESHARD TIERS:
T1(1)=L600 Vanilla Dino+Max XP+3 Stacks Ammo+Full Coloring+100 Kibble/Cakes/Beer+100% Imprint+500 Non-Tek Structures+Cryofridge+120 Pods+50k EchoCoins+2500 Materials+10 Same-Type Tributes+Boss Artifact+Revival Token(48hr)
T2(2)=Modded L600+60 Dedicated Storage+L600 Yeti+L600 Polar Bear+450 Random Shiny+Shiny Shoulder Variant
T3(3)=Tek Blueprint+Shiny Essence+200% Imprint+450 T1 Special Shiny
T5(5)=Boss Defeat Command+Bronto/Dread+Saddle+Astral Dino+L1000 Basilisk/Rock Elemental/Karkinos+50 Raw Shiny Essence+450 T2 Shiny+Small Bundle+2500 Imprint Kibble
T6(6)=Boss Ready Bundle+300% Imprint+Max XP
T8(8)=Medium Bundle+100k Resources(No Element)
T10(10)=Tek Suit Set+Platform+Combo Shinies+Dino Color Party+Breeding Pair
T12(12)=Large Bundle+200k Resources
T15(15)=30k Element+L900 Rhynio/Reaper/Aureliax+XLarge Bundle(300k)
T20(20)=Behemoth Gate Expansion(10/max)
T30(30)=2 Dedicated Storage Admin Refill+1.6M Resources
DINO INSURANCE=One Time Use+Must Be Named+One Per Dino

Respond under 1800 chars for Discord. Be accurate, community-warm, with cosmic gravitas. Use Discord markdown.`;

// ── CONVERSATION MEMORY ───────────────────────────────────────────
const convMem = new Map();
function getHist(uid){return convMem.get(uid)||[];}
function addHist(uid,role,content){const h=convMem.get(uid)||[];h.push({role,content:content.slice(0,600)});if(h.length>24)h.splice(0,h.length-24);convMem.set(uid,h);}
function clearHist(uid){convMem.delete(uid);}
setInterval(()=>{for(const[k,v]of convMem)if(!v?.length)convMem.delete(k);},30*60_000);

// ── CORE AI FUNCTION — GROQ (FREE, UNLIMITED) ─────────────────────
async function askAegis(msg, uid=null, extraCtx='') {
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
  if (!groq) return '⚠️ AI not configured — set GROQ_API_KEY in Render environment.';

  const { model } = pickModel(msg);
  let retries = 0;

  while (retries < 3) {
    try {
<<<<<<< HEAD
      const knowledge = await getKnowledge();
      const persona   = channelId ? (personaOverrides.get(channelId) || null) : null;
      const personaCtx = persona ? `\n\nCURRENT CHANNEL PERSONA OVERRIDE:\nStyle: ${persona.style}\nPersona note: ${persona.note}` : '';
      const system = CORE_PROMPT + knowledge + personaCtx + (extraCtx ? '\n\n' + extraCtx : '');
      const history = uid ? getHist(uid) : [];

      const res = await groq.chat.completions.create({
        model,
        max_tokens: model.includes('8b') ? 600 : 1000,
        temperature: 0.78,
=======
      const knowledge  = await getKnowledge();
      const system     = CORE + knowledge + (extraCtx ? '\n\n' + extraCtx : '');
      const history    = uid ? getHist(uid) : [];

      const res = await groq.chat.completions.create({
        model,
        max_tokens: model.includes('8b') ? 600 : 900,
        temperature: 0.75,
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
        messages: [
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: msg },
        ],
      });

      const text = res.choices?.[0]?.message?.content?.trim();
      if (!text) return '⚠️ Empty response from AI.';

      if (uid) { addHist(uid, 'user', msg); addHist(uid, 'assistant', text); }

<<<<<<< HEAD
      if (sb && sbOk()) (async () => {
        try {
          await sb.from('aegis_ai_usage').insert({
            model, input_tokens: res.usage?.prompt_tokens || 0,
            output_tokens: res.usage?.completion_tokens || 0,
            used_search: false, query_preview: msg.slice(0, 120),
            created_at: new Date().toISOString(),
=======
      // Log usage to Supabase (keeps /ai-cost dashboard working)
      if (sb && sbOk()) (async () => {
        try {
          await sb.from('aegis_ai_usage').insert({
            model,
            input_tokens:  res.usage?.prompt_tokens     || 0,
            output_tokens: res.usage?.completion_tokens || 0,
            used_search:   false,
            query_preview: msg.slice(0, 120),
            created_at:    new Date().toISOString(),
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
          });
        } catch {}
      })();

      return text;

    } catch (e) {
      const msg2 = e.message || '';
      if (msg2.includes('rate_limit') || e.status === 429) {
        retries++;
        if (retries < 3) { await new Promise(r => setTimeout(r, 2000 * retries)); continue; }
        return '⚠️ AEGIS rate limited. Try again in a moment.';
      }
<<<<<<< HEAD
=======
      if (msg2.includes('model_not_found')) return '⚠️ AI model unavailable. Check GROQ_API_KEY.';
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
      console.error('[AEGIS AI]', msg2);
      return '⚠️ AEGIS error: ' + msg2.slice(0, 100);
    }
  }
}

<<<<<<< HEAD
// ── AI SUMMARIZE (internal, no history) ──
async function aiSummarize(prompt) {
  if (!groq) return null;
  try {
    const res = await groq.chat.completions.create({
      model: MODEL_FAST, max_tokens: 300, temperature: 0.5,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════════
// WALLET ENGINE
// ══════════════════════════════════════════════════════════════════════
async function getWallet(id, tag) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').upsert(
      { discord_id: id, discord_tag: tag, updated_at: new Date().toISOString() },
      { onConflict: 'discord_id', ignoreDuplicates: false }
    ).select().single();
    if (error) throw new Error('Wallet error: ' + error.message);
    return data;
  });
}
async function logTx(id, tag, action, amount, balAfter, note = '', actorId = '', actorTag = '') {
  if (!sb || !sbOk()) return;
  try {
    await sb.from('aegis_wallet_ledger').insert({
      discord_id: id, action, amount, balance_wallet_after: balAfter,
      note: note || null, actor_discord_id: actorId || null, actor_tag: actorTag || null, created_at: new Date().toISOString(),
    });
  } catch {}
}
async function depositToBank(id, tag, amount) {
  const w = await getWallet(id, tag);
  if (w.wallet_balance < amount) throw new Error(`Need **${amount}** in wallet. Have **${w.wallet_balance}** 💎.`);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance: w.wallet_balance - amount, bank_balance: w.bank_balance + amount, updated_at: new Date().toISOString() }).eq('discord_id', id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id, tag, 'deposit', amount, data.bank_balance, `Deposited ${amount} to bank`, id, tag);
    return data;
  });
}
async function withdrawFromBank(id, tag, amount) {
  const w = await getWallet(id, tag);
  if (w.bank_balance < amount) throw new Error(`Need **${amount}** in bank. Have **${w.bank_balance}** 💎.`);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance: w.wallet_balance + amount, bank_balance: w.bank_balance - amount, updated_at: new Date().toISOString() }).eq('discord_id', id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id, tag, 'withdraw', amount, data.wallet_balance, `Withdrew ${amount}`, id, tag);
    return data;
  });
}
async function transferShards(fromId, fromTag, toId, toTag, amount) {
  if (fromId === toId) throw new Error('Cannot transfer to yourself.');
  const sender = await getWallet(fromId, fromTag);
  if (sender.wallet_balance < amount) throw new Error(`Need **${amount}** in wallet. Have **${sender.wallet_balance}** 💎.`);
  return sbQuery(async sb => {
    await sb.from('aegis_wallets').update({ wallet_balance: sender.wallet_balance - amount, lifetime_spent: (sender.lifetime_spent || 0) + amount, updated_at: new Date().toISOString() }).eq('discord_id', fromId);
    await getWallet(toId, toTag);
    const { data: r } = await sb.from('aegis_wallets').select('wallet_balance,lifetime_earned').eq('discord_id', toId).single();
    const { data: up } = await sb.from('aegis_wallets').update({ wallet_balance: (r.wallet_balance || 0) + amount, lifetime_earned: (r.lifetime_earned || 0) + amount, updated_at: new Date().toISOString() }).eq('discord_id', toId).select().single();
    const note = `${fromTag} → ${toTag}`;
    await logTx(fromId, fromTag, 'transfer_out', amount, sender.wallet_balance - amount, note, fromId, fromTag);
    await logTx(toId, toTag, 'transfer_in', amount, up.wallet_balance, note, fromId, fromTag);
    return { sent: sender.wallet_balance - amount, received: up.wallet_balance };
  });
}
async function grantShards(toId, toTag, amount, reason, actorId, actorTag) {
  await getWallet(toId, toTag);
  return sbQuery(async sb => {
    const { data: curr } = await sb.from('aegis_wallets').select('wallet_balance,lifetime_earned').eq('discord_id', toId).single();
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance: (curr.wallet_balance || 0) + amount, lifetime_earned: (curr.lifetime_earned || 0) + amount, updated_at: new Date().toISOString() }).eq('discord_id', toId).select().single();
    if (error) throw new Error(error.message);
    await logTx(toId, toTag, 'grant', amount, data.wallet_balance, reason || 'Admin grant', actorId, actorTag);
    return data;
  });
}
async function deductShards(fromId, fromTag, amount, reason, actorId, actorTag) {
  const w = await getWallet(fromId, fromTag);
  const nb = Math.max(0, (w.wallet_balance || 0) - amount);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance: nb, lifetime_spent: (w.lifetime_spent || 0) + amount, updated_at: new Date().toISOString() }).eq('discord_id', fromId).select().single();
    if (error) throw new Error(error.message);
    await logTx(fromId, fromTag, 'deduct', amount, data.wallet_balance, reason || 'Admin deduct', actorId, actorTag);
    return data;
  });
}
async function setBalance(targetId, targetTag, amount, reason, actorId, actorTag) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance: amount, updated_at: new Date().toISOString() }).eq('discord_id', targetId).select().single();
    if (error) throw new Error(error.message);
    await logTx(targetId, targetTag, 'admin_set', amount, amount, reason || 'Admin set', actorId, actorTag);
    return data;
  });
}
async function getTxHistory(id, limit = 15) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallet_ledger').select('action,amount,balance_wallet_after,note,actor_tag,created_at').eq('discord_id', id).order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  });
}
async function getLeaderboard(limit = 10) {
  return sbQuery(async sb => {
    const { data } = await sb.from('aegis_wallets').select('discord_id,discord_tag,wallet_balance,bank_balance,lifetime_earned').order('wallet_balance', { ascending: false }).limit(limit);
    return data || [];
  });
}
async function getSupply() {
  return sbQuery(async sb => {
    const { data } = await sb.from('aegis_wallets').select('wallet_balance,bank_balance');
    if (!data?.length) return { walletTotal: 0, bankTotal: 0, holders: 0 };
    return { walletTotal: data.reduce((s, r) => s + (r.wallet_balance || 0), 0), bankTotal: data.reduce((s, r) => s + (r.bank_balance || 0), 0), holders: data.length };
  });
}
async function claimWeekly(id, tag) {
  return sbQuery(async sb => {
    const { data: w } = await sb.from('aegis_wallets').select('*').eq('discord_id', id).single().catch(() => ({ data: null }));
    if (!w) { await getWallet(id, tag); return claimWeekly(id, tag); }
    const now = new Date(), last = w.last_daily_claim ? new Date(w.last_daily_claim) : null;
    const diff = last ? (now - last) / (1000 * 60 * 60) : 999;
    if (diff < 168) { const next = new Date(last.getTime() + 168 * 60 * 60 * 1000); throw new Error(`⏳ Already claimed. Next: <t:${Math.floor(next / 1000)}:R>`); }
    const amount = 3, streak = (w.daily_streak || 0) + 1;
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance: (w.wallet_balance || 0) + amount, lifetime_earned: (w.lifetime_earned || 0) + amount, last_daily_claim: now.toISOString(), daily_streak: streak, updated_at: now.toISOString() }).eq('discord_id', id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id, tag, 'daily_claim', amount, data.wallet_balance, `Week ${streak} claim`, 'SYSTEM', 'AEGIS');
    return { data, amount, streak };
  });
}

// ── BULK OPERATIONS ─────────────────────────────────────────────────
async function bulkGrant(userList, amount, reason, actorId, actorTag) {
  const results = [];
  for (const u of userList) {
    try {
      const w = await grantShards(u.id, u.tag, amount, reason, actorId, actorTag);
      results.push({ id: u.id, tag: u.tag, success: true, balance: w.wallet_balance });
    } catch (e) {
      results.push({ id: u.id, tag: u.tag, success: false, error: e.message });
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════════════════
// WARN ENGINE
// ══════════════════════════════════════════════════════════════════════
async function addWarn(guildId, targetId, targetTag, reason, actorId, actorTag) {
  if (!sb) return null;
  try {
    const { data } = await sb.from('aegis_warns').insert({ guild_id: guildId, discord_id: targetId, discord_tag: targetTag, reason, issued_by: actorId, issued_by_tag: actorTag, created_at: new Date().toISOString() }).select().single();
    return data;
  } catch (e) { console.error('Warn insert:', e.message); return null; }
}
async function getWarns(guildId, targetId) {
  if (!sb) return [];
  try {
    const { data } = await sb.from('aegis_warns').select('*').eq('guild_id', guildId).eq('discord_id', targetId).order('created_at', { ascending: false });
    return data || [];
  } catch { return []; }
}
async function clearWarns(guildId, targetId) {
  if (!sb) return false;
  try { await sb.from('aegis_warns').delete().eq('guild_id', guildId).eq('discord_id', targetId); return true; }
  catch { return false; }
}

// ══════════════════════════════════════════════════════════════════════
// GIVEAWAY ENGINE v2 (shard-entry support)
// ══════════════════════════════════════════════════════════════════════
const activeGiveaways = new Map();

async function drawGiveaway(msgId, guildId, client) {
  const gw = activeGiveaways.get(msgId); if (!gw) return;
  const entries = [...gw.entries];
  if (!entries.length) {
    try { const ch = client.channels.cache.get(gw.channelId); const msg = await ch?.messages.fetch(msgId); if (msg) await msg.edit({ embeds: [new EmbedBuilder().setColor(0xFF4500).setTitle('🎉 Giveaway Ended').setDescription(`**${gw.prize}**\n\nNo valid entries.`).setFooter({ text: 'TheConclave Dominion' })], components: [] }); }
    catch {} activeGiveaways.delete(msgId); return;
  }
  const winners = [];
  for (let w = 0; w < Math.min(gw.winnersCount, entries.length); w++) { const idx = Math.floor(Math.random() * entries.length); winners.push(entries.splice(idx, 1)[0]); }
  const winMentions = winners.map(w => `<@${w}>`).join(' ');
  try {
    const ch = client.channels.cache.get(gw.channelId);
    const msg = await ch?.messages.fetch(msgId);
    if (msg) await msg.edit({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('🎉 Giveaway Ended!').setDescription(`**${gw.prize}**\n\n🏆 **Winners:** ${winMentions}`).setFooter({ text: 'TheConclave Dominion' })], components: [] });
    if (ch) await ch.send(`🎉 Giveaway over! ${winMentions} won **${gw.prize}**!`);
  } catch {}
  activeGiveaways.delete(msgId);
}

// ══════════════════════════════════════════════════════════════════════
// WIPE TRACKER
// ══════════════════════════════════════════════════════════════════════
const wipeData = { date: null, reason: null, setBy: null, setAt: null };

// ══════════════════════════════════════════════════════════════════════
// TRIBE REGISTRY
// ══════════════════════════════════════════════════════════════════════
async function registerTribe(guildId, ownerId, ownerTag, tribeName, server, members = []) {
  if (!sb) throw new Error('Supabase not configured.');
  const { error } = await sb.from('aegis_tribes').upsert(
    { guild_id: guildId, owner_id: ownerId, owner_tag: ownerTag, tribe_name: tribeName, server, members: JSON.stringify(members), updated_at: new Date().toISOString() },
    { onConflict: 'guild_id,owner_id' }
  );
  if (error) throw new Error(error.message);
}
async function lookupTribe(guildId, query) {
  if (!sb) return [];
  const { data } = await sb.from('aegis_tribes').select('*').eq('guild_id', guildId).or(`tribe_name.ilike.%${query}%,owner_tag.ilike.%${query}%`).limit(5);
  return data || [];
}

// ══════════════════════════════════════════════════════════════════════
// SERVER VOTE ENGINE
// ══════════════════════════════════════════════════════════════════════
const activeVotes = new Map(); // msgId → { question, options, votes: Map<optionIdx, Set<userId>>, ends, channelId }

// ══════════════════════════════════════════════════════════════════════
// SERVER MONITOR
// ══════════════════════════════════════════════════════════════════════
const monitorState = new Map();
const MONITOR_SERVERS = [
  { id: 'island',     name: 'The Island',     nitradoId: 18266152, emoji: '🌿', ip: '217.114.196.102', port: 5390, pvp: false, patreon: false },
  { id: 'volcano',    name: 'Volcano',         nitradoId: 18094678, emoji: '🌋', ip: '217.114.196.59',  port: 5050, pvp: false, patreon: false },
  { id: 'extinction', name: 'Extinction',      nitradoId: 18106633, emoji: '🌑', ip: '31.214.196.102',  port: 6440, pvp: false, patreon: false },
  { id: 'center',     name: 'The Center',      nitradoId: 18182839, emoji: '🏔️', ip: '31.214.163.71',   port: 5120, pvp: false, patreon: false },
  { id: 'lostcolony', name: 'Lost Colony',     nitradoId: 18307276, emoji: '🪐', ip: '217.114.196.104', port: 5150, pvp: false, patreon: false },
  { id: 'astraeos',   name: 'Astraeos',        nitradoId: 18393892, emoji: '✨', ip: '217.114.196.9',   port: 5320, pvp: false, patreon: false },
  { id: 'valguero',   name: 'Valguero',        nitradoId: 18509341, emoji: '🏞️', ip: '85.190.136.141',  port: 5090, pvp: false, patreon: false },
  { id: 'scorched',   name: 'Scorched Earth',  nitradoId: 18598049, emoji: '☀️', ip: '217.114.196.103', port: 5240, pvp: false, patreon: false },
  { id: 'aberration', name: 'Aberration',      nitradoId: 18655529, emoji: '⚔️', ip: '217.114.196.80',  port: 5540, pvp: true,  patreon: false },
  { id: 'amissa',     name: 'Amissa',          nitradoId: 18680162, emoji: '⭐', ip: '217.114.196.80',  port: 5180, pvp: false, patreon: true },
];
const EXISTING_STATUS_CHANNELS = {
  aberration: '1491714622959390830', amissa: '1491714743797416056', astraeos: '1491714926862008320',
  center: '1491715233847316590', extinction: '1491715612911861790', lostcolony: '1491715764678299670',
  scorched: '1491717247083876435', island: '1491715445659799692', valguero: '1491715929586008075', volcano: '1491716283857633290',
};
const channelRenameCooldowns = new Map();
const RENAME_COOLDOWN_MS     = 12 * 60 * 1000;
const RENAME_QUEUE_DELAY_MS  = 1_500;

async function safeRenameChannel(ch, newName) {
  if (!ch || ch.name === newName) return false;
  const now = Date.now(), last = channelRenameCooldowns.get(ch.id) || 0;
  if (now - last < RENAME_COOLDOWN_MS) return false;
  channelRenameCooldowns.set(ch.id, now);
  try { await ch.setName(newName); return true; }
  catch (e) {
    if (e.status === 429 || (e.message || '').includes('429')) { channelRenameCooldowns.set(ch.id, now + 15 * 60 * 1000); console.warn(`⚠️ 429 rename ${ch.name}`); }
    else console.error(`❌ Rename ${ch.name}:`, e.message);
    return false;
  }
}
async function fetchNitradoServer(nitradoId) {
  if (!process.env.NITRADO_API_KEY) return null;
  try {
    const res = await axios.get(`https://api.nitrado.net/services/${nitradoId}/gameservers`, { headers: { Authorization: `Bearer ${process.env.NITRADO_API_KEY}` }, timeout: 10000 });
    const gs = res.data?.data?.gameserver; if (!gs) return null;
    return { status: gs.status === 'started' ? 'online' : 'offline', players: gs.query?.player_current ?? 0, maxPlayers: gs.query?.player_max ?? 20 };
  } catch { return null; }
}
async function fetchServerStatuses() {
  if (!process.env.NITRADO_API_KEY) return MONITOR_SERVERS.map(s => ({ ...s, status: 'unknown', players: 0, maxPlayers: 20 }));
  const results = [];
  await Promise.all(MONITOR_SERVERS.map(async srv => {
    const data = srv.nitradoId ? await fetchNitradoServer(srv.nitradoId) : null;
    results.push({ ...srv, status: data?.status ?? 'unknown', players: data?.players ?? 0, maxPlayers: data?.maxPlayers ?? 20 });
  }));
  return results;
}
function buildMonitorEmbed(servers) {
  const online = servers.filter(s => s.status === 'online'), offline = servers.filter(s => s.status !== 'online');
  const total = online.reduce((sum, s) => sum + s.players, 0);
  const lines = [
    ...online.map(s => `🟢 **${s.emoji} ${s.name}**${s.pvp ? ' ⚔️' : s.patreon ? ' ⭐' : ''} \`${s.players}/${s.maxPlayers}\``),
    ...offline.map(s => `🔴 **${s.emoji} ${s.name}** · Offline`),
  ].join('\n');
  return new EmbedBuilder().setTitle('⚔️ TheConclave — Live Cluster Monitor').setColor(total > 0 ? 0x35ED7E : 0xFF4500).setDescription(lines || 'No server data.').addFields({ name: '🟢 Online', value: `${online.length}/${servers.length}`, inline: true }, { name: '👥 Players', value: `${total}`, inline: true }, { name: '⏰ Updated', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }).setFooter({ text: 'TheConclave Dominion • Auto-refreshes every 5 min', iconURL: 'https://theconclavedominion.com/conclave-badge.png' }).setTimestamp();
}
async function updateExistingStatusChannels(guild, statuses) {
  for (const srv of statuses) {
    const chId = EXISTING_STATUS_CHANNELS[srv.id]; if (!chId) continue;
    const ch = await guild.channels.fetch(chId).catch(() => null); if (!ch) continue;
    const newName = srv.status === 'online' ? `🟢${srv.pvp ? '⚔️' : srv.patreon ? '⭐' : ''}・${srv.name}-${srv.players}p` : `🔴・${srv.name}-offline`;
    const renamed = await safeRenameChannel(ch, newName);
    if (renamed) await new Promise(r => setTimeout(r, RENAME_QUEUE_DELAY_MS));
  }
}
let _monitorTick = 0;
setInterval(async () => {
  _monitorTick++;
  if (!DISCORD_GUILD_ID) return;
  try {
    const g = await bot.guilds.fetch(DISCORD_GUILD_ID).catch(() => null); if (!g) return;
    const s = await fetchServerStatuses().catch(() => MONITOR_SERVERS.map(srv => ({ ...srv, status: 'unknown', players: 0, maxPlayers: 20 })));
    if (_monitorTick % 2 === 0) await updateExistingStatusChannels(g, s);
    for (const [gid, state] of monitorState) {
      if (!state.statusChannelId || !state.messageId) continue;
      try {
        const guild = await bot.guilds.fetch(gid).catch(() => null); if (!guild) continue;
        const ch = await guild.channels.fetch(state.statusChannelId).catch(() => null); if (!ch) continue;
        const embed = buildMonitorEmbed(s);
        const msg = await ch.messages.fetch(state.messageId).catch(() => null);
        if (msg) await msg.edit({ embeds: [embed] }); else { const nm = await ch.send({ embeds: [embed] }); state.messageId = nm.id; }
      } catch {}
    }
  } catch (e) { console.error('❌ Monitor tick:', e.message); }
}, 5 * 60_000);

// ══════════════════════════════════════════════════════════════════════
// EMBED HELPERS
// ══════════════════════════════════════════════════════════════════════
const C = { gold: 0xFFB800, pl: 0x7B2FFF, cy: 0x00D4FF, gr: 0x35ED7E, rd: 0xFF4500, pk: 0xFF4CD2 };
const FT = { text: 'TheConclave Dominion • 5× Crossplay • 10 Maps', iconURL: 'https://theconclavedominion.com/conclave-badge.png' };
const base = (title, color = C.pl) => new EmbedBuilder().setTitle(title).setColor(color).setFooter(FT).setTimestamp();

function walletEmbed(title, w, color = C.pl) {
  const total = (w.wallet_balance || 0) + (w.bank_balance || 0);
  return base(title, color).setDescription(`**${w.discord_tag || w.discord_id}**`).addFields(
    { name: '💎 Wallet', value: `**${(w.wallet_balance || 0).toLocaleString()}**`, inline: true },
    { name: '🏦 Bank',   value: `**${(w.bank_balance || 0).toLocaleString()}**`, inline: true },
    { name: '📊 Total',  value: `**${total.toLocaleString()}**`, inline: true },
    { name: '📈 Earned', value: `${(w.lifetime_earned || 0).toLocaleString()}`, inline: true },
    { name: '📉 Spent',  value: `${(w.lifetime_spent || 0).toLocaleString()}`, inline: true },
    { name: '🔥 Streak', value: `Week ${w.daily_streak || 0}`, inline: true },
  );
}

// ══════════════════════════════════════════════════════════════════════
// SHOP DATA
// ══════════════════════════════════════════════════════════════════════
const SHOP_TIERS = [
  { shards: 1,  emoji: '💠', name: '1 Clave Shard',   items: ['Level 600 Vanilla Dino (Tameable)', 'Max XP', '3 Stacks Ammo', 'Full Dino Coloring', '100 Kibble / Cakes / Beer', '100% Imprint', '500 Non-Tek Structures', 'Cryofridge + 120 Pods', '50,000 Echo Coins', '2,500 Materials', '10 Same-Type Tributes', 'Boss Artifact + Tribute (1 Run)', 'Non-Tek Blueprint', 'Dino Revival Token (48hr limit)'] },
  { shards: 2,  emoji: '💎', name: '2 Clave Shards',  items: ['Modded Level 600 Dino', '60 Dedicated Storage', 'Level 600 Yeti + Polar Bear', '450 Random Shiny + Shoulder Variant'] },
  { shards: 3,  emoji: '✨', name: '3 Clave Shards',  items: ['Tek Blueprint', '1 Shiny Essence', '200% Imprint', '450 T1 Special Shiny'] },
  { shards: 5,  emoji: '🔥', name: '5 Clave Shards',  items: ['Boss Defeat Command', 'Bronto or Dread + Saddle', 'Astral Dino', 'Level 1000 Basilisk / Rock Elemental / Karkinos', '50 Raw Shiny Essence', '450 T2 Special Shiny', 'Small Resource Bundle', '2,500 Imprint Kibble'] },
  { shards: 6,  emoji: '⚔️', name: '6 Clave Shards',  items: ['Boss Ready Dino Bundle', '300% Imprint', 'Max XP'] },
  { shards: 8,  emoji: '🌌', name: '8 Clave Shards',  items: ['Medium Resource Bundle', '100,000 Resources (No Element)'] },
  { shards: 10, emoji: '🛡️', name: '10 Clave Shards', items: ['Tek Suit Blueprint / Set', 'Floating Platform', 'Combo Shinies', 'Dino Color Party', 'Breeding Pair'] },
  { shards: 12, emoji: '🌠', name: '12 Clave Shards', items: ['Large Resource Bundle', '200,000 Resources'] },
  { shards: 15, emoji: '👑', name: '15 Clave Shards', items: ['30,000 Element', 'Level 900 Rhyniognatha / Reaper / Aureliax', 'XLarge Bundle (300k Resources)'] },
  { shards: 20, emoji: '🏰', name: '20 Clave Shards', items: ['1x1 Behemoth Gate Expansion (10/max)'] },
  { shards: 30, emoji: '💰', name: '30 Clave Shards', items: ['2 Dedicated Storage Admin Refill', '1.6 Million Total Resources'] },
  { shards: 0,  emoji: '🛡',  name: 'Dino Insurance',  items: ['One Time Use', 'Must Be Named', 'Backup May Not Save', 'May Require Respawn', 'One Per Dino'] },
];

const MAP_INFO = {
  island:     { name: 'The Island',    ip: '217.114.196.102:5390', emoji: '🌿', desc: 'Classic starter map. Lush biomes, all original boss arenas.', pvp: false, patreon: false },
  volcano:    { name: 'Volcano',       ip: '217.114.196.59:5050',  emoji: '🌋', desc: 'Dramatic volcanic biomes with rich resources.', pvp: false, patreon: false },
  extinction: { name: 'Extinction',    ip: '31.214.196.102:6440',  emoji: '🌑', desc: 'Post-apocalyptic Earth. Titans, OSD drops, Element farming.', pvp: false, patreon: false },
  center:     { name: 'The Center',    ip: '31.214.163.71:5120',   emoji: '🏔️', desc: 'Floating islands, underground ocean, great endgame bases.', pvp: false, patreon: false },
  lostcolony: { name: 'Lost Colony',   ip: '217.114.196.104:5150', emoji: '🪐', desc: 'Space-themed ascended map with unique creatures.', pvp: false, patreon: false },
  astraeos:   { name: 'Astraeos',      ip: '217.114.196.9:5320',   emoji: '✨', desc: 'Custom Ascended map blending multiple terrains and rare creatures.', pvp: false, patreon: false },
  valguero:   { name: 'Valguero',      ip: '85.190.136.141:5090',  emoji: '🏞️', desc: 'Rolling meadows, the Great Trench, and Deinonychus nesting.', pvp: false, patreon: false },
  scorched:   { name: 'Scorched Earth',ip: '217.114.196.103:5240', emoji: '☀️', desc: 'Desert survival: Wyverns, Rock Elementals, Manticore boss.', pvp: false, patreon: false },
  aberration: { name: 'Aberration',    ip: '217.114.196.80:5540',  emoji: '⚔️', desc: 'Underground PvP — Rock Drakes, Reapers, Nameless.', pvp: true,  patreon: false },
  amissa:     { name: 'Amissa',        ip: '217.114.196.80:5180',  emoji: '⭐', desc: 'Patreon-exclusive map for Elite tier patrons.', pvp: false, patreon: true },
};

// ══════════════════════════════════════════════════════════════════════
// SLASH COMMAND DEFINITIONS
// ══════════════════════════════════════════════════════════════════════
function addWalletSubs(b) {
  return b
    .addSubcommand(s => s.setName('balance').setDescription('💎 Check wallet').addUserOption(o => o.setName('user').setDescription('Member (blank = you)').setRequired(false)))
    .addSubcommand(s => s.setName('deposit').setDescription('🏦 Wallet → Bank').addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('withdraw').setDescription('💸 Bank → Wallet').addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('transfer').setDescription('➡️ Send shards').addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('note').setDescription('Message').setRequired(false)))
    .addSubcommand(s => s.setName('history').setDescription('🧾 Transaction log').addUserOption(o => o.setName('user').setDescription('Member').setRequired(false)).addIntegerOption(o => o.setName('count').setDescription('Entries (max 25)').setRequired(false).setMinValue(1).setMaxValue(25)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('🏆 Top holders'))
    .addSubcommand(s => s.setName('supply').setDescription('📊 Economy supply'))
    .addSubcommand(s => s.setName('grant').setDescription('🎁 [ADMIN] Grant shards').addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('deduct').setDescription('⬇️ [ADMIN] Deduct shards').addUserOption(o => o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)));
=======
// ══════════════════════════════════════════════════════════════════
// WALLET ENGINE
// ══════════════════════════════════════════════════════════════════
async function getWallet(id,tag){return sbQuery(async sb=>{const{data,error}=await sb.from('aegis_wallets').upsert({discord_id:id,discord_tag:tag,updated_at:new Date().toISOString()},{onConflict:'discord_id',ignoreDuplicates:false}).select().single();if(error)throw new Error('Wallet error: '+error.message);return data;});}
async function logTx(id,tag,action,amount,balAfter,note='',actorId='',actorTag=''){if(!sb||!sbOk())return;try{await sb.from('aegis_wallet_ledger').insert({discord_id:id,action,amount,balance_wallet_after:balAfter,note:note||null,actor_discord_id:actorId||null,actor_tag:actorTag||null,created_at:new Date().toISOString()});}catch{}}
async function depositToBank(id,tag,amount){const w=await getWallet(id,tag);if(w.wallet_balance<amount)throw new Error(`Need **${amount}** in wallet. You have **${w.wallet_balance}** 💎.`);return sbQuery(async sb=>{const{data,error}=await sb.from('aegis_wallets').update({wallet_balance:w.wallet_balance-amount,bank_balance:w.bank_balance+amount,updated_at:new Date().toISOString()}).eq('discord_id',id).select().single();if(error)throw new Error(error.message);await logTx(id,tag,'deposit',amount,data.bank_balance,`Deposited ${amount} to bank`,id,tag);return data;});}
async function withdrawFromBank(id,tag,amount){const w=await getWallet(id,tag);if(w.bank_balance<amount)throw new Error(`Need **${amount}** in bank. You have **${w.bank_balance}** 💎.`);return sbQuery(async sb=>{const{data,error}=await sb.from('aegis_wallets').update({wallet_balance:w.wallet_balance+amount,bank_balance:w.bank_balance-amount,updated_at:new Date().toISOString()}).eq('discord_id',id).select().single();if(error)throw new Error(error.message);await logTx(id,tag,'withdraw',amount,data.wallet_balance,`Withdrew ${amount}`,id,tag);return data;});}
async function transferShards(fromId,fromTag,toId,toTag,amount){if(fromId===toId)throw new Error('Cannot transfer to yourself.');const sender=await getWallet(fromId,fromTag);if(sender.wallet_balance<amount)throw new Error(`Need **${amount}** in wallet. You have **${sender.wallet_balance}** 💎.`);return sbQuery(async sb=>{await sb.from('aegis_wallets').update({wallet_balance:sender.wallet_balance-amount,lifetime_spent:(sender.lifetime_spent||0)+amount,updated_at:new Date().toISOString()}).eq('discord_id',fromId);await getWallet(toId,toTag);const{data:r}=await sb.from('aegis_wallets').select('wallet_balance,lifetime_earned').eq('discord_id',toId).single();const{data:up}=await sb.from('aegis_wallets').update({wallet_balance:(r.wallet_balance||0)+amount,lifetime_earned:(r.lifetime_earned||0)+amount,updated_at:new Date().toISOString()}).eq('discord_id',toId).select().single();const note=`${fromTag} → ${toTag}`;await logTx(fromId,fromTag,'transfer_out',amount,sender.wallet_balance-amount,note,fromId,fromTag);await logTx(toId,toTag,'transfer_in',amount,up.wallet_balance,note,fromId,fromTag);return{sent:sender.wallet_balance-amount,received:up.wallet_balance};});}
async function grantShards(toId,toTag,amount,reason,actorId,actorTag){await getWallet(toId,toTag);return sbQuery(async sb=>{const{data:curr}=await sb.from('aegis_wallets').select('wallet_balance,lifetime_earned').eq('discord_id',toId).single();const{data,error}=await sb.from('aegis_wallets').update({wallet_balance:(curr.wallet_balance||0)+amount,lifetime_earned:(curr.lifetime_earned||0)+amount,updated_at:new Date().toISOString()}).eq('discord_id',toId).select().single();if(error)throw new Error(error.message);await logTx(toId,toTag,'grant',amount,data.wallet_balance,reason||'Admin grant',actorId,actorTag);return data;});}
async function deductShards(fromId,fromTag,amount,reason,actorId,actorTag){const w=await getWallet(fromId,fromTag);const nb=Math.max(0,(w.wallet_balance||0)-amount);return sbQuery(async sb=>{const{data,error}=await sb.from('aegis_wallets').update({wallet_balance:nb,lifetime_spent:(w.lifetime_spent||0)+amount,updated_at:new Date().toISOString()}).eq('discord_id',fromId).select().single();if(error)throw new Error(error.message);await logTx(fromId,fromTag,'deduct',amount,data.wallet_balance,reason||'Admin deduct',actorId,actorTag);return data;});}
async function setBalance(targetId,targetTag,amount,reason,actorId,actorTag){return sbQuery(async sb=>{const{data,error}=await sb.from('aegis_wallets').update({wallet_balance:amount,updated_at:new Date().toISOString()}).eq('discord_id',targetId).select().single();if(error)throw new Error(error.message);await logTx(targetId,targetTag,'admin_set',amount,amount,reason||'Admin set',actorId,actorTag);return data;});}
async function getTxHistory(id,limit=15){return sbQuery(async sb=>{const{data,error}=await sb.from('aegis_wallet_ledger').select('action,amount,balance_wallet_after,note,actor_tag,created_at').eq('discord_id',id).order('created_at',{ascending:false}).limit(limit);if(error)throw new Error(error.message);return data||[];});}
async function getLeaderboard(limit=10){return sbQuery(async sb=>{const{data}=await sb.from('aegis_wallets').select('discord_id,discord_tag,wallet_balance,bank_balance,lifetime_earned').order('wallet_balance',{ascending:false}).limit(limit);return data||[];});}
async function getSupply(){return sbQuery(async sb=>{const{data}=await sb.from('aegis_wallets').select('wallet_balance,bank_balance');if(!data?.length)return{walletTotal:0,bankTotal:0,holders:0};return{walletTotal:data.reduce((s,r)=>s+(r.wallet_balance||0),0),bankTotal:data.reduce((s,r)=>s+(r.bank_balance||0),0),holders:data.length};});}
async function claimWeekly(id,tag){return sbQuery(async sb=>{const{data:w}=await sb.from('aegis_wallets').select('*').eq('discord_id',id).single().catch(()=>({data:null}));if(!w){await getWallet(id,tag);return claimWeekly(id,tag);}const now=new Date(),last=w.last_daily_claim?new Date(w.last_daily_claim):null;const diff=last?(now-last)/(1000*60*60):999;if(diff<168){const next=new Date(last.getTime()+168*60*60*1000);throw new Error(`⏳ Already claimed. Next: <t:${Math.floor(next/1000)}:R>`);}const amount=3,streak=(w.daily_streak||0)+1;const{data,error}=await sb.from('aegis_wallets').update({wallet_balance:(w.wallet_balance||0)+amount,lifetime_earned:(w.lifetime_earned||0)+amount,last_daily_claim:now.toISOString(),daily_streak:streak,updated_at:now.toISOString()}).eq('discord_id',id).select().single();if(error)throw new Error(error.message);await logTx(id,tag,'daily_claim',amount,data.wallet_balance,`Week ${streak} claim`,'SYSTEM','AEGIS');return{data,amount,streak};});}

// ══════════════════════════════════════════════════════════════════
// WARN ENGINE
// ══════════════════════════════════════════════════════════════════
async function addWarn(guildId,targetId,targetTag,reason,actorId,actorTag){if(!sb)return null;try{const{data}=await sb.from('aegis_warns').insert({guild_id:guildId,discord_id:targetId,discord_tag:targetTag,reason,issued_by:actorId,issued_by_tag:actorTag,created_at:new Date().toISOString()}).select().single();return data;}catch(e){console.error('Warn insert:',e.message);return null;}}
async function getWarns(guildId,targetId){if(!sb)return[];try{const{data}=await sb.from('aegis_warns').select('*').eq('guild_id',guildId).eq('discord_id',targetId).order('created_at',{ascending:false});return data||[];}catch{return[];}}

// ══════════════════════════════════════════════════════════════════
// GIVEAWAY ENGINE
// ══════════════════════════════════════════════════════════════════
const activeGiveaways = new Map();
async function drawGiveaway(msgId,guildId,client){
  const gw=activeGiveaways.get(msgId);if(!gw)return;
  const entries=[...gw.entries];
  if(!entries.length){try{const ch=client.channels.cache.get(gw.channelId);const msg=await ch?.messages.fetch(msgId);if(msg)await msg.edit({embeds:[new EmbedBuilder().setColor(0xFF4500).setTitle('🎉 Giveaway Ended').setDescription(`**${gw.prize}**\n\nNo valid entries.`).setFooter(FT)],components:[]});}catch{}activeGiveaways.delete(msgId);return;}
  const winners=[];for(let w=0;w<Math.min(gw.winnersCount,entries.length);w++){const idx=Math.floor(Math.random()*entries.length);winners.push(entries.splice(idx,1)[0]);}
  const winMentions=winners.map(w=>`<@${w}>`).join(' ');
  try{const ch=client.channels.cache.get(gw.channelId);const msg=await ch?.messages.fetch(msgId);if(msg)await msg.edit({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('🎉 Giveaway Ended!').setDescription(`**${gw.prize}**\n\n🏆 **Winners:** ${winMentions}`).setFooter(FT)],components:[]});if(ch)await ch.send(`🎉 Giveaway over! ${winMentions} won **${gw.prize}**!`);}catch{}
  activeGiveaways.delete(msgId);
}

// ══════════════════════════════════════════════════════════════════
// SERVER MONITOR
// ══════════════════════════════════════════════════════════════════
const monitorState = new Map();
const MONITOR_SERVERS = [
  {id:'island',    name:'The Island',    nitradoId:18266152, emoji:'🌿', ip:'217.114.196.102',port:5390, pvp:false,patreon:false},
  {id:'volcano',   name:'Volcano',       nitradoId:18094678, emoji:'🌋', ip:'217.114.196.59', port:5050, pvp:false,patreon:false},
  {id:'extinction',name:'Extinction',    nitradoId:18106633, emoji:'🌑', ip:'31.214.196.102', port:6440, pvp:false,patreon:false},
  {id:'center',    name:'The Center',    nitradoId:18182839, emoji:'🏔️', ip:'31.214.163.71',  port:5120, pvp:false,patreon:false},
  {id:'lostcolony',name:'Lost Colony',   nitradoId:18307276, emoji:'🪐', ip:'217.114.196.104',port:5150, pvp:false,patreon:false},
  {id:'astraeos',  name:'Astraeos',      nitradoId:18393892, emoji:'✨', ip:'217.114.196.9',  port:5320, pvp:false,patreon:false},
  {id:'valguero',  name:'Valguero',      nitradoId:18509341, emoji:'🏞️', ip:'85.190.136.141', port:5090, pvp:false,patreon:false},
  {id:'scorched',  name:'Scorched Earth',nitradoId:18598049, emoji:'☀️', ip:'217.114.196.103',port:5240, pvp:false,patreon:false},
  {id:'aberration',name:'Aberration',    nitradoId:18655529, emoji:'⚔️', ip:'217.114.196.80', port:5540, pvp:true, patreon:false},
  {id:'amissa',    name:'Amissa',        nitradoId:18680162, emoji:'⭐', ip:'217.114.196.80', port:5180, pvp:false,patreon:true},
];
const EXISTING_STATUS_CHANNELS = {
  aberration:'1491714622959390830',amissa:'1491714743797416056',astraeos:'1491714926862008320',
  center:'1491715233847316590',extinction:'1491715612911861790',lostcolony:'1491715764678299670',
  scorched:'1491717247083876435',island:'1491715445659799692',valguero:'1491715929586008075',volcano:'1491716283857633290',
};
// ── PER-CHANNEL RENAME COOLDOWN MAP ──────────────────────────────────
const channelRenameCooldowns = new Map();
const RENAME_COOLDOWN_MS     = 12 * 60 * 1000; // 12 min per channel
const RENAME_QUEUE_DELAY_MS  = 1_500;           // 1.5s between each rename

async function safeRenameChannel(ch, newName) {
  if (!ch || ch.name === newName) return false;

  const now = Date.now();
  const lastRename = channelRenameCooldowns.get(ch.id) || 0;
  if (now - lastRename < RENAME_COOLDOWN_MS) return false;

  channelRenameCooldowns.set(ch.id, now);

  try {
    await ch.setName(newName);
    return true;
  } catch (e) {
    if (e.status === 429 || (e.message || '').includes('429')) {
      channelRenameCooldowns.set(ch.id, now + 15 * 60 * 1000);
      console.warn(`⚠️ 429 on channel rename — ${ch.name} backed off 15 min`);
    } else {
      console.error(`❌ Rename ${ch.name}:`, e.message);
    }
    return false;
  }
}
async function fetchNitradoServer(nitradoId){if(!process.env.NITRADO_API_KEY)return null;try{const res=await axios.get(`https://api.nitrado.net/services/${nitradoId}/gameservers`,{headers:{Authorization:`Bearer ${process.env.NITRADO_API_KEY}`},timeout:10000});const gs=res.data?.data?.gameserver;if(!gs)return null;return{status:gs.status==='started'?'online':'offline',players:gs.query?.player_current??0,maxPlayers:gs.query?.player_max??20};}catch{return null;}}
async function fetchServerStatuses(){if(!process.env.NITRADO_API_KEY)return MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20}));const results=[];await Promise.all(MONITOR_SERVERS.map(async srv=>{const data=srv.nitradoId?await fetchNitradoServer(srv.nitradoId):null;results.push({...srv,status:data?.status??'unknown',players:data?.players??0,maxPlayers:data?.maxPlayers??20});}));return results;}
function buildMonitorEmbed(servers){const online=servers.filter(s=>s.status==='online'),offline=servers.filter(s=>s.status!=='online'),total=online.reduce((sum,s)=>sum+s.players,0);const lines=[...online.map(s=>`🟢 **${s.emoji} ${s.name}**${s.pvp?' ⚔️':s.patreon?' ⭐':''} \`${s.players}/${s.maxPlayers}\``), ...offline.map(s=>`🔴 **${s.emoji} ${s.name}** · Offline`)].join('\n');return new EmbedBuilder().setTitle('⚔️ TheConclave — Live Cluster Monitor').setColor(total>0?0x35ED7E:0xFF4500).setDescription(lines||'No server data.').addFields({name:'🟢 Online',value:`${online.length}/${servers.length}`,inline:true},{name:'👥 Players',value:`${total}`,inline:true},{name:'⏰ Updated',value:`<t:${Math.floor(Date.now()/1000)}:R>`,inline:true}).setFooter({text:'TheConclave Dominion • Auto-refreshes every 5 min',iconURL:'https://theconclavedominion.com/conclave-badge.png'}).setTimestamp();}
async function updateExistingStatusChannels(guild, statuses) {
  for (const srv of statuses) {
    const chId = EXISTING_STATUS_CHANNELS[srv.id];
    if (!chId) continue;

    const ch = await guild.channels.fetch(chId).catch(() => null);
    if (!ch) continue;

    const newName = srv.status === 'online'
      ? `🟢${srv.pvp ? '⚔️' : srv.patreon ? '⭐' : ''}・${srv.name}-${srv.players}p`
      : `🔴・${srv.name}-offline`;

    const renamed = await safeRenameChannel(ch, newName);
    if (renamed) {
      // Space out renames so we don't burst Discord's API
      await new Promise(r => setTimeout(r, RENAME_QUEUE_DELAY_MS));
    }
  }
}
let _monitorTick = 0;

setInterval(async () => {
  _monitorTick++;

  if (!DISCORD_GUILD_ID) return;

  try {
    const g = await bot.guilds.fetch(DISCORD_GUILD_ID).catch(() => null);
    if (!g) return;

    const s = await fetchServerStatuses().catch(() =>
      MONITOR_SERVERS.map(srv => ({ ...srv, status: 'unknown', players: 0, maxPlayers: 20 }))
    );

    // Only rename status channels every other tick (10 min effective cadence)
    if (_monitorTick % 2 === 0) {
      await updateExistingStatusChannels(g, s);
    }

    // Always update monitor embeds
    for (const [gid, state] of monitorState) {
      if (!state.statusChannelId || !state.messageId) continue;

      try {
        const guild = await bot.guilds.fetch(gid).catch(() => null);
        if (!guild) continue;

        const ch = await guild.channels.fetch(state.statusChannelId).catch(() => null);
        if (!ch) continue;

        const embed = buildMonitorEmbed(s);
        const msg = await ch.messages.fetch(state.messageId).catch(() => null);

        if (msg) {
          await msg.edit({ embeds: [embed] });
        } else {
          const nm = await ch.send({ embeds: [embed] });
          state.messageId = nm.id;
        }
      } catch {}
    }
  } catch (e) {
    console.error('❌ Monitor tick:', e.message);
  }
}, 5 * 60_000);
// ══════════════════════════════════════════════════════════════════
// MUSIC NEXUS SYNC
// ══════════════════════════════════════════════════════════════════
async function syncMusicState(guildId) {
  if (!musicRuntime) return;
  try {
    const state = musicRuntime.getState(guildId);
    if (!state?.current) return;
    await axios.post(`${MUSIC_API}/api/music/session`, {
      guild_id:    guildId,
      now_playing: state.current,
      queue_count: state.queue.length,
      mood:        state.mood || null,
      volume:      state.volume,
      loop:        state.loop,
      shuffle:     state.shuffle,
      autoplay:    state.autoplay,
      updated_at:  new Date().toISOString(),
    }, { timeout: 5000 });
  } catch {}
}
setInterval(()=>{ for(const[gid]of(musicRuntime?new Map([[DISCORD_GUILD_ID,1]]):new Map()))syncMusicState(gid); },15_000);

// ══════════════════════════════════════════════════════════════════
// EMBED HELPERS
// ══════════════════════════════════════════════════════════════════
const C={gold:0xFFB800,pl:0x7B2FFF,cy:0x00D4FF,gr:0x35ED7E,rd:0xFF4500,pk:0xFF4CD2};
const FT={text:'TheConclave Dominion • 5× Crossplay • 10 Maps',iconURL:'https://theconclavedominion.com/conclave-badge.png'};
const base=(title,color=C.pl)=>new EmbedBuilder().setTitle(title).setColor(color).setFooter(FT).setTimestamp();
const TX_ICO={deposit:'🏦',withdraw:'💸',transfer_out:'➡️',transfer_in:'⬅️',grant:'🎁',deduct:'⬇️',daily_claim:'🌟',admin_set:'🔧'};

function walletEmbed(title,w,color=C.pl){
  const total=(w.wallet_balance||0)+(w.bank_balance||0);
  return base(title,color).setDescription(`**${w.discord_tag||w.discord_id}**`).addFields(
    {name:'💎 Wallet',value:`**${(w.wallet_balance||0).toLocaleString()}**`,inline:true},
    {name:'🏦 Bank',  value:`**${(w.bank_balance||0).toLocaleString()}**`,  inline:true},
    {name:'📊 Total', value:`**${total.toLocaleString()}**`,                  inline:true},
    {name:'📈 Earned',value:`${(w.lifetime_earned||0).toLocaleString()}`,     inline:true},
    {name:'📉 Spent', value:`${(w.lifetime_spent||0).toLocaleString()}`,      inline:true},
  );
}

// ══//////////////////////════════════════════════════════════════════════════════════════
// SHOP TIER DATA
// ══════════════════════════════════════════════════════════════════
const SHOP_TIERS = [
  {shards:1,  emoji:'💠',name:'1 Clave Shard',   items:['Level 600 Vanilla Dino (Tameable)','Max XP','3 Stacks Ammo','Full Dino Coloring','100 Kibble / Cakes / Beer','100% Imprint','500 Non-Tek Structures','Cryofridge + 120 Pods','50,000 Echo Coins','2,500 Materials','10 Same-Type Tributes','Boss Artifact + Tribute (1 Run)','Non-Tek Blueprint','Dino Revival Token (48hr limit)']},
  {shards:2,  emoji:'💎',name:'2 Clave Shards',  items:['Modded Level 600 Dino','60 Dedicated Storage','450 Random Shiny Shoulder Pet Variant']},
  {shards:3,  emoji:'✨',name:'3 Clave Shards',  items:['Tek Blueprint','1 Shiny Essence','200% Imprint','450 T1 Special Shiny']},
  {shards:5,  emoji:'🔥',name:'5 Clave Shards',  items:['Boss Defeat Command','Bronto or Dread + Saddle','Astral Dino','Level 1000 Basilisk','Level 1000 Rock Elemental','Level 1000 Karkinos','50 Raw Shiny Essence','450 T2 Special Shiny','Small Resource Bundle','2,500 Imprint Kibble']},
  {shards:6,  emoji:'⚔️',name:'6 Clave Shards',  items:['Boss Ready Dino Bundle','300% Imprint','Max XP']},
  {shards:8,  emoji:'🌌',name:'8 Clave Shards',  items:['Medium Resource Bundle','100,000 Resources (No Element)']},
  {shards:10, emoji:'🛡️',name:'10 Clave Shards', items:['Tek Suit Blueprint/Set','Floating Platform','Combo Shinies','Dino Color Party','Breeding Pair']},
  {shards:12, emoji:'🌠',name:'12 Clave Shards', items:['Large Resource Bundle','200,000 Resources']},
  {shards:15, emoji:'👑',name:'15 Clave Shards', items:['30,000 Element','Level 900 Rhyniognatha','Reaper','Aureliax','XLarge Bundle (300k Resources)']},
  {shards:20, emoji:'🏰',name:'20 Clave Shards', items:['1x1 Behemoth Gate Expansion (10/max)']},
  {shards:30, emoji:'💰',name:'30 Clave Shards', items:['2 Dedicated Storage Admin Refill','1.6 Million Total Resources']},
  {shards:0,  emoji:'🛡',name:'Dino Insurance',  items:['One Time Use','Must Be Named','Backup May Not Save','May Require Respawn','One Time Per Dino']},
];

// ══════════════════════════════════════════════════════════════════
// MAP DATA
// ══════════════════════════════════════════════════════════════════
const MAP_INFO = {
  island:     {name:'The Island',     ip:'217.114.196.102:5390',emoji:'🌿',desc:'Classic starter map. Lush biomes, all original boss arenas.',pvp:false,patreon:false},
  volcano:    {name:'Volcano',        ip:'217.114.196.59:5050', emoji:'🌋',desc:'Dramatic volcanic biomes with rich resources.',pvp:false,patreon:false},
  extinction: {name:'Extinction',     ip:'31.214.196.102:6440', emoji:'🌑',desc:'Post-apocalyptic Earth. Titans, OSD drops, Element farming.',pvp:false,patreon:false},
  center:     {name:'The Center',     ip:'31.214.163.71:5120',  emoji:'🏔️',desc:'Floating islands, underground ocean, great endgame bases.',pvp:false,patreon:false},
  lostcolony: {name:'Lost Colony',    ip:'217.114.196.104:5150',emoji:'🪐',desc:'Space-themed ascended map with unique creatures.',pvp:false,patreon:false},
  astraeos:   {name:'Astraeos',       ip:'217.114.196.9:5320',  emoji:'✨',desc:'Custom Ascended map blending multiple terrains and rare creatures.',pvp:false,patreon:false},
  valguero:   {name:'Valguero',       ip:'85.190.136.141:5090', emoji:'🏞️',desc:'Rolling meadows, the Great Trench, and Deinonychus nesting.',pvp:false,patreon:false},
  scorched:   {name:'Scorched Earth', ip:'217.114.196.103:5240',emoji:'☀️',desc:'Desert survival: Wyverns, Rock Elementals, Manticore boss.',pvp:false,patreon:false},
  aberration: {name:'Aberration',     ip:'217.114.196.80:5540', emoji:'⚔️',desc:'Underground PvP — Rock Drakes, Reapers, Nameless. Bring your best.',pvp:true, patreon:false},
  amissa:     {name:'Amissa',         ip:'217.114.196.80:5180', emoji:'⭐',desc:'Patreon-exclusive map for Elite tier patrons. Premium server.',pvp:false,patreon:true},
};

// ══════════════════════════════════════════════════════════════════
// SLASH COMMAND DEFINITIONS
// ══════════════════════════════════════════════════════════════════
function addWalletSubs(b){
  return b
    .addSubcommand(s=>s.setName('balance').setDescription('💎 Check wallet').addUserOption(o=>o.setName('user').setDescription('Member (blank = you)').setRequired(false)))
    .addSubcommand(s=>s.setName('deposit').setDescription('🏦 Wallet → Bank').addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('withdraw').setDescription('💸 Bank → Wallet').addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('transfer').setDescription('➡️ Send shards').addUserOption(o=>o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('note').setDescription('Message').setRequired(false)))
    .addSubcommand(s=>s.setName('history').setDescription('🧾 Transaction log').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(false)).addIntegerOption(o=>o.setName('count').setDescription('Entries (max 25)').setRequired(false).setMinValue(1).setMaxValue(25)))
    .addSubcommand(s=>s.setName('leaderboard').setDescription('🏆 Top holders'))
    .addSubcommand(s=>s.setName('supply').setDescription('📊 Economy supply'))
    .addSubcommand(s=>s.setName('grant').setDescription('🎁 [ADMIN] Grant shards').addUserOption(o=>o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s=>s.setName('deduct').setDescription('⬇️ [ADMIN] Deduct shards').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)));
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
}

const ALL_COMMANDS = [
  // Economy
  addWalletSubs(new SlashCommandBuilder().setName('wallet').setDescription('💎 ClaveShard wallet')),
  addWalletSubs(new SlashCommandBuilder().setName('curr').setDescription('💎 ClaveShard wallet (alias)')),
<<<<<<< HEAD
  new SlashCommandBuilder().setName('weekly').setDescription('🌟 Claim weekly ClaveShards (3/week)'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Top 10 ClaveShard holders'),
  new SlashCommandBuilder().setName('give').setDescription('🎁 [ADMIN] Quick grant shards').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o => o.setName('user').setDescription('Player').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Shards').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('clvsd').setDescription('💠 Admin economy tools').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s.setName('grant').setDescription('🎁 Grant').addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('deduct').setDescription('⬇️ Deduct').addUserOption(o => o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('check').setDescription('🔍 Check wallet').addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s => s.setName('set').setDescription('🔧 Set balance').addUserOption(o => o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('New balance').setRequired(true).setMinValue(0)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Top 15 holders'))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Economy stats'))
    .addSubcommand(s => s.setName('usage').setDescription('🧠 AI usage stats'))
    .addSubcommand(s => s.setName('bulk-grant').setDescription('🎁 Grant shards to multiple users (mention up to 5)').addIntegerOption(o => o.setName('amount').setDescription('Shards each').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)).addUserOption(o => o.setName('user1').setDescription('User 1').setRequired(true)).addUserOption(o => o.setName('user2').setDescription('User 2').setRequired(false)).addUserOption(o => o.setName('user3').setDescription('User 3').setRequired(false)).addUserOption(o => o.setName('user4').setDescription('User 4').setRequired(false)).addUserOption(o => o.setName('user5').setDescription('User 5').setRequired(false)))
    .addSubcommand(s => s.setName('audit').setDescription('📋 View recent economy actions').addIntegerOption(o => o.setName('limit').setDescription('Entries (max 20)').setRequired(false).setMinValue(1).setMaxValue(20))),
  // Shop
  new SlashCommandBuilder().setName('order').setDescription('📦 Submit ClaveShard shop order')
    .addIntegerOption(o => o.setName('tier').setDescription('Tier shards').setRequired(true).setMinValue(1).setMaxValue(30))
    .addStringOption(o => o.setName('platform').setDescription('Platform').setRequired(true).addChoices({ name: 'Xbox', value: 'Xbox' }, { name: 'PlayStation', value: 'PlayStation' }, { name: 'PC', value: 'PC' }))
    .addStringOption(o => o.setName('server').setDescription('Which server?').setRequired(true))
    .addStringOption(o => o.setName('notes').setDescription('Special requests or dino name').setRequired(false))
    .addBooleanOption(o => o.setName('auto-deduct').setDescription('Auto-deduct shards from wallet?').setRequired(false)),
  new SlashCommandBuilder().setName('fulfill').setDescription('✅ [ADMIN] Mark order fulfilled').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('ref').setDescription('Order reference').setRequired(true))
    .addStringOption(o => o.setName('note').setDescription('Note to player').setRequired(false)),
  new SlashCommandBuilder().setName('shard').setDescription('💠 View complete ClaveShard tier list'),
  new SlashCommandBuilder().setName('shop').setDescription('🛍️ Browse ClaveShard catalog'),
  // AI
  new SlashCommandBuilder().setName('aegis').setDescription('🧠 Ask AEGIS AI').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('ask').setDescription('🧠 Ask AEGIS anything').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('forget').setDescription('🧹 Clear your AEGIS conversation history'),
  new SlashCommandBuilder().setName('ai-cost').setDescription('💸 [ADMIN] AI usage dashboard').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('aegis-persona').setDescription('🎭 [ADMIN] Set AEGIS persona for this channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('style').setDescription('Persona style').setRequired(true).addChoices(
      { name: '🌌 Sovereign (default)', value: 'sovereign' },
      { name: '⚔️ Combat Tactical', value: 'combat' },
      { name: '🛍️ Shop Assistant', value: 'shop' },
      { name: '📜 Lore Keeper', value: 'lore' },
      { name: '🤝 Friendly Helper', value: 'friendly' },
      { name: '❌ Reset to Default', value: 'reset' },
    ))
    .addStringOption(o => o.setName('note').setDescription('Extra persona context (optional)').setRequired(false)),
  new SlashCommandBuilder().setName('summarize').setDescription('📝 [ADMIN] AEGIS summarizes recent chat').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('count').setDescription('Messages to analyze (max 50)').setRequired(false).setMinValue(5).setMaxValue(50)),
  // Servers
  new SlashCommandBuilder().setName('servers').setDescription('🗺️ Live ARK cluster status').addStringOption(o => o.setName('map').setDescription('Filter by map').setRequired(false)),
  new SlashCommandBuilder().setName('map').setDescription('🗺️ Detailed info for a specific map').addStringOption(o => o.setName('name').setDescription('Map').setRequired(true).addChoices({ name: 'The Island', value: 'island' }, { name: 'Volcano', value: 'volcano' }, { name: 'Extinction', value: 'extinction' }, { name: 'The Center', value: 'center' }, { name: 'Lost Colony', value: 'lostcolony' }, { name: 'Astraeos', value: 'astraeos' }, { name: 'Valguero', value: 'valguero' }, { name: 'Scorched Earth', value: 'scorched' }, { name: 'Aberration (PvP)', value: 'aberration' }, { name: 'Amissa (Patreon)', value: 'amissa' })),
  new SlashCommandBuilder().setName('monitor').setDescription('📡 [ADMIN] Post live server status monitor').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addChannelOption(o => o.setName('channel').setDescription('Channel to post in').setRequired(true)),
=======
  new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Top 10 ClaveShard holders'),
  new SlashCommandBuilder().setName('give').setDescription('🎁 [ADMIN] Quick grant shards').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o=>o.setName('user').setDescription('Player').setRequired(true))
    .addIntegerOption(o=>o.setName('amount').setDescription('Shards').setRequired(true).setMinValue(1))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('clvsd').setDescription('💠 Admin economy tools').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s=>s.setName('grant').setDescription('🎁 Grant').addUserOption(o=>o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s=>s.setName('deduct').setDescription('⬇️ Deduct').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s=>s.setName('check').setDescription('🔍 Check wallet').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s=>s.setName('set').setDescription('🔧 Set balance').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('New balance').setRequired(true).setMinValue(0)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s=>s.setName('top').setDescription('🏆 Top 15 holders'))
    .addSubcommand(s=>s.setName('stats').setDescription('📊 Economy stats'))
    .addSubcommand(s=>s.setName('usage').setDescription('🧠 AI usage stats')),
  // Shop
  new SlashCommandBuilder().setName('order').setDescription('📦 Submit ClaveShard shop order')
    .addIntegerOption(o=>o.setName('tier').setDescription('Tier shards').setRequired(true).setMinValue(1).setMaxValue(30))
    .addStringOption(o=>o.setName('platform').setDescription('Platform').setRequired(true).addChoices({name:'Xbox',value:'Xbox'},{name:'PlayStation',value:'PlayStation'},{name:'PC',value:'PC'}))
    .addStringOption(o=>o.setName('server').setDescription('Which server?').setRequired(true))
    .addStringOption(o=>o.setName('notes').setDescription('Special requests or dino name').setRequired(false)),
  new SlashCommandBuilder().setName('fulfill').setDescription('✅ [ADMIN] Mark order fulfilled').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('ref').setDescription('Order reference').setRequired(true))
    .addStringOption(o=>o.setName('note').setDescription('Note to player').setRequired(false)),
  new SlashCommandBuilder().setName('shard').setDescription('💠 View complete ClaveShard tier list'),
  new SlashCommandBuilder().setName('shop').setDescription('🛍️ Browse ClaveShard catalog'),
  // AI
  new SlashCommandBuilder().setName('aegis').setDescription('🧠 Ask AEGIS AI').addStringOption(o=>o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('ask').setDescription('🧠 Ask AEGIS anything').addStringOption(o=>o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('forget').setDescription('🧹 Clear your AEGIS conversation history'),
  new SlashCommandBuilder().setName('ai-cost').setDescription('💸 [ADMIN] AI usage dashboard').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  // Servers
  new SlashCommandBuilder().setName('servers').setDescription('🗺️ Live ARK cluster status').addStringOption(o=>o.setName('map').setDescription('Filter by map').setRequired(false)),
  new SlashCommandBuilder().setName('map').setDescription('🗺️ Detailed info for a specific map').addStringOption(o=>o.setName('name').setDescription('Map').setRequired(true).addChoices({name:'The Island',value:'island'},{name:'Volcano',value:'volcano'},{name:'Extinction',value:'extinction'},{name:'The Center',value:'center'},{name:'Lost Colony',value:'lostcolony'},{name:'Astraeos',value:'astraeos'},{name:'Valguero',value:'valguero'},{name:'Scorched Earth',value:'scorched'},{name:'Aberration (PvP)',value:'aberration'},{name:'Amissa (Patreon)',value:'amissa'})),
  new SlashCommandBuilder().setName('monitor').setDescription('📡 [ADMIN] Post live server status monitor').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addChannelOption(o=>o.setName('channel').setDescription('Channel to post in').setRequired(true)),
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
  // Info
  new SlashCommandBuilder().setName('info').setDescription('ℹ️ Server info and getting-started guide'),
  new SlashCommandBuilder().setName('rules').setDescription('📜 Dominion Codex rules'),
  new SlashCommandBuilder().setName('rates').setDescription('📈 All 5× boost rates'),
  new SlashCommandBuilder().setName('mods').setDescription('🔧 Active cluster mods'),
<<<<<<< HEAD
  new SlashCommandBuilder().setName('wipe').setDescription('📅 Wipe schedule and countdown'),
  new SlashCommandBuilder().setName('set-wipe').setDescription('📅 [ADMIN] Set wipe date').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('date').setDescription('Date (e.g. 2025-08-01)').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason / context').setRequired(false)),
=======
  new SlashCommandBuilder().setName('wipe').setDescription('📅 Wipe schedule'),
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
  new SlashCommandBuilder().setName('transfer-guide').setDescription('🔄 Cross-ARK transfer guide'),
  new SlashCommandBuilder().setName('crossplay').setDescription('🎮 Crossplay connection guide'),
  new SlashCommandBuilder().setName('patreon').setDescription('⭐ Patreon perks and Amissa access'),
  new SlashCommandBuilder().setName('tip').setDescription('💡 Random ARK survival tip'),
<<<<<<< HEAD
  new SlashCommandBuilder().setName('dino').setDescription('🦕 ARK dino lookup').addStringOption(o => o.setName('name').setDescription('Dino name').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('📖 Full command reference'),
  new SlashCommandBuilder().setName('ping').setDescription('🏓 Bot latency and status'),
  // Community
  new SlashCommandBuilder().setName('profile').setDescription('🎖️ View Dominion profile').addUserOption(o => o.setName('user').setDescription('Member').setRequired(false)),
  new SlashCommandBuilder().setName('rank').setDescription('📊 Your ClaveShard rank'),
  new SlashCommandBuilder().setName('rep').setDescription('⭐ Give reputation to a member').addUserOption(o => o.setName('user').setDescription('Who to rep').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Why?').setRequired(false)),
  new SlashCommandBuilder().setName('trade').setDescription('🤝 Post a trade request').addStringOption(o => o.setName('offering').setDescription('What you offer').setRequired(true)).addStringOption(o => o.setName('looking-for').setDescription('What you want').setRequired(true)).addStringOption(o => o.setName('server').setDescription('Which server').setRequired(false)),
  new SlashCommandBuilder().setName('clipscore').setDescription('🎬 Submit a clip for Clip of the Week').addStringOption(o => o.setName('url').setDescription('Link to clip').setRequired(true)).addStringOption(o => o.setName('description').setDescription('Description').setRequired(false)),
  new SlashCommandBuilder().setName('coords').setDescription('📍 Share in-game coordinates').addStringOption(o => o.setName('location').setDescription('Location or coords').setRequired(true)).addStringOption(o => o.setName('map').setDescription('Which map').setRequired(false)),
  new SlashCommandBuilder().setName('whois').setDescription('🔍 Look up a Discord member').addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('🏠 Server statistics'),
  new SlashCommandBuilder().setName('report').setDescription('🚨 Report a player or issue').addStringOption(o => o.setName('issue').setDescription('Describe the issue').setRequired(true)).addStringOption(o => o.setName('player').setDescription('Player involved (if any)').setRequired(false)),
  // Tribe registry
  new SlashCommandBuilder().setName('tribe').setDescription('🏕️ Tribe registry')
    .addSubcommand(s => s.setName('register').setDescription('📝 Register your tribe').addStringOption(o => o.setName('name').setDescription('Tribe name').setRequired(true)).addStringOption(o => o.setName('server').setDescription('Primary server').setRequired(true)).addStringOption(o => o.setName('members').setDescription('Member Discord IDs or names (comma-separated)').setRequired(false)))
    .addSubcommand(s => s.setName('lookup').setDescription('🔍 Look up a tribe').addStringOption(o => o.setName('query').setDescription('Tribe name or owner').setRequired(true)))
    .addSubcommand(s => s.setName('my').setDescription('📋 View your registered tribe')),
  // Admin/Events
  new SlashCommandBuilder().setName('announce').setDescription('📢 [ADMIN] Send formatted announcement').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('title').setDescription('Title').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Body').setRequired(true))
    .addBooleanOption(o => o.setName('ping').setDescription('Ping @everyone?').setRequired(false)),
  new SlashCommandBuilder().setName('event').setDescription('📅 [ADMIN] Create event announcement').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Details').setRequired(true))
    .addStringOption(o => o.setName('date').setDescription('Date & time').setRequired(false))
    .addBooleanOption(o => o.setName('ping').setDescription('Ping @everyone?').setRequired(false)),
  new SlashCommandBuilder().setName('giveaway').setDescription('🎉 [ADMIN] Start a giveaway').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
    .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(false).setMinValue(1).setMaxValue(10))
    .addIntegerOption(o => o.setName('shard-entry').setDescription('Shards required to enter (0 = free)').setRequired(false).setMinValue(0)),
  new SlashCommandBuilder().setName('endgiveaway').setDescription('🎉 [ADMIN] End giveaway early').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('messageid').setDescription('Message ID of giveaway').setRequired(true)),
  new SlashCommandBuilder().setName('vote').setDescription('🗳️ [ADMIN] Create a community vote').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('question').setDescription('Vote question').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Options separated by | (2-4 options)').setRequired(true))
    .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(false).setMinValue(1).setMaxValue(1440)),
  // Moderation
  new SlashCommandBuilder().setName('warn').setDescription('⚠️ [MOD] Issue formal warning').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('warn-history').setDescription('📋 [MOD] View member warnings').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('warn-clear').setDescription('🧹 [MOD] Clear all warnings for a user').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('ban').setDescription('🔨 [MOD] Ban a member').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('timeout').setDescription('⏰ [MOD] Timeout a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration').setRequired(true).addChoices({ name: '5 min', value: '5m' }, { name: '1 hour', value: '1h' }, { name: '6 hours', value: '6h' }, { name: '24 hours', value: '24h' }, { name: '7 days', value: '7d' }))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('role').setDescription('🎭 [ADMIN] Add/remove role').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
    .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })),
  new SlashCommandBuilder().setName('ticket').setDescription('🎫 [ADMIN] Post support ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('purge').setDescription('🗑️ [ADMIN] Delete messages in bulk').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('count').setDescription('Number of messages (max 100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('Only purge from this user').setRequired(false)),
  new SlashCommandBuilder().setName('slowmode').setDescription('🐌 [ADMIN] Set channel slowmode').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('seconds').setDescription('Seconds (0=disable)').setRequired(true).setMinValue(0).setMaxValue(21600)),
  new SlashCommandBuilder().setName('lock').setDescription('🔒 [ADMIN] Lock/unlock channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Lock', value: 'lock' }, { name: 'Unlock', value: 'unlock' }))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  // Knowledge
  new SlashCommandBuilder().setName('know').setDescription('📚 [ADMIN] Manage AEGIS knowledge base').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s.setName('add').setDescription('➕ Add entry').addStringOption(o => o.setName('category').setDescription('Category').setRequired(true)).addStringOption(o => o.setName('title').setDescription('Title').setRequired(true)).addStringOption(o => o.setName('content').setDescription('Content').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('📋 List entries').addStringOption(o => o.setName('category').setDescription('Filter by category').setRequired(false)))
    .addSubcommand(s => s.setName('delete').setDescription('🗑️ Delete entry').addStringOption(o => o.setName('key').setDescription('Entry key').setRequired(true))),
  // Utils
  new SlashCommandBuilder().setName('roll').setDescription('🎲 Roll dice').addStringOption(o => o.setName('dice').setDescription('Notation (2d6, d20)').setRequired(false)),
  new SlashCommandBuilder().setName('coinflip').setDescription('🪙 Flip a coin'),
  new SlashCommandBuilder().setName('calc').setDescription('🔢 Calculate expression').addStringOption(o => o.setName('expression').setDescription('Math expression').setRequired(true)),
  new SlashCommandBuilder().setName('remind').setDescription('⏰ Set a reminder').addStringOption(o => o.setName('message').setDescription('What to remind you').setRequired(true)).addStringOption(o => o.setName('time').setDescription('When (30m, 2h, 1d)').setRequired(true)),
  new SlashCommandBuilder().setName('poll').setDescription('📊 [ADMIN] Create a poll').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('question').setDescription('Question').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Options separated by |').setRequired(true)),
];

// ══════════════════════════════════════════════════════════════════════
// COMMAND REGISTRATION
// ══════════════════════════════════════════════════════════════════════
async function registerCommands() {
  if (!DISCORD_CLIENT_ID) { console.warn('⚠️ DISCORD_CLIENT_ID missing — skipping registration'); return; }
  const rest = new REST().setToken(DISCORD_BOT_TOKEN);
  try {
    const allJson = ALL_COMMANDS.map(c => c.toJSON());
    console.log(`📡 Registering ${allJson.length} slash commands...`);
    if (DISCORD_GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body: allJson });
      console.log(`✅ Guild commands registered (${allJson.length})`);
    } else {
      await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: allJson });
      console.log(`✅ Global commands registered (${allJson.length})`);
    }
  } catch (e) { console.error('❌ Registration failed:', e.message); }
}

// ══════════════════════════════════════════════════════════════════════
// INTERACTION HANDLER
// ══════════════════════════════════════════════════════════════════════
bot.on(Events.InteractionCreate, async interaction => {

  // ── GIVEAWAY BUTTON ──
  if (interaction.isButton() && interaction.customId === 'giveaway_enter') {
    const gw = activeGiveaways.get(interaction.message.id);
    if (!gw) return interaction.reply({ content: '⚠️ Giveaway no longer active.', ephemeral: true });
    if (Date.now() > gw.endTime) return interaction.reply({ content: '⏰ Giveaway has ended.', ephemeral: true });
    if (gw.entries.has(interaction.user.id)) return interaction.reply({ content: '✅ Already entered!', ephemeral: true });

    // Shard-entry cost
    if (gw.shardCost > 0) {
      try {
        await deductShards(interaction.user.id, interaction.user.username, gw.shardCost, `Giveaway entry: ${gw.prize}`, 'SYSTEM', 'AEGIS');
      } catch (e) {
        return interaction.reply({ content: `⚠️ Entry requires **${gw.shardCost} 💎** in your wallet. ${e.message}`, ephemeral: true });
      }
    }
    gw.entries.add(interaction.user.id);
    return interaction.reply({ content: `🎉 You entered the **${gw.prize}** giveaway!${gw.shardCost > 0 ? ` (−${gw.shardCost} 💎)` : ''} Good luck!`, ephemeral: true });
  }

  // ── VOTE BUTTONS ──
  if (interaction.isButton() && interaction.customId?.startsWith('vote_')) {
    const [, msgId, optIdx] = interaction.customId.split('_');
    const vote = activeVotes.get(msgId);
    if (!vote) return interaction.reply({ content: '⚠️ Vote expired.', ephemeral: true });
    if (Date.now() > vote.ends) return interaction.reply({ content: '⏰ Vote has ended.', ephemeral: true });

    // Remove old vote from any option
    for (const [, voters] of vote.votes) voters.delete(interaction.user.id);
    if (!vote.votes.has(parseInt(optIdx))) vote.votes.set(parseInt(optIdx), new Set());
    vote.votes.get(parseInt(optIdx)).add(interaction.user.id);

    const totalVotes = [...vote.votes.values()].reduce((s, v) => s + v.size, 0);
    const resultLines = vote.options.map((o, i) => {
      const count = vote.votes.get(i)?.size || 0;
      const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
      const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      return `**${i + 1}.** ${o}\n\`${bar}\` **${pct}%** (${count} votes)`;
    }).join('\n\n');

    try {
      const msg = await interaction.message.fetch();
      await msg.edit({ embeds: [base(`🗳️ ${vote.question}`, C.cy).setDescription(resultLines + `\n\n> Total votes: **${totalVotes}** · Ends <t:${Math.floor(vote.ends / 1000)}:R>`)] });
    } catch {}
    return interaction.reply({ content: `✅ Voted for **${vote.options[parseInt(optIdx)]}**!`, ephemeral: true });
  }

  // ── TICKET BUTTONS ──
  if (interaction.isButton() && interaction.customId === 'ticket_open') {
    await interaction.deferReply({ ephemeral: true });
    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const existing = interaction.guild.channels.cache.find(c => c.name === `ticket-${safeName}`);
    if (existing) return interaction.editReply(`⚠️ You already have an open ticket: ${existing}`);
    try {
      const ch = await interaction.guild.channels.create({
        name: `ticket-${safeName}`, type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: interaction.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
          ...(ROLE_ADMIN_ID ? [{ id: ROLE_ADMIN_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
          ...(ROLE_HELPER_ID ? [{ id: ROLE_HELPER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
        ],
      });
      await ch.send({
        embeds: [base('🎫 Support Ticket', C.cy).setDescription(`Hello ${interaction.user}! A staff member will assist you shortly.\n\nDescribe your issue in detail.`).setFooter(FT)],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger))],
      });
      return interaction.editReply({ content: `✅ Ticket created: ${ch}` });
    } catch (e) { return interaction.editReply(`⚠️ Error: ${e.message}`); }
  }
  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    if (!isMod(interaction.member)) return interaction.reply({ content: '⛔ Staff only.', ephemeral: true });
    await interaction.reply('🔒 Closing ticket in 5 seconds...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
=======
  new SlashCommandBuilder().setName('dino').setDescription('🦕 ARK dino lookup').addStringOption(o=>o.setName('name').setDescription('Dino name').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('📖 Full command reference'),
  new SlashCommandBuilder().setName('ping').setDescription('🏓 Bot latency and status'),
  // Community
  new SlashCommandBuilder().setName('profile').setDescription('🎖️ View Dominion profile').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(false)),
  new SlashCommandBuilder().setName('rank').setDescription('📊 Your ClaveShard rank'),
  new SlashCommandBuilder().setName('rep').setDescription('⭐ Give reputation to a member').addUserOption(o=>o.setName('user').setDescription('Who to rep').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Why?').setRequired(false)),
  new SlashCommandBuilder().setName('trade').setDescription('🤝 Post a trade request').addStringOption(o=>o.setName('offering').setDescription('What you offer').setRequired(true)).addStringOption(o=>o.setName('looking-for').setDescription('What you want').setRequired(true)).addStringOption(o=>o.setName('server').setDescription('Which server').setRequired(false)),
  new SlashCommandBuilder().setName('online').setDescription('👥 Who is online across the cluster'),
  new SlashCommandBuilder().setName('clipscore').setDescription('🎬 Submit a clip for Clip of the Week').addStringOption(o=>o.setName('url').setDescription('Link to clip').setRequired(true)).addStringOption(o=>o.setName('description').setDescription('Description').setRequired(false)),
  new SlashCommandBuilder().setName('coords').setDescription('📍 Share in-game coordinates').addStringOption(o=>o.setName('location').setDescription('Location or coords').setRequired(true)).addStringOption(o=>o.setName('map').setDescription('Which map').setRequired(false)),
  new SlashCommandBuilder().setName('whois').setDescription('🔍 Look up a Discord member').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('🏠 Server statistics'),
  new SlashCommandBuilder().setName('report').setDescription('🚨 Report a player or issue').addStringOption(o=>o.setName('issue').setDescription('Describe the issue').setRequired(true)).addStringOption(o=>o.setName('player').setDescription('Player involved (if any)').setRequired(false)),
  // Admin/Events
  new SlashCommandBuilder().setName('announce').setDescription('📢 [ADMIN] Send formatted announcement').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('title').setDescription('Title').setRequired(true))
    .addStringOption(o=>o.setName('message').setDescription('Body').setRequired(true))
    .addBooleanOption(o=>o.setName('ping').setDescription('Ping @everyone?').setRequired(false)),
  new SlashCommandBuilder().setName('event').setDescription('📅 [ADMIN] Create event announcement').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(o=>o.setName('description').setDescription('Details').setRequired(true))
    .addStringOption(o=>o.setName('date').setDescription('Date & time').setRequired(false))
    .addBooleanOption(o=>o.setName('ping').setDescription('Ping @everyone?').setRequired(false)),
  new SlashCommandBuilder().setName('giveaway').setDescription('🎉 [ADMIN] Start a giveaway').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('prize').setDescription('Prize').setRequired(true))
    .addIntegerOption(o=>o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addIntegerOption(o=>o.setName('winners').setDescription('Number of winners').setRequired(false).setMinValue(1).setMaxValue(10)),
  new SlashCommandBuilder().setName('endgiveaway').setDescription('🎉 [ADMIN] End giveaway early').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('messageid').setDescription('Message ID of giveaway').setRequired(true)),
  // Moderation
  new SlashCommandBuilder().setName('warn').setDescription('⚠️ [MOD] Issue formal warning').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('warn-history').setDescription('📋 [MOD] View member warnings').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('ban').setDescription('🔨 [MOD] Ban a member').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('timeout').setDescription('⏰ [MOD] Timeout a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o=>o.setName('duration').setDescription('Duration').setRequired(true).addChoices({name:'5 min',value:'5m'},{name:'1 hour',value:'1h'},{name:'6 hours',value:'6h'},{name:'24 hours',value:'24h'},{name:'7 days',value:'7d'}))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('role').setDescription('🎭 [ADMIN] Add/remove role').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))
    .addRoleOption(o=>o.setName('role').setDescription('Role').setRequired(true))
    .addStringOption(o=>o.setName('action').setDescription('Action').setRequired(true).addChoices({name:'Add',value:'add'},{name:'Remove',value:'remove'})),
  new SlashCommandBuilder().setName('ticket').setDescription('🎫 [ADMIN] Post support ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('purge').setDescription('🗑️ [ADMIN] Delete messages in bulk').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o=>o.setName('count').setDescription('Number of messages (max 100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o=>o.setName('user').setDescription('Only purge from this user').setRequired(false)),
  new SlashCommandBuilder().setName('slowmode').setDescription('🐌 [ADMIN] Set channel slowmode').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o=>o.setName('seconds').setDescription('Seconds (0=disable)').setRequired(true).setMinValue(0).setMaxValue(21600)),
  new SlashCommandBuilder().setName('lock').setDescription('🔒 [ADMIN] Lock/unlock channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o=>o.setName('action').setDescription('Action').setRequired(true).addChoices({name:'Lock',value:'lock'},{name:'Unlock',value:'unlock'}))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
  // Knowledge
  new SlashCommandBuilder().setName('know').setDescription('📚 [ADMIN] Manage AEGIS knowledge base').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s=>s.setName('add').setDescription('➕ Add entry').addStringOption(o=>o.setName('category').setDescription('Category').setRequired(true)).addStringOption(o=>o.setName('title').setDescription('Title').setRequired(true)).addStringOption(o=>o.setName('content').setDescription('Content').setRequired(true)))
    .addSubcommand(s=>s.setName('list').setDescription('📋 List entries').addStringOption(o=>o.setName('category').setDescription('Filter by category').setRequired(false)))
    .addSubcommand(s=>s.setName('delete').setDescription('🗑️ Delete entry').addStringOption(o=>o.setName('key').setDescription('Entry key').setRequired(true))),
  // Utils
  new SlashCommandBuilder().setName('roll').setDescription('🎲 Roll dice').addStringOption(o=>o.setName('dice').setDescription('Notation (2d6, d20)').setRequired(false)),
  new SlashCommandBuilder().setName('coinflip').setDescription('🪙 Flip a coin'),
  new SlashCommandBuilder().setName('calc').setDescription('🔢 Calculate expression').addStringOption(o=>o.setName('expression').setDescription('Math expression').setRequired(true)),
  new SlashCommandBuilder().setName('remind').setDescription('⏰ Set a reminder').addStringOption(o=>o.setName('message').setDescription('What to remind you').setRequired(true)).addStringOption(o=>o.setName('time').setDescription('When (30m, 2h, 1d)').setRequired(true)),
  new SlashCommandBuilder().setName('poll').setDescription('📊 [ADMIN] Create a poll').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('question').setDescription('Question').setRequired(true))
    .addStringOption(o=>o.setName('options').setDescription('Options separated by |').setRequired(true)),
];

// ══════════════════════════════════════════════════════════════════
// COMMAND REGISTRATION
// ══════════════════════════════════════════════════════════════════
async function registerCommands() {
  if (!DISCORD_CLIENT_ID) { console.warn('⚠️  DISCORD_CLIENT_ID missing — skipping registration'); return; }
  const rest = new REST().setToken(DISCORD_BOT_TOKEN);
  const musicCmds = musicRuntime?.MUSIC_COMMANDS || [];
  const allJson   = [...ALL_COMMANDS.map(c=>c.toJSON()), ...musicCmds];
  try {
    console.log(`📡 Registering ${allJson.length} slash commands...`);
    if (DISCORD_GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID,DISCORD_GUILD_ID),{body:allJson});
      console.log(`✅ Guild commands registered (${allJson.length})`);
    } else {
      await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID),{body:allJson});
      console.log(`✅ Global commands registered (${allJson.length})`);
    }
  } catch(e) { console.error('❌ Registration failed:',e.message); }
}
function isUnknownInteractionError(err) {
  const m = err?.message || String(err || '');
  return m.includes('Unknown interaction');
}

function isRateLimitError(err) {
  const m = err?.message || String(err || '');
  return m.includes('429') || m.includes('rate limit');
}
// ══════════════════════════════════════════════════════════════════
// SINGLE INTERACTION HANDLER
// ══════════════════════════════════════════════════════════════════
bot.on(Events.InteractionCreate, async interaction => {

  // ── MUSIC BUTTONS ──
  if (interaction.isButton() && musicRuntime?.isMusicButton(interaction.customId)) {
    return musicRuntime.handleMusicButton(interaction, bot);
  }
  // ── MUSIC SELECT ──
  if (interaction.isStringSelectMenu() && musicRuntime?.isMusicSelect(interaction.customId)) {
    return musicRuntime.handleMusicSelect(interaction, bot);
  }
  // ── GIVEAWAY BUTTON ──
  if (interaction.isButton() && interaction.customId === 'giveaway_enter') {
    const gw = activeGiveaways.get(interaction.message.id);
    if (!gw) return interaction.reply({content:'⚠️ Giveaway no longer active.',ephemeral:true});
    if (Date.now() > gw.endTime) return interaction.reply({content:'⏰ Giveaway has ended.',ephemeral:true});
    if (gw.entries.has(interaction.user.id)) return interaction.reply({content:'✅ Already entered!',ephemeral:true});
    gw.entries.add(interaction.user.id);
    return interaction.reply({content:`🎉 You entered the **${gw.prize}** giveaway! Good luck!`,ephemeral:true});
  }
  // ── TICKET BUTTON OPEN ──
  if (interaction.isButton() && interaction.customId === 'ticket_open') {
    await interaction.deferReply({ephemeral:true});
    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,20);
    const existing = interaction.guild.channels.cache.find(c=>c.name===`ticket-${safeName}`);
    if (existing) return interaction.editReply(`⚠️ You already have an open ticket: ${existing}`);
    try {
      const ch = await interaction.guild.channels.create({
        name:`ticket-${safeName}`, type:ChannelType.GuildText,
        permissionOverwrites:[
          {id:interaction.guild.roles.everyone, deny:[PermissionFlagsBits.ViewChannel]},
          {id:interaction.user.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
          {id:interaction.guild.members.me.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels]},
          ...(ROLE_ADMIN_ID?[{id:ROLE_ADMIN_ID,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]}]:[]),
          ...(ROLE_HELPER_ID?[{id:ROLE_HELPER_ID,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]}]:[]),
        ],
      });
      await ch.send({
        embeds:[base('🎫 Support Ticket',C.cy).setDescription(`Hello ${interaction.user}! A staff member will assist you shortly.\n\nDescribe your issue in detail.`).setFooter(FT)],
        components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger))],
      });
      return interaction.editReply({content:`✅ Ticket created: ${ch}`});
    } catch(e) { return interaction.editReply(`⚠️ Error: ${e.message}`); }
  }
  // ── TICKET CLOSE ──
  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    if (!isMod(interaction.member)) return interaction.reply({content:'⛔ Staff only.',ephemeral:true});
    await interaction.reply('🔒 Closing ticket in 5 seconds...');
    setTimeout(()=>interaction.channel.delete().catch(()=>{}),5000);
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const { commandName: cmd } = interaction;
<<<<<<< HEAD
  await interaction.deferReply();

  try {
    // ──────────────────────────────────────────────────────────────────
    // ECONOMY
    // ──────────────────────────────────────────────────────────────────
    if (cmd === 'wallet' || cmd === 'curr') {
      const sub = interaction.options.getSubcommand();
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount') || 0;
      const reason = interaction.options.getString('reason') || '';
      const note   = interaction.options.getString('note') || '';
      const count  = interaction.options.getInteger('count') || 15;
      const me = interaction.user;
      try {
        if (sub === 'balance')     { const who = target || me; const w = await getWallet(who.id, who.username); return interaction.editReply({ embeds: [P.WalletPanel(`💎 ${who.username}'s Wallet`, w)] }); }
        if (sub === 'deposit')     { const w = await depositToBank(me.id, me.username, amount); return interaction.editReply({ embeds: [walletEmbed(`🏦 Deposited ${amount} 💎`, w, C.gr)] }); }
        if (sub === 'withdraw')    { const w = await withdrawFromBank(me.id, me.username, amount); return interaction.editReply({ embeds: [walletEmbed(`💸 Withdrew ${amount} 💎`, w, C.cy)] }); }
        if (sub === 'transfer')    { if (!target) return interaction.editReply('⚠️ Specify a recipient.'); const r = await transferShards(me.id, me.username, target.id, target.username, amount); return interaction.editReply({ embeds: [base(`➡️ Transferred ${amount} 💎`, C.cy).setDescription(`Sent **${amount}** to **${target.username}**${note ? `\n📝 *"${note}"*` : ''}`).addFields({ name: 'Your wallet', value: `${r.sent.toLocaleString()} 💎`, inline: true }, { name: `${target.username}'s wallet`, value: `${r.received.toLocaleString()} 💎`, inline: true })] }); }
        if (sub === 'history')     { const who = target || me; if (target && target.id !== me.id && !isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only for other users.'); const rows = await getTxHistory(who.id, count); if (!rows.length) return interaction.editReply(`📭 No history for **${who.username}** yet.`); return interaction.editReply({ embeds: [P.HistoryPanel(who.username, rows)] }); }
        if (sub === 'leaderboard') { const rows = await getLeaderboard(10); return interaction.editReply({ embeds: [P.LeaderboardPanel(rows)] }); }
        if (sub === 'supply')      { const s = await getSupply(); return interaction.editReply({ embeds: [P.SupplyPanel(s)] }); }
        if (sub === 'grant')       { if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only.'); if (!target) return interaction.editReply('⚠️ Specify target.'); const w = await grantShards(target.id, target.username, amount, reason || 'Admin grant', me.id, me.username); try { await target.send({ embeds: [base('💎 ClaveShard Received!', C.gr).setDescription(`**${me.username}** granted you **${amount.toLocaleString()} 💎**\n📝 *${reason || 'Admin grant'}*`)] }); } catch {} return interaction.editReply({ embeds: [walletEmbed(`🎁 Granted ${amount} to ${target.username}`, w, C.gr)] }); }
        if (sub === 'deduct')      { if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only.'); if (!target) return interaction.editReply('⚠️ Specify target.'); const w = await deductShards(target.id, target.username, amount, reason || 'Admin deduct', me.id, me.username); return interaction.editReply({ embeds: [walletEmbed(`⬇️ Deducted ${amount} from ${target.username}`, w, C.rd)] }); }
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }

    if (cmd === 'weekly') {
      try { const r = await claimWeekly(interaction.user.id, interaction.user.username); return interaction.editReply({ embeds: [base('🌟 Weekly ClaveShard Claimed!', C.gold).setDescription(`**${interaction.user.username}** claimed their weekly reward!`).addFields({ name: '💎 Claimed', value: `**+${r.amount}**`, inline: true }, { name: '🔥 Streak', value: `Week ${r.streak}`, inline: true }, { name: '💰 Balance', value: `${(r.data.wallet_balance || 0).toLocaleString()}`, inline: true })] }); }
      catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }

    if (cmd === 'leaderboard') {
      try { const lb = await getLeaderboard(10); return interaction.editReply({ embeds: [P.LeaderboardPanel(lb)] }); }
      catch { return interaction.editReply({ embeds: [P.ErrorPanel('Leaderboard', 'Leaderboard temporarily unavailable.')] }); }
    }

    if (cmd === 'give') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      try { const target = interaction.options.getUser('user'), amount = interaction.options.getInteger('amount'), reason = interaction.options.getString('reason') || 'Admin grant'; const w = await grantShards(target.id, target.username, amount, reason, interaction.user.id, interaction.user.username); return interaction.editReply({ embeds: [walletEmbed(`🎁 Granted to ${target.username}`, w, C.gr).setDescription(`+**${amount}** 💎 · ${reason}`)] }); }
      catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }

    if (cmd === 'clvsd') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const sub = interaction.options.getSubcommand();
      const me = interaction.user;
      try {
        if (sub === 'grant')      { const t = interaction.options.getUser('user'), a = interaction.options.getInteger('amount'), r = interaction.options.getString('reason') || ''; const w = await grantShards(t.id, t.username, a, r, me.id, me.username); return interaction.editReply({ embeds: [walletEmbed(`🎁 +${a} → ${t.username}`, w, C.gr)] }); }
        if (sub === 'deduct')     { const t = interaction.options.getUser('user'), a = interaction.options.getInteger('amount'), r = interaction.options.getString('reason') || ''; const w = await deductShards(t.id, t.username, a, r, me.id, me.username); return interaction.editReply({ embeds: [walletEmbed(`⬇️ -${a} from ${t.username}`, w, C.rd)] }); }
        if (sub === 'check')      { const t = interaction.options.getUser('user'); const w = await getWallet(t.id, t.username); return interaction.editReply({ embeds: [walletEmbed(`🔍 ${t.username}'s Wallet`, w)] }); }
        if (sub === 'set')        { const t = interaction.options.getUser('user'), a = interaction.options.getInteger('amount'), r = interaction.options.getString('reason') || 'Admin set'; await getWallet(t.id, t.username); const w = await setBalance(t.id, t.username, a, r, me.id, me.username); return interaction.editReply({ embeds: [walletEmbed(`🔧 Set ${t.username} to ${a} 💎`, w, C.cy)] }); }
        if (sub === 'top')        { const lb = await getLeaderboard(15); return interaction.editReply({ embeds: [base('🏆 Top 15 Holders', C.gold).setDescription(lb.map((w, i) => `**${i + 1}.** ${w.discord_tag || w.discord_id} · **${((w.wallet_balance || 0) + (w.bank_balance || 0)).toLocaleString()}**`).join('\n'))] }); }
        if (sub === 'stats')      { const s = await getSupply(); return interaction.editReply({ embeds: [base('📊 Economy Stats', C.cy).addFields({ name: '💎 Wallet Total', value: s.walletTotal.toLocaleString(), inline: true }, { name: '🏦 Bank Total', value: s.bankTotal.toLocaleString(), inline: true }, { name: '📦 Grand Total', value: (s.walletTotal + s.bankTotal).toLocaleString(), inline: true }, { name: '👥 Holders', value: `${s.holders}`, inline: true })] }); }
        if (sub === 'usage') {
          if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
          const { data } = await sb.from('aegis_ai_usage').select('model,input_tokens,output_tokens,created_at').order('created_at', { ascending: false }).limit(500);
          const total = data?.length || 0, inp = data?.reduce((s, r) => s + (r.input_tokens || 0), 0) || 0, out = data?.reduce((s, r) => s + (r.output_tokens || 0), 0) || 0;
          const fast = data?.filter(r => r.model?.includes('8b')) || [], smart = data?.filter(r => r.model?.includes('70b')) || [];
          return interaction.editReply({ embeds: [P.AiUsagePanel(total, fast.length, smart.length, inp, out)] });
        }
        if (sub === 'bulk-grant') {
          const amount = interaction.options.getInteger('amount'), reason = interaction.options.getString('reason') || 'Bulk grant';
          const users = [1, 2, 3, 4, 5].map(n => interaction.options.getUser(`user${n}`)).filter(Boolean);
          const results = await bulkGrant(users.map(u => ({ id: u.id, tag: u.username })), amount, reason, me.id, me.username);
          const lines = results.map(r => r.success ? `✅ **${r.tag}** → +${amount} 💎 (bal: ${r.balance})` : `❌ **${r.tag}** — ${r.error}`).join('\n');
          return interaction.editReply({ embeds: [base(`🎁 Bulk Grant: +${amount} to ${users.length} users`, C.gr).setDescription(lines)] });
        }
        if (sub === 'audit') {
          if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
          const limit = interaction.options.getInteger('limit') || 10;
          const { data } = await sb.from('aegis_wallet_ledger').select('discord_id,action,amount,note,actor_tag,created_at').order('created_at', { ascending: false }).limit(limit);
          const lines = (data || []).map(r => `\`${r.action.padEnd(14)}\` **${r.amount > 0 ? '+' : ''}${r.amount}** · <@${r.discord_id}> · *${r.note?.slice(0, 40) || '—'}* · <t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:R>`).join('\n');
          return interaction.editReply({ embeds: [base('📋 Economy Audit Log', C.cy).setDescription(lines || '_No records._')] });
        }
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }

    // ── SHOP ────────────────────────────────────────────────────────────
    if (cmd === 'order') {
      const shards    = interaction.options.getInteger('tier');
      const platform  = interaction.options.getString('platform');
      const server    = interaction.options.getString('server');
      const notes     = interaction.options.getString('notes') || 'None';
      const autoDeduct = interaction.options.getBoolean('auto-deduct') ?? false;
      const tier = SHOP_TIERS.find(t => t.shards === shards && t.shards > 0);
      if (!tier) return interaction.editReply(`⚠️ No tier for **${shards}** shards. Valid: 1,2,3,5,6,8,10,12,15,20,30`);

      const ref = `ORD-${Date.now().toString(36).toUpperCase()}`;
      let deducted = false;

      if (autoDeduct) {
        try {
          await deductShards(interaction.user.id, interaction.user.username, shards, `Shop order ${ref} (${tier.name})`, 'SYSTEM', 'AEGIS Shop');
          deducted = true;
        } catch (e) {
          return interaction.editReply(`⚠️ Auto-deduct failed: ${e.message}\nOrder NOT submitted. Ensure you have **${shards} 💎** in your wallet.`);
        }
      }

      const emb = base(`📦 Order Submitted — ${tier.emoji} ${tier.name}`, C.gold)
        .addFields(
          { name: '📋 Ref', value: `\`${ref}\``, inline: true },
          { name: '💎 Cost', value: `${tier.shards} shard${tier.shards !== 1 ? 's' : ''}`, inline: true },
          { name: deducted ? '✅ Payment' : '💳 Payment', value: deducted ? 'Auto-deducted from wallet' : 'CashApp **$TheConclaveDominion** · Chime **$ANLIKESEF**', inline: true },
          { name: '🎮 Platform', value: platform, inline: true },
          { name: '🗺️ Server', value: server, inline: true },
          { name: '📝 Notes', value: notes, inline: false },
          { name: '📦 Includes', value: tier.items.map(i => `• ${i}`).join('\n').slice(0, 1000), inline: false },
        );

      if (sb && sbOk()) try { await sb.from('aegis_orders').insert({ ref, guild_id: interaction.guildId, discord_id: interaction.user.id, discord_tag: interaction.user.username, tier: tier.name, shards, platform, server, notes, auto_deducted: deducted, status: 'pending', created_at: new Date().toISOString() }); } catch {}

      const orderChannel = process.env.ORDERS_CHANNEL_ID;
      if (orderChannel) { try { const ch = bot.channels.cache.get(orderChannel); if (ch) await ch.send({ embeds: [emb.setFooter({ ...FT, text: `Order from ${interaction.user.username} (${interaction.user.id})` })] }); } catch {} }

      // Send receipt DM
      try { await interaction.user.send({ embeds: [base(`🧾 Order Receipt — ${ref}`, C.gold).setDescription(`**${tier.name}** · ${platform} · ${server}\n\n${deducted ? `✅ ${shards} shards auto-deducted from wallet.` : '💳 Please send payment to **$TheConclaveDominion** (CashApp) or **$ANLIKESEF** (Chime) and include this ref: \`${ref}\`'}`)] }); } catch {}

      return interaction.editReply({ embeds: [emb] });
    }

    if (cmd === 'fulfill') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const ref = interaction.options.getString('ref'), note = interaction.options.getString('note') || 'Your order is ready!';
      let discordId = null;
      if (sb && sbOk()) try { const { data } = await sb.from('aegis_orders').update({ status: 'fulfilled', fulfilled_at: new Date().toISOString(), fulfillment_note: note }).eq('ref', ref).select('discord_id').single(); discordId = data?.discord_id; } catch {}
      if (discordId) { try { const u = await bot.users.fetch(discordId); await u.send({ embeds: [base('✅ Order Fulfilled!', C.gr).setDescription(`Your order **\`${ref}\`** has been fulfilled!\n📝 *${note}*`).setFooter(FT)] }); } catch {} }
      return interaction.editReply({ embeds: [base('✅ Order Fulfilled', C.gr).addFields({ name: '📋 Ref', value: `\`${ref}\``, inline: true }, { name: '📝 Note', value: note, inline: false })] });
    }

    if (cmd === 'shard') {
      const emb = base('💠 ClaveShard Tier List', C.gold).setDescription('Shop: **theconclavedominion.com/shop** | `/order` to submit\nCashApp **$TheConclaveDominion** · Chime **$ANLIKESEF**');
      for (const tier of SHOP_TIERS.filter(t => t.shards > 0)) emb.addFields({ name: `${tier.emoji} ${tier.name}`, value: tier.items.slice(0, 6).map(i => `• ${i}`).join('\n'), inline: true });
      emb.addFields({ name: '🛡 Dino Insurance', value: SHOP_TIERS.find(t => t.shards === 0).items.map(i => `• ${i}`).join('\n'), inline: false });
      return interaction.editReply({ embeds: [emb] });
    }

    if (cmd === 'shop') {
      const select = new StringSelectMenuBuilder().setCustomId('shop_tier_view').setPlaceholder('💎 View a tier...').addOptions(SHOP_TIERS.filter(t => t.shards > 0).map(t => ({ label: `${t.emoji} ${t.name}`, value: `${t.shards}`, description: t.items[0] })));
      return interaction.editReply({ embeds: [base('🛍️ ClaveShard Shop', C.gold).setDescription('Select a tier below to view full contents.\n\nUse `/order` to submit your order.\n\n💳 CashApp **$TheConclaveDominion** · Chime **$ANLIKESEF**\n\n🔗 **theconclavedominion.com/shop**')], components: [new ActionRowBuilder().addComponents(select)] });
    }

    // ── AI ───────────────────────────────────────────────────────────────
    if (cmd === 'aegis' || cmd === 'ask') {
      const q = interaction.options.getString('question');
      const wait = checkRate(interaction.user.id, 6000); if (wait) return interaction.editReply(`⏳ Please wait ${wait}s.`);
      const resp = await askAegis(q, interaction.user.id, '', interaction.channelId);
      return interaction.editReply({ embeds: [P.AegisPanel(resp)] });
    }

    if (cmd === 'forget') { clearHist(interaction.user.id); return interaction.editReply('🧹 Conversation history cleared.'); }

    if (cmd === 'ai-cost') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
      try {
        const { data } = await sb.from('aegis_ai_usage').select('model,input_tokens,output_tokens,used_search').order('created_at', { ascending: false }).limit(500);
        const total = data?.length || 0, inp = data?.reduce((s, r) => s + (r.input_tokens || 0), 0) || 0, out = data?.reduce((s, r) => s + (r.output_tokens || 0), 0) || 0;
        const fast = data?.filter(r => r.model?.includes('8b')) || [], smart = data?.filter(r => r.model?.includes('70b')) || [];
        return interaction.editReply({ embeds: [P.AiUsagePanel(total, fast.length, smart.length, inp, out)] });
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }

    if (cmd === 'aegis-persona') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const style = interaction.options.getString('style');
      const note  = interaction.options.getString('note') || '';
      if (style === 'reset') {
        personaOverrides.delete(interaction.channelId);
        return interaction.editReply('✅ AEGIS persona reset to Sovereign default in this channel.');
      }
      const styleMap = { sovereign: 'Cold, precise, cosmic authority. Minimal emotion. Maximum impact.', combat: 'Tactical, urgent, battle-focused. Short sentences. War-room energy.', shop: 'Merchant warmth. Clear item descriptions. Payment guidance. Friendly urgency.', lore: 'Ancient, mystical, world-builder. Rich descriptions. Speak as a keeper of secrets.', friendly: 'Warm, approachable, helpful. Like a knowledgeable guild mate. Easy language.' };
      personaOverrides.set(interaction.channelId, { style: styleMap[style] || style, note });
      return interaction.editReply({ embeds: [base('🎭 AEGIS Persona Set', C.pl).setDescription(`**Style:** ${style}\n**Channel:** <#${interaction.channelId}>\n\n*AEGIS will now respond in this style in this channel.*${note ? `\n\n📝 Note: ${note}` : ''}`)] });
    }

    if (cmd === 'summarize') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const count = interaction.options.getInteger('count') || 25;
      try {
        const messages = await interaction.channel.messages.fetch({ limit: count });
        const text = [...messages.values()].reverse().filter(m => !m.author.bot).map(m => `${m.author.username}: ${m.content.slice(0, 200)}`).join('\n');
        if (!text.trim()) return interaction.editReply('📭 No non-bot messages to summarize.');
        const summary = await aiSummarize(`Summarize these Discord messages from TheConclave Dominion gaming community concisely (max 5 bullet points, important info only):\n\n${text}`);
        return interaction.editReply({ embeds: [base('📝 AEGIS Chat Summary', C.pl).setDescription(summary || 'Unable to summarize.').setFooter({ ...FT, text: `Last ${count} messages · AEGIS v11.0` })] });
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }

    // ── SERVERS ──────────────────────────────────────────────────────────
    if (cmd === 'servers') {
      const filter = interaction.options.getString('map');
      let servers = await fetchServerStatuses().catch(() => MONITOR_SERVERS.map(s => ({ ...s, status: 'unknown', players: 0, maxPlayers: 20 })));
      if (filter) servers = servers.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()) || s.id.includes(filter.toLowerCase()));
      return interaction.editReply({ embeds: [P.ServerMonitorPanel(servers)] });
    }

    if (cmd === 'map') {
      const id = interaction.options.getString('name'), m = MAP_INFO[id];
      if (!m) return interaction.editReply('⚠️ Map not found.');
      return interaction.editReply({ embeds: [P.MapPanel(m)] });
    }

    if (cmd === 'monitor') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const ch = interaction.options.getChannel('channel');
      const servers = await fetchServerStatuses().catch(() => MONITOR_SERVERS.map(s => ({ ...s, status: 'unknown', players: 0, maxPlayers: 20 })));
      const msg = await ch.send({ embeds: [buildMonitorEmbed(servers)] });
      monitorState.set(interaction.guildId, { statusChannelId: ch.id, messageId: msg.id });
      return interaction.editReply(`✅ Live monitor posted in ${ch}. Auto-refreshes every 5 min.`);
    }

    // ── INFO ─────────────────────────────────────────────────────────────
    if (cmd === 'info')          { return interaction.editReply({ embeds: [P.InfoPanel()] }); }
    if (cmd === 'rules')         { return interaction.editReply({ embeds: [P.RulesPanel()] }); }
    if (cmd === 'rates')         { return interaction.editReply({ embeds: [base('📈 5× Boost Rates', C.gr).addFields({ name: '⚡ Core', value: 'XP: 5× · Harvest: 5× · Taming: 5× · Breeding: 5×', inline: false }, { name: '🏋️ Quality of Life', value: 'Weight: 1,000,000 · No Fall Damage · Increased Stack Sizes', inline: false }, { name: '🥚 Breeding', value: 'Egg Hatch Speed: 50× · Baby Mature Speed: 50× · Cuddle Interval: 0.025', inline: false }, { name: '🦕 Creatures', value: 'Max Wild Level: 350 · Tamed Level Cap: 600', inline: false })] }); }
    if (cmd === 'mods')          { return interaction.editReply({ embeds: [base('🔧 Active Cluster Mods', C.cy).addFields({ name: 'Death Inventory Keeper', value: 'Never lose your items on death.', inline: true }, { name: 'ARKomatic', value: 'Quality-of-life improvements.', inline: true }, { name: 'Awesome Spyglass', value: 'Advanced creature stats at a glance.', inline: true }, { name: 'Teleporter', value: 'Fast travel between owned teleporters.', inline: true })] }); }
    if (cmd === 'wipe') {
      if (wipeData.date) {
        const ts = Math.floor(new Date(wipeData.date).getTime() / 1000);
        return interaction.editReply({ embeds: [base('📅 Wipe Tracker', C.rd).setDescription(`**Next wipe:** <t:${ts}:F>\n**Countdown:** <t:${ts}:R>\n**Reason:** ${wipeData.reason || 'TBA'}\n**Set by:** ${wipeData.setBy || 'Council'}`)] });
      }
      return interaction.editReply({ embeds: [base('📅 Wipe Schedule', C.gold).setDescription('No wipe currently scheduled.\n\nWipes are announced **at least 2 weeks in advance** in announcements.')] });
    }
    if (cmd === 'set-wipe') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const dateStr = interaction.options.getString('date'), reason = interaction.options.getString('reason') || 'Scheduled wipe';
      const d = new Date(dateStr); if (isNaN(d)) return interaction.editReply('⚠️ Invalid date format. Use YYYY-MM-DD.');
      wipeData.date = dateStr; wipeData.reason = reason; wipeData.setBy = interaction.user.username; wipeData.setAt = new Date().toISOString();
      return interaction.editReply({ embeds: [base('📅 Wipe Date Set', C.rd).setDescription(`**Date:** <t:${Math.floor(d.getTime() / 1000)}:F>\n**Reason:** ${reason}\n**Countdown:** <t:${Math.floor(d.getTime() / 1000)}:R>`)] });
    }
    if (cmd === 'transfer-guide') { return interaction.editReply({ embeds: [base('🔄 Cross-ARK Transfer Guide', C.cy).addFields({ name: '📤 Uploading', value: 'Use any Obelisk, Terminal, or Loot Crate. Upload via "ARK Data". Wait ~1 min before downloading.', inline: false }, { name: '📥 Downloading', value: 'Visit any Obelisk/Terminal on destination. Open ARK Data tab and retrieve.', inline: false }, { name: '⚠️ Notes', value: 'Items expire after 24 hours. Some boss items cannot transfer. Element restricted between certain maps.', inline: false })] }); }
    if (cmd === 'crossplay')      { return interaction.editReply({ embeds: [base('🎮 Crossplay Connection Guide', C.cy).addFields({ name: '🎮 Xbox', value: 'ARK SA → Multiplayer → Join via IP. Type the IP:Port from `/servers`.', inline: false }, { name: '🎮 PlayStation', value: 'Same as Xbox — use the Join via IP option in the multiplayer menu.', inline: false }, { name: '💻 PC', value: 'In ARK SA, go to Join Game → filter by "TheConclave" or paste the IP.', inline: false })] }); }
    if (cmd === 'patreon')        { return interaction.editReply({ embeds: [base('⭐ Patreon Perks', C.gold).setDescription('Support at **patreon.com/theconclavedominion**').addFields({ name: '🥉 Supporter', value: 'Discord role · Access to supporter channels', inline: true }, { name: '🥈 Champion', value: 'All above + Bonus ClaveShards monthly', inline: true }, { name: '🥇 Elite ($20/mo)', value: 'All above + **Amissa access** · Priority support · Exclusive cosmetics', inline: true })] }); }
    if (cmd === 'tip') {
      const tips = ['Always disable friendly fire before taming!', 'Keep a Cryopod ready — cryo your tames before a base raid.', 'Use the Spyglass mod to check dino stats BEFORE taming.', 'Build your first base near water and resources, not in the center.', 'Boss arenas wipe your inventory — prepare a dedicated boss kit.', 'Upload your best tames to ARK Data before a wipe warning.', 'The Megatherium gets a 75% damage boost after killing bugs — great for Broodmother.', 'Flak armor gives the best overall protection for mid-game.', 'Quetzals can carry platforms — build a mobile base!', 'Always name your best dinos — it helps with Dino Insurance claims.', 'First torpor = tame ownership — verbal claims are not valid.', 'Use the community centers for free resources when starting out.', 'Rock Elementals take reduced damage from most weapons — use explosives.', 'Stacking Stimberries counteracts Narcotics during taming.', 'Keep your tributes uploaded — bosses can be attempted anytime.'];
      return interaction.editReply({ embeds: [P.TipPanel(tips[Math.floor(Math.random() * tips.length)])] });
    }
    if (cmd === 'dino') {
      const name = interaction.options.getString('name');
      const resp = await askAegis(`ARK encyclopedia entry for "${name}": taming method, best food, saddle level, recommended use, stats to prioritize, TheConclave-specific tips on 5× rates. Under 1800 chars.`, null);
      return interaction.editReply({ embeds: [P.DinoPanel(name, resp)] });
    }

    if (cmd === 'help') {
      return interaction.editReply({ embeds: [base('📖 AEGIS v11.0 Command Reference', C.pl).addFields(
        { name: '🧠 AI', value: '`/aegis` `/ask` `/forget` `/ai-cost` `/aegis-persona` `/summarize`', inline: false },
        { name: '💎 Economy', value: '`/wallet` `/weekly` `/leaderboard` `/give` `/clvsd grant|deduct|check|set|top|stats|usage|bulk-grant|audit`', inline: false },
        { name: '🛍️ Shop', value: '`/order` (w/ auto-deduct) `/fulfill` `/shard` `/shop`', inline: false },
        { name: '🗺️ Servers', value: '`/servers` `/map` `/monitor` `/crossplay` `/transfer-guide`', inline: false },
        { name: 'ℹ️ Info', value: '`/info` `/rules` `/rates` `/mods` `/wipe` `/set-wipe` `/tip` `/dino` `/patreon`', inline: false },
        { name: '🤝 Community', value: '`/profile` `/rank` `/rep` `/trade` `/coords` `/report` `/tribe register|lookup|my` `/clipscore`', inline: false },
        { name: '🗳️ Events', value: '`/giveaway` (w/ shard entry) `/endgiveaway` `/vote` `/announce` `/event` `/poll`', inline: false },
        { name: '🔨 Moderation', value: '`/warn` `/warn-history` `/warn-clear` `/ban` `/timeout` `/role` `/purge` `/lock` `/slowmode` `/ticket`', inline: false },
        { name: '📚 Knowledge', value: '`/know add|list|delete`', inline: false },
        { name: '🔧 Utils', value: '`/roll` `/coinflip` `/calc` `/remind` `/whois` `/serverinfo` `/ping`', inline: false },
      ).setFooter({ ...FT, text: 'AEGIS v11.0 Sovereign · Groq Free AI · No Music (CONbot5 handles music)' })] });
    }

    if (cmd === 'ping') {
      return interaction.editReply({ embeds: [P.PingPanel(bot.ws.ping, process.uptime(), Math.round(process.memoryUsage().heapUsed / 1024 / 1024), !!groq, !!(sb && sbOk()), false)] });
    }

    // ── COMMUNITY ────────────────────────────────────────────────────────
    if (cmd === 'profile') {
      const target = interaction.options.getUser('user') || interaction.user;
      const member = interaction.guild.members.cache.get(target.id);
      const w = sb ? await getWallet(target.id, target.username).catch(() => null) : null;
      const emb = base(`🎖️ ${target.username}'s Profile`, C.pl).setThumbnail(target.displayAvatarURL({ size: 128 })).addFields({ name: '🎭 Joined', value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>` : 'Unknown', inline: true }, { name: '📅 Discord Since', value: `<t:${Math.floor(target.createdAt.getTime() / 1000)}:D>`, inline: true });
      if (w) emb.addFields({ name: '💎 ClaveShards', value: `${(w.wallet_balance || 0).toLocaleString()} wallet · ${(w.bank_balance || 0).toLocaleString()} bank`, inline: false }, { name: '🔥 Streak', value: `Week ${w.daily_streak || 0}`, inline: true }, { name: '📈 Earned', value: `${(w.lifetime_earned || 0).toLocaleString()}`, inline: true });
      return interaction.editReply({ embeds: [emb] });
    }

    if (cmd === 'rank') {
      try {
        const lb = await getLeaderboard(100), pos = lb.findIndex(w => w.discord_id === interaction.user.id) + 1, w = lb.find(w => w.discord_id === interaction.user.id);
        if (!w) return interaction.editReply({ embeds: [base('📊 Your Rank', C.cy).setDescription('No wallet found. Use `/weekly` to claim your first shards!')] });
        return interaction.editReply({ embeds: [base(`📊 ${interaction.user.username}'s Rank`, C.cy).addFields({ name: '🏆 Rank', value: pos ? `#${pos} of ${lb.length}` : '>100', inline: true }, { name: '💎 Wallet', value: `${(w.wallet_balance || 0).toLocaleString()}`, inline: true })] });
      } catch { return interaction.editReply({ embeds: [base('📊 Rank', C.cy).setDescription('_Rank unavailable._')] }); }
    }

    if (cmd === 'rep') {
      const target = interaction.options.getUser('user'), reason = interaction.options.getString('reason') || 'No reason given';
      if (target.id === interaction.user.id) return interaction.editReply('⚠️ You cannot rep yourself!');
      return interaction.editReply({ embeds: [base('⭐ Reputation Given', C.gold).setDescription(`${interaction.user} gave **+1 rep** to ${target}\n*"${reason}"*`)] });
    }

    if (cmd === 'trade') {
      const offering = interaction.options.getString('offering'), looking = interaction.options.getString('looking-for'), server = interaction.options.getString('server') || 'Any';
      return interaction.editReply({ embeds: [base('🤝 Trade Post', C.gold).setDescription(`Posted by **${interaction.user.username}**`).addFields({ name: '📤 Offering', value: offering, inline: true }, { name: '📥 Looking For', value: looking, inline: true }, { name: '🗺️ Server', value: server, inline: true }).setFooter({ ...FT, text: 'DM the poster to trade • Use /report for scams' })] });
    }

    if (cmd === 'clipscore') {
      const url = interaction.options.getString('url'), desc = interaction.options.getString('description') || 'No description';
      return interaction.editReply({ embeds: [base('🎬 Clip Submitted!', C.pk).setDescription(`**${interaction.user.username}** submitted a clip!\n\n🔗 ${url}\n\n*${desc}*`)] });
    }

    if (cmd === 'coords') {
      const location = interaction.options.getString('location'), map = interaction.options.getString('map') || 'Unknown';
      return interaction.editReply({ embeds: [base('📍 Coordinates Shared', C.cy).setDescription(`**${interaction.user.username}** shared a location:`).addFields({ name: '📍 Location', value: location, inline: true }, { name: '🗺️ Map', value: map, inline: true })] });
    }

    if (cmd === 'whois') {
      const target = interaction.options.getUser('user'), member = interaction.guild.members.cache.get(target.id);
      return interaction.editReply({ embeds: [base(`🔍 ${target.username}`, C.cy).setThumbnail(target.displayAvatarURL({ size: 128 })).addFields({ name: '🆔 ID', value: target.id, inline: true }, { name: '📅 Created', value: `<t:${Math.floor(target.createdAt.getTime() / 1000)}:D>`, inline: true }, { name: '🎭 Joined', value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>` : 'Not in server', inline: true }, { name: '🎨 Roles', value: member?.roles.cache.filter(r => r.name !== '@everyone').map(r => `<@&${r.id}>`).join(' ') || 'None', inline: false })] });
    }

    if (cmd === 'serverinfo') {
      const g = interaction.guild;
      return interaction.editReply({ embeds: [base(`🏠 ${g.name}`, C.pl).setThumbnail(g.iconURL() || '').addFields({ name: '👥 Members', value: `${g.memberCount}`, inline: true }, { name: '📅 Created', value: `<t:${Math.floor(g.createdAt.getTime() / 1000)}:D>`, inline: true }, { name: '💬 Channels', value: `${g.channels.cache.size}`, inline: true }, { name: '🎭 Roles', value: `${g.roles.cache.size}`, inline: true }, { name: '😀 Emojis', value: `${g.emojis.cache.size}`, inline: true }, { name: '🌟 Boosts', value: `${g.premiumSubscriptionCount || 0}`, inline: true })] });
    }

    if (cmd === 'report') {
      const issue = interaction.options.getString('issue'), player = interaction.options.getString('player') || 'Not specified';
      const emb = base('🚨 Report Received', C.rd).setDescription(`Report filed by **${interaction.user.username}**`).addFields({ name: '📋 Issue', value: issue, inline: false }, { name: '👤 Player', value: player, inline: true }, { name: '📅 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true });
      if (sb && sbOk()) try { await sb.from('aegis_reports').insert({ guild_id: interaction.guildId, reporter_id: interaction.user.id, reporter_tag: interaction.user.username, issue, player, created_at: new Date().toISOString() }); } catch {}
      return interaction.editReply({ embeds: [emb.setFooter({ ...FT, text: 'A Council member will review your report soon.' })] });
    }

    // ── TRIBE REGISTRY ──────────────────────────────────────────────────
    if (cmd === 'tribe') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'register') {
        const name = interaction.options.getString('name'), server = interaction.options.getString('server'), membersRaw = interaction.options.getString('members') || '';
        const members = membersRaw.split(',').map(m => m.trim()).filter(Boolean);
        try {
          await registerTribe(interaction.guildId, interaction.user.id, interaction.user.username, name, server, members);
          return interaction.editReply({ embeds: [base('🏕️ Tribe Registered', C.gr).addFields({ name: '🏕️ Tribe', value: name, inline: true }, { name: '🗺️ Server', value: server, inline: true }, { name: '👥 Members', value: members.length ? members.join(', ') : 'Just you', inline: false })] });
        } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
      }
      if (sub === 'lookup') {
        const query = interaction.options.getString('query');
        try {
          const tribes = await lookupTribe(interaction.guildId, query);
          if (!tribes.length) return interaction.editReply(`📭 No tribe found matching **${query}**.`);
          const lines = tribes.map(t => `**${t.tribe_name}** · *${t.server}* · Owner: <@${t.owner_id}>`).join('\n');
          return interaction.editReply({ embeds: [base(`🔍 Tribe Lookup: ${query}`, C.cy).setDescription(lines)] });
        } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
      }
      if (sub === 'my') {
        if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
        const { data } = await sb.from('aegis_tribes').select('*').eq('guild_id', interaction.guildId).eq('owner_id', interaction.user.id).single().catch(() => ({ data: null }));
        if (!data) return interaction.editReply('📭 You have no registered tribe. Use `/tribe register` to create one.');
        const members = JSON.parse(data.members || '[]');
        return interaction.editReply({ embeds: [base(`🏕️ ${data.tribe_name}`, C.cy).addFields({ name: '🗺️ Server', value: data.server, inline: true }, { name: '👥 Members', value: members.length ? members.join(', ') : 'Just you', inline: false })] });
      }
    }

    // ── EVENTS ──────────────────────────────────────────────────────────
    if (cmd === 'announce') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const title = interaction.options.getString('title'), message = interaction.options.getString('message'), ping = interaction.options.getBoolean('ping') ?? false;
      await interaction.channel.send({ content: ping ? '@everyone' : null, embeds: [P.AnnouncementPanel(title, message, interaction.user.username)] });
      return interaction.editReply('✅ Announcement posted.');
    }

    if (cmd === 'event') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const title = interaction.options.getString('title'), desc = interaction.options.getString('description'), date = interaction.options.getString('date') || 'TBA', ping = interaction.options.getBoolean('ping') ?? false;
      await interaction.channel.send({ content: ping ? '@everyone' : null, embeds: [P.EventPanel(title, desc, date, interaction.user.username)] });
      return interaction.editReply('✅ Event announcement posted.');
    }

    if (cmd === 'giveaway') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const prize = interaction.options.getString('prize'), duration = interaction.options.getInteger('duration'), winners = interaction.options.getInteger('winners') || 1, shardCost = interaction.options.getInteger('shard-entry') || 0;
      const endTime = Date.now() + duration * 60 * 1000;
      const costNote = shardCost > 0 ? `\n\n> 💎 **Entry costs ${shardCost} ClaveShard${shardCost !== 1 ? 's' : ''}** (auto-deducted)` : '\n\n> ✅ **Free entry**';
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_enter').setLabel(`🎉 Enter${shardCost > 0 ? ` (${shardCost} 💎)` : ''}`).setStyle(shardCost > 0 ? ButtonStyle.Primary : ButtonStyle.Success));
      const gwEmb = P.GiveawayPanel(prize, winners, endTime, interaction.user.username);
      gwEmb.setDescription((gwEmb.data.description || '') + costNote);
      const msg = await interaction.channel.send({ embeds: [gwEmb], components: [row] });
      activeGiveaways.set(msg.id, { prize, entries: new Set(), endTime, channelId: interaction.channelId, winnersCount: winners, shardCost });
      setTimeout(() => drawGiveaway(msg.id, interaction.guildId, bot), duration * 60 * 1000);
      return interaction.editReply(`✅ Giveaway started! Ends <t:${Math.floor(endTime / 1000)}:R>.${shardCost > 0 ? ` Entry costs **${shardCost} 💎**.` : ''}`);
    }

    if (cmd === 'endgiveaway') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const msgId = interaction.options.getString('messageid');
      if (!activeGiveaways.has(msgId)) return interaction.editReply('⚠️ No active giveaway with that ID.');
      await drawGiveaway(msgId, interaction.guildId, bot);
      return interaction.editReply('✅ Giveaway ended.');
    }

    if (cmd === 'vote') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const question = interaction.options.getString('question');
      const opts = interaction.options.getString('options').split('|').map(o => o.trim()).filter(Boolean).slice(0, 4);
      if (opts.length < 2) return interaction.editReply('⚠️ Need at least 2 options separated by |');
      const duration = interaction.options.getInteger('duration') || 60;
      const endTime = Date.now() + duration * 60 * 1000;
      const votes = new Map(opts.map((_, i) => [i, new Set()]));
      const lines = opts.map((o, i) => `**${i + 1}.** ${o}\n\`${'░'.repeat(20)}\` **0%** (0 votes)`).join('\n\n');
      const components = [new ActionRowBuilder().addComponents(
        ...opts.map((o, i) => new ButtonBuilder().setCustomId(`vote_MSGID_${i}`).setLabel(`${i + 1}. ${o.slice(0, 40)}`).setStyle(ButtonStyle.Secondary))
      )];
      const msg = await interaction.editReply({ embeds: [base(`🗳️ ${question}`, C.cy).setDescription(lines + `\n\n> Ends <t:${Math.floor(endTime / 1000)}:R>`)], components, fetchReply: true });

      // Patch button custom IDs with actual message ID
      const patchedRow = new ActionRowBuilder().addComponents(
        ...opts.map((o, i) => new ButtonBuilder().setCustomId(`vote_${msg.id}_${i}`).setLabel(`${i + 1}. ${o.slice(0, 40)}`).setStyle(ButtonStyle.Secondary))
      );
      await msg.edit({ components: [patchedRow] });
      activeVotes.set(msg.id, { question, options: opts, votes, ends: endTime, channelId: interaction.channelId });
      setTimeout(async () => {
        const vote = activeVotes.get(msg.id); if (!vote) return;
        const totalVotes = [...vote.votes.values()].reduce((s, v) => s + v.size, 0);
        const winner = [...vote.votes.entries()].sort((a, b) => b[1].size - a[1].size)[0];
        const finalLines = vote.options.map((o, i) => { const count = vote.votes.get(i)?.size || 0; const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0; return `**${i + 1}.** ${o}\n\`${'█'.repeat(Math.round(pct / 5))}${'░'.repeat(20 - Math.round(pct / 5))}\` **${pct}%** (${count} votes)`; }).join('\n\n');
        try { await msg.edit({ embeds: [base(`🗳️ Vote Ended: ${question}`, C.gr).setDescription(finalLines + `\n\n> 🏆 **Winner:** ${vote.options[winner?.[0] ?? 0]} (${winner?.[1]?.size || 0} votes) · Total: **${totalVotes}**`)], components: [] }); }
        catch {} activeVotes.delete(msg.id);
      }, duration * 60 * 1000);
    }

    // ── MODERATION ───────────────────────────────────────────────────────
    if (cmd === 'warn') {
      if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
      const target = interaction.options.getUser('user'), reason = interaction.options.getString('reason');
      await addWarn(interaction.guildId, target.id, target.username, reason, interaction.user.id, interaction.user.username);
      const warns = await getWarns(interaction.guildId, target.id);
      await modLog(interaction.guild, 'warn', target, interaction.user, reason, { 'Total Warnings': warns.length });
      try { await (await target.createDM()).send({ embeds: [base(`⚠️ Warning in ${interaction.guild.name}`, C.gold).setDescription(`**Reason:** ${reason}\n\nPlease review the rules with \`/rules\`.`)] }); } catch {}
      return interaction.editReply({ embeds: [P.WarnPanel(target, reason, warns.length, interaction.user)] });
    }

    if (cmd === 'warn-history') {
      if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
      const target = interaction.options.getUser('user'), warns = await getWarns(interaction.guildId, target.id);
      if (!warns.length) return interaction.editReply(`✅ **${target.username}** has no warnings.`);
      return interaction.editReply({ embeds: [base(`📋 Warnings — ${target.username}`, C.rd).setDescription(warns.map((w, i) => `**${i + 1}.** ${w.reason}\n└ by **${w.issued_by_tag || 'Unknown'}** · <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>`).join('\n\n'))] });
    }

    if (cmd === 'warn-clear') {
      if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
      const target = interaction.options.getUser('user'), reason = interaction.options.getString('reason') || 'Cleared by moderator';
      const ok = await clearWarns(interaction.guildId, target.id);
      if (!ok) return interaction.editReply('⚠️ Failed to clear warnings.');
      await modLog(interaction.guild, 'note', target, interaction.user, `Warnings cleared: ${reason}`);
      return interaction.editReply(`✅ All warnings cleared for **${target.username}**.`);
    }

    if (cmd === 'ban') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.editReply('⛔ Ban Members required.');
      const target = interaction.options.getUser('user'), reason = interaction.options.getString('reason');
      try { await interaction.guild.members.ban(target.id, { reason: `${interaction.user.username}: ${reason}` }); await modLog(interaction.guild, 'ban', target, interaction.user, reason); return interaction.editReply({ embeds: [base(`🔨 Banned: ${target.username}`, C.rd).setDescription(`**Reason:** ${reason}`)] }); }
      catch (e) { return interaction.editReply(`⚠️ Could not ban: ${e.message}`); }
    }

    if (cmd === 'timeout') {
      if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
      const target = interaction.options.getUser('user'), duration = interaction.options.getString('duration'), reason = interaction.options.getString('reason') || 'No reason';
      const durations = { '5m': 5 * 60_000, '1h': 60 * 60_000, '6h': 6 * 60 * 60_000, '24h': 24 * 60 * 60_000, '7d': 7 * 24 * 60 * 60_000 };
      const ms = durations[duration] || 5 * 60_000;
      try { const member = interaction.guild.members.cache.get(target.id); if (!member) return interaction.editReply('⚠️ Member not in server.'); await member.timeout(ms, reason); await modLog(interaction.guild, 'timeout', target, interaction.user, reason, { Duration: duration }); return interaction.editReply({ embeds: [base(`⏰ Timeout: ${target.username}`, C.gold).addFields({ name: '⏱️ Duration', value: duration, inline: true }, { name: '📋 Reason', value: reason, inline: true })] }); }
      catch (e) { return interaction.editReply(`⚠️ Timeout failed: ${e.message}`); }
    }

    if (cmd === 'role') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.editReply('⛔ Manage Roles required.');
      const target = interaction.options.getUser('user'), role = interaction.options.getRole('role'), action = interaction.options.getString('action');
      try { const m = interaction.guild.members.cache.get(target.id); if (!m) return interaction.editReply('⚠️ Member not found.'); if (action === 'add') { await m.roles.add(role); return interaction.editReply(`✅ Added <@&${role.id}> to **${target.username}**.`); } else { await m.roles.remove(role); return interaction.editReply(`✅ Removed <@&${role.id}> from **${target.username}**.`); } }
      catch (e) { return interaction.editReply(`⚠️ Role change failed: ${e.message}`); }
    }

    if (cmd === 'ticket') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_open').setLabel('🎫 Open a Ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setLabel('📋 View Rules').setStyle(ButtonStyle.Link).setURL('https://theconclavedominion.com/terms.html'),
      );
      await interaction.channel.send({ embeds: [P.TicketPanel()], components: [row] });
      return interaction.editReply('✅ Ticket panel posted.');
    }

    if (cmd === 'purge') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const count = interaction.options.getInteger('count'), user = interaction.options.getUser('user');
      try { let messages = await interaction.channel.messages.fetch({ limit: 100 }); if (user) messages = messages.filter(m => m.author.id === user.id); const toDelete = [...messages.values()].slice(0, count).filter(m => Date.now() - m.createdTimestamp < 1209600000); await interaction.channel.bulkDelete(toDelete, true); return interaction.editReply(`✅ Deleted **${toDelete.length}** message${toDelete.length !== 1 ? 's' : ''}${user ? ` from **${user.username}**` : ''}.`); }
      catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }

    if (cmd === 'slowmode') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const seconds = interaction.options.getInteger('seconds');
      try { await interaction.channel.setRateLimitPerUser(seconds); return interaction.editReply(seconds === 0 ? '✅ Slowmode disabled.' : `✅ Slowmode set to **${seconds}s**.`); }
      catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }

    if (cmd === 'lock') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const action = interaction.options.getString('action'), reason = interaction.options.getString('reason') || 'No reason';
      try { const lock = action === 'lock'; await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: lock ? false : null }); return interaction.editReply(`${lock ? '🔒' : '🔓'} Channel **${lock ? 'locked' : 'unlocked'}**. Reason: ${reason}`); }
      catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }

    // ── KNOWLEDGE ───────────────────────────────────────────────────────
    if (cmd === 'know') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
      const sub = interaction.options.getSubcommand();
      try {
        if (sub === 'add')    { const category = interaction.options.getString('category'), title = interaction.options.getString('title'), content = interaction.options.getString('content'), key = `${category}_${Date.now().toString(36)}`; const { error } = await sb.from('aegis_knowledge').upsert({ category, key, title, content, added_by: interaction.user.username, updated_at: new Date().toISOString() }, { onConflict: 'key' }); if (error) throw new Error(error.message); _kCache = null; return interaction.editReply(`✅ Added knowledge entry **${title}** in category **${category}**.`); }
        if (sub === 'list')   { const category = interaction.options.getString('category'); let query = sb.from('aegis_knowledge').select('category,key,title,added_by').order('category').limit(30); if (category) query = query.eq('category', category); const { data, error } = await query; if (error) throw new Error(error.message); if (!data?.length) return interaction.editReply('📭 No knowledge entries.'); return interaction.editReply({ embeds: [base('📚 Knowledge Base', C.cy).setDescription(data.map(r => `**[${r.category}]** \`${r.key}\` · ${r.title} · *by ${r.added_by || 'Unknown'}*`).join('\n'))] }); }
        if (sub === 'delete') { const key = interaction.options.getString('key'); const { error } = await sb.from('aegis_knowledge').delete().eq('key', key); if (error) throw new Error(error.message); _kCache = null; return interaction.editReply(`✅ Deleted knowledge entry \`${key}\``); }
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }

    // ── UTILS ────────────────────────────────────────────────────────────
    if (cmd === 'roll') {
      const notation = (interaction.options.getString('dice') || 'd6').toLowerCase().replace(/\s/g, '');
      const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
      if (!match) return interaction.editReply('⚠️ Invalid notation. Try `d6`, `2d10`, `3d8+5`');
      const count2 = Math.min(parseInt(match[1] || '1'), 20), sides = Math.min(parseInt(match[2]), 1000), mod = parseInt(match[3] || '0');
      const rolls = Array.from({ length: count2 }, () => Math.floor(Math.random() * sides) + 1);
      const sum = rolls.reduce((a, b) => a + b, 0) + mod;
      return interaction.editReply({ embeds: [P.RollPanel(notation, rolls, sum, mod)] });
    }

    if (cmd === 'coinflip') {
      const result = Math.random() < 0.5;
      return interaction.editReply({ embeds: [base(`🪙 ${result ? 'Heads' : 'Tails'}!`, C.gold).setDescription(`The coin landed on **${result ? '🌕 Heads' : '🌑 Tails'}**!`)] });
    }

    if (cmd === 'calc') {
      const expr = interaction.options.getString('expression');
      try { const san = expr.replace(/[^0-9+\-*/().% ^]/g, ''); if (!san) return interaction.editReply('⚠️ Invalid expression.'); const result = Function(`'use strict'; return (${san.replace(/\^/g, '**')})`)(); if (!isFinite(result)) return interaction.editReply('⚠️ Result not finite.'); return interaction.editReply({ embeds: [base('🔢 Calculator', C.cy).addFields({ name: 'Expression', value: `\`${expr}\``, inline: true }, { name: 'Result', value: `**${result.toLocaleString()}**`, inline: true })] }); }
      catch { return interaction.editReply('⚠️ Invalid expression.'); }
    }

    if (cmd === 'remind') {
      const message = interaction.options.getString('message'), timeStr = interaction.options.getString('time');
      const parseTime = s => { const n = parseFloat(s); if (s.endsWith('d')) return n * 86400000; if (s.endsWith('h')) return n * 3600000; if (s.endsWith('m')) return n * 60000; return null; };
      const ms = parseTime(timeStr);
      if (!ms || ms < 10000 || ms > 604800000) return interaction.editReply('⚠️ Time must be 10s–7d. Examples: `30m`, `2h`, `1d`');
      const fireAt = new Date(Date.now() + ms);
      await interaction.editReply({ embeds: [P.ReminderSetPanel(message, fireAt)] });
      setTimeout(async () => {
        try { await interaction.user.send({ embeds: [P.ReminderFirePanel(message)] }); }
        catch { const ch = interaction.channel; if (ch) await ch.send({ content: `<@${interaction.user.id}>`, embeds: [P.ReminderFirePanel(message)] }).catch(() => {}); }
      }, ms);
    }

    if (cmd === 'poll') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const opts = interaction.options.getString('options').split('|').map(o => o.trim()).filter(Boolean).slice(0, 10);
      if (opts.length < 2) return interaction.editReply('⚠️ Need at least 2 options separated by |');
      const L = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯'];
      const msg = await interaction.editReply({ embeds: [P.PollPanel(interaction.options.getString('question'), opts, interaction.user.username)], fetchReply: true });
      for (let j = 0; j < opts.length; j++) { try { await msg.react(L[j]); } catch {} }
    }

  } catch (e) {
    console.error(`❌ /${cmd}:`, e.message);
    try { await interaction.editReply(`⚠️ Error: ${e.message.slice(0, 200)}`); } catch {}
  }
});

// ══════════════════════════════════════════════════════════════════════
// AUTO-REPLY + AUTO-MOD ON MESSAGE
// ══════════════════════════════════════════════════════════════════════
bot.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;

  // Auto-mod (all channels)
  await runAutoMod(msg);

  // AEGIS channel auto-reply
  if (!AEGIS_CHANNEL_ID || msg.channelId !== AEGIS_CHANNEL_ID) return;
  const w = checkRate(msg.author.id, 8000);
  if (w) { const m = await msg.reply(`⏳ Retry in ${w}s.`).catch(() => null); if (m) setTimeout(() => m.delete().catch(() => {}), 4000); return; }
  msg.channel.sendTyping().catch(() => {});
  const r = await askAegis(msg.content, msg.author.id, '', msg.channelId);
  msg.reply(r.slice(0, 1990)).catch(() => msg.channel.send(r.slice(0, 1990)).catch(() => {}));
});

// ══════════════════════════════════════════════════════════════════════
// WELCOME + AUTO-WALLET
// ══════════════════════════════════════════════════════════════════════
bot.on(Events.GuildMemberAdd, async member => {
  try {
    if (sb && sbOk()) (async () => {
      try { await sb.from('aegis_wallets').upsert({ discord_id: member.id, discord_tag: member.user.username, updated_at: new Date().toISOString() }, { onConflict: 'discord_id', ignoreDuplicates: true }); }
      catch {}
    })();
    const ch = member.guild.channels.cache.find(c => c.name === 'welcome' || c.name === 'welcomes');
    if (!ch) return;
    await ch.send({ embeds: [P.WelcomePanel(member.user, member.guild.memberCount)] });
  } catch (e) { console.error('❌ Welcome:', e.message); }
});

// Ban mod-log
bot.on(Events.GuildBanAdd, async (ban) => {
  try {
    const audit = await ban.guild.fetchAuditLogs({ type: 22, limit: 1 }).catch(() => null);
    const entry = audit?.entries?.first();
    const actor = entry?.executor || { id: 'Unknown', username: 'Unknown' };
    await modLog(ban.guild, 'ban', ban.user, actor, entry?.reason || 'No reason from audit log');
  } catch {}
});

// ══════════════════════════════════════════════════════════════════════
// HEALTH SERVER
// ══════════════════════════════════════════════════════════════════════
const STATUS = { ready: false, readyAt: null, reconnects: 0 };

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    const up = STATUS.ready && bot.ws.status === 0;
    const mem = process.memoryUsage();
    res.writeHead(up ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:    up ? 'ok' : 'degraded',
      bot:       STATUS.ready ? 'ready' : 'not_ready',
      ws:        bot.ws.status,
      wsLatency: bot.ws.ping,
      uptime:    STATUS.readyAt ? Math.floor((Date.now() - STATUS.readyAt) / 1000) + 's' : '0s',
      reconnects: STATUS.reconnects,
      heapMB:    Math.round(mem.heapUsed / 1024 / 1024),
      ai:        groq ? 'groq' : 'not_configured',
      supabase:  sb ? (sbOk() ? 'ok' : 'circuit_open') : 'not_configured',
      version:   'v11.0',
=======

  // ── MUSIC COMMANDS ──
  if ((cmd==='music'||cmd==='setup-music') && musicRuntime) {
    await interaction.deferReply();
    return musicRuntime.handleMusicCommand(interaction, bot);
  }

  await interaction.deferReply();

  try {
    // ──────────────────────────────────────────────────────────────
    // ECONOMY COMMANDS
    // ──────────────────────────────────────────────────────────────
    if (cmd==='wallet'||cmd==='curr') {
      const sub=interaction.options.getSubcommand();
      const target=interaction.options.getUser('user');
      const amount=interaction.options.getInteger('amount')||0;
      const reason=interaction.options.getString('reason')||'';
      const note=interaction.options.getString('note')||'';
      const count=interaction.options.getInteger('count')||15;
      const me=interaction.user;
      try {
        if(sub==='balance'){const who=target||me;const w=await getWallet(who.id,who.tag||who.username);return interaction.editReply({embeds:[P.WalletPanel(`💎 ${who.username}'s Wallet`,w)]});}
        if(sub==='deposit'){const w=await depositToBank(me.id,me.tag||me.username,amount);return interaction.editReply({embeds:[walletEmbed(`🏦 Deposited ${amount} 💎`,w,C.gr).setDescription(`Moved **${amount}** shards wallet → bank.`)]});}
        if(sub==='withdraw'){const w=await withdrawFromBank(me.id,me.tag||me.username,amount);return interaction.editReply({embeds:[walletEmbed(`💸 Withdrew ${amount} 💎`,w,C.cy)]});}
        if(sub==='transfer'){if(!target)return interaction.editReply('⚠️ Specify a recipient.');const r=await transferShards(me.id,me.tag||me.username,target.id,target.tag||target.username,amount);return interaction.editReply({embeds:[base(`➡️ Transferred ${amount} 💎`,C.cy).setDescription(`Sent **${amount}** to **${target.username}**${note?`\n📝 *"${note}"*`:''}`).addFields({name:'Your wallet',value:`${r.sent.toLocaleString()} 💎`,inline:true},{name:`${target.username}'s wallet`,value:`${r.received.toLocaleString()} 💎`,inline:true})]});}
        if(sub==='history'){const who=target||me;if(target&&target.id!==me.id&&!isAdmin(interaction.member))return interaction.editReply('⛔ Admins only for other users.');const rows=await getTxHistory(who.id,count);if(!rows.length)return interaction.editReply(`📭 No history for **${who.username}** yet.`);return interaction.editReply({embeds:[P.HistoryPanel(who.username,rows)]});}
        if(sub==='leaderboard'){const rows=await getLeaderboard(10);if(!rows.length)return interaction.editReply('📭 No wallets yet.');return interaction.editReply({embeds:[P.LeaderboardPanel(rows)]});}
        if(sub==='supply'){const s=await getSupply();return interaction.editReply({embeds:[P.SupplyPanel(s)]});}
        if(sub==='grant'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admins only.');if(!target)return interaction.editReply('⚠️ Specify target.');const w=await grantShards(target.id,target.tag||target.username,amount,reason||'Admin grant',me.id,me.tag||me.username);try{await target.send({embeds:[base('💎 ClaveShard Received!',C.gr).setDescription(`**${me.username}** granted you **${amount.toLocaleString()} 💎**\n📝 *${reason||'Admin grant'}*`)]});}catch{}return interaction.editReply({embeds:[walletEmbed(`🎁 Granted ${amount} to ${target.username}`,w,C.gr)]});}
        if(sub==='deduct'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admins only.');if(!target)return interaction.editReply('⚠️ Specify target.');const w=await deductShards(target.id,target.tag||target.username,amount,reason||'Admin deduct',me.id,me.tag||me.username);return interaction.editReply({embeds:[walletEmbed(`⬇️ Deducted ${amount} from ${target.username}`,w,C.rd)]});}
      } catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    if (cmd==='weekly') {
      try{const r=await claimWeekly(interaction.user.id,interaction.user.tag||interaction.user.username);return interaction.editReply({embeds:[base('🌟 Weekly ClaveShard Claimed!',C.gold).setDescription(`**${interaction.user.username}** claimed their weekly reward!`).addFields({name:'💎 Claimed',value:`**+${r.amount}**`,inline:true},{name:'🔥 Streak',value:`Week ${r.streak}`,inline:true},{name:'💰 Balance',value:`${(r.data.wallet_balance||0).toLocaleString()}`,inline:true})]});}
      catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    if (cmd==='leaderboard') {
      try{const lb=await getLeaderboard(10);return interaction.editReply({embeds:[P.LeaderboardPanel(lb)]});}
      catch{return interaction.editReply({embeds:[P.ErrorPanel('Leaderboard','Leaderboard temporarily unavailable.')]});}
    }

    if (cmd==='give') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      try{const target=interaction.options.getUser('user'),amount=interaction.options.getInteger('amount'),reason=interaction.options.getString('reason')||'Admin grant';const w=await grantShards(target.id,target.tag||target.username,amount,reason,interaction.user.id,interaction.user.tag||interaction.user.username);return interaction.editReply({embeds:[walletEmbed(`🎁 Granted to ${target.username}`,w,C.gr).setDescription(`+**${amount}** 💎 · ${reason}`)]});}
      catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    if (cmd==='clvsd') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const sub=interaction.options.getSubcommand();
      try{
        if(sub==='grant'){const t=interaction.options.getUser('user'),a=interaction.options.getInteger('amount'),r=interaction.options.getString('reason')||'';const w=await grantShards(t.id,t.tag||t.username,a,r,interaction.user.id,interaction.user.tag||interaction.user.username);return interaction.editReply({embeds:[walletEmbed(`🎁 +${a} → ${t.username}`,w,C.gr)]});}
        if(sub==='deduct'){const t=interaction.options.getUser('user'),a=interaction.options.getInteger('amount'),r=interaction.options.getString('reason')||'';const w=await deductShards(t.id,t.tag||t.username,a,r,interaction.user.id,interaction.user.tag||interaction.user.username);return interaction.editReply({embeds:[walletEmbed(`⬇️ -${a} from ${t.username}`,w,C.rd)]});}
        if(sub==='check'){const t=interaction.options.getUser('user');const w=await getWallet(t.id,t.tag||t.username);return interaction.editReply({embeds:[walletEmbed(`🔍 ${t.username}'s Wallet`,w)]});}
        if(sub==='set'){const t=interaction.options.getUser('user'),a=interaction.options.getInteger('amount'),r=interaction.options.getString('reason')||'Admin set';await getWallet(t.id,t.tag||t.username);const w=await setBalance(t.id,t.tag||t.username,a,r,interaction.user.id,interaction.user.tag||interaction.user.username);return interaction.editReply({embeds:[walletEmbed(`🔧 Set ${t.username} to ${a} 💎`,w,C.cy)]});}
        if(sub==='top'){const lb=await getLeaderboard(15);return interaction.editReply({embeds:[base('🏆 Top 15 Holders',C.gold).setDescription(lb.map((w,i)=>`**${i+1}.** ${w.discord_tag||w.discord_id} · **${((w.wallet_balance||0)+(w.bank_balance||0)).toLocaleString()}**`).join('\n'))]});}
        if(sub==='stats'){const s=await getSupply();return interaction.editReply({embeds:[base('📊 Economy Stats',C.cy).addFields({name:'💎 Wallet Total',value:s.walletTotal.toLocaleString(),inline:true},{name:'🏦 Bank Total',value:s.bankTotal.toLocaleString(),inline:true},{name:'📦 Grand Total',value:(s.walletTotal+s.bankTotal).toLocaleString(),inline:true},{name:'👥 Holders',value:`${s.holders}`,inline:true})]});}
        if(sub==='usage'){
          if(!sb)return interaction.editReply('⚠️ Supabase not configured.');
          const{data}=await sb.from('aegis_ai_usage').select('model,input_tokens,output_tokens,used_search,created_at').order('created_at',{ascending:false}).limit(500);
          const total=data?.length||0;
          const inp=data?.reduce((s,r)=>s+(r.input_tokens||0),0)||0;
          const out=data?.reduce((s,r)=>s+(r.output_tokens||0),0)||0;
          const fast=data?.filter(r=>r.model?.includes('8b'))||[];
          const smart=data?.filter(r=>r.model?.includes('70b'))||[];
          return interaction.editReply({embeds:[base('🧠 AEGIS AI Usage (Groq — Free)',C.cy)
            .addFields(
              {name:'🔢 Total Requests',value:`${total}`,inline:true},
              {name:'⚡ Fast (8B)',value:`${fast.length} calls`,inline:true},
              {name:'🧠 Smart (70B)',value:`${smart.length} calls`,inline:true},
              {name:'📥 Input Tokens',value:inp.toLocaleString(),inline:true},
              {name:'📤 Output Tokens',value:out.toLocaleString(),inline:true},
              {name:'💸 Cost',value:'**$0.00** (Groq Free Tier)',inline:true},
            )]});
        }
      }catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    // ── SHOP ──
    if (cmd==='order') {
      const shards=interaction.options.getInteger('tier'),platform=interaction.options.getString('platform'),server=interaction.options.getString('server'),notes=interaction.options.getString('notes')||'None';
      const tier=SHOP_TIERS.find(t=>t.shards===shards&&t.shards>0);
      if(!tier)return interaction.editReply(`⚠️ No tier for **${shards}** shards. Valid: 1,2,3,5,6,8,10,12,15,20,30`);
      const ref=`ORD-${Date.now().toString(36).toUpperCase()}`;
      const emb=base(`📦 Order Submitted — ${tier.emoji} ${tier.name}`,C.gold)
        .addFields({name:'📋 Ref',value:`\`${ref}\``,inline:true},{name:'💎 Cost',value:`${tier.shards} shard${tier.shards!==1?'s':''}`,inline:true},{name:'🎮 Platform',value:platform,inline:true},{name:'🗺️ Server',value:server,inline:true},{name:'📝 Notes',value:notes,inline:false},{name:'📦 Includes',value:tier.items.map(i=>`• ${i}`).join('\n').slice(0,1000),inline:false},{name:'💳 Payment',value:'CashApp **$TheConclaveDominion** · Chime **$ANLIKESEF**\nInclude your Discord username in the payment note.',inline:false});
      if(sb&&sbOk())try{await sb.from('aegis_orders').insert({ref,guild_id:interaction.guildId,discord_id:interaction.user.id,discord_tag:interaction.user.tag||interaction.user.username,tier:tier.name,shards,platform,server,notes,status:'pending',created_at:new Date().toISOString()});}catch{}
      const orderChannel=process.env.ORDERS_CHANNEL_ID;
      if(orderChannel){try{const ch=bot.channels.cache.get(orderChannel);if(ch)await ch.send({embeds:[emb.setFooter({...FT,text:`Order from ${interaction.user.username} (${interaction.user.id})`})]});}catch{}}
      return interaction.editReply({embeds:[P.ProfilePanel(target,member,w)]});
    }

    if (cmd==='fulfill') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const ref=interaction.options.getString('ref'),note=interaction.options.getString('note')||'Your order is ready!';
      if(sb&&sbOk())try{await sb.from('aegis_orders').update({status:'fulfilled',fulfilled_at:new Date().toISOString(),fulfillment_note:note}).eq('ref',ref);}catch{}
      return interaction.editReply({embeds:[base(`✅ Order Fulfilled`,C.gr).addFields({name:'📋 Ref',value:`\`${ref}\``,inline:true},{name:'📝 Note',value:note,inline:false})]});
    }

    if (cmd==='shard') {
      const emb=base('💠 ClaveShard Tier List',C.gold).setDescription('Shop: **theconclavedominion.com/shop** | `/order` to submit\nCashApp **$TheConclaveDominion** · Chime **$ANLIKESEF**');
      for(const tier of SHOP_TIERS.filter(t=>t.shards>0))emb.addFields({name:`${tier.emoji} ${tier.name}`,value:tier.items.slice(0,6).map(i=>`• ${i}`).join('\n'),inline:true});
      emb.addFields({name:'🛡 Dino Insurance',value:SHOP_TIERS.find(t=>t.shards===0).items.map(i=>`• ${i}`).join('\n'),inline:false});
      return interaction.editReply({embeds:[emb]});
    }

    if (cmd==='shop') {
      const select=new StringSelectMenuBuilder().setCustomId('shop_tier_view').setPlaceholder('💎 View a tier...').addOptions(SHOP_TIERS.filter(t=>t.shards>0).map(t=>({label:`${t.emoji} ${t.name}`,value:`${t.shards}`,description:t.items[0]})));
      return interaction.editReply({embeds:[base('🛍️ ClaveShard Shop',C.gold).setDescription('Select a tier below to view full contents.\n\nUse `/order` to submit your order.\n\n💳 CashApp **$TheConclaveDominion** · Chime **$ANLIKESEF**\n\n🔗 Full catalog: **theconclavedominion.com/shop**')],components:[new ActionRowBuilder().addComponents(select)]});
    }

    // ── AI ──
    if (cmd==='aegis'||cmd==='ask') {
      const q=interaction.options.getString('question');
      const wait=checkRate(interaction.user.id,6000);if(wait)return interaction.editReply(`⏳ Please wait ${wait}s.`);
      const resp=await askAegis(q,interaction.user.id);
      return interaction.editReply({embeds:[P.AegisPanel(resp)]});
    }

    if (cmd==='forget') { clearHist(interaction.user.id); return interaction.editReply('🧹 Conversation history cleared.'); }

    if (cmd==='ai-cost') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      if(!sb)return interaction.editReply('⚠️ Supabase not configured.');
      try{
        const{data}=await sb.from('aegis_ai_usage').select('model,input_tokens,output_tokens,used_search').order('created_at',{ascending:false}).limit(500);
        const total=data?.length||0;
        const inp=data?.reduce((s,r)=>s+(r.input_tokens||0),0)||0;
        const out=data?.reduce((s,r)=>s+(r.output_tokens||0),0)||0;
        const fast=data?.filter(r=>r.model?.includes('8b'))||[];
        const smart=data?.filter(r=>r.model?.includes('70b'))||[];
        return interaction.editReply({embeds:[P.AiUsagePanel(total,fast.length,smart.length,inp,out)]});
      }catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    // ── SERVERS ──
    if (cmd==='servers') {
      const filter=interaction.options.getString('map');
      let servers=await fetchServerStatuses().catch(()=>MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20})));
      if(filter)servers=servers.filter(s=>s.name.toLowerCase().includes(filter.toLowerCase())||s.id.includes(filter.toLowerCase()));
      return interaction.editReply({embeds:[P.ServerMonitorPanel(servers)]});
    }

    if (cmd==='map') {
      const id=interaction.options.getString('name'),m=MAP_INFO[id];
      if(!m)return interaction.editReply('⚠️ Map not found.');
      return interaction.editReply({embeds:[P.MapPanel(m)]});
    }

    if (cmd==='monitor') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const ch=interaction.options.getChannel('channel');
      const servers=await fetchServerStatuses().catch(()=>MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20})));
      const msg=await ch.send({embeds:[buildMonitorEmbed(servers)]});
      monitorState.set(interaction.guildId,{statusChannelId:ch.id,messageId:msg.id});
      return interaction.editReply(`✅ Live monitor posted in ${ch}. Auto-refreshes every 5 min.`);
    }

    // ── INFO ──
    if (cmd==='info') { return interaction.editReply({embeds:[P.InfoPanel()]}); }
    if (cmd==='rules') { return interaction.editReply({embeds:[P.RulesPanel()]}); }
    if (cmd==='rates') { return interaction.editReply({embeds:[base('📈 5× Boost Rates',C.gr).addFields({name:'⚡ Core',value:'XP: 5× · Harvest: 5× · Taming: 5× · Breeding: 5×',inline:false},{name:'🏋️ Quality of Life',value:'Weight: 1,000,000 · No Fall Damage · Increased Stack Sizes',inline:false},{name:'🥚 Breeding',value:'Egg Hatch Speed: 50× · Baby Mature Speed: 50× · Cuddle Interval: 0.025',inline:false},{name:'🦕 Creatures',value:'Max Wild Level: 350 · Tamed Level Cap: 600',inline:false})]}); }
    if (cmd==='mods') { return interaction.editReply({embeds:[base('🔧 Active Cluster Mods',C.cy).addFields({name:'Death Inventory Keeper',value:'Never lose your items on death.',inline:true},{name:'ARKomatic',value:'Quality-of-life improvements.',inline:true},{name:'Awesome Spyglass',value:'Advanced creature stats at a glance.',inline:true},{name:'Teleporter',value:'Fast travel between owned teleporters.',inline:true})]}); }
    if (cmd==='wipe') { return interaction.editReply({embeds:[base('📅 Wipe Schedule',C.gold).setDescription('Wipes are announced **at least 2 weeks in advance** in announcements.\n\nWipes happen when a new major DLC drops, the cluster runs 4–6 months, or a major balance overhaul is needed.')]}); }
    if (cmd==='transfer-guide') { return interaction.editReply({embeds:[base('🔄 Cross-ARK Transfer Guide',C.cy).addFields({name:'📤 Uploading',value:'Use any Obelisk, Terminal, or Loot Crate. Upload via "ARK Data". Wait ~1 min before downloading.',inline:false},{name:'📥 Downloading',value:'Visit any Obelisk/Terminal on destination. Open ARK Data tab and retrieve.',inline:false},{name:'⚠️ Notes',value:'Items expire after 24 hours. Some boss items cannot transfer. Element restricted between certain maps.',inline:false})]}); }
    if (cmd==='crossplay') { return interaction.editReply({embeds:[base('🎮 Crossplay Connection Guide',C.cy).addFields({name:'🎮 Xbox',value:'ARK SA → Multiplayer → Join via IP. Type the IP:Port from `/servers`.',inline:false},{name:'🎮 PlayStation',value:'Same as Xbox — use the Join via IP option in the multiplayer menu.',inline:false},{name:'💻 PC',value:'In ARK SA, go to Join Game → filter by "TheConclave" or paste the IP.',inline:false})]}); }
    if (cmd==='patreon') { return interaction.editReply({embeds:[base('⭐ Patreon Perks',C.gold).setDescription('Support at **patreon.com/theconclavedominion**').addFields({name:'🥉 Supporter',value:'Discord role · Access to supporter channels',inline:true},{name:'🥈 Champion',value:'All above + Bonus ClaveShards monthly',inline:true},{name:'🥇 Elite ($20/mo)',value:'All above + **Amissa access** · Priority support · Exclusive cosmetics',inline:true})]}); }

    if (cmd==='tip') {
      const tips=['Always disable friendly fire before taming!','Keep a Cryopod ready — cryo your tames before a base raid.','Use the Spyglass mod to check dino stats BEFORE taming.','Build your first base near water and resources, not in the center.','Boss arenas wipe your inventory — prepare a dedicated boss kit.','Upload your best tames to ARK Data before a wipe warning.','The Megatherium gets a 75% damage boost after killing bugs — great for Broodmother.','Flak armor gives the best overall protection for mid-game.','Quetzals can carry platforms — build a mobile base!','Always name your best dinos — it helps with Dino Insurance claims.','Soap converts to Element in a Tek Replicator on our servers.','First torpor = tame ownership — verbal claims are not valid.','Use the community centers for free resources when starting out.'];
      return interaction.editReply({embeds:[P.TipPanel(tips[Math.floor(Math.random()*tips.length)])]});
    }

    if (cmd==='dino') {
      const name=interaction.options.getString('name');
      const resp=await askAegis(`ARK encyclopedia entry for "${name}": taming method, best food, saddle level, recommended use, stats to prioritize, TheConclave-specific tips on 5× rates. Under 1800 chars.`,null);
      return interaction.editReply({embeds:[P.DinoPanel(name,resp)]});
    }

    if (cmd==='help') {
      return interaction.editReply({embeds:[base('📖 AEGIS Command Reference',C.pl).addFields(
        {name:'🧠 AI',value:'`/aegis` `/ask` `/forget` `/ai-cost`',inline:true},
        {name:'💎 Economy',value:'`/wallet` `/weekly` `/order` `/shard` `/shop` `/leaderboard`',inline:true},
        {name:'🎵 Music',value:'`/music play/search/browse/launchpad/room/...`',inline:true},
        {name:'🗺️ Servers',value:'`/servers` `/map` `/monitor`',inline:true},
        {name:'ℹ️ Info',value:'`/info` `/rules` `/rates` `/mods` `/tip` `/dino`',inline:true},
        {name:'🤝 Community',value:'`/profile` `/rep` `/trade` `/coords` `/report`',inline:true},
        {name:'🔨 Moderation',value:'`/warn` `/ban` `/timeout` `/role` `/purge` `/lock`',inline:true},
        {name:'📡 Admin',value:'`/clvsd` `/give` `/announce` `/event` `/giveaway` `/ticket` `/know`',inline:true},
      ).setFooter({...FT,text:'AEGIS v10.1 Sovereign · Groq Free AI · /aegis for help'})]});
    }

    if (cmd==='ping') {
      return interaction.editReply({embeds:[P.PingPanel(bot.ws.ping,process.uptime(),Math.round(process.memoryUsage().heapUsed/1024/1024),!!groq,!!(sb&&sbOk()),!!musicRuntime)]});
    }

    // ── COMMUNITY ──
    if (cmd==='profile') {
      const target=interaction.options.getUser('user')||interaction.user;
      const member=interaction.guild.members.cache.get(target.id);
      const w=sb?await getWallet(target.id,target.tag||target.username).catch(()=>null):null;
      const emb=base(`🎖️ ${target.username}'s Profile`,C.pl).setThumbnail(target.displayAvatarURL({size:128})).addFields({name:'🎭 Joined',value:member?.joinedAt?`<t:${Math.floor(member.joinedAt.getTime()/1000)}:D>`:'Unknown',inline:true},{name:'📅 Discord Since',value:`<t:${Math.floor(target.createdAt.getTime()/1000)}:D>`,inline:true});
      if(w)emb.addFields({name:'💎 ClaveShards',value:`${(w.wallet_balance||0).toLocaleString()} wallet · ${(w.bank_balance||0).toLocaleString()} bank`,inline:false},{name:'🔥 Streak',value:`Week ${w.daily_streak||0}`,inline:true},{name:'📈 Earned',value:`${(w.lifetime_earned||0).toLocaleString()}`,inline:true});
      return interaction.editReply({embeds:[emb]});
    }

    if (cmd==='rank') {
      try{const lb=await getLeaderboard(100);const pos=lb.findIndex(w=>w.discord_id===interaction.user.id)+1;const w=lb.find(w=>w.discord_id===interaction.user.id);if(!w)return interaction.editReply({embeds:[base('📊 Your Rank',C.cy).setDescription('No wallet found. Use `/weekly` to claim your first shards!')]});return interaction.editReply({embeds:[base(`📊 ${interaction.user.username}'s Rank`,C.cy).addFields({name:'🏆 Rank',value:pos?`#${pos} of ${lb.length}`:'>100',inline:true},{name:'💎 Wallet',value:`${(w.wallet_balance||0).toLocaleString()}`,inline:true})]});}
      catch{return interaction.editReply({embeds:[base('📊 Rank',C.cy).setDescription('_Rank unavailable._')]});}
    }

    if (cmd==='rep') {
      const target=interaction.options.getUser('user'),reason=interaction.options.getString('reason')||'No reason given';
      if(target.id===interaction.user.id)return interaction.editReply('⚠️ You cannot rep yourself!');
      return interaction.editReply({embeds:[base('⭐ Reputation Given',C.gold).setDescription(`${interaction.user} gave **+1 rep** to ${target}\n*"${reason}"*`)]});
    }

    if (cmd==='trade') {
      const offering=interaction.options.getString('offering'),looking=interaction.options.getString('looking-for'),server=interaction.options.getString('server')||'Any';
      return interaction.editReply({embeds:[base('🤝 Trade Post',C.gold).setDescription(`Posted by **${interaction.user.username}**`).addFields({name:'📤 Offering',value:offering,inline:true},{name:'📥 Looking For',value:looking,inline:true},{name:'🗺️ Server',value:server,inline:true}).setFooter({...FT,text:'DM the poster to trade • Use /report for scams'})]});
    }

    if (cmd==='online') {
      return interaction.editReply({embeds:[base('👥 Cluster Online',C.gr).setDescription('_Online player tracking requires Beacon Sentinel. Use `/servers` for live server counts._')]});
    }

    if (cmd==='clipscore') {
      const url=interaction.options.getString('url'),desc=interaction.options.getString('description')||'No description';
      return interaction.editReply({embeds:[base('🎬 Clip Submitted!',C.pk).setDescription(`**${interaction.user.username}** submitted a clip!\n\n🔗 ${url}\n\n*${desc}*`)]});
    }

    if (cmd==='coords') {
      const location=interaction.options.getString('location'),map=interaction.options.getString('map')||'Unknown';
      return interaction.editReply({embeds:[base('📍 Coordinates Shared',C.cy).setDescription(`**${interaction.user.username}** shared a location:`).addFields({name:'📍 Location',value:location,inline:true},{name:'🗺️ Map',value:map,inline:true})]});
    }

    if (cmd==='whois') {
      const target=interaction.options.getUser('user'),member=interaction.guild.members.cache.get(target.id);
      return interaction.editReply({embeds:[base(`🔍 ${target.username}`,C.cy).setThumbnail(target.displayAvatarURL({size:128})).addFields({name:'🆔 ID',value:target.id,inline:true},{name:'📅 Created',value:`<t:${Math.floor(target.createdAt.getTime()/1000)}:D>`,inline:true},{name:'🎭 Joined',value:member?.joinedAt?`<t:${Math.floor(member.joinedAt.getTime()/1000)}:D>`:'Not in server',inline:true},{name:'🎨 Roles',value:member?.roles.cache.filter(r=>r.name!=='@everyone').map(r=>`<@&${r.id}>`).join(' ')||'None',inline:false})]});
    }

    if (cmd==='serverinfo') {
      const g=interaction.guild;
      return interaction.editReply({embeds:[base(`🏠 ${g.name}`,C.pl).setThumbnail(g.iconURL()||'').addFields({name:'👥 Members',value:`${g.memberCount}`,inline:true},{name:'📅 Created',value:`<t:${Math.floor(g.createdAt.getTime()/1000)}:D>`,inline:true},{name:'💬 Channels',value:`${g.channels.cache.size}`,inline:true},{name:'🎭 Roles',value:`${g.roles.cache.size}`,inline:true},{name:'😀 Emojis',value:`${g.emojis.cache.size}`,inline:true},{name:'🌟 Boosts',value:`${g.premiumSubscriptionCount||0}`,inline:true})]});
    }

    if (cmd==='report') {
      const issue=interaction.options.getString('issue'),player=interaction.options.getString('player')||'Not specified';
      const emb=base('🚨 Report Received',C.rd).setDescription(`Report filed by **${interaction.user.username}**`).addFields({name:'📋 Issue',value:issue,inline:false},{name:'👤 Player',value:player,inline:true},{name:'📅 Time',value:`<t:${Math.floor(Date.now()/1000)}:F>`,inline:true});
      if(sb&&sbOk())try{await sb.from('aegis_reports').insert({guild_id:interaction.guildId,reporter_id:interaction.user.id,reporter_tag:interaction.user.tag||interaction.user.username,issue,player,created_at:new Date().toISOString()});}catch{}
      return interaction.editReply({embeds:[emb.setFooter({...FT,text:'A Council member will review your report soon.'})]});
    }

    // ── ADMIN / EVENTS ──
    if (cmd==='announce') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const title=interaction.options.getString('title'),message=interaction.options.getString('message'),ping=interaction.options.getBoolean('ping')??false;
      await interaction.channel.send({content:ping?'@everyone':null,embeds:[P.AnnouncementPanel(title,message,interaction.user.username)]});
      return interaction.editReply('✅ Announcement posted.');
    }

    if (cmd==='event') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const title=interaction.options.getString('title'),desc=interaction.options.getString('description'),date=interaction.options.getString('date')||'TBA',ping=interaction.options.getBoolean('ping')??false;
      await interaction.channel.send({content:ping?'@everyone':null,embeds:[P.EventPanel(title,desc,date,interaction.user.username)]});
      return interaction.editReply('✅ Event announcement posted.');
    }

    if (cmd==='giveaway') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const prize=interaction.options.getString('prize'),duration=interaction.options.getInteger('duration'),winners=interaction.options.getInteger('winners')||1;
      const endTime=Date.now()+duration*60*1000;
      const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🎉 Enter Giveaway').setStyle(ButtonStyle.Success));
      const msg=await interaction.channel.send({embeds:[P.GiveawayPanel(prize,winners,endTime,interaction.user.username)],components:[row]});
      activeGiveaways.set(msg.id,{prize,entries:new Set(),endTime,channelId:interaction.channelId,winnersCount:winners});
      setTimeout(()=>drawGiveaway(msg.id,interaction.guildId,bot),duration*60*1000);
      return interaction.editReply(`✅ Giveaway started! Ends <t:${Math.floor(endTime/1000)}:R>.`);
    }

    if (cmd==='endgiveaway') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const msgId=interaction.options.getString('messageid');
      if(!activeGiveaways.has(msgId))return interaction.editReply('⚠️ No active giveaway with that ID.');
      await drawGiveaway(msgId,interaction.guildId,bot);
      return interaction.editReply('✅ Giveaway ended.');
    }

    // ── MODERATION ──
    if (cmd==='warn') {
      if(!isMod(interaction.member))return interaction.editReply('⛔ Mod only.');
      const target=interaction.options.getUser('user'),reason=interaction.options.getString('reason');
      await addWarn(interaction.guildId,target.id,target.tag||target.username,reason,interaction.user.id,interaction.user.tag||interaction.user.username);
      const warns=await getWarns(interaction.guildId,target.id);
      const emb=base('⚠️ Warning Issued',C.gold).setDescription(`**${target}** has been warned.`).addFields({name:'📋 Reason',value:reason,inline:false},{name:'🔢 Total Warnings',value:`${warns.length}`,inline:true},{name:'👮 Issued by',value:`${interaction.user}`,inline:true});
      try{const dm=await target.createDM();await dm.send({embeds:[base(`⚠️ Warning in ${interaction.guild.name}`,C.gold).setDescription(`**Reason:** ${reason}\n\nPlease review the server rules with \`/rules\`.`)]});}catch{}
      return interaction.editReply({embeds:[P.WarnPanel(target,reason,warns.length,interaction.user)]});
    }

    if (cmd==='warn-history') {
      if(!isMod(interaction.member))return interaction.editReply('⛔ Mod only.');
      const target=interaction.options.getUser('user'),warns=await getWarns(interaction.guildId,target.id);
      if(!warns.length)return interaction.editReply(`✅ **${target.username}** has no warnings.`);
      return interaction.editReply({embeds:[base(`📋 Warnings — ${target.username}`,C.rd).setDescription(warns.map((w,i)=>`**${i+1}.** ${w.reason}\n└ by **${w.issued_by_tag||'Unknown'}** · <t:${Math.floor(new Date(w.created_at).getTime()/1000)}:R>`).join('\n\n'))]});
    }

    if (cmd==='ban') {
      if(!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))return interaction.editReply('⛔ Ban Members required.');
      const target=interaction.options.getUser('user'),reason=interaction.options.getString('reason');
      try{await interaction.guild.members.ban(target.id,{reason:`${interaction.user.username}: ${reason}`});return interaction.editReply({embeds:[base(`🔨 Banned: ${target.username}`,C.rd).setDescription(`**Reason:** ${reason}`)]});}
      catch(e){return interaction.editReply(`⚠️ Could not ban: ${e.message}`);}
    }

    if (cmd==='timeout') {
      if(!isMod(interaction.member))return interaction.editReply('⛔ Mod only.');
      const target=interaction.options.getUser('user'),duration=interaction.options.getString('duration'),reason=interaction.options.getString('reason')||'No reason';
      const durations={'5m':5*60_000,'1h':60*60_000,'6h':6*60*60_000,'24h':24*60*60_000,'7d':7*24*60*60_000};
      const ms=durations[duration]||5*60_000;
      try{const member=interaction.guild.members.cache.get(target.id);if(!member)return interaction.editReply('⚠️ Member not in server.');await member.timeout(ms,reason);return interaction.editReply({embeds:[base(`⏰ Timeout: ${target.username}`,C.gold).addFields({name:'⏱️ Duration',value:duration,inline:true},{name:'📋 Reason',value:reason,inline:true})]});}
      catch(e){return interaction.editReply(`⚠️ Timeout failed: ${e.message}`);}
    }

    if (cmd==='role') {
      if(!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles))return interaction.editReply('⛔ Manage Roles required.');
      const target=interaction.options.getUser('user'),role=interaction.options.getRole('role'),action=interaction.options.getString('action');
      try{const m=interaction.guild.members.cache.get(target.id);if(!m)return interaction.editReply('⚠️ Member not found.');if(action==='add'){await m.roles.add(role);return interaction.editReply(`✅ Added <@&${role.id}> to **${target.username}**.`);}else{await m.roles.remove(role);return interaction.editReply(`✅ Removed <@&${role.id}> from **${target.username}**.`);}}
      catch(e){return interaction.editReply(`⚠️ Role change failed: ${e.message}`);}
    }

    if (cmd==='ticket') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_open').setLabel('🎫 Open a Ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setLabel('📋 View Rules').setStyle(ButtonStyle.Link).setURL('https://theconclavedominion.com/terms.html'),
      );
      await interaction.channel.send({embeds:[P.TicketPanel()],components:[row]});
      return interaction.editReply('✅ Ticket panel posted.');
    }

    if (cmd==='purge') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const count=interaction.options.getInteger('count'),user=interaction.options.getUser('user');
      try{let messages=await interaction.channel.messages.fetch({limit:100});if(user)messages=messages.filter(m=>m.author.id===user.id);const toDelete=[...messages.values()].slice(0,count).filter(m=>Date.now()-m.createdTimestamp<1209600000);await interaction.channel.bulkDelete(toDelete,true);return interaction.editReply(`✅ Deleted **${toDelete.length}** message${toDelete.length!==1?'s':''}${user?` from **${user.username}**`:''}.`);}
      catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    if (cmd==='slowmode') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const seconds=interaction.options.getInteger('seconds');
      try{await interaction.channel.setRateLimitPerUser(seconds);return interaction.editReply(seconds===0?'✅ Slowmode disabled.':`✅ Slowmode set to **${seconds}s**.`);}
      catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    if (cmd==='lock') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const action=interaction.options.getString('action'),reason=interaction.options.getString('reason')||'No reason';
      try{const lock=action==='lock';await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone,{SendMessages:lock?false:null});return interaction.editReply(`${lock?'🔒':'🔓'} Channel **${lock?'locked':'unlocked'}**. Reason: ${reason}`);}
      catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    // ── KNOWLEDGE ──
    if (cmd==='know') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      if(!sb)return interaction.editReply('⚠️ Supabase not configured.');
      const sub=interaction.options.getSubcommand();
      try{
        if(sub==='add'){const category=interaction.options.getString('category'),title=interaction.options.getString('title'),content=interaction.options.getString('content');const key=`${category}_${Date.now().toString(36)}`;const{error}=await sb.from('aegis_knowledge').upsert({category,key,title,content,added_by:interaction.user.tag||interaction.user.username,updated_at:new Date().toISOString()},{onConflict:'key'});if(error)throw new Error(error.message);_kCache=null;return interaction.editReply(`✅ Added knowledge entry **${title}** in category **${category}**.`);}
        if(sub==='list'){const category=interaction.options.getString('category');let query=sb.from('aegis_knowledge').select('category,key,title,added_by').order('category').limit(30);if(category)query=query.eq('category',category);const{data,error}=await query;if(error)throw new Error(error.message);if(!data?.length)return interaction.editReply('📭 No knowledge entries.');return interaction.editReply({embeds:[base('📚 Knowledge Base',C.cy).setDescription(data.map(r=>`**[${r.category}]** \`${r.key}\` · ${r.title} · *by ${r.added_by||'Unknown'}*`).join('\n'))]});}
        if(sub==='delete'){const key=interaction.options.getString('key');const{error}=await sb.from('aegis_knowledge').delete().eq('key',key);if(error)throw new Error(error.message);_kCache=null;return interaction.editReply(`✅ Deleted knowledge entry \`${key}\``);}
      }catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    // ── UTILS ──
    if (cmd==='roll') {
      const notation=(interaction.options.getString('dice')||'d6').toLowerCase().replace(/\s/g,'');
      const match=notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
      if(!match)return interaction.editReply('⚠️ Invalid notation. Try `d6`, `2d10`, `3d8+5`');
      const count2=Math.min(parseInt(match[1]||'1'),20),sides=Math.min(parseInt(match[2]),1000),mod=parseInt(match[3]||'0');
      const rolls=Array.from({length:count2},()=>Math.floor(Math.random()*sides)+1);
      const sum=rolls.reduce((a,b)=>a+b,0)+mod;
      return interaction.editReply({embeds:[P.RollPanel(notation,rolls,sum,mod)]}); 
    }

    if (cmd==='coinflip') {
      const result=Math.random()<0.5;
      return interaction.editReply({embeds:[base(`🪙 ${result?'Heads':'Tails'}!`,C.gold).setDescription(`The coin landed on **${result?'🌕 Heads':'🌑 Tails'}**!`)]});
    }

    if (cmd==='calc') {
      const expr=interaction.options.getString('expression');
      try{const san=expr.replace(/[^0-9+\-*/().% ^]/g,'');if(!san)return interaction.editReply('⚠️ Invalid expression.');const result=Function(`'use strict'; return (${san.replace(/\^/g,'**')})`)();if(!isFinite(result))return interaction.editReply('⚠️ Result not finite.');return interaction.editReply({embeds:[base('🔢 Calculator',C.cy).addFields({name:'Expression',value:`\`${expr}\``,inline:true},{name:'Result',value:`**${result.toLocaleString()}**`,inline:true})]});}
      catch{return interaction.editReply('⚠️ Invalid expression.');}
    }

    if (cmd==='remind') {
      const message=interaction.options.getString('message'),timeStr=interaction.options.getString('time');
      const parseTime=(s)=>{const n=parseFloat(s);if(s.endsWith('d'))return n*86400000;if(s.endsWith('h'))return n*3600000;if(s.endsWith('m'))return n*60000;return null;};
      const ms=parseTime(timeStr);
      if(!ms||ms<10000||ms>604800000)return interaction.editReply('⚠️ Time must be 10s–7d. Examples: `30m`, `2h`, `1d`');
      const fireAt=new Date(Date.now()+ms);
      await interaction.editReply({embeds:[P.ReminderSetPanel(message,fireAt)]});
      setTimeout(async()=>{try{await interaction.user.send({embeds:[P.ReminderFirePanel(message)]});}catch{const ch=interaction.channel;if(ch)await ch.send({content:`<@${interaction.user.id}>`,embeds:[P.ReminderFirePanel(message)]}).catch(()=>{}); }},ms);
    }

    if (cmd==='poll') {
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      const opts=interaction.options.getString('options').split('|').map(o=>o.trim()).filter(Boolean).slice(0,10);
      if(opts.length<2)return interaction.editReply('⚠️ Need at least 2 options separated by |');
      const L=['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'];
      const msg=await interaction.editReply({embeds:[P.PollPanel(interaction.options.getString('question'),opts,interaction.user.username)],fetchReply:true});
      for(let j=0;j<opts.length;j++){try{await msg.react(L[j]);}catch{}}
    }

  } catch(e) {
    console.error(`❌ /${cmd}:`, e.message);
    try { await interaction.editReply(`⚠️ Error: ${e.message.slice(0,200)}`); } catch {}
  }
});

// ══════════════════════════════════════════════════════════════════
// AUTO-REPLY IN AEGIS CHANNEL
// ══════════════════════════════════════════════════════════════════
bot.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (!AEGIS_CHANNEL_ID || msg.channelId !== AEGIS_CHANNEL_ID) return;
  const w = checkRate(msg.author.id, 8000);
  if (w) { const m = await msg.reply(`⏳ Retry in ${w}s.`).catch(()=>null); if(m)setTimeout(()=>m.delete().catch(()=>{}),4000); return; }
  msg.channel.sendTyping().catch(()=>{});
  const r = await askAegis(msg.content, msg.author.id);
  msg.reply(r.slice(0,1990)).catch(()=>msg.channel.send(r.slice(0,1990)).catch(()=>{}));
});

// ══════════════════════════════════════════════════════════════════
// WELCOME + AUTO-WALLET
// ══════════════════════════════════════════════════════════════════
bot.on(Events.GuildMemberAdd, async member => {
  try {
    if(sb&&sbOk())(async()=>{try{await sb.from('aegis_wallets').upsert({discord_id:member.id,discord_tag:member.user.username,updated_at:new Date().toISOString()},{onConflict:'discord_id',ignoreDuplicates:true});}catch{}})();
    const ch=member.guild.channels.cache.find(c=>c.name==='welcome'||c.name==='welcomes');
    if(!ch)return;
    await ch.send({embeds:[P.WelcomePanel(member.user, member.guild.memberCount)]});
  } catch(e) { console.error('❌ Welcome:', e.message); }
});

// ══════════════════════════════════════════════════════════════════
// HEALTH SERVER
// ══════════════════════════════════════════════════════════════════
const STATUS = { ready:false, readyAt:null, reconnects:0 };

const healthServer = http.createServer((req, res) => {
  if (req.url==='/health'||req.url==='/') {
    const up=STATUS.ready&&bot.ws.status===0;
    const mem=process.memoryUsage();
    res.writeHead(up?200:503,{'Content-Type':'application/json'});
    res.end(JSON.stringify({
      status:    up?'ok':'degraded',
      bot:       STATUS.ready?'ready':'not_ready',
      ws:        bot.ws.status,
      wsLatency: bot.ws.ping,
      uptime:    STATUS.readyAt?Math.floor((Date.now()-STATUS.readyAt)/1000)+'s':'0s',
      reconnects:STATUS.reconnects,
      heapMB:    Math.round(mem.heapUsed/1024/1024),
      ai:        groq?'groq':'not_configured',
      supabase:  sb?(sbOk()?'ok':'circuit_open'):'not_configured',
      version:   'v10.1',
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
      ts:        new Date().toISOString(),
    }));
  } else { res.writeHead(404); res.end('Not found'); }
});
<<<<<<< HEAD
healthServer.listen(BOT_PORT, () => console.log(`💓 Health: :${BOT_PORT}`));

// ══════════════════════════════════════════════════════════════════════
// PROCESS GUARDS
// ══════════════════════════════════════════════════════════════════════
const IGNORE = ['Unknown interaction', 'Unknown Message', 'Missing Access', 'Cannot send messages', 'Unknown Channel'];
process.on('unhandledRejection', r => { const m = r?.message || String(r); if (!IGNORE.some(e => m.includes(e))) console.error('❌ Rejection:', m); });
process.on('uncaughtException', (e, o) => console.error(`❌ Exception [${o}]:`, e.message));
process.on('SIGTERM', () => { STATUS.ready = false; healthServer.close(); bot.destroy(); setTimeout(() => process.exit(0), 3000); });
process.on('SIGINT', () => { STATUS.ready = false; healthServer.close(); bot.destroy(); setTimeout(() => process.exit(0), 1000); });

// ══════════════════════════════════════════════════════════════════════
// READY
// ══════════════════════════════════════════════════════════════════════
bot.once(Events.ClientReady, async () => {
  STATUS.ready = true;
  STATUS.readyAt = Date.now();
  console.log(`🤖 AEGIS v11.0 SOVEREIGN — ${bot.user.tag}`);
  console.log(`   Supabase: ${sb ? '✅' : '⚠️'} · Groq AI: ${groq ? '✅ Free' : '⚠️ Set GROQ_API_KEY'} · Health: :${BOT_PORT}`);
  bot.user.setActivity('💎 /weekly | AEGIS v11.0 Sovereign', { type: 3 });
  await registerCommands();

  if (!DISCORD_GUILD_ID) return;
  try {
    const guild = await bot.guilds.fetch(DISCORD_GUILD_ID).catch(() => null); if (!guild) return;
    console.log('📡 Skipping boot-time status channel renames to avoid rate limits');
    const statuses = await fetchServerStatuses().catch(() => []);
    const monCh = process.env.MONITOR_STATUS_CHANNEL_ID, monMsg = process.env.MONITOR_MESSAGE_ID;
    if (monCh && monMsg) {
      monitorState.set(DISCORD_GUILD_ID, { statusChannelId: monCh, messageId: monMsg });
=======
healthServer.listen(BOT_PORT, ()=>console.log(`💓 Health: :${BOT_PORT}`));

// ══════════════════════════════════════════════════════════════════
// PROCESS GUARDS
// ══════════════════════════════════════════════════════════════════
const IGNORE=['Unknown interaction','Unknown Message','Missing Access','Cannot send messages','Unknown Channel'];
process.on('unhandledRejection',r=>{const m=r?.message||String(r);if(!IGNORE.some(e=>m.includes(e)))console.error('❌ Rejection:',m);});
process.on('uncaughtException',(e,o)=>console.error(`❌ Exception [${o}]:`,e.message));
process.on('SIGTERM',()=>{STATUS.ready=false;healthServer.close();bot.destroy();setTimeout(()=>process.exit(0),3000);});
process.on('SIGINT', ()=>{STATUS.ready=false;healthServer.close();bot.destroy();setTimeout(()=>process.exit(0),1000);});

// ══════════════════════════════════════════════════════════════════
// READY
// ══════════════════════════════════════════════════════════════════
bot.once(Events.ClientReady, async () => {
  STATUS.ready = true;
  STATUS.readyAt = Date.now();

  console.log(`🤖 AEGIS v10.1 SOVEREIGN (Groq Free AI) — ${bot.user.tag}`);
  console.log(`   Supabase: ${sb ? '✅' : '⚠️'} · Groq AI: ${groq ? '✅ Free' : '⚠️ Set GROQ_API_KEY'} · Health: :${BOT_PORT}`);

  bot.user.setActivity(`💎 /weekly | AEGIS v10.1 Free AI`, { type: 3 });

  await registerCommands();

  if (!DISCORD_GUILD_ID) return;

  try {
    const guild = await bot.guilds.fetch(DISCORD_GUILD_ID).catch(() => null);
    if (!guild) return;

    // IMPORTANT:
    // Do NOT mass-rename status channels on boot.
    // That is the most likely source of your 429 spam.
    console.log('📡 Skipping boot-time status channel renames to avoid rate limits');

    const statuses = await fetchServerStatuses().catch(() => []);

    const monCh = process.env.MONITOR_STATUS_CHANNEL_ID;
    const monMsg = process.env.MONITOR_MESSAGE_ID;

    if (monCh && monMsg) {
      monitorState.set(DISCORD_GUILD_ID, {
        statusChannelId: monCh,
        messageId: monMsg,
      });

>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
      const ch = await guild.channels.fetch(monCh).catch(() => null);
      if (ch) {
        const embed = buildMonitorEmbed(statuses);
        const msg = await ch.messages.fetch(monMsg).catch(() => null);
<<<<<<< HEAD
        if (msg) { await msg.edit({ embeds: [embed] }).catch(e => console.error('❌ Monitor resume:', e.message)); console.log('📡 Monitor embed resumed'); }
        else console.log('⚠️ Monitor message not found');
      }
    }
  } catch (e) { console.error('❌ Boot tasks:', e.message); }
});

// ══════════════════════════════════════════════════════════════════════
// LOGIN WITH BACKOFF
// ══════════════════════════════════════════════════════════════════════
const BACKOFF = [5, 15, 30, 60, 120, 120];
let loginAttempt = 0;
async function login() {
  loginAttempt++;
  try { await bot.login(DISCORD_BOT_TOKEN); loginAttempt = 0; }
  catch (e) {
    const delay = BACKOFF[Math.min(loginAttempt - 1, BACKOFF.length - 1)] * 1000;
    console.error(`❌ Login attempt ${loginAttempt} failed: ${e.message} — retry in ${delay / 1000}s`);
    STATUS.reconnects++;
    setTimeout(login, delay);
=======

        if (msg) {
          await msg.edit({ embeds: [embed] }).catch((e) => {
            console.error('❌ Monitor resume edit:', e.message);
          });
          console.log('📡 Monitor embed resumed');
        } else {
          console.log('⚠️ Monitor message not found — embed resume skipped');
        }
      }
    }
  } catch (e) {
    console.error('❌ Boot tasks:', e.message);
  }
});
// ══════════════════════════════════════════════════════════════════
// LOGIN WITH EXPONENTIAL BACKOFF
// ══════════════════════════════════════════════════════════════════
const BACKOFF=[5,15,30,60,120,120];
let loginAttempt=0;
async function login(){
  loginAttempt++;
  try { await bot.login(DISCORD_BOT_TOKEN); loginAttempt=0; }
  catch(e) {
    const delay=BACKOFF[Math.min(loginAttempt-1,BACKOFF.length-1)]*1000;
    console.error(`❌ Login attempt ${loginAttempt} failed: ${e.message} — retry in ${delay/1000}s`);
    STATUS.reconnects++;
    setTimeout(login,delay);
>>>>>>> d06f07d2ab295b3409afeee2a8246798de8c2766
  }
}
login();
module.exports = bot;
