#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flask-бекенд для сторінки «Finviz Oversold Screener».

Навіщо бекенд: Finviz не віддає дані напряму в браузер (CORS), тому запит
робить сервер через finvizfinance, а фронтенд (index.html) спілкується лише
зі своїм /api/screen.

Уся логіка скринінгу — у сусідньому finviz_screener.py (функція screen(),
яка всередині використовує fetch_for_exchange / pct_to_float / add_macd).
Тут тільки розбір query-параметрів і перетворення DataFrame → JSON.

Запуск:
    pip install -r requirements.txt
    python app.py          # http://localhost:5000
"""

import os
import sys
import time

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:                     # щоб працювало і при запуску з іншої теки
    sys.path.insert(0, BASE_DIR)

import finviz_screener as fs                     # noqa: E402  (після правки sys.path)

app = Flask(__name__, static_folder=None)

# ── дозволені значення параметрів → рядки фільтрів Finviz ──────────────
# Finviz приймає лише свої формулювання, тож довільні значення не пропускаємо.
RSI_CHOICES = {
    "30": "Oversold (30)",
    "40": "Oversold (40)",
}
EXCHANGE_CHOICES = ("NASDAQ", "NYSE", "AMEX")
PRICE_CHOICES = {
    "0": "", "1": "Over $1", "2": "Over $2", "3": "Over $3", "5": "Over $5",
    "7": "Over $7", "10": "Over $10", "15": "Over $15", "20": "Over $20",
    "30": "Over $30", "50": "Over $50",
}
VOLUME_CHOICES = {
    "0": "", "50K": "Over 50K", "100K": "Over 100K", "200K": "Over 200K",
    "300K": "Over 300K", "400K": "Over 400K", "500K": "Over 500K",
    "750K": "Over 750K", "1M": "Over 1M", "2M": "Over 2M",
}

DEFAULTS = {"rsi": "30", "min_price": "5", "min_vol": "500K"}


class BadParam(Exception):
    """Некоректний query-параметр → 400 з поясненням."""


# ─────────────────────────── ПАРАМЕТРИ ───────────────────────────

def _flag(name, default):
    """?day=1 / 0 / true / false / yes / no → bool"""
    raw = request.args.get(name)
    if raw is None or raw == "":
        return default
    val = raw.strip().lower()
    if val in ("1", "true", "yes", "on"):
        return True
    if val in ("0", "false", "no", "off"):
        return False
    raise BadParam(f"{name}: очікую 1 або 0, отримано {raw!r}")


def _choice(name, table):
    """Значення зі словника дозволених → рядок фільтра Finviz."""
    raw = (request.args.get(name) or DEFAULTS.get(name, "")).strip()
    key = raw.upper() if name == "min_vol" else raw
    if key not in table:
        raise BadParam(f"{name}: дозволені значення — {', '.join(table)}; отримано {raw!r}")
    return table[key], key


def _exchanges():
    raw = (request.args.get("exchanges") or ",".join(fs.EXCHANGES)).strip()
    out = []
    for part in raw.split(","):
        exch = part.strip().upper()
        if not exch:
            continue
        if exch not in EXCHANGE_CHOICES:
            raise BadParam(f"exchanges: дозволені — {', '.join(EXCHANGE_CHOICES)}; отримано {part!r}")
        if exch not in out:                       # Finviz бере одну біржу за запит
            out.append(exch)
    if not out:
        raise BadParam("exchanges: потрібна хоча б одна біржа")
    return out


# ─────────────────────────── DataFrame → JSON ───────────────────────────

def _num(value, digits=None):
    """Будь-що з Finviz → float або None (NaN у JSON недопустимий)."""
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        num = float(value)
    else:
        num = fs.pct_to_float(value)
    if num != num:                                # NaN
        return None
    return round(num, digits) if digits is not None else num


def _rows(df, with_macd):
    """DataFrame → список словників для фронтенда (числа, не рядки)."""
    rows = []
    for _, r in df.iterrows():
        row = {
            "ticker":     str(r.get("Ticker", "") or ""),
            "exchange":   str(r.get("Exchange", "") or ""),
            "price":      _num(r.get("Price"), 2),
            "change":     _num(r.get("_chg"), 2),      # відсотки як число: 1.5 == 1.50%
            "perf_week":  _num(r.get("_week"), 2),
            "perf_month": _num(r.get("_month"), 2),
            "rsi":        _num(r.get("RSI"), 2),
        }
        if with_macd:
            row["macd"] = _num(r.get("MACD"), 4)
            row["signal"] = _num(r.get("Signal"), 4)
            row["macd_bull"] = bool(r.get("MACD_bull") is True)
            row["macd_fresh_cross"] = bool(r.get("MACD_fresh_cross") is True)
        rows.append(row)
    return rows


# ─────────────────────────── МАРШРУТИ ───────────────────────────

@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/api/screen")
def api_screen():
    """Скринінг за query-параметрами → JSON.

    rsi=30|40, exchanges=NASDAQ,NYSE, min_price=5, min_vol=500K,
    day=1, week=1, month=1, macd=0
    """
    try:
        rsi_filter, rsi_key = _choice("rsi", RSI_CHOICES)
        min_price, _ = _choice("min_price", PRICE_CHOICES)
        min_vol, _ = _choice("min_vol", VOLUME_CHOICES)
        exchanges = _exchanges()
        day = _flag("day", True)
        week = _flag("week", True)
        month = _flag("month", True)
        macd = _flag("macd", False)
    except BadParam as e:
        return jsonify({"error": str(e), "rows": [], "count": 0}), 400

    errors, stats = [], {}
    started = time.time()
    try:
        df = fs.screen(
            exchanges=exchanges,
            rsi_filter=rsi_filter,
            min_price=min_price,
            min_avg_vol=min_vol,
            require_day_up=day,
            require_week_up=week,
            require_month_up=month,
            compute_macd=macd,
            macd_only_bullish=False,      # MACD тут лише підсвічує, а не відсіює
            errors=errors,
            stats=stats,
        )
    except Exception as e:                # скринер не має валити сервер
        app.logger.exception("screen() впав")
        return jsonify({
            "error": f"Скринінг не вдався: {e}",
            "rows": [], "count": 0, "errors": errors,
        }), 502

    rows = _rows(df, macd) if len(df) else []
    return jsonify({
        "rows": rows,
        "count": len(rows),
        "errors": errors,                 # проблеми з окремими біржами, не фатальні
        "stats": {"raw": stats.get("raw", 0), "kept": len(rows)},
        "elapsed_sec": round(time.time() - started, 1),
        "params": {
            "rsi": rsi_key, "exchanges": exchanges, "min_price": min_price or "будь-яка",
            "min_vol": min_vol or "будь-який", "day": day, "week": week,
            "month": month, "macd": macd,
        },
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print(f"→ Finviz Oversold Screener: http://localhost:{port}")
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=port, debug=False)
