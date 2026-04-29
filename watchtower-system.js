// ═══════════════════════════════════════════════════════════════════════
// AEGIS WATCHTOWER — Base Watch Request System
// Button → Modal Form → Public Forum/Channel Post + Admin Log
// Staff actions → Claim / In Progress / Complete / Extension Review
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');

const WATCHTOWER_PUBLIC_CHANNEL_ID = process.env.WATCHTOWER_PUBLIC_CHANNEL_ID || null;
const WATCHTOWER_ADMIN_LOG_CHANNEL_ID = process.env.WATCHTOWER_ADMIN_LOG_CHANNEL_ID || null;
const WATCHTOWER_STAFF_ROLE_ID = process.env.WATCHTOWER_STAFF_ROLE_ID || process.env.ROLE_ADMIN_ID || null;

const IDS = {
  openForm: 'watchtower_open_base_watch_form',
  submitForm: 'watchtower_submit_base_watch_form',
  claim: 'watchtower_claim',
  progress: 'watchtower_progress',
  complete: 'watchtower_complete',
  extension: 'watchtower_extension',
};

const STATUS = {
  pending: { label: '🟡 Pending Review', color: 0x7b2fff },
  claimed: { label: '🟢 Assigned / Claimed', color: 0x35ed7e },
  progress: { label: '🔵 In Progress', color: 0x00d4ff },
  complete: { label: '✅ Completed', color: 0x35ed7e },
  extension: { label: '🟣 Extension Review', color: 0xff4cd2 },
};

function buildWatchtowerButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.openForm)
      .setLabel('🛡️ Open Base Watch Request')
      .setStyle(ButtonStyle.Primary)
  );
}

function buildStaffActionRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(IDS.claim).setLabel('🟢 Claim').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(IDS.progress).setLabel('🔵 In Progress').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(IDS.complete).setLabel('✅ Complete').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(IDS.extension).setLabel('🟣 Extension').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
}

function buildWatchtowerPanelContent() {
  return [
    '⟦ 🛡️ AEGIS_TOWER // BASE_WATCH_REQUESTS 🛡️ ⟧',
    '',
    '📡 Need your base watched while you are away? Submit a Base Watch Request below.',
    '',
    '⟡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⟡',
    '',
    '🧾 **What this is for**',
    '• Away-player base upkeep',
    '• Multiple maps / multiple base locations',
    '• Dino feeding checks 🐾',
    '• Generator fuel checks 🔋',
    '• Decay prevention / monitoring 👁️',
    '• Minor emergency notes ⚠️',
    '',
    '⏳ **Policy**',
    '• Bases are normally reviewed after **60 days** of inactivity unless staff were informed prior.',
    '• Requests may be held for one **3-month segment** at a time.',
    '• Extensions may be approved only for special circumstances.',
    '',
    '📍 **Multiple Bases**',
    'List every map and base location clearly. One base per line is best.',
    '`Valguero — 45/62 — cliff base`',
    '`The Island — 72/34 — ocean pen`',
    '',
    '🚫 **Not for**',
    '• Full base management',
    '• Constant supervision',
    '• Building, breeding, farming, or personal chores',
    '',
    'Click below to open a Base Watch Request ticket. 👇',
  ].join('\n');
}

async function sendWatchtowerPanel(channel) {
  return channel.send({
    content: buildWatchtowerPanelContent(),
    components: [buildWatchtowerButton()],
  });
}

function safeField(value, fallback = 'Not provided') {
  return String(value || fallback).slice(0, 1024);
}

function parseBaseLines(baseLocations) {
  return String(baseLocations || '')
    .split(/\n|;/g)
    .map(line => line.trim())
    .filter(Boolean);
}

function inferPriority(upkeep, baseLocations, dates) {
  const raw = `${upkeep || ''} ${baseLocations || ''} ${dates || ''}`.toLowerCase();
  const urgentWords = ['urgent', 'emergency', 'decay', 'timer', 'almost out', 'out of fuel', 'starving', 'low food', 'cryofridge', 'generator off', 'offline soon'];
  const extensionWords = ['extension', 'longer', 'delayed', '3 month', 'three month', 'special circumstance'];
  if (extensionWords.some(w => raw.includes(w))) return '🟣 Extension Review';
  if (urgentWords.some(w => raw.includes(w))) return '🔴 Urgent Review';
  return '🟡 Standard';
}

function buildLocationSummary(baseLocations) {
  const lines = parseBaseLines(baseLocations);
  if (!lines.length) return 'No parsed locations.';
  return lines.map((line, index) => `**${index + 1}.** ${line}`).join('\n').slice(0, 1024);
}

