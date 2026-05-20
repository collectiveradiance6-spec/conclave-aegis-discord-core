'use strict';

const levels = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  success: '✅',
  debug: '🧠',
};

function log(level, scope, message, meta = null) {
  const icon = levels[level] || '•';
  const ts = new Date().toISOString();

  console.log(
    `[${ts}] ${icon} [${scope}] ${message}`,
    meta || ''
  );
}

module.exports = {
  info: (scope, msg, meta) => log('info', scope, msg, meta),
  warn: (scope, msg, meta) => log('warn', scope, msg, meta),
  error: (scope, msg, meta) => log('error', scope, msg, meta),
  success: (scope, msg, meta) => log('success', scope, msg, meta),
  debug: (scope, msg, meta) => log('debug', scope, msg, meta),
};