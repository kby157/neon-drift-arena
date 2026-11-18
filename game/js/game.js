// game.js — Neon Drift Arena's main loop and screens. Owns the world state
// (ship, enemies, bullets, particles, pickups), the collisions, the score
// and combo counter, the HUD, and the title / pause / victory / game-over
// screens. Waves come from waves.js; the cast lives in entities.js.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = {
  player: makePlayer(),
  enemies: [],
  bullets: [],
  particles: [],
  pickups: [],
  texts: [],
  score: 0,
  best: 0,
  combo: 0,
  comboT: 0,
  shake: 0,
  hurtFlash: 0,
  banner: '',
  bannerT: 0,
  won: false,
  time: 0,
};

try {
  world.best = Number(localStorage.getItem('neonDriftBest') || 0) || 0;
} catch (err) { /* storage may be unavailable; the best score just resets */ }

let state = 'title'; // 'title' | 'playing' | 'paused' | 'over' | 'victory'

world.addScore = (base, x, y) => {
  world.combo += 1;
  world.comboT = 3;
  const mult = Math.min(4, 1 + Math.floor(world.combo / 8) * 0.5);
  const gained = Math.round(base * mult);
  world.score += gained;
  addText(world, x, y - 14, `+${gained}`, '#e8fbff');
};

world.onWaveStart = (n) => {
  world.banner = n > FINAL_WAVE ? `WAVE ${n} — BEYOND THE SECTOR` : `WAVE ${n}`;
  world.bannerT = 2;
};

world.onWaveCleared = (n) => {
  const bonus = 250 * n;
  world.score += bonus;
  world.banner = n === FINAL_WAVE ? '' : `WAVE ${n} CLEARED  +${bonus}`;
  world.bannerT = 2;
  SoundFX.waveClear();
  if (n === FINAL_WAVE && !world.won) {
    world.won = true;
    state = 'victory';
    SoundFX.victory();
  }
};

function hurtPlayer(dmg) {
  const p = world.player;
  if (p.invuln > 0 || state !== 'playing') return;
  p.hp -= dmg;
  p.invuln = 0.7;
  world.shake = Math.min(14, world.shake + 7);
  world.hurtFlash = 0.35;
  burst(world, p.x, p.y, '#ff4d6d', 14, 240);
  SoundFX.playerHurt();
  if (p.hp <= 0) {
    p.hp = 0;
    state = 'over';
    world.shake = 20;
    burst(world, p.x, p.y, '#40e0ff', 60, 340);
    burst(world, p.x, p.y, '#ffffff', 30, 220);
    SoundFX.explosion();
    SoundFX.gameOver();
    if (world.score > world.best) {
      world.best = world.score;
      try { localStorage.setItem('neonDriftBest', String(world.best)); } catch (err) {}
    }
  }
}

function resetGame() {
  world.player = makePlayer();
  world.enemies = [];
  world.bullets = [];
  world.particles = [];
  world.pickups = [];
  world.texts = [];
  world.score = 0;
  world.combo = 0;
  world.comboT = 0;
  world.shake = 0;
  world.hurtFlash = 0;
  world.won = false;
  WaveDirector.reset();
}

