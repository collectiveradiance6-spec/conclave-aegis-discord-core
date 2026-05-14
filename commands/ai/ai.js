// commands/ai/ai.js — All AI commands
'use strict';

const { SlashCommandBuilder } = require('discord.js');
const ai = require('../../services/aiService');
const P  = require('../../panels');
const { C, FT, isAdmin, base } = require('../../config/constants');
const { sb, sbOk } = require('../../services/supabase');

const aegis = {
  data: new SlashCommandBuilder().setName('aegis').setDescription('🤖 Ask AEGIS anything about the Dominion')
    .addStringOption(o=>o.setName('question').setDescription('Your question').setRequired(true)),
  async execute(interaction) {
    const q=interaction.options.getString('question');
    const resp=await ai.ask(q,interaction.user.id,'',interaction.channelId);
    return interaction.editReply({ embeds:[P.AegisPanel(resp,'AEGIS')] });
  },
};

const forget = {
  data: new SlashCommandBuilder().setName('forget').setDescription('🧹 Clear your AEGIS conversation history'),
  async execute(interaction) {
    ai.clearHist(interaction.user.id);
    return interaction.editReply('🧹 Conversation history cleared.');
  },
};

const aiCost = {
  data: new SlashCommandBuilder().setName('ai-cost').setDescription('[Admin] 💰 View AI token usage and cost'),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const { data }=await sb.from('aegis_ai_usage').select('model,engine,input_tokens,output_tokens').order('created_at',{ascending:false}).limit(500);
    const total=data?.length||0, haiku=data?.filter(r=>r.engine==='anthropic').length||0, groqRows=data?.filter(r=>r.engine==='groq').length||0;
    const inp=data?.reduce((s,r)=>s+(r.input_tokens||0),0)||0, out=data?.reduce((s,r)=>s+(r.output_tokens||0),0)||0;
    return interaction.editReply({ embeds:[P.AiUsagePanel(total,haiku,groqRows,inp,out,(inp/1000*0.001)+(out/1000*0.005))] });
  },
};

const aegisPersona = {
  data: new SlashCommandBuilder().setName('aegis-persona').setDescription('[Admin] 🎭 Set AEGIS persona for this channel')
    .addStringOption(o=>o.setName('style').setDescription('Persona style').setRequired(true).addChoices({name:'Sovereign',value:'sovereign'},{name:'Combat',value:'combat'},{name:'Shop',value:'shop'},{name:'Lore',value:'lore'},{name:'Friendly',value:'friendly'},{name:'Reset',value:'reset'}))
    .addStringOption(o=>o.setName('note').setDescription('Additional context note')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const style=interaction.options.getString('style'), note=interaction.options.getString('note')||'';
    if (style==='reset') { ai.clearPersona(interaction.channelId); return interaction.editReply('✅ AEGIS persona reset to Sovereign default.'); }
    const styleMap={ sovereign:'Cold, precise, cosmic authority. Minimal emotion. Maximum impact.', combat:'Tactical, urgent, battle-focused. Short sentences. War-room energy.', shop:'Merchant warmth. Clear item descriptions. Payment guidance.', lore:'Ancient, mystical, world-builder. Rich descriptions.', friendly:'Warm, approachable, helpful. Like a knowledgeable guild mate.' };
    ai.setPersona(interaction.channelId,{style:styleMap[style]||style,note});
    return interaction.editReply({ embeds:[base('🎭 AEGIS Persona Set',C.pl).setDescription(`**Style:** ${style}\n**Channel:** <#${interaction.channelId}>${note?`\n\n📝 Note: ${note}`:''}`)] });
  },
};

