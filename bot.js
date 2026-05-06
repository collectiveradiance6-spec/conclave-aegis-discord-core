// ═══════════════════════════════════════════════════════════════════════
// CONCLAVE AEGIS BOT — v12.1 SOVEREIGN EDITION
// TheConclave Dominion · 5× Crossplay ARK: Survival Ascended
// ─────────────────────────────────────────────────────────────────────
// ✅ Anthropic Haiku 4.5 PRIMARY · Groq free fallback
// ✅ Full ClaveShard economy — wallet, bank, ledger, auto-deduct
// ✅ Shop v2 — shard verification, receipt DM, order audit log
// ✅ Giveaway v2 — shard-entry giveaways
// ✅ Auto-mod — link filter, caps flood, repeat spam
// ✅ Mod log — persistent structured logging
// ✅ Wipe tracker — countdown + announcement
// ✅ Tribe registry — tribe + member tracking
// ✅ AEGIS Persona mode — per-channel style override
// ✅ Bulk admin ops — bulk grant/deduct, audit trail
// ✅ Server vote — community voting system
// ✅ /council — show full council roster
// ✅ /digest — economy activity digest
// ✅ /streaks — weekly claim streak leaderboard
// ✅ /trivia — 200 hard ARK trivia → 15,000 ConCoins per win
// ✅ /concoin-booty — check ConCoin trivia balance
// ✅ /concoin-leaderboard — top trivia earners
// ✅ /grant-concoins — admin pay out booty to UnbelievaBoat
// ✅ /grant-concoins-manual — admin direct UB grant
// ✅ /compare — compare two dinos side by side via AI
// ✅ /boss-guide — detailed boss fight guide
// ✅ /base-tips — base building advice for specific map
// ✅ /modlog — view recent mod actions
// ═══════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();
 
const { sendWatchtowerPanel, handleWatchtowerInteraction } = require('./watchtower-system');
const http = require('http');
const axios = require('axios');
const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  Events, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType,
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const Groq      = require('groq-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const P         = require('./panels.js');
// NOTE: TRIVIA_QUESTIONS is declared below — trivia_fix is initialised
// after the array definition via a deferred require pattern.
let handleTriviaCommand, handleTriviaButton, handleTriviaModalSubmit;

// ══════════════════════════════════════════════════════════════════════
// ENV
// ══════════════════════════════════════════════════════════════════════
const {
  DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID,
  ROLE_OWNER_ID, ROLE_ADMIN_ID, ROLE_HELPER_ID,
  GROQ_API_KEY, ANTHROPIC_API_KEY,
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  AEGIS_CHANNEL_ID,
} = process.env;
 
if (!DISCORD_BOT_TOKEN) { console.error('❌ DISCORD_BOT_TOKEN missing'); process.exit(1); }
 
const BOT_PORT   = parseInt(process.env.BOT_PORT || '3001');
const GROQ_FAST  = 'llama-3.1-8b-instant';
const GROQ_SMART = 'llama-3.3-70b-versatile';
const ANT_MODEL  = 'claude-haiku-4-5-20251001';
 
// ── ConCoin / UnbelievaBoat ───────────────────────────────────────────
const UNBELIEVABOAT_API_TOKEN = process.env.UNBELIEVABOAT_API_TOKEN || null;
const UNBELIEVABOAT_CURRENCY  = process.env.UNBELIEVABOAT_CURRENCY  || 'cash';
const CONCOIN_TRIVIA_REWARD   = 15000;
 
// ── CLIENTS ──────────────────────────────────────────────────────────
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
const groq       = GROQ_API_KEY     ? new Groq({ apiKey: GROQ_API_KEY })           : null;
const sb = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;
 
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
  ],
  rest: { timeout: 15000 },
  allowedMentions: { parse: ['users','roles'], repliedUser: false },
});
 
// ══════════════════════════════════════════════════════════════════════
// PERMISSION HELPERS
// ══════════════════════════════════════════════════════════════════════
const isOwner = m => m?.roles?.cache?.has(ROLE_OWNER_ID) || m?.permissions?.has(PermissionFlagsBits.Administrator);
const isAdmin = m => isOwner(m) || m?.roles?.cache?.has(ROLE_ADMIN_ID);
const isMod   = m => isAdmin(m) || m?.roles?.cache?.has(ROLE_HELPER_ID) || m?.permissions?.has(PermissionFlagsBits.ModerateMembers);
 
// ══════════════════════════════════════════════════════════════════════
// RATE LIMITER
// ══════════════════════════════════════════════════════════════════════
const rates = new Map();
function checkRate(uid, ms = 6000) {
  const l = rates.get(uid)||0, n = Date.now();
  if (n-l < ms) return Math.ceil((ms-(n-l))/1000);
  rates.set(uid, n); return 0;
}
setInterval(() => { const cut = Date.now()-120_000; for (const [k,v] of rates) if (v<cut) rates.delete(k); }, 5*60_000);
 
// ══════════════════════════════════════════════════════════════════════
// SUPABASE CIRCUIT BREAKER
// ══════════════════════════════════════════════════════════════════════
const CB = { failures:0, openUntil:0, threshold:5, resetMs:60_000 };
const sbOk   = () => Date.now() >= CB.openUntil;
function sbFail() { CB.failures++; if (CB.failures>=CB.threshold) { CB.openUntil=Date.now()+CB.resetMs; console.error('⚡ Supabase CB OPEN'); } }
function sbSucc() { CB.failures=0; CB.openUntil=0; }
async function sbQuery(fn) {
  if (!sb) throw new Error('Supabase not configured');
  if (!sbOk()) throw new Error('Database temporarily unavailable');
  try { const r = await fn(sb); sbSucc(); return r; }
  catch (e) { sbFail(); throw e; }
}
 
// ══════════════════════════════════════════════════════════════════════
// MOD LOG
// ══════════════════════════════════════════════════════════════════════
const MOD_LOG_CHANNEL = process.env.MOD_LOG_CHANNEL_ID || null;
const recentModActions = [];
 
async function modLog(guild, action, target, actor, reason, extra={}) {
  const chId = MOD_LOG_CHANNEL || process.env.MONITOR_ACTIVITY_CHANNEL_ID;
  recentModActions.unshift({ action, targetTag: target?.username||String(target), actorTag: actor?.username||'SYSTEM', reason, ts: Date.now(), extra });
  if (recentModActions.length > 50) recentModActions.pop();
  if (!chId || !guild) return;
  try {
    const ch = guild.channels.cache.get(chId); if (!ch) return;
    const COLORS = { warn:0xFFB800, ban:0xFF4500, timeout:0xFF8C00, kick:0xFF4500, mute:0xFFB800, note:0x00D4FF, automod:0xFF4CD2 };
    const emb = new EmbedBuilder()
      .setColor(COLORS[action]||0x7B2FFF)
      .setTitle(`🔒 ${action.toUpperCase()} · ${target?.username||target}`)
      .setThumbnail(target?.displayAvatarURL?.({size:64})||null)
      .addFields(
        { name:'👤 Target', value: target?.id ? `<@${target.id}> \`${target.id}\`` : String(target), inline:true },
        { name:'👮 Actor',  value: actor?.id  ? `<@${actor.id}>` : String(actor||'SYSTEM'), inline:true },
        { name:'📋 Reason', value: reason?.slice(0,256)||'No reason', inline:false },
        ...Object.entries(extra).map(([k,v])=>({ name:k, value:String(v).slice(0,256), inline:true })),
      )
      .setFooter({ text:'AEGIS Mod Log · TheConclave Dominion' })
      .setTimestamp();
    await ch.send({ embeds:[emb] });
    if (sb && sbOk()) sb.from('aegis_mod_log').insert({
      guild_id:guild.id, action, target_id:target?.id||String(target),
      target_tag:target?.username||String(target), actor_id:actor?.id||'SYSTEM',
      actor_tag:actor?.username||'SYSTEM', reason, extra:JSON.stringify(extra),
      created_at:new Date().toISOString(),
    }).catch(()=>{});
  } catch {}
}
 
// ══════════════════════════════════════════════════════════════════════
// AUTO-MOD
// ══════════════════════════════════════════════════════════════════════
const AUTOMOD = {
  linkFilter: process.env.AUTOMOD_LINK_FILTER !== 'false',
  capsThresh: parseInt(process.env.AUTOMOD_CAPS_PCT  || '70'),
  capsMinLen: parseInt(process.env.AUTOMOD_CAPS_LEN  || '20'),
  spamWindow: parseInt(process.env.AUTOMOD_SPAM_MS   || '5000'),
  spamCount:  parseInt(process.env.AUTOMOD_SPAM_MAX  || '5'),
};
const msgHistory = new Map();
 
