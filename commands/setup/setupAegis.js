// ═══════════════════════════════════════════════════════════════════════
// commands/setup/setupAegis.js
// /setup-aegis — Admin-only multi-step guild onboarding wizard
// Prompts guild admins to configure channels, roles, and features
// Saves everything to guild_configs via guildManager
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const {
  SlashCommandBuilder, PermissionFlagsBits,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, StringSelectMenuBuilder, ChannelType,
} = require('discord.js');
const guildManager = require('../../managers/guildManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-aegis')
    .setDescription('⚙️ [ADMIN] Configure AEGIS for this server — channels, roles, features')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ── Main entry ───────────────────────────────────────────────────
  async execute(interaction) {
    const guildId = interaction.guildId;
    const config  = await guildManager.getConfig(guildId) || {};

    const embed = new EmbedBuilder()
      .setColor(0x7B2FFF)
      .setTitle('⚙️ AEGIS Setup Wizard')
      .setDescription(
        config.setup_complete
          ? '✅ **AEGIS is already configured** for this server.\n\nUse the buttons below to reconfigure any section, or run a full reset.'
          : '**Welcome to AEGIS!** Let\'s get your server set up.\n\nComplete each section to unlock the full feature set.\n\nYou can update any section at any time.'
      )
      .addFields(
        { name: '📡 Core Channels',   value: config.aegis_channel_id ? `✅ Set` : '⚪ Not set', inline:true },
        { name: '🎫 Panel Channels',   value: config.panel_support_channel_id ? '✅ Set' : '⚪ Not set', inline:true },
        { name: '📋 Ticket Logs',      value: config.ticket_log_support ? '✅ Set' : '⚪ Not set', inline:true },
        { name: '👥 Roles',            value: config.admin_role_id ? '✅ Set' : '⚪ Not set', inline:true },
        { name: '⚙️ Features',        value: config.setup_complete ? '✅ Done' : '⚪ Pending', inline:true },
        { name: '💎 Economy',          value: config.currency_name ? `✅ ${config.currency_name}` : '⚪ Default', inline:true },
      )
      .setFooter({ text: `Guild: ${interaction.guild.name} · ${interaction.guild.id}` })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('aegis_setup_channels').setLabel('📡 Core Channels').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('aegis_setup_ticketcats').setLabel('🗂️ Ticket Categories').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('aegis_setup_panels').setLabel('🎫 Panel Channels').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('aegis_setup_ticketlogs').setLabel('📋 Ticket Logs').setStyle(ButtonStyle.Primary),
    );
    const row1b = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('aegis_setup_roles').setLabel('👥 Roles').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('aegis_setup_monitor').setLabel('📡 Server Monitor').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('aegis_setup_features').setLabel('⚙️ Features').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('aegis_setup_branding').setLabel('🎨 Branding').setStyle(ButtonStyle.Secondary),
    );
    const row1c = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('aegis_setup_economy').setLabel('💎 Economy').setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('aegis_setup_complete').setLabel('✅ Finish Setup').setStyle(ButtonStyle.Success),
    );

    await interaction.editReply({ embeds:[embed], components:[row1, row2] });
  },

  // ── Handle button interactions ───────────────────────────────────
  async handleButton(interaction) {
    const { customId, guildId } = interaction;

    switch (customId) {
      case 'aegis_setup_channels':
        return showChannelsModal(interaction);
      case 'aegis_setup_monitor':
        return showMonitorModal(interaction);
      case 'aegis_setup_ticketcats':
        return showTicketCatsModal(interaction);
      case 'aegis_setup_panels':
        return showPanelChannelsModal(interaction);
      case 'aegis_setup_ticketlogs':
        return showTicketLogsModal(interaction);
      case 'aegis_setup_roles':
        return showRolesModal(interaction);
      case 'aegis_setup_branding':
        return showBrandingModal(interaction);
      case 'aegis_setup_economy':
        return showEconomyModal(interaction);
      case 'aegis_setup_features':
        return showFeaturesMenu(interaction);
      case 'aegis_setup_complete':
        return finishSetup(interaction);
    }

    // Feature toggles
    if (customId.startsWith('aegis_toggle_')) {
      const feature = customId.replace('aegis_toggle_','');
      const config = await guildManager.getConfig(guildId);
      const key    = `${feature}_enabled`;
      const newVal = !config[key];
      await guildManager.updateField(guildId, key, newVal);
      return interaction.reply({
        content: `${newVal?'✅':'❌'} **${feature}** ${newVal?'enabled':'disabled'} for this server.`,
        flags: 64,
      });
    }
  },

  // ── Handle modal submissions ─────────────────────────────────────
  async handleModal(interaction) {
    const { customId, guildId } = interaction;

    if (customId === 'aegis_modal_channels') {
      const patch = {
        aegis_channel_id:        interaction.fields.getTextInputValue('aegis_channel_id').trim()||null,
        mod_log_channel_id:      interaction.fields.getTextInputValue('mod_log_channel_id').trim()||null,
        announcement_channel_id: interaction.fields.getTextInputValue('announcement_channel_id').trim()||null,
        welcome_channel_id:      interaction.fields.getTextInputValue('welcome_channel_id').trim()||null,
        transcript_channel:      interaction.fields.getTextInputValue('transcript_channel').trim()||null,
      };
      await guildManager.update(guildId, patch);
      return interaction.reply({
        content: '✅ **Channels saved!**\n\nAEGIS will now use:\n' + Object.entries(patch).filter(([,v])=>v).map(([k,v])=>`• ${k.replace(/_id$/,'').replace(/_/g,' ')}: <#${v}>`).join('\n') || 'No channels set.',
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_roles') {
      const patch = {
        admin_role_id:  interaction.fields.getTextInputValue('admin_role_id').trim()||null,
        mod_role_id:    interaction.fields.getTextInputValue('mod_role_id').trim()||null,
        helper_role_id: interaction.fields.getTextInputValue('helper_role_id').trim()||null,
        member_role_id: interaction.fields.getTextInputValue('member_role_id').trim()||null,
        vip_role_id:    interaction.fields.getTextInputValue('vip_role_id').trim()||null,
      };
      await guildManager.update(guildId, patch);
      return interaction.reply({
        content: '✅ **Roles saved!**\n\nAEGIS will now use these roles for permission checks.',
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_branding') {
      const patch = {
        display_name:     interaction.fields.getTextInputValue('display_name').trim()||null,
        server_icon_url:  interaction.fields.getTextInputValue('server_icon_url').trim()||null,
        server_theme:     interaction.fields.getTextInputValue('server_theme').trim()||'dominion',
      };
      await guildManager.update(guildId, patch);
      return interaction.reply({
        content: `✅ **Branding saved!**\n• Name: **${patch.display_name||interaction.guild.name}**\n• Theme: **${patch.server_theme}**`,
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_panels') {
      const patch = {
        panel_support_channel_id:    interaction.fields.getTextInputValue('panel_support_ch').trim()||null,
        panel_starterkit_channel_id: interaction.fields.getTextInputValue('panel_starterkit_ch').trim()||null,
        panel_concoin_channel_id:    interaction.fields.getTextInputValue('panel_concoin_ch').trim()||null,
        panel_claveshard_channel_id: interaction.fields.getTextInputValue('panel_claveshard_ch').trim()||null,
        panel_basewatch_channel_id:  interaction.fields.getTextInputValue('panel_basewatch_ch').trim()||null,
      };
      await guildManager.update(guildId, patch);
      const set = Object.values(patch).filter(Boolean).length;
      return interaction.reply({
        content: `✅ **Panel Channels saved!** (${set}/5 set)
${Object.entries(patch).filter(([,v])=>v).map(([k,v])=>`• ${k.replace('panel_','').replace('_channel_id','')}: <#${v}>`).join('\n')||'None set.'}`,
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_monitor') {
      const patch = {
        monitor_category_id:    interaction.fields.getTextInputValue('mon_category').trim()||null,
        monitor_nitrado_key:    interaction.fields.getTextInputValue('mon_nitrado').trim()||null,
        monitor_alert_channel:  interaction.fields.getTextInputValue('mon_alert').trim()||null,
        monitor_status_channel: interaction.fields.getTextInputValue('mon_status').trim()||null,
      };
      await guildManager.update(guildId, patch);
      return interaction.reply({
        content: [
          '✅ **Server Monitor configured!**',
          '',
          patch.monitor_category_id ? `• Category: <#${patch.monitor_category_id}>` : '• Category: Not set',
          patch.monitor_alert_channel ? `• Alert channel: <#${patch.monitor_alert_channel}>` : '• Alert channel: Not set',
          patch.monitor_status_channel ? `• Status channel: <#${patch.monitor_status_channel}>` : '• Status channel: Not set',
          '',
          '**Next steps:**',
          '1. Add servers with `/monitor-add name: ip: port:`',
          '2. Create voice channels with `/monitor-channels`',
          '3. Test with `/monitor-status`',
        ].join('\n'),
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_ticketcats') {
      const patch = {
        ticket_category_support:    interaction.fields.getTextInputValue('cat_support').trim()||null,
        ticket_category_starterkit: interaction.fields.getTextInputValue('cat_starterkit').trim()||null,
        ticket_category_concoin:    interaction.fields.getTextInputValue('cat_concoin').trim()||null,
        ticket_category_claveshard: interaction.fields.getTextInputValue('cat_claveshard').trim()||null,
        ticket_category_basewatch:  interaction.fields.getTextInputValue('cat_basewatch').trim()||null,
      };
      await guildManager.update(guildId, patch);
      const set = Object.values(patch).filter(Boolean).length;
      return interaction.reply({
        content: `✅ **Ticket Categories saved!** (${set}/5 set)\n${Object.entries(patch).filter(([,v])=>v).map(([k,v])=>`• ${k.replace('ticket_category_','')}: <#${v}>`).join('\n')||'None set.'}\n\n> 💡 Tickets will now be created **inside** the configured category as private channels.`,
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_ticketlogs') {
      const patch = {
        ticket_log_support:    interaction.fields.getTextInputValue('log_support').trim()||null,
        ticket_log_starterkit: interaction.fields.getTextInputValue('log_starterkit').trim()||null,
        ticket_log_concoin:    interaction.fields.getTextInputValue('log_concoin').trim()||null,
        ticket_log_claveshard: interaction.fields.getTextInputValue('log_claveshard').trim()||null,
        ticket_log_basewatch:  interaction.fields.getTextInputValue('log_basewatch').trim()||null,
      };
      await guildManager.update(guildId, patch);
      const set = Object.values(patch).filter(Boolean).length;
      return interaction.reply({
        content: `✅ **Ticket Log Channels saved!** (${set}/5 set)
${Object.entries(patch).filter(([,v])=>v).map(([k,v])=>`• ${k.replace('ticket_log_','')}: <#${v}>`).join('\n')||'None set.'}`,
        flags: 64,
      });
    }

    if (customId === 'aegis_modal_economy') {
      const patch = {
        currency_name:        interaction.fields.getTextInputValue('currency_name').trim()||'ClaveShard',
        currency_emoji:       interaction.fields.getTextInputValue('currency_emoji').trim()||'💎',
        weekly_claim_amount:  parseInt(interaction.fields.getTextInputValue('weekly_claim_amount'))||3,
        trivia_reward_amount: parseInt(interaction.fields.getTextInputValue('trivia_reward_amount'))||15000,
      };
      await guildManager.update(guildId, patch);
      return interaction.reply({
        content: `✅ **Economy saved!**\n• Currency: ${patch.currency_emoji} **${patch.currency_name}**\n• Weekly claim: **${patch.weekly_claim_amount}**\n• Trivia reward: **${patch.trivia_reward_amount.toLocaleString()}** ConCoins`,
        flags: 64,
      });
    }
  },
};

// ── Modal builders ───────────────────────────────────────────────────
async function showMonitorModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId)||{};
  const modal = new ModalBuilder()
    .setCustomId('aegis_modal_monitor')
    .setTitle('📡 Server Monitor Setup');
  modal.addComponents(
    row(text('mon_category', 'Voice Channel Category ID', config.monitor_category_id||'',    false, 'Category where monitor VCs live — right-click → Copy ID')),
    row(text('mon_nitrado',  'Nitrado API Key',           config.monitor_nitrado_key||'',     false, 'Bearer token from nitrado.net — enables accurate player counts')),
    row(text('mon_alert',    'Status Alert Channel ID',   config.monitor_alert_channel||'',   false, 'Where online/offline alerts are posted')),
    row(text('mon_status',   'Status Text Channel ID',    config.monitor_status_channel||'',  false, 'Text channel for status embeds (optional)')),
  );
  return interaction.showModal(modal);
}

async function showTicketCatsModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId)||{};
  const modal = new ModalBuilder()
    .setCustomId('aegis_modal_ticketcats')
    .setTitle('🗂️ Ticket Category IDs');
  modal.addComponents(
    row(text('cat_support',    '🛡️ Support Category ID',      config.ticket_category_support||'',    false, 'Right-click category folder → Copy ID')),
    row(text('cat_starterkit', '🎁 Starter Kit Category ID',  config.ticket_category_starterkit||'', false, 'Category where starter kit tickets open')),
    row(text('cat_concoin',    '🪙 ConCoin Category ID',      config.ticket_category_concoin||'',    false, 'Category where ConCoin tickets open')),
    row(text('cat_claveshard', '💎 ClaveShard Category ID',   config.ticket_category_claveshard||'', false, 'Category where ClaveShard order tickets open')),
    row(text('cat_basewatch',  '👁️ Base Watch Category ID',  config.ticket_category_basewatch||'',  false, 'Category where base watch tickets open')),
  );
  return interaction.showModal(modal);
}

async function showPanelChannelsModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId)||{};
  const modal = new ModalBuilder()
    .setCustomId('aegis_modal_panels')
    .setTitle('🎫 Panel Post Channels');
  modal.addComponents(
    row(text('panel_support_ch',    '🛡️ Support Panel Channel ID',    config.panel_support_channel_id||'',    false, 'Channel where the Support panel button is posted')),
    row(text('panel_starterkit_ch', '🎁 Starter Kit Panel Channel ID', config.panel_starterkit_channel_id||'', false, 'Channel where the Starter Kit panel is posted')),
    row(text('panel_concoin_ch',    '🪙 ConCoin Panel Channel ID',     config.panel_concoin_channel_id||'',    false, 'Channel where the ConCoin panel is posted')),
    row(text('panel_claveshard_ch', '💎 ClaveShard Panel Channel ID',  config.panel_claveshard_channel_id||'', false, 'Channel where the ClaveShard panel is posted')),
    row(text('panel_basewatch_ch',  '👁️ Base Watch Panel Channel ID', config.panel_basewatch_channel_id||'',  false, 'Channel where the Base Watch panel is posted')),
  );
  return interaction.showModal(modal);
}

async function showTicketLogsModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId)||{};
  const modal = new ModalBuilder()
    .setCustomId('aegis_modal_ticketlogs')
    .setTitle('📋 Ticket Log Channels');
  modal.addComponents(
    row(text('log_support',    '🛡️ Support Ticket Log Channel ID',    config.ticket_log_support||'',    false, 'Where support ticket notifications are logged')),
    row(text('log_starterkit', '🎁 Starter Kit Log Channel ID',       config.ticket_log_starterkit||'', false, 'Where starter kit ticket logs go')),
    row(text('log_concoin',    '🪙 ConCoin Log Channel ID',           config.ticket_log_concoin||'',    false, 'Where ConCoin ticket logs go')),
    row(text('log_claveshard', '💎 ClaveShard Log Channel ID',        config.ticket_log_claveshard||'', false, 'Where ClaveShard order logs go')),
    row(text('log_basewatch',  '👁️ Base Watch Log Channel ID',       config.ticket_log_basewatch||'',  false, 'Where base watch request logs go')),
  );
  return interaction.showModal(modal);
}

async function showChannelsModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId)||{};
  const modal = new ModalBuilder()
    .setCustomId('aegis_modal_channels')
    .setTitle('📡 Channel Configuration');
  modal.addComponents(
    row(text('aegis_channel_id',       'AEGIS AI Channel ID',        config.aegis_channel_id||'',         false, 'Right-click channel → Copy ID')),
    row(text('mod_log_channel_id',     'Mod Log Channel ID',          config.mod_log_channel_id||'',       false, 'Where moderation actions are logged')),
    row(text('announcement_channel_id','Announcement Channel ID',     config.announcement_channel_id||'',  false, 'Where AEGIS announcements are posted')),
    row(text('welcome_channel_id',     'Welcome Channel ID',          config.welcome_channel_id||'',       false, 'Where new member welcomes are sent')),
    row(text('transcript_channel',     'Transcript Archive Channel',  config.transcript_channel||'',       false, 'Where ticket transcripts/archives are saved')),
  );
  return interaction.showModal(modal);
}

async function showRolesModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId)||{};
  const modal = new ModalBuilder()
    .setCustomId('aegis_modal_roles')
    .setTitle('👥 Role Configuration');
  modal.addComponents(
    row(text('admin_role_id',  'Admin Role ID',  config.admin_role_id||'',  false, 'Right-click role → Copy ID')),
    row(text('mod_role_id',    'Mod Role ID',    config.mod_role_id||'',    false, 'Moderator role ID')),
    row(text('helper_role_id', 'Helper Role ID', config.helper_role_id||'', false, 'Helper/staff role ID')),
    row(text('member_role_id', 'Member Role ID', config.member_role_id||'', false, 'Base member role ID')),
    row(text('vip_role_id',    'VIP Role ID',    config.vip_role_id||'',    false, 'VIP/Patreon role ID')),
  );
  return interaction.showModal(modal);
}

