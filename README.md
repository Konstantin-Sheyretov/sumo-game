# Sumo Game

A browser sumo game for 4 players on a 4×4 grid. Players take turns; on each turn the
current player moves their pawn exactly one space up, down, left or right (a pawn
can't step off the board by itself). Moving into an occupied square pushes that pawn,
and any pawns lined up behind it, one space. A pawn pushed off the edge is out — the
last pawn standing wins.

## Play

- Click a highlighted square next to the active pawn, or use the arrow keys.
- **Restart** resets the pawns to the four corners.

To play locally, open `index.html` in a browser — no build step needed.

## Hosting on GitHub Pages

The site is served by GitHub Pages straight from the `main` branch (Settings → Pages →
Deploy from a branch), at https://konstantin-sheyretov.github.io/sumo-game/.
