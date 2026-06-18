#!/usr/bin/env python3
"""
Phase A de la migration samediLudoV2 -> LudoHub.

Lit l'ancienne base SQLite mono-ludo et exporte toutes les tables utiles vers
un JSON brut (`ludops-export.json`), consommé ensuite par migrate-ludops.ts.

- Aucune transformation metier ici : on dump tel quel (la reformatation se fait
  cote tsx, ou le schema cible et Drizzle sont disponibles).
- Encodage : SQLite stocke en UTF-8. On lit en UTF-8 strict ; si une chaine
  echoue, fallback cp1252 (mojibake Windows) en best-effort, et on signale.
- Le rapport affiche un echantillon de chaines accentuees pour valider l'encodage
  AVANT de lancer la phase B.

Usage :
    python scripts/migration/extract-ludops.py [chemin_ludops.db]

Defaut : C:/Users/jojo-/Downloads/ludops.db
"""

import json
import os
import sqlite3
import sys

DEFAULT_DB = r"C:\Users\jojo-\Downloads\ludops.db"
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ludops-export.json")

# Tables exportees (les autres tables de l'ancienne base ne sont pas migrees).
TABLES = [
    "members",
    "seasons",
    "saturday_slots",
    "assignments",
    "themes",
    "theme_items",
    "theme_periods",
    "checkups",
    "checkup_entries",
    "game_wishes",
    "supply_needs",
    "activity_log",
    "absences",
]


def make_text_factory():
    """Decode UTF-8 strict, fallback cp1252, en signalant tout fallback."""
    fallbacks = {"count": 0, "samples": []}

    def decode(b: bytes):
        try:
            return b.decode("utf-8")
        except UnicodeDecodeError:
            s = b.decode("cp1252", errors="replace")
            fallbacks["count"] += 1
            if len(fallbacks["samples"]) < 5:
                fallbacks["samples"].append(s)
            return s

    return decode, fallbacks


def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DB
    if not os.path.exists(db_path):
        print(f"X Base introuvable : {db_path}")
        sys.exit(1)

    decode, fallbacks = make_text_factory()
    con = sqlite3.connect(db_path)
    con.text_factory = decode
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    existing = {
        r[0] for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }

    export = {}
    counts = {}
    for t in TABLES:
        if t not in existing:
            print(f"! Table absente, ignoree : {t}")
            export[t] = []
            counts[t] = 0
            continue
        rows = [dict(r) for r in cur.execute(f'SELECT * FROM "{t}"').fetchall()]
        export[t] = rows
        counts[t] = len(rows)

    con.close()

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(export, f, ensure_ascii=False, indent=2)

    # ── Rapport ──────────────────────────────────────────────────────────────
    print("=" * 64)
    print("EXTRACTION ludops.db -> ludops-export.json")
    print("=" * 64)
    print(f"Source : {db_path}")
    print(f"Sortie : {OUT_PATH}")
    print("\nComptes par table :")
    for t in TABLES:
        print(f"  {t:<20} {counts[t]:>5}")

    if fallbacks["count"]:
        print(f"\n! {fallbacks['count']} chaine(s) decodee(s) en cp1252 (fallback) :")
        for s in fallbacks["samples"]:
            print(f"    {s}")
    else:
        print("\nEncodage : UTF-8 strict OK (aucun fallback).")

    # Echantillon de chaines accentuees pour controle visuel.
    print("\nControle accents (doit etre lisible) :")
    samples = []
    for r in export.get("members", []):
        samples.append(f"member: {r.get('name')}")
    for r in export.get("supply_needs", [])[:3]:
        samples.append(f"supply: {r.get('name')}")
    for r in export.get("activity_log", [])[:2]:
        samples.append(f"log:    {r.get('description')}")
    for s in samples[:10]:
        print(f"    {s}")

    print("\nOK. Verifie les accents ci-dessus, puis lance la phase B (dry-run).")


if __name__ == "__main__":
    main()
