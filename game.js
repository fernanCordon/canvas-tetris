'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - blue
  '#ffb74d', // L - orange
  '#f06292', // O3 - ring (magenta)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // O3 - ring
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayContent = document.getElementById('overlay-content');
const overlayActions = document.getElementById('overlay-actions');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor = '#22222e';
// sesión actual
let sessionCombo, sessionMaxCombo, sessionLines;

// ---- localStorage helpers ----

function loadHighscores() {
  try {
    return JSON.parse(localStorage.getItem('tetris.highscores')) || [];
  } catch (_) {
    return [];
  }
}

function saveHighscore(name, sc, ln, lv) {
  const list = loadHighscores();
  list.push({ name, score: sc, lines: ln, level: lv });
  list.sort((a, b) => b.score - a.score);
  list.splice(5);
  localStorage.setItem('tetris.highscores', JSON.stringify(list));
  return list.findIndex(e => e.name === name && e.score === sc && e.lines === ln && e.level === lv);
}

function isTopFive(sc) {
  const list = loadHighscores();
  return list.length < 5 || sc > list[list.length - 1].score;
}

function getBestCombo() {
  return parseInt(localStorage.getItem('tetris.bestCombo') || '0', 10);
}

function getMaxLines() {
  return parseInt(localStorage.getItem('tetris.maxLines') || '0', 10);
}

function updatePersistentStats(combo, ln) {
  if (combo > getBestCombo()) localStorage.setItem('tetris.bestCombo', combo);
  if (ln > getMaxLines()) localStorage.setItem('tetris.maxLines', ln);
}

function renderHighscoresTable(containerEl, highlightIndex) {
  const list = loadHighscores();
  const bestCombo = getBestCombo();
  const maxLines = getMaxLines();

  if (list.length === 0) {
    containerEl.innerHTML = '<p class="hs-empty">Sin records todavía</p>';
    return;
  }

  let rows = list.map((e, i) => {
    const cls = i === highlightIndex ? ' class="hs-highlight"' : '';
    return `<tr${cls}>
      <td>${i + 1}</td>
      <td>${escHtml(e.name)}</td>
      <td>${e.score.toLocaleString()}</td>
      <td>${e.lines}</td>
      <td>${e.level}</td>
    </tr>`;
  }).join('');

  containerEl.innerHTML = `
    <table class="hs-table">
      <thead><tr>
        <th>Pos</th><th>Nombre</th><th>Score</th><th>Líneas</th><th>Nivel</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="hs-stats">Mejor combo: ${bestCombo} &nbsp;|&nbsp; Máx. líneas: ${maxLines}</p>`;
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---- Pantalla de inicio ----

function showStartScreen() {
  overlayTitle.textContent = 'TETRIS';
  overlayTitle.style.color = '';

  overlayContent.innerHTML = '';
  renderHighscoresTable(overlayContent, -1);

  overlayActions.innerHTML = '';

  const playBtn = document.createElement('button');
  playBtn.className = 'btn';
  playBtn.textContent = '▶ Jugar';
  playBtn.addEventListener('click', startGame);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn btn-danger';
  resetBtn.textContent = '🗑 Resetear records';
  resetBtn.addEventListener('click', () => {
    localStorage.removeItem('tetris.highscores');
    localStorage.removeItem('tetris.bestCombo');
    localStorage.removeItem('tetris.maxLines');
    renderHighscoresTable(overlayContent, -1);
  });

  overlayActions.appendChild(playBtn);
  overlayActions.appendChild(resetBtn);

  overlay.classList.remove('hidden');
}

// ---- Game flow ----

function startGame() {
  init();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    sessionLines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    // combo
    sessionCombo += cleared;
    if (sessionCombo > sessionMaxCombo) sessionMaxCombo = sessionCombo;
    updateHUD();
  } else {
    sessionCombo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  updatePersistentStats(sessionMaxCombo, sessionLines);

  overlayTitle.textContent = 'GAME OVER';
  overlayTitle.style.color = '';
  overlayContent.innerHTML = '';
  overlayActions.innerHTML = '';

  const scoreInfo = document.createElement('p');
  scoreInfo.className = 'hs-score-info';
  scoreInfo.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayContent.appendChild(scoreInfo);

  if (isTopFive(score)) {
    // mostrar input para guardar nombre
    const nameRow = document.createElement('div');
    nameRow.className = 'hs-name-row';
    nameRow.innerHTML = `<label>Tu nombre:</label>
      <input class="hs-name-input" id="hs-name-input" type="text" maxlength="12" placeholder="Jugador" />`;
    overlayContent.appendChild(nameRow);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn';
    saveBtn.textContent = 'Guardar';
    overlayActions.appendChild(saveBtn);

    const nameInput = document.getElementById('hs-name-input');
    nameInput.focus();

    const doSave = () => {
      const name = nameInput.value.trim() || 'Jugador';
      const idx = saveHighscore(name, score, lines, level);
      overlayContent.innerHTML = '';
      renderHighscoresTable(overlayContent, idx);
      overlayActions.innerHTML = '';
      appendRestartBtn();
    };

    saveBtn.addEventListener('click', doSave);
    nameInput.addEventListener('keydown', e => { if (e.code === 'Enter') doSave(); });
  } else {
    // no entra en top 5: mostrar tabla directamente
    renderHighscoresTable(overlayContent, -1);
    appendRestartBtn();
  }

  overlay.classList.remove('hidden');
}

function appendRestartBtn() {
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = '↺ Jugar de nuevo';
  btn.addEventListener('click', startGame);
  overlayActions.appendChild(btn);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayTitle.style.color = '';
    overlayContent.innerHTML = '';
    overlayActions.innerHTML = '';
    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'btn';
    resumeBtn.textContent = '▶ Continuar';
    resumeBtn.addEventListener('click', togglePause);
    overlayActions.appendChild(resumeBtn);
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  sessionCombo = 0;
  sessionMaxCombo = 0;
  sessionLines = 0;
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

document.getElementById('theme-toggle-input').addEventListener('change', e => {
  const isLight = e.target.checked;
  document.body.classList.toggle('light', isLight);
  gridColor = isLight ? '#d0d0e0' : '#22222e';
});

// Mostrar pantalla de inicio al cargar (sin arrancar el loop)
showStartScreen();
