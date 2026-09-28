import { useState } from "react";
import "./App.css";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

function App() {
  const [query, setQuery] = useState("");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchWeather() {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setWeather(null);

    try {
      /* 1️⃣  Geocode the city name → lat/lon */
      const geoRes = await fetch(
        `${GEOCODING_URL}?name=${encodeURIComponent(trimmed)}&count=1&language=en`
      );
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`City "${trimmed}" not found. Try another name.`);
      }

      const { latitude, longitude, name, country } = geoData.results[0];

      /* 2️⃣  Fetch current weather for those coordinates */
      const wxRes = await fetch(
        `${WEATHER_URL}?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );
      const wxData = await wxRes.json();

      if (!wxData.current_weather) {
        throw new Error("Unable to retrieve weather data. Please try again.");
      }

      setWeather({
        city: name,
        country: country || "",
        temperature: wxData.current_weather.temperature,
        windSpeed: wxData.current_weather.windspeed,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") fetchWeather();
  }

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="dashboard__header">
        <h1 className="dashboard__title">Weather Dashboard</h1>
        <p className="dashboard__subtitle">
          Search any city for real-time weather
        </p>
      </header>

      {/* ── Search Bar ── */}
      <div className="search-bar">
        <input
          id="city-input"
          className="search-bar__input"
          type="text"
          placeholder="Enter city name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          id="search-button"
          className="search-bar__button"
          onClick={fetchWeather}
        >
          Search
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="loading" id="loading-indicator">
          <div className="loading__spinner" />
          <span className="loading__text">Fetching weather data…</span>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="error-message" id="error-message">
          {error}
        </div>
      )}

      {/* ── Weather Card ── */}
      {weather && (
        <div className="weather-card" id="weather-card">
          <h2 className="weather-card__city">{weather.city}</h2>
          <p className="weather-card__country">{weather.country}</p>

          <div className="weather-card__stats">
            <div className="stat" id="stat-temperature">
              <div className="stat__icon">🌡️</div>
              <div className="stat__value">{weather.temperature}°C</div>
              <div className="stat__label">Temperature</div>
            </div>

            <div className="stat" id="stat-wind">
              <div className="stat__icon">💨</div>
              <div className="stat__value">{weather.windSpeed} km/h</div>
              <div className="stat__label">Wind Speed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
