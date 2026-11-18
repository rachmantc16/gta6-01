// police.js — the law in Marisol Bay: the wanted level that crimes feed
// and hiding starves, the patrol cars that hunt the player down, the
// officers who pile out when he runs on foot, the roadblocks that appear
// at three stars, and the bust meter that ends a chase on foot.

import { WANTED, PALETTE } from './config.js';
import { clamp, angleDelta, distance } from './rng.js';
import { AVENUES, STREETS, nearestAvenue, nearestStreet, collideCircle } from './city.js';
import { createCar, driveCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { sfx, sirenSound } from './audio.js';

export function createWanted() {
  return {
    stars: 0,
    heat: 0, // fractional progress toward the next star
    unseen: 0, // seconds since any officer last saw the player
    seen: false,
    spawnCd: 0,
    blockCd: 8,
    block: null, // the active roadblock's cars
  };
}

// Crimes call this. Points are in stars: a shove is 0.35, a stolen car 1,
// a hit-and-run 1.2, an officer downed 1.5.
export function addCrime(G, points, label) {
  const w = G.wanted;
  if (points <= 0) return;
  const before = w.stars;
  w.heat += points;
  while (w.heat >= 1 && w.stars < WANTED.maxStars) {
    w.stars += 1;
    w.heat -= 1;
  }
  if (w.stars >= WANTED.maxStars) w.heat = Math.min(w.heat, 0.99);
  if (w.stars > before) {
    sfx.star();
    G.fx.floatText(G.player.x, G.player.y - 46, '★'.repeat(w.stars), '#ffd166');
    if (label) G.notify(label);
  } else if (label && w.stars > 0) {
    G.notify(label);
  }
  w.unseen = 0;
}

function copsSeePlayer(G) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.kind === 'cop' && car.driver === 'police' && distance(car.x, car.y, p.x, p.y) < WANTED.sightRange) return true;
  }
  for (const ped of G.peds) {
    if (ped.kind === 'cop' && ped.state !== 'down' && distance(ped.x, ped.y, p.x, p.y) < 300) return true;
  }
  return false;
}

function spawnCopCar(G) {
  // Arrive by road, near enough to matter, far enough to be fair.
  for (let tries = 0; tries < 10; tries++) {
    const onAvenue = G.rng.chance(0.5);
    const x = onAvenue ? AVENUES[G.rng.int(0, AVENUES.length - 1)] : G.rng.range(120, 3400);
    const y = onAvenue ? G.rng.range(120, 2900) : STREETS[G.rng.int(0, STREETS.length - 1)];
    const d = distance(x, y, G.player.x, G.player.y);
    if (d < 560 || d > 900) continue;
    const car = createCar(x, y, Math.atan2(G.player.y - y, G.player.x - x), PALETTE.copBody, 'cop');
    car.driver = 'police';
    car.route = { stuckTime: 0, reverseTime: 0 };
    G.cars.push(car);
    return true;
  }
  return false;
}

function updateCopCar(G, car, dt) {
  const p = G.player;
  const target = p.car ? { x: p.car.x + Math.cos(p.car.angle) * p.car.speed * 0.35, y: p.car.y + Math.sin(p.car.angle) * p.car.speed * 0.35 } : { x: p.x, y: p.y };
  const distP = distance(car.x, car.y, p.x, p.y);
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  let steer = clamp(angleDelta(car.angle, desired) * 2.6, -1, 1);
  let throttle = 1;
  if (Math.abs(angleDelta(car.angle, desired)) > 2.2) throttle = -0.6; // turned around: back up
  if (distP < 60) throttle = 0.3;
  // Unstick: full throttle and no motion means a building won; reverse out.
  const r = car.route || (car.route = { stuckTime: 0, reverseTime: 0 });
  if (r.reverseTime > 0) {
    r.reverseTime -= dt;
    throttle = -1;
    steer = -steer;
  } else if (Math.abs(car.speed) < 14 && throttle > 0) {
    r.stuckTime += dt;
    if (r.stuckTime > 1.4) { r.reverseTime = 0.65; r.stuckTime = 0; }
  } else {
    r.stuckTime = 0;
  }
  driveCar(car, { throttle, steer, handbrake: false }, dt);

  // Close to a player on foot, the officers get out and give chase.
  if (!p.car && distP < 105 && Math.abs(car.speed) < 130 && (car.officersOut || 0) === 0) {
    car.officersOut = 2;
    car.driver = null;
    for (let i = 0; i < 2; i++) {
      const officer = createPed(car.x + G.rng.range(-16, 16), car.y + G.rng.range(-16, 16), G.rng, 'cop');
      officer.state = 'chase';
      G.peds.push(officer);
    }
    sfx.door();
  }
}

