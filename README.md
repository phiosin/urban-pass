# Urban Pass

Find joint places to exercise for people with an **Urban Sports Club** subscription and people with a **Wellpass** subscription.

If you have Wellpass and your partner or friends have Urban Sports Club, finding a studio and class you can *both* book usually means flipping between two apps. Urban Pass shows only the overlap: studios and classes available on both platforms.

Scope for now: **Berlin**.

## How it works

See [docs/approach.md](docs/approach.md) for the data sources (public USC and Wellpass endpoints), how studios are matched, and the plan.

## Run it

Needs Python 3.10+ (standard library only). With [uv](https://docs.astral.sh/uv/):

```bash
uv run --no-project --python 3.12 python -m urbanpass            # tomorrow
uv run --no-project --python 3.12 python -m urbanpass 2026-10-24 # a given day
```

This writes `data/studios.json` (matched studios), `data/classes-<date>.json`, and `site/index.html`, a single self-contained page. The first run takes about 15–20 minutes because it crawls slowly (about one request per second). Later runs reuse the cache in `data/raw/`.

**Wellpass classes:** run `uv run --no-project --python 3.12 python -m urbanpass.login` once. It asks for your Wellpass email and password in the terminal and stores only a refresh token in `.secrets/` (never committed). After that, each run checks the Wellpass in-app schedule and marks the classes that are on both schedules. Without the login, the page lists every USC class at a shared studio and shows how Wellpass booking works there.
