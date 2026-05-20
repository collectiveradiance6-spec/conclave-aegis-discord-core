// ═══════════════════════════════════════════════════════════════════════
// events/guildCreate.js — AEGIS v14 GLOBAL EDITION
// Fires when AEGIS joins a new server.
// Provisions config, sends welcome DM, prompts /setup-aegis.
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events, REST, Routes } = require('discord.js');
const guildManager = require('../managers/guildManager');

module.exports = {
  name: Events.GuildCreate,
  once: false,

  async execute(guild, client) {
    console.log(`[GuildCreate] AEGIS joined: ${guild.name} (${guild.id}) — ${guild.memberCount} members`);

    // 1. Provision guild config
    await guildManager.provision(guild.id, guild.name);

    // 2. Register commands instantly to this new guild
    //    (global commands take ~1hr — this makes them available immediately)
    if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CLIENT_ID) {
      try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
        const body = [...(client.commands?.values() || [])].map(cmd => cmd.data.toJSON());
        if (body.length) {
          await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guild.id),
            { body }
          );
          console.log(`[GuildCreate] ✅ Commands registered instantly to ${guild.name} (${body.length} cmds)`);
        }
      } catch (e) {
        console.warn(`[GuildCreate] Command registration failed for ${guild.id}: ${e.message}`);
        console.log(`[GuildCreate] Global propagation will cover this guild within ~1 hour.`);
      }
    }

    // 3. Welcome DM to guild owner
    try {
      const owner = await guild.fetchOwner();
      if (!owner) return;

      const embed = new EmbedBuilder()
        .setColor(0x7B2FFF)
        .setTitle('⚡ AEGIS has joined your server!')
        .setDescription([
          `**Thank you for adding AEGIS to ${guild.name}!**`,
          '',
          `AEGIS is a full-featured Discord AI bot that adapts to **any game or community**.`,
          `Whether you run ARK, Minecraft, Rust, Valheim, Palworld, or any other game — AEGIS learns your game and becomes your community's intelligence.`,
          '',
          '**To get started:**',
          '1. Run `/setup-aegis` in your server as an administrator',
          '2. Select your game from the preset list (or enter a custom game)',
          '3. Configure channels, roles, and economy',
          '4. Hit ✅ Finish — AEGIS is live!',
          '',
          'Setup takes under 2 minutes.',
        ].join('\n'))
        .addFields(
          { name: '🎮 Game Support',  value: 'ARK · Minecraft · Rust · Valheim · Palworld · Conan · 7DTD · Any game', inline: false },
          { name: '🤖 AI Powered',    value: 'Anthropic Haiku 4.5 primary · Groq fallback · Game-specific knowledge', inline: false },
          { name: '💎 Economy',       value: 'Wallet, bank, shop, trivia, giveaways — all customizable per guild', inline: false },
          { name: '🎫 Tickets',       value: 'Support, orders, base watch — private per-player channels', inline: false },
        )
        .setFooter({ text: 'AEGIS v14 Global Edition · Any game, any community' })
        .setThumbnail(client.user?.displayAvatarURL({ size: 128 }) || null)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('📖 Documentation').setStyle(ButtonStyle.Link).setURL('https://theconclavedominion.com'),
        new ButtonBuilder().setLabel('💬 Support Server').setStyle(ButtonStyle.Link).setURL('https://discord.gg/theconclave'),
      );

      await owner.send({ embeds: [embed], components: [row] });
      console.log(`[GuildCreate] Welcome DM sent to ${owner.user.tag}`);
    } catch (e) {
      console.warn(`[GuildCreate] Could not DM owner of ${guild.name}: ${e.message}`);
    }

    // 4. Post setup prompt in system channel
    try {
      const ch = guild.systemChannel || guild.channels.cache
        .filter(c => c.isTextBased() && !c.isThread() && c.permissionsFor(guild.members.me)?.has('SendMessages'))
        .sort((a, b) => a.position - b.position)
        .first();

      if (!ch) return;

      await ch.send({
        embeds: [new EmbedBuilder()
          .setColor(0x7B2FFF)
          .setTitle('⚡ AEGIS is here!')
          .setDescription([
            `**An admin needs to run \`/setup-aegis\` to configure AEGIS for this server.**`,
            '',
            'AEGIS adapts to your community\'s game — ARK, Minecraft, Rust, Valheim, or any other.',
            'Setup takes under 2 minutes.',
          ].join('\n'))
          .setFooter({ text: 'AEGIS v14 Global Edition' })
          .setTimestamp()
        ],
      });
    } catch (e) {
      console.warn(`[GuildCreate] Could not post in ${guild.name}: ${e.message}`);
    }
  },
};
