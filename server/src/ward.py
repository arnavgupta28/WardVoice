"""WardVoice domain: patients, round records, deterministic capture, two-layer
confirmation, sign-off lock, family report + email.

Voice (MCP tools) and touch (REST) call the same functions, so both paths obey
the same rules. Only clinical_note / family_note are free text; every other
field accepts a fixed set of values or a range-checked number.
"""
from __future__ import annotations

import copy
import datetime as dt
import functools
import html
import json
import os
import smtplib
import threading
from email.message import EmailMessage
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import requests

import persistence

IST = ZoneInfo("Asia/Kolkata")
_lock = threading.RLock()

DOCTOR = {"name": "Dr. Kavya Rao", "role": "Consultant, Internal Medicine", "ward": "Ward 4B"}

CONDITIONS = {"improving": "Getting better", "stable": "Stable", "deteriorating": "Needs closer care", "critical": "Critical"}
CONSCIOUSNESS = ["alert", "drowsy", "responds_to_voice", "unresponsive"]
DIETS = ["nil_by_mouth", "liquids", "soft", "normal", "diabetic"]
MOBILITY = ["bed_rest", "assisted", "independent"]
ORDER_KINDS = ["medication", "test", "consult", "discharge"]
ORDER_ACTIONS = ["start", "stop", "change", "order", "plan"]
SECTIONS = ["identity", "vitals", "status", "orders", "notes"]
HOLD_CONDITIONS = {"deteriorating", "critical"}

# (hard_min, hard_max) = physiologically plausible input; (min, max) = normal range.
VITALS = {
    "hr": {"label": "Heart rate", "unit": "bpm", "hard": (20, 250), "normal": (60, 100)},
    "bp_sys": {"label": "Systolic BP", "unit": "mmHg", "hard": (50, 260), "normal": (90, 140)},
    "bp_dia": {"label": "Diastolic BP", "unit": "mmHg", "hard": (20, 160), "normal": (60, 90)},
    "temp_c": {"label": "Temperature", "unit": "°C", "hard": (30.0, 43.5), "normal": (36.1, 37.8)},
    "spo2": {"label": "Oxygen saturation", "unit": "%", "hard": (50, 100), "normal": (94, 100)},
    "rr": {"label": "Respiratory rate", "unit": "/min", "hard": (4, 60), "normal": (12, 20)},
    "pain": {"label": "Pain score", "unit": "/10", "hard": (0, 10), "normal": (0, 3)},
}

PATIENTS: List[Dict[str, Any]] = [
    {
        "id": "P1", "bed": "12", "name": "Ramesh Kumar", "age": 64, "sex": "M", "mrn": "MRN-204381",
        "ward": "Ward 4B", "diagnosis": "Community-acquired pneumonia", "admitted_on": "2026-11-18",
        "family": [
            {"name": "Anita Kumar", "relation": "Daughter", "email": "anita@example.com", "consent": True},
            {"name": "Suresh Kumar", "relation": "Son", "email": "suresh@example.com", "consent": True},
        ],
        "trend": {"hr": [104, 101, 98, 96, 92, 90, 88], "spo2": [90, 91, 92, 93, 94, 95, 96],
                  "temp_c": [38.6, 38.4, 38.1, 37.9, 37.6, 37.4, 37.2], "bp": [138, 135, 132, 130, 128, 126, 124]},
    },
    {
        "id": "P2", "bed": "14", "name": "Lakshmi Iyer", "age": 71, "sex": "F", "mrn": "MRN-204417",
        "ward": "Ward 4B", "diagnosis": "Post-op hip replacement, day 2", "admitted_on": "2026-11-19",
        "family": [{"name": "Vikram Iyer", "relation": "Son", "email": "vikram@example.com", "consent": True}],
        "trend": {"hr": [82, 84, 80, 78, 79, 77, 76], "spo2": [97, 97, 98, 97, 98, 98, 98], "bp": [128, 126, 124, 125, 122, 121, 120]},
    },
    {
        "id": "P3", "bed": "15", "name": "Mohammed Farooq", "age": 58, "sex": "M", "mrn": "MRN-204452",
        "ward": "Ward 4B", "diagnosis": "Uncontrolled type 2 diabetes, DKA resolving", "admitted_on": "2026-11-20",
        "family": [{"name": "Ayesha Farooq", "relation": "Wife", "email": "ayesha@example.com", "consent": False}],
        "trend": {"hr": [112, 108, 102, 98, 95, 94, 92], "spo2": [96, 96, 97, 97, 97, 98, 98], "bp": [110, 112, 115, 118, 120, 121, 122]},
    },
]
_BY_ID = {p["id"]: p for p in PATIENTS}
_BY_BED = {p["bed"]: p for p in PATIENTS}


