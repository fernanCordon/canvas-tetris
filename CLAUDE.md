# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step. Open directly or serve statically:

```bash
open index.html                 # macOS
python3 -m http.server 8000     # then visit http://localhost:8000
npx serve .
```

## Architecture

Three files, no dependencies:

- **`index.html`** — DOM structure: `<canvas id="board">` (300×600px) for the playfield, `<canvas id="next-canvas">` (120×120px) for piece preview, a side panel with score/lines/level displays, and an `#overlay` div for pause/game-over states.
- **`style.css`** — Dark/retro aesthetic. Overlay uses `backdrop-filter: blur`.
- **`game.js`** — All game logic (~305 lines, `'use strict'`). Key entry point is `init()`, which is called once on load and again on restart.

### game.js internals

- **Board state**: `board` is a `ROWS×COLS` (20×10) matrix; `0` = empty, `1–7` = color index matching `COLORS` and `PIECES` arrays.
- **Piece object**: `{ type, shape, x, y }` — `shape` is a 2D array, mutated in-place by `rotateCW()`.
- **Game loop**: `requestAnimationFrame`-based `loop(ts)` accumulates delta time in `dropAccum`; triggers `lockPiece()` when threshold (`dropInterval`) is exceeded. `animId` holds the RAF handle for cancellation.
- **Rotation**: `rotateCW` = transpose + reverse rows. `tryRotate()` applies wall kicks of `[0, -1, 1, -2, 2]` columns before giving up.
- **Ghost piece**: `ghostY()` projects the current piece straight down; drawn at `globalAlpha = 0.2`.
- **Speed**: `dropInterval = max(100, 1000 − (level−1) × 90)` ms. Level increments every 10 lines.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × level; hard drop adds 2 pts/row, soft drop 1 pt/row.

### Canvas sizing constraint

If `COLS`, `ROWS`, or `BLOCK` are changed in `game.js`, the `width`/`height` attributes on `<canvas id="board">` in `index.html` must be updated to match (`COLS × BLOCK` and `ROWS × BLOCK`).
