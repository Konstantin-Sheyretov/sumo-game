# Sumo Game

A browser sumo game for 4 players on a 4×4 grid, played on one shared screen.

## Rules

Every pawn faces a direction, shown by its pointer. Each pawn starts facing the next
pawn clockwise.

Each round has two phases.

**Planning.** One by one, each player secretly picks a command and a priority:

- the command is one of:
  - **forward:** move one square ahead;
  - **left** or **right:** turn 90° that way, then move one square;
  - **stay**;
- the priority is a number from 1 to 4. Each number can be used once. After a player
  has used all four, they get them all back.

After locking in, the plan is hidden and the device is passed to the next player.

**Acting.** All plans are revealed. Players are taken in priority order (1 first;
ties go to whoever is further left on the **track**, which starts in a random order;
the order is fixed when the plans are revealed).

- The first player still to act chooses to **act now** or **wait**. If they wait, the
  next player in order chooses, and so on.
- The last player still to act must act.
- After someone acts, the choice starts again from the top of the order.
- In round 1 only, the player last in priority order does not move.
- If a pawn is pushed in the opposite direction to its planned move before it acts,
  its move is cancelled.
- Moving into a pawn pushes it, and any pawns lined up behind it, one square.
- A pawn that is pushed off the edge, or walks off it, is out.
- Each time a player's move pushes another pawn, that player moves one place left
  on the track.

**End.** The game ends after every player has used all four priority tokens 5 times
(20 rounds). The player furthest left on the track wins. If only one pawn is left
earlier, that pawn wins.

## Controls

Click a highlighted square (or your own pawn to stay), or use the keys: **↑**
forward, **←** left, **→** right, **↓** or **S** stay. Pick a priority with the
buttons or keys **1–4**, then **Lock in plan** (or press Enter).

To play locally, open `index.html` in a browser; there's no build step.

## Hosting on GitHub Pages

The site is served by GitHub Pages straight from the `main` branch (Settings → Pages →
Deploy from a branch), at https://konstantin-sheyretov.github.io/sumo-game/.
