// render.js — everything the eye gets: the sunset city from above. Ground,
// roads and beaches first, then buildings with their long shadows, palms,
// cars, people, and the weather of light over all of it. Pure drawing: this
// file reads the world and never changes it.

import { WORLD, PALETTE } from './config.js';
import {
  CITY_W, CITY_H, BEACH_Y, WATER_Y, AVENUES, STREETS,
  buildings, palms, lamps, blockRect, DISTRICT_LIST, LANDMARKS,
} from './city.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawGround(ctx, G) {
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, CITY_W, CITY_H);
  // Mown stripes on the grass aprons.
  ctx.fillStyle = PALETTE.grassDark;
  for (let x = 0; x < CITY_W; x += 128) {
    if ((x / 128) % 2 === 0) ctx.fillRect(x, 0, 64, BEACH_Y);
  }
  // The beach and the bay.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, BEACH_Y, CITY_W, CITY_H - BEACH_Y);
  const wave = Math.sin(G.time * 1.4) * 5;
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(0, WATER_Y + 26, CITY_W, CITY_H - WATER_Y);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, WATER_Y, CITY_W, 30 + wave);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let x = 20; x < CITY_W; x += 170) {
    const off = Math.sin(G.time * 2 + x) * 8;
    ctx.fillRect(x + off, WATER_Y + 12 + wave, 62, 3);
  }

  // Roads: asphalt along every avenue and street, edge lines, dashes.
  ctx.fillStyle = PALETTE.road;
  for (const ax of AVENUES) ctx.fillRect(ax - WORLD.road / 2, 0, WORLD.road, BEACH_Y + 40);
  for (const sy of STREETS) ctx.fillRect(0, sy - WORLD.road / 2, CITY_W, WORLD.road);
  ctx.fillStyle = PALETTE.roadEdge;
  for (const ax of AVENUES) {
    ctx.fillRect(ax - WORLD.road / 2, 0, 4, BEACH_Y + 40);
    ctx.fillRect(ax + WORLD.road / 2 - 4, 0, 4, BEACH_Y + 40);
  }
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (const ax of AVENUES) { ctx.moveTo(ax, 10); ctx.lineTo(ax, BEACH_Y + 30); }
  for (const sy of STREETS) { ctx.moveTo(10, sy); ctx.lineTo(CITY_W - 10, sy); }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Sidewalks and block aprons.
  for (let r = 0; r < WORLD.rows; r++) {
    for (let c = 0; c < WORLD.cols; c++) {
      const b = blockRect(c, r);
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(b.x - 12, b.y - 12, b.w + 24, b.h + 24);
      ctx.fillStyle = '#a8a08e';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }
  // Flamingo Park: deeper green under the palms.
  const park = blockRect(2, 2);
  ctx.fillStyle = '#2f6e3e';
  ctx.fillRect(park.x, park.y, park.w, park.h);

  // District names painted on the ground, faded like old road paint.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const d of DISTRICT_LIST) {
    ctx.fillText(d.name, d.x + d.w / 2, d.y + d.h / 2);
  }
  ctx.restore();
}

function drawBuilding(ctx, b, G) {
  const lift = 4 + b.floors * 1.6;
  // Long sunset shadow to the north-east.
  ctx.fillStyle = PALETTE.wallShade;
  ctx.fillRect(b.x + lift, b.y - lift * 0.6, b.w, b.h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.fillRect(b.x, b.y, b.w, 7);
  ctx.fillRect(b.x, b.y, 7, b.h);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(b.x, b.y + b.h - 7, b.w, 7);
  ctx.fillRect(b.x + b.w - 7, b.y, 7, b.h);
  // Rooftop furniture: vents, water tanks, a helipad on the tall towers.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  const inner = 14;
  ctx.fillRect(b.x + inner, b.y + inner, Math.min(34, b.w / 4), Math.min(22, b.h / 4));
  if (b.w > 130 && b.h > 110) ctx.fillRect(b.x + b.w - inner - 28, b.y + b.h - inner - 20, 28, 20);
  if (b.kind === 'tower') {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2 + 8);
  }
  if (b.trim) {
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 6.5, b.y + 6.5, b.w - 13, b.h - 13);
  }
}

const LANDMARK_SIGNS = [
  { at: 'club', text: 'CLUB SOLSTICE', color: '#ff5e78' },
  { at: 'police', text: 'POLICE', color: '#7ab0ff' },
  { at: 'hospital', text: 'HOSPITAL', color: '#ff8a8a' },
  { at: 'docks', text: 'PORTSIDE DOCKS', color: '#ffd166' },
  { at: 'marina', text: 'MARINA', color: '#4ad0c2' },
];

function drawSigns(ctx) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px system-ui, sans-serif';
  for (const sign of LANDMARK_SIGNS) {
    const p = LANDMARKS[sign.at];
    ctx.fillStyle = 'rgba(20,12,34,0.72)';
    const w = ctx.measureText(sign.text).width + 18;
    ctx.fillRect(p.x - w / 2, p.y - 52, w, 24);
    ctx.fillStyle = sign.color;
    ctx.fillText(sign.text, p.x, p.y - 34);
  }
  ctx.restore();
}

function drawPalm(ctx, palm) {
  const s = palm.s;
  ctx.strokeStyle = PALETTE.palmTrunk;
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(palm.x, palm.y);
  ctx.lineTo(palm.x + 4 * s, palm.y - 6 * s);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.palmLeaf;
  ctx.lineWidth = 3 * s;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + palm.x * 0.01;
    ctx.beginPath();
    ctx.moveTo(palm.x + 4 * s, palm.y - 6 * s);
    ctx.quadraticCurveTo(
      palm.x + 4 * s + Math.cos(a) * 13 * s,
      palm.y - 6 * s + Math.sin(a) * 8 * s - 4,
      palm.x + 4 * s + Math.cos(a) * 19 * s,
      palm.y - 6 * s + Math.sin(a) * 13 * s + 3,
    );
    ctx.stroke();
  }
}

