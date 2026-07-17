'use strict';
/*
 * server.js — LiteBI: login + publicação/hospedagem de dashboards.
 */
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const { pool, init } = require('./db');
const passport = require('./auth');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PUB = path.join(__dirname, 'public');
const sessionSecret = process.env.SESSION_SECRET || 'troque-este-segredo-em-producao';
let publicDashboardsCache = { rows: null, expiresAt: 0 };

if (isProd && sessionSecret === 'troque-este-segredo-em-producao') {
  throw new Error('SESSION_SECRET precisa ser configurado em produção.');
}

// Render/Neon ficam atrás de proxy; necessário para cookies 'secure'.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression({ threshold: 1024 }));
app.use('/api/dashboards', express.json({ limit: '25mb' }));
app.use('/api/profile', express.json({ limit: '3mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) res.set('Cache-Control', 'no-store');
  next();
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });
const publishLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 90, standardHeaders: 'draft-7', legacyHeaders: false });
app.use(['/auth/login', '/auth/signup'], authLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/dashboards', (req, res, next) => req.method === 'GET' ? next() : publishLimiter(req, res, next));

app.use(session({
  store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true, pruneSessionInterval: 15 * 60 }),
  secret: sessionSecret,
  name: 'litebi.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias
  },
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (_) {
    res.status(503).json({ ok: false });
  }
});

// ---------- Helpers ----------
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.method === 'GET' && req.accepts('html')) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  return res.status(401).json({ error: 'Não autenticado.' });
}
function slugId() { return crypto.randomBytes(6).toString('base64url'); }
function invalidatePublicDashboards() { publicDashboardsCache = { rows: null, expiresAt: 0 }; }
function protectDashboardScripts(html) {
  return String(html || '').replace(/<script\b(?![^>]*\bdata-cfasync=)/gi, '<script data-cfasync="false"');
}
function safeNext(value, fallback = '/dashboards') {
  const next = String(value || '');
  return next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : fallback;
}
function validateDashboardPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Estado do dashboard ausente.';
  if (payload.components && (!Array.isArray(payload.components) || payload.components.length > 150)) return 'O dashboard excede o limite de 150 componentes.';
  if (payload.rows && (!Array.isArray(payload.rows) || payload.rows.length > 100000)) return 'A base excede o limite de 100.000 linhas.';
  const bytes = Buffer.byteLength(JSON.stringify(payload));
  return bytes > 12 * 1024 * 1024 ? 'Dashboard muito grande (limite ~12MB).' : null;
}
function publicUser(u) {
  return u ? { id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url, bio: u.bio || '' } : null;
}
function publicProfileUser(u) {
  return u ? { id: u.id, name: u.name, avatar_url: u.avatar_url, bio: u.bio || '' } : null;
}
async function dashboardAccess(userId, dashboardId) {
  const { rows } = await pool.query(`
    SELECT d.user_id,
      CASE WHEN d.user_id = $1 THEN 'owner' ELSE COALESCE(ds.permission, 'viewer') END AS permission
    FROM dashboards d
    LEFT JOIN dashboard_shares ds ON ds.dashboard_id = d.id
    LEFT JOIN team_members tm ON tm.team_id = ds.team_id AND tm.user_id = $1
    WHERE d.id = $2 AND (d.user_id = $1 OR tm.user_id = $1)
    ORDER BY CASE WHEN d.user_id = $1 THEN 0 WHEN ds.permission = 'editor' THEN 1 ELSE 2 END
    LIMIT 1`, [userId, dashboardId]);
  return rows[0] || null;
}
async function teamRole(userId, teamId) {
  const { rows } = await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  return rows[0] && rows[0].role;
}
function errorPage(msg, code) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>LiteBI</title></head><body style="margin:0;font-family:ui-sans-serif,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f6f7f9;color:#1a1a1a">'
    + '<div style="max-width:520px;margin:90px auto;text-align:center;padding:0 20px">'
    + '<div style="font-size:34px;font-weight:800;letter-spacing:-.02em">LiteBI</div>'
    + '<p style="font-size:18px;color:#6b7280;margin:14px 0 24px">' + msg + '</p>'
    + '<a href="/" style="display:inline-block;background:#5e9fe8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Voltar ao início</a>'
    + '</div></body></html>';
}