async function runAutoMod(msg) {
  if (!msg.guild || msg.author.bot) return;
  const member = msg.member;
  if (isAdmin(member) || isMod(member)) return;
  const content = msg.content;
  const violations = [];
  if (AUTOMOD.linkFilter && /discord\.gg\/|discord\.com\/invite\//i.test(content))
    violations.push('Discord invite link');
  if (content.length >= AUTOMOD.capsMinLen) {
    const upper = (content.match(/[A-Z]/g)||[]).length;
    const alpha = (content.match(/[a-zA-Z]/g)||[]).length;
    if (alpha>0 && (upper/alpha)*100 >= AUTOMOD.capsThresh) violations.push('Caps flood');
  }
  const now = Date.now();
  const hist = (msgHistory.get(msg.author.id)||[]).filter(t=>now-t<AUTOMOD.spamWindow);
  hist.push(now); msgHistory.set(msg.author.id, hist);
  if (hist.length >= AUTOMOD.spamCount) violations.push('Message spam');
  if (!violations.length) return;
  try {
    await msg.delete();
    const warning = await msg.channel.send(`⚠️ <@${msg.author.id}> — AutoMod: **${violations.join(', ')}**. This is a warning.`);
    setTimeout(()=>warning.delete().catch(()=>{}), 8000);
    await addWarn(msg.guildId, msg.author.id, msg.author.username, `AutoMod: ${violations.join(', ')}`, 'SYSTEM', 'AEGIS AutoMod');
    await modLog(msg.guild, 'automod', msg.author, {id:'SYSTEM',username:'AEGIS AutoMod'}, violations.join(', '), { Channel:`<#${msg.channelId}>` });
  } catch {}
}
setInterval(()=>{ const cut=Date.now()-60_000; for (const [k,v] of msgHistory) if (!v.some(t=>t>cut)) msgHistory.delete(k); }, 2*60_000);
 
// ══════════════════════════════════════════════════════════════════════
// AI ENGINE — ANTHROPIC PRIMARY + GROQ FALLBACK
// ══════════════════════════════════════════════════════════════════════
let _kCache = null, _kTs = 0;
async function getKnowledge() {
  const now = Date.now();
  if (_kCache !== null && now-_kTs < 90_000) return _kCache;
  if (!sb || !sbOk()) { _kCache=''; return ''; }
  try {
    const { data } = await sb.from('aegis_knowledge').select('category,title,content').neq('category','auto_learned').order('category').limit(80);
    _kCache = data?.length ? '\n\nKNOWLEDGE:\n'+data.map(r=>`[${r.category}] ${r.title}: ${r.content}`).join('\n') : '';
    _kTs = now; return _kCache;
  } catch { _kCache=''; return ''; }
}
 
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
PAYMENTS: CashApp $TheConclaveDominion · Chime $TheConclaveDominion
MINECRAFT: 134.255.214.44:10090 (Bedrock)
PATREON: patreon.com/theconclavedominion · Amissa access at Elite ($20/mo)
COUNCIL: Tw_ (High Curator) · Slothie (Archmaestro) · Sandy (Wildheart) · Jenny (Skywarden) · Arbanion (Oracle of Veils) · Okami (Hazeweaver) · Rookiereaper (Gatekeeper) · Icyreaper (Veilcaster) · Jake (ForgeSmith) · CredibleDevil (Iron Vanguard)
 
CLAVESHARD TIERS: T1(1) T2(2) T3(3) T5(5) T6(6) T8(8) T10(10) T12(12) T15(15) T20(20) T30(30) + Dino Insurance
 
VOICE: Precise, sovereign, cosmic — speak with authority and a touch of mythos. Use Discord markdown. Keep responses under 1800 chars unless detail is specifically requested.`;
 
const convMem = new Map();
function getHist(uid) { return convMem.get(uid)||[]; }
function addHist(uid, role, content) {
  const h = convMem.get(uid)||[];
  h.push({ role, content: content.slice(0,600) });
  if (h.length>24) h.splice(0, h.length-24);
  convMem.set(uid, h);
}
function clearHist(uid) { convMem.delete(uid); }
setInterval(()=>{ for (const [k,v] of convMem) if (!v?.length) convMem.delete(k); }, 30*60_000);
 
function logAiUsage(model, usage, engine='anthropic') {
  if (!sb || !sbOk()) return;
  sb.from('aegis_ai_usage').insert({
    model, engine,
    input_tokens:  engine==='anthropic' ? (usage?.input_tokens||0)  : (usage?.prompt_tokens||0),
    output_tokens: engine==='anthropic' ? (usage?.output_tokens||0) : (usage?.completion_tokens||0),
    used_search: false, created_at: new Date().toISOString(),
  }).catch(()=>{});
}
 
async function askAegis(msg, uid=null, extraCtx='', channelId=null) {
  if (!anthropic && !groq) return '⚠️ AI not configured. Set ANTHROPIC_API_KEY in Render.';
  const knowledge  = await getKnowledge();
  const persona    = channelId ? (personaOverrides.get(channelId)||null) : null;
  const personaCtx = persona ? `\n\nCHANNEL PERSONA:\nStyle: ${persona.style}\nNote: ${persona.note}` : '';
  const system     = CORE_PROMPT + knowledge + personaCtx + (extraCtx ? '\n\n'+extraCtx : '');
  const history    = uid ? getHist(uid) : [];
  if (anthropic) {
    try {
      const res = await anthropic.messages.create({
        model: ANT_MODEL, max_tokens: 1024, system,
        messages: [...history.map(h=>({ role:h.role, content:h.content })), { role:'user', content: msg }],
      });
      const text = res.content?.[0]?.text?.trim();
      if (!text) return '⚠️ Empty response from AI.';
      if (uid) { addHist(uid,'user',msg); addHist(uid,'assistant',text); }
      logAiUsage(ANT_MODEL, res.usage, 'anthropic');
      return text;
    } catch (e) {
      const status = e.status || e.error?.status;
      if (status===429||status===529||status===503) console.warn(`[ANTHROPIC] ${status} — falling back to Groq`);
      else console.error('[ANTHROPIC]', e.message||e);
    }
  }
  if (groq) {
    const isComplex = /explain|analyz|compar|strateg|guide|lore|boss|dino|build/i.test(msg);
    const groqModel = isComplex ? GROQ_SMART : GROQ_FAST;
    let retries = 0;
    while (retries < 3) {
      try {
        const res = await groq.chat.completions.create({
          model: groqModel, max_tokens: groqModel.includes('8b') ? 600 : 1000, temperature: 0.78,
          messages: [{ role:'system', content: system }, ...history, { role:'user', content: msg }],
        });
        const text = res.choices?.[0]?.message?.content?.trim();
        if (!text) return '⚠️ Empty response from AI.';
        if (uid) { addHist(uid,'user',msg); addHist(uid,'assistant',text); }
        logAiUsage(groqModel, res.usage, 'groq');
        return text;
      } catch (e) {
        if ((e.message||'').includes('rate_limit') || e.status===429) {
          retries++;
          if (retries < 3) { await new Promise(r=>setTimeout(r, 3000*retries)); continue; }
          return '⚠️ AEGIS is overloaded right now. Try again in 30 seconds.';
        }
        console.error('[GROQ]', e.message||e);
        return '⚠️ AEGIS error: '+(e.message||'').slice(0,100);
      }
    }
  }
  return '⚠️ All AI backends unavailable. Try again shortly.';
}
 
async function aiSummarize(prompt) {
  if (anthropic) {
    try {
      const res = await anthropic.messages.create({ model: ANT_MODEL, max_tokens: 400, messages: [{ role:'user', content: prompt }] });
      return res.content?.[0]?.text?.trim()||null;
    } catch {}
  }
  if (groq) {
    try {
      const res = await groq.chat.completions.create({ model: GROQ_FAST, max_tokens: 300, temperature:0.5, messages: [{ role:'user', content: prompt }] });
      return res.choices?.[0]?.message?.content?.trim()||null;
    } catch {}
  }
  return null;
}
 
// ══════════════════════════════════════════════════════════════════════
// WALLET ENGINE
// ══════════════════════════════════════════════════════════════════════
async function getWallet(id, tag) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').upsert(
      { discord_id:id, discord_tag:tag, updated_at:new Date().toISOString() },
      { onConflict:'discord_id', ignoreDuplicates:false }
    ).select().single();
    if (error) throw new Error('Wallet error: '+error.message);
    return data;
  });
}
async function logTx(id, tag, action, amount, balAfter, note='', actorId='', actorTag='') {
  if (!sb||!sbOk()) return;
  try {
    await sb.from('aegis_wallet_ledger').insert({
      discord_id:id, action, amount, balance_wallet_after:balAfter,
      note:note||null, actor_discord_id:actorId||null, actor_tag:actorTag||null,
      created_at:new Date().toISOString(),
    });
  } catch {}
}
async function depositToBank(id, tag, amount) {
  const w = await getWallet(id, tag);
  if (w.wallet_balance < amount) throw new Error(`Need **${amount}** in wallet. Have **${w.wallet_balance}** 💎.`);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:w.wallet_balance-amount, bank_balance:w.bank_balance+amount, updated_at:new Date().toISOString() }).eq('discord_id',id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id,tag,'deposit',amount,data.bank_balance,`Deposited ${amount} to bank`,id,tag);
    return data;
  });
}
async function withdrawFromBank(id, tag, amount) {
  const w = await getWallet(id, tag);
  if (w.bank_balance < amount) throw new Error(`Need **${amount}** in bank. Have **${w.bank_balance}** 💎.`);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:w.wallet_balance+amount, bank_balance:w.bank_balance-amount, updated_at:new Date().toISOString() }).eq('discord_id',id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id,tag,'withdraw',amount,data.wallet_balance,`Withdrew ${amount}`,id,tag);
    return data;
  });
}
async function transferShards(fromId, fromTag, toId, toTag, amount) {
  if (fromId===toId) throw new Error('Cannot transfer to yourself.');
  const sender = await getWallet(fromId, fromTag);
  if (sender.wallet_balance < amount) throw new Error(`Need **${amount}** in wallet. Have **${sender.wallet_balance}** 💎.`);
  return sbQuery(async sb => {
    await sb.from('aegis_wallets').update({ wallet_balance:sender.wallet_balance-amount, lifetime_spent:(sender.lifetime_spent||0)+amount, updated_at:new Date().toISOString() }).eq('discord_id',fromId);
    await getWallet(toId, toTag);
    const { data:r } = await sb.from('aegis_wallets').select('wallet_balance,lifetime_earned').eq('discord_id',toId).single();
    const { data:up } = await sb.from('aegis_wallets').update({ wallet_balance:(r.wallet_balance||0)+amount, lifetime_earned:(r.lifetime_earned||0)+amount, updated_at:new Date().toISOString() }).eq('discord_id',toId).select().single();
    const note = `${fromTag} → ${toTag}`;
    await logTx(fromId,fromTag,'transfer_out',amount,sender.wallet_balance-amount,note,fromId,fromTag);
    await logTx(toId,toTag,'transfer_in',amount,up.wallet_balance,note,fromId,fromTag);
    return { sent:sender.wallet_balance-amount, received:up.wallet_balance };
  });
}
async function grantShards(toId, toTag, amount, reason, actorId, actorTag) {
  await getWallet(toId, toTag);
  return sbQuery(async sb => {
    const { data:curr } = await sb.from('aegis_wallets').select('wallet_balance,lifetime_earned').eq('discord_id',toId).single();
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:(curr.wallet_balance||0)+amount, lifetime_earned:(curr.lifetime_earned||0)+amount, updated_at:new Date().toISOString() }).eq('discord_id',toId).select().single();
    if (error) throw new Error(error.message);
    await logTx(toId,toTag,'grant',amount,data.wallet_balance,reason||'Admin grant',actorId,actorTag);
    return data;
  });
}
async function deductShards(fromId, fromTag, amount, reason, actorId, actorTag) {
  const w = await getWallet(fromId, fromTag);
  const nb = Math.max(0,(w.wallet_balance||0)-amount);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:nb, lifetime_spent:(w.lifetime_spent||0)+amount, updated_at:new Date().toISOString() }).eq('discord_id',fromId).select().single();
    if (error) throw new Error(error.message);
    await logTx(fromId,fromTag,'deduct',amount,data.wallet_balance,reason||'Admin deduct',actorId,actorTag);
    return data;
  });
}
async function setBalance(targetId, targetTag, amount, reason, actorId, actorTag) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:amount, updated_at:new Date().toISOString() }).eq('discord_id',targetId).select().single();
    if (error) throw new Error(error.message);
    await logTx(targetId,targetTag,'admin_set',amount,amount,reason||'Admin set',actorId,actorTag);
    return data;
  });
}
async function getTxHistory(id, limit=15) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallet_ledger').select('action,amount,balance_wallet_after,note,actor_tag,created_at').eq('discord_id',id).order('created_at',{ascending:false}).limit(limit);
    if (error) throw new Error(error.message);
    return data||[];
  });
}
async function getLeaderboard(limit=10) {
  return sbQuery(async sb => {
    const { data } = await sb.from('aegis_wallets').select('discord_id,discord_tag,wallet_balance,bank_balance,lifetime_earned').order('wallet_balance',{ascending:false}).limit(limit);
    return data||[];
  });
}
async function getStreakLeaderboard(limit=10) {
  return sbQuery(async sb => {
    const { data } = await sb.from('aegis_wallets').select('discord_id,discord_tag,daily_streak').order('daily_streak',{ascending:false}).limit(limit);
    return data||[];
  });
}
async function getSupply() {
  return sbQuery(async sb => {
    const { data } = await sb.from('aegis_wallets').select('wallet_balance,bank_balance');
    if (!data?.length) return { walletTotal:0, bankTotal:0, holders:0 };
    return { walletTotal:data.reduce((s,r)=>s+(r.wallet_balance||0),0), bankTotal:data.reduce((s,r)=>s+(r.bank_balance||0),0), holders:data.length };
  });
}
async function claimWeekly(id, tag) {
  return sbQuery(async sb => {
    const { data:w } = await sb.from('aegis_wallets').select('*').eq('discord_id',id).single().catch(()=>({data:null}));
    if (!w) { await getWallet(id,tag); return claimWeekly(id,tag); }
    const now=new Date(), last=w.last_daily_claim?new Date(w.last_daily_claim):null;
    const diff = last ? (now-last)/(1000*60*60) : 999;
    if (diff<168) { const next=new Date(last.getTime()+168*60*60*1000); throw new Error(`⏳ Already claimed. Next: <t:${Math.floor(next/1000)}:R>`); }
    const amount=3, streak=(w.daily_streak||0)+1;
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:(w.wallet_balance||0)+amount, lifetime_earned:(w.lifetime_earned||0)+amount, last_daily_claim:now.toISOString(), daily_streak:streak, updated_at:now.toISOString() }).eq('discord_id',id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id,tag,'daily_claim',amount,data.wallet_balance,`Week ${streak} claim`,'SYSTEM','AEGIS');
    return { data, amount, streak };
  });
}
async function bulkGrant(userList, amount, reason, actorId, actorTag) {
  const results = [];
  for (const u of userList) {
    try { const w = await grantShards(u.id,u.tag,amount,reason,actorId,actorTag); results.push({id:u.id,tag:u.tag,success:true,balance:w.wallet_balance}); }
    catch (e) { results.push({id:u.id,tag:u.tag,success:false,error:e.message}); }
  }
  return results;
}
async function resetWallet(targetId, targetTag, actorId, actorTag) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:0, bank_balance:0, daily_streak:0, updated_at:new Date().toISOString() }).eq('discord_id',targetId).select().single();
    if (error) throw new Error(error.message);
    await logTx(targetId,targetTag,'admin_reset',0,0,'Wallet reset by admin',actorId,actorTag);
    return data;
  });
}
 
// ══════════════════════════════════════════════════════════════════════
// CONCOIN BOOTY ENGINE
// Tracks per-user trivia ConCoin winnings for UnbelievaBoat payout
// ══════════════════════════════════════════════════════════════════════
async function addConcoinBooty(discordId, discordTag, amount, reason = 'Trivia Win') {
  if (!sb || !sbOk()) return null;
  try {
    const { data: existing } = await sb.from('aegis_concoin_booty').select('*').eq('discord_id', discordId).single().catch(()=>({data:null}));
    if (existing) {
      const { data } = await sb.from('aegis_concoin_booty').update({
        total_earned:  (existing.total_earned  || 0) + amount,
        pending_grant: (existing.pending_grant || 0) + amount,
        trivia_wins:   (existing.trivia_wins   || 0) + 1,
        discord_tag:   discordTag,
        last_won:      new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      }).eq('discord_id', discordId).select().single();
      return data;
    } else {
      const { data } = await sb.from('aegis_concoin_booty').insert({
        discord_id:    discordId,
        discord_tag:   discordTag,
        total_earned:  amount,
        pending_grant: amount,
        total_granted: 0,
        trivia_wins:   1,
        last_won:      new Date().toISOString(),
        created_at:    new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      }).select().single();
      return data;
    }
  } catch (e) { console.error('[ConCoin Booty]', e.message); return null; }
}
 
async function getConcoinBooty(discordId) {
  if (!sb || !sbOk()) return null;
  try {
    const { data } = await sb.from('aegis_concoin_booty').select('*').eq('discord_id', discordId).single().catch(()=>({data:null}));
    return data;
  } catch { return null; }
}
 
async function clearPendingBooty(discordId, grantedAmount, actorTag) {
  if (!sb || !sbOk()) return false;
  try {
    const booty = await getConcoinBooty(discordId);
    if (!booty) return false;
    await sb.from('aegis_concoin_booty').update({
      pending_grant:   0,
      total_granted:   (booty.total_granted || 0) + grantedAmount,
      last_granted_at: new Date().toISOString(),
      last_granted_by: actorTag,
      updated_at:      new Date().toISOString(),
    }).eq('discord_id', discordId);
    return true;
  } catch { return false; }
}
 
async function getConcoinLeaderboard(limit = 10) {
  if (!sb || !sbOk()) return [];
  try {
    const { data } = await sb.from('aegis_concoin_booty').select('discord_id,discord_tag,total_earned,trivia_wins,pending_grant').order('total_earned', { ascending: false }).limit(limit);
    return data || [];
  } catch { return []; }
}
 
async function grantToUnbelievaBoat(guildId, discordId, amount) {
  if (!UNBELIEVABOAT_API_TOKEN) throw new Error('UNBELIEVABOAT_API_TOKEN not set in Render env.');
  const url = `https://unbelievaboat.com/api/v1/guilds/${guildId}/users/${discordId}`;
  const body = { [UNBELIEVABOAT_CURRENCY]: amount };
  try {
    const res = await axios.patch(url, body, {
      headers: { Authorization: UNBELIEVABOAT_API_TOKEN, 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    return res.data;
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    throw new Error(`UB API Error: ${msg}`);
  }
}
 
// ══════════════════════════════════════════════════════════════════════
// WARN ENGINE
// ══════════════════════════════════════════════════════════════════════
async function addWarn(guildId, targetId, targetTag, reason, actorId, actorTag) {
  if (!sb) return null;
  try {
    const { data } = await sb.from('aegis_warns').insert({ guild_id:guildId, discord_id:targetId, discord_tag:targetTag, reason, issued_by:actorId, issued_by_tag:actorTag, created_at:new Date().toISOString() }).select().single();
    return data;
  } catch (e) { console.error('Warn insert:', e.message); return null; }
}
async function getWarns(guildId, targetId) {
  if (!sb) return [];
  try { const { data } = await sb.from('aegis_warns').select('*').eq('guild_id',guildId).eq('discord_id',targetId).order('created_at',{ascending:false}); return data||[]; }
  catch { return []; }
}
async function clearWarns(guildId, targetId) {
  if (!sb) return false;
  try { await sb.from('aegis_warns').delete().eq('guild_id',guildId).eq('discord_id',targetId); return true; }
  catch { return false; }
}
 
// ══════════════════════════════════════════════════════════════════════
// GIVEAWAY ENGINE
// ══════════════════════════════════════════════════════════════════════
const activeGiveaways = new Map();
 
async function drawGiveaway(msgId, guildId, client) {
  const gw = activeGiveaways.get(msgId); if (!gw) return;
  const entries = [...gw.entries];
  if (!entries.length) {
    try { const ch=client.channels.cache.get(gw.channelId); const msg=await ch?.messages.fetch(msgId); if (msg) await msg.edit({ embeds:[new EmbedBuilder().setColor(0xFF4500).setTitle('🎉 Giveaway Ended').setDescription(`**${gw.prize}**\n\nNo valid entries.`)], components:[] }); }
    catch {} activeGiveaways.delete(msgId); return;
  }
  const winners=[];
  for (let w=0; w<Math.min(gw.winnersCount,entries.length); w++) { const idx=Math.floor(Math.random()*entries.length); winners.push(entries.splice(idx,1)[0]); }
  const winMentions = winners.map(w=>`<@${w}>`).join(' ');
  try {
    const ch=client.channels.cache.get(gw.channelId);
    const msg=await ch?.messages.fetch(msgId);
    if (msg) await msg.edit({ embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('🎉 Giveaway Ended!').setDescription(`**${gw.prize}**\n\n🏆 **Winners:** ${winMentions}`)], components:[] });
    if (ch) await ch.send(`🎉 Giveaway over! ${winMentions} won **${gw.prize}**!`);
  } catch {}
  activeGiveaways.delete(msgId);
}
 
// ══════════════════════════════════════════════════════════════════════
// WIPE TRACKER
// ══════════════════════════════════════════════════════════════════════
const wipeData = { date:null, reason:null, setBy:null, setAt:null };
 
// ══════════════════════════════════════════════════════════════════════
// TRIBE REGISTRY
// ══════════════════════════════════════════════════════════════════════
async function registerTribe(guildId, ownerId, ownerTag, tribeName, server, members=[]) {
  if (!sb) throw new Error('Supabase not configured.');
  const { error } = await sb.from('aegis_tribes').upsert(
    { guild_id:guildId, owner_id:ownerId, owner_tag:ownerTag, tribe_name:tribeName, server, members:JSON.stringify(members), updated_at:new Date().toISOString() },
    { onConflict:'guild_id,owner_id' }
  );
  if (error) throw new Error(error.message);
}
async function lookupTribe(guildId, query) {
  if (!sb) return [];
  const { data } = await sb.from('aegis_tribes').select('*').eq('guild_id',guildId).or(`tribe_name.ilike.%${query}%,owner_tag.ilike.%${query}%`).limit(5);
  return data||[];
}
 
// ══════════════════════════════════════════════════════════════════════
// SERVER MONITOR
// ══════════════════════════════════════════════════════════════════════
const MONITOR_SERVERS = [
  { id:'island',     name:'The Island',     nitradoId:18266152, emoji:'🌿', ip:'217.114.196.102', port:5390, pvp:false, patreon:false },
  { id:'volcano',    name:'Volcano',        nitradoId:18094678, emoji:'🌋', ip:'217.114.196.59',  port:5050, pvp:false, patreon:false },
  { id:'extinction', name:'Extinction',     nitradoId:18106633, emoji:'🌑', ip:'31.214.196.102',  port:6440, pvp:false, patreon:false },
  { id:'center',     name:'The Center',     nitradoId:18182839, emoji:'🏔️', ip:'31.214.163.71',   port:5120, pvp:false, patreon:false },
  { id:'lostcolony', name:'Lost Colony',    nitradoId:18307276, emoji:'🪐', ip:'217.114.196.104', port:5150, pvp:false, patreon:false },
  { id:'astraeos',   name:'Astraeos',       nitradoId:18393892, emoji:'✨', ip:'217.114.196.9',   port:5320, pvp:false, patreon:false },
  { id:'valguero',   name:'Valguero',       nitradoId:18509341, emoji:'🏞️', ip:'85.190.136.141',  port:5090, pvp:false, patreon:false },
  { id:'scorched',   name:'Scorched Earth', nitradoId:18598049, emoji:'☀️', ip:'217.114.196.103', port:5240, pvp:false, patreon:false },
  { id:'aberration', name:'Aberration',     nitradoId:18655529, emoji:'⚔️', ip:'217.114.196.80',  port:5540, pvp:true,  patreon:false },
  { id:'amissa',     name:'Amissa',         nitradoId:18680162, emoji:'⭐', ip:'217.114.196.80',  port:5180, pvp:false, patreon:true  },
];
const EXISTING_STATUS_CHANNELS = {
  aberration:'1491714622959390830', amissa:'1491714743797416056', astraeos:'1491714926862008320',
  center:'1491715233847316590', extinction:'1491715612911861790', lostcolony:'1491715764678299670',
  scorched:'1491717247083876435', island:'1491715445659799692', valguero:'1491715929586008075', volcano:'1491716283857633290',
};
const channelRenameCooldowns = new Map();
const RENAME_COOLDOWN_MS = 12*60*1000;
const monitorState = new Map();
 
async function safeRenameChannel(ch, newName) {
  if (!ch||ch.name===newName) return false;
  const now=Date.now(), last=channelRenameCooldowns.get(ch.id)||0;
  if (now-last<RENAME_COOLDOWN_MS) return false;
  channelRenameCooldowns.set(ch.id, now);
  try { await ch.setName(newName); return true; }
  catch (e) {
    if (e.status===429||(e.message||'').includes('429')) { channelRenameCooldowns.set(ch.id, now+15*60*1000); console.warn(`⚠️ 429 rename ${ch.name}`); }
    else console.error(`❌ Rename ${ch.name}:`, e.message);
    return false;
  }
}
async function fetchNitradoServer(nitradoId) {
  if (!process.env.NITRADO_API_KEY) return null;
  try {
    const res = await axios.get(`https://api.nitrado.net/services/${nitradoId}/gameservers`, { headers:{Authorization:`Bearer ${process.env.NITRADO_API_KEY}`}, timeout:10000 });
    const gs = res.data?.data?.gameserver; if (!gs) return null;
    return { status:gs.status==='started'?'online':'offline', players:gs.query?.player_current??0, maxPlayers:gs.query?.player_max??20 };
  } catch { return null; }
}
async function fetchServerStatuses() {
  if (!process.env.NITRADO_API_KEY) return MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20}));
  const results = [];
  await Promise.all(MONITOR_SERVERS.map(async srv => {
    const data = srv.nitradoId ? await fetchNitradoServer(srv.nitradoId) : null;
    results.push({...srv, status:data?.status??'unknown', players:data?.players??0, maxPlayers:data?.maxPlayers??20});
  }));
  return results;
}
function buildMonitorEmbed(servers) {
  const online=servers.filter(s=>s.status==='online'), offline=servers.filter(s=>s.status!=='online');
  const total=online.reduce((sum,s)=>sum+s.players,0);
  const lines=[
    ...online.map(s=>`🟢 **${s.emoji} ${s.name}**${s.pvp?' ⚔️':s.patreon?' ⭐':''} \`${s.players}/${s.maxPlayers||20}\``),
    ...offline.map(s=>`🔴 **${s.emoji} ${s.name}** · Offline`),
  ].join('\n');
  return new EmbedBuilder()
    .setTitle('⚔️ TheConclave — Live Cluster Monitor').setColor(total>0?0x35ED7E:0xFF4500)
    .setDescription(lines||'No server data.')
    .addFields({name:'🟢 Online',value:`${online.length}/${servers.length}`,inline:true},{name:'👥 Players',value:`${total}`,inline:true},{name:'⏰ Updated',value:`<t:${Math.floor(Date.now()/1000)}:R>`,inline:true})
    .setFooter({text:'TheConclave Dominion • Auto-refreshes every 5 min',iconURL:'https://theconclavedominion.com/conclave-badge.png'}).setTimestamp();
}
async function updateExistingStatusChannels(guild, statuses) {
  for (const srv of statuses) {
    const chId=EXISTING_STATUS_CHANNELS[srv.id]; if (!chId) continue;
    const ch=await guild.channels.fetch(chId).catch(()=>null); if (!ch) continue;
    const newName=srv.status==='online'?`🟢${srv.pvp?'⚔️':srv.patreon?'⭐':''}・${srv.name}-${srv.players}p`:`🔴・${srv.name}-offline`;
    const renamed=await safeRenameChannel(ch,newName);
    if (renamed) await new Promise(r=>setTimeout(r,1500));
  }
}
let _monitorTick=0;
setInterval(async()=>{
  _monitorTick++;
  if (!DISCORD_GUILD_ID) return;
  try {
    const g=await bot.guilds.fetch(DISCORD_GUILD_ID).catch(()=>null); if (!g) return;
    const s=await fetchServerStatuses().catch(()=>MONITOR_SERVERS.map(srv=>({...srv,status:'unknown',players:0,maxPlayers:20})));
    if (_monitorTick%2===0) await updateExistingStatusChannels(g,s);
    for (const [gid,state] of monitorState) {
      if (!state.statusChannelId||!state.messageId) continue;
      try {
        const guild=await bot.guilds.fetch(gid).catch(()=>null); if (!guild) continue;
        const ch=await guild.channels.fetch(state.statusChannelId).catch(()=>null); if (!ch) continue;
        const embed=buildMonitorEmbed(s);
        const msg=await ch.messages.fetch(state.messageId).catch(()=>null);
        if (msg) await msg.edit({embeds:[embed]}); else { const nm=await ch.send({embeds:[embed]}); state.messageId=nm.id; }
      } catch {}
    }
  } catch (e) { console.error('❌ Monitor tick:', e.message); }
}, 5*60_000);
 
// ══════════════════════════════════════════════════════════════════════
// EMBED HELPERS
// ══════════════════════════════════════════════════════════════════════
const C = { gold:0xFFB800, pl:0x7B2FFF, cy:0x00D4FF, gr:0x35ED7E, rd:0xFF4500, pk:0xFF4CD2, am:0xFF8C00 };
const FT = { text:'TheConclave Dominion • 5× Crossplay • 10 Maps', iconURL:'https://theconclavedominion.com/conclave-badge.png' };
const base = (title, color=C.pl) => new EmbedBuilder().setTitle(title).setColor(color).setFooter(FT).setTimestamp();
 
function walletEmbed(title, w, color=C.pl) {
  const total=(w.wallet_balance||0)+(w.bank_balance||0);
  return base(title,color).setDescription(`**${w.discord_tag||w.discord_id}**`).addFields(
    { name:'💎 Wallet', value:`**${(w.wallet_balance||0).toLocaleString()}**`, inline:true },
    { name:'🏦 Bank',   value:`**${(w.bank_balance||0).toLocaleString()}**`,   inline:true },
    { name:'📊 Total',  value:`**${total.toLocaleString()}**`,                  inline:true },
    { name:'📈 Earned', value:`${(w.lifetime_earned||0).toLocaleString()}`,     inline:true },
    { name:'📉 Spent',  value:`${(w.lifetime_spent||0).toLocaleString()}`,      inline:true },
    { name:'🔥 Streak', value:`Week ${w.daily_streak||0}`,                      inline:true },
  );
}
 
// ══════════════════════════════════════════════════════════════════════
// SHOP DATA
// ══════════════════════════════════════════════════════════════════════
const SHOP_TIERS = [
  { shards:1,  emoji:'💠', name:'1 Clave Shard',   items:['Level 600 Vanilla Dino (Tameable)','Max XP','3 Stacks Ammo','Full Dino Coloring','100 Kibble / Cakes / Beer','100% Imprint','500 Non-Tek Structures','Cryofridge + 120 Pods','50,000 Echo Coins','2,500 Materials','10 Same-Type Tributes','Boss Artifact + Tribute (1 Run)','Non-Tek Blueprint','Dino Revival Token (48hr)'] },
  { shards:2,  emoji:'💎', name:'2 Clave Shards',  items:['Modded Level 600 Dino','60 Dedicated Storage','Level 600 Yeti + Polar Bear','450 Random Shiny + Shoulder Variant'] },
  { shards:3,  emoji:'✨', name:'3 Clave Shards',  items:['Tek Blueprint','1 Shiny Essence','200% Imprint','450 T1 Special Shiny'] },
  { shards:5,  emoji:'🔥', name:'5 Clave Shards',  items:['Boss Defeat Command','Bronto or Dread + Saddle','Astral Dino','Level 1000 Basilisk / Rock Elemental / Karkinos','50 Raw Shiny Essence','450 T2 Special Shiny','Small Resource Bundle','2,500 Imprint Kibble'] },
  { shards:6,  emoji:'⚔️', name:'6 Clave Shards',  items:['Boss Ready Dino Bundle','300% Imprint','Max XP'] },
  { shards:8,  emoji:'🌌', name:'8 Clave Shards',  items:['Medium Resource Bundle','100,000 Resources (No Element)'] },
  { shards:10, emoji:'🛡️', name:'10 Clave Shards', items:['Tek Suit Blueprint / Set','Floating Platform','Combo Shinies','Dino Color Party','Breeding Pair'] },
  { shards:12, emoji:'🌠', name:'12 Clave Shards', items:['Large Resource Bundle','200,000 Resources'] },
  { shards:15, emoji:'👑', name:'15 Clave Shards', items:['30,000 Element','Level 900 Rhyniognatha / Reaper / Aureliax','XLarge Bundle (300k Resources)'] },
  { shards:20, emoji:'🏰', name:'20 Clave Shards', items:['1x1 Behemoth Gate Expansion (10/max)'] },
  { shards:30, emoji:'💰', name:'30 Clave Shards', items:['2 Dedicated Storage Admin Refill','1.6 Million Total Resources'] },
  { shards:0,  emoji:'🛡',  name:'Dino Insurance',  items:['One Time Use','Must Be Named','Backup May Not Save','May Require Respawn','One Per Dino'] },
];
 
