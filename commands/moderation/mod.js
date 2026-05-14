// commands/moderation/mod.js — All moderation commands
'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const P = require('../../panels');
const { C, FT, isAdmin, base } = require('../../config/constants');
const { sb, sbOk, dbFire } = require('../../services/supabase');

const isMod = m => m?.permissions?.has('ManageMessages') || m?.permissions?.has('Administrator') || m?.roles?.cache?.has(process.env.MOD_ROLE_ID);

async function addWarn(guildId, targetId, targetTag, reason, actorId, actorTag) {
  if (!sb||!sbOk()) throw new Error('Database unavailable');
  const { error } = await sb.from('aegis_warnings').insert({ guild_id:guildId, target_id:targetId, target_tag:targetTag, reason, actor_id:actorId, actor_tag:actorTag, created_at:new Date().toISOString() });
  if (error) throw new Error(error.message);
}
async function getWarns(guildId, targetId) {
  if (!sb||!sbOk()) return [];
  const { data } = await sb.from('aegis_warnings').select('*').eq('guild_id',guildId).eq('target_id',targetId).order('created_at',{ascending:false});
  return data||[];
}
async function clearWarns(guildId, targetId) {
  if (!sb||!sbOk()) return false;
  await sb.from('aegis_warnings').delete().eq('guild_id',guildId).eq('target_id',targetId);
  return true;
}
async function modLog(guild, action, target, actor, reason, extra={}) {
  const logChId = process.env.MOD_LOG_CHANNEL_ID;
  if (logChId) {
    const ch = guild.channels.cache.get(logChId);
    if (ch) {
      const colors = {ban:0xFF0000,timeout:0xFF8C00,warn:0xFFB800,kick:0xFF4500,note:0x00D4FF};
      const emb = base(`🔨 ${action.toUpperCase()} — ${target.username||target.tag}`, colors[action]||0x7B2FFF)
        .addFields({name:'👤 Target',value:`${target} (\`${target.id}\`)`,inline:true},{name:'👮 Actor',value:`${actor}`,inline:true},{name:'📋 Reason',value:reason||'No reason',inline:false},...Object.entries(extra).map(([k,v])=>({name:k,value:String(v),inline:true})));
      await ch.send({embeds:[emb]}).catch(()=>{});
    }
  }
  if (sb&&sbOk()) dbFire(sb=>sb.from('aegis_mod_log').insert({guild_id:guild.id,action,target_id:target.id,target_tag:target.username||target.tag,actor_id:actor.id,actor_tag:actor.username||actor.tag,reason,extra,created_at:new Date().toISOString()}));
}

const warn = {
  data: new SlashCommandBuilder().setName('warn').setDescription('[Mod] ⚠️ Warn a member')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
    const target=interaction.options.getUser('user'), reason=interaction.options.getString('reason');
    await addWarn(interaction.guildId,target.id,target.username,reason,interaction.user.id,interaction.user.username);
    const warns=await getWarns(interaction.guildId,target.id);
    await modLog(interaction.guild,'warn',target,interaction.user,reason,{'Total Warnings':warns.length});
    try { await target.send({ embeds:[base(`⚠️ Warning in ${interaction.guild.name}`,C.gold).setDescription(`**Reason:** ${reason}\n\nReview the rules with \`/rules\`.`)] }); } catch {}
    return interaction.editReply({ embeds:[P.WarnPanel(target,reason,warns.length,interaction.user)] });
  },
};

const warnHistory = {
  data: new SlashCommandBuilder().setName('warn-history').setDescription('[Mod] 📋 View warnings for a member')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true)),
  async execute(interaction) {
    if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
    const target=interaction.options.getUser('user'), warns=await getWarns(interaction.guildId,target.id);
    if (!warns.length) return interaction.editReply(`✅ **${target.username}** has no warnings.`);
    return interaction.editReply({ embeds:[base(`📋 Warnings — ${target.username}`,C.rd).setDescription(warns.map((w,i)=>`**${i+1}.** ${w.reason}\n└ by **${w.actor_tag||'Unknown'}** · <t:${Math.floor(new Date(w.created_at).getTime()/1000)}:R>`).join('\n\n'))] });
  },
};

