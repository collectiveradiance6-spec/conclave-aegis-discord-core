'use strict';

/**
 * AEGIS BROADCAST ENGINE — embedgis.js  DBE v2.1
 *
 * Wire in bot.js:
 *   const { handleEmbedgisCommand, handleEmbedgisButton, EMBEDGIS_COMMAND } = require('./embedgis');
 *
 *   // In ALL_COMMANDS array:
 *   EMBEDGIS_COMMAND,
 *
 *   // In InteractionCreate handler (before deferReply):
 *   if (await handleEmbedgisCommand(interaction)) return;
 *   if (await handleEmbedgisButton(interaction)) return;
 *
 * FLOW:
 *   /embedgis payload:<json> [theme:...] [mode:...]
 *     → validates schema
 *     → renders all embeds
 *     → sends EPHEMERAL preview to caller
 *     → caller clicks [Confirm & Send] or [Cancel]
 *     → on confirm: dispatches to target channel (standard or cinematic)
 */

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, ChannelType,
} = require('discord.js');

// ── Pending preview store  Map<key, PendingBroadcast> ─────────────────────
// key = random hex, TTL = 5 minutes
const pendingBroadcasts = new Map();
setInterval(() => {
  const cut = Date.now() - 5 * 60_000;
  for (const [k, v] of pendingBroadcasts) if (v.createdAt < cut) pendingBroadcasts.delete(k);
}, 60_000);

// ══════════════════════════════════════════════════════════════════════════
// SLASH COMMAND DEFINITION  (add to ALL_COMMANDS in bot.js)
// ══════════════════════════════════════════════════════════════════════════
const EMBEDGIS_COMMAND = new SlashCommandBuilder()
  .setName('embedgis')
  .setDescription('📡 AEGIS Broadcast Engine v2.1 — JSON-driven cinematic announcements')
  .addStringOption(o => o
    .setName('payload')
    .setDescription('DBE v2.1 JSON payload')
    .setRequired(true)
  )
  .addStringOption(o => o
    .setName('theme')
    .setDescription('Visual theme (default: liquid_glass)')
    .setRequired(false)
    .addChoices(
      { name: '🧊 Liquid Glass (default)', value: 'liquid_glass' },
      { name: '⚡ Neon',                   value: 'neon'         },
      { name: '🌑 Void',                   value: 'void'         },
      { name: '⚔️ Tactical',               value: 'tactical'     },
    )
  )
  .addStringOption(o => o
    .setName('mode')
    .setDescription('Dispatch mode (default: from payload or standard)')
    .setRequired(false)
    .addChoices(
      { name: '📤 Standard  — all at once',        value: 'standard'  },
      { name: '🎬 Cinematic — staged with delays', value: 'cinematic' },
    )
  );

// ══════════════════════════════════════════════════════════════════════════
// THEME REGISTRY
// ══════════════════════════════════════════════════════════════════════════
const THEMES = {
  liquid_glass: {
    accent:   0x00D4FF,        // cyan
    hero:     0x7B2FFF,        // plasma purple
    grid:     0x5A1FCC,
    action:   0x00D4FF,
    links:    0xA8D8FF,
    sep:      '⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿',
    sub:      '⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒',
    divider:  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    bullet:   '◈',
    tag:      'LIQUID·GLASS',
  },
  neon: {
    accent:   0xFF4CD2,
    hero:     0xFF4CD2,
    grid:     0xFFB800,
    action:   0xFF4500,
    links:    0xFFB800,
    sep:      '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    sub:      '░░░░░░░░░░░░░░░░░░░░',
    divider:  '══════════════════════════════',
    bullet:   '◆',
    tag:      'NEON·PULSE',
  },
  void: {
    accent:   0x02010D,
    hero:     0x1A1A2E,
    grid:     0x16213E,
    action:   0x0F3460,
    links:    0x533483,
    sep:      '· · · · · · · · · · · · · · ·',
    sub:      '                              ',
    divider:  '──────────────────────────────',
    bullet:   '○',
    tag:      'VOID·SIGNAL',
  },
  tactical: {
    accent:   0x35ED7E,
    hero:     0x1B4332,
    grid:     0x2D6A4F,
    action:   0xFF8C00,
    links:    0x35ED7E,
    sep:      '████████████████████',
    sub:      '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    divider:  '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    bullet:   '▶',
    tag:      'TACTICAL·OPS',
  },
};

