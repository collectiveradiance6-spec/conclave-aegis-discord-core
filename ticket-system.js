// ═══════════════════════════════════════════════════════════════════════
// AEGIS TICKET SYSTEM v2.1
// Per-player private channels · placed inside the correct type category
// Category resolved from admin log channel's parent — zero config needed
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, PermissionFlagsBits, ChannelType,
  AttachmentBuilder,
} = require('discord.js');

// ── Env ──────────────────────────────────────────────────────────────
const TRANSCRIPT_CHANNEL = process.env.TRANSCRIPT_CHANNEL || '1503111460790735041';
const ROLE_ADMIN_ID      = process.env.ROLE_ADMIN_ID      || null;
const ROLE_HELPER_ID     = process.env.ROLE_HELPER_ID     || null;

// ── Multi-server log channel config ──────────────────────────────────
// Set ONE env var in Render: TICKET_LOG_CHANNELS
// Value is a JSON object where each key maps to a single channel ID
// OR an array of channel IDs (one per server):
//
//   TICKET_LOG_CHANNELS = {
//     "support":    ["111111111111111111", "222222222222222222"],
//     "starterkit": ["333333333333333333", "444444444444444444"],
//     "concoin":    ["555555555555555555", "666666666666666666"],
//     "claveshard": ["777777777777777777", "888888888888888888"],
//     "basewatch":  ["999999999999999999", "101010101010101010"]
//   }
//
// A single ID (string) also works if you only have one server.
// Fallback hardcoded IDs are used if the env var is missing.
// ─────────────────────────────────────────────────────────────────────
const _RAW_LOG_CHANNELS = (() => {
  const raw = process.env.TICKET_LOG_CHANNELS;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('[Tickets] TICKET_LOG_CHANNELS is not valid JSON:', e.message);
    return null;
  }
})();

// Normalise: each type resolves to an array of channel IDs
const _FALLBACK_LOG = {
  support:    ['1503110133540978769'],
  starterkit: ['1503109898093727906'],
  concoin:    ['1503109720456691742'],
  claveshard: ['1503109559022256251'],
  basewatch:  ['1503109371910029415'],
};

