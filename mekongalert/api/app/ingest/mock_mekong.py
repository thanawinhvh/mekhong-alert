from .base import IngestAdapter, NormalizedAlert

# Districts seeded with coordinates along the Mekong bank (see seed/seed.py).
RIVERSIDE_AREA_CODES = ["TH-MDH-MUEANG", "TH-MDH-WANYAI", "TH-MDH-DONTAN"]
# Mueang Mukdahan — the district seat among the three, used as the map pin.
CENTER_LAT, CENTER_LNG = 16.545, 104.722


class MockMekongAdapter(IngestAdapter):
    """§6.1 — reads gauge_readings; when the latest level is within 0.5m of
    flood stage (or over it), auto-drafts a flood alert for the riverside
    districts. Used by the Day 6 "Simulate rising water" demo button."""

    def __init__(self, tenant_id: str, latest_level_m: float, flood_stage_m: float):
        self.tenant_id = tenant_id
        self.latest_level_m = latest_level_m
        self.flood_stage_m = flood_stage_m

    def fetch(self) -> list[NormalizedAlert]:
        if self.latest_level_m < self.flood_stage_m - 0.5:
            return []
        return [
            {
                "tenant_id": self.tenant_id,
                "source": "mekong_gauge",
                "event_type": "flood",
                "severity": 3,
                "headline": "Mekong River level approaching flood stage near Mueang Mukdahan",
                "description": (
                    f"MUKDAHAN gauge reading {self.latest_level_m:.2f} m against a flood stage "
                    f"of {self.flood_stage_m:.2f} m. Riverside districts should prepare."
                ),
                "source_lang": "th",
                "area_codes": RIVERSIDE_AREA_CODES,
                "center_lat": CENTER_LAT,
                "center_lng": CENTER_LNG,
            }
        ]
