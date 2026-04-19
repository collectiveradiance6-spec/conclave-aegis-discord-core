// ═══════════════════════════════════════════════════════════════════
// CONCLAVE AEGIS — WORLD-CLASS MUSIC RUNTIME v1.0
// ═══════════════════════════════════════════════════════════════════
// Architecture:
//   ∙ play-dl — YouTube / Spotify / SoundCloud search + streaming
//   ∙ @discordjs/voice — audio pipeline, multi-guild sessions
//   ∙ Persistent queue per guild
//   ∙ 5 permanent 24/7 mood rooms (auto-reconnect, auto-fill)
//   ∙ Interactive launchpad embed (buttons + select menu)
//   ∙ Now-playing embed with live progress bar (auto-edit)
//   ∙ Playlist CRUD — Supabase + in-memory
//   ∙ Uninterrupted playback — queue fallback → mood-room fills
//   ∙ Per-room volume profiles
// ═══════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState,
  getVoiceConnection, NoSubscriberBehavior,
  StreamType,
} = require('@discordjs/voice');
const playdl = require('play-dl');
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

// ─── CONSTANTS ────────────────────────────────────────────────────
const MAX_ROOMS      = parseInt(process.env.MUSIC_MAX_ROOMS || '5', 10);
const MAX_QUEUE      = 250;
const PROGRESS_BARS  = 20;
const LAUNCHPAD_EDIT_INTERVAL = parseInt(process.env.LAUNCHPAD_EDIT_INTERVAL || '12000', 10); // ms — edit now-playing embed
const ROOM_RECONNECT_DELAY    = parseInt(process.env.ROOM_RECONNECT_DELAY || '5000', 10);
const ROOM_PULSE_INTERVAL     = parseInt(process.env.ROOM_PULSE_INTERVAL || '30000', 10); // check mood rooms heartbeat

// ─── MOOD ROOM PRESETS ────────────────────────────────────────────
const MOOD_PRESETS = {
  'midnight-lofi': {
    label: '🌙 Midnight Lo-fi',
    searchTerms: ['lofi hip hop beats to relax','midnight lofi chill','lofi hip hop radio'],
    volume: 0.6,
    color: 0x7B2FFF,
    emoji: '🌙',
    description: 'Smooth lo-fi for late-night sessions',
  },
  'synthwave-lounge': {
    label: '🌊 Synthwave Lounge',
    searchTerms: ['synthwave chill mix','retrowave ambient','synthwave relaxing drive'],
    volume: 0.7,
    color: 0xFF4CD2,
    emoji: '🌊',
    description: 'Retro-futuristic synth vibes',
  },
  'ambient-void': {
    label: '🌌 Ambient Void',
    searchTerms: ['dark ambient space music','cosmic ambient meditation','void ambient dark'],
    volume: 0.5,
    color: 0x00D4FF,
    emoji: '🌌',
    description: 'Deep space ambient for focus',
  },
  'raid-prep': {
    label: '⚔️ Raid Prep',
    searchTerms: ['epic battle music gaming','intense ark raid music','epic orchestral battle'],
    volume: 0.85,
    color: 0xFF4500,
    emoji: '⚔️',
    description: 'Hype your team for boss runs',
  },
  'party-room': {
    label: '🎉 Party Room',
    searchTerms: ['party mix 2024 hype','best hype gaming music','upbeat party gaming mix'],
    volume: 0.8,
    color: 0xFFB800,
    emoji: '🎉',
    description: 'Non-stop hype energy',
  },
};

// ─── GUILD MUSIC STATE ────────────────────────────────────────────
// guildId → GuildMusicState
const guildStates = new Map();

class GuildMusicState {
  constructor(guildId) {
    this.guildId       = guildId;
    this.queue         = [];          // [{ title, url, duration, thumbnail, requestedBy, source }]
    this.current       = null;        // currently playing track info
    this.player        = null;
    this.connection    = null;
    this.voiceChannelId = null;
    this.textChannelId  = null;
    this.launchpadMsgId = null;
    this.launchpadChannelId = null;
    this.nowPlayingMsgId = null;
    this.volume        = 80;          // 0-100
    this.loop          = false;
    this.loopQueue     = false;
    this.shuffle       = false;
    this.mood          = null;        // current mood preset key
    this.moodBuffer    = [];          // pre-fetched mood tracks
    this.progressTimer = null;
    this.reconnectTimer= null;
    this.client        = null;        // set on first join
  }
}

function getState(guildId) {
  if (!guildStates.has(guildId)) guildStates.set(guildId, new GuildMusicState(guildId));
  return guildStates.get(guildId);
}

// ─── EMBED BUILDERS ───────────────────────────────────────────────
const FT = { text: 'TheConclave Dominion • AEGIS Music Runtime', iconURL: 'https://theconclavedominion.com/conclave-badge.png' };

function progressBar(current, total) {
  if (!total) return '──────────────────── 0:00';
  const pct = Math.min(current / total, 1);
  const filled = Math.round(pct * PROGRESS_BARS);
  const bar = '█'.repeat(filled) + '░'.repeat(PROGRESS_BARS - filled);
  return `${bar} ${fmtTime(current)} / ${fmtTime(total)}`;
}

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function sourceIcon(source) {
  if (source?.includes('spotify'))   return '🎵';
  if (source?.includes('soundcloud'))return '☁️';
  return '▶️';
}

