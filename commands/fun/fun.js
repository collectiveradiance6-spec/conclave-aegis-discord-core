// commands/fun/fun.js — trivia, coinflip, roll, poll, rep, trade, concoin
'use strict';

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const P = require('../../panels');
const { C, FT, isAdmin, base } = require('../../config/constants');
const { sb, sbOk, dbFire } = require('../../services/supabase');

const TRIVIA_QUESTIONS = [
  { q:'What is the max wild dino level on TheConclave?',            a:'350',          hint:'It\'s a round number between 300-400' },
  { q:'How many maps are in the TheConclave cluster?',              a:'10',           hint:'Single digit or barely double' },
  { q:'What is the taming rate multiplier on TheConclave?',        a:'5',            hint:'It\'s the same as all our boost rates' },
  { q:'What currency does AEGIS use for the in-game economy?',      a:'claveshard',   hint:'It starts with "Clave"' },
  { q:'Which TheConclave map is PvP only?',                         a:'aberration',   hint:'Underground ARK with Rock Drakes' },
  { q:'Which map requires Patreon Elite to access?',                a:'amissa',       hint:'It\'s an exclusive/special map' },
  { q:'What is the max weight stat on TheConclave?',                a:'1000000',      hint:'One million' },
  { q:'What company hosts TheConclave servers?',                    a:'nitrado',      hint:'German game server provider' },
  { q:'What is the egg hatch speed multiplier?',                    a:'50',           hint:'Same as mature speed multiplier' },
  { q:'What ARK game does TheConclave run?',                        a:'survival ascended', hint:'The 2023 remake / remaster' },
  { q:'What platforms can play on TheConclave? (list all 4)',       a:'xbox playstation pc switch', hint:'All major modern platforms' },
  { q:'Who is the High Curator of TheConclave?',                    a:'tw',           hint:'Two letters, starts with T' },
  { q:'What is the name of the AEGIS AI assistant?',                a:'aegis',        hint:'An ancient Greek shield/defense system' },
  { q:'What does ClaveShard abbreviate to?',                        a:'cs',           hint:'Two letters' },
  { q:'What is the max tamed dino level cap?',                      a:'600',          hint:'Double the max wild level' },
];

const CONCOIN_REWARD = 15000;
const activeTrivias = new Map();

const trivia = {
  data: new SlashCommandBuilder().setName('trivia').setDescription('🎯 Answer ARK trivia to win ConCoins!'),
  async execute(interaction) {
    const existing = activeTrivias.get(interaction.channelId);
    if (existing && Date.now() < existing.expiresAt) return interaction.editReply(`⚠️ Active trivia already running!\n**Hint:** ${existing.hint}`);
    activeTrivias.delete(interaction.channelId);
    const q = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
    const expiresAt = Date.now() + 60_000;
    activeTrivias.set(interaction.channelId, { ...q, expiresAt });
    return interaction.editReply({ embeds:[base('🎯 ARK Trivia!',C.pk).setDescription([`**Question:** ${q.q}`,``,`> 🪙 First correct answer wins **${CONCOIN_REWARD.toLocaleString()} ConCoins!**`,`> Type your answer in this channel. Expires <t:${Math.floor(expiresAt/1000)}:R>`,``].join('\n'))] });
  },
};

// Export for messageCreate event
trivia.activeTrivias = activeTrivias;
trivia.CONCOIN_REWARD = CONCOIN_REWARD;

const coinflip = {
  data: new SlashCommandBuilder().setName('coinflip').setDescription('🪙 Flip a coin'),
  async execute(interaction) {
    const result = Math.random() < 0.5 ? '🪙 Heads!' : '🪙 Tails!';
    return interaction.editReply({ embeds:[base('🪙 Coin Flip',C.gold).setDescription(result)] });
  },
};