function getLogChannelIds(type) {
  const raw = _RAW_LOG_CHANNELS?.[type] ?? _FALLBACK_LOG[type];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// Optional per-type category overrides — also supports JSON array (first valid wins)
// TICKET_CATEGORY_IDS = { "support": "123...", "starterkit": "456..." }
const _RAW_CATEGORIES = (() => {
  const raw = process.env.TICKET_CATEGORY_IDS;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
})();

const CATEGORY_IDS = {
  support:    _RAW_CATEGORIES?.support    || process.env.TICKET_CATEGORY_SUPPORT    || null,
  starterkit: _RAW_CATEGORIES?.starterkit || process.env.TICKET_CATEGORY_STARTERKIT || null,
  concoin:    _RAW_CATEGORIES?.concoin    || process.env.TICKET_CATEGORY_CONCOIN    || null,
  claveshard: _RAW_CATEGORIES?.claveshard || process.env.TICKET_CATEGORY_CLAVESHARD || null,
  basewatch:  _RAW_CATEGORIES?.basewatch  || process.env.TICKET_CATEGORY_BASEWATCH  || null,
};

// ── Type metadata ────────────────────────────────────────────────────
const TYPE_META = {
  support:    { label: 'Support',         emoji: '🛡️', color: 0x00D4FF, prefix: 'sup'  },
  starterkit: { label: 'Starter Kit',     emoji: '🎁', color: 0x35ED7E, prefix: 'kit'  },
  concoin:    { label: 'ConCoin Shop',    emoji: '🪙', color: 0xFFB800, prefix: 'cc'   },
  claveshard: { label: 'ClaveShard Shop', emoji: '💎', color: 0xFF4CD2, prefix: 'clvs' },
  basewatch:  { label: 'Base Watch',      emoji: '👁️', color: 0x7B2FFF, prefix: 'bw'   },
};

const STATUS = {
  open:      { label: '🟡 Open — Awaiting Staff', color: 0x7B2FFF },
  claimed:   { label: '🟢 Claimed',               color: 0x00D4FF },
  progress:  { label: '🔵 In Progress',            color: 0x0099FF },
  escalated: { label: '🔴 Escalated',              color: 0xFF4500 },
  resolved:  { label: '✅ Resolved',               color: 0x35ED7E },
  closed:    { label: '🔒 Closed',                 color: 0x555555 },
};

// ── Modal forms ──────────────────────────────────────────────────────
// Each type gets up to 5 fields (Discord modal max).
// Fields are ordered by priority so the most critical info comes first.
const FORMS = {

  // ── 🛡️ General Support ───────────────────────────────────────────
  // Mirrors Image 2: character+tribe, server/map, platform, issue, still happening?
  support: [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('character')
        .setLabel('Character Name + Tribe (or Solo)')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('e.g. ArkRaider + TheDominion  |  or "Solo"')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('server')
        .setLabel('Which Server / Map?')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Island, Volcano, Extinction, Center, Lost Colony, Astraeos…')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('platform')
        .setLabel('Platform')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('PC / Xbox / PlayStation / Cloud')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('issue')
        .setLabel('Describe the issue in detail')
        .setStyle(TextInputStyle.Paragraph).setRequired(true)
        .setPlaceholder('What happened and when? Be as specific as possible.')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('still_happening')
        .setLabel('Is this still happening right now?')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Yes / No — attach screenshots or video if you have them.')
    ),
  ],

  // ── 🎁 Starter Kit ───────────────────────────────────────────────
  // Mirrors Image 3: in-game name, platform, dino choices, delivery info, extra details
  starterkit: [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('character')
        .setLabel('In-Game Name')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('What is your in-game character name?')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('platform')
        .setLabel('Platform')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Xbox / PlayStation / PC / Cloud')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('dino_choices')
        .setLabel('Starter Dino Choices')
        .setStyle(TextInputStyle.Paragraph).setRequired(true)
        .setPlaceholder('List your 2 starter dinos, 1 level 500 dino choice, and your shiny choice (Argy or PT).')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('delivery_info')
        .setLabel('Delivery Info')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Preferred Map + choose a 4-digit Safe-PIN for delivery.')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('extra_details')
        .setLabel('Extra Details')
        .setStyle(TextInputStyle.Paragraph).setRequired(false)
        .setPlaceholder('List any preferred colors, gender, or other notes staff should know.')
    ),
  ],

  // ── 🪙 ConCoin Shop ──────────────────────────────────────────────
  concoin: [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('character')
        .setLabel('Character Name + Server / Map')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('e.g. ArkRaider on Aberration')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('platform')
        .setLabel('Platform')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('PC / Xbox / PlayStation / Cloud')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('issue')
        .setLabel('What is your ConCoin Shop request/issue?')
        .setStyle(TextInputStyle.Paragraph).setRequired(true)
        .setPlaceholder('Describe your purchase, item request, missing coins, or dispute in detail…')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('amount')
        .setLabel('ConCoin Amount Involved')
        .setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('e.g. 5,000 ConCoins')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('proof')
        .setLabel('Proof / Transaction Reference (if any)')
        .setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('Screenshot link, transaction ID, or /concoin-booty balance')
    ),
  ],

  // ── 💎 ClaveShard Shop ───────────────────────────────────────────
  claveshard: [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('tier')
        .setLabel('Tier / Item Selection')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('T1 / T2 / T3 / T5 / T6 / T8 / T10 / T12 / T15 / T20 / T30 / Dino Insurance')
        .setMinLength(1).setMaxLength(60)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('character')
        .setLabel('Character Name + Server / Map + Platform')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('e.g. SurvivorX on Aberration — PC')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('dino_choices')
        .setLabel('Dino Choices / Order Details')
        .setStyle(TextInputStyle.Paragraph).setRequired(true)
        .setPlaceholder('Species, preferred colors, gender, mutations, any special requests…')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('delivery_info')
        .setLabel('Delivery Info')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Preferred delivery map + 4-digit Safe-PIN')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('payment')
        .setLabel('Payment Method + Confirmation')
        .setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('Cash App / Chime — username or last 4 digits of transaction')
    ),
  ],

  // ── 👁️ Aegis Base Watch ──────────────────────────────────────────
  // Mirrors Image 4 exactly
  basewatch: [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('tribe')
        .setLabel('Tribe Name')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Your tribe name')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('server')
        .setLabel('Server / Map')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('e.g. Aberration, The Island…')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('location')
        .setLabel('Base Location / Coordinates')
        .setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('e.g. 45.2 / 67.8  or  "Red Obelisk area"')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('duration')
        .setLabel('How long do you need watch?')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('e.g. 48 hours, this weekend, 1 week')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason')
        .setLabel('Reason for request')
        .setStyle(TextInputStyle.Paragraph).setRequired(true)
        .setPlaceholder('Going offline? Travelling? Explain why you need protection…')
    ),
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────
const isValidId = id => /^\d{17,20}$/.test(String(id || ''));

function buildStaffRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tkt_action_claim').setLabel('🟢 Claim').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId('tkt_action_progress').setLabel('🔵 In Progress').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('tkt_action_escalate').setLabel('🔴 Escalate').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId('tkt_action_resolve').setLabel('✅ Resolve').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId('tkt_action_close').setLabel('🔒 Close').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
}

function buildTicketEmbed({ interaction, type, ticketId, statusKey = 'open', fields = [] }) {
  const meta   = TYPE_META[type]   || TYPE_META.support;
  const status = STATUS[statusKey] || STATUS.open;
  return new EmbedBuilder()
    .setColor(status.color)
    .setAuthor({ name: `${interaction.user.username} · ${meta.label} Ticket`, iconURL: interaction.user.displayAvatarURL({ size: 64 }) })
    .setTitle(`${meta.emoji} ${meta.label} · \`${ticketId}\``)
    .setDescription([
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      `> 📊 **Status:** ${status.label}`,
      `> 🕐 **Opened:** <t:${Math.floor(Date.now()/1000)}:F>`,
      `> 👤 **Player:** ${interaction.user} · \`${interaction.user.username}\``,
      `> 🌐 **Guild:** ${interaction.guild?.name || 'Unknown'}`,
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
    ].join('\n'))
    .addFields(fields)
    .setFooter({ text: `TheConclave Dominion · AEGIS Tickets · ${ticketId}` })
    .setTimestamp();
}

function buildFields(interaction) {
  const allFields = interaction.fields.fields;
  const FIELD_MAP = {
    // keys shared across types
    character:       '🦖 Character / IGN',
    platform:        '🎮 Platform',
    server:          '🗺️ Server / Map',
    tribe:           '🏕️ Tribe',
    // support
    issue:           '📋 Issue / Request',
    still_happening: '🔴 Still Happening?',
    // starterkit
    dino_choices:    '🦕 Starter Dino Choices',
    delivery_info:   '📦 Delivery Info',
    extra_details:   '📝 Extra Details',
    // claveshard
    tier:            '💎 Tier Selected',
    payment:         '💳 Payment',
    // concoin
    amount:          '💰 Amount',
    proof:           '📎 Proof / Reference',
    // basewatch
    location:        '📍 Base Location',
    duration:        '⏱️ Watch Duration',
    reason:          '📋 Reason',
    // legacy key
    order_details:   '📋 Order Details',
  };
  const MULTILINE = new Set(['issue','reason','dino_choices','extra_details','order_details']);
  const out = [];
  for (const [key, label] of Object.entries(FIELD_MAP)) {
    const val = allFields.get(key)?.value;
    if (val) out.push({ name: label, value: val.slice(0,500), inline: !MULTILINE.has(key) });
  }
  return out;
}