// ══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ══════════════════════════════════════════════════════════════════════════
function validatePayload(data) {
  const errors = [];

  if (!data?.content?.title)             errors.push('`content.title` is required');
  if (!Array.isArray(data?.blocks))      errors.push('`blocks` array is required');
  if (data?.blocks?.length > 6)          errors.push('`blocks` exceeds maximum of 6');

  // Validate URLs in links blocks
  if (Array.isArray(data?.blocks)) {
    data.blocks.forEach((b, i) => {
      if (b.type === 'links' && Array.isArray(b.items)) {
        b.items.forEach((item, j) => {
          if (item.url) {
            try { new URL(item.url); }
            catch { errors.push(`blocks[${i}].items[${j}].url is not a valid URL`); }
          }
        });
      }
    });
  }

  return errors;
}

// ══════════════════════════════════════════════════════════════════════════
// SANITIZER
// ══════════════════════════════════════════════════════════════════════════
function sanitize(str, max = 256) {
  if (!str) return '';
  return String(str)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')   // zero-width chars
    .replace(/[\u2018\u2019]/g, "'")           // smart quotes
    .replace(/[\u201C\u201D]/g, '"')
    .normalize('NFC')
    .trim()
    .slice(0, max);
}

// ══════════════════════════════════════════════════════════════════════════
// RENDER ENGINE
// ══════════════════════════════════════════════════════════════════════════
function renderEmbeds(data, theme) {
  const T    = THEMES[theme] || THEMES.liquid_glass;
  const meta = data.meta    || {};
  const cont = data.content || {};
  const embeds = [];

  const title    = sanitize(cont.title,    256);
  const subtitle = sanitize(cont.subtitle, 256);
  const body     = sanitize(cont.body,    2048);

  for (const block of (data.blocks || [])) {

    // ── HERO ───────────────────────────────────────────────────────────
    if (block.type === 'hero') {
      const heroContent = sanitize(block.content || body, 2000);
      const desc = [
        `\`${T.sep}\``,
        subtitle ? `> ${T.bullet} *${subtitle}*` : null,
        subtitle ? `\`${T.sub}\`` : null,
        '',
        heroContent,
        '',
        `\`${T.divider}\``,
        `-# ⌁ ${T.tag} · TheConclave Dominion`,
      ].filter(l => l !== null).join('\n');

      embeds.push(
        new EmbedBuilder()
          .setColor(T.hero)
          .setTitle(`${T.bullet} ${title}`)
          .setDescription(desc.slice(0, 4096))
          .setTimestamp()
      );
    }

    // ── GRID ───────────────────────────────────────────────────────────
    else if (block.type === 'grid' && Array.isArray(block.items)) {
      const gridEmbed = new EmbedBuilder()
        .setColor(T.grid)
        .setTitle(`\`${T.sub.slice(0,10)}\`  SYSTEM MODULES  \`${T.sub.slice(0,10)}\``);

      const items = block.items.slice(0, 10);
      for (const item of items) {
        gridEmbed.addFields({
          name:   sanitize(item.title || 'MODULE', 256),
          value:  sanitize(item.content || '—', 1024),
          inline: true,
        });
      }

      // Pad to even field count for visual alignment
      if (items.length % 2 !== 0) {
        gridEmbed.addFields({ name: '\u200B', value: '\u200B', inline: true });
      }

      embeds.push(gridEmbed);
    }

    // ── ACTION ─────────────────────────────────────────────────────────
    else if (block.type === 'action') {
      const desc = [
        `\`${T.sep}\``,
        `> ${T.bullet} **ACTION REQUIRED**`,
        `\`${T.sub}\``,
        '',
        block.command ? `**Command:** \`${sanitize(block.command, 100)}\`` : null,
        block.label   ? `**Label:** ${sanitize(block.label, 256)}`         : null,
        block.channel ? `**Channel:** <#${sanitize(block.channel, 32)}>`   : null,
        '',
        `\`${T.divider}\``,
      ].filter(l => l !== null).join('\n');

      embeds.push(
        new EmbedBuilder()
          .setColor(T.action)
          .setTitle('⚡ Action Required')
          .setDescription(desc.slice(0, 4096))
      );
    }

    // ── LINKS ──────────────────────────────────────────────────────────
    else if (block.type === 'links' && Array.isArray(block.items)) {
      const linksEmbed = new EmbedBuilder()
        .setColor(T.links)
        .setTitle(`${T.bullet} Links & Resources`);

      for (const item of block.items.slice(0, 10)) {
        linksEmbed.addFields({
          name:   sanitize(item.label || 'Link', 256),
          value:  sanitize(item.url   || '—',   1024),
          inline: false,
        });
      }

      embeds.push(linksEmbed);
    }
  }

  // Fallback: no blocks produced an embed
  if (!embeds.length) {
    embeds.push(
      new EmbedBuilder()
        .setColor(T.hero)
        .setTitle(`${T.bullet} ${title}`)
        .setDescription(body || subtitle || '—')
        .setTimestamp()
    );
  }

  return embeds;
}

