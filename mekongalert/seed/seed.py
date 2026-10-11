"""Idempotent seed script.

Covers tenants, demo auth users + profiles, areas, and gauge_readings.
Later days extend this file with historical alerts/shares (Day 6), citizen
reports + subscribers (Day 5) — see SPEC.md §8, §13.

Auth users are only ever created here, never password-reset — re-running
this script (e.g. a nightly reseed) can't clobber a rotated password. Each
demo account has its own password env var (see USERS below); they're only
read when that account doesn't exist yet. To rotate existing passwords use
api/scripts/rotate_demo_passwords.py instead.

Usage: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (e.g.
`set -a; source ../.env; set +a; python seed.py` from seed/).
"""

import os
import random
import sys
from datetime import datetime, timedelta, timezone

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

TENANTS = [
    {
        "slug": "mukdahan-ddpm",
        "name_en": "Mukdahan Provincial Disaster Prevention Office",
        "name_th": "สำนักงานป้องกันและบรรเทาสาธารณภัยจังหวัดมุกดาหาร",
        "name_zh": "穆达汉府防灾减灾办公室",
        "country": "TH",
        "default_lang": "th",
    },
    {
        "slug": "qinzhou-emb",
        "name_en": "Qinzhou Emergency Management Bureau",
        "name_th": "สำนักงานบริหารจัดการเหตุฉุกเฉินชินโจว",
        "name_zh": "钦州市应急管理局",
        "country": "CN",
        "default_lang": "zh-CN",
    },
]

AREAS = {
    "mukdahan-ddpm": [
        # code, name_local, name_en, lat, lng, population_estimate (rough, for W7 impact assessment)
        ("TH-MDH-MUEANG", "เมืองมุกดาหาร", "Mueang Mukdahan", 16.545, 104.722, 140_000),
        ("TH-MDH-WANYAI", "หว้านใหญ่", "Wan Yai", 16.710, 104.750, 15_000),
        ("TH-MDH-DONTAN", "ดอนตาล", "Don Tan", 16.360, 104.750, 45_000),
        ("TH-MDH-NIKHOM", "นิคมคำสร้อย", "Nikhom Kham Soi", 16.420, 104.600, 40_000),
        ("TH-MDH-DONGLUANG", "ดงหลวง", "Dong Luang", 16.600, 104.500, 30_000),
        ("TH-MDH-KHAMCHAI", "คำชะอี", "Kham Cha-i", 16.300, 104.550, 35_000),
        ("TH-MDH-NONGSUNG", "หนองสูง", "Nong Sung", 16.550, 104.420, 25_000),
    ],
    "qinzhou-emb": [
        ("CN-QZ-QINNAN", "钦南区", "Qinnan District", 21.950, 108.620, 600_000),
        ("CN-QZ-QINBEI", "钦北区", "Qinbei District", 22.050, 108.550, 500_000),
        ("CN-QZ-LINGSHAN", "灵山县", "Lingshan County", 22.420, 109.300, 1_100_000),
        ("CN-QZ-PUBEI", "浦北县", "Pubei County", 22.270, 109.550, 700_000),
    ],
}

SHELTERS = {
    "mukdahan-ddpm": [
        ("โรงเรียนมุกดาหารวิทยาคม (Mukdahan Wittayakhom School)", 500, 16.548, 104.718),
        ("หอประชุมอำเภอดอนตาล (Don Tan District Hall)", 300, 16.362, 104.748),
        ("วัดศรีบุญเรือง หว้านใหญ่ (Wat Si Bun Rueang, Wan Yai)", 200, 16.708, 104.752),
        ("โรงเรียนนิคมคำสร้อยวิทยา (Nikhom Kham Soi School)", 250, 16.418, 104.598),
        ("ศูนย์ราชการอำเภอคำชะอี (Kham Cha-i Government Center)", 350, 16.302, 104.552),
    ],
    "qinzhou-emb": [
        ("钦南区体育馆 (Qinnan Gymnasium)", 800, 21.952, 108.618),
        ("钦北区中学 (Qinbei Middle School)", 600, 22.048, 108.552),
        ("灵山县文化中心 (Lingshan Cultural Center)", 700, 22.418, 109.302),
        ("浦北县体育中心 (Pubei Sports Center)", 500, 22.272, 109.548),
        ("钦州港应急避难所 (Qinzhou Port Emergency Shelter)", 400, 21.930, 108.640),
    ],
}

FLOOD_STAGE_M = 12.5
GAUGE_DAYS = 30
GAUGE_START_LEVEL_M = 9.8
GAUGE_END_LEVEL_M = 11.6

