'use strict';

const setupAegis = require('../setup/setupAegis');

// External systems (keep your existing ones)
const handleTicketInteraction = require('../commands/tickets/ticketHandler');
const handleWatchtowerInteraction = require('../commands/watchtower/watchtowerHandler');
const handleEmbedgisButton = require('../commands/embedgis/embedgisHandler');
const handleGiveawayEntry = require('../commands/giveaways/giveawayHandler');
const handleSubChecklist = require('../commands/subscriptions/subHandler');

// ─────────────────────────────────────────────
// MAIN ROUTER
// ─────────────────────────────────────────────
async function handle(interaction, client) {
async route(interaction, client) {
  try {
    // existing logic
  } catch (err) {
    console.error('[ROUTER CRASH]', err);

    if (!interaction.replied) {
      await interaction.reply({
        content: '⚠️ System temporarily unavailable.',
        flags: 64,
      }).catch(() => {});
    }
  }
}
  // ── BUTTONS ───────────────────────────────
  if (interaction.isButton()) {
    const id = interaction.customId;

    // AEGIS SETUP SYSTEM
    if (
      id.startsWith('aegis_setup_') ||
      id.startsWith('aegis_toggle_')
    ) {
      return setupAegis.handleButton(interaction);
    }

    // TICKETS
    if (
      id === 'ticket_open' ||
      id.startsWith('tkt_') ||
      id.startsWith('close_ticket') ||
      id.startsWith('claim_ticket')
    ) {
      return handleTicketInteraction(interaction, client);
    }

    // WATCHTOWER
    if (id.startsWith('watchtower_') || id.startsWith('wt_')) {
      return handleWatchtowerInteraction(interaction, client);
    }

    // EMBEDGIS
    if (id.startsWith('embedgis_') || id.startsWith('emg_')) {
      return handleEmbedgisButton(interaction);
    }

    // GIVEAWAYS
    if (id.startsWith('giveaway_enter_')) {
      return handleGiveawayEntry(interaction);
    }

    // SUBS
    if (id.startsWith('sub_check_')) {
      return handleSubChecklist(interaction);
    }

    return;
  }

  // ── SELECT MENUS ───────────────────────────
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === 'aegis_game_select') {
      return setupAegis.handleGameSelect(interaction);
    }

    return;
  }

  // ── MODALS ─────────────────────────────────
  if (interaction.isModalSubmit()) {

    if (interaction.customId.startsWith('aegis_modal_')) {
      return setupAegis.handleModal?.(interaction);
    }

    return;
  }

  // ── SLASH COMMAND AUTOFALL (optional future-proofing)
  if (interaction.isChatInputCommand?.()) {
    const cmd = client.commands.get(interaction.commandName);
    if (cmd?.execute) return cmd.execute(interaction, client);
  }
}

// ─────────────────────────────────────────────
module.exports = { handle };