// ---------- Autenticação ----------
app.post('/auth/signup', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim() || (email ? email.split('@')[0] : '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
    if (password.length < 6) return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [email, hash, name]
    );
    req.login(rows[0], (err) => {
      if (err) return next(err);
      res.json({ ok: true, user: publicUser(rows[0]) });
    });
  } catch (e) {
    if (e && e.code === '23505') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    next(e);
  }
});

app.post('/auth/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: (info && info.message) || 'Falha no login.' });
    req.login(user, (e) => {
      if (e) return next(e);
      res.json({ ok: true, user: publicUser(user) });
    });
  })(req, res, next);
});

app.post('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((sessionError) => {
      if (sessionError) return next(sessionError);
      res.clearCookie('litebi.sid');
      res.json({ ok: true });
    });
  });
});

app.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(404).send('Login com Google não configurado.');
  if (req.query.next) req.session.next = safeNext(req.query.next);
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user) => {
    if (err || !user) return res.redirect('/login?error=google');
    req.login(user, (e) => {
      if (e) return res.redirect('/login?error=google');
      const next = req.session.next; delete req.session.next;
      res.redirect(safeNext(next));
    });
  })(req, res, next);
});

// ---------- API ----------
app.get('/api/me', (req, res) => {
  res.json({ user: publicUser(req.user), googleEnabled: !!process.env.GOOGLE_CLIENT_ID });
});

// ---------- Perfil e amigos ----------
app.get('/api/profile', requireAuth, async (req, res, next) => {
  try {
    const dashboards = (await pool.query(`SELECT id, slug, title, views, updated_at FROM dashboards WHERE user_id = $1 AND visibility = 'public' ORDER BY updated_at DESC`, [req.user.id])).rows;
    res.json({ profile: Object.assign(publicUser(req.user), { created_at: req.user.created_at }), dashboards });
  } catch (e) { next(e); }
});

app.patch('/api/profile', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    const bio = String(req.body.bio || '').trim().slice(0, 240);
    const avatarUrl = String(req.body.avatar_url || '').trim();
    if (!name) return res.status(400).json({ error: 'O nome não pode ficar vazio.' });
    if (avatarUrl.length > 2 * 1024 * 1024 || (avatarUrl && !/^data:image\/(png|jpe?g|gif|webp);base64,/.test(avatarUrl))) {
      return res.status(400).json({ error: 'A foto precisa ser uma imagem válida.' });
    }
    const { rows } = await pool.query('UPDATE users SET name = $1, bio = $2, avatar_url = $3 WHERE id = $4 RETURNING *', [name, bio, avatarUrl || null, req.user.id]);
    req.user = rows[0];
    res.json({ ok: true, profile: publicUser(rows[0]) });
  } catch (e) { next(e); }
});

app.delete('/api/account', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((sessionError) => {
        if (sessionError) return next(sessionError);
        res.clearCookie('litebi.sid');
        res.json({ ok: true });
      });
    });
  } catch (e) { next(e); }
});

app.get('/api/profile/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Perfil inválido.' });
    const [userResult, dashboardsResult, relationResult] = await Promise.all([
      pool.query('SELECT id, name, email, avatar_url, bio, created_at FROM users WHERE id = $1', [id]),
      pool.query(`SELECT id, slug, title, views, updated_at FROM dashboards WHERE user_id = $1 AND visibility = 'public' ORDER BY updated_at DESC`, [id]),
      pool.query(`SELECT id, requester_id, addressee_id, status FROM friendships
        WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)
        ORDER BY id DESC LIMIT 1`, [req.user.id, id]),
    ]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'Perfil não encontrado.' });
    res.json({ profile: Object.assign(publicUser(user), { created_at: user.created_at }), dashboards: dashboardsResult.rows, friendship: relationResult.rows[0] || null });
  } catch (e) { next(e); }
});

