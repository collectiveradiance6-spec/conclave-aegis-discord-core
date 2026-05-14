// commands/ark/ark.js — All ARK/server/info commands
'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const P  = require('../../panels');
const { C, FT, MONITOR_SERVERS, MAP_INFO, isAdmin, base } = require('../../config/constants');
const { sb, sbOk } = require('../../services/supabase');

const ARK_TIPS = ['Always disable friendly fire before taming!','Keep a Cryopod ready — cryo your tames before danger.','Use the Spyglass mod to check dino stats BEFORE taming.','Build your first base near water and resources.','Boss arenas wipe your inventory — prepare a dedicated boss kit.','Upload your best tames to ARK Data before a wipe warning.','The Megatherium gets a 75% damage boost after killing bugs — great for Broodmother.','Flak armor gives the best overall protection for mid-game.','First torpor = tame ownership — verbal claims are not valid.','Always name your best dinos — it helps with Dino Insurance claims.','Rock Elementals take reduced damage from most weapons — use explosives.','Keep your tributes uploaded — bosses can be attempted anytime.'];

async function fetchNitrado(nitradoId) {
  if (!process.env.NITRADO_API_KEY) return null;
  try {
    const res=await axios.get(`https://api.nitrado.net/services/${nitradoId}/gameservers`,{headers:{Authorization:`Bearer ${process.env.NITRADO_API_KEY}`},timeout:10000});
    const gs=res.data?.data?.gameserver; if (!gs) return null;
    return {status:gs.status==='started'?'online':'offline',players:gs.query?.player_current??0,maxPlayers:gs.query?.player_max??20};
  } catch { return null; }
}

async function getStatuses() {
  if (!process.env.NITRADO_API_KEY) return MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20}));
  const results=[];
  await Promise.all(MONITOR_SERVERS.map(async srv=>{
    const data=await fetchNitrado(srv.nitradoId);
    results.push({...srv,status:data?.status??'unknown',players:data?.players??0,maxPlayers:data?.maxPlayers??20});
  }));
  return results;
}

const servers = {
  data: new SlashCommandBuilder().setName('servers').setDescription('🖥️ View live cluster status')
    .addStringOption(o=>o.setName('map').setDescription('Filter by map name')),
  async execute(interaction) {
    let svrs=await getStatuses().catch(()=>MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20})));
    const filter=interaction.options.getString('map');
    if (filter) svrs=svrs.filter(s=>s.name.toLowerCase().includes(filter.toLowerCase()));
    return interaction.editReply({ embeds:[P.ServerMonitorPanel(svrs)] });
  },
};

const map = {
  data: new SlashCommandBuilder().setName('map').setDescription('🗺️ Info about a specific cluster map')
    .addStringOption(o=>o.setName('name').setDescription('Map ID').setRequired(true).addChoices(...Object.entries(MAP_INFO).map(([k,v])=>({name:`${v.emoji} ${v.name}`,value:k})))),
  async execute(interaction) {
    const id=interaction.options.getString('name'), m=MAP_INFO[id];
    if (!m) return interaction.editReply('⚠️ Map not found.');
    return interaction.editReply({ embeds:[P.MapPanel(m)] });
  },
};

const monitor = {
  data: new SlashCommandBuilder().setName('monitor').setDescription('[Admin] 📡 Post live server monitor in a channel')
    .addChannelOption(o=>o.setName('channel').setDescription('Target channel').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const ch=interaction.options.getChannel('channel');
    const svrs=await getStatuses().catch(()=>MONITOR_SERVERS.map(s=>({...s,status:'unknown',players:0,maxPlayers:20})));
    const online=svrs.filter(s=>s.status==='online'), total=online.reduce((s,v)=>s+v.players,0);
    const lines=[...online.map(s=>`🟢 **${s.emoji} ${s.name}**${s.pvp?' ⚔️':s.patreon?' ⭐':''} \`${s.players}/${s.maxPlayers||20}\``), ...svrs.filter(s=>s.status!=='online').map(s=>`🔴 **${s.emoji} ${s.name}** · Offline`)].join('\n');
    const emb=new EmbedBuilder().setTitle('⚔️ TheConclave — Live Cluster Monitor').setColor(total>0?0x35ED7E:0xFF4500).setDescription(lines||'No data.').addFields({name:'🟢 Online',value:`${online.length}/${svrs.length}`,inline:true},{name:'👥 Players',value:`${total}`,inline:true},{name:'⏰ Updated',value:`<t:${Math.floor(Date.now()/1000)}:R>`,inline:true}).setFooter({text:'Auto-refreshes every 5 min',iconURL:FT.iconURL}).setTimestamp();
    await ch.send({embeds:[emb]});
    return interaction.editReply(`✅ Monitor posted in ${ch}.`);
  },
};

