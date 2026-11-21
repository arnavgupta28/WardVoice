# WardVoice demo script (about 3 minutes)

## Before going on stage
1. `cloudflared tunnel --url http://localhost:8000` → put the URL in `MCP_ENDPOINT=…/mcp` in `server/.env.local`.
2. `bun run dev`, then `curl -X POST localhost:8000/ward/reset`.
3. Open two tabs: `/doctor/round/P1?as=doctor` and `/family?as=family`.
4. Wear gloves for the visual: you never touch the screen after the first tap.

## Script

| # | You say / do | What judges see |
|---|---|---|
| 0 | One line: "Touching tablets in sterile wards spreads infection. Families get no updates. WardVoice fixes both." Tap **Start voice round**. | Agent: "WardVoice ready. Say the bed number to begin." (Murf Falcon voice) |
| 1 | "Bed 12." | Agent reads back "Ramesh Kumar, MRN ending 381. Correct?" |
| 2 | "Correct." | Identity chip turns green |
| 3 | "Pulse 88, BP 124 over 78, temp 37.2, sats 96, resp 18, pain 2." | Six vitals tiles fill in **amber** → read-back |
| 4 | "Yes." | Vitals turn **green** |
| 5 | "He's improving. Alert, soft diet, assisted mobility." → "Yes." | Status options light up → green |
| 6 | "Switch ceftriaxone to oral cefuroxime 500 twice daily. Repeat chest X-ray tomorrow." → "Yes." | Two typed orders appear → green |
| 7 | "Note for family: he's breathing more comfortably and his fever has settled." → "Yes." | Family note filled → green |
| 8 | "Sign and send." → agent reads the whole round back → "Yes." | Card locks: "Family update emailed to 2 recipients" |
| 9 | Switch to the family tab. | "How is Ramesh today?": Getting better, the doctor's note, vitals |

## If there is time (Adapt)
- Say "temp 45": the agent rejects it as implausible and asks you to re-check.
- Say "sats 86": it is flagged out of range and the agent asks for confirmation.
- Reports tab: Bed 15 shows **no consent → nothing sent**. If you set a patient to *critical*, the email is **held** and the patient goes on the call-the-family list.

## Talking points
- Hands-free in sterile settings. Voice removes the input friction where touching is the problem.
- Checked twice and deterministic: identity gate, range checks, fixed value lists, per-section and whole-round read-back. The agent never writes clinical content on its own.
- 12+ coordinated MCP tool calls per round, plus human-in-the-loop sign-off enforced in the tool.
- Follow-up after the call: family email, held for bad news, gated on consent, audit trail.

## Fallback if the venue Wi-Fi fails
Play the recorded video. Or run `server/scripts/e2e_mcp_round.py`, which drives the same round through MCP, and show the UI updating live.
