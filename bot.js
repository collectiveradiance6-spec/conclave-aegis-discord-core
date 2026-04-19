// ═══════════════════════════════════════════════════════════════════════
// CONCLAVE AEGIS BOT — bot.js v10.0 SOVEREIGN EDITION
// TheConclave Dominion · 5× Crossplay ARK: Survival Ascended
// ═══════════════════════════════════════════════════════════════════════
// Architecture:
//   ∙ Zero-orphan single InteractionCreate handler
//   ∙ AEGIS AI — micro-cost outsourced search, token budget tracking
//   ∙ Music Runtime v2 — full dashboard, search UI, playlist persistence
//   ∙ ClaveShard Economy — wallet/bank/transfer/ledger/leaderboard
//   ∙ Beacon Sentinel — tribe/player/ban lookup
//   ∙ Nitrado Direct — live cluster monitor, sidebar voice channels
//   ∙ Supabase circuit breaker + knowledge cache
//   ∙ Per-user conversation memory (12 exchanges)
//   ∙ Rate limiter with stale cleanup
//   ∙ Exponential backoff login
//   ∙ WS watchdog — only exits on 5× consecutive DISCONNECTED
// ═══════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

// ─── MUSIC RUNTIME ────────────────────────────────────────────────────
let musicRuntime = null;
if (process.env.MUSIC_RUNTIME_ENABLED !== 'false') {
  try {
    musicRuntime = require('./music.js');
    console.log('🎵 Music runtime v2 loaded');
  } catch (e) {
    console.warn('⚠️  Music runtime not loaded:', e.message);
  }
}

const http = require('http');
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  EmbedBuilder, PermissionFlagsBits, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle,
} = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const axios     = require('axios');
const { createClient } = require('@supabase/supabase-js');

// ─── ENV ───────────────────────────────────────────────────────────────
const {
  DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID,
  ROLE_OWNER_ID, ROLE_ADMIN_ID, ROLE_HELPER_ID,
  ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  AEGIS_CHANNEL_ID, ADMIN_TOKEN,
} = process.env;

if (!DISCORD_BOT_TOKEN) { console.error('❌ DISCORD_BOT_TOKEN missing'); process.exit(1); }

const API_BASE   = (process.env.API_URL || 'https://api.theconclavedominion.com').replace(/\/$/, '');
const AEGIS_CH   = AEGIS_CHANNEL_ID || '';
const BOT_PORT   = parseInt(process.env.BOT_PORT || '3001');

// AEGIS AI models — tiered for micro-cost optimization
const MODEL_FAST  = 'claude-haiku-4-5-20251001';   // simple lookups, 1c/1M input
const MODEL_SMART = 'claude-sonnet-4-6';             // complex, needs reasoning

// ─── CLIENTS ───────────────────────────────────────────────────────────
const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

const sb = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'conclave-aegis-v10' } },
    })
  : null;

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildVoiceStates,
  ],
  rest: { timeout: 15000 },
  allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
});

// ─── ROLE HELPERS ──────────────────────────────────────────────────────
const isOwner = m => m?.roles?.cache?.has(ROLE_OWNER_ID) || m?.permissions?.has(PermissionFlagsBits.Administrator);
const isAdmin = m => isOwner(m) || m?.roles?.cache?.has(ROLE_ADMIN_ID);
const isMod   = m => isAdmin(m) || m?.roles?.cache?.has(ROLE_HELPER_ID) || m?.permissions?.has(PermissionFlagsBits.ModerateMembers);

// ─── RATE LIMITER ──────────────────────────────────────────────────────
const rates = new Map();
function checkRate(uid, ms = 8000) {
  const l = rates.get(uid) || 0, n = Date.now();
  if (n - l < ms) return Math.ceil((ms - (n - l)) / 1000);
  rates.set(uid, n); return 0;
}
setInterval(() => {
  const cut = Date.now() - 120_000;
  for (const [k, v] of rates) if (v < cut) rates.delete(k);
}, 5 * 60_000);

// ─── SUPABASE CIRCUIT BREAKER ──────────────────────────────────────────
const CB = { failures: 0, openUntil: 0, threshold: 5, resetMs: 60_000 };
const sbOk = () => Date.now() >= CB.openUntil;
function sbFail() {
  CB.failures++;
  if (CB.failures >= CB.threshold) { CB.openUntil = Date.now() + CB.resetMs; console.error(`⚡ Supabase CB OPEN`); }
}
function sbSucc() { CB.failures = 0; CB.openUntil = 0; }
async function sbQuery(fn) {
  if (!sb) throw new Error('Supabase not configured');
  if (!sbOk()) throw new Error('Database temporarily unavailable');
  try { const r = await fn(sb); sbSucc(); return r; }
  catch (e) { sbFail(); throw e; }
}

// ─── AEGIS AI ENGINE (MICRO-COST TIERED) ───────────────────────────────
// Decides which model to use based on query complexity
function pickModel(query) {
  const complex = /explain|analyze|compare|strategy|build|design|how does|why does|help me|write|create|detailed|comprehensive/i.test(query);
  const timeSearch = /latest|current|today|news|update|patch|new|recent|just|now|2025|2026|version|release|price|announce/i.test(query);
  if (complex || timeSearch) return { model: MODEL_SMART, useSearch: timeSearch };
  return { model: MODEL_FAST, useSearch: false };
}

// Knowledge cache (90s TTL)
let _kCache = null, _kTs = 0;
async function getKnowledge() {
  const now = Date.now();
  if (_kCache !== null && now - _kTs < 90_000) return _kCache;
  if (!sb || !sbOk()) { _kCache = ''; return ''; }
  try {
    const { data } = await sb.from('aegis_knowledge')
      .select('category,title,content').neq('category', 'auto_learned')
      .order('category').limit(80);
    _kCache = data?.length ? '\n\nKNOWLEDGE:\n' + data.map(r => `[${r.category}] ${r.title}: ${r.content}`).join('\n') : '';
    _kTs = now;
    return _kCache;
  } catch { _kCache = ''; return ''; }
}

const CORE = `You are AEGIS — the living intelligence of TheConclave Dominion, a 5× crossplay ARK: Survival Ascended community run by Tw_ (High Curator / Owner) and co-owners Slothie (Archmaestro) and Sandy (Wildheart).

SERVERS (10 maps, all crossplay Xbox·PS·PC):
• The Island    — 217.114.196.102:5390  | 🌿 PvE starter map
• Volcano       — 217.114.196.59:5050   | 🌋 High resource
• Extinction    — 31.214.196.102:6440   | 🌑 End-game titans
• The Center    — 31.214.163.71:5120    | 🏔️ Floating islands
• Lost Colony   — 217.114.196.104:5150  | 🪐 Custom spawns
• Astraeos      — 217.114.196.9:5320    | ✨ Celestial rare
• Valguero      — 85.190.136.141:5090   | 🏞️ Deinonychus
• Scorched Earth — 217.114.196.103:5240 | ☀️ Wyverns/Manticore
• Aberration    — 217.114.196.80:5540   | ⚔️ PvP Rock Drakes
• Amissa        — 217.114.196.80:5180   | ⭐ Patreon-exclusive

RATES: 5× XP/Harvest/Taming/Breeding · 1M weight · No fall damage · Max wild 350
MODS: Death Inventory Keeper · ARKomatic · Awesome Spyglass · Teleporter
ECONOMY: /weekly free shards · /wallet balance · /order to shop
PAYMENTS: CashApp $TheConclaveDominion · Chime $ANLIKESEF
MINECRAFT: 134.255.214.44:10090 (Bedrock crossplay)
PATREON: patreon.com/theconclavedominion — Amissa at Elite $20/mo
LINKS: discord.gg/theconclave | theconclavedominion.com
COUNCIL (10): Tw_ · Slothie · Sandy · Jenny (Skywarden) · Arbanion (Oracle of Veils) · Okami (Hazeweaver) · Rookiereaper (Gatekeeper) · Icyreaper (Veilcaster) · Jake (ForgeSmith) · CredibleDevil (Iron Vanguard)

Respond under 1800 chars for Discord. Be accurate, authoritative, community-warm. Cosmic gravitas — you are the realm's intelligence.`;

// Conversation memory per user (12 exchanges)
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

async function askAegis(msg, uid = null, extraCtx = '') {
  if (!anthropic) return '⚠️ AI not configured.';
  try {
    const knowledge = await getKnowledge();
    const system    = CORE + knowledge + (extraCtx ? '\n\n' + extraCtx : '');
    const history   = uid ? getHist(uid) : [];
    const { model, useSearch } = pickModel(msg);

    const req = {
      model, max_tokens: model === MODEL_FAST ? 600 : 900,
      system,
      messages: [...history, { role: 'user', content: msg }],
    };
    if (useSearch) req.tools = [{ type: 'web_search_20250305', name: 'web_search' }];

    const res  = await anthropic.messages.create(req);
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    const searched = res.content.some(b => b.type === 'tool_use');

    if (!text) return '⚠️ Empty response. Try rephrasing.';
    if (uid) { addHist(uid, 'user', msg); addHist(uid, 'assistant', text); }

    // Log token usage for micro-cost tracking
    if (sb && sbOk()) {
      (async () => {
        try {
          await sb.from('aegis_ai_usage').insert({
            model,
            input_tokens:  res.usage?.input_tokens  || 0,
            output_tokens: res.usage?.output_tokens || 0,
            used_search:   searched,
            query_preview: msg.slice(0, 120),
            created_at:    new Date().toISOString(),
          });
        } catch {}
      })();
    }

    // Auto-learn fire-and-forget
    if (sb && sbOk() && text.length > 120 && msg.length > 20) {
      (async () => {
        try {
          await sb.from('aegis_knowledge').upsert({
            category:   'auto_learned',
            key:        `auto_${Date.now().toString(36)}`,
            title:      msg.slice(0, 120),
            content:    text.slice(0, 900),
            added_by:   'AEGIS_BOT',
            source:     searched ? 'web_search' : 'inference',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key', ignoreDuplicates: true });
        } catch {}
      })();
    }

    return (searched ? '🔍 *[web search]*\n\n' : '') + text;
  } catch (e) {
    if (e.message?.includes('overloaded')) return '⚠️ AEGIS overloaded. Retry shortly.';
    if (e.message?.includes('rate'))       return '⚠️ Rate limit. Retry in 30s.';
    return '⚠️ AEGIS error: ' + e.message.slice(0, 100);
  }
}

// ─── WALLET ENGINE ─────────────────────────────────────────────────────
async function getWallet(id, tag) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets')
      .upsert({ discord_id: id, discord_tag: tag, updated_at: new Date().toISOString() },
        { onConflict: 'discord_id', ignoreDuplicates: false })
      .select().single();
    if (error) throw new Error('Wallet error: ' + error.message);
    return data;
  });
}

async function logTx(id, tag, action, amount, balAfter, note = '', actorId = '', actorTag = '') {
  if (!sb || !sbOk()) return;
  try {
    await sb.from('aegis_wallet_ledger').insert({
      discord_id: id, action, amount,
      balance_wallet_after: balAfter,
      note: note || null, actor_discord_id: actorId || null, actor_tag: actorTag || null,
      created_at: new Date().toISOString(),
    });
  } catch {}
}

async function depositToBank(id, tag, amount) {
  const w = await getWallet(id, tag);
  if (w.wallet_balance < amount) throw new Error(`Need **${amount}** in wallet. You have **${w.wallet_balance}** 💎.`);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets')
      .update({ wallet_balance: w.wallet_balance - amount, bank_balance: w.bank_balance + amount, updated_at: new Date().toISOString() })
      .eq('discord_id', id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id, tag, 'deposit', amount, data.bank_balance, `Deposited ${amount} to bank`, id, tag);
    return data;
  });
}

async function withdrawFromBank(id, tag, amount) {
  const w = await getWallet(id, tag);
  if (w.bank_balance < amount) throw new Error(`Need **${amount}** in bank. You have **${w.bank_balance}** 💎.`);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets')
      .update({ wallet_balance: w.wallet_balance + amount, bank_balance: w.bank_balance - amount, updated_at: new Date().toISOString() })
      .eq('discord_id', id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id, tag, 'withdraw', amount, data.wallet_balance, `Withdrew ${amount} from bank`, id, tag);
    return data;
  });
}

async function transferShards(fromId, fromTag, toId, toTag, amount) {
  if (fromId === toId) throw new Error('Cannot transfer to yourself.');
  const sender = await getWallet(fromId, fromTag);
  if (sender.wallet_balance < amount) throw new Error(`Need **${amount}** in wallet. You have **${sender.wallet_balance}** 💎.`);
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

async function getHistory(id, limit = 15) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallet_ledger')
      .select('action,amount,balance_wallet_after,note,actor_tag,created_at')
      .eq('discord_id', id).order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  });
}

async function getLeaderboard(limit = 10) {
  return sbQuery(async sb => {
    const { data } = await sb.from('aegis_wallets')
      .select('discord_id,discord_tag,wallet_balance,bank_balance,lifetime_earned')
      .order('wallet_balance', { ascending: false }).limit(limit);
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
    const now = new Date();
    const last = w.last_daily_claim ? new Date(w.last_daily_claim) : null;
    const diff = last ? (now - last) / (1000 * 60 * 60) : 999;
    if (diff < 168) {
      const next = new Date(last.getTime() + 168 * 60 * 60 * 1000);
      throw new Error(`⏳ Already claimed this week. Next: <t:${Math.floor(next / 1000)}:R>`);
    }
    const amount = 3;
    const streak = (w.daily_streak || 0) + 1;
    const { data, error } = await sb.from('aegis_wallets').update({
      wallet_balance: (w.wallet_balance || 0) + amount, lifetime_earned: (w.lifetime_earned || 0) + amount,
      last_daily_claim: now.toISOString(), daily_streak: streak, updated_at: now.toISOString(),
    }).eq('discord_id', id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id, tag, 'daily_claim', amount, data.wallet_balance, `Week ${streak} claim`, 'SYSTEM', 'AEGIS');
    return { data, amount, streak };
  });
}

// ─── LIVE MONITOR ENGINE ───────────────────────────────────────────────
const monitorState = new Map();

const MONITOR_SERVERS = [
  { id: 'island',     name: 'The Island',    fullName: 'TheConclave-TheIsland-5xCrossplay',      nitradoId: 18266152, emoji: '🌿', ip: '217.114.196.102', port: 5390, pvp: false, patreon: false },
  { id: 'volcano',    name: 'Volcano',        fullName: 'TheConclave-Volcano-5xCrossplay',        nitradoId: 18094678, emoji: '🌋', ip: '217.114.196.59',  port: 5050, pvp: false, patreon: false },
  { id: 'extinction', name: 'Extinction',     fullName: 'TheConclave-Extinction-5Xcrossplay',     nitradoId: 18106633, emoji: '🌑', ip: '31.214.196.102',  port: 6440, pvp: false, patreon: false },
  { id: 'center',     name: 'The Center',     fullName: 'TheConclave-Center-5xCrossplay',         nitradoId: 18182839, emoji: '🏔️', ip: '31.214.163.71',  port: 5120, pvp: false, patreon: false },
  { id: 'lostcolony', name: 'Lost Colony',    fullName: 'TheConclave-LostColony-5xCrossplay',     nitradoId: 18307276, emoji: '🪐', ip: '217.114.196.104', port: 5150, pvp: false, patreon: false },
  { id: 'astraeos',   name: 'Astraeos',       fullName: 'TheConclave-Astreos-5xCrossplay',        nitradoId: 18393892, emoji: '✨', ip: '217.114.196.9',   port: 5320, pvp: false, patreon: false },
  { id: 'valguero',   name: 'Valguero',       fullName: 'TheConclave-Valguero-5xCrossplay',       nitradoId: 18509341, emoji: '🏞️', ip: '85.190.136.141', port: 5090, pvp: false, patreon: false },
  { id: 'scorched',   name: 'Scorched Earth', fullName: 'TheConclave-Scorched-5xCrossplay',       nitradoId: 18598049, emoji: '☀️', ip: '217.114.196.103', port: 5240, pvp: false, patreon: false },
  { id: 'aberration', name: 'Aberration',     fullName: 'TheConclave-Aberration-5xCrossplay',     nitradoId: 18655529, emoji: '⚔️', ip: '217.114.196.80',  port: 5540, pvp: true,  patreon: false },
  { id: 'amissa',     name: 'Amissa',         fullName: 'TheConclave-Amissa-Patreon-5xCrossplay', nitradoId: 18680162, emoji: '⭐', ip: '217.114.196.80',  port: 5180, pvp: false, patreon: true  },
];

