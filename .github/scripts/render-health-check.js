const https = require('https');

const url = process.env.HEALTH_URL;
const hook = process.env.RENDER_DEPLOY_HOOK_URL;

if (!url || !hook) {
  console.error('Missing HEALTH_URL or RENDER_DEPLOY_HOOK_URL');
  process.exit(1);
}

function get(u) {
  return new Promise((resolve, reject) => {
    https
      .get(u, res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      })
      .on('error', reject);
  });
}

(async () => {
  try {
    const r = await get(url);
    if (r.status !== 200) {
      await get(hook);
      console.log('Triggered redeploy');
    } else {
      console.log('Health OK');
    }
  } catch (err) {
    console.error('Health check failed:', err.message);
    await get(hook);
    console.log('Triggered redeploy after error');
  }
})();
