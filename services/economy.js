// ═══════════════════════════════════════════════════════════════════════
// services/economy.js — ClaveShard Economy Engine
// Wallet, bank, transfer, grants, deducts, ledger, leaderboard
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { sbQuery, dbFire } = require('./supabase');

async function getWallet(id, tag) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets')
      .upsert({ discord_id:id, discord_tag:tag, updated_at:new Date().toISOString() },
        { onConflict:'discord_id', ignoreDuplicates:false })
      .select().single();
    if (error) throw new Error('Wallet error: '+error.message);
    return data;
  });
}

async function logTx(id, tag, action, amount, balAfter, note='', actorId='', actorTag='') {
  dbFire(sb => sb.from('aegis_wallet_ledger').insert({
    discord_id:id, action, amount, balance_wallet_after:balAfter,
    note:note||null, actor_discord_id:actorId||null, actor_tag:actorTag||null,
    created_at:new Date().toISOString(),
  }));
}

async function deposit(id, tag, amount) {
  const w = await getWallet(id, tag);
  if (w.wallet_balance < amount) throw new Error(`Need **${amount}** in wallet. Have **${w.wallet_balance}** 💎.`);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets')
      .update({ wallet_balance:w.wallet_balance-amount, bank_balance:w.bank_balance+amount, updated_at:new Date().toISOString() })
      .eq('discord_id',id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id,tag,'deposit',amount,data.bank_balance,`Deposited ${amount}`,id,tag);
    return data;
  });
}

async function withdraw(id, tag, amount) {
  const w = await getWallet(id, tag);
  if (w.bank_balance < amount) throw new Error(`Need **${amount}** in bank. Have **${w.bank_balance}** 💎.`);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets')
      .update({ wallet_balance:w.wallet_balance+amount, bank_balance:w.bank_balance-amount, updated_at:new Date().toISOString() })
      .eq('discord_id',id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id,tag,'withdraw',amount,data.wallet_balance,`Withdrew ${amount}`,id,tag);
    return data;
  });
}

async function transfer(fromId, fromTag, toId, toTag, amount) {
  if (fromId===toId) throw new Error('Cannot transfer to yourself.');
  const sender = await getWallet(fromId, fromTag);
  if (sender.wallet_balance < amount) throw new Error(`Need **${amount}** in wallet. Have **${sender.wallet_balance}** 💎.`);
  return sbQuery(async sb => {
    await sb.from('aegis_wallets').update({ wallet_balance:sender.wallet_balance-amount, lifetime_spent:(sender.lifetime_spent||0)+amount, updated_at:new Date().toISOString() }).eq('discord_id',fromId);
    await getWallet(toId,toTag);
    const { data:r } = await sb.from('aegis_wallets').select('wallet_balance,lifetime_earned').eq('discord_id',toId).single();
    const { data:up } = await sb.from('aegis_wallets').update({ wallet_balance:(r.wallet_balance||0)+amount, lifetime_earned:(r.lifetime_earned||0)+amount, updated_at:new Date().toISOString() }).eq('discord_id',toId).select().single();
    const note=`${fromTag} → ${toTag}`;
    await logTx(fromId,fromTag,'transfer_out',amount,sender.wallet_balance-amount,note,fromId,fromTag);
    await logTx(toId,toTag,'transfer_in',amount,up.wallet_balance,note,fromId,fromTag);
    return { sent:sender.wallet_balance-amount, received:up.wallet_balance };
  });
}

async function grant(toId, toTag, amount, reason, actorId, actorTag) {
  await getWallet(toId,toTag);
  return sbQuery(async sb => {
    const { data:curr } = await sb.from('aegis_wallets').select('wallet_balance,lifetime_earned').eq('discord_id',toId).single();
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:(curr.wallet_balance||0)+amount, lifetime_earned:(curr.lifetime_earned||0)+amount, updated_at:new Date().toISOString() }).eq('discord_id',toId).select().single();
    if (error) throw new Error(error.message);
    await logTx(toId,toTag,'grant',amount,data.wallet_balance,reason||'Admin grant',actorId,actorTag);
    return data;
  });
}

