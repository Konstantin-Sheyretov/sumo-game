# Sumo Game

A browser game for 4 players on a 4×4 grid. Players take turns; on each turn the
current player moves their pawn exactly one space up, down, left or right onto an
empty square. A pawn with no free neighbouring square passes its turn.

## Play

- Click a highlighted square next to the active pawn, or use the arrow keys.
- **Restart** resets the pawns to the four corners.

To play locally, open `index.html` in a browser — no build step needed.

## Hosting on GitHub Pages

`.github/workflows/pages.yml` deploys the site on every push to `main`.
One-time setup: in the repository go to **Settings → Pages** and set
**Source** to **GitHub Actions**. The game is then served at
`https://<owner>.github.io/sumo-game/`.
