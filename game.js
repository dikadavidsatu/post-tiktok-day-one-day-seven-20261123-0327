// Burrow Dash — a tiny agent-built canvas game.
// Same map, same start, every day. Day 1 is the bare first build;
// Day 7 is the same game after a week of daily updates.
// Deterministic: fixed timestep, seeded RNG, scripted player path, so any
// game-time t renders the identical moment in both builds.
'use strict';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 540, H = 960;

// Fixed map: tunnel walls, identical in both builds.
const WALLS = [
  { x: 30, y: 150, w: 120, h: 26 },
  { x: 390, y: 150, w: 120, h: 26 },
  { x: 30, y: 760, w: 120, h: 26 },
  { x: 390, y: 760, w: 120, h: 26 },
  { x: 200, y: 420, w: 140, h: 26 },
  { x: 60, y: 560, w: 110, h: 26 },
  { x: 370, y: 560, w: 110, h: 26 },
];

const GEM_SPOTS = [
  { x: 270, y: 300 }, { x: 120, y: 250 }, { x: 420, y: 250 },
  { x: 120, y: 680 }, { x: 420, y: 680 }, { x: 270, y: 620 },
  { x: 90, y: 470 }, { x: 450, y: 470 },
];

// Beetle patrol lanes: {y, x0, x1, speed, phase}
const BEETLE_LANES = [
  { y: 210, x0: 70, x1: 470, speed: 0.9, phase: 0.0 },
  { y: 350, x0: 70, x1: 470, speed: 1.2, phase: 1.7 },
  { y: 500, x0: 70, x1: 470, speed: 0.7, phase: 3.1 },
  { y: 650, x0: 70, x1: 470, speed: 1.4, phase: 0.6 },
  { y: 810, x0: 70, x1: 470, speed: 1.0, phase: 2.4 },
];

function makeGame(build) {
  const day7 = build === 'day7';
  const rng = mulberry32(day7 ? 777 : 111);
  const state = {
    t: 0,
    build,
    score: 0,
    combo: 0,
    bestCombo: 0,
    collected: 0,
    gems: [],
    beetles: [],
    particles: [],
    floaters: [],
    star: { x: 270, y: 480, taken: false, pulse: 0 },
    player: { x: 270, y: 480, vx: 0, vy: 0, trail: [] },
  };

  const gemCount = day7 ? 8 : 1;
  for (let i = 0; i < gemCount; i++) {
    state.gems.push({ ...GEM_SPOTS[i], taken: false, respawnAt: 0, bob: rng() * 6.28 });
  }
  const beetleCount = day7 ? 5 : 1;
  for (let i = 0; i < beetleCount; i++) {
    state.beetles.push({ ...BEETLE_LANES[i], x: BEETLE_LANES[i].x0 });
  }
  return state;
}

function playerTarget(t) {
  // Scripted run: same path in both builds, so the moments match.
  const x = 270 + 185 * Math.sin(t * 0.55);
  const y = 480 + 295 * Math.sin(t * 0.83 + 1.3);
  return { x: Math.max(60, Math.min(480, x)), y: Math.max(110, Math.min(860, y)) };
}

function step(state, dt) {
  const day7 = state.build === 'day7';
  state.t += dt;
  const target = playerTarget(state.t);
  const p = state.player;
  const px = p.x, py = p.y;
  if (!state.manual) {
    p.x += (target.x - p.x) * Math.min(1, dt * 6);
    p.y += (target.y - p.y) * Math.min(1, dt * 6);
  }
  p.vx = (p.x - px) / dt; p.vy = (p.y - py) / dt;
  if (day7) {
    p.trail.push({ x: p.x, y: p.y, life: 1 });
    if (p.trail.length > 14) p.trail.shift();
    for (const tr of p.trail) tr.life -= dt * 2.2;
  }

  for (const g of state.gems) {
    if (g.taken) {
      if (day7 && state.t >= g.respawnAt) { g.taken = false; }
      continue;
    }
    const d = Math.hypot(p.x - g.x, p.y - g.y);
    if (d < 36) {
      g.taken = true;
      state.collected++;
      if (day7) {
        state.combo++;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        const mult = state.star.taken ? 2 : 1;
        state.score += 10 * mult;
        g.respawnAt = state.t + 2.0;
        state.floaters.push({ x: g.x, y: g.y - 10, text: '+' + (10 * mult), life: 1 });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          state.particles.push({
            x: g.x, y: g.y,
            vx: Math.cos(a) * (60 + (i % 5) * 22),
            vy: Math.sin(a) * (60 + (i % 5) * 22),
            life: 1, size: 3 + (i % 4),
          });
        }
      }
    }
  }

  for (const b of state.beetles) {
    const lane = b;
    const span = lane.x1 - lane.x0;
    const ph = (state.t * lane.speed + lane.phase) % 2;
    const tri = ph < 1 ? ph : 2 - ph;
    b.x = lane.x0 + tri * span;
    if (day7) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < 40 && state.combo > 0) { state.combo = 0; }
    }
  }

  if (day7) {
    state.star.pulse = state.t;
    if (!state.star.taken && Math.hypot(p.x - state.star.x, p.y - state.star.y) < 38) {
      state.star.taken = true;
      state.score += 50;
      state.floaters.push({ x: state.star.x, y: state.star.y - 14, text: 'POWER x2!', life: 1 });
    }
    for (const pt of state.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt * 1.6;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const f of state.floaters) { f.y -= 34 * dt; f.life -= dt * 1.1; }
    state.floaters = state.floaters.filter((f) => f.life > 0);
  }
}

