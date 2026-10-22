"""Build a small catalog from existing HTTP cache files without any requests."""
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from urbanpass import catalog, usc, wellpass, match
from urbanpass.__main__ import studio_record

CACHE = ROOT / "data" / "raw"


def cached_json(url, headers=None, max_age=None):
    path = CACHE / (hashlib.sha1(url.encode("utf-8")).hexdigest() + ".txt")
    if not path.is_file():
        raise RuntimeError("Missing cached response for " + url)
    body = path.read_text(encoding="utf-8")
    return json.loads(body) if body else None


def main():
    # Replace both network helper references so a missing cache file fails locally.
    usc.get_json = cached_json
    wellpass.get_json = cached_json
    venues = usc.venues()
    wp_studios = wellpass.berlin()
    pairs = match.match_studios(venues, wp_studios)
    courts = catalog.build_courts(venues, wp_studios, pairs)
    plus1_places = catalog.build_plus1_places(wp_studios, pairs)

    best = {}
    for pair in pairs:
        slug = pair["usc"]["slug"]
        prior = best.get(slug)
        if prior is None or pair["score"] > prior["score"]:
            best[slug] = pair
    studios = {slug: studio_record(pair) for slug, pair in best.items()}

    plus1_count = sum(bool(w.get("plus1")) for w in wp_studios)
    discount_count = sum(bool(catalog.discount_text(w.get("terms", ""))) for w in wp_studios)
    both_count = sum("USC" in c["platforms"] and "Wellpass" in c["platforms"] for c in courts)
    usc_count = sum("USC" in c["platforms"] for c in courts)
    wp_count = sum("Wellpass" in c["platforms"] for c in courts)
    usc_only = sum(c["platforms"] == ["USC"] for c in courts)
    wp_only = sum(c["platforms"] == ["Wellpass"] for c in courts)
    disagreements = sum(bool(w.get("plus1_membership")) != bool(w.get("plus1_gym")) for w in wp_studios)
    for sample in ("50 % Rabatt", "Ermäßigung 10 %", "Hälfte des Preises", "Zuschuss zur Miete", "Aufpreis 5 EUR"):
        if not catalog.discount_text(sample):
            raise AssertionError("Discount wording was not detected: " + sample)
    print("Berlin catalog from cache:")
    print("  USC venues: {} | Wellpass studios: {} | matched pairs: {}".format(len(venues), len(wp_studios), len(pairs)))
    print("  Plus1 Wellpass studios: {} ({} unmatched to USC)".format(plus1_count, len(plus1_places)))
    print("  Shared studio records: {} ({} Plus1, {} discount, {} courts)".format(
        len(studios), sum(bool(s["plus1"]) for s in studios.values()),
        sum(bool(s["discount"]) for s in studios.values()), sum(bool(s["court"]) for s in studios.values())))
    print("  Plus1 source flags: PLUS_1 membership {} | qualitrainPlusOneGym true {} | disagreements {}".format(
        sum(bool(w.get("plus1_membership")) for w in wp_studios),
        sum(bool(w.get("plus1_gym")) for w in wp_studios),
        disagreements))
    print("  Wellpass discount studios: {}".format(discount_count))
    print("  Court venues: {} total | shared: {} | USC-only: {} | Wellpass-only: {} | on USC: {} | on Wellpass: {}".format(
        len(courts), both_count, usc_only, wp_only, usc_count, wp_count))

    padel = next((c for c in courts if "padelcity" in c["id"].lower() or "padelcity" in c["name"].lower()), None)
    if padel is None:
        wp = next((w for w in wp_studios if w.get("slug") == "berlin-padelcity"), None)
        padel = catalog._wp_place(wp, "wellpass:berlin-padelcity", ["Wellpass"]) if wp else None
    if disagreements:
        raise AssertionError("Plus1 detail fields disagree in {} records".format(disagreements))
    if not padel or not padel["plus1"] or not padel["discount"] or not padel["external_booking"]:
        raise AssertionError("Padel City is missing an expected Plus1, discount, or booking field")
    if not padel["booking"].startswith("https://") or "1/4" not in padel["discount_text"]:
        raise AssertionError("Padel City booking link or short terms did not match cached details")
    print("  Padel City:")
    print(json.dumps(padel, ensure_ascii=False, sort_keys=True) if padel else "    not found")


if __name__ == "__main__":
    main()
