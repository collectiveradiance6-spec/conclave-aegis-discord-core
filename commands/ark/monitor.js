// commands/ark/monitor.js — Server Monitor Management Commands
// /monitor-add  /monitor-remove  /monitor-list  /monitor-refresh  /monitor-channels
'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { sb, sbOk } = require('../../services/supabase');
const { isAdmin, base, C, FT } = require('../../config/constants');
const { createChannels, queryServer, refreshGuild, buildVcName } = require('../../monitors/serverMonitor');

// ── /monitor-add ──────────────────────────────────────────────────────
const monitorAdd = {
  data: new SlashCommandBuilder()
    .setName('monitor-add')
    .setDescription('[Admin] ➕ Add a server to the live monitor')
    .addStringOption(o => o.setName('name').setDescription('Display name (e.g. The Island)').setRequired(true))
    .addStringOption(o => o.setName('ip').setDescription('Server IP address').setRequired(true))
    .addIntegerOption(o => o.setName('port').setDescription('Query port').setRequired(true))
    .addStringOption(o => o.setName('emoji').setDescription('Optional emoji (e.g. 🌿)'))
    .addBooleanOption(o => o.setName('pvp').setDescription('PvP server? (shows ⚔️)'))
    .addBooleanOption(o => o.setName('patreon').setDescription('Patreon exclusive? (shows ⭐)'))
    .addStringOption(o => o.setName('channel').setDescription('Existing voice channel ID (leave blank to auto-create later)'))
    .addStringOption(o => o.setName('nitrado-id').setDescription('Nitrado service ID (for API status — most accurate)'))
    .addIntegerOption(o => o.setName('order').setDescription('Sort order (1, 2, 3...)').setMinValue(0)),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    if (!sb || !sbOk()) return interaction.editReply('⚠️ Database unavailable.');

    const name    = interaction.options.getString('name');
    const ip      = interaction.options.getString('ip').trim();
    const port    = interaction.options.getInteger('port');
    const emoji   = interaction.options.getString('emoji') || null;
    const pvp     = interaction.options.getBoolean('pvp') || false;
    const patreon = interaction.options.getBoolean('patreon') || false;
    const vcId    = interaction.options.getString('channel')?.trim() || null;
    const nitradoId = interaction.options.getString('nitrado-id')?.trim() || null;
    const order     = interaction.options.getInteger('order') ?? 99;

    // Upsert — update existing entry if name matches, create if new
    const { data:existing } = await sb.from('aegis_server_monitors')
      .select('id').eq('guild_id', interaction.guildId).eq('server_name', name).maybeSingle();

    const upsertData = {
      guild_id:         interaction.guildId,
      server_name:      name,
      ip, port,
      emoji,
      is_pvp:           pvp,
      is_patreon:       patreon,
      voice_channel_id: vcId,
      nitrado_id:       nitradoId,
      sort_order:       order,
      active:           true,
      created_at:       new Date().toISOString(),
    };

    let error;
    if (existing?.id) {
      // Update existing record
      const { error:e } = await sb.from('aegis_server_monitors')
        .update({ ...upsertData, created_at:undefined }).eq('id', existing.id);
      error = e;
    } else {
      const { error:e } = await sb.from('aegis_server_monitors').insert({ ...upsertData, guild_id: interaction.guildId });
      error = e;
    }
    if (error) return interaction.editReply(`⚠️ Database error: ${error.message}`);
    const action = existing?.id ? 'Updated' : 'Added';

    // Test ping
    const { online, players } = await queryServer(ip, port);
    const badge = pvp ? '⚔️' : patreon ? '⭐' : emoji || '';
    const preview = buildVcName({ server_name:name, is_pvp:pvp, is_patreon:patreon }, online, players);

    return interaction.editReply({ embeds: [
      base(`${existing?.id ? '✏️ Updated' : '➕ Added'}: ${name}`, C.gr)
        .addFields(
          { name: '📡 Server',    value: `${ip}:${port}`, inline: true },
          { name: '🎮 Status',    value: online ? `🟢 Online · ${players}p` : '🔴 Offline', inline: true },
          { name: '🔖 Badge',     value: badge || 'None', inline: true },
          { name: '🔊 VC Preview',value: `\`${preview}\``, inline: false },
          { name: '📋 Next Step', value: vcId ? 'Voice channel linked ✅' : 'Run `/monitor-channels` to auto-create voice channels', inline: false },
        )
    ]});
  },
};

// ── /monitor-remove ───────────────────────────────────────────────────
const monitorRemove = {
  data: new SlashCommandBuilder()
    .setName('monitor-remove')
    .setDescription('[Admin] ➖ Remove a server from the monitor')
    .addStringOption(o => o.setName('name').setDescription('Server name to remove').setRequired(true)),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    if (!sb || !sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const name = interaction.options.getString('name');
    const { error } = await sb.from('aegis_server_monitors')
      .delete().eq('guild_id', interaction.guildId).ilike('server_name', name);
    if (error) return interaction.editReply(`⚠️ ${error.message}`);
    return interaction.editReply(`✅ **${name}** removed from monitor.`);
  },
};