const EXISTING_STATUS_CHANNELS = {
  aberration: '1491714622959390830', amissa: '1491714743797416056', astraeos: '1491714926862008320',
  center: '1491715233847316590', extinction: '1491715612911861790', lostcolony: '1491715764678299670',
  scorched: '1491717247083876435', island: '1491715445659799692', valguero: '1491715929586008075',
  volcano: '1491716283857633290',
};

const NITRADO_API = 'https://api.nitrado.net';

async function fetchNitradoServer(nitradoId) {
  if (!process.env.NITRADO_API_KEY) return null;
  try {
    const res = await axios.get(`${NITRADO_API}/services/${nitradoId}/gameservers`, {
      headers: { Authorization: `Bearer ${process.env.NITRADO_API_KEY}` }, timeout: 10000,
    });
    const gs = res.data?.data?.gameserver;
    if (!gs) return null;
    return {
      status:     gs.status === 'started' ? 'online' : 'offline',
      players:    gs.query?.player_current  ?? 0,
      maxPlayers: gs.query?.player_max      ?? 20,
      version:    gs.game_specific?.version ?? null,
    };
  } catch { return null; }
}

async function fetchNitradoStatus(servers) {
  const results = [];
  await Promise.all(servers.map(async srv => {
    const data = srv.nitradoId ? await fetchNitradoServer(srv.nitradoId) : null;
    results.push({ ...srv, status: data?.status ?? 'unknown', players: data?.players ?? 0, maxPlayers: data?.maxPlayers ?? 20, playerNames: [] });
  }));
  return results;
}

async function fetchServerStatus(servers) {
  if (process.env.NITRADO_API_KEY) return fetchNitradoStatus(servers);
  return servers.map(s => ({ ...s, status: 'unknown', players: 0, maxPlayers: 20 }));
}

function buildMonitorEmbed(servers) {
  const online = servers.filter(s => s.status === 'online');
  const offline = servers.filter(s => s.status !== 'online');
  const total = online.reduce((sum, s) => sum + s.players, 0);
  const lines = [
    ...online.map(s => {
      const tag = s.pvp ? ' ⚔️' : s.patreon ? ' ⭐' : '';
      return `🟢 **${s.emoji} ${s.name}**${tag} \`${s.players}/${s.maxPlayers}\``;
    }),
    ...offline.map(s => `🔴 **${s.emoji} ${s.name}** · Offline`),
  ].join('\n');
  return new EmbedBuilder()
    .setTitle('⚔️ TheConclave — Live Cluster Monitor')
    .setColor(total > 0 ? 0x35ED7E : 0xFF4500)
    .setDescription(lines || 'No servers configured.')
    .addFields(
      { name: '🟢 Online',        value: `${online.length}/${servers.length}`, inline: true },
      { name: '👥 Total Players', value: `${total}`, inline: true },
      { name: '⏰ Updated',       value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
    )
    .setFooter({ text: 'TheConclave Dominion • Auto-refreshes every 5 min', iconURL: 'https://theconclavedominion.com/conclave-badge.png' })
    .setTimestamp();
}

async function updateExistingStatusChannels(guild, statuses) {
  for (const srv of statuses) {
    const chId = EXISTING_STATUS_CHANNELS[srv.id];
    if (!chId) continue;
    try {
      const ch = await guild.channels.fetch(chId).catch(() => null);
      if (!ch) continue;
      const tag  = srv.pvp ? '⚔️' : srv.patreon ? '⭐' : '';
      const name = srv.status === 'online' ? `🟢${tag}・${srv.name}-${srv.players}p` : `🔴・${srv.name}-offline`;
      if (ch.name !== name) { await ch.setName(name); await new Promise(r => setTimeout(r, 600)); }
    } catch {}
  }
}

async function refreshMonitor(guild) {
  const state = monitorState.get(guild.id);
  if (!state?.statusChannelId || !state?.messageId) return;
  try {
    const ch      = await guild.channels.fetch(state.statusChannelId).catch(() => null);
    if (!ch) return;
    const servers  = state.servers?.length ? state.servers : MONITOR_SERVERS;
    const statuses = await fetchServerStatus(servers);
    const embed    = buildMonitorEmbed(statuses);
    const msg      = await ch.messages.fetch(state.messageId).catch(() => null);
    if (msg) await msg.edit({ embeds: [embed] });
    else { const nm = await ch.send({ embeds: [embed] }); state.messageId = nm.id; }
    await updateExistingStatusChannels(guild, statuses);
    state.prevStatuses = statuses;
  } catch (e) { console.error('❌ Monitor refresh:', e.message); }
}

setInterval(async () => {
  if (DISCORD_GUILD_ID) {
    try {
      const guild = await bot.guilds.fetch(DISCORD_GUILD_ID).catch(() => null);
      if (guild) { const s = await fetchServerStatus(MONITOR_SERVERS); await updateExistingStatusChannels(guild, s); }
    } catch {}
  }
  for (const [guildId, state] of monitorState) {
    if (!state.statusChannelId || !state.messageId) continue;
    try { const g = await bot.guilds.fetch(guildId).catch(() => null); if (g) await refreshMonitor(g); } catch {}
  }
}, 5 * 60_000);

// ─── BEACON SENTINEL ───────────────────────────────────────────────────
const beaconState = { access: null, refresh: null, expiresAt: 0, groupId: null, deviceSessions: new Map() };

async function beaconEnsureToken() {
  if (!beaconState.access) return null;
  const now = Math.floor(Date.now() / 1000);
  if (beaconState.expiresAt && now >= beaconState.expiresAt - 300) {
    try {
      const r = await axios.post('https://api.usebeacon.app/v4/login', {
        client_id: process.env.BEACON_CLIENT_ID || 'eb9ecdff-4048-4a83-8f40-f2e16d2e9a81',
        client_secret: process.env.BEACON_CLIENT_SECRET,
        grant_type: 'refresh_token', refresh_token: beaconState.refresh,
        scope: 'common sentinel:read sentinel:write',
      }, { timeout: 10000 });
      beaconState.access = r.data.access_token; beaconState.refresh = r.data.refresh_token; beaconState.expiresAt = r.data.access_token_expiration;
    } catch { return null; }
  }
  return beaconState.access;
}

async function beaconFetch(path, params = {}) {
  const token = await beaconEnsureToken();
  if (!token) return null;
  try {
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    const r  = await axios.get(`https://api.usebeacon.app${path}${qs}`, { headers: { Authorization: `Bearer ${token}` }, timeout: 12000 });
    return r.data;
  } catch { return null; }
}

async function sentinelOnlinePlayers() { if (!beaconState.access) return []; const d = await beaconFetch('/v4/sentinel/characters', { online: 'true', pageSize: 250 }); return d?.results || []; }
async function sentinelTribes(filter) { if (!beaconState.access) return []; const d = await beaconFetch('/v4/sentinel/tribes', { pageSize: 250 }); let t = d?.results || []; if (filter) t = t.filter(x => (x.serviceName||'').toLowerCase().includes(filter.toLowerCase())); return t; }
async function sentinelBans() { if (!beaconState.access) return []; const d = await beaconFetch('/v4/sentinel/bans', { pageSize: 100 }); return d?.results || []; }
async function sentinelPlayer(name) { if (!beaconState.access) return null; const d = await beaconFetch('/v4/sentinel/players', { search: name, pageSize: 5 }); return d?.results?.[0] || null; }

if (process.env.BEACON_ACCESS_TOKEN) {
  beaconState.access    = process.env.BEACON_ACCESS_TOKEN;
  beaconState.refresh   = process.env.BEACON_REFRESH_TOKEN || null;
  beaconState.expiresAt = parseInt(process.env.BEACON_TOKEN_EXPIRES || '0');
  beaconState.groupId   = process.env.BEACON_GROUP_ID || null;
  console.log('📡 Beacon Sentinel: token loaded from env');
}

// ─── EMBED HELPERS ─────────────────────────────────────────────────────
const C = { gold: 0xFFB800, pl: 0x7B2FFF, cy: 0x00D4FF, gr: 0x35ED7E, rd: 0xFF4500, pk: 0xFF4CD2, bl: 0x5865F2, mag: 0xAA00FF };
const FT = { text: 'TheConclave Dominion • 5× Crossplay • 10 Maps', iconURL: 'https://theconclavedominion.com/conclave-badge.png' };
const base = (title, color = C.pl) => new EmbedBuilder().setTitle(title).setColor(color).setFooter(FT).setTimestamp();
const TX_ICO = { deposit: '🏦', withdraw: '💸', transfer_out: '➡️', transfer_in: '⬅️', grant: '🎁', deduct: '⬇️', daily_claim: '🌟', spend: '🛒', earn: '✨', admin_set: '🔧', warn: '⚠️' };

function walletEmbed(title, w, color = C.pl) {
  const total = (w.wallet_balance || 0) + (w.bank_balance || 0);
  return base(title, color)
    .setDescription(`**${w.discord_tag || w.discord_id}**`)
    .addFields(
      { name: '💎 Wallet', value: `**${(w.wallet_balance || 0).toLocaleString()}**`, inline: true },
      { name: '🏦 Bank',   value: `**${(w.bank_balance   || 0).toLocaleString()}**`, inline: true },
      { name: '📊 Total',  value: `**${total.toLocaleString()}**`, inline: true },
      { name: '📈 Earned', value: `${(w.lifetime_earned || 0).toLocaleString()}`, inline: true },
      { name: '📉 Spent',  value: `${(w.lifetime_spent  || 0).toLocaleString()}`, inline: true },
      { name: '🔥 Streak', value: `Week ${w.daily_streak || 0}`, inline: true },
    );
}

// ─── WALLET SUBCOMMAND BUILDER ──────────────────────────────────────────
function wSub(b) {
  return b
    .addSubcommand(s => s.setName('balance').setDescription('💎 Check wallet').addUserOption(o => o.setName('user').setDescription('Member (blank = you)').setRequired(false)))
    .addSubcommand(s => s.setName('deposit').setDescription('🏦 Wallet → Bank').addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('withdraw').setDescription('💸 Bank → Wallet').addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('transfer').setDescription('➡️ Send shards')
      .addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('note').setDescription('Message').setRequired(false)))
    .addSubcommand(s => s.setName('history').setDescription('🧾 Transaction log')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(false))
      .addIntegerOption(o => o.setName('count').setDescription('Entries (max 25)').setRequired(false).setMinValue(1).setMaxValue(25)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('🏆 Top holders'))
    .addSubcommand(s => s.setName('supply').setDescription('📊 Economy supply'))
    .addSubcommand(s => s.setName('grant').setDescription('🎁 [ADMIN] Grant shards')
      .addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('deduct').setDescription('⬇️ [ADMIN] Deduct shards')
      .addUserOption(o => o.setName('user').setDescription('Target').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)));
}