function buildRequestEmbed({ interaction, playerTribe, discordName, baseLocations, dates, upkeep, accessNotes, statusKey = 'pending' }) {
  const status = STATUS[statusKey] || STATUS.pending;
  const priority = inferPriority(upkeep, baseLocations, dates);
  const baseCount = parseBaseLines(baseLocations).length || 1;

  return new EmbedBuilder()
    .setColor(status.color)
    .setTitle('🛡️ Base Watch Request')
    .setDescription(`📊 Status: **${status.label}**\n🚨 Priority: **${priority}**\n📍 Base Entries: **${baseCount}**`)
    .addFields(
      { name: '👤 Player / Tribe', value: safeField(playerTribe), inline: false },
      { name: '💬 Discord', value: safeField(discordName), inline: true },
      { name: '🗺️ Parsed Base Locations', value: safeField(buildLocationSummary(baseLocations)), inline: false },
      { name: '⏳ Away → Return', value: safeField(dates), inline: false },
      { name: '⚙️ Upkeep Needed', value: safeField(upkeep), inline: false },
      { name: '🔐 Access / Urgency Notes', value: safeField(accessNotes, 'No special access or urgency notes provided.'), inline: false },
    )
    .setFooter({ text: `Submitted by ${interaction.user.tag} · AEGIS Watchtower` })
    .setTimestamp();
}

function updateEmbedStatus(oldEmbed, statusKey, actorTag) {
  const status = STATUS[statusKey] || STATUS.pending;
  const embed = EmbedBuilder.from(oldEmbed)
    .setColor(status.color)
    .setDescription(`${oldEmbed.description || ''}\n\n🧭 Staff Update: **${status.label}** by **${actorTag}**`)
    .setTimestamp();
  return embed;
}

async function handleStaffAction(interaction, statusKey) {
  if (!interaction.member?.permissions?.has?.('ManageMessages') && WATCHTOWER_STAFF_ROLE_ID && !interaction.member?.roles?.cache?.has(WATCHTOWER_STAFF_ROLE_ID)) {
    await interaction.reply({ content: '⛔ Watchtower staff only.', ephemeral: true });
    return true;
  }

  const oldEmbed = interaction.message.embeds?.[0];
  if (!oldEmbed) {
    await interaction.reply({ content: '⚠️ No Watchtower embed found on this message.', ephemeral: true });
    return true;
  }

  const updated = updateEmbedStatus(oldEmbed, statusKey, interaction.user.tag);
  const disableActions = statusKey === 'complete';

  await interaction.message.edit({
    embeds: [updated],
    components: [buildStaffActionRow(disableActions)],
  });

  await interaction.reply({
    content: `✅ Watchtower request updated to **${(STATUS[statusKey] || STATUS.pending).label}**.`,
    ephemeral: true,
  });

  return true;
}

