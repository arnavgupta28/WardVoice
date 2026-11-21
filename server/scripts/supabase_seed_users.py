"""Create the WardVoice demo users in Supabase Auth and their `profiles` rows.

Run after supabase/schema.sql has been applied:

    cd server && venv/bin/python scripts/supabase_seed_users.py

Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment (or
server/.env.local / server/.env). Idempotent: existing users are reused.
"""
from __future__ import annotations

import os
import sys

import requests
from dotenv import load_dotenv

_base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_base, ".env.local"))
load_dotenv(os.path.join(_base, ".env"))

PASSWORD = "WardVoice2026!"
USERS = [
    {"email": "kavya.rao@wardvoice.demo", "role": "doctor", "display_name": "Dr. Kavya Rao", "patient_id": None},
    {"email": "anita.kumar@wardvoice.demo", "role": "family", "display_name": "Anita Kumar", "patient_id": "P1"},
]
TIMEOUT = 15


def main() -> int:
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.", file=sys.stderr)
        return 1
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    def find_user_id(email: str):
        page = 1
        while True:
            res = requests.get(f"{url}/auth/v1/admin/users", headers=headers, timeout=TIMEOUT,
                               params={"page": page, "per_page": 200})
            res.raise_for_status()
            users = res.json().get("users", [])
            for u in users:
                if (u.get("email") or "").lower() == email:
                    return u["id"]
            if len(users) < 200:
                return None
            page += 1

    for u in USERS:
        meta = {"role": u["role"], "display_name": u["display_name"], "patient_id": u["patient_id"]}
        res = requests.post(f"{url}/auth/v1/admin/users", headers=headers, timeout=TIMEOUT, json={
            "email": u["email"], "password": PASSWORD, "email_confirm": True, "user_metadata": meta})
        if res.ok:
            uid = res.json()["id"]
            print(f"created  {u['email']} ({u['role']})")
        elif res.status_code in (400, 409, 422) and "already" in res.text.lower():
            uid = find_user_id(u["email"])
            if not uid:
                print(f"error: {u['email']} reported as registered but not found", file=sys.stderr)
                return 1
            # Keep metadata and password in sync with this script.
            requests.put(f"{url}/auth/v1/admin/users/{uid}", headers=headers, timeout=TIMEOUT,
                         json={"password": PASSWORD, "user_metadata": meta}).raise_for_status()
            print(f"exists   {u['email']} ({u['role']})")
        else:
            print(f"error creating {u['email']}: HTTP {res.status_code} {res.text[:200]}", file=sys.stderr)
            return 1

        prof = requests.post(f"{url}/rest/v1/profiles", timeout=TIMEOUT,
                             headers={**headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
                             json={"id": uid, "role": u["role"], "display_name": u["display_name"],
                                   "patient_id": u["patient_id"]})
        if not prof.ok:
            print(f"error upserting profile for {u['email']}: HTTP {prof.status_code} {prof.text[:200]}"
                  " (did you run supabase/schema.sql?)", file=sys.stderr)
            return 1
        print(f"profile  {u['email']} -> {u['role']}" + (f", patient {u['patient_id']}" if u["patient_id"] else ""))

    print(f"Done. Demo password: {PASSWORD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
