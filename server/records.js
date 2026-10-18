// Alumni records in the shape of the college's paper "Alumni Database form":
// self-service form, IQAC data entry, CSV import, scanned-form digitisation and placement statistics.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { q, UPLOAD_DIR, hashPassword } = require('./db');

const STATUSES = ['Job', 'Higher studies', 'Research', 'Govt services', 'Entrepreneurship', 'Other', 'Not reported'];
const EXAMS = ['NET', 'SET/SLET', 'GATE', 'CAT', 'IAS/IPS', 'State PSC', 'UPSC', 'Others'];
const PLACEMENT = ['On-campus', 'Off-campus'];
const RECORD = `u.account IN ('active','unclaimed')`;
const SCAN_TYPES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const STATUS_KIND = { 'Job': 'job', 'Higher studies': 'study', 'Research': 'phd', 'Govt services': 'job', 'Entrepreneurship': 'startup' };

const str = (v, max) => (v === null || v === undefined ? '' : String(v)).trim().slice(0, max);
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const intOrNull = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const numOrNull = v => { const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; };
const yesNo = v => { if (v === true || v === false) return v ? 1 : 0; const s = String(v ?? '').trim().toLowerCase(); return ['y', 'yes', 'true', '1'].includes(s) ? 1 : ['n', 'no', 'false', '0'].includes(s) ? 0 : null; };
const examList = v => {
  const arr = Array.isArray(v) ? v : String(v || '').split(/[;,|]/);
  return [...new Set(arr.map(x => EXAMS.find(e => e.toLowerCase() === String(x).trim().toLowerCase())).filter(Boolean))];
};

