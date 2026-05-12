// ═══════════════════════════════════════════════════════════════════════
// AEGIS TICKET SYSTEM v3.0 — Enterprise Multi-Guild
// Zero env vars for per-guild config. Everything lives in guild_configs.
// Adding a new server = one SQL INSERT. Zero code or Render changes.
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, PermissionFlagsBits, ChannelType,
  AttachmentBuilder,
} = require('discord.js');

const guildManager = require('./managers/guildManager');

const ENV_ROLE_ADMIN  = process.env.ROLE_ADMIN_ID  || null;
const ENV_ROLE_HELPER = process.env.ROLE_HELPER_ID || null;

const TYPE_META = {
  support:    { label: 'Support',         emoji: '🛡️', color: 0x00D4FF, prefix: 'sup',  webhookKey: 'webhook_support',    logKey: 'ticket_log_support'    },
  starterkit: { label: 'Starter Kit',     emoji: '🎁', color: 0x35ED7E, prefix: 'kit',  webhookKey: 'webhook_starterkit', logKey: 'ticket_log_starterkit' },
  concoin:    { label: 'ConCoin Shop',    emoji: '🪙', color: 0xFFB800, prefix: 'cc',   webhookKey: 'webhook_concoin',    logKey: 'ticket_log_concoin'    },
  claveshard: { label: 'ClaveShard Shop', emoji: '💎', color: 0xFF4CD2, prefix: 'clvs', webhookKey: 'webhook_claveshard', logKey: 'ticket_log_claveshard' },
  basewatch:  { label: 'Base Watch',      emoji: '👁️', color: 0x7B2FFF, prefix: 'bw',   webhookKey: 'webhook_basewatch',  logKey: 'ticket_log_basewatch'  },
};

const STATUS = {
  open:      { label: '🟡 Open — Awaiting Staff', color: 0x7B2FFF },
  claimed:   { label: '🟢 Claimed',               color: 0x00D4FF },
  progress:  { label: '🔵 In Progress',            color: 0x0099FF },
  escalated: { label: '🔴 Escalated',              color: 0xFF4500 },
  resolved:  { label: '✅ Resolved',               color: 0x35ED7E },
  closed:    { label: '🔒 Closed',                 color: 0x555555 },
};

async function getGuildCfg(guildId) {
  return (await guildManager.getConfig(guildId)) || {};
}
async function getWebhookUrl(guildId, type) {
  const meta = TYPE_META[type]; if (!meta) return null;
  return (await getGuildCfg(guildId))[meta.webhookKey] || null;
}
async function getLogChannelId(guildId, type) {
  const meta = TYPE_META[type]; if (!meta) return null;
  return (await getGuildCfg(guildId))[meta.logKey] || null;
}
async function getTranscriptChannelId(guildId) {
  const cfg = await getGuildCfg(guildId);
  return cfg.transcript_channel || process.env.TRANSCRIPT_CHANNEL || null;
}
async function getStaffRoles(guildId) {
  const cfg = await getGuildCfg(guildId);
  return { adminId: cfg.role_admin_id || ENV_ROLE_ADMIN || null, helperId: cfg.role_helper_id || ENV_ROLE_HELPER || null };
}

