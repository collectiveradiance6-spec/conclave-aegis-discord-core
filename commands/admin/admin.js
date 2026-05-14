// commands/admin/admin.js — Admin, utility, community commands
'use strict';

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const P  = require('../../panels');
const ai = require('../../services/aiService');
const { C, FT, isAdmin, base } = require('../../config/constants');
const { sb, sbOk, dbFire } = require('../../services/supabase');
const econ = require('../../services/economy');

// ── ANNOUNCE ──────────────────────────────────────────────────────────
const announce = {
  data: new SlashCommandBuilder().setName('announce').setDescription('[Admin] 📣 Post an announcement')
    .addStringOption(o=>o.setName('title').setDescription('Title').setRequired(true))
    .addStringOption(o=>o.setName('message').setDescription('Message').setRequired(true))
    .addBooleanOption(o=>o.setName('ping').setDescription('@everyone ping')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const title=interaction.options.getString('title'), message=interaction.options.getString('message'), ping=interaction.options.getBoolean('ping')??false;
    await interaction.channel.send({ content:ping?'@everyone':null, embeds:[P.AnnouncementPanel(title,message,interaction.user.username)] });
    return interaction.editReply('✅ Announcement posted.');
  },
};

// ── EVENT ─────────────────────────────────────────────────────────────
const event = {
  data: new SlashCommandBuilder().setName('event').setDescription('[Admin] 📅 Post a community event')
    .addStringOption(o=>o.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(o=>o.setName('description').setDescription('Event description').setRequired(true))
    .addStringOption(o=>o.setName('date').setDescription('Date/time string'))
    .addBooleanOption(o=>o.setName('ping').setDescription('@everyone ping')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const title=interaction.options.getString('title'), desc=interaction.options.getString('description'), date=interaction.options.getString('date')||'TBA', ping=interaction.options.getBoolean('ping')??false;
    await interaction.channel.send({ content:ping?'@everyone':null, embeds:[P.EventPanel(title,desc,date,interaction.user.username)] });
    return interaction.editReply('✅ Event announcement posted.');
  },
};

// ── GIVEAWAY ──────────────────────────────────────────────────────────
const activeGiveaways = new Map();
async function drawGiveaway(msgId, guildId, client) {
  const gw = activeGiveaways.get(msgId); if (!gw) return;
  activeGiveaways.delete(msgId);
  try {
    const ch = client.channels.cache.get(gw.channelId); if (!ch) return;
    const msg = await ch.messages.fetch(msgId).catch(()=>null); if (!msg) return;
    const entries = [...gw.entries];
    if (!entries.length) { await msg.edit({ embeds:[base('🎉 Giveaway Ended',C.gold).setDescription(`**Prize:** ${gw.prize}\n\nNo entries — no winners.`)], components:[] }); return; }
    const winners = [];
    const pool = [...entries];
    for (let i=0; i<Math.min(gw.winnersCount,pool.length); i++) {
      const idx=Math.floor(Math.random()*pool.length);
      winners.push(pool.splice(idx,1)[0]);
    }
    await msg.edit({ embeds:[P.GiveawayPanel(gw.prize,gw.winnersCount,gw.endTime,gw.hostName||'Council').setDescription(`**Winners:** ${winners.map(id=>`<@${id}>`).join(', ')}\n\n**Prize:** ${gw.prize}\n\nCongratulations! 🎊`)], components:[] });
    await ch.send({ content:`🎉 Congratulations ${winners.map(id=>`<@${id}>`).join(', ')}! You won **${gw.prize}**!` });
  } catch(e) { console.error('[Giveaway] Draw error:', e.message); }
}

const giveaway = {
  data: new SlashCommandBuilder().setName('giveaway').setDescription('[Admin] 🎉 Start a giveaway')
    .addStringOption(o=>o.setName('prize').setDescription('Prize').setRequired(true))
    .addIntegerOption(o=>o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1))
    .addIntegerOption(o=>o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(10))
    .addIntegerOption(o=>o.setName('shard-entry').setDescription('ClaveShard entry cost')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const prize=interaction.options.getString('prize'), duration=interaction.options.getInteger('duration'), winnersCount=interaction.options.getInteger('winners')||1, shardCost=interaction.options.getInteger('shard-entry')||0;
    const endTime=Date.now()+duration*60*1000;
    const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_enter').setLabel(`🎉 Enter${shardCost>0?` (${shardCost} 💎)`:''}`).setStyle(shardCost>0?ButtonStyle.Primary:ButtonStyle.Success));
    const gwEmb=P.GiveawayPanel(prize,winnersCount,endTime,interaction.user.username);
    const msg=await interaction.channel.send({ embeds:[gwEmb], components:[row] });
    // Update button with message ID for unique tracking
    const row2=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`giveaway_enter_${msg.id}`).setLabel(`🎉 Enter${shardCost>0?` (${shardCost} 💎)`:''}`).setStyle(shardCost>0?ButtonStyle.Primary:ButtonStyle.Success));
    await msg.edit({ components:[row2] });
    activeGiveaways.set(msg.id,{prize,entries:new Set(),endTime,channelId:interaction.channelId,winnersCount,shardCost,hostName:interaction.user.username});
    setTimeout(()=>drawGiveaway(msg.id,interaction.guildId,interaction.client),duration*60*1000);
    return interaction.editReply(`✅ Giveaway started! Ends <t:${Math.floor(endTime/1000)}:R>.`);
  },
};
giveaway.activeGiveaways = activeGiveaways;
giveaway.drawGiveaway = drawGiveaway;

