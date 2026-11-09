"""
weatherapi.py — WeatherAPI.com client
Global weather service with radar data and minute-by-minute forecasts
"""
import httpx
from typing import Optional, Dict, List, Any
from .config import settings


class WeatherAPIClient:
    """Client for WeatherAPI.com including weather forecasts and radar data."""
    
    BASE_URL = "https://api.weatherapi.com/v1"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.weatherapi_key
        self.client = httpx.AsyncClient(timeout=10.0)
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
    
    def _check_api_key(self):
        """Check if API key is configured."""
        if not self.api_key:
            raise ValueError("WeatherAPI.com key not configured. Set WEATHERAPI_KEY in .env")
    
    async def get_current_weather(self, location: str, aqi: bool = False) -> Dict[str, Any]:
        """
        Get current weather conditions.
        
        Args:
            location: Location query (city name, lat,lon, etc.)
            aqi: Include air quality data
            
        Returns:
            Dictionary with current weather data
        """
        self._check_api_key()
        
        url = f"{self.BASE_URL}/current.json"
        params = {
            "key": self.api_key,
            "q": location,
            "aqi": "yes" if aqi else "no"
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting WeatherAPI current weather: {e}")
            return {}
    
    async def get_forecast(self, location: str, days: int = 7, hourly: bool = False) -> Dict[str, Any]:
        """
        Get weather forecast.
        
        Args:
            location: Location query (city name, lat,lon, etc.)
            days: Number of days to forecast (1-14)
            hourly: Include hourly data
            
        Returns:
            Dictionary with forecast data
        """
        self._check_api_key()
        
        url = f"{self.BASE_URL}/forecast.json"
        params = {
            "key": self.api_key,
            "q": location,
            "days": days,
            "aqi": "no",
            "alerts": "no"
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting WeatherAPI forecast: {e}")
            return {}
    
    async def get_radar(self, location: str) -> Dict[str, Any]:
        """
        Get radar imagery data (Pro+ plan required).
        
        Args:
            location: Location query (lat,lon)
            
        Returns:
            Dictionary with radar tile URLs and frames
        """
        self._check_api_key()
        
        url = f"{self.BASE_URL}/radar.json"
        params = {
            "key": self.api_key,
            "q": location
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting WeatherAPI radar: {e}")
            return {}
    
    async def get_history(self, location: str, date: str) -> Dict[str, Any]:
        """
        Get historical weather data.
        
        Args:
            location: Location query
            date: Date in yyyy-MM-dd format
            
        Returns:
            Dictionary with historical weather data
        """
        self._check_api_key()
        
        url = f"{self.BASE_URL}/history.json"
        params = {
            "key": self.api_key,
            "q": location,
            "dt": date
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting WeatherAPI history: {e}")
            return {}
    
    def parse_forecast_for_risk(self, forecast_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse WeatherAPI.com forecast data into a format compatible with the risk engine.
        
        Args:
            forecast_data: Raw forecast data from WeatherAPI.com
            
        Returns:
            Dictionary with parsed forecast data including rain estimates
        """
        if not forecast_data or "forecast" not in forecast_data:
            return {"dates": [], "rain_mm": [], "prob_pct": [], "total_7d": 0, "ok": False}
        
        forecast_days = forecast_data["forecast"].get("forecastday", [])
        
        dates = []
        rain_mm = []
        prob_pct = []
        
        for day in forecast_days:
            date = day.get("date", "")
            dates.append(date)
            
            day_data = day.get("day", {})
            
            # WeatherAPI provides total precipitation in mm
            total_precip = day_data.get("totalprecip_mm", 0) or 0
            rain_mm.append(round(total_precip, 1))
            
            # Daily chance of rain
            daily_chance = day_data.get("daily_chance_of_rain", 0) or 0
            prob_pct.append(daily_chance)
        
        total_7d = sum(rain_mm)
        
        return {
            "dates": dates,
            "rain_mm": rain_mm,
            "prob_pct": prob_pct,
            "total_7d": round(total_7d, 1),
            "ok": True,
            "source": "weatherapi"
        }


# Singleton instance for reuse
_wapi_client: Optional[WeatherAPIClient] = None


async def get_weatherapi_client() -> WeatherAPIClient:
    """Get or create WeatherAPI.com client singleton."""
    global _wapi_client
    if _wapi_client is None:
        _wapi_client = WeatherAPIClient()
    return _wapi_client
