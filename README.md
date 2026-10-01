# ZenTimer 🧘

ZenTimer is a local-first web application for structured focus, mindfulness and repeatable routines.

## Customer goal

The app is designed to remove the friction around a simple countdown: repeated timer setup, disruptive completion alerts, noisy environments, and the desire to keep personal progress private. The first screen prioritizes starting a session; advanced controls are grouped below it.

## Current capabilities

- Single timers and multi-stage routines with repeat loops.
- Morning Reset, Pomodoro x4 and Deep Work templates.
- Web Worker timing based on timestamps.
- Procedural ambient audio with final-session fade.
- Mid-session chimes, voice completion and silent visual completion.
- Notifications, Media Session and Screen Wake Lock where supported.
- IndexedDB sessions, routines, streaks, heatmaps and reflection notes.
- Markdown and CSV export.
- Local MP3/WAV custom bell storage.
- Full-screen 4-7-8 Zen breathing visual.
- PWA install metadata and offline app-shell caching after first successful cache install.
- Connection/status feedback, graceful storage warnings and friendly 404/offline pages.
- Dedicated `how-it-works.html` guide with problem, solution, architecture, real-world users, limitations and roadmap.

## Reliability boundary

ZenTimer is a browser application, not a native safety-critical alarm service. Browser, mobile operating-system, battery-saver and permission policies can affect audio, notifications, Wake Lock and background execution. Do not use it as the sole mechanism for medical, emergency, industrial or other safety-critical timing.

## Project structure

```text
mindful-alarm-app/
├── index.html
├── how-it-works.html
├── 404.html
├── offline.html
├── manifest.json
├── sw.js
├── privacy.html
├── terms.html
├── css/styles.css
├── js/app.js
├── js/reliability.js
├── js/timer-worker.js
├── assets/icons/
└── .github/workflows/deploy.yml
```

## Run locally

Use a static server because service workers require HTTPS or localhost.

```bash
python -m http.server 8000
```

## Deployment

Push to `main`; the included GitHub Actions workflow deploys the repository to GitHub Pages.

## Privacy

Session history, saved routines and custom audio are designed to remain in browser storage. Hosting providers can still maintain infrastructure logs according to their own policies. See `privacy.html`.

## License

MIT.
