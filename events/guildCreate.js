// ═══════════════════════════════════════════════════════════════════════
// events/guildCreate.js
// Fires when AEGIS joins a new server
// Auto-provisions guild config + sends /setup-aegis prompt to owner
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events } = require('discord.js');
const guildManager = require('../managers/guildManager');
const wsServer     = require('../launchpad/wsServer');

module.exports = {
  name: Events.GuildCreate,
  once: false,

  async execute(guild, client) {
    console.log(`[GuildCreate] AEGIS joined: ${guild.name} (${guild.id}) — ${guild.memberCount} members`);

    // 1. Provision guild config in Supabase
    await guildManager.provision(guild.id, guild.name);

    // 2. Broadcast to launchpad dashboard
    wsServer.broadcast({ type: 'guild_join', guildId: guild.id, guildName: guild.name, memberCount: guild.memberCount, ts: Date.now() });

    // 3. Try to send welcome DM to guild owner
    try {
      const owner = await guild.fetchOwner();
      if (!owner) return;

      const embed = new EmbedBuilder()
        .setColor(0x7B2FFF)
        .setTitle('⚔️ AEGIS has joined your server!')
        .setDescription(
          `**Thank you for adding AEGIS to ${guild.name}!**\n\n` +
          `I'm the sovereign intelligence powering TheConclave Dominion — ` +
          `now available for any Discord community.\n\n` +
          `**To get started, run \`/setup-aegis\` in your server** ` +
          `to configure channels, roles, and features.\n\n` +
          `The setup wizard will walk you through everything in under 2 minutes.`
        )
        .addFields(
          { name: '🚀 Quick Start', value: 'Run `/setup-aegis` in your server as an admin', inline:false },
          { name: '📖 Commands', value: 'Run `/help` to see all available commands', inline:true },
          { name: '🌐 Dashboard', value: 'https://aegis.theconclavedominion.com', inline:true },
          { name: '💬 Support', value: 'https://discord.gg/theconclave', inline:true },
        )
        .setFooter({ text: 'AEGIS · TheConclave Dominion · Powered by Anthropic' })
        .setThumbnail(client.user?.displayAvatarURL({ size:128 }) || null)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('🌐 Dashboard').setStyle(ButtonStyle.Link).setURL('https://aegis.theconclavedominion.com'),
        new ButtonBuilder().setLabel('💬 Support Server').setStyle(ButtonStyle.Link).setURL('https://discord.gg/theconclave'),
        new ButtonBuilder().setLabel('📖 Documentation').setStyle(ButtonStyle.Link).setURL('https://aegis.theconclavedominion.com/docs'),
      );

      await owner.send({ embeds:[embed], components:[row] });
      console.log(`[GuildCreate] Sent welcome DM to ${owner.user.tag} (${guild.name})`);
    } catch (e) {
      console.warn(`[GuildCreate] Could not DM owner of ${guild.name}:`, e.message);
    }

    // 4. Try to post setup prompt in system channel or first text channel
    try {
      const ch = guild.systemChannel || guild.channels.cache
        .filter(c => c.isTextBased() && !c.isThread() && c.permissionsFor(guild.members.me)?.has('SendMessages'))
        .sort((a,b) => a.position - b.position)
        .first();

      if (!ch) return;

      const embed = new EmbedBuilder()
        .setColor(0x7B2FFF)
        .setTitle('⚔️ AEGIS is here!')
        .setDescription(
          `I'm **AEGIS** — AI-powered Discord bot with ClaveShard economy, trivia, moderation, server monitoring, and more.\n\n` +
          `**An admin needs to run \`/setup-aegis\` to configure me for this server.**\n\n` +
          `Setup takes under 2 minutes and unlocks all features.`
        )
        .setFooter({ text: 'AEGIS v13.0 · Sovereign Platform Edition' })
        .setTimestamp();

      await ch.send({ embeds:[embed] });
    } catch (e) {
      console.warn(`[GuildCreate] Could not post in ${guild.name}:`, e.message);
    }
  },
};
