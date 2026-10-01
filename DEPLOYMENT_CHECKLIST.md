# ZenTimer Deployment Checklist

1. Replace the repository files with the contents of this folder.
2. Commit and push to `main`.
3. In GitHub Pages settings, confirm the site is served from the intended Pages workflow/environment.
4. Open the site once while online so the service worker can install its application shell.
5. Reload once after the service worker installs.
6. Test `Start Session`, `Pause`, `Reset`, a routine template, Zen Mode, reflection and history.
7. Test the site once in offline mode after the initial cache is installed.
8. Test on one desktop browser and one mobile browser because browser APIs differ.
9. Do not use the app as the only timing mechanism for medical, emergency, industrial or other safety-critical events.
