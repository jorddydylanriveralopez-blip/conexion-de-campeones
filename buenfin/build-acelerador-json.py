#!/usr/bin/env python3
"""Convierte LayOut Acelerador Noviembre.xlsx ? acelerador-noviembre.json"""

from __future__ import annotations

import json
from pathlib import Path

try:
    import openpyxl
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Necesitas openpyxl: pip install openpyxl") from exc

ROOT = Path(__file__).resolve().parent
XLSX = ROOT / "layout-acelerador-noviembre.xlsx"
OUT = ROOT / "acelerador-noviembre.json"

HEADERS = {
    "idcliente": "clave",
    "nombrecliente": "nombre",
    "activaciones_octubre": "act_octubre",
    "activaciones_noviembre": "act_noviembre",
    "adicionales": "adicionales",
    "bracket_incremento": "bracket",
    "unitario_pago": "unitario",
    "total_a_pagar": "total",
}


def norm(h: object) -> str:
    s = str(h or "").strip().lower()
    for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n")):
        s = s.replace(a, b)
    out = []
    for ch in s:
        out.append(ch if ch.isalnum() else "_")
    return "_".join(p for p in "".join(out).split("_") if p)


def num(v: object):
    if v is None or v == "":
        return 0
    if isinstance(v, (int, float)):
        return v
    s = str(v).strip().replace(",", "").replace("$", "")
    try:
        return float(s) if "." in s else int(s)
    except ValueError:
        return 0


def main() -> None:
    if not XLSX.exists():
        raise SystemExit(f"No está el Excel: {XLSX}")

    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise SystemExit("La hoja está vacía.")

    headers = [norm(h) for h in rows[0]]
    idx = {HEADERS[h]: i for i, h in enumerate(headers) if h in HEADERS}
    missing = [k for k in HEADERS.values() if k not in idx]
    if missing:
        raise SystemExit(f"Faltan columnas en el Excel: {missing}. Headers={headers}")

    data: dict[str, list] = {}
    for row in rows[1:]:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue
        clave = str(row[idx["clave"]] or "").strip().upper().replace(" ", "")
        if not clave:
            continue
        nombre = str(row[idx["nombre"]] or "").strip() or "Yaavser"
        act_oct = num(row[idx["act_octubre"]])
        act_nov = num(row[idx["act_noviembre"]])
        adicionales = num(row[idx["adicionales"]])
        bracket = row[idx["bracket"]]
        bracket = "" if bracket is None else str(bracket).strip()
        unitario = num(row[idx["unitario"]])
        total = num(row[idx["total"]])
        # Compacto: [nombre, actOct, meta, actNov, adicionales, bracket, unitario, total]
        data[clave] = [
            nombre,
            act_oct,
            act_oct,
            act_nov,
            adicionales,
            bracket,
            unitario,
            total,
        ]

    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"OK ? {OUT.name} ({len(data)} claves)")


if __name__ == "__main__":
    main()
