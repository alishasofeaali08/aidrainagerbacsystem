"""
ai.py — heuristic + weather-aware flood risk engine for Air-Eyes
"""
import urllib.request
import json
import math
from typing import Optional

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


# ── SAM 2 (Segment Anything Model 2) Integration Mock ───────────────────────
def segment_water_sam2(image_bytes: bytes) -> dict:
    """
    Mock implementation of Meta's SAM 2 for water segmentation.
    In a real implementation, this would use the 'sam2' library:
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor
    
    predictor = SAM2ImagePredictor(build_sam2(model_cfg, checkpoint))
    masks, scores, logits = predictor.predict(image)
    """
    # Simulate high-precision segmentation analysis
    # SAM 2 is excellent at identifying boundaries even in turbid water
    import random
    
    # We simulate the result of a SAM 2 mask analysis
    # For the demo, we assume the input is analyzed and water is detected
    detected_mask_area = random.uniform(0.1, 0.9) # Simulated area of the mask
    confidence = random.uniform(0.85, 0.98) # SAM 2 usually has high confidence
    
    return {
        "model": "SAM 2 (Segment Anything Model 2)",
        "segmentation_mask_present": True,
        "water_area_ratio": round(detected_mask_area, 2),
        "confidence": round(confidence, 2),
        "inference_time_ms": random.randint(50, 200),
        "status": "success"
    }


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
def _fetch_rain_forecast(lat: float, lon: float, provider: str = None) -> dict:
    """
    Fetch 7-day daily precipitation sum from weather provider.
    Provider priority: metmalaysia > accuweather > weatherapi > openmeteo
    Returns {"dates": [...], "rain_mm": [...], "total_7d": float}
    """
    from .config import settings
    import asyncio
    
    # Determine provider to use
    if provider is None:
        provider = settings.preferred_weather_provider or "openmeteo"
    
    # Try MET Malaysia first (best for Malaysia)
    if provider == "metmalaysia" and settings.metmalaysia_api_token:
        try:
            from .metmalaysia import get_metmalaysia_client
            client = asyncio.run(get_metmalaysia_client())
            # Use Open Data API (no auth required for basic forecast)
            forecast_data = asyncio.run(client.get_open_data_forecast(limit=7))
            parsed = client.parse_forecast_for_risk(forecast_data)
            if parsed.get("ok"):
                return parsed
        except Exception as e:
            print(f"MET Malaysia fetch failed: {e}")
    
    # Try AccuWeather
    if provider in ["accuweather", "metmalaysia"] and settings.accuweather_api_key:
        try:
            from .accuweather import get_accuweather_client
            client = asyncio.run(get_accuweather_client())
            location_key = asyncio.run(client.get_location_key(lat, lon))
            
            if location_key:
                forecast = asyncio.run(client.get_forecast(location_key, days=7))
                if forecast and "DailyForecasts" in forecast:
                    daily_forecasts = forecast["DailyForecasts"]
                    dates = []
                    rain_mm = []
                    prob_pct = []
                    
                    for day in daily_forecasts:
                        dates.append(day.get("Date", ""))
                        day_rain = day.get("Day", {}).get("Precipitation", {}).get("Value", 0) or 0
                        night_rain = day.get("Night", {}).get("Precipitation", {}).get("Value", 0) or 0
                        rain_mm.append(round(day_rain + night_rain, 1))
                        prob = day.get("Day", {}).get("PrecipitationProbability", 0) or 0
                        prob_pct.append(prob)
                    
                    return {
                        "dates": dates,
                        "rain_mm": rain_mm,
                        "prob_pct": prob_pct,
                        "total_7d": round(sum(rain_mm), 1),
                        "ok": True,
                        "source": "accuweather"
                    }
        except Exception as e:
            print(f"AccuWeather fetch failed: {e}")
    
    # Try WeatherAPI.com
    if provider in ["weatherapi", "accuweather", "metmalaysia"] and settings.weatherapi_key:
        try:
            from .weatherapi import get_weatherapi_client
            client = asyncio.run(get_weatherapi_client())
            location_query = f"{lat},{lon}"
            forecast_data = asyncio.run(client.get_forecast(location_query, days=7))
            parsed = client.parse_forecast_for_risk(forecast_data)
            if parsed.get("ok"):
                return parsed
        except Exception as e:
            print(f"WeatherAPI.com fetch failed: {e}")
    
    # Fallback to Open-Meteo (free, no API key)
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
            "source": "openmeteo"
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


