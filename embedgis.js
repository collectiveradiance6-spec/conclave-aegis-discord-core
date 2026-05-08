'use strict';

/**
 * AEGIS BROADCAST ENGINE — embedgis.js  DBE v2.1
 * Full interactive setup UI — no channel IDs in JSON required.
 *
 * Wire in bot.js:
 *   const { handleEmbedgisCommand, handleEmbedgisButton,
 *           handleEmbedgisSelect, EMBEDGIS_COMMAND } = require('./embedgis');
 *
 *   // In ALL_COMMANDS:   EMBEDGIS_COMMAND,
 *   // In InteractionCreate (before deferReply):
 *   if (await handleEmbedgisCommand(interaction)) return;
 *   if (await handleEmbedgisButton(interaction))  return;
 *   if (await handleEmbedgisSelect(interaction))  return;
 *
 * FLOW:
 *   /embedgis payload:<json>
 *     → validates JSON
 *     → shows interactive SETUP panel (ephemeral):
 *         [Channel picker]  ← Discord native channel browser
 *         [Theme dropdown]
 *         [Standard] [Cinematic]  ← mode toggles
 *         [No Ping]  [@everyone]  ← ping toggles
 *         [🔍 Preview]  [❌ Cancel]
 *     → Preview renders all embeds in the same message
 *     → [✅ Confirm & Send]  [◀ Back]  [❌ Cancel]
 *     → Dispatch fires to chosen channel
 */

const {
  EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
  ChannelSelectMenuBuilder, StringSelectMenuBuilder,
  SlashCommandBuilder, ChannelType,
} = require('discord.js');

// ── Pending state  Map<key, State> ───────────────────────────────────────
const pending = new Map();
setInterval(() => {
  const cut = Date.now() - 10 * 60_000; // 10 min TTL
  for (const [k, v] of pending) if (v.createdAt < cut) pending.delete(k);
}, 60_000);

function mkKey() { return Math.random().toString(36).slice(2, 10); }

// ══════════════════════════════════════════════════════════════════════════
// SLASH COMMAND
// ══════════════════════════════════════════════════════════════════════════
const EMBEDGIS_COMMAND = new SlashCommandBuilder()
  .setName('embedgis')
  .setDescription('📡 AEGIS Broadcast Engine — interactive cinematic announcements')
  .addStringOption(o => o
    .setName('payload')
    .setDescription('DBE v2.1 JSON payload (channel optional — picker below)')
    .setRequired(true)
  );