function updateOfficer(G, ped, dt) {
  const p = G.player;
  ped.stateTime += dt;
  if (ped.state === 'down') return;
  const d = distance(ped.x, ped.y, p.x, p.y);
  const desired = Math.atan2(p.y - ped.y, p.x - ped.x);
  ped.angle += clamp(angleDelta(ped.angle, desired), -5.2 * dt, 5.2 * dt);
  const speed = p.car ? 0 : 208;
  if (!p.car && d > 20) {
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    ped.walkPhase += dt * 12;
    collideCircle(ped, 11);
  }
  // The bust: stand close to a runner who is not fighting back and the
  // meter fills; break away and it drains.
  if (!p.car && d < WANTED.bustRange) {
    G.bustMeter = Math.min(WANTED.bustTime, G.bustMeter + dt);
    if (ped.attackCd <= 0 && d < 30) {
      ped.attackCd = 0.9;
      G.hurtPlayer(5, ped.x, ped.y);
    }
  }
  if (ped.attackCd > 0) ped.attackCd -= dt;
  // Officers give up and walk back to the car when the heat dies.
  if (G.wanted.stars === 0) {
    ped.state = 'walk';
    ped.kind = 'civ';
    ped.shirt = '#5a7d9e';
  }
}

function placeRoadblock(G) {
  const p = G.player;
  const facing = p.car ? p.car.angle : p.angle;
  const aheadX = p.x + Math.cos(facing) * 430;
  const aheadY = p.y + Math.sin(facing) * 430;
  const horizontal = Math.abs(Math.cos(facing)) > Math.abs(Math.sin(facing));
  const cars = [];
  for (let i = -1; i <= 1; i += 2) {
    let x;
    let y;
    let angle;
    if (horizontal) {
      x = nearestAvenue(aheadX);
      y = nearestStreet(aheadY) + i * 26;
      angle = Math.PI / 2 + i * 0.5;
    } else {
      x = nearestAvenue(aheadX) + i * 26;
      y = nearestStreet(aheadY);
      angle = i * 0.5;
    }
    const car = createCar(x, y, angle, PALETTE.copBody, 'cop');
    car.driver = null;
    car.route = { block: true };
    cars.push(car);
    G.cars.push(car);
  }
  G.wanted.block = cars;
  G.notify('Roadblock ahead!');
}

export function updatePolice(G, dt) {
  const w = G.wanted;
  w.seen = copsSeePlayer(G);
  if (w.stars > 0) {
    if (w.seen) w.unseen = 0;
    else {
      w.unseen += dt;
      if (w.unseen >= WANTED.loseSightAfter) {
        w.stars -= 1;
        w.unseen = 0;
        w.heat = 0;
        if (w.stars === 0) G.notify('You lost the heat.');
        else G.fx.floatText(G.player.x, G.player.y - 46, '★'.repeat(w.stars), '#bfeaf2');
      }
    }
  }

  // Manpower follows the stars.
  const copCars = G.cars.filter((c) => c.kind === 'cop' && c.driver === 'police');
  const desired = w.stars === 0 ? 0 : Math.min(2 + w.stars, 5);
  w.spawnCd -= dt;
  if (copCars.length < desired && w.spawnCd <= 0) {
    if (spawnCopCar(G)) w.spawnCd = 2.2;
    else w.spawnCd = 0.8;
  }

  // Roadblocks at three stars and up.
  w.blockCd -= dt;
  if (w.stars >= 3 && !w.block && w.blockCd <= 0) placeRoadblock(G);
  if (w.block) {
    const near = w.block.some((c) => distance(c.x, c.y, G.player.x, G.player.y) < 900);
    if (!near || w.stars < 3) {
      for (const c of w.block) c.dead = true;
      G.cars = G.cars.filter((c) => !c.dead);
      w.block = null;
      w.blockCd = 14;
    }
  }

  let anySiren = false;
  for (const car of G.cars) {
    if (car.kind !== 'cop') continue;
    if (distance(car.x, car.y, G.player.x, G.player.y) < 760) anySiren = true;
    if (car.driver === 'police') updateCopCar(G, car, dt);
  }
  sirenSound(anySiren && w.stars > 0);

  // The bust meter drains twice as fast as it fills.
  const officerClose = G.peds.some((ped) => ped.kind === 'cop' && ped.state !== 'down' && !G.player.car && distance(ped.x, ped.y, G.player.x, G.player.y) < WANTED.bustRange);
  if (!officerClose && G.bustMeter > 0) G.bustMeter = Math.max(0, G.bustMeter - dt * 2);
  if (G.bustMeter >= WANTED.bustTime) {
    G.bustMeter = 0;
    G.triggerBusted();
    return;
  }

  for (const ped of G.peds) {
    if (ped.kind === 'cop') updateOfficer(G, ped, dt);
  }
  // Retire distant units when the heat is off.
  if (w.stars === 0) {
    for (let i = G.cars.length - 1; i >= 0; i--) {
      const car = G.cars[i];
      if (car.kind === 'cop' && car.driver === 'police' && distance(car.x, car.y, G.player.x, G.player.y) > 500) {
        G.cars.splice(i, 1);
      }
    }
  }
}
