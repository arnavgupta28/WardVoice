"""MCP server (streamable-HTTP) exposing one mock tool. Agora cloud calls this
when the LLM emits a tool call. Replace get_time with your own tools.

This module is mounted in-process by server.py at /mcp — it is not run
standalone. Add your tools here; each @mcp.tool()-decorated function is
automatically registered with the FastMCP instance."""
import datetime
import os
from typing import Any, Dict, Literal, Optional
from urllib.parse import urlparse

import ward
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

_endpoint = urlparse(os.getenv("MCP_ENDPOINT", ""))
_public_host = _endpoint.netloc
_public_origin = f"{_endpoint.scheme}://{_public_host}" if _endpoint.scheme and _public_host else ""

mcp = FastMCP(
    "wardvoice",
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
# WardVoice tools (Track 3). Logic lives in ward.py and is shared with the touch
# fallback (REST), so voice and touch obey identical rules. Every write lands in
# a "captured" state; nothing counts until confirm_section and sign_and_send.
# ----------------------------------------------------------------------------

def _safe(tool: str, fn, **kwargs) -> Dict[str, Any]:
    try:
        return fn(**kwargs)
    except ward.WardError as exc:
        print(f"[MCP TOOL] {tool} refused: {exc}", flush=True)
        return {"error": str(exc)}
    except (ValueError, TypeError) as exc:
        return {"error": f"Invalid input: {exc}"}


@mcp.tool()
def select_patient(bed: str) -> Dict[str, Any]:
    """Select the patient by bed number (e.g. "12"). Returns name and MRN to read back for identity confirmation."""
    return _safe("select_patient", ward.select_patient, bed=bed)


@mcp.tool()
def confirm_identity(confirmed: bool) -> Dict[str, Any]:
    """Call after reading back name + MRN: confirmed=true if the doctor said yes/correct, false otherwise."""
    return _safe("confirm_identity", ward.confirm_identity, confirmed=confirmed)


@mcp.tool()
def record_vitals(hr: Optional[float] = None, bp_sys: Optional[float] = None, bp_dia: Optional[float] = None,
                  temp_c: Optional[float] = None, spo2: Optional[float] = None, rr: Optional[float] = None,
                  pain: Optional[float] = None) -> Dict[str, Any]:
    """Record any vitals the doctor spoke: heart rate (hr), blood pressure (bp_sys/bp_dia), temperature in °C
    (Fahrenheit is auto-converted), oxygen saturation (spo2), respiratory rate (rr), pain 0-10. Only pass what was said."""
    return _safe("record_vitals", ward.record_vitals, hr=hr, bp_sys=bp_sys, bp_dia=bp_dia, temp_c=temp_c,
                 spo2=spo2, rr=rr, pain=pain)


@mcp.tool()
def set_status(condition: Optional[Literal["improving", "stable", "deteriorating", "critical"]] = None,
               consciousness: Optional[Literal["alert", "drowsy", "responds_to_voice", "unresponsive"]] = None,
               diet: Optional[Literal["nil_by_mouth", "liquids", "soft", "normal", "diabetic"]] = None,
               mobility: Optional[Literal["bed_rest", "assisted", "independent"]] = None) -> Dict[str, Any]:
    """Set overall condition, consciousness, diet and/or mobility. Map the doctor's words to the closest allowed value."""
    return _safe("set_status", ward.set_status, condition=condition, consciousness=consciousness, diet=diet, mobility=mobility)


@mcp.tool()
def add_order(kind: Literal["medication", "test", "consult", "discharge"],
              action: Literal["start", "stop", "change", "order", "plan"], text: str) -> Dict[str, Any]:
    """Add one clinical decision. text is concise and complete, e.g. "Paracetamol 1 g IV 6-hourly" or
    "Repeat chest X-ray tomorrow morning". Call once per order."""
    return _safe("add_order", ward.add_order, kind=kind, action=action, text=text)


@mcp.tool()
def remove_order(order_id: str) -> Dict[str, Any]:
    """Remove a captured order by id (e.g. "O2") when the doctor cancels it."""
    return _safe("remove_order", ward.remove_order, order_id=order_id)


@mcp.tool()
def set_notes(clinical_note: Optional[str] = None, family_note: Optional[str] = None) -> Dict[str, Any]:
    """Free-text notes. clinical_note is internal (clinical shorthand is fine). family_note is sent to the family:
    write it in warm, plain language with no jargon, numbers or drug doses."""
    return _safe("set_notes", ward.set_notes, clinical_note=clinical_note, family_note=family_note)


@mcp.tool()
def confirm_section(section: Literal["vitals", "status", "orders", "notes"]) -> Dict[str, Any]:
    """Mark a section confirmed ONLY after you read it back and the doctor said yes."""
    return _safe("confirm_section", ward.confirm_section, section=section)


@mcp.tool()
def read_back() -> Dict[str, Any]:
    """Summary of the whole round to read aloud before final sign-off; also lists sections still to confirm."""
    return _safe("read_back", ward.read_back)


@mcp.tool()
def sign_and_send(doctor_confirmed: bool) -> Dict[str, Any]:
    """Final sign-off. Only after read_back and the doctor saying "sign and send". Locks the record and sends the
    family update (or holds it for a call if the condition is deteriorating/critical)."""
    return _safe("sign_and_send", ward.sign_and_send, doctor_confirmed=doctor_confirmed)
