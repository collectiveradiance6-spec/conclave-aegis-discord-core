// ═══════════════════════════════════════════════════════════════════════
// CONCLAVE AEGIS — MUSIC RUNTIME v2.0 SOVEREIGN EDITION
// ═══════════════════════════════════════════════════════════════════════
// Features:
//   ∙ play-dl — YouTube / Spotify / SoundCloud streaming
//   ∙ Multi-guild persistent queues
//   ∙ Interactive launchpad embed (buttons + select menus)
//   ∙ Progress bar now-playing (auto-edits every 12s)
//   ∙ 5 permanent 24/7 mood rooms with heartbeat auto-reconnect
//   ∙ Playlist CRUD — save/load/delete via Supabase
//   ∙ Search-and-pick UI via StringSelectMenu
//   ∙ DJ role gating (optional MUSIC_DJ_ROLE_ID env)
//   ∙ Per-guild volume, loop, shuffle, skip-vote
//   ∙ Queue paging with navigation buttons
// ═══════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState,
  getVoiceConnection, NoSubscriberBehavior, StreamType,
} = require('@discordjs/voice');
const playdl = require('play-dl');
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, SlashCommandBuilder, PermissionFlagsBits,
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// ─── SUPABASE (optional — for playlist persistence) ───────────────────
const sb = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

// ─── CONSTANTS ────────────────────────────────────────────────────────
const MAX_QUEUE              = 250;
const PROGRESS_BARS          = 20;
const LAUNCHPAD_EDIT_MS      = 12_000;
const ROOM_RECONNECT_DELAY   = parseInt(process.env.ROOM_RECONNECT_DELAY || '5000');
const ROOM_PULSE_INTERVAL    = parseInt(process.env.ROOM_PULSE_INTERVAL  || '30000');
const DJ_ROLE_ID             = process.env.MUSIC_DJ_ROLE_ID || null;
const SKIP_VOTE_THRESHOLD    = 0.5; // 50% of vc members to skip

// ─── MOOD PRESETS ─────────────────────────────────────────────────────
const MOOD_PRESETS = {
  'midnight-lofi':    { label:'🌙 Midnight Lo-fi',    terms:['lofi hip hop beats to relax','chill lofi study beats','midnight lofi mix'],       vol:0.60, color:0x7B2FFF, emoji:'🌙', desc:'Smooth lo-fi for late-night sessions' },
  'synthwave-lounge': { label:'🌊 Synthwave Lounge',   terms:['synthwave chill mix 2024','retrowave ambient drive','outrun synthwave lounge'],  vol:0.70, color:0xFF4CD2, emoji:'🌊', desc:'Retro-futuristic synth vibes' },
  'ambient-void':     { label:'🌌 Ambient Void',       terms:['dark ambient space music','cosmic ambient deep focus','void ambient cinematic'],   vol:0.50, color:0x00D4FF, emoji:'🌌', desc:'Deep space ambient for focus' },
  'raid-prep':        { label:'⚔️ Raid Prep',           terms:['epic battle music gaming','intense boss fight music','epic orchestral combat 2024'], vol:0.85, color:0xFF4500, emoji:'⚔️', desc:'Hype your team for boss runs' },
  'party-room':       { label:'🎉 Party Room',          terms:['best party mix 2024 hype','gaming hype music playlist','upbeat gaming party mix'],  vol:0.80, color:0xFFB800, emoji:'🎉', desc:'Non-stop hype energy' },
};

// ─── GUILD STATE ──────────────────────────────────────────────────────
const guildStates = new Map();
const permanentRooms = new Map();

class GuildMusicState {
  constructor(guildId) {
    this.guildId           = guildId;
    this.queue             = [];
    this.current           = null;
    this.player            = null;
    this.connection        = null;
    this.voiceChannelId    = null;
    this.textChannelId     = null;
    this.launchpadMsgId    = null;
    this.launchpadChId     = null;
    this.nowPlayingMsgId   = null;
    this.volume            = 80;
    this.loop              = false;
    this.loopQueue         = false;
    this.shuffle           = false;
    this.mood              = null;
    this.moodBuffer        = [];
    this.skipVotes         = new Set();
    this.progressTimer     = null;
    this.reconnectTimer    = null;
    this.client            = null;
  }
}

function getState(guildId) {
  if (!guildStates.has(guildId)) guildStates.set(guildId, new GuildMusicState(guildId));
  return guildStates.get(guildId);
}

