// ═══════════════════════════════════════════════════════════════════════
// CONCLAVE AEGIS BOT — v10.2 SOVEREIGN EDITION (MUSIC DECOUPLED)
// TheConclave Dominion · 5× Crossplay ARK: Survival Ascended
// Music completely removed — CONbot5 handles all music
// Groq Free AI (llama) · Zero API cost · Full economy/mod/admin
// ═══════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const http = require('http');
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  EmbedBuilder, PermissionFlagsBits, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType,
} = require('discord.js');
const Groq   = require('groq-sdk');
const axios  = require('axios');
const { createClient } = require('@supabase/supabase-js');
const P = require('./panels.js');

// ── ENV ───────────────────────────────────────────────────────────────
const {
  DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID,
  ROLE_OWNER_ID, ROLE_ADMIN_ID, ROLE_HELPER_ID,
  GROQ_API_KEY,
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  AEGIS_CHANNEL_ID,
} = process.env;

if (!DISCORD_BOT_TOKEN) { console.error('❌ DISCORD_BOT_TOKEN missing'); process.exit(1); }

const BOT_PORT = parseInt(process.env.BOT_PORT || '3001');
const MODEL_FAST  = 'llama-3.1-8b-instant';
const MODEL_SMART = 'llama-3.3-70b-versatile';

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
const sb = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildPresences,
  ],
  rest: { timeout: 15000 },
  allowedMentions: { parse: ['users','roles'], repliedUser: false },
});

// ── PERMISSION HELPERS ─────────────────────────────────────────────────
const isOwner = m => m?.roles?.cache?.has(ROLE_OWNER_ID) || m?.permissions?.has(PermissionFlagsBits.Administrator);
const isAdmin = m => isOwner(m) || m?.roles?.cache?.has(ROLE_ADMIN_ID);
const isMod   = m => isAdmin(m) || m?.roles?.cache?.has(ROLE_HELPER_ID) || m?.permissions?.has(PermissionFlagsBits.ModerateMembers);

// ── RATE LIMITER ───────────────────────────────────────────────────────
const rates = new Map();
function checkRate(uid, ms=8000) { const l=rates.get(uid)||0,n=Date.now(); if(n-l<ms)return Math.ceil((ms-(n-l))/1000); rates.set(uid,n); return 0; }
setInterval(()=>{ const cut=Date.now()-120_000; for(const[k,v]of rates)if(v<cut)rates.delete(k); },5*60_000);

// ── SUPABASE CIRCUIT BREAKER ───────────────────────────────────────────
const CB = { failures:0, openUntil:0, threshold:5, resetMs:60_000 };
const sbOk  = ()=>Date.now()>=CB.openUntil;
function sbFail(){CB.failures++;if(CB.failures>=CB.threshold){CB.openUntil=Date.now()+CB.resetMs;console.error('⚡ Supabase CB OPEN');}}
function sbSucc(){CB.failures=0;CB.openUntil=0;}
async function sbQuery(fn){if(!sb)throw new Error('Supabase not configured');if(!sbOk())throw new Error('Database temporarily unavailable');try{const r=await fn(sb);sbSucc();return r;}catch(e){sbFail();throw e;}}

function pickModel(q) {
  const complex = /explain|analyze|compare|strategy|build|design|how does|why does|write|create|detailed|comprehensive|lore|history|guide/i.test(q);
  return { model: complex ? MODEL_SMART : MODEL_FAST };
}

// ── KNOWLEDGE CACHE ────────────────────────────────────────────────────
let _kCache=null, _kTs=0;
async function getKnowledge(){
  const now=Date.now();
  if(_kCache!==null&&now-_kTs<90_000)return _kCache;
  if(!sb||!sbOk()){_kCache='';return '';}
  try{
    const{data}=await sb.from('aegis_knowledge').select('category,title,content').neq('category','auto_learned').order('category').limit(80);
    _kCache=data?.length?'\n\nKNOWLEDGE:\n'+data.map(r=>`[${r.category}] ${r.title}: ${r.content}`).join('\n'):'';
    _kTs=now; return _kCache;
  }catch{_kCache='';return '';}
}

// ── CORE PROMPT ────────────────────────────────────────────────────────
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
NOTE: Music is handled by CONbot5 (separate bot). Direct music questions there.

Respond under 1800 chars for Discord. Be accurate, community-warm, with cosmic gravitas. Use Discord markdown.`;

// ── CONVERSATION MEMORY ────────────────────────────────────────────────
const convMem = new Map();
function getHist(uid){return convMem.get(uid)||[];}
function addHist(uid,role,content){const h=convMem.get(uid)||[];h.push({role,content:content.slice(0,600)});if(h.length>24)h.splice(0,h.length-24);convMem.set(uid,h);}
function clearHist(uid){convMem.delete(uid);}
setInterval(()=>{for(const[k,v]of convMem)if(!v?.length)convMem.delete(k);},30*60_000);

// ── AI FUNCTION ────────────────────────────────────────────────────────
async function askAegis(msg, uid=null, extraCtx='') {
  if (!groq) return '⚠️ AI not configured — set GROQ_API_KEY in Render environment.';
  const { model } = pickModel(msg);
  let retries = 0;
  while (retries < 3) {
    try {
      const knowledge = await getKnowledge();
      const system    = CORE + knowledge + (extraCtx ? '\n\n' + extraCtx : '');
      const history   = uid ? getHist(uid) : [];
      const res = await groq.chat.completions.create({
        model, max_tokens: model.includes('8b') ? 600 : 900, temperature: 0.75,
        messages: [{ role:'system', content:system }, ...history, { role:'user', content:msg }],
      });
      const text = res.choices?.[0]?.message?.content?.trim();
      if (!text) return '⚠️ Empty response from AI.';
      if (uid) { addHist(uid,'user',msg); addHist(uid,'assistant',text); }
      if (sb&&sbOk()) (async()=>{ try{ await sb.from('aegis_ai_usage').insert({ model, input_tokens:res.usage?.prompt_tokens||0, output_tokens:res.usage?.completion_tokens||0, used_search:false, query_preview:msg.slice(0,120), created_at:new Date().toISOString() }); }catch{} })();
      return text;
    } catch(e) {
      const msg2=e.message||'';
      if(msg2.includes('rate_limit')||e.status===429){retries++;if(retries<3){await new Promise(r=>setTimeout(r,2000*retries));continue;}return '⚠️ AEGIS rate limited. Try again in a moment.';}
      if(msg2.includes('model_not_found'))return '⚠️ AI model unavailable. Check GROQ_API_KEY.';
      console.error('[AEGIS AI]',msg2);
      return '⚠️ AEGIS error: '+msg2.slice(0,100);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// WALLET ENGINE
// ══════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════
// WARN ENGINE
// ══════════════════════════════════════════════════════════════════════
async function addWarn(guildId,targetId,targetTag,reason,actorId,actorTag){if(!sb)return null;try{const{data}=await sb.from('aegis_warns').insert({guild_id:guildId,discord_id:targetId,discord_tag:targetTag,reason,issued_by:actorId,issued_by_tag:actorTag,created_at:new Date().toISOString()}).select().single();return data;}catch(e){console.error('Warn insert:',e.message);return null;}}
async function getWarns(guildId,targetId){if(!sb)return[];try{const{data}=await sb.from('aegis_warns').select('*').eq('guild_id',guildId).eq('discord_id',targetId).order('created_at',{ascending:false});return data||[];}catch{return[];}}

// ══════════════════════════════════════════════════════════════════════
// GIVEAWAY ENGINE
// ══════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════
// SERVER MONITOR
// ══════════════════════════════════════════════════════════════════════
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
const channelRenameCooldowns = new Map();
const RENAME_COOLDOWN_MS = 12*60*1000;
const RENAME_QUEUE_DELAY_MS = 1_500;

async function safeRenameChannel(ch, newName) {
  if (!ch||ch.name===newName)return false;
  const now=Date.now(), last=channelRenameCooldowns.get(ch.id)||0;
  if(now-last<RENAME_COOLDOWN_MS)return false;
  channelRenameCooldowns.set(ch.id,now);
  try{await ch.setName(newName);return true;}
  catch(e){
    if(e.status===429||(e.message||'').includes('429')){channelRenameCooldowns.set(ch.id,now+15*60*1000);console.warn(`⚠️ 429 on rename ${ch.name}`);}
    else console.error(`❌ Rename ${ch.name}:`,e.message);
    return false;
  }
}

const nitradoCache = new Map();
async function fetchNitradoServer(nitradoId) {
  if (!process.env.NITRADO_API_KEY) return null;
  const cached = nitradoCache.get(nitradoId);
  if (cached && Date.now() - cached.ts < 5*60*1000) return cached.data;
  try {
    const res = await axios.get(`https://api.nitrado.net/services/${nitradoId}/gameservers`, {
      headers:{Authorization:`Bearer ${process.env.NITRADO_API_KEY}`}, timeout:10000
    });
    const gs = res.data?.data?.gameserver; if(!gs)return null;
    const data = {status:gs.status==='started'?'online':'offline',players:gs.query?.player_current??0,maxPlayers:gs.query?.player_max??20};
    nitradoCache.set(nitradoId,{data,ts:Date.now()});
    return data;
  } catch(e) {
    if(e.response?.status===429){const c=nitradoCache.get(nitradoId);if(c){c.ts=Date.now()+15*60*1000;nitradoCache.set(nitradoId,c);return c.data;}}
    return null;
  }
}