function buildNowPlayingEmbed(state, elapsed = 0) {
  const track = state.current;
  if (!track) return null;

  const preset = state.mood ? MOOD_PRESETS[state.mood] : null;
  const color  = preset ? preset.color : 0x00D4FF;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${sourceIcon(track.source)} Now Playing`)
    .setDescription(`### [${track.title}](${track.url})`)
    .setThumbnail(track.thumbnail || null)
    .addFields(
      { name: '⏱️ Progress',   value: `\`${progressBar(elapsed, track.duration)}\``,         inline: false },
      { name: '👤 Requested',  value: track.requestedBy || 'AutoPlay',                         inline: true  },
      { name: '🔊 Volume',     value: `${state.volume}%`,                                      inline: true  },
      { name: '🎶 Queue',      value: `${state.queue.length} track${state.queue.length!==1?'s':''}`, inline: true },
    )
    .setFooter(FT)
    .setTimestamp();

  if (state.loop)      embed.addFields({ name: '🔂', value: 'Track Loop', inline: true });
  if (state.loopQueue) embed.addFields({ name: '🔁', value: 'Queue Loop', inline: true });
  if (state.shuffle)   embed.addFields({ name: '🔀', value: 'Shuffle On', inline: true });
  if (state.mood)      embed.addFields({ name: preset?.emoji || '🎭', value: preset?.label || state.mood, inline: true });

  return embed;
}

function buildQueueEmbed(state, page = 0) {
  const PER_PAGE = 12;
  const start  = page * PER_PAGE;
  const tracks = state.queue.slice(start, start + PER_PAGE);
  const pages  = Math.ceil(state.queue.length / PER_PAGE) || 1;

  const embed = new EmbedBuilder()
    .setColor(0x7B2FFF)
    .setTitle(`📋 Queue — ${state.queue.length} Track${state.queue.length!==1?'s':''}`)
    .setFooter({ ...FT, text: `Page ${page+1}/${pages} • ${FT.text}` })
    .setTimestamp();

  if (!state.queue.length) {
    embed.setDescription('Queue is empty. Use `/music play` to add tracks!');
    return embed;
  }

  const lines = tracks.map((t, i) =>
    `**${start+i+1}.** [${t.title.slice(0,50)}](${t.url}) — ${fmtTime(t.duration)} · ${t.requestedBy}`
  ).join('\n');

  embed.setDescription(lines);

  if (state.current) {
    embed.addFields({ name: '▶️ Now Playing', value: `[${state.current.title}](${state.current.url})` });
  }

  return embed;
}

// ─── LAUNCHPAD COMPONENTS ─────────────────────────────────────────
function buildLaunchpadComponents(state) {
  const isPlaying = state.player?.state?.status === AudioPlayerStatus.Playing;
  const isPaused  = state.player?.state?.status === AudioPlayerStatus.Paused;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_prev')   .setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(!state.queue.length && !state.current),
    new ButtonBuilder().setCustomId('music_playpause').setEmoji(isPlaying ? '⏸️' : '▶️').setStyle(isPlaying ? ButtonStyle.Primary : ButtonStyle.Success).setDisabled(!state.current),
    new ButtonBuilder().setCustomId('music_skip')   .setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(!state.queue.length),
    new ButtonBuilder().setCustomId('music_stop')   .setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(!state.current),
    new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setStyle(state.shuffle ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_vol_down') .setEmoji('🔉').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_vol_up')   .setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loop')     .setEmoji('🔂').setStyle(state.loop ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loopq')    .setEmoji('🔁').setStyle(state.loopQueue ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_queue_view').setEmoji('📋').setStyle(ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('music_mood')
      .setPlaceholder('🎭 Switch Mood Room...')
      .addOptions(
        { label: 'Off — Use My Queue', value: 'off', emoji: '❌', description: 'Disable mood room autoplay' },
        ...Object.entries(MOOD_PRESETS).map(([k, v]) => ({
          label:       v.label,
          value:       k,
          emoji:       v.emoji,
          description: v.description,
          default:     state.mood === k,
        }))
      )
  );

  return [row1, row2, row3];
}

function buildLaunchpadEmbed(state) {
  const track  = state.current;
  const preset = state.mood ? MOOD_PRESETS[state.mood] : null;

  const embed = new EmbedBuilder()
    .setColor(preset?.color ?? 0x7B2FFF)
    .setTitle(`${preset?.emoji ?? '🎛️'} AEGIS Music Launchpad`)
    .setFooter(FT)
    .setTimestamp();

  if (track) {
    embed.setDescription(`**▶️ ${track.title}**\n${track.requestedBy ? `Requested by ${track.requestedBy}` : 'AutoPlay'}`);
    if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  } else if (preset) {
    embed.setDescription(`**${preset.label}**\n${preset.description}\n\n*Auto-queuing tracks...*`);
  } else {
    embed.setDescription('Use `/music play` or select a Mood Room below to start playing.');
  }

  embed.addFields(
    { name: '🎶 Queue',   value: `${state.queue.length} track${state.queue.length!==1?'s':''}`, inline: true },
    { name: '🔊 Volume',  value: `${state.volume}%`,      inline: true },
    { name: '🎭 Mood',    value: preset?.label ?? 'Custom queue', inline: true },
  );

  return embed;
}

