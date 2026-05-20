// ═══════════════════════════════════════════════════════════════════════
// monitors/serverMonitor.js — Live Server Monitor v3.0
// Real-time-ish Nitrado monitor with:
// • Live status
// • Active player counts
// • Smart log throttling
// • Reduced Render spam
// • Discord-safe VC renames
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const {
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const { sb, sbOk } = require('../services/supabase');
const guildManager = require('../managers/guildManager');

// ── Config ────────────────────────────────────────────────────────────
const POLL_MS            = 2 * 60 * 1000; // every 2 min
const RENAME_DELAY       = 5500;
const LOG_REPEAT_MS      = 15 * 60 * 1000; // suppress identical logs
const STATUS_CACHE       = new Map();
const LAST_LOGGED_STATE  = new Map();

// ── Start Monitor ────────────────────────────────────────────────────
function startMonitor(client) {
  console.log('[Monitor] 🖥️ Live Server Monitor v3.0 started');

  const run = async () => {
    try {
      await pollAll(client);
    } catch (err) {
      console.error('[Monitor] Poll error:', err.message);
    }
  };

  // warmup
  setTimeout(run, 15000);

  // recurring
  setInterval(run, POLL_MS);
}

// ── Poll All Guilds ──────────────────────────────────────────────────
async function pollAll(client) {
  if (!sb || !sbOk()) return;

  const { data: servers, error } = await sb
    .from('aegis_server_monitors')
    .select('*')
    .eq('active', true)
    .order('guild_id')
    .order('sort_order');

  if (error) {
    console.error('[Monitor] DB Error:', error.message);
    return;
  }

  if (!servers?.length) return;

  const grouped = {};

  for (const srv of servers) {
    if (!grouped[srv.guild_id]) {
      grouped[srv.guild_id] = [];
    }

    grouped[srv.guild_id].push(srv);
  }

  for (const [guildId, guildServers] of Object.entries(grouped)) {
    await pollGuild(client, guildId, guildServers);
  }
}

// ── Poll Single Guild ────────────────────────────────────────────────
async function pollGuild(client, guildId, servers) {
  const guild =
    client.guilds.cache.get(guildId) ||
    await client.guilds.fetch(guildId).catch(() => null);

  if (!guild) return;

  const config = await guildManager.getConfig(guildId) || {};

  const apiKey =
    config.monitor_nitrado_key ||
    process.env.NITRADO_API_KEY;

  const alertChannelId = config.monitor_alert_channel;

  for (const srv of servers) {
    const result = await queryServer(srv, apiKey);

    const online = result.online;
    const players = result.players;

    const cacheKey = `${guildId}:${srv.id}`;
    const oldState = STATUS_CACHE.get(cacheKey);

    const newState = {
      online,
      players,
    };

    STATUS_CACHE.set(cacheKey, newState);

    // ── Smart Logging ─────────────────────────────────────────────
    maybeLogState(srv, newState);

    // ── VC Rename ────────────────────────────────────────────────
    if (srv.voice_channel_id) {
      await updateVoiceChannel(guild, srv, online, players);
    }

    // ── Alerts ───────────────────────────────────────────────────
    const changed =
      !oldState ||
      oldState.online !== online;

    if (changed && alertChannelId) {
      await sendStatusAlert(
        guild,
        alertChannelId,
        srv,
        online,
        players,
        config
      );
    }
  }
}

// ── Smart Logging ────────────────────────────────────────────────────
function maybeLogState(server, state) {
  const key = server.id;

  const old = LAST_LOGGED_STATE.get(key);

  const now = Date.now();

  const fingerprint =
    `${state.online}:${state.players}`;

  if (
    old &&
    old.fingerprint === fingerprint &&
    (now - old.time) < LOG_REPEAT_MS
  ) {
    return;
  }

  LAST_LOGGED_STATE.set(key, {
    fingerprint,
    time: now,
  });

  console.log(
    `[Monitor] ${server.server_name}: ${
      state.online ? '🟢 Online' : '🔴 Offline'
    } (${state.players}p)`
  );
}

// ── Voice Channel Rename ─────────────────────────────────────────────
async function updateVoiceChannel(guild, srv, online, players) {
  try {
    const vc =
      guild.channels.cache.get(srv.voice_channel_id) ||
      await guild.channels.fetch(srv.voice_channel_id).catch(() => null);

    if (!vc) return;

    const newName = buildVcName(srv, online, players);

    if (vc.name === newName) return;

    await vc.setName(newName);

    console.log(`[Monitor] ✅ VC Updated → ${newName}`);

    await sleep(RENAME_DELAY);

  } catch (err) {
    if (
      err.message?.includes('rate limit') ||
      err.message?.includes('Missing Permissions')
    ) {
      return;
    }

    console.warn(
      `[Monitor] VC Rename Failed (${srv.server_name}):`,
      err.message
    );
  }
}

// ── Send Status Alert ────────────────────────────────────────────────
async function sendStatusAlert(
  guild,
  channelId,
  srv,
  online,
  players,
  config
) {
  try {
    const channel =
      guild.channels.cache.get(channelId) ||
      await guild.channels.fetch(channelId).catch(() => null);

    if (!channel) return;

    await channel.send({
      embeds: [{
        color: online ? 0x35ED7E : 0xFF4500,
        description: online
          ? `🟢 **${srv.server_name}** is online — **${players}** player(s) connected.`
          : `🔴 **${srv.server_name}** is offline.`,
        footer: {
          text: `${config.display_name || guild.name} • Live Monitor`,
        },
        timestamp: new Date().toISOString(),
      }],
    });

  } catch {}
}

// ── VC Name Builder ──────────────────────────────────────────────────
function buildVcName(srv, online, players) {
  const dot = online ? '🟢' : '🔴';

  const badge =
    srv.is_pvp
      ? '⚔️'
      : srv.is_patreon
        ? '⭐'
        : '';

  const sep = badge ? `${badge}•` : '•';

  const status =
    online
      ? `${players}p`
      : 'OFF';

  return `${dot} ${sep} ${srv.server_name}-${status}`.slice(0, 100);
}

// ── Query Server ─────────────────────────────────────────────────────
async function queryServer(srv, apiKey) {

  // ── Nitrado API ───────────────────────────────────────────────
  if (srv.nitrado_id && apiKey) {
    try {

      const token = apiKey
        .replace(/^Bearer\s+/i, '')
        .trim();

      const url =
        `https://api.nitrado.net/services/${srv.nitrado_id}/gameservers`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(
          `[Monitor] Nitrado ${res.status} → ${srv.server_name}`
        );

        return {
          online: false,
          players: 0,
        };
      }

      const json = await res.json();

      const gs = json?.data?.gameserver;

      if (!gs) {
        return {
          online: false,
          players: 0,
        };
      }

      return {
        online: gs.status === 'started',
        players: parseInt(
          gs.query?.player_current ?? 0,
          10
        ),
      };

    } catch (err) {

      console.warn(
        `[Monitor] API Error (${srv.server_name}):`,
        err.message
      );
    }
  }

  // ── Fallback: GameDig ─────────────────────────────────────────
  if (srv.ip && srv.port) {
    try {

      let Gd;

      try {
        Gd = require('gamedig').GameDig;
      } catch {
        Gd = require('gamedig');
      }

      const state = await Gd.query({
        type: 'arkse',
        host: srv.ip,
        port: Number(srv.port),
        maxAttempts: 2,
        socketTimeout: 5000,
      });

      return {
        online: true,
        players: state.players?.length || 0,
      };

    } catch {}
  }

  return {
    online: false,
    players: 0,
  };
}