// Perfil público: não expõe senha e permite que a galeria aponte para o criador.
app.get('/api/public/profile/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Perfil inválido.' });
    const relationPromise = req.user && req.user.id !== id
      ? pool.query(`SELECT id, requester_id, addressee_id, status FROM friendships
          WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)
          ORDER BY id DESC LIMIT 1`, [req.user.id, id])
      : Promise.resolve({ rows: [] });
    const [userResult, dashboardsResult, relationResult] = await Promise.all([
      pool.query('SELECT id, name, email, avatar_url, bio, created_at FROM users WHERE id = $1', [id]),
      pool.query(`SELECT id, slug, title, views, updated_at FROM dashboards WHERE user_id = $1 AND visibility = 'public' ORDER BY updated_at DESC`, [id]),
      relationPromise,
    ]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'Perfil não encontrado.' });
    res.json({ profile: Object.assign(publicProfileUser(user), { created_at: user.created_at }), dashboards: dashboardsResult.rows, friendship: relationResult.rows[0] || null });
  } catch (e) { next(e); }
});

app.get('/api/users/search', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });
    const like = '%' + q.replace(/[%_]/g, '') + '%';
    const { rows } = await pool.query(`SELECT id, name, email, avatar_url, bio FROM users
      WHERE id <> $1 AND (name ILIKE $2 OR email ILIKE $2) ORDER BY name LIMIT 12`, [req.user.id, like]);
    res.json({ users: rows.map(publicUser) });
  } catch (e) { next(e); }
});

app.get('/api/friends', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
      u.id AS user_id, u.name, u.email, u.avatar_url, u.bio
      FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
      WHERE f.requester_id = $1 OR f.addressee_id = $1 ORDER BY f.updated_at DESC`, [req.user.id]);
    res.json({ friends: rows });
  } catch (e) { next(e); }
});

app.post('/api/friends/:userId', requireAuth, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!userId || userId === req.user.id) return res.status(400).json({ error: 'Usuário inválido.' });
    if (!(await pool.query('SELECT 1 FROM users WHERE id = $1', [userId])).rowCount) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const existing = (await pool.query(`SELECT * FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1) LIMIT 1`, [req.user.id, userId])).rows[0];
    if (existing) {
      if (existing.requester_id === userId && existing.addressee_id === req.user.id && existing.status === 'pending') {
        await pool.query("UPDATE friendships SET status = 'accepted', updated_at = now() WHERE id = $1", [existing.id]);
        return res.json({ ok: true, status: 'accepted' });
      }
      return res.status(409).json({ error: existing.status === 'accepted' ? 'Vocês já são amigos.' : 'Pedido já enviado.' });
    }
    const { rows } = await pool.query('INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2) RETURNING *', [req.user.id, userId]);
    res.json({ ok: true, friendship: rows[0] });
  } catch (e) { next(e); }
});

app.patch('/api/friends/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10), status = req.body.status === 'accepted' ? 'accepted' : 'rejected';
    const { rowCount } = await pool.query(`UPDATE friendships SET status = $1, updated_at = now()
      WHERE id = $2 AND addressee_id = $3 AND status = 'pending'`, [status, id, req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'Pedido não encontrado.' });
    res.json({ ok: true, status });
  } catch (e) { next(e); }
});

app.delete('/api/friends/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM friendships WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)', [parseInt(req.params.id, 10), req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'Amizade não encontrada.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- Equipes e colaboração ----------
app.get('/api/teams', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.id, t.name, t.owner_id, t.created_at, tm.role,
        (SELECT COUNT(*)::int FROM team_members x WHERE x.team_id = t.id) AS member_count,
        (SELECT COUNT(*)::int FROM dashboard_shares ds WHERE ds.team_id = t.id) AS dashboard_count
      FROM teams t JOIN team_members tm ON tm.team_id = t.id
      WHERE tm.user_id = $1 ORDER BY t.created_at DESC`, [req.user.id]);
    res.json({ teams: rows });
  } catch (e) { next(e); }
});