class WardError(ValueError):
    """Recoverable error — returned to the agent so it can ask the doctor again."""


def now() -> dt.datetime:
    return dt.datetime.now(IST)


def _ts() -> str:
    return now().strftime("%H:%M:%S")


def _blank_record(pid: str) -> Dict[str, Any]:
    return {
        "patient_id": pid, "status": "pending", "verified": False,
        "vitals": {k: None for k in VITALS},
        "condition": None, "consciousness": None, "diet": None, "mobility": None,
        "orders": [], "clinical_note": "", "family_note": "",
        "sections": {s: "empty" for s in SECTIONS},
        "signed_by": None, "signed_at": None, "audit": [],
    }


def _seed_reports() -> List[Dict[str, Any]]:
    today = now().date()
    d = lambda n: (today - dt.timedelta(days=n)).isoformat()  # noqa: E731
    v = lambda hr, s, di, t, o, rr, p: {"hr": hr, "bp_sys": s, "bp_dia": di, "temp_c": t, "spo2": o, "rr": rr, "pain": p}  # noqa: E731
    return [
        {"id": f"R-{d(0)}-P2", "patient_id": "P2", "date": d(0), "status": "sent", "recipients": ["vikram@example.com"],
         "condition": "stable", "vitals": v(76, 120, 76, 36.8, 98, 16, 3),
         "plan": ["Physiotherapy twice today", "Walking with a frame from tomorrow"],
         "family_note": "Lakshmi took her first steps with the physiotherapist this morning and is in good spirits.",
         "signed_by": DOCTOR["name"], "signed_at": "09:24", "delivery": "seed"},
        {"id": f"R-{d(0)}-P3", "patient_id": "P3", "date": d(0), "status": "no_consent", "recipients": [],
         "condition": "improving", "vitals": v(92, 122, 80, 36.9, 98, 17, 1),
         "plan": ["Insulin drip stopped, now on injections", "Diabetes educator visit at 3 pm"],
         "family_note": "", "signed_by": DOCTOR["name"], "signed_at": "09:12", "delivery": "seed"},
        {"id": f"R-{d(1)}-P1", "patient_id": "P1", "date": d(1), "status": "sent",
         "recipients": ["anita@example.com", "suresh@example.com"], "condition": "stable",
         "vitals": v(96, 130, 82, 37.9, 93, 20, 3),
         "plan": ["Continue IV antibiotics", "Oxygen by nasal prongs, wean as tolerated"],
         "family_note": "Ramesh had a restful night. His fever is coming down slowly and we are watching his oxygen closely.",
         "signed_by": DOCTOR["name"], "signed_at": "09:40", "delivery": "seed"},
        {"id": f"R-{d(2)}-P1", "patient_id": "P1", "date": d(2), "status": "sent",
         "recipients": ["anita@example.com", "suresh@example.com"], "condition": "stable",
         "vitals": v(101, 135, 85, 38.4, 91, 22, 4),
         "plan": ["IV antibiotics started", "Chest physiotherapy", "Blood cultures sent"],
         "family_note": "Ramesh settled into the ward well. We have started antibiotics for his chest infection.",
         "signed_by": DOCTOR["name"], "signed_at": "10:05", "delivery": "seed"},
    ]