function draw(state, ctx) {
  const day7 = state.build === 'day7';
  // Soil background.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2b1d12');
  bg.addColorStop(1, '#1a120b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Dotted soil texture, fixed.
  ctx.fillStyle = 'rgba(255, 220, 160, 0.06)';
  for (let i = 0; i < 90; i++) {
    const x = (i * 97) % W, y = (i * 173) % H;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.29); ctx.fill();
  }

  // Tunnel walls.
  ctx.fillStyle = '#4a3220';
  for (const w of WALLS) {
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#5d4028';
    ctx.fillRect(w.x, w.y, w.w, 6);
    ctx.fillStyle = '#4a3220';
  }

  // Speed lines on the edges (day 7 only).
  if (day7) {
    ctx.strokeStyle = 'rgba(255, 210, 90, 0.25)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const y = ((state.t * 420 + i * 170) % 1050) - 40;
      ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(8, y + 46); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W - 8, y); ctx.lineTo(W - 8, y + 46); ctx.stroke();
    }
  }

  // Power-up star (day 7 only).
  if (day7 && !state.star.taken) {
    const s = state.star;
    const r = 20 + 4 * Math.sin(s.pulse * 5);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Gems.
  for (const g of state.gems) {
    if (g.taken) continue;
    const bob = Math.sin(state.t * 3 + g.bob) * 4;
    ctx.save();
    ctx.translate(g.x, g.y + bob);
    ctx.rotate(Math.PI / 4);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    glow.addColorStop(0, 'rgba(120, 220, 255, 0.55)');
    glow.addColorStop(1, 'rgba(120, 220, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-34, -34, 68, 68);
    ctx.fillStyle = '#7fe3ff';
    ctx.fillRect(-13, -13, 26, 26);
    ctx.fillStyle = '#d8f6ff';
    ctx.fillRect(-13, -13, 26, 8);
    ctx.restore();
  }

  // Beetles.
  for (const b of state.beetles) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 15, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#7b241c';
    ctx.beginPath(); ctx.arc(16, 0, 8, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#7b241c'; ctx.lineWidth = 2;
    for (let l = -1; l <= 1; l++) {
      ctx.beginPath(); ctx.moveTo(-6 + l * 8, -12); ctx.lineTo(-10 + l * 8, -22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6 + l * 8, 12); ctx.lineTo(-10 + l * 8, 22); ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(19, -3, 2.5, 0, 6.29); ctx.fill();
    ctx.restore();
  }

  // Player trail (day 7 only).
  if (day7) {
    for (const tr of state.player.trail) {
      ctx.fillStyle = `rgba(255, 190, 90, ${Math.max(0, tr.life) * 0.35})`;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, 12, 0, 6.29); ctx.fill();
    }
  }

  // Player mole.
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = '#8a5a33';
  ctx.beginPath(); ctx.arc(-14, -16, 9, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(14, -16, 9, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#a9743f';
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#e89bb0';
  ctx.beginPath(); ctx.arc(0, 12, 8, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath(); ctx.arc(-9, -4, 3.5, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(9, -4, 3.5, 0, 6.29); ctx.fill();
  ctx.restore();

  // Particles + floaters (day 7 only).
  if (day7) {
    for (const pt of state.particles) {
      ctx.fillStyle = `rgba(255, 220, 120, ${Math.max(0, pt.life)})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, 6.29); ctx.fill();
    }
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    for (const f of state.floaters) {
      ctx.fillStyle = `rgba(255, 240, 160, ${Math.max(0, f.life)})`;
      ctx.fillText(f.text, f.x, f.y);
    }
  }

  // HUD (day 7 only).
  if (day7) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, W, 64);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + state.score, 20, 42);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7fe3ff';
    ctx.fillText('COMBO x' + state.combo, W - 20, 42);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('DAY 7  ·  ' + state.t.toFixed(1) + 's', W / 2, 84);
  }
}

// Browser host: renderFrame(t) resets and draws game-time t.
if (typeof window !== 'undefined') {
  window.__renderFrame = function (build, t) {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const state = makeGame(build);
    const dt = 1 / 30;
    const steps = Math.round(t / dt);
    for (let i = 0; i < steps; i++) step(state, dt);
    draw(state, ctx);
    return { score: state.score, collected: state.collected };
  };
}

// Node export for tests.
if (typeof module !== 'undefined') {
  module.exports = { makeGame, step, draw, playerTarget, W, H };
}
