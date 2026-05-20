'use strict';

const http = require('http');

function createHttpServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        ts: new Date().toISOString(),
      }));
      return;
    }

    if (req.url === '/') {
      res.writeHead(200);
      res.end('AEGIS ONLINE');
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on('error', (err) => {
    console.error('[HTTP] error', err);
  });

  return {
    server,

    async start() {
      const port = process.env.BOT_PORT || 3001;
      server.listen(port, '0.0.0.0', () => {
        console.log(`[HTTP] listening on ${port}`);
      });
    },

    async stop() {
      server.close();
    }
  };
}

module.exports = { createHttpServer };