'use strict';

const setupAegis = require('../commands/setup/setupAegis');

module.exports = {
  async route(interaction, client) {
    try {

      // ── BUTTONS ─────────────────────────────
      if (interaction.isButton()) {
        const id = interaction.customId;

        if (
          id.startsWith('aegis_setup_') ||
          id.startsWith('aegis_toggle_') ||
          id.startsWith('aegis_game_preset:')
        ) return setupAegis.handleButton(interaction);

        return;
      }

      // ── MODALS ──────────────────────────────
      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('aegis_modal_')) {
          return setupAegis.handleModal(interaction);
        }
        return;
      }

      // ── SELECT MENUS ─────────────────────────
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'aegis_game_select') {
          return setupAegis.handleGameSelect(interaction);
        }
        return;
      }

    } catch (err) {
      console.error('[ROUTER ERROR]', err);

      if (!interaction.replied) {
        await interaction.reply({
          content: '⚠️ Interaction system error.',
          flags: 64,
        }).catch(() => {});
      }
    }
  }
};