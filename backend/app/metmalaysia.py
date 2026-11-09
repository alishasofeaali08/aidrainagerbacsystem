"""
metmalaysia.py — MET Malaysia (Malaysian Meteorological Department) API client
Official Malaysian weather service with radar and forecast data
"""
import httpx
from typing import Optional, Dict, List, Any
from .config import settings


class MetMalaysiaClient:
    """Client for MET Malaysia API including weather forecasts and radar data."""
    
    BASE_URL = "https://api.met.gov.my/v2.1/"
    OPEN_DATA_URL = "https://api.data.gov.my/weather/"
    
    def __init__(self, api_token: Optional[str] = None):
        self.api_token = api_token or settings.metmalaysia_api_token
        self.client = httpx.AsyncClient(timeout=10.0)
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
    
    def _check_api_token(self):
        """Check if API token is configured."""
        if not self.api_token:
            raise ValueError("MET Malaysia API token not configured. Set METMALAYSIA_API_TOKEN in .env")
    
    async def _get_headers(self) -> Dict[str, str]:
        """Get authorization headers."""
        self._check_api_token()
        return {"Authorization": f"METToken {self.api_token}"}
    
    async def get_forecast(self, location_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get 7-day weather forecast from MET Malaysia.
        
        Args:
            location_id: Optional location ID (e.g., "St001" for state, "Ds001" for district)
            
        Returns:
            Dictionary with forecast data
        """
        self._check_api_token()
        
        url = f"{self.BASE_URL}weather/forecast"
        params = {}
        if location_id:
            params["location_id"] = location_id
        
        try:
            headers = await self._get_headers()
            response = await self.client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting MET Malaysia forecast: {e}")
            return {}
    
    async def get_forecast_by_city(self, city: str) -> Dict[str, Any]:
        """
        Get weather forecast by city name.
        
        Args:
            city: City name in Malaysia
            
        Returns:
            Dictionary with forecast data
        """
        self._check_api_token()
        
        url = f"{self.BASE_URL}weather/forecast/by-city"
        params = {"city": city}
        
        try:
            headers = await self._get_headers()
            response = await self.client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting MET Malaysia forecast by city: {e}")
            return {}
    
    async def get_current_observation(self, location_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get current weather observations.
        
        Args:
            location_id: Optional location ID
            
        Returns:
            Dictionary with current weather data
        """
        self._check_api_token()
        
        url = f"{self.BASE_URL}weather/current"
        params = {}
        if location_id:
            params["location_id"] = location_id
        
        try:
            headers = await self._get_headers()
            response = await self.client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting MET Malaysia current observation: {e}")
            return {}
    
    async def get_warnings(self) -> Dict[str, Any]:
        """
        Get active weather warnings.
        
        Returns:
            Dictionary with warning data
        """
        self._check_api_token()
        
        url = f"{self.BASE_URL}weather/warning"
        
        try:
            headers = await self._get_headers()
            response = await self.client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting MET Malaysia warnings: {e}")
            return {}
    
    async def get_earthquake_warnings(self) -> Dict[str, Any]:
        """
        Get earthquake warnings.
        
        Returns:
            Dictionary with earthquake warning data
        """
        self._check_api_token()
        
        url = f"{self.BASE_URL}weather/warning/earthquake"
        
        try:
            headers = await self._get_headers()
            response = await self.client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting MET Malaysia earthquake warnings: {e}")
            return {}
    
    async def get_open_data_forecast(self, location_filter: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
        """
        Get forecast from Malaysia Open Data API (no authentication required).
        This is the public API endpoint from data.gov.my.
        
        Args:
            location_filter: Optional location filter (e.g., "St@location__location_id" for states)
            limit: Maximum number of results
            
        Returns:
            Dictionary with forecast data
        """
        url = f"{self.OPEN_DATA_URL}forecast"
        params = {"limit": limit}
        
        if location_filter:
            params["contains"] = location_filter
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting Malaysia Open Data forecast: {e}")
            return {}
    
    async def get_open_data_warnings(self) -> Dict[str, Any]:
        """
        Get weather warnings from Malaysia Open Data API (no authentication required).
        
        Returns:
            Dictionary with warning data
        """
        url = f"{self.OPEN_DATA_URL}warning"
        
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting Malaysia Open Data warnings: {e}")
            return {}
    
    def parse_forecast_for_risk(self, forecast_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse MET Malaysia forecast data into a format compatible with the risk engine.
        
        Args:
            forecast_data: Raw forecast data from MET Malaysia API
            
        Returns:
            Dictionary with parsed forecast data including rain estimates
        """
        if not forecast_data:
            return {"dates": [], "rain_mm": [], "prob_pct": [], "total_7d": 0, "ok": False}
        
        # Handle both API v2.1 and Open Data formats
        forecasts = []
        
        if "results" in forecast_data:
            # Open Data format
            forecasts = forecast_data.get("results", [])
        elif isinstance(forecast_data, list):
            # Direct list format
            forecasts = forecast_data
        elif "forecast" in forecast_data:
            # API v2.1 format
            forecasts = forecast_data.get("forecast", [])
        
        dates = []
        rain_mm = []
        prob_pct = []
        
        # Keywords indicating rain in Malay/English
        rain_keywords = ["hujan", "rain", "ribut", "storm", "lebat", "heavy", "petir", "thunder"]
        
        for day in forecasts:
            date = day.get("date", "")
            dates.append(date)
            
            # Extract rain information from forecast text
            # MET Malaysia provides text forecasts, we need to estimate rain
            morning = day.get("morning_forecast", "").lower()
            afternoon = day.get("afternoon_forecast", "").lower()
            night = day.get("night_forecast", "").lower()
            summary = day.get("summary_forecast", "").lower()
            
            all_forecasts = f"{morning} {afternoon} {night} {summary}"
            
            # Estimate rain based on keywords
            rain_estimate = 0
            if any(kw in all_forecasts for kw in rain_keywords):
                # Base estimate for any rain mention
                rain_estimate = 5
                # Increase for heavy rain/storm keywords
                if any(kw in all_forecasts for kw in ["lebat", "heavy", "ribut", "storm"]):
                    rain_estimate = 15
                if any(kw in all_forecasts for kw in ["petir", "thunder"]):
                    rain_estimate = 20
            
            rain_mm.append(rain_estimate)
            
            # Estimate probability based on forecast certainty
            prob = 30 if rain_estimate > 0 else 10
            if "di satu dua tempat" in all_forecasts:
                prob = 40
            if "di beberapa tempat" in all_forecasts:
                prob = 60
            
            prob_pct.append(prob)
        
        total_7d = sum(rain_mm)
        
        return {
            "dates": dates,
            "rain_mm": rain_mm,
            "prob_pct": prob_pct,
            "total_7d": round(total_7d, 1),
            "ok": True,
            "source": "metmalaysia"
        }


# Singleton instance for reuse
_met_client: Optional[MetMalaysiaClient] = None


async def get_metmalaysia_client() -> MetMalaysiaClient:
    """Get or create MET Malaysia client singleton."""
    global _met_client
    if _met_client is None:
        _met_client = MetMalaysiaClient()
    return _met_client
