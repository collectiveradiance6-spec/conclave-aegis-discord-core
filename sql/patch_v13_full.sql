-- ═══════════════════════════════════════════════════════════════════════
-- AEGIS v13 — FULL PATCH (fixed)
-- Drops any conflicting views before creating tables
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- Drop conflicting views (only if they ARE views — skips tables)
do $$ declare r record; begin
  for r in
    select table_name, table_type
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'aegis_warnings','aegis_giveaways','aegis_giveaways_entries',
        'aegis_tickets','aegis_tribes','aegis_wipe_schedule',
        'aegis_knowledge','aegis_ai_usage','aegis_concoin_booty'
      )
      and table_type = 'VIEW'
  loop
    execute format('drop view if exists %I cascade', r.table_name);
    raise notice 'Dropped view: %', r.table_name;
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════════════
-- AEGIS v13 — FULL PATCH (run this, nothing else)
-- Adds every missing column to every existing table
-- Creates new tables with IF NOT EXISTS
-- Safe to run multiple times
-- ═══════════════════════════════════════════════════════════════════════

-- guild_configs
alter table if exists guild_configs add column if not exists display_name              text;
alter table if exists guild_configs add column if not exists server_icon_url           text;
alter table if exists guild_configs add column if not exists server_theme              text default 'dominion';
alter table if exists guild_configs add column if not exists bot_prefix                text default '/';
alter table if exists guild_configs add column if not exists aegis_channel_id          text;
alter table if exists guild_configs add column if not exists mod_log_channel_id        text;
alter table if exists guild_configs add column if not exists announcement_channel_id   text;
alter table if exists guild_configs add column if not exists welcome_channel_id        text;
alter table if exists guild_configs add column if not exists ticket_log_channel_id     text;
alter table if exists guild_configs add column if not exists economy_log_channel_id    text;
alter table if exists guild_configs add column if not exists monitor_channel_id        text;
alter table if exists guild_configs add column if not exists transcript_channel_id     text;
alter table if exists guild_configs add column if not exists admin_role_id             text;
alter table if exists guild_configs add column if not exists mod_role_id               text;
alter table if exists guild_configs add column if not exists helper_role_id            text;
alter table if exists guild_configs add column if not exists member_role_id            text;
alter table if exists guild_configs add column if not exists vip_role_id               text;
alter table if exists guild_configs add column if not exists economy_enabled           boolean default true;
alter table if exists guild_configs add column if not exists trivia_enabled            boolean default true;
alter table if exists guild_configs add column if not exists automod_enabled           boolean default true;
alter table if exists guild_configs add column if not exists tickets_enabled           boolean default true;
alter table if exists guild_configs add column if not exists monitor_enabled           boolean default false;
alter table if exists guild_configs add column if not exists ai_enabled                boolean default true;
alter table if exists guild_configs add column if not exists giveaway_enabled          boolean default true;
alter table if exists guild_configs add column if not exists watchtower_enabled        boolean default false;
alter table if exists guild_configs add column if not exists currency_name             text default 'ClaveShard';
alter table if exists guild_configs add column if not exists currency_emoji            text default '💎';
alter table if exists guild_configs add column if not exists weekly_claim_amount       int default 3;
alter table if exists guild_configs add column if not exists trivia_reward_amount      int default 15000;
alter table if exists guild_configs add column if not exists ai_persona                text default 'sovereign';
alter table if exists guild_configs add column if not exists ai_model_preference       text default 'anthropic';
alter table if exists guild_configs add column if not exists setup_complete            boolean default false;
alter table if exists guild_configs add column if not exists setup_by                  text;
alter table if exists guild_configs add column if not exists setup_at                  timestamptz;
alter table if exists guild_configs add column if not exists created_at                timestamptz default now();
alter table if exists guild_configs add column if not exists updated_at                timestamptz default now();
create index if not exists idx_gc_setup on guild_configs(setup_complete);
-- Panel post channels (where each ticket panel button is posted)
alter table if exists guild_configs add column if not exists panel_support_channel_id    text;
alter table if exists guild_configs add column if not exists panel_starterkit_channel_id text;
alter table if exists guild_configs add column if not exists panel_concoin_channel_id    text;
alter table if exists guild_configs add column if not exists panel_claveshard_channel_id text;
alter table if exists guild_configs add column if not exists panel_basewatch_channel_id  text;

-- Per-category ticket log channels (replaces single ticket_log_channel_id)
alter table if exists guild_configs add column if not exists ticket_log_support    text;
alter table if exists guild_configs add column if not exists ticket_log_starterkit text;
alter table if exists guild_configs add column if not exists ticket_log_concoin    text;
alter table if exists guild_configs add column if not exists ticket_log_claveshard text;
alter table if exists guild_configs add column if not exists ticket_log_basewatch  text;