// ─── COMMAND DEFINITIONS ────────────────────────────────────────────────
const cmds = [
  // ── ECONOMY ──
  wSub(new SlashCommandBuilder().setName('wallet').setDescription('💎 ClaveShard wallet — balance, transfer, history')),
  wSub(new SlashCommandBuilder().setName('curr').setDescription('💎 ClaveShard wallet (alias)')),

  new SlashCommandBuilder().setName('weekly').setDescription('🌟 Claim your weekly 3 ClaveShard reward'),

  new SlashCommandBuilder().setName('clvsd').setDescription('💠 Admin economy tools')
    .addSubcommand(s => s.setName('grant').setDescription('🎁 Grant').addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('deduct').setDescription('⬇️ Deduct').addUserOption(o => o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('check').setDescription('🔍 Check wallet').addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s => s.setName('set').setDescription('🔧 Set balance').addUserOption(o => o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('New balance').setRequired(true).setMinValue(0)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Top 15 holders'))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Full economy stats'))
    .addSubcommand(s => s.setName('usage').setDescription('🧠 AEGIS AI token usage stats')),

  new SlashCommandBuilder().setName('order').setDescription('📦 Submit a ClaveShard shop order')
    .addIntegerOption(o => o.setName('tier').setDescription('Tier 1-30').setRequired(true).setMinValue(1).setMaxValue(30))
    .addStringOption(o => o.setName('platform').setDescription('Platform').setRequired(true).addChoices({name:'Xbox',value:'Xbox'},{name:'PlayStation',value:'PlayStation'},{name:'PC',value:'PC'}))
    .addStringOption(o => o.setName('server').setDescription('Which server?').setRequired(true))
    .addStringOption(o => o.setName('notes').setDescription('Special requests').setRequired(false)),

  new SlashCommandBuilder().setName('fulfill').setDescription('✅ [ADMIN] Mark order fulfilled').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('ref').setDescription('Order ref').setRequired(true))
    .addStringOption(o => o.setName('note').setDescription('Note to player').setRequired(false)),

  new SlashCommandBuilder().setName('shard').setDescription('💠 View ClaveShard tier list & pricing'),
  new SlashCommandBuilder().setName('shop').setDescription('🛍️ Browse live ClaveShard catalog'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Top 10 ClaveShard holders'),
  new SlashCommandBuilder().setName('give').setDescription('🎁 [ADMIN] Quick grant shards').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o => o.setName('user').setDescription('Player').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Shards').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  // ── AI / INFO ──
  new SlashCommandBuilder().setName('aegis').setDescription('🧠 Ask AEGIS AI — the Dominion intelligence').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('ask').setDescription('🧠 Ask AEGIS anything').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('forget').setDescription('🧹 Clear your AEGIS conversation history'),
  new SlashCommandBuilder().setName('ai-cost').setDescription('💸 [ADMIN] AEGIS AI cost dashboard').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder().setName('servers').setDescription('🗺️ Live ARK cluster status').addStringOption(o => o.setName('map').setDescription('Filter by map name').setRequired(false)),
  new SlashCommandBuilder().setName('map').setDescription('🗺️ Detailed info for a specific ARK map').addStringOption(o => o.setName('name').setDescription('Map').setRequired(true).addChoices(
    {name:'The Island',value:'island'},{name:'Volcano',value:'volcano'},{name:'Extinction',value:'extinction'},
    {name:'The Center',value:'center'},{name:'Lost Colony',value:'lostcolony'},{name:'Astraeos',value:'astraeos'},
    {name:'Valguero',value:'valguero'},{name:'Scorched Earth',value:'scorched'},{name:'Aberration (PvP)',value:'aberration'},
    {name:'Amissa (Patreon)',value:'amissa'},
  )),
  new SlashCommandBuilder().setName('info').setDescription('ℹ️ Server info, rates, and getting-started guide'),
  new SlashCommandBuilder().setName('rules').setDescription('📜 Dominion Codex rules'),
  new SlashCommandBuilder().setName('rates').setDescription('📈 View all 5× boost rates'),
  new SlashCommandBuilder().setName('mods').setDescription('🔧 List active cluster mods'),
  new SlashCommandBuilder().setName('wipe').setDescription('📅 Wipe schedule information'),
  new SlashCommandBuilder().setName('transfer-guide').setDescription('🔄 Cross-ARK transfer guide'),
  new SlashCommandBuilder().setName('crossplay').setDescription('🎮 Crossplay connection guide (Xbox·PS·PC)'),
  new SlashCommandBuilder().setName('patreon').setDescription('⭐ View Patreon perks and Amissa access'),
  new SlashCommandBuilder().setName('forums').setDescription('🗂️ Forum panel quick-nav'),
  new SlashCommandBuilder().setName('tip').setDescription('💡 Random ARK survival tip'),
  new SlashCommandBuilder().setName('dino').setDescription('🦕 ARK dino info + tame guide').addStringOption(o => o.setName('name').setDescription('Dino name (e.g. Rex, Giga, Wyvern)').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('📖 Full command reference'),
  new SlashCommandBuilder().setName('ping').setDescription('🏓 Bot latency and status'),

  // ── SOCIAL / PROFILE ──
  new SlashCommandBuilder().setName('profile').setDescription('🎖️ View Dominion profile').addUserOption(o => o.setName('user').setDescription('Member (blank = you)').setRequired(false)),
  new SlashCommandBuilder().setName('rank').setDescription('📊 Your ClaveShard rank and standing'),
  new SlashCommandBuilder().setName('rep').setDescription('⭐ Give reputation to a community member')
    .addUserOption(o => o.setName('user').setDescription('Who to rep').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Why?').setRequired(false)),
  new SlashCommandBuilder().setName('trade').setDescription('🤝 Post a trade request')
    .addStringOption(o => o.setName('offering').setDescription('What you offer').setRequired(true))
    .addStringOption(o => o.setName('looking-for').setDescription('What you want').setRequired(true))
    .addStringOption(o => o.setName('server').setDescription('Which server').setRequired(false)),
  new SlashCommandBuilder().setName('online').setDescription('👥 Who is online across the cluster'),
  new SlashCommandBuilder().setName('clipscore').setDescription('🎬 Submit a clip for Clip of the Week')
    .addStringOption(o => o.setName('url').setDescription('Link to clip/image').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Brief description').setRequired(false)),
  new SlashCommandBuilder().setName('coords').setDescription('📍 Share or look up in-game coordinates')
    .addStringOption(o => o.setName('location').setDescription('Location or coords').setRequired(true))
    .addStringOption(o => o.setName('map').setDescription('Which map').setRequired(false)),

  // ── MODERATION ──
  new SlashCommandBuilder().setName('announce').setDescription('📢 [ADMIN] Send formatted announcement').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('title').setDescription('Title').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Body').setRequired(true))
    .addBooleanOption(o => o.setName('ping').setDescription('Ping @everyone?').setRequired(false)),
  new SlashCommandBuilder().setName('event').setDescription('📅 [ADMIN] Create server event').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Event details').setRequired(true))
    .addStringOption(o => o.setName('date').setDescription('Date & time').setRequired(false))
    .addBooleanOption(o => o.setName('ping').setDescription('Ping @everyone?').setRequired(false)),
  new SlashCommandBuilder().setName('warn').setDescription('⚠️ [MOD] Issue formal warning').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('ban').setDescription('🔨 [MOD] Ban a member').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('timeout').setDescription('⏰ [MOD] Timeout a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration').setRequired(true).addChoices({name:'5 min',value:'5m'},{name:'1 hour',value:'1h'},{name:'6 hours',value:'6h'},{name:'24 hours',value:'24h'},{name:'7 days',value:'7d'}))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('role').setDescription('🎭 [ADMIN] Add/remove role').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
    .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices({name:'Add',value:'add'},{name:'Remove',value:'remove'})),
  new SlashCommandBuilder().setName('ticket').setDescription('🎫 [ADMIN] Post support ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('report').setDescription('🚨 Report a player or issue to Council')
    .addStringOption(o => o.setName('reason').setDescription('What happened?').setRequired(true))
    .addUserOption(o => o.setName('player').setDescription('Player to report').setRequired(false))
    .addStringOption(o => o.setName('server').setDescription('Which server?').setRequired(false)),
  new SlashCommandBuilder().setName('warn-history').setDescription('📋 [MOD] View warning history for a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('purge').setDescription('🗑️ [ADMIN] Delete messages in bulk').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('count').setDescription('Number of messages (max 100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('Only purge from this user').setRequired(false)),
  new SlashCommandBuilder().setName('slowmode').setDescription('🐌 [ADMIN] Set channel slowmode').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('seconds').setDescription('0 to disable, max 21600').setRequired(true).setMinValue(0).setMaxValue(21600)),
  new SlashCommandBuilder().setName('lock').setDescription('🔒 [ADMIN] Lock/unlock a channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o => o.setName('action').setDescription('Lock or unlock').setRequired(true).addChoices({name:'Lock',value:'lock'},{name:'Unlock',value:'unlock'}))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  // ── TOOLS ──
  new SlashCommandBuilder().setName('poll').setDescription('📊 [ADMIN] Create a poll').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('question').setDescription('Question').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Options separated by |').setRequired(true)),
  new SlashCommandBuilder().setName('giveaway').setDescription('🎁 [ADMIN] Start a giveaway').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration').setRequired(true).addChoices({name:'30 min',value:'1800'},{name:'1 hour',value:'3600'},{name:'6 hours',value:'21600'},{name:'24 hours',value:'86400'},{name:'7 days',value:'604800'}))
    .addIntegerOption(o => o.setName('winners').setDescription('Winners').setRequired(false).setMinValue(1).setMaxValue(10))
    .addRoleOption(o => o.setName('required_role').setDescription('Required role to enter').setRequired(false)),
  new SlashCommandBuilder().setName('remind').setDescription('⏰ Set a reminder')
    .addStringOption(o => o.setName('message').setDescription('What to remind you').setRequired(true))
    .addStringOption(o => o.setName('time').setDescription('When (30m, 2h, 1d)').setRequired(true)),
  new SlashCommandBuilder().setName('roll').setDescription('🎲 Roll dice').addStringOption(o => o.setName('dice').setDescription('Notation (2d6, d20, 3d8+5)').setRequired(false)),
  new SlashCommandBuilder().setName('coinflip').setDescription('🪙 Flip a coin'),
  new SlashCommandBuilder().setName('calc').setDescription('🔢 Calculate expression').addStringOption(o => o.setName('expression').setDescription('Math expression').setRequired(true)),
  new SlashCommandBuilder().setName('whois').setDescription('🔍 Look up a Discord member').addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('🏠 Server statistics and info'),

  // ── MONITORING ──
  new SlashCommandBuilder().setName('setup-monitoring').setDescription('⚙️ [ADMIN] Deploy full live cluster monitor').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('monitor-refresh').setDescription('🔄 [ADMIN] Force refresh cluster stats').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('monitor-add').setDescription('➕ [ADMIN] Add server to monitor').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o => o.setName('name').setDescription('Display name').setRequired(true))
    .addStringOption(o => o.setName('ip').setDescription('Server IP').setRequired(true))
    .addIntegerOption(o => o.setName('port').setDescription('Port').setRequired(true))
    .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(false))
    .addBooleanOption(o => o.setName('pvp').setDescription('PvP?').setRequired(false))
    .addBooleanOption(o => o.setName('patreon').setDescription('Patreon-only?').setRequired(false)),

  // ── BEACON SENTINEL ──
  new SlashCommandBuilder().setName('beacon-setup').setDescription('🔐 [ADMIN] Authenticate with Beacon Sentinel').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('tribes').setDescription('🏛️ List all tribes across the cluster').addStringOption(o => o.setName('server').setDescription('Filter by server name').setRequired(false)),
  new SlashCommandBuilder().setName('player-lookup').setDescription('🔍 [MOD] Look up player in Beacon').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addStringOption(o => o.setName('name').setDescription('Player name').setRequired(true)),
  new SlashCommandBuilder().setName('sentinel-bans').setDescription('🚫 [ADMIN] Beacon Sentinel ban list').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  // Music injected below
  ...(musicRuntime?.MUSIC_COMMANDS || []),
].map(c => c.toJSON());

async function registerCommands() {
  if (!DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) { console.warn('⚠️  CLIENT_ID/GUILD_ID missing'); return; }
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body: cmds });
    console.log(`✅ ${cmds.length} commands registered`);
  } catch (e) { console.error('❌ Command reg:', e.message); }
}

// ─── WALLET HANDLER ────────────────────────────────────────────────────
async function handleWallet(i) {
  const sub    = i.options.getSubcommand();
  const target = i.options.getUser('user');
  const amount = i.options.getInteger('amount') || 0;
  const reason = i.options.getString('reason') || '';
  const note   = i.options.getString('note')   || '';
  const count  = i.options.getInteger('count') || 15;
  const me     = i.user;

  if (sub === 'balance') {
    const who = target || me;
    const w   = await getWallet(who.id, who.username);
    return i.editReply({ embeds: [walletEmbed(`💎 ${who.username}'s Wallet`, w, C.gold).setThumbnail(who.displayAvatarURL())] });
  }
  if (sub === 'deposit') {
    const w = await depositToBank(me.id, me.username, amount);
    return i.editReply({ embeds: [walletEmbed(`🏦 Deposited ${amount.toLocaleString()} 💎`, w, C.gr).setDescription(`Moved **${amount.toLocaleString()}** shards wallet → bank.`)] });
  }
  if (sub === 'withdraw') {
    const w = await withdrawFromBank(me.id, me.username, amount);
    return i.editReply({ embeds: [walletEmbed(`💸 Withdrew ${amount.toLocaleString()} 💎`, w, C.cy)] });
  }
  if (sub === 'transfer') {
    if (!target) return i.editReply('⚠️ Specify a recipient.');
    const r = await transferShards(me.id, me.username, target.id, target.username, amount);
    return i.editReply({ embeds: [base(`➡️ Transferred ${amount.toLocaleString()} 💎`, C.cy)
      .setDescription(`Sent **${amount.toLocaleString()}** to **${target.username}**${note ? `\n📝 *"${note}"*` : ''}`)
      .addFields({name:'Your wallet',value:`${r.sent.toLocaleString()} 💎`,inline:true},{name:`${target.username}'s wallet`,value:`${r.received.toLocaleString()} 💎`,inline:true})] });
  }
  if (sub === 'history') {
    const who = target || me;
    if (target && target.id !== me.id && !isAdmin(i.member)) return i.editReply('⛔ Admins only can view others.');
    const rows = await getHistory(who.id, count);
    if (!rows.length) return i.editReply(`📭 No history for **${who.username}** yet.`);
    const lines = rows.map(r => {
      const ico  = TX_ICO[r.action] || '💠';
      const sign = ['transfer_in','grant','earn','daily_claim'].includes(r.action) ? '+' : '-';
      const ts   = `<t:${Math.floor(new Date(r.created_at).getTime()/1000)}:R>`;
      return `${ico} **${sign}${r.amount.toLocaleString()}** · ${r.note || r.action} · ${ts}`;
    }).join('\n');
    return i.editReply({ embeds: [base(`🧾 ${who.username}'s History`, C.pl).setDescription(lines.slice(0,3900))] });
  }
  if (sub === 'leaderboard') {
    const rows = await getLeaderboard(10);
    if (!rows.length) return i.editReply('📭 No wallets yet.');
    const med   = ['🥇','🥈','🥉'];
    const lines = rows.map((r,idx) => {
      const total = (r.wallet_balance||0)+(r.bank_balance||0);
      return `${med[idx]||`**${idx+1}.**`} **${r.discord_tag||r.discord_id}** — **${total.toLocaleString()}**`;
    }).join('\n');
    return i.editReply({ embeds: [base('🏆 ClaveShard Leaderboard', C.gold).setDescription(lines)] });
  }
  if (sub === 'supply') {
    const s = await getSupply();
    return i.editReply({ embeds: [base('📊 Supply', C.pk).addFields({name:'💎 Wallets',value:s.walletTotal.toLocaleString(),inline:true},{name:'🏦 Banks',value:s.bankTotal.toLocaleString(),inline:true},{name:'∑ Total',value:(s.walletTotal+s.bankTotal).toLocaleString(),inline:true},{name:'👥 Holders',value:s.holders+'',inline:true})] });
  }
  if (sub === 'grant') {
    if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
    if (!target) return i.editReply('⚠️ Specify target.');
    const w = await grantShards(target.id, target.username, amount, reason||'Admin grant', me.id, me.username);
    try { await target.send({ embeds: [base('💎 ClaveShard Received!',C.gr).setDescription(`**${me.username}** granted you **${amount.toLocaleString()} 💎**\n📝 *${reason||'Admin grant'}*`)] }); } catch {}
    return i.editReply({ embeds: [walletEmbed(`🎁 Granted ${amount.toLocaleString()} to ${target.username}`,w,C.gr).addFields({name:'📝 Reason',value:reason||'No reason'})] });
  }
  if (sub === 'deduct') {
    if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
    if (!target) return i.editReply('⚠️ Specify target.');
    const w = await deductShards(target.id, target.username, amount, reason||'Admin deduct', me.id, me.username);
    return i.editReply({ embeds: [walletEmbed(`⬇️ Deducted ${amount.toLocaleString()} from ${target.username}`,w,C.rd).addFields({name:'📝 Reason',value:reason||'No reason'})] });
  }
}

