// ============================================================
// src/events/interactionCreate.js
// AEGIS v10 — Multi-Guild Interaction Router
// ============================================================
// Replaces any existing interactionCreate.js.
// Loads the guild config first, then routes to the appropriate
// command handler with the config injected as context.
// ============================================================

const guildManager = require('../managers/guildManager');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.guildId) return;

    // ── Load this guild's config ────────────────────────────
    const guildConfig = await guildManager.getConfig(interaction.guildId);

    if (!guildConfig) {
      // Guild not in guild_configs — not a managed guild, ignore
      return;
    }

    // ── Route slash commands ────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Check feature flags before executing
      const featureMap = {
        // command name prefix → feature flag field
        'balance': 'economy',
        'pay':     'economy',
        'shop':    'economy',
        'give':    'economy',
        'ticket':  'tickets',
        'giveaway':'giveaways',
        'ask':     'ai',
        'ban':     'moderation',
        'kick':    'moderation',
        'warn':    'moderation',
        'mute':    'moderation',
      };

      const cmdBase = interaction.commandName.split('-')[0];
      const requiredFeature = featureMap[cmdBase];

      if (requiredFeature && !guildConfig[`${requiredFeature}_enabled`]) {
        return interaction.reply({
          content: `⚠️ That feature is not enabled on **${guildConfig.display_name}**.`,
          ephemeral: true
        });
      }

      try {
        // Inject guildConfig so commands don't need to re-fetch it
        await command.execute(interaction, client, guildConfig);
      } catch (err) {
        console.error(`[InteractionCreate] Command error in ${interaction.guildId}:`, err);
        const errMsg = { content: '⚠️ An error occurred. Please try again.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errMsg).catch(() => {});
        } else {
          await interaction.reply(errMsg).catch(() => {});
        }
      }
    }

    // ── Route button / select menu interactions ─────────────
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const handler = client.components?.get(interaction.customId.split(':')[0]);
      if (handler) {
        try {
          await handler.execute(interaction, client, guildConfig);
        } catch (err) {
          console.error('[InteractionCreate] Component error:', err);
        }
      }
    }

    // ── Route modals ─────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const modal = client.modals?.get(interaction.customId.split(':')[0]);
      if (modal) {
        try {
          await modal.execute(interaction, client, guildConfig);
        } catch (err) {
          console.error('[InteractionCreate] Modal error:', err);
        }
      }
    }
  }
};
