# How Urban Pass finds the overlap

Goal: for Berlin, list the studios (and ideally the classes) that can be booked with **both** an Urban Sports Club (USC) membership and an EGYM Wellpass membership.

## Data sources (researched Oct 2026)

Neither platform has an official public API, but both websites load their data from JSON endpoints that work **without logging in**.

### Urban Sports Club: studios and class schedule are public

| What | Endpoint | Notes |
|---|---|---|
| Studios in Berlin | `GET https://urbansportsclub.com/de/venues?city_id=1&page=N` with header `X-Requested-With: XMLHttpRequest` | Returns `{"success":true,"data":{"showMore":bool,"content":"<html>"}}`. About 32 studios per page, 70 pages, **~2,200 Berlin studios**. Each card has the studio slug, `data-address-id`, name, district, street, disciplines, and the plans that include it (Essential / Classic / Premium / Max). |
| Class schedule | `GET https://urbansportsclub.com/de/activities?city_id=1&date=YYYY-MM-DD&page=N` (same header) | Same envelope. Each class has `data-appointment-id`, `data-address-id` (links to the studio), time, title and included plans. Details: `/de/class-details/{appointmentId}`. |
| Filters | `district`, `category`, `plan_type` query params | District and activity IDs are in the `<select>` options on the venues page. |

### Wellpass: studios are public, the class schedule is not

The gym finder at `egym-wellpass.com/de-de/gym-finder` embeds `https://locations.egym.com/embed/web/wellpass`, which talks to `https://gymfinder.int.api.egym.com`.

| What | Endpoint | Notes |
|---|---|---|
| All studios (worldwide) | `GET /v1/gym/overview?searchFilter=wellpass&limit=20000` | One ~23 MB JSON, **~17,900 studios**. Short keys: `a` = name, `slug`, `lat`/`lng`, `st` = studio type, `ac` = activities, `cbc.e` = in-app class booking enabled. No street address. About **790 are in Berlin** (by bounding box). |
| Studio detail | `GET /v1/gym?slug={slug}` | Returns a one-element array with a full address (`street`, `streetNumber`, `zipCode`), website, opening hours, `classBookingConfig`, and `qualitrainOfferDescription` (the terms text, e.g. "Inklusivleistungen: Kurse" or "nur Gerätetraining"). |
| Class schedule | — | **Only in the Wellpass mobile app**, behind login. The public web finder doesn't show classes. |

## Matching studios

USC and Wellpass use different IDs, so studios are matched by data:

1. **Address** (main signal): normalize the street (lowercase, `ß→ss`, umlauts, `straße/str.→str`, drop punctuation) plus the first house number. Example: `Glogauer Straße 19` → `glogauerstr19`.
2. **Name** (confirms it): at least one shared name word after dropping filler words (`berlin`, `studio`, `yoga`, `fitness`, …), or one name contained in the other once spaces are removed (`GETIMPULSE` ↔ `Get Impulse`).
3. **Website domain** as an extra check when available. (On the USC side it's on the studio detail page.)

Address alone over-matches buildings with many studios (e.g. Funkhaus Nalepastraße 18, Mehringdamm 33), so a match needs address **and** name. A small hand-kept file of confirmed/rejected pairs will cover edge cases.

First full run for Berlin (Oct 2026), comparing 2,218 USC studios with 790 Wellpass studios:
- 973 address matches, of which 573 also share a name word.
- That's **426 Wellpass studios** (about 54%) matching **546 USC studios**. One Wellpass studio can match several USC listings, because USC often lists one studio per activity.
- 142 of those Wellpass studios offer in-app class booking.

These are rough numbers and still include some false matches. The matcher needs tuning before the numbers can be trusted.

## Matching classes

- **Studio level (no login needed):** show studios on both platforms, plus the USC class schedule for those studios and the Wellpass terms text. This already answers "where can we both go?" for gyms, pools and saunas. For classes, it gives a good guess.
- **Class level (needs Wellpass login):** a class is only bookable by both of you if it's in USC's schedule **and** in Wellpass's in-app schedule. Studios often open only some classes to each platform, and that's the gap you keep hitting. Getting Wellpass's schedule means reading the app's API with your account (by recording the app's network traffic once). We can add this later; your USC login isn't needed because the USC schedule is public.

## Plan

1. A crawler (Python) for both platforms → `data/*.json`, run nightly via GitHub Actions. Crawl politely: about 1 request per second, cached.
2. A matcher → `data/overlap.json` with studio pairs and a confidence score.
3. A static web page (GitHub Pages): map and list of shared studios, filters for activity, district and USC plan, and the next USC classes at each studio.
4. Later: Wellpass class schedule via the app API → true class-level overlap.

## Caveats

- These are unofficial endpoints. They can change without notice, and automated access may conflict with the platforms' terms. Keep traffic low and use the data for personal use only.
- USC plan matters: a studio may only be in Premium/Max. Filter by your partner's plan.
- Wellpass terms text can restrict what's included (e.g. "Kurse nur mit Aufpreis"), so show it next to each match.

## Update: Wellpass class schedule (via the app's API)

A one-time recording of the iOS app's traffic showed how the app loads classes:

- **Classes:** `GET https://mwa-api.int.api.egym.com/mwa/api/class-booking/v1/class-session?gymId={id}&from={utc}&to={utc}&status=ACTIVE`. `gymId` is the studio's `gymUUID` (field `g` in the public `/v1/gym/overview` list, not `id`). Each session has `name`, `startDateTime`/`endDateTime` (UTC), `capacity`, `booked`, `instructor` and `gym`.
- **Auth:** `Authorization: Bearer <Firebase ID token>` (project `prod-egym-id`, valid for 1 hour). The app gets it like this:
  1. It logs in at `qualitrain.netpulse.com` (session cookie).
  2. It calls `/np/exerciser/{uuid}/externalAccount/egym/qltLocations/sso`, which returns a Firebase custom token.
  3. It exchanges that token through `signInWithCustomToken`.

  After that, the long-lived refresh token renews the ID token.
- **Our setup:** `python -m urbanpass.login` asks for the password in your own terminal and stores only the refresh token, in `.secrets/` (git-ignored). The daily run fetches the Wellpass schedule only for shared studios with in-app booking, about 140 requests.
- **Matching:** a USC class counts as "on both" when the same studio has a Wellpass class starting within 5 minutes, with the name as a tie-breaker. USC classes at in-app studios with no Wellpass counterpart are dropped. Studios where Wellpass works by check-in or external booking stay listed with a note.

The recording and the proxy's certificate key were deleted after the analysis.