async function fetchServerStatuses() {
  if (!process.env.NITRADO_API_KEY) return MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20}));
  const results=[];
  for (const srv of MONITOR_SERVERS) {
    const data = srv.nitradoId ? await fetchNitradoServer(srv.nitradoId) : null;
    results.push({...srv,status:data?.status??'unknown',players:data?.players??0,maxPlayers:data?.maxPlayers??20});
    await new Promise(r=>setTimeout(r,400));
  }
  return results;
}

function buildMonitorEmbed(servers){
  const online=servers.filter(s=>s.status==='online'),offline=servers.filter(s=>s.status!=='online'),total=online.reduce((sum,s)=>sum+s.players,0);
  const lines=[...online.map(s=>`🟢 **${s.emoji} ${s.name}**${s.pvp?' ⚔️':s.patreon?' ⭐':''} \`${s.players}/${s.maxPlayers}\``), ...offline.map(s=>`🔴 **${s.emoji} ${s.name}** · Offline`)].join('\n');
  return new EmbedBuilder().setTitle('⚔️ TheConclave — Live Cluster Monitor').setColor(total>0?0x35ED7E:0xFF4500).setDescription(lines||'No server data.').addFields({name:'🟢 Online',value:`${online.length}/${servers.length}`,inline:true},{name:'👥 Players',value:`${total}`,inline:true},{name:'⏰ Updated',value:`<t:${Math.floor(Date.now()/1000)}:R>`,inline:true}).setFooter({text:'TheConclave Dominion • Auto-refreshes every 5 min',iconURL:'https://theconclavedominion.com/conclave-badge.png'}).setTimestamp();
}

async function updateExistingStatusChannels(guild, statuses) {
  for (const srv of statuses) {
    const chId = EXISTING_STATUS_CHANNELS[srv.id]; if(!chId)continue;
    const ch = await guild.channels.fetch(chId).catch(()=>null); if(!ch)continue;
    const newName = srv.status==='online'
      ? `🟢${srv.pvp?'⚔️':srv.patreon?'⭐':''}・${srv.name}-${srv.players}p`
      : `🔴・${srv.name}-offline`;
    const renamed = await safeRenameChannel(ch,newName);
    if(renamed) await new Promise(r=>setTimeout(r,RENAME_QUEUE_DELAY_MS));
  }
}

let _monitorTick = 0;
setInterval(async()=>{
  _monitorTick++;
  if(!DISCORD_GUILD_ID)return;
  try{
    const g=await bot.guilds.fetch(DISCORD_GUILD_ID).catch(()=>null); if(!g)return;
    const s=await fetchServerStatuses().catch(()=>MONITOR_SERVERS.map(srv=>({...srv,status:'unknown',players:0,maxPlayers:20})));
    if(_monitorTick%2===0) await updateExistingStatusChannels(g,s);
    for(const[gid,state]of monitorState){
      if(!state.statusChannelId||!state.messageId)continue;
      try{
        const guild=await bot.guilds.fetch(gid).catch(()=>null);if(!guild)continue;
        const ch=await guild.channels.fetch(state.statusChannelId).catch(()=>null);if(!ch)continue;
        const embed=buildMonitorEmbed(s);
        const msg=await ch.messages.fetch(state.messageId).catch(()=>null);
        if(msg){await msg.edit({embeds:[embed]});}
        else{const nm=await ch.send({embeds:[embed]});state.messageId=nm.id;}
      }catch{}
    }
  }catch(e){console.error('❌ Monitor tick:',e.message);}
},5*60_000);

// ══════════════════════════════════════════════════════════════════════
// EMBED HELPERS
// ══════════════════════════════════════════════════════════════════════
const C={gold:0xFFB800,pl:0x7B2FFF,cy:0x00D4FF,gr:0x35ED7E,rd:0xFF4500,pk:0xFF4CD2};
const FT={text:'TheConclave Dominion • 5× Crossplay • 10 Maps',iconURL:'https://theconclavedominion.com/conclave-badge.png'};
const base=(title,color=C.pl)=>new EmbedBuilder().setTitle(title).setColor(color).setFooter(FT).setTimestamp();
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

// ══════════════════════════════════════════════════════════════════════
// SHOP TIER DATA
// ══════════════════════════════════════════════════════════════════════
const SHOP_TIERS = [
  {shards:1,  emoji:'💠',name:'1 Clave Shard',   items:['Level 600 Vanilla Dino','Max XP','3 Stacks Ammo','Full Dino Coloring','100 Kibble/Cakes/Beer','100% Imprint','500 Non-Tek Structures','Cryofridge+120 Pods','50k Echo Coins','2500 Materials','10 Same-Type Tributes','Boss Artifact+Tribute','Non-Tek Blueprint','Dino Revival Token (48hr)']},
  {shards:2,  emoji:'💎',name:'2 Clave Shards',  items:['Modded L600 Dino','60 Dedicated Storage','450 Random Shiny Shoulder Pet Variant']},
  {shards:3,  emoji:'✨',name:'3 Clave Shards',  items:['Tek Blueprint','1 Shiny Essence','200% Imprint','450 T1 Special Shiny']},
  {shards:5,  emoji:'🔥',name:'5 Clave Shards',  items:['Boss Defeat Command','Bronto/Dread+Saddle','Astral Dino','L1000 Basilisk','L1000 Rock Elemental','L1000 Karkinos','50 Raw Shiny Essence','450 T2 Special Shiny','Small Resource Bundle','2500 Imprint Kibble']},
  {shards:6,  emoji:'⚔️',name:'6 Clave Shards',  items:['Boss Ready Dino Bundle','300% Imprint','Max XP']},
  {shards:8,  emoji:'🌌',name:'8 Clave Shards',  items:['Medium Resource Bundle','100,000 Resources (No Element)']},
  {shards:10, emoji:'🛡️',name:'10 Clave Shards', items:['Tek Suit Blueprint/Set','Floating Platform','Combo Shinies','Dino Color Party','Breeding Pair']},
  {shards:12, emoji:'🌠',name:'12 Clave Shards', items:['Large Resource Bundle','200,000 Resources']},
  {shards:15, emoji:'👑',name:'15 Clave Shards', items:['30,000 Element','L900 Rhyniognatha','Reaper','Aureliax','XLarge Bundle (300k Resources)']},
  {shards:20, emoji:'🏰',name:'20 Clave Shards', items:['1x1 Behemoth Gate Expansion (10/max)']},
  {shards:30, emoji:'💰',name:'30 Clave Shards', items:['2 Dedicated Storage Admin Refill','1.6 Million Total Resources']},
  {shards:0,  emoji:'🛡',name:'Dino Insurance',  items:['One Time Use','Must Be Named','May Not Save','May Require Respawn','One Per Dino']},
];

const MAP_INFO = {
  island:     {name:'The Island',     ip:'217.114.196.102:5390',emoji:'🌿',desc:'Classic starter map.',pvp:false,patreon:false},
  volcano:    {name:'Volcano',        ip:'217.114.196.59:5050', emoji:'🌋',desc:'Volcanic biomes.',pvp:false,patreon:false},
  extinction: {name:'Extinction',     ip:'31.214.196.102:6440', emoji:'🌑',desc:'Post-apocalyptic Earth. Titans.',pvp:false,patreon:false},
  center:     {name:'The Center',     ip:'31.214.163.71:5120',  emoji:'🏔️',desc:'Floating islands.',pvp:false,patreon:false},
  lostcolony: {name:'Lost Colony',    ip:'217.114.196.104:5150',emoji:'🪐',desc:'Space-themed map.',pvp:false,patreon:false},
  astraeos:   {name:'Astraeos',       ip:'217.114.196.9:5320',  emoji:'✨',desc:'Custom Ascended map.',pvp:false,patreon:false},
  valguero:   {name:'Valguero',       ip:'85.190.136.141:5090', emoji:'🏞️',desc:'Rolling meadows.',pvp:false,patreon:false},
  scorched:   {name:'Scorched Earth', ip:'217.114.196.103:5240',emoji:'☀️',desc:'Desert survival.',pvp:false,patreon:false},
  aberration: {name:'Aberration',     ip:'217.114.196.80:5540', emoji:'⚔️',desc:'Underground PvP.',pvp:true, patreon:false},
  amissa:     {name:'Amissa',         ip:'217.114.196.80:5180', emoji:'⭐',desc:'Patreon-exclusive.',pvp:false,patreon:true},
};

