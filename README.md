# ZenTimer 🧘

> A local-first focus and mindfulness system—not just a countdown timer.

ZenTimer is a local-first mindfulness, focus and routine timer built with standard HTML, CSS and JavaScript. It is designed to work well on desktop and mobile, including low-connectivity environments after the first cached visit.

## Why this project exists

ZenTimer addresses a practical workflow problem: people often need a sequence of focus, recovery and reflection blocks, but ordinary timers make them repeatedly reconfigure sessions and choose between noisy alerts, manual tracking or cloud-based history. ZenTimer combines those steps into one browser-native flow while keeping the user in control of local data.

See the dedicated product/system guide: `how-it-works.html`.

## Included productivity features

- Multi-stage routine builder with reusable blocks, templates, custom ordering and repeat loops.
- Pomodoro-style sequence template (`25m deep work → 5m break`, repeated 4 times).
- PWA manifest and same-origin service worker caching for offline launches after the application shell has been cached.
- Procedural ambient audio using Web Audio API: Brown Noise, Gentle Rain and a 432/436 Hz stereo tone pair (4 Hz difference).
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

## System architecture

```text
User intent
   ↓
Routine / single timer
   ↓
Web Worker timing engine ──→ Stage / loop transitions
   ↓
Ambient audio + gentle cues + optional device capabilities
   ↓
Completion signal
   ↓
Reflection
   ↓
IndexedDB session record ──→ Heatmaps / streaks / Markdown / CSV

PWA Service Worker ──→ Caches the static application shell
```

## Real-world use

- **Students:** study → break → revision sequences without timer reconfiguration.
- **Remote and office workers:** deep-work blocks with quiet completion signals.
- **Mindfulness practitioners:** meditation → breathwork → journaling as one routine.
- **Writers and creators:** repeatable focus blocks plus portable session notes.
- **Quiet spaces:** visual completion signals when audio is inappropriate.

## Important limitations

A browser is not a native alarm daemon. Background execution, notifications, Wake Lock, audio playback and installation prompts depend on the browser and operating system. ZenTimer is intended for personal focus and mindfulness workflows, not medical, emergency, industrial or other safety-critical timing.

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
