// ═══════════════════════════════════════════════════════════════════════
// commands/setup/setupAegis.js — AEGIS v14 GLOBAL EDITION
// Game/topic-aware onboarding wizard. Works for ANY guild/game/topic.
// Steps: Game → Channels → Roles → Economy → Features → Finish
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const {
  SlashCommandBuilder, PermissionFlagsBits,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const guildManager = require('../../managers/guildManager');

// ── Popular game presets — auto-fills sensible defaults ───────────────
const GAME_PRESETS = {
  ark_survival_ascended: {
    game_name:  'ARK: Survival Ascended',
    game_topic: 'ARK: Survival Ascended — survival, taming, breeding, bosses, tribes, crossplay',
    server_rates: '5× XP · 5× Harvest · 5× Taming · 5× Breeding · 1M Weight · No Fall Damage · Max Wild 350',
    community_description: 'A 5× crossplay ARK: Survival Ascended community across multiple maps.',
  },
  ark_survival_evolved: {
    game_name:  'ARK: Survival Evolved',
    game_topic: 'ARK: Survival Evolved — survival, taming, breeding, bosses, tribes',
    server_rates: 'Custom rates — configure in /setup-aegis',
    community_description: 'An ARK: Survival Evolved community.',
  },
  minecraft: {
    game_name:  'Minecraft',
    game_topic: 'Minecraft — survival, building, crafting, redstone, mods, servers',
    server_rates: 'Vanilla / Modded — configure in /setup-aegis',
    community_description: 'A Minecraft community server.',
  },
  rust: {
    game_name:  'Rust',
    game_topic: 'Rust — survival, base building, raiding, PvP, crafting, server wipes',
    server_rates: 'Custom rates — configure in /setup-aegis',
    community_description: 'A Rust survival and PvP community.',
  },
  valheim: {
    game_name:  'Valheim',
    game_topic: 'Valheim — Norse survival, building, bosses, progression, biomes',
    server_rates: 'Vanilla / Modded — configure in /setup-aegis',
    community_description: 'A Valheim community server.',
  },
  palworld: {
    game_name:  'Palworld',
    game_topic: 'Palworld — Pal catching, breeding, base building, crafting, bosses',
    server_rates: 'Custom rates — configure in /setup-aegis',
    community_description: 'A Palworld community server.',
  },
  conan_exiles: {
    game_name:  'Conan Exiles',
    game_topic: 'Conan Exiles — survival, building, thralls, dungeons, PvP',
    server_rates: 'Custom rates — configure in /setup-aegis',
    community_description: 'A Conan Exiles community server.',
  },
  7dtd: {
    game_name:  '7 Days to Die',
    game_topic: '7 Days to Die — zombie survival, base building, crafting, horde nights',
    server_rates: 'Custom rates — configure in /setup-aegis',
    community_description: 'A 7 Days to Die community.',
  },
  general: {
    game_name:  'General Community',
    game_topic: 'General gaming and community discussion',
    server_rates: '',
    community_description: 'A general gaming community.',
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-aegis')
    .setDescription('⚙️ Configure AEGIS for this server — game, channels, roles, features')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ── Main entry ─────────────────────────────────────────────────────
  async execute(interaction) {
    const guildId = interaction.guildId;
    const config  = await guildManager.getConfig(guildId) || {};

    const hasGame    = !!(config.game_name);
    const hasCh      = !!(config.aegis_channel_id);
    const hasRoles   = !!(config.admin_role_id);
    const hasEcon    = !!(config.currency_name && config.currency_name !== 'ClaveShard');
    const isDone     = !!(config.setup_complete);

    const embed = new EmbedBuilder()
      .setColor(0x7B2FFF)
      .setTitle('⚙️ AEGIS Setup Wizard')
      .setDescription(
        isDone
          ? `✅ **AEGIS is configured** for **${config.display_name || interaction.guild.name}**.\n\nUse the buttons below to update any section.`
          : `**Welcome to AEGIS!** Let's configure your server.\n\n*Start with your game — AEGIS adapts its knowledge, tone, and AI responses to match your community's focus.*`
      )
      .addFields(
        { name: '🎮 Game / Topic',   value: hasGame  ? `✅ ${config.game_name}` : '⚪ Not set — **start here**', inline: true },
        { name: '📡 Core Channels',  value: hasCh    ? '✅ Configured'          : '⚪ Not set',                  inline: true },
        { name: '👥 Roles',          value: hasRoles ? '✅ Configured'          : '⚪ Not set',                  inline: true },
        { name: '💎 Economy',        value: hasEcon  ? `✅ ${config.currency_emoji} ${config.currency_name}` : '⚪ Default (ClaveShard)', inline: true },
        { name: '⚙️ Features',       value: isDone   ? '✅ Done'                : '⚪ Pending',                  inline: true },
        { name: '🤖 AI Persona',     value: config.ai_persona ? `✅ ${config.ai_persona}` : '⚪ Default (sovereign)', inline: true },
      )
      .setFooter({ text: `Guild: ${interaction.guild.name} · ${guildId}` })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('aegis_setup_game').setLabel('🎮 Game / Topic').setStyle(hasGame ? ButtonStyle.Secondary : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('aegis_setup_community').setLabel('🏠 Community Info').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('aegis_setup_channels').setLabel('📡 Channels').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('aegis_setup_roles').setLabel('👥 Roles').setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('aegis_setup_economy').setLabel('💎 Economy').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('aegis_setup_features').setLabel('⚙️ Features').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('aegis_setup_ai').setLabel('🤖 AI Persona').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('aegis_setup_ticketlogs').setLabel('📋 Ticket Logs').setStyle(ButtonStyle.Secondary),
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('aegis_setup_complete').setLabel('✅ Finish Setup').setStyle(ButtonStyle.Success),
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });
  },

  // ── Button handler ──────────────────────────────────────────────────
  async handleButton(interaction) {
    const { customId, guildId } = interaction;

    switch (customId) {
      case 'aegis_setup_game':        return showGamePresetMenu(interaction);
      case 'aegis_setup_community':   return showCommunityModal(interaction);
      case 'aegis_setup_channels':    return showChannelsModal(interaction);
      case 'aegis_setup_roles':       return showRolesModal(interaction);
      case 'aegis_setup_economy':     return showEconomyModal(interaction);
      case 'aegis_setup_features':    return showFeaturesMenu(interaction);
      case 'aegis_setup_ai':          return showAiModal(interaction);
      case 'aegis_setup_ticketlogs':  return showTicketLogsModal(interaction);
      case 'aegis_setup_complete':    return finishSetup(interaction);
    }

    // Game preset selection
    if (customId.startsWith('aegis_game_preset:')) {
      const presetKey = customId.split(':')[1];
      return applyGamePreset(interaction, presetKey);
    }

    // Feature toggles
    if (customId.startsWith('aegis_toggle_')) {
      const feature = customId.replace('aegis_toggle_', '');
      const config  = await guildManager.getConfig(guildId);
      const key     = `${feature}_enabled`;
      const newVal  = !config[key];
      await guildManager.updateField(guildId, key, newVal);
      return interaction.reply({
        content: `${newVal ? '✅' : '❌'} **${feature}** ${newVal ? 'enabled' : 'disabled'} for this server.`,
        flags: 64,
      });
    }
  },

  // ── Modal handler ────────────────────────────────────────────────────
  async handleModal(interaction) {
    const { customId, guildId } = interaction;

    if (customId === 'aegis_modal_game_custom') {
      const patch = {
        game_name:  interaction.fields.getTextInputValue('game_name').trim()  || null,
        game_topic: interaction.fields.getTextInputValue('game_topic').trim() || null,
        server_rates: interaction.fields.getTextInputValue('server_rates').trim() || null,
      };
      await guildManager.update(guildId, patch);
      // Bust AI cache so new game knowledge takes effect immediately
      try { require('../../services/aiService').bustKnowledgeCache(guildId); } catch {}
      return interaction.reply({
        content: `✅ **Game configured!**\n> 🎮 **${patch.game_name || 'Custom'}**\n> 📋 Topic: ${patch.game_topic || 'N/A'}\n\nAEGIS will now answer questions about **${patch.game_name}** for your community.`,
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_community') {
      const patch = {
        display_name:           interaction.fields.getTextInputValue('display_name').trim() || null,
        community_description:  interaction.fields.getTextInputValue('community_desc').trim() || null,
        community_rules:        interaction.fields.getTextInputValue('community_rules').trim() || null,
        staff_roster:           interaction.fields.getTextInputValue('staff_roster').trim() || null,
        payment_handle:         interaction.fields.getTextInputValue('payment_handle').trim() || null,
      };
      await guildManager.update(guildId, patch);
      try { require('../../services/aiService').bustKnowledgeCache(guildId); } catch {}
      return interaction.reply({
        content: `✅ **Community info saved!**\n> 🏠 Name: **${patch.display_name || interaction.guild.name}**\n> AEGIS now knows your community description, rules, and staff.`,
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_channels') {
      const patch = {
        aegis_channel_id:         interaction.fields.getTextInputValue('aegis_channel_id').trim()         || null,
        mod_log_channel_id:       interaction.fields.getTextInputValue('mod_log_channel_id').trim()       || null,
        announcement_channel_id:  interaction.fields.getTextInputValue('announcement_channel_id').trim()  || null,
        welcome_channel_id:       interaction.fields.getTextInputValue('welcome_channel_id').trim()       || null,
        transcript_channel:       interaction.fields.getTextInputValue('transcript_channel').trim()       || null,
      };
      await guildManager.update(guildId, patch);
      const set = Object.values(patch).filter(Boolean).length;
      return interaction.reply({
        content: `✅ **Channels saved!** (${set}/5 set)\n${Object.entries(patch).filter(([,v]) => v).map(([k,v]) => `• ${k.replace(/_id$/, '').replace(/_/g, ' ')}: <#${v}>`).join('\n') || 'None set.'}`,
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_roles') {
      const patch = {
        admin_role_id:  interaction.fields.getTextInputValue('admin_role_id').trim()  || null,
        mod_role_id:    interaction.fields.getTextInputValue('mod_role_id').trim()    || null,
        helper_role_id: interaction.fields.getTextInputValue('helper_role_id').trim() || null,
        member_role_id: interaction.fields.getTextInputValue('member_role_id').trim() || null,
        vip_role_id:    interaction.fields.getTextInputValue('vip_role_id').trim()    || null,
      };
      await guildManager.update(guildId, patch);
      return interaction.reply({ content: '✅ **Roles saved!** AEGIS will use these for permission checks.', flags: 64 });
    }

    if (customId === 'aegis_modal_economy') {
      const patch = {
        currency_name:        interaction.fields.getTextInputValue('currency_name').trim()         || 'ClaveShard',
        currency_emoji:       interaction.fields.getTextInputValue('currency_emoji').trim()        || '💎',
        payment_handle:       interaction.fields.getTextInputValue('payment_handle').trim()        || null,
        weekly_claim_amount:  parseInt(interaction.fields.getTextInputValue('weekly_amount'))      || 3,
        trivia_reward_amount: parseInt(interaction.fields.getTextInputValue('trivia_reward'))      || 15000,
      };
      await guildManager.update(guildId, patch);
      return interaction.reply({
        content: `✅ **Economy saved!**\n> ${patch.currency_emoji} **${patch.currency_name}** · Weekly: ${patch.weekly_claim_amount} · Trivia: ${patch.trivia_reward_amount.toLocaleString()}`,
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_ai') {
      const patch = {
        ai_persona:           interaction.fields.getTextInputValue('ai_persona').trim()           || 'sovereign',
        community_description: interaction.fields.getTextInputValue('ai_extra_context').trim()   || null,
        custom_features:      interaction.fields.getTextInputValue('custom_features').trim()      || null,
      };
      await guildManager.update(guildId, patch);
      try { require('../../services/aiService').bustKnowledgeCache(guildId); } catch {}
      return interaction.reply({
        content: `✅ **AI persona saved!**\n> 🤖 Persona: **${patch.ai_persona}**\n\nAEGIS will now use this tone and context for all AI responses.`,
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_ticketlogs') {
      const patch = {
        ticket_log_support:    interaction.fields.getTextInputValue('log_support').trim()    || null,
        ticket_log_starterkit: interaction.fields.getTextInputValue('log_starterkit').trim() || null,
        ticket_log_concoin:    interaction.fields.getTextInputValue('log_concoin').trim()    || null,
        ticket_log_claveshard: interaction.fields.getTextInputValue('log_claveshard').trim() || null,
        ticket_log_basewatch:  interaction.fields.getTextInputValue('log_basewatch').trim()  || null,
      };
      await guildManager.update(guildId, patch);
      const set = Object.values(patch).filter(Boolean).length;
      return interaction.reply({ content: `✅ **Ticket log channels saved!** (${set}/5 set)`, flags: 64 });
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════
// MODAL & MENU BUILDERS
// ═══════════════════════════════════════════════════════════════════════

// Game preset selector
async function showGamePresetMenu(interaction) {
  const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
  const menu = new StringSelectMenuBuilder()
    .setCustomId('aegis_game_select')
    .setPlaceholder('🎮 Select your game or choose Custom...')
    .addOptions([
      { label: '🦕 ARK: Survival Ascended', value: 'aegis_game_preset:ark_survival_ascended', description: 'PvE/PvP survival, taming, breeding, crossplay' },
      { label: '🦕 ARK: Survival Evolved',  value: 'aegis_game_preset:ark_survival_evolved',  description: 'Original ARK survival game' },
      { label: '⛏️ Minecraft',               value: 'aegis_game_preset:minecraft',             description: 'Survival, building, mods, servers' },
      { label: '🔥 Rust',                    value: 'aegis_game_preset:rust',                  description: 'Survival, base building, PvP, wipes' },
      { label: '⚔️ Valheim',                 value: 'aegis_game_preset:valheim',               description: 'Norse survival, building, bosses' },
      { label: '🐾 Palworld',               value: 'aegis_game_preset:palworld',              description: 'Pal catching, breeding, base building' },
      { label: '🏰 Conan Exiles',            value: 'aegis_game_preset:conan_exiles',          description: 'Survival, building, thralls, dungeons' },
      { label: '🧟 7 Days to Die',           value: 'aegis_game_preset:7dtd',                  description: 'Zombie survival, base building, hordes' },
      { label: '💬 General Community',       value: 'aegis_game_preset:general',               description: 'Not game-specific — general community bot' },
      { label: '⚙️ Custom (enter manually)', value: 'aegis_game_preset:custom',               description: 'Type your own game name and topic' },
    ]);

  await interaction.reply({
    content: '**🎮 Select your server\'s game or topic:**\n\nAEGIS will use this to answer game-specific questions with full knowledge. You can always change it later.',
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: 64,
  });
}

// Apply a game preset
async function applyGamePreset(interaction, presetKey) {
  if (presetKey === 'custom') {
    return showGameCustomModal(interaction);
  }
  const preset = GAME_PRESETS[presetKey] || GAME_PRESETS.general;
  await guildManager.update(interaction.guildId, {
    game_name:             preset.game_name,
    game_topic:            preset.game_topic,
    server_rates:          preset.server_rates || null,
    community_description: preset.community_description || null,
  });
  try { require('../../services/aiService').bustKnowledgeCache(interaction.guildId); } catch {}
  await interaction.reply({
    content: `✅ **Game set: ${preset.game_name}**\n\nAEGIS is now configured for ${preset.game_name}. You can refine the description and rates in **🏠 Community Info**.\n\n> Next: Set your channels with **📡 Channels**, then run **✅ Finish Setup**.`,
    flags: 64,
  });
}

async function showGameCustomModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId) || {};
  const modal = new ModalBuilder().setCustomId('aegis_modal_game_custom').setTitle('🎮 Custom Game Configuration');
  modal.addComponents(
    row(text('game_name',   'Game Name',                     config.game_name    || '', false, 'e.g. Rust, Minecraft, Valheim, General Community')),
    row(text('game_topic',  'Game Topic / Keywords',         config.game_topic   || '', false, 'e.g. survival, base building, PvP, mods, crafting')),
    row(text('server_rates','Server Rates / Settings',       config.server_rates || '', false, 'e.g. 2x gather, 5x taming, vanilla, modded — or leave blank')),
  );
  return interaction.showModal(modal);
}

async function showCommunityModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId) || {};
  const modal = new ModalBuilder().setCustomId('aegis_modal_community').setTitle('🏠 Community Information');
  modal.addComponents(
    row(text('display_name',    'Server Display Name',             config.display_name           || interaction.guild.name, false, 'What AEGIS calls your server in embeds')),
    row(para('community_desc',  'Community Description',           config.community_description  || '', false, 'Short description of your community — AEGIS reads this')),
    row(para('community_rules', 'Server Rules (short version)',    config.community_rules        || '', false, 'Key rules — AEGIS references these when asked about rules')),
    row(text('staff_roster',    'Staff / Council (name + title)',  config.staff_roster           || '', false, 'e.g. Tw_ (Owner), Sandy (Co-Owner), Slothie (Admin)')),
    row(text('payment_handle',  'Payment Handle (CashApp/Chime)', config.payment_handle         || '', false, 'e.g. $TheConclaveDominion — for shop/donation commands')),
  );
  return interaction.showModal(modal);
}

async function showChannelsModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId) || {};
  const modal = new ModalBuilder().setCustomId('aegis_modal_channels').setTitle('📡 Channel Configuration');
  modal.addComponents(
    row(text('aegis_channel_id',        'AEGIS AI Channel ID',       config.aegis_channel_id        || '', false, 'Where users can chat with AEGIS directly')),
    row(text('mod_log_channel_id',      'Mod Log Channel ID',        config.mod_log_channel_id      || '', false, 'Where moderation actions are logged')),
    row(text('announcement_channel_id', 'Announcement Channel ID',  config.announcement_channel_id || '', false, 'Where AEGIS announcements are posted')),
    row(text('welcome_channel_id',      'Welcome Channel ID',       config.welcome_channel_id      || '', false, 'Where new member welcomes are sent')),
    row(text('transcript_channel',      'Ticket Transcript Channel', config.transcript_channel      || '', false, 'Where closed ticket transcripts are archived')),
  );
  return interaction.showModal(modal);
}

async function showRolesModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId) || {};
  const modal = new ModalBuilder().setCustomId('aegis_modal_roles').setTitle('👥 Role Configuration');
  modal.addComponents(
    row(text('admin_role_id',  'Admin Role ID',  config.admin_role_id  || '', false, 'Right-click role → Copy ID')),
    row(text('mod_role_id',    'Mod Role ID',    config.mod_role_id    || '', false, 'Moderator role ID')),
    row(text('helper_role_id', 'Helper Role ID', config.helper_role_id || '', false, 'Helper/staff role ID')),
    row(text('member_role_id', 'Member Role ID', config.member_role_id || '', false, 'Base member role ID')),
    row(text('vip_role_id',    'VIP Role ID',    config.vip_role_id    || '', false, 'VIP/Patron/supporter role ID')),
  );
  return interaction.showModal(modal);
}

async function showEconomyModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId) || {};
  const modal = new ModalBuilder().setCustomId('aegis_modal_economy').setTitle('💎 Economy Settings');
  modal.addComponents(
    row(text('currency_name',   'Currency Name',          config.currency_name         || 'ClaveShard', false, 'e.g. Credits, Gold, ClaveShard, Coins')),
    row(text('currency_emoji',  'Currency Emoji',         config.currency_emoji        || '💎',         false, 'Single emoji used in currency displays')),
    row(text('payment_handle',  'Payment Handle',         config.payment_handle        || '',            false, 'CashApp/Chime handle e.g. $YourHandle')),
    row(text('weekly_amount',   'Weekly Claim Amount',    String(config.weekly_claim_amount  || 3),      false, 'How many currency per /weekly claim')),
    row(text('trivia_reward',   'Trivia Reward (ConCoins)', String(config.trivia_reward_amount || 15000), false, 'ConCoins awarded per correct trivia answer')),
  );
  return interaction.showModal(modal);
}

async function showAiModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId) || {};
  const modal = new ModalBuilder().setCustomId('aegis_modal_ai').setTitle('🤖 AI Persona & Context');
  modal.addComponents(
    row(text('ai_persona',        'AI Persona Style',           config.ai_persona             || 'sovereign', false, 'sovereign | friendly | cyber | lore | tactical')),
    row(para('ai_extra_context',  'Extra Context for AEGIS',    config.community_description  || '',          false, 'Anything extra AEGIS should know about your server')),
    row(para('custom_features',   'Custom Features / Mods',     config.custom_features        || '',          false, 'List of mods, custom mechanics, special features')),
  );
  return interaction.showModal(modal);
}

async function showTicketLogsModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId) || {};
  const modal = new ModalBuilder().setCustomId('aegis_modal_ticketlogs').setTitle('📋 Ticket Log Channels');
  modal.addComponents(
    row(text('log_support',    'Support Ticket Log',    config.ticket_log_support    || '', false, 'Admin channel where support tickets are logged')),
    row(text('log_starterkit', 'Starter Kit Log',       config.ticket_log_starterkit || '', false, 'Admin channel where starter kit tickets go')),
    row(text('log_concoin',    'ConCoin Log',           config.ticket_log_concoin    || '', false, 'Admin channel where ConCoin tickets go')),
    row(text('log_claveshard', 'ClaveShard Shop Log',   config.ticket_log_claveshard || '', false, 'Admin channel where shop order tickets go')),
    row(text('log_basewatch',  'Base Watch Log',        config.ticket_log_basewatch  || '', false, 'Admin channel where base watch requests go')),
  );
  return interaction.showModal(modal);
}

