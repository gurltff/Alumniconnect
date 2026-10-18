// SQLite storage (built into Node 22). One file at data/alumniconnect.db.
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'alumniconnect.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS departments (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  course TEXT NOT NULL,
  society TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  pass TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','alumni','faculty','admin')),
  name TEXT NOT NULL,
  dept TEXT REFERENCES departments(code),
  adm_year INTEGER,
  grad_year INTEGER,
  college_id TEXT UNIQUE,
  headline TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  status TEXT,                 -- alumni: Job, Higher studies, Research, Govt services, Entrepreneurship, Not reported
  now_title TEXT,
  sector TEXT,
  status_updated TEXT,
  mentor INTEGER NOT NULL DEFAULT 0,
  accepts INTEGER NOT NULL DEFAULT 1,
  skills TEXT NOT NULL DEFAULT '[]',
  topics TEXT NOT NULL DEFAULT '[]',
  links TEXT NOT NULL DEFAULT '[]',
  scope TEXT NOT NULL DEFAULT '',          -- faculty/admin: what they verify
  account TEXT NOT NULL DEFAULT 'active' CHECK (account IN ('pending','active','rejected','disabled','unclaimed')),  -- unclaimed: record from paper/import, no login yet
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT
);
CREATE INDEX IF NOT EXISTS users_role ON users(role, account);
CREATE INDEX IF NOT EXISTS users_dept ON users(dept);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  category TEXT,
  title TEXT NOT NULL,
  org TEXT NOT NULL DEFAULT '',
  level TEXT CHECK (level IS NULL OR level IN ('College','University','State','National','International')),
  month TEXT NOT NULL,                     -- YYYY-MM
  description TEXT NOT NULL DEFAULT '',
  proof_type TEXT CHECK (proof_type IS NULL OR proof_type IN ('file','link')),
  proof_ref TEXT,
  proof_label TEXT,
  meta TEXT,                               -- JSON, e.g. a status update waiting for approval
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','info','verified','rejected')),
  verifier_id INTEGER REFERENCES users(id),
  verified_by INTEGER REFERENCES users(id),
  verified_at TEXT,
  note TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ms_user ON milestones(user_id);
CREATE INDEX IF NOT EXISTS ms_queue ON milestones(status, verifier_id);

CREATE TABLE IF NOT EXISTS chat_requests (
  id INTEGER PRIMARY KEY,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY,
  a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (a_id, b_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS msg_chat ON messages(chat_id, id);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per student/alumni: the fields of the college's paper "Alumni Database form".
CREATE TABLE IF NOT EXISTS outcomes (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mobile TEXT,
  internship_done INTEGER,
  internship_count INTEGER,
  internship_details TEXT,
  status TEXT,                               -- Job, Higher studies, Research, Govt services, Entrepreneurship, Other, Not reported
  placement_type TEXT CHECK (placement_type IS NULL OR placement_type IN ('On-campus','Off-campus')),
  company TEXT,
  designation TEXT,
  location TEXT,
  package_lpa REAL,                          -- annual package in lakh per annum
  study_course TEXT,
  study_university TEXT,
  exams_passed TEXT NOT NULL DEFAULT '[]',
  exams_appeared TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'self' CHECK (source IN ('self','iqac-form','paper-scan','import')),
  evidence_ref TEXT,
  evidence_label TEXT,
  verified_by INTEGER REFERENCES users(id),
  verified_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scanned paper forms waiting to be read and reviewed.
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY,
  file_ref TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  batch_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','reading','ready','failed','approved','discarded')),
  extracted TEXT,
  error TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS scans_status ON scans(status, id);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Columns added after the first release.
for (const [col, type] of [['avatar', 'TEXT'], ['banner', 'TEXT']]) {
  if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
}

const q = {
  all: (sql, ...p) => db.prepare(sql).all(...p),
  get: (sql, ...p) => db.prepare(sql).get(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
  tx(fn) {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
};

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hex] = String(stored).split(':');
  if (!salt || !hex) return false;
  const want = Buffer.from(hex, 'hex');
  const got = crypto.scryptSync(String(pw), salt, 32);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

module.exports = { db, q, DATA_DIR, UPLOAD_DIR, hashPassword, checkPassword };
