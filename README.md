# AEGIS Discord Core — Deploy Guide

## New GitHub Repo Required

Create: `conclave-aegis-discord-core` on GitHub
Push all files from this folder to that repo root.

## Render — Background Worker

1. New Service → **Background Worker** (NOT Web Service)
2. Connect `conclave-aegis-discord-core` repo
3. Build command: `npm install`
4. Start command: `node bot.js`
5. Add ALL env vars from `.env.example`

**This service does NOT have a public URL** (background worker).

## Env Vars — Critical

| Var | Where to get |
|-----|--------------|
| `DISCORD_BOT_TOKEN` | Discord Developer Portal → Bot → Token |
| `DISCORD_CLIENT_ID` | Discord Developer Portal → App → Application ID |
| `DISCORD_GUILD_ID` | Already set: `1438103556610723922` |
| `ROLE_OWNER_ID` | Right-click role in Discord → Copy ID |
| `ROLE_ADMIN_ID` | Right-click role in Discord → Copy ID |
| `SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `API_URL` | `https://api.theconclavedominion.com` |

## After Deploy

1. Set `AEGIS_CHANNEL_ID` to the channel where AEGIS should auto-reply
2. Run `/setup-monitoring` in Discord to create live server stat channels
3. After `/setup-monitoring`, copy the output channel IDs into:
   - `MONITOR_STATUS_CHANNEL_ID`
   - `MONITOR_ACTIVITY_CHANNEL_ID`  
   - `MONITOR_MESSAGE_ID`
4. Run `/beacon-setup` to authenticate with Beacon Sentinel

## Bot Permissions

Required: `8` (Administrator) OR specific:
- `View Channels`, `Send Messages`, `Manage Messages`
- `Manage Channels` (for `/setup-monitoring`)
- `Manage Roles` (for `/role`)
- `Ban Members`, `Moderate Members`, `Kick Members`

Invite URL:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=8&scope=bot+applications.commands
```
