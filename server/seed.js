// Fills the database with fictional sample data. Run: npm run seed
// Every demo account uses the password: demo1234
const fs = require('fs');
const path = require('path');
const { q, DATA_DIR, hashPassword } = require('./db');

const PASSWORD = 'demo1234';
const HASH = hashPassword(PASSWORD);

const DEPTS = [
  ['PH', 'Physics', 'B.Sc. (H) Physics', 'Physics Society', 'Dr. Vivek Arora'],
  ['CH', 'Chemistry', 'B.Sc. (H) Chemistry', 'Chemistry Society', 'Dr. Nisha Kulkarni'],
  ['MA', 'Mathematics', 'B.Sc. (H) Mathematics', 'Mathematics Society', 'Dr. Sanjay Bhatt'],
  ['CS', 'Computer Science', 'B.Sc. (H) Computer Science', 'Coding Society', 'Dr. Rekha Sinha'],
  ['CM', 'Commerce', 'B.Com (H)', 'Enactus', 'Dr. Sunil Kapoor'],
  ['EC', 'Economics', 'B.A. (H) Economics', 'Economics Society', 'Dr. Aparna Menon'],
  ['EN', 'English', 'B.A. (H) English', 'Literary Society', 'Dr. Ruth D’Souza'],
  ['HI', 'History', 'B.A. (H) History', 'Heritage Club', 'Dr. Manoj Pathak'],
  ['PS', 'Political Science', 'B.A. (H) Political Science', 'Debating Society', 'Dr. Kavita Rao']
];

// Start from an empty database every time.
for (const t of ['audit_log', 'reports', 'sessions', 'messages', 'chats', 'chat_requests', 'milestones', 'users', 'departments']) q.run(`DELETE FROM ${t}`);
const up = path.join(DATA_DIR, 'uploads');
for (const f of fs.readdirSync(up)) fs.unlinkSync(path.join(up, f));

