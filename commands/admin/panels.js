// commands/admin/panels.js
// Enterprise ticket panel system — 5 category panels + /ticket selector
// Shared across both guilds via guildManager per-guild config
'use strict';

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { isAdmin, base, C, FT } = require('../../config/constants');
const { handleEmbedgisCommand, EMBEDGIS_COMMAND } = require('../../embedgis');
const { sendWatchtowerPanel } = require('../../watchtower-system');
const { sendOriginStory } = require('../../origin-panels');

// ═══════════════════════════════════════════════════════════════════════
// PANEL DEFINITIONS — full channel bio, tips, and CTA per category
// ═══════════════════════════════════════════════════════════════════════

const PANELS = {

  // ── 🛡️ GENERAL SUPPORT ──────────────────────────────────────────────
  support: {
    color: 0x00D4FF, emoji: '🛡️', btnId: 'tkt_support',
    btnLabel: '🛡️ Open Support Ticket', btnStyle: ButtonStyle.Primary,
    title: '🛡️ TheConclave · Support Tickets',
    description: [
      '```',
      ' THECONCLAVE:DOMINION — SUPPORT SYSTEM ',
      '```',
      '',
      'Need help from the **Council**? This is the right place.',
      'Click the button below to open a **private ticket** — only you and staff will see it.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '📋 **What we can help with:**',
      '> 🐛 **Bugs & Glitches** — Lost tames, items, structures, rollbacks',
      '> ⚔️ **Disputes** — Tribe conflicts, rule violations, reports',
      '> ❓ **Questions** — Rules clarification, server info, crossplay help',
      '> 🔧 **Technical** — Connection issues, crash reports, lag spikes',
      '> 📋 **Other** — Anything else that needs Council attention',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '💡 **Tips for a fast resolution:**',
      '> • **Be specific** — include your character name, tribe, server, and exact time',
      '> • **Have evidence** — screenshots or video speed up every case',
      '> • **One issue per ticket** — don\'t combine multiple problems',
      '> • **Stay in the channel** — staff will reply, usually within **24 hours**',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '-# 🔒 All tickets are private · Council responds within 24h · AEGIS v13',
    ].join('\n'),
  },

  // ── 🎁 STARTER KIT ───────────────────────────────────────────────────
  starterkit: {
    color: 0x35ED7E, emoji: '🎁', btnId: 'tkt_starterkit',
    btnLabel: '🎁 Request My Starter Kit', btnStyle: ButtonStyle.Success,
    title: '🎁 Starter Kit — New Player Welcome Package',
    description: [
      '```',
      ' THECONCLAVE:DOMINION — STARTER KIT SYSTEM ',
      '```',
      '',
      'Welcome to the Dominion, Survivor! 🌿',
      'Every new player is entitled to a **free Starter Kit** to help begin your journey.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '📦 **Your Starter Kit includes:**',
      '> 🦖 **2 Starter Dinos** of your choice',
      '> 🔮 **1 Level 500 Dino** of your choice',
      '> ✨ **1 Shiny** — Argy or Pteranodon',
      '> 🧁 **Kibble, Cakes & Ammo** packs',
      '> 📦 **Building materials** to get you started',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '📋 **Requirements:**',
      '> • Must be a **new member** (within your first 72 hours)',
      '> • **One kit per player** across all servers',
      '> • Must be in the Discord to receive your kit',
      '',
      '💡 **Tips to speed up delivery:**',
      '> • Pick your map **before** opening the ticket',
      '> • Choose a **4-digit Safe-PIN** for delivery (keep it private!)',
      '> • Have your **character name and tribe** ready',
      '> • Specify **colors** and **gender** if you have a preference',
      '> • Be **online** or let staff know your schedule',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '-# ⏰ Kits are delivered within 24–48 hours · One per player · AEGIS v13',
    ].join('\n'),
  },

  // ── 🪙 CONCOIN SHOP ──────────────────────────────────────────────────
  concoin: {
    color: 0xFFB800, emoji: '🪙', btnId: 'tkt_concoin',
    btnLabel: '🪙 Open ConCoin Ticket', btnStyle: ButtonStyle.Primary,
    title: '🪙 ConCoin Shop — In-Server Economy Support',
    description: [
      '```',
      ' THECONCLAVE:DOMINION — CONCOIN SHOP SUPPORT ',
      '```',
      '',
      'Questions about **ConCoins**? Purchases, missing coins, or disputes?',
      'Open a private ticket and the Council will handle it fast.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '🪙 **How to earn ConCoins:**',
      '> 🎯 **Trivia** — Answer in <#trivia-channel> to win **15,000 ConCoins** per correct answer',
      '> 📅 **Weekly Claim** — Use `/weekly` every 7 days',
      '> 🎉 **Events** — Community events and competitions',
      '> 🏆 **Competitions** — Season prizes and leaderboard rewards',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '🛒 **What this ticket handles:**',
      '> • **Purchases** — Submit a purchase request',
      '> • **Missing Coins** — ConCoins not received after trivia/event',
      '> • **Disputes** — Incorrect balance, scam reports',
      '> • **Manual Deposit** — Requesting pending booty be deposited',
      '> • **Balance Questions** — Check total earnings and pending rewards',
      '',
      '💡 **Before opening a ticket:**',
      '> • Run `/concoin-booty` to check your current pending balance',
      '> • Run `/concoin-leaderboard` to verify your ranking',
      '> • Have **screenshot evidence** of any missing rewards',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '-# 🪙 ConCoin issues resolved within 24h · Keep your receipts · AEGIS v13',
    ].join('\n'),
  },

  // ── 💎 CLAVESHARD SHOP ───────────────────────────────────────────────
  claveshard: {
    color: 0xFF4CD2, emoji: '💎', btnId: 'tkt_claveshard',
    btnLabel: '📚 Open ClaveShard Order 💎', btnStyle: ButtonStyle.Primary,
    title: '📚 ClaveShard Shop — Premium Orders & Fulfillment',
    description: [
      '```',
      ' THECONCLAVE:DOMINION — CLAVESHARD SHOP 💎 ',
      '```',
      '',
      'Welcome to the **ClaveShard Shop** — premium ARK items, dinos, and resources.',
      'Open a ticket to place your order. Payment via **CashApp $TheConclaveDominion**.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '💎 **Available Tiers:**',
      '> 💠 **T1** · 1 shard — Foundation Drop (dino, ammo, kibble, ConCoins)',
      '> 💎 **T2** · 2 shards — Shiny Starter (Chibis, Shiny Essence)',
      '> ✨ **T3** · 3 shards — Tek Spark (Tek suit, Shiny Essence)',
      '> 🔥 **T5** · 5 shards — Boss Spark (Boss dinos, Essence, kibble)',
      '> ⚔️ **T6** · 6 shards — Boss Ready (L1250 breeding pairs)',
      '> 🧬 **T8** · 8 shards — Medium Resources (100K materials)',
      '> 🛡️ **T10** · 10 shards — Dominion Upgrade (Tek set, platform, ConCoins)',
      '> 🌟 **T12** · 12 shards — Large Resources (200K materials)',
      '> 👑 **T15** · 15 shards — Crown Drop (L1500 dinos, element)',
      '> 🏰 **T20** · 20 shards — Gate Expansion (Behemoth gates)',
      '> 💰 **T30** · 30 shards — Dedicated Refill (1.6M resources)',
      '> 🐉 **Insurance** — Dino revival token (named dino protection)',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '💳 **Payment:**',
      '> **CashApp** `$TheConclaveDominion` · **Chime** available',
      '> Include your **order ref number** (given after ticket opens)',
      '> **1 ClaveShard = $1 USD**',
      '',
      '💡 **Tips for fast fulfillment:**',
      '> • Know your **tier** before opening (use `/shard` to browse)',
      '> • Have your **4-digit Safe-PIN** ready for delivery',
      '> • Specify **server, character name, tribe, and platform**',
      '> • Payment first = faster fulfillment queue',
      '> • Fulfilled within **24–72 hours** after payment confirmed',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '-# 💎 Browse with /shard · Order with /order · Track with /wallet · AEGIS v13',
    ].join('\n'),
  },

  // ── 👁️ BASE WATCH ────────────────────────────────────────────────────
  basewatch: {
    color: 0x7B2FFF, emoji: '👁️', btnId: 'tkt_basewatch',
    btnLabel: '🛡️ Request Base Watch', btnStyle: ButtonStyle.Danger,
    title: '👁️ AEGIS Tower — Base Watch Requests',
    description: [
      '```',
      ' THECONCLAVE:DOMINION — AEGIS BASE WATCH SYSTEM ',
      '```',
      '',
      '**Going offline?** The Council watches over your base while you\'re away.',
      'Request protection and AEGIS will keep an eye on your area.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '🛡️ **What Base Watch includes:**',
      '> 👁️ **Active monitoring** of your base area by Council members',
      '> 📸 **Screenshot evidence** if any incident occurs while you\'re away',
      '> 🚨 **Discord alert** if suspicious activity is detected near your base',
      '> 📋 **Incident report** filed if anything happens during your absence',
      '> ⚔️ **Aberration PvP** — extra vigilance on the PvP server',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '📋 **Requirements:**',
      '> • Must be in **good standing** in the Dominion',
      '> • **48 hours notice** recommended for planned absences',
      '> • Provide **coordinates or location description**',
      '> • Base must be **fully enclosed** (we can\'t protect open bases)',
      '',
      '💡 **Tips:**',
      '> • Name your dinos **before** requesting watch (helps with dino insurance)',
      '> • Include a **screenshot** of your base in the ticket if possible',
      '> • Let us know if you have **high-value dinos** that need extra attention',
      '> • For **Aberration PvP** — upload important items to ARK data before leaving',
      '> • Specify if you want a **daily check-in** message',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '-# 🛡️ AEGIS sees all · The Dominion protects its own · Base Watch v3',
    ].join('\n'),
  },
};

