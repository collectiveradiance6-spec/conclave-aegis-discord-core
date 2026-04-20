// ═══════════════════════════════════════════════════════════════════════
// CONCLAVE AEGIS — CLAVESHARD TIER DATA v3 (patch into bot.js)
// Replace the existing SHARD_TIERS / cmd 'shard' handler in bot.js
// ═══════════════════════════════════════════════════════════════════════

// ─── AUTHORITATIVE TIER DATA ──────────────────────────────────────────
const SHARD_TIERS = [
  {
    cost: 1, emoji: '💠', name: 'Tier 1',
    items: [
      'Level 600 Vanilla Dino (Tameable)',
      'Max XP',
      '3 Stacks Ammo',
      'Full Dino Coloring',
      '100 Kibble / Cakes / Beer',
      '100% Imprint',
      '500 Non-Tek Structures',
      'Cryofridge + 120 Pods',
      '50,000 Echo Coins',
      '2,500 Materials',
      '10 Same-Type Tributes',
      'Boss Artifact + Tribute (1 Run)',
      'Non-Tek Blueprint',
      'Dino Revival Token (48hr limit)',
    ],
  },
  {
    cost: 2, emoji: '💎', name: 'Tier 2',
    items: [
      'Modded Level 600 Dino',
      '60 Dedicated Storage',
      'Level 600 Yeti',
      'Level 600 Polar Bear',
      '450 Random Shiny',
      'Random Shiny Shoulder Variant',
    ],
  },
  {
    cost: 3, emoji: '✨', name: 'Tier 3',
    items: [
      'Tek Blueprint',
      '1 Shiny Essence',
      '200% Imprint',
      '450 T1 Special Shiny',
    ],
  },
  {
    cost: 5, emoji: '🔥', name: 'Tier 5',
    items: [
      'Boss Defeat Command',
      'Bronto or Dread + Saddle',
      'Astral Dino',
      'Level 1000 Basilisk',
      'Level 1000 Rock Elemental',
      'Level 1000 Karkinos',
      '50 Raw Shiny Essence',
      '450 T2 Special Shiny',
      'Small Resource Bundle',
      '2,500 Imprint Kibble',
    ],
  },
  {
    cost: 6, emoji: '⚔️', name: 'Tier 6',
    items: [
      'Boss Ready Dino Bundle',
      '300% Imprint',
      'Max XP',
    ],
  },
  {
    cost: 8, emoji: '🌌', name: 'Tier 8',
    items: [
      'Medium Resource Bundle',
      '100,000 Resources (No Element)',
    ],
  },
  {
    cost: 10, emoji: '🛡️', name: 'Tier 10',
    items: [
      'Tek Suit Blueprint Set',
      'Floating Platform',
      'Combo Shinies',
      'Dino Color Party',
      'Breeding Pair',
    ],
  },
  {
    cost: 12, emoji: '🌠', name: 'Tier 12',
    items: [
      'Large Resource Bundle',
      '200,000 Resources',
    ],
  },
  {
    cost: 15, emoji: '👑', name: 'Tier 15',
    items: [
      '30,000 Element',
      'Level 900 Rhyniognatha',
      'Reaper',
      'Aureliax',
      'XLarge Bundle (300,000 Resources)',
    ],
  },
  {
    cost: 20, emoji: '🏰', name: 'Tier 20',
    items: [
      '1×1 Behemoth Gate Expansion (10 max)',
    ],
  },
  {
    cost: 30, emoji: '💰', name: 'Tier 30',
    items: [
      '2 Dedicated Storage Admin Refill',
      '1,600,000 Total Resources',
    ],
  },
  {
    cost: null, emoji: '🛡️', name: 'Dino Insurance',
    items: [
      'One Time Use',
      'Dino Must Be Named',
      'Backup May Not Save',
      'May Require Respawn',
      'One Time Per Dino',
    ],
  },
];

// ─── /shard COMMAND HANDLER (replace existing in bot.js) ─────────────
// if (cmd === 'shard') {
//   return i.editReply({ embeds: buildShardEmbeds() });
// }