const MAP_INFO = {
  island:     { name:'The Island',    ip:'217.114.196.102:5390', emoji:'🌿', desc:'Classic starter map. Lush biomes, all original boss arenas.', pvp:false, patreon:false },
  volcano:    { name:'Volcano',       ip:'217.114.196.59:5050',  emoji:'🌋', desc:'Dramatic volcanic biomes with rich resources.', pvp:false, patreon:false },
  extinction: { name:'Extinction',    ip:'31.214.196.102:6440',  emoji:'🌑', desc:'Post-apocalyptic Earth. Titans, OSD drops, Element farming.', pvp:false, patreon:false },
  center:     { name:'The Center',    ip:'31.214.163.71:5120',   emoji:'🏔️', desc:'Floating islands, underground ocean, great endgame bases.', pvp:false, patreon:false },
  lostcolony: { name:'Lost Colony',   ip:'217.114.196.104:5150', emoji:'🪐', desc:'Space-themed ascended map with unique creatures.', pvp:false, patreon:false },
  astraeos:   { name:'Astraeos',      ip:'217.114.196.9:5320',   emoji:'✨', desc:'Custom Ascended map blending multiple terrains and rare creatures.', pvp:false, patreon:false },
  valguero:   { name:'Valguero',      ip:'85.190.136.141:5090',  emoji:'🏞️', desc:'Rolling meadows, the Great Trench, and Deinonychus nesting.', pvp:false, patreon:false },
  scorched:   { name:'Scorched Earth',ip:'217.114.196.103:5240', emoji:'☀️', desc:'Desert survival: Wyverns, Rock Elementals, Manticore boss.', pvp:false, patreon:false },
  aberration: { name:'Aberration',    ip:'217.114.196.80:5540',  emoji:'⚔️', desc:'Underground PvP — Rock Drakes, Reapers, Nameless.', pvp:true, patreon:false },
  amissa:     { name:'Amissa',        ip:'217.114.196.80:5180',  emoji:'⭐', desc:'Patreon-exclusive map for Elite tier patrons.', pvp:false, patreon:true },
};
 
// ══════════════════════════════════════════════════════════════════════
// ARK TRIVIA — 200 HARD QUESTIONS (fact-checked)
// Reward: 15,000 ConCoins per correct answer (tracked in aegis_concoin_booty)
// Admin uses /grant-concoins to pay out to UnbelievaBoat
// ══════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
// TRIVIA QUESTIONS — 200 player-facing questions
// Categories: TheConclave community · ARK creatures · Taming & breeding
//             Bosses · Map knowledge · Crafting · Expert mechanics · Lore
// All rewards are 15,000 ConCoins — tiered by difficulty via reward field
// ══════════════════════════════════════════════════════════════════════
const TRIVIA_QUESTIONS = [
  // ── TheConclave Community ──────────────────────────────────────────
  { q:'How many maps does TheConclave Dominion run simultaneously?', a:'10', hint:'Count them in the server list.' },
  { q:'What XP multiplier does TheConclave run on all maps?', a:'5x', hint:'Five times vanilla rate.' },
  { q:'What is the max wild dino level on TheConclave?', a:'350', hint:'Far above vanilla 150.' },
  { q:'Which TheConclave map is the only PvP server?', a:'Aberration', hint:'Reapers and betrayal await.' },
  { q:'Which TheConclave map is exclusive to Patreon Elite members?', a:'Amissa', hint:'A custom hidden realm.' },
  { q:'What is the monthly cost for the Patreon tier that unlocks Amissa?', a:'20 dollars', hint:'Elite tier.' },
  { q:'What is the max tamed dino level cap on TheConclave?', a:'600', hint:'Far above the vanilla 450 cap.' },
  { q:'What is the weight stat set to on TheConclave tames?', a:'1 million', hint:'You will not be over-encumbered.' },
  { q:'Does TheConclave have fall damage enabled?', a:'no', hint:'Base jumping is safe here.' },
  { q:'What are the three platforms TheConclave supports for crossplay?', a:'Xbox PlayStation and PC', hint:'Full cross-platform cluster.' },
  { q:'What is the in-game currency players earn from trivia on TheConclave?', a:'ConCoins', hint:'Paid out via UnbelievaBoat.' },
  { q:'What is the real-money currency used in the TheConclave shop?', a:'ClaveShards', hint:'One dollar equals one shard.' },
  { q:'What is the taming speed multiplier on TheConclave?', a:'5x', hint:'Same as XP and harvest.' },
  { q:'What breeding speed multiplier does TheConclave run?', a:'5x', hint:'Babies grow fast on the Dominion.' },
  { q:'What harvest rate multiplier does TheConclave use?', a:'5x', hint:'Resources flow freely.' },
  { q:'What does "first torpor equals tame ownership" mean on TheConclave?', a:'the player who fires the first tranq shot owns that tame', hint:'No calling dibs — shoot first.' },
  { q:'How many warnings before a player gets banned from TheConclave?', a:'3', hint:'Admin abuse skips straight to ban.' },
  { q:'What must a player\'s Discord display name match on TheConclave?', a:'their in-game name', hint:'Accountability and identity rule.' },
  { q:'What is the maximum tribe size allowed on TheConclave?', a:'8 players', hint:'From the Dominion Codex.' },
  { q:'How many bases is a tribe allowed per map on TheConclave?', a:'1', hint:'One base per map.' },
  { q:'What is the max tame count per tribe on TheConclave?', a:'100', hint:'Keeps the servers running clean.' },
  { q:'What immediately happens if you raid or steal on a PvE map on TheConclave?', a:'instant ban', hint:'Zero tolerance — PvP only on Aberration.' },
  { q:'What is the consequence for advertising another server inside TheConclave\'s Discord?', a:'permanent ban', hint:'No exceptions.' },
  { q:'What mod on TheConclave saves your inventory when you die?', a:'Death Inventory Keeper', hint:'Your loot stays with your corpse.' },
  { q:'What mod on TheConclave shows detailed creature stats through a spyglass?', a:'Awesome Spyglass', hint:'Stats, taming progress, and level breakdown.' },
  { q:'What mod allows players to place teleporters anywhere on TheConclave?', a:'ARKomatic or Awesome Teleporter', hint:'No tek structure prerequisites required.' },
  { q:'What platform do TheConclave members use to find the shop?', a:'theconclavedominion.com slash shop', hint:'The main website.' },
  { q:'Who is the owner and High Curator of TheConclave Dominion?', a:'Tw_', hint:'The architect of the Dominion.' },
  { q:'Who holds the title of Archmaestro on TheConclave?', a:'Slothie', hint:'The co-owner.' },
  { q:'Which council member holds the title Wildheart?', a:'Sandy', hint:'A senior Dominion figure.' },
  { q:'What council title does Jenny hold on TheConclave?', a:'Skywarden', hint:'Watches over the skies of the Dominion.' },
  { q:'What is the council title of Okami on TheConclave?', a:'Hazeweaver', hint:'Mist and fog.' },
  { q:'What is Rookiereaper\'s council title on TheConclave?', a:'Gatekeeper', hint:'Guards the threshold.' },
  { q:'What is Icyreaper\'s council title on TheConclave?', a:'Veilcaster', hint:'Ice and mystery.' },
  { q:'What title does council member Jake hold?', a:'ForgeSmith', hint:'The craftsman of the council.' },
  { q:'What is CredibleDevil\'s council title on TheConclave?', a:'Iron Vanguard', hint:'Front line of the Dominion.' },
  { q:'How many members make up the full TheConclave council?', a:'10', hint:'Count the titles in the roster.' },
  { q:'What is the name of the AI guardian bot that runs TheConclave\'s Discord?', a:'AEGIS', hint:'The sovereign intelligence of the Dominion.' },
  { q:'What does AEGIS stand for in the context of TheConclave?', a:'Automated Enforcement and Guild Intelligence System', hint:'Or at least that\'s the lore.' },
  // ── ARK Creatures — Taming ─────────────────────────────────────────
  { q:'What is the only food that works to tame a Wyvern egg once it hatches?', a:'Wyvern Milk', hint:'Stolen from unconscious female Wyverns.' },
  { q:'What unique method is required to tame a Shadowmane?', a:'passive taming with a fish basket', hint:'No knockout required.' },
  { q:'How do you obtain a Rock Drake egg in ARK?', a:'steal it from a nest in the Aberration grave of the lost', hint:'Their parents will chase you.' },
  { q:'What do you feed a baby Rock Drake to raise it?', a:'nameless venom', hint:'Obtained from Nameless creatures on Aberration.' },
  { q:'What is the taming food for a Basilisk?', a:'fertilized eggs — rock drake or magmasaur eggs preferred', hint:'It only eats eggs passively.' },
  { q:'What creature requires starve taming and must be awake during the night to tame efficiently?', a:'Megalosaurus', hint:'Nocturnal cave predator.' },
  { q:'What taming food is unique to the Procoptodon?', a:'rare mushroom', hint:'The giant kangaroo of ARK.' },
  { q:'How do you tame a Noglin?', a:'lead it to an unconscious tame and let it attach', hint:'It prefers the brains of other dinos.' },
  { q:'What must you do before a Reaper Queen will impregnate you?', a:'collect and use reaper pheromone glands to build the buff', hint:'Obtained from other killed queens.' },
  { q:'What is the minimum fish basket quality to tame a Shadowmane?', a:'0.5 multiplier', hint:'Low quality fish will not work.' },
  { q:'What is starve taming and why is it used?', a:'draining a dino\'s food to zero before feeding taming food to maximize taming effectiveness', hint:'Higher TE equals more bonus levels.' },
  { q:'What do you tame a Gacha with?', a:'stone and other crafting materials or almost any resource', hint:'It eats nearly everything.' },
  { q:'What creature on Scorched Earth is tamed with clay?', a:'Morellatops', hint:'The desert camel of ARK.' },
  { q:'What is the taming food for a wild Karkinos?', a:'spoiled meat', hint:'The giant crab is not picky.' },
  { q:'What do you feed a baby Reaper King to raise it after birth?', a:'meat or raw prime meat', hint:'Born from a survivor — raised like a carnivore.' },
  { q:'Which creature requires you to be in a reduced health state to tame it passively?', a:'Voidwyrm', hint:'Genesis Part 2 tek wyvern — needs element too.' },
  { q:'What creature is tamed by letting it harvest specific resources from a trough?', a:'Titanosaur', hint:'The largest tameable creature — temporary tame.' },
  { q:'What rare item is needed to force-tame a Titanosaur without the passive method?', a:'Titanosaur cannot be force-tamed — it requires the saddle immediately', hint:'It starves to death without constant feeding.' },
  { q:'What shoulder pet is best for keeping Nameless at bay in Aberration?', a:'Bulbdog, Shinehorn, or Featherlight', hint:'Any glow pet works.' },
  { q:'What creature passively produces cementing paste and oil on wander?', a:'Achatina', hint:'The giant snail.' },
  // ── ARK Creatures — Mechanics ──────────────────────────────────────
  { q:'What debuff can cause a Giganotosaurus to attack its own tribe?', a:'rage state', hint:'Triggered by taking significant damage.' },
  { q:'What is the Yutyrannus Courage Roar used for?', a:'buffing nearby allied tames with bonus damage and damage reduction', hint:'Boss fight essential.' },
  { q:'What does the Yutyrannus Fear Roar do to wild creatures?', a:'forces them to flee regardless of their aggression state', hint:'Opposite of courage.' },
  { q:'What unique ability makes the Managarmr stand out from all other ARK creatures?', a:'it can jump multiple times in midair and fire an ice breath while airborne', hint:'Ice drake from Extinction.' },
  { q:'What is the Megatherium\'s special buff called and what triggers it?', a:'bug slayer — activated by killing any insect class creature', hint:'Grants 75 percent bonus damage.' },
  { q:'What status effect does a Shadowmane inflict that builds stacks on attackers?', a:'thornmail poison', hint:'Five stacks maximum.' },
  { q:'What does a mate-boosted female Shadowmane apply to nearby allies?', a:'cloaked status effect', hint:'Temporary invisibility for your whole squad.' },
  { q:'What replacement does the Shadowmane have instead of a crafted saddle?', a:'natural armor that scales with its base tame level', hint:'Max armor cap of 80.' },
  { q:'What is the Megalosaurus grab attack called and what does it affect?', a:'jaw lock — immobilizes Argentavis-sized or smaller creatures', hint:'Swings the prey around violently.' },
  { q:'What unique ability does the Karkinos have that almost no other creature shares?', a:'it can grab and carry both players and tamed dinos simultaneously', hint:'Giant crab utility.' },
  { q:'What is the maximum Sleep Debt a Megalosaurus can accumulate before torpor skyrockets?', a:'120', hint:'Once maxed, it becomes very hard to move.' },
  { q:'How many wild Megalosaurus can spawn on a single map at one time?', a:'4', hint:'Aberration is the exception with unlimited spawns.' },
  { q:'Why is the Aberrant Megalosaurus better in Aberration caves than the standard version?', a:'it has no sleep cycle — full stats 24 hours a day', hint:'No nocturnal penalty underground.' },
  { q:'What creature on Aberration can ride ziplines?', a:'Ravager', hint:'Fast pack predator with climbing claws.' },
  { q:'What does the Achatina produce passively while set to wander?', a:'cementing paste and oil', hint:'Giant snail economy trick.' },
  { q:'Which ocean creature produces Black Pearls when killed in underwater caves?', a:'Eurypterid', hint:'Horseshoe crab-looking creature.' },
  { q:'What advantage does the Mosasaurus have over the Plesiosaur for underwater hauling?', a:'it has a platform saddle and higher base weight capacity', hint:'Plesiosaur has no platform saddle.' },
  { q:'What creature in ASA produces feathers that reveal breeding stat percentages?', a:'Gigantoraptor', hint:'New ASA exclusive — feathers show hidden stats.' },
  { q:'What does the Fjordhawk do when its owner dies?', a:'it revives the player at the cost of some of their inventory items', hint:'Shoulder pet from Fjordur.' },
  { q:'What resource does correctly harvesting a Karkinos produce?', a:'chitin', hint:'The crustacean shell resource.' },
  { q:'What is the Noglin\'s primary combat utility after taming?', a:'it latches onto enemy creatures or players and takes control of them', hint:'Mind control shoulder creature.' },
  { q:'What makes the Therizinosaurus the most versatile resource gatherer in ARK?', a:'it can be set to harvest specific resources like fiber wood berries or thatch individually', hint:'No other herbivore has this level of role switching.' },
  { q:'How does the Tek Gravity Grenade differ from a standard frag grenade?', a:'it creates a gravity vortex that pulls players and dinos inward', hint:'Area denial tek device.' },
  { q:'What does the Thylacoleo do that makes it unique to tame mid-combat?', a:'it can be knocked out while already attacking another creature without breaking aggro', hint:'Cliff face ambush predator.' },
  { q:'Which creature on Scorched Earth explodes on death and deals area damage?', a:'Thorny Dragon', hint:'Organic bomb — useful for PvP traps.' },
  { q:'What ability does the Managarmr\'s ice breath do to enemy mounts?', a:'slows movement and causes torpor buildup', hint:'Freeze and dismount.' },
  // ── ARK Breeding & Mutations ───────────────────────────────────────
  { q:'How many mutation rolls happen each time two creatures breed?', a:'3', hint:'Three independent 2.5 percent checks.' },
  { q:'What is the mutation chance per individual roll during a breeding event?', a:'2.5 percent', hint:'Three rolls, each at this percentage.' },
  { q:'How many wild levels does each successful mutation add to the mutated stat?', a:'2', hint:'Always exactly two levels.' },
  { q:'What is the maximum mutation counter value on one side before mutations stop sourcing from that parent?', a:'20', hint:'Matrilineal or patrilineal — 20 each.' },
  { q:'If both parents exceed 20 combined mutations, what is the total mutation chance?', a:'zero — mutations are completely impossible', hint:'Both sides must be under 20 for any chance.' },
  { q:'What percentage chance does the higher stat have of being passed to an offspring?', a:'55 percent', hint:'Lower stat has 45 percent.' },
  { q:'What is the stat mutation counter on the mother\'s side of the family tree called?', a:'matrilineal', hint:'Father\'s side is patrilineal.' },
  { q:'What is line breeding in ARK?', a:'selectively breeding across generations to stack a single stat mutation into one creature', hint:'The competitive ARK meta.' },
  { q:'What does 100 percent imprint provide to a creature in ARK Survival Ascended?', a:'20 percent bonus to all base stats and 30 percent bonus damage and 30 percent damage reduction when ridden by the imprinter', hint:'Requires the same survivor who imprinted it.' },
  { q:'What does a mate-boosted female Procoptodon\'s pouch do to baby food consumption?', a:'reduces food consumption by 50 percent and doubles imprint gain per interaction', hint:'Essential for fast baby raising.' },
  { q:'What happens when a creature\'s mutation counter reaches 255 in a single stat?', a:'the game prevents any further leveling in that stat', hint:'A hard lock that cannot be undone.' },
  { q:'What is the approximate total mutation chance when both parents are under 20 mutations?', a:'7.31 percent', hint:'Three independent 2.5 percent rolls combined.' },
  { q:'What is the difference between uploading a dino to an obelisk versus cryopodding it?', a:'uploaded dinos expire after 24 hours while cryopodded dinos last indefinitely in a fridge', hint:'Two completely different storage systems.' },
  { q:'Why can a standard bola not immobilize a Procoptodon?', a:'it is too large — requires a chain bola', hint:'Size class exception.' },
  { q:'How many traits can a single Gene Scanner device hold at once in ASA?', a:'10', hint:'Scanner storage limit.' },
  { q:'What happens to a dino if it is leveled past the server-set max cap?', a:'it gets deleted on the next server restart', hint:'Permanent loss — level carefully.' },
  { q:'What does taming effectiveness directly control at tame completion?', a:'the number of bonus wild levels added to the creature', hint:'Higher TE equals a stronger tame.' },
  // ── Bosses & Progression ──────────────────────────────────────────
  { q:'What three trophies are needed to summon the Overseer on The Island?', a:'Broodmother Lysrix trophy, Megapithecus trophy, and Dragon trophy', hint:'All three Island boss trophies combined.' },
  { q:'What unique tribute item is required specifically to summon the Island Broodmother?', a:'Titanoboa Venom', hint:'Plus the standard arthropod tributes.' },
  { q:'How many survivor levels does Alpha Ascension on The Island add to your max level?', a:'15', hint:'Each difficulty tier adds 5.' },
  { q:'What is the time limit inside any standard boss arena on The Island?', a:'30 minutes', hint:'The countdown starts immediately.' },
  { q:'Which map\'s final boss fight is against Rockwell?', a:'Aberration', hint:'The corrupted explorer notes survivor.' },
  { q:'What must be defeated before the King Titan can be summoned on Extinction?', a:'the Forest Titan, Desert Titan, and Ice Titan', hint:'All three must fall first.' },
  { q:'What is the King Titan considered in ARK lore?', a:'the apex predator and guardian of the corrupt element on Earth', hint:'The final boss of Extinction.' },
  { q:'What tek engram does killing the Alpha King Titan unlock?', a:'Tek Dedicated Storage', hint:'The highest tier reward in base game ARK.' },
  { q:'What happens to your character if you ascend on The Island?', a:'you are transferred to a new session with bonus max levels and ascension notes', hint:'Required for full game progression.' },
  { q:'What resource do the three Island bosses drop that is needed for Tek engrams?', a:'Element', hint:'The power source of all Tek tier structures.' },
  { q:'What is the Manticore on Scorched Earth weak against?', a:'fire and direct damage from Wyverns or high melee tames', hint:'Dodge the dive attacks.' },
  { q:'What is required to enter the Rockwell arena on Aberration?', a:'Rockwell tentacle tribute items plus the standard artifact set', hint:'Fought deep in the depths of Aberration.' },
  { q:'What does the Dragon boss on The Island apply to your tames during the fight?', a:'fire breath that directly reduces your dinos\' health regardless of armor', hint:'Bring fire-resistant tames.' },
  // ── Map Knowledge ─────────────────────────────────────────────────
  { q:'What mechanic prevents the use of flyers on Aberration?', a:'a magnetic field that blocks all flying mounts', hint:'Intentional design — go underground.' },
  { q:'What kills players on the surface of Aberration without hazmat gear?', a:'extreme radiation damage', hint:'The sky collapsed and let it in.' },
  { q:'What biome on Aberration is permanently lit by bioluminescent fungi and creatures?', a:'the Bioluminescent Zone', hint:'The second depth layer of Aberration.' },
  { q:'What is an Orbital Supply Drop on Extinction?', a:'a falling supply beacon that spawns waves of corrupted dinos you must defend against', hint:'OSD — defend the beacon to claim the loot.' },
  { q:'What map features a vast underground ocean accessible through a trench in the map\'s center?', a:'The Center', hint:'The floating island map.' },
  { q:'What biome unique to Scorched Earth creates a sand storm that blinds and damages players?', a:'the desert biome — sand storm weather event', hint:'Visibility drops to near zero.' },
  { q:'What Scorched Earth weather event destroys structures and anything caught in its path?', a:'Fire Tornado', hint:'A spinning column of fire.' },
  { q:'What unique traversal mechanic replaces flying on Aberration?', a:'ziplines and grappling hooks', hint:'Horizontal travel across the caverns.' },
  { q:'What biome on Genesis Part 1 has zero gravity and contains element veins?', a:'the Lunar Biome', hint:'Space surface environment.' },
  { q:'What is the Deinonychus known for on Valguero that no other map replicates?', a:'wild Deinonychus guard their nests and attack players who approach their eggs', hint:'Fjordur also has them.' },
  { q:'What is the main feature of the Lost Colony map on TheConclave?', a:'a space-themed ascended map with unique creatures and environments', hint:'One of the newer custom ASA maps.' },
  { q:'What map on TheConclave features extreme volcanic terrain and lava biomes?', a:'Volcano', hint:'Run by TheConclave alongside The Island.' },
  { q:'What is Astraeos on TheConclave?', a:'a custom Ascended map blending multiple terrain types with rare creatures', hint:'One of the 10 active Dominion servers.' },
  { q:'What game engine upgrade powers ARK Survival Ascended compared to ARK Survival Evolved?', a:'Unreal Engine 5', hint:'UE5 — massive visual and physics overhaul.' },
  { q:'What UE5 technology gives ASA real-time global illumination that ASE never had?', a:'Lumen', hint:'Dynamic lighting system.' },
  { q:'What UE5 rendering system gives ASA its ultra-detailed terrain geometry?', a:'Nanite', hint:'Virtualized micropolygon system.' },
  { q:'What cross-platform feature in ASA did ASE never support?', a:'Xbox and PlayStation crossplay simultaneously', hint:'Console crossplay was impossible before ASA.' },
  // ── Crafting & Resources ──────────────────────────────────────────
  { q:'What is the recipe for Gasoline in the Industrial Forge?', a:'5 Oil and 3 Hide produces 5 Gasoline', hint:'Cannot be made in a campfire or smithy.' },
  { q:'What is the recipe for Sparkpowder?', a:'1 Flint and 1 Stone in a Mortar and Pestle', hint:'The basis for gunpowder.' },
  { q:'What tool harvests the most Organic Polymer from a Kairuku penguin?', a:'Chainsaw', hint:'Not a dino — a tool.' },
  { q:'What is the key difference between Organic Polymer and regular Polymer?', a:'Organic Polymer spoils over time — regular Polymer does not', hint:'Time is your enemy with organic.' },
  { q:'What does leveling your Crafting Skill stat affect?', a:'the quality and stat rolls of items crafted from blueprints', hint:'Higher skill equals better gear from the same blueprint.' },
  { q:'What is Hexagons in Genesis Part 1?', a:'the exclusive mission currency earned from completing missions and spent at the Genesis shop', hint:'Cannot be transferred or traded.' },
  { q:'What resource is unique to Crystal Isles and found on its floating islands?', a:'crystal in massive quantities', hint:'The map is named after it for a reason.' },
  { q:'What resource can be transferred between maps in ASA unlike raw Element?', a:'Element Dust', hint:'Craftable into shards then into full Element.' },
  { q:'What is Black Pearl primarily used for in ARK?', a:'crafting high-tier Tek items and saddles', hint:'Sourced from Eurypterids and Tusoteuthis.' },
  { q:'What does a Tree Sap Tap collect passively?', a:'sap from Redwood trees over time', hint:'Placed directly on a Redwood tree trunk.' },
  { q:'What is the fastest way to get Obsidian in large quantities?', a:'mining obsidian nodes in caves or on mountain peaks with an Ankylosaurus', hint:'Ankys harvest stone-type resources best.' },
  { q:'What is the primary use of Silica Pearls in mid-game ARK?', a:'crafting electronics and underwater oxygen equipment', hint:'Found on the ocean floor.' },
  { q:'What does leveling the Weight stat on a Argentavis by a large amount unlock strategically?', a:'using it as a mobile forge by placing a campfire or forge in its inventory', hint:'Argentavis has a passive smelting bonus.' },
  // ── Expert Mechanics ──────────────────────────────────────────────
  { q:'What is the imprint bonus on a creature when the imprinter rides it in combat?', a:'30 percent bonus damage dealt and 30 percent damage reduction received', hint:'Only applies when the exact imprinter rides it.' },
  { q:'What is the maximum number of wild stat points that can be placed in a single stat on a dino?', a:'255', hint:'The hard cap from the base game code.' },
  { q:'What is the Wyvern Milk used for beyond feeding baby Wyverns?', a:'nothing else — it is exclusively baby Wyvern food during juvenile phase', hint:'Spoils fast so farm it fresh.' },
  { q:'What happens to imprint percentage if you miss an imprint window?', a:'you can still imprint later but total imprint at maturation will be below 100 percent', hint:'Each missed window permanently reduces the maximum.' },
  { q:'How do you prevent a baby dino from starving while offline?', a:'place enough food in a feeding trough within range of the baby', hint:'Troughs pull food automatically.' },
  { q:'What is the Cryo Sickness debuff?', a:'a temporary debuff applied when a cryopodded creature is released that reduces its stats temporarily', hint:'Wait it out before using them in combat.' },
  { q:'What kills a Wyvern egg if the temperature drops too low during incubation?', a:'it loses health and eventually dies if not kept within the required temperature range', hint:'Use air conditioners or campfires in a ring.' },
  { q:'What does the Deinonychus require to hatch that is unusual compared to most ARK eggs?', a:'a precise temperature range in a nest — an egg incubator or campfire ring works', hint:'Wild Deinonychus aggressively protect their nests.' },
  { q:'What is Voidwyrm taming food unlike all other Wyvern variants?', a:'Element — must be knocked out and fed Element', hint:'Genesis 2 exclusive Tek wyvern.' },
  { q:'What are the four Aberration lantern pets that provide Charge Light?', a:'Bulbdog, Shinehorn, Featherlight, and Glowtail', hint:'All four glow and all four protect against Nameless.' },
  { q:'What egg can only be obtained by stealing from wild nests — it cannot be bred in captivity initially?', a:'Rock Drake egg', hint:'Found in the Grave of the Lost on Aberration.' },
  { q:'What does the Tek Turret require to fire automatically?', a:'Element to power and targets set to the correct faction in the configuration', hint:'One of the most expensive auto-defenses.' },
  { q:'What are the three tiers of ARK boss difficulty?', a:'Gamma, Beta, and Alpha', hint:'Easy medium and hard — Alpha drops the most loot.' },
  { q:'What happens to a tame that is uploaded at an obelisk and not downloaded within 24 hours?', a:'it is permanently deleted', hint:'Never leave a dino uploaded longer than needed.' },
  { q:'What does Reaper impregnation require from the survivor during the Reaper Queen encounter?', a:'the survivor must have the Reaper Pheromone Gland buff active', hint:'Obtained from killing female Reapers.' },
  { q:'What is the purpose of the Yutyrannus in an Island boss fight?', a:'its courage roar buffs all nearby allies with increased damage and damage reduction', hint:'The most impactful support creature for raids.' },
  { q:'What is the fastest flier in base ARK Survival Ascended?', a:'Wyvern or Pteranodon at top speed — Wyvern has more stamina for distance', hint:'Context-dependent: sprint vs long distance.' },
  // ── ARK Lore ─────────────────────────────────────────────────────
  { q:'Who wrote the survivor notes that form the core lore of ARK?', a:'Helena Walker', hint:'She becomes the overseer of new ARKs in the story.' },
  { q:'Who is the main antagonist of the ARK storyline?', a:'Sir Edmund Rockwell', hint:'A Victorian-era explorer corrupted by Element.' },
  { q:'What is the ARK in ARK Survival Evolved?', a:'a giant space station terraforming platform designed to preserve life', hint:'Like a biological Noah\'s Ark in orbit.' },
  { q:'What is Element in ARK lore?', a:'an alien energy resource that corrupts living organisms and powers Tek technology', hint:'It fell from space and changed everything.' },
  { q:'What alien race built the ARKs and the Tek equipment?', a:'the Homo Deus — ascended humans — assisted by an alien race called the Terran Federation lore varies', hint:'The overseer entities that guide survivors.' },
  { q:'What is the Overseer on The Island?', a:'an AI intelligence that tests survivors and transfers them to new ARKs upon ascension', hint:'The final challenge of The Island.' },
  { q:'What does ascending in ARK mean lore-wise?', a:'the survivor is digitized and uploaded to join the Homo Deus collective', hint:'You transcend physical form.' },
  { q:'Who is Santiago in Genesis Part 1?', a:'a survivor and soldier who became a Homo Deus figure guiding the Genesis simulation', hint:'His logs appear throughout Genesis Part 1.' },
  { q:'What is the name of the sentient AI companion in Genesis Part 1 and 2?', a:'HLN-A', hint:'She guides you through the simulation with sarcasm.' },
  { q:'What corrupted Rockwell and turned him into the Aberration boss?', a:'he injected himself with Element from the ARK to gain power', hint:'His descent is documented in his explorer notes.' },
  // ── TheConclave Shop Deep Cuts ─────────────────────────────────────
  { q:'What is the entry-level ClaveShard shop item that includes 50,000 Echo Coins?', a:'the 1 ClaveShard tier', hint:'The cheapest tier in the Dominion shop.' },
  { q:'How many ClaveShards does the largest shop tier cost?', a:'30', hint:'Comes with 1.6 million resources.' },
  { q:'What does the 20 ClaveShard tier include?', a:'a 1x1 Behemoth Gate Expansion', hint:'Up to 10 expansions per account.' },
  { q:'How many ClaveShards is a Tek Suit Blueprint Set?', a:'10', hint:'Tek tier shop item.' },
  { q:'What is included in the 15 ClaveShard tier?', a:'30,000 Element and a Level 900 creature choice', hint:'Near the top of the shop.' },
  { q:'What does Dino Insurance cover on TheConclave?', a:'a one-time revival attempt for a named tame', hint:'One per dino — must be registered.' },
  { q:'What does the 5 ClaveShard tier include as its premium creature option?', a:'a Level 1000 Basilisk, Rock Elemental, or Karkinos', hint:'Tier 5 powerhouse creatures.' },
  { q:'What does the 6 ClaveShard tier include beyond a boss-ready dino bundle?', a:'300 percent imprint and Max XP', hint:'Just above Tier 5.' },
  { q:'What resource pack comes with the 8 ClaveShard tier?', a:'100,000 resources excluding Element', hint:'Medium resource bundle.' },
  { q:'What shop tier includes a Cryofridge plus 120 Cryopods?', a:'1 ClaveShard tier', hint:'Base tier — great value.' },
  { q:'How many ClaveShards does the 2 ClaveShard tier cost, and what dino does it include?', a:'2 ClaveShards — includes a Modded Level 600 Dino', hint:'Step above tier 1.' },
  { q:'What is the conversion rate from real money to ClaveShards?', a:'1 dollar equals 1 ClaveShard', hint:'No markup.' },
  // ── Conclave Rules & Culture ───────────────────────────────────────
  { q:'What does the TheConclave Dominion Codex govern?', a:'server rules including tribe limits, tame caps, conduct, and dispute resolution', hint:'The law of the Dominion.' },
  { q:'What is the consequence for exploiting a game bug intentionally on TheConclave?', a:'admin review and possible ban', hint:'Report bugs — do not abuse them.' },
  { q:'What is the etiquette rule around taming on TheConclave PvE maps?', a:'whoever fires the first tranq shot claims the tame — no calling dibs in advance', hint:'First torpor equals ownership.' },
  { q:'Are players allowed to block resource spawns or obelisks on TheConclave?', a:'no — blocking key spawns or obelisks is a bannable offense', hint:'Ruins the experience for everyone.' },
  { q:'What is the primary chat language required in public channels on TheConclave?', a:'English', hint:'Keeps moderation manageable.' },
  { q:'What should you do if you find a bug or exploit on TheConclave?', a:'report it to staff immediately', hint:'Abusing it is a bannable offense.' },
];

 
// ── Wire 200-question bank into trivia_fix ────────────────────────────
// trivia_fix.js exports a factory function when passed a question bank.
// The factory converts { q, a, hint } → { question, answer, reward, hint }
// and injects them as the in-memory fallback so no Supabase table is needed.
({
  handleTriviaCommand,
  handleTriviaButton,
  handleTriviaModalSubmit,
} = require('./trivia_fix')(
  TRIVIA_QUESTIONS.map(t => ({
    question: t.q,
    answer:   t.a,
    reward:   15000,
    hint:     t.hint || '',
  }))
));