// ─── HELPERS ──────────────────────────────────────────────────────────
const FT = { text: 'TheConclave Dominion • AEGIS Music v2', iconURL: 'https://theconclavedominion.com/conclave-badge.png' };

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60);
  return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m}:${s.toString().padStart(2,'0')}`;
}

function progressBar(current, total) {
  if (!total) return '──────────────────── 0:00 / 0:00';
  const pct    = Math.min(current/total, 1);
  const filled = Math.round(pct*PROGRESS_BARS);
  return '█'.repeat(filled) + '░'.repeat(PROGRESS_BARS-filled) + ` ${fmtTime(current)} / ${fmtTime(total)}`;
}

function srcIcon(source) {
  if (source?.includes('spotify'))    return '🎵';
  if (source?.includes('soundcloud')) return '☁️';
  return '▶️';
}

function isDJ(member) {
  if (!DJ_ROLE_ID) return true;
  return member?.roles?.cache?.has(DJ_ROLE_ID) || member?.permissions?.has(PermissionFlagsBits.ManageChannels);
}

// ─── TRACK RESOLUTION ─────────────────────────────────────────────────
async function resolveTrack(query) {
  try {
    if (/^https?:\/\//.test(query)) {
      if (query.includes('spotify.com')) {
        const spot = await playdl.spotify(query).catch(() => null);
        if (!spot) return null;
        if (spot.type === 'track') {
          const yt = await playdl.search(`${spot.name} ${spot.artists?.[0]?.name||''}`, { source:{ youtube:'video' }, limit:1 });
          return yt[0] ? mkTrack(yt[0], query, 'spotify') : null;
        }
        if (spot.type === 'playlist' || spot.type === 'album') {
          const tracks = await spot.all_tracks();
          return tracks.slice(0,50).map(t => ({
            title:     `${t.name} — ${t.artists?.[0]?.name||'Unknown'}`,
            url:       t.url,
            duration:  t.durationInSec||0,
            thumbnail: t.thumbnail?.url||null,
            source:    'spotify',
          }));
        }
        return null;
      }
      if (query.includes('soundcloud.com')) {
        const sc = await playdl.soundcloud(query);
        return { title:sc.name, url:query, duration:sc.durationInSec||0, thumbnail:sc.thumbnail||null, source:'soundcloud' };
      }
      // YouTube playlist
      if (query.includes('list=')) {
        const pl = await playdl.playlist_info(query, { incomplete: true }).catch(()=>null);
        if (pl) {
          const vids = await pl.all_videos();
          return vids.slice(0,50).map(v => mkTrack(v, null, 'youtube'));
        }
      }
      // Single YT URL
      const info = await playdl.video_info(query);
      return { title:info.video_details.title, url:query, duration:info.video_details.durationInSec||0, thumbnail:info.video_details.thumbnails?.[0]?.url||null, source:'youtube', ytId:info.video_details.id };
    }
    // Text search
    const results = await playdl.search(query, { source:{ youtube:'video' }, limit:1 });
    return results[0] ? mkTrack(results[0], null, 'youtube') : null;
  } catch (e) {
    console.error('[Music] resolveTrack:', e.message);
    return null;
  }
}

function mkTrack(yt, overrideUrl=null, source='youtube') {
  return { title:yt.title, url:overrideUrl||yt.url, duration:yt.durationInSec||0, thumbnail:yt.thumbnails?.[0]?.url||null, source, ytId:yt.id };
}

async function searchTop5(query) {
  try { return await playdl.search(query, { source:{ youtube:'video' }, limit:5 }); }
  catch { return []; }
}

async function getStream(track) {
  return playdl.stream(track.url, { quality:2, precache:3, discordPlayerCompatibility:true });
}

// ─── EMBEDS ───────────────────────────────────────────────────────────
function buildNowPlayingEmbed(state, elapsed=0) {
  const track  = state.current;
  if (!track) return null;
  const preset = state.mood ? MOOD_PRESETS[state.mood] : null;
  return new EmbedBuilder()
    .setColor(preset?.color ?? 0x00D4FF)
    .setTitle(`${srcIcon(track.source)} Now Playing`)
    .setDescription(`### [${track.title}](${track.url})`)
    .setThumbnail(track.thumbnail||null)
    .addFields(
      { name:'⏱️ Progress',  value:`\`${progressBar(elapsed, track.duration)}\``,                              inline:false },
      { name:'👤 Requested', value:track.requestedBy||'AutoPlay',                                               inline:true  },
      { name:'🔊 Volume',    value:`${state.volume}%`,                                                          inline:true  },
      { name:'🎶 Queue',     value:`${state.queue.length} track${state.queue.length!==1?'s':''}`,                inline:true  },
      ...(state.loop      ? [{ name:'🔂',value:'Track Loop',inline:true }]  : []),
      ...(state.loopQueue ? [{ name:'🔁',value:'Queue Loop',inline:true }]  : []),
      ...(state.shuffle   ? [{ name:'🔀',value:'Shuffle On',inline:true }]  : []),
      ...(state.mood      ? [{ name:preset?.emoji||'🎭',value:preset?.label||state.mood,inline:true }] : []),
    )
    .setFooter(FT).setTimestamp();
}

function buildQueueEmbed(state, page=0) {
  const PER  = 12, start = page*PER, tracks = state.queue.slice(start, start+PER);
  const pages = Math.ceil(state.queue.length/PER)||1;
  const emb = new EmbedBuilder().setColor(0x7B2FFF).setTitle(`📋 Queue — ${state.queue.length} Track${state.queue.length!==1?'s':''}`).setFooter({...FT, text:`Page ${page+1}/${pages} • ${FT.text}`}).setTimestamp();
  if (!state.queue.length) { emb.setDescription('Queue is empty. Use `/music play` to add tracks!'); return emb; }
  emb.setDescription(tracks.map((t,i) => `**${start+i+1}.** [${t.title.slice(0,50)}](${t.url}) — ${fmtTime(t.duration)} · ${t.requestedBy||'Auto'}`).join('\n'));
  if (state.current) emb.addFields({ name:'▶️ Now Playing', value:`[${state.current.title}](${state.current.url})` });
  return emb;
}