function resolveCollisions() {
  const p = world.player;
  // bullets vs enemies
  for (const b of world.bullets) {
    for (const e of world.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(b.x - e.x, b.y - e.y);
      if (d < b.r + e.r) {
        b.life = 0;
        e.hp -= 1;
        e.flash = 0.07;
        burst(world, b.x, b.y, KIND_STYLE[e.kind].color, 3, 150);
        if (e.hp <= 0) {
          world.addScore(KIND_STYLE[e.kind].score, e.x, e.y);
          burst(world, e.x, e.y, KIND_STYLE[e.kind].color, 22, 280);
          world.shake = Math.min(10, world.shake + 2.5);
          SoundFX.explosion();
          if (e.kind === 'splitter') {
            for (let i = 0; i < 3; i++) {
              const a = (i / 3) * Math.PI * 2 + Math.random();
              const mini = makeEnemy('mini', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
              mini.vx = Math.cos(a) * 190;
              mini.vy = Math.sin(a) * 190;
              world.enemies.push(mini);
            }
          }
          maybeDropPickup(world, e.x, e.y);
        } else {
          SoundFX.enemyHit();
        }
        break;
      }
    }
  }
  world.enemies = world.enemies.filter((e) => e.hp > 0);
  // enemies vs player
  if (state === 'playing') {
    for (const e of world.enemies) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < p.r + e.r - 2) {
        e.hp = 0;
        burst(world, e.x, e.y, KIND_STYLE[e.kind].color, 16, 240);
        hurtPlayer(e.kind === 'mini' ? 8 : 14);
      }
    }
    world.enemies = world.enemies.filter((e) => e.hp > 0);
  }
}

const stars = [];
for (let i = 0; i < 130; i++) {
  stars.push({
    x: Math.random() * ARENA.w, y: Math.random() * ARENA.h,
    z: 0.3 + Math.random() * 0.7, r: Math.random() * 1.6 + 0.4,
  });
}

function drawBackground(dt) {
  const g = ctx.createRadialGradient(640, 400, 80, 640, 400, 760);
  g.addColorStop(0, '#0a0d26');
  g.addColorStop(1, '#04050d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.strokeStyle = 'rgba(64,224,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA.w; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.h); ctx.stroke();
  }
  for (let y = 0; y <= ARENA.h; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA.w, y); ctx.stroke();
  }
  for (const s of stars) {
    s.y += dt * 6 * s.z;
    if (s.y > ARENA.h) { s.y = 0; s.x = Math.random() * ARENA.w; }
    ctx.globalAlpha = 0.35 + s.z * 0.5;
    ctx.fillStyle = '#cfe9ff';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(64,224,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, ARENA.w - 2, ARENA.h - 2);
}

