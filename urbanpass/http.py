"""Small polite HTTP helper with an on-disk cache."""
import hashlib
import json
import time
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
CACHE = Path(__file__).resolve().parent.parent / "data" / "raw"
DELAY = 0.8  # seconds between live requests

_last = 0.0


def get(url, headers=None, max_age=None):
    """GET url and return the body as text. Cached on disk; max_age in seconds (None = forever)."""
    global _last
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".txt")
    if path.exists() and (max_age is None or time.time() - path.stat().st_mtime < max_age):
        return path.read_text(encoding="utf-8")
    wait = DELAY - (time.time() - _last)
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read().decode("utf-8")
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                body = ""
                break
            if attempt == 2:
                raise
            time.sleep(3 * (attempt + 1))
    _last = time.time()
    path.write_text(body, encoding="utf-8")
    return body


def get_json(url, headers=None, max_age=None):
    body = get(url, headers, max_age)
    return json.loads(body) if body else None