function buildShardEmbeds() {
  const C = { gold:0xFFB800, pl:0x7B2FFF, cy:0x00D4FF };
  const FT = { text:'TheConclave Dominion • ClaveShard Shop', iconURL:'https://theconclavedominion.com/conclave-badge.png' };

  // Main overview embed
  const overview = new EmbedBuilder()
    .setColor(C.gold)
    .setTitle('💠 ClaveShard Shop — All Tiers')
    .setDescription([
      'Purchase in-game packages from the **Council**.',
      'Orders fulfilled within **24–72 hours**.',
      '',
      '**💳 Payment Methods**',
      '> CashApp: `$TheConclaveDominion`',
      '> Chime: `$ANLIKESEF`',
      '',
      'Include your **Discord username + tier** in the payment note.',
      'Then use `/order` to submit your request.',
      '',
      '> *All sales are final. Dino Insurance is one-time use per dino.*',
    ].join('\n'))
    .addFields(
      { name:'📦 How to Order', value:'1. Pay via CashApp/Chime\n2. Run `/order` in Discord\n3. Council fulfills within 24–72h', inline:false },
      { name:'🔗 Full Shop', value:'[theconclavedominion.com/shop.html](https://theconclavedominion.com/shop.html)', inline:true },
    )
    .setFooter(FT)
    .setTimestamp();

  // Build per-tier fields across two embeds (Discord limit 25 fields)
  const tierEmbed1 = new EmbedBuilder().setColor(C.pl).setTitle('💠 Tiers 1–8').setFooter(FT);
  const tierEmbed2 = new EmbedBuilder().setColor(C.cy).setTitle('🛡️ Tiers 10–30 + Insurance').setFooter(FT);

  const lowTiers  = SHARD_TIERS.filter(t=>t.cost!==null&&t.cost<=8);
  const highTiers = SHARD_TIERS.filter(t=>t.cost===null||t.cost>=10);

  lowTiers.forEach(t=>{
    tierEmbed1.addFields({
      name:  `${t.emoji} ${t.name} · ${t.cost} CLVSD`,
      value: t.items.map(x=>`• ${x}`).join('\n').slice(0,1020),
      inline: false,
    });
  });

  highTiers.forEach(t=>{
    tierEmbed2.addFields({
      name:  `${t.emoji} ${t.name}${t.cost!==null?` · ${t.cost} CLVSD`:''}`,
      value: t.items.map(x=>`• ${x}`).join('\n').slice(0,1020),
      inline: false,
    });
  });

  return [overview, tierEmbed1, tierEmbed2];
}

// ─── REPLACE in bot.js — find: if (cmd === 'shard') ──────────────────
// Replace with:
/*
if (cmd === 'shard') {
  const embeds = buildShardEmbeds();
  return i.editReply({ embeds });
}
*/

// Also update CORE system prompt shard section in bot.js:
const SHARD_SYSTEM_CONTEXT = `
CLAVESHARD TIERS (authoritative):
T1(1 CLVSD): L600 Vanilla Dino · Max XP · 3 Stacks Ammo · Full Dino Coloring · 100 Kibble/Cakes/Beer · 100% Imprint · 500 Non-Tek Structures · Cryofridge+120 Pods · 50k Echo Coins · 2500 Materials · 10 Same-Type Tributes · Boss Artifact+Tribute · Non-Tek Blueprint · Dino Revival Token 48hr
T2(2 CLVSD): Modded L600 Dino · 60 Dedicated Storage · L600 Yeti · L600 Polar Bear · 450 Random Shiny · Random Shiny Shoulder Variant
T3(3 CLVSD): Tek Blueprint · 1 Shiny Essence · 200% Imprint · 450 T1 Special Shiny
T5(5 CLVSD): Boss Defeat Command · Bronto/Dread+Saddle · Astral Dino · L1000 Basilisk · L1000 Rock Elemental · L1000 Karkinos · 50 Raw Shiny Essence · 450 T2 Special Shiny · Small Resource Bundle · 2500 Imprint Kibble
T6(6 CLVSD): Boss Ready Dino Bundle · 300% Imprint · Max XP
T8(8 CLVSD): Medium Resource Bundle · 100,000 Resources (No Element)
T10(10 CLVSD): Tek Suit Blueprint Set · Floating Platform · Combo Shinies · Dino Color Party · Breeding Pair
T12(12 CLVSD): Large Resource Bundle · 200,000 Resources
T15(15 CLVSD): 30,000 Element · L900 Rhyniognatha · Reaper · Aureliax · XLarge Bundle 300k Resources
T20(20 CLVSD): 1x1 Behemoth Gate Expansion (10 max)
T30(30 CLVSD): 2 Dedicated Storage Admin Refill · 1.6 Million Total Resources
Dino Insurance: One-time use · Must be named · Backup may not save · May require respawn · One time per dino
Payment: CashApp $TheConclaveDominion · Chime $ANLIKESEF
`;

module.exports = { SHARD_TIERS, buildShardEmbeds, SHARD_SYSTEM_CONTEXT };
