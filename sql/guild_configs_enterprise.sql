-- ═══════════════════════════════════════════════════════════════════════
-- AEGIS ENTERPRISE GUILD CONFIG — Ticket System v3.0
-- Run in Supabase SQL Editor
-- Adding a new server: copy the INSERT block at the bottom, fill in values
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Schema — add all ticket columns if not present ────────────────
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS webhook_support          TEXT,
  ADD COLUMN IF NOT EXISTS webhook_starterkit       TEXT,
  ADD COLUMN IF NOT EXISTS webhook_concoin          TEXT,
  ADD COLUMN IF NOT EXISTS webhook_claveshard       TEXT,
  ADD COLUMN IF NOT EXISTS webhook_basewatch        TEXT,
  ADD COLUMN IF NOT EXISTS ticket_log_support       TEXT,
  ADD COLUMN IF NOT EXISTS ticket_log_starterkit    TEXT,
  ADD COLUMN IF NOT EXISTS ticket_log_concoin       TEXT,
  ADD COLUMN IF NOT EXISTS ticket_log_claveshard    TEXT,
  ADD COLUMN IF NOT EXISTS ticket_log_basewatch     TEXT,
  ADD COLUMN IF NOT EXISTS ticket_category_support    TEXT,
  ADD COLUMN IF NOT EXISTS ticket_category_starterkit TEXT,
  ADD COLUMN IF NOT EXISTS ticket_category_concoin    TEXT,
  ADD COLUMN IF NOT EXISTS ticket_category_claveshard TEXT,
  ADD COLUMN IF NOT EXISTS ticket_category_basewatch  TEXT,
  ADD COLUMN IF NOT EXISTS transcript_channel       TEXT,
  ADD COLUMN IF NOT EXISTS role_admin_id            TEXT,
  ADD COLUMN IF NOT EXISTS role_helper_id           TEXT,
  ADD COLUMN IF NOT EXISTS aegis_channel_id         TEXT,
  ADD COLUMN IF NOT EXISTS monitor_status_channel   TEXT,
  ADD COLUMN IF NOT EXISTS monitor_message_id       TEXT;

-- ── 2. TheConclave Dominion ──────────────────────────────────────────
UPDATE guild_configs SET
  -- Ticket webhooks (fire on every new ticket — optional but useful)
  webhook_support    = 'https://discord.com/api/webhooks/1503154889180844063/j6ymttGtKc89VRKS1GmZh5Ovyl8Qg2n_vM3FZUpjWy49bbw4HP04mgT5K-m3LWEtO3x-',
  webhook_starterkit = 'https://discord.com/api/webhooks/1503155166755684422/9alA_N8_uTuku0K4cs-aAk9Shmo_LjqhRT8g-v9pCS-ehjgEFHRQ4NaTj5GaxkLHZMN3',
  webhook_concoin    = 'https://discord.com/api/webhooks/1503155322531876914/UuHvVnCuOSKeNsKDmy-ypi2AqB41MgmedVoBdsOylYtsKGBxQcxZW3F1BFUpy7szVOeR',
  webhook_claveshard = 'https://discord.com/api/webhooks/1503155521761574972/f6Ib3QzsVMGMB8xnG3i3UN45yO-BUeHGscFQRMB8nrTZpmy_gYmrnKZxX8Dy2CgDy1Aj',
  webhook_basewatch  = 'https://discord.com/api/webhooks/1503155860862406770/lUPT8SBfA-OWHGh0011LHAeVF5ig_ASITZ-s_Yj5c1NXb9dc10s_oFKkkmhAMBJ-uTjS',
  -- Admin log channels (bot posts a summary here when ticket opens)
  ticket_log_support    = '1503154098374053909',
  ticket_log_starterkit = '1503154207342071818',
  ticket_log_concoin    = '1503154325738885273',
  ticket_log_claveshard = '1492870196958859436',
  ticket_log_basewatch  = '1498786324545671410',
  -- Transcript channel
  transcript_channel    = '1503111460790735041'
