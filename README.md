# AlumniConnect

A verified student and alumni network for a college. Profiles work like LinkedIn: anyone can search people and open their journey. Every milestone on a profile is checked by the college. Students and alumni talk through chat that opens only after the other person accepts a request. The IQAC office gets live analytics and one-click NAAC/NIRF reports from the same verified data.

## Run it

Needs Node.js 22.13 or newer. Nothing else: the database is SQLite, built into Node.

```bash
npm install
npm run seed     # creates data/alumniconnect.db with fictional sample data
npm start        # http://localhost:3000
```

Every demo account uses the password `demo1234`:

| Account | Email | What to try |
|---|---|---|
| Student | priya@college.example | Dashboard, profile journey, add an achievement with a certificate, search by path, request a chat |
| Alumni | ishita@college.example | Accept Harshita's request, mentoring settings, update "what are you doing now" |
| Faculty verifier | rekha@college.example | Approve Priya's hackathon, ask for more info, reject with a reason |
| IQAC admin | iqac@college.example | Analytics, NAAC/NIRF reports (CSV download), records, registrations, audit log |

To see live chat, log in as two people in two browsers (or one normal and one private window). Messages arrive within 3 seconds.

The **Feature notes** switch in the header adds a short note to each screen on how the feature helps students and the college. It is off by default; turn it on when pitching.

## What's in it

- **Profile photo and banner.** Upload a photo, and upload a banner image or pick a plain colour (Settings, or the buttons on your profile).
- **Profiles and journeys.** Year-by-year timeline (1st year, 2nd year, …, after college) with filters. Each item shows its level, proof, and who verified it and when. Other people see only verified items.
- **Verification.** Students add milestones with a certificate (PDF/PNG/JPG, stored on the server) or a link. Each one goes to the department's faculty verifier automatically. Alumni items and status changes go to IQAC. Verifiers approve, ask for more info, or reject with a reason.
- **People search.** Search by name, skill or achievement, filter by department and mentoring. Use **path filters** (cleared a competitive exam, went into research, working in tech, started a business, and so on) to see what each person did along the way.
- **Request-first chat.** Send a request with a purpose and a note. The chat opens only if the other person accepts, and works both ways. Emails and phone numbers are never shown. Users can turn requests off and report people.
- **Dashboard.** Linked mentors, things waiting for you, an activity calendar, achievements, and gauges for profile strength, verified share and accepted requests.
- **Wall of Fame.** Built from verified achievements per category, plus an alumni mentoring spotlight.
- **Alumni form.** The same questions as the college's paper "Alumni Database form": mobile number, internships, current status (course and university, or designation, company, location, on/off-campus, annual package) and the exams passed and appeared. Alumni fill it in Settings and can attach an offer or admission letter. IQAC can edit and verify any record's form from Records.
- **Digitize records (IQAC).** Three ways to get old paper records in:
  1. **Scan forms:** upload photos or scans in bundles (JPG, PNG or PDF, one form per file). With an `ANTHROPIC_API_KEY` set on the server, AI reads each form into the fields and marks anything hard to read. A person checks each one side by side with the scan and saves it. The scan is kept as proof. Without a key, the same screen is used to type each form in from the scan.
  2. **Type in a form:** a data-entry screen laid out like the paper form.
  3. **Import CSV:** download the template, fill it in Excel, save as CSV and upload (up to 5,000 rows per file). Rows with problems are listed so they can be fixed and uploaded again.
  Records created this way have no login. If the graduate later registers with the same roll number, their account is linked to that record after IQAC confirms it.
- **Placements.** For IQAC and faculty: graduates, placed %, on-campus and off-campus %, higher studies %, average, median and highest package, by batch and by course, year by year, by recruiter, plus every graduate's outcome (CSV download). Students see the totals without names.
- **IQAC.** KPIs, charts, a department filter, a register of every record, registration approvals, reports with CSV export (student progression, awards and medals, NIRF graduation outcomes, alumni engagement), status reminders and an audit log.

## Turning on AI reading of scanned forms

Set the environment variable `ANTHROPIC_API_KEY` on the server (on Render: the service's **Environment** tab). The server then reads queued scans two at a time with Claude (`claude-opus-5-5`) and returns the fields as structured JSON. Every result is checked by a person before it is saved. Without the key, everything else works and scans are filled in by hand.

## Structure

```
server/
  db.js      SQLite schema and helpers (data/alumniconnect.db)
  seed.js    Fictional sample data
  index.js   Express REST API + serves the frontend
  records.js Alumni form, data entry, CSV import, scan reading, placement statistics
public/
  index.html, app.css, app.js   Single-page frontend (no build step)
prototype/   The first click-through HTML mockup (no backend)
```

### Database tables

`departments`, `users` (students, alumni, faculty, admin, with account approval state; `unclaimed` = record from paper with no login yet), `outcomes` (the paper form's fields, one row per graduate, with source and verification), `scans` (uploaded scanned forms and what was read from them), `milestones` (journey items with proof, routing and verification), `chat_requests`, `chats`, `messages`, `sessions`, `reports`, `audit_log`.

### API (all JSON, cookie session)

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `/logout`, `/register` · `GET /api/me` |
| Profile | `PATCH /api/me` · `POST /api/me/status` · `GET /api/dashboard` |
| People | `GET /api/people?q&role&dept&mentor&path` · `GET /api/people/:id` |
| Milestones | `POST /api/milestones` · `DELETE /api/milestones/:id` · `POST /api/milestones/:id/resubmit` · `GET /api/files/:name` |
| Verification | `GET /api/verify` · `POST /api/verify/milestone/:id` · `/account/:id` · `/report/:id` · `POST /api/reports` |
| Chat | `POST /api/requests` · `GET /api/requests` · `POST /api/requests/:id/accept\|decline\|withdraw` · `GET /api/chats` · `GET/POST /api/chats/:id/messages` |
| Admin | `GET /api/admin/overview` · `/records` · `/reports/:type?format=csv` · `/audit` · `POST /api/admin/remind` |
| Other | `GET /api/meta` · `GET /api/stats/public` · `GET /api/fame` |

## Security in this build

Passwords are hashed with scrypt. Sessions use HTTP-only cookies. Every query is parameterised. Roles are checked on every route, and proof files are visible only to the owner and verifiers until approved.

## Not built yet

- Email (reminders and notifications are logged, not sent)
- Login rate limiting
- Push or WebSocket chat (the chat polls every 3 seconds)
- Attendance

## Moving to production

Move to MySQL or PostgreSQL by porting `server/db.js` (the SQL is standard). Store uploads in object storage, and put the app behind HTTPS.

All names, records and numbers in the sample data are fictional.