_state: Dict[str, Any] = {}


def _persist() -> None:
    """Hand a private copy of the ward state to the (optional) Supabase writer."""
    if not persistence.enabled():
        return
    try:
        with _lock:
            state = copy.deepcopy(_state)
        persistence.save(state)
    except Exception as exc:  # noqa: BLE001 — never break a ward action
        print(f"[PERSIST] could not queue save: {exc}", flush=True)


def _persists(fn):
    """Persist the ward state after a mutating action succeeds."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        out = fn(*args, **kwargs)
        _persist()
        return out
    return wrapper


def _restore() -> None:
    """Replace the seed with the stored snapshot, if there is a valid one."""
    stored = persistence.load()
    if not stored:
        return
    try:
        with _lock:
            records = {**_state["records"], **{k: v for k, v in stored["records"].items() if k in _BY_ID}}
            active = stored.get("active_patient_id")
            _state.update(active_patient_id=active if active in _BY_ID else None, records=records,
                          reports=list(stored["reports"]), seq=int(stored["seq"]))
    except Exception as exc:  # noqa: BLE001 — a bad snapshot must not stop the server
        print(f"[PERSIST] stored ward state unusable, using seed: {exc}", flush=True)
        _seed()


def _seed() -> None:
    with _lock:
        _state.clear()
        records = {p["id"]: _blank_record(p["id"]) for p in PATIENTS}
        # P2 and P3 were already signed this morning, so the dashboard shows progress.
        for pid, cond, t in (("P2", "stable", "09:24"), ("P3", "improving", "09:12")):
            r = records[pid]
            r.update(status="signed", verified=True, condition=cond, signed_by=DOCTOR["name"], signed_at=t,
                     sections={s: "confirmed" for s in SECTIONS})
        _state.update(active_patient_id=None, records=records, reports=_seed_reports(), seq=0)


@_persists
def reset() -> None:
    """Back to the demo seed, and persist it so the reset survives a restart."""
    _seed()


_seed()
_restore()  # a stored snapshot (Supabase) wins over the seed


# --------------------------------------------------------------------------- helpers

def _record(pid: Optional[str] = None) -> Dict[str, Any]:
    pid = pid or _state["active_patient_id"]
    if not pid:
        raise WardError("No patient selected. Ask the doctor for the bed number, then call select_patient.")
    if pid not in _state["records"]:
        raise WardError(f"Unknown patient '{pid}'.")
    return _state["records"][pid]


def _writable(r: Dict[str, Any], need_verified: bool = True) -> None:
    if r["status"] == "signed":
        raise WardError("This round is already signed and locked. Changes need a new round.")
    if need_verified and not r["verified"]:
        p = _BY_ID[r["patient_id"]]
        raise WardError(f"Identity not confirmed yet. Read back '{p['name']}, {p['mrn']}' and call confirm_identity after the doctor says yes.")


def _audit(r: Dict[str, Any], text: str, via: str) -> None:
    actor = "WardVoice" if via == "system" else DOCTOR["name"]
    r["audit"].append({"ts": _ts(), "actor": actor, "via": via, "text": text})
    print(f"[WARD {via}] {r['patient_id']}: {text}", flush=True)


def _captured(r: Dict[str, Any], section: str) -> None:
    r["sections"][section] = "captured"
    if r["status"] == "pending":
        r["status"] = "draft"


def _enum(value: Optional[str], allowed, field: str) -> Optional[str]:
    if value is None or value == "":
        return None
    v = str(value).strip().lower().replace(" ", "_").replace("-", "_")
    if v not in allowed:
        raise WardError(f"'{value}' is not a valid {field}. Allowed: {', '.join(allowed)}.")
    return v


def _out_of_range(vitals: Dict[str, Any]) -> List[str]:
    flags = []
    for k, meta in VITALS.items():
        val = vitals.get(k)
        if val is not None and not (meta["normal"][0] <= val <= meta["normal"][1]):
            flags.append(f"{meta['label']} {val}{meta['unit']}")
    return flags


def patient_summary(p: Dict[str, Any]) -> Dict[str, Any]:
    return {k: p[k] for k in ("id", "bed", "name", "age", "sex", "mrn", "diagnosis")}


# --------------------------------------------------------------------------- actions (voice + touch)

@_persists
def select_patient(bed: Optional[str] = None, patient_id: Optional[str] = None, via: str = "voice") -> Dict[str, Any]:
    with _lock:
        p = _BY_ID.get(patient_id or "") or _BY_BED.get(str(bed or "").strip().lstrip("0") or "")
        if not p:
            raise WardError(f"No patient in bed '{bed}'. Beds on this ward: {', '.join(sorted(_BY_BED))}.")
        _state["active_patient_id"] = p["id"]
        r = _record(p["id"])
        if r["status"] != "signed" and not r["verified"]:
            r["sections"]["identity"] = "captured"
        _audit(r, f"Selected Bed {p['bed']}", via)
        return {
            "patient": patient_summary(p),
            "status": r["status"],
            "verified": r["verified"],
            "say": f"Bed {p['bed']} is {p['name']}, {p['age']}, MRN ending {p['mrn'][-3:]}. Ask the doctor to confirm identity."
            if not r["verified"] else f"Bed {p['bed']}, {p['name']}, identity already confirmed.",
        }


@_persists
def confirm_identity(confirmed: bool, via: str = "voice") -> Dict[str, Any]:
    with _lock:
        r = _record()
        _writable(r, need_verified=False)
        if not confirmed:
            _state["active_patient_id"] = None
            _audit(r, "Identity rejected — patient deselected", via)
            return {"verified": False, "say": "Identity not confirmed. Please say the bed number again."}
        r["verified"] = True
        r["sections"]["identity"] = "confirmed"
        p = _BY_ID[r["patient_id"]]
        _audit(r, f"Identity confirmed: {p['name']}, {p['mrn']}", via)
        return {"verified": True, "patient": patient_summary(p)}


@_persists
def record_vitals(via: str = "voice", **values: Any) -> Dict[str, Any]:
    with _lock:
        r = _record()
        _writable(r)
        given = {k: v for k, v in values.items() if k in VITALS and v is not None}
        if not given:
            raise WardError("No vitals given.")
        if "temp_c" in given and given["temp_c"] > 45:  # spoken in Fahrenheit
            given["temp_c"] = round((given["temp_c"] - 32) * 5 / 9, 1)
        for k, v in given.items():
            lo, hi = VITALS[k]["hard"]
            if not (lo <= float(v) <= hi):
                raise WardError(f"{VITALS[k]['label']} {v} is not plausible (expected {lo}–{hi}). Ask the doctor to repeat it.")
            r["vitals"][k] = round(float(v), 1) if k == "temp_c" else int(round(float(v)))
        _captured(r, "vitals")
        _audit(r, "Vitals captured: " + ", ".join(f"{k}={r['vitals'][k]}" for k in given), via)
        flags = _out_of_range(r["vitals"])
        return {"vitals": r["vitals"], "section": "captured", "out_of_range": flags,
                "say": "Read the vitals back and ask to confirm." + (f" Flag: {', '.join(flags)} is outside normal range — double-check." if flags else "")}


@_persists
def set_status(condition: Optional[str] = None, consciousness: Optional[str] = None, diet: Optional[str] = None,
               mobility: Optional[str] = None, via: str = "voice") -> Dict[str, Any]:
    with _lock:
        r = _record()
        _writable(r)
        updates = {
            "condition": _enum(condition, list(CONDITIONS), "condition"),
            "consciousness": _enum(consciousness, CONSCIOUSNESS, "consciousness level"),
            "diet": _enum(diet, DIETS, "diet"),
            "mobility": _enum(mobility, MOBILITY, "mobility"),
        }
        updates = {k: v for k, v in updates.items() if v is not None}
        if not updates:
            raise WardError("Nothing to set. Provide condition, consciousness, diet or mobility.")
        r.update(updates)
        _captured(r, "status")
        _audit(r, "Status set: " + ", ".join(f"{k}={v}" for k, v in updates.items()), via)
        return {"status_fields": {k: r[k] for k in ("condition", "consciousness", "diet", "mobility")}, "section": "captured"}


@_persists
def add_order(kind: str, action: str, text: str, via: str = "voice") -> Dict[str, Any]:
    with _lock:
        r = _record()
        _writable(r)
        kind = _enum(kind, ORDER_KINDS, "order kind")
        action = _enum(action, ORDER_ACTIONS, "order action")
        text = (text or "").strip()
        if len(text) < 3:
            raise WardError("Order text is empty. Ask for drug/test, dose, route and frequency.")
        _state["seq"] += 1
        order = {"id": f"O{_state['seq']}", "kind": kind, "action": action, "text": text[:160], "state": "captured"}
        r["orders"].append(order)
        _captured(r, "orders")
        _audit(r, f"Order {order['id']}: {action} {kind} — {order['text']}", via)
        return {"order": order, "orders": r["orders"], "section": "captured"}


@_persists
def remove_order(order_id: str, via: str = "voice") -> Dict[str, Any]:
    with _lock:
        r = _record()
        _writable(r)
        before = len(r["orders"])
        r["orders"] = [o for o in r["orders"] if o["id"] != order_id]
        if len(r["orders"]) == before:
            raise WardError(f"No order '{order_id}'.")
        _captured(r, "orders")
        _audit(r, f"Order {order_id} removed", via)
        return {"orders": r["orders"]}


@_persists
def set_notes(clinical_note: Optional[str] = None, family_note: Optional[str] = None, via: str = "voice") -> Dict[str, Any]:
    with _lock:
        r = _record()
        _writable(r)
        if clinical_note is not None:
            r["clinical_note"] = clinical_note.strip()[:2000]
        if family_note is not None:
            r["family_note"] = family_note.strip()[:800]
        _captured(r, "notes")
        if via == "voice":
            _audit(r, "Notes dictated", via)
        return {"clinical_note": r["clinical_note"], "family_note": r["family_note"], "section": "captured"}


@_persists
def confirm_section(section: str, via: str = "voice") -> Dict[str, Any]:
    with _lock:
        r = _record()
        _writable(r)
        section = _enum(section, [s for s in SECTIONS if s != "identity"], "section")
        if r["sections"][section] == "empty" and section != "notes":
            raise WardError(f"Nothing captured in {section} yet.")
        r["sections"][section] = "confirmed"
        if section == "orders":
            for o in r["orders"]:
                o["state"] = "confirmed"
        _audit(r, f"{section.capitalize()} confirmed", via)
        remaining = [s for s, st in r["sections"].items() if st != "confirmed"]
        return {"section": section, "state": "confirmed", "still_to_confirm": remaining}


@_persists
def confirm_order(order_id: str, via: str = "touch") -> Dict[str, Any]:
    with _lock:
        r = _record()
        _writable(r)
        hit = next((o for o in r["orders"] if o["id"] == order_id), None)
        if not hit:
            raise WardError(f"No order '{order_id}'.")
        hit["state"] = "confirmed"
        r["sections"]["orders"] = "confirmed" if all(o["state"] == "confirmed" for o in r["orders"]) else "captured"
        _audit(r, f"Order {order_id} confirmed", via)
        return {"orders": r["orders"]}


def read_back() -> Dict[str, Any]:
    """Whole-round summary the agent reads aloud before final sign-off."""
    with _lock:
        r = _record()
        p = _BY_ID[r["patient_id"]]
        v = r["vitals"]
        parts = [f"{p['name']}, bed {p['bed']}."]
        if any(x is not None for x in v.values()):
            parts.append(
                f"Pulse {v['hr']}, BP {v['bp_sys']} over {v['bp_dia']}, temperature {v['temp_c']}, oxygen {v['spo2']}, "
                f"breathing {v['rr']}, pain {v['pain']}.")
        if r["condition"]:
            parts.append(f"Condition {r['condition']}; consciousness {r['consciousness'] or 'not set'}; "
                         f"diet {r['diet'] or 'not set'}; mobility {r['mobility'] or 'not set'}.")
        if r["orders"]:
            parts.append("Orders: " + "; ".join(f"{o['action']} {o['text']}" for o in r["orders"]) + ".")
        if r["family_note"]:
            parts.append("Family note recorded.")
        remaining = [s for s, st in r["sections"].items() if st != "confirmed"]
        return {"summary": " ".join(parts), "ready_to_sign": r["verified"] and not remaining, "still_to_confirm": remaining}


@_persists
def sign_and_send(doctor_confirmed: bool, via: str = "voice") -> Dict[str, Any]:
    with _lock:
        r = _record()
        _writable(r)
        if not doctor_confirmed:
            raise WardError("Not signed: read_back the round and wait for the doctor to say 'sign and send'.")
        remaining = [s for s, st in r["sections"].items() if st != "confirmed"]
        if remaining:
            raise WardError(f"Cannot sign yet. Still to confirm: {', '.join(remaining)}.")
        r["status"] = "signed"
        r["signed_by"] = DOCTOR["name"]
        r["signed_at"] = now().strftime("%H:%M")
        _audit(r, "Round signed and locked", via)
        report = _build_report(r)
        _state["reports"].insert(0, report)
        _state["active_patient_id"] = None
    # Deliver outside the lock — network I/O.
    delivery = deliver_report(report)
    say = _dispatch_text(report)
    if report["status"] == "sent" and delivery.startswith("preview_only"):
        say = f"Family update ready for {len(report['recipients'])} recipient(s); email preview saved in reports."
    elif report["status"] == "sent" and delivery.startswith("failed"):
        say = "Record signed, but the family email failed to send. It is saved in reports to resend."
    with _lock:
        report["delivery"] = delivery
        # Audit what actually happened (sent / preview only / failed / held / no consent), after delivery.
        _audit(r, say, "system")
    return {"signed": True, "report_id": report["id"], "family_update": report["status"], "delivery": delivery,
            "say": say}


def _dispatch_text(report: Dict[str, Any]) -> str:
    if report["status"] == "held_call_family":
        return "Family email held because the condition needs a personal call. Added to the doctor's call list."
    if report["status"] == "no_consent":
        return "No family member has consented to updates, so nothing was sent."
    return f"Family update emailed to {len(report['recipients'])} recipient(s)."


def _build_report(r: Dict[str, Any]) -> Dict[str, Any]:
    p = _BY_ID[r["patient_id"]]
    consented = [f["email"] for f in p["family"] if f["consent"]]
    if r["condition"] in HOLD_CONDITIONS:
        status = "held_call_family"
    elif not consented:
        status = "no_consent"
    else:
        status = "sent"
    return {
        "id": f"R-{now().date().isoformat()}-{p['id']}-{now().strftime('%H%M%S')}",
        "patient_id": p["id"], "date": now().date().isoformat(), "status": status,
        "recipients": consented if status == "sent" else [],
        "condition": r["condition"] or "stable", "vitals": copy.deepcopy(r["vitals"]),
        "plan": [o["text"] for o in r["orders"] if o["state"] == "confirmed"],
        "family_note": r["family_note"], "signed_by": r["signed_by"], "signed_at": r["signed_at"],
        "delivery": "pending",
    }


# --------------------------------------------------------------------------- email

def _vital_cell(label: str, value: str, unit: str, ok: Optional[bool]) -> str:
    hint = "In the normal range" if ok else "Being watched closely"
    color = "#0B7A47" if ok else "#9A5B00"
    return (f'<td style="padding:6px;width:50%"><div style="background:#F5F6F8;border-radius:16px;padding:12px">'
            f'<div style="font-size:12px;color:#6B7280">{label}</div>'
            f'<div style="font-size:18px;font-weight:600;color:#0E1116">{html.escape(value)} '
            f'<span style="font-size:12px;font-weight:400;color:#6B7280">{unit}</span></div>'
            f'<div style="font-size:12px;color:{color}">{hint}</div></div></td>')


def render_email(report: Dict[str, Any], recipient_name: Optional[str] = None) -> Dict[str, str]:
    p = _BY_ID[report["patient_id"]]
    first = p["name"].split(" ")[0]
    v = report["vitals"]
    cond_label = CONDITIONS.get(report["condition"], report["condition"])

    def ok(key: str) -> Optional[bool]:
        val = v.get(key)
        if val is None:
            return None
        lo, hi = VITALS[key]["normal"]
        return lo <= val <= hi

    def fmt(x: Any) -> str:
        return "—" if x is None else str(x)

    cells = [
        _vital_cell("Heart rate", fmt(v.get("hr")), "bpm", ok("hr")),
        _vital_cell("Blood pressure", f"{fmt(v.get('bp_sys'))}/{fmt(v.get('bp_dia'))}", "mmHg", ok("bp_sys")),
        _vital_cell("Temperature", fmt(v.get("temp_c")), "°C", ok("temp_c")),
        _vital_cell("Oxygen (SpO₂)", fmt(v.get("spo2")), "%", ok("spo2")),
    ]
    plan = "".join(f'<li style="margin:4px 0">{html.escape(x)}</li>' for x in report["plan"])
    note = (f'<div style="background:#E6EEFF;border-radius:16px;padding:16px;margin:16px 0;font-size:14px;line-height:1.5">'
            f'<div style="font-size:12px;font-weight:600;color:#0B5FFF;margin-bottom:4px">A note from {html.escape(report["signed_by"])}</div>'
            f'{html.escape(report["family_note"])}</div>') if report["family_note"] else ""
    portal = os.getenv("FAMILY_PORTAL_URL", "http://localhost:3000/family")
    date_str = dt.date.fromisoformat(report["date"]).strftime("%A, %d %B %Y")
    body = f"""<!doctype html><html><body style="margin:0;background:#E9EBEE;font-family:Helvetica,Arial,sans-serif;color:#0E1116">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden">
