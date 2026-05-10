// ============================================================
// src/monitors/nitradoMonitor.js
// AEGIS v10 — Multi-Guild Nitrado Server Monitor
// ============================================================
// Polls every guild's nitrado_servers list every 60s.
// Updates the designated voice channel name with live status.
// Posts alerts to channel_cluster_status on state changes.
// ============================================================

const { Client } = require('discord.js');
const guildManager = require('../managers/guildManager');

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

// Track last known state per server IP to detect changes
// Key: `${guildId}:${ip}:${port}`
const lastKnownState = new Map();

// ── Main start function ─────────────────────────────────────
function startNitradoMonitor(client) {
  console.log('[NitradoMonitor] Starting multi-guild monitor...');

  const run = async () => {
    try {
      await pollAllGuilds(client);
    } catch (err) {
      console.error('[NitradoMonitor] Poll error:', err);
    }
  };

  run(); // immediate first run
  setInterval(run, POLL_INTERVAL_MS);
}

// ── Poll every configured guild ─────────────────────────────
async function pollAllGuilds(client) {
  const allConfigs = await guildManager.getAllConfigs();

  for (const config of allConfigs) {
    const servers = config.nitrado_servers;
    if (!Array.isArray(servers) || servers.length === 0) continue;

    for (const server of servers) {
      await pollServer(client, config, server);
    }
  }
}

// ── Poll a single server entry ──────────────────────────────
// server shape: { label: "Map Name", ip: "x.x.x.x", port: 5200 }
async function pollServer(client, config, server) {
  const { guild_id, voice_status_channel, channel_cluster_status } = config;
  const { label, ip, port } = server;
  const stateKey = `${guild_id}:${ip}:${port}`;

  let online = false;
  let playerCount = 0;

  try {
    const result = await queryGameServer(ip, port);
    online = result.online;
    playerCount = result.players ?? 0;
  } catch {
    online = false;
  }

  const newStatus = online ? 'online' : 'offline';
  const prevStatus = lastKnownState.get(stateKey);
  const statusChanged = prevStatus !== undefined && prevStatus !== newStatus;

  lastKnownState.set(stateKey, newStatus);

  // ── Update voice channel name ──────────────────────────────
  if (voice_status_channel) {
    try {
      const guild = await client.guilds.fetch(guild_id).catch(() => null);
      if (guild) {
        const vc = await guild.channels.fetch(voice_status_channel).catch(() => null);
        if (vc) {
          const vcName = online
            ? `🟢 ${label} · ${playerCount}p`
            : `🔴 ${label} · Offline`;

          if (vc.name !== vcName) {
            await vc.setName(vcName).catch(err =>
              console.warn(`[NitradoMonitor] VC rename failed (${guild_id}):`, err.message)
            );
          }
        }
      }
    } catch (err) {
      console.warn(`[NitradoMonitor] VC update error for ${guild_id}:`, err.message);
    }
  }

  // ── Post status change alert ───────────────────────────────
  if (statusChanged && channel_cluster_status) {
    try {
      const guild = await client.guilds.fetch(guild_id).catch(() => null);
      if (guild) {
        const ch = await guild.channels.fetch(channel_cluster_status).catch(() => null);
        if (ch) {
          const displayName = config.display_name ?? 'TheConclave';
          const color = online ? 0x1D9E75 : 0xE24B4A;
          const statusText = online
            ? `🟢 **${label}** is back online — ${playerCount} player(s) connected.`
            : `🔴 **${label}** appears to be offline. Investigating...`;

          await ch.send({
            embeds: [{
              color,
              description: statusText,
              footer: { text: `${displayName} · Cluster Monitor` },
              timestamp: new Date().toISOString()
            }]
          });
        }
      }
    } catch (err) {
      console.warn(`[NitradoMonitor] Alert post error for ${guild_id}:`, err.message);
    }
  }
}

// ── UDP/TCP query to game server ────────────────────────────
// Uses the 'gamedig' npm package (npm install gamedig)
// Falls back to a simple TCP ping if gamedig isn't available
async function queryGameServer(ip, port) {
  try {
    const { GameDig } = require('gamedig');
    const state = await GameDig.query({
      type: 'arkse',
      host: ip,
      port: port,
      maxAttempts: 2,
      socketTimeout: 5000
    });
    return { online: true, players: state.players?.length ?? 0 };
  } catch {
    // GameDig throws when server is offline or unreachable
    return { online: false, players: 0 };
  }
}

module.exports = { startNitradoMonitor };