// ══════════════════════════════════════════════════════════════════════
// SLASH COMMANDS — MUSIC-FREE
// ══════════════════════════════════════════════════════════════════════
function addWalletSubs(b) {
  return b
    .addSubcommand(s=>s.setName('balance').setDescription('💎 Check wallet').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(false)))
    .addSubcommand(s=>s.setName('deposit').setDescription('🏦 Wallet → Bank').addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('withdraw').setDescription('💸 Bank → Wallet').addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('transfer').setDescription('➡️ Send shards').addUserOption(o=>o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('note').setDescription('Message').setRequired(false)))
    .addSubcommand(s=>s.setName('history').setDescription('🧾 Transaction log').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(false)).addIntegerOption(o=>o.setName('count').setDescription('Entries').setRequired(false).setMinValue(1).setMaxValue(25)))
    .addSubcommand(s=>s.setName('leaderboard').setDescription('🏆 Top holders'))
    .addSubcommand(s=>s.setName('supply').setDescription('📊 Economy supply'))
    .addSubcommand(s=>s.setName('grant').setDescription('🎁 [ADMIN] Grant shards').addUserOption(o=>o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s=>s.setName('deduct').setDescription('⬇️ [ADMIN] Deduct shards').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)));
}

const ALL_COMMANDS = [
  // Economy
  addWalletSubs(new SlashCommandBuilder().setName('wallet').setDescription('💎 ClaveShard wallet')),
  addWalletSubs(new SlashCommandBuilder().setName('curr').setDescription('💎 ClaveShard wallet (alias)')),
  new SlashCommandBuilder().setName('weekly').setDescription('🌟 Claim weekly ClaveShards'),
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
    .addStringOption(o=>o.setName('notes').setDescription('Special requests').setRequired(false)),
  new SlashCommandBuilder().setName('fulfill').setDescription('✅ [ADMIN] Mark order fulfilled').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o=>o.setName('ref').setDescription('Order reference').setRequired(true))
    .addStringOption(o=>o.setName('note').setDescription('Note to player').setRequired(false)),
  new SlashCommandBuilder().setName('shard').setDescription('💠 View ClaveShard tier list'),
  new SlashCommandBuilder().setName('shop').setDescription('🛍️ Browse ClaveShard catalog'),
  // AI
  new SlashCommandBuilder().setName('aegis').setDescription('🧠 Ask AEGIS AI').addStringOption(o=>o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('ask').setDescription('🧠 Ask AEGIS anything').addStringOption(o=>o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('forget').setDescription('🧹 Clear your AEGIS conversation history'),
  new SlashCommandBuilder().setName('ai-cost').setDescription('💸 [ADMIN] AI usage dashboard').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  // Servers
  new SlashCommandBuilder().setName('servers').setDescription('🗺️ Live ARK cluster status').addStringOption(o=>o.setName('map').setDescription('Filter by map').setRequired(false)),
  new SlashCommandBuilder().setName('map').setDescription('🗺️ Detailed map info').addStringOption(o=>o.setName('name').setDescription('Map').setRequired(true).addChoices({name:'The Island',value:'island'},{name:'Volcano',value:'volcano'},{name:'Extinction',value:'extinction'},{name:'The Center',value:'center'},{name:'Lost Colony',value:'lostcolony'},{name:'Astraeos',value:'astraeos'},{name:'Valguero',value:'valguero'},{name:'Scorched Earth',value:'scorched'},{name:'Aberration (PvP)',value:'aberration'},{name:'Amissa (Patreon)',value:'amissa'})),
  new SlashCommandBuilder().setName('monitor').setDescription('📡 [ADMIN] Post live server status monitor').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addChannelOption(o=>o.setName('channel').setDescription('Channel to post in').setRequired(true)),
  // Info
  new SlashCommandBuilder().setName('info').setDescription('ℹ️ Server info'),
  new SlashCommandBuilder().setName('rules').setDescription('📜 Dominion Codex rules'),
  new SlashCommandBuilder().setName('rates').setDescription('📈 5× boost rates'),
  new SlashCommandBuilder().setName('mods').setDescription('🔧 Active cluster mods'),
  new SlashCommandBuilder().setName('wipe').setDescription('📅 Wipe schedule'),
  new SlashCommandBuilder().setName('transfer-guide').setDescription('🔄 Cross-ARK transfer guide'),
  new SlashCommandBuilder().setName('crossplay').setDescription('🎮 Crossplay connection guide'),
  new SlashCommandBuilder().setName('patreon').setDescription('⭐ Patreon perks'),
  new SlashCommandBuilder().setName('tip').setDescription('💡 Random ARK survival tip'),
  new SlashCommandBuilder().setName('dino').setDescription('🦕 ARK dino lookup').addStringOption(o=>o.setName('name').setDescription('Dino name').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('📖 Full command reference'),
  new SlashCommandBuilder().setName('ping').setDescription('🏓 Bot latency and status'),
  // Community
  new SlashCommandBuilder().setName('profile').setDescription('🎖️ View Dominion profile').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(false)),
  new SlashCommandBuilder().setName('rank').setDescription('📊 Your ClaveShard rank'),
  new SlashCommandBuilder().setName('rep').setDescription('⭐ Give reputation to a member').addUserOption(o=>o.setName('user').setDescription('Who to rep').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Why?').setRequired(false)),
  new SlashCommandBuilder().setName('trade').setDescription('🤝 Post a trade request').addStringOption(o=>o.setName('offering').setDescription('What you offer').setRequired(true)).addStringOption(o=>o.setName('looking-for').setDescription('What you want').setRequired(true)).addStringOption(o=>o.setName('server').setDescription('Which server').setRequired(false)),
  new SlashCommandBuilder().setName('report').setDescription('🚨 Report a player or issue').addStringOption(o=>o.setName('issue').setDescription('Describe the issue').setRequired(true)).addStringOption(o=>o.setName('player').setDescription('Player involved').setRequired(false)),
  new SlashCommandBuilder().setName('coords').setDescription('📍 Share in-game coordinates').addStringOption(o=>o.setName('location').setDescription('Location or coords').setRequired(true)).addStringOption(o=>o.setName('map').setDescription('Which map').setRequired(false)),
  new SlashCommandBuilder().setName('whois').setDescription('🔍 Look up a Discord member').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('🏠 Server statistics'),
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

// ══════════════════════════════════════════════════════════════════════
// COMMAND REGISTRATION
// ══════════════════════════════════════════════════════════════════════
async function registerCommands() {
  if (!DISCORD_CLIENT_ID){console.warn('⚠️ DISCORD_CLIENT_ID missing — skipping registration');return;}
  const rest = new REST().setToken(DISCORD_BOT_TOKEN);
  const allJson = ALL_COMMANDS.map(c=>c.toJSON());
  try {
    console.log(`📡 Registering ${allJson.length} slash commands (music-free)...`);
    if(DISCORD_GUILD_ID){
      await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID,DISCORD_GUILD_ID),{body:allJson});
      console.log(`✅ Guild commands registered (${allJson.length})`);
    } else {
      await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID),{body:allJson});
      console.log(`✅ Global commands registered (${allJson.length})`);
    }
  } catch(e){console.error('❌ Registration failed:',e.message);}
}

