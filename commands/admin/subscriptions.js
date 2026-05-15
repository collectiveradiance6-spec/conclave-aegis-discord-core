// commands/admin/subscriptions.js
// /sub-tiers  — display all 6 Discord subscription tiers
// /sub-check  — member checklist for received monthly items
// /sub-status — admin view of member's tier + checklist status
'use strict';

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, PermissionFlagsBits,
} = require('discord.js');
const { isAdmin, base, C, FT } = require('../../config/constants');
const { sb, sbOk, dbFire } = require('../../services/supabase');

// ── TIER DEFINITIONS ──────────────────────────────────────────────────
const TIERS = [
  {
    id: 'tribune', name: 'TRIBUNE', tier: 'I',
    price: 5, emoji: '🜂', color: 0x00D4FF,
    tagline: 'Begin your rise within the Dominion.',
    desc: 'Tribunes gain access to the Donator Map, exclusive supporter channels, and rotating community perks while helping sustain the future of Conclave servers and events.',
    items: [
      'Access to the Donator Map',
      '1 Random Chibi',
      'Supporter-only channels',
      'Community supporter status',
    ],
  },
  {
    id: 'warlord', name: 'WARLORD', tier: 'II',
    price: 10, emoji: '⚔', color: 0xFF4500,
    tagline: 'Warlords stand above the frontline.',
    desc: 'Unlock stronger rewards, premium creature access, and expanded donor privileges across the Dominion ecosystem.',
    items: [
      '2 Chibis of your choice',
      '2 Mystery Gifts',
      '1 Shiny Essence of your choice (once excluded)',
      'Access to the Donator Map',
      'All previous tier benefits',
    ],
  },
  {
    id: 'sovereign', name: 'SOVEREIGN', tier: 'III',
    price: 15, emoji: '👑', color: 0xFFB800,
    tagline: 'Sovereigns command influence across the Dominion.',
    desc: 'Designed for dedicated supporters seeking elite progression, stronger rewards, and advanced access to premium ARK content.',
    items: [
      'Sovereign Loot Crate',
      '2× temporary boosted breeding creatures',
      '1 Base or Special Chibi of your choice',
      'Level 800 breeding pair of your choice',
      '2 Shiny Essences of your choice',
      'Access to the Donator Map',
      'All previous tier benefits',
    ],
  },
  {
    id: 'imperial', name: 'IMPERIAL', tier: 'IV',
    price: 20, emoji: '💠', color: 0x7B2FFF,
    tagline: 'The highest rank within the Conclave Dominion.',
    desc: 'Imperials gain priority access to premium rewards, elite creature packages, and exclusive Dominion privileges reserved for top supporters.',
    items: [
      'Bonus 20 ClaveShards',
      '2× temporary boosted creatures',
      '1 Base or Special Chibi of your choice',
      'Sovereign Loot Crate',
      'Level 800 breeding pair of your choice',
      '2 Shiny Essences of your choice',
      'Access to the Donator Map',
      'Priority supporter status',
      'All previous tier benefits',
    ],
  },
  {
    id: 'archon', name: 'ARCHON', tier: 'V',
    price: 50, emoji: '🜏', color: 0xFF4CD2,
    tagline: 'The ruling elite of the Conclave Dominion.',
    desc: 'ARCHONS are long-term high-command supporters who gain expanded privileges, elevated recognition, and enhanced access across the Dominion ecosystem.',
    items: [
      'EVERYTHING from 💠 IMPERIAL Tier',
      'Bonus 20 ClaveShards',
      'Exclusive ARCHON role',
      'Custom Discord Nickname Change',
      'Priority support handling',
      'Expanded premium creature privileges',
      'Exclusive supporter recognition',
      'Access to ARCHON-only channels & events',
      'All previous tier benefits',
    ],
  },
  {
    id: 'overseer', name: 'OVERSEER', tier: 'VI',
    price: 80, emoji: '☠️', color: 0x35ED7E,
    tagline: 'Reserved for the highest level supporters.',
    desc: 'OVERSEERS gain elevated Dominion privileges, restricted administrative utility access, advanced community interaction controls, and elite supporter recognition.',
    items: [
      'EVERYTHING from 🜏 ARCHON Tier',
      'Bonus 20 ClaveShards',
      'Access to restricted in-game admin state',
      'Special voice party controls',
      'Elevated event participation privileges',
      'Highest supporter priority status',
      'Exclusive OVERSEER role',
      'Expanded seasonal reward access',
      'Elite Dominion recognition',
      'All previous tier benefits',
    ],
  },
];