def weather_risk_for_state(state: str, active_reports: int, provider: str = None) -> dict:
    """
    Compute combined weather + drainage load risk for one state.
    active_reports = count of non-resolved reports in that state.
    provider = weather provider to use (metmalaysia, accuweather, weatherapi, openmeteo)
    """
    coords = STATE_CAPITALS.get(state)
    if not coords:
        return {"state": state, "error": "unknown state"}

    forecast = _fetch_rain_forecast(*coords, provider=provider)

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
        "data_source":    forecast.get("source", "openmeteo"),
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


# ── Route flood risk analysis ─────────────────────────────────────────────────
def calculate_segment_flood_risk(lat: float, lon: float, reports: list) -> float:
    """
    Calculate flood risk for a specific route segment based on nearby reports.
    Returns a risk score between 0 and 1.
    """
    if not reports:
        return 0.0
    
    # Find reports within 500 meters of the segment
    nearby_reports = []
    for report in reports:
        report_lat = report.get('latitude')
        report_lon = report.get('longitude')
        if report_lat is None or report_lon is None:
            continue
        
        # Calculate distance using Haversine formula (simplified)
        distance = math.sqrt((lat - report_lat)**2 + (lon - report_lon)**2) * 111000  # Approximate meters
        if distance <= 500:  # Within 500 meters
            nearby_reports.append(report)
    
    if not nearby_reports:
        return 0.0
    
    # Calculate weighted risk based on proximity and report risk
    total_weight = 0
    weighted_risk = 0
    
    for report in nearby_reports:
        report_lat = report.get('latitude')
        report_lon = report.get('longitude')
        distance = math.sqrt((lat - report_lat)**2 + (lon - report_lon)**2) * 111000
        
        # Weight decreases with distance
        weight = 1 - (distance / 500)
        report_risk = report.get('risk_score', report.get('flood_risk', 0.5))
        
        weighted_risk += weight * report_risk
        total_weight += weight
    
    if total_weight == 0:
        return 0.0
    
    return round(min(weighted_risk / total_weight, 1.0), 3)


def analyze_route_flood_risk(route_coordinates: list, reports: list) -> dict:
    """
    Analyze flood risk along a route by checking segments.
    route_coordinates: list of [lat, lon] pairs
    reports: list of report dictionaries with latitude, longitude, risk_score/flood_risk
    Returns route analysis with segment risks and overall recommendation.
    """
    if not route_coordinates or len(route_coordinates) < 2:
        return {"error": "Invalid route coordinates"}
    
    segment_risks = []
    total_risk = 0
    high_risk_segments = 0
    
    # Analyze each segment (sample every 5th coordinate to reduce API calls)
    step = max(1, len(route_coordinates) // 20)  # Sample up to 20 points
    
    for i in range(0, len(route_coordinates), step):
        lat, lon = route_coordinates[i]
        risk = calculate_segment_flood_risk(lat, lon, reports)
        segment_risks.append({
            "index": i,
            "lat": lat,
            "lon": lon,
            "risk": risk
        })
        total_risk += risk
        if risk >= 0.6:
            high_risk_segments += 1
    
    avg_risk = total_risk / len(segment_risks) if segment_risks else 0
    
    # Generate route recommendation
    if avg_risk >= 0.6:
        recommendation = "⚠️ High flood risk along this route. Consider alternative paths or delay travel."
        risk_level = "high"
    elif avg_risk >= 0.35:
        recommendation = "⚡ Moderate flood risk. Proceed with caution and monitor weather conditions."
        risk_level = "moderate"
    else:
        recommendation = "✅ Low flood risk. Route is generally safe for travel."
        risk_level = "low"
    
    return {
        "overall_risk": round(avg_risk, 3),
        "risk_level": risk_level,
        "recommendation": recommendation,
        "high_risk_segments": high_risk_segments,
        "total_segments": len(segment_risks),
        "segment_risks": segment_risks
    }
