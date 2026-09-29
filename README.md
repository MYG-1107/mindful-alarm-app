# ZenTimer 🧘

A background-resilient, web-based meditation and focus timer built with native HTML5, CSS3, ES6+ JavaScript, and Web Workers.

## Key Features
* **Throttling-Proof Background Engine:** Uses a dedicated Web Worker running `Date.now()` timestamp calculations to prevent delay when tabs are backgrounded or screen locks.
* **Procedural Meditation Chime:** Generates a warm bell sound natively via the Web Audio API without requiring external audio files.
* **Voice Speech Alerts:** Uses native `SpeechSynthesis` to speak customizable completion messages.
* **Desktop Notifications:** Delivers OS-level notification popups when time expires.
* **Screen Wake Lock:** Prevents screen timeout during active meditation sessions.

## Project Structure
```text
zen-timer-web/
├── index.html          # HTML structure
├── css/
│   └── styles.css      # Dark mode styling & layout
├── js/
│   ├── app.js          # Controller & Web API integrations
│   └── timer-worker.js # Dedicated Web Worker thread
├── .github/
│   └── workflows/
│       └── deploy.yml  # Automated deployment workflow
└── README.md