async function showFeaturesMenu(interaction) {
  const config = await guildManager.getConfig(interaction.guildId) || {};
  const features = [
    { id: 'economy',    label: '💎 Economy (wallet/bank/shop)',   enabled: config.economy_enabled    !== false },
    { id: 'trivia',     label: '🎯 Trivia (reward system)',        enabled: config.trivia_enabled     !== false },
    { id: 'automod',    label: '🛡️ AutoMod (link/caps/spam)',     enabled: config.automod_enabled    !== false },
    { id: 'tickets',    label: '🎫 Ticket System',                 enabled: config.tickets_enabled   !== false },
    { id: 'ai',         label: '🤖 AEGIS AI Assistant',            enabled: config.ai_enabled        !== false },
    { id: 'giveaway',   label: '🎉 Giveaways & Events',            enabled: config.giveaway_enabled  !== false },
    { id: 'monitor',    label: '📡 Server Monitor (game servers)', enabled: config.monitor_enabled   === true  },
    { id: 'watchtower', label: '👁️ Watchtower (base watch)',       enabled: config.watchtower_enabled === true },
  ];

  const rows = [];
  for (let i = 0; i < features.length; i += 4) {
    const chunk = features.slice(i, i + 4);
    rows.push(new ActionRowBuilder().addComponents(
      ...chunk.map(f => new ButtonBuilder()
        .setCustomId(`aegis_toggle_${f.id}`)
        .setLabel(`${f.enabled ? '✅' : '❌'} ${f.label}`)
        .setStyle(f.enabled ? ButtonStyle.Success : ButtonStyle.Danger)
      )
    ));
  }

  return interaction.reply({
    content: '**⚙️ Feature Toggles** — click any to enable/disable:',
    components: rows,
    flags: 64,
  });
}

