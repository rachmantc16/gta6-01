// city.js — Marisol Bay itself: the road grid, the blocks and buildings on
// them, the beach, the landmarks the story uses, and the collision and
// routing questions every other system asks ("is this solid?", "where is
// the nearest avenue?"). The layout is generated from a seed, so the city
// is the same on every visit, but no two blocks are dressed alike.

import { WORLD, PITCH, PALETTE, DISTRICTS } from './config.js';
import { makeRng, clamp } from './rng.js';

export const CITY_W = WORLD.margin + WORLD.cols * PITCH + WORLD.margin;
export const BEACH_Y = WORLD.margin + WORLD.rows * PITCH; // sand starts here
export const WATER_Y = BEACH_Y + 210; // the bay itself
export const CITY_H = WATER_Y + 150;

export const avenueX = (c) => WORLD.margin + c * PITCH + WORLD.road / 2;
export const streetY = (r) => WORLD.margin + r * PITCH + WORLD.road / 2;
export const BEACH_ROAD_Y = BEACH_Y + 74;

export const AVENUES = Array.from({ length: WORLD.cols }, (_, c) => avenueX(c));
export const STREETS = [...Array.from({ length: WORLD.rows }, (_, r) => streetY(r)), BEACH_ROAD_Y];

export function blockRect(c, r) {
  return {
    x: WORLD.margin + c * PITCH + WORLD.road,
    y: WORLD.margin + r * PITCH + WORLD.road,
    w: WORLD.block,
    h: WORLD.block,
  };
}

// Blocks the story claims for itself; generation leaves them to landmarks.
const LANDMARK_BLOCKS = new Map([
  ['3,2', 'club'],
  ['0,0', 'police'],
  ['6,0', 'hospital'],
  ['0,4', 'docks'],
  ['6,5', 'marina'],
  ['2,2', 'park'],
  ['4,3', 'parking'],
]);

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];

export const buildings = [];
export const palms = [];
export const lamps = [];
export const parkSpots = []; // aprons where parked cars sit

function addBuilding(rect, rng, kind) {
  buildings.push({
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    roof: rng.pick(ROOFS),
    kind,
    floors: kind === 'tower' ? rng.int(9, 18) : rng.int(1, 4),
    trim: rng.chance(0.5),
  });
}

function dressBlock(c, r, rng) {
  const b = blockRect(c, r);
  const key = `${c},${r}`;
  const landmark = LANDMARK_BLOCKS.get(key);
  const inset = 26;
  const inner = { x: b.x + inset, y: b.y + inset, w: b.w - inset * 2, h: b.h - inset * 2 };

  if (landmark === 'park') {
    for (let i = 0; i < 9; i++) {
      palms.push({ x: b.x + rng.range(30, b.w - 30), y: b.y + rng.range(30, b.h - 30), s: rng.range(0.8, 1.3) });
    }
    return;
  }
  if (landmark === 'parking') {
    addBuilding({ x: inner.x, y: inner.y, w: 120, h: 90 }, rng, 'shop');
    for (let i = 0; i < 6; i++) {
      parkSpots.push({ x: b.x + 60 + i * 52, y: b.y + b.h - 70, angle: 0 });
    }
    return;
  }
  if (landmark === 'club' || landmark === 'police' || landmark === 'hospital') {
    addBuilding({ x: inner.x + 30, y: inner.y + 20, w: inner.w - 60, h: inner.h - 90 }, rng, landmark);
    return;
  }
  if (landmark === 'docks' || landmark === 'marina') {
    addBuilding({ x: inner.x, y: inner.y + 30, w: 150, h: 110 }, rng, 'warehouse');
    addBuilding({ x: inner.x + 180, y: inner.y + 30, w: 140, h: 110 }, rng, 'warehouse');
    addBuilding({ x: inner.x + 60, y: inner.y + 190, w: 200, h: 100 }, rng, 'warehouse');
    return;
  }

  const downtown = c >= 2 && c <= 4 && r >= 0 && r <= 2;
  if (downtown && rng.chance(0.55)) {
    addBuilding({ x: inner.x + 20, y: inner.y + 20, w: inner.w - 40, h: inner.h - 40 }, rng, 'tower');
  } else if (rng.chance(0.5)) {
    const hw = inner.w / 2 - 8;
    const hh = inner.h / 2 - 8;
    addBuilding({ x: inner.x, y: inner.y, w: hw, h: hh }, rng, 'block');
    addBuilding({ x: inner.x + hw + 16, y: inner.y, w: hw, h: hh }, rng, 'block');
    addBuilding({ x: inner.x, y: inner.y + hh + 16, w: hw, h: hh }, rng, 'shop');
    addBuilding({ x: inner.x + hw + 16, y: inner.y + hh + 16, w: hw, h: hh }, rng, 'block');
  } else {
    addBuilding({ x: inner.x + 10, y: inner.y + 10, w: inner.w - 90, h: inner.h - 20 }, rng, 'block');
    addBuilding({ x: inner.x + inner.w - 60, y: inner.y + 30, w: 50, h: 120 }, rng, 'shop');
  }

  // Curb parking along the south face of most blocks.
  if (rng.chance(0.75)) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      parkSpots.push({ x: b.x + 50 + i * 62, y: b.y + b.h - 26, angle: 0 });
    }
  }
  // Palms on the corners, lamps along the south sidewalk.
  if (rng.chance(0.8)) palms.push({ x: b.x + 16, y: b.y + 16, s: rng.range(0.8, 1.2) });
  if (rng.chance(0.8)) palms.push({ x: b.x + b.w - 16, y: b.y + b.h - 16, s: rng.range(0.8, 1.2) });
  lamps.push({ x: b.x + b.w / 2, y: b.y + b.h - 10 });
}

