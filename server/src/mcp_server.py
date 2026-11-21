"""MCP server (streamable-HTTP) exposing one mock tool. Agora cloud calls this
when the LLM emits a tool call. Replace get_time with your own tools.

This module is mounted in-process by server.py at /mcp — it is not run
standalone. Add your tools here; each @mcp.tool()-decorated function is
automatically registered with the FastMCP instance."""
import datetime
import os
from typing import Any, Dict, Literal, Optional
from urllib.parse import urlparse

import clinic
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

_endpoint = urlparse(os.getenv("MCP_ENDPOINT", ""))
_public_host = _endpoint.netloc
_public_origin = f"{_endpoint.scheme}://{_public_host}" if _endpoint.scheme and _public_host else ""

mcp = FastMCP(
    "clinic-appointment-agent",
    transport_security=TransportSecuritySettings(
        allowed_hosts=[
            "127.0.0.1:*",
            "localhost:*",
            "[::1]:*",
            *([_public_host] if _public_host else []),
        ],
        allowed_origins=[
            "http://127.0.0.1:*",
            "http://localhost:*",
            "http://[::1]:*",
            *([_public_origin] if _public_origin else []),
        ],
    ),
)


def current_time_message(time_format: Literal["12-hour", "24-hour"] = "24-hour") -> str:
    """Pure, testable helper: the message the get_time tool returns."""
    pattern = "%I:%M:%S %p" if time_format == "12-hour" else "%H:%M:%S"
    now = datetime.datetime.now().strftime(pattern)
    return f"The current server time is {now}."


@mcp.tool()
def get_time(time_format: Literal["12-hour", "24-hour"] = "24-hour") -> str:
    """Return the current server time in the requested 12-hour or 24-hour format."""
    msg = current_time_message(time_format)
    print(f"[MCP TOOL CALLED] get_time format={time_format} -> {msg}", flush=True)
    return msg


# ----------------------------------------------------------------------------
# Clinic appointment agent tools (Track 3). Logic lives in clinic.py; these
# wrappers only turn bad input into an error the model can recover from.
# ----------------------------------------------------------------------------

def _safe(tool: str, fn, **kwargs) -> Dict[str, Any]:
    try:
        return fn(**kwargs)
    except (ValueError, KeyError) as exc:
        msg = f"Invalid input: {exc}. Dates must be YYYY-MM-DD and times HH:MM (24-hour)."
        clinic.log(tool, kwargs, "error", msg)
        return {"error": msg}


@mcp.tool()
def get_today() -> Dict[str, Any]:
    """Return today's date, weekday and current time in India (IST). Use it to resolve 'tomorrow', 'this week', etc."""
    n = clinic.now()
    return {"date": n.date().isoformat(), "weekday": n.strftime("%A"), "time": n.strftime("%H:%M")}


@mcp.tool()
def search_doctors(specialty: str, area: Optional[str] = None, language: Optional[str] = None) -> Dict[str, Any]:
    """Find doctors in Bengaluru by specialty (e.g. dermatologist, general physician, endocrinologist,
    dentist, orthopedic). Optional area (e.g. Whitefield) ranks nearby clinics first; optional language filters."""
    return _safe("search_doctors", clinic.search_doctors, specialty=specialty, area=area, language=language)


@mcp.tool()
def get_doctor_slots(doctor_id: str, date_from: str, date_to: Optional[str] = None,
                     earliest_time: Optional[str] = None, latest_time: Optional[str] = None) -> Dict[str, Any]:
    """List a doctor's open 30-minute slots between date_from and date_to (YYYY-MM-DD, inclusive),
    optionally only between earliest_time and latest_time (HH:MM, 24-hour)."""
    return _safe("get_doctor_slots", clinic.get_doctor_slots, doctor_id=doctor_id, date_from=date_from,
                 date_to=date_to, earliest_time=earliest_time, latest_time=latest_time)


@mcp.tool()
def get_my_calendar(date_from: str, date_to: Optional[str] = None) -> Dict[str, Any]:
    """Return the user's existing calendar events between date_from and date_to (YYYY-MM-DD).
    Always check this before proposing a slot so you never suggest a clash."""
    return _safe("get_my_calendar", clinic.get_my_calendar, date_from=date_from, date_to=date_to)


@mcp.tool()
def book_appointment(doctor_id: str, date: str, time: str, patient_name: str, reason: str,
                     user_confirmed: bool = False) -> Dict[str, Any]:
    """Book an appointment. Only set user_confirmed=true after the user has said yes to the exact
    doctor, date, time and fee. May return SLOT_TAKEN — then offer the nearest alternatives."""
    return _safe("book_appointment", clinic.book_appointment, doctor_id=doctor_id, date=date, time=time,
                 patient_name=patient_name, reason=reason, user_confirmed=user_confirmed)


@mcp.tool()
def add_to_calendar(appointment_id: str) -> Dict[str, Any]:
    """Add a booked appointment to the user's calendar."""
    return _safe("add_to_calendar", clinic.add_to_calendar, appointment_id=appointment_id)


@mcp.tool()
def send_confirmation(appointment_id: str, channel: Literal["sms", "email", "whatsapp"] = "sms",
                      recipient: Optional[str] = None) -> Dict[str, Any]:
    """Send the appointment's current status (confirmed / rescheduled / cancelled) to the user,
    or to a family member if recipient is given."""
    return _safe("send_confirmation", clinic.send_confirmation, appointment_id=appointment_id,
                 channel=channel, recipient=recipient)


@mcp.tool()
def set_reminder(appointment_id: str, minutes_before: int = 120) -> Dict[str, Any]:
    """Schedule a reminder before the appointment (default 2 hours before)."""
    return _safe("set_reminder", clinic.set_reminder, appointment_id=appointment_id, minutes_before=minutes_before)


@mcp.tool()
def list_my_appointments() -> Dict[str, Any]:
    """List the user's active (not cancelled) appointments."""
    return _safe("list_my_appointments", clinic.list_my_appointments)


@mcp.tool()
def reschedule_appointment(appointment_id: str, new_date: str, new_time: str,
                           user_confirmed: bool = False) -> Dict[str, Any]:
    """Move an appointment to a new open slot (check get_doctor_slots and get_my_calendar first).
    Only set user_confirmed=true after the user agrees to the new slot."""
    return _safe("reschedule_appointment", clinic.reschedule_appointment, appointment_id=appointment_id,
                 new_date=new_date, new_time=new_time, user_confirmed=user_confirmed)


@mcp.tool()
def cancel_appointment(appointment_id: str, user_confirmed: bool = False) -> Dict[str, Any]:
    """Cancel an appointment and remove its calendar entry and reminders. Requires explicit user confirmation."""
    return _safe("cancel_appointment", clinic.cancel_appointment, appointment_id=appointment_id,
                 user_confirmed=user_confirmed)