async function finishSetup(interaction) {
  const config = await guildManager.getConfig(interaction.guildId) || {};
  await guildManager.saveSetup(interaction.guildId, {}, interaction.user.id);

  const warnings = [];
  if (!config.game_name)      warnings.push('• ⚠️ No game configured — run **🎮 Game / Topic** to set your game');
  if (!config.aegis_channel_id) warnings.push('• ⚠️ No AEGIS channel set — users can still use /aegis anywhere');
  if (!config.admin_role_id)  warnings.push('• ⚠️ No admin role set — AEGIS will fall back to Discord permissions');

  const embed = new EmbedBuilder()
    .setColor(warnings.length ? 0xFFB800 : 0x35ED7E)
    .setTitle(warnings.length ? '⚠️ Setup Complete (with notes)' : '✅ AEGIS Setup Complete!')
    .setDescription([
      `**${interaction.guild.name}** is now configured.`,
      '',
      config.game_name ? `🎮 Game: **${config.game_name}**` : '',
      `💎 Currency: **${config.currency_emoji} ${config.currency_name}**`,
      `🤖 AI Persona: **${config.ai_persona}**`,
      '',
      warnings.length ? '**Notes:**\n' + warnings.join('\n') : 'All settings look good!',
      '',
      '**Get started:**',
      '• Try `/aegis` to chat with AEGIS about your game',
      '• Use `/help` to see all commands',
      '• Add knowledge with `/know add`',
      '',
      config.game_name ? `AEGIS is now trained to answer questions about **${config.game_name}** for your community.` : '',
    ].filter(l => l !== '').join('\n'))
    .setFooter({ text: `Configured by ${interaction.user.username} · AEGIS v14 Global` })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: 64 });
}

// ── Input helpers ─────────────────────────────────────────────────────
const text = (id, label, value = '', required = false, placeholder = '') =>
  new TextInputBuilder().setCustomId(id).setLabel(label.slice(0, 45)).setValue(value)
    .setRequired(required).setStyle(TextInputStyle.Short)
    .setPlaceholder(placeholder.slice(0, 100) || label);

const para = (id, label, value = '', required = false, placeholder = '') =>
  new TextInputBuilder().setCustomId(id).setLabel(label.slice(0, 45)).setValue(value)
    .setRequired(required).setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(placeholder.slice(0, 100) || label);

const row = (component) => new ActionRowBuilder().addComponents(component);

// Handle select menu for game presets (wire in interactionCreate.js)
async function handleGameSelect(interaction) {
  if (!interaction.isStringSelectMenu()) return false;
  if (interaction.customId !== 'aegis_game_select') return false;
  const presetKey = interaction.values[0].replace('aegis_game_preset:', '');
  await applyGamePreset(interaction, presetKey);
  return true;
}

module.exports.handleGameSelect = handleGameSelect;
module.exports.GAME_PRESETS     = GAME_PRESETS;