// ══════════════════════════════════════════════════════════════════════════
// THEMES
// ══════════════════════════════════════════════════════════════════════════
const THEMES = {
  liquid_glass: { hero:0x7B2FFF, grid:0x5A1FCC, action:0x00D4FF, links:0xA8D8FF, accent:0x00D4FF,
    sep:'⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿', sub:'⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒',
    divider:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━', bullet:'◈', tag:'LIQUID·GLASS' },
  neon:         { hero:0xFF4CD2, grid:0xFFB800, action:0xFF4500, links:0xFFB800, accent:0xFF4CD2,
    sep:'▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓', sub:'░░░░░░░░░░░░░░░░░░░░',
    divider:'══════════════════════════════', bullet:'◆', tag:'NEON·PULSE' },
  void:         { hero:0x1A1A2E, grid:0x16213E, action:0x0F3460, links:0x533483, accent:0x533483,
    sep:'· · · · · · · · · · · · · · ·', sub:'                              ',
    divider:'──────────────────────────────', bullet:'○', tag:'VOID·SIGNAL' },
  tactical:     { hero:0x1B4332, grid:0x2D6A4F, action:0xFF8C00, links:0x35ED7E, accent:0x35ED7E,
    sep:'████████████████████', sub:'▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    divider:'▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬', bullet:'▶', tag:'TACTICAL·OPS' },
};

const THEME_LABELS = {
  liquid_glass: '🧊 Liquid Glass',
  neon:         '⚡ Neon',
  void:         '🌑 Void',
  tactical:     '⚔️ Tactical',
};

// ══════════════════════════════════════════════════════════════════════════
// VALIDATION & SANITIZE
// ══════════════════════════════════════════════════════════════════════════
function validate(data) {
  const errs = [];
  if (!data?.content?.title)        errs.push('`content.title` is required');
  if (!Array.isArray(data?.blocks)) errs.push('`blocks` array is required');
  if ((data?.blocks?.length || 0) > 6) errs.push('`blocks` exceeds max of 6');
  (data?.blocks || []).forEach((b, i) => {
    if (b.type === 'links') (b.items || []).forEach((item, j) => {
      if (item.url) { try { new URL(item.url); } catch { errs.push(`blocks[${i}].items[${j}].url invalid`); } }
    });
  });
  return errs;
}

function san(str, max = 1024) {
  if (!str) return '';
  return String(str).replace(/[\u200B-\u200D\uFEFF]/g,'').normalize('NFC').trim().slice(0, max);
}

// ══════════════════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════════════════
function renderEmbeds(data, theme) {
  const T = THEMES[theme] || THEMES.liquid_glass;
  const { title = '', subtitle = '', body = '' } = data.content || {};
  const embeds = [];

  for (const block of (data.blocks || [])) {
    if (block.type === 'hero') {
      const content = san(block.content || body, 3000);
      embeds.push(new EmbedBuilder()
        .setColor(T.hero)
        .setTitle(`${T.bullet} ${san(title, 256)}`)
        .setDescription([
          `\`${T.sep}\``,
          subtitle ? `> ${T.bullet} *${san(subtitle, 200)}*` : null,
          subtitle ? `\`${T.sub}\`` : null,
          '',
          content,
          '',
          `\`${T.divider}\``,
          `-# ⌁ ${T.tag} · TheConclave Dominion`,
        ].filter(l => l !== null).join('\n').slice(0, 4096))
        .setTimestamp());
    }

    else if (block.type === 'grid' && Array.isArray(block.items)) {
      const grid = new EmbedBuilder().setColor(T.grid)
        .setTitle(`\`${T.sub.slice(0,8)}\`  SYSTEM MODULES  \`${T.sub.slice(0,8)}\``);
      const items = block.items.slice(0, 10);
      for (const item of items)
        grid.addFields({ name: san(item.title || 'MODULE', 256), value: san(item.content || '—', 1024), inline: true });
      if (items.length % 2 !== 0) grid.addFields({ name: '\u200B', value: '\u200B', inline: true });
      embeds.push(grid);
    }

    else if (block.type === 'action') {
      embeds.push(new EmbedBuilder()
        .setColor(T.action)
        .setTitle('⚡ Action Required')
        .setDescription([
          `\`${T.sep}\``,
          `> ${T.bullet} **ACTION REQUIRED**`,
          `\`${T.sub}\``,
          '',
          block.command ? `**Command:** \`${san(block.command, 100)}\`` : null,
          block.label   ? `**Label:** ${san(block.label, 256)}`         : null,
          block.channel ? `**Channel:** <#${san(block.channel, 32)}>`   : null,
          '',
          `\`${T.divider}\``,
        ].filter(l => l !== null).join('\n').slice(0, 4096)));
    }

    else if (block.type === 'links' && Array.isArray(block.items)) {
      const le = new EmbedBuilder().setColor(T.links).setTitle(`${T.bullet} Links & Resources`);
      for (const item of block.items.slice(0, 10))
        le.addFields({ name: san(item.label || 'Link', 256), value: san(item.url || '—', 1024), inline: false });
      embeds.push(le);
    }
  }

  if (!embeds.length) {
    embeds.push(new EmbedBuilder().setColor(T.hero)
      .setTitle(`${T.bullet} ${san(title, 256)}`)
      .setDescription(san(body || subtitle || '—', 4096))
      .setTimestamp());
  }
  return embeds;
}

// ══════════════════════════════════════════════════════════════════════════
// UI BUILDERS
// ══════════════════════════════════════════════════════════════════════════
function buildSetupHeader(state) {
  const T     = THEMES[state.theme] || THEMES.liquid_glass;
  const chTxt = state.channelId ? `<#${state.channelId}>` : '*(not selected)*';
  return new EmbedBuilder()
    .setColor(T.accent)
    .setAuthor({ name: '📡 AEGIS Broadcast Engine v2.1 — Setup' })
    .setDescription([
      `\`${T.sep}\``,
      `> ${T.bullet} **Configure your broadcast below**`,
      `\`${T.sub}\``,
      '',
      `📡 **Channel:** ${chTxt}`,
      `🎨 **Theme:**   \`${state.theme}\` — ${T.tag}`,
      `🎬 **Mode:**    \`${state.mode}\``,
      `🔔 **Ping:**    \`${state.ping}\``,
      '',
      `\`${T.divider}\``,
      `-# Pick a channel then hit Preview · Expires in 10 min`,
    ].join('\n'))
    .setFooter({ text: 'Only you can see this · TheConclave Dominion' })
    .setTimestamp();
}

function buildSetupComponents(key, state) {
  // Row 1 — Channel picker (Discord native browser)
  const chSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`embedgis_ch:${key}`)
    .setPlaceholder('📡 Select target channel or forum...')
    .setChannelTypes(
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum,
      ChannelType.GuildVoice,
    )
    .setMinValues(1)
    .setMaxValues(1);

  // Row 2 — Theme dropdown
  const themeSelect = new StringSelectMenuBuilder()
    .setCustomId(`embedgis_theme:${key}`)
    .setPlaceholder(`🎨 Theme: ${THEME_LABELS[state.theme]}`)
    .addOptions(
      { label: '🧊 Liquid Glass', value: 'liquid_glass', description: 'Neon cyan/purple — cinematic glass feel', default: state.theme === 'liquid_glass' },
      { label: '⚡ Neon',         value: 'neon',         description: 'Hot pink/gold — high energy', default: state.theme === 'neon' },
      { label: '🌑 Void',         value: 'void',         description: 'Dark minimal — deep space', default: state.theme === 'void' },
      { label: '⚔️ Tactical',     value: 'tactical',     description: 'Military green — ops style', default: state.theme === 'tactical' },
    );

  // Row 3 — Mode buttons
  const modeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`embedgis_mode:${key}:standard`)
      .setLabel('📤 Standard')
      .setStyle(state.mode === 'standard' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`embedgis_mode:${key}:cinematic`)
      .setLabel('🎬 Cinematic')
      .setStyle(state.mode === 'cinematic' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`embedgis_ping:${key}:none`)
      .setLabel('🔕 No Ping')
      .setStyle(state.ping === 'none' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`embedgis_ping:${key}:everyone`)
      .setLabel('🔔 @everyone')
      .setStyle(state.ping === 'everyone' ? ButtonStyle.Danger : ButtonStyle.Secondary),
  );

  // Row 4 — Action buttons
  const previewDisabled = !state.channelId;
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`embedgis_preview:${key}`)
      .setLabel('🔍 Preview Broadcast')
      .setStyle(ButtonStyle.Success)
      .setDisabled(previewDisabled),
    new ButtonBuilder().setCustomId(`embedgis_cancel:${key}`)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  return [
    new ActionRowBuilder().addComponents(chSelect),
    new ActionRowBuilder().addComponents(themeSelect),
    modeRow,
    actionRow,
  ];
}