// ═══════════════════════════════════════════════════════════════════════
// PANEL BUILDER — creates embed + button for a given category
// ═══════════════════════════════════════════════════════════════════════

function buildPanel(type) {
  const p = PANELS[type];
  if (!p) return null;
  const emb = new EmbedBuilder()
    .setColor(p.color)
    .setTitle(p.title)
    .setDescription(p.description)
    .setThumbnail('https://theconclavedominion.com/conclave-badge.png')
    .setFooter(FT)
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(p.btnId).setLabel(p.btnLabel).setStyle(p.btnStyle)
  );
  return { embeds: [emb], components: [row] };
}

// ═══════════════════════════════════════════════════════════════════════
// /ticket — Admin panel selector
// Posts the right panel(s) in the current channel
// ═══════════════════════════════════════════════════════════════════════

const ticket = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('[Admin] 🎫 Post a ticket panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o => o
      .setName('type')
      .setDescription('Which panel to post?')
      .setRequired(true)
      .addChoices(
        { name: '🛡️ Support — General help & disputes',   value: 'support'    },
        { name: '🎁 Starter Kit — New player welcome',     value: 'starterkit' },
        { name: '🪙 ConCoin Shop — Economy & purchases',  value: 'concoin'    },
        { name: '💎 ClaveShard Shop — Premium orders',    value: 'claveshard' },
        { name: '👁️ Base Watch — AEGIS protection',      value: 'basewatch'  },
        { name: '📋 ALL — Post all 5 panels here',        value: 'all'        },
      )
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const type = interaction.options.getString('type');

    if (type === 'all') {
      // Post all 5 panels sequentially
      const types = ['support', 'starterkit', 'concoin', 'claveshard', 'basewatch'];
      for (const t of types) {
        const panel = buildPanel(t);
        if (panel) await interaction.channel.send(panel);
        await new Promise(r => setTimeout(r, 600)); // small delay between posts
      }
      return interaction.editReply('✅ All 5 ticket panels posted.');
    }

    const panel = buildPanel(type);
    if (!panel) return interaction.editReply('⚠️ Unknown panel type.');
    await interaction.channel.send(panel);
    return interaction.editReply(`✅ **${PANELS[type].emoji} ${type.charAt(0).toUpperCase() + type.slice(1)}** panel posted.`);
  },
};