// ══════════════════════════════════════════════════════════════════════════
// PREVIEW EMBED  (header card shown ephemerally to the caller)
// ══════════════════════════════════════════════════════════════════════════
function buildPreviewHeader(data, theme, targetChannelId, mode, embedCount) {
  const T     = THEMES[theme] || THEMES.liquid_glass;
  const meta  = data.meta    || {};
  const modeLabel = mode === 'cinematic'
    ? `🎬 Cinematic (${embedCount} staged sends)`
    : `📤 Standard (${embedCount} embed${embedCount !== 1 ? 's' : ''} at once)`;

  const desc = [
    `\`${T.sep}\``,
    `> ${T.bullet} **BROADCAST PREVIEW** — *review before sending*`,
    `\`${T.sub}\``,
    '',
    `**📡 Channel:** ${targetChannelId ? `<#${targetChannelId}>` : '*current channel*'}`,
    `**🎬 Mode:** ${modeLabel}`,
    `**🎨 Theme:** \`${theme}\` — ${T.tag}`,
    `**🔔 Ping:** \`${meta.ping || 'none'}\``,
    '',
    `\`${T.divider}\``,
    `> *The embeds below are exactly what will be sent.*`,
    `> *Confirm to broadcast or Cancel to abort.*`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(T.accent)
    .setAuthor({ name: '📡 AEGIS Broadcast Engine v2.1 — Preview Mode' })
    .setDescription(desc)
    .setFooter({ text: 'Only you can see this preview · TheConclave Dominion' })
    .setTimestamp();
}

function buildPreviewButtons(key) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`embedgis_confirm:${key}`)
      .setLabel('✅ Confirm & Send')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`embedgis_cancel:${key}`)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Danger),
  );
}

// ══════════════════════════════════════════════════════════════════════════
// DISPATCH  (standard or cinematic)
// ══════════════════════════════════════════════════════════════════════════
async function dispatch(channel, embeds, ping, mode) {
  if (ping === 'everyone') {
    await channel.send('@everyone');
  }

  if (mode === 'cinematic') {
    const delays = [0, 1800, 1400, 1600, 1500, 1300];
    for (let i = 0; i < embeds.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, delays[i] || 1500));
      await channel.send({ embeds: [embeds[i]] });
    }
  } else {
    // Split into chunks of 10 (Discord embed limit per message)
    for (let i = 0; i < embeds.length; i += 10) {
      await channel.send({ embeds: embeds.slice(i, i + 10) });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// COMMAND HANDLER
// ══════════════════════════════════════════════════════════════════════════
async function handleEmbedgisCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'embedgis') return false;

  // Permission check
  if (!interaction.member?.permissions?.has('ManageMessages')) {
    await interaction.reply({ content: '⛔ Staff only — requires Manage Messages.', ephemeral: true });
    return true;
  }

  const rawPayload = interaction.options.getString('payload');
  const theme      = interaction.options.getString('theme') || 'liquid_glass';
  const modeOpt    = interaction.options.getString('mode')  || null;

  // Parse JSON
  let data;
  try {
    data = JSON.parse(rawPayload);
  } catch (e) {
    await interaction.reply({
      embeds: [errorEmbed(`JSON parse error: \`${e.message.slice(0, 200)}\``)],
      ephemeral: true,
    });
    return true;
  }

  // Validate schema
  const errors = validatePayload(data);
  if (errors.length) {
    await interaction.reply({
      embeds: [errorEmbed(`**Schema validation failed:**\n${errors.map(e => `• ${e}`).join('\n')}`)],
      ephemeral: true,
    });
    return true;
  }

  const meta         = data.meta || {};
  const mode         = modeOpt || meta.mode || 'standard';
  const targetChId   = meta.channel || null;

  // Resolve target channel
  let targetChannel = null;
  if (targetChId) {
    targetChannel = interaction.guild.channels.cache.get(targetChId);
    if (!targetChannel) {
      await interaction.reply({
        embeds: [errorEmbed(`Channel \`${targetChId}\` not found. Check \`meta.channel\` in your payload.`)],
        ephemeral: true,
      });
      return true;
    }
  } else {
    targetChannel = interaction.channel;
  }

  // Render embeds
  const embeds = renderEmbeds(data, theme);

  // Store pending broadcast
  const key = Math.random().toString(36).slice(2, 10);
  pendingBroadcasts.set(key, {
    embeds,
    ping:      meta.ping || 'none',
    mode,
    channelId: targetChannel.id,
    userId:    interaction.user.id,
    guildId:   interaction.guildId,
    createdAt: Date.now(),
  });

  // Send ephemeral preview
  const previewHeader = buildPreviewHeader(data, theme, targetChannel.id, mode, embeds.length);
  await interaction.reply({
    embeds:     [previewHeader, ...embeds],
    components: [buildPreviewButtons(key)],
    ephemeral:  true,
  });

  return true;
}

