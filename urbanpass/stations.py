"""Berlin U-Bahn and S-Bahn stations from OpenStreetMap (Overpass API), and nearest-station lookup."""
import math
import urllib.parse

from .http import get_json

OVERPASS = "https://overpass-api.de/api/interpreter"
QUERY = """
[out:json][timeout:90];
area["name"="Berlin"]["boundary"="administrative"]["admin_level"="4"]->.b;
(
  node["railway"="station"](area.b);
  node["public_transport"="station"]["subway"="yes"](area.b);
  node["public_transport"="station"]["light_rail"="yes"](area.b);
);
out body;
"""


def _kind(tags):
    kinds = []
    if tags.get("station") == "subway" or tags.get("subway") == "yes":
        kinds.append("U")
    if tags.get("station") == "light_rail" or tags.get("light_rail") == "yes":
        kinds.append("S")
    return kinds


def _dist(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def berlin():
    """[{'n': name, 't': 'U'|'S', 'lat', 'lng'}] with one entry per station name and type."""
    data = get_json(f"{OVERPASS}?data={urllib.parse.quote(QUERY)}",
                    {"User-Agent": "urban-pass/0.3 (+https://github.com/phiosin/urban-pass)", "Accept": "application/json"},
                    max_age=30 * 24 * 3600) or {}
    out = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name", "")
        name = name.replace("S+U ", "").replace("U ", "", 1) if name.startswith(("S+U ", "U ")) else name
        name = name[2:] if name.startswith("S ") else name
        for k in _kind(tags):
            if not name:
                continue
            # merge duplicates (several nodes for one station)
            if any(s["t"] == k and s["n"] == name and _dist(s["lat"], s["lng"], el["lat"], el["lon"]) < 400 for s in out):
                continue
            out.append({"n": name, "t": k, "lat": round(el["lat"], 6), "lng": round(el["lon"], 6)})
    return out


def nearest(lat, lng, stations, limit=2, max_m=1500):
    """Closest stations of distinct names: [{'n','t','m'}], 't' like 'U' / 'S' / 'S+U'."""
    if lat is None or lng is None:
        return []
    by_name = {}
    for s in stations:
        d = _dist(lat, lng, s["lat"], s["lng"])
        if d > max_m:
            continue
        cur = by_name.get(s["n"])
        if cur is None:
            by_name[s["n"]] = {"n": s["n"], "t": s["t"], "m": d}
        else:
            if s["t"] not in cur["t"]:
                cur["t"] = "S+U" if {cur["t"], s["t"]} == {"S", "U"} else cur["t"]
            cur["m"] = min(cur["m"], d)
    best = sorted(by_name.values(), key=lambda x: x["m"])[:limit]
    return [{"n": b["n"], "t": b["t"], "m": int(round(b["m"] / 10.0) * 10)} for b in best]
