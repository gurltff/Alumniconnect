// AlumniConnect API + static frontend. Run: npm start  (after npm run seed)
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { q, UPLOAD_DIR, hashPassword, checkPassword } = require('./db');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '7mb' }));

const PORT = Number(process.env.PORT) || 3000;
const LEVELS = ['College', 'University', 'State', 'National', 'International'];
const KINDS = ['achievement', 'exam', 'research', 'society', 'position', 'event', 'project', 'internship', 'graduation', 'study', 'phd', 'job', 'startup'];
const ACH = ['achievement', 'exam', 'research'];
const STATUSES = ['Job', 'Higher studies', 'Research', 'Govt services', 'Entrepreneurship', 'Other', 'Not reported'];
const STATUS_KIND = { 'Job': 'job', 'Higher studies': 'study', 'Research': 'phd', 'Govt services': 'job', 'Entrepreneurship': 'startup' };
const PURPOSES = ['Mentorship', 'Career advice', 'Resume review', 'Internship / referral', 'Higher studies advice', 'Project collaboration'];
const FILE_TYPES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const BANNERS = ['navy', 'slate', 'teal', 'forest', 'plum', 'sand'];
const img = name => name ? '/api/images/' + name : null;

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const thisMonth = () => new Date().toISOString().slice(0, 7);
const ayOf = month => { const [y, m] = month.split('-').map(Number); return m >= 7 ? y : y - 1; };
const curAY = () => ayOf(thisMonth());
const str = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max);
const fail = (res, code, msg) => res.status(code).json({ error: msg });
const audit = (actor, action, target) => q.run('INSERT INTO audit_log (actor_id, action, target) VALUES (?,?,?)', actor, action, target);