// activeTrivias was the old chat-message trivia path — superseded by trivia_fix modals.
// Kept as an empty map so the MessageCreate handler below compiles without changes.
const activeTrivias = new Map(); // legacy — no longer populated
 
// ══════════════════════════════════════════════════════════════════════
// SLASH COMMAND DEFINITIONS
// ══════════════════════════════════════════════════════════════════════
function addWalletSubs(b) {
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
}
 
const ALL_COMMANDS = [
  addWalletSubs(new SlashCommandBuilder().setName('wallet').setDescription('💎 ClaveShard wallet')),
  addWalletSubs(new SlashCommandBuilder().setName('curr').setDescription('💎 ClaveShard wallet (alias)')),
  new SlashCommandBuilder().setName('weekly').setDescription('🌟 Claim weekly ClaveShards'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Top 10 ClaveShard holders'),
  new SlashCommandBuilder().setName('streaks').setDescription('🔥 Weekly claim streak leaderboard'),
  new SlashCommandBuilder().setName('give').setDescription('🎁 [ADMIN] Quick grant shards').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o=>o.setName('user').setDescription('Player').setRequired(true))
    .addIntegerOption(o=>o.setName('amount').setDescription('Shards').setRequired(true).setMinValue(1))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('clvsd').setDescription('💠 Admin economy tools').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s=>s.setName('grant').setDescription('🎁 Grant').addUserOption(o=>o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s=>s.setName('deduct').setDescription('⬇️ Deduct').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s=>s.setName('check').setDescription('🔍 Check wallet').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s=>s.setName('set').setDescription('🔧 Set balance').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('New balance').setRequired(true).setMinValue(0)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s=>s.setName('reset').setDescription('🔄 Reset wallet to zero').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s=>s.setName('top').setDescription('🏆 Top 15 holders'))
    .addSubcommand(s=>s.setName('stats').setDescription('📊 Economy stats'))
    .addSubcommand(s=>s.setName('usage').setDescription('🧠 AI usage stats'))
    .addSubcommand(s=>s.setName('bulk-grant').setDescription('🎁 Grant to multiple users')
      .addIntegerOption(o=>o.setName('amount').setDescription('Shards each').setRequired(true).setMinValue(1))
      .addUserOption(o=>o.setName('user1').setDescription('User 1').setRequired(true))
      .addUserOption(o=>o.setName('user2').setDescription('User 2').setRequired(false))
      .addUserOption(o=>o.setName('user3').setDescription('User 3').setRequired(false))
      .addUserOption(o=>o.setName('user4').setDescription('User 4').setRequired(false))
      .addUserOption(o=>o.setName('user5').setDescription('User 5').setRequired(false))
      .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s=>s.setName('audit').setDescription('📋 Recent economy actions').addIntegerOption(o=>o.setName('limit').setDescription('Entries (max 20)').setRequired(false).setMinValue(1).setMaxValue(20)))
    .addSubcommand(s=>s.setName('digest').setDescription('📊 Economy digest — grants/deducts/orders summary')),
  new SlashCommandBuilder().setName('order').setDescription('📦 Submit ClaveShard shop order')
    .addIntegerOption(o=>o.setName('tier').setDescription('Tier shards').setRequired(true).setMinValue(1).setMaxValue(30))
    .addStringOption(o=>o.setName('platform').setDescription('Platform').setRequired(true).addChoices({name:'Xbox',value:'Xbox'},{name:'PlayStation',value:'PlayStation'},{name:'PC',value:'PC'}))
    .addStringOption(o=>o.setName('server').setDescription('Which server?').setRequired(true))
    .addStringOption(o=>o.setName('notes').setDescription('Special requests or dino name').setRequired(false))
    .addBooleanOption(o=>o.setName('auto-deduct').setDescription('Auto-deduct shards from wallet?').setRequired(false)),
  new SlashCommandBuilder().setName('fulfill').setDescription('✅ [ADMIN] Mark order fulfilled').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('ref').setDescription('Order reference').setRequired(true))
    .addStringOption(o=>o.setName('note').setDescription('Note to player').setRequired(false)),
  new SlashCommandBuilder().setName('shard').setDescription('💠 View complete ClaveShard tier list'),
  new SlashCommandBuilder().setName('shop').setDescription('🛍️ Browse ClaveShard catalog'),
  new SlashCommandBuilder().setName('aegis').setDescription('🧠 Ask AEGIS AI').addStringOption(o=>o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('ask').setDescription('🧠 Ask AEGIS anything').addStringOption(o=>o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('forget').setDescription('🧹 Clear your AEGIS conversation history'),
  new SlashCommandBuilder().setName('ai-cost').setDescription('💸 [ADMIN] AI usage dashboard').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('aegis-persona').setDescription('🎭 [ADMIN] Set AEGIS persona for this channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('style').setDescription('Persona style').setRequired(true).addChoices(
      {name:'🌌 Sovereign (default)',value:'sovereign'},{name:'⚔️ Combat Tactical',value:'combat'},
      {name:'🛍️ Shop Assistant',value:'shop'},{name:'📜 Lore Keeper',value:'lore'},
      {name:'🤝 Friendly Helper',value:'friendly'},{name:'❌ Reset to Default',value:'reset'},
    ))
    .addStringOption(o=>o.setName('note').setDescription('Extra persona context').setRequired(false)),
  new SlashCommandBuilder().setName('summarize').setDescription('📝 [ADMIN] AEGIS summarizes recent chat').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o=>o.setName('count').setDescription('Messages to analyze (max 50)').setRequired(false).setMinValue(5).setMaxValue(50)),
  new SlashCommandBuilder().setName('compare').setDescription('⚖️ Compare two ARK dinos side by side')
    .addStringOption(o=>o.setName('dino1').setDescription('First dino').setRequired(true))
    .addStringOption(o=>o.setName('dino2').setDescription('Second dino').setRequired(true)),
  new SlashCommandBuilder().setName('boss-guide').setDescription('👹 Detailed boss fight guide')
    .addStringOption(o=>o.setName('boss').setDescription('Boss name').setRequired(true).addChoices(
      {name:'Broodmother',value:'Broodmother'},{name:'Megapithecus',value:'Megapithecus'},
      {name:'Dragon',value:'Dragon'},{name:'Overseer',value:'Overseer'},
      {name:'Rockwell',value:'Rockwell'},{name:'Manticore',value:'Manticore'},
      {name:'King Titan',value:'King Titan'},{name:'Dinopithecus King',value:'Dinopithecus King'},
    )),
  new SlashCommandBuilder().setName('base-tips').setDescription('🏗️ Base building tips for a specific map')
    .addStringOption(o=>o.setName('map').setDescription('Map name').setRequired(true).addChoices(
      {name:'The Island',value:'island'},{name:'Valguero',value:'valguero'},
      {name:'Aberration',value:'aberration'},{name:'Extinction',value:'extinction'},
      {name:'Lost Colony',value:'lostcolony'},{name:'Astraeos',value:'astraeos'},
      {name:'Scorched Earth',value:'scorched'},{name:'The Center',value:'center'},
      {name:'Volcano',value:'volcano'},{name:'Amissa',value:'amissa'},
    )),
  new SlashCommandBuilder().setName('servers').setDescription('🗺️ Live ARK cluster status').addStringOption(o=>o.setName('map').setDescription('Filter by map').setRequired(false)),
  new SlashCommandBuilder().setName('map').setDescription('🗺️ Detailed info for a specific map')
    .addStringOption(o=>o.setName('name').setDescription('Map').setRequired(true).addChoices(
      {name:'The Island',value:'island'},{name:'Volcano',value:'volcano'},
      {name:'Extinction',value:'extinction'},{name:'The Center',value:'center'},
      {name:'Lost Colony',value:'lostcolony'},{name:'Astraeos',value:'astraeos'},
      {name:'Valguero',value:'valguero'},{name:'Scorched Earth',value:'scorched'},
      {name:'Aberration (PvP)',value:'aberration'},{name:'Amissa (Patreon)',value:'amissa'},
    )),
  new SlashCommandBuilder().setName('monitor').setDescription('📡 [ADMIN] Post live server status monitor').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(o=>o.setName('channel').setDescription('Channel to post in').setRequired(true)),
  new SlashCommandBuilder().setName('info').setDescription('ℹ️ Server info and getting-started guide'),
  new SlashCommandBuilder().setName('rules').setDescription('📜 Dominion Codex rules'),
  new SlashCommandBuilder().setName('rates').setDescription('📈 All 5× boost rates'),
  new SlashCommandBuilder().setName('mods').setDescription('🔧 Active cluster mods'),
  new SlashCommandBuilder().setName('council').setDescription('🏛️ Meet the Conclave Council'),
  new SlashCommandBuilder().setName('wipe').setDescription('📅 Wipe schedule and countdown'),
  new SlashCommandBuilder().setName('set-wipe').setDescription('📅 [ADMIN] Set wipe date').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('date').setDescription('Date (YYYY-MM-DD)').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('transfer-guide').setDescription('🔄 Cross-ARK transfer guide'),
  new SlashCommandBuilder().setName('crossplay').setDescription('🎮 Crossplay connection guide'),
  new SlashCommandBuilder().setName('patreon').setDescription('⭐ Patreon perks and Amissa access'),
  new SlashCommandBuilder().setName('tip').setDescription('💡 Random ARK survival tip'),
  new SlashCommandBuilder().setName('dino').setDescription('🦕 ARK dino lookup').addStringOption(o=>o.setName('name').setDescription('Dino name').setRequired(true)),
  new SlashCommandBuilder().setName('trivia').setDescription('🎯 Start an ARK trivia question — win 15,000 ConCoins!'),
  new SlashCommandBuilder().setName('concoin-booty').setDescription('🪙 Check your ConCoin trivia booty balance')
    .addUserOption(o=>o.setName('user').setDescription('Check another user (admin only)').setRequired(false)),
  new SlashCommandBuilder().setName('concoin-leaderboard').setDescription('🏆 Top ConCoin trivia earners'),
  new SlashCommandBuilder().setName('grant-concoins').setDescription('💰 [ADMIN] Grant a player\'s ConCoin booty to UnbelievaBoat').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o=>o.setName('user').setDescription('Target player').setRequired(true))
    .addBooleanOption(o=>o.setName('confirm').setDescription('Confirm the grant (required)').setRequired(true)),
  new SlashCommandBuilder().setName('grant-concoins-manual').setDescription('💰 [ADMIN] Manually grant a ConCoin amount direct to UnbelievaBoat').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o=>o.setName('user').setDescription('Target player').setRequired(true))
    .addIntegerOption(o=>o.setName('amount').setDescription('ConCoin amount').setRequired(true).setMinValue(1))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('help').setDescription('📖 Full command reference'),
  new SlashCommandBuilder().setName('ping').setDescription('🏓 Bot latency and status'),
  new SlashCommandBuilder().setName('profile').setDescription('🎖️ View Dominion profile').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(false)),
  new SlashCommandBuilder().setName('rank').setDescription('📊 Your ClaveShard rank'),
  new SlashCommandBuilder().setName('rep').setDescription('⭐ Give reputation to a member')
    .addUserOption(o=>o.setName('user').setDescription('Who to rep').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Why?').setRequired(false)),
  new SlashCommandBuilder().setName('trade').setDescription('🤝 Post a trade request')
    .addStringOption(o=>o.setName('offering').setDescription('What you offer').setRequired(true))
    .addStringOption(o=>o.setName('looking-for').setDescription('What you want').setRequired(true))
    .addStringOption(o=>o.setName('server').setDescription('Which server').setRequired(false)),
  new SlashCommandBuilder().setName('coords').setDescription('📍 Share in-game coordinates')
    .addStringOption(o=>o.setName('location').setDescription('Location or coords').setRequired(true))
    .addStringOption(o=>o.setName('map').setDescription('Which map').setRequired(false)),
  new SlashCommandBuilder().setName('whois').setDescription('🔍 Look up a Discord member').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('🏠 Server statistics'),
  new SlashCommandBuilder().setName('report').setDescription('🚨 Report a player or issue')
    .addStringOption(o=>o.setName('issue').setDescription('Describe the issue').setRequired(true))
    .addStringOption(o=>o.setName('player').setDescription('Player involved (if any)').setRequired(false)),
  new SlashCommandBuilder().setName('tribe').setDescription('🏕️ Tribe registry')
    .addSubcommand(s=>s.setName('register').setDescription('📝 Register your tribe').addStringOption(o=>o.setName('name').setDescription('Tribe name').setRequired(true)).addStringOption(o=>o.setName('server').setDescription('Primary server').setRequired(true)).addStringOption(o=>o.setName('members').setDescription('Member names (comma-separated)').setRequired(false)))
    .addSubcommand(s=>s.setName('lookup').setDescription('🔍 Look up a tribe').addStringOption(o=>o.setName('query').setDescription('Tribe name or owner').setRequired(true)))
    .addSubcommand(s=>s.setName('my').setDescription('📋 View your registered tribe')),
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
    .addIntegerOption(o=>o.setName('winners').setDescription('Number of winners').setRequired(false).setMinValue(1).setMaxValue(10))
    .addIntegerOption(o=>o.setName('shard-entry').setDescription('Shards required to enter (0 = free)').setRequired(false).setMinValue(0)),
  new SlashCommandBuilder().setName('endgiveaway').setDescription('🎉 [ADMIN] End giveaway early').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('messageid').setDescription('Message ID of giveaway').setRequired(true)),
  new SlashCommandBuilder().setName('vote').setDescription('🗳️ [ADMIN] Create a community vote').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('question').setDescription('Vote question').setRequired(true))
    .addStringOption(o=>o.setName('options').setDescription('Options separated by | (2-4 options)').setRequired(true))
    .addIntegerOption(o=>o.setName('duration').setDescription('Duration in minutes').setRequired(false).setMinValue(1).setMaxValue(1440)),
  new SlashCommandBuilder().setName('warn').setDescription('⚠️ [MOD] Issue formal warning').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('warn-history').setDescription('📋 [MOD] View member warnings').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('warn-clear').setDescription('🧹 [MOD] Clear all warnings for a user').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('ban').setDescription('🔨 [MOD] Ban a member').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('timeout').setDescription('⏰ [MOD] Timeout a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o=>o.setName('duration').setDescription('Duration').setRequired(true).addChoices({name:'5 min',value:'5m'},{name:'1 hour',value:'1h'},{name:'6 hours',value:'6h'},{name:'24 hours',value:'24h'},{name:'7 days',value:'7d'}))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('modlog').setDescription('📋 [MOD] View recent mod actions').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addIntegerOption(o=>o.setName('count').setDescription('How many to show (max 20)').setRequired(false).setMinValue(1).setMaxValue(20)),
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
  new SlashCommandBuilder().setName('watchtower').setDescription('🛡️ [ADMIN] Post base protection request panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('know').setDescription('📚 [ADMIN] Manage AEGIS knowledge base').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s=>s.setName('add').setDescription('➕ Add entry').addStringOption(o=>o.setName('category').setDescription('Category').setRequired(true)).addStringOption(o=>o.setName('title').setDescription('Title').setRequired(true)).addStringOption(o=>o.setName('content').setDescription('Content').setRequired(true)))
    .addSubcommand(s=>s.setName('list').setDescription('📋 List entries').addStringOption(o=>o.setName('category').setDescription('Filter by category').setRequired(false)))
    .addSubcommand(s=>s.setName('delete').setDescription('🗑️ Delete entry').addStringOption(o=>o.setName('key').setDescription('Entry key').setRequired(true))),
  new SlashCommandBuilder().setName('roll').setDescription('🎲 Roll dice').addStringOption(o=>o.setName('dice').setDescription('Notation (2d6, d20)').setRequired(false)),
  new SlashCommandBuilder().setName('coinflip').setDescription('🪙 Flip a coin'),
  new SlashCommandBuilder().setName('calc').setDescription('🔢 Calculate expression').addStringOption(o=>o.setName('expression').setDescription('Math expression').setRequired(true)),
  new SlashCommandBuilder().setName('remind').setDescription('⏰ Set a reminder')
    .addStringOption(o=>o.setName('message').setDescription('What to remind you').setRequired(true))
    .addStringOption(o=>o.setName('time').setDescription('When (30m, 2h, 1d)').setRequired(true)),
  new SlashCommandBuilder().setName('poll').setDescription('📊 [ADMIN] Create a poll').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('question').setDescription('Question').setRequired(true))
    .addStringOption(o=>o.setName('options').setDescription('Options separated by |').setRequired(true)),
];
 