function buildPreviewComponents(key) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`embedgis_confirm:${key}`)
      .setLabel('✅ Confirm & Send')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`embedgis_back:${key}`)
      .setLabel('◀ Back to Setup')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`embedgis_cancel:${key}`)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Danger),
  )];
}

function buildPreviewHeader(state, embedCount) {
  const T = THEMES[state.theme] || THEMES.liquid_glass;
  return new EmbedBuilder()
    .setColor(T.accent)
    .setAuthor({ name: '📡 AEGIS Broadcast Engine — Preview' })
    .setDescription([
      `\`${T.sep}\``,
      `> ${T.bullet} **PREVIEW — exactly what will be sent**`,
      `\`${T.sub}\``,
      '',
      `📡 **Channel:** <#${state.channelId}>`,
      `🎬 **Mode:** ${state.mode === 'cinematic' ? `Cinematic (${embedCount} embeds, ~1.8s delay each)` : `Standard (${embedCount} embed${embedCount !== 1 ? 's' : ''} at once)`}`,
      `🎨 **Theme:** \`${state.theme}\` — ${T.tag}`,
      `🔔 **Ping:** \`${state.ping}\``,
      '',
      `\`${T.divider}\``,
      `> Confirm to broadcast · Back to adjust settings`,
    ].join('\n'))
    .setFooter({ text: 'Only you can see this · TheConclave Dominion' })
    .setTimestamp();
}

