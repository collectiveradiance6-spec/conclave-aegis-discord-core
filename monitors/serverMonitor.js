// ═══════════════════════════════════════════════════════════════════════
// monitors/serverMonitor.js — Multi-Guild Live Server Monitor v2
// One voice channel per server, updated every 5 minutes via gamedig
// Naming: 🟢 ⚔️• Aberration-3p  |  🔴 • The Island-Off
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { sb, sbOk } = require('../services/supabase');
const guildManager = require('../managers/guildManager');

// Discord rate-limits channel renames to 2/10min per channel
// We stagger updates to avoid hitting the limit
const POLL_MS       = 5 * 60 * 1000;  // 5 minutes between full sweeps
const RENAME_DELAY  = 4_000;           // 4s between each rename to avoid rate limit
const lastState     = new Map();       // guildId:serverId → 'online'|'offline'

// ── Start ────────────────────────────────────────────────────────────
function startMonitor(client) {
  console.log('[Monitor] 🖥️  Server monitor started — polling every 5 min');
  const run = async () => {
    try { await pollAll(client); }
    catch(e) { console.error('[Monitor] Poll error:', e.message); }
  };
  setTimeout(run, 10_000); // initial delay — let bot finish startup
  setInterval(run, POLL_MS);
}

// ── Poll all guilds ───────────────────────────────────────────────────
async function pollAll(client) {
  if (!sb || !sbOk()) return;
  const { data: servers } = await sb
    .from('aegis_server_monitors')
    .select('*')
    .eq('active', true)
    .order('guild_id')
    .order('sort_order');

  if (!servers?.length) return;

  // Group by guild
  const byGuild = {};
  for (const s of servers) {
    if (!byGuild[s.guild_id]) byGuild[s.guild_id] = [];
    byGuild[s.guild_id].push(s);
  }

  for (const [guildId, guildServers] of Object.entries(byGuild)) {
    await pollGuild(client, guildId, guildServers);
  }
}

// ── Poll one guild's servers ──────────────────────────────────────────
async function pollGuild(client, guildId, servers) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const cfg     = await guildManager.getConfig(guildId) || {};
  const alertCh = cfg.monitor_alert_channel;

  for (const srv of servers) {
    const { online, players } = await queryServer(srv.ip, srv.port);
    const stateKey = `${guildId}:${srv.id}`;
    const prevState = lastState.get(stateKey);
    const changed   = prevState !== undefined && prevState !== (online ? 'online' : 'offline');
    lastState.set(stateKey, online ? 'online' : 'offline');

    // ── Update voice channel name ─────────────────────────────────
    if (srv.voice_channel_id) {
      const vcName = buildVcName(srv, online, players);
      try {
        const vc = await guild.channels.fetch(srv.voice_channel_id).catch(() => null);
        if (vc && vc.name !== vcName) {
          await vc.setName(vcName);
          await new Promise(r => setTimeout(r, RENAME_DELAY));
        }
      } catch(e) {
        if (!e.message?.includes('Missing Permissions')) {
          console.warn(`[Monitor] Rename failed ${srv.server_name}:`, e.message);
        }
      }
    }

    // ── Post status change alert ──────────────────────────────────
    if (changed && alertCh) {
      const ch = guild.channels.cache.get(alertCh);
      if (ch) {
        ch.send({
          embeds: [{
            color: online ? 0x35ED7E : 0xFF4500,
            description: online
              ? `🟢 **${srv.server_name}** is back online — ${players} player(s) connected.`
              : `🔴 **${srv.server_name}** appears to be offline.`,
            footer: { text: `${cfg.display_name||'Cluster'} · Server Monitor` },
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});
      }
    }
  }
}

// ── Voice channel name format ─────────────────────────────────────────
// 🟢 ⚔️• Aberration-3p  |  🟢 ⭐• Amissa-0p  |  🔴 • The Island-Off
function buildVcName(srv, online, players) {
  const dot   = online ? '🟢' : '🔴';
  const badge = srv.is_pvp ? '⚔️' : srv.is_patreon ? '⭐' : '';
  const sep   = badge ? `${badge}•` : '•';
  const count = online ? `${players}p` : 'Off';
  return `${dot} ${sep} ${srv.server_name}-${count}`.slice(0, 100);
}

// ── Auto-create voice channels for a guild ────────────────────────────
async function createChannels(guild, guildId, categoryId) {
  if (!sb || !sbOk()) return { created: 0, errors: [] };
  const { data: servers } = await sb
    .from('aegis_server_monitors')
    .select('*')
    .eq('guild_id', guildId)
    .eq('active', true)
    .order('sort_order');

  if (!servers?.length) return { created: 0, errors: [] };

  const category = categoryId
    ? await guild.channels.fetch(categoryId).catch(() => null)
    : null;

  let created = 0;
  const errors = [];

  for (const srv of servers) {
    if (srv.voice_channel_id) continue; // already has a channel
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
        .update({ voice_channel_id: vc.id })
        .eq('id', srv.id);
      created++;
      await new Promise(r => setTimeout(r, 800));
    } catch(e) {
      errors.push(`${srv.server_name}: ${e.message}`);
    }
  }
  return { created, errors };
}

// ── gamedig query ─────────────────────────────────────────────────────
async function queryServer(ip, port) {
  if (!ip || !port) return { online: false, players: 0 };
  try {
    let GameDig;
    try { GameDig = require('gamedig').GameDig; } catch { GameDig = require('gamedig'); }
    const state = await GameDig.query({
      type: 'arkse', host: ip, port: Number(port),
      maxAttempts: 2, socketTimeout: 5000,
    });
    return { online: true, players: state.players?.length ?? 0 };
  } catch {
    return { online: false, players: 0 };
  }
}

// ── Force refresh one guild (called from /monitor-refresh) ────────────
async function refreshGuild(client, guildId) {
  if (!sb || !sbOk()) return;
  const { data: servers } = await sb
    .from('aegis_server_monitors')
    .select('*').eq('guild_id', guildId).eq('active', true).order('sort_order');
  if (servers?.length) await pollGuild(client, guildId, servers);
}

module.exports = { startMonitor, createChannels, queryServer, refreshGuild, buildVcName };
