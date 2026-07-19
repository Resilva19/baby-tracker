# Baby Tracker

A tiny shared newborn log for two phones: feeds (with L/R side), poops, and pees.

- **App:** https://resilva19.github.io/baby-tracker/ (add it to your phone's home screen)
- **Data:** stored in a private GitHub gist on the owner's account (`babylog.json`), plus a full local copy on each phone. Nothing personal lives in this repository.
- **Sync:** automatic — after every entry, on app open/focus, and every 90 seconds while open.

## Development

The app is a single self-contained `index.html` (no build step). `test/` contains a mock of the GitHub Gist API and a Playwright suite:

```bash
python3 test/mock_github.py &          # mock gist API on :8788
python3 -m http.server 8080 &          # serve the app
node test/test.js                      # run the 30-test suite
```

Built with Claude.