function addUser(u) {
  const r = q.run(`INSERT INTO users (email, pass, role, name, dept, adm_year, grad_year, college_id, headline, about, location,
      status, now_title, sector, status_updated, mentor, accepts, skills, topics, links, scope, account, last_seen)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    u.email, u.pass || HASH, u.role, u.name, u.dept || null, u.adm || null, u.grad || null, u.cid || null,
    u.headline || '', u.about || '', u.loc || '', u.status || null, u.now || null, u.sector || null, u.updated || null,
    u.mentor ? 1 : 0, u.accepts === false ? 0 : 1, JSON.stringify(u.skills || []), JSON.stringify(u.topics || []),
    JSON.stringify(u.links || []), u.scope || '', u.account || 'active', u.seen || null);
  return Number(r.lastInsertRowid);
}

const ACH = ['achievement', 'exam', 'research'];
function addMilestone(userId, m, verifierId) {
  const status = m.status || 'verified';
  const vAt = status === 'verified' ? (m.vAt || nextMonth(m.month) + '-05 11:00:00') : null;
  q.run(`INSERT INTO milestones (user_id, kind, category, title, org, level, month, description, proof_type, proof_ref, proof_label,
      status, verifier_id, verified_by, verified_at, submitted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    userId, m.kind, m.cat || null, m.title, m.org || '', m.level || null, m.month, m.desc || '',
    m.link ? 'link' : (ACH.includes(m.kind) || m.cert ? 'file' : null), m.link || null, m.proof || (m.link ? 'Link' : 'Certificate'),
    status, verifierId, status === 'verified' ? verifierId : null, vAt, m.sub || (m.month + '-20 10:00:00'));
}
function nextMonth(d) { let [y, m] = d.split('-').map(Number); m++; if (m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0'); }

q.tx(() => {
  for (const d of DEPTS) q.run('INSERT INTO departments (code, name, course, society) VALUES (?,?,?,?)', d[0], d[1], d[2], d[3]);

  const admin = addUser({ email: 'iqac@college.example', role: 'admin', name: 'Dr. Meenakshi Iyer', headline: 'IQAC coordinator', scope: 'Alumni records, registrations, reports' });
  const fac = {};
  for (const d of DEPTS) {
    fac[d[0]] = addUser({ email: d[4].replace(/^Dr\.\s*/, '').split(' ')[0].toLowerCase() + '@college.example', role: 'faculty', name: d[4], dept: d[0],
      headline: `Department moderator, ${d[1]} · Faculty coordinator, ${d[3]}`, scope: `${d[1]} department and ${d[3]}` });
  }

  // Featured profiles: fictional people with full journeys.
  const F = [
    { email: 'priya@college.example', role: 'student', name: 'Priya Singh', dept: 'CS', adm: 2024, cid: '24CS031', loc: 'New Delhi',
      headline: 'Web developer · Joint Secretary, Coding Society', skills: ['JavaScript', 'React', 'Python', 'UI design'], links: ['github.com/priya-builds'],
      about: 'Third-year Computer Science student who builds small tools that fix everyday campus problems. Looking for a winter internship in front-end development.',
      ms: [
        { kind: 'society', title: 'Joined Coding Society', org: 'Coding Society', level: 'College', month: '2024-08', desc: 'Selected through the society’s first-year coding test.' },
        { kind: 'event', title: 'Tech team volunteer, annual college fest', org: 'Fest organising committee', level: 'College', month: '2025-02', desc: 'Built the registration page used by 1,900 visitors.' },
        { kind: 'project', title: 'Built “FoundIt”, a lost-and-found web app for campus', org: 'Personal project', level: 'College', month: '2025-11', desc: '300+ users in the first month.', link: 'https://github.com/' },
        { kind: 'achievement', cat: 'tech', title: '1st prize, CodeSprint National Student Hackathon 2026', org: 'CodeSprint · off-campus', level: 'National', month: '2026-03', status: 'pending', sub: '2026-10-16 18:20:00', desc: 'Team of three. Built an offline-first attendance app for rural schools in 36 hours.' },
        { kind: 'internship', title: 'Front-end intern, Vice Chancellor Internship Scheme', org: 'University computer centre · 6 weeks', month: '2026-06', cert: true },
        { kind: 'position', title: 'Joint Secretary, Coding Society', org: 'Coding Society', level: 'College', month: '2026-08', desc: 'Runs the weekly practice contest.' }
      ] },
    { email: 'harshita@college.example', role: 'student', name: 'Harshita Rao', dept: 'CS', adm: 2023, cid: '23CS005', loc: 'New Delhi',
      headline: 'Machine learning · Smart India Hackathon 2025 finalist', skills: ['Python', 'PyTorch', 'SQL'], about: 'Final-year student interested in applied machine learning for public services.',
      ms: [
        { kind: 'society', title: 'Joined Coding Society', org: 'Coding Society', level: 'College', month: '2023-09' },
        { kind: 'internship', title: 'Research intern, machine learning', org: 'Computer Science department · 8 weeks', month: '2024-06' },
        { kind: 'achievement', cat: 'tech', title: 'Finalist, Smart India Hackathon 2025', org: 'Ministry of Education · off-campus', level: 'National', month: '2025-12' },
        { kind: 'research', cat: 'research', title: 'Paper accepted, national student research conference', org: 'Off-campus', level: 'National', month: '2026-09', status: 'pending', sub: '2026-10-14 12:00:00' }
      ] },
    { email: 'aditi@college.example', role: 'student', name: 'Aditi Verma', dept: 'HI', adm: 2024, cid: '24HI019', loc: 'New Delhi',
      headline: 'Sprinter · Captain, college athletics team', skills: ['400m', 'Event management'], about: 'History student and national-level sprinter.',
      ms: [
        { kind: 'society', title: 'Joined college athletics team', org: 'Sports committee', level: 'College', month: '2024-08' },
        { kind: 'achievement', cat: 'sports', title: 'Gold, 400m, inter-college athletics meet', org: 'Off-campus', level: 'University', month: '2025-02' },
        { kind: 'achievement', cat: 'sports', title: 'Gold, 400m, All India Inter-University Athletics Championship', org: 'Off-campus', level: 'National', month: '2026-01' },
        { kind: 'position', title: 'Captain, college athletics team', org: 'Sports committee', level: 'College', month: '2026-07' }
      ] },
    { email: 'nandini@college.example', role: 'student', name: 'Nandini Joshi', dept: 'CM', adm: 2024, cid: '24CM088', loc: 'New Delhi',
      headline: 'Enactus project lead', skills: ['Market research', 'Excel'], about: 'Commerce student working on social enterprise projects.',
      ms: [
        { kind: 'society', title: 'Joined Enactus', org: 'Enactus', level: 'College', month: '2024-08' },
        { kind: 'project', title: 'Enactus “Kulhad” clay-cup project', org: 'Enactus', level: 'College', month: '2025-12', desc: 'Helped 9 potter families sell clay cups to campus cafés.' },
        { kind: 'achievement', cat: 'startup', title: 'Winner, national case-study competition', org: 'Business school fest · off-campus', level: 'National', month: '2026-09', status: 'pending', sub: '2026-10-12 09:30:00' }
      ] },
    { email: 'ishita@college.example', role: 'alumni', name: 'Ishita Bansal', dept: 'CS', adm: 2020, grad: 2023, cid: '20CS017', loc: 'Bengaluru', mentor: true,
      status: 'Job', sector: 'Tech', now: 'Software Engineer II, Brightpath Labs', updated: '2026-08-02',
      headline: 'Software Engineer II at Brightpath Labs · GSoC 2022', topics: ['DSA & interviews', 'Open source / GSoC', 'Resume review'], skills: ['Go', 'Java', 'Distributed systems'],
      about: 'Backend engineer on payments infrastructure. I got into open source through the Coding Society in second year. Happy to help juniors with GSoC, interviews and resumes.',
      ms: [
        { kind: 'society', title: 'Joined Coding Society', org: 'Coding Society', level: 'College', month: '2020-11' },
        { kind: 'achievement', cat: 'tech', title: '1st prize, inter-college hackathon', org: 'Inter-college fest · off-campus', level: 'University', month: '2022-02' },
        { kind: 'internship', title: 'Software engineering intern', org: 'Brightpath Labs · 8 weeks', month: '2022-05' },
        { kind: 'position', title: 'President, Coding Society', org: 'Coding Society', level: 'College', month: '2022-08' },
        { kind: 'achievement', cat: 'tech', title: 'Google Summer of Code 2022 contributor', org: 'Open-source organisation · remote', level: 'International', month: '2022-09', link: 'https://summerofcode.withgoogle.com/' },
        { kind: 'graduation', title: 'Graduated, B.Sc. (H) Computer Science', org: 'CGPA 8.9', month: '2023-06', admin: true },
        { kind: 'job', title: 'Software Engineer, Brightpath Labs', org: 'Bengaluru · campus placement', month: '2023-07', admin: true },
        { kind: 'job', title: 'Promoted to Software Engineer II', org: 'Brightpath Labs', month: '2025-04', admin: true }
      ] },
    { email: 'ananya@college.example', role: 'alumni', name: 'Ananya Sharma', dept: 'PH', adm: 2019, grad: 2022, cid: '19PH008', loc: 'New Delhi', mentor: true,
      status: 'Research', now: 'PhD scholar (JRF), University of Delhi', updated: '2026-07-11',
      headline: 'PhD scholar in condensed matter physics · CSIR-NET JRF', topics: ['CSIR-NET prep', 'M.Sc. admissions', 'Research careers'], skills: ['Thin films', 'Python', 'LaTeX'],
      about: 'I work on thin-film materials for solar cells. If you are curious about research, the summer fellowships in second year are the best first step.',
      ms: [
        { kind: 'society', title: 'Joined Astronomy Club', org: 'Astronomy Club', level: 'College', month: '2019-09' },
        { kind: 'event', title: 'Organised Science Week talks', org: 'Physics Society', level: 'College', month: '2021-02' },
        { kind: 'research', cat: 'research', title: 'Summer Research Fellowship, national science academies', org: 'Off-campus · 8 weeks', level: 'National', month: '2021-06' },
        { kind: 'position', title: 'President, Physics Society', org: 'Physics Society', level: 'College', month: '2021-08' },
        { kind: 'research', cat: 'research', title: 'Paper presented, national conference on condensed matter physics', org: 'Off-campus', level: 'National', month: '2022-03' },
        { kind: 'graduation', title: 'Graduated, B.Sc. (H) Physics', month: '2022-06', admin: true },
        { kind: 'study', title: 'M.Sc. Physics', org: 'University of Delhi · 2022–24', month: '2022-07', admin: true },
        { kind: 'exam', cat: 'exam', title: 'Cleared CSIR-NET JRF, All India Rank 41', org: 'CSIR-UGC NET', level: 'National', month: '2023-12', admin: true },
        { kind: 'phd', title: 'PhD scholar (JRF), Department of Physics', org: 'University of Delhi', month: '2024-08', admin: true },
        { kind: 'research', cat: 'research', title: 'First-author paper in an international peer-reviewed journal', org: 'DOI linked', level: 'International', month: '2026-02', link: 'https://doi.org/', admin: true }
      ] },
    { email: 'kavya@college.example', role: 'alumni', name: 'Kavya Nair', dept: 'EC', adm: 2018, grad: 2021, cid: '18EC044', loc: 'Mussoorie', mentor: true,
      status: 'Govt services', now: 'Officer trainee, Civil Services', updated: '2026-09-20',
      headline: 'Civil Services Examination 2025, AIR 212', topics: ['UPSC strategy', 'Economics optional', 'Answer writing'], skills: ['Public policy', 'Economics'],
      about: 'Cleared the Civil Services Examination in my third attempt. Debating in college did more for my interview than any coaching.',
      ms: [
        { kind: 'society', title: 'Joined Debating Society', org: 'Debating Society', level: 'College', month: '2018-10' },
        { kind: 'achievement', cat: 'cultural', title: '1st prize, inter-college parliamentary debate', org: 'Inter-college fest · off-campus', level: 'University', month: '2020-02' },
        { kind: 'position', title: 'President, Debating Society', org: 'Debating Society', level: 'College', month: '2020-08' },
        { kind: 'graduation', title: 'Graduated, B.A. (H) Economics', month: '2021-06', admin: true },
        { kind: 'study', title: 'M.A. Economics', org: 'University of Delhi · 2021–23', month: '2021-08', admin: true },
        { kind: 'exam', cat: 'exam', title: 'Cleared UPSC Civil Services Examination 2025, AIR 212', org: 'Union Public Service Commission', level: 'National', month: '2026-04', admin: true },
        { kind: 'job', title: 'Officer trainee, Civil Services', org: 'Training academy', month: '2026-09', admin: true }
      ] },
    { email: 'meera@college.example', role: 'alumni', name: 'Meera Krishnan', dept: 'CM', adm: 2015, grad: 2018, cid: '15CM102', loc: 'Jaipur', mentor: true,
      status: 'Entrepreneurship', now: 'Founder, Threadloop', updated: '2026-05-03',
      headline: 'Founder, Threadloop · handloom fashion with artisan clusters', topics: ['Starting up', 'Fundraising', 'D2C brands'], skills: ['Operations', 'Fundraising'],
      about: 'Threadloop brings handloom work from Rajasthan’s artisan clusters to online buyers. I hire interns from college every winter.',
      ms: [
        { kind: 'society', title: 'Joined Enactus', org: 'Enactus', level: 'College', month: '2015-08' },
        { kind: 'project', title: 'Project lead, Enactus “Bunkar” handloom project', org: 'Enactus', level: 'College', month: '2016-09' },
        { kind: 'achievement', cat: 'startup', title: 'Runner-up, Enactus India National Exposition', org: 'Enactus India · off-campus', level: 'National', month: '2017-03' },
        { kind: 'graduation', title: 'Graduated, B.Com (H)', month: '2018-06', admin: true },
        { kind: 'job', title: 'Analyst, Kestrel Advisory', org: 'Gurugram', month: '2018-07', admin: true },
        { kind: 'startup', title: 'Founded Threadloop', org: 'Jaipur · 40 artisans', month: '2021-03', admin: true },
        { kind: 'achievement', cat: 'startup', title: 'Threadloop selected for a national startup seed fund', org: 'Government-recognised incubator', level: 'National', month: '2025-11', admin: true }
      ] },
    { email: 'sneha@college.example', role: 'alumni', name: 'Sneha Gupta', dept: 'CH', adm: 2016, grad: 2019, cid: '16CH021', loc: 'Toronto, Canada', mentor: true,
      status: 'Higher studies', now: 'PhD candidate, University of Toronto', updated: '2026-03-14',
      headline: 'PhD candidate in green chemistry, University of Toronto', topics: ['Applying abroad', 'SOPs', 'Research interviews'], skills: ['Organic synthesis', 'Catalysis'],
      about: 'Happy to talk about applying for funded PhDs abroad.',
      ms: [
        { kind: 'society', title: 'Joined Chemistry Society', org: 'Chemistry Society', level: 'College', month: '2016-09' },
        { kind: 'research', cat: 'research', title: 'Poster, national symposium on green chemistry', org: 'Off-campus', level: 'National', month: '2019-02' },
        { kind: 'graduation', title: 'Graduated, B.Sc. (H) Chemistry', month: '2019-06', admin: true },
        { kind: 'exam', cat: 'exam', title: 'Qualified GATE Chemistry, AIR 156', org: 'GATE 2021', level: 'National', month: '2021-03', admin: true },
        { kind: 'phd', title: 'PhD, Department of Chemistry', org: 'University of Toronto · fully funded', month: '2021-09', admin: true }
      ] },
    { email: 'tanvi@college.example', role: 'alumni', name: 'Tanvi Arora', dept: 'EN', adm: 2019, grad: 2022, cid: '19EN012', loc: 'New Delhi', accepts: false,
      status: 'Job', sector: 'Media', now: 'Correspondent, The Delhi Chronicle', updated: '2025-11-02', headline: 'Correspondent, The Delhi Chronicle', skills: ['Reporting', 'Editing'],
      ms: [
        { kind: 'society', title: 'Joined Literary Society', org: 'Literary Society', level: 'College', month: '2019-09' },
        { kind: 'achievement', cat: 'cultural', title: '1st prize, inter-college creative writing', org: 'Off-campus', level: 'University', month: '2021-01' },
        { kind: 'graduation', title: 'Graduated, B.A. (H) English', month: '2022-06', admin: true },
        { kind: 'job', title: 'Correspondent, The Delhi Chronicle', org: 'New Delhi', month: '2023-01', admin: true }
      ] }
  ];
  const ids = {};
  for (const f of F) {
    const id = addUser(Object.assign({ seen: '2026-10-17 20:00:00' }, f));
    ids[f.name.split(' ')[0].toLowerCase()] = id;
    for (const m of f.ms) addMilestone(id, m, m.admin ? admin : fac[f.dept]);
  }

  // Register: fictional synthetic records so counts, charts and reports have volume.
  let seed = 20261018;
  const R = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(R() * a.length)];
  const wpick = (items, w) => { let r = R() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < items.length; i++) { r -= w[i]; if (r < 0) return items[i]; } return items[items.length - 1]; };
  const FN = ['Aarushi', 'Akanksha', 'Anjali', 'Anushka', 'Bhavya', 'Charu', 'Deepika', 'Diya', 'Gauri', 'Ishani', 'Jahnavi', 'Khushi', 'Kritika', 'Lavanya', 'Mansi', 'Megha', 'Muskan', 'Neha', 'Nikita', 'Pallavi', 'Prachi', 'Radhika', 'Ritika', 'Sanya', 'Shreya', 'Shruti', 'Simran', 'Srishti', 'Tanya', 'Vaishnavi', 'Vanshika', 'Zoya'];
  const LN = ['Agarwal', 'Bhatia', 'Chauhan', 'Chopra', 'Garg', 'Iyer', 'Jain', 'Kapoor', 'Kaur', 'Khan', 'Malhotra', 'Mishra', 'Nair', 'Negi', 'Pandey', 'Rawat', 'Reddy', 'Saxena', 'Sethi', 'Sharma', 'Singh', 'Srivastava', 'Tiwari', 'Verma'];
  const codes = DEPTS.map(d => d[0]);
  const DW = [8, 7, 6, 12, 14, 10, 9, 8, 8];
  const SOC = Object.fromEntries(DEPTS.map(d => [d[0], d[3]]));
  const COURSE = Object.fromEntries(DEPTS.map(d => [d[0], d[2]]));
  const JOBS = {
    Tech: [['Software Engineer', 'Quantra Systems'], ['Data Analyst', 'Nimbus Cloudworks'], ['Product Analyst', 'Brightpath Labs']],
    Finance: [['Analyst', 'Kestrel Advisory'], ['Associate', 'Meridian Capital'], ['Audit Associate', 'Ledgerline & Co.']],
    Media: [['Content Writer', 'Inkwell Publishing'], ['Sub-editor', 'The Delhi Chronicle']],
    Education: [['Teacher', 'a Delhi public school'], ['Academic Coordinator', 'Lumen Learning']],
    Policy: [['Research Associate', 'Civic Lens Foundation'], ['Policy Analyst', 'Policy Bridge India']]
  };
  const SECTOR_W = { CS: [8, 1, 0, 1, 0], MA: [5, 3, 0, 2, 0], CM: [1, 8, 0, 1, 0], EC: [1, 6, 0, 1, 2], EN: [0, 1, 6, 2, 1], HI: [0, 1, 2, 4, 3], PS: [0, 1, 2, 2, 5], PH: [3, 2, 0, 4, 1], CH: [2, 2, 0, 5, 1] };
  const TPL = [
    ['achievement', 'tech', 'College', 6, ['Winner, college coding contest']], ['achievement', 'tech', 'University', 6, ['1st prize, inter-college hackathon', 'Runner-up, inter-college coding contest']],
    ['achievement', 'tech', 'National', 3, ['Finalist, Smart India Hackathon', 'Top 50, national coding challenge']], ['achievement', 'tech', 'International', 1, ['Google Summer of Code contributor']],
    ['achievement', 'sports', 'University', 6, ['Gold medal, inter-college athletics meet', 'Silver medal, inter-college badminton']], ['achievement', 'sports', 'State', 3, ['Gold, state athletics championship']],
    ['achievement', 'sports', 'National', 2, ['Finalist, All India Inter-University Championship']], ['research', 'research', 'National', 4, ['Paper presented, national student conference', 'Summer research fellowship']],
    ['research', 'research', 'International', 1, ['Paper published, international peer-reviewed journal']], ['exam', 'exam', 'National', 5, ['Qualified IIT JAM', 'Cleared GATE', 'Qualified CUET PG (top 1%)']],
    ['achievement', 'cultural', 'College', 8, ['1st prize, college debate', 'Winner, college quiz']], ['achievement', 'cultural', 'University', 8, ['1st prize, inter-college debate', '1st place, inter-college dance competition']],
    ['achievement', 'social', 'College', 7, ['NSS: 240 hours of community service']], ['achievement', 'social', 'State', 2, ['Winner, state youth parliament']],
    ['achievement', 'startup', 'National', 1.5, ['Runner-up, Enactus India National Exposition']]
  ];
  let n = 0;
  const pendingPool = [];
  function synthAch(uid, dept, ay, recent) {
    const t = wpick(TPL, TPL.map(x => x[3]));
    const m = pick([9, 11, 1, 2, 3]); const y = m >= 7 ? ay : ay + 1;
    const month = y + '-' + String(m).padStart(2, '0');
    if (month > '2026-10') return;
    const isPending = recent && month >= '2026-09' && pendingPool.length < 9;
    addMilestone(uid, { kind: t[0], cat: t[1], level: t[2], title: pick(t[4]), org: t[2] === 'College' ? SOC[dept] : 'Off-campus', month,
      status: isPending ? 'pending' : (R() < 0.03 ? 'rejected' : 'verified'), sub: isPending ? `2026-10-${String(5 + pendingPool.length).padStart(2, '0')} 10:00:00` : null }, fac[dept]);
    if (isPending) pendingPool.push(uid);
  }
  for (let g = 2015; g <= 2026; g++) {
    for (let k = 0; k < 70 + (g - 2015) * 8; k++) {
      const dept = wpick(codes, DW); n++;
      const status = wpick(['Job', 'Higher studies', 'Research', 'Govt services', 'Entrepreneurship', 'Not reported'], [44, 22, 7, 9, 4, 14]);
      let now = null, sector = null;
      if (status === 'Job') { sector = wpick(['Tech', 'Finance', 'Media', 'Education', 'Policy'], SECTOR_W[dept]); const j = pick(JOBS[sector]); now = `${j[0]}, ${j[1]}`; }
      if (status === 'Higher studies') now = pick(['M.Sc.', 'M.A.', 'MBA', 'M.Com', 'MCA']) + ', ' + pick(['University of Delhi', 'Jawaharlal Nehru University', 'University of Edinburgh', 'IIM Indore']);
      if (status === 'Research') now = 'PhD scholar, ' + pick(['University of Delhi', 'IISER Pune', 'Jawaharlal Nehru University']);
      if (status === 'Govt services') now = pick(['Inspector (SSC CGL)', 'Probationary Officer, public sector bank', 'Assistant Professor (UGC-NET)', 'State civil services officer']);
      if (status === 'Entrepreneurship') now = 'Founder, ' + pick(['Kraftbox', 'Leafline', 'Tutorly', 'Spicetrail', 'Loomwise']);
      const stale = R() < 0.07;
      const mentor = g <= 2024 && R() < 0.09;
      const name = pick(FN) + ' ' + pick(LN);
      const uid = addUser({ email: `alumni${n}@college.example`, role: 'alumni', name, dept, adm: g - 3, grad: g, cid: String(g - 3).slice(2) + dept + (100 + n),
        status, now, sector, updated: stale ? `${Math.min(g, 2023)}-08-01` : `${2025 + (R() < 0.5 ? 1 : 0)}-0${1 + Math.floor(R() * 8)}-10`,
        headline: now || `${COURSE[dept]}, class of ${g}`, mentor, accepts: mentor || R() < 0.6, topics: mentor ? ['Career advice', 'Resume review'] : [],
        seen: R() < 0.32 ? '2026-10-0' + (1 + Math.floor(R() * 9)) + ' 12:00:00' : '2025-12-01 12:00:00' });
      for (let a = 0, c = wpick([0, 1, 2, 3], [40, 33, 18, 9]); a < c; a++) synthAch(uid, dept, g - 3 + Math.floor(R() * 3), false);
    }
  }
  for (const [adm, cnt] of [[2023, 300], [2024, 520], [2025, 540], [2026, 560]]) {
    for (let k = 0; k < cnt; k++) {
      const dept = wpick(codes, DW); n++;
      const uid = addUser({ email: `student${n}@college.example`, role: 'student', name: pick(FN) + ' ' + pick(LN), dept, adm, cid: String(adm).slice(2) + dept + (100 + n),
        headline: `${COURSE[dept]} student`, seen: R() < 0.7 ? '2026-10-1' + Math.floor(R() * 8) + ' 12:00:00' : '2026-03-01 12:00:00' });
      if (adm < 2026) for (let a = 0, c = wpick([0, 1, 2, 3], [48, 30, 15, 7]); a < c; a++) synthAch(uid, dept, adm + Math.floor(R() * (2027 - adm)), true);
    }
  }

  // A registration and a report waiting for IQAC.
  addUser({ email: 'simran.kaur@college.example', role: 'alumni', name: 'Simran Kaur', dept: 'CH', adm: 2016, grad: 2019, cid: '16CH0099', account: 'pending',
    status: 'Job', sector: 'Education', now: 'Assistant Professor', headline: 'Assistant Professor', updated: '2026-10-15' });

  // Chats and requests between the featured people.
  const c1 = Number(q.run('INSERT INTO chats (a_id, b_id, purpose, created_at) VALUES (?,?,?,?)', Math.min(ids.priya, ids.ishita), Math.max(ids.priya, ids.ishita), 'Mentorship', '2026-10-02 19:12:00').lastInsertRowid);
  const msgs = [
    [ids.priya, 'Hi Ishita di! I saw you went from Coding Society to GSoC. I want to apply next year. How did you pick an organisation?', '2026-10-02 19:12:00'],
    [ids.ishita, 'Hi Priya! Fix small issues in 2–3 projects you already use. Pick the one where maintainers reply fastest and stick with it.', '2026-10-02 21:40:00'],
    [ids.priya, 'That makes sense. Could you look at my resume sometime?', '2026-10-03 08:05:00'],
    [ids.ishita, 'Sure, send it this weekend. Also, congrats on the hackathon! Get it verified so it shows on your profile.', '2026-10-17 18:30:00']
  ];
  for (const [s, b, t] of msgs) q.run('INSERT INTO messages (chat_id, sender_id, body, created_at, read_at) VALUES (?,?,?,?,?)', c1, s, b, t, s === ids.ishita && t > '2026-10-10' ? null : t);
  const reqs = [
    [ids.meera, ids.priya, 'Internship / referral', 'Hi Priya, I’m a 2018 B.Com graduate and run Threadloop. We need a front-end intern for 8 weeks this winter, and your FoundIt project is close to what we need. Interested?', '2026-10-17 11:00:00'],
    [ids.priya, ids.sneha, 'Higher studies advice', 'Hi Sneha di, I’m a 3rd-year CS student thinking about an MS abroad. Could I ask you about the application timeline?', '2026-10-15 16:00:00'],
    [ids.harshita, ids.ishita, 'Resume review', 'Hi Ishita di! I’m a final-year CS student and SIH 2025 finalist, applying for backend roles. Could you review my resume?', '2026-10-16 09:00:00']
  ];
  for (const r of reqs) q.run('INSERT INTO chat_requests (from_id, to_id, purpose, note, created_at) VALUES (?,?,?,?,?)', ...r);

  q.run('INSERT INTO audit_log (actor_id, action, target, created_at) VALUES (?,?,?,?)', admin, 'Imported records', '42 rows from the 2016 Chemistry register', '2026-10-16 11:30:00');
  q.run('INSERT INTO audit_log (actor_id, action, target, created_at) VALUES (?,?,?,?)', admin, 'Exported report', 'NAAC student progression, batch 2026', '2026-10-18 10:05:00');
});

const c = q.get(`SELECT (SELECT count(*) FROM users) u, (SELECT count(*) FROM milestones) m, (SELECT count(*) FROM milestones WHERE status='pending') p`);
console.log(`Seeded ${c.u} users, ${c.m} milestones (${c.p} waiting for verification).`);
console.log(`Demo password for every account: ${PASSWORD}`);
