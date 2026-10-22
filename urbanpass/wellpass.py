"""EGYM Wellpass: public gym finder API (studios only; the class schedule is app-only)."""
import html
import re
import urllib.parse

from .http import get_json

API = "https://gymfinder.int.api.egym.com"
HEAD = {"Origin": "https://locations.egym.com"}
DAY = 24 * 3600
BERLIN_BOX = (52.33, 52.68, 13.08, 13.77)  # lat min/max, lng min/max


def _strip(s):
    s = re.sub(r"<br\s*/?>|</p>|</li>", "\n", s or "")
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    return re.sub(r"\n\s*\n+", "\n", s).strip()


def studios(box=BERLIN_BOX):
    data = get_json(f"{API}/v1/gym/overview?searchFilter=wellpass&limit=20000", HEAD, 7 * DAY)
    la0, la1, lo0, lo1 = box
    return [g for g in data["gyms"] if la0 < g["lat"] < la1 and lo0 < g["lng"] < lo1]


def detail(slug):
    d = get_json(f"{API}/v1/gym?slug={urllib.parse.quote(slug)}", HEAD, 7 * DAY)
    if isinstance(d, list):
        d = d[0] if d else None
    if not d:
        return None
    a = d.get("address") or {}
    cb = d.get("classBookingConfig") or {}
    ext = d.get("externalBookingInfo") or {}
    ext_channel = ext.get("channel") or {}
    memberships = d.get("membershipTypes") or []
    return {
        "slug": d["slug"],
        "name": d.get("alias", ""),
        "street": f"{a.get('street', '')} {a.get('streetNumber', '') or ''}".strip(),
        "zip": a.get("zipCode", ""),
        "lat": (a.get("coordinates") or [None, None])[1],
        "lng": (a.get("coordinates") or [None, None])[0],
        "website": d.get("website") or "",
        "plus1": "PLUS_1" in memberships or d.get("qualitrainPlusOneGym") is True,
        "plus1_membership": "PLUS_1" in memberships,
        "plus1_gym": d.get("qualitrainPlusOneGym") is True,
        "activities": [x.get("activity") or x.get("name") for x in d.get("activities") or [] if isinstance(x, dict)],
        "in_app_booking": bool(cb.get("enabled")),
        "booking_required": bool(cb.get("bookingRequiredForCheckin")),
        "external_booking": ext.get("link") or ext_channel.get("link") or "",
        "terms": _strip(d.get("qualitrainOfferDescription")),
        "url": f"https://locations.egym.com/embed/web/wellpass/{d['slug']}",
    }


def berlin():
    out = []
    for g in studios():
        d = detail(g["slug"])
        if d:
            d["gym_id"] = g.get("g") or g["id"]  # gymUUID: the id the class schedule uses
            d["activities"] = d["activities"] or [a["a"] for a in g.get("ac", [])]
            out.append(d)
    return out