const endgiveaway = {
  data: new SlashCommandBuilder().setName('endgiveaway').setDescription('[Admin] 🎉 Force-end a giveaway')
    .addStringOption(o=>o.setName('messageid').setDescription('Giveaway message ID').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const msgId=interaction.options.getString('messageid');
    if (!activeGiveaways.has(msgId)) return interaction.editReply('⚠️ No active giveaway with that ID.');
    await drawGiveaway(msgId,interaction.guildId,interaction.client);
    return interaction.editReply('✅ Giveaway ended.');
  },
};

// ── VOTE ─────────────────────────────────────────────────────────────
const vote = {
  data: new SlashCommandBuilder().setName('vote').setDescription('[Admin] 🗳️ Create a multi-option vote')
    .addStringOption(o=>o.setName('question').setDescription('Vote question').setRequired(true))
    .addStringOption(o=>o.setName('options').setDescription('Options separated by | (up to 4)').setRequired(true))
    .addIntegerOption(o=>o.setName('duration').setDescription('Duration in minutes').setMinValue(1)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const question=interaction.options.getString('question'), opts=interaction.options.getString('options').split('|').map(o=>o.trim()).filter(Boolean).slice(0,4), duration=interaction.options.getInteger('duration')||60;
    if (opts.length<2) return interaction.editReply('⚠️ Need at least 2 options separated by |');
    const endTime=Date.now()+duration*60*1000;
    const votes=new Map(opts.map((_,i)=>[i,new Set()]));
    const lines=opts.map((o,i)=>`**${i+1}.** ${o}\n\`${'░'.repeat(20)}\` **0%** (0 votes)`).join('\n\n');
    const msg=await interaction.editReply({ embeds:[base(`🗳️ ${question}`,C.cy).setDescription(lines+`\n\n> Ends <t:${Math.floor(endTime/1000)}:R>`)], fetchReply:true });
    const row=new ActionRowBuilder().addComponents(...opts.map((o,i)=>new ButtonBuilder().setCustomId(`vote_${msg.id}_${i}`).setLabel(`${i+1}. ${o.slice(0,40)}`).setStyle(ButtonStyle.Secondary)));
    await msg.edit({ components:[row] });
    setTimeout(async()=>{
      const totalVotes=[...votes.values()].reduce((s,v)=>s+v.size,0);
      const winner=[...votes.entries()].sort((a,b)=>b[1].size-a[1].size)[0];
      const finalLines=opts.map((o,i)=>{ const count=votes.get(i)?.size||0,pct=totalVotes?Math.round((count/totalVotes)*100):0; return `**${i+1}.** ${o}\n\`${'█'.repeat(Math.round(pct/5))}${'░'.repeat(20-Math.round(pct/5))}\` **${pct}%** (${count} votes)`; }).join('\n\n');
      try { await msg.edit({ embeds:[base(`🗳️ Vote Ended: ${question}`,C.gr).setDescription(finalLines+`\n\n> 🏆 **Winner:** ${opts[winner?.[0]??0]} (${winner?.[1]?.size||0} votes)`)], components:[] }); } catch {}
    }, duration*60*1000);
  },
};