export function drawCar(ctx, car, G) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(30,10,40,0.3)';
  rr(ctx, -24, -10, 52, 26, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#14141a';
  ctx.fillRect(-17, -15, 11, 5);
  ctx.fillRect(8, -15, 11, 5);
  ctx.fillRect(-17, 10, 11, 5);
  ctx.fillRect(8, 10, 11, 5);
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -26, -13, 52, 26, 8);
  ctx.fill();
  if (car.kind === 'cop') {
    ctx.fillStyle = PALETTE.copTrim;
    ctx.fillRect(-26, -4, 52, 8);
  }
  // Cabin and glass.
  ctx.fillStyle = 'rgba(16,22,38,0.9)';
  rr(ctx, -8, -10, 20, 20, 4);
  ctx.fill();
  ctx.fillStyle = car.color;
  rr(ctx, -4, -8, 11, 16, 3);
  ctx.fill();
  // Lights: white at the nose, red at the tail.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(23, -10, 3, 6);
  ctx.fillRect(23, 4, 3, 6);
  ctx.fillStyle = '#ff4040';
  ctx.fillRect(-26, -10, 3, 6);
  ctx.fillRect(-26, 4, 3, 6);
  if (car.kind === 'cop') {
    const flash = Math.sin(G.time * 11 + car.sirenPhase) > 0;
    ctx.fillStyle = flash ? '#ff4040' : '#4060ff';
    rr(ctx, -3, -7, 7, 14, 2);
    ctx.fill();
    if (car.driver === 'police') {
      ctx.globalAlpha = 0.16 + 0.1 * Math.sin(G.time * 11 + car.sirenPhase);
      ctx.fillStyle = flash ? '#ff4040' : '#4060ff';
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  // Damage smoke lives outside the rotation.
  if (car.damage > 55 && !car.dead) {
    if (Math.random() < 0.3) G.fx.smoke(car.x + Math.cos(car.angle) * 20, car.y + Math.sin(car.angle) * 20, 1);
  }
}

export function drawPerson(ctx, ped, G) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(30,10,40,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    rr(ctx, -6, -13, 12, 20, 5);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(0, -17, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const stride = Math.sin(ped.walkPhase || 0) * 5;
  ctx.strokeStyle = '#2c2c38';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(stride, 9);
  ctx.moveTo(0, 2);
  ctx.lineTo(-stride, 9);
  ctx.stroke();
  ctx.fillStyle = ped.shirt;
  rr(ctx, -6.5, -7, 13, 13, 5);
  ctx.fill();
  // A punching arm swings out in front.
  if (ped.punchAnim > 0) {
    const reach = 13 * (ped.punchAnim / 0.18);
    ctx.strokeStyle = ped.skin;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(3, -2);
    ctx.lineTo(3 + reach + 4, -2);
    ctx.stroke();
  }
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, -11, 5.6, 0, Math.PI * 2);
  ctx.fill();
  if (ped.kind === 'cop') {
    ctx.fillStyle = '#16224f';
    ctx.fillRect(-6, -16, 12, 4);
  }
  if (ped.kind === 'vega') {
    ctx.fillStyle = '#2b1030';
    ctx.beginPath();
    ctx.arc(0, -12, 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(0, -10.5, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawMarker(ctx, G) {
  if (!G.marker) return;
  const m = G.marker;
  const pulse = 1 + Math.sin(G.time * 5) * 0.16;
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(m.x - 5, m.y - 340, 10, 340);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawWorld(ctx, G) {
  drawGround(ctx, G);
  G.fx.drawSkids(ctx);
  for (const b of buildings) drawBuilding(ctx, b, G);
  drawSigns(ctx);
  for (const lamp of lamps) {
    ctx.fillStyle = '#3c4048';
    ctx.fillRect(lamp.x - 1.5, lamp.y - 6, 3, 8);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y - 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const palm of palms) drawPalm(ctx, palm);
  drawMarker(ctx, G);
  // Pickups (cafecito cups) glow gently.
  for (const cup of G.pickups) {
    if (cup.taken) continue;
    const bob = Math.sin(G.time * 3 + cup.x) * 2;
    ctx.fillStyle = 'rgba(255,209,102,0.3)';
    ctx.beginPath();
    ctx.arc(cup.x, cup.y + bob, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(cup.x - 5, cup.y - 6 + bob, 10, 12);
    ctx.fillStyle = '#c65b39';
    ctx.fillRect(cup.x - 5, cup.y - 1 + bob, 10, 4);
  }
  const sortedCars = [...G.cars].sort((a, b) => a.y - b.y);
  for (const car of sortedCars) drawCar(ctx, car, G);
  for (const ped of G.peds) drawPerson(ctx, ped, G);
  if (!G.player.car) drawPerson(ctx, { ...G.player, kind: 'player' }, G);
  G.fx.drawParticles(ctx);
  G.fx.drawTexts(ctx);
}

// The sunset itself, in screen space: warm wash from the west, violet
// corners, and a soft glow low over the bay.
export function drawAtmosphere(ctx, w, h, G) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(255,140,60,0.10)');
  grad.addColorStop(0.55, 'rgba(255,80,120,0.05)');
  grad.addColorStop(1, 'rgba(40,10,80,0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(20,0,40,0)');
  vig.addColorStop(1, 'rgba(20,0,40,0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}
