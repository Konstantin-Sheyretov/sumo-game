# Sumo Game

A browser sumo game for 4 players on a 4×4 grid, played on one shared screen.

## Rules

Each round has two phases.

**Planning.** One by one, each player secretly picks an action and a priority:

- the action is a move one square (up, down, left or right) or stay;
- the priority is a number from 1 to 4. Each number can be used once. After a player
  has used all four, they get them all back.

After locking in, the plan is hidden and the device is passed to the next player.

**Acting.** All plans are revealed and carried out in priority order, 1 first. Ties
go to whoever is further left on the **track**, which starts in a random order. The
acting order is fixed when the plans are revealed.

- Moving into a pawn pushes it, and any pawns lined up behind it, one square.
- A pawn pushed off the edge is out.
- Each time a player's move pushes another pawn, that player moves one place left
  on the track.
- If a planned move would take a pawn off the board when it acts (for example
  because it was pushed to the edge earlier in the round), the move does nothing.

The last pawn standing wins.

## Controls

Click a highlighted square (or your own pawn to stay), or use the arrow keys and **S**.
Pick a priority with the buttons or keys **1–4**, then **Lock in plan** (or press Enter).

To play locally, open `index.html` in a browser; there's no build step.

## Hosting on GitHub Pages

The site is served by GitHub Pages straight from the `main` branch (Settings → Pages →
Deploy from a branch), at https://konstantin-sheyretov.github.io/sumo-game/.
