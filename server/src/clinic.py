"""Clinic appointment domain: mock doctors, slots, the user's calendar, bookings,
notifications and an activity log the dashboard reads.

Everything is in-memory and deterministic so the hackathon demo is repeatable.
Call `reset()` (or POST /demo/reset) between demo runs.

Demo toggle: when DEMO_SIMULATE_SLOT_TAKEN is on (default), the first booking
attempt after a reset fails with SLOT_TAKEN so the agent has to recover — this
shows Track 3's "Adapt" step on stage every time.
"""
from __future__ import annotations

import datetime as dt
import itertools
import os
import threading
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
_lock = threading.Lock()


def now() -> dt.datetime:
    return dt.datetime.now(IST)


def today() -> dt.date:
    return now().date()


# --------------------------------------------------------------------------- data

@dataclass(frozen=True)
class Doctor:
    id: str
    name: str
    specialty: str
    clinic: str
    area: str
    fee_inr: int
    rating: float
    languages: tuple
    slot_times: tuple  # daily HH:MM slots before blocking


DOCTORS: List[Doctor] = [
    Doctor("D1", "Dr. Kavya Rao", "dermatologist", "Sunrise Skin Clinic", "Whitefield",
           800, 4.8, ("English", "Kannada", "Hindi"), ("10:00", "11:30", "17:30", "18:30", "19:30")),
    Doctor("D2", "Dr. Arjun Mehta", "dermatologist", "SkinFirst", "Indiranagar",
           1000, 4.6, ("English", "Hindi"), ("09:30", "12:00", "18:00", "19:00")),
    Doctor("D3", "Dr. Meera Iyer", "general physician", "Brookefield Family Care", "Brookefield",
           500, 4.7, ("English", "Tamil", "Hindi"), ("09:00", "10:00", "11:00", "17:00", "18:00", "19:00")),
    Doctor("D4", "Dr. Rohan Shetty", "endocrinologist", "Koramangala Diabetes Centre", "Koramangala",
           1200, 4.9, ("English", "Kannada"), ("10:30", "12:30", "18:30")),
    Doctor("D5", "Dr. Ananya Das", "dentist", "Smile Studio", "Whitefield",
           700, 4.5, ("English", "Bengali", "Hindi"), ("10:00", "13:00", "17:00", "18:30", "20:00")),
    Doctor("D6", "Dr. Vikram Nair", "orthopedic", "HSR Bone & Joint", "HSR Layout",
           900, 4.6, ("English", "Malayalam"), ("09:30", "11:00", "18:00", "19:30")),
]
_DOCTORS_BY_ID = {d.id: d for d in DOCTORS}

SPECIALTY_ALIASES = {
    "skin": "dermatologist", "derma": "dermatologist", "dermatology": "dermatologist",
    "gp": "general physician", "general": "general physician", "physician": "general physician",
    "family doctor": "general physician", "fever": "general physician",
    "diabetes": "endocrinologist", "endocrinology": "endocrinologist", "thyroid": "endocrinologist",
    "teeth": "dentist", "tooth": "dentist", "dental": "dentist",
    "bones": "orthopedic", "ortho": "orthopedic", "orthopaedic": "orthopedic", "knee": "orthopedic",
}


@dataclass
class Appointment:
    id: str
    doctor_id: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    patient_name: str
    reason: str
    status: str = "confirmed"  # confirmed | cancelled | rescheduled
    calendar_event_id: Optional[str] = None
    reminders: List[str] = field(default_factory=list)


@dataclass
class CalendarEvent:
    id: str
    title: str
    date: str
    start: str
    end: str


# --------------------------------------------------------------------------- state

_state: Dict[str, Any] = {}
_ids = itertools.count(1)


def _seed_calendar() -> List[CalendarEvent]:
    """The user's existing commitments, relative to today, so slots can clash."""
    d1 = (today() + dt.timedelta(days=1)).isoformat()
    d2 = (today() + dt.timedelta(days=2)).isoformat()
    d3 = (today() + dt.timedelta(days=3)).isoformat()
    return [
        CalendarEvent("E-seed-1", "Team sync", d1, "18:00", "19:00"),
        CalendarEvent("E-seed-2", "Gym", d2, "19:00", "20:30"),
        CalendarEvent("E-seed-3", "Project review", d3, "17:00", "18:45"),
    ]