// ── KNOWLEDGE ─────────────────────────────────────────────────────────
const know = {
  data: new SlashCommandBuilder().setName('know').setDescription('[Admin] 📚 Manage AEGIS knowledge base')
    .addSubcommand(s=>s.setName('add').setDescription('Add a knowledge entry').addStringOption(o=>o.setName('category').setDescription('Category').setRequired(true)).addStringOption(o=>o.setName('title').setDescription('Title').setRequired(true)).addStringOption(o=>o.setName('content').setDescription('Content').setRequired(true)))
    .addSubcommand(s=>s.setName('list').setDescription('List entries').addStringOption(o=>o.setName('category').setDescription('Filter by category')))
    .addSubcommand(s=>s.setName('delete').setDescription('Delete an entry').addStringOption(o=>o.setName('id').setDescription('Entry ID').setRequired(true))),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const sub=interaction.options.getSubcommand();
    if (sub==='add') {
      const { error }=await sb.from('aegis_knowledge').insert({guild_id:interaction.guildId,category:interaction.options.getString('category'),title:interaction.options.getString('title'),content:interaction.options.getString('content'),created_at:new Date().toISOString()});
      if (error) return interaction.editReply(`⚠️ ${error.message}`);
      return interaction.editReply('✅ Knowledge entry added.');
    }
    if (sub==='list') {
      const cat=interaction.options.getString('category');
      let q=sb.from('aegis_knowledge').select('id,category,title').order('category').limit(20);
      if (cat) q=q.ilike('category',`%${cat}%`);
      const { data }=await q;
      if (!data?.length) return interaction.editReply('📭 No entries found.');
      const lines=data.map(r=>`\`${r.id.slice(-8)}\` **[${r.category}]** ${r.title}`).join('\n');
      return interaction.editReply({ embeds:[base('📚 Knowledge Base',C.pl).setDescription(lines)] });
    }
    if (sub==='delete') {
      const { error }=await sb.from('aegis_knowledge').delete().eq('id',interaction.options.getString('id'));
      if (error) return interaction.editReply(`⚠️ ${error.message}`);
      return interaction.editReply('✅ Entry deleted.');
    }
  },
};

// ── PING ──────────────────────────────────────────────────────────────
const ping = {
  data: new SlashCommandBuilder().setName('ping').setDescription('🏓 AEGIS status and latency'),
  async execute(interaction) {
    const ws=interaction.client.ws.ping, uptime=process.uptime(), mem=Math.round(process.memoryUsage().heapUsed/1024/1024);
    return interaction.editReply({ embeds:[P.PingPanel(ws,uptime,mem,!!process.env.ANTHROPIC_API_KEY,!!process.env.GROQ_API_KEY,sbOk())] });
  },
};

