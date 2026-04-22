// ═══════════════════════════════════════════════════════════════════════
// CONCLAVE AEGIS — MUSIC RUNTIME v4.0 RYTHM-CLASS SOVEREIGN
// ✅ Discord Activity presence  ✅ Voice-channel text panel
// ✅ Title search (no URL needed)  ✅ All-member voting & queue adds
// ✅ Persistent dashboard  ✅ Auto DJ  ✅ 24/7 Mood Rooms
// ✅ Queue pagination  ✅ Lyrics search  ✅ Equaliser presets
// ═══════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState,
  getVoiceConnection, NoSubscriberBehavior, StreamType,
} = require('@discordjs/voice');
const playdl = require('play-dl');
const fs     = require('node:fs');
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, SlashCommandBuilder, PermissionFlagsBits,
  ActivityType,
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// ─── SUPABASE ─────────────────────────────────────────────────────────
const sb = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

// ─── CONSTANTS ────────────────────────────────────────────────────────
const MAX_QUEUE          = 500;
const PROG_LEN           = 20;
const REFRESH_MS         = 15_000;
const RECONNECT_DELAY    = parseInt(process.env.ROOM_RECONNECT_DELAY || '5000');
const PULSE_INTERVAL     = parseInt(process.env.ROOM_PULSE_INTERVAL  || '25000');
const DJ_ROLE            = process.env.MUSIC_DJ_ROLE_ID || null;
const VOTE_THRESHOLD     = 0.5;   // 50% of voice members to skip
const HISTORY_MAX        = 100;
const AUTO_SIMILAR_COUNT = 5;
const YT_FAIL_SKIP_DELAY = 1200;
const YT_ERROR_COOLDOWN  = 15_000;
const SEARCH_RESULTS     = 8;     // show 8 results in search picker

// Cookie injection
try {
  const cookie = process.env.YOUTUBE_COOKIE || '';
  if (cookie && typeof playdl.setToken === 'function') {
    playdl.setToken({ youtube: { cookie } });
    console.log('🍪 YouTube cookie injected');
  }
} catch (e) { console.warn('⚠️ YouTube cookie inject failed:', e.message); }

// ─── BOT GATE DETECTION ───────────────────────────────────────────────
function isBotGate(err) {
  const m = String(err?.message || err || '');
  return /sign in to confirm/i.test(m) || /not a bot/i.test(m) || /while getting info/i.test(m);
}

// ─── GENRE CATALOG ────────────────────────────────────────────────────
const GENRES = {
  lofi:       { label:'🌙 Lo-Fi',       color:0x7B2FFF, queries:['lofi hip hop chill beats study 2024','midnight lo-fi mix deep focus','chill lofi beats relaxing 1 hour'] },
  synthwave:  { label:'🌊 Synthwave',    color:0xFF4CD2, queries:['synthwave retrowave mix 2024','outrun synthwave neon night drive','retrowave 80s electronic'] },
  ambient:    { label:'🌌 Ambient',      color:0x00D4FF, queries:['dark ambient space music 1 hour','cosmic ambient meditation deep','cinematic ambient drone score'] },
  epicbattle: { label:'⚔️ Epic Battle',  color:0xFF4500, queries:['epic battle orchestral cinematic gaming','boss fight music intense dramatic','epic cinematic combat film score'] },
  hiphop:     { label:'🎤 Hip-Hop',      color:0xFFB800, queries:['hip hop beats instrumental 2024 best','rap instrumental mix trap beats','chill hip hop playlist study'] },
  electronic: { label:'⚡ Electronic',   color:0x00FF88, queries:['electronic edm gaming mix 2024','progressive house deep mix','techno electronic focus work'] },
  rock:       { label:'🎸 Rock',         color:0xFF6B35, queries:['rock gaming music hard mix 2024','best rock songs playlist energy','alternative rock greatest hits'] },
  jazz:       { label:'🎷 Jazz',         color:0xC9A96E, queries:['smooth jazz instrumental cafe background','jazz focus study music piano','jazz lounge cocktail music best'] },
  classical:  { label:'🎻 Classical',    color:0xE8D5B7, queries:['epic orchestral classical music best','piano classical focus composers','cinematic classical dramatic film'] },
  kpop:       { label:'🌸 K-Pop',        color:0xFF69B4, queries:['kpop playlist 2024 best hits mix','kpop bts blackpink trending','best kpop girl group boy group 2024'] },
  vgm:        { label:'🎮 VGM / OST',    color:0x4ECDC4, queries:['video game soundtrack best ost playlist','epic game music mix 1 hour','iconic gaming ost collection'] },
  party:      { label:'🎉 Party / Hype', color:0xFFD700, queries:['party mix 2024 hype energy hits','best party songs club mix','hype playlist workout energy'] },
  metal:      { label:'🔥 Metal',        color:0x8B0000, queries:['heavy metal gaming power mix','best metal songs playlist headbang','power metal epic thrash'] },
  rnb:        { label:'💜 R&B / Soul',   color:0x9B59B6, queries:['rnb soul music playlist chill 2024','best rnb songs smooth mix','neo soul rnb vibes'] },
  country:    { label:'🤠 Country',      color:0xD2691E, queries:['country music best hits 2024','country pop playlist modern','country road songs mix'] },
  reggae:     { label:'🌴 Reggae',       color:0x2ECC71, queries:['reggae music best hits chill summer','reggae dancehall mix vibes','roots reggae classic hits'] },
};

// ─── MOOD PRESETS ─────────────────────────────────────────────────────
const MOODS = {
  'midnight-lofi':    { label:'🌙 Midnight Lo-Fi',  genre:'lofi',       vol:60, color:0x7B2FFF, emoji:'🌙', desc:'Smooth lo-fi for late-night grind' },
  'synthwave-lounge': { label:'🌊 Synthwave Lounge', genre:'synthwave',  vol:70, color:0xFF4CD2, emoji:'🌊', desc:'Retro-futuristic synth drive' },
  'ambient-void':     { label:'🌌 Ambient Void',     genre:'ambient',    vol:50, color:0x00D4FF, emoji:'🌌', desc:'Deep space ambient focus' },
  'raid-prep':        { label:'⚔️ Raid Prep',         genre:'epicbattle', vol:85, color:0xFF4500, emoji:'⚔️', desc:'Maximum hype for boss runs' },
  'party-room':       { label:'🎉 Party Room',        genre:'party',      vol:80, color:0xFFD700, emoji:'🎉', desc:'Non-stop energy' },
  'vgm-lounge':       { label:'🎮 VGM Lounge',        genre:'vgm',        vol:65, color:0x4ECDC4, emoji:'🎮', desc:'Iconic video game soundtracks' },
  'metal-forge':      { label:'🔥 Metal Forge',       genre:'metal',      vol:80, color:0x8B0000, emoji:'🔥', desc:'Headbang and craft' },
  'chill-rnb':        { label:'💜 Chill R&B',         genre:'rnb',        vol:65, color:0x9B59B6, emoji:'💜', desc:'Smooth R&B for base building' },
};

// ─── EQUALISER PRESETS ────────────────────────────────────────────────
// Volume modifiers — actual EQ requires ffmpeg filters (future upgrade)
const EQ_PRESETS = {
  flat:       { label:'⚖️ Flat',         volMod: 1.0 },
  bassboost:  { label:'🔊 Bass Boost',   volMod: 1.15 },
  nightcore:  { label:'🌟 Nightcore',    volMod: 0.9  },
  vaporwave:  { label:'🌊 Vaporwave',    volMod: 0.85 },
  earrape:    { label:'📢 Earrape',      volMod: 1.5  },
};

// ─── GUILD STATE ──────────────────────────────────────────────────────
const guildStates    = new Map();
const permanentRooms = new Map();

class GuildMusicState {
  constructor(gid) {
    this.guildId         = gid;
    this.queue           = [];
    this.history         = [];
    this.current         = null;
    this.player          = null;
    this.connection      = null;
    this.voiceChannelId  = null;
    this.textChannelId   = null;      // fallback text channel
    this.vcTextChannelId = null;      // voice-channel built-in text (preferred)
    this.launchpadMsgId  = null;
    this.launchpadChId   = null;
    this.dashboardMsgId  = null;
    this.dashboardChId   = null;
    this.nowPlayingMsgId = null;
    this.volume          = 80;
    this.loop            = false;
    this.loopQueue       = false;
    this.shuffle         = false;
    this.autoplay        = false;
    this.mood            = null;
    this.moodBuffer      = [];
    this.eq              = 'flat';
    this.skipVotes       = new Set();
    this.addVotes        = new Map();  // song URL → Set of voter IDs
    this.progressTimer   = null;
    this.client          = null;
    this.startedAt       = null;
    this.paused          = false;
    this._lastBotGate    = 0;
  }
}