// ─── AUDIO PIPELINE ───────────────────────────────────────────────
async function searchTrack(query, source = 'auto') {
  try {
    // Auto-detect URL type
    if (/^https?:\/\//.test(query)) {
      if (query.includes('spotify.com')) {
        const spot = await playdl.spotify(query);
        if (spot.type === 'track') {
          const yt = await playdl.search(`${spot.name} ${spot.artists?.[0]?.name||''}`, { source: { youtube: 'video' }, limit: 1 });
          if (yt[0]) return trackFromYT(yt[0], query, 'spotify');
        }
        return null;
      }
      if (query.includes('soundcloud.com')) {
        const sc = await playdl.soundcloud(query);
        const stream = await playdl.stream_from_info(sc);
        return {
          title:       sc.name,
          url:         query,
          duration:    sc.durationInSec,
          thumbnail:   sc.thumbnail,
          source:      'soundcloud',
          stream,
        };
      }
      // YouTube URL
      const info = await playdl.video_info(query);
      return trackFromYTInfo(info, query, 'youtube');
    }

    // Text search → YouTube
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (!results.length) return null;
    return trackFromYT(results[0], null, 'youtube');

  } catch (e) {
    console.error('[Music] searchTrack:', e.message);
    return null;
  }
}

function trackFromYT(yt, overrideUrl = null, source = 'youtube') {
  return {
    title:       yt.title,
    url:         overrideUrl || yt.url,
    duration:    yt.durationInSec || 0,
    thumbnail:   yt.thumbnails?.[0]?.url || null,
    source,
    ytId:        yt.id,
  };
}

async function trackFromYTInfo(info, url, source = 'youtube') {
  return {
    title:     info.video_details.title,
    url:       url || info.video_details.url,
    duration:  info.video_details.durationInSec || 0,
    thumbnail: info.video_details.thumbnails?.[0]?.url || null,
    source,
    ytId:      info.video_details.id,
  };
}

async function getAudioStream(track) {
  if (track.stream) return track.stream;
  return await playdl.stream(track.url, {
    quality: 2,
    precache: 3,
    discordPlayerCompatibility: true,
  });
}

// ─── PLAYBACK ENGINE ──────────────────────────────────────────────
async function playNext(state, client) {
  if (!state.connection || !state.voiceChannelId) return;

  // Determine next track
  let track = null;

  if (state.loop && state.current) {
    track = state.current;
  } else if (state.queue.length) {
    if (state.shuffle) {
      const idx = Math.floor(Math.random() * state.queue.length);
      track = state.queue.splice(idx, 1)[0];
    } else {
      track = state.queue.shift();
    }
    if (state.loopQueue && state.current) {
      state.queue.push(state.current);
    }
  } else if (state.mood) {
    // Fill from mood buffer or fetch new
    track = await getMoodTrack(state);
  }

  if (!track) {
    state.current = null;
    await updateLaunchpad(state, client);
    return;
  }

  state.current = { ...track, startTime: Date.now() };
  state.current.requestedBy = track.requestedBy || 'AutoPlay';

  try {
    const stream = await getAudioStream(track);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type || StreamType.Opus,
      inlineVolume: true,
    });
    resource.volume?.setVolume(state.volume / 100);
    state.player.play(resource);

    // Start progress timer
    clearInterval(state.progressTimer);
    if (state.nowPlayingMsgId && state.textChannelId) {
      let elapsed = 0;
      state.progressTimer = setInterval(async () => {
        elapsed += LAUNCHPAD_EDIT_INTERVAL / 1000;
        await updateNowPlaying(state, client, elapsed);
      }, LAUNCHPAD_EDIT_INTERVAL);
    }

    await updateLaunchpad(state, client);
    await postNowPlaying(state, client);

  } catch (e) {
    console.error('[Music] playNext error:', e.message);
    // Skip to next
    setTimeout(() => playNext(state, client), 500);
  }
}

// ─── MOOD ROOM AUTO-FILL ──────────────────────────────────────────
async function getMoodTrack(state) {
  if (state.moodBuffer.length) return state.moodBuffer.shift();

  // Fetch fresh batch
  const preset = MOOD_PRESETS[state.mood];
  if (!preset) return null;

  try {
    const term    = preset.searchTerms[Math.floor(Math.random() * preset.searchTerms.length)];
    const results = await playdl.search(term, { source: { youtube: 'video' }, limit: 6 });

    state.moodBuffer = results
      .filter(r => r.durationInSec > 60 && r.durationInSec < 7200)
      .map(r => trackFromYT(r, null, 'youtube'));

    // Shuffle buffer
    for (let i = state.moodBuffer.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.moodBuffer[i], state.moodBuffer[j]] = [state.moodBuffer[j], state.moodBuffer[i]];
    }

    return state.moodBuffer.shift() || null;
  } catch (e) {
    console.error('[Music] getMoodTrack:', e.message);
    return null;
  }
}

