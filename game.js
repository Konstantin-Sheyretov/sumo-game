(() => {
  "use strict";

  const SIZE = 4;
  const START_POSITIONS = [
    { row: 0, col: 0 },
    { row: 0, col: SIZE - 1 },
    { row: SIZE - 1, col: SIZE - 1 },
    { row: SIZE - 1, col: 0 },
  ];
  const NAMES = ["Red", "Blue", "Green", "Yellow"];
  const DIRECTIONS = {
    ArrowUp: { row: -1, col: 0 },
    ArrowDown: { row: 1, col: 0 },
    ArrowLeft: { row: 0, col: -1 },
    ArrowRight: { row: 0, col: 1 },
  };

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const logEl = document.getElementById("log");
  const resetBtn = document.getElementById("reset");

  let players;
  let current;
  let turn;

  function reset() {
    players = START_POSITIONS.map((pos, i) => ({ id: i, name: NAMES[i], ...pos }));
    current = 0;
    turn = 1;
    logEl.innerHTML = "";
    skipIfStuck();
    render();
  }

  function playerAt(row, col) {
    return players.find((p) => p.row === row && p.col === col);
  }

  function inBounds(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  // A pawn moves exactly one space up, down, left or right onto an empty square.
  function legalMoves(player) {
    return Object.values(DIRECTIONS)
      .map((d) => ({ row: player.row + d.row, col: player.col + d.col }))
      .filter((m) => inBounds(m.row, m.col) && !playerAt(m.row, m.col));
  }

  function isLegal(player, row, col) {
    return legalMoves(player).some((m) => m.row === row && m.col === col);
  }

  function cellName(row, col) {
    return String.fromCharCode(65 + col) + (row + 1);
  }

  function log(text) {
    const li = document.createElement("li");
    li.textContent = text;
    logEl.prepend(li);
  }

  function nextPlayer() {
    current = (current + 1) % players.length;
    if (current === 0) turn++;
    skipIfStuck();
  }

  // With 4 pawns on 16 squares a pawn can be boxed in; it then passes.
  function skipIfStuck() {
    for (let i = 0; i < players.length; i++) {
      if (legalMoves(players[current]).length > 0) return;
      log(`${players[current].name} is blocked and passes.`);
      current = (current + 1) % players.length;
      if (current === 0) turn++;
    }
  }

  function move(row, col) {
    const player = players[current];
    if (!isLegal(player, row, col)) return;
    const from = cellName(player.row, player.col);
    player.row = row;
    player.col = col;
    log(`Turn ${turn}: ${player.name} ${from} → ${cellName(row, col)}`);
    nextPlayer();
    render();
  }

  function render() {
    const player = players[current];
    const targets = legalMoves(player);
    statusEl.textContent = `Turn ${turn} — ${player.name}'s move`;
    statusEl.style.color = `var(--p${current + 1})`;

    boardEl.innerHTML = "";
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.setAttribute("role", "gridcell");
        const occupant = playerAt(row, col);
        const isTarget = targets.some((t) => t.row === row && t.col === col);
        let label = cellName(row, col);

        if (occupant) {
          const pawn = document.createElement("span");
          pawn.className = `pawn p${occupant.id + 1}`;
          if (occupant.id === current) pawn.classList.add("active");
          pawn.textContent = occupant.id + 1;
          cell.appendChild(pawn);
          label += `, ${occupant.name} pawn`;
        }
        if (isTarget) {
          cell.classList.add("target");
          cell.addEventListener("click", () => move(row, col));
          label += ", move here";
        } else {
          cell.tabIndex = -1;
        }
        cell.setAttribute("aria-label", label);
        boardEl.appendChild(cell);
      }
    }
  }

  document.addEventListener("keydown", (e) => {
    const d = DIRECTIONS[e.key];
    if (!d) return;
    e.preventDefault();
    const p = players[current];
    move(p.row + d.row, p.col + d.col);
  });

  resetBtn.addEventListener("click", reset);
  reset();
})();
