# WardVoice: hands-free ward rounds and automatic family updates

**Track:** AI Agents That Get Things Done (Build with Agora, Bengaluru)
**One line:** Doctors run ward rounds by voice, so they don't touch tablets with gloved hands. Every field is checked twice, and each family gets a plain-language daily email once the doctor signs off.

## Problem
- In sterile and isolation areas, touching a tablet risks cross-contamination. The alternative, removing gloves to type, slows the round down.
- Daily family updates are written by hand, so they are often late, inconsistent or skipped.

## How it works
1. **Identify:** the doctor says "Bed 12". The agent reads back two identifiers (name + MRN) and waits for "correct". Nothing is written before then.
2. **Capture:** speech fills structured fields through fixed MCP tools. Vitals, condition, diet, mobility and orders only accept valid values from a fixed set. The clinical note and the note for the family are the only free text.
3. **Confirm, layer 1:** the agent reads back each section. "Yes" marks it green; a correction re-captures it. Every field also has a touch fallback button.
4. **Confirm, layer 2:** the agent reads a summary of the whole round, the doctor says "sign and send", and the record locks with an audit trail.
5. **After sign-off, without the doctor:** the record is stored and a templated family email goes out to consented recipients only. Internal notes are never sent. A deteriorating or critical patient gets a "doctor will call you" flag instead of an email.

## Logins and pages
| Route | Who | Purpose |
|---|---|---|
| `/` | Everyone | Landing page: blue hero, "Doctor sign in" and "Family sign in" pills |
| `/signin?role=doctor\|family` | Everyone | Demo sign-in with pre-filled credentials |
| `/doctor` | Doctor | Ward dashboard: today's round, progress (x/N signed), patient cards, "Start voice round" |
| `/doctor/round/[id]` | Doctor | Voice round workspace: identity check, live fields (amber = captured, green = confirmed), condition selector, orders, notes, voice panel with transcript, step tracker, **Sign & send** |
| `/doctor/reports` | Doctor | Sent and held family reports, audit log, email preview |
| `/family` | Family | "How is Ramesh today?": condition, vitals with sparklines, today's plan, note from the doctor, signed by and when |
| `/family/updates` | Family | Timeline of daily updates |
| Email | Family | Blue header, condition pill, vitals grid, plan, doctor's note, sign-off line, "View in portal" button |

## Design language (from `design/`)
- Page `#E9EBEE`, cards `#F5F6F8` with soft neumorphic shadows, ink `#0E1116`, muted text `#6B7280`.
- Primary blue `#0B5FFF`. Red `#E5243B` only for critical states. Amber `#F59E0B` = captured but unconfirmed. Green `#12B76A` = confirmed.
- Card radius 28px, fully rounded pills with a circular arrow icon, oversized tight display headings (Instrument Sans).
- Vitals rows: icon tile, label and value, sparkline, "Now" chip.

## Data and API (backend `server/src/ward.py`, exposed as MCP tools and REST)
- `Patient {id, bed, name, age, sex, mrn, diagnosis, family[] {name, relation, email, consent}}`
- `RoundRecord {patient_id, status: draft|signed, verified, vitals{hr,bp_sys,bp_dia,temp_c,spo2,rr,pain}, condition, consciousness, diet, mobility, orders[], clinical_note, family_note, field_state{field: captured|confirmed}, signed_by, signed_at, audit[]}`
- MCP tools: `select_patient`, `confirm_identity`, `set_vitals`, `set_condition`, `set_status_fields`, `add_order`, `set_clinical_note`, `set_family_note`, `confirm_section`, `read_back`, `sign_and_send`
- REST: `GET /ward/state`, `GET /ward/patients/{id}`, `POST /ward/patients/{id}/confirm` (touch fallback), `GET /ward/reports`, `GET /ward/reports/{id}/email.html`, `POST /ward/reset`

## Scope
**MVP:** both logins, all pages, voice capture of vitals, condition, diet and orders, range checks, two-layer confirmation, touch fallback, audit log, sign-off lock, templated family email (real email if a key is set, otherwise a preview), consent and hold rules.
**Stretch:** a Murf voice note in Hindi or Kannada attached to the email; a family voice line that answers only from the signed summary; a handover summary for the next shift.

## Schedule
1. UI pages on mock data (now)
2. `ward.py` + MCP tools + REST, swap the UI to live data
3. Keys, tunnel, first live voice round
4. Email sending and polish, rehearse
5. Video, README, submit on Commudle