<tr><td style="background:#0B5FFF;padding:24px;color:#fff">
<div style="font-size:13px;opacity:.8">Daily update · {date_str}</div>
<div style="font-size:24px;font-weight:600;margin-top:4px">How {html.escape(first)} is doing today</div></td></tr>
<tr><td style="padding:24px">
<p style="font-size:14px;margin:0 0 16px">Dear {html.escape(recipient_name or 'family')},</p>
<p style="font-size:14px;margin:0 0 12px">Overall: <span style="background:#E6EEFF;color:#0B5FFF;border-radius:999px;padding:4px 12px;font-weight:600">{html.escape(cond_label)}</span></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>{cells[0]}{cells[1]}</tr><tr>{cells[2]}{cells[3]}</tr></table>
{f'<p style="font-size:14px;font-weight:600;margin:16px 0 4px">Plan for today</p><ul style="font-size:14px;padding-left:18px;margin:0">{plan}</ul>' if plan else ''}
{note}
<p style="font-size:12px;color:#6B7280;line-height:1.5">Reviewed and signed by {html.escape(report['signed_by'])} at {report['signed_at']}. Questions? Call the Ward 4B desk at +91 80 4000 1234. This update is shared only with family members the patient has consented to.</p>
<a href="{portal}" style="display:inline-block;background:#0B5FFF;color:#fff;text-decoration:none;border-radius:999px;padding:10px 20px;font-size:14px">View in family portal</a>
</td></tr></table></td></tr></table></body></html>"""
    text = (f"Daily update for {p['name']} ({date_str})\nOverall: {cond_label}\n"
            f"Heart rate {fmt(v.get('hr'))} bpm, BP {fmt(v.get('bp_sys'))}/{fmt(v.get('bp_dia'))}, "
            f"temperature {fmt(v.get('temp_c'))}°C, oxygen {fmt(v.get('spo2'))}%\n"
            + ("Plan: " + "; ".join(report["plan"]) + "\n" if report["plan"] else "")
            + (f"Note from {report['signed_by']}: {report['family_note']}\n" if report["family_note"] else "")
            + f"Signed by {report['signed_by']} at {report['signed_at']}.")
    subject = f"Daily update for {p['name']}: {cond_label}"
    return {"subject": subject, "html": body, "text": text}


def deliver_report(report: Dict[str, Any]) -> str:
    """Send via Resend or SMTP when configured; otherwise keep as an in-app preview.
    FAMILY_EMAIL_OVERRIDE redirects all family mail to one inbox (live demo)."""
    if report["status"] != "sent" or not report["recipients"]:
        return "not_sent"
    p = _BY_ID[report["patient_id"]]
    override = os.getenv("FAMILY_EMAIL_OVERRIDE", "").strip()
    to = [override] if override else report["recipients"]
    first_name = next((f["name"].split(" ")[0] for f in p["family"] if f["consent"]), None)
    mail = render_email(report, first_name)
    sender = os.getenv("EMAIL_FROM", "WardVoice <onboarding@resend.dev>")
    try:
        if os.getenv("RESEND_API_KEY"):
            res = requests.post("https://api.resend.com/emails", timeout=10,
                                headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}"},
                                json={"from": sender, "to": to, "subject": mail["subject"], "html": mail["html"], "text": mail["text"]})
            res.raise_for_status()
            return f"emailed via Resend to {', '.join(to)}"
        if os.getenv("SMTP_HOST") and os.getenv("SMTP_USER"):
            msg = EmailMessage()
            msg["Subject"], msg["From"], msg["To"] = mail["subject"], os.getenv("SMTP_FROM", os.environ["SMTP_USER"]), ", ".join(to)
            msg.set_content(mail["text"])
            msg.add_alternative(mail["html"], subtype="html")
            with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "587")), timeout=10) as s:
                s.starttls()
                s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
                s.send_message(msg)
            return f"emailed via SMTP to {', '.join(to)}"
    except Exception as exc:  # noqa: BLE001 — surface, don't crash the round
        print(f"[WARD email] delivery failed: {exc}", flush=True)
        return f"failed: {exc}"
    return "preview_only (no email provider configured)"


# --------------------------------------------------------------------------- read models

def snapshot() -> Dict[str, Any]:
    with _lock:
        return json.loads(json.dumps({
            "doctor": DOCTOR, "active_patient_id": _state["active_patient_id"],
            "patients": PATIENTS, "records": _state["records"], "reports": _state["reports"],
            "today": now().date().isoformat(),
        }))


def report_by_id(rid: str) -> Optional[Dict[str, Any]]:
    with _lock:
        return next((copy.deepcopy(r) for r in _state["reports"] if r["id"] == rid), None)


@_persists
def apply_touch(pid: str, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Touch fallback: same rules as voice, recorded as via=touch."""
    with _lock:
        _state["active_patient_id"] = pid
        if action == "select":
            return select_patient(patient_id=pid, via="touch")
        if action == "verify":
            return confirm_identity(True, via="touch")
        if action == "confirm_section":
            return confirm_section(payload["section"], via="touch")
        if action == "set_choice":
            return set_status(**{payload["field"]: payload["value"]}, via="touch")
        if action == "set_vital":
            return record_vitals(via="touch", **{payload["key"]: payload["value"]})
        if action == "confirm_order":
            return confirm_order(payload["order_id"], via="touch")
        if action == "remove_order":
            return remove_order(payload["order_id"], via="touch")
        if action == "set_note":
            return set_notes(**{payload["field"]: payload["value"]}, via="touch")
        if action == "sign":
            pass
        else:
            raise WardError(f"Unknown action '{action}'.")
    return sign_and_send(True, via="touch")