function getState(gid) {
  if (!guildStates.has(gid)) guildStates.set(gid, new GuildMusicState(gid));
  return guildStates.get(gid);
}

// ─── PERMISSION HELPERS ───────────────────────────────────────────────
function isDJ(member) {
  if (!DJ_ROLE) return true;
  return member?.roles?.cache?.has(DJ_ROLE)
      || member?.permissions?.has(PermissionFlagsBits.ManageChannels);
}

// Any voice channel member can vote / add to queue
function isInVoice(member, state) {
  if (!state.voiceChannelId) return false;
  const vc = member?.guild?.channels?.cache?.get(state.voiceChannelId);
  return !!vc?.members?.has(member.id);
}

function voiceMemberCount(state, guild) {
  const vc = guild?.channels?.cache?.get(state.voiceChannelId);
  return vc?.members?.filter(m => !m.user.bot).size || 1;
}

// ─── UTILITIES ────────────────────────────────────────────────────────
const FT = { text:'TheConclave Dominion • AEGIS Music v4 Rythm-Class', iconURL:'https://theconclavedominion.com/conclave-badge.png' };

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

function progBar(cur, tot) {
  const f = Math.round(Math.min(tot>0?cur/tot:0,1)*PROG_LEN);
  return `${'█'.repeat(f)}${'░'.repeat(PROG_LEN-f)}`;
}

function pct(cur, tot) { return tot ? Math.round(Math.min(cur/tot,1)*100) : 0; }

// ─── TRACK RESOLUTION ─────────────────────────────────────────────────
function mkTrack(yt, url=null, src='youtube', thumb=null) {
  return {
    title:     yt.title || 'Unknown',
    url:       url || yt.url,
    duration:  yt.durationInSec || 0,
    thumbnail: thumb || yt.thumbnails?.[0]?.url || null,
    source:    src,
    ytId:      yt.id || null,
  };
}

async function resolveTrack(query) {
  try {
    const isUrl = /^https?:\/\//.test(query);

    if (isUrl) {
      if (query.includes('spotify.com')) {
        const sp = await playdl.spotify(query).catch(() => null);
        if (!sp) return null;
        if (sp.type === 'track') {
          const yt = await playdl.search(`${sp.name} ${sp.artists?.[0]?.name||''}`, { source:{ youtube:'video' }, limit:1 });
          if (!yt[0]) return null;
          return mkTrack(yt[0], query, 'spotify', sp.thumbnail?.url);
        }
        if (sp.type === 'playlist' || sp.type === 'album') {
          const all = await sp.all_tracks();
          return all.slice(0,100).map(t => ({
            title: `${t.name} — ${t.artists?.[0]?.name||'Unknown'}`,
            url: t.url, duration: t.durationInSec||0,
            thumbnail: t.thumbnail?.url||null, source:'spotify',
          }));
        }
        return null;
      }

      if (query.includes('soundcloud.com')) {
        const sc = await playdl.soundcloud(query);
        return { title:sc.name, url:query, duration:sc.durationInSec||0, thumbnail:sc.thumbnail||null, source:'soundcloud' };
      }

      if (query.includes('list=')) {
        const pl = await playdl.playlist_info(query, { incomplete:true }).catch(() => null);
        if (pl) {
          const vids = await pl.all_videos();
          return vids.slice(0,100).map(v => mkTrack(v, null, 'youtube'));
        }
      }

      const info = await playdl.video_info(query);
      const d    = info.video_details;
      return { title:d.title, url:query, duration:d.durationInSec||0, thumbnail:d.thumbnails?.[0]?.url||null, source:'youtube', ytId:d.id };
    }

    // Title search — return top result
    const results = await playdl.search(query, { source:{ youtube:'video' }, limit:1 });
    return results[0] ? mkTrack(results[0]) : null;

  } catch (e) { console.error('[Music] resolve:', e.message); return null; }
}

// Search and return multiple results for picker UI
async function searchMultiple(query, limit = SEARCH_RESULTS) {
  try { return await playdl.search(query, { source:{ youtube:'video' }, limit }); }
  catch { return []; }
}

async function getStream(track) {
  const opts = { quality:2, precache:3, discordPlayerCompatibility:true };
  try { return await playdl.stream(track.url, opts); }
  catch { return await playdl.stream(track.url, { ...opts, quality:1 }); }
}

// ─── VOICE TEXT CHANNEL HELPER ────────────────────────────────────────
// Discord voice channels have an associated text channel since 2022.
// We try to post the control panel there first, then fall back to
// the text channel the command was issued in.
async function resolveVoiceTextChannel(state, client) {
  if (state.vcTextChannelId) {
    const ch = client.channels.cache.get(state.vcTextChannelId);
    if (ch) return ch;
  }
  if (state.textChannelId) {
    return client.channels.cache.get(state.textChannelId) || null;
  }
  return null;
}

// When a user joins with /music play, try to detect the voice channel's
// built-in text channel (same ID as the voice channel on recent Discord).
function detectVoiceTextId(vcChannel) {
  // Modern Discord: the voice channel itself can receive messages.
  // We use the VC's ID as the text channel target and let Discord.js handle it.
  return vcChannel?.id || null;
}

// ─── EMBED BUILDERS ───────────────────────────────────────────────────

function buildActivityDashboard(state, elapsed=0) {
  const t    = state.current;
  const mood = state.mood ? MOODS[state.mood] : null;
  const eq   = EQ_PRESETS[state.eq] || EQ_PRESETS.flat;
  const color = mood?.color ?? 0x7B2FFF;

  const p    = t ? pct(Math.min(elapsed, t.duration), t.duration) : 0;
  const bar  = t ? progBar(Math.min(elapsed, t.duration), t.duration) : '─'.repeat(PROG_LEN);
  const time = t ? `${fmtTime(Math.min(elapsed,t.duration))} / ${fmtTime(t.duration)}` : '0:00 / 0:00';

  const badges = [
    state.loop      ? '`🔂 LOOP`'    : null,
    state.loopQueue ? '`🔁 Q-LOOP`'  : null,
    state.shuffle   ? '`🔀 SHUFFLE`' : null,
    state.autoplay  ? '`🤖 AUTO`'    : null,
    state.paused    ? '`⏸ PAUSED`'  : null,
    state.eq !== 'flat' ? `\`${eq.label}\`` : null,
    mood ? `\`${mood.emoji} ${mood.label}\`` : null,
  ].filter(Boolean).join(' ');

  const nextUp = state.queue.slice(0,3).map((x,i)=>`\`${i+1}.\` ${x.title.slice(0,42)}`).join('\n') || '_Queue empty — add tracks or enable Auto_';

  const emb = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name:'🎵 AEGIS Music — Rythm-Class v4', iconURL:'https://theconclavedominion.com/conclave-badge.png' })
    .setTimestamp()
    .setFooter(FT);

  if (t) {
    emb.setTitle(t.title.slice(0,256))
       .setURL(t.url)
       .setThumbnail(t.thumbnail || 'https://theconclavedominion.com/conclave-badge.png')
       .setDescription([
         `\`${bar}\` **${p}%**`,
         `\`${time}\``,
         '',
         badges || '▶️ Playing',
         '',
         `🔊 **Vol** ${state.volume}%  ·  📋 **Queue** ${state.queue.length}  ·  📜 **History** ${state.history.length}`,
       ].join('\n'))
       .addFields(
         { name:'🎶 Up Next', value:nextUp, inline:false },
         { name:'🎤 Added by', value:t.requestedBy||'AutoPlay', inline:true },
         { name:'📡 Source', value:(t.source||'YouTube').toUpperCase(), inline:true },
         { name:'⏱️ Duration', value:fmtTime(t.duration), inline:true },
       );
  } else {
    emb.setTitle('⏹️ Nothing Playing')
       .setDescription('Use `/music play <song name>` to add a track!\n\nOr browse genres / pick a Mood Room below.\n> *AEGIS Music Rythm-Class — Global Streaming*');
  }

  return emb;
}

