import httpx

from .base import IngestAdapter, NormalizedAlert

USGS_FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
# Rough bbox covering the Mekong region + Guangxi: (lat_min, lat_max, lng_min, lng_max)
BBOX = (8.0, 26.0, 97.0, 112.0)
MIN_MAGNITUDE = 4.5


def _severity_for_magnitude(mag: float) -> int:
    if mag < 5:
        return 2
    if mag < 6:
        return 3
    if mag < 7:
        return 4
    return 5


class UsgsQuakeAdapter(IngestAdapter):
    """§W4 — polls the USGS 4.5+/day feed, filtered to the Mekong/Guangxi bbox.
    No cron infra in this build (see §7 descope on queue infra); exposed via
    a manually-triggerable endpoint (POST /api/demo/check-quakes) instead of
    continuous polling."""

    def __init__(self, tenant_id: str, area_codes: list[str]):
        self.tenant_id = tenant_id
        self.area_codes = area_codes

    def fetch(self) -> list[NormalizedAlert]:
        try:
            resp = httpx.get(USGS_FEED_URL, timeout=10)
            resp.raise_for_status()
        except httpx.HTTPError:
            return []

        data = resp.json()
        lat_min, lat_max, lng_min, lng_max = BBOX
        drafts: list[NormalizedAlert] = []
        for feature in data.get("features", []):
            props = feature["properties"]
            lng, lat = feature["geometry"]["coordinates"][:2]
            mag = props.get("mag") or 0
            if mag < MIN_MAGNITUDE or not (lat_min <= lat <= lat_max and lng_min <= lng <= lng_max):
                continue
            drafts.append(
                {
                    "tenant_id": self.tenant_id,
                    "source": "auto",
                    "event_type": "earthquake",
                    "severity": _severity_for_magnitude(mag),
                    "headline": f"M{mag:.1f} earthquake detected — {props.get('place', 'nearby region')}",
                    "description": f"USGS reports a magnitude {mag:.1f} earthquake. {props.get('title', '')}",
                    "source_lang": "en",
                    "area_codes": self.area_codes,
                    "center_lat": lat,
                    "center_lng": lng,
                }
            )
        return drafts