USERS = [
    # email, tenant slug, role, display name, env var holding its password
    ("admin@mukdahan.demo", "mukdahan-ddpm", "admin", "Admin (Mukdahan DDPM)", "SEED_ADMIN_MUKDAHAN_PASSWORD"),
    ("op@mukdahan.demo", "mukdahan-ddpm", "operator", "Operator (Mukdahan DDPM)", "SEED_OP_MUKDAHAN_PASSWORD"),
    ("viewer@mukdahan.demo", "mukdahan-ddpm", "viewer", "Viewer (Mukdahan DDPM)", "DEMO_VIEWER_PASSWORD"),
    ("admin@qinzhou.demo", "qinzhou-emb", "admin", "Admin (Qinzhou EMB)", "SEED_ADMIN_QINZHOU_PASSWORD"),
    ("op@qinzhou.demo", "qinzhou-emb", "operator", "Operator (Qinzhou EMB)", "SEED_OP_QINZHOU_PASSWORD"),
]


def upsert_tenants() -> dict[str, str]:
    slugs = [t["slug"] for t in TENANTS]
    existing = client.table("tenants").select("id, slug").in_("slug", slugs).execute()
    by_slug = {row["slug"]: row["id"] for row in existing.data}
    for t in TENANTS:
        if t["slug"] in by_slug:
            continue
        res = client.table("tenants").insert(t).execute()
        by_slug[t["slug"]] = res.data[0]["id"]
        print(f"  created tenant {t['slug']}")
    return by_slug


def upsert_areas(tenant_ids: dict[str, str]) -> None:
    rows = [
        {
            "tenant_id": tenant_ids[slug],
            "code": code,
            "name_local": name_local,
            "name_en": name_en,
            "lat": lat,
            "lng": lng,
            "population_estimate": population,
        }
        for slug, districts in AREAS.items()
        for code, name_local, name_en, lat, lng, population in districts
    ]
    client.table("areas").upsert(rows, on_conflict="tenant_id,code").execute()
    print(f"  upserted {len(rows)} areas")


def upsert_shelters(tenant_ids: dict[str, str]) -> None:
    for slug, shelters in SHELTERS.items():
        tenant_id = tenant_ids[slug]
        existing = client.table("shelters").select("id").eq("tenant_id", tenant_id).execute().data
        if existing:
            continue
        rows = [
            {"tenant_id": tenant_id, "name": name, "capacity": capacity, "lat": lat, "lng": lng}
            for name, capacity, lat, lng in shelters
        ]
        client.table("shelters").insert(rows).execute()
        print(f"  created {len(rows)} shelters for {slug}")


def upsert_gauge_readings() -> None:
    now = datetime.now(timezone.utc)
    rows = []
    for i in range(GAUGE_DAYS):
        progress = i / (GAUGE_DAYS - 1)
        level = GAUGE_START_LEVEL_M + (GAUGE_END_LEVEL_M - GAUGE_START_LEVEL_M) * progress
        level += random.uniform(-0.05, 0.05)
        rows.append(
            {
                "station": "MUKDAHAN",
                "level_m": round(level, 2),
                "flood_stage_m": FLOOD_STAGE_M,
                "reading_at": (now - timedelta(days=GAUGE_DAYS - 1 - i)).isoformat(),
            }
        )
    client.table("gauge_readings").upsert(rows, on_conflict="station,reading_at").execute()
    print(f"  upserted {len(rows)} gauge_readings rows")


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


def upsert_users(tenant_ids: dict[str, str]) -> None:
    for email, slug, role, display_name, password_env in USERS:
        user_id = find_user_id_by_email(email)
        if user_id is None:
            password = os.environ.get(password_env)
            if not password:
                sys.exit(f"{password_env} must be set to create {email} (see .env.example)")
            created = client.auth.admin.create_user(
                {"email": email, "password": password, "email_confirm": True}
            )
            user_id = created.user.id
            print(f"  created auth user {email}")
        client.table("profiles").upsert(
            {"id": user_id, "tenant_id": tenant_ids[slug], "display_name": display_name, "role": role}
        ).execute()
    print(f"  upserted {len(USERS)} profiles")


def main() -> None:
    print("Seeding tenants...")
    tenant_ids = upsert_tenants()
    print("Seeding areas...")
    upsert_areas(tenant_ids)
    print("Seeding demo users...")
    upsert_users(tenant_ids)
    print("Seeding gauge readings...")
    upsert_gauge_readings()
    print("Seeding shelters...")
    upsert_shelters(tenant_ids)
    print("Done.")


if __name__ == "__main__":
    main()
