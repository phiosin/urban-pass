# Urban Pass

Find joint places to exercise for people with an **Urban Sports Club** subscription and people with a **Wellpass** subscription.

If you have Wellpass and your partner or friends have Urban Sports Club, finding a studio and class you can *both* book usually means flipping between two apps. Urban Pass shows only the overlap: studios and classes available on both platforms.

Scope for now: **Berlin**.

## How it works

See [docs/approach.md](docs/approach.md) for the data sources (public USC and Wellpass endpoints), how studios are matched, and the plan.

## How it fits together

```
GitHub Action (daily, 06:30)          WordPress.com site
  crawl USC + Wellpass  ──commit──▶  main ──▶ wp-plugin branch ──GitHub Deployments──▶ /wp-content/plugins/urban-pass
```

- `urbanpass/`: Python crawler and matcher (standard library only).
- `wordpress/urban-pass/`: the WordPress plugin (app UI in `assets/`, daily data in `data/`).
- `.github/workflows/refresh-data.yml`: rebuilds 7 days of data every morning, commits it, and republishes the `wp-plugin` branch.
- `dev/index.html`: local preview of the plugin UI without WordPress.

## Run it locally

Needs Python 3.10+. With [uv](https://docs.astral.sh/uv/):

```bash
uv run --no-project --python 3.12 python -m urbanpass.login        # once: Wellpass login (password is not stored)
uv run --no-project --python 3.12 python -m urbanpass --days 7     # build data into wordpress/urban-pass/data/
```

Then serve the repo (`python -m http.server`) and open `/dev/`.

## Set up the WordPress site (one time)

1. **Create the site** on WordPress.com. GitHub Deployments needs a Business or Commerce plan.
2. **Make it private** (Settings → General → Privacy → Private). The class data comes partly from your Wellpass account, and the sources are unofficial.
3. **Connect GitHub:** Hosting → Deployments → Connect repository → `phiosin/urban-pass`, branch **`wp-plugin`**, destination **`/wp-content/plugins/urban-pass`**, mode **Simple**, automatic deployments **on**.
4. **Activate** the *Urban Pass* plugin. It takes over the front page. To switch that off, use Settings → Reading. The app also works at `/urban-pass/` (after saving Settings → Permalinks once) and via the `[urban_pass]` shortcode.
5. **Daily Wellpass check:** add the GitHub secret `WELLPASS_REFRESH_TOKEN`, using the `refresh_token` value from `.secrets/wellpass.json`:

   ```bash
   uv run --no-project --python 3.12 python -c "import json;print(json.load(open('.secrets/wellpass.json'))['refresh_token'])" | gh secret set WELLPASS_REFRESH_TOKEN
   ```

Not affiliated with Urban Sports Club or EGYM Wellpass.
