from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def local_now() -> datetime:
    """Heure locale (naïve) : les dates de concert sont saisies en heure locale."""
    return datetime.now(ZoneInfo(get_settings().timezone)).replace(tzinfo=None)
