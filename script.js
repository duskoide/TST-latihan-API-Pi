/* Bandung Weather — API requests, response formatting, DOM updates, events.
 * Vanilla JS only: fetch, URLSearchParams, Intl.DateTimeFormat, DOM methods.
 */

"use strict";

/* ---------- Configuration ---------- */

// The API key is intentionally NOT hard-coded here.
// It comes from config.js (gitignored). See config.example.js / README.md.
var API_KEY = window.OPENWEATHER_API_KEY || "YOUR_API_KEY";

var CITY = "Bandung";
var REQUEST_TIMEOUT_MS = 10000;

/* ---------- DOM references ---------- */

var refreshButton = document.getElementById("refresh-button");
var retryButton = document.getElementById("retry-button");
var statusRegion = document.getElementById("status-region");
var errorPanel = document.getElementById("error-panel");
var errorMessage = document.getElementById("error-message");
var weatherCard = document.getElementById("weather-card");
var cityName = document.getElementById("city-name");
var weatherIcon = document.getElementById("weather-icon");
var weatherIconFallback = document.getElementById("weather-icon-fallback");
var temperatureValue = document.getElementById("temperature-value");
var weatherDescription = document.getElementById("weather-description");
var feelsLikeValue = document.getElementById("feels-like-value");
var humidityValue = document.getElementById("humidity-value");
var windValue = document.getElementById("wind-value");
var observationTime = document.getElementById("observation-time");

/* ---------- State ---------- */

var requestPending = false;

/* ---------- Helpers ---------- */

/** Format a number with at most one decimal place, safely handling missing values. */
function formatNumber(value, suffix) {
  if (typeof value !== "number" || !isFinite(value)) {
    return "--";
  }
  var rounded = Math.round(value * 10) / 10;
  return suffix ? rounded + suffix : String(rounded);
}

/** Format a Unix timestamp (seconds) as Bandung local time (Asia/Jakarta). */
function formatBandungTime(unixSeconds) {
  if (typeof unixSeconds !== "number" || !isFinite(unixSeconds)) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(unixSeconds * 1000));
  } catch (err) {
    // Extremely old browsers without Intl time zone support.
    return new Date(unixSeconds * 1000).toUTCString();
  }
}

/** Map an API error code to a friendly, actionable message. */
function messageForError(status, bodyMessage) {
  if (status === 401) {
    return (
      "The API key was rejected (HTTP 401). Check that your key in config.js is valid " +
      "and activated — new OpenWeather keys can take up to a couple of hours to activate."
    );
  }
  if (status === 404) {
    return "The city could not be found (HTTP 404).";
  }
  if (status === 429) {
    return "Rate limit reached (HTTP 429). Please wait a minute and try again.";
  }
  if (status !== null) {
    return (
      "The weather service returned an unexpected response (HTTP " + status + ")." +
      (bodyMessage ? " " + bodyMessage : "")
    );
  }
  return "Could not reach the weather service. Check your internet connection and try again.";
}

/** Update the accessible status region. */
function setStatus(kind, text) {
  statusRegion.className = "status status--" + kind;
  statusRegion.textContent = text;
}

/* ---------- Weather rendering ---------- */