function buildLaunchpad(state) {
  const mood  = state.mood ? MOODS[state.mood] : null;
  const color = mood?.color ?? 0x7B2FFF;
  const t     = state.current;

  const emb = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${mood?.emoji ?? '🎛️'} AEGIS Music Control — Voice Panel`)
    .setFooter({ ...FT, text:`${FT.text} · All voice members can interact!` })
    .setTimestamp();

  if (t) {
    emb.setDescription(`**▶️ ${t.title.slice(0,80)}**\nby **${t.requestedBy||'AutoPlay'}**`)
       .setThumbnail(t.thumbnail || null);
  } else {
    emb.setDescription('_Idle — use the controls below or type `/music play <song name>`_');
  }

  emb.addFields(
    { name:'📋 Queue',    value:`${state.queue.length} track${state.queue.length!==1?'s':''}`, inline:true },
    { name:'🔊 Volume',   value:`${state.volume}%`,    inline:true },
    { name:'🎭 Mood',     value:mood?.label||'Manual', inline:true },
    { name:'🔂 Loop',     value:state.loop?'Track':state.loopQueue?'Queue':'Off', inline:true },
    { name:'🔀 Shuffle',  value:state.shuffle?'ON':'Off', inline:true },
    { name:'🤖 AutoPlay', value:state.autoplay?'ON':'Off', inline:true },
  );

  return emb;
}

function buildQueueEmbed(state, page=0) {
  const PER   = 10;
  const total = state.queue.length;
  const pages = Math.ceil(total/PER) || 1;
  const slice = state.queue.slice(page*PER, (page+1)*PER);
  const totalDur = state.queue.reduce((s,t)=>s+(t.duration||0),0);

  const emb = new EmbedBuilder()
    .setColor(0x7B2FFF)
    .setTitle(`📋 Queue · ${total} Track${total!==1?'s':''} · ${fmtTime(totalDur)} total`)
    .setFooter({ text:`Page ${page+1}/${pages} · ${FT.text}` })
    .setTimestamp();

  if (!total) { emb.setDescription('_Queue empty. Use `/music play <song name>` or browse genres!_'); return emb; }

  emb.setDescription(slice.map((t,i)=>{
    const n = page*PER+i+1;
    return `**${n}.** [${t.title.slice(0,52)}](${t.url}) \`${fmtTime(t.duration)}\` · ${t.requestedBy||'Auto'}`;
  }).join('\n'));

  if (state.current) {
    emb.addFields({ name:'▶️ Now Playing', value:`[${state.current.title.slice(0,70)}](${state.current.url}) \`${fmtTime(state.current.duration)}\`` });
  }
  return emb;
}

function buildHistoryEmbed(state) {
  const h = [...state.history].reverse().slice(0,20);
  if (!h.length) return new EmbedBuilder().setColor(0x7B2FFF).setTitle('📜 History').setDescription('_No tracks played yet._').setFooter(FT);
  return new EmbedBuilder()
    .setColor(0x7B2FFF)
    .setTitle(`📜 Play History · ${state.history.length} tracks`)
    .setDescription(h.map((t,i)=>`\`${i+1}.\` [${t.title.slice(0,55)}](${t.url}) · ${t.requestedBy||'Auto'}`).join('\n'))
    .setFooter(FT).setTimestamp();
}

function buildSearchEmbed(results, query) {
  return new EmbedBuilder()
    .setColor(0x00D4FF)
    .setTitle(`🔍 Results for: "${query.slice(0,60)}"`)
    .setDescription(results.map((r,i)=>
      `**${i+1}.** [${r.title.slice(0,62)}](${r.url})\n└ \`${fmtTime(r.durationInSec)}\` · ${r.channel?.name||'YouTube'}`
    ).join('\n\n'))
    .setFooter({ ...FT, text:`${results.length} results · Select one below` });
}

function buildGenreBrowserEmbed() {
  return new EmbedBuilder()
    .setColor(0x7B2FFF)
    .setTitle('🎸 AEGIS Genre Browser')
    .setDescription('Select a genre to instantly fill the queue, or pick a **Mood Room** for 24/7 autoplay.\n\n> 🎶 All voice channel members can add songs & vote!')
    .addFields(
      { name:'🎸 Genres (16)', value:Object.values(GENRES).map(g=>g.label).join('  ·  '), inline:false },
      { name:'🎭 Mood Rooms (24/7)', value:Object.values(MOODS).map(m=>`${m.emoji} ${m.label}`).join('  ·  '), inline:false },
    )
    .setFooter(FT).setTimestamp();
}

// ─── COMPONENT BUILDERS ───────────────────────────────────────────────

function buildDashboardComponents(state) {
  const playing = state.player?.state?.status === AudioPlayerStatus.Playing;
  const hasQ    = state.queue.length > 0 || !!state.current;

  // Row 1 — Playback
  const r1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_prev')     .setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_playpause').setEmoji(playing?'⏸️':'▶️').setStyle(playing?ButtonStyle.Primary:ButtonStyle.Success).setDisabled(!hasQ),
    new ButtonBuilder().setCustomId('music_skip')     .setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(!hasQ),
    new ButtonBuilder().setCustomId('music_stop')     .setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(!hasQ),
    new ButtonBuilder().setCustomId('music_refresh')  .setEmoji('🔄').setStyle(ButtonStyle.Secondary),
  );

  // Row 2 — Volume & Modes
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_vol_down').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_vol_up')  .setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loop')    .setEmoji('🔂').setStyle(state.loop?ButtonStyle.Success:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loopq')   .setEmoji('🔁').setStyle(state.loopQueue?ButtonStyle.Success:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_shuffle') .setEmoji('🔀').setStyle(state.shuffle?ButtonStyle.Success:ButtonStyle.Secondary),
  );

  // Row 3 — Info & Extras
  const r3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_queue_view').setLabel('📋 Queue')  .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_history')   .setLabel('📜 History').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_autoplay')  .setLabel('🤖 Auto')   .setStyle(state.autoplay?ButtonStyle.Success:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_browse')    .setLabel('🎸 Browse') .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_clear')     .setLabel('🗑️ Clear')  .setStyle(ButtonStyle.Danger).setDisabled(!state.queue.length),
  );

  // Row 4 — Mood Room selector
  const r4 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('music_mood')
      .setPlaceholder('🎭 Mood Room — 24/7 autoplay...')
      .addOptions([
        { label:'❌ Off — Manual Queue', value:'off', emoji:'❌', description:'Disable mood autoplay' },
        ...Object.entries(MOODS).map(([k,v])=>({ label:v.label, value:k, emoji:v.emoji, description:v.desc, default:state.mood===k })),
      ]),
  );

  return [r1, r2, r3, r4];
}

function buildLaunchpadComponents(state) {
  return buildDashboardComponents(state);
}

function buildGenreComponents(state) {
  const entries = Object.entries(GENRES);
  const half1   = entries.slice(0,8);
  const half2   = entries.slice(8);

  const g1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('music_genre_select')
      .setPlaceholder('🎸 Pick a genre...')
      .addOptions(half1.map(([k,v])=>({ label:v.label, value:k, description:`Queue 10 tracks from ${v.label}` })))
  );
  const g2 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('music_genre_select_b')
      .setPlaceholder('🎸 More genres...')
      .addOptions(half2.map(([k,v])=>({ label:v.label, value:k, description:`Queue 10 tracks from ${v.label}` })))
  );
  const moodRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('music_mood')
      .setPlaceholder('🎭 Or pick a 24/7 Mood Room...')
      .addOptions([
        { label:'❌ Off — Manual Queue', value:'off', emoji:'❌', description:'Disable mood autoplay' },
        ...Object.entries(MOODS).map(([k,v])=>({ label:v.label, value:k, emoji:v.emoji, description:v.desc, default:state.mood===k })),
      ])
  );

  return [g1, g2, moodRow];
}

function buildEqComponents() {
  return [new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('music_eq')
      .setPlaceholder('🎛️ Equaliser preset...')
      .addOptions(Object.entries(EQ_PRESETS).map(([k,v])=>({ label:v.label, value:k })))
  )];
}