async function showBrandingModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId)||{};
  const modal = new ModalBuilder()
    .setCustomId('aegis_modal_branding')
    .setTitle('🎨 Server Branding');
  modal.addComponents(
    row(text('display_name',    'Server Display Name', config.display_name||interaction.guild.name, false, 'Name shown in AEGIS embeds')),
    row(text('server_icon_url', 'Server Icon URL',     config.server_icon_url||'',                  false, 'Direct image URL for server icon')),
    row(text('server_theme',    'Theme (dominion/cyber/custom)', config.server_theme||'dominion',   false, 'dominion | cyber | custom')),
  );
  return interaction.showModal(modal);
}

async function showEconomyModal(interaction) {
  const config = await guildManager.getConfig(interaction.guildId)||{};
  const modal = new ModalBuilder()
    .setCustomId('aegis_modal_economy')
    .setTitle('💎 Economy Settings');
  modal.addComponents(
    row(text('currency_name',        'Currency Name',       config.currency_name||'ClaveShard', false, 'e.g. ClaveShard, Gold, Credits')),
    row(text('currency_emoji',       'Currency Emoji',      config.currency_emoji||'💎',        false, 'Single emoji for currency display')),
    row(text('weekly_claim_amount',  'Weekly Claim Amount', String(config.weekly_claim_amount||3), false, 'How many currency per /weekly claim')),
    row(text('trivia_reward_amount', 'Trivia Reward (ConCoins)', String(config.trivia_reward_amount||15000), false, 'ConCoins won per trivia question')),
  );
  return interaction.showModal(modal);
}