// ══════════════════════════════════════════════════════════════════════
// INTERACTION HANDLER
// ══════════════════════════════════════════════════════════════════════
bot.on(Events.InteractionCreate, async interaction => {
  // ── GIVEAWAY BUTTON ──
  if (interaction.isButton() && interaction.customId==='giveaway_enter') {
    const gw=activeGiveaways.get(interaction.message.id);
    if(!gw)return interaction.reply({content:'⚠️ Giveaway no longer active.',ephemeral:true});
    if(Date.now()>gw.endTime)return interaction.reply({content:'⏰ Giveaway has ended.',ephemeral:true});
    if(gw.entries.has(interaction.user.id))return interaction.reply({content:'✅ Already entered!',ephemeral:true});
    gw.entries.add(interaction.user.id);
    return interaction.reply({content:`🎉 You entered the **${gw.prize}** giveaway! Good luck!`,ephemeral:true});
  }
  // ── TICKET BUTTONS ──
  if (interaction.isButton()&&interaction.customId==='ticket_open'){
    await interaction.deferReply({ephemeral:true});
    const safeName=interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,20);
    const existing=interaction.guild.channels.cache.find(c=>c.name===`ticket-${safeName}`);
    if(existing)return interaction.editReply(`⚠️ You already have an open ticket: ${existing}`);
    try{
      const ch=await interaction.guild.channels.create({name:`ticket-${safeName}`,type:ChannelType.GuildText,permissionOverwrites:[
        {id:interaction.guild.roles.everyone,deny:[PermissionFlagsBits.ViewChannel]},
        {id:interaction.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
        {id:interaction.guild.members.me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels]},
        ...(ROLE_ADMIN_ID?[{id:ROLE_ADMIN_ID,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]}]:[]),
        ...(ROLE_HELPER_ID?[{id:ROLE_HELPER_ID,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]}]:[]),
      ]});
      await ch.send({embeds:[base('🎫 Support Ticket',C.cy).setDescription(`Hello ${interaction.user}! A staff member will assist you shortly.\n\nDescribe your issue in detail.`).setFooter(FT)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger))]});
      return interaction.editReply({content:`✅ Ticket created: ${ch}`});
    }catch(e){return interaction.editReply(`⚠️ Error: ${e.message}`);}
  }
  if(interaction.isButton()&&interaction.customId==='ticket_close'){
    if(!isMod(interaction.member))return interaction.reply({content:'⛔ Staff only.',ephemeral:true});
    await interaction.reply('🔒 Closing ticket in 5 seconds...');
    setTimeout(()=>interaction.channel.delete().catch(()=>{}),5000);
    return;
  }

  if(!interaction.isChatInputCommand())return;
  const{commandName:cmd}=interaction;
  await interaction.deferReply();

  try {
    // ── ECONOMY ──────────────────────────────────────────────────────
    if(cmd==='wallet'||cmd==='curr'){
      const sub=interaction.options.getSubcommand();
      const target=interaction.options.getUser('user');
      const amount=interaction.options.getInteger('amount')||0;
      const reason=interaction.options.getString('reason')||'';
      const note=interaction.options.getString('note')||'';
      const count=interaction.options.getInteger('count')||15;
      const me=interaction.user;
      try{
        if(sub==='balance'){const who=target||me;const w=await getWallet(who.id,who.tag||who.username);return interaction.editReply({embeds:[P.WalletPanel(`💎 ${who.username}'s Wallet`,w)]});}
        if(sub==='deposit'){const w=await depositToBank(me.id,me.tag||me.username,amount);return interaction.editReply({embeds:[walletEmbed(`🏦 Deposited ${amount} 💎`,w,C.gr).setDescription(`Moved **${amount}** shards wallet → bank.`)]});}
        if(sub==='withdraw'){const w=await withdrawFromBank(me.id,me.tag||me.username,amount);return interaction.editReply({embeds:[walletEmbed(`💸 Withdrew ${amount} 💎`,w,C.cy)]});}
        if(sub==='transfer'){if(!target)return interaction.editReply('⚠️ Specify a recipient.');const r=await transferShards(me.id,me.tag||me.username,target.id,target.tag||target.username,amount);return interaction.editReply({embeds:[base(`➡️ Transferred ${amount} 💎`,C.cy).setDescription(`Sent **${amount}** to **${target.username}**${note?`\n📝 *"${note}"*`:''}`).addFields({name:'Your wallet',value:`${r.sent.toLocaleString()} 💎`,inline:true},{name:`${target.username}'s wallet`,value:`${r.received.toLocaleString()} 💎`,inline:true})]});}
        if(sub==='history'){const who=target||me;if(target&&target.id!==me.id&&!isAdmin(interaction.member))return interaction.editReply('⛔ Admins only for other users.');const rows=await getTxHistory(who.id,count);if(!rows.length)return interaction.editReply(`📭 No history for **${who.username}** yet.`);return interaction.editReply({embeds:[P.HistoryPanel(who.username,rows)]});}
        if(sub==='leaderboard'){const rows=await getLeaderboard(10);if(!rows.length)return interaction.editReply('📭 No wallets yet.');return interaction.editReply({embeds:[P.LeaderboardPanel(rows)]});}
        if(sub==='supply'){const s=await getSupply();return interaction.editReply({embeds:[P.SupplyPanel(s)]});}
        if(sub==='grant'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admins only.');if(!target)return interaction.editReply('⚠️ Specify target.');const w=await grantShards(target.id,target.tag||target.username,amount,reason||'Admin grant',me.id,me.tag||me.username);try{await target.send({embeds:[base('💎 ClaveShard Received!',C.gr).setDescription(`**${me.username}** granted you **${amount.toLocaleString()} 💎**\n📝 *${reason||'Admin grant'}*`)]});}catch{}return interaction.editReply({embeds:[walletEmbed(`🎁 Granted ${amount} to ${target.username}`,w,C.gr)]});}
        if(sub==='deduct'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admins only.');if(!target)return interaction.editReply('⚠️ Specify target.');const w=await deductShards(target.id,target.tag||target.username,amount,reason||'Admin deduct',me.id,me.tag||me.username);return interaction.editReply({embeds:[walletEmbed(`⬇️ Deducted ${amount} from ${target.username}`,w,C.rd)]});}
      }catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    if(cmd==='weekly'){try{const r=await claimWeekly(interaction.user.id,interaction.user.tag||interaction.user.username);return interaction.editReply({embeds:[base('🌟 Weekly ClaveShard Claimed!',C.gold).setDescription(`**${interaction.user.username}** claimed their weekly reward!`).addFields({name:'💎 Claimed',value:`**+${r.amount}**`,inline:true},{name:'🔥 Streak',value:`Week ${r.streak}`,inline:true},{name:'💰 Balance',value:`${(r.data.wallet_balance||0).toLocaleString()}`,inline:true})]});}catch(e){return interaction.editReply(`⚠️ ${e.message}`);}}

    if(cmd==='leaderboard'){try{const lb=await getLeaderboard(10);return interaction.editReply({embeds:[P.LeaderboardPanel(lb)]});}catch{return interaction.editReply({embeds:[P.ErrorPanel('Leaderboard','Leaderboard temporarily unavailable.')]});}}

    if(cmd==='give'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');try{const target=interaction.options.getUser('user'),amount=interaction.options.getInteger('amount'),reason=interaction.options.getString('reason')||'Admin grant';const w=await grantShards(target.id,target.tag||target.username,amount,reason,interaction.user.id,interaction.user.tag||interaction.user.username);return interaction.editReply({embeds:[walletEmbed(`🎁 Granted to ${target.username}`,w,C.gr).setDescription(`+**${amount}** 💎 · ${reason}`)]});}catch(e){return interaction.editReply(`⚠️ ${e.message}`);}}

    if(cmd==='clvsd'){
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
          const total=data?.length||0,inp=data?.reduce((s,r)=>s+(r.input_tokens||0),0)||0,out=data?.reduce((s,r)=>s+(r.output_tokens||0),0)||0;
          const fast=data?.filter(r=>r.model?.includes('8b'))||[],smart=data?.filter(r=>r.model?.includes('70b'))||[];
          return interaction.editReply({embeds:[base('🧠 AEGIS AI Usage (Groq — Free)',C.cy).addFields({name:'🔢 Total Requests',value:`${total}`,inline:true},{name:'⚡ Fast (8B)',value:`${fast.length} calls`,inline:true},{name:'🧠 Smart (70B)',value:`${smart.length} calls`,inline:true},{name:'📥 Input Tokens',value:inp.toLocaleString(),inline:true},{name:'📤 Output Tokens',value:out.toLocaleString(),inline:true},{name:'💸 Cost',value:'**$0.00** (Groq Free Tier)',inline:true})]});
        }
      }catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    // ── SHOP ─────────────────────────────────────────────────────────
    if(cmd==='order'){
      const shards=interaction.options.getInteger('tier'),platform=interaction.options.getString('platform'),server=interaction.options.getString('server'),notes=interaction.options.getString('notes')||'None';
      const tier=SHOP_TIERS.find(t=>t.shards===shards&&t.shards>0);
      if(!tier)return interaction.editReply(`⚠️ No tier for **${shards}** shards. Valid: 1,2,3,5,6,8,10,12,15,20,30`);
      const ref=`ORD-${Date.now().toString(36).toUpperCase()}`;
      const emb=base(`📦 Order Submitted — ${tier.emoji} ${tier.name}`,C.gold)
        .addFields({name:'📋 Ref',value:`\`${ref}\``,inline:true},{name:'💎 Cost',value:`${tier.shards} shard${tier.shards!==1?'s':''}`,inline:true},{name:'🎮 Platform',value:platform,inline:true},{name:'🗺️ Server',value:server,inline:true},{name:'📝 Notes',value:notes,inline:false},{name:'📦 Includes',value:tier.items.map(i=>`• ${i}`).join('\n').slice(0,1000),inline:false},{name:'💳 Payment',value:'CashApp **$TheConclaveDominion** · Chime **$ANLIKESEF**\nInclude your Discord username in the payment note.',inline:false});
      if(sb&&sbOk())try{await sb.from('aegis_orders').insert({ref,guild_id:interaction.guildId,discord_id:interaction.user.id,discord_tag:interaction.user.tag||interaction.user.username,tier:tier.name,shards,platform,server,notes,status:'pending',created_at:new Date().toISOString()});}catch{}
      const orderChannel=process.env.ORDERS_CHANNEL_ID;
      if(orderChannel){try{const ch=bot.channels.cache.get(orderChannel);if(ch)await ch.send({embeds:[emb.setFooter({...FT,text:`Order from ${interaction.user.username} (${interaction.user.id})`})]});}catch{}}
      return interaction.editReply({embeds:[emb]});
    }

    if(cmd==='fulfill'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const ref=interaction.options.getString('ref'),note=interaction.options.getString('note')||'Your order is ready!';if(sb&&sbOk())try{await sb.from('aegis_orders').update({status:'fulfilled',fulfilled_at:new Date().toISOString(),fulfillment_note:note}).eq('ref',ref);}catch{}return interaction.editReply({embeds:[base(`✅ Order Fulfilled`,C.gr).addFields({name:'📋 Ref',value:`\`${ref}\``,inline:true},{name:'📝 Note',value:note,inline:false})]});}

    if(cmd==='shard'){const emb=base('💠 ClaveShard Tier List',C.gold).setDescription('Shop: **theconclavedominion.com/shop** | `/order` to submit\nCashApp **$TheConclaveDominion** · Chime **$ANLIKESEF**');for(const tier of SHOP_TIERS.filter(t=>t.shards>0))emb.addFields({name:`${tier.emoji} ${tier.name}`,value:tier.items.slice(0,6).map(i=>`• ${i}`).join('\n'),inline:true});emb.addFields({name:'🛡 Dino Insurance',value:SHOP_TIERS.find(t=>t.shards===0).items.map(i=>`• ${i}`).join('\n'),inline:false});return interaction.editReply({embeds:[emb]});}

    if(cmd==='shop'){const select=new StringSelectMenuBuilder().setCustomId('shop_tier_view').setPlaceholder('💎 View a tier...').addOptions(SHOP_TIERS.filter(t=>t.shards>0).map(t=>({label:`${t.emoji} ${t.name}`,value:`${t.shards}`,description:t.items[0]})));return interaction.editReply({embeds:[base('🛍️ ClaveShard Shop',C.gold).setDescription('Select a tier below to view full contents.\n\nUse `/order` to submit your order.\n\n💳 CashApp **$TheConclaveDominion** · Chime **$ANLIKESEF**\n\n🔗 Full catalog: **theconclavedominion.com/shop**')],components:[new ActionRowBuilder().addComponents(select)]});}

    // ── AI ────────────────────────────────────────────────────────────
    if(cmd==='aegis'||cmd==='ask'){const q=interaction.options.getString('question');const wait=checkRate(interaction.user.id,6000);if(wait)return interaction.editReply(`⏳ Please wait ${wait}s.`);const resp=await askAegis(q,interaction.user.id);return interaction.editReply({embeds:[P.AegisPanel(resp)]});}
    if(cmd==='forget'){clearHist(interaction.user.id);return interaction.editReply('🧹 Conversation history cleared.');}
    if(cmd==='ai-cost'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');if(!sb)return interaction.editReply('⚠️ Supabase not configured.');try{const{data}=await sb.from('aegis_ai_usage').select('model,input_tokens,output_tokens,used_search').order('created_at',{ascending:false}).limit(500);const total=data?.length||0,inp=data?.reduce((s,r)=>s+(r.input_tokens||0),0)||0,out=data?.reduce((s,r)=>s+(r.output_tokens||0),0)||0;const fast=data?.filter(r=>r.model?.includes('8b'))||[],smart=data?.filter(r=>r.model?.includes('70b'))||[];return interaction.editReply({embeds:[P.AiUsagePanel(total,fast.length,smart.length,inp,out)]});}catch(e){return interaction.editReply(`⚠️ ${e.message}`);}}

    // ── SERVERS ───────────────────────────────────────────────────────
    if(cmd==='servers'){const filter=interaction.options.getString('map');let servers=await fetchServerStatuses().catch(()=>MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20})));if(filter)servers=servers.filter(s=>s.name.toLowerCase().includes(filter.toLowerCase())||s.id.includes(filter.toLowerCase()));return interaction.editReply({embeds:[P.ServerMonitorPanel(servers)]});}
    if(cmd==='map'){const id=interaction.options.getString('name'),m=MAP_INFO[id];if(!m)return interaction.editReply('⚠️ Map not found.');return interaction.editReply({embeds:[P.MapPanel(m)]});}
    if(cmd==='monitor'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const ch=interaction.options.getChannel('channel');const servers=await fetchServerStatuses().catch(()=>MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20})));const msg=await ch.send({embeds:[buildMonitorEmbed(servers)]});monitorState.set(interaction.guildId,{statusChannelId:ch.id,messageId:msg.id});return interaction.editReply(`✅ Live monitor posted in ${ch}. Auto-refreshes every 5 min.`);}

    // ── INFO ──────────────────────────────────────────────────────────
    if(cmd==='info'){return interaction.editReply({embeds:[P.InfoPanel()]});}
    if(cmd==='rules'){return interaction.editReply({embeds:[P.RulesPanel()]});}
    if(cmd==='rates'){return interaction.editReply({embeds:[base('📈 5× Boost Rates',C.gr).addFields({name:'⚡ Core',value:'XP: 5× · Harvest: 5× · Taming: 5× · Breeding: 5×',inline:false},{name:'🏋️ Quality of Life',value:'Weight: 1,000,000 · No Fall Damage · Increased Stack Sizes',inline:false},{name:'🥚 Breeding',value:'Egg Hatch Speed: 50× · Baby Mature Speed: 50× · Cuddle Interval: 0.025',inline:false},{name:'🦕 Creatures',value:'Max Wild Level: 350 · Tamed Level Cap: 600',inline:false})]});}
    if(cmd==='mods'){return interaction.editReply({embeds:[base('🔧 Active Cluster Mods',C.cy).addFields({name:'Death Inventory Keeper',value:'Never lose your items on death.',inline:true},{name:'ARKomatic',value:'Quality-of-life improvements.',inline:true},{name:'Awesome Spyglass',value:'Advanced creature stats at a glance.',inline:true},{name:'Teleporter',value:'Fast travel between owned teleporters.',inline:true})]});}
    if(cmd==='wipe'){return interaction.editReply({embeds:[base('📅 Wipe Schedule',C.gold).setDescription('Wipes are announced **at least 2 weeks in advance** in announcements.\n\nWipes happen when a new major DLC drops or after 4–6 months.')]});}
    if(cmd==='transfer-guide'){return interaction.editReply({embeds:[base('🔄 Cross-ARK Transfer Guide',C.cy).addFields({name:'📤 Uploading',value:'Use any Obelisk, Terminal, or Loot Crate. Upload via "ARK Data". Wait ~1 min before downloading.',inline:false},{name:'📥 Downloading',value:'Visit any Obelisk/Terminal on destination. Open ARK Data tab and retrieve.',inline:false},{name:'⚠️ Notes',value:'Items expire after 24 hours. Some boss items cannot transfer.',inline:false})]});}
    if(cmd==='crossplay'){return interaction.editReply({embeds:[base('🎮 Crossplay Connection Guide',C.cy).addFields({name:'🎮 Xbox/PS',value:'ARK SA → Multiplayer → Join via IP. Type the IP:Port from `/servers`.',inline:false},{name:'💻 PC',value:'In ARK SA, go to Join Game → filter by "TheConclave" or paste the IP.',inline:false})]});}
    if(cmd==='patreon'){return interaction.editReply({embeds:[base('⭐ Patreon Perks',C.gold).setDescription('Support at **patreon.com/theconclavedominion**').addFields({name:'🥇 Elite ($20/mo)',value:'Amissa access · Priority support · Exclusive cosmetics',inline:true},{name:'🥈 Champion',value:'Bonus ClaveShards monthly',inline:true},{name:'🥉 Supporter',value:'Discord role · Supporter channels',inline:true})]});}

    if(cmd==='tip'){const tips=['Always disable friendly fire before taming!','Keep a Cryopod ready — cryo your tames before a base raid.','Use the Spyglass mod to check dino stats BEFORE taming.','Boss arenas wipe your inventory — prepare a dedicated boss kit.','Upload your best tames to ARK Data before a wipe warning.','The Megatherium gets a 75% damage boost after killing bugs — great for Broodmother.','First torpor = tame ownership — verbal claims are not valid.','Soap converts to Element in a Tek Replicator on our servers.'];return interaction.editReply({embeds:[P.TipPanel(tips[Math.floor(Math.random()*tips.length)])]});}

    if(cmd==='dino'){const name=interaction.options.getString('name');const resp=await askAegis(`ARK encyclopedia entry for "${name}": taming method, best food, saddle level, recommended use, stats to prioritize, TheConclave-specific tips on 5× rates. Under 1800 chars.`,null);return interaction.editReply({embeds:[P.DinoPanel(name,resp)]});}

    if(cmd==='help'){return interaction.editReply({embeds:[base('📖 AEGIS Command Reference',C.pl).addFields(
      {name:'🧠 AI',value:'`/aegis` `/ask` `/forget` `/ai-cost`',inline:true},
      {name:'💎 Economy',value:'`/wallet` `/weekly` `/order` `/shard` `/shop` `/leaderboard`',inline:true},
      {name:'🎵 Music',value:'Music handled by **CONbot5** bot. Use `/play` there.',inline:true},
      {name:'🗺️ Servers',value:'`/servers` `/map` `/monitor`',inline:true},
      {name:'ℹ️ Info',value:'`/info` `/rules` `/rates` `/mods` `/tip` `/dino`',inline:true},
      {name:'🤝 Community',value:'`/profile` `/rep` `/trade` `/coords` `/report`',inline:true},
      {name:'🔨 Moderation',value:'`/warn` `/ban` `/timeout` `/role` `/purge` `/lock`',inline:true},
      {name:'📡 Admin',value:'`/clvsd` `/give` `/announce` `/event` `/giveaway` `/ticket` `/know`',inline:true},
    ).setFooter({...FT,text:'AEGIS v10.2 Sovereign · Groq Free AI · Music → CONbot5'})]});}

    if(cmd==='ping'){return interaction.editReply({embeds:[P.PingPanel(bot.ws.ping,process.uptime(),Math.round(process.memoryUsage().heapUsed/1024/1024),!!groq,!!(sb&&sbOk()),false)]});}

    // ── COMMUNITY ────────────────────────────────────────────────────
    if(cmd==='profile'){const target=interaction.options.getUser('user')||interaction.user;const member=interaction.guild.members.cache.get(target.id);const w=sb?await getWallet(target.id,target.tag||target.username).catch(()=>null):null;const emb=base(`🎖️ ${target.username}'s Profile`,C.pl).setThumbnail(target.displayAvatarURL({size:128})).addFields({name:'🎭 Joined',value:member?.joinedAt?`<t:${Math.floor(member.joinedAt.getTime()/1000)}:D>`:'Unknown',inline:true},{name:'📅 Discord Since',value:`<t:${Math.floor(target.createdAt.getTime()/1000)}:D>`,inline:true});if(w)emb.addFields({name:'💎 ClaveShards',value:`${(w.wallet_balance||0).toLocaleString()} wallet · ${(w.bank_balance||0).toLocaleString()} bank`,inline:false},{name:'🔥 Streak',value:`Week ${w.daily_streak||0}`,inline:true},{name:'📈 Earned',value:`${(w.lifetime_earned||0).toLocaleString()}`,inline:true});return interaction.editReply({embeds:[emb]});}
    if(cmd==='rank'){try{const lb=await getLeaderboard(100);const pos=lb.findIndex(w=>w.discord_id===interaction.user.id)+1;const w=lb.find(w=>w.discord_id===interaction.user.id);if(!w)return interaction.editReply({embeds:[base('📊 Your Rank',C.cy).setDescription('No wallet found. Use `/weekly` to claim your first shards!')]});return interaction.editReply({embeds:[base(`📊 ${interaction.user.username}'s Rank`,C.cy).addFields({name:'🏆 Rank',value:pos?`#${pos} of ${lb.length}`:'>100',inline:true},{name:'💎 Wallet',value:`${(w.wallet_balance||0).toLocaleString()}`,inline:true})]});}catch{return interaction.editReply({embeds:[base('📊 Rank',C.cy).setDescription('_Rank unavailable._')]});}}
    if(cmd==='rep'){const target=interaction.options.getUser('user'),reason=interaction.options.getString('reason')||'No reason given';if(target.id===interaction.user.id)return interaction.editReply('⚠️ You cannot rep yourself!');return interaction.editReply({embeds:[base('⭐ Reputation Given',C.gold).setDescription(`${interaction.user} gave **+1 rep** to ${target}\n*"${reason}"*`)]});}
    if(cmd==='trade'){const offering=interaction.options.getString('offering'),looking=interaction.options.getString('looking-for'),server=interaction.options.getString('server')||'Any';return interaction.editReply({embeds:[base('🤝 Trade Post',C.gold).setDescription(`Posted by **${interaction.user.username}**`).addFields({name:'📤 Offering',value:offering,inline:true},{name:'📥 Looking For',value:looking,inline:true},{name:'🗺️ Server',value:server,inline:true}).setFooter({...FT,text:'DM the poster to trade • Use /report for scams'})]});}
    if(cmd==='report'){const issue=interaction.options.getString('issue'),player=interaction.options.getString('player')||'Not specified';const emb=base('🚨 Report Received',C.rd).setDescription(`Report filed by **${interaction.user.username}**`).addFields({name:'📋 Issue',value:issue,inline:false},{name:'👤 Player',value:player,inline:true},{name:'📅 Time',value:`<t:${Math.floor(Date.now()/1000)}:F>`,inline:true});if(sb&&sbOk())try{await sb.from('aegis_reports').insert({guild_id:interaction.guildId,reporter_id:interaction.user.id,reporter_tag:interaction.user.tag||interaction.user.username,issue,player,created_at:new Date().toISOString()});}catch{}return interaction.editReply({embeds:[emb.setFooter({...FT,text:'A Council member will review your report soon.'})]});}
    if(cmd==='coords'){const location=interaction.options.getString('location'),map=interaction.options.getString('map')||'Unknown';return interaction.editReply({embeds:[base('📍 Coordinates Shared',C.cy).setDescription(`**${interaction.user.username}** shared a location:`).addFields({name:'📍 Location',value:location,inline:true},{name:'🗺️ Map',value:map,inline:true})]});}
    if(cmd==='whois'){const target=interaction.options.getUser('user'),member=interaction.guild.members.cache.get(target.id);return interaction.editReply({embeds:[base(`🔍 ${target.username}`,C.cy).setThumbnail(target.displayAvatarURL({size:128})).addFields({name:'🆔 ID',value:target.id,inline:true},{name:'📅 Created',value:`<t:${Math.floor(target.createdAt.getTime()/1000)}:D>`,inline:true},{name:'🎭 Joined',value:member?.joinedAt?`<t:${Math.floor(member.joinedAt.getTime()/1000)}:D>`:'Not in server',inline:true},{name:'🎨 Roles',value:member?.roles.cache.filter(r=>r.name!=='@everyone').map(r=>`<@&${r.id}>`).join(' ')||'None',inline:false})]});}
    if(cmd==='serverinfo'){const g=interaction.guild;return interaction.editReply({embeds:[base(`🏠 ${g.name}`,C.pl).setThumbnail(g.iconURL()||'').addFields({name:'👥 Members',value:`${g.memberCount}`,inline:true},{name:'📅 Created',value:`<t:${Math.floor(g.createdAt.getTime()/1000)}:D>`,inline:true},{name:'💬 Channels',value:`${g.channels.cache.size}`,inline:true},{name:'🎭 Roles',value:`${g.roles.cache.size}`,inline:true},{name:'😀 Emojis',value:`${g.emojis.cache.size}`,inline:true},{name:'🌟 Boosts',value:`${g.premiumSubscriptionCount||0}`,inline:true})]});}

    // ── ADMIN/EVENTS ──────────────────────────────────────────────────
    if(cmd==='announce'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const title=interaction.options.getString('title'),message=interaction.options.getString('message'),ping=interaction.options.getBoolean('ping')??false;await interaction.channel.send({content:ping?'@everyone':null,embeds:[P.AnnouncementPanel(title,message,interaction.user.username)]});return interaction.editReply('✅ Announcement posted.');}
    if(cmd==='event'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const title=interaction.options.getString('title'),desc=interaction.options.getString('description'),date=interaction.options.getString('date')||'TBA',ping=interaction.options.getBoolean('ping')??false;await interaction.channel.send({content:ping?'@everyone':null,embeds:[P.EventPanel(title,desc,date,interaction.user.username)]});return interaction.editReply('✅ Event announcement posted.');}
    if(cmd==='giveaway'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const prize=interaction.options.getString('prize'),duration=interaction.options.getInteger('duration'),winners=interaction.options.getInteger('winners')||1;const endTime=Date.now()+duration*60*1000;const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🎉 Enter Giveaway').setStyle(ButtonStyle.Success));const msg=await interaction.channel.send({embeds:[P.GiveawayPanel(prize,winners,endTime,interaction.user.username)],components:[row]});activeGiveaways.set(msg.id,{prize,entries:new Set(),endTime,channelId:interaction.channelId,winnersCount:winners});setTimeout(()=>drawGiveaway(msg.id,interaction.guildId,bot),duration*60*1000);return interaction.editReply(`✅ Giveaway started! Ends <t:${Math.floor(endTime/1000)}:R>.`);}
    if(cmd==='endgiveaway'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const msgId=interaction.options.getString('messageid');if(!activeGiveaways.has(msgId))return interaction.editReply('⚠️ No active giveaway with that ID.');await drawGiveaway(msgId,interaction.guildId,bot);return interaction.editReply('✅ Giveaway ended.');}

    // ── MODERATION ────────────────────────────────────────────────────
    if(cmd==='warn'){if(!isMod(interaction.member))return interaction.editReply('⛔ Mod only.');const target=interaction.options.getUser('user'),reason=interaction.options.getString('reason');await addWarn(interaction.guildId,target.id,target.tag||target.username,reason,interaction.user.id,interaction.user.tag||interaction.user.username);const warns=await getWarns(interaction.guildId,target.id);try{const dm=await target.createDM();await dm.send({embeds:[base(`⚠️ Warning in ${interaction.guild.name}`,C.gold).setDescription(`**Reason:** ${reason}\n\nPlease review the server rules with \`/rules\`.`)]});}catch{}return interaction.editReply({embeds:[P.WarnPanel(target,reason,warns.length,interaction.user)]});}
    if(cmd==='warn-history'){if(!isMod(interaction.member))return interaction.editReply('⛔ Mod only.');const target=interaction.options.getUser('user'),warns=await getWarns(interaction.guildId,target.id);if(!warns.length)return interaction.editReply(`✅ **${target.username}** has no warnings.`);return interaction.editReply({embeds:[base(`📋 Warnings — ${target.username}`,C.rd).setDescription(warns.map((w,i)=>`**${i+1}.** ${w.reason}\n└ by **${w.issued_by_tag||'Unknown'}** · <t:${Math.floor(new Date(w.created_at).getTime()/1000)}:R>`).join('\n\n'))]});}
    if(cmd==='ban'){if(!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))return interaction.editReply('⛔ Ban Members required.');const target=interaction.options.getUser('user'),reason=interaction.options.getString('reason');try{await interaction.guild.members.ban(target.id,{reason:`${interaction.user.username}: ${reason}`});return interaction.editReply({embeds:[base(`🔨 Banned: ${target.username}`,C.rd).setDescription(`**Reason:** ${reason}`)]});}catch(e){return interaction.editReply(`⚠️ Could not ban: ${e.message}`);}}
    if(cmd==='timeout'){if(!isMod(interaction.member))return interaction.editReply('⛔ Mod only.');const target=interaction.options.getUser('user'),duration=interaction.options.getString('duration'),reason=interaction.options.getString('reason')||'No reason';const durations={'5m':5*60_000,'1h':60*60_000,'6h':6*60*60_000,'24h':24*60*60_000,'7d':7*24*60*60_000};const ms=durations[duration]||5*60_000;try{const member=interaction.guild.members.cache.get(target.id);if(!member)return interaction.editReply('⚠️ Member not in server.');await member.timeout(ms,reason);return interaction.editReply({embeds:[base(`⏰ Timeout: ${target.username}`,C.gold).addFields({name:'⏱️ Duration',value:duration,inline:true},{name:'📋 Reason',value:reason,inline:true})]});}catch(e){return interaction.editReply(`⚠️ Timeout failed: ${e.message}`);}}
    if(cmd==='role'){if(!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles))return interaction.editReply('⛔ Manage Roles required.');const target=interaction.options.getUser('user'),role=interaction.options.getRole('role'),action=interaction.options.getString('action');try{const m=interaction.guild.members.cache.get(target.id);if(!m)return interaction.editReply('⚠️ Member not found.');if(action==='add'){await m.roles.add(role);return interaction.editReply(`✅ Added <@&${role.id}> to **${target.username}**.`);}else{await m.roles.remove(role);return interaction.editReply(`✅ Removed <@&${role.id}> from **${target.username}**.`);}}catch(e){return interaction.editReply(`⚠️ Role change failed: ${e.message}`);}}
    if(cmd==='ticket'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_open').setLabel('🎫 Open a Ticket').setStyle(ButtonStyle.Primary),new ButtonBuilder().setLabel('📋 View Rules').setStyle(ButtonStyle.Link).setURL('https://theconclavedominion.com/terms.html'));await interaction.channel.send({embeds:[P.TicketPanel()],components:[row]});return interaction.editReply('✅ Ticket panel posted.');}
    if(cmd==='purge'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const count=interaction.options.getInteger('count'),user=interaction.options.getUser('user');try{let messages=await interaction.channel.messages.fetch({limit:100});if(user)messages=messages.filter(m=>m.author.id===user.id);const toDelete=[...messages.values()].slice(0,count).filter(m=>Date.now()-m.createdTimestamp<1209600000);await interaction.channel.bulkDelete(toDelete,true);return interaction.editReply(`✅ Deleted **${toDelete.length}** message${toDelete.length!==1?'s':''}${user?` from **${user.username}**`:''}.`);}catch(e){return interaction.editReply(`⚠️ ${e.message}`);}}
    if(cmd==='slowmode'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const seconds=interaction.options.getInteger('seconds');try{await interaction.channel.setRateLimitPerUser(seconds);return interaction.editReply(seconds===0?'✅ Slowmode disabled.':`✅ Slowmode set to **${seconds}s**.`);}catch(e){return interaction.editReply(`⚠️ ${e.message}`);}}
    if(cmd==='lock'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const action=interaction.options.getString('action'),reason=interaction.options.getString('reason')||'No reason';try{const lock=action==='lock';await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone,{SendMessages:lock?false:null});return interaction.editReply(`${lock?'🔒':'🔓'} Channel **${lock?'locked':'unlocked'}**. Reason: ${reason}`);}catch(e){return interaction.editReply(`⚠️ ${e.message}`);}}

    // ── KNOWLEDGE ─────────────────────────────────────────────────────
    if(cmd==='know'){
      if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');
      if(!sb)return interaction.editReply('⚠️ Supabase not configured.');
      const sub=interaction.options.getSubcommand();
      try{
        if(sub==='add'){const category=interaction.options.getString('category'),title=interaction.options.getString('title'),content=interaction.options.getString('content');const key=`${category}_${Date.now().toString(36)}`;const{error}=await sb.from('aegis_knowledge').upsert({category,key,title,content,added_by:interaction.user.tag||interaction.user.username,updated_at:new Date().toISOString()},{onConflict:'key'});if(error)throw new Error(error.message);_kCache=null;return interaction.editReply(`✅ Added knowledge entry **${title}** in category **${category}**.`);}
        if(sub==='list'){const category=interaction.options.getString('category');let query=sb.from('aegis_knowledge').select('category,key,title,added_by').order('category').limit(30);if(category)query=query.eq('category',category);const{data,error}=await query;if(error)throw new Error(error.message);if(!data?.length)return interaction.editReply('📭 No knowledge entries.');return interaction.editReply({embeds:[base('📚 Knowledge Base',C.cy).setDescription(data.map(r=>`**[${r.category}]** \`${r.key}\` · ${r.title} · *by ${r.added_by||'Unknown'}*`).join('\n'))]});}
        if(sub==='delete'){const key=interaction.options.getString('key');const{error}=await sb.from('aegis_knowledge').delete().eq('key',key);if(error)throw new Error(error.message);_kCache=null;return interaction.editReply(`✅ Deleted knowledge entry \`${key}\``);}
      }catch(e){return interaction.editReply(`⚠️ ${e.message}`);}
    }

    // ── UTILS ─────────────────────────────────────────────────────────
    if(cmd==='roll'){const notation=(interaction.options.getString('dice')||'d6').toLowerCase().replace(/\s/g,'');const match=notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/);if(!match)return interaction.editReply('⚠️ Invalid notation. Try `d6`, `2d10`, `3d8+5`');const count2=Math.min(parseInt(match[1]||'1'),20),sides=Math.min(parseInt(match[2]),1000),mod=parseInt(match[3]||'0');const rolls=Array.from({length:count2},()=>Math.floor(Math.random()*sides)+1);const sum=rolls.reduce((a,b)=>a+b,0)+mod;return interaction.editReply({embeds:[P.RollPanel(notation,rolls,sum,mod)]});}
    if(cmd==='coinflip'){const result=Math.random()<0.5;return interaction.editReply({embeds:[base(`🪙 ${result?'Heads':'Tails'}!`,C.gold).setDescription(`The coin landed on **${result?'🌕 Heads':'🌑 Tails'}**!`)]});}
    if(cmd==='calc'){const expr=interaction.options.getString('expression');try{const san=expr.replace(/[^0-9+\-*/().% ^]/g,'');if(!san)return interaction.editReply('⚠️ Invalid expression.');const result=Function(`'use strict'; return (${san.replace(/\^/g,'**')})`)();if(!isFinite(result))return interaction.editReply('⚠️ Result not finite.');return interaction.editReply({embeds:[base('🔢 Calculator',C.cy).addFields({name:'Expression',value:`\`${expr}\``,inline:true},{name:'Result',value:`**${result.toLocaleString()}**`,inline:true})]});}catch{return interaction.editReply('⚠️ Invalid expression.');}}
    if(cmd==='remind'){const message=interaction.options.getString('message'),timeStr=interaction.options.getString('time');const parseTime=(s)=>{const n=parseFloat(s);if(s.endsWith('d'))return n*86400000;if(s.endsWith('h'))return n*3600000;if(s.endsWith('m'))return n*60000;return null;};const ms=parseTime(timeStr);if(!ms||ms<10000||ms>604800000)return interaction.editReply('⚠️ Time must be 10s–7d. Examples: `30m`, `2h`, `1d`');const fireAt=new Date(Date.now()+ms);await interaction.editReply({embeds:[P.ReminderSetPanel(message,fireAt)]});setTimeout(async()=>{try{await interaction.user.send({embeds:[P.ReminderFirePanel(message)]});}catch{const ch=interaction.channel;if(ch)await ch.send({content:`<@${interaction.user.id}>`,embeds:[P.ReminderFirePanel(message)]}).catch(()=>{}); }},ms);}
    if(cmd==='poll'){if(!isAdmin(interaction.member))return interaction.editReply('⛔ Admin only.');const opts=interaction.options.getString('options').split('|').map(o=>o.trim()).filter(Boolean).slice(0,10);if(opts.length<2)return interaction.editReply('⚠️ Need at least 2 options separated by |');const L=['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'];const msg=await interaction.editReply({embeds:[P.PollPanel(interaction.options.getString('question'),opts,interaction.user.username)],fetchReply:true});for(let j=0;j<opts.length;j++){try{await msg.react(L[j]);}catch{}}}

  } catch(e) {
    const msg=e?.message||String(e||'');
    if(msg.includes('Unknown interaction')||msg.includes('429')||msg.includes('rate limit'))return;
    console.error(`❌ /${cmd}:`,e.message);
    try{await interaction.editReply(`⚠️ Error: ${e.message.slice(0,200)}`);}catch{}
  }
});