const FORMS = {
  support: [
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('issue').setLabel('What do you need help with?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Describe your issue in detail...')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('platform').setLabel('Platform (Xbox / PS / PC)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(20)),
  ],
  starterkit: [
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('character').setLabel('Character Name (in-game)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server').setLabel('Which server / map?').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80).setPlaceholder('e.g. The Island, Extinction...')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('platform').setLabel('Platform (Xbox / PS / PC)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)),
  ],
  concoin: [
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('issue').setLabel('Describe your ConCoin issue').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800).setPlaceholder('Missing coins, trade dispute, purchase issue...')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('Amount involved (if applicable)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(30)),
  ],
  claveshard: [
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tier').setLabel('Tier (e.g. T1, T5, T15, Insurance)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server').setLabel('Which server / map?').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('platform').setLabel('Platform (Xbox / PS / PC)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('notes').setLabel('Special requests / dino name').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
  ],
  basewatch: [
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tribe').setLabel('Tribe Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server').setLabel('Server / Map').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('coords').setLabel('Base coordinates or description').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('duration').setLabel('How long offline?').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(80).setPlaceholder('e.g. 3 days, this weekend...')),
  ],
};

const isValidId = id => typeof id === 'string' && /^\d{17,20}$/.test(id.trim());
const genTicketId = type => `${type.slice(0,4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageMessages)) return true;
  const roles = member.roles?.cache;
  if (ENV_ROLE_ADMIN  && roles?.has(ENV_ROLE_ADMIN))  return true;
  if (ENV_ROLE_HELPER && roles?.has(ENV_ROLE_HELPER)) return true;
  return false;
}

function buildFields(interaction) {
  const fields = [];
  try { for (const [id, val] of interaction.fields?.fields ?? []) { if (val?.value?.trim()) fields.push({ name: id.charAt(0).toUpperCase()+id.slice(1), value: val.value.trim() }); } } catch {}
  return fields;
}

function buildTicketEmbed({ interaction, type, ticketId, statusKey, fields }) {
  const meta = TYPE_META[type] || TYPE_META.support;
  const status = STATUS[statusKey] || STATUS.open;
  const emb = new EmbedBuilder()
    .setColor(meta.color)
    .setAuthor({ name: `${meta.emoji} ${meta.label} — ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ size: 64 }) })
    .setDescription([`> 🎫 **Ticket ID:** \`${ticketId}\``, `> 📊 **Status:** ${status.label}`, `> 🕐 **Opened:** <t:${Math.floor(Date.now()/1000)}:F>`].join('\n'))
    .setFooter({ text: 'TheConclave Dominion · AEGIS Ticket System v3' }).setTimestamp();
  for (const f of fields) emb.addFields({ name: f.name, value: f.value.slice(0,1024), inline: false });
  return emb;
}

function buildStaffRow(isClosed = false) {
  if (isClosed) return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tkt_action_resolve').setLabel('✅ Resolved').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId('tkt_action_close').setLabel('🔒 Closed').setStyle(ButtonStyle.Secondary).setDisabled(true),
  );
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tkt_action_claim').setLabel('✋ Claim').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tkt_action_progress').setLabel('🔵 In Progress').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tkt_action_escalate').setLabel('🔴 Escalate').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('tkt_action_resolve').setLabel('✅ Resolve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tkt_action_close').setLabel('🔒 Close').setStyle(ButtonStyle.Secondary),
  );
}

async function resolveCategory(guild, type, guildId) {
  const cfg = await getGuildCfg(guildId);
  const explicitId = cfg[`ticket_category_${type}`];
  if (isValidId(explicitId)) {
    try { const cat = await guild.channels.fetch(explicitId); if (cat?.type === ChannelType.GuildCategory) return cat.id; } catch {}
  }
  const logChId = cfg[TYPE_META[type]?.logKey];
  if (!isValidId(logChId)) return null;
  try {
    const logCh = guild.channels.cache.get(logChId) || await guild.channels.fetch(logChId).catch(() => null);
    if (logCh?.parentId) return logCh.parentId;
  } catch {}
  return null;
}

async function updateStatus(interaction, statusKey) {
  const status = STATUS[statusKey] || STATUS.open;
  const oldEmbed = interaction.message?.embeds?.[0];
  if (!oldEmbed) return;
  const newDesc = (oldEmbed.description || '')
    .replace(/> 📊 \*\*Status:\*\*.*/, `> 📊 **Status:** ${status.label}`)
    .replace(/> 👮 \*\*Staff:\*\*.*\n?/, '')
    .replace(/(> 🕐 \*\*Opened:\*\*)/, `> 👮 **Staff:** ${interaction.user}\n$1`);
  await interaction.message.edit({ embeds: [EmbedBuilder.from(oldEmbed).setColor(status.color).setDescription(newDesc)], components: [buildStaffRow(['resolved','closed'].includes(statusKey))] });
}

