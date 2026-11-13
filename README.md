# Pocket Arcade

Portal and browser games in one Vite monorepo. The apps are served under the
same origin:

- `/` — enter and save a player name
- `/snake/`
- `/tetris/`
- `/breakout/`

The name is stored in browser `localStorage` and prefilled in each game's score
form. The games continue to accept edits to the name before submitting a score.

## Run locally

Use Node.js 20.19 or newer. Copy `.env.example` to `.env`, then run:

```sh
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `VITE_API_BASE_URL`. Set the
three public `VITE_*_TITLE_GAME_ID` values and API URL for the deployment.
These Vite variables are public browser configuration; never put secrets in
them.

## Build and deploy

Run `npm run build`; Vite creates a multi-page static site in `dist/`. Deploy
this directory as the root of a single static hosting project. Configure the
deployed site origin in the game server's `ALLOWED_GAME_ORIGINS` setting so the
games can read and submit scores from the unified origin.

The original standalone game repositories are not modified by this migration.
The source in this repository is the unified deployment copy.
# POCKET ARCADE