function genTicketId(type) {
  return `${(TYPE_META[type]?.prefix||'tck').toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ModerateMembers)) return true;
  if (isValidId(ROLE_ADMIN_ID)  && member.roles?.cache?.has(ROLE_ADMIN_ID))  return true;
  if (isValidId(ROLE_HELPER_ID) && member.roles?.cache?.has(ROLE_HELPER_ID)) return true;
  return false;
}

// ── Resolve category for ticket type ────────────────────────────────
// Priority: per-type env var → log channel's parent category → none
async function resolveCategory(guild, type) {
  // 1. Per-type env var override
  const envId = CATEGORY_IDS[type];
  if (isValidId(envId)) {
    try {
      const cat = await guild.channels.fetch(envId);
      if (cat?.type === ChannelType.GuildCategory) return cat.id;
    } catch (e) {
      console.warn(`[Tickets] TICKET_CATEGORY_${type.toUpperCase()} fetch failed: ${e.message}`);
    }
  }

  // 2. Auto-resolve from log channel's parent — try all configured IDs
  const logChIds = getLogChannelIds(type);
  if (!logChIds.length) {
    console.warn(`[Tickets] No log channel IDs configured for type "${type}" — ticket will be uncategorized`);
    return null;
  }

  for (const logChId of logChIds) {
    if (!isValidId(logChId)) {
      console.warn(`[Tickets] Invalid snowflake in log channels for "${type}": "${logChId}"`);
      continue;
    }
    try {
      let logCh = guild.channels.cache.get(logChId);
      if (!logCh) logCh = await guild.channels.fetch(logChId).catch(() => null);
      if (logCh?.parentId) {
        console.log(`[Tickets] category for "${type}" resolved to ${logCh.parentId} via log channel ${logChId}`);
        return logCh.parentId;
      }
    } catch (e) {
      console.warn(`[Tickets] resolveCategory(${type}) failed on ${logChId}: ${e.message}`);
    }
  }

  console.warn(`[Tickets] No parent category found for type "${type}" — ticket will be uncategorized`);
  return null;
}

async function updateStatus(interaction, statusKey) {
  const status   = STATUS[statusKey] || STATUS.open;
  const oldEmbed = interaction.message?.embeds?.[0];
  if (!oldEmbed) return;
  const newDesc = (oldEmbed.description || '')
    .replace(/> 📊 \*\*Status:\*\*.*/, `> 📊 **Status:** ${status.label}`)
    .replace(/> 👮 \*\*Staff:\*\*.*\n?/, '')
    .replace(/(> 🕐 \*\*Opened:\*\*)/, `> 👮 **Staff:** ${interaction.user}\n$1`);
  await interaction.message.edit({
    embeds:     [EmbedBuilder.from(oldEmbed).setColor(status.color).setDescription(newDesc)],
    components: [buildStaffRow(['resolved','closed'].includes(statusKey))],
  });
}

async function saveTranscript(channel, closedBy, statusKey, client) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const lines    = [...messages.values()].reverse().map(m => {
      const t = new Date(m.createdTimestamp).toLocaleString('en-US',{dateStyle:'short',timeStyle:'short'});
      const c = m.content || (m.embeds[0]?.title ? `[Embed: ${m.embeds[0].title}]` : '[attachment]');
      return `[${t}] ${m.author.username}: ${c}`;
    }).join('\n');
    const text = [
      '═══════════════════════════════════════════',
      'TICKET TRANSCRIPT — TheConclave Dominion',
      `Channel: ${channel.name}`, `Closed by: ${closedBy}`,
      `Status: ${STATUS[statusKey]?.label||statusKey}`,
      `Date: ${new Date().toLocaleString('en-US',{dateStyle:'full',timeStyle:'short'})}`,
      '═══════════════════════════════════════════', '', lines, '', 'END OF TRANSCRIPT',
    ].join('\n');
    const trCh = client.channels.cache.get(TRANSCRIPT_CHANNEL);
    if (!trCh) return;
    await trCh.send({
      embeds: [new EmbedBuilder()
        .setColor(statusKey==='resolved'?0x35ED7E:0x555555)
        .setTitle(`📋 Transcript — ${channel.name}`)
        .addFields(
          {name:'🏷️ Status', value:STATUS[statusKey]?.label||statusKey, inline:true},
          {name:'👤 Closed by', value:closedBy, inline:true},
          {name:'📅 Date', value:`<t:${Math.floor(Date.now()/1000)}:F>`, inline:false},
        )
        .setFooter({text:'TheConclave Dominion · AEGIS Ticket System'}).setTimestamp()
      ],
      files: [new AttachmentBuilder(Buffer.from(text,'utf8'),{name:`transcript-${channel.name}-${Date.now()}.txt`})],
    });
  } catch (e) { console.warn('[Tickets] Transcript error:', e.message); }
}

// ════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════
async function handleTicketInteraction(interaction, client) {

  // ── ticket_open → type selector ───────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'ticket_open') {
    await interaction.reply({
      flags: 64,
      embeds: [new EmbedBuilder().setColor(0x00D4FF).setTitle('🎫 Open a Ticket')
        .setDescription([
          '**Choose the category that matches your request:**','',
          '🛡️ **Support** — Server help, questions, disputes',
          '🎁 **Starter Kit** — New player kit request',
          '🪙 **ConCoin** — Economy, purchases, disputes',
          '💎 **ClaveShard Shop** — Premium orders & fulfillment',
          '👁️ **Base Watch** — AEGIS protection requests','',
          '-# Your ticket will be a **private channel** — only you and staff can see it.',
        ].join('\n')).setFooter({text:'TheConclave Dominion · Powered by AEGIS'})
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tkt_support').setLabel('🛡️ Support').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tkt_starterkit').setLabel('🎁 Starter Kit').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('tkt_concoin').setLabel('🪙 ConCoin').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('tkt_claveshard').setLabel('💎 ClaveShard').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('tkt_basewatch').setLabel('👁️ Base Watch').setStyle(ButtonStyle.Danger),
      )],
    });
    return true;
  }

  // ── tkt_type → show modal ─────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('tkt_') && !interaction.customId.startsWith('tkt_action_')) {
    const type = interaction.customId.replace('tkt_', '');
    const meta = TYPE_META[type] || TYPE_META.support;
    const modal = new ModalBuilder().setCustomId(`ticket_modal_${type}`).setTitle(`${meta.emoji} ${meta.label} Ticket`.slice(0,45));
    modal.addComponents(...(FORMS[type] || FORMS.support));
    await interaction.showModal(modal);
    return true;
  }

  // ── modal submit → create private channel in correct category ─────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
    await interaction.deferReply({ flags: 64 });

    const type     = interaction.customId.replace('ticket_modal_', '');
    const meta     = TYPE_META[type] || TYPE_META.support;
    const ticketId = genTicketId(type);
    const fields   = buildFields(interaction);
    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,20);
    const chName   = `${meta.prefix}-${safeName}`.slice(0,100);

    // Duplicate check
    const existing = interaction.guild.channels.cache.find(
      c => c.name === chName && c.topic?.includes(interaction.user.id)
    );
    if (existing) {
      return interaction.editReply({
        content: `⚠️ You already have an open **${meta.label}** ticket: ${existing}\nUse that channel or ask staff to close it first.`,
      });
    }

    // Resolve category — auto-uses log channel's parent (GET-SUPPORT, STARTER-KIT-SUPPORT, etc.)
    const categoryId = await resolveCategory(interaction.guild, type);

    // Permission overwrites
    const perms = [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
      ]},
      { id: client.user.id, allow: [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ]},
    ];
    if (isValidId(ROLE_ADMIN_ID))  perms.push({ id: ROLE_ADMIN_ID,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] });
    if (isValidId(ROLE_HELPER_ID)) perms.push({ id: ROLE_HELPER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

    // Create channel
    let ticketCh;
    try {
      const opts = {
        name: chName, type: ChannelType.GuildText,
        topic: `${ticketId} · ${interaction.user.id} · ${meta.label}`,
        permissionOverwrites: perms,
      };
      if (categoryId) opts.parent = categoryId;
      ticketCh = await interaction.guild.channels.create(opts);
    } catch (e) {
      console.error('[Tickets] Channel create error:', e.message);
      return interaction.editReply(`⚠️ Could not create ticket channel: ${e.message}`);
    }

    const staffPing = [
      isValidId(ROLE_ADMIN_ID)  ? `<@&${ROLE_ADMIN_ID}>`  : '',
      isValidId(ROLE_HELPER_ID) ? `<@&${ROLE_HELPER_ID}>` : '',
    ].filter(Boolean).join(' ');

    // Post rich embed + staff buttons inside the private channel
    await ticketCh.send({
      content: [
        `${interaction.user} — welcome to your **${meta.label}** ticket!`,
        `> 🎫 ID: \`${ticketId}\`  ·  ⏰ Staff respond within **24h**`,
        `> 💬 Describe anything extra below. Staff will respond here.`,
        staffPing ? `\n${staffPing} — new ticket awaiting response.` : '',
      ].filter(Boolean).join('\n'),
      embeds:     [buildTicketEmbed({ interaction, type, ticketId, statusKey: 'open', fields })],
      components: [buildStaffRow(false)],
    });

    // Compact summary → post to ALL configured admin log channels for this type
    const logChIds = getLogChannelIds(type);
    if (!logChIds.length) {
      console.warn(`[Tickets] No log channels configured for type "${type}" — skipping admin log post`);
    }
    for (const logChId of logChIds) {
      if (!isValidId(logChId)) continue;
      const logCh = await client.channels.fetch(logChId).catch(e => {
        console.warn(`[Tickets] Cannot fetch log channel ${logChId} for type "${type}": ${e.message}`);
        return null;
      });
      if (!logCh) continue;
      await logCh.send({
        content: staffPing || undefined,
        embeds: [new EmbedBuilder()
          .setColor(meta.color)
          .setAuthor({ name: `New ${meta.label} — ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({size:64}) })
          .setDescription([
            `> 🎫 **ID:** \`${ticketId}\``,
            `> 📂 **Channel:** ${ticketCh}`,
            `> 👤 **Player:** ${interaction.user}`,
            fields[0] ? `> 📋 **${fields[0].name}:** ${fields[0].value.slice(0,80)}` : null,
          ].filter(Boolean).join('\n'))
          .setFooter({text:'TheConclave · AEGIS Ticket System v2'}).setTimestamp()
        ],
      }).catch(e => console.warn(`[Tickets] Failed to post to log channel ${logChId}: ${e.message}`));
    }

    return interaction.editReply({
      content: [`✅ **Ticket opened!**`, `> 🎫 ID: \`${ticketId}\``, `> 📂 Your channel: ${ticketCh}`, `> ⏰ Staff will respond within 24 hours`].join('\n'),
    });
  }

  // ── Staff action buttons ──────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('tkt_action_')) {
    const action = interaction.customId.replace('tkt_action_', '');

    if (!isStaff(interaction.member)) {
      await interaction.reply({ content: '⛔ Staff only.', flags: 64 });
      return true;
    }

    if (action === 'claim') {
      await updateStatus(interaction, 'claimed');
      await interaction.reply({ content: `✋ **${interaction.user}** claimed this ticket.` });
      return true;
    }
    if (action === 'progress') {
      await updateStatus(interaction, 'progress');
      await interaction.reply({ content: `🔵 **${interaction.user}** marked this as **In Progress**.` });
      return true;
    }
    if (action === 'escalate') {
      await updateStatus(interaction, 'escalated');
      const ping = isValidId(ROLE_ADMIN_ID) ? `<@&${ROLE_ADMIN_ID}>` : '@Admin';
      await interaction.reply({ content: `🔴 ${ping} — **Escalated** by ${interaction.user}. Immediate attention required.` });
      return true;
    }
    if (action === 'resolve') {
      await updateStatus(interaction, 'resolved');
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x35ED7E).setTitle('✅ Ticket Resolved')
          .setDescription(`Resolved by ${interaction.user}.\n\n*Transcript saved. Channel deletes in **10 seconds**.*`).setTimestamp()],
      });
      await saveTranscript(interaction.channel, interaction.user.username, 'resolved', client);
      setTimeout(() => interaction.channel.delete().catch(() => {}), 10_000);
      return true;
    }
    if (action === 'close') {
      await updateStatus(interaction, 'closed');
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x555555).setTitle('🔒 Ticket Closed')
          .setDescription(`Closed by ${interaction.user}.\n\n*Transcript saved. Channel deletes in **10 seconds**.*`).setTimestamp()],
      });
      await saveTranscript(interaction.channel, interaction.user.username, 'closed', client);
      setTimeout(() => interaction.channel.delete().catch(() => {}), 10_000);
      return true;
    }
    return true;
  }

  return false;
}

module.exports = { handleTicketInteraction };