// ─── VOICE CONNECTION MANAGEMENT ─────────────────────────────────
async function ensureVoiceConnection(state, voiceChannel, client) {
  const existing = getVoiceConnection(state.guildId);
  if (existing && state.connection === existing) return existing;

  const connection = joinVoiceChannel({
    channelId:      voiceChannel.id,
    guildId:        state.guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf:       true,
  });

  state.connection      = connection;
  state.voiceChannelId  = voiceChannel.id;
  state.client          = client;

  // Create player if needed
  if (!state.player) {
    state.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    state.player.on(AudioPlayerStatus.Idle, () => {
      clearInterval(state.progressTimer);
      setTimeout(() => playNext(state, client), 300);
    });

    state.player.on('error', e => {
      console.error('[Music] Player error:', e.message);
      setTimeout(() => playNext(state, client), 500);
    });
  }

  connection.subscribe(state.player);

  // Handle disconnect
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling,   5000),
        entersState(connection, VoiceConnectionStatus.Connecting,   5000),
      ]);
    } catch {
      if (state.mood) {
        // Auto-reconnect for mood rooms
        state.reconnectTimer = setTimeout(() => {
          const guild = client.guilds.cache.get(state.guildId);
          const ch    = guild?.channels.cache.get(state.voiceChannelId);
          if (ch) ensureVoiceConnection(state, ch, client);
        }, ROOM_RECONNECT_DELAY);
      } else {
        connection.destroy();
        state.connection = null;
      }
    }
  });

  return connection;
}

// ─── NOW PLAYING EMBED (persistent, editable) ────────────────────
async function postNowPlaying(state, client) {
  if (!state.textChannelId) return;
  const ch = client.channels.cache.get(state.textChannelId);
  if (!ch) return;

  const embed = buildNowPlayingEmbed(state, 0);
  if (!embed) return;

  try {
    const msg = await ch.send({ embeds: [embed] });
    state.nowPlayingMsgId = msg.id;
  } catch {}
}

async function updateNowPlaying(state, client, elapsed) {
  if (!state.nowPlayingMsgId || !state.textChannelId) return;
  const ch = client.channels.cache.get(state.textChannelId);
  if (!ch) return;

  try {
    const msg = await ch.messages.fetch(state.nowPlayingMsgId).catch(() => null);
    if (!msg) return;
    const embed = buildNowPlayingEmbed(state, elapsed);
    if (embed) await msg.edit({ embeds: [embed] });
  } catch {}
}

// ─── LAUNCHPAD (persistent control panel) ────────────────────────
async function updateLaunchpad(state, client) {
  if (!state.launchpadMsgId || !state.launchpadChannelId) return;
  const ch = client.channels.cache.get(state.launchpadChannelId);
  if (!ch) return;

  try {
    const msg = await ch.messages.fetch(state.launchpadMsgId).catch(() => null);
    if (!msg) return;
    await msg.edit({
      embeds:     [buildLaunchpadEmbed(state)],
      components: buildLaunchpadComponents(state),
    });
  } catch {}
}

// ─── EXPORTED COMMAND HANDLERS ────────────────────────────────────

async function cmdPlay(interaction, client) {
  const query   = interaction.options.getString('query');
  const member  = interaction.member;
  const vc      = member?.voice?.channel;

  if (!vc) return interaction.editReply('⚠️ Join a voice channel first.');

  const state = getState(interaction.guildId);
  state.textChannelId = interaction.channelId;

  await ensureVoiceConnection(state, vc, client);

  await interaction.editReply(`🔍 Searching: \`${query}\`...`);

  const track = await searchTrack(query);
  if (!track) return interaction.editReply('⚠️ No results found. Try a different query.');

  track.requestedBy = interaction.user.username;

  const wasEmpty = !state.current && !state.queue.length;

  if (state.queue.length >= MAX_QUEUE) {
    return interaction.editReply(`⚠️ Queue full (${MAX_QUEUE} tracks max). Skip some tracks first.`);
  }

  state.queue.push(track);

  if (wasEmpty && state.player?.state?.status !== AudioPlayerStatus.Playing) {
    await playNext(state, client);
    return interaction.editReply({ content: null, embeds: [
      new EmbedBuilder()
        .setColor(0x00D4FF)
        .setTitle('▶️ Now Playing')
        .setDescription(`[${track.title}](${track.url})`)
        .addFields(
          { name: '⏱️ Duration', value: fmtTime(track.duration), inline: true },
          { name: '👤 Requested by', value: track.requestedBy, inline: true },
        )
        .setThumbnail(track.thumbnail || null)
        .setFooter(FT)
    ]});
  }

  return interaction.editReply({ content: null, embeds: [
    new EmbedBuilder()
      .setColor(0x7B2FFF)
      .setTitle('📋 Added to Queue')
      .setDescription(`[${track.title}](${track.url})`)
      .addFields(
        { name: '⏱️ Duration',  value: fmtTime(track.duration), inline: true },
        { name: '📍 Position',  value: `#${state.queue.length}`, inline: true },
        { name: '⏰ Est. Wait', value: estimateWait(state),       inline: true },
      )
      .setThumbnail(track.thumbnail || null)
      .setFooter(FT)
  ]});
}

