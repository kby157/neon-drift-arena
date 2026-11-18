// entities.js — the cast of Neon Drift Arena: the player's ship, four enemy
// kinds with distinct movement, bullets, particles, pickups and floating
// score text. Each kind is a plain object made by a factory here; the game
// loop in game.js owns the arrays and calls the update/draw functions.

const ARENA = { w: 1280, h: 800 };

const KIND_STYLE = {
  chaser: { color: '#ff4d6d', r: 16, hp: 3, speed: 96, score: 100 },
  dasher: { color: '#ffb340', r: 13, hp: 2, speed: 70, score: 150 },
  splitter: { color: '#c44dff', r: 23, hp: 6, speed: 52, score: 200 },
  mini: { color: '#ff8fab', r: 9, hp: 1, speed: 150, score: 50 },
  orbiter: { color: '#40e0ff', r: 15, hp: 4, speed: 110, score: 175 },
};

function makePlayer() {
  return {
    x: ARENA.w / 2, y: ARENA.h / 2, vx: 0, vy: 0, r: 14,
    hp: 100, maxHp: 100, angle: 0, fireCd: 0, rapid: 0, invuln: 0,
    thrust: 0,
  };
}

function edgeSpawnPoint() {
  const side = Math.floor(Math.random() * 4);
  const m = 30;
  if (side === 0) return { x: Math.random() * ARENA.w, y: -m };
  if (side === 1) return { x: ARENA.w + m, y: Math.random() * ARENA.h };
  if (side === 2) return { x: Math.random() * ARENA.w, y: ARENA.h + m };
  return { x: -m, y: Math.random() * ARENA.h };
}

function makeEnemy(kind, x, y) {
  const s = KIND_STYLE[kind];
  return {
    kind, x, y, vx: 0, vy: 0, r: s.r, hp: s.hp, maxHp: s.hp,
    t: Math.random() * 10, state: 'chase', stateT: 0, flash: 0,
  };
}

function burst(w, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (0.3 + Math.random() * 0.7) * speed;
    w.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0, maxLife: 0.35 + Math.random() * 0.4, color,
      size: 2 + Math.random() * 3,
    });
  }
}

function addText(w, x, y, text, color) {
  w.texts.push({ x, y, vy: -46, life: 0, maxLife: 0.9, text, color });
}

