// ═══════════════════════════════════════════════════════════════════════
// AEGIS ORIGIN PANELS — /origin command
// 10 cinematic embed panels posted with 4s delays
// The full founding story of TheConclave Dominion
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { EmbedBuilder } = require('discord.js');

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Panel definitions ────────────────────────────────────────────────
function buildPanels() {
  return [

    // ── PANEL 1 ──────────────────────────────────────────────────────
    new EmbedBuilder()
      .setColor(0x0a0a1a)
      .setTitle('🌌  T H E   S K Y   W I T H O U T   B E G I N N I N G')
      .setDescription([
        '```',
        ' ◈ P A N E L   0 1   /   1 0 ',
        '```',
        '',
        '> *An ARK sky. Infinite. Unchosen.*',
        '> *Clouds drift like continents that forgot their borders.*',
        '> *Stars sit unnaturally close — as though the system itself is leaning in.*',
        '',
        'Below: untouched wilderness.',
        'Forests breathing. Creatures moving without destination.',
        'Rivers running because rivers run — not because anyone built them.',
        '',
        '**No names. No structures. No claim to anything.**',
        '',
        '`────────────────────────────────`',
        '',
        '*The world did not wait for permission.*',
        '*It was already in motion before anyone arrived inside it.*',
        '',
        '**And yet —**',
        '',
        '*Something was already moving through it.*',
        '*Not a system. Not a server.*',
        '',
        '`⠀`',
        '> **People.**',
      ].join('\n'))
      .setFooter({ text: 'TheConclave Dominion · Origin Chronicle · Panel 01' })
      .setTimestamp(),

    // ── PANEL 2 ──────────────────────────────────────────────────────
    new EmbedBuilder()
      .setColor(0x0d1a1a)
      .setTitle('🤝  T H E   F I R S T   C O N N E C T I O N S')
      .setDescription([
        '```',
        ' ◈ P A N E L   0 2   /   1 0 ',
        '```',
        '',
        '> *Small bases appear at the edges of the map.*',
        '> *Each one alone. Each one building toward nothing in particular.*',
        '> *Survival had no direction yet.*',
        '',
        '`────────────────────────────────`',
        '',
        'They did not meet because they were meant to.',
        '',
        'They met because **the world forced overlap.**',
        '',
        '⠀⠀⠀🌾 A resource shared at a riverbank.',
        '⠀⠀⠀🔥 A fire that one person lit and another sat beside.',
        '⠀⠀⠀🤝 A moment of help that asked for nothing.',
        '⠀⠀⠀🚪 A decision — quiet, unremarkable — not to walk away.',
        '',
        '`────────────────────────────────`',
        '',
        'That decision was the beginning.',
        '',
        '*Not the server.*',
        '*Not the system.*',
        '',
        '**The decision not to walk away.**',
        '',
        '*And slowly… survival stopped being alone.*',
      ].join('\n'))
      .setFooter({ text: 'TheConclave Dominion · Origin Chronicle · Panel 02' })
      .setTimestamp(),

    // ── PANEL 3 ──────────────────────────────────────────────────────
    new EmbedBuilder()
      .setColor(0x1a0d2e)
      .setTitle('🧬  T H E   F O U N D I N G   S I X')
      .setDescription([
        '```',
        ' ◈ P A N E L   0 3   /   1 0 ',
        '```',
        '',
        '> *Paths began linking. Resources left at thresholds.*',
        '> *Dinos moved between tribes. Routes formed where no routes were designed.*',
        '> *Something was organizing itself without being told to.*',
        '',
        '`────────────────────────────────`',
        '',
        '**They were not chosen. Not assigned. Not built into the system.**',
        '',
        'They simply **remained close long enough**',
        'for survival to become structure.',
        '',
        '`────────────────────────────────`',
        '',
        '🧭 **Tw_** ⠀⠀ — *The path between everything. Never standing still.*',
        '🏗️ **Sandy** ⠀ — *Foundation. The one things were built on top of.*',
        '👁️ **Slothie** — *Silent awareness. Saw what others moved past.*',
        '⚙️ **Jenny** ⠀ — *The coordination link. Nothing connected without her.*',
        '🪨 **Anky** ⠀⠀ — *Structural force. The one who held weight without comment.*',
        '🕯️ **Hidden Pillars** — *Unseen support. There before anyone noticed.*',
        '',
        '`────────────────────────────────`',
        '',
        '*Between these six…*',
        '*something that had no name yet*',
        '**began forming.**',
      ].join('\n'))
      .setFooter({ text: 'TheConclave Dominion · Origin Chronicle · Panel 03' })
      .setTimestamp(),

    // ── PANEL 4 ──────────────────────────────────────────────────────
    new EmbedBuilder()
      .setColor(0x2e1a0d)
      .setTitle('⚠️  T H E   P R E S S U R E   S H I F T')
      .setDescription([
        '```',
        ' ◈ P A N E L   0 4   /   1 0 ',
        '```',
        '',
        '> *The lighting changes. Not dramatically. Not with a signal.*',
        '> *The world simply feels colder than it did before.*',
        '> *Something is applying weight to everything inside it.*',
        '',
        '`────────────────────────────────`',
        '',
        '**And then… the world changed.**',
        '',
        '⠀⠀⠀Not loudly.',
        '⠀⠀⠀Not violently.',
        '⠀⠀⠀**In pressure.**',
        '',
        'What once felt open → became **controlled.**',
        'What once felt shared → became **managed.**',
        'What once felt alive → began to feel **observed.**',
        '',
        '`────────────────────────────────`',
        '',
        '*Rules arrived that were not made by people inside the world.*',
        '*Systems were adjusted by people who did not live in them.*',
        '*The space between players and the game began filling with something else.*',
        '',
        '**Administration.**',
        '**Distance.**',
        '**The feeling that the world no longer belonged to the people inside it.**',
        '',
        '`────────────────────────────────`',
        '',
        '*The pressure was not a war.*',
        '*It was something quieter and harder to fight:*',
        '',
        '**The slow loss of ownership over what had been built.**',
      ].join('\n'))
      .setFooter({ text: 'TheConclave Dominion · Origin Chronicle · Panel 04' })
      .setTimestamp(),

    // ── PANEL 5 ──────────────────────────────────────────────────────
    new EmbedBuilder()
      .setColor(0x3a1a1a)
      .setTitle('🏗️  T H E   L A S T   S T A B I L I T Y')
      .setDescription([
        '```',
        ' ◈ P A N E L   0 5   /   1 0 ',
        '```',
        '',
        '> *Bases expanding. Emergency lines forming.*',
        '> *Not for conflict — for preservation.*',
        '> *They were not fighting anything. They were trying to hold something together.*',
        '',
        '`────────────────────────────────`',
        '',
        '**They didn\'t fight the world.**',
        '',
        'They tried to **stabilize it.**',
        '',
        '*To hold it long enough for it to breathe again.*',
        '*To keep the space between players from collapsing entirely.*',
        '',
        '`────────────────────────────────`',
        '',
        '**Even those running it were not treated as enemies.**',
        '',
        '*They were treated as players still inside the same world.*',
        '*Still capable of remembering what it felt like before the pressure.*',
        '',
        'The six tried to create something simple:',
        '',
        '⠀⠀⠀**A place where it could just be a game again.**',
        '',
        '⠀⠀⠀No pressure.',
        '⠀⠀⠀No control loops.',
        '⠀⠀⠀No system overriding experience.',
        '',
        '⠀⠀⠀**Just play.**',
        '',
        '`────────────────────────────────`',
        '',
        '***But intention is not structure.***',
        '***And structure is what the world was running out of.***',
      ].join('\n'))
      .setFooter({ text: 'TheConclave Dominion · Origin Chronicle · Panel 05' })
      .setTimestamp(),

    // ── PANEL 6 ──────────────────────────────────────────────────────
    new EmbedBuilder()
      .setColor(0x0a0a0a)
      .setTitle('🕳️  R E M O V A L   W I T H O U T   W A R')
      .setDescription([
        '```',
        ' ◈ P A N E L   0 6   /   1 0 ',
        '```',
        '',
        '> *Fully built bases. Still standing.*',
        '> *Torches burning at coordinates no one will return to.*',
        '> *Creatures idle at gates that will not open again.*',
        '> *Doors left ajar. Storage full. No one home.*',
        '',
        '`────────────────────────────────`',
        '',
        '**There was no collapse.**',
        '**No final fight.**',
        '**No ending with weight.**',
        '',
        '*Just —*',
        '',
        '⠀⠀⠀⠀⠀⠀⠀⠀**removal.**',
        '',
        '`────────────────────────────────`',
        '',
        '*A world continuing forward*',
        '*as if nothing inside it had ever mattered.*',
        '',
        '*As if the bases were never built.*',
        '*As if the fires were never lit.*',
        '*As if the six people who stayed the longest*',
        '*had simply never arrived.*',
        '',
        '`────────────────────────────────`',
        '',
        '*This is what silence feels like when it is applied from outside.*',
        '',
        '**Not the silence of peace.**',
        '**The silence of erasure.**',
      ].join('\n'))
      .setFooter({ text: 'TheConclave Dominion · Origin Chronicle · Panel 06' })
      .setTimestamp(),

    // ── PANEL 7 ──────────────────────────────────────────────────────
    new EmbedBuilder()
      .setColor(0x1a0a2e)
      .setTitle('💥  T H E   C O L L I S I O N   E V E N T')
      .setDescription([
        '```',
        ' ◈ P A N E L   0 7   /   1 0 ',
        '```',
        '',
        '> *Fragments of everything they built drift in negative space.*',
        '> *Names visible in the dark — not as memory but as architecture.*',
        '> *The pieces are not falling. They are being pulled.*',
        '> *Something is drawing all of it toward a single point.*',
        '',
        '`────────────────────────────────`',
        '',
        '**They did not scatter.**',
        '',
        '⠀⠀⠀**They converged.**',
        '',
        '`────────────────────────────────`',
        '',
        '*The Founding Six.*',
        '',
        '*Not survivors of a broken world —*',
        '',
        '**The foundation of a new one, formed from its remains.**',
        '',
        '`────────────────────────────────`',
        '',
        '🧭 Everything learned became **structure.**',
        '💔 Everything lost became **design.**',
        '🕯️ Everything remembered became **foundation.**',
        '⚡ Everything that failed became **instruction.**',
        '',
        '`────────────────────────────────`',
        '',
        '*The collision was not destruction.*',
        '',
        '**It was the moment compression became creation.**',
      ].join('\n'))
      .setFooter({ text: 'TheConclave Dominion · Origin Chronicle · Panel 07' })
      .setTimestamp(),

    // ── PANEL 8 ──────────────────────────────────────────────────────
    new EmbedBuilder()
      .setColor(0x7B2FFF)
      .setTitle('🏛️  T H E   C O N C L A V E   D O M I N I O N')
      .setDescription([
        '```',
        ' ◈ P A N E L   0 8   /   1 0 ',
        '```',
        '',
        '> *A network of worlds. Alive. Interconnected.*',
        '> *Bases spanning ten maps and every major platform.*',
        '> *Economy flowing. Community moving. Something finally stable.*',
        '',
        '`────────────────────────────────`',
        '',
        '**A crossplay ARK network built from persistence, memory, and structure.**',
        '',
        '⠀⠀⠀⠀⠀⠀🏛️ **T H E   C O N C L A V E   D O M I N I O N**',
        '',
        '`────────────────────────────────`',
        '',
        '🌍 **PvE CORE** — 9 persistent survival worlds across every terrain.',
        '⚔️ **PvP REALM** — Aberration. Controlled conflict. Real consequences.',
        '⭐ **AMISSA** — Elite-tier Patreon realm. Hidden from the casual eye.',
        '🌐 **CROSSPLAY** — Xbox · PlayStation · PC · Switch. All in the same world.',
        '',
        '`────────────────────────────────`',
        '',
        '> 5× XP · 5× Harvest · 5× Taming · 5× Breeding',
        '> Max Wild 350 · Tamed Cap 600 · Weight: 1,000,000',
        '> No Fall Damage · Full Mod Suite · Economy System',
        '',
        '`────────────────────────────────`',
        '',
        '**A world that does not reset what it remembers.**',
      ].join('\n'))
      .setFooter({ text: 'TheConclave Dominion · Origin Chronicle · Panel 08' })
      .setTimestamp(),

    // ── PANEL 9 ──────────────────────────────────────────────────────
    new EmbedBuilder()
      .setColor(0x00D4FF)
      .setTitle('🤖  S Y S T E M   C O R E   —   A E G I S')
      .setDescription([
        '```',
        ' ◈ P A N E L   0 9   /   1 0 ',
        '```',
        '',
        '> *The infrastructure behind the world becomes visible.*',
        '> *Economy systems. Live server monitors. Ticket pipelines.*',
        '> *A sovereign intelligence woven into every layer of the Dominion.*',
        '',
        '`────────────────────────────────`',
        '',
        '**Nothing here is accidental.**',
        '**Nothing here is temporary.**',
        '**Everything is structured. Everything is maintained. Everything evolves.**',
        '',
        '`────────────────────────────────`',
        '',
        '🤖 **AEGIS** — Automated Enforcement & Guild Intelligence System',
        '⠀⠀⠀— 80 slash commands across two clusters',
        '⠀⠀⠀— ClaveShard economy: wallet, bank, ledger, shop pipeline',
        '⠀⠀⠀— Live Nitrado server monitor across all 10 maps',
        '⠀⠀⠀— Private per-player ticket system with status tracking',
        '⠀⠀⠀— Trivia engine: 200 questions, 15,000 ConCoins per win',
        '⠀⠀⠀— AI backbone: Anthropic Haiku primary · Groq Llama fallback',
        '',
        '`────────────────────────────────`',
        '',
        '💻 **theconclavedominion.com** — live website, shop, map cluster pages',
        '🗄️ **Supabase** — persistent database across wallets, orders, tickets, tribes',
        '☁️ **Cloudflare Pages** — global CDN frontend delivery',
        '🚀 **Render** — bot + API always-on deployment',
        '',
        '`────────────────────────────────`',
        '',
        '*Solo-built. Solo-maintained.*',
        '**Still running.**',
      ].join('\n'))
      .setFooter({ text: 'TheConclave Dominion · Origin Chronicle · Panel 09' })
      .setTimestamp(),

    // ── PANEL 10 — FINAL ─────────────────────────────────────────────
    new EmbedBuilder()
      .setColor(0xFFB800)
      .setTitle('🌿  W H A T   R E M A I N S')
      .setDescription([
        '```',
        ' ◈ P A N E L   1 0   /   1 0   —   F I N A L',
        '```',
        '',
        '> *Stars aligning.*',
        '> *Empty space becoming ordered light.*',
        '> *Silence — but not the silence of erasure.*',
        '> *The silence of something that has found its shape.*',
        '',
        '`────────────────────────────────`',
        '',
        '**The Conclave Dominion was not created to be new.**',
        '',
        '*It was created because something old*',
        '*failed to hold what people built inside it.*',
        '',
        '*And from that failure —*',
        '',
        '*six travelers did not disappear.*',
        '',
        '**They became the foundation of something that still exists.**',
        '',
        '`────────────────────────────────`',
        '',
        '🌌 *"The Conclave Dominion is not a server.*',
        '*It is what remains when everything temporary falls away."*',
        '',
        '`────────────────────────────────`',
        '',
        '🏛️ **theconclavedominion.com**',
        '🎮 **Xbox · PlayStation · PC · Switch**',
        '◈ **5× Crossplay · 10 Maps · Always Online**',
        '',
        '`────────────────────────────────`',
        '',
        '*The Dominion remembers.*',
        '**Join it.**',
      ].join('\n'))
      .setFooter({ text: 'TheConclave Dominion · Origin Chronicle · End of Record' })
      .setTimestamp(),
  ];
}

// ── Main export — send all panels with cinematic delay ───────────────
async function sendOriginStory(channel, panelDelay = 4000) {
  const panels = buildPanels();
  for (let i = 0; i < panels.length; i++) {
    await channel.send({ embeds: [panels[i]] });
    if (i < panels.length - 1) {
      await new Promise(r => setTimeout(r, panelDelay));
    }
  }
}

module.exports = { sendOriginStory };
