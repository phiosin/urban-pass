"""Build the Urban Pass data.

Usage: python -m urbanpass [--days N] [--start YYYY-MM-DD] [--out DIR]
Defaults: 7 days starting today (Berlin), written to wordpress/urban-pass/data/.
"""
import argparse
import datetime as dt
import json
from pathlib import Path

from . import match, stations, usc, wellpass, wellpass_auth

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "wordpress" / "urban-pass" / "data"


def berlin_today():
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    return (now + dt.timedelta(hours=match._berlin_offset(now.date().isoformat()))).date()


STATIONS = []


def studio_record(p):
    u, w = p["usc"], p["wellpass"]
    code, label = match.wellpass_status(w)
    return {
        "name": u["name"], "wp_name": w["name"], "street": w["street"] or u["street"], "district": u["district"],
        "lat": w.get("lat"), "lng": w.get("lng"), "disciplines": u["disciplines"], "plans": u["plans"],
        "usc_url": f"{usc.BASE}/venues/{u['slug']}", "wp_url": w["url"], "wp_status": code, "wp_label": label,
        "booking": w.get("external_booking") or "", "terms": (w.get("terms") or "")[:800],
        "gym_id": w.get("gym_id"),
        "near": stations.nearest(w.get("lat"), w.get("lng"), STATIONS),
    }


def compact_class(c):
    w = c["wellpass"]
    wc = w.get("wp_class") or {}
    return {
        "id": c["id"], "t": c["title"], "c": c["category"], "s": c["start"], "e": c["end"], "st": c["venue_slug"],
        "pl": c["plans"], "u": c["spots_left"], "img": c.get("image", ""), "ok": w["confirmed"],
        "w": wc.get("spots"), "act": w["activity_listed"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--start", default=None)
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()
    first = dt.date.fromisoformat(args.start) if args.start else berlin_today()
    dates = [(first + dt.timedelta(days=i)).isoformat() for i in range(args.days)]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    print("USC venues ...", flush=True)
    venues = usc.venues()
    print(f"  {len(venues)}\nWellpass studios ...", flush=True)
    wp = wellpass.berlin()
    print(f"  {len(wp)}")
    print("Stations ...", flush=True)
    STATIONS.extend(stations.berlin())
    pairs = match.match_studios(venues, wp)
    best = {}
    for p in pairs:
        if p["usc"]["slug"] not in best or p["score"] > best[p["usc"]["slug"]]["score"]:
            best[p["usc"]["slug"]] = p
    studios = {slug: studio_record(p) for slug, p in best.items()}
    print(f"Shared studios: {len({s['wp_url'] for s in studios.values()})}")

    sessions, checked = {}, False
    if wellpass_auth.logged_in():
        try:
            gyms = {s["gym_id"] for s in studios.values() if s["wp_status"] == "app" and s["gym_id"]}
            sessions = match.wellpass_sessions(gyms, dates[0], len(dates), wellpass_auth.class_sessions)
            checked = True
        except wellpass_auth.AuthError as e:
            print(f"Skipping Wellpass class check: {e}")
    else:
        print("Not logged in to Wellpass - skipping class check.")

    days = []
    used = set()
    for date in dates:
        print(f"{date}: USC classes ...", flush=True)
        joint = match.joint_classes(usc.classes(date), pairs)
        n = match.confirm(joint, date, sessions) if checked else 0
        if checked:
            joint = [c for c in joint if c["wellpass"]["confirmed"] is not False]
        print(f"  {len(joint)} at shared studios, {n} on both schedules")
        used.update(c["venue_slug"] for c in joint)
        (out / f"{date}.json").write_text(json.dumps(
            {"date": date, "classes": [compact_class(c) for c in joint]},
            ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        days.append({"date": date, "classes": len(joint), "confirmed": n})

    for old in out.glob("20??-??-??.json"):
        if old.stem not in dates:
            old.unlink()
    index = {
        "generated": dt.datetime.now(dt.timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%dT%H:%MZ"), "city": "Berlin", "wellpass_checked": checked,
        "days": days, "stations": STATIONS, "studios": {k: {kk: vv for kk, vv in v.items() if kk != "gym_id"}
                                  for k, v in studios.items() if k in used},
    }
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(dates)} days to {out}")


if __name__ == "__main__":
    main()