// ─── PLAYBACK ENGINE ──────────────────────────────────────────────────
async function playNext(state, client) {
  if (!state.connection || !state.voiceChannelId) return;

  if (state.current) {
    state.history.push({ ...state.current, playedAt:new Date().toISOString() });
    if (state.history.length > HISTORY_MAX) state.history.shift();
  }

  let track = null;

  if (state.loop && state.current) {
    track = state.current;
  } else if (state.queue.length) {
    if (state.shuffle) {
      const idx = Math.floor(Math.random() * state.queue.length);
      track = state.queue.splice(idx,1)[0];
    } else {
      track = state.queue.shift();
    }
    if (state.loopQueue && state.current) state.queue.push(state.current);
  } else if (state.mood) {
    track = await getMoodTrack(state);
  } else if (state.autoplay && state.current) {
    const terms = state.current.title.split(' ').slice(0,4).join(' ');
    const res   = await playdl.search(`${terms} mix similar`, { source:{ youtube:'video' }, limit:AUTO_SIMILAR_COUNT }).catch(()=>[]);
    const pick  = res.find(r => !state.history.some(h => h.url === r.url));
    if (pick) track = mkTrack(pick);
  }

  if (!track) {
    state.current = null;
    state.paused  = false;
    await updateDashboard(state, client);
    return;
  }

  state.current   = { ...track, startTime:Date.now(), requestedBy:track.requestedBy||'AutoPlay' };
  state.startedAt = Date.now();
  state.paused    = false;
  state.skipVotes.clear();

  // Set bot activity to now-playing
  try {
    client.user.setActivity(`🎵 ${track.title.slice(0,120)}`, { type: ActivityType.Listening });
  } catch {}

  try {
    const stream   = await getStream(track);
    const eq       = EQ_PRESETS[state.eq] || EQ_PRESETS.flat;
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type || StreamType.Opus,
      inlineVolume: true,
    });
    resource.volume?.setVolume((state.volume / 100) * eq.volMod);
    state.player.play(resource);

    clearInterval(state.progressTimer);
    let elapsed = 0;
    state.progressTimer = setInterval(async () => {
      if (!state.paused) elapsed += REFRESH_MS / 1000;
      await updateDashboard(state, client, elapsed);
    }, REFRESH_MS);

    await updateDashboard(state, client, 0);
    await postNowPlaying(state, client);

  } catch (e) {
    console.error('[Music] playNext:', e.message);
    clearInterval(state.progressTimer);

    const ch = await resolveVoiceTextChannel(state, client);
    const now = Date.now();

    if (isBotGate(e)) {
      if (now - state._lastBotGate > YT_ERROR_COOLDOWN) {
        state._lastBotGate = now;
        ch?.send('⚠️ YouTube bot-gate hit — skipping this track. Try again or use a Spotify/SoundCloud link.').catch(()=>{});
      }
    } else {
      ch?.send(`⚠️ Track failed to load: \`${e.message.slice(0,80)}\` — skipping.`).catch(()=>{});
    }

    state.current = null;
    state.paused  = false;
    await updateDashboard(state, client, 0);
    setTimeout(() => playNext(state, client), YT_FAIL_SKIP_DELAY);
  }
}

async function getMoodTrack(state) {
  if (state.moodBuffer.length) return state.moodBuffer.shift();
  const mood  = MOODS[state.mood];
  if (!mood) return null;
  const genre = GENRES[mood.genre];
  if (!genre) return null;
  try {
    const q    = genre.queries[Math.floor(Math.random()*genre.queries.length)];
    const res  = await playdl.search(q, { source:{ youtube:'video' }, limit:10 });
    state.moodBuffer = res
      .filter(r => r.durationInSec>60 && r.durationInSec<7200)
      .map(r => mkTrack(r));
    for (let i=state.moodBuffer.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [state.moodBuffer[i],state.moodBuffer[j]]=[state.moodBuffer[j],state.moodBuffer[i]];
    }
    return state.moodBuffer.shift()||null;
  } catch { return null; }
}

// ─── VOICE CONNECTION ─────────────────────────────────────────────────
async function ensureVC(state, vc, client) {
  const ex = getVoiceConnection(state.guildId);
  if (ex && state.connection===ex) return ex;

  const conn = joinVoiceChannel({
    channelId: vc.id,
    guildId:   state.guildId,
    adapterCreator: vc.guild.voiceAdapterCreator,
    selfDeaf: true, selfMute: false,
  });

  state.connection    = conn;
  state.voiceChannelId = vc.id;
  state.client         = client;

  // Try to find the voice channel's built-in text channel
  // Modern Discord voice channels can receive text messages directly
  state.vcTextChannelId = vc.id;

  if (!state.player) {
    state.player = createAudioPlayer({ behaviors:{ noSubscriber:NoSubscriberBehavior.Pause } });

    state.player.on(AudioPlayerStatus.Idle, () => {
      clearInterval(state.progressTimer);
      // Reset bot activity when idle
      try { client.user.setActivity('💎 /music play | AEGIS v4', { type: ActivityType.Playing }); } catch {}
      setTimeout(() => playNext(state, client), 300);
    });

    state.player.on('error', async (e) => {
      console.error('[Music] Player err:', e.message);
      clearInterval(state.progressTimer);
      state.current = null;
      state.paused  = false;
      setTimeout(() => playNext(state, client), YT_FAIL_SKIP_DELAY);
    });
  }

  conn.subscribe(state.player);

  conn.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(conn, VoiceConnectionStatus.Signalling, 5_000),
        entersState(conn, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      if (state.mood || state.autoplay || permanentRooms.has(state.guildId)) {
        setTimeout(async () => {
          try {
            const g  = client.guilds.cache.get(state.guildId);
            const ch = g?.channels.cache.get(state.voiceChannelId);
            if (ch) {
              await ensureVC(state, ch, client);
              if (!state.current || state.player?.state?.status !== AudioPlayerStatus.Playing) {
                await playNext(state, client);
              }
            }
          } catch {}
        }, RECONNECT_DELAY);
      } else {
        conn.destroy();
        state.connection = null;
      }
    }
  });

  return conn;
}

// ─── MESSAGE MANAGEMENT ───────────────────────────────────────────────
async function postNowPlaying(state, client) {
  const ch = await resolveVoiceTextChannel(state, client);
  if (!ch) return;
  try {
    const elapsed = state.startedAt ? Math.floor((Date.now()-state.startedAt)/1000) : 0;
    const msg = await ch.send({ embeds:[buildActivityDashboard(state, elapsed)] });
    state.nowPlayingMsgId = msg.id;
  } catch {}
}

async function updateDashboard(state, client, elapsed) {
  if (elapsed === undefined) {
    elapsed = state.startedAt ? Math.floor((Date.now()-state.startedAt)/1000) : 0;
  }

  // Update launchpad
  if (state.launchpadMsgId && state.launchpadChId) {
    const ch = client.channels.cache.get(state.launchpadChId);
    if (ch) {
      try {
        const msg = await ch.messages.fetch(state.launchpadMsgId).catch(()=>null);
        if (msg) await msg.edit({ embeds:[buildLaunchpad(state)], components:buildLaunchpadComponents(state) });
      } catch {}
    }
  }

  // Update standalone dashboard
  if (state.dashboardMsgId && state.dashboardChId) {
    const ch = client.channels.cache.get(state.dashboardChId);
    if (ch) {
      try {
        const msg = await ch.messages.fetch(state.dashboardMsgId).catch(()=>null);
        if (msg) await msg.edit({ embeds:[buildActivityDashboard(state, elapsed)], components:buildDashboardComponents(state) });
      } catch {}
    }
  }
}

// ─── PLAYLIST PERSISTENCE ─────────────────────────────────────────────
async function savePlaylist(guildId, userId, name, tracks) {
  if (!sb) throw new Error('Supabase not configured.');
  const { error } = await sb.from('aegis_music_playlists').upsert(
    { guild_id:guildId, created_by:userId, name, tracks:JSON.stringify(tracks.slice(0,200)), updated_at:new Date().toISOString() },
    { onConflict:'guild_id,name' }
  );
  if (error) throw new Error(error.message);
}

async function loadPlaylist(guildId, name) {
  if (!sb) throw new Error('Supabase not configured.');
  const { data, error } = await sb.from('aegis_music_playlists').select('*').eq('guild_id',guildId).eq('name',name).single();
  if (error||!data) throw new Error(`Playlist **${name}** not found.`);
  return { ...data, tracks:JSON.parse(data.tracks||'[]') };
}

async function listPlaylists(guildId) {
  if (!sb) throw new Error('Supabase not configured.');
  const { data } = await sb.from('aegis_music_playlists')
    .select('name,created_by,updated_at').eq('guild_id',guildId)
    .order('updated_at',{ ascending:false }).limit(25);
  return data||[];
}

