"""Usage: python -m urbanpass [YYYY-MM-DD]   (default: tomorrow, Berlin time)"""
import datetime as dt
import json
import sys
from pathlib import Path

from . import match, site, usc, wellpass, wellpass_auth

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def main():
    date = sys.argv[1] if len(sys.argv) > 1 else (dt.date.today() + dt.timedelta(days=1)).isoformat()
    DATA.mkdir(exist_ok=True)

    print("USC venues ...", flush=True)
    venues = usc.venues()
    print(f"  {len(venues)}")
    print("Wellpass studios ...", flush=True)
    wp = wellpass.berlin()
    print(f"  {len(wp)}")

    pairs = match.match_studios(venues, wp)
    shared = sorted({p["wellpass"]["slug"] for p in pairs})
    print(f"Shared studios: {len(shared)} Wellpass / {len({p['usc']['slug'] for p in pairs})} USC listings")
    (DATA / "studios.json").write_text(json.dumps(
        [{"usc": p["usc"]["slug"], "usc_name": p["usc"]["name"], "wellpass": p["wellpass"]["slug"],
          "wellpass_name": p["wellpass"]["name"], "street": p["wellpass"]["street"], "score": p["score"]}
         for p in pairs], ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"USC classes on {date} ...", flush=True)
    classes = usc.classes(date)
    print(f"  {len(classes)}")
    joint = match.joint_classes(classes, pairs)
    print(f"Classes at shared studios: {len(joint)}")

    checked = False
    if wellpass_auth.logged_in():
        try:
            match.confirm_with_wellpass(joint, date, wellpass_auth.class_sessions)
            checked = True
        except wellpass_auth.AuthError as e:
            print(f"Skipping Wellpass class check: {e}")
    else:
        print("Not logged in to Wellpass (python -m urbanpass.login) - skipping class check.")
    # A USC class at an in-app-booking studio that isn't on the Wellpass schedule can't be done together.
    if checked:
        joint = [c for c in joint if c["wellpass"]["confirmed"] is not False]

    out = {"date": date, "generated": dt.datetime.now().isoformat(timespec="minutes"), "wellpass_checked": checked,
           "counts": {"usc_classes": len(classes), "shared_studios": len(shared), "joint_classes": len(joint),
                      "confirmed": sum(1 for c in joint if c["wellpass"]["confirmed"])},
           "classes": joint}
    (DATA / f"classes-{date}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    path = site.build(out, ROOT / "site" / "index.html")
    print(f"Site: {path}")


if __name__ == "__main__":
    main()