function buildLaunchpadEmbed(state) {
  const track  = state.current;
  const preset = state.mood ? MOOD_PRESETS[state.mood] : null;
  const emb    = new EmbedBuilder().setColor(preset?.color??0x7B2FFF).setTitle(`${preset?.emoji??'🎛️'} AEGIS Music Launchpad`).setFooter(FT).setTimestamp();
  if (track) {
    emb.setDescription(`**▶️ ${track.title}**\n${track.requestedBy?`Requested by **${track.requestedBy}**`:'AutoPlay'}`);
    if (track.thumbnail) emb.setThumbnail(track.thumbnail);
  } else if (preset) {
    emb.setDescription(`**${preset.label}**\n${preset.desc}\n\n*Auto-queuing tracks...*`);
  } else {
    emb.setDescription('Use `/music play` or select a Mood Room below to start.');
  }
  emb.addFields(
    { name:'🎶 Queue',  value:`${state.queue.length} track${state.queue.length!==1?'s':''}`, inline:true },
    { name:'🔊 Volume', value:`${state.volume}%`,                                              inline:true },
    { name:'🎭 Mood',   value:preset?.label??'Custom queue',                                   inline:true },
  );
  return emb;
}

function buildLaunchpadComponents(state) {
  const isPlaying = state.player?.state?.status === AudioPlayerStatus.Playing;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_prev')     .setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_playpause').setEmoji(isPlaying?'⏸️':'▶️').setStyle(isPlaying?ButtonStyle.Primary:ButtonStyle.Success).setDisabled(!state.current),
    new ButtonBuilder().setCustomId('music_skip')     .setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(!state.queue.length&&!state.current),
    new ButtonBuilder().setCustomId('music_stop')     .setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(!state.current),
    new ButtonBuilder().setCustomId('music_shuffle')  .setEmoji('🔀').setStyle(state.shuffle?ButtonStyle.Primary:ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_vol_down')  .setEmoji('🔉').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_vol_up')    .setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loop')      .setEmoji('🔂').setStyle(state.loop?ButtonStyle.Primary:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loopq')     .setEmoji('🔁').setStyle(state.loopQueue?ButtonStyle.Primary:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_queue_view').setEmoji('📋').setStyle(ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('music_mood').setPlaceholder('🎭 Switch Mood Room...').addOptions(
      { label:'Off — Custom Queue', value:'off', emoji:'❌', description:'Disable mood room autoplay' },
      ...Object.entries(MOOD_PRESETS).map(([k,v]) => ({ label:v.label, value:k, emoji:v.emoji, description:v.desc, default:state.mood===k })),
    ),
  );

  return [row1, row2, row3];
}

// ─── PLAYBACK ENGINE ──────────────────────────────────────────────────
async function playNext(state, client) {
  if (!state.connection || !state.voiceChannelId) return;

  let track = null;
  if (state.loop && state.current) { track = state.current; }
  else if (state.queue.length) {
    if (state.shuffle) { const idx = Math.floor(Math.random()*state.queue.length); track = state.queue.splice(idx,1)[0]; }
    else { track = state.queue.shift(); }
    if (state.loopQueue && state.current) state.queue.push(state.current);
  } else if (state.mood) {
    track = await getMoodTrack(state);
  }

  if (!track) { state.current = null; await updateLaunchpad(state, client); return; }

  state.current = { ...track, startTime: Date.now(), requestedBy: track.requestedBy||'AutoPlay' };
  state.skipVotes.clear();

  try {
    const stream   = await getStream(track);
    const resource = createAudioResource(stream.stream, { inputType: stream.type||StreamType.Opus, inlineVolume: true });
    resource.volume?.setVolume(state.volume/100);
    state.player.play(resource);

    clearInterval(state.progressTimer);
    let elapsed = 0;
    state.progressTimer = setInterval(async () => {
      elapsed += LAUNCHPAD_EDIT_MS/1000;
      if (state.nowPlayingMsgId && state.textChannelId) await updateNowPlaying(state, client, elapsed);
    }, LAUNCHPAD_EDIT_MS);

    await updateLaunchpad(state, client);
    await postNowPlaying(state, client);

  } catch (e) {
    console.error('[Music] playNext error:', e.message);
    setTimeout(() => playNext(state, client), 500);
  }
}

async function getMoodTrack(state) {
  if (state.moodBuffer.length) return state.moodBuffer.shift();
  const preset = MOOD_PRESETS[state.mood];
  if (!preset) return null;
  try {
    const term    = preset.terms[Math.floor(Math.random()*preset.terms.length)];
    const results = await playdl.search(term, { source:{ youtube:'video' }, limit:6 });
    state.moodBuffer = results.filter(r=>r.durationInSec>60&&r.durationInSec<7200).map(r=>mkTrack(r,null,'youtube'));
    for (let i = state.moodBuffer.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [state.moodBuffer[i],state.moodBuffer[j]] = [state.moodBuffer[j],state.moodBuffer[i]];
    }
    return state.moodBuffer.shift() || null;
  } catch { return null; }
}

// ─── VOICE CONNECTION ─────────────────────────────────────────────────
async function ensureVC(state, vc, client) {
  const existing = getVoiceConnection(state.guildId);
  if (existing && state.connection === existing) return existing;

  const conn = joinVoiceChannel({ channelId:vc.id, guildId:state.guildId, adapterCreator:vc.guild.voiceAdapterCreator, selfDeaf:true });
  state.connection     = conn;
  state.voiceChannelId = vc.id;
  state.client         = client;

  if (!state.player) {
    state.player = createAudioPlayer({ behaviors:{ noSubscriber:NoSubscriberBehavior.Pause } });
    state.player.on(AudioPlayerStatus.Idle, () => { clearInterval(state.progressTimer); setTimeout(()=>playNext(state,client),300); });
    state.player.on('error', e => { console.error('[Music] Player error:', e.message); setTimeout(()=>playNext(state,client),500); });
  }

  conn.subscribe(state.player);

  conn.on(VoiceConnectionStatus.Disconnected, async () => {
    try { await Promise.race([entersState(conn,VoiceConnectionStatus.Signalling,5000), entersState(conn,VoiceConnectionStatus.Connecting,5000)]); }
    catch {
      if (state.mood) {
        state.reconnectTimer = setTimeout(() => {
          const guild = client.guilds.cache.get(state.guildId);
          const ch    = guild?.channels.cache.get(state.voiceChannelId);
          if (ch) ensureVC(state, ch, client);
        }, ROOM_RECONNECT_DELAY);
      } else { conn.destroy(); state.connection = null; }
    }
  });

  return conn;
}