// ─── MAIN INTERACTION HANDLER — ZERO ORPHANS ───────────────────────────
bot.on(Events.InteractionCreate, async i => {

  // ── MUSIC BUTTONS + SELECTS ──
  if (musicRuntime) {
    if (i.isButton() && musicRuntime.isMusicButton(i.customId)) return musicRuntime.handleMusicButton(i, bot);
    if (i.isStringSelectMenu() && musicRuntime.isMusicSelect(i.customId)) return musicRuntime.handleMusicSelect(i, bot);
  }

  // ── BUTTON HANDLERS ──
  if (i.isButton()) {
    if (i.customId === 'monitor_refresh') {
      await i.deferReply({ ephemeral: true });
      const state = monitorState.get(i.guild.id);
      if (!state) return i.editReply('⚠️ No monitor. Run `/setup-monitoring` first.');
      await refreshMonitor(i.guild);
      return i.editReply('✅ Cluster stats refreshed.');
    }

    if (i.customId === 'monitor_players') {
      await i.deferReply({ ephemeral: true });
      const statuses = await fetchServerStatus(MONITOR_SERVERS);
      const active   = statuses.filter(s => s.status === 'online' && s.players > 0);
      if (!active.length) return i.editReply('👻 No players online right now.');
      const total  = active.reduce((sum,s) => sum+s.players, 0);
      const fields = active.map(s => ({name:`${s.emoji} ${s.name}`,value:`${s.players}/${s.maxPlayers} online`,inline:true}));
      return i.editReply({ embeds: [base(`👥 ${total} Online`, C.cy).addFields(...fields.slice(0,25)).setTimestamp()] });
    }

    if (i.customId === 'open_ticket') {
      try {
        await i.deferReply({ ephemeral: true });
        const name = `ticket-${i.user.username.toLowerCase().replace(/[^a-z0-9]/g,'-')}-${Date.now().toString(36)}`;
        const ch   = await i.guild.channels.create({
          name, topic: `Support — ${i.user.tag} — Opened <t:${Math.floor(Date.now()/1000)}:F>`,
          permissionOverwrites: [
            { id: i.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
            ...(ROLE_ADMIN_ID ? [{ id: ROLE_ADMIN_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
            ...(ROLE_OWNER_ID ? [{ id: ROLE_OWNER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
          ],
        });
        const closeRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger));
        await ch.send({ content: `<@${i.user.id}> Welcome! Describe your issue below.`, embeds: [base(`🎫 Ticket — ${i.user.username}`,C.gr).addFields({name:'⏰ Opened',value:`<t:${Math.floor(Date.now()/1000)}:F>`,inline:true},{name:'⚡ Response',value:'Within 24 hours',inline:true})], components: [closeRow] });
        return i.editReply({ content: `✅ Ticket: ${ch}` });
      } catch (e) { try { await i.editReply({ content: `⚠️ ${e.message}` }); } catch {} }
    }

    if (i.customId === 'close_ticket') {
      if (!isMod(i.member)) { await i.reply({ content: '⛔ Moderators only.', ephemeral: true }); return; }
      await i.reply({ content: '🔒 Closing in 5 seconds...' });
      setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }
    return;
  }

  if (!i.isChatInputCommand()) return;
  const cmd = i.commandName;
  try { await i.deferReply(); } catch { return; }

  try {

    // ── MUSIC COMMANDS ──
    if (musicRuntime) {
      const handled = await musicRuntime.handleMusicCommand(i, bot).catch(e => {
        console.error('[Music cmd]', e.message);
        i.editReply('⚠️ Music error: ' + e.message.slice(0,120)).catch(() => {});
        return true;
      });
      if (handled) return;
    }

    // ── ECONOMY ──
    if (cmd === 'wallet' || cmd === 'curr') return await handleWallet(i);

    if (cmd === 'clvsd') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const sub    = i.options.getSubcommand();
      const target = i.options.getUser('user');
      const amount = i.options.getInteger('amount') || 0;
      const reason = i.options.getString('reason') || 'Admin action';
      const me     = i.user;

      if (sub === 'grant') {
        const w = await grantShards(target.id, target.username, amount, reason, me.id, me.username);
        try { await target.send({ embeds: [base('💎 Shards Received!',C.gr).setDescription(`**${me.username}** granted you **${amount.toLocaleString()} 💎**\n📝 *${reason}*`)] }); } catch {}
        return i.editReply({ embeds: [walletEmbed(`🎁 Granted ${amount.toLocaleString()} to ${target.username}`,w,C.gr).addFields({name:'📝 Reason',value:reason,inline:true},{name:'👮 By',value:me.username,inline:true})] });
      }
      if (sub === 'deduct') {
        const w = await deductShards(target.id, target.username, amount, reason, me.id, me.username);
        return i.editReply({ embeds: [walletEmbed(`⬇️ Deducted ${amount.toLocaleString()} from ${target.username}`,w,C.rd)] });
      }
      if (sub === 'check') {
        const w    = await getWallet(target.id, target.username);
        const rows = await getHistory(target.id, 5);
        const emb  = walletEmbed(`🔍 Admin — ${target.username}`,w,C.cy).setThumbnail(target.displayAvatarURL());
        if (rows.length) emb.addFields({name:'🕓 Last 5',value:rows.map(r=>`${TX_ICO[r.action]||'💠'} **${['transfer_in','grant','earn','daily_claim'].includes(r.action)?'+':'-'}${r.amount.toLocaleString()}** · ${r.note||r.action}`).join('\n')});
        return i.editReply({ embeds: [emb] });
      }
      if (sub === 'set') {
        await getWallet(target.id, target.username);
        const { data: cur } = await sb.from('aegis_wallets').select('wallet_balance').eq('discord_id', target.id).single();
        const prev = cur?.wallet_balance || 0;
        const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance: amount, updated_at: new Date().toISOString() }).eq('discord_id', target.id).select().single();
        if (error) return i.editReply(`⚠️ ${error.message}`);
        await logTx(target.id, target.username, 'admin_set', Math.abs(amount-prev), amount, `Set to ${amount} — ${reason}`, me.id, me.username);
        return i.editReply({ embeds: [base(`🔧 Wallet Set — ${target.username}`,C.pk).addFields({name:'⬅️ Previous',value:`${prev.toLocaleString()} 💎`,inline:true},{name:'➡️ New',value:`${amount.toLocaleString()} 💎`,inline:true},{name:'📝 Reason',value:reason})] });
      }
      if (sub === 'top') {
        const rows = await getLeaderboard(15);
        const med  = ['🥇','🥈','🥉'];
        const lines = rows.map((r,idx) => `${med[idx]||`**${idx+1}.**`} **${r.discord_tag||r.discord_id}** — **${((r.wallet_balance||0)+(r.bank_balance||0)).toLocaleString()}**`).join('\n');
        return i.editReply({ embeds: [base('🏆 Top 15 Holders',C.gold).setDescription(lines||'No wallets yet.')] });
      }
      if (sub === 'stats') {
        const s = await getSupply();
        const { data: recent } = await sb.from('aegis_wallet_ledger').select('action,amount,created_at').order('created_at',{ascending:false}).limit(5);
        const emb = base('📊 Economy Stats',C.pk).addFields({name:'💎 Wallets',value:s.walletTotal.toLocaleString(),inline:true},{name:'🏦 Banks',value:s.bankTotal.toLocaleString(),inline:true},{name:'∑ Total',value:(s.walletTotal+s.bankTotal).toLocaleString(),inline:true},{name:'👥 Holders',value:s.holders+'',inline:true});
        if (recent?.length) emb.addFields({name:'🕓 Recent',value:recent.map(r=>`${TX_ICO[r.action]||'💠'} **${r.action}** · ${r.amount.toLocaleString()}`).join('\n')});
        return i.editReply({ embeds: [emb] });
      }
      if (sub === 'usage') {
        if (!sb || !sbOk()) return i.editReply('⚠️ Database unavailable.');
        const { data } = await sb.from('aegis_ai_usage').select('model,input_tokens,output_tokens,used_search,created_at').order('created_at',{ascending:false}).limit(50);
        if (!data?.length) return i.editReply('📭 No AI usage logged yet.');
        const totIn  = data.reduce((s,r)=>s+(r.input_tokens||0),0);
        const totOut = data.reduce((s,r)=>s+(r.output_tokens||0),0);
        const haiku  = data.filter(r=>r.model?.includes('haiku'));
        const sonnet = data.filter(r=>r.model?.includes('sonnet'));
        const searched = data.filter(r=>r.used_search).length;
        // Approximate cost (Haiku: $0.80/$4 per 1M; Sonnet: $3/$15 per 1M)
        const haikuCost  = ((haiku.reduce((s,r)=>s+(r.input_tokens||0),0)*0.80 + haiku.reduce((s,r)=>s+(r.output_tokens||0),0)*4) / 1_000_000);
        const sonnetCost = ((sonnet.reduce((s,r)=>s+(r.input_tokens||0),0)*3 + sonnet.reduce((s,r)=>s+(r.output_tokens||0),0)*15) / 1_000_000);
        return i.editReply({ embeds: [base('🧠 AEGIS AI Usage (last 50)',C.cy)
          .addFields(
            {name:'📊 Total Calls',value:`${data.length}`,inline:true},
            {name:'🔤 Input Tokens',value:totIn.toLocaleString(),inline:true},
            {name:'📝 Output Tokens',value:totOut.toLocaleString(),inline:true},
            {name:'⚡ Haiku Calls',value:`${haiku.length} (~$${haikuCost.toFixed(4)})`,inline:true},
            {name:'🧠 Sonnet Calls',value:`${sonnet.length} (~$${sonnetCost.toFixed(4)})`,inline:true},
            {name:'🔍 With Search',value:`${searched}`,inline:true},
            {name:'💰 Est. Cost',value:`~$${(haikuCost+sonnetCost).toFixed(4)}`,inline:true},
          )] });
      }
    }

    if (cmd === 'weekly') {
      try {
        const { data: w, amount, streak } = await claimWeekly(i.user.id, i.user.username);
        return i.editReply({ embeds: [base('🌟 Weekly ClaveShard Claimed!',C.gold)
          .setThumbnail(i.user.displayAvatarURL())
          .setDescription(`**${i.user.username}** claimed their weekly reward!`)
          .addFields({name:'💎 Claimed',value:`**+${amount.toLocaleString()} shards**`,inline:true},{name:'🔥 Streak',value:`Week ${streak}`,inline:true},{name:'💰 Balance',value:`${(w.wallet_balance||0).toLocaleString()} shards`,inline:true})
          .setFooter({text:`Week ${streak} · Next claim in 7 days!`})] });
      } catch (e) { return i.editReply(e.message); }
    }

    if (cmd === 'leaderboard') {
      if (!sb) return i.editReply('⚠️ Economy offline.');
      const rows = await getLeaderboard(10);
      if (!rows?.length) return i.editReply({ embeds: [base('🏆 Leaderboard',C.gold).setDescription('No data yet!')] });
      const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
      const lines  = rows.map((r,idx) => `${medals[idx]} **${r.discord_tag||'Unknown'}** — **${((r.wallet_balance||0)+(r.bank_balance||0)).toLocaleString()}** 💎`).join('\n');
      return i.editReply({ embeds: [base('🏆 ClaveShard Leaderboard',C.gold).setDescription(lines)] });
    }

    if (cmd === 'give') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const target = i.options.getUser('user');
      const amount = i.options.getInteger('amount');
      const reason = i.options.getString('reason') || 'Admin grant';
      const w = await grantShards(target.id, target.username, amount, reason, i.user.id, i.user.username);
      return i.editReply({ embeds: [base(`✅ Gave ${amount.toLocaleString()} 💎 to ${target.username}`,C.gr).setDescription(`Reason: ${reason}`)] });
    }

    if (cmd === 'order') {
      const tier = i.options.getInteger('tier'), plat = i.options.getString('platform'), srv = i.options.getString('server'), notes = i.options.getString('notes') || 'None';
      await axios.post(`${API_BASE}/orders`, { username: i.user.username, discordId: i.user.id, discordTag: i.user.username, item: `Tier ${tier} ClaveShard Pack`, cost: 'See website', mapName: srv, specifics: `Platform: ${plat}\n${notes}` }).catch(() => {});
      return i.editReply({ embeds: [base('📦 Order Received!',C.gold)
        .setDescription(`Your Tier **${tier}** order is in the Council queue.`)
        .addFields({name:'🎮 Platform',value:plat,inline:true},{name:'🗺️ Server',value:srv,inline:true},{name:'📝 Notes',value:notes},{name:'💳 Payment',value:'**$TheConclaveDominion** CashApp\n**$ANLIKESEF** Chime\n\nInclude your username in the payment note!'},{name:'⏱️ Fulfillment',value:'Council fulfills within 24-72 hours.'})
      ] });
    }

    if (cmd === 'fulfill') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const ref = i.options.getString('ref').toUpperCase();
      try {
        await axios.post(`${API_BASE}/api/orders/${ref}/fulfill`, { note: i.options.getString('note')||'Fulfilled' }, { headers: { Authorization: `Bearer ${ADMIN_TOKEN||''}` } });
        return i.editReply(`✅ Order **${ref}** marked as fulfilled.`);
      } catch { return i.editReply(`⚠️ Could not update **${ref}** — check admin panel.`); }
    }

    if (cmd === 'shard') return i.editReply({ embeds: [base('💠 ClaveShard Shop Tiers',C.gold)
      .setDescription('Each tier costs its tier number in ClaveShard.\nPay via **$TheConclaveDominion** CashApp or **$ANLIKESEF** Chime, then use `/order`.')
      .addFields(
        {name:'💠 T1 · 1 CLVSD',value:'L600 Vanilla Dino · Max XP · 3 Stacks Ammo · Full Dino Coloring · 100 Kibble/Cakes · 100% Imprint · 500 Structures · Cryofridge+120 Pods · Revival Token 48hr',inline:false},
        {name:'💎 T2 · 2 CLVSD',value:'Modded L600 Dino · L600 Allowed Dino · L500 Random Shiny · L500 Shiny Shoulder · 60 Dedicated Storage',inline:false},
        {name:'✨ T3 · 3 CLVSD',value:'Tek Blueprint · 1 Shiny Essence · 200% Imprint · L600 T1 Special Shiny',inline:false},
        {name:'🔥 T5 · 5 CLVSD',value:'Boss Defeat Command · Bronto/Dread+Saddle · L1000 Dino · L100 Shiny Essence · L800 T2 Shiny · Small Bundle 250k Resources',inline:false},
        {name:'⚔️ T6–T8',value:'T6: Boss Ready Bundle · L1250 Breeding Pair · 250% Imprint\nT8: Medium Bundle 100k Resources',inline:false},
        {name:'🛡️ T10–T12',value:'T10: Tek Suit Set · Floating Platform · Combo Shiny Essence\nT12: Large Bundle 200k Resources',inline:false},
        {name:'👑 T15–T20–T30',value:'T15: 30k Element · L1500 Rare Dinos · XL Bundle 300k\nT20: Behemoth Gate Expansion\nT30: Dedicated Storage Refill · 1.6M Resources',inline:false},
        {name:'🛡️ Dino Insurance',value:'One-time use · Must be named · Open a ticket to activate',inline:false},
      )
    ] });

    if (cmd === 'shop') {
      try {
        const r = await axios.get(`${API_BASE}/api/shop`, { timeout: 6000 });
        const items = r.data.items || [];
        if (!items.length) return i.editReply({ embeds: [base('🛍️ ClaveShard Shop',C.gold).setDescription('Shop being stocked. Visit theconclavedominion.com/shop.html or use `/shard`.')] });
        const fields = items.slice(0,10).map(item => ({name:`${item.image_emoji||'💎'} ${item.name}`,value:`${(item.description||'').slice(0,60)}\n**${item.price_label||(item.price===0?'Free':'$'+item.price)}**`,inline:true}));
        return i.editReply({ embeds: [base('🛍️ ClaveShard Shop',C.gold).setDescription('Full catalog: theconclavedominion.com/shop.html').addFields(...fields)] });
      } catch { return i.editReply({ embeds: [base('🛍️ ClaveShard Shop',C.gold).setDescription('Use `/shard` for tier list or visit theconclavedominion.com/shop.html')] }); }
    }

    // ── AI ──
    if (cmd === 'aegis' || cmd === 'ask') {
      const w = checkRate(i.user.id, 6000);
      if (w) return i.editReply(`⏳ Slow down, Survivor. Retry in ${w}s.`);
      const r = await askAegis(i.options.getString('question'), i.user.id);
      return i.editReply(r.slice(0,1990));
    }

    if (cmd === 'forget') { clearHist(i.user.id); return i.editReply('🧹 AEGIS conversation history cleared. Fresh start, Survivor.'); }

    if (cmd === 'ai-cost') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      if (!sb || !sbOk()) return i.editReply('⚠️ Database unavailable.');
      const { data } = await sb.from('aegis_ai_usage').select('model,input_tokens,output_tokens,used_search').order('created_at',{ascending:false}).limit(500);
      if (!data?.length) return i.editReply('📭 No usage data yet.');
      const haiku  = data.filter(r=>r.model?.includes('haiku'));
      const sonnet = data.filter(r=>r.model?.includes('sonnet'));
      const hIn  = haiku.reduce((s,r)=>s+(r.input_tokens||0),0);
      const hOut = haiku.reduce((s,r)=>s+(r.output_tokens||0),0);
      const sIn  = sonnet.reduce((s,r)=>s+(r.input_tokens||0),0);
      const sOut = sonnet.reduce((s,r)=>s+(r.output_tokens||0),0);
      const hCost = (hIn*0.80+hOut*4)/1_000_000;
      const sCost = (sIn*3+sOut*15)/1_000_000;
      return i.editReply({ embeds: [base('💸 AEGIS AI Cost Dashboard',C.mag)
        .addFields(
          {name:'📊 Total Requests',value:`${data.length}`,inline:true},
          {name:'🔍 With Web Search',value:`${data.filter(r=>r.used_search).length}`,inline:true},
          {name:'',value:'',inline:false},
          {name:'⚡ Haiku (fast)',value:`${haiku.length} calls\n${hIn.toLocaleString()} in / ${hOut.toLocaleString()} out\n~$${hCost.toFixed(4)}`,inline:true},
          {name:'🧠 Sonnet (smart)',value:`${sonnet.length} calls\n${sIn.toLocaleString()} in / ${sOut.toLocaleString()} out\n~$${sCost.toFixed(4)}`,inline:true},
          {name:'💰 Total Estimated',value:`**~$${(hCost+sCost).toFixed(4)}**`,inline:false},
        )] });
    }

    // ── SERVERS / INFO ──
    if (cmd === 'servers') {
      const statuses = await fetchServerStatus(MONITOR_SERVERS);
      const filter   = i.options.getString('map')?.toLowerCase();
      const list     = filter ? statuses.filter(s => s.name.toLowerCase().includes(filter)) : statuses;
      if (!list.length) return i.editReply('⚠️ No results.');
      const on  = list.filter(s => s.status === 'online');
      const off = list.filter(s => s.status !== 'online');
      const lines = [
        ...on.map(s => `🟢 **${s.emoji} ${s.name}** · \`${s.players}/${s.maxPlayers}\` · \`${s.ip}:${s.port}\`${s.pvp?' ⚔️':s.patreon?' ⭐':''}`),
        ...off.map(s => `🔴 **${s.emoji} ${s.name}** · Offline`),
      ].join('\n');
      return i.editReply({ embeds: [base('⚔️ TheConclave — Live Cluster',C.gold).setDescription(lines).addFields({name:'✅ Online',value:`${on.length}/${list.length}`,inline:true},{name:'⏰ Updated',value:`<t:${Math.floor(Date.now()/1000)}:R>`,inline:true})] });
    }

    if (cmd === 'map') {
      const MAPS = {
        island:     {title:'🌿 The Island',ip:'217.114.196.102:5390',desc:'Classic ARK. Beginner-friendly, all biomes, starter bosses.',tags:'Beginner · All Resources · Boss Arenas',pvp:false,patreon:false},
        volcano:    {title:'🌋 Volcano',ip:'217.114.196.59:5050',desc:'High-resource volcanic biome. Rich minerals and challenging terrain.',tags:'Intermediate · High Resources',pvp:false,patreon:false},
        extinction: {title:'🌑 Extinction',ip:'31.214.196.102:6440',desc:'End-game. Titan bosses, corrupted dinos, Element farming.',tags:'End-Game · Titans · Element',pvp:false,patreon:false},
        center:     {title:'🏔️ The Center',ip:'31.214.163.71:5120',desc:'Floating islands and vast ocean caves.',tags:'Mid-Game · Unique Biomes',pvp:false,patreon:false},
        lostcolony: {title:'🪐 Lost Colony',ip:'217.114.196.104:5150',desc:'Post-colony world with unique loot and aberrant creatures.',tags:'Custom · Unique Spawns',pvp:false,patreon:false},
        astraeos:   {title:'✨ Astraeos',ip:'217.114.196.9:5320',desc:'Celestial landscape with rare crystal resources.',tags:'Custom · Rare Resources',pvp:false,patreon:false},
        valguero:   {title:'🏞️ Valguero',ip:'85.190.136.141:5090',desc:'Aberration zones, Deinonychus nests, beautiful landscape.',tags:'Mid-Game · Deinonychus · Aberration Zone',pvp:false,patreon:false},
        scorched:   {title:'☀️ Scorched Earth',ip:'217.114.196.103:5240',desc:'Harsh desert. Wyverns, Manticore boss, dust storms.',tags:'Wyverns · Desert · Manticore',pvp:false,patreon:false},
        aberration: {title:'⚔️ Aberration',ip:'217.114.196.80:5540',desc:'Underground PvP. Rock Drakes, Reapers, highest risk/reward.',tags:'⚔️ PvP · Rock Drakes · Reapers',pvp:true,patreon:false},
        amissa:     {title:'⭐ Amissa',ip:'217.114.196.80:5180',desc:'Exclusive Patreon-only map. Premium experience, small community.',tags:'⭐ Patreon Exclusive · Premium',pvp:false,patreon:true},
      };
      const m = MAPS[i.options.getString('name')];
      if (!m) return i.editReply('⚠️ Map not found.');
      const emb = base(m.title, m.pvp ? C.rd : m.patreon ? C.gold : C.cy)
        .addFields({name:'🌐 Connect',value:`\`${m.ip}\``,inline:true},{name:'🏷️ Type',value:m.tags,inline:true},{name:'📝 About',value:m.desc},{name:'🔗 How to Join',value:'ARK → Sessions → Join by IP → paste the IP above.'});
      if (m.pvp)     emb.addFields({name:'⚠️ PvP Notice',value:'PvP is enabled. Highest risk in the cluster.'});
      if (m.patreon) emb.addFields({name:'⭐ Patreon Required',value:'Elite Patron ($20/mo). Visit patreon.com/theconclavedominion'});
      return i.editReply({ embeds: [emb] });
    }

    if (cmd === 'info') return i.editReply({ embeds: [base('⚔️ TheConclave Dominion',C.pl)
      .setDescription('5× crossplay ARK: Survival Ascended — all platforms, all maps, one community.')
      .addFields(
        {name:'🌍 Crossplay',value:'Xbox · PlayStation · PC',inline:true},
        {name:'⚡ Rates',value:'5× XP · Harvest · Taming · Breed',inline:true},
        {name:'⚙️ Config',value:'1M Weight · No Fall Dmg · Max Dino 350',inline:true},
        {name:'🗺️ 10 Maps',value:'Island · Volcano · Extinction · Center · Lost Colony · Astraeos · Valguero · Scorched · Aberration (PvP) · Amissa (Patreon)'},
        {name:'🔧 Mods',value:'Death Inventory Keeper · ARKomatic · Awesome Spyglass · Teleporter'},
        {name:'💎 Economy',value:'`/weekly` 3 free shards/week · `/wallet balance` · `/order` to shop'},
        {name:'🌐 Links',value:'[Website](https://theconclavedominion.com) · [Discord](https://discord.gg/theconclave) · [Patreon](https://patreon.com/theconclavedominion)'},
      )
    ] });

    if (cmd === 'rules') return i.editReply({ embeds: [base('📜 TheConclave Codex',C.pl)
      .setDescription('All members must follow these rules. Violations: Warning → Timeout → Ban.')
      .addFields(
        {name:'1. Respect',value:'No harassment, hate speech, racism, or toxic targeting.'},
        {name:'2. No Griefing',value:'No destroying or stealing on PvE maps. PvP = Aberration only.'},
        {name:'3. No Cheating',value:'No mesh builds, duplication, or exploit abuse. Instant permanent ban.'},
        {name:'4. Limits',value:'Max 500 tamed dinos per tribe. Reasonable base footprint. Abandoned structures demolished after 2 weeks.'},
        {name:'5. Staff Final',value:'Council rulings are final. Disputes go to #support-tickets.'},
        {name:'6. No Advertising',value:'No other server promotion without explicit Council approval.'},
        {name:'⚠️ Penalties',value:'Warning → 24h Timeout → 7d Timeout → Permanent Ban\nCheating/hate speech = immediate permanent ban.'},
        {name:'🌐 Full Codex',value:'theconclavedominion.com/terms.html'},
      )
    ] });

    if (cmd === 'rates') return i.editReply({ embeds: [base('📈 Cluster Rates — 5× Everything',C.cy)
      .addFields(
        {name:'⚡ XP',value:'5×',inline:true},{name:'🪓 Harvest',value:'5×',inline:true},{name:'🦴 Taming',value:'5×',inline:true},
        {name:'🥚 Breeding',value:'5×',inline:true},{name:'🏋️ Weight',value:'1,000,000',inline:true},{name:'🦕 Max Dino',value:'Lvl 350',inline:true},
        {name:'💀 Fall DMG',value:'Off',inline:true},{name:'🌐 Crossplay',value:'Xbox · PS · PC',inline:true},{name:'🗺️ Maps',value:'10 servers',inline:true},
      )
    ] });

    if (cmd === 'mods') return i.editReply({ embeds: [base('🔧 Active Cluster Mods',C.cy)
      .addFields(
        {name:'☠️ Death Inventory Keeper',value:'Your inventory stays put when you die.'},
        {name:'🤖 ARKomatic',value:'Quality of life improvements across all maps.'},
        {name:'🔭 Awesome Spyglass',value:'Enhanced spyglass showing dino stats and more.'},
        {name:'🌀 Awesome Teleporter',value:'Place teleporters to fast-travel across maps.'},
      )
    ] });

    if (cmd === 'wipe') return i.editReply({ embeds: [base('📅 Wipe Schedule',C.mag)
      .setDescription('Wipe dates announced **1 week in advance** in <#announcements>.')
      .addFields(
        {name:'🗺️ PvE Maps',value:'No scheduled wipes. Maps persist until major updates require it.'},
        {name:'⚔️ Aberration PvP',value:'Seasonal wipes. Check Discord for current season end date.'},
        {name:'⭐ Amissa',value:'No wipes — patron-protected server.'},
      )
    ] });

    if (cmd === 'transfer-guide') return i.editReply({ embeds: [base('🔄 Cross-ARK Transfer Guide',C.cy)
      .addFields(
        {name:'Step 1',value:'Go to an **Obelisk**, Supply Drop, or **TEK Transmitter**'},
        {name:'Step 2',value:'Open Terminal → **"Travel to Another Server"**'},
        {name:'Step 3',value:'Select the destination Conclave map from the list'},
        {name:'Step 4',value:'Upload your survivor + dinos/items (each has a 24h timer)'},
        {name:'⚠️ Notes',value:'Some items may not transfer between all maps. Downloads at Obelisks on destination.'},
      )
    ] });

    if (cmd === 'crossplay') return i.editReply({ embeds: [base('🎮 Crossplay Connection Guide',C.cy)
      .addFields(
        {name:'🎮 Xbox / Microsoft Store',value:'Search **TheConclave** in the unofficial server browser, or connect by IP via network settings.'},
        {name:'🎯 PlayStation',value:'Use in-game unofficial server browser and search **TheConclave**.'},
        {name:'💻 PC (Steam/Epic)',value:'Add as favorite in ARK server browser. All 10 IPs at theconclavedominion.com/ark'},
        {name:'📋 Quick IP',value:'**The Island:** 217.114.196.102:5390 · All IPs → `/servers`'},
        {name:'🔧 Still stuck?',value:'Use `/ticket` to open a private support channel.'},
      )
    ] });

    if (cmd === 'patreon') return i.editReply({ embeds: [base('⭐ Support on Patreon',C.gold)
      .setDescription('Help keep **10 servers** running for the entire community.')
      .addFields(
        {name:'🌟 Supporter · $5/mo',value:'● Supporter role\n● Early access to events\n● Special badge in Discord'},
        {name:'💎 Patron · $10/mo',value:'● All above\n● Monthly ClaveShard bonus\n● Exclusive Patron channel'},
        {name:'⭐ Elite Patron · $20/mo',value:'● All above\n● **Amissa server access** (exclusive map)\n● Priority Council support\n● Name in credits'},
        {name:'🔗 Links',value:'[Patreon](https://patreon.com/theconclavedominion) · **$TheConclaveDominion** CashApp · **$ANLIKESEF** Chime'},
      )
    ] });

    if (cmd === 'forums') return i.editReply({ embeds: [base('🗂️ Forum Panels',C.cy)
      .addFields(
        {name:'🌋 ARK Help',value:'#ark-help · #taming-guides · #base-builds · #mod-help',inline:true},
        {name:'💬 Community',value:'#general · #introductions · #media · #off-topic',inline:true},
        {name:'💎 ClaveShard',value:'#shard-requests · #trade-post · #giveaways',inline:true},
        {name:'👁️ Council',value:'#patch-notes · #server-updates · #announcements',inline:true},
        {name:'🎮 ARK Servers',value:'#server-status · #connection-help · #cluster-chat',inline:true},
        {name:'🎫 Support',value:'#open-a-ticket · #report-a-player · #appeals',inline:true},
      )
    ] });

    if (cmd === 'tip') {
      const TIPS = [
        'Put points into **Weight** on your first few levels — you can never have too much.',
        'On our 5× cluster, **imprinting** is 5× faster too. Set timers, never miss a cuddle!',
        'Use a **Whip** to grab items off the ground while mounted. Huge QoL upgrade.',
        'Baby dinos eat roughly **5× faster** on boosted servers. Always prep plenty of food.',
        '**Element** is shared across the cluster via transfers. Farm on Extinction, use anywhere.',
        'The **Aberration** server is PvP — cross over prepared or you\'ll be looted.',
        'Amissa is **Patreon-exclusive** — extra protections, smaller community, premium feel.',
        'Type `/weekly` in Discord every 7 days for 3 free ClaveShards — never miss it!',
        'Tame an **Anky** first — metal and crystal farming makes everything easier.',
        'Beaver dams respawn faster when harvested completely. Leave nothing behind.',
        'Always back up your dinos in a cryo pod before server transfers.',
        '**Crystal Isles** and **Lost Colony** are great starter maps — fewer predators near spawn.',
      ];
      return i.editReply({ embeds: [base('💡 Dominion Tip',C.gold).setDescription(`> ${TIPS[Math.floor(Math.random()*TIPS.length)]}`).setFooter({text:'TheConclave Dominion · 5× Rates · 10 Maps'})] });
    }

    if (cmd === 'dino') {
      const name = i.options.getString('name');
      const DINOS = {
        rex:    {icon:'🦖',desc:'Top predator. Max wild 150. Best for bosses.',food:'Raw Mutton',kibble:'Rex Kibble',tame:'~2h at 150 on 5×'},
        giga:   {icon:'🦣',desc:'Strongest land dino. Rage mechanic.',food:'Raw Mutton',kibble:'Exceptional',tame:'4-6h at 150 on 5×'},
        wyvern: {icon:'🐉',desc:'Cannot tame — steal an egg from a nest. Raise on milk.',food:'Wyvern Milk',kibble:'N/A (egg steal)',tame:'Egg steal + imprint'},
        anky:   {icon:'⚒️',desc:'Best metal/crystal/flint harvester.',food:'Mejoberry',kibble:'Simple',tame:'~1h at 150 on 5×'},
        argy:   {icon:'🦅',desc:'Best all-around flyer. Great carry weight.',food:'Raw Mutton',kibble:'Regular',tame:'~1.5h at 150 on 5×'},
        bronto: {icon:'🦕',desc:'Best berry harvester. Saddle is a mobile base.',food:'Crops',kibble:'Superior',tame:'~3h at 150 on 5×'},
      };
      const key   = name.toLowerCase().replace(/[^a-z]/g,'');
      const found = DINOS[key] || Object.entries(DINOS).find(([k])=>k.startsWith(key.slice(0,3)))?.[1];
      if (found) {
        return i.editReply({ embeds: [base(`${found.icon} ${name.charAt(0).toUpperCase()+name.slice(1)}`,C.cy)
          .addFields({name:'📋 About',value:found.desc},{name:'🍖 Best Food',value:found.food,inline:true},{name:'🥣 Kibble',value:found.kibble,inline:true},{name:'⏱️ Tame Time',value:found.tame,inline:true},{name:'💡 Tip',value:'5× rates mean tame times are 5× faster than official!'})
        ] });
      }
      if (anthropic) {
        try {
          const msg = await anthropic.messages.create({ model: MODEL_FAST, max_tokens: 400, messages: [{ role: 'user', content: `Brief ARK Survival Ascended tame guide for ${name} on a 5× server. Include best food, kibble, tame time at lvl 150 on 5× rates, and 1 tip. Under 200 words.` }] });
          return i.editReply({ embeds: [base(`🦕 ${name.charAt(0).toUpperCase()+name.slice(1)} — Tame Guide`,C.cy).setDescription(msg.content[0].text).setFooter({text:'Powered by AEGIS AI · 5× Rates'})] });
        } catch {}
      }
      return i.editReply({ embeds: [base('🦕 Dino Lookup',C.cy).setDescription(`No data for **${name}**. Try /aegis for detailed info!`)] });
    }

    if (cmd === 'help') {
      const categories = [
        {name:'💎 Economy',value:'`/wallet` `/curr` `/weekly` `/clvsd` `/order` `/shard` `/shop` `/leaderboard` `/give` `/fulfill`'},
        {name:'🧠 AI & Info',value:'`/aegis` `/ask` `/forget` `/ai-cost` `/servers` `/map` `/info` `/rules` `/rates` `/mods` `/wipe` `/transfer-guide` `/crossplay` `/patreon` `/tip` `/dino`'},
        {name:'🎖️ Profile & Social',value:'`/profile` `/rank` `/rep` `/trade` `/online` `/clipscore` `/coords` `/forums`'},
        {name:'📢 Moderation',value:'`/announce` `/event` `/warn` `/ban` `/timeout` `/role` `/ticket` `/report` `/warn-history` `/purge` `/slowmode` `/lock`'},
        {name:'🎲 Tools',value:'`/poll` `/giveaway` `/remind` `/roll` `/coinflip` `/calc` `/whois` `/serverinfo`'},
        {name:'📡 Monitoring',value:'`/setup-monitoring` `/monitor-refresh` `/monitor-add`'},
        {name:'🔐 Beacon Sentinel',value:'`/beacon-setup` `/tribes` `/player-lookup` `/sentinel-bans`'},
        {name:'🎵 Music',value:'`/music play` `/music search` `/music queue` `/music skip` `/music volume` `/music room` `/music launchpad` and more'},
        {name:'🔗 Links',value:'[Website](https://theconclavedominion.com) · [Discord](https://discord.gg/theconclave) · [Patreon](https://patreon.com/theconclavedominion)'},
      ];
      return i.editReply({ embeds: [base('📖 AEGIS Command Reference',C.pl).setDescription(`**${cmds.length} commands** available.\nUse \`/aegis [question]\` to ask anything!`).addFields(...categories)] });
    }

    if (cmd === 'ping') {
      const start = Date.now(); let apiMs = '—';
      try { const t = Date.now(); await axios.get(`${API_BASE}/health`,{timeout:5000}); apiMs = `${Date.now()-t}ms`; } catch {}
      return i.editReply({ embeds: [base('🏓 Pong!',C.gr)
        .addFields(
          {name:'💓 WS Heartbeat',value:`${bot.ws.ping}ms`,inline:true},
          {name:'🌐 API Latency',value:apiMs,inline:true},
          {name:'⚡ Command',value:`${Date.now()-start}ms`,inline:true},
          {name:'📊 Status',value:bot.ws.ping<100?'🟢 Excellent':bot.ws.ping<200?'🟡 Good':'🔴 Degraded',inline:true},
          {name:'🤖 Model',value:`Haiku fast / Sonnet smart`,inline:true},
          {name:'💾 DB',value:sb?(sbOk()?'🟢 OK':'🔴 CB Open'):'⚠️ No DB',inline:true},
        )] });
    }

    // ── PROFILE / SOCIAL ──
    if (cmd === 'profile') {
      const target = i.options.getUser('user') || i.user;
      const member = await i.guild.members.fetch(target.id).catch(() => null);
      let wallet = null;
      if (sb && sbOk()) { try { const { data } = await sb.from('aegis_wallets').select('*').eq('discord_id',target.id).single(); wallet = data; } catch {} }
      const roles     = member?.roles.cache.filter(r=>r.id!==i.guild.id).sort((a,b)=>b.position-a.position).first(5).map(r=>`<@&${r.id}>`).join(' ') || 'None';
      const joinedDays = member?.joinedAt ? Math.floor((Date.now()-member.joinedAt)/(1000*60*60*24)) : 0;
      const emb = base(`🎖️ ${target.username}'s Profile`,C.pl).setThumbnail(target.displayAvatarURL({size:256}))
        .addFields({name:'📅 Member Since',value:member?.joinedAt?`<t:${Math.floor(member.joinedAt/1000)}:D>`:'Unknown',inline:true},{name:'📆 Days',value:`${joinedDays}`,inline:true},{name:'🆔 ID',value:target.id,inline:true},{name:'🎖️ Top Roles',value:roles});
      if (wallet) {
        const total = (wallet.wallet_balance||0)+(wallet.bank_balance||0);
        emb.addFields({name:'💎 Wallet',value:`${(wallet.wallet_balance||0).toLocaleString()}`,inline:true},{name:'🏦 Bank',value:`${(wallet.bank_balance||0).toLocaleString()}`,inline:true},{name:'💰 Total',value:`${total.toLocaleString()}`,inline:true},{name:'🔥 Streak',value:`Week ${wallet.daily_streak||0}`,inline:true},{name:'📈 Earned',value:`${(wallet.lifetime_earned||0).toLocaleString()}`,inline:true},{name:'📉 Spent',value:`${(wallet.lifetime_spent||0).toLocaleString()}`,inline:true});
      }
      return i.editReply({ embeds: [emb] });
    }

    if (cmd === 'rank') {
      if (!sb||!sbOk()) return i.editReply('⚠️ Database unavailable.');
      const { data: all } = await sb.from('aegis_wallets').select('discord_id,wallet_balance,bank_balance').order('wallet_balance',{ascending:false});
      const myW  = await getWallet(i.user.id, i.user.username);
      const pos  = all?.findIndex(w=>w.discord_id===i.user.id) ?? -1;
      const total = (myW.wallet_balance||0)+(myW.bank_balance||0);
      const rank  = total>=10000?'⚜️ Shard Lord':total>=5000?'💎 Shard Master':total>=1000?'🔷 Shard Knight':total>=500?'🔹 Shard Warrior':'⚪ Shard Novice';
      return i.editReply({ embeds: [base('📊 Your Rank',C.gold).setThumbnail(i.user.displayAvatarURL()).setDescription(`**${i.user.username}**\n${rank}`)
        .addFields({name:'💎 Wallet',value:`${(myW.wallet_balance||0).toLocaleString()}`,inline:true},{name:'🏦 Bank',value:`${(myW.bank_balance||0).toLocaleString()}`,inline:true},{name:'💰 Total',value:`${total.toLocaleString()}`,inline:true},{name:'🏆 Rank',value:pos>=0?`#${pos+1} of ${all.length}`:'Unranked',inline:true})] });
    }

    if (cmd === 'rep') {
      const target = i.options.getUser('user'), reason = i.options.getString('reason') || 'Being an awesome community member!';
      if (target.id === i.user.id) return i.editReply('❌ Cannot rep yourself!');
      if (target.bot) return i.editReply('❌ Bots don\'t need reputation.');
      if (sb && sbOk()) { try { await grantShards(target.id,target.username,10,`Rep from ${i.user.username}: ${reason}`,i.user.id,i.user.username); try { await target.send({ embeds: [base('⭐ You\'ve Been Repped!',C.gold).setDescription(`**${i.user.username}** gave you a rep point!\n📝 *"${reason}"*\n\n+10 ClaveShard bonus!`)] }); } catch {} } catch {} }
      return i.editReply({ embeds: [base('⭐ Rep Given!',C.gold).setDescription(`**${i.user.username}** repped **${target.username}**!\n📝 *"${reason}"*`).addFields({name:'💎 Bonus',value:'+10 ClaveShard to their wallet!',inline:true})] });
    }

    if (cmd === 'trade') {
      const offering = i.options.getString('offering'), lookingFor = i.options.getString('looking-for'), server = i.options.getString('server') || 'Any server';
      return i.editReply({ embeds: [base('🤝 Trade Request',C.gold).setDescription(`**${i.user.username}** is looking to trade!`)
        .addFields({name:'📦 Offering',value:offering,inline:true},{name:'🔍 Looking For',value:lookingFor,inline:true},{name:'🗺️ Server',value:server,inline:true},{name:'📬 Contact',value:`DM <@${i.user.id}> or reply here`})
        .setFooter({text:'TheConclave Trade Post · No scam protection'})] });
    }

    if (cmd === 'online') {
      let total = 0, description = '';
      if (beaconState.access) {
        try {
          const chars = await sentinelOnlinePlayers();
          if (chars.length) {
            total = chars.length;
            const by = {};
            for (const c of chars) { const s = c.serviceDisplayName||'Unknown'; if (!by[s]) by[s] = 0; by[s]++; }
            description = Object.entries(by).map(([s,n]) => `**${s}** — ${n} player${n>1?'s':''}`).join('\n');
          }
        } catch {}
      }
      if (!description) description = 'No live player data. Use `/servers` for server status.';
      return i.editReply({ embeds: [base(`👥 Online Now — ${total} Player${total!==1?'s':''}`,C.gr).setDescription(description).setFooter({text:'Live via Beacon Sentinel · TheConclave Dominion'})] });
    }

    if (cmd === 'clipscore') {
      const url = i.options.getString('url'), desc = i.options.getString('description') || 'No description.';
      const emb = base('🎬 Clip Submission',C.mag).setDescription(`**${i.user.username}** submitted a clip!`).addFields({name:'🔗 Link',value:url},{name:'📝 Description',value:desc},{name:'⭐ Vote',value:'React with ⭐ to support this clip!'}).setFooter({text:'TheConclave Clip of the Week · Council picks the winner'});
      const msg = await i.editReply({ embeds:[emb], fetchReply:true });
      await msg.react('⭐').catch(()=>{});
      return;
    }

    if (cmd === 'coords') {
      const location = i.options.getString('location'), map = i.options.getString('map') || 'current map';
      return i.editReply({ embeds: [base('📍 Coordinates',C.cy).setDescription(`**${location}** on ${map}`).addFields({name:'📋 Format',value:'**LAT LON** shown top-right of HUD\nExample: `52.3 / 48.1`'},{name:'💡 Tip',value:'Use 📍 in chat + coords so tribe/allies can find you fast'},{name:'🗺️ Map Overlays',value:'Visit ARK Smart Breeding or Dododex for detailed maps'})] });
    }

    // ── MODERATION ──
    if (cmd === 'announce') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const emb = new EmbedBuilder().setTitle(`📢 ${i.options.getString('title')}`).setDescription(i.options.getString('message')).setColor(C.gold).setFooter(FT).setTimestamp().setAuthor({name:i.user.username,iconURL:i.user.displayAvatarURL()});
      const ch  = i.guild.channels.cache.find(c=>c.name==='announcements') || i.channel;
      try { await ch.send({ content: i.options.getBoolean('ping') ? '@everyone' : undefined, embeds: [emb] }); } catch { await i.channel.send({ embeds: [emb] }); }
      try { await axios.post(`${API_BASE}/api/announcements`,{title:i.options.getString('title'),body:i.options.getString('message'),author:i.user.username},{headers:{Authorization:`Bearer ${ADMIN_TOKEN||''}`}}); } catch {}
      return i.editReply(`✅ Announcement sent to ${ch}!`);
    }

    if (cmd === 'event') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const title = i.options.getString('title'), desc = i.options.getString('description'), date = i.options.getString('date') || 'Date TBD';
      try { await axios.post(`${API_BASE}/api/events`,{title,description:desc,event_date:null,created_by:i.user.username},{headers:{Authorization:`Bearer ${ADMIN_TOKEN||''}`}}); } catch {}
      const emb = base(`📅 ${title}`,C.gold).setDescription(desc).addFields({name:'📆 When',value:date,inline:true},{name:'📌 By',value:i.user.username,inline:true}).setAuthor({name:'TheConclave Event',iconURL:i.user.displayAvatarURL()}).setFooter({text:'React with 🎉 to show interest! • TheConclave Dominion'});
      const annCh = i.guild.channels.cache.find(c=>c.name==='announcements'||c.name==='events') || i.channel;
      const msg = await annCh.send({ content: i.options.getBoolean('ping') ? '@everyone' : undefined, embeds: [emb] });
      try { await msg.react('🎉'); } catch {}
      return i.editReply(`✅ Event posted to ${annCh}!`);
    }

    if (cmd === 'warn') {
      if (!isMod(i.member)) return i.editReply('⛔ Moderators only.');
      const target = i.options.getUser('user'), reason = i.options.getString('reason');
      const warnEmb = base('⚠️ Formal Warning',C.rd).setDescription(`**${target.username}** was warned by **${i.user.username}**`).addFields({name:'📝 Reason',value:reason},{name:'⏰ Time',value:`<t:${Math.floor(Date.now()/1000)}:F>`});
      try { await target.send({ embeds: [base('⚠️ Warning — TheConclave',C.rd).setDescription(`You received a formal warning.\n📝 **${reason}**\n\nFurther violations may result in timeout or ban.`)] }); } catch {}
      try { const modCh = i.guild.channels.cache.find(c=>c.name==='mod-log'); if (modCh) await modCh.send({ embeds: [warnEmb] }); } catch {}
      if (sb && sbOk()) { (async () => { try { await sb.from('aegis_warnings').insert({ discord_id: target.id, discord_tag: target.username, reason, issued_by: i.user.id, issued_by_tag: i.user.username, created_at: new Date().toISOString() }); } catch {} })(); }
      return i.editReply({ embeds: [warnEmb] });
    }

    if (cmd === 'warn-history') {
      if (!isMod(i.member)) return i.editReply('⛔ Moderators only.');
      const target = i.options.getUser('user');
      if (!sb||!sbOk()) return i.editReply('⚠️ Database unavailable.');
      const { data: warns } = await sb.from('aegis_warnings').select('*').eq('discord_id',target.id).order('created_at',{ascending:false}).limit(20);
      if (!warns?.length) return i.editReply(`✅ No warnings on record for **${target.username}**.`);
      const lines = warns.map((w,idx) => `**${idx+1}.** <t:${Math.floor(new Date(w.created_at).getTime()/1000)}:D> · ${w.reason} · by ${w.issued_by_tag}`).join('\n');
      return i.editReply({ embeds: [base(`⚠️ Warnings — ${target.username}`,C.rd).setDescription(lines).addFields({name:'Total',value:`${warns.length} warning${warns.length!==1?'s':''}`,inline:true})] });
    }

    if (cmd === 'ban') {
      if (!isMod(i.member)) return i.editReply('⛔ Moderators only.');
      const t = i.options.getUser('user'), r = i.options.getString('reason');
      try {
        await i.guild.bans.create(t.id, { reason: `${i.user.username}: ${r}`, deleteMessageSeconds: 86400 });
        try { const modCh = i.guild.channels.cache.find(c=>c.name==='mod-log'); if (modCh) await modCh.send({ embeds: [base('🔨 Member Banned',C.rd).addFields({name:'👤 User',value:`${t.username} (${t.id})`,inline:true},{name:'👮 By',value:i.user.username,inline:true},{name:'📝 Reason',value:r})] }); } catch {}
        return i.editReply(`✅ **${t.username}** has been banned. Reason: ${r}`);
      } catch (e) { return i.editReply(`⚠️ Ban failed: ${e.message}`); }
    }

    if (cmd === 'timeout') {
      if (!isMod(i.member)) return i.editReply('⛔ Moderators only.');
      const t = i.options.getUser('user'), d = i.options.getString('duration'), r = i.options.getString('reason') || 'No reason';
      const MS = {'5m':300000,'1h':3600000,'6h':21600000,'24h':86400000,'7d':604800000};
      try { const m = await i.guild.members.fetch(t.id); await m.timeout(MS[d]||3600000, r); return i.editReply(`✅ **${t.username}** timed out for **${d}**. Reason: ${r}`); }
      catch (e) { return i.editReply(`⚠️ ${e.message}`); }
    }

    if (cmd === 'role') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const t = i.options.getUser('user'), role = i.options.getRole('role'), act = i.options.getString('action');
      try {
        const m = await i.guild.members.fetch(t.id);
        if (act === 'add') { await m.roles.add(role); return i.editReply(`✅ Added **${role.name}** to **${t.username}**.`); }
        else { await m.roles.remove(role); return i.editReply(`✅ Removed **${role.name}** from **${t.username}**.`); }
      } catch (e) { return i.editReply(`⚠️ ${e.message}`); }
    }

    if (cmd === 'ticket') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_ticket').setLabel('🎫 Open a Ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setLabel('📋 View Rules').setStyle(ButtonStyle.Link).setURL('https://theconclavedominion.com/terms.html'),
      );
      await i.channel.send({ embeds: [base('🎫 Support Center',C.cy).setDescription('Click below to open a private support ticket.\nCouncil responds within 24 hours.').addFields({name:'🆘 General Support',value:'Server issues, questions, help',inline:true},{name:'💎 ClaveShard Issues',value:'Orders, economy disputes',inline:true},{name:'🚨 Report a Player',value:'Rules violations, griefing, toxicity',inline:true})], components: [row] });
      return i.editReply('✅ Ticket panel posted.');
    }

    if (cmd === 'report') {
      const player = i.options.getUser('player'), reason = i.options.getString('reason'), srv = i.options.getString('server') || 'Not specified';
      const ref = `RPT-${Date.now().toString(36).toUpperCase()}`;
      const emb = base('🚨 Player Report',C.rd).setDescription(`**Reported by:** ${i.user.username} (${i.user.id})`).addFields({name:'👤 Reported',value:player?`${player.username} (${player.id})`:'Not specified',inline:true},{name:'🗺️ Server',value:srv,inline:true},{name:'📝 Reason',value:reason},{name:'📌 Ref',value:ref},{name:'⏰ Time',value:`<t:${Math.floor(Date.now()/1000)}:F>`});
      try { const modCh = i.guild.channels.cache.find(c=>c.name==='mod-log'||c.name==='council-chamber'); if (modCh) await modCh.send({ embeds: [emb] }); } catch {}
      return i.editReply({ embeds: [base('✅ Report Submitted',C.gr).setDescription('Report logged and forwarded to Council.').addFields({name:'📌 Reference',value:ref},{name:'⏱️ Response',value:'Typically within 24 hours'},{name:'📬 Urgent?',value:'Use `/ticket` for a private support channel'})], ephemeral: true });
    }

    if (cmd === 'purge') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const count = i.options.getInteger('count');
      const user  = i.options.getUser('user');
      try {
        let messages = await i.channel.messages.fetch({ limit: 100 });
        if (user) messages = messages.filter(m => m.author.id === user.id);
        const toDelete = [...messages.values()].slice(0, count).filter(m => Date.now() - m.createdTimestamp < 1209600000);
        await i.channel.bulkDelete(toDelete, true);
        return i.editReply(`✅ Deleted **${toDelete.length}** message${toDelete.length!==1?'s':''}${user?` from **${user.username}**`:''}.`);
      } catch (e) { return i.editReply(`⚠️ Purge failed: ${e.message}`); }
    }

    if (cmd === 'slowmode') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const seconds = i.options.getInteger('seconds');
      try { await i.channel.setRateLimitPerUser(seconds); return i.editReply(seconds === 0 ? '✅ Slowmode disabled.' : `✅ Slowmode set to **${seconds}s**.`); }
      catch (e) { return i.editReply(`⚠️ ${e.message}`); }
    }

    if (cmd === 'lock') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const action = i.options.getString('action'), reason = i.options.getString('reason') || 'No reason';
      try {
        const lock = action === 'lock';
        await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: lock ? false : null });
        return i.editReply(`${lock?'🔒':'🔓'} Channel **${lock?'locked':'unlocked'}**. Reason: ${reason}`);
      } catch (e) { return i.editReply(`⚠️ ${e.message}`); }
    }

    // ── TOOLS ──
    if (cmd === 'poll') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const opts = i.options.getString('options').split('|').map(o=>o.trim()).filter(Boolean).slice(0,10);
      if (opts.length < 2) return i.editReply('⚠️ Need at least 2 options separated by |');
      const L = ['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'];
      const emb = base(`📊 ${i.options.getString('question')}`,C.cy).setDescription(opts.map((o,j)=>`${L[j]} **${o}**`).join('\n\n')).setFooter({text:`Poll by ${i.user.username} • TheConclave Dominion`});
      const msg = await i.editReply({ embeds: [emb], fetchReply: true });
      for (let j = 0; j < opts.length; j++) { try { await msg.react(L[j]); } catch {} }
    }

    if (cmd === 'giveaway') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const prize = i.options.getString('prize'), dur = parseInt(i.options.getString('duration')||'86400'), winners = i.options.getInteger('winners')||1, reqRole = i.options.getRole('required_role');
      const endsAt = new Date(Date.now()+dur*1000);
      const emb = new EmbedBuilder().setTitle('🎁 GIVEAWAY').setColor(C.gold).setDescription(`**Prize:** ${prize}\n\nReact with 🎉 to enter!${reqRole?`\n\n⚠️ **Required role:** <@&${reqRole.id}>`:''}`)
        .addFields({name:'🏆 Winners',value:String(winners),inline:true},{name:'⏰ Ends',value:`<t:${Math.floor(endsAt/1000)}:R>`,inline:true},{name:'📌 Hosted By',value:i.user.username,inline:true}).setTimestamp(endsAt).setFooter(FT);
      const msg = await i.editReply({ embeds: [emb], fetchReply: true });
      try { await msg.react('🎉'); } catch {}
    }

    if (cmd === 'remind') {
      const message = i.options.getString('message'), timeStr = i.options.getString('time');
      const parseTime = (s) => { const n = parseFloat(s); if (s.endsWith('d')) return n*86400000; if (s.endsWith('h')) return n*3600000; if (s.endsWith('m')) return n*60000; return null; };
      const ms = parseTime(timeStr);
      if (!ms||ms<10000||ms>604800000) return i.editReply('⚠️ Time must be 10s–7d. Examples: `30m`, `2h`, `1d`');
      const fireAt = new Date(Date.now()+ms);
      await i.editReply({ embeds: [base('⏰ Reminder Set!',C.cy).setDescription(`I'll ping you <t:${Math.floor(fireAt/1000)}:R>!\n📝 *${message}*`)] });
      setTimeout(async () => {
        try { await i.user.send({ embeds: [base('⏰ Reminder!',C.cy).setDescription(`📝 *${message}*`)] }); }
        catch { const ch = i.channel; if (ch) await ch.send({ content:`<@${i.user.id}>`, embeds: [base('⏰ Reminder!',C.cy).setDescription(`📝 *${message}*`)] }).catch(()=>{}); }
      }, ms);
    }

    if (cmd === 'roll') {
      const notation = (i.options.getString('dice')||'d6').toLowerCase().replace(/\s/g,'');
      const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
      if (!match) return i.editReply('⚠️ Invalid notation. Try `d6`, `2d10`, `3d8+5`');
      const count2 = Math.min(parseInt(match[1]||'1'),20), sides = Math.min(parseInt(match[2]),1000), mod = parseInt(match[3]||'0');
      if (sides < 2) return i.editReply('⚠️ Dice must have at least 2 sides.');
      const rolls = Array.from({length:count2}, ()=>Math.floor(Math.random()*sides)+1);
      const sum   = rolls.reduce((a,b)=>a+b,0)+mod;
      const display = rolls.length>1 ? `[${rolls.join(', ')}]${mod?` ${mod>0?'+':''}${mod}`:''}` : `${rolls[0]}${mod?` ${mod>0?'+':''}${mod}`:''}`;
      return i.editReply({ embeds: [base(`🎲 ${notation.toUpperCase()}`,C.cy).setDescription(`**Result: ${sum}**\n${display}`).addFields({name:'Rolls',value:rolls.join(', '),inline:true},{name:'Total',value:`${sum}`,inline:true})] });
    }

    if (cmd === 'coinflip') {
      const result = Math.random()<0.5?'Heads':'Tails';
      return i.editReply({ embeds: [base(`🪙 ${result}!`,C.gold).setDescription(`${result==='Heads'?'🌕':'🌑'} The coin landed on **${result}**!`)] });
    }

    if (cmd === 'calc') {
      const expr = i.options.getString('expression');
      try {
        const san = expr.replace(/[^0-9+\-*/().% ^]/g,'');
        if (!san) return i.editReply('⚠️ Invalid expression.');
        const result = Function(`'use strict'; return (${san.replace(/\^/g,'**')})`)();
        if (!isFinite(result)) return i.editReply('⚠️ Result not finite.');
        return i.editReply({ embeds: [base('🔢 Calculator',C.cy).addFields({name:'Expression',value:`\`${expr}\``,inline:true},{name:'Result',value:`**${result.toLocaleString()}**`,inline:true})] });
      } catch { return i.editReply('⚠️ Invalid expression. Try: `100*5`, `2^10`, `(50+30)/4`'); }
    }

    if (cmd === 'whois') {
      const target = i.options.getUser('user');
      try {
        const member = await i.guild.members.fetch(target.id);
        const roles  = member.roles.cache.filter(r=>r.id!==i.guild.id).sort((a,b)=>b.position-a.position).first(8).map(r=>`<@&${r.id}>`).join(' ') || 'None';
        let wallet = null;
        if (sb&&sbOk()) { try { const { data } = await sb.from('aegis_wallets').select('wallet_balance,bank_balance,daily_streak').eq('discord_id',target.id).single(); wallet = data; } catch {} }
        const emb = base(`🔍 ${target.username}`,C.cy).setThumbnail(target.displayAvatarURL()).addFields({name:'📅 Joined',value:member.joinedAt?`<t:${Math.floor(member.joinedAt/1000)}:D>`:'Unknown',inline:true},{name:'📆 Created',value:`<t:${Math.floor(target.createdAt/1000)}:D>`,inline:true},{name:'🆔 ID',value:target.id,inline:true},{name:'🎖️ Roles',value:roles});
        if (wallet) emb.addFields({name:'💎 ClaveShard',value:`${((wallet.wallet_balance||0)+(wallet.bank_balance||0)).toLocaleString()} total · 🔥 Week ${wallet.daily_streak||0}`,inline:true});
        if (member.nickname) emb.addFields({name:'🏷️ Nickname',value:member.nickname,inline:true});
        return i.editReply({ embeds: [emb] });
      } catch (e) { return i.editReply(`⚠️ ${e.message}`); }
    }

    if (cmd === 'serverinfo') {
      const g = i.guild;
      await g.members.fetch().catch(()=>{});
      const online   = g.members.cache.filter(m=>m.presence?.status==='online'||m.presence?.status==='dnd'||m.presence?.status==='idle').size;
      const channels = g.channels.cache;
      return i.editReply({ embeds: [base(`🏠 ${g.name}`,C.pl).setThumbnail(g.iconURL()).addFields({name:'👥 Members',value:`${g.memberCount.toLocaleString()} · ${online} online`,inline:true},{name:'📅 Created',value:`<t:${Math.floor(g.createdAt/1000)}:D>`,inline:true},{name:'🆔 Guild ID',value:g.id,inline:true},{name:'📺 Channels',value:`${channels.filter(c=>c.type===0).size} text · ${channels.filter(c=>c.type===2).size} voice`,inline:true},{name:'🎭 Roles',value:`${g.roles.cache.size}`,inline:true},{name:'🌟 Features',value:'5× crossplay ARK · ClaveShard Economy · AEGIS AI · 10 Maps'})] });
    }

    // ── MONITORING ──
    if (cmd === 'setup-monitoring') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      await i.editReply('⚙️ Deploying Dominion Cluster Monitor...');
      try {
        const everyone  = i.guild.roles.everyone;
        const readOnly  = [{ id: everyone, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions] }, ...(ROLE_ADMIN_ID?[{id:ROLE_ADMIN_ID,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageMessages]}]:[]), ...(ROLE_OWNER_ID?[{id:ROLE_OWNER_ID,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageMessages]}]:[])];
        const voicePerms = [{ id: everyone, deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.SendMessages] }];
        const statuses  = await fetchServerStatus(MONITOR_SERVERS);
        const online    = statuses.filter(s=>s.status==='online');
        const total     = online.reduce((sum,s)=>sum+s.players,0);
        const cat = await i.guild.channels.create({ name: '⚡・DOMINION NETWORK', type: 4, permissionOverwrites: readOnly });
        const vOnline  = await i.guild.channels.create({ name: `🟢 Online: ${online.length} of 10`, type: 2, parent: cat.id, permissionOverwrites: voicePerms });
        await new Promise(r=>setTimeout(r,400));
        const vPlayers = await i.guild.channels.create({ name: `👥 Players: ${total} Live`, type: 2, parent: cat.id, permissionOverwrites: voicePerms });
        await new Promise(r=>setTimeout(r,400));
        for (const srv of statuses) {
          const isOn = srv.status === 'online';
          const name = isOn ? `${srv.emoji} ${srv.name} · ${srv.players}/${srv.maxPlayers}` : `🔴 ${srv.name} · Offline`;
          await i.guild.channels.create({ name, type: 2, parent: cat.id, permissionOverwrites: voicePerms });
          await new Promise(r=>setTimeout(r,500));
        }
        const statusCh = await i.guild.channels.create({ name: '📡・cluster-status', type: 0, parent: cat.id, topic: '⚡ Live ARK cluster — auto-updates every 5 min', permissionOverwrites: readOnly });
        const actCh    = await i.guild.channels.create({ name: '📊・player-activity', type: 0, parent: cat.id, topic: 'Live player activity across all 10 servers', permissionOverwrites: readOnly });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('monitor_refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('monitor_players').setLabel('👥 Who Is Online').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setLabel('🌐 Website').setStyle(ButtonStyle.Link).setURL('https://theconclavedominion.com'),
        );
        const msg = await statusCh.send({ embeds: [buildMonitorEmbed(statuses)], components: [row] });
        await actCh.send({ embeds: [new EmbedBuilder().setColor(0x7B2FFF).setTitle('📊 Player Activity Feed').setDescription('Player count changes appear here in real time.\nPowered by **Nitrado direct API**.').setFooter({text:'TheConclave Dominion • AEGIS Network Monitor'}).setTimestamp()] });
        monitorState.set(i.guild.id, { statusChannelId: statusCh.id, activityChannelId: actCh.id, messageId: msg.id, servers: [...MONITOR_SERVERS], prevStatuses: statuses });
        return i.editReply({ embeds: [base('⚡ Dominion Network Online',0x7B2FFF).setDescription('Full live cluster monitor deployed.').addFields({name:'🟢 Online',value:`${online.length}/10`,inline:true},{name:'👥 Players',value:`${total}`,inline:true},{name:'⏰ Refresh',value:'Every 5 min',inline:true},{name:'📡 Status Feed',value:`${statusCh}`,inline:true},{name:'📊 Activity Feed',value:`${actCh}`,inline:true})] });
      } catch (e) { return i.editReply(`⚠️ Setup failed: ${e.message}`); }
    }

    if (cmd === 'monitor-add') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const state = monitorState.get(i.guild.id);
      if (!state) return i.editReply('⚠️ Run `/setup-monitoring` first.');
      const name = i.options.getString('name'), ip = i.options.getString('ip'), port = i.options.getInteger('port');
      const emoji = i.options.getString('emoji')||'🖥️', pvp = i.options.getBoolean('pvp')||false, patreon = i.options.getBoolean('patreon')||false;
      const id = name.toLowerCase().replace(/[^a-z0-9]/g,'_');
      if (state.servers?.find(s=>s.ip===ip&&s.port===port)) return i.editReply(`⚠️ **${ip}:${port}** already monitored.`);
      state.servers = [...(state.servers||MONITOR_SERVERS), { id, name, emoji, ip, port, pvp, patreon }];
      await refreshMonitor(i.guild);
      return i.editReply({ embeds: [base(`✅ Added ${emoji} ${name}`,0x35ED7E).addFields({name:'🌐 IP',value:`\`${ip}:${port}\``,inline:true},{name:'⚔️ PvP',value:pvp?'Yes':'No',inline:true},{name:'⭐ Patreon',value:patreon?'Yes':'No',inline:true})] });
    }

    if (cmd === 'monitor-refresh') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      const state = monitorState.get(i.guild.id);
      if (!state) return i.editReply('⚠️ No monitor active. Run `/setup-monitoring` first.');
      await i.editReply('🔄 Forcing cluster refresh...');
      await refreshMonitor(i.guild);
      return i.editReply('✅ All stat channels updated.');
    }

    // ── BEACON SENTINEL ──
    if (cmd === 'beacon-setup') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      try {
        const { randomBytes, createHash } = require('crypto');
        const verifier  = randomBytes(48).toString('base64url').slice(0,96);
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        const clientId  = process.env.BEACON_CLIENT_ID || 'eb9ecdff-4048-4a83-8f40-f2e16d2e9a81';
        const clientSec = process.env.BEACON_CLIENT_SECRET || '';
        const form = new URLSearchParams({ client_id: clientId, client_secret: clientSec, scope: 'common sentinel:read sentinel:write', code_challenge: challenge, code_challenge_method: 'S256' });
        const r = await axios.post('https://api.usebeacon.app/v4/device', form.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });
        const { device_code, user_code, verification_uri_complete, expires_in } = r.data;
        try {
          await i.user.send({ embeds: [base('🔐 Beacon Sentinel Auth',C.cy).setDescription('Visit the link below to connect AEGIS to Beacon Sentinel.').addFields({name:'🔑 Code',value:`\`${user_code}\``,inline:true},{name:'⏰ Expires',value:`${Math.floor(expires_in/60)} min`,inline:true},{name:'🌐 Auth Link',value:`[Click to authorize](${verification_uri_complete})`},{name:'📋 Steps',value:'1. Click link\n2. Log in to Beacon\n3. Enter the code\n4. Wait for DM confirmation'})] });
        } catch { return i.editReply('⚠️ Could not DM you. Enable DMs from server members.'); }
        await i.editReply('✅ Auth code sent to your DMs. Complete the steps there.');
        const pollMs = (r.data.interval||5)*1000;
        let attempts = 0;
        const max = Math.floor(expires_in/(r.data.interval||5));
        const poll = setInterval(async () => {
          attempts++;
          if (attempts > max) { clearInterval(poll); return; }
          try {
            const t = await axios.post('https://api.usebeacon.app/v4/login', { client_id: clientId, client_secret: clientSec||undefined, device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code', code_verifier: verifier }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
            clearInterval(poll);
            beaconState.access = t.data.access_token; beaconState.refresh = t.data.refresh_token; beaconState.expiresAt = t.data.access_token_expiration;
            try {
              await i.user.send({ embeds: [base('✅ Beacon Connected!',C.gr).setDescription('AEGIS is now authenticated with Beacon Sentinel.').addFields({name:'⚠️ Next Step',value:'Copy tokens from next message into Render env vars.'})] });
              await i.user.send(`**Paste into Render Environment Variables:**\n\`\`\`\nBEACON_ACCESS_TOKEN=${t.data.access_token}\nBEACON_REFRESH_TOKEN=${t.data.refresh_token}\nBEACON_TOKEN_EXPIRES=${t.data.access_token_expiration}\n\`\`\``);
            } catch {}
          } catch (e) {
            const code = e.response?.data?.error;
            if (code==='authorization_pending'||code==='slow_down') return;
            clearInterval(poll);
          }
        }, pollMs);
      } catch (e) { return i.editReply(`⚠️ ${e.response?.data?.error||e.message}`); }
    }

    if (cmd === 'tribes') {
      const filter = i.options.getString('server') || '';
      if (!beaconState.access) return i.editReply('⚠️ Beacon Sentinel not connected. Admin must run `/beacon-setup` first.');
      const tribes = await sentinelTribes(filter);
      if (!tribes.length) return i.editReply(`📭 No tribes found${filter?` on **${filter}**`:''}.`);
      const lines = tribes.slice(0,25).map((t,idx) => `**${idx+1}.** ${t.tribeName||'Unnamed'}${t.serviceDisplayName?` · *${t.serviceDisplayName}*`:''}`).join('\n');
      return i.editReply({ embeds: [base(`🏛️ Tribes${filter?' — '+filter:''}`,C.pl).setDescription(lines).addFields({name:'📊 Total',value:`${tribes.length}`,inline:true}).setFooter({text:'Powered by Beacon Sentinel • TheConclave Dominion'})] });
    }

    if (cmd === 'player-lookup') {
      if (!isMod(i.member)) return i.editReply('⛔ Moderators only.');
      if (!beaconState.access) return i.editReply('⚠️ Beacon Sentinel not connected.');
      const name = i.options.getString('name');
      const player = await sentinelPlayer(name);
      if (!player) return i.editReply(`📭 No player found matching **${name}**.`);
      const emb = base(`🔍 ${player.playerName||name}`,C.cy).addFields({name:'🆔 Player ID',value:player.playerId||'Unknown',inline:true},{name:'👤 Name',value:player.playerName||'Unknown',inline:true},{name:'🕐 Last Active',value:player.updatedAt?`<t:${Math.floor(new Date(player.updatedAt)/1000)}:R>`:'Unknown',inline:true});
      if (player.notes?.length) emb.addFields({name:'📝 Notes',value:player.notes.slice(0,3).map(n=>n.note).join('\n')});
      return i.editReply({ embeds: [emb] });
    }

    if (cmd === 'sentinel-bans') {
      if (!isAdmin(i.member)) return i.editReply('⛔ Admins only.');
      if (!beaconState.access) return i.editReply('⚠️ Beacon Sentinel not connected.');
      const bans = await sentinelBans();
      if (!bans.length) return i.editReply('✅ No active bans on record.');
      const lines = bans.slice(0,20).map((b,idx) => `**${idx+1}.** ${b.playerName||b.playerId||'Unknown'} · ${b.reason||'No reason'}${b.createdAt?` · <t:${Math.floor(new Date(b.createdAt)/1000)}:R>`:''}`).join('\n');
      return i.editReply({ embeds: [base('🚫 Sentinel Ban List',C.rd).setDescription(lines).addFields({name:'📊 Total',value:`${bans.length}`,inline:true}).setFooter({text:'Powered by Beacon Sentinel'})] });
    }

  } catch (e) {
    console.error(`❌ /${cmd}:`, e.message);
    try { await i.editReply(`⚠️ Error: ${e.message.slice(0,200)}`); } catch {}
  }
});