async function deduct(fromId, fromTag, amount, reason, actorId, actorTag) {
  const w = await getWallet(fromId,fromTag);
  const nb = Math.max(0,(w.wallet_balance||0)-amount);
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:nb, lifetime_spent:(w.lifetime_spent||0)+amount, updated_at:new Date().toISOString() }).eq('discord_id',fromId).select().single();
    if (error) throw new Error(error.message);
    await logTx(fromId,fromTag,'deduct',amount,data.wallet_balance,reason||'Admin deduct',actorId,actorTag);
    return data;
  });
}

async function setBalance(targetId, targetTag, amount, reason, actorId, actorTag) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:amount, updated_at:new Date().toISOString() }).eq('discord_id',targetId).select().single();
    if (error) throw new Error(error.message);
    await logTx(targetId,targetTag,'admin_set',amount,amount,reason||'Admin set',actorId,actorTag);
    return data;
  });
}

async function resetWallet(targetId, targetTag, actorId, actorTag) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:0,bank_balance:0,daily_streak:0,updated_at:new Date().toISOString() }).eq('discord_id',targetId).select().single();
    if (error) throw new Error(error.message);
    await logTx(targetId,targetTag,'admin_reset',0,0,'Wallet reset',actorId,actorTag);
    return data;
  });
}

async function getHistory(id, limit=15) {
  return sbQuery(async sb => {
    const { data, error } = await sb.from('aegis_wallet_ledger').select('action,amount,balance_wallet_after,note,actor_tag,created_at').eq('discord_id',id).order('created_at',{ascending:false}).limit(limit);
    if (error) throw new Error(error.message);
    return data||[];
  });
}

async function getLeaderboard(limit=10) {
  return sbQuery(async sb => {
    const { data } = await sb.from('aegis_wallets').select('discord_id,discord_tag,wallet_balance,bank_balance,lifetime_earned').order('wallet_balance',{ascending:false}).limit(limit);
    return data||[];
  });
}

async function getSupply() {
  return sbQuery(async sb => {
    const { data } = await sb.from('aegis_wallets').select('wallet_balance,bank_balance');
    if (!data?.length) return { walletTotal:0, bankTotal:0, holders:0 };
    return { walletTotal:data.reduce((s,r)=>s+(r.wallet_balance||0),0), bankTotal:data.reduce((s,r)=>s+(r.bank_balance||0),0), holders:data.length };
  });
}

async function claimWeekly(id, tag) {
  return sbQuery(async sb => {
    const { data:w } = await sb.from('aegis_wallets').select('*').eq('discord_id',id).single().catch(()=>({data:null}));
    if (!w) { await getWallet(id,tag); return claimWeekly(id,tag); }
    const now=new Date(), last=w.last_daily_claim?new Date(w.last_daily_claim):null;
    const diff = last?(now-last)/(1000*60*60):999;
    if (diff<168) { const next=new Date(last.getTime()+168*60*60*1000); throw new Error(`⏳ Already claimed. Next: <t:${Math.floor(next/1000)}:R>`); }
    const amount=3, streak=(w.daily_streak||0)+1;
    const { data, error } = await sb.from('aegis_wallets').update({ wallet_balance:(w.wallet_balance||0)+amount, lifetime_earned:(w.lifetime_earned||0)+amount, last_daily_claim:now.toISOString(), daily_streak:streak, updated_at:now.toISOString() }).eq('discord_id',id).select().single();
    if (error) throw new Error(error.message);
    await logTx(id,tag,'daily_claim',amount,data.wallet_balance,`Week ${streak} claim`,'SYSTEM','AEGIS');
    return { data, amount, streak };
  });
}

async function bulkGrant(userList, amount, reason, actorId, actorTag) {
  const results = [];
  for (const u of userList) {
    try { const w=await grant(u.id,u.tag,amount,reason,actorId,actorTag); results.push({...u,success:true,balance:w.wallet_balance}); }
    catch(e) { results.push({...u,success:false,error:e.message}); }
  }
  return results;
}

module.exports = { getWallet, logTx, deposit, withdraw, transfer, grant, deduct, setBalance, resetWallet, getHistory, getLeaderboard, getSupply, claimWeekly, bulkGrant };