// ─── NOW PLAYING ──────────────────────────────────────────────────────
async function postNowPlaying(state, client) {
  if (!state.textChannelId) return;
  const ch = client.channels.cache.get(state.textChannelId);
  if (!ch) return;
  const emb = buildNowPlayingEmbed(state, 0);
  if (!emb) return;
  try { const msg = await ch.send({ embeds:[emb] }); state.nowPlayingMsgId = msg.id; } catch {}
}

async function updateNowPlaying(state, client, elapsed) {
  if (!state.nowPlayingMsgId || !state.textChannelId) return;
  const ch = client.channels.cache.get(state.textChannelId);
  if (!ch) return;
  try { const msg = await ch.messages.fetch(state.nowPlayingMsgId).catch(()=>null); if (!msg) return; const emb = buildNowPlayingEmbed(state,elapsed); if (emb) await msg.edit({ embeds:[emb] }); } catch {}
}

async function updateLaunchpad(state, client) {
  if (!state.launchpadMsgId || !state.launchpadChId) return;
  const ch = client.channels.cache.get(state.launchpadChId);
  if (!ch) return;
  try { const msg = await ch.messages.fetch(state.launchpadMsgId).catch(()=>null); if (!msg) return; await msg.edit({ embeds:[buildLaunchpadEmbed(state)], components:buildLaunchpadComponents(state) }); } catch {}
}

// ─── PLAYLIST PERSISTENCE ─────────────────────────────────────────────
async function savePlaylist(guildId, userId, name, tracks) {
  if (!sb) throw new Error('Supabase not configured.');
  const { error } = await sb.from('aegis_music_playlists').upsert({
    guild_id: guildId, created_by: userId, name, tracks: JSON.stringify(tracks.slice(0,100)),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'guild_id,name' });
  if (error) throw new Error(error.message);
}

async function loadPlaylist(guildId, name) {
  if (!sb) throw new Error('Supabase not configured.');
  const { data, error } = await sb.from('aegis_music_playlists').select('*').eq('guild_id', guildId).eq('name', name).single();
  if (error || !data) throw new Error(`Playlist **${name}** not found.`);
  return { ...data, tracks: JSON.parse(data.tracks||'[]') };
}

async function listPlaylists(guildId) {
  if (!sb) throw new Error('Supabase not configured.');
  const { data } = await sb.from('aegis_music_playlists').select('name,created_by,updated_at').eq('guild_id', guildId).order('updated_at', { ascending:false }).limit(20);
  return data || [];
}

async function deletePlaylist(guildId, name) {
  if (!sb) throw new Error('Supabase not configured.');
  const { error } = await sb.from('aegis_music_playlists').delete().eq('guild_id', guildId).eq('name', name);
  if (error) throw new Error(error.message);
}

// ─── COMMAND IMPLEMENTATIONS ──────────────────────────────────────────
async function cmdPlay(i, client) {
  if (!isDJ(i.member)) return i.editReply('⛔ You need the DJ role to control music.');
  const query  = i.options.getString('query');
  const member = i.member;
  const vc     = member?.voice?.channel;
  if (!vc) return i.editReply('⚠️ Join a voice channel first.');

  const state = getState(i.guildId);
  state.textChannelId = i.channelId;
  await ensureVC(state, vc, client);

  await i.editReply(`🔍 Searching: \`${query}\`...`);

  const result = await resolveTrack(query);
  if (!result) return i.editReply('⚠️ No results found. Try a different query or URL.');

  if (Array.isArray(result)) {
    // Playlist/album
    const added = result.map(t => ({ ...t, requestedBy: i.user.username }));
    for (const t of added) { if (state.queue.length < MAX_QUEUE) state.queue.push(t); }
    if (!state.current) await playNext(state, client);
    return i.editReply({ content:null, embeds:[new EmbedBuilder().setColor(0x7B2FFF).setTitle('📋 Playlist Added').setDescription(`Added **${added.length} tracks** to queue.`).addFields({name:'🎶 Queue',value:`${state.queue.length} total`,inline:true}).setFooter(FT)] });
  }

  result.requestedBy = i.user.username;
  if (state.queue.length >= MAX_QUEUE) return i.editReply(`⚠️ Queue full (${MAX_QUEUE} max).`);
  state.queue.push(result);

  const wasEmpty = state.queue.length === 1 && !state.current;
  if (wasEmpty) await playNext(state, client);

  return i.editReply({ content:null, embeds:[new EmbedBuilder().setColor(wasEmpty?0x00D4FF:0x7B2FFF)
    .setTitle(wasEmpty?'▶️ Now Playing':'📋 Added to Queue')
    .setDescription(`[${result.title}](${result.url})`)
    .setThumbnail(result.thumbnail||null)
    .addFields({name:'⏱️ Duration',value:fmtTime(result.duration),inline:true},{name:wasEmpty?'🎵 Source':'📍 Position',value:wasEmpty?(result.source||'YouTube'):`#${state.queue.length}`,inline:true})
    .setFooter(FT)] });
}