// ── /sub-tiers — Display all tiers ───────────────────────────────────
const subTiers = {
  data: new SlashCommandBuilder()
    .setName('sub-tiers')
    .setDescription('👑 View all Discord subscription tiers and their benefits'),

  async execute(interaction) {
    // Overview embed
    const overview = new EmbedBuilder()
      .setColor(0x7B2FFF)
      .setTitle('👑 TheConclave Dominion — Supporter Tiers')
      .setDescription([
        '**Support the Dominion. Claim your rewards monthly.**',
        '',
        'Subscribe via the Discord Shop below this channel or at the server shop.',
        'Use `/sub-check` to mark which rewards you\'ve received this month.',
        '',
        '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      ].join('\n'))
      .addFields(
        TIERS.map(t => ({
          name: `${t.emoji} **${t.name}** — Tier ${t.tier} · $${t.price}/mo`,
          value: t.items.slice(0, 4).map(i => `• ${i}`).join('\n') + (t.items.length > 4 ? `\n*+ ${t.items.length - 4} more...*` : ''),
          inline: true,
        }))
      )
      .setFooter({ ...FT, text: 'Use /sub-check to track your monthly rewards · AEGIS Subscription System' })
      .setTimestamp();

    return interaction.editReply({ embeds: [overview] });
  },
};

// ── /sub-info — Detailed single tier view ─────────────────────────────
const subInfo = {
  data: new SlashCommandBuilder()
    .setName('sub-info')
    .setDescription('💠 View detailed info for a specific subscription tier')
    .addStringOption(o => o.setName('tier').setDescription('Tier to view').setRequired(true)
      .addChoices(...TIERS.map(t => ({ name: `${t.emoji} ${t.name} — $${t.price}/mo`, value: t.id })))),

  async execute(interaction) {
    const tierId = interaction.options.getString('tier');
    const t = TIERS.find(t => t.id === tierId);
    if (!t) return interaction.editReply('⚠️ Tier not found.');

    const emb = new EmbedBuilder()
      .setColor(t.color)
      .setTitle(`${t.emoji} ${t.name} — Tier ${t.tier}`)
      .setDescription([
        `**$${t.price}/month**`,
        '',
        `*${t.tagline}*`,
        '',
        t.desc,
        '',
        '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      ].join('\n'))
      .addFields({
        name: '📦 Included Benefits',
        value: t.items.map(i => `✦ ${i}`).join('\n'),
        inline: false,
      })
      .setFooter({ ...FT, text: `Tier ${t.tier} · $${t.price}/mo · Use /sub-check to track your rewards` })
      .setTimestamp();

    return interaction.editReply({ embeds: [emb] });
  },
};

// ── /sub-check — Monthly rewards checklist ────────────────────────────
const subCheck = {
  data: new SlashCommandBuilder()
    .setName('sub-check')
    .setDescription('✅ Check off your received subscription rewards for this month')
    .addStringOption(o => o.setName('tier').setDescription('Your subscription tier').setRequired(true)
      .addChoices(...TIERS.map(t => ({ name: `${t.emoji} ${t.name} — $${t.price}/mo`, value: t.id })))),

  async execute(interaction) {
    const tierId  = interaction.options.getString('tier');
    const t       = TIERS.find(t => t.id === tierId);
    if (!t) return interaction.editReply('⚠️ Tier not found.');

    const userId  = interaction.user.id;
    const month   = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Load existing checklist from Supabase
    let received = [];
    if (sb && sbOk()) {
      const { data } = await sb.from('aegis_sub_checklist')
        .select('received_items')
        .eq('discord_id', userId)
        .eq('tier_id', tierId)
        .eq('month', month)
        .single()
        .catch(() => ({ data: null }));
      received = data?.received_items || [];
    }

    const embeds = [buildChecklistEmbed(t, received, month, interaction.user)];
    const components = buildChecklistRows(t, received, userId, tierId, month);

    return interaction.editReply({ embeds, components });
  },

  // Handle button press from interactionCreate
  async handleChecklistButton(interaction) {
    const parts   = interaction.customId.split('_'); // sub_check_USERID_TIERID_MONTH_ITEMIDX
    if (parts[0] !== 'sub' || parts[1] !== 'check') return;

    const [,, userId, tierId, month, itemIdxStr] = parts;
    const itemIdx = parseInt(itemIdxStr);

    // Only the owner can toggle their own checklist
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '⛔ This is not your checklist.', flags: 64 });
    }

    const t = TIERS.find(t => t.id === tierId);
    if (!t || isNaN(itemIdx)) return;

    // Load + toggle
    let received = [];
    if (sb && sbOk()) {
      const { data } = await sb.from('aegis_sub_checklist')
        .select('received_items')
        .eq('discord_id', userId)
        .eq('tier_id', tierId)
        .eq('month', month)
        .single()
        .catch(() => ({ data: null }));
      received = data?.received_items || [];
    }

    const key = `${tierId}_${itemIdx}`;
    if (received.includes(key)) {
      received = received.filter(r => r !== key);
    } else {
      received.push(key);
    }

    // Save
    if (sb && sbOk()) {
      await sb.from('aegis_sub_checklist').upsert({
        discord_id:     userId,
        discord_tag:    interaction.user.username,
        tier_id:        tierId,
        month,
        received_items: received,
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'discord_id,tier_id,month' });
    }

    const embeds = [buildChecklistEmbed(t, received, month, interaction.user)];
    const components = buildChecklistRows(t, received, userId, tierId, month);

    return interaction.update({ embeds, components });
  },
};

// ── /sub-status — Admin view of member's checklist ────────────────────
const subStatus = {
  data: new SlashCommandBuilder()
    .setName('sub-status')
    .setDescription('[Admin] 📊 View a member\'s subscription checklist status')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('Target member').setRequired(true))
    .addStringOption(o => o.setName('tier').setDescription('Tier to check').setRequired(true)
      .addChoices(...TIERS.map(t => ({ name: `${t.emoji} ${t.name}`, value: t.id })))),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const target = interaction.options.getUser('user');
    const tierId = interaction.options.getString('tier');
    const t      = TIERS.find(t => t.id === tierId);
    if (!t) return interaction.editReply('⚠️ Tier not found.');

    const month  = new Date().toISOString().slice(0, 7);
    let received = [];

    if (sb && sbOk()) {
      const { data } = await sb.from('aegis_sub_checklist')
        .select('received_items, updated_at')
        .eq('discord_id', target.id)
        .eq('tier_id', tierId)
        .eq('month', month)
        .single()
        .catch(() => ({ data: null }));
      received = data?.received_items || [];
    }

    const checkedCount = t.items.filter((_, i) => received.includes(`${tierId}_${i}`)).length;

    const emb = new EmbedBuilder()
      .setColor(t.color)
      .setTitle(`${t.emoji} ${target.username} — ${t.name} Status`)
      .setThumbnail(target.displayAvatarURL({ size: 64 }))
      .setDescription([
        `**Tier:** ${t.emoji} ${t.name} ($${t.price}/mo)`,
        `**Month:** ${month}`,
        `**Progress:** ${checkedCount}/${t.items.length} items received`,
        '',
        '**Checklist:**',
        ...t.items.map((item, i) => {
          const checked = received.includes(`${tierId}_${i}`);
          return `${checked ? '✅' : '⬜'} ${item}`;
        }),
      ].join('\n'))
      .setFooter({ ...FT, text: `Checked by ${interaction.user.username}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [emb] });
  },
};

// ── /sub-fulfill — Admin marks an item as fulfilled ───────────────────
const subFulfill = {
  data: new SlashCommandBuilder()
    .setName('sub-fulfill')
    .setDescription('[Admin] ✅ Mark all subscription items as fulfilled for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('Target member').setRequired(true))
    .addStringOption(o => o.setName('tier').setDescription('Tier').setRequired(true)
      .addChoices(...TIERS.map(t => ({ name: `${t.emoji} ${t.name}`, value: t.id })))),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.editReply('⛔ Admin only.');
    const target = interaction.options.getUser('user');
    const tierId = interaction.options.getString('tier');
    const t      = TIERS.find(t => t.id === tierId);
    if (!t) return interaction.editReply('⚠️ Tier not found.');

    const month    = new Date().toISOString().slice(0, 7);
    const allItems = t.items.map((_, i) => `${tierId}_${i}`);

    if (sb && sbOk()) {
      await sb.from('aegis_sub_checklist').upsert({
        discord_id:     target.id,
        discord_tag:    target.username,
        tier_id:        tierId,
        month,
        received_items: allItems,
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'discord_id,tier_id,month' });
    }

    try {
      await target.send({ embeds: [
        new EmbedBuilder()
          .setColor(t.color)
          .setTitle(`${t.emoji} Your ${t.name} rewards are ready!`)
          .setDescription([
            `Your **${t.name}** subscription rewards for **${month}** have been fulfilled!`,
            '',
            '**Received this month:**',
            ...t.items.map(i => `✅ ${i}`),
            '',
            'Use `/sub-check` to review your checklist anytime.',
          ].join('\n'))
          .setFooter(FT)
          .setTimestamp(),
      ]});
    } catch {}

    return interaction.editReply({
      embeds: [base(`✅ Fulfilled: ${target.username} — ${t.name}`, C.gr)
        .setDescription(`All **${t.items.length}** ${t.name} items marked as received for ${month}.`)],
    });
  },
};

// ── HELPERS ───────────────────────────────────────────────────────────
function buildChecklistEmbed(t, received, month, user) {
  const checkedCount = t.items.filter((_, i) => received.includes(`${t.id}_${i}`)).length;
  const pct = Math.round((checkedCount / t.items.length) * 100);
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

  return new EmbedBuilder()
    .setColor(t.color)
    .setTitle(`${t.emoji} ${t.name} — Monthly Checklist`)
    .setDescription([
      `**${user.username}'s rewards for ${month}**`,
      '',
      `\`${bar}\` **${pct}%** (${checkedCount}/${t.items.length} received)`,
      '',
      'Click the buttons below to mark each item as received.',
      '',
      '`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`',
      ...t.items.map((item, i) => {
        const checked = received.includes(`${t.id}_${i}`);
        return `${checked ? '✅' : '⬜'} ${item}`;
      }),
    ].join('\n'))
    .setFooter({ ...FT, text: `${t.name} · $${t.price}/mo · ${month}` })
    .setTimestamp();
}

function buildChecklistRows(t, received, userId, tierId, month) {
  const rows = [];
  for (let i = 0; i < t.items.length; i += 4) {
    const chunk = t.items.slice(i, i + 4);
    rows.push(new ActionRowBuilder().addComponents(
      ...chunk.map((item, j) => {
        const idx     = i + j;
        const key     = `${tierId}_${idx}`;
        const checked = received.includes(key);
        return new ButtonBuilder()
          .setCustomId(`sub_check_${userId}_${tierId}_${month}_${idx}`)
          .setLabel(`${checked ? '✅' : '⬜'} ${item.slice(0, 60)}`)
          .setStyle(checked ? ButtonStyle.Success : ButtonStyle.Secondary);
      })
    ));
    if (rows.length >= 4) break; // Discord max 5 rows, keep 1 for safety
  }
  return rows;
}

// Export checklist handler for interactionCreate
const subscriptions = [subTiers, subInfo, subCheck, subStatus, subFulfill];
subscriptions.handleChecklistButton = subCheck.handleChecklistButton;

module.exports = subscriptions;
