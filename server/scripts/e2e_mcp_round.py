"""End-to-end check of the agent's tool path, without voice.

Runs the demo ward round for Bed 12 by calling the MCP tools in the order the
WardVoice agent would, against a running backend (local or the public tunnel
that Agora cloud uses), then checks the family report.

    venv/bin/python scripts/e2e_mcp_round.py [base_url]   # default http://localhost:8000
"""
import asyncio
import sys

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")

STEPS = [
    ("select_patient", {"bed": "12"}),
    ("confirm_identity", {"confirmed": True}),
    ("record_vitals", {"hr": 88, "bp_sys": 124, "bp_dia": 78, "temp_c": 37.2, "spo2": 96, "rr": 18, "pain": 2}),
    ("confirm_section", {"section": "vitals"}),
    ("set_status", {"condition": "improving", "consciousness": "alert", "diet": "soft", "mobility": "assisted"}),
    ("confirm_section", {"section": "status"}),
    ("add_order", {"kind": "medication", "action": "change", "text": "Switch IV ceftriaxone to oral cefuroxime 500 mg twice daily"}),
    ("add_order", {"kind": "test", "action": "order", "text": "Repeat chest X-ray tomorrow"}),
    ("confirm_section", {"section": "orders"}),
    ("set_notes", {"clinical_note": "CAP day 4, afebrile 24h, crackles reduced R base.",
                   "family_note": "He is breathing more comfortably and his fever has settled."}),
    ("confirm_section", {"section": "notes"}),
    ("read_back", {}),
    ("sign_and_send", {"doctor_confirmed": True}),
]


def http(method: str, path: str):
    r = httpx.request(method, BASE + path, timeout=20)
    r.raise_for_status()
    return r.json()


async def main() -> int:
    http("POST", "/ward/reset")
    async with streamablehttp_client(BASE + "/mcp") as (read, write, _):
        async with ClientSession(read, write) as s:
            await s.initialize()
            tools = {t.name for t in (await s.list_tools()).tools}
            missing = {name for name, _ in STEPS} - tools
            assert not missing, f"missing tools: {missing}"
            for name, args in STEPS:
                res = await s.call_tool(name, args)
                text = " ".join(c.text for c in res.content if hasattr(c, "text"))
                ok = not res.isError and '"ok": false' not in text
                print(f"{'✓' if ok else '✗'} {name:16} {text[:110]}")
                if not ok:
                    return 1

    state = http("GET", "/ward/state")
    rec = state["records"]["P1"]
    report = next(r for r in state["reports"] if r["patient_id"] == "P1" and r["date"] == state["today"])
    print(f"\nrecord: {rec['status']} by {rec['signed_by']} · report: {report['status']} → {report['recipients']}")
    assert rec["status"] == "signed" and report["status"] == "sent" and len(report["recipients"]) == 2
    print("E2E OK")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
