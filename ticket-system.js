// ═══════════════════════════════════════════════════════════════════════
// AEGIS TICKET SYSTEM — Fully Self-Contained
// Mirrors watchtower-system.js pattern exactly:
// Button → Modal Form → Direct Channel Post + Admin Ping
// All ticket types: support, starterkit, concoin, claveshard, basewatch
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require('discord.js');

// ── Channel IDs — reads from env, falls back to hardcoded Dominion IDs ──
const LOG_CHANNELS = {
  support:    process.env.LOG_SUPPORT    || process.env.TICKET_LOG_SUPPORT    || '1503110133540978769',
  starterkit: process.env.LOG_STARTERKIT || process.env.TICKET_LOG_STARTERKIT || '1503109898093727906',
  concoin:    process.env.LOG_CONCOIN    || process.env.TICKET_LOG_CONCOIN    || '1503109720456691742',
  claveshard: process.env.LOG_CLAVESHARD || process.env.TICKET_LOG_CLAVESHARD || '1503109559022256251',
  basewatch:  process.env.LOG_BASEWATCH  || process.env.TICKET_LOG_BASEWATCH  || '1503109371910029415',
};

const TRANSCRIPT_CH = process.env.TRANSCRIPT_CHANNEL || '1503111460790735041';

const TYPE_META = {
  support:    { label: 'Support Ticket',         emoji: '🛡️', color: 0x00D4FF },
  starterkit: { label: 'Starter Kit Request',     emoji: '🎁', color: 0x35ED7E },
  concoin:    { label: 'ConCoin Shop Ticket',      emoji: '🪙', color: 0xFFB800 },
  claveshard: { label: 'ClaveShard Shop Ticket',   emoji: '💎', color: 0xFF4CD2 },
  basewatch:  { label: 'Base Watch Request',       emoji: '👁️', color: 0x7B2FFF },
};

// ── Modal forms per ticket type ─────────────────────────────────────────
const FORMS = {
  support: [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('issue')
        .setLabel('What do you need help with?')
        .setStyle(TextInputStyle.Paragraph).setRequired(true)
        .setPlaceholder('Describe your issue in as much detail as possible...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('server')
        .setLabel('Which server? (if applicable)')
        .setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('e.g. Aberration, Scorched Earth, Cyber Nexus...')
    ),
  ],
  starterkit: [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('character')
        .setLabel('Character Name').setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Your in-game character name')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('server')
        .setLabel('Which Server / Map?').setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('e.g. The Island, Scorched Earth...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('platform')
        .setLabel('Platform').setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Xbox / PlayStation / PC / Switch')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('tribe')
        .setLabel('Tribe Name (or Solo?)').setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('Your tribe name, or "Solo"')
    ),
  ],
  concoin: [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('issue')
        .setLabel('What is your ConCoin issue?').setStyle(TextInputStyle.Paragraph).setRequired(true)
        .setPlaceholder('Describe your purchase, missing coins, or dispute...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('amount')
        .setLabel('ConCoin Amount Involved').setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('e.g. 500 ConCoins')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('proof')
        .setLabel('Proof / Transaction Reference').setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('Screenshot link or transaction ID')
    ),
  ],
  claveshard: [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('tier')
        .setLabel('Tier / Item Selection').setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('T1/T2/T3/T5/T6/T8/T10/T12/T15/T20/T30 or Dino Insurance')
        .setMinLength(1).setMaxLength(50)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('character')
        .setLabel('Character Name & Server / Map').setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('e.g. SurvivorX on Aberration')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('platform')
        .setLabel('Platform').setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Xbox / PlayStation / PC / Switch')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('order_details')
        .setLabel('Order Details / Special Requests')
        .setStyle(TextInputStyle.Paragraph).setRequired(false)
        .setPlaceholder('Specific dino type, colors, species name, delivery notes...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('payment')
        .setLabel('Payment Method + Confirmation').setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('Cash App / Chime + last 4 digits or username')
    ),
  ],
  basewatch: [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('tribe')
        .setLabel('Tribe Name').setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Your tribe name')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('server')
        .setLabel('Server / Map').setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('e.g. Aberration, The Island...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('location')
        .setLabel('Base Location / Coordinates').setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('e.g. 45.2 / 67.8 or "Red Obelisk area"')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('duration')
        .setLabel('How long do you need watch?').setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('e.g. 48 hours, this weekend, 1 week')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason')
        .setLabel('Reason for request').setStyle(TextInputStyle.Paragraph).setRequired(true)
        .setPlaceholder('Going offline? Travelling? Explain why you need protection...')
    ),
  ],
};