async function cmdSearch(i, client) {
  const query   = i.options.getString('query');
  const results = await searchTop5(query);
  if (!results.length) return i.editReply('⚠️ No results.');

  const emb = new EmbedBuilder().setColor(0x00D4FF).setTitle(`🔍 Search: "${query}"`)
    .setDescription(results.map((r,idx) => `**${idx+1}.** [${r.title}](${r.url}) — ${fmtTime(r.durationInSec)}`).join('\n')).setFooter(FT);

  const select = new StringSelectMenuBuilder().setCustomId('music_search_select').setPlaceholder('Select a track to play...')
    .addOptions(results.map(r => ({ label:r.title.slice(0,80), value:r.url, description:`${fmtTime(r.durationInSec)} · YouTube` })));

  return i.editReply({ embeds:[emb], components:[new ActionRowBuilder().addComponents(select)] });
}

async function cmdSkip(i, client) {
  const state = getState(i.guildId);
  if (!state.current) return i.editReply('⚠️ Nothing is playing.');

  if (!isDJ(i.member)) {
    // Skip vote
    const vc      = i.guild.channels.cache.get(state.voiceChannelId);
    const members = vc?.members.filter(m=>!m.user.bot).size || 1;
    state.skipVotes.add(i.user.id);
    const needed = Math.ceil(members*SKIP_VOTE_THRESHOLD);
    if (state.skipVotes.size < needed) return i.editReply(`🗳️ Skip vote: **${state.skipVotes.size}/${needed}** votes needed.`);
  }

  const skipped = state.current.title;
  clearInterval(state.progressTimer);
  state.player?.stop();
  return i.editReply({ embeds:[new EmbedBuilder().setColor(0xFFB800).setDescription(`⏭️ Skipped: **${skipped}**`).setFooter(FT)] });
}

async function cmdStop(i, client) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const state = getState(i.guildId);
  state.queue = []; state.current = null; state.mood = null; state.moodBuffer = [];
  clearInterval(state.progressTimer);
  state.player?.stop(true); state.connection?.destroy(); state.connection = null;
  await updateLaunchpad(state, client);
  return i.editReply('⏹️ Stopped. Queue cleared. Disconnected from voice.');
}

async function cmdVolume(i, client) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const vol = i.options.getInteger('level');
  const state = getState(i.guildId);
  state.volume = vol;
  const ps = state.player?.state;
  if (ps?.resource?.volume) ps.resource.volume.setVolume(vol/100);
  await updateLaunchpad(state, client);
  return i.editReply(`🔊 Volume set to **${vol}%**`);
}

async function cmdQueue(i) {
  const page  = Math.max(0,(i.options.getInteger('page')||1)-1);
  const state = getState(i.guildId);
  return i.editReply({ embeds:[buildQueueEmbed(state, page)] });
}

async function cmdLoop(i, client) {
  const mode  = i.options.getString('mode') || 'track';
  const state = getState(i.guildId);
  if (mode==='track')  { state.loop = !state.loop; await updateLaunchpad(state,client); return i.editReply(state.loop?'🔂 Track loop **ON**':'🔂 Track loop **OFF**'); }
  if (mode==='queue')  { state.loopQueue = !state.loopQueue; await updateLaunchpad(state,client); return i.editReply(state.loopQueue?'🔁 Queue loop **ON**':'🔁 Queue loop **OFF**'); }
  state.loop = false; state.loopQueue = false; await updateLaunchpad(state,client);
  return i.editReply('🔂 Loop **OFF**');
}

async function cmdShuffle(i, client) {
  const state = getState(i.guildId);
  state.shuffle = !state.shuffle;
  if (state.shuffle && state.queue.length>1) {
    for (let k=state.queue.length-1; k>0; k--) { const j=Math.floor(Math.random()*(k+1)); [state.queue[k],state.queue[j]]=[state.queue[j],state.queue[k]]; }
  }
  await updateLaunchpad(state, client);
  return i.editReply(state.shuffle?'🔀 Shuffle **ON** — queue randomized!':'🔀 Shuffle **OFF**');
}

async function cmdNowPlaying(i) {
  const state = getState(i.guildId);
  if (!state.current) return i.editReply('⚠️ Nothing is playing.');
  const elapsed = Math.floor((Date.now()-(state.current.startTime||Date.now()))/1000);
  return i.editReply({ embeds:[buildNowPlayingEmbed(state, elapsed)] });
}

async function cmdLaunchpad(i, client) {
  const state = getState(i.guildId);
  state.launchpadChId = i.channelId;
  const msg = await i.editReply({ embeds:[buildLaunchpadEmbed(state)], components:buildLaunchpadComponents(state), fetchReply:true });
  state.launchpadMsgId = msg.id;
}

async function cmdMoodRoom(i, client) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const mood   = i.options.getString('room');
  const vc     = i.member?.voice?.channel;
  const state  = getState(i.guildId);
  state.textChannelId = i.channelId;

  if (mood === 'off') { state.mood = null; state.moodBuffer = []; await updateLaunchpad(state,client); return i.editReply('❌ Mood room disabled.'); }

  const preset = MOOD_PRESETS[mood];
  if (!preset) return i.editReply('⚠️ Unknown mood room.');
  if (!vc) return i.editReply('⚠️ Join a voice channel first.');

  state.mood = mood; state.moodBuffer = []; state.volume = preset.vol*100;
  await ensureVC(state, vc, client);
  if (!state.current || state.player?.state?.status !== AudioPlayerStatus.Playing) await playNext(state, client);
  await updateLaunchpad(state, client);

  return i.editReply({ embeds:[new EmbedBuilder().setColor(preset.color).setTitle(`${preset.emoji} Mood Room Activated`).setDescription(`**${preset.label}**\n${preset.desc}`).addFields({name:'🔊 Volume',value:`${state.volume}%`,inline:true},{name:'🔁 AutoFill',value:'On — endless stream',inline:true}).setFooter(FT)] });
}