// ── HELP ──────────────────────────────────────────────────────────────
const help = {
  data: new SlashCommandBuilder().setName('help').setDescription('📖 AEGIS command reference'),
  async execute(interaction) {
    return interaction.editReply({ embeds:[base('📖 AEGIS v13 Command Reference',C.pl).addFields(
      {name:'🤖 AI',       value:'`/aegis` `/forget` `/ai-cost` `/aegis-persona` `/summarize` `/compare` `/boss-guide` `/base-tips` `/dino`',inline:false},
      {name:'💎 Economy',  value:'`/wallet` `/weekly` `/streaks` `/leaderboard` `/give` `/shard` `/shop` `/order` `/fulfill` `/clvsd`',inline:false},
      {name:'🗺️ ARK',      value:'`/servers` `/map` `/monitor` `/rates` `/mods` `/wipe` `/set-wipe` `/info` `/rules` `/council` `/tip` `/transfer-guide` `/crossplay` `/patreon` `/coords`',inline:false},
      {name:'🎯 Fun',      value:'`/trivia` `/coinflip` `/roll` `/poll` `/rep` `/trade` `/concoin-booty` `/concoin-leaderboard` `/deposit-concoins`',inline:false},
      {name:'🔨 Mod',      value:'`/warn` `/warn-history` `/warn-clear` `/ban` `/timeout` `/purge` `/lock` `/slowmode` `/role` `/modlog` `/report`',inline:false},
      {name:'⚙️ Admin',    value:'`/announce` `/event` `/giveaway` `/endgiveaway` `/vote` `/know` `/setup-aegis`',inline:false},
      {name:'🔧 Utility',  value:'`/ping` `/help` `/calc` `/whois` `/serverinfo` `/profile` `/rank` `/tribe` `/remind`',inline:false},
    ).setFooter({...FT,text:'AEGIS v13.0 Sovereign Platform Edition'})] });
  },
};

// ── CALC ──────────────────────────────────────────────────────────────
const calc = {
  data: new SlashCommandBuilder().setName('calc').setDescription('🔢 Calculator')
    .addStringOption(o=>o.setName('expression').setDescription('Math expression (e.g. 100*5+200)').setRequired(true)),
  async execute(interaction) {
    const expr = interaction.options.getString('expression').replace(/[^0-9+\-*/().% ]/g,'');
    try { const result=Function(`'use strict';return(${expr})`)(); return interaction.editReply({ embeds:[base('🔢 Calculator',C.cy).addFields({name:'Expression',value:`\`${expr}\``,inline:true},{name:'Result',value:`**${result}**`,inline:true})] }); }
    catch { return interaction.editReply('⚠️ Invalid expression.'); }
  },
};

// ── WHOIS ─────────────────────────────────────────────────────────────
const whois = {
  data: new SlashCommandBuilder().setName('whois').setDescription('🔍 Look up a Discord member')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)),
  async execute(interaction) {
    const target=interaction.options.getUser('user'), member=interaction.guild.members.cache.get(target.id);
    return interaction.editReply({ embeds:[base(`🔍 ${target.username}`,C.cy).setThumbnail(target.displayAvatarURL({size:128})).addFields({name:'🆔 ID',value:target.id,inline:true},{name:'📅 Created',value:`<t:${Math.floor(target.createdAt.getTime()/1000)}:D>`,inline:true},{name:'🎭 Joined',value:member?.joinedAt?`<t:${Math.floor(member.joinedAt.getTime()/1000)}:D>`:'Not in server',inline:true},{name:'🎨 Roles',value:member?.roles.cache.filter(r=>r.name!=='@everyone').map(r=>`<@&${r.id}>`).join(' ')||'None',inline:false})] });
  },
};

// ── SERVERINFO ────────────────────────────────────────────────────────
const serverinfo = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('📊 View server information'),
  async execute(interaction) {
    const g=interaction.guild;
    return interaction.editReply({ embeds:[P.StatsPanel(g,g.memberCount,Math.round(g.memberCount*0.3),g.channels.cache.size,g.roles.cache.size,g.premiumSubscriptionCount||0)] });
  },
};