function estimateWait(state) {
  const remaining = (state.current?.duration || 0) -
    Math.floor((Date.now() - (state.current?.startTime || Date.now())) / 1000);
  const total = remaining + state.queue.slice(0, -1).reduce((s, t) => s + (t.duration || 0), 0);
  return fmtTime(Math.max(0, total));
}

async function cmdSkip(interaction, client) {
  const state = getState(interaction.guildId);
  if (!state.current) return interaction.editReply('⚠️ Nothing is playing.');

  const skipped = state.current.title;
  clearInterval(state.progressTimer);
  state.player?.stop();

  return interaction.editReply({ embeds: [
    new EmbedBuilder()
      .setColor(0xFFB800)
      .setDescription(`⏭️ Skipped: **${skipped}**`)
      .setFooter(FT)
  ]});
}

async function cmdStop(interaction, client) {
  const state = getState(interaction.guildId);
  state.queue   = [];
  state.current = null;
  state.mood    = null;
  state.moodBuffer = [];
  clearInterval(state.progressTimer);
  state.player?.stop(true);
  state.connection?.destroy();
  state.connection = null;

  await updateLaunchpad(state, client);
  return interaction.editReply('⏹️ Stopped. Queue cleared. Disconnected.');
}

async function cmdPause(interaction) {
  const state = getState(interaction.guildId);
  if (!state.player || state.player.state.status !== AudioPlayerStatus.Playing)
    return interaction.editReply('⚠️ Nothing is playing.');
  state.player.pause();
  return interaction.editReply('⏸️ Paused.');
}

async function cmdResume(interaction) {
  const state = getState(interaction.guildId);
  if (!state.player || state.player.state.status !== AudioPlayerStatus.Paused)
    return interaction.editReply('⚠️ Not paused.');
  state.player.unpause();
  return interaction.editReply('▶️ Resumed.');
}

async function cmdVolume(interaction, client) {
  const vol = interaction.options.getInteger('level');
  if (vol < 0 || vol > 100) return interaction.editReply('⚠️ Volume must be 0–100.');
  const state = getState(interaction.guildId);
  state.volume = vol;

  // Apply immediately to current resource
  const playerState = state.player?.state;
  if (playerState?.status === AudioPlayerStatus.Playing && playerState.resource?.volume) {
    playerState.resource.volume.setVolume(vol / 100);
  }

  await updateLaunchpad(state, client);
  return interaction.editReply(`🔊 Volume set to **${vol}%**`);
}

async function cmdQueue(interaction) {
  const page  = Math.max(0, (interaction.options.getInteger('page') || 1) - 1);
  const state = getState(interaction.guildId);
  return interaction.editReply({ embeds: [buildQueueEmbed(state, page)] });
}

async function cmdLoop(interaction, client) {
  const mode  = interaction.options.getString('mode') || 'track';
  const state = getState(interaction.guildId);

  if (mode === 'track') {
    state.loop = !state.loop;
    await updateLaunchpad(state, client);
    return interaction.editReply(state.loop ? '🔂 Track loop **ON**' : '🔂 Track loop **OFF**');
  }
  if (mode === 'queue') {
    state.loopQueue = !state.loopQueue;
    await updateLaunchpad(state, client);
    return interaction.editReply(state.loopQueue ? '🔁 Queue loop **ON**' : '🔁 Queue loop **OFF**');
  }
  state.loop = false; state.loopQueue = false;
  await updateLaunchpad(state, client);
  return interaction.editReply('🔂 Loop **OFF**');
}

async function cmdShuffle(interaction, client) {
  const state    = getState(interaction.guildId);
  state.shuffle  = !state.shuffle;

  if (state.shuffle && state.queue.length > 1) {
    for (let i = state.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
    }
  }

  await updateLaunchpad(state, client);
  return interaction.editReply(state.shuffle ? '🔀 Shuffle **ON** — queue randomized!' : '🔀 Shuffle **OFF**');
}

async function cmdNowPlaying(interaction) {
  const state = getState(interaction.guildId);
  if (!state.current) return interaction.editReply('⚠️ Nothing is playing.');

  const elapsed = Math.floor((Date.now() - (state.current.startTime || Date.now())) / 1000);
  const embed   = buildNowPlayingEmbed(state, elapsed);
  return interaction.editReply({ embeds: [embed] });
}

async function cmdLaunchpad(interaction, client) {
  const state = getState(interaction.guildId);
  state.launchpadChannelId = interaction.channelId;

  const msg = await interaction.editReply({
    embeds:     [buildLaunchpadEmbed(state)],
    components: buildLaunchpadComponents(state),
    fetchReply: true,
  });
  state.launchpadMsgId = msg.id;
}