// ══════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER
// ══════════════════════════════════════════════════════════════════════════
async function handleEmbedgisButton(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith('embedgis_')) return false;

  const [action, key] = interaction.customId.split(':');
  const pending = pendingBroadcasts.get(key);

  // Confirm
  if (action === 'embedgis_confirm') {
    if (!pending) {
      await interaction.reply({
        content: '⌛ This broadcast preview has expired (5 min limit). Run `/embedgis` again.',
        ephemeral: true,
      });
      return true;
    }

    // Only the original caller can confirm
    if (pending.userId !== interaction.user.id) {
      await interaction.reply({ content: '⛔ Only the person who created this preview can send it.', ephemeral: true });
      return true;
    }

    pendingBroadcasts.delete(key);

    const channel = interaction.guild.channels.cache.get(pending.channelId);
    if (!channel) {
      await interaction.reply({ content: '⚠️ Target channel no longer exists.', ephemeral: true });
      return true;
    }

    await interaction.deferUpdate();

    // Dispatch with failure recovery
    let success    = false;
    let fallbackUsed = false;

    try {
      await dispatch(channel, pending.embeds, pending.ping, pending.mode);
      success = true;
    } catch (e) {
      console.error('[EMBEDGIS] dispatch error:', e.message);

      // Recovery step 1: reduce to single embed
      try {
        const collapsed = new EmbedBuilder()
          .setColor(0x7B2FFF)
          .setTitle('📡 Broadcast')
          .setDescription(
            pending.embeds.map(em => [
              em.data.title,
              em.data.description,
              (em.data.fields || []).map(f => `**${f.name}:** ${f.value}`).join('\n'),
            ].filter(Boolean).join('\n')).join('\n\n').slice(0, 4000)
          );
        await channel.send({ embeds: [collapsed] });
        success = true;
        fallbackUsed = true;
      } catch (e2) {
        // Recovery step 2: plain text
        try {
          await channel.send('📡 **Broadcast** — embed rendering failed. Check bot permissions.');
          success = true;
          fallbackUsed = true;
        } catch {}
      }
    }

    // Confirm to caller via edit
    const T = THEMES['liquid_glass'];
    const resultEmbed = new EmbedBuilder()
      .setColor(success ? 0x35ED7E : 0xFF4500)
      .setTitle(success ? '✅ Broadcast Sent' : '❌ Broadcast Failed')
      .setDescription([
        `**Channel:** <#${pending.channelId}>`,
        `**Mode:** ${pending.mode}`,
        `**Embeds:** ${pending.embeds.length}`,
        fallbackUsed ? '\n⚠️ *Fallback mode used — some formatting may be simplified.*' : '',
      ].join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed], components: [] });
    return true;
  }

  // Cancel
  if (action === 'embedgis_cancel') {
    pendingBroadcasts.delete(key);
    await interaction.update({
      embeds:     [new EmbedBuilder().setColor(0x888888).setTitle('❌ Broadcast Cancelled').setDescription('The preview was discarded. No message was sent.')],
      components: [],
    });
    return true;
  }

  return false;
}

// ══════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════
function errorEmbed(msg) {
  return new EmbedBuilder()
    .setColor(0xFF4500)
    .setTitle('⚠️ AEGIS Broadcast Engine — Error')
    .setDescription(msg.slice(0, 4096))
    .setFooter({ text: 'DBE v2.1 · Fix payload and try again' });
}

// ══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════
module.exports = {
  handleEmbedgisCommand,
  handleEmbedgisButton,
  EMBEDGIS_COMMAND,
  THEMES,       // exported so other modules can read theme palette
  renderEmbeds, // exported so auto-broadcast engine can call directly later
};
