'use strict';

// ---------- Oppsett ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const ui = {
  hud: $('hud'), score: $('score'), combo: $('combo'), lives: $('lives'),
  menu: $('menu'), pause: $('pause'), over: $('over'),
  best: $('best'), overBest: $('overBest'), finalScore: $('finalScore'), newBest: $('newBest'),
  soundBtn: $('soundBtn'), installHint: $('installHint'),
};

let W = 0, H = 0, dpr = 1, S = 1; // S = skalering ut fra skjermstørrelse
const sprites = {};

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  S = Math.min(W, H) / 400;
  buildSprites();
  if (player) {
    player.y = playerY();
    player.x = clamp(player.x, player.r, W - player.r);
  }
  initBackground();
}

// ---------- Hjelpere ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function storageGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignorer */ }
}

function makeSprite(size, draw) {
  const c = document.createElement('canvas');
  const px = Math.ceil(size * dpr);
  c.width = px; c.height = px;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  draw(g, size);
  return { img: c, size };
}

function starPath(g, cx, cy, outer, inner, points = 5) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

function buildSprites() {
  const starR = 16 * S;
  sprites.star = makeSprite(starR * 4, (g, size) => {
    const c = size / 2;
    g.shadowColor = 'rgba(255, 210, 80, 0.9)';
    g.shadowBlur = starR * 1.2;
    const grad = g.createRadialGradient(c, c - starR * 0.3, 1, c, c, starR);
    grad.addColorStop(0, '#fffbe0');
    grad.addColorStop(0.5, '#ffd84d');
    grad.addColorStop(1, '#ff9f1c');
    g.fillStyle = grad;
    starPath(g, c, c, starR, starR * 0.45);
    g.fill();
  });

  const metR = 20 * S;
  sprites.meteor = makeSprite(metR * 2.6, (g, size) => {
    const c = size / 2;
    g.shadowColor = 'rgba(255, 90, 60, 0.8)';
    g.shadowBlur = metR * 0.5;
    g.beginPath();
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const r = metR * (0.82 + ((i * 37) % 7) / 30);
      g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    g.closePath();
    const grad = g.createRadialGradient(c - metR * 0.3, c - metR * 0.3, 2, c, c, metR);
    grad.addColorStop(0, '#9b8a8a');
    grad.addColorStop(1, '#3b2f36');
    g.fillStyle = grad;
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    [[-0.3, 0.2, 0.22], [0.35, -0.1, 0.16], [0.05, -0.4, 0.12]].forEach(([dx, dy, rr]) => {
      g.beginPath();
      g.arc(c + dx * metR, c + dy * metR, rr * metR, 0, Math.PI * 2);
      g.fill();
    });
  });

  const puR = 18 * S;
  const emojiSprite = (emoji, ring) => makeSprite(puR * 3, (g, size) => {
    const c = size / 2;
    g.shadowColor = ring;
    g.shadowBlur = puR;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.strokeStyle = ring;
    g.lineWidth = 2 * S;
    g.beginPath();
    g.arc(c, c, puR, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.shadowBlur = 0;
    g.font = `${puR * 1.15}px -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, c, c + puR * 0.08);
  });
  sprites.shield = emojiSprite('🛡️', '#6ee7ff');
  sprites.heart = emojiSprite('❤️', '#ff6b8b');

  const shipR = 22 * S;
  sprites.ship = makeSprite(shipR * 3, (g, size) => {
    const c = size / 2;
    g.shadowColor = 'rgba(110, 231, 255, 0.8)';
    g.shadowBlur = shipR * 0.6;
    // vinger
    g.fillStyle = '#5b6cff';
    g.beginPath();
    g.moveTo(c, c - shipR * 0.2);
    g.lineTo(c + shipR, c + shipR * 0.75);
    g.lineTo(c + shipR * 0.35, c + shipR * 0.6);
    g.lineTo(c - shipR * 0.35, c + shipR * 0.6);
    g.lineTo(c - shipR, c + shipR * 0.75);
    g.closePath();
    g.fill();
    // kropp
    const grad = g.createLinearGradient(c - shipR * 0.4, 0, c + shipR * 0.4, 0);
    grad.addColorStop(0, '#d9e2ff');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#aab8ff');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(c, c - shipR);
    g.quadraticCurveTo(c + shipR * 0.45, c, c + shipR * 0.32, c + shipR * 0.7);
    g.lineTo(c - shipR * 0.32, c + shipR * 0.7);
    g.quadraticCurveTo(c - shipR * 0.45, c, c, c - shipR);
    g.fill();
    // cockpit
    g.shadowBlur = 0;
    g.fillStyle = '#6ee7ff';
    g.beginPath();
    g.ellipse(c, c - shipR * 0.25, shipR * 0.14, shipR * 0.26, 0, 0, Math.PI * 2);
    g.fill();
  });
}

// ---------- Lyd ----------
let audio = null;
let soundOn = storageGet('stjerne.sound', '1') === '1';

function initAudio() {
  if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio = new AC();
}

function beep(freq, dur = 0.1, type = 'sine', vol = 0.15, slideTo = null) {
  if (!soundOn || !audio) return;
  const t = audio.currentTime;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function updateSoundBtn() { ui.soundBtn.textContent = `Lyd: ${soundOn ? 'på' : 'av'}`; }

// ---------- Bakgrunn ----------
let bgStars = [];
function initBackground() {
  const count = Math.round((W * H) / 2500);
  bgStars = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    layer: Math.random() < 0.7 ? 1 : Math.random() < 0.7 ? 2 : 3,
    tw: Math.random() * Math.PI * 2,
  }));
}

function drawBackground(dt, speed) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0b1026');
  grad.addColorStop(1, '#1b1446');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  for (const s of bgStars) {
    s.y += speed * dt * s.layer * 0.12;
    s.tw += dt * 2;
    if (s.y > H) { s.y = -2; s.x = Math.random() * W; }
    const a = 0.35 + 0.25 * s.layer * (0.7 + 0.3 * Math.sin(s.tw));
    ctx.fillStyle = `rgba(220, 225, 255, ${Math.min(a, 1)})`;
    const size = s.layer * 0.7 * S;
    ctx.fillRect(s.x, s.y, size, size * (1 + s.layer * 0.4));
  }
}

// ---------- Spilltilstand ----------
let state = 'menu';
let player = null;
let objects = [];
let particles = [];
let popups = [];
let score = 0, combo = 0, lives = 3, time = 0;
let spawnTimer = 0, invuln = 0, shieldT = 0, shake = 0;
let best = parseInt(storageGet('stjerne.best', '0'), 10) || 0;

const playerY = () => H - Math.max(110 * S, H * 0.16);

function multiplier() { return Math.min(5, 1 + Math.floor(combo / 8)); }
function gameSpeed() { return Math.min(620, 200 + time * 7) * S; }

function resetGame() {
  player = { x: W / 2, y: playerY(), tx: W / 2, r: 22 * S, tilt: 0 };
  objects = [];
  particles = [];
  popups = [];
  score = 0; combo = 0; lives = 3; time = 0;
  spawnTimer = 0.6; invuln = 0; shieldT = 0; shake = 0;
  updateHud();
}

function spawn() {
  const speed = gameSpeed();
  const r = Math.random();
  const meteorChance = Math.min(0.55, 0.28 + time * 0.006);
  let type = 'star';
  if (r < 0.025 && shieldT <= 0) type = 'shield';
  else if (r < 0.04 && lives < 3) type = 'heart';
  else if (r < 0.04 + meteorChance) type = 'meteor';

  const radius = type === 'star' ? 16 * S : type === 'meteor' ? rand(16, 24) * S : 18 * S;
  const o = {
    type,
    x: rand(radius, W - radius),
    y: -radius * 2,
    r: radius,
    vy: speed * rand(0.8, 1.25) * (type === 'meteor' ? 1.1 : 1),
    vx: type === 'meteor' && time > 20 ? rand(-40, 40) * S : 0,
    rot: rand(0, Math.PI * 2),
    vr: rand(-2, 2),
  };
  objects.push(o);
}

function burst(x, y, color, n = 14, power = 220) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(power * 0.3, power) * S;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.4, 0.8), max: 0.8, color, size: rand(2, 4) * S });
  }
}

function popup(x, y, text, color) { popups.push({ x, y, text, color, life: 0.9 }); }

function updateHud() {
  ui.score.textContent = score;
  const m = multiplier();
  ui.combo.textContent = m > 1 ? `x${m} combo` : '';
  ui.lives.textContent = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives));
}

function hitPlayer(o) {
  const dx = o.x - player.x, dy = o.y - player.y;
  const rr = o.r * 0.85 + player.r * 0.7;
  return dx * dx + dy * dy < rr * rr;
}

function update(dt) {
  time += dt;
  invuln = Math.max(0, invuln - dt);
  shieldT = Math.max(0, shieldT - dt);
  shake = Math.max(0, shake - dt * 30);

  // spiller
  const prevX = player.x;
  player.tx = clamp(player.tx, player.r, W - player.r);
  player.x += (player.tx - player.x) * Math.min(1, dt * 20);
  const vx = (player.x - prevX) / Math.max(dt, 0.001);
  player.tilt += (clamp(vx / (900 * S), -0.45, 0.45) - player.tilt) * Math.min(1, dt * 12);

  // spawning
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawn();
    spawnTimer = Math.max(0.24, 0.85 - time * 0.011) * rand(0.7, 1.2);
  }

  // objekter
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    o.y += o.vy * dt;
    o.x += o.vx * dt;
    o.rot += o.vr * dt;
    if (o.x < o.r || o.x > W - o.r) o.vx *= -1;

    if (hitPlayer(o)) {
      objects.splice(i, 1);
      if (o.type === 'star') {
        combo++;
        const m = multiplier();
        score += m;
        burst(o.x, o.y, '#ffd84d', 12);
        popup(o.x, o.y, `+${m}`, '#ffd84d');
        beep(660 + Math.min(combo, 24) * 25, 0.09, 'triangle', 0.12);
      } else if (o.type === 'shield') {
        shieldT = 6;
        burst(o.x, o.y, '#6ee7ff', 20);
        popup(o.x, o.y, 'Skjold!', '#6ee7ff');
        beep(440, 0.25, 'sine', 0.15, 1200);
      } else if (o.type === 'heart') {
        lives = Math.min(3, lives + 1);
        burst(o.x, o.y, '#ff6b8b', 20);
        popup(o.x, o.y, '+1 liv', '#ff6b8b');
        beep(520, 0.2, 'sine', 0.15, 1040);
      } else if (o.type === 'meteor') {
        if (shieldT > 0) {
          score += 2;
          burst(o.x, o.y, '#6ee7ff', 18, 300);
          popup(o.x, o.y, '+2', '#6ee7ff');
          beep(300, 0.12, 'square', 0.08, 900);
        } else if (invuln <= 0) {
          lives--;
          combo = 0;
          invuln = 1.5;
          shake = 14;
          burst(o.x, o.y, '#ff7b54', 26, 340);
          beep(180, 0.35, 'sawtooth', 0.18, 50);
          if (navigator.vibrate) navigator.vibrate(120);
          if (lives <= 0) { updateHud(); endGame(); return; }
        }
      }
      updateHud();
      continue;
    }

    if (o.y - o.r > H) {
      objects.splice(i, 1);
      if (o.type === 'star' && combo > 0) { combo = 0; updateHud(); }
    }
  }

  // partikler
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    popups[i].life -= dt;
    popups[i].y -= 50 * S * dt;
    if (popups[i].life <= 0) popups.splice(i, 1);
  }
}

function drawSprite(sp, x, y, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(sp.img, -sp.size / 2, -sp.size / 2, sp.size, sp.size);
  ctx.restore();
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);

  for (const o of objects) {
    if (o.type === 'meteor') {
      // ildhale
      const len = o.r * 3.2;
      const ang = Math.atan2(o.vy, o.vx);
      const tx = o.x - Math.cos(ang) * len, ty = o.y - Math.sin(ang) * len;
      const g = ctx.createLinearGradient(o.x, o.y, tx, ty);
      g.addColorStop(0, 'rgba(255, 140, 60, 0.75)');
      g.addColorStop(1, 'rgba(255, 60, 60, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      const px = Math.cos(ang + Math.PI / 2) * o.r * 0.8, py = Math.sin(ang + Math.PI / 2) * o.r * 0.8;
      ctx.moveTo(o.x + px, o.y + py);
      ctx.lineTo(tx, ty);
      ctx.lineTo(o.x - px, o.y - py);
      ctx.closePath();
      ctx.fill();
      const k = o.r / (20 * S);
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      ctx.scale(k, k);
      ctx.drawImage(sprites.meteor.img, -sprites.meteor.size / 2, -sprites.meteor.size / 2, sprites.meteor.size, sprites.meteor.size);
      ctx.restore();
    } else if (o.type === 'star') {
      drawSprite(sprites.star, o.x, o.y, o.rot * 0.5);
    } else {
      const bob = Math.sin(time * 6 + o.x) * 0.08;
      drawSprite(sprites[o.type], o.x, o.y, bob);
    }
  }

  // spiller
  if (player && (state !== 'play' || invuln <= 0 || Math.floor(invuln * 12) % 2 === 0)) {
    // flamme
    const fl = (0.7 + Math.random() * 0.5) * player.r;
    const g = ctx.createLinearGradient(0, player.y + player.r * 0.6, 0, player.y + player.r * 0.6 + fl);
    g.addColorStop(0, 'rgba(255, 230, 140, 0.95)');
    g.addColorStop(1, 'rgba(255, 90, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(player.x - player.r * 0.25, player.y + player.r * 0.6);
    ctx.lineTo(player.x, player.y + player.r * 0.6 + fl);
    ctx.lineTo(player.x + player.r * 0.25, player.y + player.r * 0.6);
    ctx.fill();
    drawSprite(sprites.ship, player.x, player.y, player.tilt);

    if (shieldT > 0) {
      const blink = shieldT < 1.5 && Math.floor(shieldT * 8) % 2 === 0;
      if (!blink) {
        ctx.strokeStyle = 'rgba(110, 231, 255, 0.85)';
        ctx.fillStyle = 'rgba(110, 231, 255, 0.12)';
        ctx.lineWidth = 3 * S;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r * 1.6 + Math.sin(time * 10) * 2 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // partikler
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${18 * S}px -apple-system, system-ui, sans-serif`;
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life / 0.9, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------- Hovedløkke ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const bgSpeed = state === 'play' ? gameSpeed() : 120 * S;
  drawBackground(state === 'pause' ? 0 : dt, bgSpeed);
  if (state === 'play') update(dt);
  draw();
  requestAnimationFrame(frame);
}

// ---------- Skjermer ----------
function show(el) { [ui.menu, ui.pause, ui.over].forEach((x) => x.classList.toggle('hidden', x !== el)); }

function updateBestText() {
  const t = best > 0 ? `Rekord: ${best}` : '';
  ui.best.textContent = t;
  ui.overBest.textContent = t;
}

function startGame() {
  initAudio();
  resetGame();
  state = 'play';
  show(null);
  ui.hud.classList.remove('hidden');
  beep(520, 0.15, 'triangle', 0.12, 880);
}

function endGame() {
  state = 'over';
  const isBest = score > best;
  if (isBest) { best = score; storageSet('stjerne.best', String(best)); }
  ui.finalScore.textContent = score;
  ui.newBest.classList.toggle('hidden', !isBest || score === 0);
  updateBestText();
  ui.hud.classList.add('hidden');
  setTimeout(() => { if (state === 'over') show(ui.over); }, 600);
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'pause';
  show(ui.pause);
}

function resumeGame() {
  if (state !== 'pause') return;
  initAudio();
  state = 'play';
  show(null);
}

function toMenu() {
  state = 'menu';
  player = null;
  objects = [];
  ui.hud.classList.add('hidden');
  updateBestText();
  show(ui.menu);
}

// ---------- Input ----------
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'play') return;
  canvas.setPointerCapture?.(e.pointerId);
  drag = { id: e.pointerId, fx: e.clientX, px: player.tx };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId || state !== 'play') return;
  player.tx = drag.px + (e.clientX - drag.fx) * 1.4;
  // Unngå at fingeren drar skipet "forbi" kanten og må tilbake
  const clamped = clamp(player.tx, player.r, W - player.r);
  if (clamped !== player.tx) { drag.px += clamped - player.tx; player.tx = clamped; }
});
const endDrag = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// Tastatur (for testing på PC)
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key);
  if (e.key === ' ' || e.key === 'Enter') {
    if (state === 'menu' || state === 'over') startGame();
    else if (state === 'pause') resumeGame();
  }
  if (e.key === 'Escape' || e.key === 'p') state === 'play' ? pauseGame() : resumeGame();
});
window.addEventListener('keyup', (e) => keys.delete(e.key));
setInterval(() => {
  if (state !== 'play' || !player) return;
  const step = 14 * S;
  if (keys.has('ArrowLeft') || keys.has('a')) player.tx -= step;
  if (keys.has('ArrowRight') || keys.has('d')) player.tx += step;
}, 16);

// Hindre zoom/scroll på iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });

$('startBtn').addEventListener('click', startGame);
$('retryBtn').addEventListener('click', startGame);
$('menuBtn').addEventListener('click', toMenu);
$('pauseBtn').addEventListener('click', pauseGame);
$('resumeBtn').addEventListener('click', resumeGame);
$('quitBtn').addEventListener('click', toMenu);
ui.soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  storageSet('stjerne.sound', soundOn ? '1' : '0');
  updateSoundBtn();
  initAudio();
  beep(660, 0.08, 'triangle', 0.1);
});

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('resize', resize);

// ---------- Installasjon / offline ----------
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
if (isIOS && !isStandalone) ui.installHint.classList.remove('hidden');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline-støtte er valgfritt */ });
  });
}

// ---------- Start ----------
resize();
updateSoundBtn();
updateBestText();
requestAnimationFrame(frame);
