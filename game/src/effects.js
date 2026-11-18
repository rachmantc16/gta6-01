// effects.js — the juice: particles, skid marks, floating text and screen
// shake. Nothing here knows the rules of the game; systems call spawn
// helpers and this module ages, fades and draws what they asked for.

import { clamp } from './rng.js';

const MAX_PARTICLES = 420;
const MAX_SKIDS = 700;

export class Effects {
  constructor() {
    this.particles = [];
    this.skids = [];
    this.texts = [];
    this.shakeTime = 0;
    this.shakePower = 0;
  }

  shake(power, time = 0.28) {
    this.shakePower = Math.max(this.shakePower, power);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  burst(x, y, opts = {}) {
    const count = opts.count ?? 10;
    const color = opts.color ?? '#ffd98a';
    const speed = opts.speed ?? 130;
    const life = opts.life ?? 0.55;
    const size = opts.size ?? 3;
    const gravity = opts.gravity ?? 0;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: life * (0.6 + Math.random() * 0.7),
        age: 0,
        color,
        size: size * (0.6 + Math.random() * 0.8),
        gravity,
      });
    }
  }

  // Named one-liners the gameplay code reads well with.
  sparks(x, y, n = 12) { this.burst(x, y, { count: n, color: '#ffcf5e', speed: 240, life: 0.4, size: 2.5 }); }
  dust(x, y, n = 8) { this.burst(x, y, { count: n, color: 'rgba(214,196,160,0.8)', speed: 60, life: 0.7, size: 5 }); }
  smoke(x, y, n = 6) { this.burst(x, y, { count: n, color: 'rgba(70,70,80,0.55)', speed: 34, life: 1.1, size: 6 }); }
  stars(x, y, n = 7) { this.burst(x, y, { count: n, color: '#ffe95e', speed: 90, life: 0.5, size: 3, gravity: -60 }); }
  confetti(x, y, n = 26) {
    const colors = ['#ff5e78', '#ffd166', '#4ad0c2', '#7a6ad9', '#6ab04c'];
    for (let i = 0; i < n; i++) {
      this.burst(x, y, { count: 1, color: colors[i % colors.length], speed: 190, life: 0.9, size: 3.5, gravity: 220 });
    }
  }
  splash(x, y, n = 10) { this.burst(x, y, { count: n, color: '#bfeaf2', speed: 120, life: 0.5, size: 3, gravity: 260 }); }

  skid(x, y, angle) {
    if (this.skids.length >= MAX_SKIDS) this.skids.shift();
    this.skids.push({ x, y, angle, age: 0 });
  }

  floatText(x, y, text, color = '#ffffff') {
    this.texts.push({ x, y, text, color, age: 0, life: 1.25 });
  }

  update(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const s of this.skids) s.age += dt;
    this.skids = this.skids.filter((s) => s.age < 7);
    for (const t of this.texts) {
      t.age += dt;
      t.y -= 34 * dt;
    }
    this.texts = this.texts.filter((t) => t.age < t.life);
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakePower = 0;
    }
  }

  // Random camera offset for this frame, decaying with the shake.
  shakeOffset() {
    if (this.shakePower <= 0) return { x: 0, y: 0 };
    const p = this.shakePower * clamp(this.shakeTime / 0.28, 0, 1);
    return { x: (Math.random() * 2 - 1) * p, y: (Math.random() * 2 - 1) * p };
  }

  drawSkids(ctx) {
    ctx.save();
    for (const s of this.skids) {
      const alpha = 0.34 * (1 - s.age / 7);
      ctx.fillStyle = `rgba(20,20,26,${alpha.toFixed(3)})`;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillRect(-2.2, -5, 4.4, 10);
      ctx.restore();
    }
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const t = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    for (const t of this.texts) {
      const alpha = 1 - t.age / t.life;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,10,30,0.8)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