async function cmdRemove(i) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const pos = i.options.getInteger('position');
  const state = getState(i.guildId);
  if (pos<1||pos>state.queue.length) return i.editReply(`⚠️ Position must be 1–${state.queue.length}`);
  const removed = state.queue.splice(pos-1,1)[0];
  return i.editReply(`✅ Removed: **${removed.title}**`);
}

async function cmdClearQueue(i) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const state = getState(i.guildId);
  const count = state.queue.length; state.queue = []; state.moodBuffer = [];
  return i.editReply(`🗑️ Cleared **${count}** track${count!==1?'s':''} from the queue.`);
}

async function cmdMove(i) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const from = i.options.getInteger('from')-1, to = i.options.getInteger('to')-1;
  const state = getState(i.guildId);
  if (from<0||from>=state.queue.length||to<0||to>=state.queue.length) return i.editReply(`⚠️ Positions must be 1–${state.queue.length}`);
  const [track] = state.queue.splice(from,1); state.queue.splice(to,0,track);
  return i.editReply(`↕️ Moved **${track.title}** to position **${to+1}**`);
}

async function cmdPlaylistSave(i) {
  const name  = i.options.getString('name');
  const state = getState(i.guildId);
  if (!state.queue.length && !state.current) return i.editReply('⚠️ Nothing in queue to save.');
  const tracks = [...(state.current ? [state.current] : []), ...state.queue];
  await savePlaylist(i.guildId, i.user.id, name, tracks);
  return i.editReply(`✅ Playlist **${name}** saved (${tracks.length} tracks).`);
}

async function cmdPlaylistLoad(i, client) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const name = i.options.getString('name');
  const pl   = await loadPlaylist(i.guildId, name);
  const vc   = i.member?.voice?.channel;
  if (!vc) return i.editReply('⚠️ Join a voice channel first.');
  const state = getState(i.guildId);
  state.textChannelId = i.channelId;
  await ensureVC(state, vc, client);
  for (const t of pl.tracks) { if (state.queue.length < MAX_QUEUE) state.queue.push({ ...t, requestedBy: i.user.username }); }
  if (!state.current) await playNext(state, client);
  return i.editReply({ embeds:[new EmbedBuilder().setColor(0x7B2FFF).setTitle(`📂 Playlist Loaded: ${name}`).setDescription(`Loaded **${pl.tracks.length}** tracks into queue.`).setFooter(FT)] });
}

async function cmdPlaylistList(i) {
  const lists = await listPlaylists(i.guildId);
  if (!lists.length) return i.editReply('📭 No saved playlists for this server.');
  const lines = lists.map((p,idx) => `**${idx+1}.** \`${p.name}\` — <t:${Math.floor(new Date(p.updated_at).getTime()/1000)}:R>`).join('\n');
  return i.editReply({ embeds:[new EmbedBuilder().setColor(0x7B2FFF).setTitle('📂 Server Playlists').setDescription(lines).setFooter(FT)] });
}

async function cmdPlaylistDelete(i) {
  if (!isDJ(i.member)) return i.editReply('⛔ DJ role required.');
  const name = i.options.getString('name');
  await deletePlaylist(i.guildId, name);
  return i.editReply(`🗑️ Playlist **${name}** deleted.`);
}

// ─── BUTTON HANDLER ───────────────────────────────────────────────────
async function handleMusicButton(i, client) {
  const state = getState(i.guildId);
  await i.deferUpdate().catch(()=>{});
  const id = i.customId;

  if (id==='music_playpause') {
    if (state.player?.state?.status===AudioPlayerStatus.Playing) state.player.pause();
    else if (state.player?.state?.status===AudioPlayerStatus.Paused) state.player.unpause();
  }
  else if (id==='music_skip') { clearInterval(state.progressTimer); state.player?.stop(); }
  else if (id==='music_stop') { state.queue=[]; state.current=null; state.mood=null; state.moodBuffer=[]; clearInterval(state.progressTimer); state.player?.stop(true); state.connection?.destroy(); state.connection=null; }
  else if (id==='music_shuffle') { state.shuffle=!state.shuffle; if(state.shuffle&&state.queue.length>1){for(let k=state.queue.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[state.queue[k],state.queue[j]]=[state.queue[j],state.queue[k]];}} }
  else if (id==='music_loop')   { state.loop=!state.loop; }
  else if (id==='music_loopq')  { state.loopQueue=!state.loopQueue; }
  else if (id==='music_vol_down') { state.volume=Math.max(0,state.volume-10); const ps=state.player?.state; if(ps?.resource?.volume) ps.resource.volume.setVolume(state.volume/100); }
  else if (id==='music_vol_up')   { state.volume=Math.min(100,state.volume+10); const ps=state.player?.state; if(ps?.resource?.volume) ps.resource.volume.setVolume(state.volume/100); }
  else if (id==='music_queue_view') { try { await i.followUp({ embeds:[buildQueueEmbed(state,0)], ephemeral:true }); } catch {} }
  else if (id==='music_prev') { if(state.current){ state.queue.unshift({...state.current}); clearInterval(state.progressTimer); state.player?.stop(); } }

  await updateLaunchpad(state, client);
}