// ─── AEGIS CHANNEL AUTO-REPLY ──────────────────────────────────────────
bot.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (!AEGIS_CH || msg.channelId !== AEGIS_CH) return;
  const w = checkRate(msg.author.id, 8000);
  if (w) { const m = await msg.reply(`⏳ Retry in ${w}s.`).catch(()=>null); if (m) setTimeout(()=>m.delete().catch(()=>{}),4000); return; }
  msg.channel.sendTyping().catch(()=>{});
  const r = await askAegis(msg.content, msg.author.id);
  msg.reply(r.slice(0,1990)).catch(()=>msg.channel.send(r.slice(0,1990)).catch(()=>{}));
});

// ─── WELCOME + AUTO-WALLET ──────────────────────────────────────────────
bot.on(Events.GuildMemberAdd, async member => {
  try {
    if (sb && sbOk()) (async () => { try { await sb.from('aegis_wallets').upsert({ discord_id: member.id, discord_tag: member.user.username, updated_at: new Date().toISOString() }, { onConflict: 'discord_id', ignoreDuplicates: true }); } catch {} })();
    const ch = member.guild.channels.cache.find(c => c.name==='welcome'||c.name==='welcomes'||c.name==='welcome-gate');
    if (!ch) return;
    await ch.send({ embeds: [base(`⚔️ Welcome, ${member.user.username}!`,C.pl)
      .setThumbnail(member.user.displayAvatarURL())
      .setDescription('You\'ve joined TheConclave Dominion — 5× crossplay ARK across **10 maps**.')
      .addFields({name:'📌 Start Here',value:'#rules — Read the Codex',inline:true},{name:'🎮 Server IPs',value:'`/servers`',inline:true},{name:'💎 Free Shards',value:'`/weekly`',inline:true},{name:'💬 Say Hi',value:'#general',inline:true},{name:'🎫 Support',value:'`/ticket`',inline:true},{name:'🧠 Ask AEGIS',value:'`/aegis [question]`',inline:true})
      .setFooter({text:`Member #${member.guild.memberCount} • TheConclave Dominion`})] });
  } catch (e) { console.error('❌ Welcome:', e.message); }
});