async function saveTranscript(channel, closedBy, statusKey, client, guildId) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const lines = [...messages.values()].reverse().map(m => {
      const t = new Date(m.createdTimestamp).toLocaleString('en-US',{dateStyle:'short',timeStyle:'short'});
      const c = m.content || (m.embeds[0]?.title ? `[Embed: ${m.embeds[0].title}]` : '[attachment]');
      return `[${t}] ${m.author.username}: ${c}`;
    }).join('\n');
    const text = ['═══════════════════════════════════════════','TICKET TRANSCRIPT — TheConclave AEGIS v3',`Channel: ${channel.name}`,`Closed by: ${closedBy}`,`Status: ${STATUS[statusKey]?.label||statusKey}`,`Date: ${new Date().toLocaleString('en-US',{dateStyle:'full',timeStyle:'short'})}`, '═══════════════════════════════════════════','',lines,'','END OF TRANSCRIPT'].join('\n');
    const trChId = await getTranscriptChannelId(guildId);
    if (!isValidId(trChId)) return;
    const trCh = client.channels.cache.get(trChId);
    if (!trCh) return;
    await trCh.send({
      embeds: [new EmbedBuilder().setColor(statusKey==='resolved'?0x35ED7E:0x555555).setTitle(`📋 Transcript — ${channel.name}`).addFields({name:'🏷️ Status',value:STATUS[statusKey]?.label||statusKey,inline:true},{name:'👤 Closed by',value:closedBy,inline:true},{name:'📅 Date',value:`<t:${Math.floor(Date.now()/1000)}:F>`,inline:false}).setFooter({text:'TheConclave Dominion · AEGIS Ticket System v3'}).setTimestamp()],
      files: [new AttachmentBuilder(Buffer.from(text,'utf8'),{name:`transcript-${channel.name}-${Date.now()}.txt`})],
    });
  } catch (e) { console.warn('[Tickets] Transcript error:', e.message); }
}

