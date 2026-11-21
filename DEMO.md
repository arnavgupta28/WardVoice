# Medi — Clinic Concierge (Build with Agora, Track 3)

Voice agent that plans and completes a doctor booking end to end:
search → check doctor slots + your calendar → propose → **you confirm** → book →
recover if the slot is taken → add to calendar → send confirmation → set reminder.

Stack: Agora Conversational AI (Deepgram STT → OpenAI LLM → **Murf Falcon TTS**),
tools served over **MCP** (`server/src/mcp_server.py`, logic in `server/src/clinic.py`),
live "Agent actions" panel in the web UI.

## Run it

1. Credentials in `server/.env.local`:
   - `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` — Agora Console (project with Conversational AI enabled)
   - `MURF_API_KEY` — Murf API dashboard. Check `MURF_VOICE_ID` against Murf's voice list.
2. Public tunnel (Agora cloud must reach `/mcp`):
   ```
   cloudflared tunnel --url http://localhost:8000
   ```
   Copy the `https://….trycloudflare.com` URL → `MCP_ENDPOINT=https://….trycloudflare.com/mcp`
   (the URL changes every time you restart cloudflared).
3. `bun run dev` → open http://localhost:3000 → Start Conversation.
4. Between runs, click **Reset demo** in the Agent actions panel.

Tests: `cd server && venv/bin/python -m pytest -q`

## 2-minute stage script

| You say | What the judges see in the panel |
|---|---|
| "I've had a skin rash for a week. Can you get me a dermatologist near Whitefield, sometime after 6 in the evening this week?" | Search doctors → Check doctor slots → Read your calendar (Team sync clash dropped) |
| Medi proposes Dr. Kavya Rao, day, time, ₹800. You: "Yes, book it." | Book appointment → ⚠ SLOT_TAKEN |
| Medi: "That slot just got taken — next is … Shall I book that?" You: "Yes." | Check doctor slots → Book appointment ✓ → Add to calendar → Send confirmation → Set reminder |
| "Also WhatsApp the details to my mom." | Send confirmation (WhatsApp → Mom) |
| *(optional)* "Actually move it to Saturday morning." | Check slots → Reschedule → Send confirmation |

Talking points: ≥2 coordinated tool calls (we do 6+), human-in-the-loop approval enforced
in the tool itself (`user_confirmed`), recovery from a failed action, follow-ups after the
call, and emergency safety (chest pain → "call 112", no booking).

The SLOT_TAKEN on the first booking is a deliberate demo switch (`DEMO_SIMULATE_SLOT_TAKEN=1`)
so recovery shows every time — say so if asked; all data is mocked and in-memory.
