// ============================================================
// src/events/guildMemberAdd.js
// AEGIS v10 — Multi-Guild Auto-Role on Join
// ============================================================

const guildManager = require('../managers/guildManager');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const config = await guildManager.getConfig(member.guild.id);
    if (!config) return;

    // Auto-assign initiate role
    if (config.role_initiate) {
      try {
        await member.roles.add(config.role_initiate);
      } catch (err) {
        console.warn(`[GuildMemberAdd] Could not assign initiate role in ${member.guild.id}:`, err.message);
      }
    }

    // Welcome message
    if (config.channel_welcome) {
      try {
        const welcomeChannel = await member.guild.channels
          .fetch(config.channel_welcome)
          .catch(() => null);

        if (welcomeChannel) {
          const displayName = config.display_name ?? 'TheConclave';
          const theme = config.server_theme;

          const welcomeMsg = theme === 'nexus'
            ? `⚡ **${member.user.username}** has jacked into the **${displayName}** grid. Welcome, initiate.`
            : `🛡️ **${member.user.username}** has entered **${displayName}**. Welcome to the Dominion.`;

          await welcomeChannel.send({
            embeds: [{
              color: theme === 'nexus' ? 0x185FA5 : 0x3C3489,
              description: welcomeMsg,
              footer: { text: `${displayName} · AEGIS v10` },
              timestamp: new Date().toISOString()
            }]
          });
        }
      } catch (err) {
        console.warn(`[GuildMemberAdd] Welcome msg failed in ${member.guild.id}:`, err.message);
      }
    }
  }
};
