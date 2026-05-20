// commands/ai/ai.js — AEGIS v14 GLOBAL EDITION
// All AI commands are now guild-aware.
// The system prompt is built dynamically from guild_configs per guild.
'use strict';

const { SlashCommandBuilder } = require('discord.js');
const ai = require('../../services/aiService');
const P  = require('../../panels');
const { C, FT, isAdmin, base } = require('../../config/constants');
const { sb, sbOk } = require('../../services/supabase');
const guildManager  = require('../../managers/guildManager');

// ── /aegis ────────────────────────────────────────────────────────────
const aegis = {
  data: new SlashCommandBuilder()
    .setName('aegis')
    .setDescription('🤖 Ask AEGIS anything about your server or game')
    .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  async execute(interaction) {
    try {
      const q       = interaction.options.getString('question');
      const guildCfg = await guildManager.getConfig(interaction.guildId);
      const resp    = await ai.ask(q, interaction.user.id, '', interaction.channelId, interaction.guildId, guildCfg);
      const engine  = process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC·HAIKU·4.5' : 'GROQ·LLAMA·3';
      return interaction.editReply({ embeds: [P.AegisPanel(resp, engine)] });
    } catch (e) {
      console.error('[/aegis]', e.message);
      return interaction.editReply(`⚠️ AEGIS error: ${e.message?.slice(0, 100) || 'Unknown'}`);
    }
  },
};

// ── /forget ───────────────────────────────────────────────────────────
const forget = {
  data: new SlashCommandBuilder()
    .setName('forget')
    .setDescription('🧹 Clear your AEGIS conversation history'),
  async execute(interaction) {
    ai.clearHist(interaction.user.id);
    return interaction.editReply('🧹 Conversation history cleared.');
  },
};

// ── /ai-cost ─────────────────────────────────────────────────────────
const aiCost = {
  data: new SlashCommandBuilder()
    .setName('ai-cost')
    .setDescription('[Admin] 💰 View AI token usage and estimated cost'),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    if (!sb || !sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    try {
      // Show guild-specific usage if available, else all
      let query = sb.from('aegis_ai_usage').select('model,engine,input_tokens,output_tokens').order('created_at', { ascending: false }).limit(500);
      const { data } = await query;
      const total   = data?.length || 0;
      const haiku   = data?.filter(r => r.engine === 'anthropic').length || 0;
      const groqRows = data?.filter(r => r.engine === 'groq').length || 0;
      const inp     = data?.reduce((s, r) => s + (r.input_tokens  || 0), 0) || 0;
      const out     = data?.reduce((s, r) => s + (r.output_tokens || 0), 0) || 0;
      return interaction.editReply({ embeds: [P.AiUsagePanel(total, haiku, groqRows, inp, out, (inp/1000*0.001)+(out/1000*0.005))] });
    } catch (e) { return interaction.editReply(`⚠️ ${e.message}`); }
  },
};

// ── /aegis-persona ────────────────────────────────────────────────────
const aegisPersona = {
  data: new SlashCommandBuilder()
    .setName('aegis-persona')
    .setDescription('[Admin] 🎭 Set AEGIS persona for this channel')
    .addStringOption(o => o.setName('style').setDescription('Persona style').setRequired(true)
      .addChoices(
        { name: '🌌 Sovereign (default)', value: 'sovereign' },
        { name: '⚔️ Combat Tactical',     value: 'combat'   },
        { name: '🛍️ Shop Assistant',      value: 'shop'     },
        { name: '📜 Lore Keeper',         value: 'lore'     },
        { name: '🤝 Friendly Helper',     value: 'friendly' },
        { name: '❌ Reset to Default',    value: 'reset'    },
      ))
    .addStringOption(o => o.setName('note').setDescription('Additional persona context')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const style = interaction.options.getString('style');
    const note  = interaction.options.getString('note') || '';
    if (style === 'reset') {
      ai.clearPersona(interaction.channelId);
      return interaction.editReply('✅ AEGIS persona reset to server default.');
    }
    const styleMap = {
      sovereign: 'Cold, precise, cosmic authority. Minimal emotion. Maximum impact.',
      combat:    'Tactical, urgent, battle-focused. Short sentences. War-room energy.',
      shop:      'Merchant warmth. Clear item descriptions. Payment guidance.',
      lore:      'Ancient, mystical, world-builder. Rich descriptions. Keeper of secrets.',
      friendly:  'Warm, approachable, helpful. Like a knowledgeable community member.',
    };
    ai.setPersona(interaction.channelId, { style: styleMap[style] || style, note });
    return interaction.editReply({ embeds: [
      base('🎭 AEGIS Persona Set', C.pl)
        .setDescription(`**Style:** ${style}\n**Channel:** <#${interaction.channelId}>${note ? `\n\n📝 Note: ${note}` : ''}`)
    ]});
  },
};