const rates = {
  data: new SlashCommandBuilder().setName('rates').setDescription('📈 View cluster boost rates'),
  async execute(interaction) {
    return interaction.editReply({ embeds:[base('📈 5× Boost Rates',C.gr).addFields({name:'⚡ Core',value:'XP: 5× · Harvest: 5× · Taming: 5× · Breeding: 5×',inline:false},{name:'🏋️ QoL',value:'Weight: 1,000,000 · No Fall Damage · Increased Stacks',inline:false},{name:'🥚 Breeding',value:'Egg Hatch: 50× · Mature: 50× · Cuddle: 0.025',inline:false},{name:'🦕 Creatures',value:'Max Wild: 350 · Tamed Cap: 600',inline:false})] });
  },
};

const mods = {
  data: new SlashCommandBuilder().setName('mods').setDescription('🔧 View active cluster mods'),
  async execute(interaction) {
    return interaction.editReply({ embeds:[base('🔧 Active Cluster Mods',C.cy).addFields({name:'Death Inventory Keeper',value:'Never lose your items on death.',inline:true},{name:'ARKomatic',value:'Quality-of-life improvements.',inline:true},{name:'Awesome Spyglass',value:'Advanced creature stats at a glance.',inline:true},{name:'Teleporter',value:'Fast travel between owned teleporters.',inline:true})] });
  },
};

const wipe = {
  data: new SlashCommandBuilder().setName('wipe').setDescription('📅 Check next wipe schedule'),
  async execute(interaction) {
    if (!sb||!sbOk()) return interaction.editReply({ embeds:[base('📅 Wipe Schedule',C.gold).setDescription('No wipe currently scheduled.\n\nWipes are announced **at least 2 weeks in advance**.')] });
    const { data }=await sb.from('aegis_wipe_schedule').select('*').eq('guild_id',interaction.guildId).order('wipe_date',{ascending:true}).limit(1);
    const w=data?.[0];
    if (!w) return interaction.editReply({ embeds:[base('📅 Wipe Schedule',C.gold).setDescription('No wipe currently scheduled.')] });
    const ts=Math.floor(new Date(w.wipe_date).getTime()/1000);
    return interaction.editReply({ embeds:[base('📅 Wipe Tracker',C.rd).setDescription(`**Next wipe:** <t:${ts}:F>\n**Countdown:** <t:${ts}:R>\n**Server:** ${w.server}\n**Set by:** ${w.created_by||'Council'}`)] });
  },
};

const setWipe = {
  data: new SlashCommandBuilder().setName('set-wipe').setDescription('[Admin] 📅 Set upcoming wipe date')
    .addStringOption(o=>o.setName('date').setDescription('Date (YYYY-MM-DD)').setRequired(true))
    .addStringOption(o=>o.setName('server').setDescription('Server/map').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const dateStr=interaction.options.getString('date'), server=interaction.options.getString('server'), reason=interaction.options.getString('reason')||'Scheduled wipe';
    const d=new Date(dateStr); if (isNaN(d)) return interaction.editReply('⚠️ Invalid date. Use YYYY-MM-DD.');
    if (sb&&sbOk()) await sb.from('aegis_wipe_schedule').insert({guild_id:interaction.guildId,server,wipe_date:d.toISOString(),created_by:interaction.user.username,created_at:new Date().toISOString()});
    return interaction.editReply({ embeds:[base('📅 Wipe Date Set',C.rd).setDescription(`**Date:** <t:${Math.floor(d.getTime()/1000)}:F>\n**Server:** ${server}\n**Reason:** ${reason}\n**Countdown:** <t:${Math.floor(d.getTime()/1000)}:R>`)] });
  },
};

