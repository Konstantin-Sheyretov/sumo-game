(() => {
  "use strict";

  const SIZE = 4;
  const PRIORITIES = [1, 2, 3, 4];
  const ACT_DELAY_MS = 900;
  const START_POSITIONS = [
    { row: 0, col: 0 },
    { row: 0, col: SIZE - 1 },
    { row: SIZE - 1, col: SIZE - 1 },
    { row: SIZE - 1, col: 0 },
  ];
  const NAMES = ["Red", "Blue", "Green", "Yellow"];
  const DIRECTIONS = {
    up: { row: -1, col: 0, arrow: "↑", key: "ArrowUp" },
    down: { row: 1, col: 0, arrow: "↓", key: "ArrowDown" },
    left: { row: 0, col: -1, arrow: "←", key: "ArrowLeft" },
    right: { row: 0, col: 1, arrow: "→", key: "ArrowRight" },
  };
  const STAY = "stay";

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const trackEl = document.getElementById("track");
  const panelEl = document.getElementById("panel");
  const logEl = document.getElementById("log");
  const resetBtn = document.getElementById("reset");

  // phase: "planning" | "handoff" | "acting" | "over"
  let players, track, round, phase, planners, planIndex, plans, draft, queue, actIndex, winner, timer;

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
    players = START_POSITIONS.map((pos, i) => ({
      id: i,
      name: NAMES[i],
      alive: true,
      tokens: PRIORITIES.slice(),
      ...pos,
    }));
    track = shuffle(players.map((p) => p.id));
    round = 1;
    winner = null;
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

  function actionText(action) {
    return action === STAY ? "stay" : `move ${DIRECTIONS[action].arrow} ${action}`;
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

  // ---------- planning ----------

  function startPlanning() {
    phase = "planning";
    plans = {};
    planners = alivePlayers().map((p) => p.id);
    planIndex = 0;
    draft = { action: null, priority: null };
    log(`— Round ${round}: planning —`, "round");
    render();
  }

  function planner() {
    return players[planners[planIndex]];
  }

  // At planning time a pawn may not plan to step off the board.
  function canPlan(player, action) {
    if (action === STAY) return true;
    const d = DIRECTIONS[action];
    return inBounds(player.row + d.row, player.col + d.col);
  }

  function chooseAction(action) {
    if (phase !== "planning" || !canPlan(planner(), action)) return;
    draft.action = action;
    render();
  }

  function choosePriority(n) {
    if (phase !== "planning" || !planner().tokens.includes(n)) return;
    draft.priority = n;
    render();
  }

  function lockIn() {
    if (phase !== "planning" || draft.action === null || draft.priority === null) return;
    const p = planner();
    plans[p.id] = { ...draft };
    p.tokens = p.tokens.filter((t) => t !== draft.priority);
    if (p.tokens.length === 0) p.tokens = PRIORITIES.slice();
    draft = { action: null, priority: null };
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
      .map((id) => ({ id, ...plans[id] }))
      .sort((a, b) => a.priority - b.priority || track.indexOf(a.id) - track.indexOf(b.id));
    actIndex = 0;
    log(`— Round ${round}: acting —`, "round");
    queue.forEach((q) => log(`${NAMES[q.id]} planned: priority ${q.priority}, ${actionText(q.action)}`, "plan"));
    render();
    timer = setTimeout(stepActing, ACT_DELAY_MS);
  }

  function stepActing() {
    if (phase !== "acting") return;
    const q = queue[actIndex];
    performAction(players[q.id], q.action);
    actIndex++;

    const remaining = alivePlayers();
    if (remaining.length === 1) {
      winner = remaining[0];
      phase = "over";
      log(`${winner.name} wins!`, "win");
      render();
      return;
    }
    if (actIndex >= queue.length) {
      round++;
      startPlanning();
      return;
    }
    render();
    timer = setTimeout(stepActing, ACT_DELAY_MS);
  }

  function performAction(player, action) {
    if (!player.alive) {
      log(`${player.name} is out and does nothing.`);
      return;
    }
    if (action === STAY) {
      log(`${player.name} stays on ${cellName(player.row, player.col)}.`);
      return;
    }
    const d = DIRECTIONS[action];
    const tr = player.row + d.row;
    const tc = player.col + d.col;
    if (!inBounds(tr, tc)) {
      log(`${player.name} can't move ${action} from ${cellName(player.row, player.col)} — the edge is in the way.`);
      return;
    }

    // Collect the contiguous line of pawns in front of the mover.
    const chain = [];
    let r = tr;
    let c = tc;
    let p;
    while (inBounds(r, c) && (p = playerAt(r, c))) {
      chain.push(p);
      r += d.row;
      c += d.col;
    }

    // Shift the line from the far end; anything leaving the board is out.
    const from = cellName(player.row, player.col);
    for (let i = chain.length - 1; i >= 0; i--) {
      const q = chain[i];
      q.row += d.row;
      q.col += d.col;
      if (!inBounds(q.row, q.col)) q.alive = false;
    }
    player.row = tr;
    player.col = tc;

    let text = `${player.name} ${from} → ${cellName(tr, tc)}`;
    const pushed = chain.filter((q) => q.alive).map((q) => q.name);
    if (pushed.length) text += `, pushing ${pushed.join(" and ")}`;
    log(text);
    chain
      .filter((q) => !q.alive)
      .forEach((q) => log(`${q.name} was pushed off the board by ${player.name} and is out!`, "out"));

    if (chain.length) moveLeftOnTrack(player);
    track = track.filter((id) => players[id].alive);
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

  function renderStatus() {
    let text;
    let color = "var(--fg)";
    if (phase === "planning") {
      text = `Round ${round} — ${planner().name}, plan your action`;
      color = `var(--p${planner().id + 1})`;
    } else if (phase === "handoff") {
      text = `Round ${round} — planning`;
    } else if (phase === "acting") {
      const q = queue[actIndex];
      text = `Round ${round} — acting: ${NAMES[q.id]} (priority ${q.priority})`;
      color = `var(--p${q.id + 1})`;
    } else {
      text = `${winner.name} wins!`;
      color = `var(--p${winner.id + 1})`;
    }
    statusEl.textContent = text;
    statusEl.style.color = color;
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

    let chosenCell = null;
    if (planning && draft.action && draft.action !== STAY) {
      const d = DIRECTIONS[draft.action];
      chosenCell = { row: me.row + d.row, col: me.col + d.col };
    }

    boardEl.innerHTML = "";
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const cell = el("button", { type: "button", className: "cell" });
        cell.setAttribute("role", "gridcell");
        const occupant = playerAt(row, col);
        let label = cellName(row, col);

        if (occupant) {
          const pawn = el("span", {
            className: `pawn p${occupant.id + 1}`,
            textContent: occupant.id + 1,
          });
          const highlight = planning ? occupant.id === me.id : occupant.id === actorId;
          if (highlight) pawn.classList.add("active");
          cell.append(pawn);
          label += `, ${occupant.name} pawn`;
        }

        let clickable = false;
        if (planning) {
          if (occupant && occupant.id === me.id) {
            clickable = true;
            cell.classList.add("target");
            if (draft.action === STAY) cell.classList.add("chosen");
            cell.addEventListener("click", () => chooseAction(STAY));
            label += ", plan to stay";
          } else {
            for (const [name, d] of Object.entries(DIRECTIONS)) {
              if (me.row + d.row === row && me.col + d.col === col) {
                clickable = true;
                cell.classList.add("target");
                if (chosenCell && chosenCell.row === row && chosenCell.col === col) cell.classList.add("chosen");
                cell.addEventListener("click", () => chooseAction(name));
                label += `, plan to move ${name}`;
              }
            }
          }
        }
        if (!clickable) cell.tabIndex = -1;
        cell.setAttribute("aria-label", label);
        boardEl.append(cell);
      }
    }
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

    const actions = el("div", { className: "choice-row" }, [el("span", { className: "choice-label", textContent: "Action" })]);
    for (const [name, d] of Object.entries(DIRECTIONS)) {
      const b = el("button", { type: "button", className: "choice", textContent: d.arrow, title: `Move ${name}` });
      b.setAttribute("aria-label", `Move ${name}`);
      b.disabled = !canPlan(me, name);
      if (draft.action === name) b.classList.add("selected");
      b.addEventListener("click", () => chooseAction(name));
      actions.append(b);
    }
    const stayB = el("button", { type: "button", className: "choice wide", textContent: "Stay" });
    if (draft.action === STAY) stayB.classList.add("selected");
    stayB.addEventListener("click", () => chooseAction(STAY));
    actions.append(stayB);

    const prios = el("div", { className: "choice-row" }, [el("span", { className: "choice-label", textContent: "Priority" })]);
    PRIORITIES.forEach((n) => {
      const b = el("button", { type: "button", className: "choice", textContent: n });
      b.disabled = !me.tokens.includes(n);
      if (b.disabled) b.title = "Already used — comes back once all 4 are used";
      if (draft.priority === n) b.classList.add("selected");
      b.addEventListener("click", () => choosePriority(n));
      prios.append(b);
    });

    const lock = el("button", { type: "button", className: "primary", textContent: "Lock in plan" });
    lock.disabled = draft.action === null || draft.priority === null;
    lock.addEventListener("click", lockIn);

    panelEl.append(
      actions,
      prios,
      el("p", {
        className: "small",
        textContent: "Keys: arrows / S to pick an action, 1–4 for priority, Enter to lock in. Other players: look away!",
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
      el("p", {
        textContent: last ? "All plans are locked in." : `Pass the device to ${next.name}.`,
      }),
    );
    const b = el("button", {
      type: "button",
      className: "primary",
      textContent: last ? "Reveal plans & act" : `I'm ${next.name} — start planning`,
    });
    b.addEventListener("click", continueFromHandoff);
    panelEl.append(b);
    b.focus();
  }

  function renderActingPanel() {
    const list = el("ol", { className: "queue" });
    queue.forEach((q, i) => {
      const li = el("li", {
        className: `p-text${q.id + 1}` + (i < actIndex ? " done" : "") + (i === actIndex ? " current" : ""),
        textContent: `${NAMES[q.id]} — priority ${q.priority}: ${actionText(q.action)}`,
      });
      list.append(li);
    });
    panelEl.append(el("p", { className: "small", textContent: "Acting in priority order (ties: leftmost on the track first)" }), list);
  }

  function renderOverPanel() {
    const b = el("button", { type: "button", className: "primary", textContent: "Play again" });
    b.addEventListener("click", reset);
    panelEl.append(el("p", { className: "handoff", textContent: `${winner.name} is the last pawn standing!` }), b);
  }

  // ---------- input ----------

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (phase === "planning") {
      const dir = Object.entries(DIRECTIONS).find(([, d]) => d.key === e.key);
      if (dir) {
        e.preventDefault();
        chooseAction(dir[0]);
      } else if (e.key === "s" || e.key === "S") {
        chooseAction(STAY);
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        choosePriority(Number(e.key));
      } else if (e.key === "Enter" && e.target.tagName !== "BUTTON") {
        lockIn();
      }
    }
  });

  resetBtn.addEventListener("click", reset);
  reset();
})();
