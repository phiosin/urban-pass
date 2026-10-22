"""Shared studio features and single-platform place records for the app."""
import re
import unicodedata


COURT_RE = re.compile(
    r"\b(?:padel|tennis|squash|badminton|racquetball|pickle\s?ball|table[_ -]?tennis|"
    r"ping[_ -]?pong|volleyball|basketball|futsal|football)\b", re.I)
DISCOUNT_RE = re.compile(
    r"(?:\b\d{1,3}\s?%|\b\d+\s?prozent\b|\b\d\s?/\s?\d\b|"
    r"\b(?:rabatt\w*|ermaessig\w*|ermassig\w*|haelfte|halfte|anteilig\w*|zuschuss\w*|"
    r"aufpreis\w*|zuzahlung\w*|eigenanteil\w*|preisnachlass\w*)\b)", re.I)


def _fold(value):
    value = (value or "").lower().replace("ß", "ss")
    value = value.replace("\u00c3\u00a4", "ae").replace("\u00c3\u00b6", "oe").replace("\u00c3\u00bc", "ue")
    value = value.replace("\u00df", "ss").replace("\u00e4", "ae").replace("\u00f6", "oe").replace("\u00fc", "ue")
    return "".join(c for c in unicodedata.normalize("NFKD", value)
                   if not unicodedata.combining(c))


def is_court(activities, name="", terms=""):
    """Whether listed activities or venue details identify a rentable sport court."""
    text = " ".join(str(x or "") for x in (activities or [])) + " " + name + " " + terms
    return bool(COURT_RE.search(_fold(text)))


def discount_text(terms):
    """Return the short terms line that describes a partial offer or extra charge."""
    if not terms:
        return ""
    for line in re.split(r"[\n\r]+", terms):
        line = re.sub(r"\s+", " ", line).strip(" \t:;-.")
        if DISCOUNT_RE.search(_fold(line)):
            line = re.sub(r"^(?:inklusivleistungen|zuzahlungen|zus[aä]tzliche kosten)\s*:\s*", "", line, flags=re.I)
            return line[:180]
    return ""


def studio_features(usc_venue, wp_studio):
    summary = discount_text(wp_studio.get("terms", ""))
    court = is_court(usc_venue.get("disciplines"), usc_venue.get("name", "")) or \
            is_court(wp_studio.get("activities"), wp_studio.get("name", ""), wp_studio.get("terms", ""))
    booking = wp_studio.get("external_booking") or (wp_studio.get("website") if court else "") or ""
    return {
        "plus1": bool(wp_studio.get("plus1")),
        "discount": bool(summary),
        "discount_text": summary,
        "external_booking": bool(booking),
        "booking": booking,
        "court": court,
    }


def _wp_place(wp, identifier, platforms):
    summary = discount_text(wp.get("terms", ""))
    booking = wp.get("external_booking") or wp.get("website") or ""
    return {
        "id": identifier, "name": wp.get("name") or wp.get("slug", ""), "wp_name": wp.get("name", ""),
        "street": wp.get("street", ""), "district": "", "lat": wp.get("lat"), "lng": wp.get("lng"),
        "activities": wp.get("activities") or [], "platforms": platforms, "plans": [],
        "plus1": bool(wp.get("plus1")), "discount": bool(summary), "discount_text": summary,
        "external_booking": bool(booking), "booking": booking, "website": wp.get("website", ""),
        "wp_url": wp.get("url", ""), "usc_url": "", "terms": (wp.get("terms") or "")[:800],
        "court": is_court(wp.get("activities"), wp.get("name", ""), wp.get("terms", "")),
    }


def build_courts(usc_venues, wp_studios, pairs, usc_locations=None):
    """Make one record per shared court plus court venues listed by only one platform."""
    usc_courts = {u["slug"]: u for u in usc_venues
                  if is_court(u.get("disciplines"), u.get("name", ""))}
    wp_courts = {w["slug"]: w for w in wp_studios
                 if is_court(w.get("activities"), w.get("name", ""), w.get("terms", ""))}
    shared = {}
    for pair in pairs:
        u, w = pair["usc"], pair["wellpass"]
        if u.get("slug") not in usc_courts or w.get("slug") not in wp_courts:
            continue
        prior = shared.get(w["slug"])
        if prior is None or pair["score"] > prior["score"]:
            shared[w["slug"]] = pair

    records = []
    used_usc, used_wp = set(), set()
    for slug, pair in shared.items():
        u, w = pair["usc"], pair["wellpass"]
        base = _wp_place(w, "shared:" + slug, ["USC", "Wellpass"])
        base.update({"name": u.get("name") or w.get("name", ""), "usc_name": u.get("name", ""),
                     "district": u.get("district", ""), "activities": list(dict.fromkeys(
                         (u.get("disciplines") or []) + (w.get("activities") or []))),
                     "plans": u.get("plans") or [], "usc_url": "https://urbansportsclub.com/de/venues/" + u["slug"]})
        records.append(base)
        used_usc.add(u["slug"])
        used_wp.add(slug)

    for slug, wp in wp_courts.items():
        if slug not in used_wp:
            records.append(_wp_place(wp, "wellpass:" + slug, ["Wellpass"]))
    for slug, u in usc_courts.items():
        if slug in used_usc:
            continue
        records.append({
            "id": "usc:" + slug, "name": u.get("name", ""), "wp_name": "", "usc_name": u.get("name", ""),
            "street": u.get("street", ""), "district": u.get("district", ""), "lat": (usc_locations or {}).get(u.get("slug"), (None, None))[0],
            "lng": (usc_locations or {}).get(u.get("slug"), (None, None))[1],
            "activities": u.get("disciplines") or [], "platforms": ["USC"], "plans": u.get("plans") or [],
            "plus1": False, "discount": False, "discount_text": "", "external_booking": False,
            "booking": "", "website": "", "wp_url": "", "usc_url": "https://urbansportsclub.com/de/venues/" + slug,
            "terms": "", "court": True,
        })
    return sorted(records, key=lambda x: x["name"].casefold())


def build_plus1_places(wp_studios, pairs):
    """Wellpass Plus1 studios that have no matched USC listing."""
    matched = {p["wellpass"].get("slug") for p in pairs}
    return sorted([
        _wp_place(w, "wellpass:" + w["slug"], ["Wellpass"])
        for w in wp_studios if w.get("plus1") and w.get("slug") not in matched
    ], key=lambda x: x["name"].casefold())