const info = {
  data: new SlashCommandBuilder().setName('info').setDescription('ℹ️ TheConclave Dominion info'),
  async execute(interaction) { return interaction.editReply({ embeds:[P.InfoPanel()] }); },
};

const rules = {
  data: new SlashCommandBuilder().setName('rules').setDescription('📜 View server rules'),
  async execute(interaction) { return interaction.editReply({ embeds:[P.RulesPanel()] }); },
};

const council = {
  data: new SlashCommandBuilder().setName('council').setDescription('👑 Meet the Council'),
  async execute(interaction) { return interaction.editReply({ embeds:[P.CouncilPanel()] }); },
};

const patreon = {
  data: new SlashCommandBuilder().setName('patreon').setDescription('⭐ View Patreon perks'),
  async execute(interaction) {
    return interaction.editReply({ embeds:[base('⭐ Patreon Perks',C.gold).setDescription('Support at **patreon.com/theconclavedominion**').addFields({name:'🥉 Supporter',value:'Discord role · Supporter channels',inline:true},{name:'🥈 Champion',value:'All above',inline:true},{name:'🥇 Elite ($20/mo)',value:'All above + Bonus ClaveShards + **Amissa access** · Priority support',inline:true})] });
  },
};

const tip = {
  data: new SlashCommandBuilder().setName('tip').setDescription('💡 Random ARK survival tip'),
  async execute(interaction) {
    return interaction.editReply({ embeds:[P.TipPanel(ARK_TIPS[Math.floor(Math.random()*ARK_TIPS.length)])] });
  },
};

const transferGuide = {
  data: new SlashCommandBuilder().setName('transfer-guide').setDescription('🔄 Cross-server transfer guide'),
  async execute(interaction) {
    return interaction.editReply({ embeds:[base('🔄 Cross-ARK Transfer Guide',C.cy).addFields({name:'📤 Uploading',value:'Use any Obelisk, Terminal, or Loot Crate. Upload via ARK Data. Wait ~1 min before downloading.',inline:false},{name:'📥 Downloading',value:'Visit any Obelisk/Terminal on destination. Open ARK Data tab and retrieve.',inline:false},{name:'⚠️ Notes',value:'Items expire after 24 hours. Some boss items cannot transfer. Element restricted on some maps.',inline:false})] });
  },
};

const crossplay = {
  data: new SlashCommandBuilder().setName('crossplay').setDescription('🎮 Crossplay connection guide'),
  async execute(interaction) {
    return interaction.editReply({ embeds:[base('🎮 Crossplay Connection Guide',C.cy).addFields({name:'🎮 Xbox',value:'ARK SA → Multiplayer → Join via IP.',inline:false},{name:'🎮 PlayStation',value:'Same as Xbox — use the Join via IP option.',inline:false},{name:'💻 PC',value:'In ARK SA, go to Join Game → filter by "TheConclave" or paste the IP.',inline:false})] });
  },
};

const coords = {
  data: new SlashCommandBuilder().setName('coords').setDescription('📍 Share your coordinates')
    .addStringOption(o=>o.setName('location').setDescription('Coordinates or description').setRequired(true))
    .addStringOption(o=>o.setName('map').setDescription('Map name')),
  async execute(interaction) {
    const location=interaction.options.getString('location'), mapName=interaction.options.getString('map')||'Unknown';
    return interaction.editReply({ embeds:[base('📍 Coordinates Shared',C.cy).setDescription(`**${interaction.user.username}** shared a location:`).addFields({name:'📍 Location',value:location,inline:true},{name:'🗺️ Map',value:mapName,inline:true})] });
  },
};

module.exports = [servers,map,monitor,rates,mods,wipe,setWipe,info,rules,council,patreon,tip,transferGuide,crossplay,coords];