// ── /summarize ────────────────────────────────────────────────────────
const summarize = {
  data: new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('[Admin] 📝 Summarize recent channel messages')
    .addIntegerOption(o => o.setName('count').setDescription('Number of messages').setMinValue(5).setMaxValue(50)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const count = interaction.options.getInteger('count') || 25;
    const messages = await interaction.channel.messages.fetch({ limit: count });
    const text = [...messages.values()].reverse().filter(m => !m.author.bot)
      .map(m => `${m.author.username}: ${m.content.slice(0, 200)}`).join('\n');
    if (!text.trim()) return interaction.editReply('📭 No non-bot messages to summarize.');
    const guildCfg = await guildManager.getConfig(interaction.guildId);
    const topic    = guildCfg?.game_name || 'community';
    const summary  = await ai.summarize(`Summarize these Discord messages from a ${topic} community concisely (max 5 bullet points):\n\n${text}`);
    return interaction.editReply({ embeds: [
      base('📝 AEGIS Chat Summary', C.pl)
        .setDescription(summary || 'Unable to summarize.')
        .setFooter({ ...FT, text: `Last ${count} messages · AEGIS v14` })
    ]});
  },
};

// ── /compare ─────────────────────────────────────────────────────────
const compare = {
  data: new SlashCommandBuilder()
    .setName('compare')
    .setDescription('⚖️ Compare two items, creatures, or options from your game')
    .addStringOption(o => o.setName('item1').setDescription('First item').setRequired(true))
    .addStringOption(o => o.setName('item2').setDescription('Second item').setRequired(true)),
  async execute(interaction) {
    const item1    = interaction.options.getString('item1');
    const item2    = interaction.options.getString('item2');
    const guildCfg = await guildManager.getConfig(interaction.guildId);
    const game     = guildCfg?.game_name || 'your game';
    const resp     = await ai.ask(
      `Compare **${item1}** vs **${item2}** in ${game}. Cover: strengths, weaknesses, use cases, which is better and when. Keep under 1600 characters.`,
      null, '', interaction.channelId, interaction.guildId, guildCfg
    );
    return interaction.editReply({ embeds: [
      base(`⚖️ ${item1} vs ${item2}`, C.cy).setDescription(resp)
    ]});
  },
};

// ── /boss-guide ───────────────────────────────────────────────────────
const bossGuide = {
  data: new SlashCommandBuilder()
    .setName('boss-guide')
    .setDescription('👹 AI guide for a boss or challenge in your game')
    .addStringOption(o => o.setName('boss').setDescription('Boss or challenge name').setRequired(true)),
  async execute(interaction) {
    const boss     = interaction.options.getString('boss');
    const guildCfg = await guildManager.getConfig(interaction.guildId);
    const game     = guildCfg?.game_name || 'your game';
    const resp     = await ai.ask(
      `Detailed guide for defeating **${boss}** in ${game}. Include: preparation, recommended loadout/tames, strategy, common mistakes, rewards. Under 1600 characters.`,
      null, '', interaction.channelId, interaction.guildId, guildCfg
    );
    return interaction.editReply({ embeds: [
      base(`👹 Boss Guide: ${boss}`, C.rd).setDescription(resp)
    ]});
  },
};

// ── /base-tips ────────────────────────────────────────────────────────
const baseTips = {
  data: new SlashCommandBuilder()
    .setName('base-tips')
    .setDescription('🏗️ AI base building tips for a specific location or map')
    .addStringOption(o => o.setName('location').setDescription('Map or location name').setRequired(true)),
  async execute(interaction) {
    const location = interaction.options.getString('location');
    const guildCfg = await guildManager.getConfig(interaction.guildId);
    const game     = guildCfg?.game_name || 'your game';
    const rates    = guildCfg?.server_rates || '';
    const resp     = await ai.ask(
      `Base building tips for **${location}** in ${game}. ${rates ? `Server settings: ${rates}.` : ''} Cover: best spots, terrain advantages, resource proximity, threats. Under 1600 characters.`,
      null, '', interaction.channelId, interaction.guildId, guildCfg
    );
    return interaction.editReply({ embeds: [
      base(`🏗️ Base Tips: ${location}`, C.gr).setDescription(resp)
    ]});
  },
};

// ── /dino (generic "creature/item lookup") ────────────────────────────
const dino = {
  data: new SlashCommandBuilder()
    .setName('dino')
    .setDescription('🦕 Look up a creature, item, or mechanic from your game')
    .addStringOption(o => o.setName('name').setDescription('What to look up').setRequired(true)),
  async execute(interaction) {
    const name     = interaction.options.getString('name');
    const guildCfg = await guildManager.getConfig(interaction.guildId);
    const game     = guildCfg?.game_name || 'your game';
    const resp     = await ai.ask(
      `Detailed ${game} info for "${name}": how to obtain/tame, stats, uses, recommended approach, tips. Under 1600 characters.`,
      null, '', interaction.channelId, interaction.guildId, guildCfg
    );
    return interaction.editReply({ embeds: [P.DinoPanel(name, resp)] });
  },
};

module.exports = [aegis, forget, aiCost, aegisPersona, summarize, compare, bossGuide, baseTips, dino];