/* ---------- outcome storage ---------- */
function cleanOutcome(b) {
  const status = STATUSES.includes(b.status) ? b.status : null;
  return {
    mobile: str(b.mobile, 20).replace(/[^\d+ -]/g, '') || null,
    internship_done: yesNo(b.internship_done),
    internship_count: intOrNull(b.internship_count),
    internship_details: str(b.internship_details, 400) || null,
    status,
    placement_type: PLACEMENT.includes(b.placement_type) ? b.placement_type : null,
    company: str(b.company, 120) || null,
    designation: str(b.designation, 120) || null,
    location: str(b.location, 120) || null,
    package_lpa: numOrNull(b.package_lpa),
    study_course: str(b.study_course, 120) || null,
    study_university: str(b.study_university, 160) || null,
    exams_passed: JSON.stringify(examList(b.exams_passed)),
    exams_appeared: JSON.stringify(examList(b.exams_appeared))
  };
}
function nowTitle(o) {
  if (o.status === 'Job' || o.status === 'Govt services') return [o.designation, o.company].filter(Boolean).join(', ') || null;
  if (o.status === 'Higher studies' || o.status === 'Research') return [o.study_course, o.study_university].filter(Boolean).join(', ') || null;
  if (o.status === 'Entrepreneurship') return o.company ? 'Founder, ' + o.company : null;
  return null;
}
function saveOutcome(userId, raw, { source, verifier, evidence }) {
  const o = cleanOutcome(raw);
  const prev = q.get('SELECT * FROM outcomes WHERE user_id = ?', userId);
  const ev = evidence || (prev ? { ref: prev.evidence_ref, label: prev.evidence_label } : { ref: null, label: null });
  q.run(`INSERT INTO outcomes (user_id, mobile, internship_done, internship_count, internship_details, status, placement_type, company, designation, location, package_lpa,
      study_course, study_university, exams_passed, exams_appeared, source, evidence_ref, evidence_label, verified_by, verified_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET mobile=excluded.mobile, internship_done=excluded.internship_done, internship_count=excluded.internship_count,
      internship_details=excluded.internship_details, status=excluded.status, placement_type=excluded.placement_type, company=excluded.company,
      designation=excluded.designation, location=excluded.location, package_lpa=excluded.package_lpa, study_course=excluded.study_course,
      study_university=excluded.study_university, exams_passed=excluded.exams_passed, exams_appeared=excluded.exams_appeared, source=excluded.source,
      evidence_ref=excluded.evidence_ref, evidence_label=excluded.evidence_label, verified_by=excluded.verified_by, verified_at=excluded.verified_at, updated_at=excluded.updated_at`,
    userId, o.mobile, o.internship_done, o.internship_count, o.internship_details, o.status, o.placement_type, o.company, o.designation, o.location, o.package_lpa,
    o.study_course, o.study_university, o.exams_passed, o.exams_appeared, source, ev.ref, ev.label, verifier || null, verifier ? now() : null, now());
  // Keep the profile's headline status in step with the form.
  if (o.status) {
    const title = nowTitle(o);
    const sector = o.status === 'Job' ? (q.get('SELECT sector FROM users WHERE id = ?', userId) || {}).sector : null;
    // Only replace the headline when it was generated (blank, "Class of …" or the old status line), never a headline the person wrote.
    q.run(`UPDATE users SET status = ?, now_title = ?, status_updated = ?,
        headline = CASE WHEN ? IS NOT NULL AND role = 'alumni' AND (headline = '' OR headline LIKE 'Class of%' OR headline = coalesce(now_title, '')) THEN ? ELSE headline END,
        sector = coalesce(?, sector) WHERE id = ?`,
      o.status, title, now().slice(0, 10), title, title, sector, userId);
  }
  return o;
}
function shapeOutcome(o) {
  if (!o) return null;
  return { ...o, internship_done: o.internship_done === null ? null : !!o.internship_done, exams_passed: JSON.parse(o.exams_passed || '[]'), exams_appeared: JSON.parse(o.exams_appeared || '[]'),
    evidence_url: o.evidence_ref ? '/api/evidence/' + o.evidence_ref : null, verified: !!o.verified_at };
}
function saveFile(prefix, name, base64, types, maxMb) {
  const ext = String(name || '').split('.').pop().toLowerCase();
  if (!types[ext]) throw new Error('Upload a ' + Object.keys(types).map(x => x.toUpperCase()).join(', ') + ' file.');
  const buf = Buffer.from(String(base64 || ''), 'base64');
  if (!buf.length || buf.length > maxMb * 1024 * 1024) throw new Error(`The file must be smaller than ${maxMb} MB.`);
  const ref = `${prefix}-${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, ref), buf);
  return { ref, label: str(name, 120), mime: types[ext] };
}

/* ---------- creating records from paper ---------- */
function upsertPaperRecord(f, ctx) {
  const dept = q.get('SELECT code FROM departments WHERE code = ?', str(f.dept, 4).toUpperCase());
  const name = str(f.name, 80), roll = str(f.roll_no, 30).toUpperCase().replace(/\s+/g, '');
  const adm = intOrNull(f.adm_year), grad = intOrNull(f.grad_year);
  const errors = [];
  if (name.length < 3) errors.push('name is missing');
  if (!roll) errors.push('roll number is missing');
  if (!dept) errors.push('course/department not recognised');
  if (!grad || grad < 1980 || grad > new Date().getFullYear() + 1) errors.push('graduation year is missing or wrong');
  if (errors.length) return { ok: false, errors };
  let u = q.get('SELECT * FROM users WHERE college_id = ?', roll);
  const email = str(f.email, 200).toLowerCase();
  let created = false;
  if (!u) {
    const safeEmail = email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !q.get('SELECT 1 FROM users WHERE email = ?', email) ? email : `${roll.toLowerCase()}@records.local`;
    const id = Number(q.run(`INSERT INTO users (email, pass, role, name, dept, adm_year, grad_year, college_id, headline, account, accepts)
      VALUES (?,?, 'alumni', ?,?,?,?,?,?, 'unclaimed', 0)`, safeEmail, hashPassword(crypto.randomBytes(18).toString('hex')), name, dept.code, adm || grad - 3, grad, roll,
      `Class of ${grad}`).lastInsertRowid);
    u = q.get('SELECT * FROM users WHERE id = ?', id); created = true;
  } else if (u.role !== 'alumni' && u.role !== 'student') return { ok: false, errors: ['roll number belongs to a staff account'] };
  else if (u.name.toLowerCase() !== name.toLowerCase() && !ctx.overwrite) return { ok: false, errors: [`roll number ${roll} already belongs to ${u.name}`], duplicate: u.id };
  else if (u.role === 'student') q.run(`UPDATE users SET role = 'alumni', grad_year = ? WHERE id = ?`, grad, u.id);
  saveOutcome(u.id, f, ctx);
  return { ok: true, id: u.id, created };
}

/* ---------- CSV ---------- */
const CSV_COLUMNS = ['name', 'roll_no', 'dept', 'adm_year', 'grad_year', 'email', 'mobile', 'internship_done', 'internship_count', 'internship_details',
  'status', 'study_course', 'study_university', 'designation', 'company', 'location', 'placement_type', 'package_lpa', 'exams_passed', 'exams_appeared'];
function parseCSV(text) {
  const rows = []; let row = [], cell = '', inQ = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
const csvCell = v => /[",\n]/.test(String(v ?? '')) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v ?? '');

/* ---------- AI reading of scanned forms ---------- */
const FORM_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['is_alumni_form', 'name', 'roll_no', 'course_text', 'dept', 'adm_year', 'grad_year', 'email', 'mobile', 'internship_done', 'internship_count',
    'internship_details', 'status', 'study_course', 'study_university', 'designation', 'company', 'location', 'placement_type', 'package_lpa', 'exams_passed', 'exams_appeared', 'uncertain'],
  properties: {
    is_alumni_form: { type: 'boolean' },
    name: { type: ['string', 'null'] }, roll_no: { type: ['string', 'null'] }, course_text: { type: ['string', 'null'] }, dept: { type: ['string', 'null'] },
    adm_year: { type: ['integer', 'null'] }, grad_year: { type: ['integer', 'null'] }, email: { type: ['string', 'null'] }, mobile: { type: ['string', 'null'] },
    internship_done: { type: ['boolean', 'null'] }, internship_count: { type: ['integer', 'null'] }, internship_details: { type: ['string', 'null'] },
    status: { type: ['string', 'null'] }, study_course: { type: ['string', 'null'] }, study_university: { type: ['string', 'null'] },
    designation: { type: ['string', 'null'] }, company: { type: ['string', 'null'] }, location: { type: ['string', 'null'] },
    placement_type: { type: ['string', 'null'] }, package_lpa: { type: ['number', 'null'] },
    exams_passed: { type: 'array', items: { type: 'string' } }, exams_appeared: { type: 'array', items: { type: 'string' } },
    uncertain: { type: 'array', items: { type: 'string' } }
  }
};
function readingPrompt(depts) {
  return `This is a scan or photo of a paper "Alumni Database form" filled in by hand by a graduate of an Indian college. Read it and return the fields as JSON.

Rules:
- Copy names, roll numbers, emails and phone numbers exactly as written. Do not guess characters you cannot read: put the field name in "uncertain" and give your best reading, or null if the field is blank or illegible.
- "dept" must be one of these codes, chosen from the course name: ${depts.map(d => `${d.code} = ${d.course}`).join('; ')}. Use null if none fits.
- "Graduation passing year (Batch)" is usually written like "2023-2026": the first year is adm_year, the second is grad_year.
- "status" must be one of: ${STATUSES.join(', ')}. Use "Higher studies" when a course and university are filled in, "Job" when a designation or company is filled in, "Not reported" when the current-status section is blank or says NA.
- "placement_type" is "On-campus" or "Off-campus" only if the form says so; otherwise null.
- "package_lpa" is the annual package in lakh per annum (e.g. "6.5 LPA" -> 6.5, "Rs 4,80,000" -> 4.8). Null when blank or NA.
- "exams_passed" and "exams_appeared": the ticked boxes in each row, using only these names: ${EXAMS.join(', ')}.
- Treat "NA", "-", and empty boxes as null.
- If the image is not this form, set is_alumni_form to false and the other fields to null or empty arrays.`;
}
let client = null;
const aiEnabled = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
async function readScan(scan) {
  client = client || new Anthropic();
  const data = fs.readFileSync(path.join(UPLOAD_DIR, scan.file_ref)).toString('base64');
  const media = scan.mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: scan.mime, data } };
  const depts = q.all('SELECT code, course FROM departments ORDER BY code');
  const request = {
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: FORM_SCHEMA } },
    messages: [{ role: 'user', content: [media, { type: 'text', text: readingPrompt(depts) }] }]
  };
  const res = await client.beta.messages.create(request);
  if (res.stop_reason === 'refusal') throw new Error('The model declined to read this file.');
  if (res.stop_reason === 'max_tokens') throw new Error('The reading was cut off. Retry this scan.');
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text);
}
let working = 0;
async function pumpQueue() {
  if (!aiEnabled()) return;
  while (working < 2) {
    const scan = q.get(`SELECT * FROM scans WHERE status = 'queued' ORDER BY id LIMIT 1`);
    if (!scan) return;
    q.run(`UPDATE scans SET status = 'reading' WHERE id = ?`, scan.id);
    working++;
    readScan(scan)
      .then(out => q.run(`UPDATE scans SET status = 'ready', extracted = ?, error = NULL WHERE id = ?`, JSON.stringify(out), scan.id))
      .catch(err => {
        const msg = err instanceof Anthropic.RateLimitError ? 'Rate limited by the AI service. Retry in a minute.'
          : err instanceof Anthropic.AuthenticationError ? 'The AI service rejected the API key.'
          : err instanceof Anthropic.APIError ? `AI service error ${err.status || ''}: ${err.message}`.trim()
          : err.message;
        q.run(`UPDATE scans SET status = 'failed', error = ? WHERE id = ?`, str(msg, 300), scan.id);
      })
      .finally(() => { working--; pumpQueue(); });
  }
}

/* ---------- placement statistics ---------- */
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const round1 = v => v === null ? null : Math.round(v * 10) / 10;
function placementRows(filter) {
  const where = [`u.role = 'alumni'`, RECORD], p = [];
  if (filter.batch) { where.push('u.grad_year = ?'); p.push(Number(filter.batch)); }
  if (filter.dept) { where.push('u.dept = ?'); p.push(filter.dept); }
  return q.all(`SELECT u.id, u.name, u.college_id, u.dept, u.grad_year, d.name dept_name, coalesce(o.status, u.status, 'Not reported') status,
      o.placement_type, coalesce(o.company, '') company, coalesce(o.designation, '') designation, coalesce(o.location, '') location, o.package_lpa,
      o.study_course, o.study_university, o.verified_at
    FROM users u JOIN departments d ON d.code = u.dept LEFT JOIN outcomes o ON o.user_id = u.id WHERE ${where.join(' AND ')} ORDER BY u.grad_year DESC, d.name, u.name`, ...p);
}
function summarise(rows) {
  const n = rows.length, placed = rows.filter(r => r.status === 'Job');
  const pk = placed.map(r => r.package_lpa).filter(v => v !== null && v > 0);
  const pct = k => n ? Math.round(k / n * 1000) / 10 : 0;
  const count = s => rows.filter(r => r.status === s).length;
  return {
    graduates: n,
    placed: placed.length, placed_pct: pct(placed.length),
    on_campus: placed.filter(r => r.placement_type === 'On-campus').length, on_campus_pct: pct(placed.filter(r => r.placement_type === 'On-campus').length),
    off_campus: placed.filter(r => r.placement_type === 'Off-campus').length, off_campus_pct: pct(placed.filter(r => r.placement_type === 'Off-campus').length),
    higher_studies: count('Higher studies') + count('Research'), higher_studies_pct: pct(count('Higher studies') + count('Research')),
    govt: count('Govt services'), govt_pct: pct(count('Govt services')),
    entrepreneurship: count('Entrepreneurship'), entrepreneurship_pct: pct(count('Entrepreneurship')),
    other: count('Other'), other_pct: pct(count('Other')),
    not_reported: count('Not reported'), not_reported_pct: pct(count('Not reported')),
    with_package: pk.length, avg_package: round1(avg(pk)), median_package: round1(median(pk)), highest_package: pk.length ? Math.max(...pk) : null,
    companies: new Set(placed.map(r => r.company).filter(Boolean)).size
  };
}

module.exports = function mountRecords(app, { auth, fail, audit, publicUser }) {
  const staff = auth('admin', 'faculty');

  app.get('/api/records/meta', auth(), (req, res) => res.json({ statuses: STATUSES, exams: EXAMS, placement: PLACEMENT, columns: CSV_COLUMNS, ai: aiEnabled() }));

  // Self-service: the paper form, filled online by the alumna/alumnus.
  app.get('/api/me/outcome', auth('alumni', 'student'), (req, res) => res.json({ outcome: shapeOutcome(q.get('SELECT * FROM outcomes WHERE user_id = ?', req.user.id)) }));
  app.put('/api/me/outcome', auth('alumni', 'student'), (req, res) => {
    try {
      let evidence = null;
      if (req.body.evidence && req.body.evidence.data) {
        const f = saveFile('evidence', req.body.evidence.name, req.body.evidence.data, { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }, 5);
        evidence = { ref: f.ref, label: f.label };
      }
      saveOutcome(req.user.id, req.body, { source: 'self', verifier: null, evidence });
      res.json({ outcome: shapeOutcome(q.get('SELECT * FROM outcomes WHERE user_id = ?', req.user.id)), user: publicUser(q.get('SELECT * FROM users WHERE id = ?', req.user.id), req.user) });
    } catch (e) { fail(res, 400, e.message); }
  });
  app.get('/api/evidence/:name', auth(), (req, res) => {
    const name = path.basename(req.params.name);
    const o = q.get('SELECT * FROM outcomes WHERE evidence_ref = ?', name);
    const scan = q.get('SELECT * FROM scans WHERE file_ref = ?', name);
    if (!o && !scan) return fail(res, 404, 'Not found.');
    const allowed = ['admin', 'faculty'].includes(req.user.role) || (o && o.user_id === req.user.id);
    if (!allowed) return fail(res, 403, 'Only the owner and staff can see this document.');
    sendFile(res, name, scan ? scan.mime : null);
  });
  function sendFile(res, name, mime) {
    const file = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(file)) return fail(res, 404, 'File missing.');
    const ext = name.split('.').pop();
    res.setHeader('Content-Type', mime || SCAN_TYPES[ext] || (ext === 'svg' ? 'image/svg+xml' : 'application/octet-stream'));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    fs.createReadStream(file).pipe(res);
  }

  // IQAC: one record's form.
  app.get('/api/admin/outcome/:id', staff, (req, res) => {
    const u = q.get(`SELECT * FROM users u WHERE id = ? AND role IN ('student','alumni')`, Number(req.params.id));
    if (!u) return fail(res, 404, 'Record not found.');
    res.json({ user: { ...publicUser(u, req.user), college_id: u.college_id, email: u.email }, outcome: shapeOutcome(q.get('SELECT * FROM outcomes WHERE user_id = ?', u.id)) });
  });
  app.put('/api/admin/outcome/:id', auth('admin'), (req, res) => {
    const u = q.get(`SELECT * FROM users WHERE id = ? AND role IN ('student','alumni')`, Number(req.params.id));
    if (!u) return fail(res, 404, 'Record not found.');
    saveOutcome(u.id, req.body, { source: q.get('SELECT source FROM outcomes WHERE user_id = ?', u.id)?.source || 'iqac-form', verifier: req.user.id });
    audit(req.user.id, 'Updated and verified alumni form', `${u.name} (${u.college_id})`);
    res.json({ ok: true });
  });
  app.post('/api/admin/outcome/:id/verify', auth('admin'), (req, res) => {
    const r = q.run('UPDATE outcomes SET verified_by = ?, verified_at = ? WHERE user_id = ?', req.user.id, now(), Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'This record has no form yet.');
    res.json({ ok: true });
  });

  // IQAC: type in a paper form (optionally with a photo of it).
  app.post('/api/admin/paper', auth('admin'), (req, res) => {
    try {
      let evidence = null;
      if (req.body.scan && req.body.scan.data) { const f = saveFile('evidence', req.body.scan.name, req.body.scan.data, SCAN_TYPES, 8); evidence = { ref: f.ref, label: f.label }; }
      const r = upsertPaperRecord(req.body, { source: 'iqac-form', verifier: req.user.id, evidence, overwrite: !!req.body.overwrite });
      if (!r.ok) return res.status(400).json({ error: 'Not saved: ' + r.errors.join('; ') + '.', duplicate: r.duplicate || null });
      audit(req.user.id, r.created ? 'Entered paper form' : 'Updated record from paper form', `${str(req.body.name, 80)} (${str(req.body.roll_no, 30)})`);
      res.json(r);
    } catch (e) { fail(res, 400, e.message); }
  });

  // IQAC: CSV import (Excel -> Save As -> CSV).
  app.get('/api/admin/import/template', auth('admin'), (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="alumni-form-template.csv"');
    res.send([CSV_COLUMNS.join(','), ['Sample Name', '23MA001', 'MA', 2023, 2026, 'name@example.com', '', 'Yes', 1, 'Summer internship, 2 months', 'Higher studies',
      'M.Sc. Applied Mathematics', 'Example University', '', '', '', '', '', 'GATE', 'NET;GATE'].map(csvCell).join(','),
      '# dept codes: ' + q.all('SELECT code, name FROM departments ORDER BY code').map(d => `${d.code}=${d.name}`).join(' '),
      '# status: ' + STATUSES.join(' | ') + ' · placement_type: On-campus | Off-campus · exams separated by ; from: ' + EXAMS.join(' ')].join('\n'));
  });
  app.post('/api/admin/import', auth('admin'), (req, res) => {
    const rows = parseCSV(req.body.csv || '').filter(r => !String(r[0] || '').startsWith('#'));
    if (rows.length < 2) return fail(res, 400, 'The file has no data rows. Use the template’s column headings in the first row.');
    const head = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const missing = ['name', 'roll_no', 'dept', 'grad_year'].filter(c => !head.includes(c));
    if (missing.length) return fail(res, 400, 'Missing columns: ' + missing.join(', ') + '.');
    if (rows.length > 5001) return fail(res, 400, 'Import at most 5,000 rows at a time.');
    const result = { created: 0, updated: 0, errors: [] };
    q.tx(() => {
      rows.slice(1).forEach((r, i) => {
        const f = Object.fromEntries(head.map((h, j) => [h, (r[j] || '').trim()]));
        if (f.package_lpa === '') f.package_lpa = null;
        const out = upsertPaperRecord(f, { source: 'import', verifier: req.user.id, evidence: null, overwrite: false });
        if (out.ok) out.created ? result.created++ : result.updated++;
        else result.errors.push({ row: i + 2, name: f.name || '', errors: out.errors });
      });
    });
    audit(req.user.id, 'Imported alumni forms', `${result.created} new, ${result.updated} updated, ${result.errors.length} rows with problems`);
    res.json(result);
  });

  // IQAC: scanned forms.
  app.post('/api/admin/scans', auth('admin'), (req, res) => {
    try {
      const f = saveFile('scan', req.body.name, req.body.data, SCAN_TYPES, 10);
      const id = Number(q.run(`INSERT INTO scans (file_ref, file_name, mime, batch_label, status, uploaded_by) VALUES (?,?,?,?,?,?)`,
        f.ref, f.label, f.mime, str(req.body.batch, 60), aiEnabled() ? 'queued' : 'ready', req.user.id).lastInsertRowid);
      pumpQueue();
      res.json({ id });
    } catch (e) { fail(res, 400, e.message); }
  });
  app.get('/api/admin/scans', auth('admin'), (req, res) => {
    const counts = Object.fromEntries(q.all('SELECT status, count(*) n FROM scans GROUP BY status').map(r => [r.status, r.n]));
    const st = ['queued', 'reading', 'ready', 'failed', 'approved', 'discarded'].includes(req.query.status) ? req.query.status : null;
    const rows = q.all(`SELECT id, file_name, batch_label, status, error, uploaded_at, extracted FROM scans ${st ? 'WHERE status = ?' : `WHERE status IN ('queued','reading','ready','failed')`} ORDER BY id LIMIT 200`, ...(st ? [st] : []))
      .map(s => { const x = s.extracted ? JSON.parse(s.extracted) : null; return { ...s, extracted: undefined, name: x?.name || null, roll_no: x?.roll_no || null, uncertain: x?.uncertain?.length || 0 }; });
    res.json({ counts, rows, ai: aiEnabled() });
  });
  app.get('/api/admin/scans/:id', auth('admin'), (req, res) => {
    const s = q.get('SELECT * FROM scans WHERE id = ?', Number(req.params.id));
    if (!s) return fail(res, 404, 'Scan not found.');
    const x = s.extracted ? JSON.parse(s.extracted) : null;
    const existing = x?.roll_no ? q.get('SELECT id, name, account FROM users WHERE college_id = ?', String(x.roll_no).toUpperCase().replace(/\s+/g, '')) : null;
    res.json({ scan: { ...s, extracted: x, file_url: '/api/admin/scans/' + s.id + '/file' }, existing });
  });
  app.get('/api/admin/scans/:id/file', auth('admin'), (req, res) => {
    const s = q.get('SELECT * FROM scans WHERE id = ?', Number(req.params.id));
    if (!s) return fail(res, 404, 'Scan not found.');
    sendFile(res, s.file_ref, s.mime);
  });
  app.post('/api/admin/scans/:id/:action', auth('admin'), (req, res) => {
    const s = q.get('SELECT * FROM scans WHERE id = ?', Number(req.params.id));
    if (!s) return fail(res, 404, 'Scan not found.');
    if (req.params.action === 'discard') { q.run(`UPDATE scans SET status = 'discarded', reviewed_by = ?, reviewed_at = ? WHERE id = ?`, req.user.id, now(), s.id); return res.json({ ok: true }); }
    if (req.params.action === 'retry') {
      if (!aiEnabled()) return fail(res, 400, 'AI reading is off. Add ANTHROPIC_API_KEY to the server to turn it on.');
      q.run(`UPDATE scans SET status = 'queued', error = NULL WHERE id = ?`, s.id); pumpQueue(); return res.json({ ok: true });
    }
    if (req.params.action !== 'approve') return fail(res, 400, 'Unknown action.');
    const r = upsertPaperRecord(req.body, { source: 'paper-scan', verifier: req.user.id, evidence: { ref: s.file_ref, label: s.file_name }, overwrite: !!req.body.overwrite });
    if (!r.ok) return res.status(400).json({ error: 'Not saved: ' + r.errors.join('; ') + '.', duplicate: r.duplicate || null });
    q.run(`UPDATE scans SET status = 'approved', user_id = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`, r.id, req.user.id, now(), s.id);
    audit(req.user.id, 'Approved scanned form', `${str(req.body.name, 80)} (${str(req.body.roll_no, 30)})`);
    res.json(r);
  });

  // Placement statistics. Students see totals only; staff also see names.
  app.get('/api/placements', auth(), (req, res) => {
    const dept = q.get('SELECT code FROM departments WHERE code = ?', String(req.query.dept || ''))?.code || null;
    const batch = intOrNull(req.query.batch);
    const rows = placementRows({ batch, dept });
    const isStaff = ['admin', 'faculty'].includes(req.user.role);
    if (req.query.format === 'csv') {
      if (!isStaff) return fail(res, 403, 'Only staff can download names.');
      const head = ['Name', 'Roll number', 'Department', 'Batch', 'Outcome', 'Placement', 'Company', 'Designation', 'Location', 'Package (LPA)', 'Course', 'University', 'Verified'];
      audit(req.user.id, 'Exported placement records', `${batch || 'all batches'}${dept ? ', ' + dept : ''}`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="placements-${batch || 'all'}${dept ? '-' + dept : ''}.csv"`);
      return res.send([head, ...rows.map(r => [r.name, r.college_id, r.dept_name, r.grad_year, r.status, r.placement_type || '', r.company, r.designation, r.location, r.package_lpa ?? '',
        r.study_course || '', r.study_university || '', r.verified_at ? 'Yes' : 'No'])].map(r => r.map(csvCell).join(',')).join('\n'));
    }
    const groupBy = (key, label) => { const m = new Map(); rows.forEach(r => { const k = r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
      return [...m.entries()].map(([k, list]) => ({ [label]: k, ...summarise(list) })); };
    const companies = new Map();
    rows.filter(r => r.status === 'Job' && r.company).forEach(r => { const c = companies.get(r.company) || { company: r.company, hires: 0, on_campus: 0, packages: [] };
      c.hires++; if (r.placement_type === 'On-campus') c.on_campus++; if (r.package_lpa) c.packages.push(r.package_lpa); companies.set(r.company, c); });
    const allBatches = q.all(`SELECT DISTINCT grad_year y FROM users u WHERE role = 'alumni' AND ${RECORD} AND grad_year IS NOT NULL ORDER BY y DESC`).map(r => r.y);
    const trend = placementRows({ dept });
    res.json({
      filter: { batch, dept }, batches: allBatches, summary: summarise(rows),
      byCourse: groupBy('dept_name', 'course').sort((a, b) => a.course.localeCompare(b.course)),
      byYear: (() => { const m = new Map(); trend.forEach(r => { if (!m.has(r.grad_year)) m.set(r.grad_year, []); m.get(r.grad_year).push(r); });
        return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([y, list]) => ({ year: y, ...summarise(list) })); })(),
      companies: [...companies.values()].map(c => ({ company: c.company, hires: c.hires, on_campus: c.on_campus, avg_package: round1(avg(c.packages)), highest_package: c.packages.length ? Math.max(...c.packages) : null }))
        .sort((a, b) => b.hires - a.hires || a.company.localeCompare(b.company)).slice(0, 40),
      students: isStaff ? rows.filter(r => r.status !== 'Not reported').slice(0, 500).map(r => ({ id: r.id, name: r.name, roll: r.college_id, course: r.dept_name, batch: r.grad_year, status: r.status,
        placement_type: r.placement_type, company: r.company, designation: r.designation, location: r.location, package_lpa: r.package_lpa, study: [r.study_course, r.study_university].filter(Boolean).join(', '), verified: !!r.verified_at })) : null
    });
  });

  pumpQueue();
  setInterval(pumpQueue, 30000).unref();
};
module.exports.STATUSES = STATUSES;
module.exports.EXAMS = EXAMS;
module.exports.saveOutcome = saveOutcome;
