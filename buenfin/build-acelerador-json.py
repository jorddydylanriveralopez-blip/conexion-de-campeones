#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convert Acelerador Noviembre.csv to acelerador-noviembre.json.

Each row is [nombre, actOct, meta, actNov, adicionales, bracket, unitario, total].
The client key is the code before " - " in Nombre Cliente.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSV = ROOT / "acelerador-noviembre.csv"
OUT = ROOT / "acelerador-noviembre.json"


def num(v: str):
    s = (v or "").strip().replace(",", "").replace("$", "").replace(" ", "")
    if not s:
        return 0
    try:
        return float(s) if "." in s else int(s)
    except ValueError:
        return 0


def split_cliente(raw: str) -> tuple[str, str]:
    text = (raw or "").strip()
    if " - " in text:
        clave, nombre = text.split(" - ", 1)
    else:
        clave, nombre = text, ""
    clave = clave.strip().upper().replace(" ", "")
    nombre = nombre.strip() or "Yaavser"
    return clave, nombre


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else CSV
    if not src.exists():
        raise SystemExit(f"Missing CSV: {src}")

    data: dict[str, list] = {}
    with src.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            clave, nombre = split_cliente(row.get("Nombre Cliente", ""))
            if not clave:
                continue
            act_oct = num(row.get("Activaciones Octubre", ""))
            act_nov = num(row.get("Activaciones Noviembre", ""))
            data[clave] = [
                nombre,
                act_oct,
                act_oct,
                act_nov,
                num(row.get("Adicionales", "")),
                (row.get("Bracket Incremento") or "").strip(),
                num(row.get("Unitario Pago", "")),
                num(row.get("Total a Pagar", "")),
            ]

    OUT.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"OK -> {OUT.name} ({len(data)} keys)")


if __name__ == "__main__":
    main()