const roll = {
  data: new SlashCommandBuilder().setName('roll').setDescription('🎲 Roll dice')
    .addStringOption(o=>o.setName('dice').setDescription('Format: NdN (e.g. 2d6, 1d20)').setRequired(true)),
  async execute(interaction) {
    const input = interaction.options.getString('dice');
    const match = input.match(/^(\d+)d(\d+)$/i);
    if (!match) return interaction.editReply('⚠️ Use format NdN e.g. `2d6` or `1d20`');
    const count = Math.min(parseInt(match[1]), 20), sides = Math.min(parseInt(match[2]), 1000);
    const rolls = Array.from({length:count}, ()=>Math.floor(Math.random()*sides)+1);
    const total = rolls.reduce((a,b)=>a+b,0);
    return interaction.editReply({ embeds:[P.RollPanel(input,rolls,total)] });
  },
};

const poll = {
  data: new SlashCommandBuilder().setName('poll').setDescription('[Admin] 🗳️ Create a simple yes/no poll')
    .addStringOption(o=>o.setName('question').setDescription('Poll question').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const question = interaction.options.getString('question');
    const emb = base(`🗳️ Poll: ${question}`, C.cy).setDescription('Vote with reactions below!').setFooter({...FT, text:`Poll by ${interaction.user.username}`});
    const msg = await interaction.channel.send({ embeds:[emb] });
    await msg.react('✅'); await msg.react('❌');
    return interaction.editReply('✅ Poll posted!');
  },
};

const rep = {
  data: new SlashCommandBuilder().setName('rep').setDescription('⭐ Give reputation to a player')
    .addUserOption(o=>o.setName('user').setDescription('Player to rep').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    const target = interaction.options.getUser('user'), reason = interaction.options.getString('reason')||'No reason given';
    if (target.id === interaction.user.id) return interaction.editReply('⚠️ You cannot rep yourself!');
    return interaction.editReply({ embeds:[base('⭐ Reputation Given',C.gold).setDescription(`${interaction.user} gave **+1 rep** to ${target}\n*"${reason}"*`)] });
  },
};

const trade = {
  data: new SlashCommandBuilder().setName('trade').setDescription('🤝 Post a trade offer')
    .addStringOption(o=>o.setName('offering').setDescription('What you\'re offering').setRequired(true))
    .addStringOption(o=>o.setName('looking-for').setDescription('What you want').setRequired(true))
    .addStringOption(o=>o.setName('server').setDescription('Server/map')),
  async execute(interaction) {
    const offering=interaction.options.getString('offering'), looking=interaction.options.getString('looking-for'), server=interaction.options.getString('server')||'Any';
    return interaction.editReply({ embeds:[base('🤝 Trade Post',C.gold).setDescription(`Posted by **${interaction.user.username}**`).addFields({name:'📤 Offering',value:offering,inline:true},{name:'📥 Looking For',value:looking,inline:true},{name:'🗺️ Server',value:server,inline:true}).setFooter({...FT,text:'DM the poster to trade • Use /report for scams'})] });
  },
};

