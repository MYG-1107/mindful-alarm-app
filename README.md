# ZenTimer 🧘

ZenTimer is a local-first mindfulness, focus and routine timer built with standard HTML, CSS and JavaScript. It is designed to work well on desktop and mobile, including low-connectivity environments after the first cached visit.

## Included productivity features

- Multi-stage routine builder with reusable blocks, templates, custom ordering and repeat loops.
- Pomodoro-style sequence template (`25m deep work → 5m break`, repeated 4 times).
- PWA manifest and service worker caching for offline launches.
- Procedural ambient audio using Web Audio API: Brown Noise, Gentle Rain and a 432/436 Hz binaural mode.
- Automatic ambient fade during the final 10 seconds of the total session.
- IndexedDB session history, focus ratings, reflection notes, total hours and streak calculations.
- Weekly and six-month SVG heatmaps.
- Keyboard shortcuts: Space start/pause, R reset, Esc Zen Mode and 1–6 quick presets.
- Full-screen Zen Mode with a 4-7-8 breathing visual.
- Repeating mid-session interval chimes.
- Silent visual completion alert that pulses the screen and changes the browser tab title.
- Post-session reflection with Markdown and CSV export.
- Local `.mp3` / `.wav` custom bell storage as an IndexedDB Blob.
- Screen Wake Lock and browser notifications where supported.

## Project structure

```text
mindful-alarm-app/
├── index.html
├── manifest.json
├── sw.js
├── privacy.html
├── terms.html
├── LICENSE
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   └── timer-worker.js
├── assets/
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
└── .github/
    └── workflows/
        └── deploy.yml
```

## Run locally

Open the folder with a static server (recommended for service workers), for example through GitHub Codespaces or:

```bash
python -m http.server 8000
```

Then open the forwarded port.

## Privacy

No third-party analytics script is bundled. Session history, routines and custom audio are kept in the browser's IndexedDB/Local Storage. See `privacy.html` for the app-level privacy model.

## License

MIT.