def reset() -> None:
    global _ids
    with _lock:
        _ids = itertools.count(1)
        _state.clear()
        _state.update(
            appointments={},
            calendar=_seed_calendar(),
            notifications=[],
            activity=[],
            booked=set(),  # (doctor_id, date, time)
            booking_attempts=0,
            simulate_slot_taken=os.getenv("DEMO_SIMULATE_SLOT_TAKEN", "1") not in ("0", "false", "no"),
        )


reset()


def _next_id(prefix: str) -> str:
    return f"{prefix}-{next(_ids):03d}"


def log(tool: str, args: Dict[str, Any], status: str, summary: str) -> None:
    """Append to the activity feed shown on the dashboard."""
    with _lock:
        _state["activity"].append({
            "id": len(_state["activity"]) + 1,
            "ts": now().strftime("%H:%M:%S"),
            "tool": tool,
            "args": {k: v for k, v in args.items() if v not in (None, "")},
            "status": status,  # ok | error | info
            "summary": summary,
        })
    print(f"[MCP TOOL] {tool} {status}: {summary}", flush=True)


def snapshot() -> Dict[str, Any]:
    """Everything the dashboard needs, JSON-ready."""
    with _lock:
        appts = []
        for a in _state["appointments"].values():
            doc = _DOCTORS_BY_ID[a.doctor_id]
            appts.append({**asdict(a), "doctor": doc.name, "clinic": doc.clinic, "area": doc.area})
        return {
            "today": today().isoformat(),
            "activity": list(_state["activity"]),
            "appointments": appts,
            "calendar": [asdict(e) for e in sorted(_state["calendar"], key=lambda e: (e.date, e.start))],
            "notifications": list(_state["notifications"]),
        }


# --------------------------------------------------------------------------- helpers

def _parse_date(value: str) -> dt.date:
    """Accept YYYY-MM-DD or a few spoken forms the LLM may pass through."""
    v = (value or "").strip().lower()
    if v in ("", "today"):
        return today()
    if v == "tomorrow":
        return today() + dt.timedelta(days=1)
    if v in ("day after tomorrow", "day after"):
        return today() + dt.timedelta(days=2)
    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for i, name in enumerate(weekdays):
        if name in v:
            delta = (i - today().weekday()) % 7 or 7
            return today() + dt.timedelta(days=delta)
    return dt.date.fromisoformat(value.strip())