// ─── WATCHDOG ──────────────────────────────────────────────────────────
const STATUS = { ready: false, readyAt: null, reconnects: 0 };
let watchdogFails = 0, lastReady = Date.now();
const WATCHDOG_START = Date.now() + 90_000;

setInterval(async () => {
  if (Date.now() < WATCHDOG_START) return;
  const wsStatus = bot.ws?.status ?? -1;
  const heapMB   = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  if (heapMB > 450) console.warn(`⚠️  High memory: ${heapMB}MB`);
  if (wsStatus !== 5) { if (wsStatus === 0) { watchdogFails = 0; lastReady = Date.now(); } return; }
  watchdogFails++;
  if (watchdogFails >= 5) {
    STATUS.reconnects++;
    console.error(`❌ Bot fully disconnected — restarting (attempt #${STATUS.reconnects})...`);
    STATUS.ready = false;
    try { healthServer.close(); } catch {}
    try { bot.destroy(); } catch {}
    setTimeout(() => process.exit(1), 2000);
  }
}, 30_000);

// ─── HEALTH SERVER ─────────────────────────────────────────────────────
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    const up  = STATUS.ready && bot.ws.status === 0;
    const mem = process.memoryUsage();
    res.writeHead(up ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: up ? 'ok' : 'degraded', bot: STATUS.ready ? 'ready' : 'not_ready',
      ws: bot.ws.status, wsLatency: bot.ws.ping, uptime: STATUS.readyAt ? Math.floor((Date.now()-STATUS.readyAt)/1000)+'s' : '0s',
      reconnects: STATUS.reconnects, heapMB: Math.round(mem.heapUsed/1024/1024),
      supabase: sb ? (sbOk() ? 'ok' : 'circuit_open') : 'not_configured',
      commands: cmds.length, version: 'v10.0', ts: new Date().toISOString(),
    }));
  } else { res.writeHead(404); res.end('Not found'); }
});
healthServer.listen(BOT_PORT, () => console.log(`💓 Health: :${BOT_PORT}`));