// ── PROFILE ───────────────────────────────────────────────────────────
const profile = {
  data: new SlashCommandBuilder().setName('profile').setDescription('🎖️ View a player profile')
    .addUserOption(o=>o.setName('user').setDescription('Target')),
  async execute(interaction) {
    const target=interaction.options.getUser('user')||interaction.user, member=interaction.guild.members.cache.get(target.id);
    const w=sb&&sbOk()?await econ.getWallet(target.id,target.username).catch(()=>null):null;
    const emb=base(`🎖️ ${target.username}'s Profile`,C.pl).setThumbnail(target.displayAvatarURL({size:128})).addFields({name:'🎭 Joined',value:member?.joinedAt?`<t:${Math.floor(member.joinedAt.getTime()/1000)}:D>`:'Unknown',inline:true},{name:'📅 Discord Since',value:`<t:${Math.floor(target.createdAt.getTime()/1000)}:D>`,inline:true});
    if (w) emb.addFields({name:'💎 ClaveShards',value:`${(w.wallet_balance||0).toLocaleString()} wallet · ${(w.bank_balance||0).toLocaleString()} bank`,inline:false},{name:'🔥 Streak',value:`Week ${w.daily_streak||0}`,inline:true},{name:'📈 Lifetime',value:`${(w.lifetime_earned||0).toLocaleString()} earned`,inline:true});
    return interaction.editReply({ embeds:[emb] });
  },
};

// ── RANK ──────────────────────────────────────────────────────────────
const rank = {
  data: new SlashCommandBuilder().setName('rank').setDescription('📊 Your ClaveShard rank'),
  async execute(interaction) {
    try { const lb=await econ.getLeaderboard(100), pos=lb.findIndex(w=>w.discord_id===interaction.user.id)+1, w=lb.find(w=>w.discord_id===interaction.user.id); if (!w) return interaction.editReply({ embeds:[base('📊 Your Rank',C.cy).setDescription('No wallet found. Use `/weekly` to claim your first shards!')] }); return interaction.editReply({ embeds:[base(`📊 ${interaction.user.username}'s Rank`,C.cy).addFields({name:'🏆 Rank',value:pos?`#${pos} of ${lb.length}`:'>100',inline:true},{name:'💎 Wallet',value:`${(w.wallet_balance||0).toLocaleString()}`,inline:true})] }); }
    catch { return interaction.editReply({ embeds:[base('📊 Rank',C.cy).setDescription('_Rank unavailable._')] }); }
  },
};

// ── TRIBE ────────────────────────────────────────────────────────────
const tribe = {
  data: new SlashCommandBuilder().setName('tribe').setDescription('🏕️ Tribe registry')
    .addSubcommand(s=>s.setName('register').setDescription('Register your tribe').addStringOption(o=>o.setName('name').setDescription('Tribe name').setRequired(true)).addStringOption(o=>o.setName('server').setDescription('Server').setRequired(true)).addStringOption(o=>o.setName('members').setDescription('Members (comma-separated names)')))
    .addSubcommand(s=>s.setName('lookup').setDescription('Look up a tribe').addStringOption(o=>o.setName('query').setDescription('Tribe name or leader').setRequired(true)))
    .addSubcommand(s=>s.setName('my').setDescription('View your tribe')),
  async execute(interaction) {
    if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const sub=interaction.options.getSubcommand();
    if (sub==='register') {
      const name=interaction.options.getString('name'), server=interaction.options.getString('server'), membersRaw=interaction.options.getString('members')||'', members=membersRaw.split(',').map(m=>m.trim()).filter(Boolean);
      const { error }=await sb.from('aegis_tribes').upsert({guild_id:interaction.guildId,name,leader_id:interaction.user.id,members,created_at:new Date().toISOString()},{onConflict:'guild_id,leader_id'});
      if (error) return interaction.editReply(`⚠️ ${error.message}`);
      return interaction.editReply({ embeds:[base('🏕️ Tribe Registered',C.gr).addFields({name:'🏕️ Tribe',value:name,inline:true},{name:'🗺️ Server',value:server,inline:true},{name:'👥 Members',value:members.length?members.join(', '):'Just you',inline:false})] });
    }
    if (sub==='lookup') {
      const query=interaction.options.getString('query');
      const { data }=await sb.from('aegis_tribes').select('name,leader_id,members').eq('guild_id',interaction.guildId).ilike('name',`%${query}%`).limit(5);
      if (!data?.length) return interaction.editReply(`📭 No tribe found matching **${query}**.`);
      return interaction.editReply({ embeds:[base(`🔍 Tribe Lookup: ${query}`,C.cy).setDescription(data.map(t=>`**${t.name}** · Owner: <@${t.leader_id}>`).join('\n'))] });
    }
    if (sub==='my') {
      const { data }=await sb.from('aegis_tribes').select('*').eq('guild_id',interaction.guildId).eq('leader_id',interaction.user.id).single().catch(()=>({data:null}));
      if (!data) return interaction.editReply('📭 No registered tribe. Use `/tribe register` to create one.');
      return interaction.editReply({ embeds:[base(`🏕️ ${data.name}`,C.cy).addFields({name:'👥 Members',value:(data.members||[]).join(', ')||'Just you',inline:false})] });
    }
  },
};