const warnClear = {
  data: new SlashCommandBuilder().setName('warn-clear').setDescription('[Mod] 🗑️ Clear all warnings for a member')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
    const target=interaction.options.getUser('user'), reason=interaction.options.getString('reason')||'Cleared by moderator';
    await clearWarns(interaction.guildId,target.id);
    await modLog(interaction.guild,'note',target,interaction.user,`Warnings cleared: ${reason}`);
    return interaction.editReply(`✅ All warnings cleared for **${target.username}**.`);
  },
};

const ban = {
  data: new SlashCommandBuilder().setName('ban').setDescription('[Admin] 🔨 Ban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.editReply('⛔ Ban Members required.');
    const target=interaction.options.getUser('user'), reason=interaction.options.getString('reason');
    try { await interaction.guild.members.ban(target.id,{reason:`${interaction.user.username}: ${reason}`}); await modLog(interaction.guild,'ban',target,interaction.user,reason); return interaction.editReply({ embeds:[base(`🔨 Banned: ${target.username}`,C.rd).setDescription(`**Reason:** ${reason}`)] }); }
    catch(e) { return interaction.editReply(`⚠️ Could not ban: ${e.message}`); }
  },
};

const timeout = {
  data: new SlashCommandBuilder().setName('timeout').setDescription('[Mod] ⏰ Timeout a member')
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addStringOption(o=>o.setName('duration').setDescription('Duration').setRequired(true).addChoices({name:'5 minutes',value:'5m'},{name:'1 hour',value:'1h'},{name:'6 hours',value:'6h'},{name:'24 hours',value:'24h'},{name:'7 days',value:'7d'}))
    .addStringOption(o=>o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
    const target=interaction.options.getUser('user'), duration=interaction.options.getString('duration'), reason=interaction.options.getString('reason')||'No reason';
    const durations={'5m':5*60_000,'1h':60*60_000,'6h':6*60*60_000,'24h':24*60*60_000,'7d':7*24*60*60_000};
    try { const member=interaction.guild.members.cache.get(target.id); if (!member) return interaction.editReply('⚠️ Member not in server.'); await member.timeout(durations[duration]||5*60_000,reason); await modLog(interaction.guild,'timeout',target,interaction.user,reason,{Duration:duration}); return interaction.editReply({ embeds:[base(`⏰ Timeout: ${target.username}`,C.gold).addFields({name:'⏱️ Duration',value:duration,inline:true},{name:'📋 Reason',value:reason,inline:true})] }); }
    catch(e) { return interaction.editReply(`⚠️ Timeout failed: ${e.message}`); }
  },
};