// ── Build embed fields from modal submission ────────────────────────────
function buildEmbedFields(interaction, type) {
  const fields = interaction.fields.fields;
  const embedFields = [
    { name: '👤 User',    value: `${interaction.user} \`${interaction.user.username}\``, inline: true },
    { name: '🏷️ Type',   value: TYPE_META[type]?.label || type, inline: true },
    { name: '🕐 Opened', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
    { name: '🌐 Server', value: `${interaction.guild?.name || 'Unknown'}`, inline: true },
  ];

  const FIELD_MAP = {
    issue:         '📋 Issue / Request',
    reason:        '📋 Reason',
    server:        '🗺️ Server / Map',
    character:     '🦖 Character',
    platform:      '🎮 Platform',
    tribe:         '🏕️ Tribe',
    tier:          '💎 Tier Selected',
    order_details: '📋 Order Details',
    payment:       '💳 Payment',
    amount:        '💰 Amount',
    proof:         '📎 Proof / Reference',
    location:      '📍 Base Location',
    duration:      '⏱️ Watch Duration',
  };

  for (const [key, label] of Object.entries(FIELD_MAP)) {
    const val = fields.get(key)?.value;
    if (val) {
      embedFields.push({
        name:   label,
        value:  val.slice(0, 500),
        inline: !['issue','reason','order_details','📋 Order Details'].includes(key),
      });
    }
  }

  return embedFields;
}

// ── Main interaction handler — call this FIRST in bot.on(InteractionCreate) ──
async function handleTicketInteraction(interaction, client) {

  // ── TYPE SELECTOR (ticket_open button) ─────────────────────────────
  if (interaction.isButton() && interaction.customId === 'ticket_open') {
    await interaction.reply({
      flags: 64,
      embeds: [new EmbedBuilder()
        .setColor(0x00D4FF)
        .setTitle('🎫 Open a Support Ticket')
        .setDescription([
          '**Select the category that matches your request:**',
          '',
          '🛡️ **Support** — General server help, questions, issues',
          '🎁 **Starter Kit** — Request your new player starter kit',
          '🪙 **ConCoin Shop** — ConCoin purchases, economy issues',
          '💎 **ClaveShard Shop** — Shard orders, fulfillment',
          '👁️ **Base Watch** — AEGIS tower base protection requests',
        ].join('\n'))
        .setFooter({ text: 'TheConclave Dominion · Tickets are private' })
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tkt_support').setLabel('🛡️ Support').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tkt_starterkit').setLabel('🎁 Starter Kit').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('tkt_concoin').setLabel('🪙 ConCoin Shop').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('tkt_claveshard').setLabel('💎 ClaveShard Shop').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('tkt_basewatch').setLabel('👁️ Base Watch').setStyle(ButtonStyle.Danger),
      )],
    });
    return true;
  }

  // ── TICKET TYPE BUTTON → show modal ────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('tkt_')) {
    const type = interaction.customId.replace('tkt_', '');
    const meta = TYPE_META[type] || TYPE_META.support;
    const form = FORMS[type] || FORMS.support;

    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal_${type}`)
      .setTitle(meta.label.slice(0, 45));

    modal.addComponents(...form);
    await interaction.showModal(modal);
    return true;
  }

  // ── MODAL SUBMIT → post to log channel ─────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
    await interaction.deferReply({ flags: 64 });

    const type    = interaction.customId.replace('ticket_modal_', '');
    const meta    = TYPE_META[type] || TYPE_META.support;
    const logChId = LOG_CHANNELS[type];

    // Check log channel
    if (!logChId) {
      return interaction.editReply('⚠️ Ticket log channel not configured. Contact an admin.');
    }

    const logChannel = await client.channels.fetch(logChId).catch(() => null);
    if (!logChannel) {
      return interaction.editReply('⚠️ Ticket log channel not found. Contact an admin.');
    }

    // Build embed
    const embedFields = buildEmbedFields(interaction, type);

    // Staff ping
    const adminRoleId  = process.env.ROLE_ADMIN_ID;
    const helperRoleId = process.env.ROLE_HELPER_ID;
    const pingContent  = [
      `${interaction.user}`,
      adminRoleId  ? `<@&${adminRoleId}>`  : '',
      helperRoleId ? `<@&${helperRoleId}>` : '',
    ].filter(Boolean).join(' ');

    // Post to log channel (direct — no webhooks, no Supabase)
    try {
      await logChannel.send({
        content: pingContent,
        embeds: [new EmbedBuilder()
          .setColor(meta.color)
          .setTitle(`${meta.emoji} New ${meta.label}`)
          .addFields(embedFields)
          .setFooter({ text: 'TheConclave Dominion · AEGIS Ticket System' })
          .setTimestamp()
        ],
      });
    } catch (sendErr) {
      console.error(`[Tickets] Failed to post to log channel ${logChId}:`, sendErr.message);
      return interaction.editReply('⚠️ Failed to submit ticket — could not reach log channel. Contact an admin.');
    }

    // Confirm to user
    return interaction.editReply({
      content: `✅ **${meta.label}** submitted successfully!\nStaff will respond in <#${logChId}>.`,
    });
  }

  // ── TICKET CLAIM ────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'ticket_claim') {
    const modPerms = interaction.member?.permissions?.has?.('ModerateMembers');
    const adminRole = process.env.ROLE_ADMIN_ID;
    const helperRole = process.env.ROLE_HELPER_ID;
    const hasRole = interaction.member?.roles?.cache?.has(adminRole) ||
                    interaction.member?.roles?.cache?.has(helperRole);

    if (!modPerms && !hasRole) {
      await interaction.reply({ content: '⛔ Staff only.', flags: 64 });
      return true;
    }

    await interaction.reply({
      content: `✋ **${interaction.user}** has claimed this ticket. They will handle it from here.`,
    });
    return true;
  }

  // ── TICKET CLOSE / RESOLVE ──────────────────────────────────────────
  if (interaction.isButton() && ['ticket_close', 'ticket_resolve'].includes(interaction.customId)) {
    const modPerms = interaction.member?.permissions?.has?.('ModerateMembers');
    const adminRole = process.env.ROLE_ADMIN_ID;
    const helperRole = process.env.ROLE_HELPER_ID;
    const hasRole = interaction.member?.roles?.cache?.has(adminRole) ||
                    interaction.member?.roles?.cache?.has(helperRole);

    if (!modPerms && !hasRole) {
      await interaction.reply({ content: '⛔ Staff only.', flags: 64 });
      return true;
    }

    const isResolve = interaction.customId === 'ticket_resolve';
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(isResolve ? 0x35ED7E : 0xFF4444)
        .setTitle(isResolve ? '✅ Ticket Resolved' : '🔒 Ticket Closed')
        .setDescription(`${isResolve ? 'Resolved' : 'Closed'} by ${interaction.user}`)
        .setTimestamp()
      ],
    });

    // Save transcript
    try {
      const ch = interaction.channel;
      const messages = await ch.messages.fetch({ limit: 100 });
      const sorted   = [...messages.values()].reverse();
      const lines    = sorted.map(m => {
        const time    = new Date(m.createdTimestamp).toLocaleString('en-US', { dateStyle:'short', timeStyle:'short' });
        const content = m.content || (m.embeds[0]?.title ? `[Embed: ${m.embeds[0].title}]` : '[attachment]');
        return `[${time}] ${m.author.username}: ${content}`;
      }).join('\n');

      const transcriptText = [
        '═══════════════════════════════════════════',
        'TICKET TRANSCRIPT — TheConclave Dominion',
        `Thread: ${ch.name}`,
        `Closed by: ${interaction.user.username}`,
        `Date: ${new Date().toLocaleString('en-US', { dateStyle:'full', timeStyle:'short' })}`,
        '═══════════════════════════════════════════',
        '', lines, '',
        'END OF TRANSCRIPT',
      ].join('\n');

      const transcriptCh = client.channels.cache.get(TRANSCRIPT_CH);
      if (transcriptCh) {
        const { AttachmentBuilder } = require('discord.js');
        const buf        = Buffer.from(transcriptText, 'utf8');
        const attachment = new AttachmentBuilder(buf, { name: `transcript-${ch.name}-${Date.now()}.txt` });
        await transcriptCh.send({
          embeds: [new EmbedBuilder()
            .setColor(isResolve ? 0x35ED7E : 0xFF4444)
            .setTitle(`📋 Transcript — ${ch.name}`)
            .addFields(
              { name: '🏷️ Status',    value: isResolve ? '✅ Resolved' : '🔒 Closed', inline: true },
              { name: '👤 Closed by', value: interaction.user.username, inline: true },
              { name: '📅 Date',      value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true },
            )
            .setFooter({ text: 'TheConclave Dominion · AEGIS Ticket System' })
            .setTimestamp()
          ],
          files: [attachment],
        }).catch(() => {});
      }
    } catch (transcriptErr) {
      console.warn('[Tickets] Transcript error:', transcriptErr.message);
    }

    // Archive or delete channel
    setTimeout(async () => {
      try {
        if (interaction.channel.isThread()) {
          await interaction.channel.setArchived(true);
        } else {
          await interaction.channel.delete();
        }
      } catch {}
    }, 8000);

    return true;
  }

  // Not a ticket interaction
  return false;
}

module.exports = { handleTicketInteraction };