app.post('/api/teams', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: 'Informe um nome para a equipe.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const team = (await client.query('INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING *', [name, req.user.id])).rows[0];
      await client.query("INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')", [team.id, req.user.id]);
      await client.query('COMMIT');
      res.json({ ok: true, team: Object.assign(team, { role: 'owner', member_count: 1, dashboard_count: 0 }) });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  } catch (e) { next(e); }
});

app.get('/api/teams/:id/members', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!(await teamRole(req.user.id, id))) return res.status(403).json({ error: 'Você não pertence a esta equipe.' });
    const { rows } = await pool.query(`SELECT u.id, u.name, u.email, u.avatar_url, tm.role, tm.created_at
      FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = $1 ORDER BY tm.created_at`, [id]);
    res.json({ members: rows });
  } catch (e) { next(e); }
});

app.post('/api/teams/:id/members', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10), role = req.body.role === 'editor' ? 'editor' : 'member';
    const ownerRole = await teamRole(req.user.id, id);
    if (!['owner', 'admin'].includes(ownerRole)) return res.status(403).json({ error: 'Somente donos e administradores podem convidar.' });
    const email = String(req.body.email || '').toLowerCase().trim();
    const user = (await pool.query('SELECT id, name, email, avatar_url FROM users WHERE email = $1', [email])).rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado. Ele precisa criar uma conta primeiro.' });
    const existing = (await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [id, user.id])).rows[0];
    if (existing && existing.role === 'owner') return res.status(400).json({ error: 'O dono da equipe não pode ter a permissão alterada.' });
    await pool.query(`INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)
      ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role`, [id, user.id, role]);
    res.json({ ok: true, member: Object.assign(user, { role }) });
  } catch (e) { next(e); }
});

app.patch('/api/teams/:id/members/:userId', requireAuth, async (req, res, next) => {
  try {
    const teamId = parseInt(req.params.id, 10), userId = parseInt(req.params.userId, 10);
    const actorRole = await teamRole(req.user.id, teamId);
    if (!['owner', 'admin'].includes(actorRole)) return res.status(403).json({ error: 'Somente donos e administradores podem alterar permissões.' });
    const role = req.body.role === 'editor' ? 'editor' : 'member';
    const target = (await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId])).rows[0];
    if (!target) return res.status(404).json({ error: 'Participante não encontrado.' });
    if (target.role === 'owner') return res.status(400).json({ error: 'O dono da equipe não pode ser rebaixado.' });
    await pool.query('UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3', [role, teamId, userId]);
    res.json({ ok: true, role });
  } catch (e) { next(e); }
});

