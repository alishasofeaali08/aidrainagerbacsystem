import React from 'react';

/** Flood incidents and weather-derived risk are presented as one situation view. */
export default function FloodWeatherPage({ FloodMap, WeatherRisk, flood, reports, user }) {
  return (
    <div className="page-stack">
      <FloodMap flood={flood} reports={reports} user={user} />
      <WeatherRisk user={user} flood={flood} />
    </div>
  );
}
