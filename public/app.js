/* AlumniConnect frontend: a small single-page app that talks to the REST API in /server. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtMonth = d => { if (!d) return ''; const [y, m] = d.split('-').map(Number); return M[m - 1] + ' ' + y; };
const fmtDay = d => { if (!d) return ''; const [y, m, dd] = d.slice(0, 10).split('-').map(Number); return dd + ' ' + M[m - 1] + ' ' + y; };
const fmtWhen = d => { if (!d) return ''; const t = new Date(d.replace(' ', 'T') + 'Z'); const today = new Date();
  return t.toDateString() === today.toDateString() ? t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : t.getDate() + ' ' + M[t.getMonth()]; };
const ayStart = d => { const [y, m] = d.split('-').map(Number); return m >= 7 ? y : y - 1; };
const ayLabel = s => s + '–' + String(s + 1).slice(2);
const ord = n => ['', '1st', '2nd', '3rd', '4th', '5th'][n] || n + 'th';
const fmtN = n => Number(n || 0).toLocaleString('en-IN');
const first = n => String(n || '').replace(/^(Dr|Mr|Ms)\.\s*/, '').split(' ')[0];
const initials = n => String(n || '').replace(/^(Dr|Mr|Ms)\.\s*/, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const thisMonth = () => new Date().toISOString().slice(0, 7);
const CUR_AY = ayStart(thisMonth());

const P = {
  home: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
  message: '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
  trophy: '<path d="M9 21h6M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  out: '<path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H8"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5zM11.5 13.5L20 4"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>',
  flag: '<path d="M5 21V4h12l-2 4 2 4H5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>',
  case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
  book: '<path d="M5 4h14v15H7a2 2 0 0 0-2 2zM5 21V4"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 4-2 6 2 0 4.5-.5 6-2M9 15l-3-3c1-4 4.5-8.5 12-9 0 7.5-5 11-9 12z"/><circle cx="15" cy="9" r="1.5"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>'
};
const icon = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
const KIND = {
  achievement: ['award', 'Achievement'], exam: ['book', 'Competitive exam'], research: ['flask', 'Research'], society: ['users', 'Society'],
  position: ['flag', 'Position held'], event: ['cal', 'Event'], project: ['code', 'Project'], internship: ['case', 'Internship'],
  graduation: ['cap', 'Graduation'], study: ['cap', 'Higher studies'], phd: ['flask', 'Research role'], job: ['case', 'Job'], startup: ['rocket', 'Startup']
};
const ACH = ['achievement', 'exam', 'research'];
const CATS = [['tech', 'Tech & coding'], ['sports', 'Sports'], ['research', 'Research'], ['exam', 'Competitive exam'], ['startup', 'Entrepreneurship'], ['cultural', 'Arts & debate'], ['social', 'Social service']];

/* ---------- state + api ---------- */
const S = {
  me: null, counts: {}, meta: null,
  explain: (() => { try { return localStorage.getItem('ac-explain') === '1'; } catch { return false; } })(),
  people: { q: '', role: '', dept: '', mentor: false, path: '', limit: 24 },
  prof: { jf: 'all', ph: '', open: new Set(), id: null },
  msg: { tab: 'chats', last: 0 },
  ver: { sel: null, mode: null },
  plc: { batch: '', dept: '', q: '' },
  dig: { sel: null, filter: '' },
  adm: { tab: 'overview', dept: '', rtype: 'progression', ryear: '', rq: '', rrole: '', rpage: 0 },
  modal: null
};
let pollT = null, countsT = null;
async function api(path, opts = {}) {
  const res = await fetch(path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/api/auth')) { S.me = null; location.hash = '#/login'; throw new Error('Please log in.'); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3600); }
const deptName = c => (S.meta?.departments.find(d => d.code === c) || {}).name || '';
const course = c => (S.meta?.departments.find(d => d.code === c) || {}).course || '';

/* ---------- small pieces ---------- */
const av = (u, cls = '') => u.avatar_url ? `<img class="av ${cls}" src="${esc(u.avatar_url)}" alt="">`
  : `<span class="av ${['', 't2', 't3'][(u.id || 0) % 3]} ${cls}" aria-hidden="true">${esc(initials(u.name))}</span>`;
const BANNERS = ['navy', 'slate', 'teal', 'forest', 'plum', 'sand'];
const bannerClass = u => u.banner_url ? '' : 'bn-' + (BANNERS.includes(u.banner_preset) ? u.banner_preset : 'navy');
const bannerStyle = u => u.banner_url ? `style="background-image:url('${esc(u.banner_url)}')"` : '';
const lvl = l => l ? `<span class="lv ${l === 'National' || l === 'International' ? 'lv-hi' : ''}">${esc(l)}</span>` : '';
function pill(s) {
  if (s === 'verified') return `<span class="st st-ok">${icon('check', 13)}Verified</span>`;
  if (s === 'pending') return `<span class="st st-warn">${icon('clock', 13)}Pending</span>`;
  if (s === 'info') return `<span class="st st-warn">${icon('info', 13)}Info requested</span>`;
  return `<span class="st st-bad">${icon('x', 13)}Not verified</span>`;
}
function meta(u) {
  if (u.role === 'alumni') return `${course(u.dept)} · Class of ${u.grad_year}`;
  if (u.role === 'student') return `${course(u.dept)} · ${ord(CUR_AY - u.adm_year + 1)} year`;
  return u.headline;
}
function ring(pct) {
  const r = 22, c = 2 * Math.PI * r;
  return `<svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label="${pct}%" style="flex:none"><circle cx="28" cy="28" r="${r}" fill="none" stroke="#e6e9ee" stroke-width="5"/>
    <circle cx="28" cy="28" r="${r}" fill="none" class="ring-fill" style="--len:${(c * pct / 100).toFixed(1)}" stroke="#23569b" stroke-width="5" stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 28 28)"/>
    <text x="28" y="32" text-anchor="middle" style="font:600 12px var(--font);fill:#1c2430">${pct}%</text></svg>`;
}
function why(key) {
  if (!S.explain) return '';
  const W = WHY[key]; if (!W) return '';
  return `<aside class="why" aria-label="Why this feature matters">${icon('info', 18)}<p class="lead"><b>${esc(W[0])}</b></p>
    <div style="grid-column:2"><h3>For students &amp; alumni</h3><p>${esc(W[1])}</p></div><div><h3>For the college</h3><p>${esc(W[2])}</p></div></aside>`;
}
const WHY = {
  dash: ['One screen shows what needs action: requests, verifications and progress.', 'No more checking WhatsApp groups and notice boards. Your mentors, pending verifications and achievements are in one place.', 'Every action here is recorded, so the college can measure real student and alumni engagement instead of guessing.'],
  profile: ['A LinkedIn-style profile where every milestone is checked by the college.', 'A verified journey from 1st year to career. Share one link with recruiters instead of a self-claimed resume.', 'Data is collected once, at the source, with proof. NAAC and NIRF numbers come straight from these records.'],
  people: ['Search seniors by the path they took, not just by name.', 'A 1st-year can find alumni who cleared GATE, went into research or started a business, and see exactly what they did each year in college.', 'The alumni network becomes useful to current students, which keeps alumni engaged with the college.'],
  messages: ['Chat starts only after the other person accepts a request.', 'Students reach the right senior safely. Phone numbers and emails stay hidden, and anyone can be reported or ignored.', 'Every accepted mentoring request counts as alumni engagement, a number NAAC asks for every year.'],
  verify: ['Faculty approve achievements in one click, with the proof in front of them.', 'Students get a “Verified” badge that recruiters and universities can trust.', 'Each item goes to the right person automatically: society coordinator, department moderator or IQAC. Nothing is lost in email.'],
  admin: ['One-click NAAC and NIRF reports from verified data.', 'Students stop filling the same Google Form every year.', 'IQAC saves weeks of collecting data each accreditation cycle, and every row links back to its proof and verifier.'],
  fame: ['A Wall of Fame built only from verified achievements.', 'Sports, research, exams, startups and debate get equal recognition, not just a single leaderboard.', 'A ready showcase for the website, admissions brochures and the annual report.'],
  placements: ['Placement records the college can present: by batch, course and company, with average and median packages.', 'Students see which companies hire from their course and what their seniors went on to do.', 'Ready numbers for NIRF, NAAC, the placement brochure and the annual report, straight from verified alumni forms instead of manual counting.'],
  digitize: ['Old paper forms become searchable records without retyping every one.', 'Graduates from older batches appear in the alumni register and can claim their profile later using their roll number.', 'Staff scan forms in batches. AI reads each one into the form fields, and a person checks it against the scan before it is saved, with the scan kept as proof.'],
  settings: ['People control what they share and when they can be contacted.', 'Turn chat requests on or off, list mentoring topics, and keep your current status up to date.', 'Alumni status updates feed placement and higher-studies figures without a separate survey.']
};

/* ---------- router ---------- */
function route() { const h = location.hash.replace(/^#\/?/, ''); const [name, id] = h.split('/'); return { name: name || 'login', id }; }
async function boot() {
  try { S.meta = await api('/api/meta'); } catch { }
  try { const r = await api('/api/me'); S.me = r.user; S.counts = r.counts; S.rmeta = await api('/api/records/meta'); } catch { S.me = null; }
  window.addEventListener('hashchange', render);
  render();
}
function home() { return S.me.role === 'admin' ? '#/admin' : S.me.role === 'faculty' ? '#/verify' : '#/dashboard'; }
async function render() {
  clearInterval(pollT); pollT = null;
  const r = route();
  if (!S.me && !['login', 'register'].includes(r.name)) { location.hash = '#/login'; return; }
  if (S.me && ['login', 'register', ''].includes(r.name)) { location.hash = home(); return; }
  if (!S.me) { delete $('app').dataset.user; lastKey = null; $('app').innerHTML = r.name === 'register' ? viewRegister() : await viewLogin(); enter($('app').firstElementChild); return; }
  const views = { placements: viewPlacements, digitize: viewDigitize, dashboard: viewDash, u: viewProfile, people: viewPeople, messages: viewMessages, verify: viewVerify, admin: viewAdmin, fame: viewFame, settings: viewSettings };
  if (r.name === 'messages' && S.me.role === 'admin') { location.hash = '#/admin'; return; }
  const v = views[r.name] || viewDash;
  const key = r.name + '/' + (r.id || ''), changed = key !== lastKey;
  lastKey = key;
  let view = $('view');
  if (!view || $('app').dataset.user !== String(S.me.id)) {
    // First paint for this account: build the frame once.
    $('app').innerHTML = shell(r); $('app').dataset.user = S.me.id; view = $('view');
    view.innerHTML = `<div class="empty">Loading…</div>`;
  } else {
    // Keep the sidebar and header; only update what changed.
    updateChrome(r);
    if (changed) view.classList.add('leaving');
  }
  let html;
  try { html = await v(r.id); } catch (e) { html = `<div class="card empty">${icon('info', 28)}<p>${esc(e.message)}</p></div>`; }
  if (lastKey !== key) return; // a newer navigation started while this one loaded
  view.innerHTML = html;
  view.classList.remove('leaving');
  if (changed) { scrollTo(0, 0); enter(view); }
  afterRender(r);
}
let lastKey = null;
// Replays the entrance animation on an element.
function enter(el) { if (!el) return; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
// Swaps a region's content with a short fade instead of a hard cut.
function swap(el, html) { if (!el) return; el.innerHTML = html; el.classList.remove('soft'); void el.offsetWidth; el.classList.add('soft'); toggleOutcomeSections(); }
function updateChrome(r) {
  const n = $('nav'); if (n) n.outerHTML = navHTML(r);
  const h = $('hello'); if (h) h.innerHTML = titleFor(r);
  const b = $('bell'); if (b) b.outerHTML = bellHTML();
}
function titleFor(r) {
  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  return r.name === 'dashboard' ? `${greet}, ${esc(first(S.me.name))}` : TITLES[r.name] || 'Dashboard';
}
function afterRender(r) {
  toggleOutcomeSections();
  if (r.name === 'messages' && r.id) { scrollThread(); pollT = setInterval(pollChat, 3000); }
  clearInterval(countsT); countsT = setInterval(refreshCounts, 15000);
}
async function refreshCounts() {
  if (!S.me) return;
  try { const r = await api('/api/me'); const changed = JSON.stringify(r.counts) !== JSON.stringify(S.counts); S.counts = r.counts; if (changed) updateBadges(); } catch { }
}
function updateBadges() { const n = $('nav'); if (n) n.outerHTML = navHTML(route()); const b = $('bell'); if (b) b.outerHTML = bellHTML(); }

/* ---------- shell ---------- */
function navItems() {
  const r = S.me.role, c = S.counts;
  const items = [];
  if (r === 'student' || r === 'alumni') items.push(['dashboard', 'Dashboard', 'home'], ['u/' + S.me.id, 'My profile', 'user']);
  if (r === 'admin') items.push(['admin', 'Dashboard', 'chart']);
  if (r === 'admin' || r === 'faculty') items.push(['verify', 'Verify', 'shield', c.queue]);
  if (r === 'admin') items.push(['digitize', 'Digitize records', 'upload']);
  items.push(['placements', 'Placements', 'case'], ['people', 'People', 'users']);
  if (r !== 'admin') items.push(['messages', 'Messages', 'message', (c.requests || 0) + (c.unread || 0)]);
  items.push(['fame', 'Wall of Fame', 'trophy'], ['settings', 'Settings', 'gear']);
  return items;
}
function navHTML(r) {
  const cur = r.name === 'u' ? (Number(r.id) === S.me.id ? 'u/' + S.me.id : 'people') : r.name;
  return `<nav class="nav" id="nav" aria-label="Main">${navItems().map(([k, l, ic, n]) => `<button data-go="#/${k}" ${cur === k ? 'aria-current="page"' : ''}>${icon(ic, 20)}<span>${l}</span>${n ? `<span class="badge">${n}</span>` : ''}</button>`).join('')}</nav>`;
}
const bellHTML = () => S.me.role === 'admin' ? '<span id="bell" hidden></span>' : `<button class="iconbtn" id="bell" data-go="#/messages" aria-label="Messages and requests">${icon('bell', 22)}${(S.counts.requests || 0) + (S.counts.unread || 0) ? '<span class="dot"></span>' : ''}</button>`;
const TITLES = { placements: 'Placements', digitize: 'Digitize records', people: 'People', messages: 'Messages', verify: 'Verification', admin: 'IQAC Dashboard', fame: 'Wall of Fame', settings: 'Settings', u: 'Profile' };
function shell(r) {
  const hello = titleFor(r);
  return `<div class="frame">
    <aside class="side">
      <button class="logo" data-go="${home()}" aria-label="AlumniConnect home"><span class="mark">AC</span>AlumniConnect</button>
      <div class="me">${av(S.me)}<div><b>${esc(S.me.name)}</b><span>${esc(S.me.role === 'student' ? 'Student' : S.me.role === 'alumni' ? 'Alumni' : S.me.role === 'faculty' ? 'Faculty verifier' : 'IQAC admin')}</span></div></div>
      ${navHTML(r)}
      <div class="side-foot"><button data-act="logout">${icon('out', 20)}Log out</button></div>
    </aside>
    <main class="main">
      <header class="head"><h1 class="hello" id="hello">${hello}</h1>
        <form class="search" data-form="topsearch" role="search">${icon('search', 18)}<label for="top-q" hidden>Search people</label><input id="top-q" type="search" placeholder="Search people, skills, achievements" value="${esc(S.people.q)}"></form>
        ${bellHTML()}
        <button class="iconbtn mobile-only" data-act="logout" aria-label="Log out" title="Log out">${icon('out', 18)}</button>
        <button class="switch" data-act="explain" aria-pressed="${S.explain}" title="Show a short note on each page about how the feature helps"><i></i>Feature notes</button>
      </header>
      <section id="view"></section>
    </main>
  </div>`;
}

/* ---------- login / register ---------- */
function authSide() {
  return `<section class="auth-l"><div class="logo"><span class="mark">AC</span>AlumniConnect</div>
    <div><h1>The alumni and achievement network of Your College Name</h1>
      <p>Student and alumni profiles, verified achievements, mentoring and IQAC reports in one place.</p></div>
    <footer>Internal Quality Assurance Cell · Your College Name</footer></section>`;
}
async function viewLogin() {
  const demo = [['priya@college.example', 'Priya Singh', 'Student'], ['ishita@college.example', 'Ishita Bansal', 'Alumni'],
    ['rekha@college.example', 'Dr. Rekha Sinha', 'Faculty verifier'], ['iqac@college.example', 'Dr. Meenakshi Iyer', 'IQAC admin']];
  return `<div class="auth">${authSide()}
    <section class="auth-r"><div class="auth-box">
      <div><h2>Log in</h2><p class="small muted" style="margin-top:4px">Use your college email.</p></div>
      <form class="stack" data-form="login" style="gap:12px">
        <div class="fld"><label for="l-email">Email</label><input id="l-email" type="email" autocomplete="username" required></div>
        <div class="fld"><label for="l-pass">Password</label><input id="l-pass" type="password" autocomplete="current-password" required></div>
        <p class="err" id="l-err" hidden></p>
        <button class="btn btn-p" type="submit" style="height:38px">Log in</button>
      </form>
      <p class="small">New user? <a href="#/register">Create an account</a></p>
      <div class="divider">Demo accounts · password demo1234</div>
      <div class="demo-acc">${demo.map(([e, n, d], i) => `<button data-act="demo" data-email="${e}">${av({ id: i, name: n }, 'av-sm')}<div><b>${esc(n)}</b><span>${esc(d)} · ${e}</span></div></button>`).join('')}</div>
    </div></section>
  </div>`;
}
function viewRegister() {
  const opts = (S.meta?.departments || []).map(d => `<option value="${d.code}">${esc(d.name)}</option>`).join('');
  const y = new Date().getFullYear();
  return `<div class="auth">${authSide()}<section class="auth-r"><div class="auth-box" style="width:min(460px,100%)">
    <div><h2>Create an account</h2><p class="small muted" style="margin-top:4px">IQAC checks every registration against college records before the account is activated.</p></div>
    <form class="stack" data-form="register" style="gap:12px">
      <div class="fld"><label for="r-role">I am</label><select id="r-role"><option value="student">A current student</option><option value="alumni">An alumna or alumnus</option></select></div>
      <div class="fld"><label for="r-name">Full name</label><input id="r-name" type="text" required></div>
      <div class="fld"><label for="r-email">Email</label><input id="r-email" type="email" required></div>
      <div class="fld"><label for="r-pass">Password</label><input id="r-pass" type="password" minlength="8" required><small>At least 8 characters.</small></div>
      <div class="fld"><label for="r-dept">Department</label><select id="r-dept" required>${opts}</select></div>
      <div class="row" style="align-items:flex-start">
        <div class="fld" style="flex:1;min-width:140px"><label for="r-adm">Admission year</label><input id="r-adm" type="number" min="1990" max="${y}" required></div>
        <div class="fld" style="flex:1;min-width:140px"><label for="r-grad">Graduation year (alumni)</label><input id="r-grad" type="number" min="1990" max="${y}"></div>
      </div>
      <div class="fld"><label for="r-cid">College roll number</label><input id="r-cid" type="text" required></div>
      <p class="err" id="r-err" hidden></p>
      <button class="btn btn-p" type="submit">Send registration</button>
      <p class="small">Already registered? <a href="#/login">Log in</a></p>
    </form></div></section></div>`;
}

/* ---------- dashboard ---------- */
async function viewDash() {
  if (S.me.role === 'admin') { location.hash = '#/admin'; return ''; }
  if (S.me.role === 'faculty') { location.hash = '#/verify'; return ''; }
  const d = await api('/api/dashboard'), alum = S.me.role === 'alumni';
  const linked = d.chats.map(c => `<div class="prow">${av(c.partner, 'av-sm')}<div><b>${esc(c.partner.name)}</b><span>${esc(c.partner.role === 'alumni' ? 'Alumni' : 'Student')} · ${esc(c.purpose)}</span></div>
      <button class="round" data-go="#/messages/${c.id}" aria-label="Open chat with ${esc(c.partner.name)}">${c.unread ? c.unread + ' new' : icon('message', 15)}</button></div>`);
  const sugg = d.suggestions.map(s => `<div class="prow">${av(s, 'av-sm')}<div><b>${esc(s.name)}</b><span>Suggested · ${esc(s.headline)}</span></div>
      <button class="round" data-go="#/u/${s.id}" aria-label="View ${esc(s.name)}">View</button></div>`);
  const linkedRows = [...linked, ...sugg].slice(0, 3);
  const waiting = d.requests.slice(0, 3).map(r => `<div class="prow">${av({ id: r.from_id, name: r.name, avatar_url: r.avatar_url }, 'av-sm')}<div><b>${esc(r.name)}</b><span>Chat request · ${esc(r.purpose)}</span></div>
      <button class="round" data-act="msgtab" data-k="requests">Reply</button></div>`);
  const pend = d.achievements.filter(a => a.status !== 'verified').slice(0, 2).map(a => `<div class="prow"><span class="ico-c">${icon('clock', 15)}</span><div><b>${esc(a.title)}</b><span>Waiting for ${esc(a.routed_to?.name || 'a verifier')}</span></div></div>`);
  const now = new Date();
  const hints = { 'Profile strength': 'Complete your profile', 'Milestones verified': 'Of everything you added', 'Requests accepted': alum ? 'Of requests you received' : 'Of requests you sent' };
  return `${why('dash')}<div class="dash">
    <section class="card ga"><div class="card-h"><h2>${alum ? 'Your students' : 'Your mentors'}</h2><button class="see" data-go="#/people">Find people</button></div>
      <div>${linkedRows.join('') || '<p class="small muted">No chats yet.</p>'}</div></section>
    <section class="card gb"><div class="card-h"><h2>Needs your attention</h2><button class="see" data-go="#/messages">Messages</button></div>
      <div>${[...waiting, ...pend].slice(0, 3).join('') || '<p class="small muted">Nothing waiting. You’re all caught up.</p>'}</div></section>
    <section class="card gc"><div class="card-h"><h2>Recent activity</h2></div>
      <div class="sched"><div class="cal">${calendar(now, d.activity)}</div>
        <div>${d.activity.slice(0, 4).map(a => `<div class="drow"><div class="day"><b>${Number(a.at.slice(8, 10))}</b><span>${M[Number(a.at.slice(5, 7)) - 1]}</span></div>
          <div><p>${esc(a.text)}</p></div></div>`).join('') || '<p class="small muted">Your activity will show here.</p>'}</div></div></section>
    <section class="card gd"><div class="card-h"><h2>Your achievements</h2><button class="see" data-act="add">${icon('plus', 14)} Add</button></div>
      ${d.achievements.length ? `<div class="alist">${d.achievements.map(a => `<button class="aitem" data-go="#/u/${S.me.id}"><span class="ico-c">${icon(KIND[a.kind]?.[0] || 'award', 16)}</span>
        <div><b>${esc(a.title)}</b><span class="row" style="gap:6px">${lvl(a.level)}${pill(a.status)}<span class="small muted">${fmtMonth(a.month)}</span></span></div></button>`).join('')}</div>`
        : `<div class="empty"><p>Add your first achievement to start your journey.</p><button class="btn btn-p" data-act="add">${icon('plus', 15)}Add achievement</button></div>`}</section>
    <aside class="rail gr">${d.rings.map(g => `<div class="card gauge">${ring(g.pct)}<div><h3>${esc(g.label)}</h3><p>${esc(hints[g.label] || '')}</p></div></div>`).join('')}
      <div class="card"><div class="card-h" style="margin-bottom:8px"><h2>Profile</h2></div><p class="small muted">Keep your journey up to date so juniors and recruiters see your verified work.</p>
        <button class="btn" style="margin-top:12px;width:100%" data-go="#/u/${S.me.id}">View my profile</button></div></aside>
  </div>`;
}
function calendar(date, activity) {
  const y = date.getFullYear(), m = date.getMonth();
  const days = new Set(activity.filter(a => a.at.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).map(a => Number(a.at.slice(8, 10))));
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7, len = new Date(y, m + 1, 0).getDate(), prevLen = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push(`<td class="out"><span>${prevLen - i}</span></td>`);
  for (let dd = 1; dd <= len; dd++) cells.push(`<td class="${dd === date.getDate() ? 'today' : days.has(dd) ? 'has' : ''}"><span>${dd}</span></td>`);
  for (let dd = 1; cells.length % 7; dd++) cells.push(`<td class="out"><span>${dd}</span></td>`);
  const rows = []; for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  return `<div class="cal-h"><span>${MONTHS[m]} ${y}</span></div>
    <table><thead><tr>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

/* ---------- people ---------- */
const PATHS = [['exam', 'Cleared a competitive exam'], ['research', 'Went into research'], ['study', 'Higher studies'], ['tech', 'Working in tech'], ['finance', 'Finance & consulting'], ['govt', 'Government services'], ['startup', 'Started a business'], ['sports', 'National-level sports']];
async function viewPeople() {
  const p = S.people, o = (v, l, c) => `<option value="${v}" ${c === v ? 'selected' : ''}>${esc(l)}</option>`;
  return `${why('people')}<div class="people">
    <aside class="card filters">
      <div class="fld"><label for="p-q">Search</label><input id="p-q" type="search" data-p="q" value="${esc(p.q)}" placeholder="Name, company, skill"></div>
      <div class="fld"><label for="p-role">Show</label><select id="p-role" data-p="role">${o('', 'Everyone', p.role)}${o('alumni', 'Alumni', p.role)}${o('student', 'Students', p.role)}</select></div>
      <div class="fld"><label for="p-dept">Department</label><select id="p-dept" data-p="dept">${o('', 'All departments', p.dept)}${S.meta.departments.map(d => o(d.code, d.name, p.dept)).join('')}</select></div>
      <label class="check"><input type="checkbox" data-p="mentor" ${p.mentor ? 'checked' : ''}> Open to mentoring</label>
    </aside>
    <section class="stack">
      <div class="card"><h2 style="font-size:16px">Find people by the path they took</h2><p class="small muted">Pick an outcome to see who got there and what they did in college.</p>
        <div class="row" style="margin-top:12px">${PATHS.map(([k, l]) => `<button class="chip fchip" data-act="path" data-k="${k}" aria-pressed="${p.path === k}">${esc(l)}</button>`).join('')}</div></div>
      <div id="presults">${await peopleResults()}</div>
    </section></div>`;
}
async function peopleResults() {
  const p = S.people, qs = new URLSearchParams({ q: p.q, role: p.role, dept: p.dept, path: p.path, limit: p.limit });
  if (p.mentor) qs.set('mentor', '1');
  const r = await api('/api/people?' + qs);
  return `<p class="small muted" style="margin-bottom:10px">${fmtN(r.total)} ${r.total === 1 ? 'person' : 'people'}${p.path ? ' took this path' : ''} · only college-verified milestones are shown</p>
    ${r.people.length ? `<div class="pgrid">${r.people.map(personCard).join('')}</div>` : `<div class="card empty">${icon('search', 28)}<p>No one matches. Try another department or clear the search.</p></div>`}
    ${r.total > r.people.length ? `<div style="text-align:center;margin-top:16px"><button class="btn" data-act="more">Show more</button></div>` : ''}`;
}
function personCard(u) {
  return `<article class="card pcard"><div class="pcard-cov ${bannerClass(u)}" ${bannerStyle(u)}></div><div class="pcard-b">${av(u, 'av-lg')}
    <h3><button class="link" data-go="#/u/${u.id}">${esc(u.name)}</button></h3>
    <p class="small">${esc(u.headline)}</p><p class="small muted">${esc(meta(u))}</p>
    <div class="row"><span class="chip">${u.role === 'alumni' ? 'Alumni' : 'Student'}</span>${u.mentor ? '<span class="chip chip-a">Open to mentoring</span>' : ''}${u.verified ? `<span class="chip">${icon('check', 12)}${u.verified} verified</span>` : ''}</div>
    ${S.people.path && u.path.length ? `<ol class="path">${u.path.map(m => `<li><i>${m.month.slice(0, 4)}</i>${esc(m.title.length > 46 ? m.title.slice(0, 44) + '…' : m.title)}</li>`).join('')}</ol>` : ''}
    <div class="acts">${chatBtn(u, u.relation, 'btn-sm')}<button class="btn btn-g btn-sm" data-go="#/u/${u.id}">View profile</button></div></div></article>`;
}
function chatBtn(u, rel, sm = '') {
  if (!rel || rel.kind === 'self' || S.me.role === 'admin' || u.role === 'admin') return '';
  if (rel.kind === 'chat') return `<button class="btn btn-p ${sm}" data-go="#/messages/${rel.chat_id}">${icon('message', 15)}Message</button>`;
  if (rel.kind === 'sent') return `<button class="btn ${sm}" disabled>${icon('clock', 15)}Request sent</button>`;
  if (rel.kind === 'received') return `<button class="btn btn-p ${sm}" data-act="msgtab" data-k="requests">${icon('message', 15)}Reply to request</button>`;
  if (!u.accepts) return `<button class="btn ${sm}" disabled>Not taking requests</button>`;
  return `<button class="btn btn-p ${sm}" data-act="ask" data-id="${u.id}" data-name="${esc(u.name)}">${icon('send', 15)}Request to chat</button>`;
}

/* ---------- profile ---------- */
function phase(u, m) {
  if (m.kind === 'graduation' || (u.role === 'alumni' && m.month > u.grad_year + '-06')) return { k: 'after', label: 'After college', yr: 'since ' + u.grad_year };
  const y = Math.max(1, ayStart(m.month) - u.adm_year + 1);
  return { k: 'y' + y, label: ord(y) + ' year', yr: ayLabel(u.adm_year + y - 1) };
}
function phases(u) {
  const n = u.role === 'alumni' ? u.grad_year - u.adm_year : CUR_AY - u.adm_year + 1, out = [];
  for (let y = 1; y <= n; y++) out.push({ k: 'y' + y, label: ord(y) + ' year', yr: ayLabel(u.adm_year + y - 1) });
  if (u.role === 'alumni') out.push({ k: 'after', label: 'After college', yr: 'since ' + u.grad_year });
  return out;
}
async function viewProfile(id) {
  const d = await api('/api/people/' + Number(id)), u = d.user, own = u.id === S.me.id, all = own || ['admin', 'faculty'].includes(S.me.role);
  if (S.prof.id !== u.id) { S.prof = { id: u.id, jf: 'all', ph: '', open: new Set() }; const last = d.milestones.filter(m => ACH.includes(m.kind)).pop(); if (last) S.prof.open.add(last.id); }
  const groups = { all: () => true, ach: m => ACH.includes(m.kind), campus: m => ['society', 'position', 'event'].includes(m.kind), work: m => ['project', 'internship', 'job', 'startup'].includes(m.kind), edu: m => ['graduation', 'study', 'phd'].includes(m.kind) };
  const shown = d.milestones.filter(groups[S.prof.jf]).filter(m => !S.prof.ph || phase(u, m).k === S.prof.ph);
  const verAch = d.milestones.filter(m => ACH.includes(m.kind) && m.status === 'verified');
  const counts = ['International', 'National', 'State', 'University', 'College'].map(l => [l, verAch.filter(m => m.level === l).length]).filter(x => x[1]);
  const link = location.origin + '/#/u/' + u.id;
  return `${why('profile')}<div class="pf"><div class="stack">
    <section class="card pf-top"><div class="cover ${bannerClass(u)}" ${bannerStyle(u)}>${own ? `<button class="btn btn-sm edit" data-act="banner">${icon('gear', 14)}Edit banner</button>` : ''}</div>
      <div class="pf-head"><div class="pf-av">${av(u, 'av-xl')}${own ? `<button class="cam" data-act="photo" aria-label="Change profile photo" title="Change profile photo">${icon('camera', 16)}</button>` : ''}</div>
        <h2 class="pf-name">${esc(u.name)}${verAch.length ? `<span class="st st-ok">${icon('shield', 13)}${verAch.length} verified achievements</span>` : ''}</h2>
        <p style="font-size:15px;margin-top:2px">${esc(u.headline)}</p>
        <p class="small muted" style="margin-top:4px">${esc(meta(u))}${u.location ? ' · ' + esc(u.location) : ''}${u.college_id ? ` · <span class="mono">${esc(u.college_id)}</span>` : ''}</p>
        <div class="row" style="margin-top:10px">${d.unclaimed ? '<span class="chip">From the college register · no login yet</span>' : ''}${u.role === 'alumni' && u.status ? `<span class="chip chip-a">${icon('case', 12)}${esc(u.status)}${u.status_updated ? ' · confirmed ' + fmtDay(u.status_updated) : ''}</span>` : ''}
          ${u.mentor ? '<span class="chip chip-a">Open to mentoring</span>' : ''}${u.links.map(l => `<span class="chip">${icon('link', 12)}${esc(l)}</span>`).join('')}</div>
        <div class="row" style="margin-top:14px">${own ? `<button class="btn btn-p" data-act="add">${icon('plus', 15)}Add to journey</button><button class="btn" data-go="#/settings">Edit profile</button>` : chatBtn(u, d.relation)}
          <button class="btn" data-act="copy" data-t="${esc(link)}">${icon('copy', 15)}Copy profile link</button>
          ${!own && S.me.role !== 'admin' ? `<button class="btn btn-g" data-act="report" data-id="${u.id}" data-name="${esc(u.name)}">Report incorrect info</button>` : ''}</div>
      </div></section>
    ${u.about ? `<section class="card"><div class="card-h"><h2>About</h2></div><p style="max-width:70ch">${esc(u.about)}</p></section>` : ''}
    <section class="card"><div class="between"><h2 style="font-size:16px">Journey</h2><div class="row">${counts.map(([l, n]) => `<span class="chip ${l === 'National' || l === 'International' ? 'chip-g' : ''}">${n} ${l}</span>`).join('')}</div></div>
      <p class="small muted" style="margin-top:2px">${all ? 'You see every item and its status. Others see only verified milestones.' : 'Every milestone here was checked by a faculty verifier or IQAC.'}</p>
      <div class="strip" role="group" aria-label="Filter by year">${phases(u).map(ph => { const its = d.milestones.filter(m => phase(u, m).k === ph.k);
        return `<button class="yseg" data-act="ph" data-k="${ph.k}" aria-pressed="${S.prof.ph === ph.k}"><b>${ph.label}</b><small>${ph.yr}</small><span class="dots">${its.map(m => `<span class="d8 ${m.status !== 'verified' ? 'p' : ACH.includes(m.kind) ? 'a' : ''}"></span>`).join('')}</span></button>`; }).join('')}</div>
      <div class="legend"><span><span class="d8 a"></span>Achievement</span><span><span class="d8"></span>Other milestone</span>${all ? '<span><span class="d8 p"></span>Waiting for verification</span>' : ''}</div>
      <div class="row" style="margin-top:12px">${[['all', 'All'], ['ach', 'Achievements'], ['campus', 'Societies & roles'], ['work', 'Projects & work'], ['edu', 'Education']].map(([k, l]) => `<button class="chip fchip" data-act="jf" data-k="${k}" aria-pressed="${S.prof.jf === k}">${l}</button>`).join('')}</div>
      ${journey(u, shown, own)}
    </section></div>
    <aside class="stack">
      ${own && d.strength ? `<section class="card stack" style="gap:10px"><div class="card-h" style="margin:0"><h2>Profile strength</h2><span class="small muted">${d.strength.pct}%</span></div><div class="meter"><span style="width:${d.strength.pct}%"></span></div>
        ${d.strength.checks.map(c => `<div class="tick ${c.done ? 'done' : ''}">${icon(c.done ? 'check' : 'plus', 15)}<span>${esc(c.label)}</span></div>`).join('')}</section>` : ''}
      ${!own && S.me.role !== 'admin' && !d.unclaimed ? `<section class="card stack" style="gap:10px"><h2 style="font-size:15px">Talk to ${esc(first(u.name))}</h2>
        ${u.mentor ? `<p class="small">Open to mentoring on:</p><div class="row">${u.topics.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : `<p class="small">${u.accepts ? 'Accepts chat requests.' : 'Not taking chat requests right now.'}</p>`}
        <div>${chatBtn(u, d.relation)}</div><p class="small muted">${icon('lock', 13)} Your request includes your profile and a short note. Phone numbers and emails stay hidden.</p></section>` : ''}
      ${u.skills.length ? `<section class="card"><div class="card-h"><h2>Skills</h2></div><div class="row">${u.skills.map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div></section>` : ''}
      <section class="card"><div class="card-h"><h2>Similar paths</h2></div><div class="stack" style="gap:8px">${d.similar.map(x => `<div class="prow">${av(x, 'av-sm')}<div><b>${esc(x.name)}</b><span>${esc(x.headline)}</span></div><button class="round" data-go="#/u/${x.id}" aria-label="View ${esc(x.name)}">${icon('arrow', 14)}</button></div>`).join('') || '<p class="small muted">No similar profiles yet.</p>'}</div></section>
    </aside></div>`;
}
function journey(u, list, own) {
  if (!list.length) return `<div class="empty">${icon('info', 24)}<p>Nothing in this view.</p>${own ? `<button class="btn btn-p" data-act="add">${icon('plus', 15)}Add to journey</button>` : ''}</div>`;
  const groups = [];
  list.forEach(m => { const ph = phase(u, m); let g = groups.find(x => x.k === ph.k); if (!g) groups.push(g = { ...ph, items: [] }); g.items.push(m); });
  return groups.map(g => `<div class="jgroup"><div class="jlab">${g.label}<em>${g.yr}</em></div><ol class="jlist">${g.items.map(m => {
    const open = S.prof.open.has(m.id), [ic, label] = KIND[m.kind] || ['award', m.kind];
    return `<li class="${ACH.includes(m.kind) ? 'is-ach' : ''}"><button class="jrow" data-act="item" data-id="${m.id}" aria-expanded="${open}">
      <span class="jico">${icon(ic, 18)}</span><span><span class="jt">${esc(m.title)}</span><span class="js">${esc(label)}${m.org ? ' · ' + esc(m.org) : ''} · ${fmtMonth(m.month)}</span></span>
      <span class="jtags">${lvl(m.level)}${pill(m.status)}</span></button>
      ${open ? `<div class="jdet">${m.description ? `<p>${esc(m.description)}</p>` : ''}
        ${m.proof_url ? `<div class="row">${icon(m.proof_type === 'link' ? 'link' : 'file', 16)}<a href="${esc(m.proof_url)}" target="_blank" rel="noopener">${esc(m.proof_label || 'View proof')}</a></div>` : m.proof_label ? `<div class="row muted">${icon('file', 16)}${esc(m.proof_label)}</div>` : ''}
        ${m.status === 'verified' && m.verifier ? `<p style="color:var(--ok)">${icon('shield', 14)} Verified by ${esc(m.verifier.name)} · ${fmtDay(m.verified_at)}</p>` : ''}
        ${m.status === 'pending' ? `<p style="color:var(--warn)">Waiting for ${esc(m.routed_to?.name || 'a verifier')} · sent ${fmtDay(m.submitted_at)}</p>` : ''}
        ${m.status === 'info' || m.status === 'rejected' ? `<p style="color:var(--bad)">${m.status === 'info' ? 'More information requested' : 'Not verified'}${m.note ? ': ' + esc(m.note) : ''}</p>
          ${own ? `<div class="row"><button class="btn btn-sm btn-p" data-act="resubmit" data-id="${m.id}">Reply and resend</button></div>` : ''}` : ''}
        ${own && m.status !== 'verified' ? `<div><button class="btn btn-sm btn-g" data-act="delms" data-id="${m.id}">Withdraw</button></div>` : ''}
      </div>` : ''}</li>`; }).join('')}</ol></div>`).join('');
}

/* ---------- messages ---------- */
async function viewMessages(id) {
  const [cl, rq] = await Promise.all([api('/api/chats'), api('/api/requests')]);
  let pane = `<div class="empty">${icon('message', 32)}<p>Chats open only after the other person accepts your request.</p></div>`;
  if (id) {
    const c = await api(`/api/chats/${Number(id)}/messages`);
    S.msg.last = c.messages.length ? c.messages[c.messages.length - 1].id : 0;
    const p = c.chat.partner;
    pane = `<div class="pane-h"><button class="btn btn-g btn-sm back" data-go="#/messages" aria-label="Back to chats">${icon('back', 16)}</button>${av(p)}
        <div><button class="link" data-go="#/u/${p.id}"><b>${esc(p.name)}</b></button><p class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.headline)}</p></div>
        <button class="btn btn-g btn-sm" data-act="report" data-id="${p.id}" data-name="${esc(p.name)}">Report</button></div>
      <div class="thread" id="thread"><p class="note">Started from a ${esc(c.chat.purpose.toLowerCase())} request · ${fmtDay(c.chat.created_at)}. Contact details stay hidden unless you share them.</p>
        ${c.messages.map(bubble).join('')}</div>
      <form class="compose" data-form="send" data-chat="${c.chat.id}"><label for="msg-in" hidden>Message</label><textarea id="msg-in" placeholder="Write a message" required></textarea><button class="btn btn-p" type="submit">${icon('send', 15)}Send</button></form>`;
    refreshCounts();
  }
  const tab = S.msg.tab;
  const reqRow = (r, dir) => `<div class="req"><div class="row">${av({ id: r.uid, name: r.name }, 'av-sm')}<div style="flex:1;min-width:0"><button class="link" data-go="#/u/${r.uid}"><b class="small">${esc(r.name)}</b></button><p class="small muted">${esc(r.headline)}</p></div></div>
    <div class="row"><span class="chip chip-a">${esc(r.purpose)}</span><span class="small muted">${fmtDay(r.created_at)}</span></div><q>${esc(r.note)}</q>
    <div class="row">${dir === 'in' ? `<button class="btn btn-p btn-sm" data-act="reqdo" data-k="accept" data-id="${r.id}">Accept</button><button class="btn btn-sm" data-act="reqdo" data-k="decline" data-id="${r.id}">Decline</button>`
      : `<span class="st st-warn">${icon('clock', 13)}Waiting for ${esc(first(r.name))}</span><button class="btn btn-g btn-sm" data-act="reqdo" data-k="withdraw" data-id="${r.id}">Withdraw</button>`}</div></div>`;
  return `${why('messages')}<div class="card two" data-open="${id ? 1 : 0}">
    <div class="list"><div class="tabs"><button data-act="msgtab" data-k="chats" aria-pressed="${tab === 'chats'}">Chats</button><button data-act="msgtab" data-k="requests" aria-pressed="${tab === 'requests'}">Requests${rq.received.length ? ` (${rq.received.length})` : ''}</button></div>
      ${tab === 'chats' ? (cl.chats.map(c => `<button class="li" data-go="#/messages/${c.id}" aria-current="${String(c.id) === String(id)}">${av(c.partner)}<div><b>${esc(c.partner.name)}<small>${fmtWhen(c.last_at)}</small></b><p>${c.last_mine ? 'You: ' : ''}${esc(c.last)}</p></div>${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</button>`).join('')
        || `<div class="empty"><p>No chats yet. Find someone in People and send a request.</p><button class="btn" data-go="#/people">Find people</button></div>`)
      : `<p class="sec-l">RECEIVED</p>${rq.received.map(r => reqRow(r, 'in')).join('') || '<p class="req small muted">No requests waiting.</p>'}<p class="sec-l">SENT</p>${rq.sent.map(r => reqRow(r, 'out')).join('') || '<p class="req small muted">No pending requests.</p>'}`}
    </div><div class="pane">${pane}</div></div>`;
}
const bubble = m => `<div class="bub ${m.sender_id === S.me.id ? 'me' : 'them'}" data-mid="${m.id}">${esc(m.body)}<small>${fmtWhen(m.created_at)}</small></div>`;
function scrollThread() { const t = $('thread'); if (t) t.scrollTop = t.scrollHeight; }
async function pollChat() {
  const r = route(); if (r.name !== 'messages' || !r.id) return;
  try {
    const c = await api(`/api/chats/${Number(r.id)}/messages?after=${S.msg.last}`);
    const fresh = c.messages.filter(m => !document.querySelector(`[data-mid="${m.id}"]`));
    if (fresh.length) { $('thread').insertAdjacentHTML('beforeend', fresh.map(bubble).join('')); S.msg.last = fresh[fresh.length - 1].id; scrollThread(); }
  } catch { }
}

/* ---------- verification ---------- */
async function viewVerify() {
  const { items } = await api('/api/verify');
  const sel = items.find(i => `${i.type}-${i.id}` === S.ver.sel);
  const label = i => i.type === 'account' ? 'New registration' : i.type === 'report' ? 'Profile report' : i.milestone.verifier === null && i.meta?.status ? 'Status update' : (KIND[i.milestone.kind] || [, 'Milestone'])[1];
  const title = i => i.type === 'account' ? `${i.person.role === 'alumni' ? 'Alumni' : 'Student'}, ${deptName(i.person.dept)}` : i.type === 'report' ? i.reason : i.milestone.title;
  let detail = `<div class="empty">${icon('shield', 32)}<p>Pick an item to see the proof and decide.</p></div>`;
  if (sel) {
    let body = '';
    if (sel.type === 'milestone') {
      const m = sel.milestone, p = sel.person;
      body = `<div class="row">${av(p)}<div><button class="link" data-go="#/u/${p.id}"><b>${esc(p.name)}</b></button><p class="small muted">${esc(meta({ role: p.role, dept: p.dept, adm_year: p.adm_year, grad_year: p.grad_year }))} · <span class="mono">${esc(p.college_id)}</span></p></div></div>
        <div><h2 style="font-size:19px">${esc(m.title)}</h2><div class="row" style="margin-top:8px">${lvl(m.level)}<span class="chip">${esc((KIND[m.kind] || [, m.kind])[1])}</span><span class="small muted">${esc(m.org)} · ${fmtMonth(m.month)}</span></div></div>
        ${sel.meta?.status ? `<p class="small">Changes current status to <b>${esc(sel.meta.status)}</b>: ${esc(m.title)}</p>` : ''}
        ${m.description ? `<p class="small">${esc(m.description)}</p>` : ''}
        <div class="proof">${icon(m.proof_type === 'link' ? 'link' : 'file', 26)}<div><b class="small">Proof</b><p class="small">${m.proof_url ? `<a href="${esc(m.proof_url)}" target="_blank" rel="noopener">${esc(m.proof_label || 'Open proof')}</a>` : esc(m.proof_label || 'No proof attached')}</p></div></div>
        ${sel.status === 'info' ? `<p class="small" style="color:var(--warn)">You asked: ${esc(m.note || '')}</p>` : ''}
        <p class="small muted">Routed to ${esc(m.routed_to?.name || 'you')} (${esc(m.routed_to?.scope || '')}). Submitted ${fmtDay(sel.submitted_at)}.</p>`;
    } else if (sel.type === 'account') {
      const p = sel.person;
      body = `<h2 style="font-size:19px">${esc(p.name)}</h2><div class="tw"><table class="t"><tbody>
        ${[['Role', p.role === 'alumni' ? 'Alumni' : 'Student'], ['Department', deptName(p.dept)], ['Batch', `${p.adm_year}–${p.grad_year || ''}`], ['Roll number', p.college_id], ['Email', p.email]].map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>
        <p class="small muted">${esc(sel.check)} Check the roll number against the register before approving.</p>`;
    } else {
      body = `<h2 style="font-size:19px">${esc(sel.reason)}</h2><p class="small">About <button class="link" data-go="#/u/${sel.person.id}"><b>${esc(sel.person.name)}</b></button>, reported by ${esc(sel.reporter)}.</p><p>${esc(sel.details)}</p>`;
    }
    const canNote = sel.type === 'milestone';
    detail = `<div class="pane-h"><button class="btn btn-g btn-sm back" data-act="vback" aria-label="Back to list">${icon('back', 16)}</button><div><b>${esc(label(sel))}</b></div>${pill(sel.status)}</div>
      <div class="detail">${body}
      ${S.ver.mode ? `<div class="fld"><label for="v-note">${S.ver.mode === 'reject' ? 'Reason (they will see this)' : 'What do you need?'}</label><textarea id="v-note"></textarea></div>
        <div class="row"><button class="btn ${S.ver.mode === 'reject' ? 'btn-d' : 'btn-p'}" data-act="vdo" data-k="${S.ver.mode}">${S.ver.mode === 'reject' ? 'Reject' : 'Send request'}</button><button class="btn btn-g" data-act="vmode" data-k="">Cancel</button></div>`
      : `<div class="row"><button class="btn btn-p" data-act="vdo" data-k="approve">${icon('check', 15)}${sel.type === 'report' ? 'Mark resolved' : 'Approve'}</button>
        ${canNote ? `<button class="btn" data-act="vmode" data-k="info">Ask for more info</button><button class="btn btn-d" data-act="vmode" data-k="reject">Reject</button>` : `<button class="btn btn-d" data-act="vdo" data-k="reject">${sel.type === 'report' ? 'Dismiss' : 'Reject'}</button>`}</div>`}</div>`;
  }
  return `${why('verify')}<div class="between" style="margin-bottom:14px"><p class="small muted">${S.me.role === 'admin' ? 'Everything waiting across the college: achievements, status updates, registrations and reports.' : 'Routed to you as ' + esc(S.me.scope || S.me.headline) + '.'}</p><span class="chip">${items.length} waiting</span></div>
    <div class="card two" data-open="${sel ? 1 : 0}"><div class="list">${items.map(i => `<button class="li" data-act="vsel" data-k="${i.type}-${i.id}" aria-current="${`${i.type}-${i.id}` === S.ver.sel}">${av(i.person, 'av-sm')}
      <div><b>${esc(i.person.name)}<small>${fmtDay(i.submitted_at)}</small></b><p>${esc(title(i))}</p><span class="small muted">${esc(label(i))}</span></div></button>`).join('') || `<div class="empty">${icon('check', 28)}<p>All caught up.</p></div>`}</div>
    <div class="pane">${detail}</div></div>`;
}

/* ---------- admin ---------- */
async function viewAdmin() {
  const a = S.adm, tabs = [['overview', 'Overview'], ['reports', 'NAAC / NIRF reports'], ['records', 'Records'], ['audit', 'Audit log']];
  return `${why('admin')}<div class="between" style="margin-bottom:6px"><div class="atabs">${tabs.map(([k, l]) => `<button data-act="atab" data-k="${k}" aria-pressed="${a.tab === k}">${l}</button>`).join('')}</div>
    <select id="a-dept" data-a="dept" style="width:auto">${['', ...S.meta.departments.map(d => d.code)].map(c => `<option value="${c}" ${a.dept === c ? 'selected' : ''}>${c ? esc(deptName(c)) : 'All departments'}</option>`).join('')}</select></div>
    <div id="aregion">${await adminRegion()}</div>`;
}
async function adminRegion() { return ({ overview: aOverview, reports: aReports, records: aRecords, audit: aAudit })[S.adm.tab](); }
async function aOverview() {
  const o = await api('/api/admin/overview?dept=' + S.adm.dept), k = o.kpis;
  const tiles = [['Total alumni', k.alumni], ['Current students', k.students], ['Verified achievements', k.verified], ['Pending verification', k.pending + k.registrations, '#/verify'], ['Active mentors', k.mentors], ['Departments', k.departments]];
  const totalAl = o.outcomes.reduce((n, x) => n + x.value, 0);
  return `<div class="stack" style="gap:18px">
    <div class="kpis">${tiles.map(([l, v, go]) => go ? `<button class="kpi" data-go="${go}"><span>${l}</span><b>${fmtN(v)}</b></button>` : `<div class="kpi"><span>${l}</span><b>${fmtN(v)}</b></div>`).join('')}</div>
    <div class="grid2">
      <section class="card"><div class="card-h"><h2>Verified achievements by level</h2></div>${cols(o.byLevel.map(x => ({ l: x.label, v: x.value })), true)}</section>
      <section class="card"><div class="card-h"><h2>Where alumni are now</h2><span class="small muted">${fmtN(totalAl)} alumni</span></div>
        <div class="stack" style="gap:4px">${o.outcomes.map(x => { const max = Math.max(1, ...o.outcomes.map(y => y.value));
          return `<div class="hb" title="${esc(x.label)}: ${x.value}"><span>${esc(x.label)}</span><div class="hb-t"><i style="width:calc((100% - 90px) * ${(x.value / max).toFixed(3)})"></i><span>${fmtN(x.value)} · ${totalAl ? Math.round(x.value / totalAl * 100) : 0}%</span></div></div>`; }).join('')}</div></section>
    </div>
    <section class="card"><div class="card-h"><h2>Alumni on record by graduation year</h2></div>${cols(o.byYear.map(x => ({ l: "'" + String(x.label).slice(2), v: x.value, t: 'Class of ' + x.label })), false)}</section>
    <div class="grid2">
      <section class="card"><div class="card-h"><h2>Mentoring</h2></div><div class="stack" style="gap:8px">
        <div class="prow" style="border-radius:14px"><div><b>${fmtN(k.requests)} chat requests sent to alumni and students</b><span>${fmtN(k.accepted)} accepted (${k.requests ? Math.round(k.accepted / k.requests * 100) : 0}%)</span></div></div>
        <div class="prow" style="border-radius:14px"><div><b>${fmtN(k.mentors)} alumni open to mentoring</b><span>Counted in the NAAC alumni engagement report</span></div></div></div></section>
      <section class="card"><div class="card-h"><h2>Needs attention</h2></div><div class="stack" style="gap:8px">
        <div class="prow" style="border-radius:14px"><div><b>${fmtN(k.stale)} alumni haven’t confirmed their status in 2+ years</b><span>They get an email asking “Is this still what you’re doing?”</span></div><button class="btn btn-sm" data-act="remind">Send reminder</button></div>
        <div class="prow" style="border-radius:14px"><div><b>${fmtN(k.pending)} milestones and ${fmtN(k.registrations)} registrations waiting</b><span>Routed to faculty and IQAC</span></div><button class="btn btn-sm" data-go="#/verify">Open queue</button></div></div></section>
    </div></div>`;
}
function cols(data, all) {
  const max = Math.max(1, ...data.map(d => d.v)), mi = data.findIndex(d => d.v === max);
  return `<div class="cols">${data.map((d, i) => `<div class="col" title="${esc(d.t || d.l)}: ${fmtN(d.v)}">${all || i === mi || i === data.length - 1 ? `<span>${fmtN(d.v)}</span>` : ''}<i style="height:calc((100% - 22px) * ${(d.v / max).toFixed(3)})"></i></div>`).join('')}</div>
    <div class="col-l">${data.map(d => `<span>${esc(d.l)}</span>`).join('')}</div>`;
}
const REPORTS = [['progression', 'NAAC · Student progression', 'batch'], ['awards', 'NAAC · Awards and medals', 'ay'], ['nirf', 'NIRF · Graduation outcomes', 'batch'], ['engagement', 'NAAC · Alumni engagement', 'none']];
async function aReports() {
  const a = S.adm, rep = REPORTS.find(r => r[0] === a.rtype), yr = new Date().getFullYear();
  const years = rep[2] === 'ay' ? [CUR_AY - 1, CUR_AY - 2, CUR_AY - 3, CUR_AY] : [yr, yr - 1, yr - 2, yr - 3, yr - 4];
  if (!years.map(String).includes(a.ryear)) a.ryear = String(years[0]);
  const qs = `year=${a.ryear}&dept=${a.dept}`;
  const d = await api(`/api/admin/reports/${a.rtype}?${qs}`);
  return `<div class="stack" style="gap:16px">
    <section class="card"><div class="row" style="align-items:flex-end">
      <div class="fld" style="flex:2;min-width:220px"><label for="a-rtype">Report</label><select id="a-rtype" data-a="rtype">${REPORTS.map(r => `<option value="${r[0]}" ${a.rtype === r[0] ? 'selected' : ''}>${r[1]}</option>`).join('')}</select></div>
      ${rep[2] !== 'none' ? `<div class="fld" style="flex:1;min-width:150px"><label for="a-ryear">${rep[2] === 'ay' ? 'Academic year' : 'Graduating batch'}</label><select id="a-ryear" data-a="ryear">${years.map(y => `<option value="${y}" ${a.ryear === String(y) ? 'selected' : ''}>${rep[2] === 'ay' ? ayLabel(y) : y}</option>`).join('')}</select></div>` : ''}
      <a class="btn btn-p" href="/api/admin/reports/${a.rtype}?${qs}&format=csv" download>${icon('file', 15)}Download CSV</a></div>
      <p class="small muted" style="margin-top:10px">Only verified records are counted. Each award row names its verifier and links to its proof.</p></section>
    <div class="kpis">${d.summary.map(([l, v]) => `<div class="kpi"><span>${esc(l)}</span><b>${fmtN(v)}</b></div>`).join('')}</div>
    <div class="tw"><table class="t"><thead><tr>${d.head.map((h, i) => `<th class="${typeof d.rows[0]?.[i] === 'number' ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${d.rows.slice(0, 50).map(r => `<tr>${r.map(c => `<td class="${typeof c === 'number' ? 'n' : ''}">${String(c).startsWith('http') ? `<a href="${esc(c)}" target="_blank" rel="noopener">Link</a>` : esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${d.head.length}" class="muted">No verified records for this selection.</td></tr>`}</tbody></table></div>
    ${d.rows.length > 50 ? `<p class="small muted">Showing 50 of ${fmtN(d.rows.length)} rows. Download the CSV for all of them.</p>` : ''}</div>`;
}
async function aRecords() {
  const a = S.adm, r = await api(`/api/admin/records?q=${encodeURIComponent(a.rq)}&role=${a.rrole}&dept=${a.dept}&page=${a.rpage}`);
  return `<div class="stack" style="gap:12px"><div class="row">
      <div class="fld" style="flex:2;min-width:200px"><label for="a-rq">Search records</label><input id="a-rq" type="search" data-a="rq" value="${esc(a.rq)}" placeholder="Name, roll number or email"></div>
      <div class="fld" style="flex:1;min-width:140px"><label for="a-rrole">Role</label><select id="a-rrole" data-a="rrole"><option value="">All</option><option value="alumni" ${a.rrole === 'alumni' ? 'selected' : ''}>Alumni</option><option value="student" ${a.rrole === 'student' ? 'selected' : ''}>Students</option></select></div></div>
    <div class="tw"><table class="t"><thead><tr><th>Roll number</th><th>Name</th><th>Role</th><th>Department</th><th>Batch</th><th>Status now</th><th class="n">Achievements</th><th>Alumni form</th><th>Account</th></tr></thead><tbody>
      ${r.rows.map(x => `<tr><td class="mono">${esc(x.college_id)}</td><td><button class="link" data-go="#/u/${x.id}">${esc(x.name)}</button></td><td>${x.role === 'alumni' ? 'Alumni' : 'Student'}</td><td>${esc(deptName(x.dept))}</td>
        <td>${x.adm_year}–${x.grad_year ? String(x.grad_year).slice(2) : ''}</td><td>${esc(x.now_title || x.status || (x.role === 'student' ? 'Studying' : 'Not reported'))}</td><td class="n">${x.verified}</td>
        <td>${x.role === 'alumni' ? `<button class="link small" data-act="editform" data-id="${x.id}">${x.form_source ? (x.form_verified ? 'Verified' : 'Review') : 'Add'} · ${({ self: 'by alumna', 'iqac-form': 'IQAC', 'paper-scan': 'scan', import: 'import' })[x.form_source] || 'none'}</button>` : '<span class="muted small">Student</span>'}</td>
        <td>${x.account === 'active' ? '<span class="small">Active</span>' : x.account === 'unclaimed' ? '<span class="small muted">No login yet</span>' : pill('pending')}</td></tr>`).join('')}</tbody></table></div>
    <div class="pager"><span class="small muted">${fmtN(r.page * 25 + 1)}–${fmtN(Math.min(r.total, r.page * 25 + 25))} of ${fmtN(r.total)}</span>
      <div class="row"><button class="btn btn-sm" data-act="rpage" data-k="-1" ${r.page ? '' : 'disabled'}>Previous</button><button class="btn btn-sm" data-act="rpage" data-k="1" ${(r.page + 1) * 25 < r.total ? '' : 'disabled'}>Next</button></div></div></div>`;
}
async function aAudit() {
  const r = await api('/api/admin/audit');
  return `<div class="tw"><table class="t"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>${r.rows.map(x => `<tr><td style="white-space:nowrap">${fmtDay(x.created_at)} ${x.created_at.slice(11, 16)}</td><td>${esc(x.actor || '')}</td><td>${esc(x.action)}</td><td>${esc(x.target)}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------- fame ---------- */
async function viewFame() {
  const f = await api('/api/fame');
  return `${why('fame')}<p class="small muted" style="margin-bottom:14px">${ayLabel(f.ay)} · chosen from verified achievements only. The top entry in each category is the nominee; the rest are the shortlist.</p>
    <div class="fame">${f.categories.map(c => { const [w, ...rest] = c.entries;
      return `<section class="card fcard"><p class="eyebrow">${esc(c.label)}</p>${w ? `<div class="row">${av({ id: w.uid, name: w.name }, 'av-lg')}<div style="flex:1;min-width:0"><h3><button class="link" data-go="#/u/${w.uid}">${esc(w.name)}</button></h3><p class="small muted">${esc(deptName(w.dept))} · ${w.role === 'alumni' ? 'Class of ' + w.grad_year : 'Student'}</p></div></div>
        <p>${esc(w.title)}</p><div class="row">${lvl(w.level)}${pill('verified')}<span class="small muted">${fmtMonth(w.month)}</span></div>
        ${rest.length ? `<div class="stack" style="gap:6px"><p class="small muted">Shortlist</p>${rest.map(x => `<div class="prow"><div><b>${esc(x.name)}</b><span>${esc(x.title)}</span></div>${lvl(x.level)}</div>`).join('')}</div>` : ''}`
        : '<p class="small muted">No verified entries this year yet.</p>'}</section>`; }).join('')}
      <section class="card fcard"><p class="eyebrow">Alumni Spotlight</p><p class="small muted">Alumni who accepted the most mentoring requests.</p>
        ${f.spotlight.map(s => `<div class="prow">${av(s, 'av-sm')}<div><b>${esc(s.name)}</b><span>${esc(s.headline)}</span></div><span class="chip chip-a">${s.accepted} mentored</span></div>`).join('') || '<p class="small muted">No mentoring yet.</p>'}</section>
    </div>`;
}

/* ---------- settings ---------- */
async function viewSettings() {
  const u = S.me, alum = u.role === 'alumni', person = u.role === 'student' || alum;
  const outcome = alum ? (await api('/api/me/outcome')).outcome : null;
  return `${why('settings')}<div class="grid2" style="align-items:start">
    <section class="card"><div class="card-h"><h2>Profile</h2></div><form class="stack" data-form="profile" style="gap:12px">
      <div class="fld"><label for="s-head">Headline</label><input id="s-head" type="text" maxlength="140" value="${esc(u.headline)}"></div>
      <div class="fld"><label for="s-loc">City</label><input id="s-loc" type="text" maxlength="80" value="${esc(u.location)}"></div>
      <div class="fld"><label for="s-about">About</label><textarea id="s-about" maxlength="1200">${esc(u.about)}</textarea></div>
      <div class="fld"><label for="s-skills">Skills</label><input id="s-skills" type="text" value="${esc(u.skills.join(', '))}"><small>Separate with commas.</small></div>
      <div class="fld"><label for="s-links">Links (GitHub, LinkedIn, portfolio)</label><input id="s-links" type="text" value="${esc(u.links.join(', '))}"></div>
      <button class="btn btn-p" type="submit">Save profile</button></form></section>
    <div class="stack">
      ${person ? `<section class="card"><div class="card-h"><h2>Chat and mentoring</h2></div><form class="stack" data-form="privacy" style="gap:12px">
        <label class="check"><input type="checkbox" id="s-acc" ${u.accepts ? 'checked' : ''}> Accept chat requests</label>
        ${alum ? `<label class="check"><input type="checkbox" id="s-men" ${u.mentor ? 'checked' : ''}> Show me as open to mentoring</label>
        <div class="fld"><label for="s-top">Mentoring topics</label><input id="s-top" type="text" value="${esc(u.topics.join(', '))}"><small>Separate with commas.</small></div>` : ''}
        <p class="small muted">${icon('lock', 13)} Your email and phone number are never shown. People see your profile and can only message you after you accept.</p>
        <button class="btn btn-p" type="submit">Save</button></form></section>` : ''}
      ${alum ? `<section class="card"><div class="card-h"><h2>Alumni form</h2><span class="small muted">${outcome?.verified ? 'Verified by IQAC' : outcome ? 'Not verified yet' : 'Not filled'}</span></div>
        <p class="small muted" style="margin-bottom:12px">The same questions as the college’s paper alumni form. This feeds placement and higher-studies reports, so keep it current.</p>
        <form class="stack" data-form="myoutcome" style="gap:14px">${outcomeForm(outcome || {}, { evidence: true })}
          <button class="btn btn-p" type="submit">Save form</button></form></section>` : ''}
      <section class="card"><div class="card-h"><h2>Photo and banner</h2></div>
        <div class="row" style="gap:14px">${av(S.me, 'av-lg')}<div class="row"><button class="btn" data-act="photo">Change photo</button>${S.me.avatar_url ? '<button class="btn btn-g" data-act="rmphoto">Remove</button>' : ''}<button class="btn" data-act="banner">Change banner</button></div></div></section>
      <section class="card"><div class="card-h"><h2>Account</h2></div><p class="small">${esc(u.email)}</p><p class="small muted">${u.college_id ? 'Roll number ' + esc(u.college_id) : esc(u.scope || '')}</p>
        <button class="btn" style="margin-top:12px" data-act="logout">${icon('out', 15)}Log out</button></section>
    </div></div>`;
}

/* ---------- alumni form (same questions as the paper form) ---------- */
function outcomeForm(o, opts) {
  const R = S.rmeta || { statuses: [], exams: [], placement: [] }, P = opts.prefix || 'o';
  const un = new Set(opts.uncertain || []);
  const f = (id, label, val, type = 'text', extra = '') => `<div class="fld ${un.has(id) ? 'unsure' : ''}"><label for="${P}-${id}">${label}${un.has(id) ? ' <span class="st st-warn">Check: hard to read</span>' : ''}</label>
    <input id="${P}-${id}" type="${type}" value="${esc(val ?? '')}" ${extra}></div>`;
  const sel = (id, label, val, options, blank = 'Not filled') => `<div class="fld ${un.has(id) ? 'unsure' : ''}"><label for="${P}-${id}">${label}</label><select id="${P}-${id}" ${id === 'status' ? 'data-ostatus' : ''}><option value="">${blank}</option>${options.map(x => `<option ${String(val ?? '') === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;
  const yn = o.internship_done === true ? 'Yes' : o.internship_done === false ? 'No' : '';
  const checks = (name, list) => `<div class="exams">${R.exams.map(e => `<label class="check"><input type="checkbox" name="${P}-${name}" value="${esc(e)}" ${(list || []).includes(e) ? 'checked' : ''}> ${esc(e)}</label>`).join('')}</div>`;
  const deptOpts = S.meta.departments.map(d => `<option value="${d.code}" ${o.dept === d.code ? 'selected' : ''}>${esc(d.course)}</option>`).join('');
  return `${opts.identity ? `<fieldset class="ofs"><legend>Student details</legend><div class="ogrid">
      ${f('name', 'Student name', o.name, 'text', 'required')}${f('roll_no', 'Examination roll no.', o.roll_no, 'text', 'required')}
      <div class="fld ${un.has('dept') ? 'unsure' : ''}"><label for="${P}-dept">Course</label><select id="${P}-dept" required><option value="">Choose course</option>${deptOpts}</select>${o.course_text ? `<small>Written on form: ${esc(o.course_text)}</small>` : ''}</div>
      ${f('adm_year', 'Batch from (admission year)', o.adm_year, 'number', 'min="1980" max="2100"')}${f('grad_year', 'Batch to (passing year)', o.grad_year, 'number', 'min="1980" max="2100" required')}
      ${f('email', 'Email', o.email, 'text')}${f('mobile', 'Mobile no.', o.mobile, 'text')}</div></fieldset>`
    : `<div class="ogrid">${f('mobile', 'Mobile no. (visible only to IQAC)', o.mobile, 'text')}</div>`}
    <fieldset class="ofs"><legend>Internships during graduation</legend><div class="ogrid">
      ${sel('internship_done', 'Internship done?', yn, ['Yes', 'No'])}${f('internship_count', 'Number of internships', o.internship_count, 'number', 'min="0" max="20"')}
      <div class="fld span2 ${un.has('internship_details') ? 'unsure' : ''}"><label for="${P}-internship_details">Details (when, where, duration)</label><input id="${P}-internship_details" type="text" value="${esc(o.internship_details || '')}"></div></div></fieldset>
    <fieldset class="ofs"><legend>Current status</legend><div class="ogrid">
      ${sel('status', 'What are you doing now?', o.status, R.statuses)}
      <div class="osec" data-for="study">${f('study_course', 'Higher studies: course', o.study_course)}${f('study_university', 'University', o.study_university)}</div>
      <div class="osec" data-for="job">${f('designation', 'Job: designation', o.designation)}${f('company', 'Company / organisation', o.company)}${f('location', 'Location', o.location)}
        ${sel('placement_type', 'Placement', o.placement_type, R.placement, 'Not recorded')}${f('package_lpa', 'Annual package (lakh per annum)', o.package_lpa, 'number', 'min="0" step="0.1"')}</div></div></fieldset>
    <fieldset class="ofs"><legend>Competitive exams</legend><p class="small muted">Passed</p>${checks('passed', o.exams_passed)}<p class="small muted" style="margin-top:8px">Appeared</p>${checks('appeared', o.exams_appeared)}</fieldset>
    ${opts.evidence ? `<div class="fld"><label for="o-evidence">Offer letter or admission/allotment letter (optional)</label><input id="o-evidence" type="file" accept=".pdf,.png,.jpg,.jpeg">${o.evidence_url ? `<small>Attached: <a href="${esc(o.evidence_url)}" target="_blank" rel="noopener">${esc(o.evidence_label || 'document')}</a></small>` : ''}</div>` : ''}`;
}
function readOutcomeForm(P = 'o') {
  const v = id => ($(P + '-' + id)?.value ?? '').trim();
  const out = {};
  ['name', 'roll_no', 'dept', 'adm_year', 'grad_year', 'email', 'mobile', 'internship_done', 'internship_count', 'internship_details', 'status', 'study_course', 'study_university',
    'designation', 'company', 'location', 'placement_type', 'package_lpa'].forEach(k => { if ($(P + '-' + k)) out[k] = v(k); });
  if (out.package_lpa === '') out.package_lpa = null;
  out.exams_passed = [...document.querySelectorAll(`input[name="${P}-passed"]:checked`)].map(x => x.value);
  out.exams_appeared = [...document.querySelectorAll(`input[name="${P}-appeared"]:checked`)].map(x => x.value);
  return out;
}
function toggleOutcomeSections() {
  document.querySelectorAll('[data-ostatus]').forEach(sel => {
    const st = sel.value, scope = sel.closest('form') || document;
    scope.querySelectorAll('.osec').forEach(sec => {
      const show = sec.dataset.for === 'study' ? ['Higher studies', 'Research', ''].includes(st) : ['Job', 'Govt services', 'Entrepreneurship', ''].includes(st);
      sec.classList.toggle('dim', !show);
    });
  });
}

/* ---------- placements ---------- */
const lpa = v => v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 })} LPA`;
const pc = v => `${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
async function viewPlacements() {
  const p = S.plc, qs = new URLSearchParams({ batch: p.batch, dept: p.dept });
  const d = await api('/api/placements?' + qs), s = d.summary, staff = ['admin', 'faculty'].includes(S.me.role);
  const typeUnknown = s.placed - s.on_campus - s.off_campus;
  const bars = [['Placed on campus', s.on_campus], ['Placed off campus', s.off_campus], ['Placed (type not recorded)', typeUnknown], ['Higher studies & research', s.higher_studies],
    ['Government services', s.govt], ['Entrepreneurship', s.entrepreneurship], ['Other', s.other], ['Not reported', s.not_reported]].filter(b => b[1] > 0 || b[0].startsWith('Placed on') || b[0].startsWith('Placed off'));
  const max = Math.max(1, ...bars.map(b => b[1]));
  const title = `${p.batch ? 'Batch of ' + p.batch : 'All batches'} · ${p.dept ? esc(deptName(p.dept)) : 'all courses'}`;
  return `${why('placements')}
  <div class="between" style="margin-bottom:14px"><div class="row">
      <select data-pl="batch" aria-label="Batch" style="width:auto"><option value="">All batches</option>${d.batches.map(y => `<option value="${y}" ${String(y) === p.batch ? 'selected' : ''}>Batch of ${y}</option>`).join('')}</select>
      <select data-pl="dept" aria-label="Course" style="width:auto"><option value="">All courses</option>${S.meta.departments.map(x => `<option value="${x.code}" ${x.code === p.dept ? 'selected' : ''}>${esc(x.course)}</option>`).join('')}</select></div>
    ${staff ? `<a class="btn" href="/api/placements?${qs}&format=csv" download>${icon('file', 15)}Download CSV</a>` : ''}</div>
  <div class="stack">
    <div class="kpis k4">
      <div class="kpi"><span>Graduates on record</span><b>${fmtN(s.graduates)}</b></div>
      <div class="kpi"><span>Placed</span><b>${fmtN(s.placed)} <small class="muted" style="font-size:14px;font-weight:500">${pc(s.placed_pct)}</small></b></div>
      <div class="kpi"><span>On-campus placement</span><b>${pc(s.on_campus_pct)}</b></div>
      <div class="kpi"><span>Off-campus placement</span><b>${pc(s.off_campus_pct)}</b></div>
      <div class="kpi"><span>Higher studies</span><b>${pc(s.higher_studies_pct)}</b></div>
      <div class="kpi"><span>Average package</span><b>${lpa(s.avg_package)}</b></div>
      <div class="kpi"><span>Median package</span><b>${lpa(s.median_package)}</b></div>
      <div class="kpi"><span>Highest package</span><b>${lpa(s.highest_package)}</b></div>
    </div>
    <div class="grid2">
      <section class="card"><div class="card-h"><h2>Where the batch went</h2><span class="small muted">${title}</span></div>
        <div class="stack" style="gap:4px">${bars.map(([l, v]) => `<div class="hb" style="grid-template-columns:190px minmax(0,1fr)" title="${esc(l)}: ${v}"><span>${esc(l)}</span><div class="hb-t"><i style="width:calc((100% - 100px) * ${(v / max).toFixed(3)})"></i><span>${fmtN(v)} · ${pc(s.graduates ? v / s.graduates * 100 : 0)}</span></div></div>`).join('')}</div>
        <p class="small muted" style="margin-top:10px">Percentages are of all graduates on record for this selection. ${fmtN(s.with_package)} placed graduates reported a package; average and median use those.</p></section>
      <section class="card"><div class="card-h"><h2>Placement rate by year</h2><span class="small muted">${p.dept ? esc(deptName(p.dept)) : 'All courses'}</span></div>
        ${cols(d.byYear.map(y => ({ l: "'" + String(y.year).slice(2), v: Math.round(y.placed_pct), t: `Batch of ${y.year}: ${pc(y.placed_pct)} placed, median ${lpa(y.median_package)}` })), true).replace(/<span>(\d+)<\/span>/g, '<span>$1%</span>')}</section>
    </div>
    <section class="card" style="padding:0"><div class="card-h" style="padding:16px 18px 0"><h2>By course</h2><span class="small muted">${p.batch ? 'Batch of ' + p.batch : 'All batches'}</span></div>
      <div class="tw" style="border:0;border-top:1px solid var(--line);border-radius:0 0 8px 8px;margin-top:12px"><table class="t"><thead><tr><th>Course</th><th class="n">Graduates</th><th class="n">Placed</th><th class="n">On-campus</th><th class="n">Off-campus</th><th class="n">Higher studies</th><th class="n">Average</th><th class="n">Median</th><th class="n">Highest</th></tr></thead>
      <tbody>${d.byCourse.map(c => `<tr><td>${esc(c.course)}</td><td class="n">${fmtN(c.graduates)}</td><td class="n">${pc(c.placed_pct)}</td><td class="n">${fmtN(c.on_campus)}</td><td class="n">${fmtN(c.off_campus)}</td><td class="n">${pc(c.higher_studies_pct)}</td><td class="n">${lpa(c.avg_package)}</td><td class="n">${lpa(c.median_package)}</td><td class="n">${lpa(c.highest_package)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">No records.</td></tr>'}</tbody></table></div></section>
    <section class="card" style="padding:0"><div class="card-h" style="padding:16px 18px 0"><h2>Year by year</h2></div>
      <div class="tw" style="border:0;border-top:1px solid var(--line);border-radius:0 0 8px 8px;margin-top:12px"><table class="t"><thead><tr><th>Batch</th><th class="n">Graduates</th><th class="n">Placed</th><th class="n">On-campus</th><th class="n">Off-campus</th><th class="n">Higher studies</th><th class="n">Other / not reported</th><th class="n">Average</th><th class="n">Median</th></tr></thead>
      <tbody>${d.byYear.slice().reverse().map(y => `<tr><td>${y.year}</td><td class="n">${fmtN(y.graduates)}</td><td class="n">${pc(y.placed_pct)}</td><td class="n">${pc(y.on_campus_pct)}</td><td class="n">${pc(y.off_campus_pct)}</td><td class="n">${pc(y.higher_studies_pct)}</td><td class="n">${pc(y.other_pct + y.not_reported_pct + y.govt_pct + y.entrepreneurship_pct)}</td><td class="n">${lpa(y.avg_package)}</td><td class="n">${lpa(y.median_package)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="card" style="padding:0"><div class="card-h" style="padding:16px 18px 0"><h2>Recruiters</h2><span class="small muted">${fmtN(s.companies)} companies · ${title}</span></div>
      <div class="tw" style="border:0;border-top:1px solid var(--line);border-radius:0 0 8px 8px;margin-top:12px"><table class="t"><thead><tr><th>Company</th><th class="n">Graduates hired</th><th class="n">On-campus</th><th class="n">Average package</th><th class="n">Highest</th></tr></thead>
      <tbody>${d.companies.map(c => `<tr><td>${esc(c.company)}</td><td class="n">${fmtN(c.hires)}</td><td class="n">${fmtN(c.on_campus)}</td><td class="n">${lpa(c.avg_package)}</td><td class="n">${lpa(c.highest_package)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No placements recorded.</td></tr>'}</tbody></table></div></section>
    ${staff ? `<section class="card" style="padding:0"><div class="between" style="padding:16px 18px 0"><h2 style="font-size:14.5px">Graduates</h2><input type="search" data-pls placeholder="Search name, company, roll no." style="width:min(280px,100%)" aria-label="Search graduates"></div>
      <div class="tw" style="border:0;border-top:1px solid var(--line);border-radius:0 0 8px 8px;margin-top:12px;max-height:520px;overflow:auto"><table class="t"><thead><tr><th>Name</th><th>Roll no.</th><th>Course</th><th>Batch</th><th>Outcome</th><th>Where</th><th class="n">Package</th><th>Form</th></tr></thead>
      <tbody>${d.students.map(r => `<tr data-plrow="${esc((r.name + ' ' + r.roll + ' ' + r.company + ' ' + r.study).toLowerCase())}"><td><button class="link" data-go="#/u/${r.id}">${esc(r.name)}</button></td><td class="mono">${esc(r.roll)}</td><td>${esc(r.course)}</td><td>${r.batch}</td>
        <td>${esc(r.status)}${r.placement_type ? ` <span class="chip">${esc(r.placement_type)}</span>` : ''}</td><td>${esc(r.status === 'Job' || r.status === 'Govt services' || r.status === 'Entrepreneurship' ? [r.designation, r.company, r.location].filter(Boolean).join(', ') : r.study)}</td>
        <td class="n">${r.package_lpa ? lpa(r.package_lpa) : '—'}</td><td>${r.verified ? '<span class="small">Verified</span>' : '<span class="small muted">Self-reported</span>'}</td></tr>`).join('')}</tbody></table></div></section>`
      : `<p class="small muted">Individual records are visible to faculty and IQAC only.</p>`}
  </div>`;
}

/* ---------- digitize (IQAC) ---------- */
async function viewDigitize() {
  return `${why('digitize')}<div class="grid3">
    <section class="card"><div class="card-h"><h2>1. Scan paper forms</h2></div>
      <p class="small muted">Photograph or scan each form (one form per file: JPG, PNG or PDF). Upload a whole bundle at once.</p>
      <div class="stack" style="gap:10px;margin-top:12px"><div class="fld"><label for="dg-batch">Bundle name (optional)</label><input id="dg-batch" type="text" placeholder="For example: Mathematics 2018, box 3"></div>
        <input id="dg-files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" aria-label="Scanned forms">
        <button class="btn btn-p" data-act="upload">${icon('upload', 15)}Upload scans</button><p class="small muted" id="dg-progress" aria-live="polite"></p></div></section>
    <section class="card"><div class="card-h"><h2>2. Or type in a form</h2></div>
      <p class="small muted">For forms that are faster to type than to scan. The screen follows the paper form line by line.</p>
      <button class="btn" style="margin-top:12px" data-act="paper">${icon('plus', 15)}Type in a paper form</button></section>
    <section class="card"><div class="card-h"><h2>3. Or import a spreadsheet</h2></div>
      <p class="small muted">If any batch is already in Excel, save it as CSV using the template’s column headings. Up to 5,000 rows per file.</p>
      <div class="stack" style="gap:10px;margin-top:12px"><a class="btn" href="/api/admin/import/template" download>${icon('file', 15)}Download template</a>
        <input id="dg-csv" type="file" accept=".csv,text/csv" aria-label="CSV file"><button class="btn btn-p" data-act="importcsv">Import</button><div id="dg-import" aria-live="polite"></div></div></section>
  </div>
  <div id="dg-review" style="margin-top:16px">${await digitizeReview()}</div>`;
}
async function refreshDigitize(full) { const el = $('dg-review'); if (el) swap(el, await digitizeReview()); else if (full) rerender(); }
async function digitizeReview() {
  const st = S.dig.filter, r = await api('/api/admin/scans' + (st ? '?status=' + st : ''));
  const c = r.counts, label = { queued: 'Waiting to be read', reading: 'Being read', ready: 'Ready to check', failed: 'Couldn’t read', approved: 'Saved', discarded: 'Discarded' };
  if (!S.dig.sel && r.rows.length) S.dig.sel = (r.rows.find(x => x.status === 'ready') || r.rows[0]).id;
  let detail = `<div class="empty">${icon('file', 30)}<p>Upload scans to start. Each one appears here to check before it is saved.</p></div>`;
  if (S.dig.sel && r.rows.some(x => x.id === S.dig.sel)) {
    const d = await api('/api/admin/scans/' + S.dig.sel), sc = d.scan, x = sc.extracted || {};
    const view = sc.mime === 'application/pdf' ? `<iframe src="${sc.file_url}" title="Scanned form" class="scanview"></iframe>` : `<a href="${sc.file_url}" target="_blank" rel="noopener" title="Open full size"><img src="${sc.file_url}" alt="Scanned form ${esc(sc.file_name)}" class="scanview"></a>`;
    detail = `<div class="pane-h"><button class="btn btn-g btn-sm back" data-act="dsel" data-id="">${icon('back', 16)}</button><div><b>${esc(sc.file_name)}</b><p class="small muted">${esc(sc.batch_label || 'No bundle name')} · ${label[sc.status]}</p></div></div>
      <div class="review"><div class="scanbox">${view}</div>
      <form class="detail" onsubmit="return false">
        ${sc.status === 'failed' ? `<p class="err">${esc(sc.error || 'Couldn’t read this file.')}</p>` : ''}
        ${sc.status === 'queued' || sc.status === 'reading' ? `<p class="small muted">This scan is waiting for the AI to read it. You can also fill it in by hand below.</p>` : ''}
        ${sc.status === 'ready' && !r.ai && !sc.extracted ? `<p class="small muted">AI reading is off on this server, so fill the fields from the scan.</p>` : ''}
        ${x.is_alumni_form === false ? `<p class="err">This doesn’t look like an alumni form.</p>` : ''}
        ${d.existing ? `<p class="small" style="color:var(--warn)">Roll number already on record: <b>${esc(d.existing.name)}</b>. Saving updates that record.</p>` : ''}
        ${x.uncertain?.length ? `<p class="small" style="color:var(--warn)">${x.uncertain.length} field${x.uncertain.length > 1 ? 's were' : ' was'} hard to read and ${x.uncertain.length > 1 ? 'are' : 'is'} marked below.</p>` : ''}
        ${outcomeForm(x, { identity: true, uncertain: x.uncertain || [] })}
        <p class="err" id="d-err" hidden></p>
        <div class="row">${sc.status === 'approved' || sc.status === 'discarded' ? '' : `<button class="btn btn-p" data-act="ddo" data-k="approve">${icon('check', 15)}Save to register</button>`}
          ${sc.status === 'failed' ? `<button class="btn" data-act="ddo" data-k="retry">Read again</button>` : ''}${sc.status === 'approved' || sc.status === 'discarded' ? '' : `<button class="btn btn-g" data-act="ddo" data-k="discard">Discard</button>`}</div>
      </form></div>`;
  }
  return `<section class="card" style="padding:0"><div class="between" style="padding:14px 16px"><div class="row">${['', 'queued', 'ready', 'failed', 'approved'].map(k => `<button class="chip fchip" data-act="dfilter" data-k="${k}" aria-pressed="${st === k}">${k ? label[k] : 'To do'} ${k ? `<b>${c[k] || 0}</b>` : `<b>${(c.queued || 0) + (c.reading || 0) + (c.ready || 0) + (c.failed || 0)}</b>`}</button>`).join('')}</div>
      <span class="small muted">AI reading: ${r.ai ? 'on' : 'off (add ANTHROPIC_API_KEY on the server)'}</span></div>
    <div class="two dig" data-open="${S.dig.sel ? 1 : 0}" style="border:0;border-top:1px solid var(--line);border-radius:0">
      <div class="list">${r.rows.map(x => `<button class="li" data-act="dsel" data-id="${x.id}" aria-current="${x.id === S.dig.sel}"><span class="ico-c">${icon('file', 15)}</span><div><b>${esc(x.name || x.file_name)}<small>${label[x.status]}</small></b>
        <p>${esc(x.roll_no || x.batch_label || x.file_name)}${x.uncertain ? ` · ${x.uncertain} to check` : ''}</p></div></button>`).join('') || '<div class="empty"><p>Nothing here.</p></div>'}</div>
      <div class="pane">${detail}</div></div></section>`;
}

/* ---------- modals ---------- */
function openModal(m) { S.modal = m; renderModal(); }
function closeModal() { S.modal = null; renderModal(); }
function renderModal() {
  const root = $('modal'), m = S.modal;
  if (!m) { root.innerHTML = ''; return; }
  const head = t => `<div class="mh"><h2 id="mt">${t}</h2><button type="button" class="btn btn-g btn-sm" data-act="close" aria-label="Close">${icon('x', 16)}</button></div>`;
  const foot = l => `<div class="mf"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn btn-p" type="submit">${l}</button></div>`;
  let h = '';
  if (m.type === 'ask') h = `<form data-form="ask">${head('Request to chat with ' + esc(first(m.name)))}<div class="mb">
      <div class="fld"><label for="ask-p">What is it about?</label><select id="ask-p">${S.meta.purposes.map(x => `<option>${x}</option>`).join('')}</select></div>
      <div class="fld"><label for="ask-n">Short note</label><textarea id="ask-n" maxlength="300" required placeholder="Say who you are and what you’d like to ask."></textarea></div>
      <p class="small muted">${icon('lock', 13)} ${esc(first(m.name))} sees your profile and this note. The chat opens only if they accept.</p><p class="err" id="m-err" hidden></p></div>${foot('Send request')}</form>`;
  if (m.type === 'add') h = `<form data-form="add">${head('Add to your journey')}<div class="mb">
      <div class="row" style="align-items:flex-start"><div class="fld" style="flex:1;min-width:160px"><label for="f-kind">Type</label><select id="f-kind">${['achievement', 'exam', 'research', 'society', 'position', 'event', 'project', 'internship'].map(k => `<option value="${k}">${KIND[k][1]}</option>`).join('')}</select></div>
        <div class="fld" style="flex:1;min-width:160px"><label for="f-cat">Area</label><select id="f-cat"><option value="">Not applicable</option>${CATS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div></div>
      <div class="fld"><label for="f-title">Title</label><input id="f-title" type="text" required maxlength="160" placeholder="For example: 2nd prize, inter-college debate"></div>
      <div class="row" style="align-items:flex-start"><div class="fld" style="flex:1;min-width:150px"><label for="f-month">Month</label><input id="f-month" type="month" required max="${thisMonth()}"></div>
        <div class="fld" style="flex:1;min-width:150px"><label for="f-level">Level</label><select id="f-level"><option value="">Not applicable</option>${S.meta.levels.map(l => `<option>${l}</option>`).join('')}</select></div></div>
      <div class="fld"><label for="f-org">Organised by</label><input id="f-org" type="text" maxlength="120" placeholder="Event, society or organisation"></div>
      <div class="fld"><label for="f-desc">What did you do?</label><textarea id="f-desc" maxlength="600"></textarea></div>
      <div class="fld"><label for="f-file">Proof: certificate (PDF, PNG or JPG, under 5 MB)</label><input id="f-file" type="file" accept=".pdf,.png,.jpg,.jpeg"></div>
      <div class="fld"><label for="f-link">Or a link</label><input id="f-link" type="url" placeholder="https://"></div>
      <p class="small muted">${S.me.role === 'alumni' ? 'Goes to IQAC for verification.' : 'Goes to your department’s faculty verifier. Achievements need proof.'}</p><p class="err" id="m-err" hidden></p></div>${foot('Send for verification')}</form>`;
  if (m.type === 'report') h = `<form data-form="report">${head('Report incorrect information')}<div class="mb">
      <p class="small">About ${esc(m.name)}</p>
      <div class="fld"><label for="r-why">Reason</label><select id="r-why"><option>An achievement looks wrong</option><option>Wrong batch or department</option><option>Fake profile</option><option>Inappropriate messages</option><option>Something else</option></select></div>
      <div class="fld"><label for="r-txt">Details</label><textarea id="r-txt" required maxlength="600"></textarea></div><p class="small muted">IQAC reviews every report. The person isn’t told who reported it.</p><p class="err" id="m-err" hidden></p></div>${foot('Send to IQAC')}</form>`;
  if (m.type === 'paper' || m.type === 'editform') root.dataset.wide = '1'; else delete root.dataset.wide;
  if (m.type === 'banner') h = `<form data-form="banner">${head('Profile banner')}<div class="mb">
      <div class="fld"><span class="small" style="font-weight:500">Pick a colour</span><div class="banners">${BANNERS.map(b => `<button type="button" class="bn-${b}" data-act="pickbanner" data-k="${b}" aria-pressed="${!S.me.banner_url && S.me.banner_preset === b}" aria-label="${b}"></button>`).join('')}</div></div>
      <div class="divider">or</div>
      <div class="fld"><label for="bn-file">Upload an image</label><input id="bn-file" type="file" accept=".png,.jpg,.jpeg,.webp"><small>Wide images work best, around 1500 × 400 px. PNG, JPG or WebP, under 4 MB.</small></div>
      <p class="err" id="m-err" hidden></p></div>${foot('Save banner')}</form>`;
  if (m.type === 'photo') h = `<form data-form="photo">${head('Profile photo')}<div class="mb">
      <div class="row" style="gap:14px">${av(S.me, 'av-lg')}<p class="small muted">A clear photo of your face helps people recognise you. Square images work best.</p></div>
      <div class="fld"><label for="ph-file">Choose a photo</label><input id="ph-file" type="file" accept=".png,.jpg,.jpeg,.webp" required><small>PNG, JPG or WebP, under 4 MB.</small></div>
      <p class="err" id="m-err" hidden></p></div>${foot('Save photo')}</form>`;
  if (m.type === 'editform') h = `<form data-form="editform">${head('Alumni form · ' + esc(m.user.name))}<div class="mb">
      <p class="small muted">Roll number <span class="mono">${esc(m.user.college_id)}</span> · ${esc(meta(m.user))}${m.outcome?.evidence_url ? ` · <a href="${esc(m.outcome.evidence_url)}" target="_blank" rel="noopener">View attached document</a>` : ''}</p>
      ${outcomeForm(m.outcome || {}, { prefix: 'm' })}<p class="small muted">Saving marks this form as verified by IQAC.</p><p class="err" id="m-err" hidden></p></div>${foot('Save and verify')}</form>`;
  if (m.type === 'paper') h = `<form data-form="paper">${head('Type in a paper form')}<div class="mb">
      <p class="small muted">Copy the form line by line. A photo or scan of the paper is optional but recommended as proof.</p>
      ${outcomeForm({}, { identity: true, prefix: 'm' })}
      <div class="fld"><label for="pp-scan">Photo or scan of the form</label><input id="pp-scan" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"></div>
      <p class="err" id="m-err" hidden></p></div>${foot('Save record')}</form>`;
  if (m.type === 'resubmit') h = `<form data-form="resubmit">${head('Reply and resend')}<div class="mb">
      <div class="fld"><label for="rs-d">Add the details the verifier asked for</label><textarea id="rs-d" required maxlength="600"></textarea></div><p class="err" id="m-err" hidden></p></div>${foot('Resend for verification')}</form>`;
  root.innerHTML = `<div class="ovl" data-act="close-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">${h}</div></div>`;
  const f = root.querySelector('textarea, input, select'); if (f) f.focus();
  toggleOutcomeSections();
}
function modalError(e) { const el = $('m-err'); if (el) { el.textContent = e.message; el.hidden = false; } else toast(e.message); }
const readFile = file => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(file); });
const splitList = v => v.split(',').map(x => x.trim()).filter(Boolean);

/* ---------- events ---------- */
async function rerender() { const y = scrollY; await render(); scrollTo(0, y); }
const ACT = {
  async logout() { await api('/api/auth/logout', { body: {} }).catch(() => {}); S.me = null; location.hash = '#/login'; render(); },
  explain(el) { S.explain = !S.explain; try { localStorage.setItem('ac-explain', S.explain ? '1' : '0'); } catch { } el.setAttribute('aria-pressed', S.explain); rerender(); },
  demo(el) { $('l-email').value = el.dataset.email; $('l-pass').value = 'demo1234'; $('l-pass').form.requestSubmit(); },
  async path(el) { S.people.path = S.people.path === el.dataset.k ? '' : el.dataset.k; S.people.limit = 24; document.querySelectorAll('[data-act=path]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === S.people.path)); swap($('presults'), await peopleResults()); },
  async more() { S.people.limit += 24; swap($('presults'), await peopleResults()); },
  ask(el) { openModal({ type: 'ask', id: Number(el.dataset.id), name: el.dataset.name }); },
  add() { openModal({ type: 'add' }); },
  report(el) { openModal({ type: 'report', id: Number(el.dataset.id), name: el.dataset.name }); },
  resubmit(el) { openModal({ type: 'resubmit', id: Number(el.dataset.id) }); },
  async delms(el) { try { await api('/api/milestones/' + el.dataset.id, { method: 'DELETE' }); toast('Withdrawn'); rerender(); } catch (e) { toast(e.message); } },
  banner() { openModal({ type: 'banner', preset: null }); },
  photo() { openModal({ type: 'photo' }); },
  pickbanner(el) { S.modal.preset = el.dataset.k; document.querySelectorAll('[data-act=pickbanner]').forEach(b => b.setAttribute('aria-pressed', b === el)); },
  async rmphoto() { try { const r = await api('/api/me/image', { body: { kind: 'avatar', remove: true } }); S.me = r.user; toast('Photo removed'); rerender(); } catch (e) { toast(e.message); } },
  async editform(el) { try { const r = await api('/api/admin/outcome/' + el.dataset.id); openModal({ type: 'editform', id: Number(el.dataset.id), user: r.user, outcome: r.outcome }); } catch (e) { toast(e.message); } },
  paper() { openModal({ type: 'paper' }); },
  async dsel(el) { S.dig.sel = el.dataset.id ? Number(el.dataset.id) : null; await refreshDigitize(); toggleOutcomeSections(); },
  async dfilter(el) { S.dig.filter = el.dataset.k; S.dig.sel = null; await refreshDigitize(); toggleOutcomeSections(); },
  async ddo(el) {
    const id = S.dig.sel, act = el.dataset.k;
    try {
      if (act === 'approve') { await api(`/api/admin/scans/${id}/approve`, { body: { ...readOutcomeForm(), overwrite: !!el.dataset.overwrite } }); toast('Saved to the alumni register'); }
      else { await api(`/api/admin/scans/${id}/${act}`, { body: {} }); toast(act === 'discard' ? 'Scan discarded' : 'Sent for reading again'); }
      S.dig.sel = null; await refreshDigitize(true); toggleOutcomeSections();
    } catch (e) { const er = $('d-err'); if (er) { er.textContent = e.message; er.hidden = false; } else toast(e.message); }
  },
  async upload() {
    const files = [...($('dg-files')?.files || [])]; if (!files.length) { toast('Choose the scanned files first.'); return; }
    const out = $('dg-progress'), batch = ($('dg-batch')?.value || '').trim(); let done = 0, failed = 0;
    for (const f of files) {
      out.textContent = `Uploading ${done + failed + 1} of ${files.length}…`;
      try { await api('/api/admin/scans', { body: { name: f.name, batch, data: await readFile(f) } }); done++; } catch (e) { failed++; }
    }
    out.textContent = `Uploaded ${done} of ${files.length}${failed ? `, ${failed} failed (check the file type and size)` : ''}.`;
    $('dg-files').value = ''; await refreshDigitize(true);
  },
  async importcsv() {
    const f = $('dg-csv')?.files[0]; if (!f) { toast('Choose a CSV file first.'); return; }
    const out = $('dg-import');
    try { out.innerHTML = 'Importing…'; const r = await api('/api/admin/import', { body: { csv: await f.text() } });
      out.innerHTML = `<p class="small"><b>${r.created}</b> new records, <b>${r.updated}</b> updated${r.errors.length ? `, <b style="color:var(--bad)">${r.errors.length}</b> rows need fixing:` : '.'}</p>
        ${r.errors.length ? `<div class="tw" style="max-height:180px;overflow:auto;margin-top:6px"><table class="t"><tbody>${r.errors.slice(0, 100).map(e => `<tr><td class="n">Row ${e.row}</td><td>${esc(e.name)}</td><td>${esc(e.errors.join('; '))}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    } catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  },
  close: closeModal,
  'close-bg'(el, e) { if (e.target === el) closeModal(); },
  copy(el) { const t = el.dataset.t; (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast('Profile link copied'), () => toast(t)); },
  ph(el) { S.prof.ph = S.prof.ph === el.dataset.k ? '' : el.dataset.k; rerender(); },
  jf(el) { S.prof.jf = el.dataset.k; rerender(); },
  item(el) { const id = Number(el.dataset.id); S.prof.open.has(id) ? S.prof.open.delete(id) : S.prof.open.add(id); rerender(); },
  msgtab(el) { S.msg.tab = el.dataset.k; if (route().name === 'messages') rerender(); else location.hash = '#/messages'; },
  async reqdo(el) {
    try { const r = await api(`/api/requests/${el.dataset.id}/${el.dataset.k}`, { body: {} });
      toast({ accept: 'Chat started', decline: 'Request declined. They won’t see a reason.', withdraw: 'Request withdrawn' }[el.dataset.k]);
      await refreshCounts(); if (r.chat_id) { S.msg.tab = 'chats'; location.hash = '#/messages/' + r.chat_id; } else rerender(); } catch (e) { toast(e.message); }
  },
  vsel(el) { S.ver.sel = el.dataset.k; S.ver.mode = null; rerender(); },
  vback() { S.ver.sel = null; rerender(); },
  vmode(el) { S.ver.mode = el.dataset.k || null; rerender().then(() => $('v-note')?.focus()); },
  async vdo(el) {
    const [type, id] = S.ver.sel.split('-'), action = el.dataset.k, note = $('v-note')?.value || '';
    const url = { milestone: '/api/verify/milestone/', account: '/api/verify/account/', report: '/api/verify/report/' }[type] + id;
    try { await api(url, { body: { action, note } }); toast(action === 'approve' ? 'Approved. They’ve been notified.' : action === 'reject' ? 'Rejected. The reason was sent.' : 'Request for more information sent.');
      S.ver.sel = null; S.ver.mode = null; await refreshCounts(); updateBadges(); rerender(); } catch (e) { toast(e.message); }
  },
  async atab(el) { S.adm.tab = el.dataset.k; document.querySelectorAll('[data-act=atab]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === S.adm.tab)); swap($('aregion'), await adminRegion()); },
  async rpage(el) { S.adm.rpage = Math.max(0, S.adm.rpage + Number(el.dataset.k)); swap($('aregion'), await adminRegion()); },
  async remind() { try { const r = await api('/api/admin/remind', { body: {} }); toast(`Reminder queued for ${fmtN(r.count)} alumni`); } catch (e) { toast(e.message); } }
};
document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]'); if (go) { e.preventDefault(); location.hash = go.dataset.go; return; }
  const el = e.target.closest('[data-act]'); if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el, e);
});
let typeT;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.p && el.type !== 'checkbox' && el.tagName !== 'SELECT') { S.people[el.dataset.p] = el.value; S.people.limit = 24; clearTimeout(typeT); typeT = setTimeout(async () => { swap($('presults'), await peopleResults()); }, 250); }
  if (el.dataset.pls !== undefined) { S.plc.q = el.value.toLowerCase(); document.querySelectorAll('[data-plrow]').forEach(r => { r.hidden = S.plc.q && !r.dataset.plrow.includes(S.plc.q); }); }
  if (el.dataset.a === 'rq') { S.adm.rq = el.value; S.adm.rpage = 0; clearTimeout(typeT); typeT = setTimeout(async () => { $('aregion').innerHTML = await adminRegion(); const i = $('a-rq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.p && (el.type === 'checkbox' || el.tagName === 'SELECT')) { S.people[el.dataset.p] = el.type === 'checkbox' ? el.checked : el.value; S.people.limit = 24; swap($('presults'), await peopleResults()); }
  if (el.dataset.pl) { S.plc[el.dataset.pl] = el.value; rerender(); return; }
  if (el.dataset.ostatus !== undefined) toggleOutcomeSections();
  if (el.dataset.a && el.tagName === 'SELECT') { S.adm[el.dataset.a] = el.value; S.adm.rpage = 0; swap($('aregion'), await adminRegion()); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.modal) closeModal();
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'msg-in') { e.preventDefault(); e.target.form.requestSubmit(); }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, kind = f.dataset.form, v = id => ($(id)?.value || '').trim();
  const btn = f.querySelector('button[type=submit]'); if (btn) btn.disabled = true;
  try {
    if (kind === 'login') {
      try { const r = await api('/api/auth/login', { body: { email: v('l-email'), password: $('l-pass').value } }); S.me = r.user; const me = await api('/api/me'); S.counts = me.counts; S.rmeta = await api('/api/records/meta'); location.hash = home(); render(); }
      catch (err) { $('l-err').textContent = err.message; $('l-err').hidden = false; }
    } else if (kind === 'register') {
      try { const r = await api('/api/auth/register', { body: { role: v('r-role'), name: v('r-name'), email: v('r-email'), password: $('r-pass').value, dept: v('r-dept'), adm_year: v('r-adm'), grad_year: v('r-grad'), college_id: v('r-cid') } });
        toast(r.message); location.hash = '#/login'; } catch (err) { $('r-err').textContent = err.message; $('r-err').hidden = false; }
    } else if (kind === 'topsearch') {
      S.people.q = v('top-q'); S.people.limit = 24; location.hash = '#/people'; if (route().name === 'people') rerender();
    } else if (kind === 'send') {
      const body = v('msg-in'); if (!body) return;
      const r = await api(`/api/chats/${f.dataset.chat}/messages`, { body: { body } });
      $('msg-in').value = ''; $('thread').insertAdjacentHTML('beforeend', bubble(r.message)); S.msg.last = Math.max(S.msg.last, r.message.id); scrollThread(); $('msg-in').focus();
    } else if (kind === 'ask') {
      try { await api('/api/requests', { body: { to: S.modal.id, purpose: v('ask-p'), note: v('ask-n') } }); toast(`Request sent to ${first(S.modal.name)}`); closeModal(); rerender(); } catch (err) { modalError(err); }
    } else if (kind === 'add') {
      try {
        const file = $('f-file').files[0], link = v('f-link');
        const proof = file ? { type: 'file', name: file.name, data: await readFile(file) } : link ? { type: 'link', url: link } : null;
        await api('/api/milestones', { body: { kind: v('f-kind'), category: v('f-cat'), title: v('f-title'), month: v('f-month'), level: v('f-level'), org: v('f-org'), description: v('f-desc'), proof } });
        closeModal(); toast('Sent for verification'); S.prof.id = null; location.hash = '#/u/' + S.me.id; rerender();
      } catch (err) { modalError(err); }
    } else if (kind === 'report') {
      try { await api('/api/reports', { body: { user_id: S.modal.id, reason: v('r-why'), details: v('r-txt') } }); closeModal(); toast('Sent to IQAC for review'); } catch (err) { modalError(err); }
    } else if (kind === 'banner' || kind === 'photo') {
      try {
        const file = $(kind === 'banner' ? 'bn-file' : 'ph-file').files[0];
        let body;
        if (file) body = { kind: kind === 'banner' ? 'banner' : 'avatar', name: file.name, data: await readFile(file) };
        else if (kind === 'banner' && S.modal.preset) body = { kind: 'banner', preset: S.modal.preset };
        else throw new Error(kind === 'banner' ? 'Pick a colour or upload an image.' : 'Choose a photo first.');
        const r = await api('/api/me/image', { body }); S.me = r.user; closeModal(); toast(kind === 'banner' ? 'Banner updated' : 'Photo updated'); rerender();
      } catch (err) { modalError(err); }
    } else if (kind === 'myoutcome') {
      const body = readOutcomeForm(), file = $('o-evidence')?.files[0];
      if (file) body.evidence = { name: file.name, data: await readFile(file) };
      const r = await api('/api/me/outcome', { method: 'PUT', body }); S.me = r.user; toast('Alumni form saved'); rerender();
    } else if (kind === 'editform') {
      try { await api('/api/admin/outcome/' + S.modal.id, { method: 'PUT', body: readOutcomeForm('m') }); closeModal(); toast('Form saved and verified'); $('aregion') && ($('aregion').innerHTML = await adminRegion()); } catch (err) { modalError(err); }
    } else if (kind === 'paper') {
      try { const body = readOutcomeForm('m'), file = $('pp-scan').files[0]; if (file) body.scan = { name: file.name, data: await readFile(file) };
        const r = await api('/api/admin/paper', { body }); closeModal(); toast(r.created ? 'New record saved' : 'Existing record updated'); } catch (err) { modalError(err); }
    } else if (kind === 'resubmit') {
      try { await api(`/api/milestones/${S.modal.id}/resubmit`, { body: { description: v('rs-d') } }); closeModal(); toast('Sent for verification again'); rerender(); } catch (err) { modalError(err); }
    } else if (kind === 'profile') {
      const r = await api('/api/me', { method: 'PATCH', body: { headline: v('s-head'), location: v('s-loc'), about: v('s-about'), skills: splitList(v('s-skills')), links: splitList(v('s-links')) } });
      S.me = r.user; toast('Profile saved');
    } else if (kind === 'privacy') {
      const body = { accepts: $('s-acc').checked }; if ($('s-men')) { body.mentor = $('s-men').checked; body.topics = splitList(v('s-top')); }
      const r = await api('/api/me', { method: 'PATCH', body }); S.me = r.user; toast('Saved');
    } else if (kind === 'status') {
      const r = await api('/api/me/status', { body: { status: v('s-st'), title: v('s-tt'), month: v('s-mo') } });
      const me = await api('/api/me'); S.me = me.user; toast(r.message || 'Saved'); rerender();
    }
  } catch (err) { toast(err.message); } finally { if (btn && document.body.contains(btn)) btn.disabled = false; }
});

boot();
})();
