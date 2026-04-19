'use strict';

/**
 * Conclave Aegis hotfix loader
 *
 * Use this as the Render/Node start file:
 *   node bot.hotfix.js
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const targetPath = path.join(__dirname, 'bot.js');

if (!fs.existsSync(targetPath)) {
  throw new Error(`bot.js not found at ${targetPath}`);
}

let source = fs.readFileSync(targetPath, 'utf8');

function stripBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return text;
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return text;
  return text.slice(0, start) + text.slice(end);
}

// Remove the orphaned command splice that was appended outside the main async interaction handler.
source = stripBetween(
  source,
  '// ─── BUTTON HANDLERS ───────────────────────────────────────────',
  "bot.on(Events.InteractionCreate, async i => {"
);

// Remove registration of the extra experimental commands whose handlers lived in the broken splice.
source = stripBetween(
  source,
  '// ─── ADDITIONAL COMMANDS (brings total to 60) ─────────────────',
  '// Music commands — injected at runtime if enabled'
);

// Patch obvious runtime faults.
source = source.replaceAll('NITRADO_API_URL', 'NITRADO_API');
source = source.replace(
  "      const headers = BATTLEMETRICS_TOKEN ? { Authorization: `Bearer ${BATTLEMETRICS_TOKEN}` } : {};",
  "      const bmToken = process.env.BATTLEMETRICS_TOKEN || ''; const headers = bmToken ? { Authorization: `Bearer ${bmToken}` } : {};"
);
source = source.replace(
  "    if (musicRuntime) {\n      await i.deferReply().catch(() => {});\n      const handled = await musicRuntime.handleMusicCommand(i, bot).catch(e => {",
  "    if (musicRuntime) {\n      const handled = await musicRuntime.handleMusicCommand(i, bot).catch(e => {"
);

// Compile sanitized source as the real bot module.
const hotfixModule = new Module(targetPath, module.parent || module);
hotfixModule.filename = targetPath;
hotfixModule.paths = Module._nodeModulePaths(__dirname);
hotfixModule._compile(source, targetPath);

module.exports = hotfixModule.exports;