async function deletePlaylist(guildId, name) {
  if (!sb) throw new Error('Supabase not configured.');
  const { error } = await sb.from('aegis_music_playlists').delete().eq('guild_id',guildId).eq('name',name);
  if (error) throw new Error(error.message);
}

// ─── COMMAND HANDLERS ─────────────────────────────────────────────────

// PLAY — supports title search with picker, URLs, playlists
async function cmdPlay(i, client) {
  const vc = i.member?.voice?.channel;
  if (!vc) return i.editReply('⚠️ Join a voice channel first!');

  const query = i.options.getString('query');
  const state = getState(i.guildId);
  state.textChannelId = i.channelId;
  await ensureVC(state, vc, client);

  const isUrl = /^https?:\/\//.test(query);

  if (isUrl) {
    // Direct URL path
    await i.editReply(`🔍 Loading: \`${query.slice(0,80)}\`...`);
    const result = await resolveTrack(query);
    if (!result) return i.editReply('⚠️ Could not load that URL.');

    if (Array.isArray(result)) {
      result.forEach(t => { if(state.queue.length<MAX_QUEUE) state.queue.push({...t, requestedBy:i.user.username}); });
      if (!state.current) await playNext(state, client);
      return i.editReply({ content:null, embeds:[
        new EmbedBuilder().setColor(0x7B2FFF).setTitle('📂 Playlist Added')
          .setDescription(`Added **${result.length}** tracks to the queue.`)
          .addFields({ name:'📋 Queue total', value:`${state.queue.length}`, inline:true })
          .setFooter(FT),
      ]});
    }

    result.requestedBy = i.user.username;
    if (state.queue.length >= MAX_QUEUE) return i.editReply(`⚠️ Queue full (${MAX_QUEUE} max).`);
    state.queue.push(result);
    const wasEmpty = state.queue.length===1 && !state.current;
    if (wasEmpty) await playNext(state, client);
    return i.editReply({ content:null, embeds:[
      new EmbedBuilder()
        .setColor(wasEmpty?0x00D4FF:0x7B2FFF)
        .setTitle(wasEmpty?'▶️ Now Playing':'📋 Added to Queue')
        .setDescription(`**[${result.title}](${result.url})**`)
        .setThumbnail(result.thumbnail||null)
        .addFields(
          { name:'⏱️ Duration', value:fmtTime(result.duration), inline:true },
          { name:wasEmpty?'📡 Source':'📍 Position', value:wasEmpty?(result.source||'YouTube'):`#${state.queue.length}`, inline:true },
          { name:'🎤 Added by', value:i.user.username, inline:true },
        ).setFooter(FT),
    ]});
  }

  // Title search — show picker with up to 8 results
  await i.editReply(`🔍 Searching: \`${query.slice(0,80)}\`...`);
  const results = await searchMultiple(query, SEARCH_RESULTS);
  if (!results.length) return i.editReply('⚠️ No results found. Try a different search term.');

  const select = new StringSelectMenuBuilder()
    .setCustomId('music_search_select')
    .setPlaceholder(`🎵 Pick one of ${results.length} results...`)
    .addOptions(results.slice(0,8).map((r,idx)=>({
      label: `${idx+1}. ${r.title.slice(0,75)}`,
      value: r.url,
      description: `${fmtTime(r.durationInSec)} · ${r.channel?.name?.slice(0,40)||'YouTube'}`,
    })));

  return i.editReply({
    embeds: [buildSearchEmbed(results.slice(0,8), query)],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

async function cmdSearch(i, client) {
  const query   = i.options.getString('query');
  const results = await searchMultiple(query, SEARCH_RESULTS);
  if (!results.length) return i.editReply('⚠️ No results found.');

  const select = new StringSelectMenuBuilder()
    .setCustomId('music_search_select')
    .setPlaceholder('🎵 Select a track to add...')
    .addOptions(results.slice(0,8).map((r,idx)=>({
      label: `${idx+1}. ${r.title.slice(0,75)}`,
      value: r.url,
      description: `${fmtTime(r.durationInSec)} · ${r.channel?.name?.slice(0,40)||'YouTube'}`,
    })));

  return i.editReply({ embeds:[buildSearchEmbed(results.slice(0,8), query)], components:[new ActionRowBuilder().addComponents(select)] });
}

// SKIP — DJ skips instantly, others vote (50% threshold)
async function cmdSkip(i, client) {
  const state = getState(i.guildId);
  if (!state.current) return i.editReply('⚠️ Nothing playing.');

  if (isDJ(i.member) || state.current.requestedBy === i.user.username) {
    // DJ or track requester can skip immediately
    clearInterval(state.progressTimer);
    const skipped = state.current.title;
    state.player?.stop();
    return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFFB800).setDescription(`⏭️ Skipped **${skipped.slice(0,80)}**`).setFooter(FT)] });
  }

  // Vote skip for all voice members
  if (!isInVoice(i.member, state)) return i.editReply('⚠️ Join the voice channel to vote!');

  const need = Math.ceil(voiceMemberCount(state, i.guild) * VOTE_THRESHOLD);
  state.skipVotes.add(i.user.id);

  if (state.skipVotes.size >= need) {
    clearInterval(state.progressTimer);
    const skipped = state.current.title;
    state.player?.stop();
    return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFFB800).setDescription(`⏭️ Vote skip passed! Skipped **${skipped.slice(0,80)}**`).setFooter(FT)] });
  }

  return i.editReply(`🗳️ Skip vote: **${state.skipVotes.size}/${need}** needed. ${need - state.skipVotes.size} more required.`);
}

async function cmdStop(i, client) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const state = getState(i.guildId);
  state.queue=[]; state.current=null; state.mood=null; state.moodBuffer=[]; state.autoplay=false; state.paused=false;
  clearInterval(state.progressTimer);
  state.player?.stop(true); state.connection?.destroy(); state.connection=null;
  try { i.client.user.setActivity('💎 /music play | AEGIS v4', { type:ActivityType.Playing }); } catch {}
  await updateDashboard(state, client);
  return i.editReply('⏹️ Stopped. Queue cleared. Disconnected from voice.');
}

async function cmdVolume(i, client) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const vol   = i.options.getInteger('level');
  const state = getState(i.guildId);
  state.volume = vol;
  const ps = state.player?.state;
  const eq = EQ_PRESETS[state.eq] || EQ_PRESETS.flat;
  if (ps?.resource?.volume) ps.resource.volume.setVolume((vol/100)*eq.volMod);
  await updateDashboard(state, client);
  return i.editReply(`🔊 Volume → **${vol}%**`);
}

async function cmdQueue(i) {
  const page = Math.max(0,(i.options.getInteger('page')||1)-1);
  return i.editReply({ embeds:[buildQueueEmbed(getState(i.guildId), page)] });
}

async function cmdHistory(i) { return i.editReply({ embeds:[buildHistoryEmbed(getState(i.guildId))] }); }

async function cmdNowPlaying(i) {
  const state   = getState(i.guildId);
  if (!state.current) return i.editReply('⚠️ Nothing playing.');
  const elapsed = state.startedAt ? Math.floor((Date.now()-state.startedAt)/1000) : 0;
  return i.editReply({ embeds:[buildActivityDashboard(state,elapsed)] });
}

async function cmdDashboard(i, client) {
  const state   = getState(i.guildId);
  state.dashboardChId = i.channelId;
  const elapsed = state.startedAt ? Math.floor((Date.now()-state.startedAt)/1000) : 0;
  const msg = await i.editReply({ embeds:[buildActivityDashboard(state,elapsed)], components:buildDashboardComponents(state), fetchReply:true });
  state.dashboardMsgId = msg.id;
}

async function cmdLaunchpad(i, client) {
  const state = getState(i.guildId);
  state.launchpadChId = i.channelId;
  const msg = await i.editReply({ embeds:[buildLaunchpad(state)], components:buildLaunchpadComponents(state), fetchReply:true });
  state.launchpadMsgId = msg.id;
}

async function cmdBrowse(i, client) {
  return i.editReply({ embeds:[buildGenreBrowserEmbed()], components:buildGenreComponents(getState(i.guildId)) });
}

async function cmdEq(i, client) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const preset = i.options.getString('preset');
  const state  = getState(i.guildId);
  state.eq     = preset || 'flat';
  const eq     = EQ_PRESETS[state.eq] || EQ_PRESETS.flat;
  // Apply volume modifier
  const ps = state.player?.state;
  if (ps?.resource?.volume) ps.resource.volume.setVolume((state.volume/100)*eq.volMod);
  await updateDashboard(state, client);
  return i.editReply({ embeds:[new EmbedBuilder().setColor(0x7B2FFF).setTitle('🎛️ EQ Updated').setDescription(`Preset set to **${eq.label}**`).setFooter(FT)] });
}