// ══════════════════════════════════════════════════════════════════════
// COMMAND REGISTRATION
// ══════════════════════════════════════════════════════════════════════
async function registerCommands() {
  if (!DISCORD_CLIENT_ID) { console.warn('⚠️ DISCORD_CLIENT_ID missing — skipping registration'); return; }
  const rest = new REST().setToken(DISCORD_BOT_TOKEN);
  try {
    const allJson = ALL_COMMANDS.map(c=>c.toJSON());
    console.log(`📡 Registering ${allJson.length} slash commands...`);
    if (DISCORD_GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body:allJson });
      console.log(`✅ Guild commands registered (${allJson.length})`);
    } else {
      await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body:allJson });
      console.log(`✅ Global commands registered (${allJson.length})`);
    }
  } catch (e) { console.error('❌ Registration failed:', e.message); }
}
 
const activeVotes = new Map();
 
// ══════════════════════════════════════════════════════════════════════
// INTERACTION HANDLER
// ══════════════════════════════════════════════════════════════════════
bot.on(Events.InteractionCreate, async interaction => {
  try {
    if (await handleWatchtowerInteraction(interaction, bot)) return;
  if (await handleTriviaCommand(interaction)) return;
if (await handleTriviaButton(interaction)) return;
if (await handleTriviaModalSubmit(interaction)) return;
 
    if (interaction.isButton() && interaction.customId==='giveaway_enter') {
      const gw = activeGiveaways.get(interaction.message.id);
      if (!gw) return interaction.reply({ content:'⚠️ Giveaway no longer active.', ephemeral:true });
      if (Date.now()>gw.endTime) return interaction.reply({ content:'⏰ Giveaway has ended.', ephemeral:true });
      if (gw.entries.has(interaction.user.id)) return interaction.reply({ content:'✅ Already entered!', ephemeral:true });
      if (gw.shardCost>0) {
        try { await deductShards(interaction.user.id, interaction.user.username, gw.shardCost, `Giveaway entry: ${gw.prize}`, 'SYSTEM', 'AEGIS'); }
        catch (e) { return interaction.reply({ content:`⚠️ Entry requires **${gw.shardCost} 💎** in your wallet. ${e.message}`, ephemeral:true }); }
      }
      gw.entries.add(interaction.user.id);
      return interaction.reply({ content:`🎉 You entered the **${gw.prize}** giveaway!${gw.shardCost>0?` (−${gw.shardCost} 💎)`:''} Good luck!`, ephemeral:true });
    }
 
    if (interaction.isButton() && interaction.customId?.startsWith('vote_')) {
      const [,msgId,optIdx] = interaction.customId.split('_');
      const vote = activeVotes.get(msgId);
      if (!vote) return interaction.reply({ content:'⚠️ Vote expired.', ephemeral:true });
      if (Date.now()>vote.ends) return interaction.reply({ content:'⏰ Vote has ended.', ephemeral:true });
      for (const [,voters] of vote.votes) voters.delete(interaction.user.id);
      if (!vote.votes.has(parseInt(optIdx))) vote.votes.set(parseInt(optIdx), new Set());
      vote.votes.get(parseInt(optIdx)).add(interaction.user.id);
      const totalVotes=[...vote.votes.values()].reduce((s,v)=>s+v.size,0);
      const resultLines=vote.options.map((o,i)=>{ const count=vote.votes.get(i)?.size||0; const pct=totalVotes?Math.round((count/totalVotes)*100):0; const bar='█'.repeat(Math.round(pct/5))+'░'.repeat(20-Math.round(pct/5)); return `**${i+1}.** ${o}\n\`${bar}\` **${pct}%** (${count} votes)`; }).join('\n\n');
      try { const msg=await interaction.message.fetch(); await msg.edit({ embeds:[base(`🗳️ ${vote.question}`,C.cy).setDescription(resultLines+`\n\n> Total votes: **${totalVotes}** · Ends <t:${Math.floor(vote.ends/1000)}:R>`)] }); }
      catch {}
      return interaction.reply({ content:`✅ Voted for **${vote.options[parseInt(optIdx)]}**!`, ephemeral:true });
    }
 
    if (interaction.isButton() && interaction.customId==='ticket_open') {
      await interaction.deferReply({ ephemeral:true });
      const safeName=interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,20);
      const existing=interaction.guild.channels.cache.find(c=>c.name===`ticket-${safeName}`);
      if (existing) return interaction.editReply(`⚠️ You already have an open ticket: ${existing}`);
      try {
        const ch=await interaction.guild.channels.create({
          name:`ticket-${safeName}`, type:ChannelType.GuildText,
          permissionOverwrites:[
            { id:interaction.guild.roles.everyone, deny:[PermissionFlagsBits.ViewChannel] },
            { id:interaction.user.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory] },
            { id:interaction.guild.members.me.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels] },
            ...(ROLE_ADMIN_ID?[{id:ROLE_ADMIN_ID,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]}]:[]),
            ...(ROLE_HELPER_ID?[{id:ROLE_HELPER_ID,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]}]:[]),
          ],
        });
        await ch.send({ embeds:[base('🎫 Support Ticket',C.cy).setDescription(`Hello ${interaction.user}! A staff member will assist you shortly.\n\nDescribe your issue in detail.`).setFooter(FT)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger))] });
        return interaction.editReply({ content:`✅ Ticket created: ${ch}` });
      } catch (e) { return interaction.editReply(`⚠️ Error: ${e.message}`); }
    }
    if (interaction.isButton() && interaction.customId==='ticket_close') {
      if (!isMod(interaction.member)) return interaction.reply({ content:'⛔ Staff only.', ephemeral:true });
      await interaction.reply('🔒 Closing ticket in 5 seconds...');
      setTimeout(()=>interaction.channel.delete().catch(()=>{}), 5000);
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName:cmd } = interaction;
    await interaction.deferReply();
 
    if (cmd==='watchtower') {
      if (!isAdmin(interaction.member)) return interaction.editReply('❌ Admin only.');
      await sendWatchtowerPanel(interaction.channel);
      return interaction.editReply({ content:'✅ Watchtower panel posted.', ephemeral:true });
    }
 
    // ════════════════════════════════════════════════════════════════
    // ECONOMY
    // ════════════════════════════════════════════════════════════════
    if (cmd==='wallet'||cmd==='curr') {
      const sub=interaction.options.getSubcommand();
      const target=interaction.options.getUser('user');
      const amount=interaction.options.getInteger('amount')||0;
      const reason=interaction.options.getString('reason')||'';
      const count=interaction.options.getInteger('count')||15;
      const me=interaction.user;
      try {
        if (sub==='balance')     { const who=target||me; const w=await getWallet(who.id,who.username); return interaction.editReply({ embeds:[P.WalletPanel(`💎 ${who.username}'s Wallet`,w)] }); }
        if (sub==='deposit')     { const w=await depositToBank(me.id,me.username,amount); return interaction.editReply({ embeds:[walletEmbed(`🏦 Deposited ${amount} 💎`,w,C.gr)] }); }
        if (sub==='withdraw')    { const w=await withdrawFromBank(me.id,me.username,amount); return interaction.editReply({ embeds:[walletEmbed(`💸 Withdrew ${amount} 💎`,w,C.cy)] }); }
        if (sub==='transfer')    { if (!target) return interaction.editReply('⚠️ Specify a recipient.'); const note=interaction.options.getString('note')||''; const r=await transferShards(me.id,me.username,target.id,target.username,amount); return interaction.editReply({ embeds:[base(`➡️ Transferred ${amount} 💎`,C.cy).setDescription(`Sent **${amount}** to **${target.username}**${note?`\n📝 *"${note}"*`:''}`).addFields({name:'Your wallet',value:`${r.sent.toLocaleString()} 💎`,inline:true},{name:`${target.username}'s wallet`,value:`${r.received.toLocaleString()} 💎`,inline:true})] }); }
        if (sub==='history')     { const who=target||me; if (target&&target.id!==me.id&&!isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only for other users.'); const rows=await getTxHistory(who.id,count); if (!rows.length) return interaction.editReply(`📭 No history for **${who.username}** yet.`); return interaction.editReply({ embeds:[P.HistoryPanel(who.username,rows)] }); }
        if (sub==='leaderboard') { const rows=await getLeaderboard(10); return interaction.editReply({ embeds:[P.LeaderboardPanel(rows)] }); }
        if (sub==='supply')      { const s=await getSupply(); return interaction.editReply({ embeds:[P.SupplyPanel(s)] }); }
        if (sub==='grant')       { if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only.'); if (!target) return interaction.editReply('⚠️ Specify target.'); const w=await grantShards(target.id,target.username,amount,reason||'Admin grant',me.id,me.username); try { await target.send({ embeds:[base('💎 ClaveShard Received!',C.gr).setDescription(`**${me.username}** granted you **${amount.toLocaleString()} 💎**\n📝 *${reason||'Admin grant'}*`)] }); } catch {} return interaction.editReply({ embeds:[walletEmbed(`🎁 Granted ${amount} to ${target.username}`,w,C.gr)] }); }
        if (sub==='deduct')      { if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only.'); if (!target) return interaction.editReply('⚠️ Specify target.'); const w=await deductShards(target.id,target.username,amount,reason||'Admin deduct',me.id,me.username); return interaction.editReply({ embeds:[walletEmbed(`⬇️ Deducted ${amount} from ${target.username}`,w,C.rd)] }); }
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }
 
    if (cmd==='weekly') {
      try { const r=await claimWeekly(interaction.user.id,interaction.user.username); return interaction.editReply({ embeds:[base('🌟 Weekly ClaveShard Claimed!',C.gold).setDescription(`**${interaction.user.username}** claimed their weekly reward!`).addFields({name:'💎 Claimed',value:`**+${r.amount}**`,inline:true},{name:'🔥 Streak',value:`Week ${r.streak}`,inline:true},{name:'💰 Balance',value:`${(r.data.wallet_balance||0).toLocaleString()}`,inline:true})] }); }
      catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }
 
    if (cmd==='leaderboard') {
      try { const lb=await getLeaderboard(10); return interaction.editReply({ embeds:[P.LeaderboardPanel(lb)] }); }
      catch { return interaction.editReply({ embeds:[P.ErrorPanel('Leaderboard','Leaderboard temporarily unavailable.')] }); }
    }
 
    if (cmd==='streaks') {
      try { const rows=await getStreakLeaderboard(10); return interaction.editReply({ embeds:[P.StreakPanel(rows)] }); }
      catch { return interaction.editReply('⚠️ Streak data unavailable.'); }
    }
 
    if (cmd==='give') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      try { const target=interaction.options.getUser('user'), amount=interaction.options.getInteger('amount'), reason=interaction.options.getString('reason')||'Admin grant'; const w=await grantShards(target.id,target.username,amount,reason,interaction.user.id,interaction.user.username); return interaction.editReply({ embeds:[walletEmbed(`🎁 Granted to ${target.username}`,w,C.gr).setDescription(`+**${amount}** 💎 · ${reason}`)] }); }
      catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }
 
    if (cmd==='clvsd') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const sub=interaction.options.getSubcommand(), me=interaction.user;
      try {
        if (sub==='grant')   { const t=interaction.options.getUser('user'),a=interaction.options.getInteger('amount'),r=interaction.options.getString('reason')||''; const w=await grantShards(t.id,t.username,a,r,me.id,me.username); return interaction.editReply({ embeds:[walletEmbed(`🎁 +${a} → ${t.username}`,w,C.gr)] }); }
        if (sub==='deduct')  { const t=interaction.options.getUser('user'),a=interaction.options.getInteger('amount'),r=interaction.options.getString('reason')||''; const w=await deductShards(t.id,t.username,a,r,me.id,me.username); return interaction.editReply({ embeds:[walletEmbed(`⬇️ -${a} from ${t.username}`,w,C.rd)] }); }
        if (sub==='check')   { const t=interaction.options.getUser('user'); const w=await getWallet(t.id,t.username); return interaction.editReply({ embeds:[walletEmbed(`🔍 ${t.username}'s Wallet`,w)] }); }
        if (sub==='set')     { const t=interaction.options.getUser('user'),a=interaction.options.getInteger('amount'),r=interaction.options.getString('reason')||'Admin set'; await getWallet(t.id,t.username); const w=await setBalance(t.id,t.username,a,r,me.id,me.username); return interaction.editReply({ embeds:[walletEmbed(`🔧 Set ${t.username} to ${a} 💎`,w,C.cy)] }); }
        if (sub==='reset')   { const t=interaction.options.getUser('user'),r=interaction.options.getString('reason')||'Admin reset'; const w=await resetWallet(t.id,t.username,me.id,me.username); return interaction.editReply({ embeds:[walletEmbed(`🔄 Reset ${t.username}'s wallet`,w,C.am)] }); }
        if (sub==='top')     { const lb=await getLeaderboard(15); return interaction.editReply({ embeds:[base('🏆 Top 15 Holders',C.gold).setDescription(lb.map((w,i)=>`**${i+1}.** ${w.discord_tag||w.discord_id} · **${((w.wallet_balance||0)+(w.bank_balance||0)).toLocaleString()}**`).join('\n'))] }); }
        if (sub==='stats')   { const s=await getSupply(); return interaction.editReply({ embeds:[base('📊 Economy Stats',C.cy).addFields({name:'💎 Wallet Total',value:s.walletTotal.toLocaleString(),inline:true},{name:'🏦 Bank Total',value:s.bankTotal.toLocaleString(),inline:true},{name:'📦 Grand Total',value:(s.walletTotal+s.bankTotal).toLocaleString(),inline:true},{name:'👥 Holders',value:`${s.holders}`,inline:true})] }); }
        if (sub==='digest') {
          if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
          const since=new Date(Date.now()-7*24*60*60*1000).toISOString();
          const { data:ledger } = await sb.from('aegis_wallet_ledger').select('action,amount,actor_tag').gte('created_at',since);
          const grants=ledger?.filter(r=>r.action==='grant').reduce((s,r)=>s+(r.amount||0),0)||0;
          const deducts=ledger?.filter(r=>r.action==='deduct').reduce((s,r)=>s+(r.amount||0),0)||0;
          const { count:orders } = await sb.from('aegis_orders').select('*',{count:'exact',head:true}).gte('created_at',since);
          const lb=await getLeaderboard(1);
          return interaction.editReply({ embeds:[P.DigestPanel('Last 7 days',grants,deducts,orders||0,lb[0]?.discord_tag||'N/A')] });
        }
        if (sub==='usage') {
          if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
          const { data } = await sb.from('aegis_ai_usage').select('model,engine,input_tokens,output_tokens').order('created_at',{ascending:false}).limit(500);
          const total=data?.length||0, haiku=data?.filter(r=>r.engine==='anthropic')||[], groqRows=data?.filter(r=>r.engine==='groq')||[];
          const inp=data?.reduce((s,r)=>s+(r.input_tokens||0),0)||0, out=data?.reduce((s,r)=>s+(r.output_tokens||0),0)||0;
          const cost_usd=(inp/1000*0.001)+(out/1000*0.005);
          return interaction.editReply({ embeds:[P.AiUsagePanel(total,haiku.length,groqRows.length,inp,out,cost_usd)] });
        }
        if (sub==='bulk-grant') {
          const amount=interaction.options.getInteger('amount'), reason=interaction.options.getString('reason')||'Bulk grant';
          const users=[1,2,3,4,5].map(n=>interaction.options.getUser(`user${n}`)).filter(Boolean);
          const results=await bulkGrant(users.map(u=>({id:u.id,tag:u.username})),amount,reason,me.id,me.username);
          const lines=results.map(r=>r.success?`✅ **${r.tag}** → +${amount} 💎`:`❌ **${r.tag}** — ${r.error}`).join('\n');
          return interaction.editReply({ embeds:[base(`🎁 Bulk Grant: +${amount} to ${users.length} users`,C.gr).setDescription(lines)] });
        }
        if (sub==='audit') {
          if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
          const limit=interaction.options.getInteger('limit')||10;
          const { data } = await sb.from('aegis_wallet_ledger').select('discord_id,action,amount,note,actor_tag,created_at').order('created_at',{ascending:false}).limit(limit);
          const lines=(data||[]).map(r=>`\`${r.action.padEnd(14)}\` **${r.amount>0?'+':''}${r.amount}** · <@${r.discord_id}> · *${r.note?.slice(0,40)||'—'}* · <t:${Math.floor(new Date(r.created_at).getTime()/1000)}:R>`).join('\n');
          return interaction.editReply({ embeds:[base('📋 Economy Audit Log',C.cy).setDescription(lines||'_No records._')] });
        }
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }
 
    // ════════════════════════════════════════════════════════════════
    // SHOP
    // ════════════════════════════════════════════════════════════════
    if (cmd==='order') {
      const shards=interaction.options.getInteger('tier'), platform=interaction.options.getString('platform'), server=interaction.options.getString('server'), notes=interaction.options.getString('notes')||'None', autoDeduct=interaction.options.getBoolean('auto-deduct')??false;
      const tier=SHOP_TIERS.find(t=>t.shards===shards&&t.shards>0);
      if (!tier) return interaction.editReply(`⚠️ No tier for **${shards}** shards. Valid: 1,2,3,5,6,8,10,12,15,20,30`);
      const ref=`ORD-${Date.now().toString(36).toUpperCase()}`; let deducted=false;
      if (autoDeduct) { try { await deductShards(interaction.user.id,interaction.user.username,shards,`Shop order ${ref}`,'SYSTEM','AEGIS Shop'); deducted=true; } catch (e) { return interaction.editReply(`⚠️ Auto-deduct failed: ${e.message}\nEnsure you have **${shards} 💎** in wallet.`); } }
      const emb=base(`📦 Order Submitted — ${tier.emoji} ${tier.name}`,C.gold).addFields({name:'📋 Ref',value:`\`${ref}\``,inline:true},{name:'💎 Cost',value:`${shards} shard${shards!==1?'s':''}`,inline:true},{name:deducted?'✅ Payment':'💳 Payment',value:deducted?'Auto-deducted':'CashApp **$TheConclaveDominion**',inline:true},{name:'🎮 Platform',value:platform,inline:true},{name:'🗺️ Server',value:server,inline:true},{name:'📝 Notes',value:notes,inline:false},{name:'📦 Includes',value:tier.items.map(i=>`• ${i}`).join('\n').slice(0,1000),inline:false});
      if (sb&&sbOk()) try { await sb.from('aegis_orders').insert({ ref, guild_id:interaction.guildId, discord_id:interaction.user.id, discord_tag:interaction.user.username, tier:tier.name, shards, platform, server, notes, auto_deducted:deducted, status:'pending', created_at:new Date().toISOString() }); } catch {}
      const orderChannel=process.env.ORDERS_CHANNEL_ID;
      if (orderChannel) { try { const ch=bot.channels.cache.get(orderChannel); if (ch) await ch.send({ embeds:[emb.setFooter({...FT,text:`Order from ${interaction.user.username} (${interaction.user.id})`})] }); } catch {} }
      try { await interaction.user.send({ embeds:[base(`🧾 Order Receipt — ${ref}`,C.gold).setDescription(`**${tier.name}** · ${platform} · ${server}\n\n${deducted?`✅ ${shards} shards auto-deducted.`:`💳 Pay **$TheConclaveDominion** and include ref: \`${ref}\``}`)] }); } catch {}
      return interaction.editReply({ embeds:[emb] });
    }
 
    if (cmd==='fulfill') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const ref=interaction.options.getString('ref'), note=interaction.options.getString('note')||'Your order is ready!';
      let discordId=null;
      if (sb&&sbOk()) try { const { data } = await sb.from('aegis_orders').update({ status:'fulfilled', fulfilled_at:new Date().toISOString(), fulfillment_note:note }).eq('ref',ref).select('discord_id').single(); discordId=data?.discord_id; } catch {}
      if (discordId) { try { const u=await bot.users.fetch(discordId); await u.send({ embeds:[base('✅ Order Fulfilled!',C.gr).setDescription(`Your order **\`${ref}\`** has been fulfilled!\n📝 *${note}*`).setFooter(FT)] }); } catch {} }
      return interaction.editReply({ embeds:[base('✅ Order Fulfilled',C.gr).addFields({name:'📋 Ref',value:`\`${ref}\``,inline:true},{name:'📝 Note',value:note,inline:false})] });
    }
 
    if (cmd==='shard') {
      const emb=base('💠 ClaveShard Tier List',C.gold).setDescription('Shop: **theconclavedominion.com/shop** | `/order` to submit\nCashApp **$TheConclaveDominion**');
      for (const tier of SHOP_TIERS.filter(t=>t.shards>0)) emb.addFields({name:`${tier.emoji} ${tier.name}`,value:tier.items.slice(0,5).map(i=>`• ${i}`).join('\n'),inline:true});
      emb.addFields({name:'🛡 Dino Insurance',value:SHOP_TIERS.find(t=>t.shards===0).items.map(i=>`• ${i}`).join('\n'),inline:false});
      return interaction.editReply({ embeds:[emb] });
    }
 
    if (cmd==='shop') {
      const select=new StringSelectMenuBuilder().setCustomId('shop_tier_view').setPlaceholder('💎 View a tier...').addOptions(SHOP_TIERS.filter(t=>t.shards>0).map(t=>({label:`${t.emoji} ${t.name}`,value:`${t.shards}`,description:t.items[0]})));
      return interaction.editReply({ embeds:[base('🛍️ ClaveShard Shop',C.gold).setDescription('Select a tier below.\n\nUse `/order` to submit.\n\n💳 CashApp **$TheConclaveDominion**\n\n🔗 **theconclavedominion.com/shop**')], components:[new ActionRowBuilder().addComponents(select)] });
    }
 
    // ════════════════════════════════════════════════════════════════
    // AI
    // ════════════════════════════════════════════════════════════════
    if (cmd==='aegis'||cmd==='ask') {
      const q=interaction.options.getString('question');
      const wait=checkRate(interaction.user.id,5000); if (wait) return interaction.editReply(`⏳ Please wait ${wait}s.`);
      const resp=await askAegis(q,interaction.user.id,'',interaction.channelId);
      return interaction.editReply({ embeds:[P.AegisPanel(resp, anthropic?'ANTHROPIC·HAIKU·4.5':'GROQ·LLAMA·3')] });
    }
 
    if (cmd==='forget') { clearHist(interaction.user.id); return interaction.editReply('🧹 Conversation history cleared.'); }
 
    if (cmd==='ai-cost') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
      try {
        const { data } = await sb.from('aegis_ai_usage').select('model,engine,input_tokens,output_tokens').order('created_at',{ascending:false}).limit(500);
        const total=data?.length||0, haiku=data?.filter(r=>r.engine==='anthropic')||[], groqRows=data?.filter(r=>r.engine==='groq')||[];
        const inp=data?.reduce((s,r)=>s+(r.input_tokens||0),0)||0, out=data?.reduce((s,r)=>s+(r.output_tokens||0),0)||0;
        const cost_usd=(inp/1000*0.001)+(out/1000*0.005);
        return interaction.editReply({ embeds:[P.AiUsagePanel(total,haiku.length,groqRows.length,inp,out,cost_usd)] });
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }
 
    if (cmd==='aegis-persona') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const style=interaction.options.getString('style'), note=interaction.options.getString('note')||'';
      if (style==='reset') { personaOverrides.delete(interaction.channelId); return interaction.editReply('✅ AEGIS persona reset to Sovereign default.'); }
      const styleMap={ sovereign:'Cold, precise, cosmic authority. Minimal emotion. Maximum impact.', combat:'Tactical, urgent, battle-focused. Short sentences. War-room energy.', shop:'Merchant warmth. Clear item descriptions. Payment guidance.', lore:'Ancient, mystical, world-builder. Rich descriptions. Keeper of secrets.', friendly:'Warm, approachable, helpful. Like a knowledgeable guild mate.' };
      personaOverrides.set(interaction.channelId,{style:styleMap[style]||style,note});
      return interaction.editReply({ embeds:[base('🎭 AEGIS Persona Set',C.pl).setDescription(`**Style:** ${style}\n**Channel:** <#${interaction.channelId}>${note?`\n\n📝 Note: ${note}`:''}`)] });
    }
 
    if (cmd==='summarize') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const count=interaction.options.getInteger('count')||25;
      try {
        const messages=await interaction.channel.messages.fetch({limit:count});
        const text=[...messages.values()].reverse().filter(m=>!m.author.bot).map(m=>`${m.author.username}: ${m.content.slice(0,200)}`).join('\n');
        if (!text.trim()) return interaction.editReply('📭 No non-bot messages to summarize.');
        const summary=await aiSummarize(`Summarize these Discord messages from TheConclave Dominion gaming community concisely (max 5 bullet points):\n\n${text}`);
        return interaction.editReply({ embeds:[base('📝 AEGIS Chat Summary',C.pl).setDescription(summary||'Unable to summarize.').setFooter({...FT,text:`Last ${count} messages · AEGIS v12.1`})] });
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }
 
    if (cmd==='compare') {
      const dino1=interaction.options.getString('dino1'), dino2=interaction.options.getString('dino2');
      const resp=await askAegis(`Compare ${dino1} vs ${dino2} in ARK: Survival Ascended. Cover: taming difficulty, combat effectiveness, utility/uses, resource gathering, speed, recommended saddle level. TheConclave uses 5× rates and max wild 350. Keep under 1600 chars.`,null,'',interaction.channelId);
      return interaction.editReply({ embeds:[base(`⚖️ ${dino1} vs ${dino2}`,C.cy).setDescription(resp).setAuthor({name:'🦕 AEGIS Dino Comparer',iconURL:'https://theconclavedominion.com/conclave-badge.png'})] });
    }
 
    if (cmd==='boss-guide') {
      const boss=interaction.options.getString('boss');
      const resp=await askAegis(`Detailed boss fight guide for ${boss} in ARK Survival Ascended. Include: recommended dinos, ideal levels (TheConclave max wild 350), artifact/tribute requirements, fight strategy, common mistakes, rewards. Under 1600 chars.`,null,'',interaction.channelId);
      return interaction.editReply({ embeds:[base(`👹 Boss Guide: ${boss}`,C.rd).setDescription(resp).setAuthor({name:'⚔️ AEGIS Boss Intelligence',iconURL:'https://theconclavedominion.com/conclave-badge.png'})] });
    }
 
    if (cmd==='base-tips') {
      const mapId=interaction.options.getString('map'), mapName=MAP_INFO[mapId]?.name||mapId;
      const resp=await askAegis(`Base building tips for ${mapName} in ARK Survival Ascended on TheConclave Dominion (5× PvE, except Aberration PvP). Best locations with coordinates, terrain advantages, resource proximity, threats. Under 1600 chars.`,null,'',interaction.channelId);
      return interaction.editReply({ embeds:[base(`🏗️ Base Tips: ${mapName}`,C.gr).setDescription(resp).setAuthor({name:'🗺️ AEGIS Base Intelligence',iconURL:'https://theconclavedominion.com/conclave-badge.png'})] });
    }
 
    // ════════════════════════════════════════════════════════════════
    // SERVERS
    // ════════════════════════════════════════════════════════════════
    if (cmd==='servers') {
      const filter=interaction.options.getString('map');
      let servers=await fetchServerStatuses().catch(()=>MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20})));
      if (filter) servers=servers.filter(s=>s.name.toLowerCase().includes(filter.toLowerCase())||s.id.includes(filter.toLowerCase()));
      return interaction.editReply({ embeds:[P.ServerMonitorPanel(servers)] });
    }
 
    if (cmd==='map') {
      const id=interaction.options.getString('name'), m=MAP_INFO[id];
      if (!m) return interaction.editReply('⚠️ Map not found.');
      return interaction.editReply({ embeds:[P.MapPanel(m)] });
    }
 
    if (cmd==='monitor') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const ch=interaction.options.getChannel('channel');
      const servers=await fetchServerStatuses().catch(()=>MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20})));
      const msg=await ch.send({ embeds:[buildMonitorEmbed(servers)] });
      monitorState.set(interaction.guildId,{statusChannelId:ch.id,messageId:msg.id});
      return interaction.editReply(`✅ Live monitor posted in ${ch}. Auto-refreshes every 5 min.`);
    }
 
    // ════════════════════════════════════════════════════════════════
    // INFO
    // ════════════════════════════════════════════════════════════════
    if (cmd==='info')    { return interaction.editReply({ embeds:[P.InfoPanel()] }); }
    if (cmd==='rules')   { return interaction.editReply({ embeds:[P.RulesPanel()] }); }
    if (cmd==='council') { return interaction.editReply({ embeds:[P.CouncilPanel()] }); }
 
    if (cmd==='rates') {
      return interaction.editReply({ embeds:[base('📈 5× Boost Rates',C.gr).addFields(
        {name:'⚡ Core',value:'XP: 5× · Harvest: 5× · Taming: 5× · Breeding: 5×',inline:false},
        {name:'🏋️ QoL',value:'Weight: 1,000,000 · No Fall Damage · Increased Stacks',inline:false},
        {name:'🥚 Breeding',value:'Egg Hatch: 50× · Mature: 50× · Cuddle: 0.025',inline:false},
        {name:'🦕 Creatures',value:'Max Wild: 350 · Tamed Cap: 600',inline:false},
      )] });
    }
 
    if (cmd==='mods') {
      return interaction.editReply({ embeds:[base('🔧 Active Cluster Mods',C.cy).addFields(
        {name:'Death Inventory Keeper',value:'Never lose your items on death.',inline:true},
        {name:'ARKomatic',value:'Quality-of-life improvements.',inline:true},
        {name:'Awesome Spyglass',value:'Advanced creature stats at a glance.',inline:true},
        {name:'Teleporter',value:'Fast travel between owned teleporters.',inline:true},
      )] });
    }
 
    if (cmd==='wipe') {
      if (wipeData.date) { const ts=Math.floor(new Date(wipeData.date).getTime()/1000); return interaction.editReply({ embeds:[base('📅 Wipe Tracker',C.rd).setDescription(`**Next wipe:** <t:${ts}:F>\n**Countdown:** <t:${ts}:R>\n**Reason:** ${wipeData.reason||'TBA'}\n**Set by:** ${wipeData.setBy||'Council'}`)] }); }
      return interaction.editReply({ embeds:[base('📅 Wipe Schedule',C.gold).setDescription('No wipe currently scheduled.\n\nWipes are announced **at least 2 weeks in advance**.')] });
    }
 
    if (cmd==='set-wipe') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const dateStr=interaction.options.getString('date'), reason=interaction.options.getString('reason')||'Scheduled wipe';
      const d=new Date(dateStr); if (isNaN(d)) return interaction.editReply('⚠️ Invalid date format. Use YYYY-MM-DD.');
      wipeData.date=dateStr; wipeData.reason=reason; wipeData.setBy=interaction.user.username; wipeData.setAt=new Date().toISOString();
      return interaction.editReply({ embeds:[base('📅 Wipe Date Set',C.rd).setDescription(`**Date:** <t:${Math.floor(d.getTime()/1000)}:F>\n**Reason:** ${reason}\n**Countdown:** <t:${Math.floor(d.getTime()/1000)}:R>`)] });
    }
 
    if (cmd==='transfer-guide') {
      return interaction.editReply({ embeds:[base('🔄 Cross-ARK Transfer Guide',C.cy).addFields(
        {name:'📤 Uploading',value:'Use any Obelisk, Terminal, or Loot Crate. Upload via ARK Data. Wait ~1 min before downloading.',inline:false},
        {name:'📥 Downloading',value:'Visit any Obelisk/Terminal on destination. Open ARK Data tab and retrieve.',inline:false},
        {name:'⚠️ Notes',value:'Items expire after 24 hours. Some boss items cannot transfer. Element restricted on some maps.',inline:false},
      )] });
    }
 
    if (cmd==='crossplay') {
      return interaction.editReply({ embeds:[base('🎮 Crossplay Connection Guide',C.cy).addFields(
        {name:'🎮 Xbox',value:'ARK SA → Multiplayer → Join via IP. Type the IP:Port from `/servers`.',inline:false},
        {name:'🎮 PlayStation',value:'Same as Xbox — use the Join via IP option in the multiplayer menu.',inline:false},
        {name:'💻 PC',value:'In ARK SA, go to Join Game → filter by "TheConclave" or paste the IP.',inline:false},
      )] });
    }
 
    if (cmd==='patreon') {
      return interaction.editReply({ embeds:[base('⭐ Patreon Perks',C.gold).setDescription('Support at **patreon.com/theconclavedominion**').addFields(
        {name:'🥉 Supporter',value:'Discord role · Supporter channels',inline:true},
        {name:'🥈 Champion',value:'All above',inline:true},
        {name:'🥇 Elite ($20/mo)',value:'All above + Bonus ClaveShards monthly + **Amissa access** · Priority support',inline:true},
      )] });
    }
 
    if (cmd==='tip') {
      const tips=['Always disable friendly fire before taming!','Keep a Cryopod ready — cryo your tames before danger.','Use the Spyglass mod to check dino stats BEFORE taming.','Build your first base near water and resources.','Boss arenas wipe your inventory — prepare a dedicated boss kit.','Upload your best tames to ARK Data before a wipe warning.','The Megatherium gets a 75% damage boost after killing bugs — great for Broodmother.','Flak armor gives the best overall protection for mid-game.','First torpor = tame ownership — verbal claims are not valid.','Always name your best dinos — it helps with Dino Insurance claims.','Rock Elementals take reduced damage from most weapons — use explosives.','Keep your tributes uploaded — bosses can be attempted anytime.'];
      return interaction.editReply({ embeds:[P.TipPanel(tips[Math.floor(Math.random()*tips.length)])] });
    }
 
    if (cmd==='dino') {
      const name=interaction.options.getString('name');
      const resp=await askAegis(`ARK encyclopedia entry for "${name}": taming method, best food, saddle level, recommended use, stats to prioritize, TheConclave tips on 5× rates. Under 1600 chars.`,null);
      return interaction.editReply({ embeds:[P.DinoPanel(name,resp)] });
    }
 
    // ════════════════════════════════════════════════════════════════
    // TRIVIA — reward: 15,000 ConCoins
    // ════════════════════════════════════════════════════════════════
    if (cmd==='trivia') {
      if (activeTrivias.has(interaction.channelId)) {
        const existing=activeTrivias.get(interaction.channelId);
        if (Date.now()<existing.expiresAt) return interaction.editReply(`⚠️ There's already an active trivia question in this channel!\n**Hint:** ${existing.hint}`);
        activeTrivias.delete(interaction.channelId);
      }
      const q=TRIVIA_QUESTIONS[Math.floor(Math.random()*TRIVIA_QUESTIONS.length)];
      const expiresAt=Date.now()+60_000;
      activeTrivias.set(interaction.channelId,{...q, expiresAt});
      return interaction.editReply({ embeds:[base('🎯 ARK Trivia!',C.pk).setDescription([
        `**Question:** ${q.q}`,
        '',
        `> 🪙 First correct answer wins **${CONCOIN_TRIVIA_REWARD.toLocaleString()} ConCoins!**`,
        `> Type your answer in this channel. Expires <t:${Math.floor(expiresAt/1000)}:R>`,
        '',
        `-# Use /concoin-booty to check your total · Admins use /grant-concoins to pay out`,
      ].join('\n'))] });
    }
 
    // ════════════════════════════════════════════════════════════════
    // CONCOIN BOOTY
    // ════════════════════════════════════════════════════════════════
    if (cmd==='concoin-booty') {
      const target=interaction.options.getUser('user');
      if (target&&target.id!==interaction.user.id&&!isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only for checking other players.');
      const who=target||interaction.user;
      const booty=await getConcoinBooty(who.id);
      if (!booty) return interaction.editReply({ embeds:[base('🪙 ConCoin Booty — Empty',C.cy).setDescription(`**${who.username}** hasn't won any trivia yet!\n\nUse \`/trivia\` to start earning. Each correct answer earns **${CONCOIN_TRIVIA_REWARD.toLocaleString()} ConCoins**!`)] });
      return interaction.editReply({ embeds:[base(`🪙 ${who.username}'s ConCoin Booty`,C.gold).addFields(
        {name:'💰 Pending Payout', value:`**${(booty.pending_grant||0).toLocaleString()} ConCoins**`, inline:true},
        {name:'📊 Total Earned',  value:`**${(booty.total_earned||0).toLocaleString()} ConCoins**`,  inline:true},
        {name:'✅ Total Granted', value:`**${(booty.total_granted||0).toLocaleString()} ConCoins**`, inline:true},
        {name:'🎯 Trivia Wins',   value:`**${booty.trivia_wins||0}** correct answers`,               inline:true},
        {name:'⏰ Last Win',      value:booty.last_won?`<t:${Math.floor(new Date(booty.last_won).getTime()/1000)}:R>`:'Never', inline:true},
        {name:'💸 Last Granted',  value:booty.last_granted_at?`<t:${Math.floor(new Date(booty.last_granted_at).getTime()/1000)}:R> by ${booty.last_granted_by||'?'}`:'Never', inline:false},
      ).setFooter({...FT,text:'Use /trivia to earn more · Admins use /grant-concoins to pay out'})] });
    }
 
    if (cmd==='concoin-leaderboard') {
      const rows=await getConcoinLeaderboard(10);
      if (!rows.length) return interaction.editReply('📭 No trivia winners yet! Use `/trivia` to be the first!');
      const medals=['👑','🥇','🥈','🥉','💠','💠','💠','💠','💠','💠'];
      const lines=rows.map((r,i)=>`${medals[i]||`**${i+1}.**`} **${r.discord_tag||r.discord_id}**\n> 🪙 **${(r.total_earned||0).toLocaleString()} CC** earned · 🎯 ${r.trivia_wins||0} wins · 💰 ${(r.pending_grant||0).toLocaleString()} pending`).join('\n\n');
      return interaction.editReply({ embeds:[base('🪙 ConCoin Trivia Leaderboard',C.gold).setDescription(`\`⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿\`\n> ◈ *Top ConCoin earners through trivia*\n\`⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒\`\n\n${lines}\n\n\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`\n-# Each correct /trivia earns ${CONCOIN_TRIVIA_REWARD.toLocaleString()} ConCoins`).setFooter({...FT,text:'ConCoin Booty System v12.1'})] });
    }
 
    if (cmd==='grant-concoins') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const target=interaction.options.getUser('user'), confirm=interaction.options.getBoolean('confirm');
      if (!confirm) return interaction.editReply('⚠️ You must set `confirm: True` to execute the grant.');
      const booty=await getConcoinBooty(target.id);
      if (!booty||booty.pending_grant<=0) return interaction.editReply(`⚠️ **${target.username}** has no pending ConCoin booty to grant.`);
      const amount=booty.pending_grant;
      let ubResult=null, ubError=null;
      try { ubResult=await grantToUnbelievaBoat(interaction.guildId, target.id, amount); } catch (e) { ubError=e.message; }
      await clearPendingBooty(target.id, amount, interaction.user.username);
      if (ubResult) {
        try { await target.send({ embeds:[base('💰 ConCoin Booty Paid Out!',C.gr).setDescription(`Your trivia winnings have been transferred to your UnbelievaBoat wallet!\n\nKeep playing \`/trivia\` to earn more!`).addFields({name:'🪙 Amount',value:`**${amount.toLocaleString()} ConCoins**`,inline:true},{name:'👮 By',value:interaction.user.username,inline:true}).setFooter({...FT,text:'AEGIS ConCoin Booty System'})] }); } catch {}
        return interaction.editReply({ embeds:[base('✅ ConCoin Booty Granted!',C.gr).addFields(
          {name:'👤 Player', value:`**${target.username}**`, inline:true},
          {name:'💰 Amount', value:`**${amount.toLocaleString()} ConCoins**`, inline:true},
          {name:'📡 UB API', value:'✅ Success', inline:false},
          {name:'💳 New Cash', value:`${ubResult?.cash?.toLocaleString()||'?'}`, inline:true},
        ).setFooter({...FT,text:`Granted by ${interaction.user.username}`})] });
      } else {
        return interaction.editReply({ embeds:[base('⚠️ Booty Cleared — UB API Failed',C.am).setDescription(`Booty cleared from database but UnbelievaBoat API call failed.\n\n**Please grant manually in UB.**`).addFields(
          {name:'👤 Player', value:`**${target.username}** (\`${target.id}\`)`, inline:false},
          {name:'💰 Amount', value:`**${amount.toLocaleString()} ConCoins**`, inline:true},
          {name:'❌ UB Error', value:`\`${ubError||'Unknown error'}\``, inline:false},
          {name:'🔧 Fix', value:'Add UNBELIEVABOAT_API_TOKEN to Render env, or grant manually in UB dashboard.', inline:false},
        )] });
      }
    }
 
    if (cmd==='grant-concoins-manual') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const target=interaction.options.getUser('user'), amount=interaction.options.getInteger('amount'), reason=interaction.options.getString('reason')||'Admin manual grant';
      let ubResult=null, ubError=null;
      try { ubResult=await grantToUnbelievaBoat(interaction.guildId, target.id, amount); } catch (e) { ubError=e.message; }
      if (ubResult) {
        return interaction.editReply({ embeds:[base('✅ Manual ConCoin Grant Success',C.gr).addFields(
          {name:'👤 Player', value:`**${target.username}**`, inline:true},
          {name:'💰 Amount', value:`**${amount.toLocaleString()} ConCoins**`, inline:true},
          {name:'📋 Reason', value:reason, inline:false},
          {name:'💳 New Cash', value:`${ubResult?.cash?.toLocaleString()||'?'}`, inline:true},
        )] });
      } else {
        return interaction.editReply({ embeds:[base('❌ UB API Grant Failed',C.rd).addFields(
          {name:'👤 Player', value:target.username, inline:true},
          {name:'💰 Amount', value:amount.toLocaleString(), inline:true},
          {name:'❌ Error', value:`\`${ubError||'Unknown'}\``, inline:false},
        )] });
      }
    }
 
    // ════════════════════════════════════════════════════════════════
    // HELP & PING
    // ════════════════════════════════════════════════════════════════
    if (cmd==='help') {
      return interaction.editReply({ embeds:[base('📖 AEGIS v12.1 Command Reference',C.pl).addFields(
        {name:'🧠 AI',       value:'`/aegis` `/ask` `/forget` `/ai-cost` `/aegis-persona` `/summarize` `/compare` `/boss-guide` `/base-tips`',inline:false},
        {name:'💎 Economy',  value:'`/wallet` `/weekly` `/streaks` `/leaderboard` `/give` `/clvsd grant|deduct|check|set|reset|top|stats|usage|bulk-grant|audit|digest`',inline:false},
        {name:'🛍️ Shop',     value:'`/order` (w/ auto-deduct) `/fulfill` `/shard` `/shop`',inline:false},
        {name:'🪙 ConCoins', value:'`/trivia` (win 15,000 ConCoins!) `/concoin-booty` `/concoin-leaderboard` `/grant-concoins` `/grant-concoins-manual`',inline:false},
        {name:'🗺️ Servers',  value:'`/servers` `/map` `/monitor` `/crossplay` `/transfer-guide`',inline:false},
        {name:'ℹ️ Info',     value:'`/info` `/rules` `/council` `/rates` `/mods` `/wipe` `/set-wipe` `/tip` `/dino` `/patreon`',inline:false},
        {name:'🤝 Community',value:'`/profile` `/rank` `/rep` `/trade` `/coords` `/report` `/tribe register|lookup|my`',inline:false},
        {name:'🗳️ Events',   value:'`/giveaway` `/endgiveaway` `/vote` `/announce` `/event` `/poll`',inline:false},
        {name:'🔨 Mod',      value:'`/warn` `/warn-history` `/warn-clear` `/ban` `/timeout` `/modlog` `/role` `/purge` `/lock` `/slowmode` `/ticket` `/watchtower`',inline:false},
        {name:'📚 Knowledge',value:'`/know add|list|delete`',inline:false},
        {name:'🔧 Utils',    value:'`/roll` `/coinflip` `/calc` `/remind` `/whois` `/serverinfo` `/ping`',inline:false},
      ).setFooter({...FT,text:'AEGIS v12.1 Sovereign · Anthropic Haiku 4.5 Primary · Groq Fallback'})] });
    }
 
    if (cmd==='ping') {
      return interaction.editReply({ embeds:[P.PingPanel(bot.ws.ping,process.uptime(),Math.round(process.memoryUsage().heapUsed/1024/1024),!!anthropic,!!groq,!!(sb&&sbOk()))] });
    }
 
    // ════════════════════════════════════════════════════════════════
    // COMMUNITY
    // ════════════════════════════════════════════════════════════════
    if (cmd==='profile') {
      const target=interaction.options.getUser('user')||interaction.user, member=interaction.guild.members.cache.get(target.id);
      const w=sb?await getWallet(target.id,target.username).catch(()=>null):null;
      const emb=base(`🎖️ ${target.username}'s Profile`,C.pl).setThumbnail(target.displayAvatarURL({size:128})).addFields({name:'🎭 Joined',value:member?.joinedAt?`<t:${Math.floor(member.joinedAt.getTime()/1000)}:D>`:'Unknown',inline:true},{name:'📅 Discord Since',value:`<t:${Math.floor(target.createdAt.getTime()/1000)}:D>`,inline:true});
      if (w) emb.addFields({name:'💎 ClaveShards',value:`${(w.wallet_balance||0).toLocaleString()} wallet · ${(w.bank_balance||0).toLocaleString()} bank`,inline:false},{name:'🔥 Streak',value:`Week ${w.daily_streak||0}`,inline:true},{name:'📈 Earned',value:`${(w.lifetime_earned||0).toLocaleString()}`,inline:true});
      return interaction.editReply({ embeds:[emb] });
    }
 
    if (cmd==='rank') {
      try {
        const lb=await getLeaderboard(100), pos=lb.findIndex(w=>w.discord_id===interaction.user.id)+1, w=lb.find(w=>w.discord_id===interaction.user.id);
        if (!w) return interaction.editReply({ embeds:[base('📊 Your Rank',C.cy).setDescription('No wallet found. Use `/weekly` to claim your first shards!')] });
        return interaction.editReply({ embeds:[base(`📊 ${interaction.user.username}'s Rank`,C.cy).addFields({name:'🏆 Rank',value:pos?`#${pos} of ${lb.length}`:'>100',inline:true},{name:'💎 Wallet',value:`${(w.wallet_balance||0).toLocaleString()}`,inline:true})] });
      } catch { return interaction.editReply({ embeds:[base('📊 Rank',C.cy).setDescription('_Rank unavailable._')] }); }
    }
 
    if (cmd==='rep') {
      const target=interaction.options.getUser('user'), reason=interaction.options.getString('reason')||'No reason given';
      if (target.id===interaction.user.id) return interaction.editReply('⚠️ You cannot rep yourself!');
      return interaction.editReply({ embeds:[base('⭐ Reputation Given',C.gold).setDescription(`${interaction.user} gave **+1 rep** to ${target}\n*"${reason}"*`)] });
    }
 
    if (cmd==='trade') {
      const offering=interaction.options.getString('offering'), looking=interaction.options.getString('looking-for'), server=interaction.options.getString('server')||'Any';
      return interaction.editReply({ embeds:[base('🤝 Trade Post',C.gold).setDescription(`Posted by **${interaction.user.username}**`).addFields({name:'📤 Offering',value:offering,inline:true},{name:'📥 Looking For',value:looking,inline:true},{name:'🗺️ Server',value:server,inline:true}).setFooter({...FT,text:'DM the poster to trade • Use /report for scams'})] });
    }
 
    if (cmd==='coords') {
      const location=interaction.options.getString('location'), map=interaction.options.getString('map')||'Unknown';
      return interaction.editReply({ embeds:[base('📍 Coordinates Shared',C.cy).setDescription(`**${interaction.user.username}** shared a location:`).addFields({name:'📍 Location',value:location,inline:true},{name:'🗺️ Map',value:map,inline:true})] });
    }
 
    if (cmd==='whois') {
      const target=interaction.options.getUser('user'), member=interaction.guild.members.cache.get(target.id);
      return interaction.editReply({ embeds:[base(`🔍 ${target.username}`,C.cy).setThumbnail(target.displayAvatarURL({size:128})).addFields({name:'🆔 ID',value:target.id,inline:true},{name:'📅 Created',value:`<t:${Math.floor(target.createdAt.getTime()/1000)}:D>`,inline:true},{name:'🎭 Joined',value:member?.joinedAt?`<t:${Math.floor(member.joinedAt.getTime()/1000)}:D>`:'Not in server',inline:true},{name:'🎨 Roles',value:member?.roles.cache.filter(r=>r.name!=='@everyone').map(r=>`<@&${r.id}>`).join(' ')||'None',inline:false})] });
    }
 
    if (cmd==='serverinfo') {
      const g=interaction.guild;
      return interaction.editReply({ embeds:[P.StatsPanel(g,g.memberCount,Math.round(g.memberCount*0.3),g.channels.cache.size,g.roles.cache.size,g.premiumSubscriptionCount||0)] });
    }
 
    if (cmd==='report') {
      const issue=interaction.options.getString('issue'), player=interaction.options.getString('player')||'Not specified';
      const emb=base('🚨 Report Received',C.rd).setDescription(`Report filed by **${interaction.user.username}**`).addFields({name:'📋 Issue',value:issue,inline:false},{name:'👤 Player',value:player,inline:true},{name:'📅 Time',value:`<t:${Math.floor(Date.now()/1000)}:F>`,inline:true});
      if (sb&&sbOk()) try { await sb.from('aegis_reports').insert({ guild_id:interaction.guildId, reporter_id:interaction.user.id, reporter_tag:interaction.user.username, issue, player, created_at:new Date().toISOString() }); } catch {}
      return interaction.editReply({ embeds:[emb.setFooter({...FT,text:'A Council member will review your report soon.'})] });
    }
 
    // ════════════════════════════════════════════════════════════════
    // TRIBE
    // ════════════════════════════════════════════════════════════════
    if (cmd==='tribe') {
      const sub=interaction.options.getSubcommand();
      if (sub==='register') {
        const name=interaction.options.getString('name'), server=interaction.options.getString('server'), membersRaw=interaction.options.getString('members')||'';
        const members=membersRaw.split(',').map(m=>m.trim()).filter(Boolean);
        try { await registerTribe(interaction.guildId,interaction.user.id,interaction.user.username,name,server,members); return interaction.editReply({ embeds:[base('🏕️ Tribe Registered',C.gr).addFields({name:'🏕️ Tribe',value:name,inline:true},{name:'🗺️ Server',value:server,inline:true},{name:'👥 Members',value:members.length?members.join(', '):'Just you',inline:false})] }); }
        catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
      }
      if (sub==='lookup') {
        const query=interaction.options.getString('query');
        try { const tribes=await lookupTribe(interaction.guildId,query); if (!tribes.length) return interaction.editReply(`📭 No tribe found matching **${query}**.`); return interaction.editReply({ embeds:[base(`🔍 Tribe Lookup: ${query}`,C.cy).setDescription(tribes.map(t=>`**${t.tribe_name}** · *${t.server}* · Owner: <@${t.owner_id}>`).join('\n'))] }); }
        catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
      }
      if (sub==='my') {
        if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
        const { data } = await sb.from('aegis_tribes').select('*').eq('guild_id',interaction.guildId).eq('owner_id',interaction.user.id).single().catch(()=>({data:null}));
        if (!data) return interaction.editReply('📭 You have no registered tribe. Use `/tribe register` to create one.');
        const members=JSON.parse(data.members||'[]');
        return interaction.editReply({ embeds:[base(`🏕️ ${data.tribe_name}`,C.cy).addFields({name:'🗺️ Server',value:data.server,inline:true},{name:'👥 Members',value:members.length?members.join(', '):'Just you',inline:false})] });
      }
    }
 
    // ════════════════════════════════════════════════════════════════
    // EVENTS / ANNOUNCE
    // ════════════════════════════════════════════════════════════════
    if (cmd==='announce') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const title=interaction.options.getString('title'), message=interaction.options.getString('message'), ping=interaction.options.getBoolean('ping')??false;
      await interaction.channel.send({ content:ping?'@everyone':null, embeds:[P.AnnouncementPanel(title,message,interaction.user.username)] });
      return interaction.editReply('✅ Announcement posted.');
    }
 
    if (cmd==='event') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const title=interaction.options.getString('title'), desc=interaction.options.getString('description'), date=interaction.options.getString('date')||'TBA', ping=interaction.options.getBoolean('ping')??false;
      await interaction.channel.send({ content:ping?'@everyone':null, embeds:[P.EventPanel(title,desc,date,interaction.user.username)] });
      return interaction.editReply('✅ Event announcement posted.');
    }
 
    if (cmd==='giveaway') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const prize=interaction.options.getString('prize'), duration=interaction.options.getInteger('duration'), winners=interaction.options.getInteger('winners')||1, shardCost=interaction.options.getInteger('shard-entry')||0;
      const endTime=Date.now()+duration*60*1000;
      const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_enter').setLabel(`🎉 Enter${shardCost>0?` (${shardCost} 💎)`:''}`).setStyle(shardCost>0?ButtonStyle.Primary:ButtonStyle.Success));
      const gwEmb=P.GiveawayPanel(prize,winners,endTime,interaction.user.username);
      if (shardCost>0) gwEmb.setDescription((gwEmb.data.description||'')+`\n\n> 💎 **Entry costs ${shardCost} ClaveShard${shardCost!==1?'s':''}** (auto-deducted)`);
      const msg=await interaction.channel.send({ embeds:[gwEmb], components:[row] });
      activeGiveaways.set(msg.id,{prize,entries:new Set(),endTime,channelId:interaction.channelId,winnersCount:winners,shardCost});
      setTimeout(()=>drawGiveaway(msg.id,interaction.guildId,bot), duration*60*1000);
      return interaction.editReply(`✅ Giveaway started! Ends <t:${Math.floor(endTime/1000)}:R>.`);
    }
 
    if (cmd==='endgiveaway') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const msgId=interaction.options.getString('messageid');
      if (!activeGiveaways.has(msgId)) return interaction.editReply('⚠️ No active giveaway with that ID.');
      await drawGiveaway(msgId,interaction.guildId,bot);
      return interaction.editReply('✅ Giveaway ended.');
    }
 
    if (cmd==='vote') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const question=interaction.options.getString('question');
      const opts=interaction.options.getString('options').split('|').map(o=>o.trim()).filter(Boolean).slice(0,4);
      if (opts.length<2) return interaction.editReply('⚠️ Need at least 2 options separated by |');
      const duration=interaction.options.getInteger('duration')||60, endTime=Date.now()+duration*60*1000;
      const votes=new Map(opts.map((_,i)=>[i,new Set()]));
      const components=[new ActionRowBuilder().addComponents(...opts.map((o,i)=>new ButtonBuilder().setCustomId(`vote_MSGID_${i}`).setLabel(`${i+1}. ${o.slice(0,40)}`).setStyle(ButtonStyle.Secondary)))];
      const lines=opts.map((o,i)=>`**${i+1}.** ${o}\n\`${'░'.repeat(20)}\` **0%** (0 votes)`).join('\n\n');
      const msg=await interaction.editReply({ embeds:[base(`🗳️ ${question}`,C.cy).setDescription(lines+`\n\n> Ends <t:${Math.floor(endTime/1000)}:R>`)], components, fetchReply:true });
      const patchedRow=new ActionRowBuilder().addComponents(...opts.map((o,i)=>new ButtonBuilder().setCustomId(`vote_${msg.id}_${i}`).setLabel(`${i+1}. ${o.slice(0,40)}`).setStyle(ButtonStyle.Secondary)));
      await msg.edit({ components:[patchedRow] });
      activeVotes.set(msg.id,{question,options:opts,votes,ends:endTime,channelId:interaction.channelId});
      setTimeout(async()=>{
        const vote=activeVotes.get(msg.id); if (!vote) return;
        const totalVotes=[...vote.votes.values()].reduce((s,v)=>s+v.size,0);
        const winner=[...vote.votes.entries()].sort((a,b)=>b[1].size-a[1].size)[0];
        const finalLines=vote.options.map((o,i)=>{ const count=vote.votes.get(i)?.size||0; const pct=totalVotes?Math.round((count/totalVotes)*100):0; return `**${i+1}.** ${o}\n\`${'█'.repeat(Math.round(pct/5))}${'░'.repeat(20-Math.round(pct/5))}\` **${pct}%** (${count} votes)`; }).join('\n\n');
        try { await msg.edit({ embeds:[base(`🗳️ Vote Ended: ${question}`,C.gr).setDescription(finalLines+`\n\n> 🏆 **Winner:** ${vote.options[winner?.[0]??0]} (${winner?.[1]?.size||0} votes)`)], components:[] }); }
        catch {} activeVotes.delete(msg.id);
      }, duration*60*1000);
    }
 
    // ════════════════════════════════════════════════════════════════
    // MODERATION
    // ════════════════════════════════════════════════════════════════
    if (cmd==='warn') {
      if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
      const target=interaction.options.getUser('user'), reason=interaction.options.getString('reason');
      await addWarn(interaction.guildId,target.id,target.username,reason,interaction.user.id,interaction.user.username);
      const warns=await getWarns(interaction.guildId,target.id);
      await modLog(interaction.guild,'warn',target,interaction.user,reason,{'Total Warnings':warns.length});
      try { await (await target.createDM()).send({ embeds:[base(`⚠️ Warning in ${interaction.guild.name}`,C.gold).setDescription(`**Reason:** ${reason}\n\nPlease review the rules with \`/rules\`.`)] }); } catch {}
      return interaction.editReply({ embeds:[P.WarnPanel(target,reason,warns.length,interaction.user)] });
    }
 
    if (cmd==='warn-history') {
      if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
      const target=interaction.options.getUser('user'), warns=await getWarns(interaction.guildId,target.id);
      if (!warns.length) return interaction.editReply(`✅ **${target.username}** has no warnings.`);
      return interaction.editReply({ embeds:[base(`📋 Warnings — ${target.username}`,C.rd).setDescription(warns.map((w,i)=>`**${i+1}.** ${w.reason}\n└ by **${w.issued_by_tag||'Unknown'}** · <t:${Math.floor(new Date(w.created_at).getTime()/1000)}:R>`).join('\n\n'))] });
    }
 
    if (cmd==='warn-clear') {
      if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
      const target=interaction.options.getUser('user'), reason=interaction.options.getString('reason')||'Cleared by moderator';
      const ok=await clearWarns(interaction.guildId,target.id);
      if (!ok) return interaction.editReply('⚠️ Failed to clear warnings.');
      await modLog(interaction.guild,'note',target,interaction.user,`Warnings cleared: ${reason}`);
      return interaction.editReply(`✅ All warnings cleared for **${target.username}**.`);
    }
 
    if (cmd==='modlog') {
      if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
      const count=interaction.options.getInteger('count')||10, entries=recentModActions.slice(0,count);
      if (!entries.length) return interaction.editReply('📭 No recent mod actions recorded in memory.');
      const lines=entries.map(e=>`\`${e.action.toUpperCase().padEnd(10)}\` **${e.targetTag}** · *${e.reason?.slice(0,50)||'—'}* · <t:${Math.floor(e.ts/1000)}:R> · by ${e.actorTag}`).join('\n');
      return interaction.editReply({ embeds:[base('📋 Recent Mod Actions',C.rd).setDescription(lines).setFooter({...FT,text:'In-memory log · Resets on bot restart'})] });
    }
 
    if (cmd==='ban') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.editReply('⛔ Ban Members required.');
      const target=interaction.options.getUser('user'), reason=interaction.options.getString('reason');
      try { await interaction.guild.members.ban(target.id,{reason:`${interaction.user.username}: ${reason}`}); await modLog(interaction.guild,'ban',target,interaction.user,reason); return interaction.editReply({ embeds:[base(`🔨 Banned: ${target.username}`,C.rd).setDescription(`**Reason:** ${reason}`)] }); }
      catch (e) { return interaction.editReply(`⚠️ Could not ban: ${e.message}`); }
    }
 
    if (cmd==='timeout') {
      if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
      const target=interaction.options.getUser('user'), duration=interaction.options.getString('duration'), reason=interaction.options.getString('reason')||'No reason';
      const durations={'5m':5*60_000,'1h':60*60_000,'6h':6*60*60_000,'24h':24*60*60_000,'7d':7*24*60*60_000};
      const ms=durations[duration]||5*60_000;
      try { const member=interaction.guild.members.cache.get(target.id); if (!member) return interaction.editReply('⚠️ Member not in server.'); await member.timeout(ms,reason); await modLog(interaction.guild,'timeout',target,interaction.user,reason,{Duration:duration}); return interaction.editReply({ embeds:[base(`⏰ Timeout: ${target.username}`,C.gold).addFields({name:'⏱️ Duration',value:duration,inline:true},{name:'📋 Reason',value:reason,inline:true})] }); }
      catch (e) { return interaction.editReply(`⚠️ Timeout failed: ${e.message}`); }
    }
 
    if (cmd==='role') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.editReply('⛔ Manage Roles required.');
      const target=interaction.options.getUser('user'), role=interaction.options.getRole('role'), action=interaction.options.getString('action');
      try { const m=interaction.guild.members.cache.get(target.id); if (!m) return interaction.editReply('⚠️ Member not found.'); if (action==='add') { await m.roles.add(role); return interaction.editReply(`✅ Added <@&${role.id}> to **${target.username}**.`); } else { await m.roles.remove(role); return interaction.editReply(`✅ Removed <@&${role.id}> from **${target.username}**.`); } }
      catch (e) { return interaction.editReply(`⚠️ Role change failed: ${e.message}`); }
    }
 
    if (cmd==='ticket') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_open').setLabel('🎫 Open a Ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setLabel('📋 View Rules').setStyle(ButtonStyle.Link).setURL('https://theconclavedominion.com/terms.html'),
      );
      await interaction.channel.send({ embeds:[P.TicketPanel()], components:[row] });
      return interaction.editReply('✅ Ticket panel posted.');
    }
 
    if (cmd==='purge') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const count=interaction.options.getInteger('count'), user=interaction.options.getUser('user');
      try {
        let messages=await interaction.channel.messages.fetch({limit:100});
        if (user) messages=messages.filter(m=>m.author.id===user.id);
        const toDelete=[...messages.values()].slice(0,count).filter(m=>Date.now()-m.createdTimestamp<1209600000);
        await interaction.channel.bulkDelete(toDelete,true);
        return interaction.editReply(`✅ Deleted **${toDelete.length}** message${toDelete.length!==1?'s':''}${user?` from **${user.username}**`:''}.`);
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }
 
    if (cmd==='slowmode') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const seconds=interaction.options.getInteger('seconds');
      try { await interaction.channel.setRateLimitPerUser(seconds); return interaction.editReply(seconds===0?'✅ Slowmode disabled.':`✅ Slowmode set to **${seconds}s**.`); }
      catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }
 
    if (cmd==='lock') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const action=interaction.options.getString('action'), reason=interaction.options.getString('reason')||'No reason';
      try { const lock=action==='lock'; await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone,{SendMessages:lock?false:null}); return interaction.editReply(`${lock?'🔒':'🔓'} Channel **${lock?'locked':'unlocked'}**. Reason: ${reason}`); }
      catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }
 
    // ════════════════════════════════════════════════════════════════
    // KNOWLEDGE
    // ════════════════════════════════════════════════════════════════
    if (cmd==='know') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      if (!sb) return interaction.editReply('⚠️ Supabase not configured.');
      const sub=interaction.options.getSubcommand();
      try {
        if (sub==='add')    { const category=interaction.options.getString('category'),title=interaction.options.getString('title'),content=interaction.options.getString('content'),key=`${category}_${Date.now().toString(36)}`; const { error } = await sb.from('aegis_knowledge').upsert({category,key,title,content,added_by:interaction.user.username,updated_at:new Date().toISOString()},{onConflict:'key'}); if (error) throw new Error(error.message); _kCache=null; return interaction.editReply(`✅ Added knowledge entry **${title}** in **${category}**.`); }
        if (sub==='list')   { const category=interaction.options.getString('category'); let query=sb.from('aegis_knowledge').select('category,key,title,added_by').order('category').limit(30); if (category) query=query.eq('category',category); const { data, error } = await query; if (error) throw new Error(error.message); if (!data?.length) return interaction.editReply('📭 No knowledge entries.'); return interaction.editReply({ embeds:[base('📚 Knowledge Base',C.cy).setDescription(data.map(r=>`**[${r.category}]** \`${r.key}\` · ${r.title} · *by ${r.added_by||'Unknown'}*`).join('\n'))] }); }
        if (sub==='delete') { const key=interaction.options.getString('key'); const { error } = await sb.from('aegis_knowledge').delete().eq('key',key); if (error) throw new Error(error.message); _kCache=null; return interaction.editReply(`✅ Deleted knowledge entry \`${key}\``); }
      } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
    }
 
    // ════════════════════════════════════════════════════════════════
    // UTILS
    // ════════════════════════════════════════════════════════════════
    if (cmd==='roll') {
      const notation=(interaction.options.getString('dice')||'d6').toLowerCase().replace(/\s/g,'');
      const match=notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
      if (!match) return interaction.editReply('⚠️ Invalid notation. Try `d6`, `2d10`, `3d8+5`');
      const count2=Math.min(parseInt(match[1]||'1'),20), sides=Math.min(parseInt(match[2]),1000), mod=parseInt(match[3]||'0');
      const rolls=Array.from({length:count2},()=>Math.floor(Math.random()*sides)+1);
      const sum=rolls.reduce((a,b)=>a+b,0)+mod;
      return interaction.editReply({ embeds:[P.RollPanel(notation,rolls,sum,mod)] });
    }
 
    if (cmd==='coinflip') {
      const result=Math.random()<0.5;
      return interaction.editReply({ embeds:[base(`🪙 ${result?'Heads':'Tails'}!`,C.gold).setDescription(`The coin landed on **${result?'🌕 Heads':'🌑 Tails'}**!`)] });
    }
 
    if (cmd==='calc') {
      const expr=interaction.options.getString('expression');
      try { const san=expr.replace(/[^0-9+\-*/().% ^]/g,''); if (!san) return interaction.editReply('⚠️ Invalid expression.'); const result=Function(`'use strict'; return (${san.replace(/\^/g,'**')})`)(); if (!isFinite(result)) return interaction.editReply('⚠️ Result not finite.'); return interaction.editReply({ embeds:[base('🔢 Calculator',C.cy).addFields({name:'Expression',value:`\`${expr}\``,inline:true},{name:'Result',value:`**${result.toLocaleString()}**`,inline:true})] }); }
      catch { return interaction.editReply('⚠️ Invalid expression.'); }
    }
 
    if (cmd==='remind') {
      const message=interaction.options.getString('message'), timeStr=interaction.options.getString('time');
      const parseTime=s=>{ const n=parseFloat(s); if(s.endsWith('d')) return n*86400000; if(s.endsWith('h')) return n*3600000; if(s.endsWith('m')) return n*60000; return null; };
      const ms=parseTime(timeStr);
      if (!ms||ms<10000||ms>604800000) return interaction.editReply('⚠️ Time must be 10s–7d. Examples: `30m`, `2h`, `1d`');
      const fireAt=new Date(Date.now()+ms);
      await interaction.editReply({ embeds:[P.ReminderSetPanel(message,fireAt)] });
      setTimeout(async()=>{
        try { await interaction.user.send({ embeds:[P.ReminderFirePanel(message)] }); }
        catch { const ch=interaction.channel; if (ch) await ch.send({content:`<@${interaction.user.id}>`,embeds:[P.ReminderFirePanel(message)]}).catch(()=>{}); }
      }, ms);
    }
 
    if (cmd==='poll') {
      if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
      const opts=interaction.options.getString('options').split('|').map(o=>o.trim()).filter(Boolean).slice(0,10);
      if (opts.length<2) return interaction.editReply('⚠️ Need at least 2 options separated by |');
      const L=['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'];
      const msg=await interaction.editReply({ embeds:[P.PollPanel(interaction.options.getString('question'),opts,interaction.user.username)], fetchReply:true });
      for (let j=0; j<opts.length; j++) { try { await msg.react(L[j]); } catch {} }
    }
 
  } catch (e) {
    console.error(`❌ /${interaction.commandName}:`, e.message);
    try { await interaction.editReply(`⚠️ Error: ${e.message.slice(0,200)}`); } catch {}
  }
});
 
