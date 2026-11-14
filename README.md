# Dailo

Dailo is a mobile-first, installable daily word game. Every calendar date has three deterministic five-letter puzzles, so everyone playing a given date receives the same trio without requiring a server.

## Features

- Three shared puzzles per day
- Custom animated keyboard with correct, present, and absent letter states
- Familiar daily-answer list plus a broad accepted-guess dictionary
- Offline-ready Progressive Web App
- In-progress games, finished games, streaks, and history saved locally
- Shareable image cards using the native share sheet when supported
- Automated GitHub Pages deployment from `main`

## Run locally

```bash
npm run serve
```

Then open <http://localhost:4173>.

## Test

```bash
npm test
```

## Daily puzzle algorithm

The local calendar date and game number are hashed with a versioned seed. The result indexes into the answer list, with deterministic collision avoidance so the three games are different. Changing the seed version would create a new schedule, so it should only be done intentionally.

## Deploy

The workflow in `.github/workflows/deploy-pages.yml` publishes `public/` to GitHub Pages whenever a commit lands on `main`. Pages must use **GitHub Actions** as its source in the repository settings.

## Privacy

Dailo has no account and sends no game data anywhere. Game state stays in the browser's local storage.

## Word list

The answer and accepted-guess lists come from the MIT-licensed `wordle-words` package. See `THIRD_PARTY_NOTICES.md`.