// ═══════════════════════════════════════════════════════════════════════
// INDIVIDUAL PANEL COMMANDS (for posting to specific channels directly)
// ═══════════════════════════════════════════════════════════════════════

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

const panelStarterkit = {
  data: new SlashCommandBuilder()
    .setName('panel-starterkit').setDescription('[Admin] 🎁 Post starter kit panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await interaction.channel.send(buildPanel('starterkit'));
    return interaction.editReply('✅ Starter kit panel posted.');
  },
};

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

const panelBasewatch = {
  data: new SlashCommandBuilder()
    .setName('panel-basewatch').setDescription('[Admin] 👁️ Post base watch panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await interaction.channel.send(buildPanel('basewatch'));
    return interaction.editReply('✅ Base Watch panel posted.');
  },
};

// ── SETUP-TICKETS ─────────────────────────────────────────────────────
const setupTickets = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets').setDescription('[Admin] ⚙️ Configure ticket webhook for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('type').setDescription('Ticket type').setRequired(true)
      .addChoices(
        {name:'Support',value:'support'},{name:'Starter Kit',value:'starterkit'},
        {name:'ConCoin',value:'concoin'},{name:'ClaveShard',value:'claveshard'},
        {name:'Base Watch',value:'basewatch'}
      ))
    .addStringOption(o => o.setName('webhook').setDescription('Webhook URL').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const type = interaction.options.getString('type');
    const webhook = interaction.options.getString('webhook');
    if (!webhook.startsWith('https://discord.com/api/webhooks/') && !webhook.startsWith('https://discordapp.com/api/webhooks/')) {
      return interaction.editReply('⚠️ Invalid webhook URL.');
    }
    const guildManager = require('../../managers/guildManager');
    await guildManager.updateField(interaction.guildId, `webhook_${type}`, webhook);
    return interaction.editReply(`✅ **${type}** ticket webhook saved for this server.`);
  },
};