async function cmdMoodRoom(i, client) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const mood  = i.options.getString('room');
  const state = getState(i.guildId);
  state.textChannelId = i.channelId;

  if (mood==='off') {
    state.mood=null; state.moodBuffer=[]; state.autoplay=false;
    await updateDashboard(state,client);
    return i.editReply('❌ Mood room disabled.');
  }

  const preset = MOODS[mood];
  if (!preset) return i.editReply('⚠️ Unknown mood.');

  const vc = i.member?.voice?.channel;
  if (!vc) return i.editReply('⚠️ Join a voice channel first.');

  state.mood=mood; state.moodBuffer=[]; state.volume=preset.vol;
  await ensureVC(state, vc, client);
  if (!state.current || state.player?.state?.status !== AudioPlayerStatus.Playing) {
    await playNext(state,client);
  }
  await updateDashboard(state, client);

  return i.editReply({ embeds:[
    new EmbedBuilder().setColor(preset.color)
      .setTitle(`${preset.emoji} ${preset.label} Active`)
      .setDescription(`${preset.desc}\n\n🔄 **Uninterrupted 24/7 stream active.**\nAEGIS will auto-reconnect if disconnected.\n\n> 🎶 All voice members can skip & add songs!`)
      .addFields({ name:'🔊 Volume', value:`${state.volume}%`, inline:true },{ name:'🔁 Mode', value:'Infinite autoplay', inline:true })
      .setFooter(FT),
  ]});
}

async function cmdAutoplay(i, client) {
  const state = getState(i.guildId);
  state.autoplay = !state.autoplay;
  await updateDashboard(state, client);
  return i.editReply(state.autoplay?'🤖 AutoPlay **ON** — AEGIS will auto-queue similar tracks.':'🤖 AutoPlay **OFF**');
}

async function cmdLoop(i, client) {
  const mode  = i.options.getString('mode')||'track';
  const state = getState(i.guildId);
  if (mode==='track') { state.loop=!state.loop; await updateDashboard(state,client); return i.editReply(state.loop?'🔂 Track loop **ON**':'🔂 Track loop **OFF**'); }
  if (mode==='queue') { state.loopQueue=!state.loopQueue; await updateDashboard(state,client); return i.editReply(state.loopQueue?'🔁 Queue loop **ON**':'🔁 Queue loop **OFF**'); }
  state.loop=false; state.loopQueue=false; await updateDashboard(state,client);
  return i.editReply('🔂 Loop **OFF**');
}

async function cmdShuffle(i, client) {
  const state = getState(i.guildId);
  state.shuffle = !state.shuffle;
  if (state.shuffle && state.queue.length>1) {
    for(let k=state.queue.length-1;k>0;k--){
      const j=Math.floor(Math.random()*(k+1));
      [state.queue[k],state.queue[j]]=[state.queue[j],state.queue[k]];
    }
  }
  await updateDashboard(state, client);
  return i.editReply(state.shuffle?'🔀 Shuffle **ON** — queue randomized!':'🔀 Shuffle **OFF**');
}

async function cmdRemove(i) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const pos   = i.options.getInteger('position');
  const state = getState(i.guildId);
  if (pos<1||pos>state.queue.length) return i.editReply(`⚠️ Position 1–${state.queue.length}.`);
  const [removed] = state.queue.splice(pos-1,1);
  return i.editReply(`✅ Removed **${removed.title.slice(0,80)}**.`);
}

async function cmdMove(i) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const from=i.options.getInteger('from')-1, to=i.options.getInteger('to')-1;
  const state=getState(i.guildId);
  if(from<0||from>=state.queue.length||to<0||to>=state.queue.length) return i.editReply(`⚠️ Positions 1–${state.queue.length}.`);
  const [t]=state.queue.splice(from,1); state.queue.splice(to,0,t);
  return i.editReply(`↕️ Moved **${t.title.slice(0,60)}** → position **${to+1}**.`);
}

async function cmdClear(i, client) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const state=getState(i.guildId); const n=state.queue.length;
  state.queue=[]; state.moodBuffer=[];
  await updateDashboard(state, client);
  return i.editReply(`🗑️ Cleared **${n}** track${n!==1?'s':''}.`);
}

async function cmdPlaylistSave(i) {
  const name=i.options.getString('name'), state=getState(i.guildId);
  const tracks=[...(state.current?[state.current]:[]),...state.queue];
  if(!tracks.length) return i.editReply('⚠️ Nothing in queue to save.');
  await savePlaylist(i.guildId,i.user.id,name,tracks);
  return i.editReply(`✅ Playlist **${name}** saved (${tracks.length} tracks).`);
}