-- Transcript archive channel (replaces generic ticket_log_channel_id)
alter table if exists guild_configs add column if not exists transcript_channel text;


-- aegis_wallets
alter table if exists aegis_wallets add column if not exists discord_tag      text;
alter table if exists aegis_wallets add column if not exists guild_id         text;
alter table if exists aegis_wallets add column if not exists wallet_balance   int default 0;
alter table if exists aegis_wallets add column if not exists bank_balance     int default 0;
alter table if exists aegis_wallets add column if not exists lifetime_earned  int default 0;
alter table if exists aegis_wallets add column if not exists lifetime_spent   int default 0;
alter table if exists aegis_wallets add column if not exists daily_streak     int default 0;
alter table if exists aegis_wallets add column if not exists last_daily_claim timestamptz;
alter table if exists aegis_wallets add column if not exists updated_at       timestamptz default now();
create index if not exists idx_w_guild on aegis_wallets(guild_id);

-- aegis_wallet_ledger
alter table if exists aegis_wallet_ledger add column if not exists guild_id             text;
alter table if exists aegis_wallet_ledger add column if not exists balance_wallet_after int;
alter table if exists aegis_wallet_ledger add column if not exists actor_discord_id     text;
alter table if exists aegis_wallet_ledger add column if not exists actor_tag            text;
create index if not exists idx_wl_did on aegis_wallet_ledger(discord_id);
create index if not exists idx_wl_ts  on aegis_wallet_ledger(created_at desc);

-- aegis_mod_log
alter table if exists aegis_mod_log add column if not exists extra jsonb default '{}';
create index if not exists idx_ml_guild on aegis_mod_log(guild_id);
create index if not exists idx_ml_ts    on aegis_mod_log(created_at desc);

-- aegis_shop_orders
alter table if exists aegis_shop_orders add column if not exists guild_id        text;
alter table if exists aegis_shop_orders add column if not exists shards_deducted boolean default false;
alter table if exists aegis_shop_orders add column if not exists fulfilled_by    text;
alter table if exists aegis_shop_orders add column if not exists fulfilled_at    timestamptz;

-- aegis_concoin_booty (may or may not exist)
create table if not exists aegis_concoin_booty (
  discord_id   text primary key,
  discord_tag  text,
  guild_id     text,
  booty        int default 0,
  total_earned int default 0,
  updated_at   timestamptz default now()
);
alter table if exists aegis_concoin_booty add column if not exists discord_tag  text;
alter table if exists aegis_concoin_booty add column if not exists guild_id     text;
alter table if exists aegis_concoin_booty add column if not exists total_earned int default 0;
alter table if exists aegis_concoin_booty add column if not exists updated_at   timestamptz default now();

-- New tables (fully safe with IF NOT EXISTS)
create table if not exists aegis_knowledge (
  id         uuid primary key default uuid_generate_v4(),
  guild_id   text,
  category   text not null,
  title      text not null,
  content    text not null,
  created_at timestamptz default now()
);
create index if not exists idx_k_cat on aegis_knowledge(category);

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
  id             uuid primary key default uuid_generate_v4(),
  guild_id       text not null,
  channel_id     text unique,
  user_id        text not null,
  user_tag       text,
  category       text default 'support',
  status         text default 'open',
  claimed_by     text,
  transcript_url text,
  created_at     timestamptz default now(),
  closed_at      timestamptz
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

-- RLS + service_role on everything
do $$ declare t text; begin
  foreach t in array array[
    'guild_configs','aegis_wallets','aegis_wallet_ledger','aegis_shop_orders',
    'aegis_knowledge','aegis_mod_log','aegis_warnings','aegis_giveaways',
    'aegis_giveaways_entries','aegis_tickets','aegis_ai_usage',
    'aegis_concoin_booty','aegis_tribes','aegis_wipe_schedule','aegis_sub_checklist'
  ] loop
    begin
      execute format('alter table %I enable row level security', t);
      execute format('drop policy if exists svc_%s on %I', replace(t,'-','_'), t);
      execute format('create policy svc_%s on %I for all to service_role using (true) with check (true)', replace(t,'-','_'), t);
    exception when others then
      raise notice 'Skipping % — %', t, sqlerrm;
    end;
  end loop;
end $$;

-- Confirm everything is good
select table_name, count(*) as columns
from information_schema.columns
where table_schema = 'public'
  and table_name in ('guild_configs','aegis_wallets','aegis_wallet_ledger','aegis_concoin_booty')
group by table_name
order by table_name;