function buildCity(seed) {
  const rng = makeRng(seed);
  for (let r = 0; r < WORLD.rows; r++) {
    for (let c = 0; c < WORLD.cols; c++) dressBlock(c, r, rng);
  }
  // A double row of palms along the beachfront street.
  for (let x = 60; x < CITY_W - 40; x += 92) {
    palms.push({ x, y: BEACH_Y + 128, s: rng.range(0.9, 1.4) });
  }
}

buildCity(20261117);

// Named places the missions and respawns point at. Doors sit on the apron
// just south of their block, reachable on foot and by car.
function doorOf(c, r, dx = 0.5) {
  const b = blockRect(c, r);
  return { x: b.x + b.w * dx, y: b.y + b.h + 26 };
}

export const LANDMARKS = {
  club: { ...doorOf(3, 2), name: 'Club Solstice', block: [3, 2] },
  police: { ...doorOf(0, 0), name: 'Marisol Bay PD', block: [0, 0] },
  hospital: { ...doorOf(6, 0), name: 'Bayview Hospital', block: [6, 0] },
  docks: { ...doorOf(0, 4), name: 'Portside Docks', block: [0, 4] },
  marina: { ...doorOf(6, 5), name: 'The Marina', block: [6, 5] },
  park: { x: blockRect(2, 2).x + WORLD.block / 2, y: blockRect(2, 2).y + WORLD.block / 2, name: 'Flamingo Park' },
  hideout: { x: 240, y: BEACH_ROAD_Y + 66, name: 'the beach lot' },
  beach: { x: CITY_W / 2, y: BEACH_Y + 130, name: 'Marisol Beach' },
};

export const DISTRICT_LIST = DISTRICTS.map((d) => {
  const b = blockRect(d.col, d.row);
  return { name: d.name, x: b.x, y: b.y, w: b.w, h: b.h };
});

// --- Collision ------------------------------------------------------------
// Buildings and the bay are solid; everything else is open ground. A mover
// is a circle: push it out of every rect it overlaps, axis by axis, which
// gives sliding along walls for free.

export function collideCircle(pos, radius) {
  pos.x = clamp(pos.x, radius, CITY_W - radius);
  pos.y = clamp(pos.y, radius, CITY_H - radius);
  if (pos.y > WATER_Y - radius) pos.y = WATER_Y - radius;
  for (const b of buildings) {
    const nearX = clamp(pos.x, b.x, b.x + b.w);
    const nearY = clamp(pos.y, b.y, b.y + b.h);
    const dx = pos.x - nearX;
    const dy = pos.y - nearY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nearX + (dx / d) * radius;
      pos.y = nearY + (dy / d) * radius;
    } else {
      // Centre inside the rect: leave by the shallowest face.
      const left = pos.x - b.x;
      const right = b.x + b.w - pos.x;
      const top = pos.y - b.y;
      const bottom = b.y + b.h - pos.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) pos.x = b.x - radius;
      else if (min === right) pos.x = b.x + b.w + radius;
      else if (min === top) pos.y = b.y - radius;
      else pos.y = b.y + b.h + radius;
    }
  }
  return pos;
}

export function pointInBuilding(x, y, pad = 0) {
  for (const b of buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}

export function isWater(x, y) {
  return y > WATER_Y;
}

export function isOnRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < WORLD.road / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < WORLD.road / 2) return true;
  return false;
}

// The road axis a point belongs to: 'v' on an avenue, 'h' on a street,
// null off-road. Traffic and police route along these.
export function roadAxisAt(x, y) {
  let best = null;
  let bestD = WORLD.road / 2;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = 'v'; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = 'h'; }
  }
  return best;
}

export function nearestAvenue(x) {
  let best = AVENUES[0];
  for (const ax of AVENUES) if (Math.abs(ax - x) < Math.abs(best - x)) best = ax;
  return best;
}

export function nearestStreet(y) {
  let best = STREETS[0];
  for (const sy of STREETS) if (Math.abs(sy - y) < Math.abs(best - y)) best = sy;
  return best;
}

// Sidewalk ring just inside a block: where pedestrians prefer to walk.
export function sidewalkPoint(rng) {
  const c = rng.int(0, WORLD.cols - 1);
  const r = rng.int(0, WORLD.rows - 1);
  const b = blockRect(c, r);
  const side = rng.int(0, 3);
  const t = rng.next();
  if (side === 0) return { x: b.x + t * b.w, y: b.y + 9 };
  if (side === 1) return { x: b.x + t * b.w, y: b.y + b.h - 9 };
  if (side === 2) return { x: b.x + 9, y: b.y + t * b.h };
  return { x: b.x + b.w - 9, y: b.y + t * b.h };
}
