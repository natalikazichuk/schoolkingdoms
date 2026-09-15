#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Finviz-скринер: акції NYSE/NASDAQ, які перепродані (RSI oversold),
але почали розворот угору — ріст за день, тиждень (опц.) і місяць у плюсі.
Опційно: підтвердження бичачим MACD (рахується по денних свічках через yfinance).

Дані: Finviz (безкоштовний рівень, затримка ~15 хв) через бібліотеку finvizfinance.
Ідея сетапу: акція у місячному висхідному тренді відкотилась у зону перепроданості
і сьогодні починає розвертатись угору.

Встановлення:
    pip install finvizfinance pandas
    pip install yfinance          # тільки якщо COMPUTE_MACD = True

Запуск:
    python finviz_screener.py
"""

import time
import sys
import pandas as pd

# ─────────────────────────── НАЛАШТУВАННЯ ───────────────────────────

EXCHANGES = ["NASDAQ", "NYSE"]        # Finviz дозволяє лише одну біржу за запит → перебираємо

RSI_FILTER = "Oversold (30)"          # "Oversold (30)" суворо / "Oversold (40)" м'якше
MIN_PRICE  = "Over $5"                # відсіюємо копійчані акції: "Over $5" / "Over $10" / ""
MIN_AVG_VOL = "Over 500K"             # ліквідність: "Over 500K" / "Over 1M" / ""

# Пост-фільтр по перформансу (Finviz повертає ці колонки, парсимо самі):
REQUIRE_DAY_UP   = True   # Change за сьогодні > 0   (день — початок росту)
REQUIRE_WEEK_UP  = True   # Perf Week > 0            (тиждень у плюсі) — послаб, якщо порожньо
REQUIRE_MONTH_UP = True   # Perf Month > 0           (місяць позитивний)

COMPUTE_MACD = False      # True → додатково рахувати MACD по денних свічках (потрібен yfinance + інтернет до Yahoo)
MACD_ONLY_BULLISH = False # True → залишати ЛИШЕ ті, де MACD бичачий (лінія > сигналу)

REQUEST_PAUSE = 1.0       # пауза між запитами до Finviz, сек (щоб не впертись у ліміти)
OUTPUT_CSV = "finviz_result.csv"

# ─────────────────────────── ДОПОМІЖНІ ───────────────────────────

def pct_to_float(x):
    """'5.23%' -> 5.23 ; '-' / '' / None -> NaN"""
    if x is None:
        return float("nan")
    s = str(x).strip().replace("%", "").replace(",", "")
    if s in ("", "-", "nan", "None"):
        return float("nan")
    try:
        return float(s)
    except ValueError:
        return float("nan")


def fetch_for_exchange(exchange):
    """Тягне з Finviz Performance + Technical view для однієї біржі та зливає по Ticker."""
    from finvizfinance.screener.performance import Performance
    from finvizfinance.screener.technical import Technical

    filters = {
        "Exchange": exchange,
        "RSI (14)": RSI_FILTER,
        "Performance": "Month Up",     # серверний фільтр: місяць у плюсі
    }
    if MIN_PRICE:
        filters["Price"] = MIN_PRICE
    if MIN_AVG_VOL:
        filters["Average Volume"] = MIN_AVG_VOL

    # Performance view → Perf Week / Perf Month / Change / Volume / Price
    perf = Performance()
    perf.set_filter(filters_dict=filters)
    df_perf = perf.screener_view(verbose=0)
    time.sleep(REQUEST_PAUSE)

    if df_perf is None or len(df_perf) == 0:
        return pd.DataFrame()

    # Technical view → RSI / SMA / ATR (той самий фільтр → той самий набір тікерів)
    tech = Technical()
    tech.set_filter(filters_dict=filters)
    df_tech = tech.screener_view(verbose=0)
    time.sleep(REQUEST_PAUSE)

    if df_tech is not None and "Ticker" in df_tech.columns:
        keep_tech = [c for c in ["Ticker", "RSI", "SMA20", "SMA50", "SMA200", "ATR"] if c in df_tech.columns]
        df = df_perf.merge(df_tech[keep_tech], on="Ticker", how="left")
    else:
        df = df_perf

    df["Exchange"] = exchange
    return df


def add_macd(df):
    """Додає колонки MACD/Signal/Hist/бичачий-прапорець по денних свічках (yfinance)."""
    try:
        import yfinance as yf
    except ImportError:
        print("⚠️  yfinance не встановлено — пропускаю MACD. (pip install yfinance)")
        df["MACD_bull"] = pd.NA
        return df

    macd_vals, sig_vals, hist_vals, bull_vals, cross_vals = [], [], [], [], []
    for tkr in df["Ticker"]:
        macd = sig = hist = float("nan")
        bull = cross = False
        try:
            hist_df = yf.Ticker(tkr).history(period="4mo", interval="1d")
            close = hist_df["Close"].dropna()
            if len(close) >= 35:
                ema12 = close.ewm(span=12, adjust=False).mean()
                ema26 = close.ewm(span=26, adjust=False).mean()
                macd_line = ema12 - ema26
                signal = macd_line.ewm(span=9, adjust=False).mean()
                h = macd_line - signal
                macd, sig, hist = float(macd_line.iloc[-1]), float(signal.iloc[-1]), float(h.iloc[-1])
                bull = macd > sig
                # свіжий бичачий перетин за останні 3 дні
                cross = any(h.iloc[-k] > 0 >= h.iloc[-k - 1] for k in range(1, 4))
        except Exception:
            pass
        macd_vals.append(round(macd, 4) if macd == macd else None)
        sig_vals.append(round(sig, 4) if sig == sig else None)
        hist_vals.append(round(hist, 4) if hist == hist else None)
        bull_vals.append(bull)
        cross_vals.append(cross)
        time.sleep(0.3)

    df["MACD"] = macd_vals
    df["Signal"] = sig_vals
    df["Hist"] = hist_vals
    df["MACD_bull"] = bull_vals
    df["MACD_fresh_cross"] = cross_vals
    return df


# ─────────────────────────── ОСНОВНЕ ───────────────────────────

def main():
    frames = []
    for exch in EXCHANGES:
        print(f"→ Finviz: {exch} ...")
        try:
            frames.append(fetch_for_exchange(exch))
        except Exception as e:
            print(f"   помилка для {exch}: {e}")

    if not frames or all(len(f) == 0 for f in frames):
        print("Порожньо після серверних фільтрів Finviz. Спробуй RSI 'Oversold (40)'.")
        return

    df = pd.concat([f for f in frames if len(f) > 0], ignore_index=True)
    df = df.drop_duplicates(subset="Ticker")

    # числові версії відсоткових колонок
    df["_chg"]   = df["Change"].apply(pct_to_float)     if "Change" in df.columns else float("nan")
    df["_week"]  = df["Perf Week"].apply(pct_to_float)  if "Perf Week" in df.columns else float("nan")
    df["_month"] = df["Perf Month"].apply(pct_to_float) if "Perf Month" in df.columns else float("nan")

    mask = pd.Series(True, index=df.index)
    if REQUIRE_DAY_UP:
        mask &= df["_chg"] > 0
    if REQUIRE_WEEK_UP:
        mask &= df["_week"] > 0
    if REQUIRE_MONTH_UP:
        mask &= df["_month"] > 0
    df = df[mask].copy()

    if len(df) == 0:
        print("Нічого не пройшло пост-фільтр (день/тиждень/місяць).")
        print("Порада: постав REQUIRE_WEEK_UP = False або RSI 'Oversold (40)'.")
        return

    if COMPUTE_MACD:
        print(f"→ Рахую MACD для {len(df)} тікерів (yfinance)...")
        df = add_macd(df)
        if MACD_ONLY_BULLISH and "MACD_bull" in df.columns:
            df = df[df["MACD_bull"] == True]

    # сортуємо: найсильніший денний імпульс зверху
    df = df.sort_values("_chg", ascending=False)

    show = ["Ticker", "Exchange", "Price", "Change", "Perf Week", "Perf Month", "RSI"]
    if COMPUTE_MACD:
        show += ["MACD", "Signal", "MACD_bull", "MACD_fresh_cross"]
    show = [c for c in show if c in df.columns]

    print(f"\n✅ Знайдено: {len(df)}\n")
    print(df[show].to_string(index=False))

    df[show].to_csv(OUTPUT_CSV, index=False)
    print(f"\n💾 Збережено у {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