async function cmdMoodRoom(interaction, client) {
  const mood   = interaction.options.getString('room');
  const member = interaction.member;
  const vc     = member?.voice?.channel;

  if (!vc && mood !== 'off') return interaction.editReply('⚠️ Join a voice channel first.');

  const state = getState(interaction.guildId);
  state.textChannelId = interaction.channelId;

  if (mood === 'off') {
    state.mood       = null;
    state.moodBuffer = [];
    await updateLaunchpad(state, client);
    return interaction.editReply('❌ Mood room disabled. Queue playback continues.');
  }

  const preset = MOOD_PRESETS[mood];
  if (!preset) return interaction.editReply('⚠️ Unknown mood room.');

  state.mood       = mood;
  state.moodBuffer = [];
  state.volume     = preset.volume * 100;

  await ensureVoiceConnection(state, vc, client);

  // If nothing playing, kick off mood
  if (!state.current || state.player?.state?.status !== AudioPlayerStatus.Playing) {
    await playNext(state, client);
  }

  await updateLaunchpad(state, client);
  return interaction.editReply({ embeds: [
    new EmbedBuilder()
      .setColor(preset.color)
      .setTitle(`${preset.emoji} Mood Room Activated`)
      .setDescription(`**${preset.label}**\n${preset.description}`)
      .addFields(
        { name: '🔊 Volume',  value: `${state.volume}%`, inline: true },
        { name: '🔁 AutoFill', value: 'On — endless stream', inline: true },
      )
      .setFooter(FT)
  ]});
}

