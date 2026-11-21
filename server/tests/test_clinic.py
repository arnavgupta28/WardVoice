"""End-to-end demo journey through the clinic MCP tools (Track 3 flow:
plan -> execute -> adapt on SLOT_TAKEN -> confirm & follow up)."""
import asyncio
import datetime as dt
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import clinic  # noqa: E402
import mcp_server as srv  # noqa: E402


def call(name, **args):
    """Invoke a tool through FastMCP exactly as Agora cloud would."""
    out = asyncio.run(srv.mcp.call_tool(name, args))
    content = out[0] if isinstance(out, tuple) else out
    return json.loads(content[0].text)


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch):
    monkeypatch.setenv("DEMO_SIMULATE_SLOT_TAKEN", "1")
    clinic.reset()
    yield


def _first_two_slots(doctor_id):
    start = clinic.today() + dt.timedelta(days=1)
    r = call("get_doctor_slots", doctor_id=doctor_id, date_from=start.isoformat(),
             date_to=(start + dt.timedelta(days=6)).isoformat())
    flat = [(d["date"], t) for d in r["availability"] for t in d["slots"]]
    assert len(flat) >= 2
    return flat[0], flat[1]


def test_all_tools_registered():
    names = {t.name for t in asyncio.run(srv.mcp.list_tools())}
    assert {"search_doctors", "get_doctor_slots", "get_my_calendar", "book_appointment",
            "add_to_calendar", "send_confirmation", "set_reminder", "list_my_appointments",
            "reschedule_appointment", "cancel_appointment", "get_today", "get_time"} <= names


def test_search_ranks_requested_area_first_and_resolves_alias():
    r = call("search_doctors", specialty="skin", area="Indiranagar")
    assert [d["doctor_id"] for d in r["doctors"]] == ["D2", "D1"]


def test_search_unknown_specialty_lists_options():
    r = call("search_doctors", specialty="astrologer")
    assert r["doctors"] == [] and "Available specialties" in r["error"]


def test_booking_requires_confirmation():
    (date, time), _ = _first_two_slots("D1")
    r = call("book_appointment", doctor_id="D1", date=date, time=time, patient_name="Asha",
             reason="rash", user_confirmed=False)
    assert "confirmed" in r["error"]
    assert clinic.snapshot()["appointments"] == []


def test_full_journey_with_slot_taken_recovery():
    (d1, t1), (d2, t2) = _first_two_slots("D1")

    first = call("book_appointment", doctor_id="D1", date=d1, time=t1, patient_name="Asha",
                 reason="rash", user_confirmed=True)
    assert first["error"].startswith("SLOT_TAKEN")

    # The taken slot disappears from availability; agent re-queries and rebooks.
    again = call("get_doctor_slots", doctor_id="D1", date_from=d1)
    assert t1 not in [t for day in again["availability"] for t in day["slots"]]

    ok = call("book_appointment", doctor_id="D1", date=d2, time=t2, patient_name="Asha",
              reason="rash", user_confirmed=True)
    appt = ok["appointment_id"]
    assert ok["status"] == "confirmed"

    cal = call("add_to_calendar", appointment_id=appt)
    assert cal["date"] == d2 and cal["start"] == t2
    msg = call("send_confirmation", appointment_id=appt, channel="whatsapp", recipient="Mom")
    assert msg["sent"] and "is confirmed" in msg["message"]
    rem = call("set_reminder", appointment_id=appt)
    assert rem["reminder_at"]

    snap = clinic.snapshot()
    tools = [a["tool"] for a in snap["activity"]]
    assert tools.count("book_appointment") == 2
    assert {"add_to_calendar", "send_confirmation", "set_reminder"} <= set(tools)
    assert snap["notifications"][0]["to"] == "Mom"


def test_reschedule_and_cancel():
    os.environ["DEMO_SIMULATE_SLOT_TAKEN"] = "0"
    clinic.reset()
    (d1, t1), (d2, t2) = _first_two_slots("D3")
    appt = call("book_appointment", doctor_id="D3", date=d1, time=t1, patient_name="Ravi",
                reason="fever", user_confirmed=True)["appointment_id"]
    call("add_to_calendar", appointment_id=appt)

    moved = call("reschedule_appointment", appointment_id=appt, new_date=d2, new_time=t2, user_confirmed=True)
    assert moved["status"] == "rescheduled"
    ev = [e for e in clinic.snapshot()["calendar"] if e["title"].startswith("Dr. Meera")]
    assert ev[0]["date"] == d2 and ev[0]["start"] == t2
    assert "rescheduled" in call("send_confirmation", appointment_id=appt)["message"]

    assert "error" in call("cancel_appointment", appointment_id=appt)  # needs confirmation
    call("cancel_appointment", appointment_id=appt, user_confirmed=True)
    assert call("list_my_appointments")["appointments"] == []
    assert not [e for e in clinic.snapshot()["calendar"] if e["title"].startswith("Dr. Meera")]


def test_bad_date_returns_recoverable_error():
    r = call("get_doctor_slots", doctor_id="D1", date_from="21/11/2026")
    assert "Invalid input" in r["error"]


def test_calendar_seed_creates_a_clash_tomorrow():
    tomorrow = (clinic.today() + dt.timedelta(days=1)).isoformat()
    ev = call("get_my_calendar", date_from=tomorrow)["events"]
    assert ev and ev[0]["start"] == "18:00"