async function showFeaturesMenu(interaction) {
  const config = await guildManager.getConfig(interaction.guildId)||{};
  const features = [
    { id:'economy',     label:'💎 Economy (wallet/bank/shop)',  enabled: config.economy_enabled!==false },
    { id:'trivia',      label:'🎯 Trivia (ConCoin rewards)',    enabled: config.trivia_enabled!==false  },
    { id:'automod',     label:'🛡️ AutoMod (link/caps/spam)',   enabled: config.automod_enabled!==false },
    { id:'tickets',     label:'🎫 Ticket System',               enabled: config.tickets_enabled!==false },
    { id:'ai',          label:'🤖 AEGIS AI Assistant',          enabled: config.ai_enabled!==false      },
    { id:'giveaway',    label:'🎉 Giveaways',                   enabled: config.giveaway_enabled!==false},
    { id:'monitor',     label:'📡 Server Monitor (Nitrado)',    enabled: config.monitor_enabled===true  },
    { id:'watchtower',  label:'👁 Watchtower Panel',            enabled: config.watchtower_enabled===true},
  ];

  const rows = [];
  for (let i = 0; i < features.length; i += 4) {
    const chunk = features.slice(i, i+4);
    rows.push(new ActionRowBuilder().addComponents(
      ...chunk.map(f => new ButtonBuilder()
        .setCustomId(`aegis_toggle_${f.id}`)
        .setLabel(`${f.enabled?'✅':'❌'} ${f.label}`)
        .setStyle(f.enabled ? ButtonStyle.Success : ButtonStyle.Danger)
      )
    ));
  }

  return interaction.reply({
    content: '**⚙️ Feature Toggles** — click to enable/disable each feature for this server:',
    components: rows,
    flags: 64,
  });
}

async function finishSetup(interaction) {
  const guildId = interaction.guildId;
  await guildManager.saveSetup(guildId, {}, interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(0x35ED7E)
    .setTitle('✅ AEGIS Setup Complete!')
    .setDescription(`**${interaction.guild.name}** is now fully configured.\n\nAEGIS is active and ready. All features will use the configuration you set.\n\nRun \`/setup-aegis\` anytime to update settings.`)
    .addFields(
      { name: '📖 Get Started', value: 'Try `/aegis`, `/wallet`, `/trivia`, `/help`', inline:false },
      { name: '🔗 Dashboard', value: 'https://aegis.theconclavedominion.com', inline:false },
    )
    .setFooter({ text: `Configured by ${interaction.user.username}` })
    .setTimestamp();

  return interaction.reply({ embeds:[embed], flags:64 });
}

// ── Helpers ──────────────────────────────────────────────────────────
const text = (id, label, value='', required=false, placeholder='') =>
  new TextInputBuilder().setCustomId(id).setLabel(label).setValue(value).setRequired(required)
    .setStyle(TextInputStyle.Short).setPlaceholder(placeholder||label);
const row = (component) => new ActionRowBuilder().addComponents(component);