async function cmdSearch(interaction, client) {
  const query   = interaction.options.getString('query');
  const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 5 });

  if (!results.length) return interaction.editReply('⚠️ No results.');

  const embed = new EmbedBuilder()
    .setColor(0x00D4FF)
    .setTitle(`🔍 Search: "${query}"`)
    .setDescription(results.map((r, i) =>
      `**${i+1}.** [${r.title}](${r.url}) — ${fmtTime(r.durationInSec)}`
    ).join('\n'))
    .setFooter(FT);

  const select = new StringSelectMenuBuilder()
    .setCustomId('music_search_select')
    .setPlaceholder('Select a track to play...')
    .addOptions(results.map((r, i) => ({
      label:       r.title.slice(0, 80),
      value:       r.url,
      description: `${fmtTime(r.durationInSec)} — YouTube`,
    })));

  return interaction.editReply({
    embeds:     [embed],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

async function cmdRemove(interaction) {
  const pos   = interaction.options.getInteger('position');
  const state = getState(interaction.guildId);

  if (pos < 1 || pos > state.queue.length) {
    return interaction.editReply(`⚠️ Position must be 1–${state.queue.length}`);
  }

  const removed = state.queue.splice(pos - 1, 1)[0];
  return interaction.editReply(`✅ Removed: **${removed.title}**`);
}

async function cmdClearQueue(interaction) {
  const state   = getState(interaction.guildId);
  const count   = state.queue.length;
  state.queue   = [];
  state.moodBuffer = [];
  return interaction.editReply(`🗑️ Cleared **${count}** track${count!==1?'s':''} from the queue.`);
}

async function cmdMove(interaction) {
  const from  = interaction.options.getInteger('from') - 1;
  const to    = interaction.options.getInteger('to')   - 1;
  const state = getState(interaction.guildId);

  if (from < 0 || from >= state.queue.length || to < 0 || to >= state.queue.length) {
    return interaction.editReply(`⚠️ Positions must be within 1–${state.queue.length}`);
  }

  const [track] = state.queue.splice(from, 1);
  state.queue.splice(to, 0, track);
  return interaction.editReply(`↕️ Moved **${track.title}** to position **${to+1}**`);
}

// ─── BUTTON + SELECT HANDLER ──────────────────────────────────────
async function handleMusicButton(interaction, client) {
  const state = getState(interaction.guildId);
  await interaction.deferUpdate().catch(() => {});

  const id = interaction.customId;

  if (id === 'music_playpause') {
    if (state.player?.state?.status === AudioPlayerStatus.Playing) {
      state.player.pause();
    } else if (state.player?.state?.status === AudioPlayerStatus.Paused) {
      state.player.unpause();
    }
  }
  else if (id === 'music_skip') {
    clearInterval(state.progressTimer);
    state.player?.stop();
  }
  else if (id === 'music_stop') {
    state.queue = []; state.current = null; state.mood = null; state.moodBuffer = [];
    clearInterval(state.progressTimer);
    state.player?.stop(true);
    state.connection?.destroy();
    state.connection = null;
  }
  else if (id === 'music_shuffle') {
    state.shuffle = !state.shuffle;
    if (state.shuffle && state.queue.length > 1) {
      for (let i = state.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
      }
    }
  }
  else if (id === 'music_loop')   { state.loop      = !state.loop; }
  else if (id === 'music_loopq')  { state.loopQueue = !state.loopQueue; }
  else if (id === 'music_vol_down') {
    state.volume = Math.max(0, state.volume - 10);
    const ps = state.player?.state;
    if (ps?.resource?.volume) ps.resource.volume.setVolume(state.volume / 100);
  }
  else if (id === 'music_vol_up') {
    state.volume = Math.min(100, state.volume + 10);
    const ps = state.player?.state;
    if (ps?.resource?.volume) ps.resource.volume.setVolume(state.volume / 100);
  }
  else if (id === 'music_queue_view') {
    const embed = buildQueueEmbed(state, 0);
    try { await interaction.followUp({ embeds: [embed], ephemeral: true }); } catch {}
  }
  else if (id === 'music_prev') {
    // Not truly "previous" — replay current or last
    if (state.current) {
      state.queue.unshift({ ...state.current });
      clearInterval(state.progressTimer);
      state.player?.stop();
    }
  }

  await updateLaunchpad(state, client);
}

async function handleMusicSelect(interaction, client) {
  await interaction.deferUpdate().catch(() => {});
  const id    = interaction.customId;
  const value = interaction.values[0];

  if (id === 'music_mood') {
    const state = getState(interaction.guildId);

    if (value === 'off') {
      state.mood = null; state.moodBuffer = [];
    } else {
      const preset = MOOD_PRESETS[value];
      if (preset) {
        state.mood       = value;
        state.moodBuffer = [];
        state.volume     = preset.volume * 100;

        const member = interaction.member;
        const vc     = member?.voice?.channel;
        if (vc) await ensureVoiceConnection(state, vc, client);

        if (!state.current || state.player?.state?.status !== AudioPlayerStatus.Playing) {
          await playNext(state, client);
        }
      }
    }
    await updateLaunchpad(state, client);
  }
  else if (id === 'music_search_select') {
    const state = getState(interaction.guildId);
    const track = await searchTrack(value);
    if (!track) return;
    track.requestedBy = interaction.user.username;
    state.queue.push(track);

    const member = interaction.member;
    const vc     = member?.voice?.channel;
    if (vc) await ensureVoiceConnection(state, vc, client);

    if (!state.current || state.player?.state?.status !== AudioPlayerStatus.Playing) {
      await playNext(state, client);
    } else {
      await updateLaunchpad(state, client);
    }
  }
}

// ─── PERMANENT ROOM MANAGER ────────────────────────────────────────
// Stores: { guildId: [{ preset, voiceChannelId, textChannelId }] }
const permanentRooms = new Map();

async function setupPermanentRoom(guild, voiceChannelId, textChannelId, moodKey, client) {
  const rooms = permanentRooms.get(guild.id) || [];
  if (rooms.length >= MAX_ROOMS) {
    throw new Error(`Maximum ${MAX_ROOMS} permanent rooms per server.`);
  }

  const preset = MOOD_PRESETS[moodKey];
  if (!preset) throw new Error(`Unknown mood: ${moodKey}`);

  const vc = guild.channels.cache.get(voiceChannelId);
  if (!vc) throw new Error('Voice channel not found.');

  rooms.push({ preset: moodKey, voiceChannelId, textChannelId });
  permanentRooms.set(guild.id, rooms);

  // Start playing
  const state = getState(guild.id);
  state.textChannelId = textChannelId;
  state.mood          = moodKey;
  state.volume        = preset.volume * 100;

  await ensureVoiceConnection(state, vc, client);
  await playNext(state, client);

  return state;
}

// Heartbeat — re-join if disconnected
setInterval(async () => {
  for (const [guildId, rooms] of permanentRooms) {
    for (const room of rooms) {
      const state = guildStates.get(guildId);
      if (!state?.client) continue;

      const conn = getVoiceConnection(guildId);
      if (!conn) {
        try {
          const guild = state.client.guilds.cache.get(guildId);
          const vc    = guild?.channels.cache.get(room.voiceChannelId);
          if (vc) {
            await ensureVoiceConnection(state, vc, state.client);
            await playNext(state, state.client);
          }
        } catch (e) {
          console.error('[Music] Room heartbeat reconnect failed:', e.message);
        }
      }
    }
  }
}, ROOM_PULSE_INTERVAL);

// ─── SLASH COMMAND DEFINITIONS ────────────────────────────────────
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const MUSIC_COMMANDS = [
  new SlashCommandBuilder()
    .setName('music')
    .setDescription('🎵 AEGIS Music — world-class playback engine')
    .addSubcommand(s => s.setName('play').setDescription('▶️ Play a track or URL')
      .addStringOption(o => o.setName('query').setDescription('Song name, YouTube/Spotify/SoundCloud URL').setRequired(true)))
    .addSubcommand(s => s.setName('search').setDescription('🔍 Search and pick a track')
      .addStringOption(o => o.setName('query').setDescription('Search query').setRequired(true)))
    .addSubcommand(s => s.setName('skip').setDescription('⏭️ Skip the current track'))
    .addSubcommand(s => s.setName('stop').setDescription('⏹️ Stop playback and clear queue'))
    .addSubcommand(s => s.setName('pause').setDescription('⏸️ Pause playback'))
    .addSubcommand(s => s.setName('resume').setDescription('▶️ Resume playback'))
    .addSubcommand(s => s.setName('nowplaying').setDescription('🎵 Show current track info'))
    .addSubcommand(s => s.setName('queue').setDescription('📋 View the queue')
      .addIntegerOption(o => o.setName('page').setDescription('Page number').setRequired(false).setMinValue(1)))
    .addSubcommand(s => s.setName('volume').setDescription('🔊 Set volume (0-100)')
      .addIntegerOption(o => o.setName('level').setDescription('Volume level 0-100').setRequired(true).setMinValue(0).setMaxValue(100)))
    .addSubcommand(s => s.setName('loop').setDescription('🔂 Toggle loop mode')
      .addStringOption(o => o.setName('mode').setDescription('Loop mode').setRequired(false)
        .addChoices({name:'Track',value:'track'},{name:'Queue',value:'queue'},{name:'Off',value:'off'})))
    .addSubcommand(s => s.setName('shuffle').setDescription('🔀 Toggle shuffle mode'))
    .addSubcommand(s => s.setName('launchpad').setDescription('🎛️ Open the interactive music control panel'))
    .addSubcommand(s => s.setName('remove').setDescription('🗑️ Remove a track from queue')
      .addIntegerOption(o => o.setName('position').setDescription('Track position').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('move').setDescription('↕️ Move a track in queue')
      .addIntegerOption(o => o.setName('from').setDescription('From position').setRequired(true).setMinValue(1))
      .addIntegerOption(o => o.setName('to').setDescription('To position').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('clear').setDescription('🗑️ Clear the entire queue'))
    .addSubcommand(s => s.setName('room').setDescription('🎭 Set a permanent mood room')
      .addStringOption(o => o.setName('room').setDescription('Mood preset').setRequired(true)
        .addChoices(
          {name:'Off — Custom Queue',    value:'off'},
          {name:'🌙 Midnight Lo-fi',     value:'midnight-lofi'},
          {name:'🌊 Synthwave Lounge',   value:'synthwave-lounge'},
          {name:'🌌 Ambient Void',       value:'ambient-void'},
          {name:'⚔️ Raid Prep',          value:'raid-prep'},
          {name:'🎉 Party Room',         value:'party-room'},
        ))),
  new SlashCommandBuilder()
    .setName('setup-music')
    .setDescription('[ADMIN] Set up a permanent 24/7 music room')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o => o.setName('voice').setDescription('Voice channel for music').setRequired(true))
    .addChannelOption(o => o.setName('text').setDescription('Text channel for now-playing').setRequired(true))
    .addStringOption(o => o.setName('mood').setDescription('Mood preset').setRequired(true)
      .addChoices(
        {name:'🌙 Midnight Lo-fi',     value:'midnight-lofi'},
        {name:'🌊 Synthwave Lounge',   value:'synthwave-lounge'},
        {name:'🌌 Ambient Void',       value:'ambient-void'},
        {name:'⚔️ Raid Prep',          value:'raid-prep'},
        {name:'🎉 Party Room',         value:'party-room'},
      )),
].map(c => c.toJSON());

// ─── MAIN DISPATCH ────────────────────────────────────────────────
async function handleMusicCommand(interaction, client) {
  if (!interaction.isChatInputCommand()) return false;

  const cmd = interaction.commandName;
  const sub = interaction.options.getSubcommand?.(false);

  if (cmd === 'setup-music') {
    if (!interaction.member?.permissions?.has('ManageChannels')) {
      return interaction.editReply('⛔ Manage Channels permission required.');
    }
    const vc   = interaction.options.getChannel('voice');
    const tc   = interaction.options.getChannel('text');
    const mood = interaction.options.getString('mood');
    try {
      await setupPermanentRoom(interaction.guild, vc.id, tc.id, mood, client);
      const preset = MOOD_PRESETS[mood];
      return interaction.editReply({ embeds: [
        new EmbedBuilder()
          .setColor(preset.color)
          .setTitle(`${preset.emoji} Permanent Room Set Up!`)
          .setDescription(`**${preset.label}** is now active in ${vc} / ${tc}\nAutomatic reconnect and endless stream enabled.`)
          .setFooter(FT)
      ]});
    } catch (e) {
      return interaction.editReply(`⚠️ ${e.message}`);
    }
  }

  if (cmd !== 'music') return false;

  if (sub === 'play')       return cmdPlay(interaction, client);
  if (sub === 'search')     return cmdSearch(interaction, client);
  if (sub === 'skip')       return cmdSkip(interaction, client);
  if (sub === 'stop')       return cmdStop(interaction, client);
  if (sub === 'pause')      return cmdPause(interaction);
  if (sub === 'resume')     return cmdResume(interaction);
  if (sub === 'nowplaying') return cmdNowPlaying(interaction);
  if (sub === 'queue')      return cmdQueue(interaction);
  if (sub === 'volume')     return cmdVolume(interaction, client);
  if (sub === 'loop')       return cmdLoop(interaction, client);
  if (sub === 'shuffle')    return cmdShuffle(interaction, client);
  if (sub === 'launchpad')  return cmdLaunchpad(interaction, client);
  if (sub === 'remove')     return cmdRemove(interaction);
  if (sub === 'move')       return cmdMove(interaction);
  if (sub === 'clear')      return cmdClearQueue(interaction);
  if (sub === 'room')       return cmdMoodRoom(interaction, client);

  return false;
}

module.exports = {
  MUSIC_COMMANDS,
  MOOD_PRESETS,
  handleMusicCommand,
  handleMusicButton,
  handleMusicSelect,
  getState,
  // For bot.js to hook in
  isMusicButton: (id) => id?.startsWith('music_'),
  isMusicSelect: (id) => id === 'music_mood' || id === 'music_search_select',
};
