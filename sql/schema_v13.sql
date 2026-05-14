-- ═══════════════════════════════════════════════════════════════════════
-- AEGIS ENTERPRISE SCHEMA v13.0
-- Multi-guild platform — run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── GUILD CONFIGS — Per-guild bot configuration ──────────────────────
create table if not exists guild_configs (
  guild_id                  text primary key,
  display_name              text,
  server_icon_url           text,
  server_theme              text default 'dominion',
  bot_prefix                text default '/',

  -- Channels
  aegis_channel_id          text,
  mod_log_channel_id        text,
  announcement_channel_id   text,
  welcome_channel_id        text,
  ticket_log_channel_id     text,
  economy_log_channel_id    text,
  monitor_channel_id        text,
  transcript_channel_id     text,

  -- Roles
  admin_role_id             text,
  mod_role_id               text,
  helper_role_id            text,
  member_role_id            text,
  vip_role_id               text,

  -- Feature flags
  economy_enabled           boolean default true,
  trivia_enabled            boolean default true,
  automod_enabled           boolean default true,
  tickets_enabled           boolean default true,
  monitor_enabled           boolean default false,
  ai_enabled                boolean default true,
  giveaway_enabled          boolean default true,
  watchtower_enabled        boolean default false,

  -- Economy settings
  currency_name             text default 'ClaveShard',
  currency_emoji            text default '💎',
  weekly_claim_amount       int default 3,
  trivia_reward_amount      int default 15000,

  -- AI settings
  ai_persona                text default 'sovereign',
  ai_model_preference       text default 'anthropic',

  -- Setup
  setup_complete            boolean default false,
  setup_by                  text,
  setup_at                  timestamptz,

  -- Meta
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);
create index if not exists idx_gc_setup on guild_configs(setup_complete);

-- ── WALLETS ──────────────────────────────────────────────────────────
create table if not exists aegis_wallets (
  discord_id      text primary key,
  discord_tag     text,
  guild_id        text,          -- allow per-guild wallets (null = global)
  wallet_balance  int default 0,
  bank_balance    int default 0,
  lifetime_earned int default 0,
  lifetime_spent  int default 0,
  daily_streak    int default 0,
  last_daily_claim timestamptz,
  updated_at      timestamptz default now()
);
create index if not exists idx_w_guild on aegis_wallets(guild_id);

-- ── WALLET LEDGER ─────────────────────────────────────────────────────
create table if not exists aegis_wallet_ledger (
  id                    uuid primary key default uuid_generate_v4(),
  discord_id            text not null,
  guild_id              text,
  action                text not null,
  amount                int,
  balance_wallet_after  int,
  note                  text,
  actor_discord_id      text,
  actor_tag             text,
  created_at            timestamptz default now()
);
create index if not exists idx_wl_did on aegis_wallet_ledger(discord_id);
create index if not exists idx_wl_ts  on aegis_wallet_ledger(created_at desc);

-- ── SHOP ORDERS ──────────────────────────────────────────────────────
create table if not exists aegis_shop_orders (
  id            uuid primary key default uuid_generate_v4(),
  guild_id      text,
  discord_id    text not null,
  discord_tag   text,
  tier          int not null,
  platform      text,
  server        text,
  notes         text,
  shards_deducted boolean default false,
  fulfilled     boolean default false,
  fulfilled_by  text,
  fulfilled_at  timestamptz,
  ref           text unique,
  created_at    timestamptz default now()
);

-- ── KNOWLEDGE BASE ────────────────────────────────────────────────────
create table if not exists aegis_knowledge (
  id          uuid primary key default uuid_generate_v4(),
  guild_id    text,              -- null = global shared knowledge
  category    text not null,
  title       text not null,
  content     text not null,
  created_at  timestamptz default now()
);
create index if not exists idx_k_cat on aegis_knowledge(category);

-- ── MOD LOG ──────────────────────────────────────────────────────────
create table if not exists aegis_mod_log (
  id          uuid primary key default uuid_generate_v4(),
  guild_id    text not null,
  action      text not null,
  target_id   text,
  target_tag  text,
  actor_id    text,
  actor_tag   text,
  reason      text,
  extra       jsonb default '{}',
  created_at  timestamptz default now()
);
create index if not exists idx_ml_guild on aegis_mod_log(guild_id);
create index if not exists idx_ml_ts    on aegis_mod_log(created_at desc);