function drawWorld() {
  for (const pk of world.pickups) drawPickup(ctx, pk);
  for (const e of world.enemies) drawEnemy(ctx, e);
  ctx.fillStyle = '#bffbff';
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of world.particles) {
    ctx.globalAlpha = 1 - pt.life / pt.maxLife;
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  if (state !== 'over') drawShip(ctx, world.player);
  ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of world.texts) {
    ctx.globalAlpha = 1 - t.life / t.maxLife;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8fbff';
  ctx.font = '700 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(String(world.score).padStart(6, '0'), 22, 40);
  ctx.font = '500 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(232,251,255,0.55)';
  ctx.fillText(`BEST ${world.best}`, 24, 60);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8fbff';
  ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`WAVE ${Math.max(1, WaveDirector.wave)}`, ARENA.w / 2, 38);

  if (world.combo >= 2) {
    const mult = Math.min(4, 1 + Math.floor(world.combo / 8) * 0.5);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd75d';
    ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`COMBO x${mult.toFixed(1)}`, ARENA.w - 22, 40);
    ctx.fillStyle = 'rgba(255,215,93,0.35)';
    ctx.fillRect(ARENA.w - 142, 48, 120, 4);
    ctx.fillStyle = '#ffd75d';
    ctx.fillRect(ARENA.w - 142, 48, 120 * (world.comboT / 3), 4);
  }

  // hull bar
  const p = world.player;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(232,251,255,0.55)';
  ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('HULL', 22, ARENA.h - 34);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(22, ARENA.h - 28, 240, 12);
  const frac = p.hp / p.maxHp;
  ctx.fillStyle = frac > 0.5 ? '#5dff8f' : frac > 0.25 ? '#ffd75d' : '#ff4d6d';
  ctx.fillRect(22, ARENA.h - 28, 240 * frac, 12);
  if (p.rapid > 0) {
    ctx.fillStyle = '#ffd75d';
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`RAPID FIRE ${p.rapid.toFixed(0)}s`, 280, ARENA.h - 17);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(232,251,255,0.4)';
  ctx.font = '500 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('WASD move · mouse aim · click/Space fire · P pause · M mute', ARENA.w - 20, ARENA.h - 17);

  if (world.bannerT > 0 && world.banner) {
    ctx.globalAlpha = Math.min(1, world.bannerT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8fbff';
    ctx.font = '800 44px "Segoe UI", system-ui, sans-serif';
    ctx.shadowColor = '#40e0ff';
    ctx.shadowBlur = 24;
    ctx.fillText(world.banner, ARENA.w / 2, 150);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  if (world.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,40,70,${world.hurtFlash * 0.5})`;
    ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  }
}

function centerPanel(lines) {
  ctx.fillStyle = 'rgba(3,4,12,0.72)';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.textAlign = 'center';
  let y = 240;
  for (const line of lines) {
    ctx.fillStyle = line.color || '#e8fbff';
    ctx.font = line.font || '500 20px "Segoe UI", system-ui, sans-serif';
    if (line.glow) { ctx.shadowColor = line.glow; ctx.shadowBlur = 26; }
    ctx.fillText(line.text, ARENA.w / 2, y);
    ctx.shadowBlur = 0;
    y += line.gap || 34;
  }
}

function drawScreens() {
  if (state === 'title') {
    centerPanel([
      { text: 'NEON DRIFT ARENA', font: '800 64px "Segoe UI", system-ui, sans-serif', color: '#40e0ff', glow: '#40e0ff', gap: 58 },
      { text: 'Ten waves of drift-born hunters stand between you and a clear sector.', gap: 30 },
      { text: 'Survive them all. Chain kills to raise your combo. Grab what the wreckage drops.', gap: 52 },
      { text: 'WASD / arrows — fly        mouse — aim        click / Space — fire', color: '#9be7ff', gap: 30 },
      { text: 'P — pause        M — mute        hull pickups repair 25 · lightning is rapid fire · stars are pure score', color: '#9be7ff', gap: 58 },
      { text: 'CLICK OR PRESS ENTER TO LAUNCH', font: '700 26px "Segoe UI", system-ui, sans-serif', color: '#ffd75d', gap: 40 },
      { text: `BEST SCORE ${world.best}`, color: 'rgba(232,251,255,0.6)' },
    ]);
  } else if (state === 'paused') {
    centerPanel([
      { text: 'PAUSED', font: '800 48px "Segoe UI", system-ui, sans-serif', gap: 52 },
      { text: 'Press P to resume', color: '#9be7ff' },
    ]);
  } else if (state === 'victory') {
    centerPanel([
      { text: 'SECTOR CLEARED', font: '800 56px "Segoe UI", system-ui, sans-serif', color: '#5dff8f', glow: '#5dff8f', gap: 54 },
      { text: `You cleared all ${FINAL_WAVE} waves with ${world.score} points.`, gap: 34 },
      { text: 'The drift keeps spawning hunters beyond the sector line —', gap: 30 },
      { text: 'press ENTER to fly on and build your score, as long as you last.', gap: 54 },
      { text: 'ENTER — KEEP FLYING', font: '700 24px "Segoe UI", system-ui, sans-serif', color: '#ffd75d' },
    ]);
  } else if (state === 'over') {
    centerPanel([
      { text: 'SHIP LOST', font: '800 56px "Segoe UI", system-ui, sans-serif', color: '#ff4d6d', glow: '#ff4d6d', gap: 54 },
      { text: `Final score  ${world.score}`, font: '700 30px "Segoe UI", system-ui, sans-serif', gap: 36 },
      { text: `Reached wave ${WaveDirector.wave} · best ${world.best}`, color: '#9be7ff', gap: 58 },
      { text: 'CLICK OR PRESS ENTER TO FLY AGAIN', font: '700 24px "Segoe UI", system-ui, sans-serif', color: '#ffd75d' },
    ]);
  }
}

function startGame() {
  SoundFX.unlock();
  SoundFX.startMusic();
  resetGame();
  state = 'playing';
}

// Demo scenes, used to take the entry's screenshots: ?demo=play seeds a
// mid-game moment, ?demo=end the game-over screen. Plain visits get title.
function seedDemo() {
  const mode = new URLSearchParams(location.search).get('demo');
  if (mode === 'play') {
    resetGame();
    state = 'playing';
    world.score = 12450;
    world.best = 15200;
    world.combo = 9;
    world.comboT = 2.4;
    world.player.hp = 72;
    world.player.x = 430;
    world.player.y = 470;
    world.player.invuln = 9999;
    WaveDirector.wave = 3;
    WaveDirector.state = 'clearing';
    const spots = [
      ['chaser', 880, 240], ['chaser', 990, 420], ['dasher', 760, 130],
      ['splitter', 1080, 620], ['orbiter', 300, 210], ['mini', 700, 560],
      ['chaser', 180, 640],
    ];
    for (const [kind, x, y] of spots) {
      const e = makeEnemy(kind, x, y);
      if (kind === 'chaser') e.hp = 2;
      world.enemies.push(e);
    }
    world.pickups.push({ x: 620, y: 300, r: 10, kind: 'rapid', t: 1 });
    world.pickups.push({ x: 240, y: 380, r: 10, kind: 'heart', t: 2 });
    // A short burst already in flight toward the nearest chaser, so the
    // scene shows the ship mid-fight rather than parked.
    const aim = Math.atan2(240 - world.player.y, 880 - world.player.x);
    world.player.angle = aim;
    for (let i = 0; i < 4; i++) {
      world.bullets.push({
        x: world.player.x + Math.cos(aim) * (60 + i * 52),
        y: world.player.y + Math.sin(aim) * (60 + i * 52),
        vx: Math.cos(aim) * 780, vy: Math.sin(aim) * 780, r: 4, life: 0.9,
      });
    }
    world.banner = 'WAVE 3';
    world.bannerT = 1.6;
  } else if (mode === 'end') {
    resetGame();
    world.score = 18730;
    world.best = 18730;
    WaveDirector.wave = 7;
    state = 'over';
  }
}

let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  world.time += dt;

  if (Input.wasPressed('m')) SoundFX.toggleMute();

  if (state === 'title') {
    if (Input.wasPressed('enter') || Input.wasPressed('click')) startGame();
  } else if (state === 'playing') {
    if (Input.wasPressed('p')) state = 'paused';
    WaveDirector.update(world, dt);
    updatePlayer(world, dt);
    for (const e of world.enemies) updateEnemy(world, e, dt);
    updateBullets(world, dt);
    resolveCollisions();
    updateParticles(world, dt);
    updatePickups(world, dt);
    world.comboT -= dt;
    if (world.comboT <= 0) world.combo = 0;
  } else if (state === 'paused') {
    if (Input.wasPressed('p')) state = 'playing';
  } else if (state === 'victory') {
    updateParticles(world, dt);
    if (Input.wasPressed('enter') || Input.wasPressed('click')) state = 'playing';
  } else if (state === 'over') {
    updateParticles(world, dt);
    if (Input.wasPressed('enter') || Input.wasPressed('click')) startGame();
  }

  world.bannerT = Math.max(0, world.bannerT - dt);
  world.hurtFlash = Math.max(0, world.hurtFlash - dt);
  world.shake = Math.max(0, world.shake - dt * 26);

  ctx.save();
  if (world.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawBackground(dt);
  drawWorld();
  ctx.restore();
  if (state === 'playing' || state === 'paused') drawHUD();
  drawScreens();
  Input.endFrame();
}

Input.bind(canvas);
seedDemo();
requestAnimationFrame(frame);
