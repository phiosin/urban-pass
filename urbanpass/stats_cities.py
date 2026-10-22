"""Overlap statistics for Germany's three biggest cities.

Usage: python -m urbanpass.stats_cities [--days 3]
Writes wordpress/urban-pass/data/stats.json:
  per city: studios on USC, on Wellpass, on both; USC classes in the next N days and how many are also
  on the Wellpass schedule (same studio, start time and name).
"""
import argparse
import datetime as dt
import json
from pathlib import Path

from . import match, usc, wellpass, wellpass_auth

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "wordpress" / "urban-pass" / "data" / "stats.json"

# name, USC city id, Wellpass lat/lng box (lat min, lat max, lng min, lng max)
CITIES = [
    ("Berlin", 1, (52.33, 52.68, 13.08, 13.77)),
    ("Hamburg", 3, (53.39, 53.75, 9.73, 10.33)),
    ("München", 2, (48.06, 48.25, 11.36, 11.73)),
]


def city_stats(name, city_id, box, dates):
    print(f"== {name}", flush=True)
    usc.use_city(city_id)
    venues = usc.venues(city_id)
    wp = wellpass.in_box(box)
    pairs = match.match_studios(venues, wp)
    shared_wp = {p["wellpass"]["slug"] for p in pairs}
    print(f"  USC venues {len(venues)} · Wellpass studios {len(wp)} · on both {len(shared_wp)}", flush=True)

    sessions = {}
    if wellpass_auth.logged_in():
        gyms = set()
        for p in pairs:
            code, _ = match.wellpass_status(p["wellpass"])
            if code == "app" and p["wellpass"].get("gym_id"):
                gyms.add(p["wellpass"]["gym_id"])
        sessions = match.wellpass_sessions(gyms, dates[0], len(dates), wellpass_auth.class_sessions)

    usc_total = both = 0
    for date in dates:
        usc.use_city(city_id)  # keep the session on this city
        classes = usc.classes(date, city_id)
        joint = match.joint_classes(classes, pairs)
        n = match.confirm(joint, date, sessions) if sessions else 0
        usc_total += len(classes)
        both += n
        print(f"  {date}: {len(classes)} USC classes, {n} on both", flush=True)

    return {
        "city": name, "usc_venues": len(venues), "wp_studios": len(wp), "shared_studios": len(shared_wp),
        "usc_classes": usc_total, "both_classes": both,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=3)
    args = ap.parse_args()
    today = dt.date.today()
    # start tomorrow so a half-finished today doesn't skew the numbers
    dates = [(today + dt.timedelta(days=i)).isoformat() for i in range(1, args.days + 1)]
    cities = [city_stats(n, c, b, dates) for n, c, b in CITIES]
    usc.use_city(1)
    total = {k: sum(c[k] for c in cities) for k in ("usc_venues", "wp_studios", "shared_studios", "usc_classes", "both_classes")}
    out = {"generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "dates": dates,
           "cities": cities, "total": total}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(total))


if __name__ == "__main__":
    main()