// ─── SELECT HANDLER ───────────────────────────────────────────────────
async function handleMusicSelect(i, client) {
  await i.deferUpdate().catch(()=>{});
  const id    = i.customId;
  const value = i.values[0];
  const state = getState(i.guildId);

  if (id==='music_mood') {
    if (value==='off') { state.mood=null; state.moodBuffer=[]; }
    else {
      const preset = MOOD_PRESETS[value];
      if (preset) {
        state.mood=value; state.moodBuffer=[]; state.volume=preset.vol*100;
        const vc = i.member?.voice?.channel;
        if (vc) await ensureVC(state, vc, client);
        if (!state.current||state.player?.state?.status!==AudioPlayerStatus.Playing) await playNext(state,client);
      }
    }
    await updateLaunchpad(state, client);
  }
  else if (id==='music_search_select') {
    const track = await resolveTrack(value);
    if (!track) return;
    if (Array.isArray(track)) return;
    track.requestedBy = i.user.username;
    state.queue.push(track);
    const vc = i.member?.voice?.channel;
    if (vc) await ensureVC(state, vc, client);
    if (!state.current||state.player?.state?.status!==AudioPlayerStatus.Playing) await playNext(state,client);
    else await updateLaunchpad(state, client);
  }
}

// ─── PERMANENT ROOM MANAGER ───────────────────────────────────────────
async function setupPermanentRoom(guild, vcId, tcId, moodKey, client) {
  const rooms = permanentRooms.get(guild.id) || [];
  const preset = MOOD_PRESETS[moodKey];
  if (!preset) throw new Error(`Unknown mood: ${moodKey}`);
  const vc = guild.channels.cache.get(vcId);
  if (!vc) throw new Error('Voice channel not found.');
  rooms.push({ preset:moodKey, voiceChannelId:vcId, textChannelId:tcId });
  permanentRooms.set(guild.id, rooms);
  const state = getState(guild.id);
  state.textChannelId = tcId; state.mood = moodKey; state.volume = preset.vol*100;
  await ensureVC(state, vc, client);
  await playNext(state, client);
  return state;
}

// Heartbeat
setInterval(async () => {
  for (const [guildId, rooms] of permanentRooms) {
    const state = guildStates.get(guildId);
    if (!state?.client) continue;
    const conn = getVoiceConnection(guildId);
    if (!conn) {
      try {
        const guild = state.client.guilds.cache.get(guildId);
        const vc    = guild?.channels.cache.get(rooms[0]?.voiceChannelId);
        if (vc) { await ensureVC(state, vc, state.client); await playNext(state, state.client); }
      } catch (e) { console.error('[Music] Heartbeat reconnect failed:', e.message); }
    }
  }
}, ROOM_PULSE_INTERVAL);