const purge = {
  data: new SlashCommandBuilder().setName('purge').setDescription('[Mod] 🗑️ Bulk delete messages')
    .addIntegerOption(o=>o.setName('count').setDescription('Number (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),
  async execute(interaction) {
    if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
    const count=interaction.options.getInteger('count');
    try { const deleted=await interaction.channel.bulkDelete(count,true); return interaction.editReply(`✅ Deleted **${deleted.size}** messages.`); }
    catch(e) { return interaction.editReply(`⚠️ Purge failed: ${e.message}`); }
  },
};

const lock = {
  data: new SlashCommandBuilder().setName('lock').setDescription('[Mod] 🔒 Lock/unlock the current channel')
    .addStringOption(o=>o.setName('action').setDescription('Lock or unlock').setRequired(true).addChoices({name:'Lock',value:'lock'},{name:'Unlock',value:'unlock'}))
    .addStringOption(o=>o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
    const action=interaction.options.getString('action'), reason=interaction.options.getString('reason')||'No reason';
    const locked=action==='lock';
    try { await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone,{SendMessages:locked?false:null}); return interaction.editReply(`${locked?'🔒 Locked':'🔓 Unlocked'} **${interaction.channel.name}**. Reason: ${reason}`); }
    catch(e) { return interaction.editReply(`⚠️ Failed: ${e.message}`); }
  },
};

const slowmode = {
  data: new SlashCommandBuilder().setName('slowmode').setDescription('[Mod] ⏱️ Set slowmode on current channel')
    .addIntegerOption(o=>o.setName('seconds').setDescription('Seconds (0 = off)').setRequired(true).setMinValue(0).setMaxValue(21600)),
  async execute(interaction) {
    if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
    const secs=interaction.options.getInteger('seconds');
    try { await interaction.channel.setRateLimitPerUser(secs); return interaction.editReply(secs===0?'✅ Slowmode disabled.': `✅ Slowmode set to **${secs}s**.`); }
    catch(e) { return interaction.editReply(`⚠️ Failed: ${e.message}`); }
  },
};

const role = {
  data: new SlashCommandBuilder().setName('role').setDescription('[Admin] 🎭 Add/remove a role from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(o=>o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({name:'Add',value:'add'},{name:'Remove',value:'remove'}))
    .addUserOption(o=>o.setName('user').setDescription('Target').setRequired(true))
    .addRoleOption(o=>o.setName('role').setDescription('Role').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.editReply('⛔ Manage Roles required.');
    const action=interaction.options.getString('action'), target=interaction.options.getUser('user'), roleObj=interaction.options.getRole('role');
    try { const m=interaction.guild.members.cache.get(target.id); if (!m) return interaction.editReply('⚠️ Member not found.'); if (action==='add') { await m.roles.add(roleObj); return interaction.editReply(`✅ Added <@&${roleObj.id}> to **${target.username}**.`); } else { await m.roles.remove(roleObj); return interaction.editReply(`✅ Removed <@&${roleObj.id}> from **${target.username}**.`); } }
    catch(e) { return interaction.editReply(`⚠️ Role change failed: ${e.message}`); }
  },
};

const modlog = {
  data: new SlashCommandBuilder().setName('modlog').setDescription('[Mod] 📋 View recent mod actions')
    .addIntegerOption(o=>o.setName('count').setDescription('Number').setMinValue(1).setMaxValue(25)),
  async execute(interaction) {
    if (!isMod(interaction.member)) return interaction.editReply('⛔ Mod only.');
    if (!sb||!sbOk()) return interaction.editReply('⚠️ Database unavailable.');
    const count=interaction.options.getInteger('count')||10;
    const { data }=await sb.from('aegis_mod_log').select('action,target_tag,reason,actor_tag,created_at').eq('guild_id',interaction.guildId).order('created_at',{ascending:false}).limit(count);
    if (!data?.length) return interaction.editReply('📭 No recent mod actions.');
    const lines=data.map(e=>`\`${e.action.toUpperCase().padEnd(10)}\` **${e.target_tag}** · *${e.reason?.slice(0,50)||'—'}* · <t:${Math.floor(new Date(e.created_at).getTime()/1000)}:R> · by ${e.actor_tag}`).join('\n');
    return interaction.editReply({ embeds:[base('📋 Recent Mod Actions',C.rd).setDescription(lines)] });
  },
};

const report = {
  data: new SlashCommandBuilder().setName('report').setDescription('🚨 Report an issue to the Council')
    .addStringOption(o=>o.setName('issue').setDescription('Describe the issue').setRequired(true))
    .addStringOption(o=>o.setName('player').setDescription('Player involved (if any)')),
  async execute(interaction) {
    const issue=interaction.options.getString('issue'), player=interaction.options.getString('player')||'Not specified';
    const emb=base('🚨 Report Received',C.rd).setDescription(`Report filed by **${interaction.user.username}**`).addFields({name:'📋 Issue',value:issue,inline:false},{name:'👤 Player',value:player,inline:true},{name:'📅 Time',value:`<t:${Math.floor(Date.now()/1000)}:F>`,inline:true});
    if (sb&&sbOk()) dbFire(sb=>sb.from('aegis_reports').upsert({guild_id:interaction.guildId,reporter_id:interaction.user.id,reporter_tag:interaction.user.username,issue,player,created_at:new Date().toISOString()}).catch(()=>{}));
    return interaction.editReply({ embeds:[emb.setFooter({...FT,text:'A Council member will review your report soon.'})] });
  },
};

module.exports = [warn,warnHistory,warnClear,ban,timeout,purge,lock,slowmode,role,modlog,report];
