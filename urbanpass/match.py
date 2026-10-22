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


def _to_local(iso_utc, offset):
    h, m = int(iso_utc[11:13]), int(iso_utc[14:16])
    total = (h * 60 + m + offset * 60) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def _minutes(hhmm):
    return int(hhmm[:2]) * 60 + int(hhmm[3:5])


def confirm_with_wellpass(joint, date, fetch, log=print):
    """Check each class against the Wellpass app schedule (studios with in-app booking only).

    fetch(gym_id, from_utc, to_utc) -> list of Wellpass class sessions.
    Sets c["wellpass"]["confirmed"] to True (same start time on Wellpass), False, or leaves None (not checked).
    """
    import datetime as dt
    off = _berlin_offset(date)
    day = dt.date.fromisoformat(date)
    start = (dt.datetime.combine(day, dt.time()) - dt.timedelta(hours=off)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    end = (dt.datetime.combine(day + dt.timedelta(days=1), dt.time()) - dt.timedelta(hours=off, seconds=1)).strftime("%Y-%m-%dT%H:%M:%S.999Z")
    gyms = {c["wellpass"]["gym_id"] for c in joint if c["wellpass"]["status"] == "app" and c["wellpass"].get("gym_id")}
    log(f"Wellpass schedules for {len(gyms)} studios ...")
    sessions = {}
    for i, g in enumerate(sorted(gyms)):
        sessions[g] = [{"start": _to_local(s["startDateTime"], off), "end": _to_local(s["endDateTime"], off),
                        "name": s.get("name", ""), "spots": (s["capacity"] - s["booked"]) if s.get("capacity") else None}
                       for s in fetch(g, start, end) or []]
        time.sleep(0.5)
    n = 0
    for c in joint:
        w = c["wellpass"]
        if w.get("gym_id") not in sessions:
            continue
        # same start time (±5 min) and a similar name; the best name match wins when rooms overlap
        hits = [s for s in sessions[w["gym_id"]] if abs(_minutes(s["start"]) - _minutes(c["start"])) <= 5
                and name_score(s["name"], c["title"]) > 0]
        hits.sort(key=lambda s: -name_score(s["name"], c["title"]))
        w["confirmed"] = bool(hits)
        if hits:
            w["wp_class"] = hits[0]
            n += 1
    log(f"Confirmed on both: {n}")
    return sessions


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
