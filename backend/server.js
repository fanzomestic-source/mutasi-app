import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import MutasikuSDK from 'mutasiku-sdk';

const { MUTASIKU_API_KEY, APP_PASSWORD, PORT = 3000 } = process.env;
if (!MUTASIKU_API_KEY || !APP_PASSWORD) {
  console.error('MUTASIKU_API_KEY dan APP_PASSWORD wajib diisi');
  process.exit(1);
}

// Logger kosong supaya respons API tidak ikut tercatat di log
const sdk = new MutasikuSDK({ apiKey: MUTASIKU_API_KEY, logger: { error() {} } });
const app = express();
app.use(cors());

// Auth sederhana: Authorization: Bearer <APP_PASSWORD>
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!crypto.timingSafeEqual(sha(token), sha(APP_PASSWORD))) {
    return res.status(401).json({ status: 'error', message: 'Kata sandi salah' });
  }
  next();
}

// Batasi percobaan login per IP (anti brute force)
const fails = new Map();
app.use('/api', (req, res, next) => {
  const f = fails.get(req.ip);
  if (f && f.n >= 10 && Date.now() - f.t < 15 * 60 * 1000) {
    return res.status(429).json({ status: 'error', message: 'Terlalu banyak percobaan' });
  }
  auth(req, {
    status: (c) => ({
      json: (b) => {
        const cur = fails.get(req.ip) || { n: 0 };
        fails.set(req.ip, { n: cur.n + 1, t: Date.now() });
        res.status(c).json(b);
      },
    }),
  }, () => { fails.delete(req.ip); next(); });
});

const wrap = (fn) => async (req, res) => {
  const r = await fn(req);
  const ok = r && r.status !== 'error' && r.success !== false;
  res.status(ok ? 200 : 502).json(r);
};

app.get('/api/ping', (_q, res) => res.json({ status: 'success' }));
app.get('/api/providers', wrap(() => sdk.getProviders({ isActive: true })));
app.get('/api/accounts', wrap(() => sdk.getAccounts({ limit: 100 })));
app.post('/api/accounts/:id/refresh', wrap((q) => sdk.refreshAccount(q.params.id)));

app.get('/api/mutations', wrap((q) => {
  const n = (v) => (v === undefined || v === '' ? undefined : Number(v));
  const { accountId, type, startDate, endDate, search, page, limit, minAmount, maxAmount } = q.query;
  return sdk.getMutasi({
    accountId, type, startDate, endDate, search,
    page: n(page), limit: n(limit) || 20,
    minAmount: n(minAmount), maxAmount: n(maxAmount),
  });
}));

app.listen(PORT, () => console.log(`Backend jalan di port ${PORT}`));