const summarize = {
  data: new SlashCommandBuilder().setName('summarize').setDescription('[Admin] 📝 Summarize recent channel messages')
    .addIntegerOption(o=>o.setName('count').setDescription('Number of messages').setMinValue(5).setMaxValue(50)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const count=interaction.options.getInteger('count')||25;
    const messages=await interaction.channel.messages.fetch({limit:count});
    const text=[...messages.values()].reverse().filter(m=>!m.author.bot).map(m=>`${m.author.username}: ${m.content.slice(0,200)}`).join('\n');
    if (!text.trim()) return interaction.editReply('📭 No non-bot messages to summarize.');
    const summary=await ai.summarize(`Summarize these Discord messages from TheConclave Dominion gaming community concisely (max 5 bullet points):\n\n${text}`);
    return interaction.editReply({ embeds:[base('📝 AEGIS Chat Summary',C.pl).setDescription(summary||'Unable to summarize.').setFooter({...FT,text:`Last ${count} messages · AEGIS`})] });
  },
};

const compare = {
  data: new SlashCommandBuilder().setName('compare').setDescription('⚖️ Compare two ARK dinos head-to-head')
    .addStringOption(o=>o.setName('dino1').setDescription('First dino').setRequired(true))
    .addStringOption(o=>o.setName('dino2').setDescription('Second dino').setRequired(true)),
  async execute(interaction) {
    const dino1=interaction.options.getString('dino1'), dino2=interaction.options.getString('dino2');
    const resp=await ai.ask(`Compare ${dino1} vs ${dino2} in ARK: Survival Ascended. Cover: taming difficulty, combat effectiveness, utility/uses, resource gathering, speed, recommended saddle level. TheConclave uses 5× rates and max wild 350. Keep under 1600 chars.`,null,'',interaction.channelId);
    return interaction.editReply({ embeds:[base(`⚖️ ${dino1} vs ${dino2}`,C.cy).setDescription(resp)] });
  },
};

const bossGuide = {
  data: new SlashCommandBuilder().setName('boss-guide').setDescription('👹 AI boss fight guide')
    .addStringOption(o=>o.setName('boss').setDescription('Boss name').setRequired(true)),
  async execute(interaction) {
    const boss=interaction.options.getString('boss');
    const resp=await ai.ask(`Detailed boss fight guide for ${boss} in ARK Survival Ascended. Include: recommended dinos, ideal levels (TheConclave max wild 350), artifact/tribute requirements, fight strategy, common mistakes, rewards. Under 1600 chars.`,null,'',interaction.channelId);
    return interaction.editReply({ embeds:[base(`👹 Boss Guide: ${boss}`,C.rd).setDescription(resp)] });
  },
};

const baseTips = {
  data: new SlashCommandBuilder().setName('base-tips').setDescription('🏗️ AI base building tips for a specific map')
    .addStringOption(o=>o.setName('map').setDescription('Map name').setRequired(true)),
  async execute(interaction) {
    const mapName=interaction.options.getString('map');
    const resp=await ai.ask(`Base building tips for ${mapName} in ARK Survival Ascended on TheConclave Dominion (5× PvE, except Aberration PvP). Best locations with coordinates, terrain advantages, resource proximity, threats. Under 1600 chars.`,null,'',interaction.channelId);
    return interaction.editReply({ embeds:[base(`🏗️ Base Tips: ${mapName}`,C.gr).setDescription(resp)] });
  },
};

const dino = {
  data: new SlashCommandBuilder().setName('dino').setDescription('🦕 AI dino encyclopedia entry')
    .addStringOption(o=>o.setName('name').setDescription('Dino name').setRequired(true)),
  async execute(interaction) {
    const name=interaction.options.getString('name');
    const resp=await ai.ask(`ARK encyclopedia entry for "${name}": taming method, best food, saddle level, recommended use, stats to prioritize, TheConclave tips on 5× rates. Under 1600 chars.`,null);
    return interaction.editReply({ embeds:[P.DinoPanel(name,resp)] });
  },
};

module.exports = [aegis, forget, aiCost, aegisPersona, summarize, compare, bossGuide, baseTips, dino];