// ── AUTO-REPLY ─────────────────────────────────────────────────────────
bot.on(Events.MessageCreate, async msg => {
  if(msg.author.bot)return;
  if(!AEGIS_CHANNEL_ID||msg.channelId!==AEGIS_CHANNEL_ID)return;
  const w=checkRate(msg.author.id,8000);
  if(w){const m=await msg.reply(`⏳ Retry in ${w}s.`).catch(()=>null);if(m)setTimeout(()=>m.delete().catch(()=>{}),4000);return;}
  msg.channel.sendTyping().catch(()=>{});
  const r=await askAegis(msg.content,msg.author.id);
  msg.reply(r.slice(0,1990)).catch(()=>msg.channel.send(r.slice(0,1990)).catch(()=>{}));
});

// ── WELCOME ────────────────────────────────────────────────────────────
bot.on(Events.GuildMemberAdd, async member => {
  try{
    if(sb&&sbOk())(async()=>{try{await sb.from('aegis_wallets').upsert({discord_id:member.id,discord_tag:member.user.username,updated_at:new Date().toISOString()},{onConflict:'discord_id',ignoreDuplicates:true});}catch{}})();
    const ch=member.guild.channels.cache.find(c=>c.name==='welcome'||c.name==='welcomes');
    if(!ch)return;
    await ch.send({embeds:[P.WelcomePanel(member.user,member.guild.memberCount)]});
  }catch(e){console.error('❌ Welcome:',e.message);}
});