const concoinBooty = {
  data: new SlashCommandBuilder().setName('concoin-booty').setDescription('🪙 Check your ConCoin trivia earnings')
    .addUserOption(o=>o.setName('user').setDescription('Target (admin only for others)')),
  async execute(interaction) {
    const target = interaction.options.getUser('user');
    if (target && target.id !== interaction.user.id && !isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only for other players.');
    const who = target || interaction.user;
    if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const { data:booty } = await sb.from('aegis_concoin_booty').select('*').eq('discord_id',who.id).single().catch(()=>({data:null}));
    if (!booty) return interaction.editReply({ embeds:[base(`🪙 ${who.username}'s ConCoin Booty`,C.cy).setDescription(`No trivia wins yet! Use \`/trivia\` to start earning **${CONCOIN_REWARD.toLocaleString()} ConCoins** per correct answer!`)] });
    return interaction.editReply({ embeds:[base(`🪙 ${who.username}'s ConCoin Booty`,C.gold).addFields({name:'💰 Pending',value:`**${(booty.booty||0).toLocaleString()} ConCoins**`,inline:true},{name:'📊 Total Earned',value:`**${(booty.total_earned||0).toLocaleString()}**`,inline:true})] });
  },
};

const concoinLeaderboard = {
  data: new SlashCommandBuilder().setName('concoin-leaderboard').setDescription('🪙 Top ConCoin earners'),
  async execute(interaction) {
    if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const { data } = await sb.from('aegis_concoin_booty').select('discord_tag,booty,total_earned').order('total_earned',{ascending:false}).limit(10);
    if (!data?.length) return interaction.editReply('📭 No trivia winners yet! Use `/trivia`!');
    const medals=['👑','🥇','🥈','🥉','💠','💠','💠','💠','💠','💠'];
    const lines=data.map((r,i)=>`${medals[i]||`**${i+1}.**`} **${r.discord_tag||'Unknown'}** · 🪙 **${(r.total_earned||0).toLocaleString()}** total`).join('\n');
    return interaction.editReply({ embeds:[base('🪙 ConCoin Trivia Leaderboard',C.gold).setDescription(lines)] });
  },
};

const depositConcoins = {
  data: new SlashCommandBuilder().setName('deposit-concoins').setDescription('🪙 Deposit your pending ConCoin trivia winnings to UB'),
  async execute(interaction) {
    if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const { data:booty } = await sb.from('aegis_concoin_booty').select('*').eq('discord_id',interaction.user.id).single().catch(()=>({data:null}));
    if (!booty||booty.booty<=0) return interaction.editReply({ embeds:[base('🪙 Nothing to Deposit',C.cy).setDescription(`No pending ConCoin booty.\n\nWin trivia with \`/trivia\` to earn **${CONCOIN_REWARD.toLocaleString()} ConCoins**!`)] });
    return interaction.editReply({ embeds:[base('📋 Contact an Admin',C.gold).setDescription(`You have **${booty.booty.toLocaleString()} ConCoins** pending.\n\nAsk an admin to run \`/grant-concoins\` to deposit to your UnbelievaBoat wallet.`)] });
  },
};

const grantConcoins = {
  data: new SlashCommandBuilder().setName('grant-concoins').setDescription('[Admin] 💰 Grant pending ConCoin booty to a player')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addBooleanOption(o=>o.setName('confirm').setDescription('Confirm action').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    if (!interaction.options.getBoolean('confirm')) return interaction.editReply('⚠️ Set `confirm: True` to execute.');
    const target = interaction.options.getUser('user');
    if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const { data:booty } = await sb.from('aegis_concoin_booty').select('*').eq('discord_id',target.id).single().catch(()=>({data:null}));
    if (!booty||booty.booty<=0) return interaction.editReply(`⚠️ **${target.username}** has no pending ConCoin booty.`);
    const amount = booty.booty;
    await sb.from('aegis_concoin_booty').update({booty:0,updated_at:new Date().toISOString()}).eq('discord_id',target.id);
    return interaction.editReply({ embeds:[base('✅ ConCoin Booty Recorded',C.gr).addFields({name:'👤 Player',value:target.username,inline:true},{name:'💰 Amount',value:`${amount.toLocaleString()} ConCoins`,inline:true},{name:'📋 Note',value:'Manually grant in UnbelievaBoat dashboard.',inline:false})] });
  },
};

const grantConcoinsManual = {
  data: new SlashCommandBuilder().setName('grant-concoins-manual').setDescription('[Admin] 💰 Manually grant ConCoins to a player')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
    .addStringOption(o=>o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const target=interaction.options.getUser('user'), amount=interaction.options.getInteger('amount'), reason=interaction.options.getString('reason')||'Admin grant';
    return interaction.editReply({ embeds:[base('📋 Manual Grant Logged',C.cy).addFields({name:'👤 Player',value:target.username,inline:true},{name:'💰 Amount',value:`${amount.toLocaleString()} ConCoins`,inline:true},{name:'📋 Reason',value:reason,inline:false},{name:'⚠️ Action Required',value:'Manually grant in the UnbelievaBoat dashboard.',inline:false})] });
  },
};

module.exports = [trivia,coinflip,roll,poll,rep,trade,concoinBooty,concoinLeaderboard,depositConcoins,grantConcoins,grantConcoinsManual];