async function handleTicketInteraction(interaction, client) {

  if (interaction.isButton() && interaction.customId === 'ticket_open') {
    await interaction.reply({
      flags: 64,
      embeds: [new EmbedBuilder().setColor(0x00D4FF).setTitle('🎫 Open a Ticket').setDescription(['**Choose the category that matches your request:**','','🛡️ **Support** — Server help, questions, disputes','🎁 **Starter Kit** — New player kit request','🪙 **ConCoin** — Economy, purchases, disputes','💎 **ClaveShard Shop** — Premium orders & fulfillment','👁️ **Base Watch** — AEGIS protection requests','','-# Your ticket will be a **private channel** — only you and staff can see it.'].join('\n')).setFooter({text:'TheConclave Dominion · Powered by AEGIS'})],
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

  if (interaction.isButton() && interaction.customId.startsWith('tkt_') && !interaction.customId.startsWith('tkt_action_')) {
    const type = interaction.customId.replace('tkt_', '');
    const meta = TYPE_META[type] || TYPE_META.support;
    const modal = new ModalBuilder().setCustomId(`ticket_modal_${type}`).setTitle(`${meta.emoji} ${meta.label} Ticket`.slice(0,45));
    modal.addComponents(...(FORMS[type] || FORMS.support));
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
    await interaction.deferReply({ flags: 64 });
    const type     = interaction.customId.replace('ticket_modal_', '');
    const meta     = TYPE_META[type] || TYPE_META.support;
    const guildId  = interaction.guildId;
    const ticketId = genTicketId(type);
    const fields   = buildFields(interaction);
    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,20);
    const chName   = `${meta.prefix}-${safeName}`.slice(0,100);

    const existing = interaction.guild.channels.cache.find(c => c.name === chName && c.topic?.includes(interaction.user.id));
    if (existing) return interaction.editReply({ content: `⚠️ You already have an open **${meta.label}** ticket: ${existing}\nUse that channel or ask staff to close it first.` });

    const { adminId, helperId } = await getStaffRoles(guildId);
    const categoryId = await resolveCategory(interaction.guild, type, guildId);

    const perms = [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
    ];
    if (isValidId(adminId))  perms.push({ id: adminId,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] });
    if (isValidId(helperId)) perms.push({ id: helperId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

    let ticketCh;
    try {
      const opts = { name: chName, type: ChannelType.GuildText, topic: `${ticketId} · ${interaction.user.id} · ${meta.label}`, permissionOverwrites: perms };
      if (categoryId) opts.parent = categoryId;
      ticketCh = await interaction.guild.channels.create(opts);
    } catch (e) {
      console.error('[Tickets] Channel create error:', e.message);
      return interaction.editReply(`⚠️ Could not create ticket channel: ${e.message}`);
    }

    const staffPing = [isValidId(adminId)?`<@&${adminId}>`:'' , isValidId(helperId)?`<@&${helperId}>`:'' ].filter(Boolean).join(' ');

    await ticketCh.send({
      content: [`${interaction.user} — welcome to your **${meta.label}** ticket!`,`> 🎫 ID: \`${ticketId}\`  ·  ⏰ Staff respond within **24h**`,`> 💬 Add any extra detail below. Staff will respond here.`,staffPing?`\n${staffPing} — new ticket awaiting response.`:''].filter(Boolean).join('\n'),
      embeds: [buildTicketEmbed({ interaction, type, ticketId, statusKey: 'open', fields })],
      components: [buildStaffRow(false)],
    });

    // Log to guild's configured admin channel
    const logChId = await getLogChannelId(guildId, type);
    if (isValidId(logChId)) {
      const logCh = await client.channels.fetch(logChId).catch(() => null);
      if (logCh) {
        await logCh.send({
          content: staffPing || undefined,
          embeds: [new EmbedBuilder().setColor(meta.color).setAuthor({ name: `New ${meta.label} — ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({size:64}) }).setDescription([`> 🎫 **ID:** \`${ticketId}\``,`> 📂 **Channel:** ${ticketCh}`,`> 👤 **Player:** ${interaction.user}`,fields[0]?`> 📋 **${fields[0].name}:** ${fields[0].value.slice(0,100)}`:null].filter(Boolean).join('\n')).setFooter({text:`Guild: ${interaction.guild.name} · AEGIS Ticket v3`}).setTimestamp()],
        }).catch(e => console.warn(`[Tickets] Log channel post failed (${logChId}):`, e.message));
      }
    } else {
      console.warn(`[Tickets] No log channel for guild ${guildId} type "${type}" — run /setup-tickets`);
    }

    // Fire webhook if configured
    const webhookUrl = await getWebhookUrl(guildId, type);
    if (webhookUrl) {
      fetch(webhookUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'AEGIS Ticket System', embeds:[{ color:meta.color, title:`${meta.emoji} New ${meta.label} Ticket`, description:[`**ID:** \`${ticketId}\``,`**Player:** ${interaction.user.username} (\`${interaction.user.id}\`)`,`**Channel:** ${ticketCh.name}`,...fields.map(f=>`**${f.name}:** ${f.value.slice(0,200)}`)].join('\n'), timestamp:new Date().toISOString(), footer:{text:`Guild: ${interaction.guild.name} · AEGIS v3`} }] }) })
        .catch(e => console.warn('[Tickets] Webhook fire failed:', e.message));
    }

    return interaction.editReply({ content: [`✅ **Ticket opened!**`,`> 🎫 ID: \`${ticketId}\``,`> 📂 Your channel: ${ticketCh}`,`> ⏰ Staff will respond within 24 hours`].join('\n') });
  }

  if (interaction.isButton() && interaction.customId.startsWith('tkt_action_')) {
    const action  = interaction.customId.replace('tkt_action_', '');
    const guildId = interaction.guildId;
    if (!isStaff(interaction.member)) { await interaction.reply({ content: '⛔ Staff only.', flags: 64 }); return true; }

    if (action === 'claim')    { await updateStatus(interaction,'claimed');   await interaction.reply({ content: `✋ **${interaction.user}** claimed this ticket.` }); return true; }
    if (action === 'progress') { await updateStatus(interaction,'progress');  await interaction.reply({ content: `🔵 **${interaction.user}** marked as **In Progress**.` }); return true; }
    if (action === 'escalate') {
      await updateStatus(interaction, 'escalated');
      const { adminId } = await getStaffRoles(guildId);
      await interaction.reply({ content: `🔴 ${isValidId(adminId)?`<@&${adminId}>`:'@Admin'} — **Escalated** by ${interaction.user}. Immediate attention required.` });
      return true;
    }
    if (action === 'resolve') {
      await updateStatus(interaction, 'resolved');
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x35ED7E).setTitle('✅ Ticket Resolved').setDescription(`Resolved by ${interaction.user}.\n\n*Transcript saved. Channel deletes in **10 seconds**.*`).setTimestamp()] });
      await saveTranscript(interaction.channel, interaction.user.username, 'resolved', client, guildId);
      setTimeout(() => interaction.channel.delete().catch(() => {}), 10_000);
      return true;
    }
    if (action === 'close') {
      await updateStatus(interaction, 'closed');
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x555555).setTitle('🔒 Ticket Closed').setDescription(`Closed by ${interaction.user}.\n\n*Transcript saved. Channel deletes in **10 seconds**.*`).setTimestamp()] });
      await saveTranscript(interaction.channel, interaction.user.username, 'closed', client, guildId);
      setTimeout(() => interaction.channel.delete().catch(() => {}), 10_000);
      return true;
    }
    return true;
  }

  return false;
}

module.exports = { handleTicketInteraction };
