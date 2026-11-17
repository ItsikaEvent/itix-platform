import threading
import time
from collections import defaultdict
from fastapi import HTTPException, Request, status


class SlidingWindowLimiter:
    """Limiteur de débit en mémoire à fenêtre glissante (Sliding Window), thread-safe."""

    def __init__(self):
        self._lock = threading.Lock()
        self._hits = defaultdict(list)
        self._last_cleanup = time.time()

    def _cleanup(self, now: float) -> None:
        """Purge les anciennes entrées toutes les 5 minutes pour éviter toute fuite de mémoire."""
        if now - self._last_cleanup > 300:
            for k in list(self._hits.keys()):
                self._hits[k] = [t for t in self._hits[k] if now - t < 3600]
                if not self._hits[k]:
                    del self._hits[k]
            self._last_cleanup = now

    def check(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int, int]:
        """Vérifie si la requête est autorisée.

        Retourne: (is_allowed, remaining, retry_after)
        """
        now = time.time()
        with self._lock:
            self._cleanup(now)
            timestamps = [t for t in self._hits[key] if now - t < window_seconds]
            self._hits[key] = timestamps

            if len(timestamps) >= max_requests:
                oldest = timestamps[0]
                retry_after = max(1, int(window_seconds - (now - oldest)))
                return False, 0, retry_after

            self._hits[key].append(now)
            remaining = max_requests - len(self._hits[key])
            return True, remaining, 0

    def reset(self) -> None:
        """Réinitialise les compteurs (utile pour les tests unitaires)."""
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


def rate_limit(max_requests: int, window_seconds: int = 60, key_prefix: str = "rl"):
    """Dépendance FastAPI pour appliquer une limite de débit."""

    def dependency(request: Request):
        # Récupération de l'adresse IP (supporte X-Forwarded-For pour proxy Render)
        forwarded = request.headers.get("x-forwarded-for")
        ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "127.0.0.1")
        key = f"{key_prefix}:{request.url.path}:{ip}"

        allowed, remaining, retry_after = limiter.check(key, max_requests, window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Trop de requêtes. Veuillez patienter {retry_after} seconde(s) avant de réessayer.",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                },
            )

    return dependency
