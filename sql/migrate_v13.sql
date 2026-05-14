-- ═══════════════════════════════════════════════════════════════════════
-- AEGIS v13 — MIGRATION PATCH
-- Run this BEFORE schema_v13.sql if guild_configs already exists
-- Adds all columns that may be missing from older versions
-- ═══════════════════════════════════════════════════════════════════════

-- guild_configs: add any missing columns
alter table guild_configs add column if not exists display_name              text;
alter table guild_configs add column if not exists server_icon_url           text;
alter table guild_configs add column if not exists server_theme              text default 'dominion';
alter table guild_configs add column if not exists bot_prefix                text default '/';
alter table guild_configs add column if not exists aegis_channel_id          text;
alter table guild_configs add column if not exists mod_log_channel_id        text;
alter table guild_configs add column if not exists announcement_channel_id   text;
alter table guild_configs add column if not exists welcome_channel_id        text;
alter table guild_configs add column if not exists ticket_log_channel_id     text;
alter table guild_configs add column if not exists economy_log_channel_id    text;
alter table guild_configs add column if not exists monitor_channel_id        text;
alter table guild_configs add column if not exists transcript_channel_id     text;
alter table guild_configs add column if not exists admin_role_id             text;
alter table guild_configs add column if not exists mod_role_id               text;
alter table guild_configs add column if not exists helper_role_id            text;
alter table guild_configs add column if not exists member_role_id            text;
alter table guild_configs add column if not exists vip_role_id               text;
alter table guild_configs add column if not exists economy_enabled           boolean default true;
alter table guild_configs add column if not exists trivia_enabled            boolean default true;
alter table guild_configs add column if not exists automod_enabled           boolean default true;
alter table guild_configs add column if not exists tickets_enabled           boolean default true;
alter table guild_configs add column if not exists monitor_enabled           boolean default false;
alter table guild_configs add column if not exists ai_enabled                boolean default true;
alter table guild_configs add column if not exists giveaway_enabled          boolean default true;
alter table guild_configs add column if not exists watchtower_enabled        boolean default false;
alter table guild_configs add column if not exists currency_name             text default 'ClaveShard';
alter table guild_configs add column if not exists currency_emoji            text default '💎';
alter table guild_configs add column if not exists weekly_claim_amount       int default 3;
alter table guild_configs add column if not exists trivia_reward_amount      int default 15000;
alter table guild_configs add column if not exists ai_persona                text default 'sovereign';
alter table guild_configs add column if not exists ai_model_preference       text default 'anthropic';
alter table guild_configs add column if not exists setup_complete            boolean default false;
alter table guild_configs add column if not exists setup_by                  text;
alter table guild_configs add column if not exists setup_at                  timestamptz;
alter table guild_configs add column if not exists created_at                timestamptz default now();
alter table guild_configs add column if not exists updated_at                timestamptz default now();

-- Create index if missing
create index if not exists idx_gc_setup on guild_configs(setup_complete);

-- Now create all the OTHER tables that are new (safe — uses if not exists)
create extension if not exists "uuid-ossp";

create table if not exists aegis_wallets (
  discord_id      text primary key,
  discord_tag     text,
  guild_id        text,
  wallet_balance  int default 0,
  bank_balance    int default 0,
  lifetime_earned int default 0,
  lifetime_spent  int default 0,
  daily_streak    int default 0,
  last_daily_claim timestamptz,
  updated_at      timestamptz default now()
);
create index if not exists idx_w_guild on aegis_wallets(guild_id);

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

create table if not exists aegis_shop_orders (
  id              uuid primary key default uuid_generate_v4(),
  guild_id        text,
  discord_id      text not null,
  discord_tag     text,
  tier            int not null,
  platform        text,
  server          text,
  notes           text,
  shards_deducted boolean default false,
  fulfilled       boolean default false,
  fulfilled_by    text,
  fulfilled_at    timestamptz,
  ref             text unique,
  created_at      timestamptz default now()
);

create table if not exists aegis_knowledge (
  id         uuid primary key default uuid_generate_v4(),
  guild_id   text,
  category   text not null,
  title      text not null,
  content    text not null,
  created_at timestamptz default now()
);
create index if not exists idx_k_cat on aegis_knowledge(category);

create table if not exists aegis_mod_log (
  id         uuid primary key default uuid_generate_v4(),
  guild_id   text not null,
  action     text not null,
  target_id  text,
  target_tag text,
  actor_id   text,
  actor_tag  text,
  reason     text,
  extra      jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_ml_guild on aegis_mod_log(guild_id);
create index if not exists idx_ml_ts    on aegis_mod_log(created_at desc);

create table if not exists aegis_warnings (
  id         uuid primary key default uuid_generate_v4(),
  guild_id   text not null,
  target_id  text not null,
  target_tag text,
  reason     text,
  actor_id   text,
  actor_tag  text,
  created_at timestamptz default now()
);
create index if not exists idx_warn_target on aegis_warnings(guild_id, target_id);

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

create table if not exists aegis_concoin_booty (
  discord_id   text primary key,
  discord_tag  text,
  guild_id     text,
  booty        int default 0,
  total_earned int default 0,
  updated_at   timestamptz default now()
);

create table if not exists aegis_tribes (
  id         uuid primary key default uuid_generate_v4(),
  guild_id   text not null,
  name       text not null,
  leader_id  text,
  members    text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists aegis_wipe_schedule (
  id         uuid primary key default uuid_generate_v4(),
  guild_id   text not null,
  server     text not null,
  wipe_date  timestamptz,
  created_by text,
  created_at timestamptz default now()
);

-- RLS + service_role policies on all new tables
do $$ declare t text; begin
  foreach t in array array[
    'guild_configs','aegis_wallets','aegis_wallet_ledger','aegis_shop_orders',
    'aegis_knowledge','aegis_mod_log','aegis_warnings','aegis_giveaways',
    'aegis_giveaways_entries','aegis_tickets','aegis_ai_usage',
    'aegis_concoin_booty','aegis_tribes','aegis_wipe_schedule'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists svc_%s on %I', replace(t,'.','_'), t);
    execute format('create policy svc_%s on %I for all to service_role using (true) with check (true)', replace(t,'.','_'), t);
  end loop;
end $$;

-- Confirm
select column_name from information_schema.columns
where table_name = 'guild_configs' and column_name = 'setup_complete';
