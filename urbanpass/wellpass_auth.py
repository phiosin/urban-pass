"""Wellpass app login (Netpulse -> Firebase) and class schedule.

Login chain, as used by the Wellpass iOS app:
  1. Netpulse login (email + password)       -> JSESSIONID cookie + exerciser uuid
  2. Netpulse SSO for EGYM                   -> Firebase custom token
  3. Firebase signInWithCustomToken          -> ID token (1 h) + refresh token (long-lived)
Only the refresh token is stored (in .secrets/wellpass.json, git-ignored).
"""
import http.cookiejar
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

NETPULSE = "https://qualitrain.netpulse.com"
MWA = "https://mwa-api.int.api.egym.com/mwa/api"
ENV_JS = "https://locations.egym.com/resources/js/env.js"
SECRETS = Path(__file__).resolve().parent.parent / ".secrets" / "wellpass.json"
APP_UA = "Wellpass/3080 CFNetwork/3860.600.12 Darwin/25.5.0"
NP_UA = "QualitrainContainer/6.6.1 (com.qualitrain.fitness; build:3080; iOS 26.5.2) Alamofire/5.9.1"


class AuthError(Exception):
    pass


_key = {}


def firebase_key():
    """EGYM's public Firebase web key, read from their gym finder at runtime (kept out of this repo)."""
    if "v" not in _key:
        req = urllib.request.Request(ENV_JS, headers={"User-Agent": APP_UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            js = r.read().decode()
        m = re.search(r'firebaseOptions:\s*\{[^}]*?apiKey:\s*"([^"]+)"', js, re.S)
        if not m:
            raise AuthError("Couldn't find EGYM's Firebase key in env.js.")
        _key["v"] = m.group(1)
    return _key["v"]


def _post_json(url, payload, headers=None):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def _post_form(url, fields, opener=urllib.request.urlopen, headers=None):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode(), method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded", **(headers or {})})
    with opener(req, timeout=30) as r:
        return json.loads(r.read() or b"{}")


def login(email, password):
    """Full login; saves the Firebase refresh token. Run by the user, never stored: the password."""
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)).open
    try:
        me = _post_form(f"{NETPULSE}/np/exerciser/login", {"username": email, "password": password, "relogin": "false"},
                        opener, {"User-Agent": NP_UA, "Accept": "application/json"})
    except urllib.error.HTTPError as e:
        raise AuthError(f"Wellpass login failed (HTTP {e.code}). Check email/password.") from None
    uuid = me.get("uuid") or me.get("exerciserUuid") or me.get("id")
    if not uuid:
        raise AuthError(f"Logged in, but no account id in the response (fields: {sorted(me)}).")

    req = urllib.request.Request(f"{NETPULSE}/np/exerciser/{uuid}/externalAccount/egym/qltLocations/sso",
                                 headers={"User-Agent": NP_UA, "Accept": "application/json"})
    with opener(req, timeout=30) as r:
        sso = json.loads(r.read())
    m = re.search(r"[?&]code=([^&]+)", sso.get("url", ""))
    if not m:
        raise AuthError(f"No EGYM token in the SSO response (fields: {sorted(sso)}).")

    fb = _post_json(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={firebase_key()}",
                    {"token": urllib.parse.unquote(m.group(1)), "returnSecureToken": True})
    SECRETS.parent.mkdir(exist_ok=True)
    SECRETS.write_text(json.dumps({"refresh_token": fb["refreshToken"]}), encoding="utf-8")
    return True


_cache = {"token": None, "exp": 0}


def id_token():
    """A fresh 1-hour ID token from the stored refresh token."""
    if _cache["token"] and time.time() < _cache["exp"] - 120:
        return _cache["token"]
    if not SECRETS.exists():
        raise AuthError("Not logged in. Run: python -m urbanpass.login")
    refresh = json.loads(SECRETS.read_text(encoding="utf-8"))["refresh_token"]
    try:
        r = _post_form(f"https://securetoken.googleapis.com/v1/token?key={firebase_key()}",
                       {"grant_type": "refresh_token", "refresh_token": refresh})
    except urllib.error.HTTPError as e:
        raise AuthError(f"Token refresh failed (HTTP {e.code}). Run the login again.") from None
    if r.get("refresh_token") and r["refresh_token"] != refresh:
        SECRETS.write_text(json.dumps({"refresh_token": r["refresh_token"]}), encoding="utf-8")
    _cache.update(token=r["id_token"], exp=time.time() + int(r.get("expires_in", 3600)))
    return _cache["token"]


def logged_in():
    return SECRETS.exists()


def class_sessions(gym_id, start_utc, end_utc):
    """Wellpass classes at one studio between two UTC datetimes (ISO strings ending in Z)."""
    q = urllib.parse.urlencode({"gymId": gym_id, "from": start_utc, "to": end_utc, "status": "ACTIVE"})
    req = urllib.request.Request(f"{MWA}/class-booking/v1/class-session?{q}",
                                 headers={"Authorization": f"Bearer {id_token()}", "Accept": "application/json",
                                          "User-Agent": APP_UA, "Accept-Language": "de-DE"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read() or b"[]")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise AuthError(f"Wellpass refused the token (HTTP {e.code}).") from None
            if e.code == 404:
                return []
            if attempt == 2:
                raise
            time.sleep(3 * (attempt + 1))
