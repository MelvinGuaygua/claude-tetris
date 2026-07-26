# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript (no framework, no build tools, no dependencies) rendered on an HTML5 Canvas. The entire repo is 4 files: `index.html`, `style.css`, `game.js`, `README.md` (README is in Spanish).

## Running the project

There is no build, lint, or test step — this is plain static HTML/CSS/JS.

- Open directly: `open index.html` (macOS)
- Or serve locally (needed if testing anything that would require a server, otherwise optional):
  - `python3 -m http.server 8000`
  - `npx serve .`
  - `php -S localhost:8000`

## Architecture

All game logic lives in `game.js` (~305 lines) as a single procedural script with module-scope mutable state — no classes, no ES modules, no state management library. `index.html` just wires up the DOM and loads the script at the end of `<body>` (no `defer`); `game.js` calls `init()` at its own top level once loaded.

**Global state** (module-scope `let`s): `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`. This is the entire game state — there's no separate store/model object.

**Board & pieces**:
- `board` is a `ROWS × COLS` 2D array; each cell is `0` (empty) or `1`-`7` (locked piece's color id).
- `current` / `next` are objects `{ type, shape, x, y }`; `shape` is a matrix copy from `PIECES[type]`.
- `PIECES[]` and `COLORS[]` are indexed 1-7 for the seven tetrominoes (index 0 unused/null).

**Game loop**: `loop(ts)` runs via `requestAnimationFrame`. It's an accumulator loop, not fixed-timestep: `dt = ts - lastTime` accumulates into `dropAccum`, and once `dropAccum >= dropInterval` the piece drops one row (or locks if it can't). `draw()` runs every frame regardless (full immediate-mode canvas redraw, no dirty-rect tracking).

**Key functions**:
- `collide(shape, ox, oy)` — bounds/overlap check against `board`.
- `rotateCW(shape)` / `tryRotate()` — transpose+reverse rotation, then tries wall-kick x-offsets `[0, -1, 1, -2, 2]` until one doesn't collide.
- `merge()` / `lockPiece()` — writes `current` into `board`, then clears lines and spawns the next piece.
- `clearLines()` — scans bottom-up, `splice`s full rows (re-checks the same index after a splice since rows shift down), updates `score` (`LINE_SCORES[cleared] * level`), `lines`, `level` (`floor(lines/10)+1`), and `dropInterval` (`max(100, 1000 - (level-1)*90)`).
- `ghostY()` — projects `current` straight down to find the landing row; used both to render the ghost piece (20% opacity) and to score hard drops.
- `spawn()` / `endGame()` — promotes `next` to `current`, generates a new `next`; if the new piece immediately collides at spawn, ends the game.
- `draw()` / `drawBlock()` / `drawGrid()` / `drawNext()` — full redraw each frame: grid, locked cells, ghost piece, current piece, and the separate next-piece preview canvas.
- Input: a single `keydown` listener on `document`. `KeyP` toggles pause regardless of state; all other keys are ignored while `paused || gameOver`. `ArrowLeft`/`ArrowRight` move, `ArrowDown` soft-drops, `ArrowUp`/`KeyX` rotates, `Space` hard-drops (`preventDefault()`d to stop page scroll).
- `togglePause()` — cancels/restarts the `requestAnimationFrame` loop and toggles the shared `#overlay` between "PAUSA" and "GAME OVER" text.
- `init()` — resets all state, builds a fresh board, seeds `current`/`next`, hides the overlay, starts the loop. Called once at script load and again on restart-button click.

**Tunable constants** (top of `game.js`): `COLS=10`, `ROWS=20`, `BLOCK=30` (px), `LINE_SCORES=[0,100,300,500,800]`, initial `dropInterval=1000` (ms).

**DOM structure** (`index.html`): `#board` canvas (300×600 = 10×20 blocks at 30px) is the main play field; `<aside class="panel">` holds `#score`/`#lines`/`#level` text and a separate `#next-canvas` (120×120) for the next-piece preview; `#overlay` is a single hidden div reused for both the pause screen and the game-over screen, containing `#overlay-title`, `#overlay-score`, and `#restart-btn`.