// ── HEALTH SERVER ──────────────────────────────────────────────────────
const STATUS={ready:false,readyAt:null,reconnects:0};
const healthServer=http.createServer((req,res)=>{
  if(req.url==='/health'||req.url==='/'){
    const up=STATUS.ready&&bot.ws.status===0;
    const mem=process.memoryUsage();
    res.writeHead(up?200:503,{'Content-Type':'application/json'});
    res.end(JSON.stringify({status:up?'ok':'degraded',bot:STATUS.ready?'ready':'not_ready',ws:bot.ws.status,wsLatency:bot.ws.ping,uptime:STATUS.readyAt?Math.floor((Date.now()-STATUS.readyAt)/1000)+'s':'0s',reconnects:STATUS.reconnects,heapMB:Math.round(mem.heapUsed/1024/1024),ai:groq?'groq':'not_configured',supabase:sb?(sbOk()?'ok':'circuit_open'):'not_configured',music:'DECOUPLED → CONbot5',version:'v10.2'}));
  }else{res.writeHead(404);res.end('Not found');}
});
healthServer.listen(BOT_PORT,()=>console.log(`💓 Health: :${BOT_PORT}`));

// ── PROCESS GUARDS ─────────────────────────────────────────────────────
const IGNORE=['Unknown interaction','Unknown Message','Missing Access','Cannot send messages','Unknown Channel','429','rate limit'];
process.on('unhandledRejection',r=>{const m=r?.message||String(r);if(!IGNORE.some(e=>m.includes(e)))console.error('❌ Rejection:',m);});
process.on('uncaughtException',(e,o)=>console.error(`❌ Exception [${o}]:`,e.message));
process.on('SIGTERM',()=>{STATUS.ready=false;healthServer.close();bot.destroy();setTimeout(()=>process.exit(0),3000);});
process.on('SIGINT',()=>{STATUS.ready=false;healthServer.close();bot.destroy();setTimeout(()=>process.exit(0),1000);});

