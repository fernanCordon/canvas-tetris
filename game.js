'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

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

const SKINS = {
  retro: {
    colors: [null,'#4dd0e1','#ffd54f','#ba68c8','#81c784','#e57373','#64b5f6','#ffb74d','#f06292'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = this.colors[colorIndex];
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      ctx.globalAlpha = 1;
    },
  },
  neon: {
    colors: [null,'#00fff7','#ffe600','#d400ff','#00ff66','#ff1744','#2979ff','#ff9100','#ff4081'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = '#060606';
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = 1;
    },
  },
  pastel: {
    colors: [null,'#b2ebf2','#fff9c4','#e1bee7','#c8e6c9','#ffcdd2','#bbdefb','#ffe0b2','#fce4ec'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      ctx.globalAlpha = alpha ?? 1;
      const px = x * size + 1, py = y * size + 1, pw = size - 2, ph = size - 2, r = 6;
      ctx.fillStyle = this.colors[colorIndex];
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(px, py, pw, ph, r);
      } else {
        ctx.moveTo(px + r, py);
        ctx.lineTo(px + pw - r, py);
        ctx.arcTo(px + pw, py, px + pw, py + r, r);
        ctx.lineTo(px + pw, py + ph - r);
        ctx.arcTo(px + pw, py + ph, px + pw - r, py + ph, r);
        ctx.lineTo(px + r, py + ph);
        ctx.arcTo(px, py + ph, px, py + ph - r, r);
        ctx.lineTo(px, py + r);
        ctx.arcTo(px, py, px + r, py, r);
        ctx.closePath();
      }
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(px + 2, py + 2, Math.floor(pw / 2), Math.floor(ph / 2));
      ctx.globalAlpha = 1;
    },
  },
  pixel: {
    colors: [null,'#4dd0e1','#ffd54f','#ba68c8','#81c784','#e57373','#64b5f6','#ffb74d','#f06292'],
    get darkColors() {
      const val = this.colors.map(c => {
        if (!c) return null;
        const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
        return `rgb(${Math.floor(r*0.5)},${Math.floor(g*0.5)},${Math.floor(b*0.5)})`;
      });
      Object.defineProperty(this, 'darkColors', { value: val });
      return val;
    },
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      ctx.globalAlpha = alpha ?? 1;
      const color = this.colors[colorIndex];
      const dark = this.darkColors[colorIndex];
      const sub = Math.floor(size / 4);
      for (let sr = 0; sr < 4; sr++)
        for (let sc = 0; sc < 4; sc++) {
          ctx.fillStyle = (sr + sc) % 2 === 0 ? color : dark;
          ctx.fillRect(x * size + sc * sub + 1, y * size + sr * sub + 1, sub - 1, sub - 1);
        }
      ctx.globalAlpha = 1;
    },
  },
};

let activeSkin = localStorage.getItem('tetris.skin') || 'retro';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

// Overlay views
const viewGameover    = document.getElementById('view-gameover');
const viewPause       = document.getElementById('view-pause');
const viewControls    = document.getElementById('view-controls');
const viewStartLevel  = document.getElementById('view-startlevel');
const viewHighscores  = document.getElementById('view-highscores');

// Game-over highscore elements
const goTableContainer = document.getElementById('go-table-container');
const goNameSection    = document.getElementById('go-name-section');
const goNameInput      = document.getElementById('go-name-input');
const goSaveBtn        = document.getElementById('go-save-btn');

// Start screen elements
const hsTableContainer = document.getElementById('hs-table-container');
const hsPlayBtn        = document.getElementById('hs-play-btn');
const hsResetBtn       = document.getElementById('hs-reset-btn');

// Pause menu buttons
const btnResume        = document.getElementById('btn-resume');
const btnRestartPause  = document.getElementById('btn-restart-pause');
const btnControlsMenu  = document.getElementById('btn-controls');
const btnStartLevel    = document.getElementById('btn-startlevel');
const startlevelDisplay = document.getElementById('startlevel-display');

// Controls view
const btnBackControls = document.getElementById('btn-back-controls');

// Start-level view
const levelPickerValue = document.getElementById('level-picker-value');
const btnLevelDec      = document.getElementById('btn-level-dec');
const btnLevelInc      = document.getElementById('btn-level-inc');
const btnBackStartLevel = document.getElementById('btn-back-startlevel');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor = activeSkin === 'neon' ? '#0a0a0a' : '#22222e';
// 'none' | 'pause' | 'controls' | 'startLevel' | 'gameover' | 'highscores'
let overlayState = 'none';
let chosenStartLevel = parseInt(localStorage.getItem('tetris.startLevel') || '1', 10);
let combo = 0;
let maxComboGame = 0;

// ---- localStorage helpers ----

function loadHighscores() {
  try { return JSON.parse(localStorage.getItem('tetris.highscores')) || []; }
  catch { return []; }
}

function saveHighscore(name, s, l, lv) {
  const hs = loadHighscores();
  hs.push({ name, score: s, lines: l, level: lv });
  hs.sort((a, b) => b.score - a.score);
  hs.splice(5);
  localStorage.setItem('tetris.highscores', JSON.stringify(hs));
  return hs;
}

function isTopFive(s) {
  const hs = loadHighscores();
  return hs.length < 5 || s > hs[hs.length - 1].score;
}

function loadStat(key) {
  return parseInt(localStorage.getItem(key) || '0', 10);
}

