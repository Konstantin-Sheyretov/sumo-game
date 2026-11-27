(() => {
  "use strict";

  const SIZE = 4;
  const PRIORITIES = [1, 2, 3, 4];
  const TOKEN_CYCLES = 5; // the game ends once every player has used all tokens this many times
  const MAX_ROUNDS = TOKEN_CYCLES * PRIORITIES.length;
  const ACT_DELAY_MS = 900;
  const NAMES = ["Red", "Blue", "Green", "Yellow"];

  // Facings in clockwise order, so turning right is +1 and turning left is -1.
  const FACINGS = ["up", "right", "down", "left"];
  const VECTORS = {
    up: { row: -1, col: 0 },
    right: { row: 0, col: 1 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
  };
  const ARROWS = { up: "↑", right: "→", down: "↓", left: "←" };

  // Pawns start in the corners, each facing the next pawn clockwise.
  const START = [
    { row: 0, col: 0, facing: "right" },
    { row: 0, col: SIZE - 1, facing: "down" },
    { row: SIZE - 1, col: SIZE - 1, facing: "left" },
    { row: SIZE - 1, col: 0, facing: "up" },
  ];

  const COMMANDS = {
    forward: { label: "Forward", symbol: "↑", turn: 0, key: ["ArrowUp", "w", "W"] },
    left: { label: "Left", symbol: "↰", turn: -1, key: ["ArrowLeft", "a", "A"] },
    right: { label: "Right", symbol: "↱", turn: 1, key: ["ArrowRight", "d", "D"] },
    stay: { label: "Stay", symbol: "●", turn: null, key: ["ArrowDown", "s", "S"] },
  };

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const trackEl = document.getElementById("track");
  const panelEl = document.getElementById("panel");
  const logEl = document.getElementById("log");
  const resetBtn = document.getElementById("reset");

  // phase: "planning" | "handoff" | "acting" | "over"
  let players, track, round, phase, planners, planIndex, plans, draft, queue, actIndex, winner, endReason, timer;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function reset() {
    clearTimeout(timer);
    players = START.map((s, i) => ({
      id: i,
      name: NAMES[i],
      alive: true,
      tokens: PRIORITIES.slice(),
      ...s,
    }));
    track = shuffle(players.map((p) => p.id));
    round = 1;
    winner = null;
    endReason = "";
    logEl.innerHTML = "";
    log(`Starting track: ${track.map((id) => NAMES[id]).join(", ")}`);
    startPlanning();
  }

  // ---------- helpers ----------

  function alivePlayers() {
    return players.filter((p) => p.alive);
  }

  function playerAt(row, col) {
    return players.find((p) => p.alive && p.row === row && p.col === col);
  }

  function inBounds(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  function cellName(row, col) {
    return String.fromCharCode(65 + col) + (row + 1);
  }

  function turned(facing, turn) {
    const i = FACINGS.indexOf(facing);
    return FACINGS[(i + turn + FACINGS.length) % FACINGS.length];
  }

  // Where a command would take a pawn from its current position: new facing and square.
  function resolveCommand(player, command) {
    const c = COMMANDS[command];
    if (c.turn === null) return null;
    const facing = turned(player.facing, c.turn);
    const v = VECTORS[facing];
    return { facing, row: player.row + v.row, col: player.col + v.col };
  }

  function commandText(command) {
    if (command === "stay") return "stay";
    if (command === "forward") return "move forward";
    return `turn ${command} and move`;
  }

  function log(text, cls) {
    const li = document.createElement("li");
    li.textContent = text;
    if (cls) li.className = cls;
    logEl.prepend(li);
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    children.forEach((c) => node.append(c));
    return node;
  }

  function cycleOfRound(r) {
    return Math.ceil(r / PRIORITIES.length);
  }

  // ---------- planning ----------

  function startPlanning() {
    phase = "planning";
    plans = {};
    planners = alivePlayers().map((p) => p.id);
    planIndex = 0;
    draft = { command: null, priority: null };
    log(`— Round ${round}/${MAX_ROUNDS}: planning —`, "round");
    render();
  }

  function planner() {
    return players[planners[planIndex]];
  }

  function chooseCommand(command) {
    if (phase !== "planning" || !COMMANDS[command]) return;
    draft.command = command;
    render();
  }

  function choosePriority(n) {
    if (phase !== "planning" || !planner().tokens.includes(n)) return;
    draft.priority = n;
    render();
  }

  function lockIn() {
    if (phase !== "planning" || draft.command === null || draft.priority === null) return;
    const p = planner();
    plans[p.id] = { ...draft };
    p.tokens = p.tokens.filter((t) => t !== draft.priority);
    if (p.tokens.length === 0) p.tokens = PRIORITIES.slice();
    draft = { command: null, priority: null };
    phase = "handoff";
    render();
  }

  function continueFromHandoff() {
    if (phase !== "handoff") return;
    planIndex++;
    if (planIndex < planners.length) {
      phase = "planning";
      render();
    } else {
      startActing();
    }
  }

  // ---------- acting ----------

  function startActing() {
    phase = "acting";
    // Lower priority number acts first; ties go to whoever is further left on the track.
    queue = planners
      .map((id) => ({ id, ...plans[id], skip: false }))
      .sort((a, b) => a.priority - b.priority || track.indexOf(a.id) - track.indexOf(b.id));
    // In the first round, the player who acts last does not get to act.
    if (round === 1) queue[queue.length - 1].skip = true;
    actIndex = 0;
    log(`— Round ${round}/${MAX_ROUNDS}: acting —`, "round");
    queue.forEach((q) => log(`${NAMES[q.id]} planned: priority ${q.priority}, ${commandText(q.command)}`, "plan"));
    render();
    timer = setTimeout(stepActing, ACT_DELAY_MS);
  }

  function stepActing() {
    if (phase !== "acting") return;
    const q = queue[actIndex];
    if (q.skip) {
      log(`${NAMES[q.id]} acts last in round 1 and does not move.`);
    } else {
      performCommand(players[q.id], q.command);
    }
    actIndex++;

    const remaining = alivePlayers();
    if (remaining.length === 1) {
      return endGame(remaining[0], "last pawn standing");
    }
    if (actIndex >= queue.length) {
      if (round >= MAX_ROUNDS) {
        return endGame(players[track[0]], `leftmost on the track after ${TOKEN_CYCLES} full cycles of priority tokens`);
      }
      round++;
      startPlanning();
      return;
    }
    render();
    timer = setTimeout(stepActing, ACT_DELAY_MS);
  }

  function endGame(player, reason) {
    winner = player;
    endReason = reason;
    phase = "over";
    log(`${winner.name} wins — ${reason}!`, "win");
    render();
  }

  function performCommand(player, command) {
    if (!player.alive) {
      log(`${player.name} is out and does nothing.`);
      return;
    }
    const from = cellName(player.row, player.col);
    const target = resolveCommand(player, command);
    if (!target) {
      log(`${player.name} stays on ${from}, facing ${player.facing}.`);
      return;
    }
    const v = VECTORS[target.facing];
    const turnedText = target.facing !== player.facing ? `turns ${command}, ` : "";
    player.facing = target.facing;

    // Walking off the board is allowed, and knocks the pawn out.
    if (!inBounds(target.row, target.col)) {
      player.alive = false;
      log(`${player.name} ${turnedText}walks off the board from ${from} and is out!`, "out");
      track = track.filter((id) => players[id].alive);
      return;
    }

    // Collect the contiguous line of pawns in front of the mover.
    const chain = [];
    let r = target.row;
    let c = target.col;
    let p;
    while (inBounds(r, c) && (p = playerAt(r, c))) {
      chain.push(p);
      r += v.row;
      c += v.col;
    }

    // Shift the line from the far end; anything leaving the board is out.
    for (let i = chain.length - 1; i >= 0; i--) {
      const q = chain[i];
      q.row += v.row;
      q.col += v.col;
      if (!inBounds(q.row, q.col)) q.alive = false;
    }
    player.row = target.row;
    player.col = target.col;

    let text = `${player.name} ${turnedText}${from} → ${cellName(target.row, target.col)}`;
    const pushed = chain.filter((q) => q.alive).map((q) => q.name);
    if (pushed.length) text += `, pushing ${pushed.join(" and ")}`;
    log(text);
    chain
      .filter((q) => !q.alive)
      .forEach((q) => log(`${q.name} was pushed off the board by ${player.name} and is out!`, "out"));

    track = track.filter((id) => players[id].alive);
    if (chain.length) moveLeftOnTrack(player);
  }

  function moveLeftOnTrack(player) {
    const i = track.indexOf(player.id);
    if (i > 0) {
      [track[i - 1], track[i]] = [track[i], track[i - 1]];
      log(`${player.name} moves left on the track.`);
    }
  }

  // ---------- rendering ----------

  function render() {
    renderStatus();
    renderTrack();
    renderBoard();
    renderPanel();
  }

  function roundInfo() {
    return `Round ${round}/${MAX_ROUNDS} · token cycle ${cycleOfRound(round)}/${TOKEN_CYCLES}`;
  }

  function renderStatus() {
    let text;
    let color = "var(--fg)";
    if (phase === "planning") {
      text = `${planner().name}, plan your action`;
      color = `var(--p${planner().id + 1})`;
    } else if (phase === "handoff") {
      text = "Planning…";
    } else if (phase === "acting") {
      const q = queue[actIndex];
      text = `Acting: ${NAMES[q.id]} (priority ${q.priority})`;
      color = `var(--p${q.id + 1})`;
    } else {
      text = `${winner.name} wins!`;
      color = `var(--p${winner.id + 1})`;
    }
    statusEl.textContent = text;
    statusEl.style.color = color;
    document.getElementById("round").textContent = roundInfo();
  }

  function renderTrack() {
    trackEl.innerHTML = "";
    trackEl.append(el("span", { className: "track-label", textContent: "Track:" }));
    track.forEach((id) => {
      trackEl.append(el("span", { className: `tag p${id + 1}`, textContent: NAMES[id] }));
    });
    players
      .filter((p) => !p.alive)
      .forEach((p) => trackEl.append(el("span", { className: `tag p${p.id + 1} out`, textContent: `${p.name} (out)` })));
  }

  function renderBoard() {
    const planning = phase === "planning";
    const me = planning ? planner() : null;
    let actorId = null;
    if (phase === "acting") actorId = queue[actIndex].id;
    if (phase === "over") actorId = winner.id;

    // Squares the current planner can click, keyed by "row,col".
    const targets = {};
    if (planning) {
      for (const cmd of ["forward", "left", "right"]) {
        const t = resolveCommand(me, cmd);
        if (inBounds(t.row, t.col)) targets[`${t.row},${t.col}`] = cmd;
      }
      targets[`${me.row},${me.col}`] = "stay";
    }

    boardEl.innerHTML = "";
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const cell = el("button", { type: "button", className: "cell" });
        cell.setAttribute("role", "gridcell");
        const occupant = playerAt(row, col);
        let label = cellName(row, col);

        if (occupant) {
          cell.append(pawnEl(occupant, planning ? occupant.id === me.id : occupant.id === actorId));
          label += `, ${occupant.name} pawn facing ${occupant.facing}`;
        }

        const cmd = targets[`${row},${col}`];
        if (cmd) {
          cell.classList.add("target");
          if (draft.command === cmd) cell.classList.add("chosen");
          if (cmd !== "stay") cell.append(el("span", { className: "cmd-hint", textContent: COMMANDS[cmd].label }));
          cell.addEventListener("click", () => chooseCommand(cmd));
          label += `, plan: ${commandText(cmd)}`;
        } else {
          cell.tabIndex = -1;
        }
        cell.setAttribute("aria-label", label);
        boardEl.append(cell);
      }
    }
  }

  function pawnEl(player, active) {
    const deg = FACINGS.indexOf(player.facing) * 90;
    const pawn = el("span", { className: `pawn p${player.id + 1}` + (active ? " active" : "") }, [
      el("span", { className: "nose" }),
      el("span", { className: "num", textContent: player.id + 1 }),
    ]);
    pawn.style.setProperty("--rot", `${deg}deg`);
    return pawn;
  }

  function renderPanel() {
    panelEl.innerHTML = "";
    if (phase === "planning") renderPlanningPanel();
    else if (phase === "handoff") renderHandoffPanel();
    else if (phase === "acting") renderActingPanel();
    else renderOverPanel();
  }

  function renderPlanningPanel() {
    const me = planner();

    const cmds = el("div", { className: "choice-row" }, [el("span", { className: "choice-label", textContent: "Command" })]);
    for (const [name, c] of Object.entries(COMMANDS)) {
      const b = el("button", { type: "button", className: "choice wide", textContent: `${c.symbol} ${c.label}` });
      b.dataset.command = name;
      if (draft.command === name) b.classList.add("selected");
      b.addEventListener("click", () => chooseCommand(name));
      cmds.append(b);
    }

    const prios = el("div", { className: "choice-row" }, [el("span", { className: "choice-label", textContent: "Priority" })]);
    PRIORITIES.forEach((n) => {
      const b = el("button", { type: "button", className: "choice", textContent: n });
      b.dataset.priority = n;
      b.disabled = !me.tokens.includes(n);
      if (b.disabled) b.title = "Already used — comes back once all 4 are used";
      if (draft.priority === n) b.classList.add("selected");
      b.addEventListener("click", () => choosePriority(n));
      prios.append(b);
    });

    const info = [`Facing ${ARROWS[me.facing]} ${me.facing}.`];
    if (draft.command && draft.command !== "stay") {
      const t = resolveCommand(me, draft.command);
      if (!inBounds(t.row, t.col)) info.push("⚠ From here this walks off the board!");
    }
    if (round === 1) info.push("Round 1: whoever acts last does not move.");

    const lock = el("button", { type: "button", className: "primary", textContent: "Lock in plan" });
    lock.disabled = draft.command === null || draft.priority === null;
    lock.addEventListener("click", lockIn);

    panelEl.append(
      cmds,
      prios,
      el("p", { className: "info", textContent: info.join(" ") }),
      el("p", {
        className: "small",
        textContent: "Keys: ↑ forward, ← left, → right, ↓/S stay, 1–4 priority, Enter to lock in. Others: look away!",
      }),
      lock,
    );
  }

  function renderHandoffPanel() {
    const done = players[planners[planIndex]];
    const last = planIndex + 1 >= planners.length;
    const next = last ? null : players[planners[planIndex + 1]];
    panelEl.append(
      el("p", { className: "handoff", textContent: `${done.name}'s plan is locked in and hidden.` }),
      el("p", { textContent: last ? "All plans are locked in." : `Pass the device to ${next.name}.` }),
    );
    const b = el("button", {
      type: "button",
      className: "primary",
      textContent: last ? "Reveal plans & act" : `I'm ${next.name} — start planning`,
    });
    b.addEventListener("click", continueFromHandoff);
    panelEl.append(b);
    b.focus({ preventScroll: true });
  }

  function renderActingPanel() {
    const list = el("ol", { className: "queue" });
    queue.forEach((q, i) => {
      let text = `${NAMES[q.id]} — priority ${q.priority}: ${commandText(q.command)}`;
      if (q.skip) text += " (acts last in round 1: does not move)";
      list.append(
        el("li", {
          className: `p-text${q.id + 1}` + (i < actIndex ? " done" : "") + (i === actIndex ? " current" : ""),
          textContent: text,
        }),
      );
    });
    panelEl.append(el("p", { className: "small", textContent: "Acting in priority order (ties: leftmost on the track first)" }), list);
  }

  function renderOverPanel() {
    const b = el("button", { type: "button", className: "primary", textContent: "Play again" });
    b.addEventListener("click", reset);
    panelEl.append(el("p", { className: "handoff", textContent: `${winner.name} wins — ${endReason}.` }), b);
  }

  // ---------- input ----------

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || phase !== "planning") return;
    const cmd = Object.entries(COMMANDS).find(([, c]) => c.key.includes(e.key));
    if (cmd) {
      e.preventDefault();
      chooseCommand(cmd[0]);
    } else if (["1", "2", "3", "4"].includes(e.key)) {
      choosePriority(Number(e.key));
    } else if (e.key === "Enter" && e.target.tagName !== "BUTTON") {
      lockIn();
    }
  });

  resetBtn.addEventListener("click", reset);
  reset();
})();