app.delete('/api/teams/:id/members/:userId', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10), userId = parseInt(req.params.userId, 10);
    const ownerRole = await teamRole(req.user.id, id);
    if (!['owner', 'admin'].includes(ownerRole) && userId !== req.user.id) return res.status(403).json({ error: 'Sem permissão.' });
    const target = (await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [id, userId])).rows[0];
    if (!target) return res.status(404).json({ error: 'Participante não encontrado.' });
    if (target.role === 'owner') return res.status(400).json({ error: 'O dono da equipe não pode ser removido.' });
    await pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [id, userId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.delete('/api/teams/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const team = (await pool.query('SELECT owner_id FROM teams WHERE id = $1', [id])).rows[0];
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada.' });
    if (team.owner_id !== req.user.id) return res.status(403).json({ error: 'Somente o dono pode excluir a equipe.' });
    await pool.query('DELETE FROM teams WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- IA ----------
// A chave fica somente no servidor. O frontend envia apenas metadados compactos.
app.post('/api/ai/dashboard', requireAuth, async (req, res, next) => {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return res.status(503).json({ error: 'OpenAI não configurada. Defina OPENAI_API_KEY e reinicie o servidor.' });
    const input = req.body || {};
    if (!Array.isArray(input.columns) || !input.columns.length) return res.status(400).json({ error: 'Colunas ausentes.' });

    const compact = {
      rows: Math.max(0, Number(input.rowCount) || 0),
      columns: input.columns.slice(0, 30).map((c) => ({
        name: String(c.name || '').slice(0, 80),
        type: String(c.type || 'texto'),
        distinct: Number(c.distinct) || 0,
        fill: Number(c.fill) || 0,
      })),
      sample: Array.isArray(input.sample) ? input.sample.slice(0, 3).map((row) => {
        const clean = {};
        Object.entries(row && typeof row === 'object' ? row : {}).slice(0, 30).forEach(([key, value]) => { clean[String(key).slice(0, 80)] = String(value == null ? '' : value).slice(0, 120); });
        return clean;
      }) : [],
    };
    const fileDescription = String(input.description || '').trim();
    if (fileDescription) compact.description = fileDescription.slice(0, 500);
    const focus = String(input.focus || '').trim();
    if (focus) compact.focus = focus.slice(0, 320);
    compact.columns.forEach((column, index) => {
      const description = String(input.columns[index]?.description || '').trim();
      if (description) column.description = description.slice(0, 120);
    });
    const prompt = [
      'Responda SOMENTE JSON válido, sem markdown, no formato {"theme":{"title":"...","subtitle":"...","color1":"#RRGGBB","color2":"#RRGGBB"},"components":[...]}.',
      'Retorne exatamente 3 KPIs, 4 gráficos e 1 tabela. Use apenas nomes de colunas fornecidos; não invente colunas.',
      'Cada KPI DEVE ser {"type":"kpi","title":"...","config":{"mode":"simples","column":"coluna","agg":"soma|media|max|min|contagem","format":"numero|moeda|percentual"}}.',
      'Cada gráfico DEVE ser {"type":"chart","title":"...","config":{"type":"line|column|bar|pie","x":"coluna","y":"coluna","agg":"soma|media|max|min|contagem","dateGroup":"dia|mes|ano"}}.',
      'A tabela DEVE ser {"type":"table","title":"...","config":{"columns":["coluna"],"sortBy":"coluna","limit":8}}.',
      'Use line somente com data no eixo x; use column/bar/pie somente com categoria/texto no x. Prefira métricas numéricas úteis, não IDs.',
      'Se houver foco do usuário, priorize esse objetivo ao escolher KPIs e gráficos; se faltar uma coluna necessária, use a melhor alternativa disponível.',
      JSON.stringify(compact),
    ].join('\n');
    const aiAbort = new AbortController();
    const aiTimeout = setTimeout(() => aiAbort.abort(), 30000);
    const openaiOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + openaiKey },
      signal: aiAbort.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.4-nano',
        input: prompt,
        reasoning: { effort: 'none' },
        max_output_tokens: 1800,
        text: { format: { type: 'json_object' } },
      }),
    };
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch('https://api.openai.com/v1/responses', openaiOptions);
      if (![429, 503].includes(response.status) || attempt === 1) break;
      console.warn('[LiteBI] OpenAI temporariamente indisponível; tentando novamente.');
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    clearTimeout(aiTimeout);
    const data = await response.json();
    const text = data.output?.flatMap((item) => item.content || []).filter((item) => item.type === 'output_text').map((item) => item.text).join('') || data.output_text || '';
    console.log('[LiteBI] IA OpenAI respondeu:', response.status, response.ok ? 'ok' : 'erro');
    if (!response.ok) {
      const reason = data.error?.message || (response.status === 503 ? 'Serviço temporariamente indisponível.' : 'Falha na API.');
      return res.status(502).json({ error: 'OpenAI HTTP ' + response.status + ': ' + reason });
    }
    if (!text) {
      console.error('[LiteBI] IA sem texto:', JSON.stringify(data).slice(0, 1000));
      return res.status(502).json({ error: 'A IA respondeu sem conteúdo.' });
    }
    let result;
    try {
      const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
      try { result = JSON.parse(cleaned); } catch (_) {
        const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start) throw _;
        result = JSON.parse(cleaned.slice(start, end + 1));
      }
    } catch (_) {
      console.error('[LiteBI] JSON inválido retornado pela IA:', text.slice(0, 1200));
      return res.status(502).json({ error: 'A IA respondeu, mas o JSON veio incompleto ou inválido.' });
    }
    if (!Array.isArray(result.components)) return res.status(502).json({ error: 'A IA não retornou componentes.' });
    // O contrato da IA exige 3 KPIs + 4 gráficos + 1 tabela = 8 componentes.
    // Não truncar para 8 aqui: o frontend valida a contagem completa.
    const components = result.components.map((component) => {
      if (!component || typeof component !== 'object') return null;
      if (['line', 'column', 'bar', 'pie'].includes(component.type)) {
        const { type, x, y, agg, dateGroup } = component;
        return { type: 'chart', title: component.title || (String(type) + ' por ' + String(x || 'categoria')), config: { type, x, y, agg, dateGroup } };
      }
      return component;
    }).filter(Boolean).slice(0, 8);
    res.json({ theme: result.theme && typeof result.theme === 'object' ? result.theme : null, components });
  } catch (e) { next(e); }
});

