#!/usr/bin/env python3
"""Erzeugt CHANGELOG.md aus changelog.js (der einzigen Quelle des Versionsverlaufs).

    tools/changelog.py               CHANGELOG.md neu schreiben
    tools/changelog.py --check 1.2.0 zusätzlich prüfen, dass 1.2.0 die neueste Version ist
"""
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
          "August", "September", "Oktober", "November", "Dezember"]


def load():
    text = (ROOT / "changelog.js").read_text(encoding="utf-8").strip()
    prefix = "window.ER_CHANGELOG ="
    if not text.startswith(prefix):
        sys.exit(f"changelog.js muss mit „{prefix}“ beginnen")
    return json.loads(text[len(prefix):].rstrip(";"))


def german_date(iso):
    d = date.fromisoformat(iso)
    return f"{d.day}. {MONTHS[d.month - 1]} {d.year}"


def main():
    entries = load()
    if "--check" in sys.argv:
        expected = sys.argv[sys.argv.index("--check") + 1]
        if entries[0]["version"] != expected:
            sys.exit(f"Neueste Version in changelog.js ist {entries[0]['version']}, VERSION ist {expected} – "
                     "bitte erst den Versionsverlauf ergänzen.")
    lines = ["# Versionsverlauf", "", "Wird aus `changelog.js` erzeugt (`tools/changelog.py`).", ""]
    for entry in entries:
        lines += [f"## {entry['version']} – {german_date(entry['date'])}", ""]
        lines += [f"- {change}" for change in entry["changes"]]
        lines.append("")
    (ROOT / "CHANGELOG.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
