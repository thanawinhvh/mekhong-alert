"""Rotate demo account passwords in Supabase Auth.

The old shared SEED_USER_PASSWORD is assumed leaked (its value is kept out of git).
This gives every demo account its own password: viewer@mukdahan.demo stays
public (password from DEMO_VIEWER_PASSWORD, unchanged by design so the
portfolio link keeps working); the op/admin accounts each get a fresh
random password printed once and nowhere else.

Usage: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DEMO_VIEWER_PASSWORD must
be set (e.g. `set -a; source ../.env; set +a; python rotate_demo_passwords.py`
from api/scripts/).
"""

import os
import secrets
import sys

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

# email -> env var holding a fixed password, or None to generate a random one
ACCOUNTS = [
    ("viewer@mukdahan.demo", "DEMO_VIEWER_PASSWORD"),
    ("op@mukdahan.demo", None),
    ("admin@mukdahan.demo", None),
    ("op@qinzhou.demo", None),
    ("admin@qinzhou.demo", None),
]


def find_user_id_by_email(email: str) -> str | None:
    page = 1
    while True:
        result = client.auth.admin.list_users(page=page, per_page=200)
        users = result if isinstance(result, list) else getattr(result, "users", result)
        if not users:
            return None
        for u in users:
            if u.email == email:
                return u.id
        page += 1


def main() -> None:
    print("Rotating demo account passwords...\n")
    for email, env_var in ACCOUNTS:
        user_id = find_user_id_by_email(email)
        if user_id is None:
            sys.exit(f"{email}: no auth user found — run seed/seed.py first")

        if env_var:
            password = os.environ.get(env_var)
            if not password:
                sys.exit(f"{env_var} must be set (public password for {email})")
        else:
            password = secrets.token_urlsafe(12)

        client.auth.admin.update_user_by_id(user_id, {"password": password})
        print(f"  {email:<24} {password}")

    print("\nShown once above — save the private ones to a password manager.")
    print("Do not paste them into git, README, seed files, or logs.")


if __name__ == "__main__":
    main()