function updatePlayer(w, dt) {
  const p = w.player;
  const mv = Input.moveVector();
  const ACCEL = 2400;
  const DRAG = 6.5;
  p.vx += mv.x * ACCEL * dt;
  p.vy += mv.y * ACCEL * dt;
  p.vx -= p.vx * DRAG * dt;
  p.vy -= p.vy * DRAG * dt;
  p.x = Math.min(ARENA.w - p.r, Math.max(p.r, p.x + p.vx * dt));
  p.y = Math.min(ARENA.h - p.r, Math.max(p.r, p.y + p.vy * dt));
  p.thrust = Math.hypot(mv.x, mv.y);
  p.angle = Math.atan2(Input.mouse.y - p.y, Input.mouse.x - p.x);
  p.fireCd -= dt;
  p.rapid = Math.max(0, p.rapid - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  const interval = p.rapid > 0 ? 0.09 : 0.16;
  if (Input.firing() && p.fireCd <= 0) {
    p.fireCd = interval;
    const spread = (Math.random() - 0.5) * 0.05;
    const a = p.angle + spread;
    w.bullets.push({
      x: p.x + Math.cos(p.angle) * (p.r + 6),
      y: p.y + Math.sin(p.angle) * (p.r + 6),
      vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, r: 4, life: 0.9,
    });
    burst(w, p.x + Math.cos(p.angle) * (p.r + 8), p.y + Math.sin(p.angle) * (p.r + 8), '#9be7ff', 1, 60);
    SoundFX.shoot();
  }
}

function steer(e, tx, ty, speed, dt, turn) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const want = { x: (dx / d) * speed, y: (dy / d) * speed };
  e.vx += (want.x - e.vx) * Math.min(1, turn * dt);
  e.vy += (want.y - e.vy) * Math.min(1, turn * dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

function updateEnemy(w, e, dt) {
  const p = w.player;
  const s = KIND_STYLE[e.kind];
  e.t += dt;
  e.flash = Math.max(0, e.flash - dt);
  if (e.kind === 'chaser' || e.kind === 'mini' || e.kind === 'splitter') {
    const wobble = Math.sin(e.t * 3.1) * 22;
    steer(e, p.x + -Math.sin(e.t) * wobble, p.y + Math.cos(e.t * 0.9) * wobble, s.speed, dt, 3.2);
  } else if (e.kind === 'dasher') {
    e.stateT += dt;
    if (e.state === 'chase') {
      steer(e, p.x, p.y, s.speed, dt, 4);
      if (e.stateT > 1.1) { e.state = 'aim'; e.stateT = 0; }
    } else if (e.state === 'aim') {
      e.vx *= 0.9; e.vy *= 0.9;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.flash = 0.08;
      if (e.stateT > 0.45) {
        e.state = 'dash'; e.stateT = 0;
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.vx = Math.cos(a) * 560; e.vy = Math.sin(a) * 560;
        SoundFX.enemyHit();
      }
    } else {
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.stateT > 0.38) { e.state = 'chase'; e.stateT = 0; }
    }
  } else if (e.kind === 'orbiter') {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ring = 190;
    const radial = (d - ring) * 1.6;
    const tx = p.x - (dx / d) * ring + (-dy / d) * 130;
    const ty = p.y - (dy / d) * ring + (dx / d) * 130;
    steer(e, tx, ty, s.speed + Math.abs(radial), dt, 3.6);
    e.stateT += dt;
    if (e.stateT > 3.4) {
      e.stateT = 0;
      e.vx += (dx / d) * 260; e.vy += (dy / d) * 260;
    }
  }
}

function updateBullets(w, dt) {
  for (const b of w.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  w.bullets = w.bullets.filter(
    (b) => b.life > 0 && b.x > -20 && b.x < ARENA.w + 20 && b.y > -20 && b.y < ARENA.h + 20);
}

function updateParticles(w, dt) {
  for (const pt of w.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92; pt.vy *= 0.92;
    pt.life += dt;
  }
  w.particles = w.particles.filter((pt) => pt.life < pt.maxLife);
  for (const t of w.texts) {
    t.y += t.vy * dt;
    t.life += dt;
  }
  w.texts = w.texts.filter((t) => t.life < t.maxLife);
}

function updatePickups(w, dt) {
  const p = w.player;
  for (const pk of w.pickups) {
    pk.t += dt;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < 90) { // drift toward the player when close
      pk.x += ((p.x - pk.x) / d) * 130 * dt;
      pk.y += ((p.y - pk.y) / d) * 130 * dt;
    }
    if (d < p.r + pk.r + 4) {
      pk.taken = true;
      if (pk.kind === 'heart') {
        p.hp = Math.min(p.maxHp, p.hp + 25);
        addText(w, p.x, p.y - 24, '+25 HULL', '#5dff8f');
      } else if (pk.kind === 'rapid') {
        p.rapid = 8;
        addText(w, p.x, p.y - 24, 'RAPID FIRE', '#ffd75d');
      } else {
        w.addScore(500, p.x, p.y);
      }
      SoundFX.pickup();
      burst(w, pk.x, pk.y, '#ffffff', 10, 160);
    }
  }
  w.pickups = w.pickups.filter((pk) => !pk.taken && pk.t < 11);
}

function maybeDropPickup(w, x, y) {
  const roll = Math.random();
  if (roll < 0.07) w.pickups.push({ x, y, r: 10, kind: 'heart', t: 0 });
  else if (roll < 0.13) w.pickups.push({ x, y, r: 10, kind: 'rapid', t: 0 });
  else if (roll < 0.17) w.pickups.push({ x, y, r: 10, kind: 'star', t: 0 });
}

function drawShip(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  if (p.thrust > 0) {
    ctx.fillStyle = 'rgba(255,170,60,0.85)';
    ctx.beginPath();
    ctx.moveTo(-14, 5);
    ctx.lineTo(-24 - Math.random() * 8, 0);
    ctx.lineTo(-14, -5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0 ? 0.35 : 1;
  ctx.strokeStyle = '#40e0ff';
  ctx.fillStyle = '#0b2a3d';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#40e0ff';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, 11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-12, -11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#bffbff';
  ctx.beginPath();
  ctx.arc(3, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, e) {
  const s = KIND_STYLE[e.kind];
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.strokeStyle = e.flash > 0 ? '#ffffff' : s.color;
  ctx.fillStyle = 'rgba(10,8,24,0.9)';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = s.color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  if (e.kind === 'chaser') {
    for (let i = 0; i < 3; i++) {
      const a = e.t * 2 + (i * Math.PI * 2) / 3;
      const px = Math.cos(a) * e.r;
      const py = Math.sin(a) * e.r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (e.kind === 'dasher') {
    ctx.moveTo(e.r, 0);
    ctx.lineTo(-e.r, e.r * 0.75);
    ctx.lineTo(-e.r * 0.4, 0);
    ctx.lineTo(-e.r, -e.r * 0.75);
    ctx.closePath();
  } else if (e.kind === 'splitter') {
    for (let i = 0; i < 6; i++) {
      const a = e.t * 0.8 + (i * Math.PI) / 3;
      const px = Math.cos(a) * e.r;
      const py = Math.sin(a) * e.r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (e.kind === 'mini') {
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
  } else { // orbiter: ring with a core
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (e.kind === 'orbiter') {
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2, 3);
    ctx.fillStyle = s.color;
    ctx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2 * (e.hp / e.maxHp), 3);
  }
}

function drawPickup(ctx, pk) {
  const bob = Math.sin(pk.t * 4) * 3;
  ctx.save();
  ctx.translate(pk.x, pk.y + bob);
  ctx.lineWidth = 2.5;
  if (pk.kind === 'heart') {
    ctx.strokeStyle = '#5dff8f';
    ctx.shadowColor = '#5dff8f';
    ctx.shadowBlur = 10;
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.fillStyle = '#5dff8f';
    ctx.fillRect(-2.5, -6, 5, 12);
    ctx.fillRect(-6, -2.5, 12, 5);
  } else if (pk.kind === 'rapid') {
    ctx.strokeStyle = '#ffd75d';
    ctx.shadowColor = '#ffd75d';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(-6, 2);
    ctx.lineTo(0, 2);
    ctx.lineTo(-2, 10);
    ctx.lineTo(6, -2);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 4) / 5;
      const px = Math.cos(a) * 10;
      const py = Math.sin(a) * 10;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