// ── REMIND ────────────────────────────────────────────────────────────
const remind = {
  data: new SlashCommandBuilder().setName('remind').setDescription('⏰ Set a reminder')
    .addStringOption(o=>o.setName('message').setDescription('What to remind you about').setRequired(true))
    .addIntegerOption(o=>o.setName('minutes').setDescription('Minutes from now').setRequired(true).setMinValue(1).setMaxValue(1440)),
  async execute(interaction) {
    const message=interaction.options.getString('message'), minutes=interaction.options.getInteger('minutes');
    const fireAt=Date.now()+minutes*60*1000;
    return interaction.editReply({ embeds:[P.ReminderSetPanel(message,Math.floor(fireAt/1000))] }).then(async ()=>{
      setTimeout(async ()=>{
        try { const u=await interaction.client.users.fetch(interaction.user.id); await u.send({ embeds:[P.ReminderFirePanel(message)] }); } catch {}
      }, minutes*60*1000);
    });
  },
};

// ── SETUP TICKETS ────────────────────────────────────────────────────
const setupTickets = {
  data: new SlashCommandBuilder().setName('setup-tickets').setDescription('[Admin] 🎫 Post ticket panel in current channel')
    .addStringOption(o=>o.setName('type').setDescription('Panel type').setRequired(true).addChoices({name:'Support',value:'support'},{name:'Starter Kit',value:'starterkit'},{name:'ClaveShard Shop',value:'claveshard'},{name:'Base Watch',value:'basewatch'})),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const type=interaction.options.getString('type');
    const configs = {
      support:    { color:0x00D4FF, title:'TheConclave Support',     btnId:'tkt_support',    btnLabel:'🛡️ Open Support Ticket',  btnStyle:ButtonStyle.Primary },
      starterkit: { color:0x35ED7E, title:'Starter Kit Request',     btnId:'tkt_starterkit', btnLabel:'🎁 Request Starter Kit',   btnStyle:ButtonStyle.Success },
      claveshard: { color:0xFF4CD2, title:'📚 ClaveShard Shop 👀',   btnId:'tkt_claveshard', btnLabel:'📚 Open Shop Ticket 👀',  btnStyle:ButtonStyle.Primary },
      basewatch:  { color:0x7B2FFF, title:'🛡️ AEGIS Base Watch 🛡️', btnId:'tkt_basewatch',  btnLabel:'🛡️ Request Base Watch',  btnStyle:ButtonStyle.Danger  },
    };
    const cfg=configs[type];
    const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(cfg.btnId).setLabel(cfg.btnLabel).setStyle(cfg.btnStyle));
    await interaction.channel.send({ embeds:[base(cfg.title,cfg.color).setDescription('Click the button below to open a private ticket with the Council.')], components:[row] });
    return interaction.editReply('✅ Ticket panel posted.');
  },
};

module.exports = [announce,event,giveaway,endgiveaway,vote,know,ping,help,calc,whois,serverinfo,profile,rank,tribe,remind,setupTickets];