// ══════════════════════════════════════════════════════════════════════════
// DISPATCH
// ══════════════════════════════════════════════════════════════════════════
async function dispatch(channel, embeds, ping, mode) {
  if (ping === 'everyone') await channel.send('@everyone');
  if (mode === 'cinematic') {
    for (let i = 0; i < embeds.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 1800));
      await channel.send({ embeds: [embeds[i]] });
    }
  } else {
    for (let i = 0; i < embeds.length; i += 10)
      await channel.send({ embeds: embeds.slice(i, i + 10) });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// COMMAND HANDLER
// ══════════════════════════════════════════════════════════════════════════
async function handleEmbedgisCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'embedgis') return false;

  if (!interaction.member?.permissions?.has('ManageMessages')) {
    await interaction.reply({ content: '⛔ Staff only — requires Manage Messages.', ephemeral: true });
    return true;
  }

  let data;
  try { data = JSON.parse(interaction.options.getString('payload')); }
  catch (e) {
    await interaction.reply({ embeds:[errEmbed(`JSON parse error: \`${e.message.slice(0,200)}\``)], ephemeral:true });
    return true;
  }

  const errs = validate(data);
  if (errs.length) {
    await interaction.reply({ embeds:[errEmbed(`**Validation failed:**\n${errs.map(e=>`• ${e}`).join('\n')}`)], ephemeral:true });
    return true;
  }

  const key = mkKey();
  const state = {
    data,
    channelId:  data.meta?.channel || null,
    theme:      data.meta?.theme   || 'liquid_glass',
    mode:       data.meta?.mode    || 'standard',
    ping:       data.meta?.ping    || 'none',
    userId:     interaction.user.id,
    guildId:    interaction.guildId,
    createdAt:  Date.now(),
    phase:      'setup', // 'setup' | 'preview'
  };
  pending.set(key, state);

  await interaction.reply({
    embeds:     [buildSetupHeader(state)],
    components: buildSetupComponents(key, state),
    ephemeral:  true,
  });
  return true;
}

// ══════════════════════════════════════════════════════════════════════════
// SELECT MENU HANDLER
// ══════════════════════════════════════════════════════════════════════════
async function handleEmbedgisSelect(interaction) {
  if (!interaction.isChannelSelectMenu() && !interaction.isStringSelectMenu()) return false;
  if (!interaction.customId.startsWith('embedgis_')) return false;

  const [action, key] = interaction.customId.split(':');
  const state = pending.get(key);
  if (!state) { await interaction.reply({ content:'⌛ Setup expired. Run `/embedgis` again.', ephemeral:true }); return true; }
  if (state.userId !== interaction.user.id) { await interaction.reply({ content:'⛔ Not your broadcast.', ephemeral:true }); return true; }

  if (action === 'embedgis_ch') {
    state.channelId = interaction.values[0];
  } else if (action === 'embedgis_theme') {
    state.theme = interaction.values[0];
  }

  await interaction.update({
    embeds:     [buildSetupHeader(state)],
    components: buildSetupComponents(key, state),
  });
  return true;
}

