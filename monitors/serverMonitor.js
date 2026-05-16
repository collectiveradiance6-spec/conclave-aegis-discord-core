// ═══════════════════════════════════════════════════════════════════════
// monitors/serverMonitor.js — Live Server Monitor v2.1
// Uses Nitrado API (HTTPS) for accurate status + player count
// Gamedig UDP is blocked on most cloud hosts (Render) — API is reliable
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { sb, sbOk } = require('../services/supabase');
const guildManager  = require('../managers/guildManager');

const POLL_MS      = 5 * 60 * 1000;  // 5 min sweep
const RENAME_DELAY = 5_500;           // 5.5s between renames (Discord: 2/10min per channel)
const lastState    = new Map();        // guildId:id → 'online'|'offline'

// ── Start ─────────────────────────────────────────────────────────────
function startMonitor(client) {
  console.log('[Monitor] 🖥️  Server monitor v2.1 started (Nitrado API mode)');
  const run = async () => {
    try { await pollAll(client); }
    catch(e) { console.error('[Monitor] Poll error:', e.message); }
  };
  setTimeout(run, 15_000);       // wait for bot to fully init
  setInterval(run, POLL_MS);
}

// ── Poll all guilds ───────────────────────────────────────────────────
async function pollAll(client) {
  if (!sb || !sbOk()) return;
  const { data: servers } = await sb
    .from('aegis_server_monitors')
    .select('*')
    .eq('active', true)
    .order('guild_id').order('sort_order');
  if (!servers?.length) return;

  const byGuild = {};
  for (const s of servers) {
    if (!byGuild[s.guild_id]) byGuild[s.guild_id] = [];
    byGuild[s.guild_id].push(s);
  }
  for (const [gid, srvs] of Object.entries(byGuild)) {
    await pollGuild(client, gid, srvs);
  }
}

// ── Poll one guild ────────────────────────────────────────────────────
async function pollGuild(client, guildId, servers) {
  const guild = client.guilds.cache.get(guildId)
    || await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const cfg      = await guildManager.getConfig(guildId) || {};
  const apiKey   = cfg.monitor_nitrado_key || process.env.NITRADO_API_KEY;
  const alertChId = cfg.monitor_alert_channel;

  for (const srv of servers) {
    const { online, players } = await queryServer(srv, apiKey);
    const key      = `${guildId}:${srv.id}`;
    const prevState = lastState.get(key);
    const changed   = prevState !== undefined && prevState !== (online ? 'online' : 'offline');
    lastState.set(key, online ? 'online' : 'offline');

    // ── Rename voice channel ──────────────────────────────────────
    if (srv.voice_channel_id) {
      const name = buildVcName(srv, online, players);
      try {
        const vc = guild.channels.cache.get(srv.voice_channel_id)
          || await guild.channels.fetch(srv.voice_channel_id).catch(() => null);
        if (vc && vc.name !== name) {
          await vc.setName(name);
          console.log(`[Monitor] ✅ ${srv.server_name}: ${name}`);
          await new Promise(r => setTimeout(r, RENAME_DELAY));
        }
      } catch(e) {
        if (!e.message?.includes('Missing Permissions') && !e.message?.includes('rate limit')) {
          console.warn(`[Monitor] Rename failed ${srv.server_name}:`, e.message);
        }
      }
    }

    // ── Status change alert ───────────────────────────────────────
    if (changed && alertChId) {
      const ch = guild.channels.cache.get(alertChId);
      if (ch) {
        ch.send({ embeds: [{
          color:       online ? 0x35ED7E : 0xFF4500,
          description: online
            ? `🟢 **${srv.server_name}** is back online${players > 0 ? ` — ${players} player(s) connected` : ''}.`
            : `🔴 **${srv.server_name}** is offline. Monitoring continues.`,
          footer:    { text: `${cfg.display_name || 'Cluster'} · Server Monitor` },
          timestamp: new Date().toISOString(),
        }]}).catch(() => {});
      }
    }
  }
}

// ── Voice channel name ────────────────────────────────────────────────
// 🟢 ⚔️• Aberration-3p  |  🟢 ⭐• Amissa-0p  |  🔴 • The Island-Off
function buildVcName(srv, online, players) {
  const dot   = online ? '🟢' : '🔴';
  const badge = srv.is_pvp ? '⚔️' : srv.is_patreon ? '⭐' : '';
  const sep   = badge ? `${badge}•` : '•';
  const stat  = online ? `${players}p` : 'Off';
  return `${dot} ${sep} ${srv.server_name}-${stat}`.slice(0, 100);
}

// ── Query via Nitrado API (primary) or gamedig (fallback) ─────────────
async function queryServer(srv, apiKey) {
  // Primary: Nitrado API — works from any cloud host over HTTPS
  if (srv.nitrado_id && apiKey) {
    try {
      const res = await fetch(
        `https://api.nitrado.net/services/${srv.nitrado_id}/gameservers`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal:  AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const json = await res.json();
        const gs   = json?.data?.gameserver;
        if (gs) {
          const online  = gs.status === 'started';
          const players = parseInt(gs.query?.player_current ?? 0, 10);
          return { online, players };
        }
      }
    } catch(e) {
      console.warn(`[Monitor] Nitrado API error for ${srv.server_name}:`, e.message);
    }
  }

  // Fallback: gamedig UDP (may fail on restricted networks)
  if (srv.ip && srv.port) {
    try {
      let Gd;
      try { Gd = require('gamedig').GameDig; } catch { Gd = require('gamedig'); }
      const state = await Gd.query({
        type: 'arkse', host: srv.ip, port: Number(srv.port),
        maxAttempts: 2, socketTimeout: 5000,
      });
      return { online: true, players: state.players?.length ?? 0 };
    } catch { /* offline */ }
  }

  return { online: false, players: 0 };
}

// ── Auto-create locked voice channels ────────────────────────────────
async function createChannels(guild, guildId, categoryId) {
  if (!sb || !sbOk()) return { created: 0, errors: [] };
  const { data: servers } = await sb
    .from('aegis_server_monitors')
    .select('*').eq('guild_id', guildId).eq('active', true).order('sort_order');
  if (!servers?.length) return { created: 0, errors: [] };

  const category = categoryId
    ? await guild.channels.fetch(categoryId).catch(() => null)
    : null;

  let created = 0;
  const errors = [];

  for (const srv of servers) {
    if (srv.voice_channel_id) continue;
    try {
      const vc = await guild.channels.create({
        name:   buildVcName(srv, false, 0),
        type:   ChannelType.GuildVoice,
        parent: category?.id || null,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] },
        ],
      });
      await sb.from('aegis_server_monitors')
        .update({ voice_channel_id: vc.id }).eq('id', srv.id);
      created++;
      await new Promise(r => setTimeout(r, 800));
    } catch(e) {
      errors.push(`${srv.server_name}: ${e.message}`);
    }
  }
  return { created, errors };
}

// ── Force refresh one guild ───────────────────────────────────────────
async function refreshGuild(client, guildId) {
  if (!sb || !sbOk()) return;
  const { data: servers } = await sb
    .from('aegis_server_monitors')
    .select('*').eq('guild_id', guildId).eq('active', true).order('sort_order');
  if (servers?.length) await pollGuild(client, guildId, servers);
}

module.exports = { startMonitor, createChannels, queryServer, refreshGuild, buildVcName };
