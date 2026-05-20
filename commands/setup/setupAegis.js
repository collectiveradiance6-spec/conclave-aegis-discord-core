'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const guildManager = require('../../managers/guildManager');
const aiService = require('../../services/aiService');

// ─────────────────────────────────────────────
// GAME PRESETS
// ─────────────────────────────────────────────
const GAME_PRESETS = {
  ark_survival_ascended: {
    game_name: 'ARK: Survival Ascended',
    game_topic: 'Survival, taming, bosses, tribes',
    server_rates: '5x rates',
    community_description: 'ARK ASA community server',
  },
  minecraft: {
    game_name: 'Minecraft',
    game_topic: 'Survival, building, mods',
    server_rates: 'Vanilla / Modded',
    community_description: 'Minecraft community',
  },
  rust: {
    game_name: 'Rust',
    game_topic: 'PvP, raiding, wipes',
    server_rates: 'Custom wipes',
    community_description: 'Rust PvP server',
  },
  general: {
    game_name: 'General Community',
    game_topic: 'Gaming & community',
    server_rates: '',
    community_description: 'General community server',
  },
};

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-aegis')
    .setDescription('Configure AEGIS')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = await guildManager.getConfig(interaction.guildId) || {};

    const embed = new EmbedBuilder()
      .setColor(0x7B2FFF)
      .setTitle('AEGIS Setup')
      .setDescription('Configure your server quickly.');

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('aegis_setup_game')
        .setLabel('Game')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('aegis_setup_channels')
        .setLabel('Channels')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('aegis_setup_roles')
        .setLabel('Roles')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('aegis_setup_ai')
        .setLabel('AI')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('aegis_setup_complete')
        .setLabel('Finish')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row1, row2],
      flags: 64,
    });
  },

  // ─────────────────────────────────────────────
  // BUTTONS
  // ─────────────────────────────────────────────
  async handleButton(interaction) {
    const id = interaction.customId;
    const guildId = interaction.guildId;

    if (id === 'aegis_setup_game') {
      return showGameMenu(interaction);
    }

    if (id.startsWith('aegis_toggle_')) {
      const key = id.replace('aegis_toggle_', '');
      const config = await guildManager.getConfig(guildId);
      const newVal = !config[key];

      await guildManager.updateField(guildId, key, newVal);

      return interaction.reply({
        content: `Toggled ${key}: ${newVal}`,
        flags: 64,
      });
    }
  },

  // ─────────────────────────────────────────────
  // SELECT MENU
  // ─────────────────────────────────────────────
  async handleGameSelect(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    if (interaction.customId !== 'aegis_game_select') return false;

    const key = interaction.values[0];
    const preset = GAME_PRESETS[key] || GAME_PRESETS.general;

    await guildManager.update(interaction.guildId, {
      game_name: preset.game_name,
      game_topic: preset.game_topic,
      server_rates: preset.server_rates,
      community_description: preset.community_description,
    });

    try { aiService.bustKnowledgeCache(interaction.guildId); } catch {}

    return interaction.reply({
      content: `Game set to **${preset.game_name}**`,
      flags: 64,
    });
  },

  GAME_PRESETS,
};

// ─────────────────────────────────────────────
// GAME MENU
// ─────────────────────────────────────────────
async function showGameMenu(interaction) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('aegis_game_select')
    .setPlaceholder('Select game')
    .addOptions(
      Object.keys(GAME_PRESETS).map(k => ({
        label: GAME_PRESETS[k].game_name,
        value: k,
      }))
    );

  return interaction.reply({
    content: 'Select a game:',
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: 64,
  });
}