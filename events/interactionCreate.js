// ═══════════════════════════════════════════════════════════════════════
// events/interactionCreate.js — AEGIS v14 GLOBAL EDITION
// Routes all interactions including new game-select menu from /setup-aegis
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const setupAegis  = require('../commands/setup/setupAegis');
const { handleEmbedgisButton, handleEmbedgisSelect } = require('../embedgis');
const { handleTicketInteraction }    = require('../ticket-system');
const { handleWatchtowerInteraction } = require('../watchtower-system');

const rates = new Map();
function checkRate(uid, ms = 4000) {
  const l = rates.get(uid) || 0, n = Date.now();
  if (n - l < ms) return Math.ceil((ms - (n - l)) / 1000);
  rates.set(uid, n); return 0;
}
setInterval(() => { const cut = Date.now() - 120_000; for (const [k,v] of rates) if (v < cut) rates.delete(k); }, 5*60_000);

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    try {

      // ── Slash commands ──────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return interaction.reply({ content: '⚠️ Unknown command.', flags: 64 });

        const isAdmin = interaction.member?.permissions?.has('Administrator') ||
                        interaction.member?.permissions?.has('ManageMessages');
        if (!isAdmin) {
          const wait = checkRate(interaction.user.id);
          if (wait > 0) return interaction.reply({ content: `⏳ Wait **${wait}s**.`, flags: 64 });
        }

        if (!interaction.deferred && !interaction.replied) {
          try { await interaction.deferReply(); }
          catch (e) { console.error(`[${interaction.commandName}] deferReply failed:`, e.message); return; }
        }

        try {
          return await cmd.execute(interaction, client);
        } catch (e) {
          console.error(`[/${interaction.commandName}]`, e.message);
          try {
            const m = '⚠️ ' + (e.message?.slice(0, 120) || 'Error');
            if (interaction.deferred || interaction.replied) await interaction.editReply(m);
            else await interaction.reply({ content: m, flags: 64 });
          } catch {}
        }
        return;
      }

      // ── Select menus ────────────────────────────────────────────────
      if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
        const id = interaction.customId;
        // Game preset selection from /setup-aegis
        if (id === 'aegis_game_select') {
          return await setupAegis.handleGameSelect(interaction);
        }
        if (id.startsWith('ticket_') || id.startsWith('tkt_'))
          return await handleTicketInteraction(interaction, client);
        if (id.startsWith('emg_') || id.startsWith('embedgis_'))
          return await handleEmbedgisSelect(interaction);
        return;
      }

      // ── Buttons ─────────────────────────────────────────────────────
      if (interaction.isButton()) {
        const id = interaction.customId;
        if (id.startsWith('aegis_setup_') || id.startsWith('aegis_toggle_') || id.startsWith('aegis_game_preset:'))
          return await setupAegis.handleButton(interaction);
        if (id === 'ticket_open' || id.startsWith('tkt_') || id.startsWith('close_ticket') || id.startsWith('claim_ticket'))
          return await handleTicketInteraction(interaction, client);
        if (id.startsWith('watchtower_') || id.startsWith('wt_'))
          return await handleWatchtowerInteraction(interaction, client);
        if (id.startsWith('emg_') || id.startsWith('embedgis_'))
          return await handleEmbedgisButton(interaction);
        if (id.startsWith('giveaway_enter_'))
          return await handleGiveawayEntry(interaction);
        if (id.startsWith('sub_check_'))
          return await handleSubChecklist(interaction);
        return;
      }

      // ── Modals ──────────────────────────────────────────────────────
      if (interaction.isModalSubmit()) {
        const id = interaction.customId;
        if (id.startsWith('aegis_modal_')) return await setupAegis.handleModal(interaction);
        if (id.startsWith('ticket_modal_') || id.startsWith('ticket_'))
          return await handleTicketInteraction(interaction, client);
        return;
      }

    } catch (err) {
      console.error('[InteractionCreate]', err.message);
      try {
        const m = '⚠️ An error occurred. Please try again.';
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: m, flags: 64 });
        else await interaction.reply({ content: m, flags: 64 });
      } catch {}
    }
  },
};

// ── Helper: giveaway entry ──────────────────────────────────────────
async function handleGiveawayEntry(interaction) {
  const giveawayId = interaction.customId.replace('giveaway_enter_', '');
  const { sb, sbOk } = require('../services/supabase');
  if (!sb || !sbOk()) return interaction.reply({ content: '⚠️ Database unavailable.', flags: 64 });
  const userId = interaction.user.id;
  const { data: existing } = await sb.from('aegis_giveaways_entries').select('id')
    .eq('giveaway_id', giveawayId).eq('user_id', userId).single().catch(() => ({ data: null }));
  if (existing) return interaction.reply({ content: '✅ Already entered!', flags: 64 });
  await sb.from('aegis_giveaways_entries').insert({
    giveaway_id: giveawayId, user_id: userId, user_tag: interaction.user.username,
    entered_at: new Date().toISOString(),
  }).catch(() => {});
  const { count } = await sb.from('aegis_giveaways_entries')
    .select('*', { count: 'exact', head: true }).eq('giveaway_id', giveawayId);
  return interaction.reply({ content: `🎉 You're in! **${count || '?'}** entries so far.`, flags: 64 });
}

// ── Helper: subscription checklist ──────────────────────────────────
async function handleSubChecklist(interaction) {
  try {
    const subs = require('../commands/admin/subscriptions.js');
    const h = Array.isArray(subs) ? subs.find(c => c?.handleChecklistButton) : subs;
    if (h?.handleChecklistButton) return await h.handleChecklistButton(interaction);
  } catch (e) {
    console.error('[SubChecklist]', e.message);
    return interaction.reply({ content: '⚠️ Checklist error.', flags: 64 });
  }
}