def _mins(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _fmt_day(d: dt.date) -> str:
    return d.strftime("%A %d %b")


def _is_blocked(doc_id: str, d: dt.date, t: str) -> bool:
    """Deterministic pseudo-random unavailability so not every slot is open."""
    return (sum(map(ord, doc_id)) + d.toordinal() + _mins(t)) % 5 == 0


def _calendar_conflict(date_iso: str, t: str, duration: int = 30) -> Optional[CalendarEvent]:
    start, end = _mins(t), _mins(t) + duration
    for e in _state["calendar"]:
        if e.date == date_iso and start < _mins(e.end) and _mins(e.start) < end:
            return e
    return None


def _open_slots(doc: Doctor, d: dt.date) -> List[str]:
    if d.weekday() == 6:  # clinics closed on Sunday
        return []
    out = []
    for t in doc.slot_times:
        if d == today() and _mins(t) <= now().hour * 60 + now().minute + 30:
            continue
        if _is_blocked(doc.id, d, t) or (doc.id, d.isoformat(), t) in _state["booked"]:
            continue
        out.append(t)
    return out


# --------------------------------------------------------------------------- tool logic

def search_doctors(specialty: str, area: Optional[str] = None, language: Optional[str] = None) -> Dict[str, Any]:
    spec = (specialty or "").strip().lower()
    spec = SPECIALTY_ALIASES.get(spec, spec)
    matches = [d for d in DOCTORS if spec and (spec in d.specialty or d.specialty in spec)]
    if language:
        matches = [d for d in matches if any(language.lower() == l.lower() for l in d.languages)] or matches
    if area:
        near = [d for d in matches if area.lower() in d.area.lower()]
        matches = near + [d for d in matches if d not in near]
    result = {
        "doctors": [
            {"doctor_id": d.id, "name": d.name, "specialty": d.specialty, "clinic": d.clinic,
             "area": d.area, "fee_inr": d.fee_inr, "rating": d.rating, "languages": list(d.languages)}
            for d in matches
        ]
    }
    if not matches:
        result["error"] = (f"No doctors found for '{specialty}'. Available specialties: "
                           + ", ".join(sorted({d.specialty for d in DOCTORS})))
        log("search_doctors", {"specialty": specialty, "area": area}, "error", result["error"])
    else:
        log("search_doctors", {"specialty": specialty, "area": area, "language": language}, "ok",
            f"{len(matches)} match(es): " + ", ".join(f"{d.name} ({d.area})" for d in matches))
    return result


def get_doctor_slots(doctor_id: str, date_from: str, date_to: Optional[str] = None,
                     earliest_time: Optional[str] = None, latest_time: Optional[str] = None) -> Dict[str, Any]:
    doc = _DOCTORS_BY_ID.get((doctor_id or "").upper())
    if not doc:
        msg = f"Unknown doctor_id '{doctor_id}'. Call search_doctors first."
        log("get_doctor_slots", {"doctor_id": doctor_id}, "error", msg)
        return {"error": msg}
    start = _parse_date(date_from)
    end = _parse_date(date_to) if date_to else start
    end = min(end, start + dt.timedelta(days=13))
    days = []
    with _lock:
        d = start
        while d <= end:
            slots = [t for t in _open_slots(doc, d)
                     if (not earliest_time or _mins(t) >= _mins(earliest_time))
                     and (not latest_time or _mins(t) <= _mins(latest_time))]
            if slots:
                days.append({"date": d.isoformat(), "day": _fmt_day(d), "slots": slots})
            d += dt.timedelta(days=1)
    total = sum(len(x["slots"]) for x in days)
    log("get_doctor_slots", {"doctor": doc.name, "from": start.isoformat(), "to": end.isoformat(),
                             "after": earliest_time, "before": latest_time},
        "ok", f"{total} open slot(s) for {doc.name}")
    return {"doctor_id": doc.id, "doctor": doc.name, "availability": days}


def get_my_calendar(date_from: str, date_to: Optional[str] = None) -> Dict[str, Any]:
    start = _parse_date(date_from)
    end = _parse_date(date_to) if date_to else start
    with _lock:
        events = [asdict(e) for e in _state["calendar"] if start.isoformat() <= e.date <= end.isoformat()]
    events.sort(key=lambda e: (e["date"], e["start"]))
    log("get_my_calendar", {"from": start.isoformat(), "to": end.isoformat()}, "ok",
        f"{len(events)} event(s): " + "; ".join(f"{e['title']} {e['date']} {e['start']}-{e['end']}" for e in events)
        if events else "calendar is free")
    return {"events": events}


def book_appointment(doctor_id: str, date: str, time: str, patient_name: str, reason: str,
                     user_confirmed: bool) -> Dict[str, Any]:
    args = {"doctor_id": doctor_id, "date": date, "time": time, "patient": patient_name}
    if not user_confirmed:
        msg = ("Not booked: the user has not explicitly confirmed. Read back doctor, date, time "
               "and fee, ask for a yes, then call again with user_confirmed=true.")
        log("book_appointment", args, "error", "blocked — waiting for user confirmation")
        return {"error": msg}
    doc = _DOCTORS_BY_ID.get((doctor_id or "").upper())
    if not doc:
        log("book_appointment", args, "error", "unknown doctor")
        return {"error": f"Unknown doctor_id '{doctor_id}'."}
    d = _parse_date(date)
    with _lock:
        _state["booking_attempts"] += 1
        if time not in _open_slots(doc, d):
            msg = f"{time} on {_fmt_day(d)} is not an open slot for {doc.name}. Call get_doctor_slots."
            simulated = False
        elif _state["simulate_slot_taken"] and _state["booking_attempts"] == 1:
            _state["booked"].add((doc.id, d.isoformat(), time))  # someone else got it
            msg = (f"SLOT_TAKEN: {time} on {_fmt_day(d)} with {doc.name} was just booked by another "
                   f"patient. Offer the user the nearest alternatives from get_doctor_slots.")
            simulated = True
        else:
            msg = None
            simulated = False
        if msg is None:
            appt = Appointment(_next_id("APT"), doc.id, d.isoformat(), time, patient_name, reason)
            _state["appointments"][appt.id] = appt
            _state["booked"].add((doc.id, d.isoformat(), time))
    if msg:
        log("book_appointment", args, "error", msg.split(":")[0] if simulated else msg)
        return {"error": msg}
    log("book_appointment", args, "ok",
        f"{appt.id} confirmed: {doc.name}, {_fmt_day(d)} {time}, {doc.clinic}")
    return {"appointment_id": appt.id, "status": "confirmed", "doctor": doc.name, "clinic": doc.clinic,
            "address_area": doc.area, "date": d.isoformat(), "day": _fmt_day(d), "time": time,
            "fee_inr": doc.fee_inr}


def _get_appt(appointment_id: str) -> Optional[Appointment]:
    return _state["appointments"].get((appointment_id or "").upper())


def add_to_calendar(appointment_id: str) -> Dict[str, Any]:
    with _lock:
        a = _get_appt(appointment_id)
        if not a or a.status == "cancelled":
            err = f"No active appointment '{appointment_id}'."
        else:
            err = None
            doc = _DOCTORS_BY_ID[a.doctor_id]
            end = _mins(a.time) + 30
            ev = CalendarEvent(_next_id("E"), f"{doc.name} ({doc.specialty})", a.date, a.time,
                               f"{end // 60:02d}:{end % 60:02d}")
            _state["calendar"].append(ev)
            a.calendar_event_id = ev.id
    if err:
        log("add_to_calendar", {"appointment_id": appointment_id}, "error", err)
        return {"error": err}
    log("add_to_calendar", {"appointment_id": a.id}, "ok", f"added '{ev.title}' on {ev.date} {ev.start}")
    return {"calendar_event_id": ev.id, "title": ev.title, "date": ev.date, "start": ev.start, "end": ev.end}


def send_confirmation(appointment_id: str, channel: str = "sms", recipient: Optional[str] = None) -> Dict[str, Any]:
    channel = (channel or "sms").lower()
    if channel not in ("sms", "email", "whatsapp"):
        channel = "sms"
    with _lock:
        a = _get_appt(appointment_id)
        if not a:
            err = f"No appointment '{appointment_id}'."
        else:
            err = None
            doc = _DOCTORS_BY_ID[a.doctor_id]
            verb = {"confirmed": "is confirmed", "cancelled": "has been cancelled",
                    "rescheduled": "has been rescheduled"}.get(a.status, a.status)
            body = (f"Your appointment {a.id} with {doc.name} at {doc.clinic}, {doc.area} on "
                    f"{_fmt_day(dt.date.fromisoformat(a.date))} at {a.time} {verb}. Fee: Rs {doc.fee_inr}.")
            note = {"id": _next_id("MSG"), "channel": channel, "to": recipient or "you",
                    "body": body, "ts": now().strftime("%H:%M:%S")}
            _state["notifications"].append(note)
    if err:
        log("send_confirmation", {"appointment_id": appointment_id}, "error", err)
        return {"error": err}
    log("send_confirmation", {"appointment_id": a.id, "channel": channel, "to": note["to"]}, "ok",
        f"{channel.upper()} sent to {note['to']}")
    return {"sent": True, "channel": channel, "to": note["to"], "message": body}


def set_reminder(appointment_id: str, minutes_before: int = 120) -> Dict[str, Any]:
    with _lock:
        a = _get_appt(appointment_id)
        if not a or a.status == "cancelled":
            err = f"No active appointment '{appointment_id}'."
        else:
            err = None
            at = dt.datetime.fromisoformat(f"{a.date}T{a.time}") - dt.timedelta(minutes=int(minutes_before))
            when = at.strftime("%a %d %b %H:%M")
            a.reminders.append(when)
    if err:
        log("set_reminder", {"appointment_id": appointment_id}, "error", err)
        return {"error": err}
    log("set_reminder", {"appointment_id": a.id, "minutes_before": minutes_before}, "ok", f"reminder at {when}")
    return {"reminder_at": when, "appointment_id": a.id}


def list_my_appointments() -> Dict[str, Any]:
    with _lock:
        items = [{"appointment_id": a.id, "doctor": _DOCTORS_BY_ID[a.doctor_id].name, "date": a.date,
                  "time": a.time, "status": a.status}
                 for a in _state["appointments"].values() if a.status != "cancelled"]
    log("list_my_appointments", {}, "ok", f"{len(items)} active appointment(s)")
    return {"appointments": items}


def cancel_appointment(appointment_id: str, user_confirmed: bool) -> Dict[str, Any]:
    if not user_confirmed:
        log("cancel_appointment", {"appointment_id": appointment_id}, "error", "blocked — waiting for user confirmation")
        return {"error": "Not cancelled: ask the user to confirm, then call again with user_confirmed=true."}
    with _lock:
        a = _get_appt(appointment_id)
        if not a or a.status == "cancelled":
            err = f"No active appointment '{appointment_id}'."
        else:
            err = None
            a.status = "cancelled"
            _state["booked"].discard((a.doctor_id, a.date, a.time))
            if a.calendar_event_id:
                _state["calendar"] = [e for e in _state["calendar"] if e.id != a.calendar_event_id]
                a.calendar_event_id = None
            a.reminders.clear()
    if err:
        log("cancel_appointment", {"appointment_id": appointment_id}, "error", err)
        return {"error": err}
    log("cancel_appointment", {"appointment_id": a.id}, "ok", f"{a.id} cancelled, calendar + reminders cleared")
    return {"appointment_id": a.id, "status": "cancelled"}


def reschedule_appointment(appointment_id: str, new_date: str, new_time: str, user_confirmed: bool) -> Dict[str, Any]:
    args = {"appointment_id": appointment_id, "new_date": new_date, "new_time": new_time}
    if not user_confirmed:
        log("reschedule_appointment", args, "error", "blocked — waiting for user confirmation")
        return {"error": "Not rescheduled: confirm the new slot with the user, then call again with user_confirmed=true."}
    with _lock:
        a = _get_appt(appointment_id)
        doc = _DOCTORS_BY_ID[a.doctor_id] if a else None
        d = _parse_date(new_date)
        if not a or a.status == "cancelled":
            err = f"No active appointment '{appointment_id}'."
        elif new_time not in _open_slots(doc, d):
            err = f"{new_time} on {_fmt_day(d)} is not open for {doc.name}. Call get_doctor_slots."
        else:
            err = None
            _state["booked"].discard((a.doctor_id, a.date, a.time))
            a.date, a.time, a.status = d.isoformat(), new_time, "rescheduled"
            _state["booked"].add((a.doctor_id, a.date, a.time))
            for e in _state["calendar"]:
                if e.id == a.calendar_event_id:
                    end = _mins(new_time) + 30
                    e.date, e.start, e.end = a.date, new_time, f"{end // 60:02d}:{end % 60:02d}"
            a.reminders.clear()
    if err:
        log("reschedule_appointment", args, "error", err)
        return {"error": err}
    log("reschedule_appointment", args, "ok", f"{a.id} moved to {_fmt_day(d)} {new_time}; calendar updated")
    return {"appointment_id": a.id, "status": "rescheduled", "date": a.date, "time": a.time,
            "note": "Calendar updated. Reminders were cleared; set a new one."}
