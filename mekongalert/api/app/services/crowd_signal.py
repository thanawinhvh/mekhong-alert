import math
from typing import Any

RADIUS_KM = 5.0
MIN_CLUSTER_SIZE = 3


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def detect_cluster(new_report: dict[str, Any], recent_reports: list[dict[str, Any]]) -> list[str] | None:
    """§W3 — recent_reports must already be filtered to same tenant + category,
    credibility in (medium, high), created within the last 30 minutes. Returns
    the clustered report ids (including new_report) if the corroboration
    threshold is met, else None."""
    if new_report.get("lat") is None or new_report.get("lng") is None:
        return None
    cluster_ids = [new_report["id"]]
    for r in recent_reports:
        if r["id"] == new_report["id"] or r.get("lat") is None or r.get("lng") is None:
            continue
        if haversine_km(new_report["lat"], new_report["lng"], r["lat"], r["lng"]) <= RADIUS_KM:
            cluster_ids.append(r["id"])
    return cluster_ids if len(cluster_ids) >= MIN_CLUSTER_SIZE else None