app.post('/api/dashboards', requireAuth, async (req, res, next) => {
  try {
    const { title, visibility, payload, html } = req.body || {};
    const payloadError = validateDashboardPayload(payload);
    if (payloadError) return res.status(payloadError.includes('grande') ? 413 : 400).json({ error: payloadError });
    if (!html || typeof html !== 'string') return res.status(400).json({ error: 'HTML do dashboard ausente.' });
    if (html.length > 12 * 1024 * 1024) return res.status(413).json({ error: 'Dashboard muito grande (limite ~12MB).' });
    const vis = visibility === 'public' ? 'public' : 'private';
    const t = String(title || (payload.theme && payload.theme.title) || 'Dashboard').slice(0, 200);
    const slug = slugId();
    const { rows } = await pool.query(
      'INSERT INTO dashboards (slug, user_id, title, visibility, payload, html) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, slug, title, visibility, created_at',
      [slug, req.user.id, t, vis, payload, html]
    );
    invalidatePublicDashboards();
    res.json({ ok: true, dashboard: rows[0], url: '/d/' + slug });
  } catch (e) { next(e); }
});

app.get('/api/dashboards', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.slug, d.title, d.visibility, d.views, d.created_at, d.updated_at,
        u.name AS owner_name, u.email AS owner_email,
        CASE WHEN d.user_id = $1 THEN 'owner' ELSE shared.access END AS access
       FROM dashboards d JOIN users u ON u.id = d.user_id
       LEFT JOIN LATERAL (
         SELECT CASE WHEN count(*) = 0 THEN NULL WHEN bool_or(ds.permission = 'editor') THEN 'editor' ELSE 'viewer' END AS access
         FROM dashboard_shares ds
         JOIN team_members tm ON tm.team_id = ds.team_id AND tm.user_id = $1
         WHERE ds.dashboard_id = d.id
       ) shared ON true
       WHERE d.user_id = $1 OR shared.access IS NOT NULL ORDER BY d.updated_at DESC`,
      [req.user.id]
    );
    res.json({ dashboards: rows });
  } catch (e) { next(e); }
});

app.get('/api/public/dashboards', async (req, res, next) => {
  try {
    if (publicDashboardsCache.rows && publicDashboardsCache.expiresAt > Date.now()) {
      return res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120').json({ dashboards: publicDashboardsCache.rows });
    }
    const { rows } = await pool.query(`SELECT d.id, d.slug, d.title, d.views, d.updated_at,
      u.id AS owner_id, u.name AS owner_name, u.avatar_url
      FROM dashboards d JOIN users u ON u.id = d.user_id
      WHERE d.visibility = 'public' ORDER BY d.updated_at DESC LIMIT 100`);
    publicDashboardsCache = { rows, expiresAt: Date.now() + 30000 };
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120').json({ dashboards: rows });
  } catch (e) { next(e); }
});

app.get('/api/dashboards/:id/shares', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10), access = await dashboardAccess(req.user.id, id);
    if (!access || access.permission !== 'owner') return res.status(403).json({ error: 'Somente o dono pode gerenciar compartilhamentos.' });
    const { rows } = await pool.query(`SELECT ds.team_id, ds.permission, t.name
      FROM dashboard_shares ds JOIN teams t ON t.id = ds.team_id WHERE ds.dashboard_id = $1`, [id]);
    res.json({ shares: rows });
  } catch (e) { next(e); }
});

app.post('/api/dashboards/:id/shares', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10), teamId = parseInt(req.body.teamId, 10);
    const access = await dashboardAccess(req.user.id, id);
    if (!access || access.permission !== 'owner') return res.status(403).json({ error: 'Somente o dono pode compartilhar.' });
    if (!(await teamRole(req.user.id, teamId))) return res.status(403).json({ error: 'Você não pertence a esta equipe.' });
    const permission = req.body.permission === 'editor' ? 'editor' : 'viewer';
    await pool.query(`INSERT INTO dashboard_shares (dashboard_id, team_id, permission) VALUES ($1, $2, $3)
      ON CONFLICT (dashboard_id, team_id) DO UPDATE SET permission = EXCLUDED.permission`, [id, teamId, permission]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.delete('/api/dashboards/:id/shares/:teamId', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10), teamId = parseInt(req.params.teamId, 10), access = await dashboardAccess(req.user.id, id);
    if (!access || access.permission !== 'owner') return res.status(403).json({ error: 'Somente o dono pode remover compartilhamentos.' });
    await pool.query('DELETE FROM dashboard_shares WHERE dashboard_id = $1 AND team_id = $2', [id, teamId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.get('/api/dashboards/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const access = await dashboardAccess(req.user.id, id);
    if (!access) return res.status(404).json({ error: 'Dashboard não encontrado.' });
    if (!['owner', 'editor'].includes(access.permission)) return res.status(403).json({ error: 'Este dashboard é somente para visualização.' });
    const { rows } = await pool.query(
      'SELECT id, slug, title, visibility, payload FROM dashboards WHERE id = $1', [id]
    );
    res.json({ dashboard: Object.assign(rows[0], { access: access.permission }) });
  } catch (e) { next(e); }
});

app.patch('/api/dashboards/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10), access = await dashboardAccess(req.user.id, id);
    if (!access || !['owner', 'editor'].includes(access.permission)) return res.status(403).json({ error: 'Você só pode editar dashboards com permissão de editor.' });
    const sets = []; const vals = []; let i = 1;
    if (req.body.visibility && access.permission !== 'owner') return res.status(403).json({ error: 'Somente o dono pode alterar a visibilidade.' });
    if (req.body.visibility) { sets.push('visibility = $' + (i++)); vals.push(req.body.visibility === 'public' ? 'public' : 'private'); }
    if (req.body.title) { sets.push('title = $' + (i++)); vals.push(String(req.body.title).slice(0, 200)); }
    if (req.body.payload) {
      const payloadError = validateDashboardPayload(req.body.payload);
      if (payloadError) return res.status(payloadError.includes('grande') ? 413 : 400).json({ error: payloadError });
      sets.push('payload = $' + (i++)); vals.push(req.body.payload);
    }
    if (typeof req.body.html === 'string') {
      if (req.body.html.length > 12 * 1024 * 1024) return res.status(413).json({ error: 'Dashboard muito grande (limite ~12MB).' });
      sets.push('html = $' + (i++)); vals.push(req.body.html);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar.' });
    sets.push('updated_at = now()');
    vals.push(id);
    const { rowCount, rows } = await pool.query(
      'UPDATE dashboards SET ' + sets.join(', ') + ' WHERE id = $' + (i++) + ' RETURNING id, slug, title, visibility',
      vals
    );
    if (!rowCount) return res.status(404).json({ error: 'Dashboard não encontrado.' });
    invalidatePublicDashboards();
    res.json({ ok: true, dashboard: rows[0] });
  } catch (e) { next(e); }
});

app.delete('/api/dashboards/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const access = await dashboardAccess(req.user.id, id);
    if (!access || access.permission !== 'owner') return res.status(403).json({ error: 'Somente o dono pode excluir.' });
    const { rowCount } = await pool.query('DELETE FROM dashboards WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'Dashboard não encontrado.' });
    invalidatePublicDashboards();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- Viewer público/privado ----------
app.get('/d/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, user_id, visibility, html FROM dashboards WHERE slug = $1', [req.params.slug]);
    const d = rows[0];
    if (!d) return res.status(404).send(errorPage('Dashboard não encontrado.'));
    if (d.visibility !== 'public') {
      const uid = req.user && req.user.id;
      if (!uid) return res.redirect('/login?next=' + encodeURIComponent('/d/' + req.params.slug));
      if (uid !== d.user_id && !(await dashboardAccess(uid, d.id))) return res.status(403).send(errorPage('Este dashboard é privado.'));
    }
    pool.query('UPDATE dashboards SET views = views + 1 WHERE id = $1', [d.id]).catch(() => {});
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "sandbox allow-scripts allow-downloads; default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; connect-src 'none'",
      'Cache-Control': d.visibility === 'public' ? 'public, max-age=60, stale-while-revalidate=300, no-transform' : 'private, no-store, no-transform',
    }).send(protectDashboardScripts(d.html));
  } catch (e) { next(e); }
});

// ---------- Páginas ----------
app.get('/login', (req, res) => res.sendFile(path.join(PUB, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(PUB, 'signup.html')));
app.get('/', (req, res) => res.sendFile(path.join(PUB, 'home.html')));
app.get('/builder', requireAuth, (req, res) => res.sendFile(path.join(PUB, 'index.html')));
app.get('/index.html', requireAuth, (req, res) => res.sendFile(path.join(PUB, 'index.html')));
app.get('/home', requireAuth, (req, res) => res.sendFile(path.join(PUB, 'dashboards.html')));
app.get('/dashboards', requireAuth, (req, res) => res.sendFile(path.join(PUB, 'dashboards.html')));
app.get('/profile', requireAuth, (req, res) => res.sendFile(path.join(PUB, 'profile.html')));
app.get('/u/:id', (req, res) => res.sendFile(path.join(PUB, 'profile.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(PUB, 'termos.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(PUB, 'privacidade.html')));
app.get('/logo.png', (req, res) => res.sendFile(path.join(__dirname, 'logo.png')));
// Arquivos estáticos (cloud.js, base-exemplo.csv, etc.)
app.use(express.static(PUB, { etag: true, lastModified: true, maxAge: isProd ? '1d' : 0 }));

// 404
app.use((req, res) => {
  if (req.accepts('html')) return res.status(404).send(errorPage('Página não encontrada.'));
  res.status(404).json({ error: 'Não encontrado.' });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error('[LiteBI] Erro:', err);
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Conteúdo enviado excede o limite permitido.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  res.status(err.status && err.status < 500 ? err.status : 500).json({ error: 'Erro interno do servidor.' });
});

const PORT = Number(process.env.PORT) || 3000;
let httpServer;
init()
  .then(() => {
    httpServer = app.listen(PORT, () => console.log('[LiteBI] Servidor no ar na porta ' + PORT));
    httpServer.keepAliveTimeout = 65000;
    httpServer.headersTimeout = 66000;
  })
  .catch((e) => { console.error('[LiteBI] Falha ao iniciar o banco:', e); process.exit(1); });

function shutdown(signal) {
  console.log('[LiteBI] Encerrando após ' + signal + '…');
  const force = setTimeout(() => process.exit(1), 10000);
  force.unref();
  if (!httpServer) return pool.end().finally(() => process.exit(0));
  httpServer.close(() => pool.end().finally(() => process.exit(0)));
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