function saveStat(key, value) {
  if (value > loadStat(key)) localStorage.setItem(key, value);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderHighscoresTable(container, newEntryIndex) {
  const hs = loadHighscores();
  const bestCombo = loadStat('tetris.bestCombo');
  const maxLines  = loadStat('tetris.maxLines');

  let html = '<table class="hs-table"><thead><tr>'
    + '<th>Pos</th><th>Nombre</th><th>Score</th><th>Líneas</th><th>Nivel</th>'
    + '</tr></thead><tbody>';

  if (hs.length === 0) {
    html += '<tr><td colspan="5" class="hs-empty">Sin records aún</td></tr>';
  } else {
    hs.forEach((entry, i) => {
      const cls = (i === newEntryIndex) ? ' class="hs-new"' : '';
      html += `<tr${cls}><td>${i + 1}</td><td>${escapeHtml(entry.name)}</td>`
        + `<td>${entry.score.toLocaleString()}</td><td>${entry.lines}</td><td>${entry.level}</td></tr>`;
    });
  }

  html += '</tbody></table>'
    + `<p class="hs-stats">Mejor combo: <strong>${bestCombo}</strong> líneas a la vez`
    + ` &nbsp;|&nbsp; Máx. líneas en una partida: <strong>${maxLines}</strong></p>`;

  container.innerHTML = html;
}

// ---- Board logic ----

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

function calcDropInterval(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
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
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = calcDropInterval(level);
    combo++;
    if (combo > maxComboGame) maxComboGame = combo;
    updateHUD();
  } else {
    combo = 0;
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
  SKINS[activeSkin].drawBlock(context, x, y, colorIndex, size, alpha);
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

function showView(state) {
  overlayState = state;
  const views = { gameover: viewGameover, pause: viewPause, controls: viewControls, startLevel: viewStartLevel, highscores: viewHighscores };
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle('hidden', key !== state);
  }
  overlay.classList.toggle('hidden', state === 'none');
}

function syncStartLevelUI() {
  startlevelDisplay.textContent = chosenStartLevel;
  levelPickerValue.textContent = chosenStartLevel;
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  saveStat('tetris.bestCombo', maxComboGame);
  saveStat('tetris.maxLines', lines);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  if (isTopFive(score)) {
    goNameSection.classList.remove('hidden');
    goTableContainer.classList.add('hidden');
    goNameInput.value = '';
    restartBtn.classList.add('hidden');
  } else {
    goNameSection.classList.add('hidden');
    goTableContainer.classList.remove('hidden');
    renderHighscoresTable(goTableContainer, -1);
    restartBtn.classList.remove('hidden');
  }

  showView('gameover');
}

function togglePause() {
  if (gameOver) return;
  if (paused) {
    paused = false;
    showView('none');
    lastTime = performance.now();
    dropAccum = 0;
    loop(lastTime);
  } else {
    paused = true;
    cancelAnimationFrame(animId);
    showView('pause');
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
  level = chosenStartLevel;
  paused = false;
  gameOver = false;
  dropInterval = calcDropInterval(chosenStartLevel);
  dropAccum = 0;
  combo = 0;
  maxComboGame = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  showView('none');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (overlayState === 'none' || overlayState === 'pause') togglePause();
    return;
  }
  if (overlayState !== 'none') return;
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

restartBtn.addEventListener('click', init);
hsPlayBtn.addEventListener('click', init);

hsResetBtn.addEventListener('click', () => {
  localStorage.removeItem('tetris.highscores');
  localStorage.removeItem('tetris.bestCombo');
  localStorage.removeItem('tetris.maxLines');
  renderHighscoresTable(hsTableContainer, -1);
});

// Game-over: save score to top 5
goSaveBtn.addEventListener('click', () => {
  const name = goNameInput.value.trim() || 'Anónimo';
  const hs = saveHighscore(name, score, lines, level);
  const newIdx = hs.findIndex(e => e.name === name && e.score === score);
  goNameSection.classList.add('hidden');
  goTableContainer.classList.remove('hidden');
  renderHighscoresTable(goTableContainer, newIdx);
  restartBtn.classList.remove('hidden');
});

goNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') goSaveBtn.click();
});

btnResume.addEventListener('click', togglePause);
btnRestartPause.addEventListener('click', init);
btnControlsMenu.addEventListener('click', () => showView('controls'));
btnStartLevel.addEventListener('click', () => { syncStartLevelUI(); showView('startLevel'); });
btnBackControls.addEventListener('click', () => showView('pause'));

btnLevelDec.addEventListener('click', () => {
  if (chosenStartLevel > 1) {
    chosenStartLevel--;
    localStorage.setItem('tetris.startLevel', chosenStartLevel);
    syncStartLevelUI();
  }
});
btnLevelInc.addEventListener('click', () => {
  if (chosenStartLevel < 10) {
    chosenStartLevel++;
    localStorage.setItem('tetris.startLevel', chosenStartLevel);
    syncStartLevelUI();
  }
});
btnBackStartLevel.addEventListener('click', () => showView('pause'));

function updateGridColor() {
  gridColor = activeSkin === 'neon' ? '#0a0a0a'
    : document.body.classList.contains('light') ? '#d0d0e0' : '#22222e';
}

document.getElementById('theme-toggle-input').addEventListener('change', e => {
  document.body.classList.toggle('light', e.target.checked);
  updateGridColor();
});

document.querySelectorAll('.skin-btn').forEach(btn => {
  btn.classList.toggle('active', btn.dataset.skin === activeSkin);
  btn.addEventListener('click', () => {
    activeSkin = btn.dataset.skin;
    localStorage.setItem('tetris.skin', activeSkin);
    document.querySelectorAll('.skin-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateGridColor();
    if (current) { draw(); drawNext(); }
  });
});

syncStartLevelUI();
// Show records screen on load; game loop starts only when user clicks "Jugar"
renderHighscoresTable(hsTableContainer, -1);
showView('highscores');
