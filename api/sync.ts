const KVDB_BUCKET = process.env.KVDB_BUCKET || '';
const KVDB_WRITE_KEY = process.env.KVDB_WRITE_KEY || '';
const KVDB_READ_KEY = process.env.KVDB_READ_KEY || '';

const buildKvdbUrl = (code: string, keyName: 'write_key' | 'read_key', keyValue?: string) => {
  const base = `https://kvdb.io/${encodeURIComponent(KVDB_BUCKET)}/${encodeURIComponent(code)}`;
  if (!keyValue) return base;
  const params = new URLSearchParams({ [keyName]: keyValue });
  return `${base}?${params.toString()}`;
};

export default async function handler(req: any, res: any) {
  if (!KVDB_BUCKET) {
    res.status(500).json({ error: 'KVDB_BUCKET is not configured' });
    return;
  }

  if (req.method === 'POST') {
    const { code, snippets } = req.body || {};
    if (!code) {
      res.status(400).json({ error: 'Missing code' });
      return;
    }
    try {
      const url = buildKvdbUrl(code, 'write_key', KVDB_WRITE_KEY);
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(snippets || [])
      });
      if (!response.ok) {
        res.status(response.status).json({ error: 'kvdb write failed' });
        return;
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: 'kvdb write error' });
    }
    return;
  }

  if (req.method === 'GET') {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      res.status(400).json({ error: 'Missing code' });
      return;
    }
    try {
      const url = buildKvdbUrl(code, 'read_key', KVDB_READ_KEY || KVDB_WRITE_KEY);
      const response = await fetch(url);
      if (response.status === 404) {
        res.status(200).json({ snippets: [] });
        return;
      }
      if (!response.ok) {
        res.status(response.status).json({ error: 'kvdb read failed' });
        return;
      }
      const text = await response.text();
      const snippets = text ? JSON.parse(text) : [];
      res.status(200).json({ snippets });
    } catch (error) {
      res.status(500).json({ error: 'kvdb read error' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