// ══════════════════════════════════════════════════════════════════════
// MESSAGE CREATE — Auto-reply + Auto-mod + Trivia answers
// ══════════════════════════════════════════════════════════════════════
bot.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  await runAutoMod(msg);
 
  // ── TRIVIA ANSWER CHECK — awards 15,000 ConCoins ──────────────────
  const trivia = activeTrivias.get(msg.channelId);
  if (trivia && Date.now() < trivia.expiresAt) {
    const answer = msg.content.toLowerCase().trim();
    if (answer.includes(trivia.a.toLowerCase())) {
      activeTrivias.delete(msg.channelId);
      let booty = null;
      try { booty = await addConcoinBooty(msg.author.id, msg.author.username, CONCOIN_TRIVIA_REWARD, 'Trivia Win'); }
      catch (e) { console.error('[Trivia Booty]', e.message); }
      const pending = (booty?.pending_grant || CONCOIN_TRIVIA_REWARD).toLocaleString();
      const total   = (booty?.total_earned  || CONCOIN_TRIVIA_REWARD).toLocaleString();
      const wins    = booty?.trivia_wins || 1;
      await msg.reply(
        `🎯 **CORRECT!** The answer was **${trivia.a}**!\n` +
        `> 🪙 **+${CONCOIN_TRIVIA_REWARD.toLocaleString()} ConCoins** added to your booty!\n` +
        `> 💰 Pending payout: **${pending} ConCoins** · Total earned: **${total}** · Wins: **${wins}**\n` +
        `-# Use \`/concoin-booty\` to check · Admins use \`/grant-concoins\` to pay out to UB`
      );
      return;
    }
  }
 
  ({
  handleTriviaCommand,
  handleTriviaButton,
  handleTriviaModalSubmit
} = require('./trivia_fix'));

  // ── AEGIS CHANNEL AUTO-REPLY ──────────────────────────────────────
  if (!AEGIS_CHANNEL_ID || msg.channelId !== AEGIS_CHANNEL_ID) return;
  const w = checkRate(msg.author.id, 8000);
  if (w) { const m = await msg.reply(`⏳ Retry in ${w}s.`).catch(()=>null); if (m) setTimeout(()=>m.delete().catch(()=>{}), 4000); return; }
  msg.channel.sendTyping().catch(()=>{});
  const r = await askAegis(msg.content, msg.author.id, '', msg.channelId);
  msg.reply(r.slice(0, 1990)).catch(()=>msg.channel.send(r.slice(0, 1990)).catch(()=>{}));
});
 
