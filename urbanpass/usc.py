"""Urban Sports Club: public venue list and class schedule (no login needed)."""
import html
import json
import re

from .http import get_json

BASE = "https://urbansportsclub.com/de"
AJAX = {"X-Requested-With": "XMLHttpRequest"}
BERLIN = 1
DAY = 24 * 3600


def _pages(url, max_age):
    page = 1
    while True:
        data = get_json(f"{url}&page={page}", AJAX, max_age)
        if not data or not data.get("success"):
            break
        yield data["data"]["content"]
        if not data["data"].get("showMore"):
            break
        page += 1


def _text(pattern, block):
    m = re.search(pattern, block, re.S)
    return html.unescape(re.sub(r"\s+", " ", m.group(1))).strip() if m else ""


def venues(city_id=BERLIN):
    out = {}
    for content in _pages(f"{BASE}/venues?city_id={city_id}", 7 * DAY):
        for block in content.split('class="smm-studio-snippet b-studio-item"')[1:]:
            slug = _text(r'href="/de/venues/([^"]+)"', block)
            out[slug] = {
                "slug": slug,
                "address_id": _text(r'data-address-id="(\d+)"', block),
                "name": _text(r'smm-studio-snippet__studio-link[^>]*>(.*?)</a>', block),
                "district": _text(r'smm-studio-snippet__address">\s*([^,<]+),', block),
                "street": _text(r'address-street">(.*?)</span>', block),
                "disciplines": [d.strip() for d in _text(r'class="disciplines">(.*?)</div>', block).split("·") if d.strip()],
                "plans": re.findall(r'studio-plan" data-type="\d+">\s*(\w+)', block),
            }
    return list(out.values())


def classes(date, city_id=BERLIN):
    """All classes in the city on date (YYYY-MM-DD)."""
    out = {}
    for content in _pages(f"{BASE}/activities?city_id={city_id}&date={date}", 6 * 3600):
        for block in content.split('class="smm-class-snippet  row"')[1:]:
            appt = _text(r'data-appointment-id="(\d+)"', block)
            layer = re.search(r'data-datalayer="([^"]+)"', block)
            info = json.loads(html.unescape(layer.group(1))).get("class", {}) if layer else {}
            times = re.findall(r"\d{2}:\d{2}", _text(r'class-time">(.*?)</p>', block))
            out[appt] = {
                "id": appt,
                "venue_slug": _text(r'href="/de/venues/([^"]+)"', block),
                "venue_name": _text(r'smm-studio-link visible-lg"[^>]*>.*?</i>(.*?)</a>', block),
                "district": _text(r'class="district">(.*?)</span>', block),
                "title": info.get("name") or _text(r'smm-class-link title"[^>]*>(.*?)</a>', block),
                "category": info.get("category", ""),
                "spots_left": info.get("spots_left"),
                "start": times[0] if times else "",
                "end": times[1] if len(times) > 1 else "",
                "plans": re.findall(r'class-plan" data-type="\d+">\s*(\w+)', block),
                "url": f"{BASE}/class-details/{appt}",
                "image": html.unescape(_text(r"background-image: url\('([^']+)'\)", block)),
            }
    return sorted(out.values(), key=lambda c: (c["start"], c["venue_name"]))
