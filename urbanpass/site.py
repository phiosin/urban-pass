"""Render the joint class list as one self-contained HTML page."""
import json
from pathlib import Path

TEMPLATE = Path(__file__).with_name("template.html")


def build(data, out_path):
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8").replace("/*__DATA__*/null", payload)
    out_path.write_text(html, encoding="utf-8")
    return out_path