// ══════════════════════════════════════════════════════════════════════
// WELCOME + AUTO-WALLET
// ══════════════════════════════════════════════════════════════════════
bot.on(Events.GuildMemberAdd, async member => {
  try {
    if (sb&&sbOk()) sb.from('aegis_wallets').upsert({ discord_id:member.id, discord_tag:member.user.username, updated_at:new Date().toISOString() },{ onConflict:'discord_id', ignoreDuplicates:true }).catch(()=>{});
    const ch = member.guild.channels.cache.find(c=>c.name==='welcome'||c.name==='welcomes');
    if (!ch) return;
    await ch.send({ embeds:[P.WelcomePanel(member.user, member.guild.memberCount)] });
  } catch (e) { console.error('❌ Welcome:', e.message); }
});
 
bot.on(Events.GuildBanAdd, async ban => {
  try {
    const audit = await ban.guild.fetchAuditLogs({type:22, limit:1}).catch(()=>null);
    const entry = audit?.entries?.first();
    const actor = entry?.executor || {id:'Unknown', username:'Unknown'};
    await modLog(ban.guild, 'ban', ban.user, actor, entry?.reason||'No reason from audit log');
  } catch {}
});
 
// ══════════════════════════════════════════════════════════════════════
// HEALTH SERVER
// ══════════════════════════════════════════════════════════════════════
const STATUS = { ready:false, readyAt:null, reconnects:0 };
 