// ── Auto Create VC Channels ──────────────────────────────────────────
async function createChannels(guild, guildId, categoryId) {

  if (!sb || !sbOk()) {
    return { created: 0, errors: [] };
  }

  const { data: servers } = await sb
    .from('aegis_server_monitors')
    .select('*')
    .eq('guild_id', guildId)
    .eq('active', true)
    .order('sort_order');

  if (!servers?.length) {
    return { created: 0, errors: [] };
  }

  const category = categoryId
    ? await guild.channels.fetch(categoryId).catch(() => null)
    : null;

  let created = 0;

  const errors = [];

  for (const srv of servers) {

    if (srv.voice_channel_id) {
      continue;
    }

    try {

      const vc = await guild.channels.create({
        name: buildVcName(srv, false, 0),
        type: ChannelType.GuildVoice,
        parent: category?.id || null,
        permissionOverwrites: [{
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.Connect],
        }],
      });

      await sb
        .from('aegis_server_monitors')
        .update({
          voice_channel_id: vc.id,
        })
        .eq('id', srv.id);

      created++;

      await sleep(1000);

    } catch (err) {

      errors.push(
        `${srv.server_name}: ${err.message}`
      );
    }
  }

  return {
    created,
    errors,
  };
}

// ── Force Refresh ────────────────────────────────────────────────────
async function refreshGuild(client, guildId) {

  if (!sb || !sbOk()) return;

  const { data: servers } = await sb
    .from('aegis_server_monitors')
    .select('*')
    .eq('guild_id', guildId)
    .eq('active', true)
    .order('sort_order');

  if (!servers?.length) return;

  await pollGuild(client, guildId, servers);
}

// ── Utils ────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Exports ──────────────────────────────────────────────────────────
module.exports = {
  startMonitor,
  createChannels,
  queryServer,
  refreshGuild,
  buildVcName,
};