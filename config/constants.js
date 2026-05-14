// ═══════════════════════════════════════════════════════════════════════
// config/constants.js — Shared constants for all command modules
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const C = {
  gold: 0xFFB800, pl: 0x7B2FFF, cy: 0x00D4FF,
  gr:   0x35ED7E, rd: 0xFF4500, pk: 0xFF4CD2, am: 0xFF8C00,
};

const FT = {
  text: 'TheConclave Dominion • 5× Crossplay • 10 Maps',
  iconURL: 'https://theconclavedominion.com/conclave-badge.png',
};

const MONITOR_SERVERS = [
  { id:'island',     name:'The Island',     nitradoId:18266152, emoji:'🌿', ip:'217.114.196.102', port:5390, pvp:false, patreon:false },
  { id:'volcano',    name:'Volcano',        nitradoId:18094678, emoji:'🌋', ip:'217.114.196.59',  port:5050, pvp:false, patreon:false },
  { id:'extinction', name:'Extinction',     nitradoId:18106633, emoji:'🌑', ip:'31.214.196.102',  port:6440, pvp:false, patreon:false },
  { id:'center',     name:'The Center',     nitradoId:18182839, emoji:'🏔️', ip:'31.214.163.71',   port:5120, pvp:false, patreon:false },
  { id:'lostcolony', name:'Lost Colony',    nitradoId:18307276, emoji:'🪐', ip:'217.114.196.104', port:5150, pvp:false, patreon:false },
  { id:'astraeos',   name:'Astraeos',       nitradoId:18393892, emoji:'✨', ip:'217.114.196.9',   port:5320, pvp:false, patreon:false },
  { id:'valguero',   name:'Valguero',       nitradoId:18509341, emoji:'🏞️', ip:'85.190.136.141',  port:5090, pvp:false, patreon:false },
  { id:'scorched',   name:'Scorched Earth', nitradoId:18598049, emoji:'☀️', ip:'217.114.196.103', port:5240, pvp:false, patreon:false },
  { id:'aberration', name:'Aberration',     nitradoId:18655529, emoji:'⚔️', ip:'217.114.196.80',  port:5540, pvp:true,  patreon:false },
  { id:'amissa',     name:'Amissa',         nitradoId:18680162, emoji:'⭐', ip:'217.114.196.80',  port:5180, pvp:false, patreon:true  },
];

const MAP_INFO = {
  island:     { name:'The Island',     emoji:'🌿', pvp:false, boss:'Overseer',  notes:'Starter map. Best for new players.' },
  volcano:    { name:'Volcano',        emoji:'🌋', pvp:false, boss:'None',      notes:'Custom map with volcanic terrain.' },
  extinction: { name:'Extinction',     emoji:'🌑', pvp:false, boss:'King Titan',notes:'Post-apocalyptic. Veins and element.' },
  center:     { name:'The Center',     emoji:'🏔️', pvp:false, boss:'Dragon/Brood',notes:'Giant floating island. Beautiful.' },
  lostcolony: { name:'Lost Colony',    emoji:'🪐', pvp:false, boss:'None',      notes:'Space-themed exploration map.' },
  astraeos:   { name:'Astraeos',       emoji:'✨', pvp:false, boss:'None',      notes:'Custom sci-fi terrain.' },
  valguero:   { name:'Valguero',       emoji:'🏞️', pvp:false, boss:'None',      notes:'Aberrant zone + surface. Great caves.' },
  scorched:   { name:'Scorched Earth', emoji:'☀️', pvp:false, boss:'Manticore', notes:'Desert survival. Heat/cold cycles.' },
  aberration: { name:'Aberration',     emoji:'⚔️', pvp:true,  boss:'Rockwell',  notes:'⚔️ PvP map. Underground only.' },
  amissa:     { name:'Amissa',         emoji:'⭐', pvp:false, boss:'None',      notes:'⭐ Patreon Elite exclusive.' },
};

const SHOP_TIERS = [
  { shards:1,  name:'Foundation Drop', emoji:'💠', items:['Level 600 allowed dino','3 stacks of ammo','Full dino coloring','100 kibble, cakes, or beer','100% imprint','500 non-Tek structures','Cryofridge + 120 cryopods','50,000 ConCoins','2,500 materials/resources','10 same-type tributes','Boss artifact + tribute set (1 run)','Non-Tek blueprint','Dino Revival Token — 48 hrs'] },
  { shards:2,  name:'Shiny Starter',   emoji:'💎', items:['60 Dedicated Storage','Level 700 allowed dino','Level 500 Random Shiny','Level 500 Shiny Shoulder Variant'] },
  { shards:3,  name:'Tek Spark',       emoji:'✨', items:['Tek Suit or Tek Blueprint','1 Shiny Essence','200% imprint','Level 600 T1 Shiny'] },
  { shards:5,  name:'Boss Spark',      emoji:'🔥', items:['Boss Defeat Command','Level 1000 allowed dino','Level 800 T2 Special Shiny','100 Raw Shiny Essence','2,500 imprint kibble','25,000 materials/resources'] },
  { shards:6,  name:'Boss Ready',      emoji:'⚔️', items:['Level 1250 Breeding Pair / Boss Dinos','250% imprint — Rex, Yuty, Carchar, or Therizino','300% imprint — Ossidion'] },
  { shards:8,  name:'Med Resources',   emoji:'🧬', items:['100,000 materials/resources','No element variants'] },
  { shards:10, name:'Dominion Upgrade',emoji:'🛡️', items:['Ascendant Tek Suit or Blueprint Set','Floating Cliff Platform','200,000 ConCoins','Combo Shiny Essence — choose 2','Dino Color Party — 10 dinos'] },
  { shards:12, name:'Large Resources', emoji:'🌟', items:['200,000 materials/resources','No element variants'] },
  { shards:15, name:'Crown Drop',      emoji:'👑', items:['30,000 element','Level 1500 Rhyniognatha','Level 1500 Reaper King','Level 1500 Aureliax','Level 1500 Elder Claw','Level 1500 Dreadnoughtus','Level 1500 Acrocanthosaurus','Level 1500 Helicoprion','Level 1500 Dreadmare','Level 1500 Pyromane','300,000 materials/resources'] },
  { shards:20, name:'Gate Expansion',  emoji:'🏰', items:['1×1 Behemoth Gate Expansion','Max 10 gates per map per tribe','600,000 ConCoins'] },
  { shards:30, name:'Dedicated Refill',emoji:'💰', items:['1.6 million total resources','No element variants','No structures, artifacts, or trophies'] },
  { shards:0,  name:'Dino Insurance',  emoji:'🛡️', items:['One-time use per named dino','Dino must be named first','Backup may not always save','May require respawn','Ticket-based request'] },
];

const isAdmin = (member) =>
  member?.permissions?.has('Administrator') ||
  member?.permissions?.has('ManageMessages') ||
  member?.roles?.cache?.has(process.env.ADMIN_ROLE_ID) ||
  member?.roles?.cache?.has(process.env.MOD_ROLE_ID);

const base = (title, color = C.pl) => {
  const { EmbedBuilder } = require('discord.js');
  return new EmbedBuilder().setTitle(title).setColor(color).setFooter(FT).setTimestamp();
};

module.exports = { C, FT, MONITOR_SERVERS, MAP_INFO, SHOP_TIERS, isAdmin, base };
