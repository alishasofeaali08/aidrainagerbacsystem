"""
ai.py — heuristic + weather-aware flood risk engine for Air-Eyes
"""
import urllib.request
import json
import math

# ── Drain blockage classifier ─────────────────────────────────────────────────
def classify_image(description: str, has_photo: bool):
    words = (description or "").lower()
    if any(k in words for k in ["blocked","blockage","rubbish","trash","clog","sampah","tersumbat"]):
        return "possible_blockage", 0.62
    return ("needs_visual_review", 0.35) if has_photo else ("insufficient_evidence", 0.10)


# ── Base flood score from description ────────────────────────────────────────
def flood_score(description: str) -> float:
    s = 0.25
    d = (description or "").lower()
    if any(k in d for k in ["overflow","flood","water level","heavy rain","banjir","limpahan"]):
        s += 0.45
    if any(k in d for k in ["blocked","rubbish","clog","sampah","tersumbat"]):
        s += 0.20
    return round(min(s, 1), 2)


def priority(confidence: float, risk: float) -> int:
    score = max(confidence * 0.45, risk)
    return 1 if score >= .8 else 2 if score >= .6 else 3 if score >= .4 else 4 if score >= .2 else 5


# ── Malaysian state bounding boxes (lat_min, lat_max, lon_min, lon_max) ──────
# Ordered peninsula-first, then East Malaysia, then FTs last (smallest areas)
_STATE_BOUNDS = [
    # Peninsular — ordered smallest/most specific first to avoid overlap
    ("Perlis",           6.15, 6.72,  100.04, 100.50),
    ("Pulau Pinang",     5.13, 5.58,  100.16, 100.50),
    # Federal Territories (small, checked early)
    ("Putrajaya",        2.885, 2.975, 101.665, 101.740),
    ("Kuala Lumpur",     3.055, 3.245, 101.615, 101.790),
    ("Labuan",           5.27,  5.38,  115.17,  115.27),
    # States
    ("Kedah",            5.55, 6.72,   99.60, 100.78),
    ("Kelantan",         4.70, 6.27,  101.55, 102.48),
    ("Terengganu",       4.00, 5.81,  102.72, 103.50),
    ("Selangor",         2.72, 3.84,  101.19, 101.86),
    ("Negeri Sembilan",  2.39, 3.12,  101.70, 102.46),
    ("Melaka",           2.08, 2.52,  102.01, 102.56),
    ("Johor",            1.20, 2.66,  102.96, 104.45),
    ("Perak",            3.67, 5.88,  100.33, 101.70),
    ("Pahang",           2.45, 4.65,  101.42, 103.50),
    # East Malaysia
    ("Sabah",            4.00, 7.37,  115.45, 119.30),
    ("Sarawak",          0.85, 5.00,  109.56, 115.65),
]

# State capital coordinates for weather lookup
STATE_CAPITALS = {
    "Johor":           (1.4854,  103.7618),
    "Kedah":           (6.1184,  100.3685),
    "Kelantan":        (6.1248,  102.2376),
    "Melaka":          (2.1896,  102.2501),
    "Negeri Sembilan": (2.7297,  101.9381),
    "Pahang":          (3.7999,  103.3268),
    "Perak":           (4.5921,  101.0901),
    "Perlis":          (6.4449,  100.2048),
    "Pulau Pinang":    (5.3535,  100.3008),
    "Sabah":           (5.9804,  116.0735),
    "Sarawak":         (1.5497,  110.3592),
    "Selangor":        (3.0738,  101.5183),
    "Terengganu":      (5.3296,  103.1370),
    "Kuala Lumpur":    (3.1390,  101.6869),
    "Putrajaya":       (2.9264,  101.6964),
    "Labuan":          (5.2831,  115.2308),
}


def state_from_coords(lat: float, lon: float) -> str:
    """Return the Malaysian state name for a given lat/lon, or empty string."""
    for name, lat_min, lat_max, lon_min, lon_max in _STATE_BOUNDS:
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return name
    return ""


# ── Weather-based risk engine ─────────────────────────────────────────────────
def _fetch_rain_forecast(lat: float, lon: float) -> dict:
    """
    Fetch 7-day daily precipitation sum from Open-Meteo (free, no API key).
    Returns {"dates": [...], "rain_mm": [...], "total_7d": float}
    """
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=precipitation_sum,precipitation_probability_max"
        f"&timezone=Asia%2FKuala_Lumpur"
        f"&forecast_days=7"
    )
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read())
        daily = data.get("daily", {})
        rain  = daily.get("precipitation_sum", [0]*7)
        prob  = daily.get("precipitation_probability_max", [0]*7)
        dates = daily.get("time", [])
        return {
            "dates":    dates,
            "rain_mm":  [r or 0 for r in rain],
            "prob_pct": [p or 0 for p in prob],
            "total_7d": round(sum(r or 0 for r in rain), 1),
            "ok": True,
        }
    except Exception as e:
        return {"dates": [], "rain_mm": [], "prob_pct": [], "total_7d": 0, "ok": False, "error": str(e)}