// ─── PROCESS GUARDS ─────────────────────────────────────────────────────
const IGNORE = ['Unknown interaction','Unknown Message','Missing Access','Cannot send messages','Unknown Channel'];
process.on('unhandledRejection', r => { const m = r?.message||String(r); if (!IGNORE.some(e=>m.includes(e))) console.error('❌ Rejection:', m); });
process.on('uncaughtException', (e, o) => console.error(`❌ Exception [${o}]:`, e.message));
process.on('SIGTERM', () => { STATUS.ready = false; healthServer.close(); bot.destroy(); setTimeout(() => process.exit(0), 3000); });
process.on('SIGINT',  () => { STATUS.ready = false; healthServer.close(); bot.destroy(); setTimeout(() => process.exit(0), 1000); });

// ─── READY ─────────────────────────────────────────────────────────────
bot.once(Events.ClientReady, async () => {
  STATUS.ready = true; STATUS.readyAt = Date.now();
  console.log(`🤖 AEGIS v10.0 SOVEREIGN — ${bot.user.tag}`);
  console.log(`   Supabase: ${sb?'✅':'⚠️'} · Anthropic: ${anthropic?'✅':'⚠️'} · Health: :${BOT_PORT} · Commands: ${cmds.length}`);
  bot.user.setActivity(`💎 /weekly | ${cmds.length} commands | AEGIS v10`, { type: 3 });
  await registerCommands();

  if (DISCORD_GUILD_ID) {
    const guild = await bot.guilds.fetch(DISCORD_GUILD_ID).catch(()=>null);
    if (guild) {
      console.log('📡 Updating live status channels...');
      const statuses = await fetchServerStatus(MONITOR_SERVERS);
      await updateExistingStatusChannels(guild, statuses);
      console.log('✅ Status channels updated on boot');
      const monCh  = process.env.MONITOR_STATUS_CHANNEL_ID;
      const actCh  = process.env.MONITOR_ACTIVITY_CHANNEL_ID;
      const monMsg = process.env.MONITOR_MESSAGE_ID;
      if (monCh && monMsg) {
        monitorState.set(DISCORD_GUILD_ID, { statusChannelId: monCh, activityChannelId: actCh||null, messageId: monMsg, servers: [...MONITOR_SERVERS], prevStatuses: statuses });
        await refreshMonitor(guild);
        console.log('📡 Monitor embed resumed');
      }
    }
  }
});

// ─── LOGIN ──────────────────────────────────────────────────────────────
let loginAttempt = 0;
const BACKOFF = [5,15,30,60,120,120];
async function login() {
  loginAttempt++;
  try { await bot.login(DISCORD_BOT_TOKEN); loginAttempt = 0; }
  catch (e) {
    const delay = BACKOFF[Math.min(loginAttempt-1, BACKOFF.length-1)] * 1000;
    console.error(`❌ Login attempt ${loginAttempt} failed: ${e.message} — retry in ${delay/1000}s`);
    setTimeout(login, delay);
  }
}
login();
module.exports = bot;