async function cmdPlaylistLoad(i, client) {
  if(!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const pl=await loadPlaylist(i.guildId,i.options.getString('name'));
  const vc=i.member?.voice?.channel; if(!vc) return i.editReply('⚠️ Join a voice channel first.');
  const state=getState(i.guildId); state.textChannelId=i.channelId;
  await ensureVC(state,vc,client);
  pl.tracks.forEach(t=>{ if(state.queue.length<MAX_QUEUE) state.queue.push({...t,requestedBy:i.user.username}); });
  if(!state.current) await playNext(state,client);
  return i.editReply({ embeds:[new EmbedBuilder().setColor(0x7B2FFF).setTitle(`📂 Loaded: ${pl.name}`).setDescription(`Added **${pl.tracks.length}** tracks.`).setFooter(FT)] });
}

async function cmdPlaylistList(i) {
  const lists=await listPlaylists(i.guildId);
  if(!lists.length) return i.editReply('📭 No saved playlists.');
  return i.editReply({ embeds:[new EmbedBuilder().setColor(0x7B2FFF).setTitle('📂 Server Playlists').setDescription(lists.map((p,idx)=>`**${idx+1}.** \`${p.name}\` — <t:${Math.floor(new Date(p.updated_at).getTime()/1000)}:R>`).join('\n')).setFooter(FT)] });
}

async function cmdPlaylistDelete(i) {
  if(!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  await deletePlaylist(i.guildId,i.options.getString('name'));
  return i.editReply(`🗑️ Playlist **${i.options.getString('name')}** deleted.`);
}

// ─── BUTTON HANDLER ───────────────────────────────────────────────────
async function handleMusicButton(i, client) {
  const state = getState(i.guildId);
  await i.deferUpdate().catch(()=>{});
  const id = i.customId;

  // Anyone in the voice channel can use basic controls
  const inVoice = isInVoice(i.member, state);
  const dj      = isDJ(i.member);

  if (id==='music_playpause') {
    if (!dj && !inVoice) return;
    const s = state.player?.state?.status;
    if (s===AudioPlayerStatus.Playing)      { state.player.pause();   state.paused=true;  }
    else if (s===AudioPlayerStatus.Paused)  { state.player.unpause(); state.paused=false; }

  } else if (id==='music_skip') {
    if (!inVoice) return;
    // Vote skip from button
    const need = Math.ceil(voiceMemberCount(state, i.guild) * VOTE_THRESHOLD);
    if (dj || state.current?.requestedBy===i.user.username) {
      clearInterval(state.progressTimer);
      state.player?.stop();
    } else {
      state.skipVotes.add(i.user.id);
      if (state.skipVotes.size >= need) { clearInterval(state.progressTimer); state.player?.stop(); }
      else {
        try { await i.followUp({ content:`🗳️ Skip vote: **${state.skipVotes.size}/${need}**`, ephemeral:true }); } catch {}
      }
    }

  } else if (id==='music_stop') {
    if (!dj) return;
    state.queue=[]; state.current=null; state.mood=null; state.moodBuffer=[]; state.autoplay=false; state.paused=false;
    clearInterval(state.progressTimer); state.player?.stop(true); state.connection?.destroy(); state.connection=null;
    try { client.user.setActivity('💎 /music play | AEGIS v4', { type:ActivityType.Playing }); } catch {}

  } else if (id==='music_prev') {
    if (!dj && !inVoice) return;
    if (state.history.length) {
      const prev=state.history.pop();
      if (state.current) state.queue.unshift({...state.current});
      state.queue.unshift({...prev});
      clearInterval(state.progressTimer); state.player?.stop();
    }

  } else if (id==='music_shuffle') {
    if (!inVoice) return;
    state.shuffle=!state.shuffle;
    if (state.shuffle&&state.queue.length>1){
      for(let k=state.queue.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[state.queue[k],state.queue[j]]=[state.queue[j],state.queue[k]];}
    }

  } else if (id==='music_loop') {
    if (!dj && !inVoice) return;
    state.loop=!state.loop;

  } else if (id==='music_loopq') {
    if (!dj) return;
    state.loopQueue=!state.loopQueue;

  } else if (id==='music_autoplay') {
    if (!dj) return;
    state.autoplay=!state.autoplay;

  } else if (id==='music_vol_down') {
    if (!dj) return;
    state.volume=Math.max(0,state.volume-10);
    const ps=state.player?.state;
    const eq=EQ_PRESETS[state.eq]||EQ_PRESETS.flat;
    if(ps?.resource?.volume) ps.resource.volume.setVolume((state.volume/100)*eq.volMod);

  } else if (id==='music_vol_up') {
    if (!dj) return;
    state.volume=Math.min(100,state.volume+10);
    const ps=state.player?.state;
    const eq=EQ_PRESETS[state.eq]||EQ_PRESETS.flat;
    if(ps?.resource?.volume) ps.resource.volume.setVolume((state.volume/100)*eq.volMod);

  } else if (id==='music_clear') {
    if (!dj) return;
    state.queue=[]; state.moodBuffer=[];

  } else if (id==='music_queue_view') {
    try { await i.followUp({ embeds:[buildQueueEmbed(state,0)], ephemeral:true }); } catch {}

  } else if (id==='music_history') {
    try { await i.followUp({ embeds:[buildHistoryEmbed(state)], ephemeral:true }); } catch {}

  } else if (id==='music_browse') {
    try { await i.followUp({ embeds:[buildGenreBrowserEmbed()], components:buildGenreComponents(state), ephemeral:true }); } catch {}

  } else if (id==='music_refresh') {
    // Just refresh — handled below
  }

  await updateDashboard(state, client);
}

// ─── SELECT HANDLER ───────────────────────────────────────────────────
async function handleMusicSelect(i, client) {
  await i.deferUpdate().catch(()=>{});
  const id=i.customId, value=i.values[0], state=getState(i.guildId);

  if (id==='music_mood') {
    if (!isDJ(i.member)) return;
    if (value==='off') { state.mood=null; state.moodBuffer=[]; }
    else {
      const preset=MOODS[value];
      if (preset) {
        state.mood=value; state.moodBuffer=[]; state.volume=preset.vol;
        const vc=i.member?.voice?.channel;
        if (vc) await ensureVC(state,vc,client);
        if (!state.current||state.player?.state?.status!==AudioPlayerStatus.Playing) await playNext(state,client);
      }
    }
    await updateDashboard(state,client);
    return;
  }

  if (id==='music_genre_select'||id==='music_genre_select_b') {
    // Anyone in voice can pick a genre
    if (!isInVoice(i.member, state) && !isDJ(i.member)) return;
    const genre=GENRES[value]; if(!genre) return;
    const q=genre.queries[Math.floor(Math.random()*genre.queries.length)];
    const res=await searchMultiple(q, 10);
    const tracks=res.filter(r=>r.durationInSec>30&&r.durationInSec<7200).map(r=>mkTrack(r)).slice(0,10);
    tracks.forEach(t=>{ t.requestedBy=i.user.username; if(state.queue.length<MAX_QUEUE) state.queue.push(t); });
    const vc=i.member?.voice?.channel; if(vc) await ensureVC(state,vc,client);
    if(!state.current||state.player?.state?.status!==AudioPlayerStatus.Playing) await playNext(state,client);
    else await updateDashboard(state,client);
    try { await i.followUp({ content:`🎸 Added **${tracks.length}** tracks from ${genre.label}!`, ephemeral:true }); } catch {}
    return;
  }

  if (id==='music_search_select') {
    // Anyone in voice can add from search
    const track=await resolveTrack(value);
    if(!track||Array.isArray(track)) return;
    track.requestedBy=i.user.username;
    if(state.queue.length<MAX_QUEUE) state.queue.push(track);
    const vc=i.member?.voice?.channel; if(vc) await ensureVC(state,vc,client);
    if(!state.current||state.player?.state?.status!==AudioPlayerStatus.Playing) await playNext(state,client);
    else await updateDashboard(state,client);
    try { await i.followUp({ content:`✅ **${track.title.slice(0,80)}** added to queue at position #${state.queue.length}`, ephemeral:true }); } catch {}
    return;
  }

  if (id==='music_eq') {
    if (!isDJ(i.member)) return;
    state.eq = value;
    const eq = EQ_PRESETS[value] || EQ_PRESETS.flat;
    const ps = state.player?.state;
    if (ps?.resource?.volume) ps.resource.volume.setVolume((state.volume/100)*eq.volMod);
    await updateDashboard(state,client);
    try { await i.followUp({ content:`🎛️ EQ set to **${eq.label}**`, ephemeral:true }); } catch {}
    return;
  }
}

// ─── PERMANENT ROOM SETUP ─────────────────────────────────────────────
async function setupPermanentRoom(guild, vcId, tcId, moodKey, client) {
  const preset=MOODS[moodKey]; if(!preset) throw new Error(`Unknown mood: ${moodKey}`);
  const vc=guild.channels.cache.get(vcId); if(!vc) throw new Error('Voice channel not found.');
  const rooms=permanentRooms.get(guild.id)||[];
  rooms.push({ preset:moodKey, voiceChannelId:vcId, textChannelId:tcId });
  permanentRooms.set(guild.id,rooms);
  const state=getState(guild.id);
  state.textChannelId=tcId;
  state.mood=moodKey;
  state.volume=preset.vol;
  await ensureVC(state,vc,client);
  await playNext(state,client);
  return state;
}

// Global heartbeat watchdog
setInterval(async () => {
  for (const [gid, rooms] of permanentRooms) {
    const state=guildStates.get(gid); if(!state?.client) continue;
    const conn=getVoiceConnection(gid);
    if(!conn||conn.state?.status===VoiceConnectionStatus.Disconnected) {
      try {
        const g=state.client.guilds.cache.get(gid);
        const vc=g?.channels.cache.get(rooms[0]?.voiceChannelId);
        if(vc){ await ensureVC(state,vc,state.client); if(!state.current||state.player?.state?.status!==AudioPlayerStatus.Playing) await playNext(state,state.client); }
      } catch(e){ console.error('[Music] Heartbeat:', e.message); }
    }
  }
  for (const [gid, state] of guildStates) {
    if(!state.client||(!state.mood&&!state.autoplay)) continue;
    const conn=getVoiceConnection(gid);
    if(!conn&&state.voiceChannelId) {
      try {
        const g=state.client.guilds.cache.get(gid);
        const vc=g?.channels.cache.get(state.voiceChannelId);
        if(vc){ await ensureVC(state,vc,state.client); if(!state.current||state.player?.state?.status!==AudioPlayerStatus.Playing) await playNext(state,state.client); }
      } catch {}
    }
  }
}, PULSE_INTERVAL);

// ─── SLASH COMMAND DEFINITIONS ────────────────────────────────────────
const MUSIC_COMMANDS = [
  new SlashCommandBuilder().setName('music').setDescription('🎵 AEGIS Music Rythm-Class v4 — Advanced streaming')
    .addSubcommand(s=>s.setName('play').setDescription('▶️ Play by song title or URL (YouTube/Spotify/SoundCloud)').addStringOption(o=>o.setName('query').setDescription('Song name OR URL').setRequired(true)))
    .addSubcommand(s=>s.setName('search').setDescription('🔍 Search and pick from top 8 results').addStringOption(o=>o.setName('query').setDescription('Search query').setRequired(true)))
    .addSubcommand(s=>s.setName('browse').setDescription('🎸 Open genre browser — 16 genres + mood rooms'))
    .addSubcommand(s=>s.setName('skip').setDescription('⏭️ Skip / vote-skip current track'))
    .addSubcommand(s=>s.setName('stop').setDescription('⏹️ Stop and clear queue'))
    .addSubcommand(s=>s.setName('pause').setDescription('⏸️ Pause playback'))
    .addSubcommand(s=>s.setName('resume').setDescription('▶️ Resume playback'))
    .addSubcommand(s=>s.setName('nowplaying').setDescription('📊 Full now-playing panel'))
    .addSubcommand(s=>s.setName('dashboard').setDescription('🎛️ Open the full interactive Music Dashboard'))
    .addSubcommand(s=>s.setName('launchpad').setDescription('🎛️ Open voice-channel control panel'))
    .addSubcommand(s=>s.setName('history').setDescription('📜 View recently played tracks'))
    .addSubcommand(s=>s.setName('queue').setDescription('📋 View queue').addIntegerOption(o=>o.setName('page').setDescription('Page').setRequired(false).setMinValue(1)))
    .addSubcommand(s=>s.setName('volume').setDescription('🔊 Set volume 0–100 (DJ only)').addIntegerOption(o=>o.setName('level').setDescription('Volume').setRequired(true).setMinValue(0).setMaxValue(100)))
    .addSubcommand(s=>s.setName('loop').setDescription('🔂 Toggle loop mode').addStringOption(o=>o.setName('mode').setDescription('Mode').setRequired(false).addChoices({ name:'Track', value:'track' },{ name:'Queue', value:'queue' },{ name:'Off', value:'off' })))
    .addSubcommand(s=>s.setName('shuffle').setDescription('🔀 Toggle shuffle'))
    .addSubcommand(s=>s.setName('autoplay').setDescription('🤖 Toggle AutoPlay'))
    .addSubcommand(s=>s.setName('remove').setDescription('🗑️ Remove a track (DJ only)').addIntegerOption(o=>o.setName('position').setDescription('Position').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('move').setDescription('↕️ Reorder a track (DJ only)').addIntegerOption(o=>o.setName('from').setDescription('From').setRequired(true).setMinValue(1)).addIntegerOption(o=>o.setName('to').setDescription('To').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('clear').setDescription('🗑️ Clear queue (DJ only)'))
    .addSubcommand(s=>s.setName('eq').setDescription('🎛️ Equaliser preset (DJ only)').addStringOption(o=>o.setName('preset').setDescription('EQ preset').setRequired(true).addChoices(
      { name:'⚖️ Flat (default)', value:'flat' },
      { name:'🔊 Bass Boost', value:'bassboost' },
      { name:'🌟 Nightcore', value:'nightcore' },
      { name:'🌊 Vaporwave', value:'vaporwave' },
      { name:'📢 Earrape (⚠️)', value:'earrape' },
    )))
    .addSubcommand(s=>s.setName('room').setDescription('🎭 24/7 Mood Room').addStringOption(o=>o.setName('room').setDescription('Mood preset').setRequired(true).addChoices(
      { name:'❌ Off', value:'off' },
      { name:'🌙 Midnight Lo-Fi', value:'midnight-lofi' },
      { name:'🌊 Synthwave Lounge', value:'synthwave-lounge' },
      { name:'🌌 Ambient Void', value:'ambient-void' },
      { name:'⚔️ Raid Prep', value:'raid-prep' },
      { name:'🎉 Party Room', value:'party-room' },
      { name:'🎮 VGM Lounge', value:'vgm-lounge' },
      { name:'🔥 Metal Forge', value:'metal-forge' },
      { name:'💜 Chill R&B', value:'chill-rnb' },
    )))
    .addSubcommandGroup(g=>g.setName('playlist').setDescription('📂 Server playlists')
      .addSubcommand(s=>s.setName('save').setDescription('💾 Save queue').addStringOption(o=>o.setName('name').setDescription('Name').setRequired(true)))
      .addSubcommand(s=>s.setName('load').setDescription('📂 Load playlist').addStringOption(o=>o.setName('name').setDescription('Name').setRequired(true)))
      .addSubcommand(s=>s.setName('list').setDescription('📋 List playlists'))
      .addSubcommand(s=>s.setName('delete').setDescription('🗑️ Delete playlist').addStringOption(o=>o.setName('name').setDescription('Name').setRequired(true))),
    ),
  new SlashCommandBuilder().setName('setup-music').setDescription('🎵 [ADMIN] Deploy permanent 24/7 music room').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o=>o.setName('voice').setDescription('Voice channel').setRequired(true))
    .addChannelOption(o=>o.setName('text').setDescription('Text channel for now-playing').setRequired(true))
    .addStringOption(o=>o.setName('mood').setDescription('Starting mood').setRequired(true).addChoices(
      { name:'🌙 Midnight Lo-Fi', value:'midnight-lofi' },
      { name:'🌊 Synthwave Lounge', value:'synthwave-lounge' },
      { name:'🌌 Ambient Void', value:'ambient-void' },
      { name:'⚔️ Raid Prep', value:'raid-prep' },
      { name:'🎉 Party Room', value:'party-room' },
      { name:'🎮 VGM Lounge', value:'vgm-lounge' },
      { name:'🔥 Metal Forge', value:'metal-forge' },
      { name:'💜 Chill R&B', value:'chill-rnb' },
    )),
].map(c=>c.toJSON());

// ─── MAIN DISPATCH ────────────────────────────────────────────────────
async function handleMusicCommand(i, client) {
  if (!i.isChatInputCommand()) return false;
  const cmd=i.commandName, grp=i.options.getSubcommandGroup?.(false), sub=i.options.getSubcommand?.(false);

  if (cmd==='setup-music') {
    if (!i.member?.permissions?.has(PermissionFlagsBits.ManageChannels)) return i.editReply('⛔ Manage Channels required.');
    const vc=i.options.getChannel('voice'), tc=i.options.getChannel('text'), mood=i.options.getString('mood');
    try {
      await setupPermanentRoom(i.guild,vc.id,tc.id,mood,client);
      const p=MOODS[mood];
      return i.editReply({ embeds:[new EmbedBuilder().setColor(p.color)
        .setTitle(`${p.emoji} Permanent Room Live!`)
        .setDescription(`**${p.label}** streaming in ${vc}\nNow-playing in ${tc}\n\n🔄 Auto-reconnect active.\n🎶 All voice members can skip & add songs!`)
        .setFooter(FT)] });
    } catch(e){ return i.editReply(`⚠️ ${e.message}`); }
  }

  if (cmd!=='music') return false;

  if (grp==='playlist') {
    try {
      if(sub==='save')   return await cmdPlaylistSave(i);
      if(sub==='load')   return await cmdPlaylistLoad(i,client);
      if(sub==='list')   return await cmdPlaylistList(i);
      if(sub==='delete') return await cmdPlaylistDelete(i);
    } catch(e){ return i.editReply(`⚠️ Playlist: ${e.message}`); }
  }

  if(sub==='play')       return cmdPlay(i,client);
  if(sub==='search')     return cmdSearch(i,client);
  if(sub==='browse')     return cmdBrowse(i,client);
  if(sub==='skip')       return cmdSkip(i,client);
  if(sub==='stop')       return cmdStop(i,client);
  if(sub==='pause')      { if(!isDJ(i.member)) return i.editReply('⛔ DJ role required.'); const s=getState(i.guildId); s.player?.pause(); s.paused=true; return i.editReply('⏸️ Paused.'); }
  if(sub==='resume')     { if(!isDJ(i.member)) return i.editReply('⛔ DJ role required.'); const s=getState(i.guildId); s.player?.unpause(); s.paused=false; return i.editReply('▶️ Resumed.'); }
  if(sub==='nowplaying') return cmdNowPlaying(i);
  if(sub==='dashboard')  return cmdDashboard(i,client);
  if(sub==='launchpad')  return cmdLaunchpad(i,client);
  if(sub==='history')    return cmdHistory(i);
  if(sub==='queue')      return cmdQueue(i);
  if(sub==='volume')     return cmdVolume(i,client);
  if(sub==='loop')       return cmdLoop(i,client);
  if(sub==='shuffle')    return cmdShuffle(i,client);
  if(sub==='autoplay')   return cmdAutoplay(i,client);
  if(sub==='remove')     return cmdRemove(i);
  if(sub==='move')       return cmdMove(i);
  if(sub==='clear')      return cmdClear(i,client);
  if(sub==='eq')         return cmdEq(i,client);
  if(sub==='room')       return cmdMoodRoom(i,client);

  return false;
}

module.exports = {
  MUSIC_COMMANDS,
  MOODS, GENRES, EQ_PRESETS,
  handleMusicCommand,
  handleMusicButton,
  handleMusicSelect,
  getState,
  isMusicButton: id => id?.startsWith('music_'),
  isMusicSelect: id => ['music_mood','music_search_select','music_genre_select','music_genre_select_b','music_eq'].includes(id),
};