WHERE guild_id = '1438103556610723922';

-- ── 3. Cyber Nexus ───────────────────────────────────────────────────
UPDATE guild_configs SET
  webhook_support    = 'https://discord.com/api/webhooks/1503146823244578866/4wV_fkKANn51KcCIzgy5SbV_K1ptn8PqkAgT1D6NG96J4dpVju2pNQZYhwmzUm2fJ48D',
  webhook_starterkit = 'https://discord.com/api/webhooks/1503147111049330819/FusaukOH1UOINnqJOmhhd_ik1wubaPZWQ8WYESGGPRvngMwW6W_vvb-raTmDEoQ3lDWG',
  webhook_concoin    = 'https://discord.com/api/webhooks/1503147801935220947/jUfK0R7LRb4ga8yVqJH4Z3wV7REw6tlTB_1Cu6J88nZPHQ8-PTeNQB_7Zj6j0errDU9A',
  webhook_claveshard = 'https://discord.com/api/webhooks/1503147971829829642/y0zvK6zSoDGBCn4R7Qugxv1naBb74XDWBkPyo6K8uc9cnY7HV0FKNNwjY0CEr6hoKWHC',
  webhook_basewatch  = 'https://discord.com/api/webhooks/1503148110812155965/yh_lP_HNEnIcvDqxQob06qi0ewTNep6KLYPH-MOVe-Xk2sDUmTk77HO6HXWnpofvihMG',
  ticket_log_support    = '1503110133540978769',
  ticket_log_starterkit = '1503109898093727906',
  ticket_log_concoin    = '1503109720456691742',
  ticket_log_claveshard = '1503109559022256251',
  ticket_log_basewatch  = '1503109371910029415',
  transcript_channel    = '1503111460790735041'
WHERE guild_id = '1502913390761345044';

-- ── 4. ADDING A NEW SERVER (template — copy + fill for server 3, 4...) ──
-- Step 1: make sure the guild has a row in guild_configs (bot auto-inserts
--         on first command, or insert manually here):
--
-- INSERT INTO guild_configs (guild_id, display_name)
-- VALUES ('NEW_GUILD_ID', 'My New Server')
-- ON CONFLICT (guild_id) DO NOTHING;
--
-- Step 2: fill in their ticket config:
--
-- UPDATE guild_configs SET
--   webhook_support    = 'https://discord.com/api/webhooks/...',
--   webhook_starterkit = 'https://discord.com/api/webhooks/...',
--   webhook_concoin    = 'https://discord.com/api/webhooks/...',
--   webhook_claveshard = 'https://discord.com/api/webhooks/...',
--   webhook_basewatch  = 'https://discord.com/api/webhooks/...',
--   ticket_log_support    = 'CHANNEL_ID',
--   ticket_log_starterkit = 'CHANNEL_ID',
--   ticket_log_concoin    = 'CHANNEL_ID',
--   ticket_log_claveshard = 'CHANNEL_ID',
--   ticket_log_basewatch  = 'CHANNEL_ID',
--   transcript_channel    = 'CHANNEL_ID',
--   role_admin_id         = 'ROLE_ID',   -- optional: guild-specific admin role
--   role_helper_id        = 'ROLE_ID'    -- optional: guild-specific helper role
-- WHERE guild_id = 'NEW_GUILD_ID';
--
-- That's it. No code changes. No Render env changes. Bot picks it up instantly.

-- ── 5. Verify ────────────────────────────────────────────────────────
SELECT
  guild_id,
  display_name,
  webhook_support    IS NOT NULL AS support_wh,
  webhook_starterkit IS NOT NULL AS starterkit_wh,
  webhook_concoin    IS NOT NULL AS concoin_wh,
  webhook_claveshard IS NOT NULL AS claveshard_wh,
  webhook_basewatch  IS NOT NULL AS basewatch_wh,
  ticket_log_claveshard          AS clvsd_log_ch,
  transcript_channel
FROM guild_configs
ORDER BY display_name;
