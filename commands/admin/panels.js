// commands/admin/panels.js
// panel-support · panel-starterkit · panel-concoin · panel-claveshard · panel-basewatch
// ticket · watchtower · origin · embedgis
'use strict';

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, PermissionFlagsBits,
} = require('discord.js');
const { isAdmin, base, C, FT } = require('../../config/constants');
const { handleEmbedgisCommand, EMBEDGIS_COMMAND } = require('../../embedgis');
const { sendWatchtowerPanel } = require('../../watchtower-system');
const { sendOriginStory } = require('../../origin-panels');

// ── PANEL CONFIGS ─────────────────────────────────────────────────────
const PANEL_CONFIGS = {
  support: {
    color: 0x00D4FF, emoji: '🛡️', title: 'TheConclave Support',
    desc: [
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      '',
      '**Need help from the Council?**',
      'Click the button below to open a private support ticket.',
      '',
      '**What we can help with:**',
      '> 🗺️ Server issues & questions',
      '> ⚔️ Disputes & rule clarifications',
      '> 🐛 Bug reports & glitches',
      '> 🙏 General Dominion help',
      '',
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      '-# Tickets are private · Council responds within 24 hours',
    ].join('\n'),
    btnId: 'tkt_support', btnLabel: '🛡️ Open Support Ticket', btnStyle: ButtonStyle.Primary,
  },
  starterkit: {
    color: 0x35ED7E, emoji: '🎁', title: 'Starter Kit Requests',
    desc: [
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      '',
      '**New to TheConclave? Claim your starter kit!**',
      '',
      '**Kits include:**',
      '> 🦖 A starter dino for your journey',
      '> 🏠 Basic building materials',
      '> 🍗 Food & survival supplies',
      '> 📦 ConCoins to get started',
      '',
      '**Requirements:**',
      '> New member (first 72h)',
      '> One kit per player per server',
      '',
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      '-# Fulfilled by Council within 24 hours',
    ].join('\n'),
    btnId: 'tkt_starterkit', btnLabel: '🎁 Request Starter Kit', btnStyle: ButtonStyle.Success,
  },
  concoin: {
    color: 0xFFB800, emoji: '🪙', title: 'ConCoin Shop',
    desc: [
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      '',
      '**ConCoin Shop — In-Server Economy**',
      'Open a ticket for purchases, transfers, or disputes.',
      '',
      '**Earn ConCoins via:**',
      '> 🎯 Trivia — **15,000 ConCoins** per correct answer',
      '> 📅 Weekly claims via `/weekly`',
      '> 🎉 Events & competitions',
      '',
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      '-# All ConCoin issues handled by Council',
    ].join('\n'),
    btnId: 'tkt_concoin', btnLabel: '🪙 Open ConCoin Ticket', btnStyle: ButtonStyle.Primary,
  },
  claveshard: {
    color: 0xFF4CD2, emoji: '📚', title: '📚 ClaveShard Shop 👀',
    desc: [
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      '',
      '**ClaveShard Shop — Premium Dinos, Items & Resources**',
      '',
      '> 💠 **Tier 1** — Foundation Drop · 1 shard',
      '> 💎 **Tier 2** — Shiny Starter · 2 shards',
      '> ✨ **Tier 3** — Tek Spark · 3 shards',
      '> 🔥 **Tier 5** — Boss Spark · 5 shards',
      '> ⚔️ **Tier 6** — Boss Ready · 6 shards',
      '> 🧬 **Tier 8** — Medium Resources · 8 shards',
      '> 🛡️ **Tier 10** — Dominion Upgrade · 10 shards',
      '> 🌟 **Tier 12** — Large Resources · 12 shards',
      '> 👑 **Tier 15** — Crown Drop · 15 shards',
      '> 🏰 **Tier 20** — Gate Expansion · 20 shards',
      '> 💰 **Tier 30** — Dedicated Refill · 30 shards',
      '> 🐉 **Dino Insurance** — Protect your named dino',
      '',
      '**Payment:** Cash App `$TheConclaveDominion`',
      '**Delivery:** 24–72 hours via Council',
      '',
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      '-# Click below to open your order ticket',
    ].join('\n'),
    btnId: 'tkt_claveshard', btnLabel: '📚 Open Shop Ticket 👀', btnStyle: ButtonStyle.Primary,
  },
  basewatch: {
    color: 0x7B2FFF, emoji: '🛡️', title: '🛡️ AEGIS Base Watch 🛡️',
    desc: [
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      '',
      '**AEGIS Tower — Base Protection Requests**',
      'Going offline? Request protection from the Council.',
      '',
      '**Base watch includes:**',
      '> 👁️ Council monitors your base area',
      '> 🚨 Alert if suspicious activity detected',
      '> 📸 Screenshot evidence if incident occurs',
      '',
      '**Requirements:**',
      '> Server member in good standing',
      '> 48h notice recommended',
      '> Coordinates or description required',
      '',
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      '-# AEGIS sees all · The Dominion protects its own',
    ].join('\n'),
    btnId: 'tkt_basewatch', btnLabel: '🛡️ Request Base Watch', btnStyle: ButtonStyle.Danger,
  },
};

// ── Helper: build a panel embed + button ─────────────────────────────
function buildPanel(type) {
  const cfg = PANEL_CONFIGS[type];
  const emb = new EmbedBuilder()
    .setColor(cfg.color)
    .setTitle(`${cfg.emoji} ${cfg.title}`)
    .setDescription(cfg.desc)
    .setFooter(FT)
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(cfg.btnId).setLabel(cfg.btnLabel).setStyle(cfg.btnStyle)
  );
  return { embeds:[emb], components:[row] };
}

