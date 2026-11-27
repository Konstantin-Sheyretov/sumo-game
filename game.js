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
  const stayBtn = document.getElementById("stay");

  let players;
  let current;
  let turn;
  let winner;

  function reset() {
    players = START_POSITIONS.map((pos, i) => ({ id: i, name: NAMES[i], alive: true, ...pos }));
    current = 0;
    turn = 1;
    winner = null;
    logEl.innerHTML = "";
    render();
  }

  function alivePlayers() {
    return players.filter((p) => p.alive);
  }

  function playerAt(row, col) {
    return players.find((p) => p.alive && p.row === row && p.col === col);
  }

  function inBounds(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  // A pawn may step one square up, down, left or right, as long as it stays on
  // the board. If the square is occupied, the pawns in that line are pushed.
  function legalMoves(player) {
    return Object.values(DIRECTIONS)
      .map((d) => ({ row: player.row + d.row, col: player.col + d.col, d }))
      .filter((m) => inBounds(m.row, m.col));
  }

  function findMove(player, row, col) {
    return legalMoves(player).find((m) => m.row === row && m.col === col);
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
    do {
      current = (current + 1) % players.length;
      if (current === 0) turn++;
    } while (!players[current].alive);
  }

  // The current player keeps their pawn where it is and ends their turn.
  function stay() {
    if (winner) return;
    const player = players[current];
    log(`Turn ${turn}: ${player.name} stays on ${cellName(player.row, player.col)}`);
    nextPlayer();
    render();
  }

  function move(row, col) {
    if (winner) return;
    const player = players[current];
    const m = findMove(player, row, col);
    if (!m) return;

    // Collect the contiguous line of pawns in front of the mover.
    const chain = [];
    let r = m.row;
    let c = m.col;
    let p;
    while (inBounds(r, c) && (p = playerAt(r, c))) {
      chain.push(p);
      r += m.d.row;
      c += m.d.col;
    }

    // Shift the line from the far end; anything leaving the board is out.
    const from = cellName(player.row, player.col);
    for (let i = chain.length - 1; i >= 0; i--) {
      const q = chain[i];
      q.row += m.d.row;
      q.col += m.d.col;
      if (!inBounds(q.row, q.col)) q.alive = false;
    }
    player.row = m.row;
    player.col = m.col;

    let text = `Turn ${turn}: ${player.name} ${from} → ${cellName(m.row, m.col)}`;
    const pushed = chain.filter((q) => q.alive).map((q) => q.name);
    if (pushed.length) text += `, pushing ${pushed.join(" and ")}`;
    log(text);
    chain
      .filter((q) => !q.alive)
      .forEach((q) => log(`${q.name} was pushed off the board by ${player.name} and is out!`));

    const remaining = alivePlayers();
    if (remaining.length === 1) {
      winner = remaining[0];
      log(`${winner.name} wins!`);
    } else {
      nextPlayer();
    }
    render();
  }

  function render() {
    const player = winner || players[current];
    const targets = winner ? [] : legalMoves(player);
    statusEl.textContent = winner
      ? `${winner.name} wins!`
      : `Turn ${turn} — ${player.name}'s move`;
    statusEl.style.color = `var(--p${player.id + 1})`;

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
          if (occupant.id === player.id) pawn.classList.add("active");
          pawn.textContent = occupant.id + 1;
          cell.appendChild(pawn);
          label += `, ${occupant.name} pawn`;
        }
        if (!winner && occupant && occupant.id === player.id) {
          cell.classList.add("stay");
          cell.addEventListener("click", stay);
          label += ", stay here";
        } else if (isTarget) {
          cell.classList.add("target");
          if (occupant) cell.classList.add("push");
          cell.addEventListener("click", () => move(row, col));
          label += occupant ? ", push here" : ", move here";
        } else {
          cell.tabIndex = -1;
        }
        cell.setAttribute("aria-label", label);
        boardEl.appendChild(cell);
      }
    }

    stayBtn.disabled = Boolean(winner);
    renderRoster();
  }

  function renderRoster() {
    let roster = document.getElementById("roster");
    if (!roster) {
      roster = document.createElement("div");
      roster.id = "roster";
      statusEl.after(roster);
    }
    roster.innerHTML = "";
    players.forEach((p) => {
      const tag = document.createElement("span");
      tag.className = `tag p${p.id + 1}` + (p.alive ? "" : " out");
      tag.textContent = p.alive ? p.name : `${p.name} (out)`;
      roster.appendChild(tag);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      stay();
      return;
    }
    const d = DIRECTIONS[e.key];
    if (!d) return;
    e.preventDefault();
    if (winner) return;
    const p = players[current];
    move(p.row + d.row, p.col + d.col);
  });

  resetBtn.addEventListener("click", reset);
  stayBtn.addEventListener("click", stay);
  reset();
})();
