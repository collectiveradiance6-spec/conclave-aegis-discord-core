// ═══════════════════════════════════════════════════════════════════════
// events/interactionCreate.js — Routes all Discord interactions
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { Events } = require('discord.js');
const setupAegis = require('../commands/setup/setupAegis');
const { handleEmbedgisButton, handleEmbedgisSelect } = require('../embedgis');
const { handleTicketInteraction } = require('../ticket-system');
const { handleWatchtowerInteraction } = require('../watchtower-system');

const rates = new Map();
function checkRate(uid,ms=5000){const l=rates.get(uid)||0,n=Date.now();if(n-l<ms)return Math.ceil((ms-(n-l))/1000);rates.set(uid,n);return 0;}
setInterval(()=>{const cut=Date.now()-120_000;for(const [k,v] of rates)if(v<cut)rates.delete(k);},5*60_000);

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return interaction.reply({content:'⚠️ Unknown command.',ephemeral:true});
        const member = interaction.member;
        const isAdmin = member?.permissions?.has('ManageMessages')||member?.permissions?.has('Administrator');
        if (!isAdmin) {
          const wait = checkRate(interaction.user.id);
          if (wait>0) return interaction.reply({content:`⏳ Wait **${wait}s** before another command.`,ephemeral:true});
        }
        return cmd.execute(interaction, client);
      }
      if (interaction.isButton()) {
        const id = interaction.customId;
        if (id.startsWith('aegis_setup_')||id.startsWith('aegis_toggle_')) return setupAegis.handleButton(interaction);
        if (id.startsWith('ticket_')||id.startsWith('close_ticket')||id.startsWith('claim_ticket')) return handleTicketInteraction(interaction);
        if (id.startsWith('watchtower_')||id.startsWith('wt_')) return handleWatchtowerInteraction(interaction);
        if (id.startsWith('giveaway_enter_')) return handleGiveawayEntry(interaction);
        return;
      }
      if (interaction.isModalSubmit()) {
        const id = interaction.customId;
        if (id.startsWith('aegis_modal_')) return setupAegis.handleModal(interaction);
        if (id.startsWith('ticket_')) return handleTicketInteraction(interaction);
        return;
      }
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('ticket_')) return handleTicketInteraction(interaction);
        return;
      }
    } catch(err) {
      console.error('[InteractionCreate]',err.message);
      const msg='⚠️ An error occurred. Please try again.';
      try {
        if (interaction.replied||interaction.deferred) await interaction.followUp({content:msg,ephemeral:true});
        else await interaction.reply({content:msg,ephemeral:true});
      } catch {}
    }
  },
};

async function handleSubChecklist(interaction) {
  // Sub tier checklist button handler — handled inline in subscription command
  const subCmd = require('../commands/admin/subscriptions.js').find?.(c=>c.data?.name==='sub-checklist') ||
                 require('../commands/admin/subscriptions.js');
  if (subCmd?.handleChecklistButton) return subCmd.handleChecklistButton(interaction);
}

async function handleGiveawayEntry(interaction) {
  const giveawayId = interaction.customId.replace('giveaway_enter_','');
  const {sb,sbOk} = require('../services/supabase');
  if (!sb||!sbOk()) return interaction.reply({content:'⚠️ Database unavailable.',ephemeral:true});
  const userId = interaction.user.id;
  const {data:existing} = await sb.from('aegis_giveaways_entries').select('id').eq('giveaway_id',giveawayId).eq('user_id',userId).single().catch(()=>({data:null}));
  if (existing) return interaction.reply({content:'✅ Already entered!',ephemeral:true});
  await sb.from('aegis_giveaways_entries').insert({giveaway_id:giveawayId,user_id:userId,user_tag:interaction.user.tag,entered_at:new Date().toISOString()}).catch(()=>{});
  const {count} = await sb.from('aegis_giveaways_entries').select('*',{count:'exact',head:true}).eq('giveaway_id',giveawayId);
  return interaction.reply({content:`🎉 You're in! **${count||'?'}** entries so far.`,ephemeral:true});
}