const healthServer = http.createServer((req, res) => {
  if (req.url==='/health' || req.url==='/') {
    const up = STATUS.ready && bot.ws.status===0;
    const mem = process.memoryUsage();
    res.writeHead(up?200:503, {'Content-Type':'application/json'});
    res.end(JSON.stringify({
      status:     up?'ok':'degraded',
      bot:        STATUS.ready?'ready':'not_ready',
      ws:         bot.ws.status,
      wsLatency:  bot.ws.ping,
      uptime:     STATUS.readyAt?Math.floor((Date.now()-STATUS.readyAt)/1000)+'s':'0s',
      reconnects: STATUS.reconnects,
      heapMB:     Math.round(mem.heapUsed/1024/1024),
      ai_primary: anthropic?'anthropic-haiku-4-5':'not_configured',
      ai_fallback:groq?'groq-llama3':'not_configured',
      supabase:   sb?(sbOk()?'ok':'circuit_open'):'not_configured',
      ub_token:   UNBELIEVABOAT_API_TOKEN?'configured':'not_configured',
      version:    'v12.1',
      ts:         new Date().toISOString(),
    }));
  } else { res.writeHead(404); res.end('Not found'); }
});
healthServer.listen(BOT_PORT, ()=>console.log(`💓 Health: :${BOT_PORT}`));
 
// ══════════════════════════════════════════════════════════════════════
// PROCESS GUARDS
// ══════════════════════════════════════════════════════════════════════
const IGNORE=['Unknown interaction','Unknown Message','Missing Access','Cannot send messages','Unknown Channel'];
process.on('unhandledRejection', r=>{ const m=r?.message||String(r); if (!IGNORE.some(e=>m.includes(e))) console.error('❌ Rejection:',m); });
process.on('uncaughtException',  (e,o)=>console.error(`❌ Exception [${o}]:`,e.message));
process.on('SIGTERM', ()=>{ STATUS.ready=false; healthServer.close(); bot.destroy(); setTimeout(()=>process.exit(0),3000); });
process.on('SIGINT',  ()=>{ STATUS.ready=false; healthServer.close(); bot.destroy(); setTimeout(()=>process.exit(0),1000); });
 
// ══════════════════════════════════════════════════════════════════════
// READY
// ══════════════════════════════════════════════════════════════════════
bot.once(Events.ClientReady, async () => {
  STATUS.ready=true; STATUS.readyAt=Date.now();
  console.log(`🤖 AEGIS v12.1 SOVEREIGN — ${bot.user.tag}`);
  console.log(`   AI Primary:  ${anthropic?'✅ Anthropic Haiku 4.5':'❌ NOT SET — add ANTHROPIC_API_KEY'}`);
  console.log(`   AI Fallback: ${groq?'✅ Groq Free':'⚠️ No Groq key'}`);
  console.log(`   Supabase:    ${sb?'✅':'❌'}`);
  console.log(`   UB Token:    ${UNBELIEVABOAT_API_TOKEN?'✅ Loaded':'⚠️ Not set — /grant-concoins will fail'}`);
  console.log(`   Health:      :${BOT_PORT}`);
  bot.user.setActivity('🪙 /trivia | 15,000 ConCoins per win!', { type:3 });
  await registerCommands();
 
  if (!DISCORD_GUILD_ID) return;
  try {
    const guild=await bot.guilds.fetch(DISCORD_GUILD_ID).catch(()=>null); if (!guild) return;
    const statuses=await fetchServerStatuses().catch(()=>[]);
    const monCh=process.env.MONITOR_STATUS_CHANNEL_ID, monMsg=process.env.MONITOR_MESSAGE_ID;
    if (monCh&&monMsg) {
      monitorState.set(DISCORD_GUILD_ID,{statusChannelId:monCh, messageId:monMsg});
      const ch=await guild.channels.fetch(monCh).catch(()=>null);
      if (ch) {
        const embed=buildMonitorEmbed(statuses);
        const msg=await ch.messages.fetch(monMsg).catch(()=>null);
        if (msg) await msg.edit({embeds:[embed]}).catch(e=>console.error('❌ Monitor resume:',e.message));
      }
    }
  } catch (e) { console.error('❌ Boot tasks:', e.message); }
});
 
// ══════════════════════════════════════════════════════════════════════
// LOGIN WITH BACKOFF
// ══════════════════════════════════════════════════════════════════════
const BACKOFF=[5,15,30,60,120,120];
let loginAttempt=0;
async function login() {
  loginAttempt++;
  try { await bot.login(DISCORD_BOT_TOKEN); loginAttempt=0; }
  catch (e) {
    const delay=BACKOFF[Math.min(loginAttempt-1,BACKOFF.length-1)]*1000;
    console.error(`❌ Login attempt ${loginAttempt} failed: ${e.message} — retry in ${delay/1000}s`);
    STATUS.reconnects++; setTimeout(login,delay);
  }
}
login();