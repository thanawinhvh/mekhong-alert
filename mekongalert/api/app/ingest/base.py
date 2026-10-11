from abc import ABC, abstractmethod
from typing import TypedDict


class NormalizedAlert(TypedDict, total=False):
    tenant_id: str
    source: str
    event_type: str
    severity: int
    headline: str
    description: str
    source_lang: str
    area_codes: list[str]
    center_lat: float
    center_lng: float


class IngestAdapter(ABC):
    """§6.1 — one adapter per upstream signal source. fetch() returns alerts
    ready to insert as drafts; it does not write to the DB itself."""

    @abstractmethod
    def fetch(self) -> list[NormalizedAlert]:
        raise NotImplementedError