// ── WATCHTOWER ─────────────────────────────────────────────────────────
const watchtower = {
  data: new SlashCommandBuilder()
    .setName('watchtower').setDescription('[Admin] 🛡️ Post AEGIS Watchtower panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await sendWatchtowerPanel(interaction.channel);
    return interaction.editReply('✅ Watchtower panel posted.');
  },
};

// ── ORIGIN ─────────────────────────────────────────────────────────────
const origin = {
  data: new SlashCommandBuilder()
    .setName('origin').setDescription('[Admin] 🌌 Post the Conclave origin story')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('delay').setDescription('Seconds between panels (default 4)').setMinValue(2).setMaxValue(10)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    await interaction.editReply('🌌 Broadcasting origin story...');
    await sendOriginStory(interaction.channel, (interaction.options.getInteger('delay')||4)*1000);
  },
};

// ── EMBEDGIS ──────────────────────────────────────────────────────────
const embedgis = {
  data: EMBEDGIS_COMMAND,
  async execute(interaction) {
    await handleEmbedgisCommand(interaction);
  },
};

module.exports = [
  ticket,
  panelSupport, panelStarterkit, panelConcoin, panelClaveshard, panelBasewatch,
  setupTickets, watchtower, origin, embedgis,
];

module.exports.buildPanel = buildPanel;
module.exports.PANELS = PANELS;
