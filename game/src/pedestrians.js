// pedestrians.js — the people of Marisol Bay: shoppers, joggers and
// beachgoers who stroll the sidewalks, pick a new corner when they arrive,
// and run screaming when the day's crime happens near them. Fighters and
// officers are pedestrians too, but their brains live in combat.js and
// police.js; this file owns the civilian crowd.

import { PALETTE } from './config.js';
import { clamp, angleDelta, distance } from './rng.js';
import { sidewalkPoint, collideCircle, CITY_W, BEACH_Y } from './city.js';

let nextPedId = 1;

export function createPed(x, y, rng, kind = 'civ') {
  return {
    id: nextPedId++,
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    kind, // 'civ' | 'thug' | 'cop' | 'vega'
    shirt: kind === 'cop' ? '#1d2a6a' : kind === 'thug' ? '#3a3f4a' : rng.pick(PALETTE.pedShirts),
    skin: ['#8a5a33', '#a06a3b', '#6e4525', '#c98d5f', '#7a4a28'][rng.int(0, 4)],
    health: kind === 'thug' ? 70 : kind === 'cop' ? 80 : 40,
    state: 'walk', // 'walk' | 'flee' | 'down' | 'fight' | 'talk'
    target: null,
    stateTime: 0,
    walkPhase: rng.range(0, 6),
    attackCd: 0,
    home: { x, y },
  };
}

export function spawnCrowd(G) {
  for (let i = 0; i < 26; i++) {
    const p = sidewalkPoint(G.rng);
    const ped = createPed(p.x, p.y, G.rng, 'civ');
    ped.target = sidewalkPoint(G.rng);
    G.peds.push(ped);
  }
  // A few beachgoers down on the sand.
  for (let i = 0; i < 5; i++) {
    const ped = createPed(G.rng.range(120, CITY_W - 120), BEACH_Y + G.rng.range(40, 150), G.rng, 'civ');
    ped.target = { x: ped.x + G.rng.range(-160, 160), y: ped.y + G.rng.range(-40, 60) };
    ped.beach = true;
    G.peds.push(ped);
  }
}

function pickNextTarget(G, ped) {
  if (ped.beach) {
    ped.target = {
      x: clamp(ped.x + G.rng.range(-260, 260), 60, CITY_W - 60),
      y: clamp(ped.y + G.rng.range(-70, 90), BEACH_Y + 26, BEACH_Y + 180),
    };
    return;
  }
  ped.target = sidewalkPoint(G.rng);
}

export function scarePeds(G, x, y, radius = 190) {
  for (const ped of G.peds) {
    if (ped.kind !== 'civ' || ped.state === 'down') continue;
    if (distance(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.stateTime = 0;
      ped.fleeFrom = { x, y };
      if (G.rng.chance(0.3)) G.fx.floatText(ped.x, ped.y - 22, '!', '#ff5e78');
    }
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.kind !== 'civ') continue;
    ped.stateTime += dt;
    if (ped.state === 'down') {
      ped.speed = 0;
      if (ped.health > 0 && ped.stateTime > 6) {
        ped.state = 'flee';
        ped.stateTime = 0;
        ped.fleeFrom = { x: G.player.x, y: G.player.y };
      }
      continue;
    }
    let target = ped.target;
    let speed = 66;
    if (ped.state === 'flee') {
      const from = ped.fleeFrom || G.player;
      const away = Math.atan2(ped.y - from.y, ped.x - from.x);
      target = { x: ped.x + Math.cos(away) * 120, y: ped.y + Math.sin(away) * 120 };
      speed = 168;
      if (ped.stateTime > 2.4) {
        ped.state = 'walk';
        pickNextTarget(G, ped);
      }
    } else if (!target || distance(ped.x, ped.y, target.x, target.y) < 14) {
      pickNextTarget(G, ped);
      target = ped.target;
    }
    // A fast car close by is its own scare, even without a crime event.
    if (ped.state === 'walk' && G.player.car && Math.abs(G.player.car.speed) > 200 &&
        distance(ped.x, ped.y, G.player.car.x, G.player.car.y) < 74) {
      ped.state = 'flee';
      ped.stateTime = 0;
      ped.fleeFrom = { x: G.player.car.x, y: G.player.car.y };
      continue;
    }
    const desired = Math.atan2(target.y - ped.y, target.x - ped.x);
    ped.angle += clamp(angleDelta(ped.angle, desired), -4.4 * dt, 4.4 * dt);
    ped.speed = speed;
    ped.walkPhase += dt * (speed / 12);
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    collideCircle(ped, 11);
  }
  // Keep the streets populated near the player, thin them out far away.
  let near = 0;
  for (const ped of G.peds) {
    if (ped.kind === 'civ' && distance(ped.x, ped.y, G.player.x, G.player.y) < 700) near++;
  }
  if (near < 9 && G.rng.chance(0.06)) {
    const p = sidewalkPoint(G.rng);
    if (distance(p.x, p.y, G.player.x, G.player.y) > 420) {
      const ped = createPed(p.x, p.y, G.rng, 'civ');
      ped.target = sidewalkPoint(G.rng);
      G.peds.push(ped);
    }
  }
}