/* ---------- auth ---------- */
function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
app.use((req, res, next) => {
  const token = cookies(req).sid;
  if (token) {
    const u = q.get(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? AND u.account = 'active'`, token, now());
    if (u) {
      req.user = u;
      if (!u.last_seen || u.last_seen < now().slice(0, 13)) q.run('UPDATE users SET last_seen = ? WHERE id = ?', now(), u.id);
    }
  }
  next();
});
const auth = (...roles) => (req, res, next) => {
  if (!req.user) return fail(res, 401, 'Please log in.');
  if (roles.length && !roles.includes(req.user.role)) return fail(res, 403, 'You don’t have access to this.');
  next();
};
function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  q.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)', token, userId, exp);
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 86400}`);
}

/* ---------- shaping ---------- */
const DEPTS = () => Object.fromEntries(q.all('SELECT * FROM departments').map(d => [d.code, d]));
function publicUser(u, viewer) {
  if (!u) return null;
  const self = viewer && (viewer.id === u.id || viewer.role === 'admin');
  return {
    id: u.id, role: u.role, name: u.name, dept: u.dept, adm_year: u.adm_year, grad_year: u.grad_year,
    headline: u.headline, about: u.about, location: u.location, status: u.status, now_title: u.now_title, sector: u.sector,
    status_updated: u.status_updated, mentor: !!u.mentor, accepts: !!u.accepts,
    avatar_url: img(u.avatar),
    banner_url: u.banner && !u.banner.startsWith('preset:') ? img(u.banner) : null,
    banner_preset: u.banner && u.banner.startsWith('preset:') ? u.banner.slice(7) : 'navy',
    skills: JSON.parse(u.skills || '[]'), topics: JSON.parse(u.topics || '[]'), links: JSON.parse(u.links || '[]'), scope: u.scope,
    ...(self ? { email: u.email, college_id: u.college_id, account: u.account } : {})
  };
}
function shapeMilestone(m, viewer) {
  const canSeeNote = viewer && (viewer.id === m.user_id || viewer.role === 'admin' || viewer.id === m.verifier_id);
  return {
    id: m.id, user_id: m.user_id, kind: m.kind, category: m.category, title: m.title, org: m.org, level: m.level, month: m.month,
    description: m.description, proof_type: m.proof_type, proof_label: m.proof_label,
    proof_url: m.proof_type === 'file' && m.proof_ref ? '/api/files/' + m.proof_ref : m.proof_type === 'link' ? m.proof_ref : null,
    status: m.status, submitted_at: m.submitted_at, verified_at: m.verified_at,
    verifier: m.vname ? { name: m.vname, scope: m.vscope } : null,
    routed_to: m.rname ? { name: m.rname, scope: m.rscope } : null,
    note: canSeeNote ? m.note : null
  };
}
const MS_SELECT = `SELECT m.*, v.name vname, v.scope vscope, r.name rname, r.scope rscope FROM milestones m
  LEFT JOIN users v ON v.id = m.verified_by LEFT JOIN users r ON r.id = m.verifier_id`;
function milestonesFor(userId, viewer) {
  const all = viewer.id === userId || viewer.role === 'admin' || viewer.role === 'faculty';
  return q.all(`${MS_SELECT} WHERE m.user_id = ? ${all ? '' : "AND m.status = 'verified'"} ORDER BY m.month, m.id`, userId).map(m => shapeMilestone(m, viewer));
}
function strength(u, ms) {
  const checks = [
    ['Write an About section', !!u.about],
    ['Get 3 milestones verified', ms.filter(m => m.status === 'verified').length >= 3],
    ['Get an achievement verified', ms.some(m => ACH.includes(m.kind) && m.status === 'verified')],
    ['Add GitHub, LinkedIn or a portfolio', JSON.parse(u.links || '[]').length > 0],
    ['Add at least 3 skills', JSON.parse(u.skills || '[]').length >= 3]
  ];
  if (u.role === 'alumni') checks.push(['Confirm what you’re doing now (last 12 months)', !!u.status_updated && u.status_updated >= new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)]);
  return { pct: Math.round(checks.filter(c => c[1]).length / checks.length * 100), checks: checks.map(([label, done]) => ({ label, done })) };
}
function relation(me, otherId) {
  const [a, b] = me < otherId ? [me, otherId] : [otherId, me];
  const chat = q.get('SELECT id FROM chats WHERE a_id = ? AND b_id = ?', a, b);
  if (chat) return { kind: 'chat', chat_id: chat.id };
  const sent = q.get(`SELECT id FROM chat_requests WHERE from_id = ? AND to_id = ? AND status = 'pending'`, me, otherId);
  if (sent) return { kind: 'sent', request_id: sent.id };
  const recv = q.get(`SELECT id FROM chat_requests WHERE from_id = ? AND to_id = ? AND status = 'pending'`, otherId, me);
  if (recv) return { kind: 'received', request_id: recv.id };
  return { kind: 'none' };
}
function routeFor(user) {
  if (user.role === 'student') {
    const f = q.get(`SELECT id FROM users WHERE role = 'faculty' AND dept = ? AND account = 'active' ORDER BY id LIMIT 1`, user.dept);
    if (f) return f.id;
  }
  return q.get(`SELECT id FROM users WHERE role = 'admin' AND account = 'active' ORDER BY id LIMIT 1`).id;
}
const vcountSql = `(SELECT count(*) FROM milestones x WHERE x.user_id = u.id AND x.status = 'verified' AND x.kind IN ('achievement','exam','research'))`;

/* ---------- public ---------- */
app.get('/api/meta', (req, res) => res.json({ departments: q.all('SELECT * FROM departments ORDER BY name'), levels: LEVELS, statuses: STATUSES, purposes: PURPOSES }));
app.get('/api/stats/public', (req, res) => {
  res.json(q.get(`SELECT
    (SELECT count(*) FROM users WHERE role = 'alumni' AND account IN ('active','unclaimed')) alumni,
    (SELECT count(*) FROM milestones WHERE status = 'verified' AND kind IN ('achievement','exam','research')) verified,
    (SELECT count(*) FROM users WHERE account = 'active' AND last_seen >= datetime('now','-90 days')) active,
    (SELECT count(*) FROM users WHERE role = 'alumni' AND mentor = 1 AND account = 'active') mentors`));
});

app.post('/api/auth/login', (req, res) => {
  const u = q.get('SELECT * FROM users WHERE email = ?', str(req.body.email, 200).toLowerCase());
  if (!u || !checkPassword(req.body.password || '', u.pass)) return fail(res, 401, 'Email or password is wrong.');
  if (u.account === 'pending') return fail(res, 403, 'Your registration is waiting for IQAC to verify it against college records.');
  if (u.account !== 'active') return fail(res, 403, 'This account is not active. Contact the IQAC office.');
  startSession(res, u.id);
  res.json({ user: publicUser(u, u) });
});
app.post('/api/auth/logout', (req, res) => {
  const t = cookies(req).sid; if (t) q.run('DELETE FROM sessions WHERE token = ?', t);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.post('/api/auth/register', (req, res) => {
  const b = req.body, role = b.role === 'alumni' ? 'alumni' : 'student';
  const name = str(b.name, 80), email = str(b.email, 200).toLowerCase(), cid = str(b.college_id, 20).toUpperCase();
  const adm = Number(b.adm_year), grad = role === 'alumni' ? Number(b.grad_year) : null;
  if (name.length < 3) return fail(res, 400, 'Enter your full name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 400, 'Enter a valid email address.');
  if (String(b.password || '').length < 8) return fail(res, 400, 'Use a password with at least 8 characters.');
  if (!DEPTS()[b.dept]) return fail(res, 400, 'Pick your department.');
  if (!(adm >= 1990 && adm <= new Date().getFullYear())) return fail(res, 400, 'Enter your admission year.');
  if (role === 'alumni' && !(grad > adm && grad <= new Date().getFullYear())) return fail(res, 400, 'Enter your graduation year.');
  if (!cid) return fail(res, 400, 'Enter your college roll number.');
  const paper = q.get(`SELECT * FROM users WHERE college_id = ? AND account = 'unclaimed'`, cid);
  if (paper) {
    if (q.get('SELECT 1 FROM users WHERE email = ? AND id != ?', email, paper.id)) return fail(res, 409, 'An account with this email already exists.');
    q.run(`UPDATE users SET email = ?, pass = ?, account = 'pending', accepts = 1 WHERE id = ?`, email, hashPassword(b.password), paper.id);
    return res.json({ ok: true, message: 'We found your record from the college register. IQAC will confirm it’s you, then you can log in.' });
  }
  if (q.get('SELECT 1 FROM users WHERE email = ? OR college_id = ?', email, cid)) return fail(res, 409, 'An account with this email or roll number already exists.');
  q.run(`INSERT INTO users (email, pass, role, name, dept, adm_year, grad_year, college_id, headline, account) VALUES (?,?,?,?,?,?,?,?,?, 'pending')`,
    email, hashPassword(b.password), role, name, b.dept, adm, grad, cid, `${DEPTS()[b.dept].course}${grad ? ', class of ' + grad : ' student'}`);
  res.json({ ok: true, message: 'Registration sent. IQAC will check it against college records, then you can log in.' });
});

/* ---------- me ---------- */
app.get('/api/me', auth(), (req, res) => {
  const counts = q.get(`SELECT
    (SELECT count(*) FROM chat_requests WHERE to_id = ? AND status = 'pending') requests,
    (SELECT count(*) FROM messages m JOIN chats c ON c.id = m.chat_id WHERE (c.a_id = ? OR c.b_id = ?) AND m.sender_id != ? AND m.read_at IS NULL) unread`,
    req.user.id, req.user.id, req.user.id, req.user.id);
  if (req.user.role === 'admin') { counts.requests = 0; counts.unread = 0; }
  res.json({ user: publicUser(req.user, req.user), counts: { ...counts, queue: queueCount(req.user) } });
});
app.patch('/api/me', auth(), (req, res) => {
  const b = req.body, u = req.user;
  const list = (v, n) => Array.isArray(v) ? v.map(x => str(x, 60)).filter(Boolean).slice(0, n) : undefined;
  const fields = {
    headline: b.headline !== undefined ? str(b.headline, 140) : u.headline,
    about: b.about !== undefined ? str(b.about, 1200) : u.about,
    location: b.location !== undefined ? str(b.location, 80) : u.location,
    skills: JSON.stringify(list(b.skills, 15) ?? JSON.parse(u.skills)),
    links: JSON.stringify(list(b.links, 5) ?? JSON.parse(u.links)),
    topics: JSON.stringify(list(b.topics, 8) ?? JSON.parse(u.topics)),
    mentor: b.mentor !== undefined ? (b.mentor ? 1 : 0) : u.mentor,
    accepts: b.accepts !== undefined ? (b.accepts ? 1 : 0) : u.accepts
  };
  q.run('UPDATE users SET headline=?, about=?, location=?, skills=?, links=?, topics=?, mentor=?, accepts=? WHERE id=?',
    fields.headline, fields.about, fields.location, fields.skills, fields.links, fields.topics, fields.mentor, fields.accepts, u.id);
  res.json({ user: publicUser(q.get('SELECT * FROM users WHERE id = ?', u.id), req.user) });
});
app.post('/api/me/status', auth('alumni'), (req, res) => {
  const status = STATUSES.includes(req.body.status) ? req.body.status : null, title = str(req.body.title, 140), month = str(req.body.month, 7);
  if (!status) return fail(res, 400, 'Pick what you’re doing now.');
  if (status === 'Not reported') { q.run('UPDATE users SET status=?, now_title=NULL, status_updated=? WHERE id=?', status, now().slice(0, 10), req.user.id); return res.json({ ok: true }); }
  if (title.length < 3) return fail(res, 400, 'Add your role, course or exam.');
  if (!/^\d{4}-\d{2}$/.test(month) || month > thisMonth()) return fail(res, 400, 'Pick the month this started.');
  if (!title.toLowerCase().includes('since') && title === req.user.now_title) {
    q.run('UPDATE users SET status_updated = ? WHERE id = ?', now().slice(0, 10), req.user.id);
    return res.json({ ok: true, message: 'Thanks, your status is confirmed.' });
  }
  q.run(`INSERT INTO milestones (user_id, kind, title, org, month, meta, status, verifier_id) VALUES (?,?,?,?,?,?, 'pending', ?)`,
    req.user.id, STATUS_KIND[status], title, str(req.body.org, 120), month, JSON.stringify({ status, sector: str(req.body.sector, 30) || null }), routeFor(req.user));
  res.json({ ok: true, message: 'Sent to IQAC. Your profile keeps the current status until it’s approved.' });
});

app.post('/api/me/image', auth(), (req, res) => {
  const kind = req.body.kind === 'banner' ? 'banner' : req.body.kind === 'avatar' ? 'avatar' : null;
  if (!kind) return fail(res, 400, 'Unknown image type.');
  const old = req.user[kind];
  let value = null;
  if (kind === 'banner' && req.body.preset) {
    if (!BANNERS.includes(req.body.preset)) return fail(res, 400, 'Pick one of the banner colours.');
    value = 'preset:' + req.body.preset;
  } else if (!req.body.remove) {
    const ext = String(req.body.name || '').split('.').pop().toLowerCase();
    if (!IMAGE_TYPES[ext]) return fail(res, 400, 'Upload a PNG, JPG or WebP image.');
    const buf = Buffer.from(String(req.body.data || ''), 'base64');
    if (!buf.length || buf.length > 4 * 1024 * 1024) return fail(res, 400, 'The image must be smaller than 4 MB.');
    value = `${kind}-${crypto.randomBytes(12).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, value), buf);
  }
  q.run(`UPDATE users SET ${kind} = ? WHERE id = ?`, value, req.user.id);
  if (old && !old.startsWith('preset:')) fs.rm(path.join(UPLOAD_DIR, path.basename(old)), () => {});
  res.json({ user: publicUser(q.get('SELECT * FROM users WHERE id = ?', req.user.id), req.user) });
});
app.get('/api/images/:name', auth(), (req, res) => {
  const name = path.basename(req.params.name), ext = name.split('.').pop();
  if (!/^(avatar|banner)-[a-f0-9]+\.\w+$/.test(name) || !IMAGE_TYPES[ext]) return fail(res, 404, 'Not found.');
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return fail(res, 404, 'Not found.');
  res.setHeader('Content-Type', IMAGE_TYPES[ext]);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  fs.createReadStream(file).pipe(res);
});

/* ---------- dashboard ---------- */
app.get('/api/dashboard', auth(), (req, res) => {
  const u = req.user, ms = q.all('SELECT * FROM milestones WHERE user_id = ?', u.id);
  const chats = chatList(u.id).slice(0, 4);
  const reqIn = q.all(`SELECT r.*, u.name, u.headline, u.avatar FROM chat_requests r JOIN users u ON u.id = r.from_id WHERE r.to_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`, u.id);
  const reqOut = q.all(`SELECT status FROM chat_requests WHERE from_id = ?`, u.id);
  const linkedIds = chats.map(c => c.partner.id);
  const suggestions = q.all(`SELECT u.* FROM users u WHERE u.role = ? AND u.account = 'active' AND u.id != ? AND ${u.role === 'student' ? 'u.mentor = 1 AND' : ''} u.dept = ?
      ORDER BY (u.about != '') DESC, ${vcountSql} DESC LIMIT 6`, u.role === 'alumni' ? 'student' : 'alumni', u.id, u.dept)
    .filter(x => !linkedIds.includes(x.id)).slice(0, 3).map(x => publicUser(x, u));
  reqIn.forEach(r => { r.avatar_url = img(r.avatar); delete r.avatar; });
  // Activity feed for the calendar: things that happened to this person.
  const activity = [
    ...q.all(`SELECT m.submitted_at at, 'Sent for verification: ' || m.title text, 'pending' type FROM milestones m WHERE m.user_id = ? AND m.status IN ('pending','info')`, u.id),
    ...q.all(`SELECT m.verified_at at, 'Verified: ' || m.title text, 'verified' type FROM milestones m WHERE m.user_id = ? AND m.status = 'verified' AND m.verified_at IS NOT NULL`, u.id),
    ...reqIn.map(r => ({ at: r.created_at, text: `${r.name} sent a ${r.purpose.toLowerCase()} request`, type: 'request' })),
    ...q.all(`SELECT r.decided_at at, x.name || ' accepted your chat request' text, 'chat' type FROM chat_requests r JOIN users x ON x.id = r.to_id WHERE r.from_id = ? AND r.status = 'accepted'`, u.id),
    ...q.all(`SELECT max(m.created_at) at, 'New message from ' || x.name text, 'message' type FROM messages m JOIN chats c ON c.id = m.chat_id JOIN users x ON x.id = m.sender_id
       WHERE (c.a_id = ? OR c.b_id = ?) AND m.sender_id != ? GROUP BY c.id`, u.id, u.id, u.id)
  ].filter(a => a.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const achievements = q.all(`${MS_SELECT} WHERE m.user_id = ? AND m.kind IN ('achievement','exam','research','project') ORDER BY m.month DESC LIMIT 4`, u.id).map(m => shapeMilestone(m, u));
  const verifiedPct = ms.length ? Math.round(ms.filter(m => m.status === 'verified').length / ms.length * 100) : 0;
  const sentDecided = reqOut.filter(r => r.status !== 'pending');
  const recvAll = q.all('SELECT status FROM chat_requests WHERE to_id = ?', u.id).filter(r => r.status !== 'pending');
  const rings = u.role === 'alumni'
    ? [{ label: 'Profile strength', pct: strength(u, ms).pct }, { label: 'Requests accepted', pct: recvAll.length ? Math.round(recvAll.filter(r => r.status === 'accepted').length / recvAll.length * 100) : 0 },
       { label: 'Milestones verified', pct: verifiedPct }]
    : [{ label: 'Profile strength', pct: strength(u, ms).pct }, { label: 'Milestones verified', pct: verifiedPct },
       { label: 'Requests accepted', pct: sentDecided.length ? Math.round(sentDecided.filter(r => r.status === 'accepted').length / sentDecided.length * 100) : 0 }];
  res.json({ user: publicUser(u, u), strength: strength(u, ms), chats, requests: reqIn, suggestions, activity, achievements, rings });
});

/* ---------- people ---------- */
const PATHS = {
  exam: `EXISTS (SELECT 1 FROM milestones x WHERE x.user_id = u.id AND x.status = 'verified' AND x.kind = 'exam')`,
  research: `(u.status = 'Research' OR EXISTS (SELECT 1 FROM milestones x WHERE x.user_id = u.id AND x.status = 'verified' AND x.kind = 'research'))`,
  study: `u.status = 'Higher studies'`,
  tech: `u.sector = 'Tech'`,
  finance: `u.sector = 'Finance'`,
  govt: `u.status = 'Govt services'`,
  startup: `(u.status = 'Entrepreneurship' OR EXISTS (SELECT 1 FROM milestones x WHERE x.user_id = u.id AND x.status = 'verified' AND x.category = 'startup'))`,
  sports: `EXISTS (SELECT 1 FROM milestones x WHERE x.user_id = u.id AND x.status = 'verified' AND x.category = 'sports' AND x.level IN ('National','International'))`
};
app.get('/api/people', auth(), (req, res) => {
  const where = [`u.account = 'active'`, `u.role IN ('student','alumni')`, 'u.id != ?'], p = [req.user.id];
  if (['student', 'alumni'].includes(req.query.role)) { where.push('u.role = ?'); p.push(req.query.role); }
  if (req.query.dept) { where.push('u.dept = ?'); p.push(String(req.query.dept)); }
  if (req.query.mentor === '1') where.push('u.mentor = 1');
  if (req.query.grad) { where.push('u.grad_year = ?'); p.push(Number(req.query.grad)); }
  if (PATHS[req.query.path]) where.push(PATHS[req.query.path]);
  const term = str(req.query.q, 80);
  if (term) {
    const like = '%' + term.replace(/[%_]/g, '') + '%';
    where.push(`(u.name LIKE ? OR u.headline LIKE ? OR u.now_title LIKE ? OR u.skills LIKE ? OR EXISTS (SELECT 1 FROM milestones x WHERE x.user_id = u.id AND x.status = 'verified' AND x.title LIKE ?))`);
    p.push(like, like, like, like, like);
  }
  const limit = Math.min(Number(req.query.limit) || 24, 60), offset = Math.max(Number(req.query.offset) || 0, 0);
  const total = q.get(`SELECT count(*) n FROM users u WHERE ${where.join(' AND ')}`, ...p).n;
  const rows = q.all(`SELECT u.*, ${vcountSql} vcount FROM users u WHERE ${where.join(' AND ')}
    ORDER BY (u.about != '') DESC, vcount DESC, u.name LIMIT ? OFFSET ?`, ...p, limit, offset);
  const people = rows.map(r => ({
    ...publicUser(r, req.user), verified: r.vcount, relation: relation(req.user.id, r.id),
    path: q.all(`SELECT kind, title, month FROM milestones WHERE user_id = ? AND status = 'verified' AND kind IN ('achievement','exam','research','position','internship','job','startup','phd','study') ORDER BY month DESC LIMIT 4`, r.id).reverse()
  }));
  res.json({ total, people });
});
app.get('/api/people/:id', auth(), (req, res) => {
  const staffView = ['admin', 'faculty'].includes(req.user.role);
  const u = q.get(`SELECT * FROM users WHERE id = ? AND (account = 'active' OR (? AND account = 'unclaimed'))`, Number(req.params.id), staffView ? 1 : 0);
  if (!u) return fail(res, 404, 'Profile not found.');
  const ms = q.all('SELECT * FROM milestones WHERE user_id = ?', u.id);
  const similar = q.all(`SELECT u.* FROM users u WHERE u.account = 'active' AND u.role IN ('student','alumni') AND u.id NOT IN (?, ?) AND (u.dept = ? OR (u.status IS NOT NULL AND u.status = ?))
    ORDER BY (u.about != '') DESC, ${vcountSql} DESC LIMIT 3`, u.id, req.user.id, u.dept, u.status).map(x => publicUser(x, req.user));
  res.json({
    user: publicUser(u, req.user), milestones: milestonesFor(u.id, req.user),
    relation: u.id === req.user.id ? { kind: 'self' } : u.account === 'unclaimed' ? { kind: 'none' } : relation(req.user.id, u.id),
    unclaimed: u.account === 'unclaimed',
    strength: u.id === req.user.id ? strength(u, ms) : null, similar
  });
});

/* ---------- milestones + proof files ---------- */
app.post('/api/milestones', auth('student', 'alumni'), (req, res) => {
  const b = req.body, kind = KINDS.includes(b.kind) ? b.kind : null;
  const title = str(b.title, 160), month = str(b.month, 7), level = LEVELS.includes(b.level) ? b.level : null;
  if (!kind) return fail(res, 400, 'Pick what kind of milestone this is.');
  if (title.length < 3) return fail(res, 400, 'Add a title.');
  if (!/^\d{4}-\d{2}$/.test(month) || month > thisMonth()) return fail(res, 400, 'Pick the month it happened. It can’t be in the future.');
  let proofType = null, proofRef = null, proofLabel = null;
  if (b.proof && b.proof.type === 'file') {
    const ext = String(b.proof.name || '').split('.').pop().toLowerCase();
    if (!FILE_TYPES[ext]) return fail(res, 400, 'Upload a PDF, PNG or JPG.');
    const buf = Buffer.from(String(b.proof.data || ''), 'base64');
    if (!buf.length || buf.length > 5 * 1024 * 1024) return fail(res, 400, 'The file must be smaller than 5 MB.');
    proofRef = crypto.randomBytes(16).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, proofRef), buf);
    proofType = 'file'; proofLabel = str(b.proof.name, 120);
  } else if (b.proof && b.proof.type === 'link') {
    try { const url = new URL(String(b.proof.url)); if (!/^https?:$/.test(url.protocol)) throw 0; proofRef = url.href; } catch { return fail(res, 400, 'Enter a link that starts with https://'); }
    proofType = 'link'; proofLabel = url_label(proofRef);
  } else if (ACH.includes(kind)) return fail(res, 400, 'Achievements need proof: a certificate or a link.');
  const verifier = routeFor(req.user);
  const r = q.run(`INSERT INTO milestones (user_id, kind, category, title, org, level, month, description, proof_type, proof_ref, proof_label, verifier_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, req.user.id, kind, str(b.category, 20) || null, title, str(b.org, 120), level, month, str(b.description, 600),
    proofType, proofRef, proofLabel, verifier);
  const m = q.get(`${MS_SELECT} WHERE m.id = ?`, Number(r.lastInsertRowid));
  res.json({ milestone: shapeMilestone(m, req.user) });
});
function url_label(href) { try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return 'Link'; } }
app.delete('/api/milestones/:id', auth(), (req, res) => {
  const m = q.get('SELECT * FROM milestones WHERE id = ? AND user_id = ?', Number(req.params.id), req.user.id);
  if (!m) return fail(res, 404, 'Not found.');
  if (m.status === 'verified') return fail(res, 400, 'Verified milestones can only be removed by IQAC.');
  q.run('DELETE FROM milestones WHERE id = ?', m.id);
  res.json({ ok: true });
});
app.get('/api/files/:name', auth(), (req, res) => {
  const name = path.basename(req.params.name);
  const m = q.get('SELECT * FROM milestones WHERE proof_ref = ? AND proof_type = ?', name, 'file');
  if (!m) return fail(res, 404, 'File not found.');
  const allowed = m.status === 'verified' || m.user_id === req.user.id || req.user.role === 'admin' || m.verifier_id === req.user.id;
  if (!allowed) return fail(res, 403, 'This proof is visible only to the owner and verifiers until it’s verified.');
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return fail(res, 404, 'File missing.');
  res.setHeader('Content-Type', FILE_TYPES[name.split('.').pop()] || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  fs.createReadStream(file).pipe(res);
});

/* ---------- verification ---------- */
function queueCount(u) {
  if (u.role === 'faculty') return q.get(`SELECT count(*) n FROM milestones WHERE verifier_id = ? AND status IN ('pending','info')`, u.id).n;
  if (u.role === 'admin') return q.get(`SELECT (SELECT count(*) FROM milestones WHERE status IN ('pending','info'))
    + (SELECT count(*) FROM users WHERE account = 'pending') + (SELECT count(*) FROM reports WHERE status = 'open') n`).n;
  return 0;
}
app.get('/api/verify', auth('faculty', 'admin'), (req, res) => {
  const mine = req.user.role === 'faculty';
  const items = q.all(`${MS_SELECT.replace('SELECT m.*', 'SELECT m.*, o.name oname, o.dept odept, o.college_id ocid, o.role orole, o.adm_year oadm, o.grad_year ograd, o.avatar oavatar')}
    JOIN users o ON o.id = m.user_id WHERE m.status IN ('pending','info') ${mine ? 'AND m.verifier_id = ?' : ''} ORDER BY m.submitted_at`, ...(mine ? [req.user.id] : []))
    .map(m => ({ type: 'milestone', id: m.id, submitted_at: m.submitted_at, status: m.status, meta: m.meta ? JSON.parse(m.meta) : null,
      person: { id: m.user_id, name: m.oname, dept: m.odept, college_id: m.ocid, role: m.orole, adm_year: m.oadm, grad_year: m.ograd, avatar_url: img(m.oavatar) }, milestone: shapeMilestone(m, req.user) }));
  if (!mine) {
    for (const u of q.all(`SELECT * FROM users WHERE account = 'pending' ORDER BY created_at`)) {
      const match = q.get(`SELECT count(*) n FROM users WHERE dept = ? AND (grad_year = ? OR adm_year = ?) AND account = 'active'`, u.dept, u.grad_year, u.adm_year).n;
      items.push({ type: 'account', id: u.id, submitted_at: u.created_at, status: 'pending', person: { ...publicUser(u, req.user), college_id: u.college_id, email: u.email },
        check: `Roll number ${u.college_id}. ${match} other records on file for this department and batch.` });
    }
    for (const r of q.all(`SELECT r.*, a.name rname, b.name tname FROM reports r JOIN users a ON a.id = r.reporter_id JOIN users b ON b.id = r.user_id WHERE r.status = 'open'`))
      items.push({ type: 'report', id: r.id, submitted_at: r.created_at, status: 'pending', person: { id: r.user_id, name: r.tname }, reason: r.reason, details: r.details, reporter: r.rname });
  }
  res.json({ items });
});
app.post('/api/verify/milestone/:id', auth('faculty', 'admin'), (req, res) => {
  const m = q.get('SELECT m.*, u.name uname FROM milestones m JOIN users u ON u.id = m.user_id WHERE m.id = ?', Number(req.params.id));
  if (!m) return fail(res, 404, 'Not found.');
  if (req.user.role !== 'admin' && m.verifier_id !== req.user.id) return fail(res, 403, 'This item is routed to someone else.');
  const action = req.body.action, note = str(req.body.note, 400);
  if (action === 'approve') {
    q.tx(() => {
      q.run(`UPDATE milestones SET status = 'verified', verified_by = ?, verified_at = ?, note = NULL WHERE id = ?`, req.user.id, now(), m.id);
      if (m.meta) {
        const meta = JSON.parse(m.meta);
        if (meta.status) q.run('UPDATE users SET status = ?, now_title = ?, sector = ?, status_updated = ?, headline = ? WHERE id = ?', meta.status, m.title, meta.sector, now().slice(0, 10), m.title, m.user_id);
      }
    });
    audit(req.user.id, 'Approved milestone', `${m.title} · ${m.uname}`);
  } else if (action === 'reject' || action === 'info') {
    if (!note) return fail(res, 400, action === 'reject' ? 'Add a reason so they know what to fix.' : 'Say what extra information you need.');
    q.run('UPDATE milestones SET status = ?, note = ? WHERE id = ?', action === 'reject' ? 'rejected' : 'info', note, m.id);
    audit(req.user.id, action === 'reject' ? 'Rejected milestone' : 'Asked for more information', `${m.title} · ${m.uname}: ${note}`);
  } else return fail(res, 400, 'Unknown action.');
  res.json({ ok: true });
});
app.post('/api/milestones/:id/resubmit', auth(), (req, res) => {
  const m = q.get(`SELECT * FROM milestones WHERE id = ? AND user_id = ? AND status IN ('info','rejected')`, Number(req.params.id), req.user.id);
  if (!m) return fail(res, 404, 'Not found.');
  const desc = str(req.body.description, 600);
  q.run(`UPDATE milestones SET status = 'pending', description = CASE WHEN ? != '' THEN ? ELSE description END, submitted_at = ? WHERE id = ?`, desc, desc, now(), m.id);
  res.json({ ok: true });
});
app.post('/api/verify/account/:id', auth('admin'), (req, res) => {
  const u = q.get(`SELECT * FROM users WHERE id = ? AND account = 'pending'`, Number(req.params.id));
  if (!u) return fail(res, 404, 'Not found.');
  const ok = req.body.action === 'approve';
  q.run('UPDATE users SET account = ? WHERE id = ?', ok ? 'active' : 'rejected', u.id);
  audit(req.user.id, ok ? 'Approved registration' : 'Rejected registration', `${u.name} (${u.college_id})`);
  res.json({ ok: true });
});
app.post('/api/verify/report/:id', auth('admin'), (req, res) => {
  const r = q.get(`SELECT r.*, u.name FROM reports r JOIN users u ON u.id = r.user_id WHERE r.id = ? AND r.status = 'open'`, Number(req.params.id));
  if (!r) return fail(res, 404, 'Not found.');
  const st = req.body.action === 'approve' ? 'resolved' : 'dismissed';
  q.run('UPDATE reports SET status = ? WHERE id = ?', st, r.id);
  audit(req.user.id, st === 'resolved' ? 'Resolved report' : 'Dismissed report', `${r.name}: ${r.reason}`);
  res.json({ ok: true });
});
app.post('/api/reports', auth(), (req, res) => {
  const target = q.get('SELECT id FROM users WHERE id = ?', Number(req.body.user_id));
  const reason = str(req.body.reason, 80), details = str(req.body.details, 600);
  if (!target || !reason || !details) return fail(res, 400, 'Pick a reason and add details.');
  q.run('INSERT INTO reports (reporter_id, user_id, reason, details) VALUES (?,?,?,?)', req.user.id, target.id, reason, details);
  res.json({ ok: true });
});

/* ---------- chat requests + chats ---------- */
// Chat is for students, alumni and faculty. The IQAC admin account does not chat.
const chatUser = auth('student', 'alumni', 'faculty');
app.post('/api/requests', chatUser, (req, res) => {
  const to = q.get(`SELECT * FROM users WHERE id = ? AND account = 'active'`, Number(req.body.to));
  const purpose = PURPOSES.includes(req.body.purpose) ? req.body.purpose : null, note = str(req.body.note, 300);
  if (!to || to.id === req.user.id) return fail(res, 400, 'Pick someone to send the request to.');
  if (to.role === 'admin') return fail(res, 400, 'The IQAC office can’t be messaged here. Use the college’s official contact.');
  if (!to.accepts) return fail(res, 400, `${to.name} isn’t taking chat requests right now.`);
  if (!purpose) return fail(res, 400, 'Pick what the request is about.');
  if (note.length < 10) return fail(res, 400, 'Add a short note (at least 10 characters) so they know who you are.');
  if (relation(req.user.id, to.id).kind !== 'none') return fail(res, 409, 'You already have a request or chat with this person.');
  q.run('INSERT INTO chat_requests (from_id, to_id, purpose, note) VALUES (?,?,?,?)', req.user.id, to.id, purpose, note);
  res.json({ ok: true });
});
app.get('/api/requests', chatUser, (req, res) => {
  const cols = 'r.id, r.purpose, r.note, r.status, r.created_at, u.id uid, u.name, u.headline, u.role, u.dept, u.avatar';
  const shape = rows => rows.map(r => ({ ...r, avatar_url: img(r.avatar), avatar: undefined }));
  res.json({
    received: shape(q.all(`SELECT ${cols} FROM chat_requests r JOIN users u ON u.id = r.from_id WHERE r.to_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`, req.user.id)),
    sent: shape(q.all(`SELECT ${cols} FROM chat_requests r JOIN users u ON u.id = r.to_id WHERE r.from_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`, req.user.id))
  });
});
app.post('/api/requests/:id/:action', chatUser, (req, res) => {
  const r = q.get(`SELECT * FROM chat_requests WHERE id = ? AND status = 'pending'`, Number(req.params.id));
  if (!r) return fail(res, 404, 'This request is no longer open.');
  const act = req.params.action;
  if (act === 'withdraw') {
    if (r.from_id !== req.user.id) return fail(res, 403, 'Not your request.');
    q.run(`UPDATE chat_requests SET status = 'withdrawn', decided_at = ? WHERE id = ?`, now(), r.id); return res.json({ ok: true });
  }
  if (r.to_id !== req.user.id) return fail(res, 403, 'Only the person who received this request can answer it.');
  if (act === 'decline') { q.run(`UPDATE chat_requests SET status = 'declined', decided_at = ? WHERE id = ?`, now(), r.id); return res.json({ ok: true }); }
  if (act !== 'accept') return fail(res, 400, 'Unknown action.');
  const chatId = q.tx(() => {
    q.run(`UPDATE chat_requests SET status = 'accepted', decided_at = ? WHERE id = ?`, now(), r.id);
    const [a, b] = r.from_id < r.to_id ? [r.from_id, r.to_id] : [r.to_id, r.from_id];
    const id = Number(q.run('INSERT INTO chats (a_id, b_id, purpose) VALUES (?,?,?)', a, b, r.purpose).lastInsertRowid);
    q.run('INSERT INTO messages (chat_id, sender_id, body, created_at) VALUES (?,?,?,?)', id, r.from_id, r.note, r.created_at);
    return id;
  });
  res.json({ ok: true, chat_id: chatId });
});
function chatList(uid) {
  return q.all(`SELECT c.*, (SELECT body FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) last_body,
      (SELECT sender_id FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) last_sender,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) last_at,
      (SELECT count(*) FROM messages WHERE chat_id = c.id AND sender_id != ? AND read_at IS NULL) unread
    FROM chats c WHERE c.a_id = ? OR c.b_id = ? ORDER BY last_at DESC`, uid, uid, uid)
    .map(c => { const p = q.get('SELECT * FROM users WHERE id = ?', c.a_id === uid ? c.b_id : c.a_id);
      return { id: c.id, purpose: c.purpose, created_at: c.created_at, last: c.last_body, last_mine: c.last_sender === uid, last_at: c.last_at, unread: c.unread,
        partner: { id: p.id, name: p.name, headline: p.headline, role: p.role, avatar_url: img(p.avatar) } }; });
}
function chatFor(req, res) {
  const c = q.get('SELECT * FROM chats WHERE id = ?', Number(req.params.id));
  if (!c || (c.a_id !== req.user.id && c.b_id !== req.user.id)) { fail(res, 404, 'Chat not found.'); return null; }
  return c;
}
app.get('/api/chats', chatUser, (req, res) => res.json({ chats: chatList(req.user.id) }));
app.get('/api/chats/:id/messages', chatUser, (req, res) => {
  const c = chatFor(req, res); if (!c) return;
  const after = Number(req.query.after) || 0;
  const msgs = q.all('SELECT id, sender_id, body, created_at FROM messages WHERE chat_id = ? AND id > ? ORDER BY id', c.id, after);
  q.run('UPDATE messages SET read_at = ? WHERE chat_id = ? AND sender_id != ? AND read_at IS NULL', now(), c.id, req.user.id);
  const p = q.get('SELECT * FROM users WHERE id = ?', c.a_id === req.user.id ? c.b_id : c.a_id);
  res.json({ chat: { id: c.id, purpose: c.purpose, created_at: c.created_at, partner: publicUser(p, req.user) }, messages: msgs });
});
app.post('/api/chats/:id/messages', chatUser, (req, res) => {
  const c = chatFor(req, res); if (!c) return;
  const body = str(req.body.body, 2000);
  if (!body) return fail(res, 400, 'Write a message first.');
  const r = q.run('INSERT INTO messages (chat_id, sender_id, body) VALUES (?,?,?)', c.id, req.user.id, body);
  res.json({ message: q.get('SELECT id, sender_id, body, created_at FROM messages WHERE id = ?', Number(r.lastInsertRowid)) });
});

/* ---------- wall of fame ---------- */
const FAME = [['research', 'Researcher of the Year'], ['sports', 'Sports Star'], ['exam', 'Competitive Exams'], ['startup', 'Entrepreneur of the Year'], ['tech', 'Tech & Innovation'], ['cultural', 'Arts & Debate']];
app.get('/api/fame', auth(), (req, res) => {
  const ay = Number(req.query.ay) || curAY() - 1;
  const rank = `CASE m.level WHEN 'International' THEN 4 WHEN 'National' THEN 3 WHEN 'State' THEN 2 WHEN 'University' THEN 1 ELSE 0 END`;
  const cats = FAME.map(([cat, label]) => ({ cat, label, entries: q.all(`SELECT m.id, m.title, m.level, m.month, u.id uid, u.name, u.role, u.avatar, u.dept, u.grad_year, u.adm_year
      FROM milestones m JOIN users u ON u.id = m.user_id WHERE m.status = 'verified' AND m.category = ? AND m.month BETWEEN ? AND ?
      ORDER BY ${rank} DESC, (u.about != '') DESC, m.month DESC LIMIT 4`, cat, `${ay}-07`, `${ay + 1}-06`).map(e => ({ ...e, avatar_url: img(e.avatar) })) }));
  const spotlight = q.all(`SELECT u.id, u.name, u.headline, u.dept, u.grad_year, u.avatar, count(r.id) accepted FROM users u JOIN chat_requests r ON r.to_id = u.id AND r.status = 'accepted'
    WHERE u.role = 'alumni' GROUP BY u.id ORDER BY accepted DESC LIMIT 3`).map(e => ({ ...e, avatar_url: img(e.avatar) }));
  res.json({ ay, categories: cats, spotlight });
});

/* ---------- admin ---------- */
app.get('/api/admin/overview', auth('admin'), (req, res) => {
  const d = req.query.dept && DEPTS()[req.query.dept] ? req.query.dept : null;
  const df = d ? 'AND u.dept = ?' : '', dp = d ? [d] : [];
  const k = q.get(`SELECT
    (SELECT count(*) FROM users u WHERE role = 'alumni' AND account IN ('active','unclaimed') ${df}) alumni,
    (SELECT count(*) FROM users u WHERE role = 'student' AND account = 'active' ${df}) students,
    (SELECT count(*) FROM milestones m JOIN users u ON u.id = m.user_id WHERE m.status = 'verified' AND m.kind IN ('achievement','exam','research') ${df}) verified,
    (SELECT count(*) FROM milestones m JOIN users u ON u.id = m.user_id WHERE m.status IN ('pending','info') ${df}) pending,
    (SELECT count(*) FROM users u WHERE role = 'alumni' AND mentor = 1 AND account = 'active' ${df}) mentors,
    (SELECT count(*) FROM users u WHERE role = 'alumni' AND account IN ('active','unclaimed') AND (status_updated IS NULL OR status_updated < date('now','-2 years')) ${df}) stale,
    (SELECT count(*) FROM users WHERE account = 'pending') registrations,
    (SELECT count(*) FROM chat_requests r JOIN users u ON u.id = r.to_id WHERE 1 ${df}) requests,
    (SELECT count(*) FROM chat_requests r JOIN users u ON u.id = r.to_id WHERE r.status = 'accepted' ${df}) accepted`, ...dp, ...dp, ...dp, ...dp, ...dp, ...dp, ...dp, ...dp);
  k.departments = d ? 1 : q.get('SELECT count(*) n FROM departments').n;
  const byLevel = LEVELS.map(l => ({ label: l, value: q.get(`SELECT count(*) n FROM milestones m JOIN users u ON u.id = m.user_id WHERE m.status = 'verified' AND m.kind IN ('achievement','exam','research') AND m.level = ? ${df}`, l, ...dp).n }));
  const outcomes = STATUSES.map(s => ({ label: s, value: q.get(`SELECT count(*) n FROM users u WHERE role = 'alumni' AND account IN ('active','unclaimed') AND coalesce(status,'Not reported') = ? ${df}`, s, ...dp).n }));
  const byYear = q.all(`SELECT grad_year label, count(*) value FROM users u WHERE role = 'alumni' AND account IN ('active','unclaimed') ${df} GROUP BY grad_year ORDER BY grad_year`, ...dp);
  const byDept = q.all(`SELECT d.name label, count(m.id) value FROM departments d LEFT JOIN users u ON u.dept = d.code LEFT JOIN milestones m ON m.user_id = u.id AND m.status = 'verified' AND m.kind IN ('achievement','exam','research') GROUP BY d.code ORDER BY value DESC`);
  res.json({ kpis: k, byLevel, outcomes, byYear, byDept });
});
app.get('/api/admin/records', auth('admin'), (req, res) => {
  const where = [`u.role IN ('student','alumni')`], p = [];
  if (req.query.dept) { where.push('u.dept = ?'); p.push(req.query.dept); }
  if (['student', 'alumni'].includes(req.query.role)) { where.push('u.role = ?'); p.push(req.query.role); }
  if (req.query.stale === '1') where.push(`u.role = 'alumni' AND (u.status_updated IS NULL OR u.status_updated < date('now','-2 years'))`);
  const t = str(req.query.q, 60);
  if (t) { where.push('(u.name LIKE ? OR u.college_id LIKE ? OR u.email LIKE ?)'); p.push(`%${t}%`, `%${t}%`, `%${t}%`); }
  const page = Math.max(Number(req.query.page) || 0, 0);
  const total = q.get(`SELECT count(*) n FROM users u WHERE ${where.join(' AND ')}`, ...p).n;
  const rows = q.all(`SELECT u.id, u.college_id, u.name, u.email, u.role, u.dept, u.adm_year, u.grad_year, u.status, u.now_title, u.status_updated, u.account, ${vcountSql} verified,
      (SELECT source FROM outcomes o WHERE o.user_id = u.id) form_source, (SELECT verified_at FROM outcomes o WHERE o.user_id = u.id) form_verified
    FROM users u WHERE ${where.join(' AND ')} ORDER BY u.id DESC LIMIT 25 OFFSET ?`, ...p, page * 25);
  res.json({ total, page, rows });
});
const REPORTS = {
  progression: { label: 'NAAC · Student progression', year: 'batch', run(y, d) {
    const head = ['Name', 'Roll number', 'Department', 'Outcome', 'Details'];
    const rows = q.all(`SELECT u.name, u.college_id, dp.name dept, coalesce(u.status,'Not reported') status, coalesce(u.now_title,'') now FROM users u JOIN departments dp ON dp.code = u.dept
      WHERE u.role = 'alumni' AND u.account IN ('active','unclaimed') AND u.grad_year = ? ${d ? 'AND u.dept = ?' : ''} ORDER BY dp.name, u.name`, y, ...(d ? [d] : [])).map(r => [r.name, r.college_id, r.dept, r.status, r.now]);
    return { head, rows, summary: STATUSES.map(s => [s, rows.filter(r => r[3] === s).length]) };
  } },
  awards: { label: 'NAAC · Awards and medals', year: 'ay', run(y, d) {
    const head = ['Name', 'Roll number', 'Department', 'Award', 'Level', 'Month', 'Verified by', 'Proof'];
    const rows = q.all(`SELECT u.name, u.college_id, dp.name dept, m.title, m.level, m.month, v.name vname, m.proof_type, m.proof_ref FROM milestones m
      JOIN users u ON u.id = m.user_id JOIN departments dp ON dp.code = u.dept LEFT JOIN users v ON v.id = m.verified_by
      WHERE m.status = 'verified' AND m.kind IN ('achievement','exam','research') AND m.level IN ('University','State','National','International')
      AND m.month BETWEEN ? AND ? ${d ? 'AND u.dept = ?' : ''} ORDER BY m.month`, `${y}-07`, `${y + 1}-06`, ...(d ? [d] : []))
      .map(r => [r.name, r.college_id, r.dept, r.title, r.level, r.month, r.vname || '', r.proof_type === 'link' ? r.proof_ref : r.proof_ref ? 'Uploaded certificate' : '']);
    return { head, rows, summary: LEVELS.slice(1).map(l => [l, rows.filter(r => r[4] === l).length]) };
  } },
  nirf: { label: 'NIRF · Graduation outcomes', year: 'batch', run(y, d) {
    const head = ['Department', 'Graduates', 'Placed', 'Higher studies', 'Placed %', 'Higher studies %'];
    const rows = q.all(`SELECT dp.name, count(u.id) g, sum(u.status = 'Job') pl, sum(u.status IN ('Higher studies','Research')) hs FROM departments dp
      LEFT JOIN users u ON u.dept = dp.code AND u.role = 'alumni' AND u.account IN ('active','unclaimed') AND u.grad_year = ? ${d ? 'WHERE dp.code = ?' : ''} GROUP BY dp.code ORDER BY dp.name`, y, ...(d ? [d] : []))
      .map(r => [r.name, r.g, r.pl || 0, r.hs || 0, r.g ? Math.round((r.pl || 0) / r.g * 100) + '%' : '—', r.g ? Math.round((r.hs || 0) / r.g * 100) + '%' : '—']);
    return { head, rows, summary: [['Graduates', rows.reduce((n, r) => n + r[1], 0)], ['Placed', rows.reduce((n, r) => n + r[2], 0)], ['Higher studies', rows.reduce((n, r) => n + r[3], 0)]] };
  } },
  engagement: { label: 'NAAC · Alumni engagement', year: 'none', run(y, d) {
    const head = ['Department', 'Alumni on record', 'Open to mentoring', 'Chat requests received', 'Accepted'];
    const rows = q.all(`SELECT dp.name, (SELECT count(*) FROM users u WHERE u.dept = dp.code AND u.role = 'alumni' AND u.account IN ('active','unclaimed')) al,
      (SELECT count(*) FROM users u WHERE u.dept = dp.code AND u.role = 'alumni' AND u.mentor = 1) me,
      (SELECT count(*) FROM chat_requests r JOIN users u ON u.id = r.to_id WHERE u.dept = dp.code AND u.role = 'alumni') rq,
      (SELECT count(*) FROM chat_requests r JOIN users u ON u.id = r.to_id WHERE u.dept = dp.code AND u.role = 'alumni' AND r.status = 'accepted') ac
      FROM departments dp ${d ? 'WHERE dp.code = ?' : ''} ORDER BY dp.name`, ...(d ? [d] : [])).map(r => [r.name, r.al, r.me, r.rq, r.ac]);
    return { head, rows, summary: [['Alumni', rows.reduce((n, r) => n + r[1], 0)], ['Mentors', rows.reduce((n, r) => n + r[2], 0)], ['Requests accepted', rows.reduce((n, r) => n + r[4], 0)]] };
  } }
};
app.get('/api/admin/reports/:type', auth('admin'), (req, res) => {
  const rep = REPORTS[req.params.type]; if (!rep) return fail(res, 404, 'Unknown report.');
  const y = Number(req.query.year) || (rep.year === 'ay' ? curAY() - 1 : new Date().getFullYear());
  const d = req.query.dept && DEPTS()[req.query.dept] ? req.query.dept : null;
  const out = rep.run(y, d);
  if (req.query.format === 'csv') {
    const cell = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
    audit(req.user.id, 'Exported report', `${rep.label}, ${y}${d ? ', ' + d : ''} (CSV)`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}-${y}.csv"`);
    return res.send([out.head, ...out.rows].map(r => r.map(cell).join(',')).join('\n'));
  }
  res.json({ label: rep.label, year: y, yearType: rep.year, ...out });
});
app.post('/api/admin/remind', auth('admin'), (req, res) => {
  const n = q.get(`SELECT count(*) n FROM users WHERE role = 'alumni' AND account = 'active' AND (status_updated IS NULL OR status_updated < date('now','-2 years'))`).n;
  audit(req.user.id, 'Sent status reminders', `${n} alumni`);
  res.json({ ok: true, count: n });
});
app.get('/api/admin/audit', auth('admin'), (req, res) => {
  res.json({ rows: q.all(`SELECT a.created_at, a.action, a.target, u.name actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 100`) });
});

/* ---------- alumni forms, digitisation, placements ---------- */
require('./records')(app, { auth, fail, audit, publicUser });

/* ---------- frontend ---------- */
app.use('/api', (req, res) => fail(res, 404, 'Unknown API route.'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

if (!q.get('SELECT 1 FROM users LIMIT 1')) console.log('Database is empty. Run `npm run seed` first.');
app.listen(PORT, () => console.log(`AlumniConnect running at http://localhost:${PORT}`));
