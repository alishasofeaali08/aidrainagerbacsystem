"""
accuweather.py — AccuWeather API client for radar and weather data
"""
import httpx
from typing import Optional, Dict, List, Any
from .config import settings


class AccuWeatherClient:
    """Client for AccuWeather API including radar and weather data."""
    
    BASE_URL = "https://api.accuweather.com"
    DEV_BASE_URL = "https://apidev.accuweather.com"
    
    def __init__(self, api_key: Optional[str] = None, use_dev: bool = False):
        self.api_key = api_key or settings.accuweather_api_key
        self.base_url = self.DEV_BASE_URL if use_dev else self.BASE_URL
        self.client = httpx.AsyncClient(timeout=10.0)
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
    
    def _check_api_key(self):
        """Check if API key is configured."""
        if not self.api_key:
            raise ValueError("AccuWeather API key not configured. Set ACCUWEATHER_API_KEY in .env")
    
    async def get_location_key(self, lat: float, lon: float) -> Optional[str]:
        """
        Get AccuWeather location key from coordinates.
        
        Args:
            lat: Latitude
            lon: Longitude
            
        Returns:
            Location key string or None if not found
        """
        self._check_api_key()
        
        url = f"{self.base_url}/locations/v1/cities/geoposition/search"
        params = {
            "apikey": self.api_key,
            "q": f"{lat},{lon}",
            "language": "en-us"
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data and isinstance(data, list) and len(data) > 0:
                return data[0].get("Key")
            elif data and isinstance(data, dict):
                return data.get("Key")
            return None
        except Exception as e:
            print(f"Error getting location key: {e}")
            return None
    
    async def get_current_conditions(self, location_key: str) -> Dict[str, Any]:
        """
        Get current weather conditions for a location.
        
        Args:
            location_key: AccuWeather location key
            
        Returns:
            Dictionary with current conditions data
        """
        self._check_api_key()
        
        url = f"{self.base_url}/currentconditions/v1/{location_key}"
        params = {
            "apikey": self.api_key,
            "language": "en-us",
            "details": "true"
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data and isinstance(data, list) and len(data) > 0:
                return data[0]
            return {}
        except Exception as e:
            print(f"Error getting current conditions: {e}")
            return {}
    
    async def get_forecast(self, location_key: str, days: int = 5) -> Dict[str, Any]:
        """
        Get daily forecast for a location.
        
        Args:
            location_key: AccuWeather location key
            days: Number of days to forecast (1-15)
            
        Returns:
            Dictionary with forecast data
        """
        self._check_api_key()
        
        url = f"{self.base_url}/forecasts/v1/daily/{days}day/{location_key}"
        params = {
            "apikey": self.api_key,
            "language": "en-us",
            "details": "true",
            "metric": "true"
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting forecast: {e}")
            return {}
    
    async def get_radar_imagery(self, location_key: str, resolution: str = "1024x1024") -> Dict[str, Any]:
        """
        Get radar and satellite imagery for a location.
        
        Args:
            location_key: AccuWeather location key
            resolution: Image resolution (480x480, 640x480, 1024x1024)
            
        Returns:
            Dictionary with radar and satellite image URLs
        """
        self._check_api_key()
        
        url = f"{self.base_url}/imagery/v1/maps/radsat/{resolution}/{location_key}"
        params = {
            "apikey": self.api_key,
            "language": "en-us"
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting radar imagery: {e}")
            return {}
    
    async def get_radar_tiles(self, zoom: int, x: int, y: int, timestamp: Optional[str] = None) -> str:
        """
        Get radar tile for map overlay (ZYX format - most recent).
        
        Args:
            zoom: Zoom level (0-18)
            x: X coordinate
            y: Y coordinate
            timestamp: Optional timestamp in format yyyy-mm-ddThh:mm:ssZ
            
        Returns:
            URL to the radar tile image
        """
        self._check_api_key()
        
        if timestamp:
            url = f"{self.base_url}/maps/v1/radar/globalSIR/zxy/{timestamp}/{zoom}/{x}/{y}.png"
        else:
            url = f"{self.base_url}/maps/v1/radar/globalSIR/zxy/tile/{zoom}/{x}/{y}.png"
        
        params = {
            "apikey": self.api_key,
            "colortable": "on",
            "display_mode": "radar"
        }
        
        try:
            response = await self.client.get(url, params=params, follow_redirects=False)
            if response.status_code == 302:
                return response.headers.get("location", "")
            return url
        except Exception as e:
            print(f"Error getting radar tile: {e}")
            return ""
    
    async def get_radar_products(self, locations: bool = False) -> List[Dict[str, Any]]:
        """
        List available radar products.
        
        Args:
            locations: Include bounding boxes for each product
            
        Returns:
            List of radar products
        """
        self._check_api_key()
        
        url = f"{self.base_url}/maps/v1/radar/globalSIR/request_products"
        params = {
            "apikey": self.api_key,
            "locations": str(locations).lower()
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f"Error getting radar products: {e}")
            return []


# Singleton instance for reuse
_client: Optional[AccuWeatherClient] = None


async def get_accuweather_client() -> AccuWeatherClient:
    """Get or create AccuWeather client singleton."""
    global _client
    if _client is None:
        _client = AccuWeatherClient()
    return _client