async function handleWatchtowerInteraction(interaction, client) {
  if (interaction.isButton()) {
    if (interaction.customId === IDS.claim) return handleStaffAction(interaction, 'claimed');
    if (interaction.customId === IDS.progress) return handleStaffAction(interaction, 'progress');
    if (interaction.customId === IDS.complete) return handleStaffAction(interaction, 'complete');
    if (interaction.customId === IDS.extension) return handleStaffAction(interaction, 'extension');
  }

  if (interaction.isButton() && interaction.customId === IDS.openForm) {
    const modal = new ModalBuilder()
      .setCustomId(IDS.submitForm)
      .setTitle('Base Watch Request');

    const playerTribe = new TextInputBuilder()
      .setCustomId('player_tribe')
      .setLabel('Player / Tribe Name')
      .setPlaceholder('Example: TW__ / Radiant')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const discordName = new TextInputBuilder()
      .setCustomId('discord_name')
      .setLabel('Discord Name')
      .setPlaceholder('Example: _Tw__')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const baseLocations = new TextInputBuilder()
      .setCustomId('base_locations')
      .setLabel('Maps + Base Locations / Coords')
      .setPlaceholder('One per line: Valguero 45/62 cliff base; Island 72/34 water pen')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(900);

    const dates = new TextInputBuilder()
      .setCustomId('dates')
      .setLabel('Leaving Date → Expected Return Date')
      .setPlaceholder('Example: 04/28 → 05/15')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const upkeep = new TextInputBuilder()
      .setCustomId('upkeep')
      .setLabel('Upkeep + Access / Urgency Notes')
      .setPlaceholder('Example: Feed dinos, fuel generators. Main gate unlocked. Standard urgency. Turrets active.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(900);

    modal.addComponents(
      new ActionRowBuilder().addComponents(playerTribe),
      new ActionRowBuilder().addComponents(discordName),
      new ActionRowBuilder().addComponents(baseLocations),
      new ActionRowBuilder().addComponents(dates),
      new ActionRowBuilder().addComponents(upkeep),
    );

    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === IDS.submitForm) {
    const playerTribe = interaction.fields.getTextInputValue('player_tribe');
    const discordName = interaction.fields.getTextInputValue('discord_name');
    const baseLocations = interaction.fields.getTextInputValue('base_locations');
    const dates = interaction.fields.getTextInputValue('dates');
    const upkeep = interaction.fields.getTextInputValue('upkeep');
    const accessNotes = upkeep;
    const priority = inferPriority(upkeep, baseLocations, dates);
    const baseCount = parseBaseLines(baseLocations).length || 1;

    if (!WATCHTOWER_PUBLIC_CHANNEL_ID || !WATCHTOWER_ADMIN_LOG_CHANNEL_ID) {
      await interaction.reply({
        content: '⚠️ Watchtower is missing channel IDs. Staff must set WATCHTOWER_PUBLIC_CHANNEL_ID and WATCHTOWER_ADMIN_LOG_CHANNEL_ID in Render.',
        ephemeral: true,
      });
      return true;
    }

    const publicChannel = await client.channels.fetch(WATCHTOWER_PUBLIC_CHANNEL_ID).catch(() => null);
    const adminLog = await client.channels.fetch(WATCHTOWER_ADMIN_LOG_CHANNEL_ID).catch(() => null);

    if (!publicChannel || !adminLog) {
      await interaction.reply({
        content: '⚠️ Watchtower channel lookup failed. Staff should verify the public/admin channel IDs.',
        ephemeral: true,
      });
      return true;
    }

    const embed = buildRequestEmbed({ interaction, playerTribe, discordName, baseLocations, dates, upkeep, accessNotes });

    const publicContent = [
      '⟦ 🛡️ BASE_WATCH_REQUEST 🛡️ ⟧',
      '',
      `👤 Player / Tribe: ${playerTribe}`,
      `💬 Discord: ${discordName}`,
      `🚨 Priority: ${priority}`,
      `📍 Base Entries: ${baseCount}`,
      '',
      '🗺️ Maps + Base Locations:',
      buildLocationSummary(baseLocations),
      '',
      `⏳ Away → Return: ${dates}`,
      '',
      '⚙️ Upkeep / Notes:',
      upkeep,
      '',
      '📊 Status: 🟡 Pending Review',
    ].join('\n');

    const adminContent = [
      WATCHTOWER_STAFF_ROLE_ID ? `<@&${WATCHTOWER_STAFF_ROLE_ID}>` : null,
      '⟦ :URGENTA: 🔒 AEGIS_TOWER_BASE_WATCH // ADMIN_LOG 🔒 :URGENTA: ⟧',
      '',
      `👤 Submitted By: ${interaction.user.tag}`,
      `🆔 Discord ID: ${interaction.user.id}`,
      `👤 Player / Tribe: ${playerTribe}`,
      `💬 Discord Name: ${discordName}`,
      `🚨 Priority: ${priority}`,
      `📍 Base Entries: ${baseCount}`,
      '',
      '🗺️ Maps + Base Locations:',
      buildLocationSummary(baseLocations),
      '',
      `⏳ Away → Return: ${dates}`,
      '',
      '⚙️ Upkeep / Access / Urgency:',
      upkeep,
      '',
      '📊 Status: 🟡 Pending Review',
    ].filter(Boolean).join('\n');

    if (publicChannel.type === ChannelType.GuildForum) {
      await publicChannel.threads.create({
        name: `🛡️ ${priority.replace(/^[^A-Za-z]+/, '')} // ${playerTribe}`.slice(0, 100),
        message: { content: publicContent, embeds: [embed] },
      });
    } else {
      await publicChannel.send({ content: publicContent, embeds: [embed] });
    }

    await adminLog.send({
      content: adminContent,
      embeds: [embed],
      components: [buildStaffActionRow(false)],
    });

    await interaction.reply({
      content: '✅ Your Base Watch Request has been submitted to the Watchtower.',
      ephemeral: true,
    });
    return true;
  }

  return false;
}

module.exports = {
  sendWatchtowerPanel,
  handleWatchtowerInteraction,
};