// ══════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER
// ══════════════════════════════════════════════════════════════════════════
async function handleEmbedgisButton(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith('embedgis_')) return false;

  const parts  = interaction.customId.split(':');
  const action = parts[0];
  const key    = parts[1];
  const value  = parts[2]; // for mode/ping

  const state = pending.get(key);

  // Cancel — works even if state is gone
  if (action === 'embedgis_cancel') {
    pending.delete(key);
    await interaction.update({
      embeds:     [new EmbedBuilder().setColor(0x888888).setTitle('❌ Broadcast Cancelled').setDescription('No message was sent.')],
      components: [],
    });
    return true;
  }

  if (!state) {
    await interaction.reply({ content:'⌛ Setup expired. Run `/embedgis` again.', ephemeral:true });
    return true;
  }
  if (state.userId !== interaction.user.id) {
    await interaction.reply({ content:'⛔ Not your broadcast.', ephemeral:true });
    return true;
  }

  // Mode toggle
  if (action === 'embedgis_mode') {
    state.mode = value;
    await interaction.update({ embeds:[buildSetupHeader(state)], components:buildSetupComponents(key, state) });
    return true;
  }

  // Ping toggle
  if (action === 'embedgis_ping') {
    state.ping = value;
    await interaction.update({ embeds:[buildSetupHeader(state)], components:buildSetupComponents(key, state) });
    return true;
  }

  // Preview
  if (action === 'embedgis_preview') {
    if (!state.channelId) {
      await interaction.reply({ content:'⚠️ Pick a channel first.', ephemeral:true });
      return true;
    }
    const embeds = renderEmbeds(state.data, state.theme);
    state.renderedEmbeds = embeds;
    state.phase = 'preview';
    await interaction.update({
      embeds:     [buildPreviewHeader(state, embeds.length), ...embeds],
      components: buildPreviewComponents(key),
    });
    return true;
  }

  // Back to setup
  if (action === 'embedgis_back') {
    state.phase = 'setup';
    state.renderedEmbeds = null;
    await interaction.update({
      embeds:     [buildSetupHeader(state)],
      components: buildSetupComponents(key, state),
    });
    return true;
  }

  // Confirm & Send
  if (action === 'embedgis_confirm') {
    const channel = interaction.guild.channels.cache.get(state.channelId);
    if (!channel) {
      await interaction.update({ embeds:[errEmbed('Channel not found. Go back and re-select.')], components:buildPreviewComponents(key) });
      return true;
    }

    pending.delete(key);
    await interaction.deferUpdate();

    const embeds = state.renderedEmbeds || renderEmbeds(state.data, state.theme);
    let success = false, fallback = false;

    try {
      await dispatch(channel, embeds, state.ping, state.mode);
      success = true;
    } catch (e) {
      console.error('[EMBEDGIS] dispatch error:', e.message);
      try {
        const collapsed = new EmbedBuilder().setColor(0x7B2FFF).setTitle('📡 Broadcast')
          .setDescription(embeds.map(em => [em.data.title, em.data.description].filter(Boolean).join('\n')).join('\n\n').slice(0,3800));
        await channel.send({ embeds:[collapsed] });
        success = true; fallback = true;
      } catch { /* silent */ }
    }

    const T = THEMES[state.theme] || THEMES.liquid_glass;
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(success ? 0x35ED7E : 0xFF4500)
        .setTitle(success ? '✅ Broadcast Sent!' : '❌ Broadcast Failed')
        .setDescription([
          `**Channel:** <#${state.channelId}>`,
          `**Mode:** ${state.mode}   **Theme:** ${state.theme}   **Ping:** ${state.ping}`,
          `**Embeds sent:** ${embeds.length}`,
          fallback ? '\n⚠️ *Fallback mode used — formatting simplified.*' : '',
        ].join('\n'))
        .setTimestamp()],
      components: [],
    });
    return true;
  }

  return false;
}

// ══════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════
function errEmbed(msg) {
  return new EmbedBuilder().setColor(0xFF4500)
    .setTitle('⚠️ AEGIS Broadcast Engine — Error')
    .setDescription(msg.slice(0,4096))
    .setFooter({ text:'DBE v2.1 · Fix payload and try again' });
}

module.exports = {
  handleEmbedgisCommand,
  handleEmbedgisButton,
  handleEmbedgisSelect,
  EMBEDGIS_COMMAND,
  THEMES,
  renderEmbeds,
};
