# WardVoice: build steps

Deadline: **12:30 IST** on Commudle (our target 12:00).
✅ done · 🟡 in progress · 🔴 not started

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Idea, plan, track (Track 3) | ✅ | PLAN.md |
| 2 | Mobile app screens (doctor + family) | ✅ | phone frame, design tokens |
| 3 | Backend: ward domain, MCP tools, REST, email template | ✅ | 19 tests pass |
| 4 | Voice controls inside the round screen | ✅ | Start / Mute / End, live transcript, agent state |
| 5 | **Keys: Agora App ID + certificate, Murf key** | 🟡 | Agora ✅ (tokens minting) · **Murf still a placeholder: YOU** |
| 6 | Murf Falcon voice ID checked against the API | 🔴 | blocked on 5; `en-IN-priya` is a guess |
| 7 | Public tunnel → `MCP_ENDPOINT` | ✅ | cloudflared running; URL written to `.env.local` (changes on restart) |
| 8 | MCP reachable from the internet (host check) | ✅ | fixed 421 by restarting with the tunnel host |
| 9 | Full round over MCP via the public URL (no voice) | ✅ | `server/scripts/e2e_mcp_round.py`: 13 tool calls, signed, emailed to 2 |
| 10 | Doctor + family screens reflect the signed round | ✅ | screenshots checked |
| 11 | Agent starts (`/startAgent`) with Murf TTS | 🔴 | blocked on 5 |
| 12 | First live voice round, Bed 12 to sign and send | 🔴 | blocked on 5 |
| 13 | Family email delivered (Resend/SMTP) | 🔴 | optional; preview-only works now |
| 14 | README = submission text (Agora, Murf, agent workflow) | ✅ | |
| 15 | DEMO.md = WardVoice demo script | ✅ | |
| 16 | Commit + push to public GitHub repo | ✅ | github.com/arnavgupta28/WardVoice |
| 16b | Medical illustration fragments (DNA, heart, lungs, bone, cells, stethoscope, ECG) | ✅ | `web/src/wardvoice/figures.tsx` |
| 17 | Demo video (backup) | 🔴 | **YOU** record after step 12 |
| 18 | Submit on Commudle | 🔴 | **YOU**, by 12:30 |

## Unblock step 5 (about 5 minutes)
1. Murf key: murf.ai/api/dashboard → copy it into `MURF_API_KEY=` in `server/.env.local`.
2. Agora: console.agora.io → your project (Conversational AI enabled) → copy the App ID and App Certificate into `AGORA_APP_ID=` / `AGORA_APP_CERTIFICATE=`.
3. Tell me "keys in". I'll restart the backend, check the Murf voice, start the agent and run the voice round.