def _rain_risk(total_7d_mm: float, max_daily_mm: float) -> float:
    """
    Convert rainfall totals to a 0–1 weather risk factor.
    Thresholds based on Malaysian Met Dept categories:
      <10 mm/day  → light
      10–50 mm    → moderate
      50–100 mm   → heavy
      >100 mm     → very heavy / extreme
    """
    base = min(total_7d_mm / 350, 0.70)   # 350 mm over 7 days → 0.70
    peak = min(max_daily_mm  / 100, 0.30)  # 100 mm single day  → 0.30
    return round(min(base + peak, 1.0), 3)


def weather_risk_for_state(state: str, active_reports: int) -> dict:
    """
    Compute combined weather + drainage load risk for one state.
    active_reports = count of non-resolved reports in that state.
    """
    coords = STATE_CAPITALS.get(state)
    if not coords:
        return {"state": state, "error": "unknown state"}

    forecast = _fetch_rain_forecast(*coords)

    rain_mm   = forecast["rain_mm"]
    max_daily = max(rain_mm) if rain_mm else 0
    total_7d  = forecast["total_7d"]

    weather_score = _rain_risk(total_7d, max_daily)

    # Drainage load factor: each 5 active reports adds 0.05, capped at 0.30
    load_factor = min(active_reports / 5 * 0.05, 0.30)

    combined = round(min(weather_score * 0.70 + load_factor * 0.30 + weather_score * load_factor * 0.20, 1.0), 3)

    level = (
        "🔴 Extreme"  if combined >= 0.80 else
        "🟠 High"     if combined >= 0.60 else
        "🟡 Moderate" if combined >= 0.35 else
        "🟢 Low"
    )

    # AI narrative
    narrative = _generate_narrative(state, total_7d, max_daily, active_reports, combined, level, forecast)

    return {
        "state":          state,
        "weather_score":  weather_score,
        "load_factor":    round(load_factor, 3),
        "combined_risk":  combined,
        "risk_level":     level,
        "total_rain_7d":  total_7d,
        "max_daily_rain": round(max_daily, 1),
        "active_reports": active_reports,
        "forecast":       forecast,
        "narrative":      narrative,
        "coords":         coords,
    }


def _generate_narrative(state, total_7d, max_daily, reports, combined, level, forecast):
    """Rule-based AI narrative — no external LLM required."""
    sentences = []

    # Rainfall context
    if total_7d >= 200:
        sentences.append(f"Exceptional rainfall of {total_7d} mm is forecast for {state} over the next 7 days — well above the tropical average.")
    elif total_7d >= 100:
        sentences.append(f"{state} is expecting heavy cumulative rainfall of {total_7d} mm over 7 days.")
    elif total_7d >= 40:
        sentences.append(f"Moderate rainfall ({total_7d} mm total) is expected in {state} over the next week.")
    else:
        sentences.append(f"Relatively dry conditions are forecast for {state} with only {total_7d} mm of rain expected over 7 days.")

    # Peak day
    if max_daily >= 100:
        sentences.append(f"A peak of {max_daily} mm in a single day poses a severe flash-flood risk to drainage infrastructure.")
    elif max_daily >= 50:
        sentences.append(f"A peak daily total of {max_daily} mm could overwhelm blocked drains rapidly.")
    elif max_daily >= 20:
        sentences.append(f"Daily peaks up to {max_daily} mm require monitoring of existing blockage reports.")

    # Drainage load
    if reports >= 10:
        sentences.append(f"With {reports} active blockage reports, drainage capacity in {state} is already under significant strain.")
    elif reports >= 5:
        sentences.append(f"There are {reports} unresolved blockage reports in {state}, amplifying flood risk during rain events.")
    elif reports > 0:
        sentences.append(f"{reports} active report(s) are logged in {state}.")
    else:
        sentences.append(f"No active blockage reports are currently logged for {state}.")

    # Combined verdict
    sentences.append(f"Combined risk assessment: {level} ({round(combined*100)}%).")

    if combined >= 0.60:
        sentences.append("Immediate inspection and clearance of high-priority drainage sites is recommended before the forecast rain arrives.")
    elif combined >= 0.35:
        sentences.append("Routine monitoring and pre-emptive clearing of flagged drains is advised.")
    else:
        sentences.append("No urgent drainage action is required at this time.")

    return " ".join(sentences)
