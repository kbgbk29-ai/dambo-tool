const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${UPSTASH_URL}/${command}/${args.map(a => encodeURIComponent(JSON.stringify(a))).join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const data = await redis('get', 'customers');
    return res.status(200).json(JSON.parse(data || '[]'));
  }

  if (req.method === 'POST') {
    const { customers } = req.body;
    await redis('set', 'customers', JSON.stringify(customers));
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await redis('del', 'customers');
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