/** Safely render one weather observation into the card. */
function renderWeather(data) {
  // City / country
  var city = typeof data.name === "string" && data.name ? data.name : CITY;
  var country =
    data.sys && typeof data.sys.country === "string" && data.sys.country
      ? data.sys.country
      : "";
  cityName.textContent = country ? city + ", " + country : city;

  // Temperature / feels like (units=metric -> Celsius)
  // The main temperature's °C unit lives in the HTML next to this span.
  temperatureValue.textContent = formatNumber(data.main && data.main.temp);
  feelsLikeValue.textContent = formatNumber(data.main && data.main.feels_like, "\u00B0C");

  // Humidity (%) and wind (m/s)
  humidityValue.textContent = formatNumber(data.main && data.main.humidity, "%");
  windValue.textContent = formatNumber(data.wind && data.wind.speed, " m/s");

  // Description
  var description =
    data.weather && data.weather[0] && typeof data.weather[0].description === "string"
      ? data.weather[0].description
      : "";
  weatherDescription.textContent = description ? description : "No description available";

  // Icon with text fallback if the image fails to load
  var iconCode =
    data.weather && data.weather[0] && typeof data.weather[0].icon === "string"
      ? data.weather[0].icon
      : "";
  if (iconCode) {
    weatherIconFallback.hidden = true;
    weatherIcon.classList.remove("weather-card__icon--fallback");
    weatherIcon.style.display = "";
    weatherIcon.src = "https://openweathermap.org/img/wn/" + iconCode + "@2x.png";
    weatherIcon.alt = description ? description : "Weather icon";
  } else {
    showIconFallback();
  }

  // Observation time in Bandung time (this is the API data timestamp, not fetch time)
  var formatted = formatBandungTime(data.dt);
  if (formatted) {
    observationTime.textContent = formatted;
    observationTime.dateTime = new Date(data.dt * 1000).toISOString();
  } else {
    observationTime.textContent = "unavailable";
    observationTime.dateTime = "";
  }

  weatherCard.hidden = false;
}

/** Hide the icon <img> and show a text fallback when it cannot be displayed. */
function showIconFallback() {
  weatherIcon.removeAttribute("src");
  weatherIcon.style.display = "none";
  weatherIconFallback.hidden = false;
}

weatherIcon.addEventListener("error", function () {
  // Image failed to load (e.g. offline, blocked): degrade gracefully.
  showIconFallback();
});

/* ---------- API request ---------- */

function buildUrl() {
  var params = new URLSearchParams({
    q: CITY,
    appid: API_KEY,
    units: "metric",
  });
  return "https://api.openweathermap.org/data/2.5/weather?" + params.toString();
}

/** Fetch the weather once. Never throws; reports errors through the UI states. */
function loadWeather() {
  if (requestPending) {
    return; // prevent overlapping requests (double-click, Enter while pending)
  }
  if (API_KEY === "YOUR_API_KEY" || !API_KEY) {
    showError(
      "No API key configured. Copy config.example.js to config.js and paste your " +
        "OpenWeather API key there (see README.md)."
    );
    return;
  }

  requestPending = true;
  refreshButton.disabled = true;
  errorPanel.hidden = true;
  setStatus("loading", "Loading weather data\u2026");

  var controller = new AbortController();
  var timeoutId = setTimeout(function () {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  fetch(buildUrl(), { signal: controller.signal })
    .then(function (response) {
      // fetch does NOT reject on HTTP errors — check response.ok explicitly.
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (body) {
          if (!response.ok) {
            var error = new Error(messageForError(response.status, body && body.message));
            error.httpStatus = response.status;
            throw error;
          }
          return body;
        });
    })
    .then(function (data) {
      renderWeather(data);
      setStatus(
        "success",
        "Weather updated for " + (data.name || CITY) + "."
      );
    })
    .catch(function (err) {
      if (err && err.name === "AbortError") {
        showError(
          "The request timed out after " +
            REQUEST_TIMEOUT_MS / 1000 +
            " seconds. Check your connection and try again."
        );
      } else {
        showError(err && err.message ? err.message : "Unexpected error. Please try again.");
      }
    })
    .finally(function () {
      clearTimeout(timeoutId);
      requestPending = false;
      refreshButton.disabled = false;
    });
}

/** Show the error panel with a retry action. */
function showError(text) {
  setStatus("error", "Could not load weather data.");
  errorMessage.textContent = text;
  errorPanel.hidden = false;
  retryButton.focus();
}

/* ---------- Events ---------- */

refreshButton.addEventListener("click", loadWeather);
retryButton.addEventListener("click", loadWeather);

/* Fetch only on initial load; no automatic polling. */
loadWeather();
