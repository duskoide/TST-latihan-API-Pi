# Bandung Weather

A responsive single-page weather dashboard for Bandung, Indonesia, built with plain
**HTML, CSS, and vanilla JavaScript** — no frameworks, no libraries, no build step.

It fetches the current weather from the
[OpenWeather Current Weather API](https://openweathermap.org/current) and renders it
client-side.

## Files

| File | Responsibility |
| --- | --- |
| `index.html` | Semantic page structure, weather fields, status region, buttons |
| `style.css` | Layout, colours, responsive styles, loading/focus states |
| `script.js` | API request, response formatting, DOM updates, event handling |
| `config.js` | Your local API key (gitignored — see below) |
| `config.example.js` | Template to copy into `config.js` |

## Setup

1. Get a free API key at <https://home.openweathermap.org/api_keys>
   (new keys can take up to a couple of hours to activate).
2. Copy `config.example.js` to `config.js` and paste your key:

   ```js
   window.OPENWEATHER_API_KEY = "your-key-here";
   ```

3. Open `index.html` directly in a browser, or serve the folder locally:

   ```bash
   # any static file server works, e.g.:
   python3 -m http.server 8000
   # then visit http://localhost:8000/
   ```

`config.js` is gitignored. Note that any key used by a client-side app is visible
to visitors of the page — use a free/classroom key and rotate it if it is exposed.

## How it works (request → JSON → DOM)

1. On page load (and on **Refresh**), `script.js` builds the request URL with
   `URLSearchParams` (`q=Bandung`, `units=metric`, your `appid`) and calls `fetch`
   with an `AbortController`-based 10-second timeout.
2. The response is checked with `response.ok` (`fetch` does not reject on HTTP
   errors). HTTP 401/404/429, network failures, and timeouts each produce a
   friendly message plus a **Try again** action.
3. The JSON fields are mapped into the page with `textContent` only
   (never interpolated into HTML): `name`/`sys.country` → city,
   `main.temp`/`main.feels_like` → temperatures (°C), `main.humidity` → humidity (%),
   `wind.speed` → wind (m/s), `weather[0].description`/`.icon` → description and icon,
   and `dt` → observation time rendered in Bandung time (`Asia/Jakarta`) with
   `Intl.DateTimeFormat`.
4. Loading, success, and error states are announced through an
   `aria-live="polite"` status region. The Refresh button is disabled while a
   request is pending so requests cannot overlap.

## Features

- Current temperature, feels-like, humidity, wind speed, description, and icon
  (with a text fallback if the icon image fails to load).
- Observation time shown in Bandung local time, labelled as the API data timestamp.
- Loading / success / error states with retry; missing fields render as `--`
  instead of `undefined`.
- Responsive layout (≈360 px phones up to desktop), visible keyboard focus,
  accessible status messages.
- OpenWeather attribution in the footer.

Weather data provided by [OpenWeather](https://openweathermap.org/).
