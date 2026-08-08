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
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (anillo con hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const GRID_LINES = { dark: '#22222e', light: '#d8d8e2' };
const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 9;
const HIGHSCORES_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';
const MAX_SCORES = 5;

const SKINS = {
  retro: { label: 'Retro' },
  neon: { label: 'Neon' },
  pastel: { label: 'Pastel' },
  pixel: { label: 'Pixel Art' },
};
const SKIN_KEY = 'tetris-skin';

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
const themeSwitch = document.getElementById('theme-switch');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const controlsToggleBtn = document.getElementById('controls-toggle-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level-select');
const leaderboardListEl = document.getElementById('leaderboard-list');
const bestComboValueEl = document.getElementById('best-combo-value');
const maxLinesValueEl = document.getElementById('max-lines-value');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, theme, combo, bestCombo, skin;

function applyTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  themeSwitch.checked = theme === 'light';
  draw();
  drawNext();
}

function getStartLevel() {
  const stored = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  if (stored >= MIN_START_LEVEL && stored <= MAX_START_LEVEL) return stored;
  return MIN_START_LEVEL;
}

function syncStartLevelSelect() {
  startLevelSelect.value = String(getStartLevel());
}

function loadScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIGHSCORES_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function saveScores(list) {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
}

function qualifiesForTop5(s) {
  const list = loadScores();
  return list.length < MAX_SCORES || s > list[list.length - 1].score;
}

function insertScore(name, s) {
  const list = loadScores();
  const entry = { name, score: s };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  if (list.length > MAX_SCORES) list.length = MAX_SCORES;
  const idx = list.indexOf(entry);
  saveScores(list);
  return { list, idx };
}

function loadBestCombo() {
  return parseInt(localStorage.getItem(BEST_COMBO_KEY), 10) || 0;
}

function saveBestCombo(v) {
  localStorage.setItem(BEST_COMBO_KEY, String(v));
}

function loadMaxLines() {
  return parseInt(localStorage.getItem(MAX_LINES_KEY), 10) || 0;
}

function saveMaxLines(v) {
  localStorage.setItem(MAX_LINES_KEY, String(v));
}

function renderLeaderboard(highlightIndex) {
  const list = loadScores();
  leaderboardListEl.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'leaderboard-empty';
    li.textContent = '— sin puntuaciones —';
    leaderboardListEl.appendChild(li);
  } else {
    list.forEach((entry, i) => {
      const li = document.createElement('li');
      if (i === highlightIndex) li.classList.add('highlight');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'lb-name';
      nameSpan.textContent = `${i + 1}. ${entry.name}`;
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'lb-score';
      scoreSpan.textContent = entry.score.toLocaleString();
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      leaderboardListEl.appendChild(li);
    });
  }
  bestComboValueEl.textContent = loadBestCombo();
  maxLinesValueEl.textContent = loadMaxLines();
}

function applySkin(name) {
  skin = SKINS[name] ? name : 'retro';
  document.documentElement.setAttribute('data-skin', skin);
  localStorage.setItem(SKIN_KEY, skin);
  if (skinSelect) skinSelect.value = skin;
  draw();
  drawNext();
}

function lighten(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
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
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    bestCombo = Math.max(bestCombo, combo);
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

function drawRetroBlock(context, px, py, s, colorIndex) {
  context.fillStyle = COLORS[colorIndex];
  context.fillRect(px, py, s, s);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, s, 4);
}

function drawNeonBlock(context, px, py, s, colorIndex) {
  const color = COLORS[colorIndex];
  context.save();
  context.shadowBlur = 12;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  context.restore();
  context.fillStyle = 'rgba(255,255,255,0.18)';
  context.fillRect(px, py, s, 4);
}

function drawPastelBlock(context, px, py, s, colorIndex) {
  const color = lighten(COLORS[colorIndex], 0.35);
  const radius = Math.min(6, s / 4);
  context.fillStyle = color;
  roundRectPath(context, px, py, s, s, radius);
  context.fill();
  context.save();
  roundRectPath(context, px, py, s, s, radius);
  context.clip();
  context.fillStyle = 'rgba(255,255,255,0.3)';
  context.fillRect(px, py, s, 4);
  context.restore();
}

function drawPixelBlock(context, px, py, s, colorIndex) {
  context.fillStyle = COLORS[colorIndex];
  context.fillRect(px, py, s, s);
  const cell = Math.max(2, Math.floor(s / 4));
  for (let iy = 0; iy * cell < s; iy++) {
    for (let ix = 0; ix * cell < s; ix++) {
      const cx = px + ix * cell;
      const cy = py + iy * cell;
      const cw = Math.min(cell, px + s - cx);
      const ch = Math.min(cell, py + s - cy);
      context.fillStyle = (ix + iy) % 2 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
      context.fillRect(cx, cy, cw, ch);
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.globalAlpha = alpha ?? 1;

  switch (skin) {
    case 'neon':
      drawNeonBlock(context, px, py, s, colorIndex);
      break;
    case 'pastel':
      drawPastelBlock(context, px, py, s, colorIndex);
      break;
    case 'pixel':
      drawPixelBlock(context, px, py, s, colorIndex);
      break;
    default:
      drawRetroBlock(context, px, py, s, colorIndex);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = GRID_LINES[theme];
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
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  pauseMenu.classList.add('hidden');
  restartBtn.classList.remove('hidden');

  if (bestCombo > loadBestCombo()) saveBestCombo(bestCombo);
  if (lines > loadMaxLines()) saveMaxLines(lines);

  if (qualifiesForTop5(score)) {
    nameEntry.classList.remove('hidden');
    nameInput.value = '';
    saveScoreBtn.onclick = () => {
      const name = (nameInput.value.trim() || 'PLAYER').slice(0, 12).toUpperCase();
      const { idx } = insertScore(name, score);
      renderLeaderboard(idx);
      nameEntry.classList.add('hidden');
    };
  } else {
    nameEntry.classList.add('hidden');
  }

  renderLeaderboard();
  overlay.classList.remove('hidden');
  if (!nameEntry.classList.contains('hidden')) nameInput.focus();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    restartBtn.classList.add('hidden');
    pauseControls.classList.add('hidden');
    controlsToggleBtn.textContent = 'Ver controles';
    syncStartLevelSelect();
    pauseMenu.classList.remove('hidden');
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
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = getStartLevel();
  combo = 0;
  bestCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  applySkin(localStorage.getItem(SKIN_KEY) || 'retro');
  pauseMenu.classList.add('hidden');
  pauseControls.classList.add('hidden');
  controlsToggleBtn.textContent = 'Ver controles';
  restartBtn.classList.remove('hidden');
  overlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  renderLeaderboard();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

themeSwitch.addEventListener('change', () => {
  applyTheme(themeSwitch.checked ? 'light' : 'dark');
});

startLevelSelect.addEventListener('change', () => {
  localStorage.setItem(START_LEVEL_KEY, startLevelSelect.value);
});

resumeBtn.addEventListener('click', togglePause);
menuRestartBtn.addEventListener('click', init);
controlsToggleBtn.addEventListener('click', () => {
  const nowHidden = pauseControls.classList.toggle('hidden');
  controlsToggleBtn.textContent = nowHidden ? 'Ver controles' : 'Ocultar controles';
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
});

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
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

restartBtn.addEventListener('click', init);

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  localStorage.removeItem(HIGHSCORES_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(MAX_LINES_KEY);
  renderLeaderboard();
});

nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveScoreBtn.click();
});

init();
