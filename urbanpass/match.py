"""Match USC venues to Wellpass studios, then attach the day's USC classes."""
import re
import time
import unicodedata

STOP = {"berlin", "studio", "studios", "gmbh", "the", "by", "und", "and", "in", "am", "im", "an", "der", "die",
        "das", "fitness", "yoga", "club", "e", "v", "ev", "de", "la", "le", "sport", "sports", "center", "zentrum",
        "school", "schule", "gym", "haus", "house", "berlins"}
# Place names say where a studio is, not which studio it is.
STOP |= {"mitte", "kreuzberg", "friedrichshain", "neukoelln", "prenzlauer", "berg", "pberg", "schoeneberg",
         "charlottenburg", "wilmersdorf", "wedding", "moabit", "pankow", "tempelhof", "steglitz", "zehlendorf",
         "spandau", "lichtenberg", "treptow", "koepenick", "reinickendorf", "marzahn", "hellersdorf", "tiergarten",
         "weissensee", "friedenau", "alexanderplatz", "alex", "potsdamer", "platz", "funkhaus", "kiez", "west",
         "ost", "nord", "sued", "east", "north", "south", "city", "bergmannkiez", "kollwitzkiez", "plaenterwald",
         "oberschoeneweide", "adlershof", "rummelsburg", "ostkreuz", "warschauer", "hackescher", "markt",
         "gesundbrunnen", "kudamm", "zoo", "str", "strasse", "allee", "damm", "ufer"}


def _ascii(s):
    s = (s or "").lower().replace("ß", "ss").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def street_key(street):
    """'Glogauer Straße 19' -> 'glogauerstr19'; returns '' without a house number."""
    s = re.sub(r"strasse|str\.", "str", _ascii(street))
    s = re.sub(r"[^a-z0-9]", "", s)
    m = re.match(r"([a-z]+?)(\d+)", s)
    return m.group(1) + m.group(2) if m else ""


def tokens(name):
    return {t for t in re.split(r"[^a-z0-9]+", _ascii(name)) if len(t) > 1 and t not in STOP}


def compact(name):
    return re.sub(r"[^a-z0-9]", "", _ascii(name))


def name_score(a, b):
    """0..1 similarity of two studio names."""
    ta, tb = tokens(a), tokens(b)
    if ta and tb:
        j = len(ta & tb) / min(len(ta), len(tb))
    else:
        j = 0.0
    ca, cb = compact(a), compact(b)
    if len(ca) >= 5 and len(cb) >= 5 and (ca in cb or cb in ca):
        j = max(j, 1.0)
    # USC sometimes runs words together ("GETIMPULSE") - compare against compacted tokens too
    ca2, cb2 = "".join(sorted(ta)), "".join(sorted(tb))
    if ca2 and ca2 == cb2:
        j = 1.0
    return j


def match_studios(usc_venues, wp_studios, min_score=0.5):
    by_key = {}
    for w in wp_studios:
        k = street_key(w["street"])
        if k:
            by_key.setdefault(k, []).append(w)
    pairs = []
    for u in usc_venues:
        for w in by_key.get(street_key(u["street"]), []):
            s = name_score(u["name"], w["name"])
            if s >= min_score:
                pairs.append({"usc": u, "wellpass": w, "score": round(s, 2)})
    return pairs


ACTIVITY_WORDS = {
    "pilates": ["PILATES"], "reformer": ["PILATES"], "yoga": ["YOGA"], "barre": ["BARRE"], "boxing": ["BOX", "MARTIAL"],
    "boxen": ["BOX", "MARTIAL"], "kickbox": ["BOX", "MARTIAL"], "dance": ["DANCE"], "tanz": ["DANCE"],
    "spinning": ["CYCLING", "SPINNING", "INDOOR"], "cycling": ["CYCLING", "SPINNING", "INDOOR"],
    "crossfit": ["CROSS"], "hiit": ["CROSS", "CIRCUIT", "HIIT", "FUNCTIONAL"], "functional": ["FUNCTIONAL", "CROSS"],
    "climbing": ["CLIMB", "BOULDER"], "bouldern": ["CLIMB", "BOULDER"], "bouldering": ["CLIMB", "BOULDER"],
    "swim": ["SWIM"], "schwimmen": ["SWIM"], "sauna": ["SAUNA", "WELLNESS"], "meditation": ["MEDITATION", "RELAX"],
    "martial": ["MARTIAL"], "kampfsport": ["MARTIAL"], "aerial": ["AERIAL", "POLE"], "pole": ["POLE", "AERIAL"],
    "running": ["RUNNING", "OUTDOOR"], "lauf": ["RUNNING", "OUTDOOR"], "kraft": ["STRENGTH", "MUSCULATION"],
    "strength": ["STRENGTH", "MUSCULATION"], "massage": ["MASSAGE"], "stretching": ["MOBILITY", "STRETCH"],
    "mobility": ["MOBILITY", "STRETCH"], "hyrox": ["CROSS", "FUNCTIONAL", "CIRCUIT"],
}