// ── PANEL-SUPPORT ─────────────────────────────────────────────────────
const panelSupport = {
  data: new SlashCommandBuilder()
    .setName('panel-support').setDescription('[Admin] 🛡️ Post general support panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await interaction.channel.send(buildPanel('support'));
    return interaction.editReply('✅ Support panel posted.');
  },
};

// ── PANEL-STARTERKIT ──────────────────────────────────────────────────
const panelStarterkit = {
  data: new SlashCommandBuilder()
    .setName('panel-starterkit').setDescription('[Admin] 🎁 Post starter kit request panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await interaction.channel.send(buildPanel('starterkit'));
    return interaction.editReply('✅ Starter kit panel posted.');
  },
};

// ── PANEL-CONCOIN ─────────────────────────────────────────────────────
const panelConcoin = {
  data: new SlashCommandBuilder()
    .setName('panel-concoin').setDescription('[Admin] 🪙 Post ConCoin shop panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await interaction.channel.send(buildPanel('concoin'));
    return interaction.editReply('✅ ConCoin panel posted.');
  },
};

// ── PANEL-CLAVESHARD ──────────────────────────────────────────────────
const panelClaveshard = {
  data: new SlashCommandBuilder()
    .setName('panel-claveshard').setDescription('[Admin] 💎 Post ClaveShard shop panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await interaction.channel.send(buildPanel('claveshard'));
    return interaction.editReply('✅ ClaveShard panel posted.');
  },
};

// ── PANEL-BASEWATCH ───────────────────────────────────────────────────
const panelBasewatch = {
  data: new SlashCommandBuilder()
    .setName('panel-basewatch').setDescription('[Admin] 👁️ Post base watch request panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await interaction.channel.send(buildPanel('basewatch'));
    return interaction.editReply('✅ Base watch panel posted.');
  },
};

// ── TICKET (main panel with all ticket type buttons) ──────────────────
const ticket = {
  data: new SlashCommandBuilder()
    .setName('ticket').setDescription('[Admin] 🎫 Post the main ticket hub panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const emb = new EmbedBuilder()
      .setColor(0x00D4FF)
      .setTitle('🎫 Open a Ticket')
      .setDescription([
        '**Need help from the Conclave Council?**',
        'Click the button below to choose a ticket category.',
        '',
        '🛡️ **Support** — Server help, questions, disputes',
        '🎁 **Starter Kit** — New player kit request',
        '🪙 **ConCoin** — Economy, purchases, disputes',
        '💎 **ClaveShard Shop** — Premium orders & fulfillment',
        '👁️ **Base Watch** — AEGIS base protection requests',
        '',
        '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
        '-# All tickets are **private** — only you and staff can see them',
      ].join('\n'))
      .setFooter(FT)
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open').setLabel('🎫 Open a Ticket').setStyle(ButtonStyle.Primary)
    );
    await interaction.channel.send({ embeds:[emb], components:[row] });
    return interaction.editReply('✅ Ticket hub panel posted.');
  },
};

// ── SETUP-TICKETS (webhook config per type) ───────────────────────────
const setupTickets = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets').setDescription('[Admin] ⚙️ Configure ticket system for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o=>o.setName('type').setDescription('Ticket type').setRequired(true)
      .addChoices(
        {name:'Support',value:'support'},{name:'Starter Kit',value:'starterkit'},
        {name:'ConCoin',value:'concoin'},{name:'ClaveShard',value:'claveshard'},
        {name:'Base Watch',value:'basewatch'}
      ))
    .addStringOption(o=>o.setName('webhook').setDescription('Webhook URL for notifications').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const type    = interaction.options.getString('type');
    const webhook = interaction.options.getString('webhook');
    if (!webhook.startsWith('https://discord.com/api/webhooks/') && !webhook.startsWith('https://discordapp.com/api/webhooks/')) {
      return interaction.editReply('⚠️ Invalid webhook URL. Must be a Discord webhook.');
    }
    const guildManager = require('../../managers/guildManager');
    const key = `webhook_${type}`;
    await guildManager.updateField(interaction.guildId, key, webhook);
    return interaction.editReply(`✅ **${type}** ticket webhook saved.\n\nNew ${type} tickets will now send notifications to that webhook.`);
  },
};

// ── WATCHTOWER ────────────────────────────────────────────────────────
const watchtower = {
  data: new SlashCommandBuilder()
    .setName('watchtower').setDescription('[Admin] 🛡️ Post AEGIS Watchtower base protection panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await sendWatchtowerPanel(interaction.channel);
    return interaction.editReply('✅ Watchtower panel posted.');
  },
};

// ── ORIGIN ────────────────────────────────────────────────────────────
const origin = {
  data: new SlashCommandBuilder()
    .setName('origin').setDescription('[Admin] 🌌 Post the full Conclave Dominion origin story')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o=>o.setName('delay').setDescription('Seconds between panels (default 4)').setMinValue(2).setMaxValue(10)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const secs = (interaction.options.getInteger('delay') || 4) * 1000;
    await interaction.editReply('🌌 Broadcasting origin story...');
    await sendOriginStory(interaction.channel, secs);
  },
};

// ── EMBEDGIS (DBE v2.1 — full broadcast engine) ───────────────────────
const embedgis = {
  data: EMBEDGIS_COMMAND,
  async execute(interaction) {
    // The embedgis module handles full state machine internally
    // interactionCreate.js must also wire handleEmbedgisButton + handleEmbedgisSelect
    const handled = await handleEmbedgisCommand(interaction);
    if (!handled) return interaction.editReply('⚠️ Embed broadcast engine error.');
  },
};

module.exports = [
  panelSupport, panelStarterkit, panelConcoin, panelClaveshard, panelBasewatch,
  ticket, setupTickets, watchtower, origin, embedgis,
];

// Export individual panel builder for use in setup-aegis wizard
module.exports.buildPanel = buildPanel;
