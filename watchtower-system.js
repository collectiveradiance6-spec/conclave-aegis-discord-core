// ═══════════════════════════════════════════════════════════════════════
// AEGIS WATCHTOWER — Base Protection Request System
// Button → Modal Form → Public Forum/Channel Post + Admin Log
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
  openForm: 'watchtower_open_base_protection_form',
  submitForm: 'watchtower_submit_base_protection_form',
};

function buildWatchtowerButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.openForm)
      .setLabel('🛡️ Open Base Protection Form')
      .setStyle(ButtonStyle.Primary)
  );
}

function buildWatchtowerPanelContent() {
  return [
    '⟦ :URGENTA: 🛡️ AEGIS_WATCHTOWER // BASE_PROTECTION_REQUESTS 🛡️ :URGENTA: ⟧',
    '',
    '📡 This is the official Watchtower intake for base upkeep while players are away.',
    '',
    '🧱 Normal policy: bases are usually not deleted until ⏳ **60 days** of inactivity unless staff were informed prior.',
    '📅 Request limit: admins can hold/monitor one request for one ⏳ **3-month segment** at a time.',
    '⚠️ Special circumstances may be reviewed and extended at staff discretion.',
    '',
    'Click the button below to submit the form. 👇',
  ].join('\n');
}

async function sendWatchtowerPanel(channel) {
  return channel.send({
    content: buildWatchtowerPanelContent(),
    components: [buildWatchtowerButton()],
  });
}

function buildRequestEmbed({ interaction, playerTribe, discordName, mapLocation, dates, upkeep, notes }) {
  return new EmbedBuilder()
    .setColor(0x7b2fff)
    .setTitle('🛡️ Base Protection Request')
    .setDescription('📊 Status: 🟡 Pending')
    .addFields(
      { name: '👤 Player / Tribe', value: playerTribe.slice(0, 1024), inline: false },
      { name: '💬 Discord', value: discordName.slice(0, 1024), inline: true },
      { name: '🗺️ Map / Location', value: mapLocation.slice(0, 1024), inline: false },
      { name: '⏳ Away → Return', value: dates.slice(0, 1024), inline: false },
      { name: '⚙️ Upkeep Needed', value: upkeep.slice(0, 1024), inline: false },
      { name: '🧠 Notes / Urgency', value: (notes || 'No special notes provided.').slice(0, 1024), inline: false },
    )
    .setFooter({ text: `Submitted by ${interaction.user.tag} · Watchtower Protocol` })
    .setTimestamp();
}

async function handleWatchtowerInteraction(interaction, client) {
  if (interaction.isButton() && interaction.customId === IDS.openForm) {
    const modal = new ModalBuilder()
      .setCustomId(IDS.submitForm)
      .setTitle('Base Protection Request');

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

    const mapLocation = new TextInputBuilder()
      .setCustomId('map_location')
      .setLabel('Map + Base Location / Coords')
      .setPlaceholder('Example: Valguero — 45 / 62 — Cliffside metal base')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200);

    const dates = new TextInputBuilder()
      .setCustomId('dates')
      .setLabel('Leaving Date → Expected Return Date')
      .setPlaceholder('Example: 04/28 → 05/15')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const upkeep = new TextInputBuilder()
      .setCustomId('upkeep')
      .setLabel('Upkeep Needed + Notes / Urgency')
      .setPlaceholder('Example: Feed dinos, fuel generators. Standard urgency. Turrets active.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(900);

    modal.addComponents(
      new ActionRowBuilder().addComponents(playerTribe),
      new ActionRowBuilder().addComponents(discordName),
      new ActionRowBuilder().addComponents(mapLocation),
      new ActionRowBuilder().addComponents(dates),
      new ActionRowBuilder().addComponents(upkeep),
    );

    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === IDS.submitForm) {
    const playerTribe = interaction.fields.getTextInputValue('player_tribe');
    const discordName = interaction.fields.getTextInputValue('discord_name');
    const mapLocation = interaction.fields.getTextInputValue('map_location');
    const dates = interaction.fields.getTextInputValue('dates');
    const upkeep = interaction.fields.getTextInputValue('upkeep');
    const notes = upkeep;

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

    const embed = buildRequestEmbed({ interaction, playerTribe, discordName, mapLocation, dates, upkeep, notes });

    const publicContent = [
      '⟦ 🛡️ BASE_PROTECTION_REQUEST 🛡️ ⟧',
      '',
      `👤 Player / Tribe: ${playerTribe}`,
      `💬 Discord: ${discordName}`,
      `🗺️ Map / Location: ${mapLocation}`,
      `⏳ Away → Return: ${dates}`,
      `⚙️ Upkeep Needed: ${upkeep}`,
      '',
      '📊 Status: 🟡 Pending',
    ].join('\n');

    const adminContent = [
      WATCHTOWER_STAFF_ROLE_ID ? `<@&${WATCHTOWER_STAFF_ROLE_ID}>` : null,
      '⟦ :URGENTA: 🛡️ ADMIN_BASE_PROTECTION_LOG 🛡️ :URGENTA: ⟧',
      '',
      `👤 Submitted By: ${interaction.user.tag}`,
      `🆔 Discord ID: ${interaction.user.id}`,
      `👤 Player / Tribe: ${playerTribe}`,
      `💬 Discord Name: ${discordName}`,
      `🗺️ Map / Location: ${mapLocation}`,
      `⏳ Away → Return: ${dates}`,
      `⚙️ Upkeep Needed: ${upkeep}`,
      '',
      '📊 Status: 🟡 Pending',
    ].filter(Boolean).join('\n');

    if (publicChannel.type === ChannelType.GuildForum) {
      await publicChannel.threads.create({
        name: `🛡️ Base Request // ${playerTribe}`.slice(0, 100),
        message: { content: publicContent, embeds: [embed] },
      });
    } else {
      await publicChannel.send({ content: publicContent, embeds: [embed] });
    }

    await adminLog.send({ content: adminContent, embeds: [embed] });

    await interaction.reply({
      content: '✅ Your base protection request has been submitted to the Watchtower.',
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