def activity_listed(category, title, wp_activities):
    """Does the Wellpass studio list an activity that fits this USC class? True/False/None (unknown)."""
    words = re.split(r"[^a-z]+", _ascii(f"{category} {title}"))
    wanted = {code for w in words for key, codes in ACTIVITY_WORDS.items() if w.startswith(key) for code in codes}
    if not wanted or not wp_activities:
        return None
    acts = " ".join(a or "" for a in wp_activities).upper()
    return any(code in acts for code in wanted)


def wellpass_status(w):
    """How classes at this studio work for Wellpass members."""
    terms = (w.get("terms") or "").lower()
    if w["in_app_booking"]:
        return "app", "Book in Wellpass app"
    if w.get("external_booking"):
        return "external", "Book via studio link"
    if re.search(r"keine kurse|ohne kurse|nur (ger(ae|ä)te|freies) training|no classes", terms):
        return "no_classes", "No classes on Wellpass"
    return "checkin", "Check in on site"


def _berlin_offset(date):
    """UTC offset in hours for Berlin on date (CEST from the last Sunday of March to the last Sunday of October)."""
    import datetime as dt
    d = dt.date.fromisoformat(date)

    def last_sunday(month):
        last = dt.date(d.year, month, 31)
        return last - dt.timedelta(days=(last.weekday() + 1) % 7)
    return 2 if last_sunday(3) <= d < last_sunday(10) else 1


def _local(iso_utc):
    """'2026-10-23T15:15:00Z' -> ('2026-10-23', '17:15') in Berlin time."""
    import datetime as dt
    t = dt.datetime.fromisoformat(iso_utc.replace("Z", "+00:00")).replace(tzinfo=None)
    t += dt.timedelta(hours=_berlin_offset(t.date().isoformat()))
    return t.date().isoformat(), t.strftime("%H:%M")


def _minutes(hhmm):
    return int(hhmm[:2]) * 60 + int(hhmm[3:5])


def wellpass_sessions(gym_ids, first_date, days, fetch, log=print):
    """Wellpass app classes for each studio over a date range: {gym_id: {date: [session, ...]}}.

    fetch(gym_id, from_utc, to_utc) -> list of raw Wellpass class sessions.
    """
    import datetime as dt
    d0 = dt.date.fromisoformat(first_date)
    start = dt.datetime.combine(d0, dt.time()) - dt.timedelta(hours=_berlin_offset(first_date))
    last = d0 + dt.timedelta(days=days)
    end = dt.datetime.combine(last, dt.time()) - dt.timedelta(hours=_berlin_offset(last.isoformat()), seconds=1)
    fmt = "%Y-%m-%dT%H:%M:%S.000Z"
    log(f"Wellpass schedules for {len(gym_ids)} studios ...")
    out = {}
    for g in sorted(gym_ids):
        by_day = out.setdefault(g, {})
        for s in fetch(g, start.strftime(fmt), end.strftime(fmt)) or []:
            day, t0 = _local(s["startDateTime"])
            by_day.setdefault(day, []).append({
                "start": t0, "end": _local(s["endDateTime"])[1], "name": s.get("name", ""),
                "spots": (s["capacity"] - s["booked"]) if s.get("capacity") else None})
        time.sleep(0.5)
    return out


def confirm(joint, date, sessions):
    """Mark each class confirmed=True/False against Wellpass sessions of that day (None = not checked)."""
    n = 0
    for c in joint:
        w = c["wellpass"]
        if w["status"] != "app" or w.get("gym_id") not in sessions:
            continue
        todays = sessions[w["gym_id"]].get(date, [])
        # same start time (±5 min) and a similar name; the best name match wins when rooms overlap
        hits = [s for s in todays if abs(_minutes(s["start"]) - _minutes(c["start"])) <= 5
                and name_score(s["name"], c["title"]) > 0]
        hits.sort(key=lambda s: -name_score(s["name"], c["title"]))
        w["confirmed"] = bool(hits)
        if hits:
            w["wp_class"] = hits[0]
            n += 1
    return n


def joint_classes(classes, pairs):
    by_slug = {}
    for p in pairs:
        cur = by_slug.get(p["usc"]["slug"])
        if not cur or p["score"] > cur["score"]:
            by_slug[p["usc"]["slug"]] = p
    out = []
    for c in classes:
        p = by_slug.get(c["venue_slug"])
        if not p:
            continue
        w = p["wellpass"]
        code, label = wellpass_status(w)
        if code == "no_classes":
            continue
        out.append({
            **c,
            "wellpass": {
                "name": w["name"], "url": w["url"], "status": code, "status_label": label,
                "gym_id": w.get("gym_id"), "confirmed": None,
                "booking_link": w.get("external_booking") or "", "terms": w.get("terms", "")[:600],
                "activity_listed": activity_listed(c["category"], c["title"], w.get("activities")),
                "street": w["street"], "lat": w.get("lat"), "lng": w.get("lng"),
            },
            "match_score": p["score"],
        })
    return out