-- ── WARNINGS ─────────────────────────────────────────────────────────
create table if not exists aegis_warnings (
  id          uuid primary key default uuid_generate_v4(),
  guild_id    text not null,
  target_id   text not null,
  target_tag  text,
  reason      text,
  actor_id    text,
  actor_tag   text,
  created_at  timestamptz default now()
);
create index if not exists idx_warn_target on aegis_warnings(guild_id, target_id);

-- ── GIVEAWAYS ────────────────────────────────────────────────────────
create table if not exists aegis_giveaways (
  id          uuid primary key default uuid_generate_v4(),
  guild_id    text not null,
  channel_id  text not null,
  message_id  text,
  prize       text not null,
  winners     int default 1,
  shard_cost  int default 0,
  host_id     text,
  ended       boolean default false,
  winner_ids  text[],
  ends_at     timestamptz,
  created_at  timestamptz default now()
);

create table if not exists aegis_giveaways_entries (
  id          uuid primary key default uuid_generate_v4(),
  giveaway_id uuid references aegis_giveaways(id) on delete cascade,
  user_id     text not null,
  user_tag    text,
  entered_at  timestamptz default now(),
  unique(giveaway_id, user_id)
);

-- ── TICKETS ──────────────────────────────────────────────────────────
create table if not exists aegis_tickets (
  id              uuid primary key default uuid_generate_v4(),
  guild_id        text not null,
  channel_id      text unique,
  user_id         text not null,
  user_tag        text,
  category        text default 'support',
  status          text default 'open',
  claimed_by      text,
  transcript_url  text,
  created_at      timestamptz default now(),
  closed_at       timestamptz
);
create index if not exists idx_tk_guild on aegis_tickets(guild_id, status);

-- ── AI USAGE LOG ─────────────────────────────────────────────────────
create table if not exists aegis_ai_usage (
  id            uuid primary key default uuid_generate_v4(),
  guild_id      text,
  model         text,
  engine        text,
  input_tokens  int default 0,
  output_tokens int default 0,
  created_at    timestamptz default now()
);
create index if not exists idx_ai_ts on aegis_ai_usage(created_at desc);

-- ── TRIVIA CONCOIN BOOTY ─────────────────────────────────────────────
create table if not exists aegis_concoin_booty (
  discord_id    text primary key,
  discord_tag   text,
  guild_id      text,
  booty         int default 0,
  total_earned  int default 0,
  updated_at    timestamptz default now()
);

-- ── TRIBES ───────────────────────────────────────────────────────────
create table if not exists aegis_tribes (
  id          uuid primary key default uuid_generate_v4(),
  guild_id    text not null,
  name        text not null,
  leader_id   text,
  members     text[] default '{}',
  created_at  timestamptz default now()
);

-- ── WIPE TRACKER ─────────────────────────────────────────────────────
create table if not exists aegis_wipe_schedule (
  id          uuid primary key default uuid_generate_v4(),
  guild_id    text not null,
  server      text not null,
  wipe_date   timestamptz,
  created_by  text,
  created_at  timestamptz default now()
);

-- ── RLS — enable on all tables ───────────────────────────────────────
alter table guild_configs         enable row level security;
alter table aegis_wallets         enable row level security;
alter table aegis_wallet_ledger   enable row level security;
alter table aegis_shop_orders     enable row level security;
alter table aegis_knowledge       enable row level security;
alter table aegis_mod_log         enable row level security;
alter table aegis_warnings        enable row level security;
alter table aegis_giveaways       enable row level security;
alter table aegis_giveaways_entries enable row level security;
alter table aegis_tickets         enable row level security;
alter table aegis_ai_usage        enable row level security;
alter table aegis_concoin_booty   enable row level security;
alter table aegis_tribes          enable row level security;
alter table aegis_wipe_schedule   enable row level security;

-- Service role bypasses all RLS
do $$ declare t text; begin
  foreach t in array array[
    'guild_configs','aegis_wallets','aegis_wallet_ledger','aegis_shop_orders',
    'aegis_knowledge','aegis_mod_log','aegis_warnings','aegis_giveaways',
    'aegis_giveaways_entries','aegis_tickets','aegis_ai_usage',
    'aegis_concoin_booty','aegis_tribes','aegis_wipe_schedule'
  ] loop
    execute format('drop policy if exists svc_%s on %I', replace(t,'.','_'), t);
    execute format('create policy svc_%s on %I for all to service_role using (true) with check (true)', replace(t,'.','_'), t);
  end loop;
end $$;
