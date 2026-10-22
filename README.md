# Urban Pass

Find joint places to exercise for people with an **Urban Sports Club** subscription and people with a **Wellpass** subscription.

If you have Wellpass and your partner or friends have Urban Sports Club, finding a studio and class you can *both* book usually means flipping between two apps. Urban Pass shows only the overlap: studios and classes available on both platforms.

Scope for now: **Berlin**.

## How it works

See [docs/approach.md](docs/approach.md) for the data sources (public USC and Wellpass endpoints), how studios are matched, and the plan.

## How it fits together

```
GitHub Action "Refresh class data" (run on demand)        GitHub Pages (free)
  crawl USC + Wellpass ──commit data──▶ main ──deploy──▶ https://phiosin.github.io/urban-pass/
```

- `urbanpass/`: Python crawler and matcher (standard library only).
- `wordpress/urban-pass/`: the app (`assets/`) and its data (`data/`). It also works as a WordPress plugin, if the site's plan allows plugins (WordPress.com Business or self-hosted).
- `web/index.html`: page shell for GitHub Pages.
- `.github/workflows/refresh-data.yml`: on-demand data refresh (Actions → *Refresh class data* → *Run workflow*), followed by a deploy.
- `.github/workflows/deploy-pages.yml`: publishes the site whenever the app or data changes on `main`.
- `dev/index.html`: local preview.
- Map: [Leaflet](https://leafletjs.com) with OpenStreetMap tiles; U-/S-Bahn stations come from OpenStreetMap via the Overpass API.

## Run it locally

Needs Python 3.10+. With [uv](https://docs.astral.sh/uv/):

```bash
uv run --no-project --python 3.12 python -m urbanpass.login        # once: Wellpass login (password is not stored)
uv run --no-project --python 3.12 python -m urbanpass --days 7     # build data into wordpress/urban-pass/data/
```

Then serve the repo (`python -m http.server`) and open `/dev/`.

## Update the classes

- **From GitHub:** Actions → *Refresh class data* → *Run workflow*. This works in the GitHub mobile app too, and the app's About tab links there. It takes about 15 minutes, and the site updates automatically when it's done.
- **Locally:** run the two commands above, then commit and push `wordpress/urban-pass/data`.

The GitHub run needs the secret `WELLPASS_REFRESH_TOKEN` for the Wellpass schedule check. Set it once from your PC:

```bash
uv run --no-project --python 3.12 python -c "import json;print(json.load(open('.secrets/wellpass.json'))['refresh_token'])" | gh secret set WELLPASS_REFRESH_TOKEN
```

## Note on privacy

The repository and the site are public, and the data includes Wellpass schedule details fetched with a personal account. Keep the site unlisted (it is `noindex`), or make the repo private; GitHub Pages for private repos needs GitHub Pro.

Not affiliated with Urban Sports Club or EGYM Wellpass.