// ── /monitor-list ─────────────────────────────────────────────────────
const monitorList = {
  data: new SlashCommandBuilder()
    .setName('monitor-list')
    .setDescription('📋 List all monitored servers for this guild'),

  async execute(interaction) {
    if (!sb || !sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const { data } = await sb.from('aegis_server_monitors')
      .select('*').eq('guild_id', interaction.guildId).eq('active', true).order('sort_order');
    if (!data?.length) return interaction.editReply('📭 No servers configured. Use `/monitor-add` to add one.');

    const lines = data.map(s => {
      const badge = s.is_pvp ? '⚔️' : s.is_patreon ? '⭐' : s.emoji || '•';
      const vc    = s.voice_channel_id ? `<#${s.voice_channel_id}>` : '⚪ No VC';
      return `${badge} **${s.server_name}** · \`${s.ip}:${s.port}\` · ${vc}`;
    }).join('\n');

    return interaction.editReply({ embeds: [
      base(`🖥️ Server Monitor — ${data.length} servers`, C.cy)
        .setDescription(lines)
        .setFooter({ ...FT, text: 'Updates every 5 minutes · /monitor-refresh to force update' })
    ]});
  },
};

// ── /monitor-refresh ──────────────────────────────────────────────────
const monitorRefresh = {
  data: new SlashCommandBuilder()
    .setName('monitor-refresh')
    .setDescription('[Admin] 🔄 Force refresh all server statuses now'),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await interaction.editReply('🔄 Refreshing all server statuses...');
    await refreshGuild(interaction.client, interaction.guildId);
    return interaction.editReply('✅ Voice channels updated. Changes may take a few seconds to appear in Discord.');
  },
};

// ── /monitor-channels ─────────────────────────────────────────────────
const monitorChannels = {
  data: new SlashCommandBuilder()
    .setName('monitor-channels')
    .setDescription('[Admin] 🔊 Auto-create voice channels for all monitored servers')
    .addStringOption(o => o.setName('category').setDescription('Category ID to create channels in (or set in /setup-aegis)')),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    if (!sb || !sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    await interaction.editReply('⏳ Creating voice channels...');

    const guildManager = require('../../managers/guildManager');
    const cfg = await guildManager.getConfig(interaction.guildId) || {};
    const catId = interaction.options.getString('category') || cfg.monitor_category_id;

    const { data } = await sb.from('aegis_server_monitors')
      .select('voice_channel_id').eq('guild_id', interaction.guildId).eq('active', true);
    const { created, errors } = await createChannels(interaction.guild, interaction.guildId, catId);

    const alreadyHave = data.filter(s => s.voice_channel_id).length;
    let reply = `✅ Created **${created}** voice channel(s).`;
    if (alreadyHave > 0) reply += `\n📌 **${alreadyHave}** server(s) already had voice channels linked — skipped.`;
    if (errors.length) reply += `\n\n⚠️ **Errors:**\n${errors.map(e=>`• ${e}`).join('\n')}`;
    if (!catId) reply += '\n\n💡 Tip: Set a category in `/setup-aegis` → 📡 Server Monitor so channels are grouped together.';
    if (created === 0 && alreadyHave === 0) reply += '\n\n❌ No servers found or all creation failed. Check bot has **Manage Channels** permission.';

    return interaction.editReply(reply);
  },
};

// ── /monitor-status ───────────────────────────────────────────────────
const monitorStatus = {
  data: new SlashCommandBuilder()
    .setName('monitor-status')
    .setDescription('🖥️ Live status check of all monitored servers'),

  async execute(interaction) {
    if (!sb || !sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const { data } = await sb.from('aegis_server_monitors')
      .select('*').eq('guild_id', interaction.guildId).eq('active', true).order('sort_order');
    if (!data?.length) return interaction.editReply('📭 No servers configured. Use `/monitor-add`.');

    await interaction.editReply('🔍 Querying servers...');

    const results = await Promise.all(
      data.map(async s => {
        const { online, players } = await queryServer(s.ip, s.port);
        return { ...s, online, players };
      })
    );

    const onlineCount = results.filter(r => r.online).length;
    const totalPlayers = results.filter(r => r.online).reduce((a, r) => a + r.players, 0);

    const lines = results.map(s => {
      const badge = s.is_pvp ? '⚔️' : s.is_patreon ? '⭐' : '';
      const dot   = s.online ? '🟢' : '🔴';
      const stat  = s.online ? `${s.players}p` : 'Offline';
      return `${dot} ${badge}**${s.server_name}** — ${stat}`;
    }).join('\n');

    return interaction.editReply({ embeds: [
      new EmbedBuilder()
        .setColor(onlineCount > 0 ? C.gr : C.rd)
        .setTitle('🖥️ Live Cluster Status')
        .setDescription(lines)
        .addFields(
          { name: '🟢 Online', value: `${onlineCount}/${results.length}`, inline: true },
          { name: '👥 Players', value: `${totalPlayers}`, inline: true },
          { name: '⏰ Checked', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
        )
        .setFooter(FT)
        .setTimestamp()
    ]});
  },
};

// ── /monitor-clear ────────────────────────────────────────────────────
const monitorClear = {
  data: new SlashCommandBuilder()
    .setName('monitor-clear')
    .setDescription('[Admin] 🗑️ Remove ALL servers from this guild\'s monitor (fresh start)')
    .addBooleanOption(o => o.setName('confirm').setDescription('Type True to confirm').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    if (!interaction.options.getBoolean('confirm')) return interaction.editReply('⚠️ Set confirm:True to proceed.');
    if (!sb || !sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const { error, count } = await sb.from('aegis_server_monitors')
      .delete().eq('guild_id', interaction.guildId);
    if (error) return interaction.editReply(`⚠️ ${error.message}`);
    return interaction.editReply('✅ All monitor entries cleared. Re-add servers with `/monitor-add`.');
  },
};

module.exports = [monitorAdd, monitorRemove, monitorList, monitorRefresh, monitorChannels, monitorStatus, monitorClear];
