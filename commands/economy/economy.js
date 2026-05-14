// ═══════════════════════════════════════════════════════════════════════
// commands/economy/economy.js
// wallet · weekly · leaderboard · streaks · give · shard · shop
// order · fulfill · clvsd (admin suite)
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const econ    = require('../../services/economy');
const { sb, sbOk, dbFire } = require('../../services/supabase');
const P       = require('../../panels');
const { C, FT, SHOP_TIERS, isAdmin, base } = require('../../config/constants');

const walletEmbed = (title, w, color=C.pl) =>
  base(title, color).addFields(
    { name:'💎 Wallet', value:`**${(w?.wallet_balance||0).toLocaleString()}**`, inline:true },
    { name:'🏦 Bank',   value:`**${(w?.bank_balance||0).toLocaleString()}**`,   inline:true },
    { name:'💰 Total',  value:`**${((w?.wallet_balance||0)+(w?.bank_balance||0)).toLocaleString()}**`, inline:true },
  );

// ── WALLET ──────────────────────────────────────────────────────────
const wallet = {
  data: new SlashCommandBuilder()
    .setName('wallet').setDescription('💎 ClaveShard wallet')
    .addSubcommand(s=>s.setName('balance').setDescription('View balance').addUserOption(o=>o.setName('user').setDescription('Target user')))
    .addSubcommand(s=>s.setName('deposit').setDescription('Move shards to bank').addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('withdraw').setDescription('Move shards from bank').addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('transfer').setDescription('Send shards to another player').addUserOption(o=>o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('note').setDescription('Optional note')))
    .addSubcommand(s=>s.setName('history').setDescription('Transaction history').addUserOption(o=>o.setName('user').setDescription('Target (admin only for others)')).addIntegerOption(o=>o.setName('count').setDescription('Number of records').setMinValue(1).setMaxValue(50)))
    .addSubcommand(s=>s.setName('leaderboard').setDescription('Top wallet holders'))
    .addSubcommand(s=>s.setName('supply').setDescription('Economy supply stats'))
    .addSubcommand(s=>s.setName('grant').setDescription('[Admin] Grant shards').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')))
    .addSubcommand(s=>s.setName('deduct').setDescription('[Admin] Deduct shards').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason'))),

  async execute(interaction) {
    const sub=interaction.options.getSubcommand(), target=interaction.options.getUser('user'), amount=interaction.options.getInteger('amount')||0, reason=interaction.options.getString('reason')||'', me=interaction.user;
    try {
      if (sub==='balance')     { const who=target||me; const w=await econ.getWallet(who.id,who.username); return interaction.editReply({ embeds:[P.WalletPanel(`💎 ${who.username}'s Wallet`,w)] }); }
      if (sub==='deposit')     { const w=await econ.deposit(me.id,me.username,amount); return interaction.editReply({ embeds:[walletEmbed(`🏦 Deposited ${amount} 💎`,w,C.gr)] }); }
      if (sub==='withdraw')    { const w=await econ.withdraw(me.id,me.username,amount); return interaction.editReply({ embeds:[walletEmbed(`💸 Withdrew ${amount} 💎`,w,C.cy)] }); }
      if (sub==='transfer')    { if (!target) return interaction.editReply('⚠️ Specify a recipient.'); const note=interaction.options.getString('note')||''; const r=await econ.transfer(me.id,me.username,target.id,target.username,amount); return interaction.editReply({ embeds:[base(`➡️ Transferred ${amount} 💎`,C.cy).setDescription(`Sent **${amount}** to **${target.username}**${note?`\n📝 *"${note}"*`:''}`).addFields({name:'Your wallet',value:`${r.sent.toLocaleString()} 💎`,inline:true},{name:`${target.username}'s wallet`,value:`${r.received.toLocaleString()} 💎`,inline:true})] }); }
      if (sub==='history')     { const who=target||me; if (target&&target.id!==me.id&&!isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only.'); const rows=await econ.getHistory(who.id,interaction.options.getInteger('count')||15); if (!rows.length) return interaction.editReply(`📭 No history for **${who.username}**.`); return interaction.editReply({ embeds:[P.HistoryPanel(who.username,rows)] }); }
      if (sub==='leaderboard') { const rows=await econ.getLeaderboard(10); return interaction.editReply({ embeds:[P.LeaderboardPanel(rows)] }); }
      if (sub==='supply')      { const s=await econ.getSupply(); return interaction.editReply({ embeds:[P.SupplyPanel(s)] }); }
      if (sub==='grant')       { if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only.'); const w=await econ.grant(target.id,target.username,amount,reason||'Admin grant',me.id,me.username); try { await target.send({ embeds:[base('💎 ClaveShard Received!',C.gr).setDescription(`**${me.username}** granted you **${amount.toLocaleString()} 💎**\n📝 *${reason||'Admin grant'}*`)] }); } catch {} return interaction.editReply({ embeds:[walletEmbed(`🎁 Granted ${amount} to ${target.username}`,w,C.gr)] }); }
      if (sub==='deduct')      { if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only.'); const w=await econ.deduct(target.id,target.username,amount,reason||'Admin deduct',me.id,me.username); return interaction.editReply({ embeds:[walletEmbed(`⬇️ Deducted ${amount} from ${target.username}`,w,C.rd)] }); }
    } catch(e) { return interaction.editReply(`⚠️ ${e.message}`); }
  },
};

// ── WEEKLY ──────────────────────────────────────────────────────────
const weekly = {
  data: new SlashCommandBuilder().setName('weekly').setDescription('🌟 Claim weekly ClaveShard reward'),
  async execute(interaction) {
    try { const r=await econ.claimWeekly(interaction.user.id,interaction.user.username); return interaction.editReply({ embeds:[base('🌟 Weekly ClaveShard Claimed!',C.gold).setDescription(`**${interaction.user.username}** claimed their weekly reward!`).addFields({name:'💎 Claimed',value:`**+${r.amount}**`,inline:true},{name:'🔥 Streak',value:`Week ${r.streak}`,inline:true},{name:'💰 Balance',value:`${(r.data.wallet_balance||0).toLocaleString()}`,inline:true})] }); }
    catch(e) { return interaction.editReply(`⚠️ ${e.message}`); }
  },
};

// ── LEADERBOARD ──────────────────────────────────────────────────────
const leaderboard = {
  data: new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Top ClaveShard holders'),
  async execute(interaction) {
    try { const lb=await econ.getLeaderboard(10); return interaction.editReply({ embeds:[P.LeaderboardPanel(lb)] }); }
    catch { return interaction.editReply('⚠️ Leaderboard unavailable.'); }
  },
};

// ── STREAKS ──────────────────────────────────────────────────────────
const streaks = {
  data: new SlashCommandBuilder().setName('streaks').setDescription('🔥 Weekly claim streak leaderboard'),
  async execute(interaction) {
    if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    try {
      const { data } = await sb.from('aegis_wallets').select('discord_tag,daily_streak').order('daily_streak',{ascending:false}).limit(10);
      if (!data?.length) return interaction.editReply('📭 No streak data yet.');
      const lines = data.map((r,i)=>`**${i+1}.** ${r.discord_tag||'Unknown'} — 🔥 Week ${r.daily_streak||0}`).join('\n');
      return interaction.editReply({ embeds:[base('🔥 Weekly Streak Leaderboard',C.gold).setDescription(lines)] });
    } catch(e) { return interaction.editReply(`⚠️ ${e.message}`); }
  },
};

// ── GIVE ────────────────────────────────────────────────────────────
const give = {
  data: new SlashCommandBuilder().setName('give').setDescription('[Admin] 🎁 Grant ClaveShards to a player')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
    .addStringOption(o=>o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const target=interaction.options.getUser('user'), amount=interaction.options.getInteger('amount'), reason=interaction.options.getString('reason')||'Admin grant';
    try { const w=await econ.grant(target.id,target.username,amount,reason,interaction.user.id,interaction.user.username); return interaction.editReply({ embeds:[walletEmbed(`🎁 Granted to ${target.username}`,w,C.gr).setDescription(`+**${amount}** 💎 · ${reason}`)] }); }
    catch(e) { return interaction.editReply(`⚠️ ${e.message}`); }
  },
};

// ── SHARD ────────────────────────────────────────────────────────────
const shard = {
  data: new SlashCommandBuilder().setName('shard').setDescription('💠 View full ClaveShard tier list'),
  async execute(interaction) {
    const emb=base('💠 ClaveShard Tier List',C.gold).setDescription('Shop: **theconclavedominion.com/shop** | `/order` to submit\nCashApp **$TheConclaveDominion**');
    for (const tier of SHOP_TIERS.filter(t=>t.shards>0)) emb.addFields({name:`${tier.emoji} ${tier.name}`,value:tier.items.slice(0,5).map(i=>`• ${i}`).join('\n').slice(0,1024),inline:true});
    emb.addFields({name:'🛡 Dino Insurance',value:SHOP_TIERS.find(t=>t.shards===0).items.map(i=>`• ${i}`).join('\n'),inline:false});
    return interaction.editReply({ embeds:[emb] });
  },
};

// ── SHOP ────────────────────────────────────────────────────────────
const shop = {
  data: new SlashCommandBuilder().setName('shop').setDescription('🛍️ Browse the ClaveShard shop'),
  async execute(interaction) {
    const select=new StringSelectMenuBuilder().setCustomId('shop_tier_view').setPlaceholder('💎 View a tier...').addOptions(SHOP_TIERS.filter(t=>t.shards>0).map(t=>({label:`${t.emoji} ${t.name}`,value:`${t.shards}`,description:t.items[0]?.slice(0,100)||''})));
    return interaction.editReply({ embeds:[base('🛍️ ClaveShard Shop',C.gold).setDescription('Select a tier below.\n\nUse `/order` to submit.\n\n💳 CashApp **$TheConclaveDominion**\n\n🔗 **theconclavedominion.com/shop**')], components:[new ActionRowBuilder().addComponents(select)] });
  },
};

// ── ORDER ───────────────────────────────────────────────────────────
const order = {
  data: new SlashCommandBuilder().setName('order').setDescription('📦 Submit a ClaveShard shop order')
    .addIntegerOption(o=>o.setName('tier').setDescription('Shard cost of tier').setRequired(true))
    .addStringOption(o=>o.setName('platform').setDescription('Your platform').setRequired(true).addChoices({name:'Xbox',value:'Xbox'},{name:'PlayStation',value:'PlayStation'},{name:'PC',value:'PC'},{name:'Switch',value:'Switch'}))
    .addStringOption(o=>o.setName('server').setDescription('Map/server name').setRequired(true))
    .addStringOption(o=>o.setName('notes').setDescription('Additional notes'))
    .addBooleanOption(o=>o.setName('auto-deduct').setDescription('Auto-deduct ClaveShards from wallet')),
  async execute(interaction) {
    const shards=interaction.options.getInteger('tier'), platform=interaction.options.getString('platform'), server=interaction.options.getString('server'), notes=interaction.options.getString('notes')||'None', autoDeduct=interaction.options.getBoolean('auto-deduct')??false;
    const tier=SHOP_TIERS.find(t=>t.shards===shards&&t.shards>0);
    if (!tier) return interaction.editReply(`⚠️ No tier for **${shards}** shards. Valid: 1,2,3,5,6,8,10,12,15,20,30`);
    const ref=`ORD-${Date.now().toString(36).toUpperCase()}`; let deducted=false;
    if (autoDeduct) { try { await econ.deduct(interaction.user.id,interaction.user.username,shards,`Shop order ${ref}`,'SYSTEM','AEGIS Shop'); deducted=true; } catch(e) { return interaction.editReply(`⚠️ Auto-deduct failed: ${e.message}`); } }
    const emb=base(`📦 Order Submitted — ${tier.emoji} ${tier.name}`,C.gold).addFields({name:'📋 Ref',value:`\`${ref}\``,inline:true},{name:'💎 Cost',value:`${shards} shard${shards!==1?'s':''}`,inline:true},{name:deducted?'✅ Payment':'💳 Payment',value:deducted?'Auto-deducted':'CashApp **$TheConclaveDominion**',inline:true},{name:'🎮 Platform',value:platform,inline:true},{name:'🗺️ Server',value:server,inline:true},{name:'📝 Notes',value:notes,inline:false},{name:'📦 Includes',value:tier.items.map(i=>`• ${i}`).join('\n').slice(0,1000),inline:false});
    if (sb&&sbOk()) dbFire(sb=>sb.from('aegis_shop_orders').insert({ ref, guild_id:interaction.guildId, discord_id:interaction.user.id, discord_tag:interaction.user.username, tier:shards, platform, server, notes, shards_deducted:deducted, fulfilled:false, created_at:new Date().toISOString() }));
    try { await interaction.user.send({ embeds:[base(`🧾 Order Receipt — ${ref}`,C.gold).setDescription(`**${tier.name}** · ${platform} · ${server}\n\n${deducted?`✅ ${shards} shards auto-deducted.`:`💳 Pay **$TheConclaveDominion** and include ref: \`${ref}\``}`)] }); } catch {}
    return interaction.editReply({ embeds:[emb] });
  },
};

// ── FULFILL ──────────────────────────────────────────────────────────
const fulfill = {
  data: new SlashCommandBuilder().setName('fulfill').setDescription('[Admin] ✅ Mark a shop order as fulfilled')
    .addStringOption(o=>o.setName('ref').setDescription('Order reference code').setRequired(true))
    .addStringOption(o=>o.setName('note').setDescription('Fulfillment note for the player')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const ref=interaction.options.getString('ref'), note=interaction.options.getString('note')||'Your order is ready!';
    let discordId=null;
    if (sb&&sbOk()) try { const { data }=await sb.from('aegis_shop_orders').update({ fulfilled:true, fulfilled_at:new Date().toISOString(), fulfilled_by:interaction.user.username }).eq('ref',ref).select('discord_id').single(); discordId=data?.discord_id; } catch {}
    if (discordId) try { const u=await interaction.client.users.fetch(discordId); await u.send({ embeds:[base('✅ Order Fulfilled!',C.gr).setDescription(`Your order **\`${ref}\`** has been fulfilled!\n📝 *${note}*`).setFooter(FT)] }); } catch {}
    return interaction.editReply({ embeds:[base('✅ Order Fulfilled',C.gr).addFields({name:'📋 Ref',value:`\`${ref}\``,inline:true},{name:'📝 Note',value:note,inline:false})] });
  },
};

// ── CLVSD (Admin Economy Suite) ──────────────────────────────────────
const clvsd = {
  data: new SlashCommandBuilder().setName('clvsd').setDescription('[Admin] 🛠️ Full economy admin suite')
    .addSubcommand(s=>s.setName('grant').setDescription('Grant shards').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')))
    .addSubcommand(s=>s.setName('deduct').setDescription('Deduct shards').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')))
    .addSubcommand(s=>s.setName('check').setDescription('Check balance').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)))
    .addSubcommand(s=>s.setName('set').setDescription('Set balance').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('New balance').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')))
    .addSubcommand(s=>s.setName('reset').setDescription('Reset wallet to 0').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')))
    .addSubcommand(s=>s.setName('top').setDescription('Top 15 holders'))
    .addSubcommand(s=>s.setName('stats').setDescription('Economy stats'))
    .addSubcommand(s=>s.setName('audit').setDescription('Recent ledger entries').addIntegerOption(o=>o.setName('limit').setDescription('Number').setMinValue(1).setMaxValue(50)))
    .addSubcommand(s=>s.setName('bulk-grant').setDescription('Grant to multiple users at once').addIntegerOption(o=>o.setName('amount').setDescription('Amount each').setRequired(true)).addUserOption(o=>o.setName('user1').setDescription('User 1').setRequired(true)).addUserOption(o=>o.setName('user2').setDescription('User 2')).addUserOption(o=>o.setName('user3').setDescription('User 3')).addUserOption(o=>o.setName('user4').setDescription('User 4')).addUserOption(o=>o.setName('user5').setDescription('User 5')).addStringOption(o=>o.setName('reason').setDescription('Reason')))
    .addSubcommand(s=>s.setName('digest').setDescription('7-day economy digest'))
    .addSubcommand(s=>s.setName('usage').setDescription('AI usage stats')),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admins only.');
    const sub=interaction.options.getSubcommand(), me=interaction.user;
    try {
      if (sub==='grant')  { const t=interaction.options.getUser('user'),a=interaction.options.getInteger('amount'),r=interaction.options.getString('reason')||''; const w=await econ.grant(t.id,t.username,a,r,me.id,me.username); return interaction.editReply({ embeds:[walletEmbed(`🎁 +${a} → ${t.username}`,w,C.gr)] }); }
      if (sub==='deduct') { const t=interaction.options.getUser('user'),a=interaction.options.getInteger('amount'),r=interaction.options.getString('reason')||''; const w=await econ.deduct(t.id,t.username,a,r,me.id,me.username); return interaction.editReply({ embeds:[walletEmbed(`⬇️ -${a} from ${t.username}`,w,C.rd)] }); }
      if (sub==='check')  { const t=interaction.options.getUser('user'); const w=await econ.getWallet(t.id,t.username); return interaction.editReply({ embeds:[walletEmbed(`🔍 ${t.username}'s Wallet`,w)] }); }
      if (sub==='set')    { const t=interaction.options.getUser('user'),a=interaction.options.getInteger('amount'),r=interaction.options.getString('reason')||'Admin set'; const w=await econ.setBalance(t.id,t.username,a,r,me.id,me.username); return interaction.editReply({ embeds:[walletEmbed(`🔧 Set ${t.username} to ${a} 💎`,w,C.cy)] }); }
      if (sub==='reset')  { const t=interaction.options.getUser('user'),r=interaction.options.getString('reason')||'Admin reset'; const w=await econ.resetWallet(t.id,t.username,me.id,me.username); return interaction.editReply({ embeds:[walletEmbed(`🔄 Reset ${t.username}'s wallet`,w,C.am)] }); }
      if (sub==='top')    { const lb=await econ.getLeaderboard(15); return interaction.editReply({ embeds:[base('🏆 Top 15 Holders',C.gold).setDescription(lb.map((w,i)=>`**${i+1}.** ${w.discord_tag||w.discord_id} · **${((w.wallet_balance||0)+(w.bank_balance||0)).toLocaleString()}**`).join('\n'))] }); }
      if (sub==='stats')  { const s=await econ.getSupply(); return interaction.editReply({ embeds:[base('📊 Economy Stats',C.cy).addFields({name:'💎 Wallet Total',value:s.walletTotal.toLocaleString(),inline:true},{name:'🏦 Bank Total',value:s.bankTotal.toLocaleString(),inline:true},{name:'📦 Grand Total',value:(s.walletTotal+s.bankTotal).toLocaleString(),inline:true},{name:'👥 Holders',value:`${s.holders}`,inline:true})] }); }
      if (sub==='bulk-grant') {
        const amount=interaction.options.getInteger('amount'), reason=interaction.options.getString('reason')||'Bulk grant';
        const users=[1,2,3,4,5].map(n=>interaction.options.getUser(`user${n}`)).filter(Boolean);
        const results=await econ.bulkGrant(users.map(u=>({id:u.id,tag:u.username})),amount,reason,me.id,me.username);
        return interaction.editReply({ embeds:[base(`🎁 Bulk Grant: +${amount} to ${users.length} users`,C.gr).setDescription(results.map(r=>r.success?`✅ **${r.tag}** → +${amount} 💎`:`❌ **${r.tag}** — ${r.error}`).join('\n'))] });
      }
      if (sub==='audit') {
        if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
        const limit=interaction.options.getInteger('limit')||10;
        const { data }=await sb.from('aegis_wallet_ledger').select('discord_id,action,amount,note,actor_tag,created_at').order('created_at',{ascending:false}).limit(limit);
        const lines=(data||[]).map(r=>`\`${r.action.padEnd(12)}\` **${r.amount>0?'+':''}${r.amount}** · <@${r.discord_id}> · *${r.note?.slice(0,40)||'—'}* · <t:${Math.floor(new Date(r.created_at).getTime()/1000)}:R>`).join('\n');
        return interaction.editReply({ embeds:[base('📋 Economy Audit Log',C.cy).setDescription(lines||'_No records._')] });
      }
      if (sub==='digest') {
        if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
        const since=new Date(Date.now()-7*24*60*60*1000).toISOString();
        const { data:ledger }=await sb.from('aegis_wallet_ledger').select('action,amount').gte('created_at',since);
        const grants=ledger?.filter(r=>r.action==='grant').reduce((s,r)=>s+(r.amount||0),0)||0;
        const deducts=ledger?.filter(r=>r.action==='deduct').reduce((s,r)=>s+(r.amount||0),0)||0;
        const lb=await econ.getLeaderboard(1);
        return interaction.editReply({ embeds:[base('📊 7-Day Economy Digest',C.gold).addFields({name:'💎 Granted',value:grants.toLocaleString(),inline:true},{name:'⬇️ Deducted',value:deducts.toLocaleString(),inline:true},{name:'🏆 Top Holder',value:lb[0]?.discord_tag||'N/A',inline:true})] });
      }
      if (sub==='usage') {
        if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
        const { data }=await sb.from('aegis_ai_usage').select('model,engine,input_tokens,output_tokens').order('created_at',{ascending:false}).limit(500);
        const total=data?.length||0, haiku=data?.filter(r=>r.engine==='anthropic').length||0, groqRows=data?.filter(r=>r.engine==='groq').length||0;
        const inp=data?.reduce((s,r)=>s+(r.input_tokens||0),0)||0, out=data?.reduce((s,r)=>s+(r.output_tokens||0),0)||0;
        return interaction.editReply({ embeds:[P.AiUsagePanel(total,haiku,groqRows,inp,out,(inp/1000*0.001)+(out/1000*0.005))] });
      }
    } catch(e) { return interaction.editReply(`⚠️ ${e.message}`); }
  },
};

module.exports = [wallet, weekly, leaderboard, streaks, give, shard, shop, order, fulfill, clvsd];