// ── READY ──────────────────────────────────────────────────────────────
bot.once(Events.ClientReady, async()=>{
  STATUS.ready=true; STATUS.readyAt=Date.now();
  console.log(`\n🤖 AEGIS v10.2 SOVEREIGN (Music Decoupled) — ${bot.user.tag}`);
  console.log(`   Supabase: ${sb?'✅':'⚠️'} · Groq AI: ${groq?'✅ Free':'⚠️'} · Health: :${BOT_PORT}`);
  console.log(`   🎵 Music: DECOUPLED → CONbot5`);
  bot.user.setActivity('💎 /weekly | AEGIS v10.2 | Music → CONbot5', {type:3});
  await registerCommands();
  if(!DISCORD_GUILD_ID)return;
  try{
    const guild=await bot.guilds.fetch(DISCORD_GUILD_ID).catch(()=>null); if(!guild)return;
    console.log('📡 Skipping boot-time status channel renames to avoid rate limits');
    const statuses=await fetchServerStatuses().catch(()=>[]);
    const monCh=process.env.MONITOR_STATUS_CHANNEL_ID, monMsg=process.env.MONITOR_MESSAGE_ID;
    if(monCh&&monMsg){
      monitorState.set(DISCORD_GUILD_ID,{statusChannelId:monCh,messageId:monMsg});
      const ch=await guild.channels.fetch(monCh).catch(()=>null);
      if(ch){const embed=buildMonitorEmbed(statuses);const msg=await ch.messages.fetch(monMsg).catch(()=>null);if(msg)await msg.edit({embeds:[embed]}).catch(e=>console.error('❌ Monitor resume:',e.message));}
    }
  }catch(e){console.error('❌ Boot tasks:',e.message);}
});

// ── LOGIN ──────────────────────────────────────────────────────────────
const BACKOFF=[5,15,30,60,120,120];
let loginAttempt=0;
async function login(){
  loginAttempt++;
  try{await bot.login(DISCORD_BOT_TOKEN);loginAttempt=0;}
  catch(e){const delay=BACKOFF[Math.min(loginAttempt-1,BACKOFF.length-1)]*1000;console.error(`❌ Login attempt ${loginAttempt} failed: ${e.message} — retry in ${delay/1000}s`);STATUS.reconnects++;setTimeout(login,delay);}
}
login();
module.exports = bot;