// ─── SLASH COMMAND DEFINITIONS ────────────────────────────────────────
const MUSIC_COMMANDS = [
  new SlashCommandBuilder().setName('music').setDescription('🎵 AEGIS Music — full-featured playback engine')
    .addSubcommand(s=>s.setName('play').setDescription('▶️ Play a track, URL, or playlist').addStringOption(o=>o.setName('query').setDescription('Song name, YouTube/Spotify/SoundCloud URL or playlist').setRequired(true)))
    .addSubcommand(s=>s.setName('search').setDescription('🔍 Search and pick from top 5 results').addStringOption(o=>o.setName('query').setDescription('Search query').setRequired(true)))
    .addSubcommand(s=>s.setName('skip').setDescription('⏭️ Skip the current track'))
    .addSubcommand(s=>s.setName('stop').setDescription('⏹️ Stop and clear queue'))
    .addSubcommand(s=>s.setName('pause').setDescription('⏸️ Pause playback'))
    .addSubcommand(s=>s.setName('resume').setDescription('▶️ Resume playback'))
    .addSubcommand(s=>s.setName('nowplaying').setDescription('🎵 Current track info with progress bar'))
    .addSubcommand(s=>s.setName('queue').setDescription('📋 View queue').addIntegerOption(o=>o.setName('page').setDescription('Page number').setRequired(false).setMinValue(1)))
    .addSubcommand(s=>s.setName('volume').setDescription('🔊 Set volume 0-100').addIntegerOption(o=>o.setName('level').setDescription('Volume 0-100').setRequired(true).setMinValue(0).setMaxValue(100)))
    .addSubcommand(s=>s.setName('loop').setDescription('🔂 Toggle loop').addStringOption(o=>o.setName('mode').setDescription('Loop mode').setRequired(false).addChoices({name:'Track',value:'track'},{name:'Queue',value:'queue'},{name:'Off',value:'off'})))
    .addSubcommand(s=>s.setName('shuffle').setDescription('🔀 Toggle shuffle'))
    .addSubcommand(s=>s.setName('launchpad').setDescription('🎛️ Open interactive music control panel'))
    .addSubcommand(s=>s.setName('remove').setDescription('🗑️ Remove a track from queue').addIntegerOption(o=>o.setName('position').setDescription('Track position').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('move').setDescription('↕️ Reorder a track in queue').addIntegerOption(o=>o.setName('from').setDescription('From position').setRequired(true).setMinValue(1)).addIntegerOption(o=>o.setName('to').setDescription('To position').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('clear').setDescription('🗑️ Clear entire queue'))
    .addSubcommand(s=>s.setName('room').setDescription('🎭 Set mood room for endless autoplay').addStringOption(o=>o.setName('room').setDescription('Mood preset').setRequired(true).addChoices({name:'Off — Custom Queue',value:'off'},{name:'🌙 Midnight Lo-fi',value:'midnight-lofi'},{name:'🌊 Synthwave Lounge',value:'synthwave-lounge'},{name:'🌌 Ambient Void',value:'ambient-void'},{name:'⚔️ Raid Prep',value:'raid-prep'},{name:'🎉 Party Room',value:'party-room'})))
    .addSubcommandGroup(g=>g.setName('playlist').setDescription('📂 Manage server playlists')
      .addSubcommand(s=>s.setName('save').setDescription('💾 Save current queue as playlist').addStringOption(o=>o.setName('name').setDescription('Playlist name').setRequired(true)))
      .addSubcommand(s=>s.setName('load').setDescription('📂 Load a saved playlist').addStringOption(o=>o.setName('name').setDescription('Playlist name').setRequired(true)))
      .addSubcommand(s=>s.setName('list').setDescription('📋 List all saved playlists'))
      .addSubcommand(s=>s.setName('delete').setDescription('🗑️ Delete a playlist').addStringOption(o=>o.setName('name').setDescription('Playlist name').setRequired(true))),
    ),
  new SlashCommandBuilder().setName('setup-music').setDescription('🎵 [ADMIN] Set up a permanent 24/7 music room').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o=>o.setName('voice').setDescription('Voice channel for music').setRequired(true))
    .addChannelOption(o=>o.setName('text').setDescription('Text channel for now-playing').setRequired(true))
    .addStringOption(o=>o.setName('mood').setDescription('Starting mood preset').setRequired(true).addChoices({name:'🌙 Midnight Lo-fi',value:'midnight-lofi'},{name:'🌊 Synthwave Lounge',value:'synthwave-lounge'},{name:'🌌 Ambient Void',value:'ambient-void'},{name:'⚔️ Raid Prep',value:'raid-prep'},{name:'🎉 Party Room',value:'party-room'})),
].map(c=>c.toJSON());

// ─── MAIN DISPATCH ────────────────────────────────────────────────────
async function handleMusicCommand(i, client) {
  if (!i.isChatInputCommand()) return false;
  const cmd = i.commandName;
  const sub = i.options.getSubcommand?.(false);
  const grp = i.options.getSubcommandGroup?.(false);

  if (cmd === 'setup-music') {
    if (!i.member?.permissions?.has(PermissionFlagsBits.ManageChannels)) return i.editReply('⛔ Manage Channels required.');
    const vc   = i.options.getChannel('voice');
    const tc   = i.options.getChannel('text');
    const mood = i.options.getString('mood');
    try {
      await setupPermanentRoom(i.guild, vc.id, tc.id, mood, client);
      const preset = MOOD_PRESETS[mood];
      return i.editReply({ embeds:[new EmbedBuilder().setColor(preset.color).setTitle(`${preset.emoji} Permanent Room Set Up!`).setDescription(`**${preset.label}** is now live in ${vc} / ${tc}\nAuto-reconnect and endless stream enabled.`).setFooter(FT)] });
    } catch (e) { return i.editReply(`⚠️ ${e.message}`); }
  }

  if (cmd !== 'music') return false;

  // Playlist group
  if (grp === 'playlist') {
    try {
      if (sub==='save')   return await cmdPlaylistSave(i);
      if (sub==='load')   return await cmdPlaylistLoad(i, client);
      if (sub==='list')   return await cmdPlaylistList(i);
      if (sub==='delete') return await cmdPlaylistDelete(i);
    } catch (e) { return i.editReply(`⚠️ Playlist error: ${e.message}`); }
  }

  // Regular subcommands
  if (sub==='play')       return cmdPlay(i, client);
  if (sub==='search')     return cmdSearch(i, client);
  if (sub==='skip')       return cmdSkip(i, client);
  if (sub==='stop')       return cmdStop(i, client);
  if (sub==='pause')      { if(!isDJ(i.member)) return i.editReply('⛔ DJ role required.'); const s=getState(i.guildId); if(s.player?.state?.status!==AudioPlayerStatus.Playing) return i.editReply('⚠️ Nothing playing.'); s.player.pause(); return i.editReply('⏸️ Paused.'); }
  if (sub==='resume')     { if(!isDJ(i.member)) return i.editReply('⛔ DJ role required.'); const s=getState(i.guildId); if(s.player?.state?.status!==AudioPlayerStatus.Paused) return i.editReply('⚠️ Not paused.'); s.player.unpause(); return i.editReply('▶️ Resumed.'); }
  if (sub==='nowplaying') return cmdNowPlaying(i);
  if (sub==='queue')      return cmdQueue(i);
  if (sub==='volume')     return cmdVolume(i, client);
  if (sub==='loop')       return cmdLoop(i, client);
  if (sub==='shuffle')    return cmdShuffle(i, client);
  if (sub==='launchpad')  return cmdLaunchpad(i, client);
  if (sub==='remove')     return cmdRemove(i);
  if (sub==='move')       return cmdMove(i);
  if (sub==='clear')      return cmdClearQueue(i);
  if (sub==='room')       return cmdMoodRoom(i, client);

  return false;
}

module.exports = {
  MUSIC_COMMANDS,
  MOOD_PRESETS,
  handleMusicCommand,
  handleMusicButton,
  handleMusicSelect,
  getState,
  isMusicButton: (id) => id?.startsWith('music_'),
  isMusicSelect: (id) => ['music_mood','music_search_select'].includes(id),
};
