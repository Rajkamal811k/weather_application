import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

function App() {
  const [query, setQuery] = useState("");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unit, setUnit] = useState("C"); // "C" or "F"
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  /* ── Convert temperature ── */
  function displayTemp(celsius) {
    if (unit === "F") {
      return `${((celsius * 9) / 5 + 32).toFixed(1)}°F`;
    }
    return `${celsius}°C`;
  }

  /* ── Fetch weather by lat/lon ── */
  async function fetchWeatherByCoords(lat, lon, cityName, country) {
    setLoading(true);
    setError("");
    setWeather(null);

    try {
      const wxRes = await fetch(
        `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current_weather=true`
      );
      const wxData = await wxRes.json();

      if (!wxData.current_weather) {
        throw new Error("Unable to retrieve weather data. Please try again.");
      }

      setWeather({
        city: cityName,
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

  /* ── Search by city name ── */
  async function fetchWeather() {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setWeather(null);
    setSuggestions([]);
    setShowSuggestions(false);

    try {
      const geoRes = await fetch(
        `${GEOCODING_URL}?name=${encodeURIComponent(trimmed)}&count=1&language=en`
      );
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`City "${trimmed}" not found. Try another name.`);
      }

      const { latitude, longitude, name, country } = geoData.results[0];
      await fetchWeatherByCoords(latitude, longitude, name, country);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  /* ── GPS Location ── */
  async function fetchByGPS() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading(true);
    setError("");
    setWeather(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Reverse-geocode to get city name
          const revRes = await fetch(
            `${GEOCODING_URL}?name=&count=1&language=en&latitude=${latitude}&longitude=${longitude}`
          );
          const revData = await revRes.json();

          let cityName = "Your Location";
          let country = "";

          // Open-Meteo doesn't have a reverse geocoding endpoint,
          // so we use a free reverse geocoder instead
          try {
            const nominatimRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`
            );
            const nomData = await nominatimRes.json();
            cityName =
              nomData.address?.city ||
              nomData.address?.town ||
              nomData.address?.village ||
              nomData.address?.county ||
              "Your Location";
            country = nomData.address?.country || "";
          } catch {
            // If reverse geocoding fails, fall back to generic label
          }

          setQuery(cityName);
          await fetchWeatherByCoords(latitude, longitude, cityName, country);
        } catch (err) {
          setError(err.message);
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location permission denied. Please allow access in your browser.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location information unavailable.");
            break;
          case err.TIMEOUT:
            setError("Location request timed out.");
            break;
          default:
            setError("An unknown error occurred while fetching location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  /* ── Autocomplete suggestions ── */
  const fetchSuggestions = useCallback(async (value) => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const res = await fetch(
        `${GEOCODING_URL}?name=${encodeURIComponent(value.trim())}&count=5&language=en`
      );
      const data = await res.json();

      if (data.results && data.results.length > 0) {
        setSuggestions(data.results);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  function handleInputChange(e) {
    const value = e.target.value;
    setQuery(value);

    // Debounce the suggestions fetch (300ms)
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  }

  function handleSuggestionClick(suggestion) {
    setQuery(suggestion.name);
    setSuggestions([]);
    setShowSuggestions(false);
    fetchWeatherByCoords(
      suggestion.latitude,
      suggestion.longitude,
      suggestion.name,
      suggestion.country || ""
    );
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      setShowSuggestions(false);
      fetchWeather();
    }
  }

  /* ── Close suggestions on outside click ── */
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="dashboard__header">
        <h1 className="dashboard__title">Weather Dashboard</h1>
        <p className="dashboard__subtitle">
          Search any city or use your GPS for real-time weather
        </p>
      </header>

      {/* ── Unit Toggle ── */}
      <div className="unit-toggle" id="unit-toggle">
        <button
          className={`unit-toggle__btn ${unit === "C" ? "unit-toggle__btn--active" : ""}`}
          onClick={() => setUnit("C")}
          id="unit-celsius"
        >
          °C
        </button>
        <button
          className={`unit-toggle__btn ${unit === "F" ? "unit-toggle__btn--active" : ""}`}
          onClick={() => setUnit("F")}
          id="unit-fahrenheit"
        >
          °F
        </button>
      </div>

      {/* ── Search Bar ── */}
      <div className="search-row">
        <div className="search-bar">
          <div className="search-bar__input-wrapper">
            <input
              ref={inputRef}
              id="city-input"
              className="search-bar__input"
              type="text"
              placeholder="Enter city name…"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
            />

            {/* ── Suggestions Dropdown ── */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="suggestions" ref={suggestionsRef} id="suggestions-list">
                {suggestions.map((s, idx) => (
                  <li
                    key={`${s.id}-${idx}`}
                    className="suggestions__item"
                    onClick={() => handleSuggestionClick(s)}
                  >
                    <span className="suggestions__city">{s.name}</span>
                    <span className="suggestions__meta">
                      {[s.admin1, s.country].filter(Boolean).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            id="search-button"
            className="search-bar__button"
            onClick={fetchWeather}
          >
            Search
          </button>
        </div>

        {/* ── GPS Button ── */}
        <button
          id="gps-button"
          className="gps-button"
          onClick={fetchByGPS}
          disabled={gpsLoading}
          title="Use my location"
        >
          {gpsLoading ? (
            <span className="gps-button__spinner" />
          ) : (
            <svg
              className="gps-button__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          )}
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
              <div className="stat__value">{displayTemp(weather.temperature)}</div>
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
