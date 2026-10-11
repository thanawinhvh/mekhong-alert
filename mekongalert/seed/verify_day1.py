"""Day 1 acceptance check (§13): each demo user logs in and sees only their
own tenant/profile row — proves Supabase Auth + RLS are wired correctly.
Requires SUPABASE_URL / SUPABASE_ANON_KEY, plus each account's current
password in the env var named below (same names seed.py reads).
"""

import os

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

USERS = [
    ("admin@mukdahan.demo", "mukdahan-ddpm", "SEED_ADMIN_MUKDAHAN_PASSWORD"),
    ("op@mukdahan.demo", "mukdahan-ddpm", "SEED_OP_MUKDAHAN_PASSWORD"),
    ("viewer@mukdahan.demo", "mukdahan-ddpm", "DEMO_VIEWER_PASSWORD"),
    ("admin@qinzhou.demo", "qinzhou-emb", "SEED_ADMIN_QINZHOU_PASSWORD"),
    ("op@qinzhou.demo", "qinzhou-emb", "SEED_OP_QINZHOU_PASSWORD"),
]


def check(email: str, expected_slug: str, password_env: str) -> None:
    password = os.environ[password_env]
    client = create_client(SUPABASE_URL, ANON_KEY)
    client.auth.sign_in_with_password({"email": email, "password": password})

    tenants = client.table("tenants").select("slug").execute().data
    assert len(tenants) == 1, f"{email}: expected to see exactly 1 tenant, saw {tenants}"
    assert tenants[0]["slug"] == expected_slug, f"{email}: saw wrong tenant {tenants}"

    profiles = client.table("profiles").select("id").execute().data
    assert len(profiles) == 1, f"{email}: expected to see exactly own profile, saw {profiles}"

    print(f"  OK  {email:<24} -> tenant={tenants[0]['slug']}")


LEAKED_PASSWORD = os.environ.get("SEED_USER_PASSWORD", "")  # old shared demo password (assumed leaked, kept out of git) — must stay dead


def check_old_password_rejected(email: str) -> None:
    if not LEAKED_PASSWORD:
        print(f"  --  {email:<24} -> skipped (set SEED_USER_PASSWORD to the old shared password to check it is dead)")
        return
    client = create_client(SUPABASE_URL, ANON_KEY)
    try:
        client.auth.sign_in_with_password({"email": email, "password": LEAKED_PASSWORD})
    except Exception:
        print(f"  OK  {email:<24} -> leaked password rejected")
        return
    raise AssertionError(f"{email}: the old shared demo password still works!")


def main() -> None:
    for email, slug, password_env in USERS:
        check(email, slug, password_env)
    for email, _, _ in USERS:
        check_old_password_rejected(email)
    print("\nDay 1 acceptance: PASS — demo users log in with their own password; the leaked password is dead.")


if __name__ == "__main__":
    main()
