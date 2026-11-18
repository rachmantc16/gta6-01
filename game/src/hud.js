// hud.js — everything drawn over the world: health, cash and stars, the
// live minimap, the objective line and prompts, dialogue, toasts, and the
// full-screen states (title, pause, busted, wasted). If the player needs
// to read it, it is drawn here.

import { PLAYER, WANTED } from './config.js';
import { clamp, distance } from './rng.js';
import { CITY_W, CITY_H, AVENUES, STREETS, WATER_Y, LANDMARKS } from './city.js';
import { MISSION_DEFS } from './missions.js';

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(16,10,30,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

export function drawStars(ctx, x, y, stars, size = 21) {
  ctx.save();
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  for (let i = 0; i < WANTED.maxStars; i++) {
    ctx.fillStyle = i < stars ? '#ffd166' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', x + i * (size + 2), y);
  }
  ctx.restore();
}

function drawMinimap(ctx, G, x, y, w, h) {
  panel(ctx, x - 6, y - 6, w + 12, h + 12, 0.62);
  const sx = w / CITY_W;
  const sy = h / CITY_H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#2c5c3a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1d7f8c';
  ctx.fillRect(x, y + WATER_Y * sy, w, h - WATER_Y * sy);
  ctx.strokeStyle = 'rgba(240,240,240,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const ax of AVENUES) { ctx.moveTo(x + ax * sx, y); ctx.lineTo(x + ax * sx, y + h); }
  for (const syLine of STREETS) { ctx.moveTo(x, y + syLine * sy); ctx.lineTo(x + w, y + syLine * sy); }
  ctx.stroke();
  // The club, because every road home leads there.
  ctx.fillStyle = '#ff5e78';
  ctx.fillRect(x + LANDMARKS.club.x * sx - 2, y + LANDMARKS.club.y * sy - 2, 4, 4);
  // Traffic as pale dots, police as blue ones.
  for (const car of G.cars) {
    if (car.kind === 'cop') continue;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 2, 2);
  }
  for (const car of G.cars) {
    if (car.kind !== 'cop') continue;
    ctx.fillStyle = Math.sin(G.time * 8) > 0 ? '#ff5050' : '#4a7dff';
    ctx.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
  }
  for (const ped of G.peds) {
    if (ped.kind !== 'cop') continue;
    ctx.fillStyle = '#4a7dff';
    ctx.fillRect(x + ped.x * sx - 1.5, y + ped.y * sy - 1.5, 3, 3);
  }
  // The mission marker breathes.
  if (G.marker) {
    const r = 4 + Math.sin(G.time * 5) * 1.4;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x + G.marker.x * sx, y + G.marker.y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Danny, as a white arrow on his heading.
  const px = x + G.player.x * sx;
  const py = y + G.player.y * sy;
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHUD(ctx, G, w, h) {
  const p = G.player;
  // Health, top left.
  panel(ctx, 14, 12, 218, 46);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('DANNY REYES', 24, 28);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(24, 34, 196, 12);
  const healthFrac = clamp(p.health / PLAYER.maxHealth, 0, 1);
  ctx.fillStyle = healthFrac > 0.35 ? '#59d977' : '#ff5050';
  ctx.fillRect(24, 34, 196 * healthFrac, 12);
  if (p.car) {
    const dmg = clamp(p.car.damage / 100, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(24, 50, 196, 5);
    ctx.fillStyle = '#e8a13a';
    ctx.fillRect(24, 50, 196 * (1 - dmg), 5);
  }

  // Cash and heat, top right.
  const cashText = `$${Math.floor(G.money)}`;
  ctx.font = 'bold 24px system-ui, sans-serif';
  const cashW = ctx.measureText(cashText).width;
  panel(ctx, w - cashW - 150, 12, cashW + 136, 46);
  ctx.fillStyle = '#7be495';
  ctx.textAlign = 'right';
  ctx.fillText(cashText, w - 24, 44);
  drawStars(ctx, w - cashW - 126, 44, G.wanted.stars, 20);

  // District name, under health.
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'left';
  ctx.fillText(G.district, 24, 78);

  // Mission timer, top centre.
  if (G.mission.timer !== null && G.mission.timer !== undefined && G.mission.active >= 0) {
    const t = Math.max(0, G.mission.timer);
    const label = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    ctx.font = 'bold 30px system-ui, sans-serif';
    const tw = ctx.measureText(label).width;
    panel(ctx, w / 2 - tw / 2 - 14, 12, tw + 28, 44, t < 20 ? 0.75 : 0.55);
    ctx.fillStyle = t < 20 ? '#ff6060' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(label, w / 2, 46);
  }

  drawMinimap(ctx, G, w - 216, h - 166, 200, 150);

  // Objective and prompt, bottom centre.
  ctx.textAlign = 'center';
  if (G.objective) {
    let line = G.objective;
    if (G.marker) {
      const d = Math.round(distance(p.x, p.y, G.marker.x, G.marker.y));
      line += `  ·  ${d}m`;
    }
    ctx.font = 'bold 17px system-ui, sans-serif';
    const ow = ctx.measureText(line).width;
    panel(ctx, w / 2 - ow / 2 - 16, h - 64, ow + 32, 34, 0.6);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(line, w / 2, h - 41);
  }
  if (G.prompt) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const pw = ctx.measureText(G.prompt).width;
    panel(ctx, w / 2 - pw / 2 - 14, h - 108, pw + 28, 30, 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(G.prompt, w / 2, h - 87);
  }

  // The bust meter, centre screen, only while it matters.
  if (G.bustMeter > 0.05) {
    const frac = clamp(G.bustMeter / WANTED.bustTime, 0, 1);
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#ff6060';
    ctx.fillText('BUSTED?', w / 2, h / 2 - 90);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(w / 2 - 110, h / 2 - 80, 220, 12);
    ctx.fillStyle = '#ff5050';
    ctx.fillRect(w / 2 - 110, h / 2 - 80, 220 * frac, 12);
  }

  // Toasts stack under the timer.
  ctx.font = 'bold 16px system-ui, sans-serif';
  G.toasts.forEach((toast, i) => {
    const alpha = clamp(toast.age / 0.3, 0, 1) * clamp((toast.life - toast.age) / 0.5, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(16,10,30,0.8)';
    ctx.lineWidth = 4;
    const y = 92 + i * 24;
    ctx.strokeText(toast.text, w / 2, y);
    ctx.fillText(toast.text, w / 2, y);
    ctx.globalAlpha = 1;
  });
}

export function drawDialogue(ctx, G, w, h) {
  const d = G.dialogue;
  if (!d) return;
  const line = d.lines[d.index];
  if (!line) return;
  const boxH = 108;
  const boxY = h - boxH - 18;
  panel(ctx, 24, boxY, w - 48, boxH, 0.82);
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = line.who === 'Ms. Vega' ? '#ff8fa3' : '#ffd166';
  ctx.fillText(line.who.toUpperCase(), 44, boxY + 30);
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const shown = line.text.slice(0, Math.floor(d.shown));
  wrapText(ctx, shown, 44, boxY + 60, w - 96, 24);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.textAlign = 'right';
  ctx.fillText('E ▸', w - 44, boxY + boxH - 14);
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

function sunsetBackdrop(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2b1055');
  grad.addColorStop(0.55, '#7597de');
  grad.addColorStop(0.78, '#ff9a5a');
  grad.addColorStop(1, '#ff5e78');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // The sun, low over the bay.
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.72, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b1030';
  const base = h * 0.78;
  const heights = [120, 190, 150, 230, 170, 260, 140, 200, 160, 120];
  const bw = w / heights.length;
  heights.forEach((bh, i) => ctx.fillRect(i * bw, base - bh, bw - 6, bh + h * 0.22));
  ctx.fillRect(0, base, w, h - base);
}

export function drawTitle(ctx, G, w, h) {
  sunsetBackdrop(ctx, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(255,94,120,0.8)';
  ctx.shadowBlur = 26;
  ctx.fillText('MARISOL BAY', w / 2, h * 0.3);
  ctx.shadowBlur = 0;
  ctx.font = '21px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('One driver. One fixer. One long sunset to get rich in.', w / 2, h * 0.3 + 42);
  const hasSave = G.save.started;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(hasSave ? 'ENTER — pick up where you left off' : 'ENTER — start a new story', w / 2, h * 0.52);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const lines = [
    'WASD / arrows — walk and drive      SHIFT — run',
    'E — talk, get in, steal a car      SPACE — punch / handbrake',
    'P — pause      M — mute',
    'Run jobs for Ms. Vega at Club Solstice. Mind the stars.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.6 + i * 27));
  if (hasSave) {
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const done = G.save.missionsDone.length;
    ctx.fillText(`Saved: $${Math.floor(G.save.money)} · ${done} of 3 jobs done · N — wipe the save and start over`, w / 2, h * 0.6 + lines.length * 27 + 12);
  }
}

export function drawPause(ctx, G, w, h) {
  ctx.fillStyle = 'rgba(14,8,26,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h * 0.26);
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('Ms. Vega’s jobs', w / 2, h * 0.26 + 52);
  ctx.font = '18px system-ui, sans-serif';
  MISSION_DEFS.forEach((def, i) => {
    const done = G.mission.done[i];
    const active = G.mission.active === i;
    ctx.fillStyle = done ? '#7be495' : active ? '#ffd166' : 'rgba(255,255,255,0.85)';
    const mark = done ? '✓' : active ? '▸' : '·';
    ctx.fillText(`${mark} ${def.title} — $${def.pay}`, w / 2, h * 0.26 + 88 + i * 28);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(`Cash $${Math.floor(G.money)} · Wanted ${'★'.repeat(G.wanted.stars)}`, w / 2, h * 0.26 + 88 + MISSION_DEFS.length * 28 + 22);
  ctx.fillText('P or ESC — back to the streets', w / 2, h - 54);
}

export function drawEndScreen(ctx, G, w, h, kind) {
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,30,90,0.55)' : 'rgba(90,10,20,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.fillStyle = kind === 'busted' ? '#7ab0ff' : '#ff6060';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', w / 2, h * 0.42);
  ctx.shadowBlur = 0;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const fine = Math.floor(G.lastFine || 0);
  ctx.fillText(
    kind === 'busted'
      ? `The Marisol Bay PD kept $${fine} of your cash as a "processing fee".`
      : `Bayview Hospital patched you up. The bill came to $${fine}.`,
    w / 2, h * 0.42 + 46,
  );
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('ENTER — back on the street', w / 2, h * 0.42 + 92);
}
