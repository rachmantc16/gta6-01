// traffic.js — the civilian cars of Marisol Bay: a fleet that cruises the
// avenue/street grid on the correct side of the road, turns at corners,
// queues behind obstacles and honks at jaywalkers — plus the parked cars
// along the curbs that exist to be stolen.

import { clamp, angleDelta, distance } from './rng.js';
import { AVENUES, STREETS, parkSpots, CITY_W, CITY_H } from './city.js';
import { createCar, driveCar, randomCarColor } from './vehicles.js';
import { sfx } from './audio.js';

const LANE = 17; // right-hand traffic offset from a road's centre line
const CRUISE = 205;

function laneTarget(car) {
  const r = car.route;
  if (r.axis === 'h') {
    return { x: AVENUES[r.cross], y: STREETS[r.street] + (r.dir > 0 ? LANE : -LANE) };
  }
  return { x: AVENUES[r.ave] + (r.dir > 0 ? -LANE : LANE), y: STREETS[r.cross] };
}

function newRoute(rng, x, y) {
  // Start on whichever road the car sits on, heading somewhere sensible.
  let street = 0;
  let bestD = Infinity;
  STREETS.forEach((sy, i) => { const d = Math.abs(sy - y); if (d < bestD) { bestD = d; street = i; } });
  let ave = 0;
  bestD = Infinity;
  AVENUES.forEach((ax, i) => { const d = Math.abs(ax - x); if (d < bestD) { bestD = d; ave = i; } });
  const axis = rng.chance(0.5) ? 'h' : 'v';
  const dir = rng.sign();
  const route = { axis, dir, street, ave, cross: 0 };
  route.cross = axis === 'h' ? clamp(ave + dir, 0, AVENUES.length - 1) : clamp(street + dir, 0, STREETS.length - 1);
  if (route.cross === (axis === 'h' ? ave : street)) route.dir = -dir;
  route.cross = axis === 'h' ? clamp(ave + route.dir, 0, AVENUES.length - 1) : clamp(street + route.dir, 0, STREETS.length - 1);
  return route;
}

function advanceRoute(car, rng) {
  const r = car.route;
  if (r.axis === 'h') {
    const atEnd = (r.dir > 0 && r.cross >= AVENUES.length - 1) || (r.dir < 0 && r.cross <= 0);
    if (!atEnd && rng.chance(0.62)) {
      r.cross += r.dir;
    } else if (rng.chance(0.75) || atEnd) {
      // Turn onto the avenue we just reached.
      r.ave = r.cross;
      r.axis = 'v';
      r.dir = rng.sign();
      r.cross = clamp(r.street + r.dir, 0, STREETS.length - 1);
      if (r.cross === r.street) r.dir = -r.dir;
      r.cross = clamp(r.street + r.dir, 0, STREETS.length - 1);
    } else {
      r.cross += r.dir;
    }
  } else {
    const atEnd = (r.dir > 0 && r.cross >= STREETS.length - 1) || (r.dir < 0 && r.cross <= 0);
    if (!atEnd && rng.chance(0.62)) {
      r.cross += r.dir;
    } else if (rng.chance(0.75) || atEnd) {
      r.street = r.cross;
      r.axis = 'h';
      r.dir = rng.sign();
      r.cross = clamp(r.ave + r.dir, 0, AVENUES.length - 1);
      if (r.cross === r.ave) r.dir = -r.dir;
      r.cross = clamp(r.ave + r.dir, 0, AVENUES.length - 1);
    } else {
      r.cross += r.dir;
    }
  }
}

export function spawnParkedCars(G) {
  for (const spot of parkSpots) {
    if (!G.rng.chance(0.62)) continue;
    const car = createCar(spot.x, spot.y, spot.angle, randomCarColor(G.rng), 'civ');
    car.driver = null;
    G.cars.push(car);
  }
}

export function spawnTrafficCar(G, anywhere = false) {
  for (let tries = 0; tries < 12; tries++) {
    const onAvenue = G.rng.chance(0.5);
    const x = onAvenue ? AVENUES[G.rng.int(0, AVENUES.length - 1)] : G.rng.range(80, CITY_W - 80);
    const y = onAvenue ? G.rng.range(80, CITY_H - 200) : STREETS[G.rng.int(0, STREETS.length - 1)];
    const d = distance(x, y, G.player.x, G.player.y);
    if (!anywhere && (d < 520 || d > 1250)) continue;
    const car = createCar(x, y, 0, randomCarColor(G.rng), 'civ');
    car.driver = 'traffic';
    car.route = newRoute(G.rng, x, y);
    const target = laneTarget(car);
    car.angle = Math.atan2(target.y - y, target.x - x);
    if (car.route.axis === 'h') car.y = target.y; else car.x = target.x;
    G.cars.push(car);
    return car;
  }
  return null;
}

export function initTraffic(G) {
  spawnParkedCars(G);
  for (let i = 0; i < 13; i++) spawnTrafficCar(G, true);
}

// Anything solid in front of the car: another car, the player, a crowd.
function obstacleAhead(G, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const look = 86;
  const px = car.x + fx * look * 0.55;
  const py = car.y + fy * look * 0.55;
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    if (distance(px, py, other.x, other.y) < 40) return other;
  }
  if (!G.player.car && distance(px, py, G.player.x, G.player.y) < 30) return G.player;
  for (const ped of G.peds) {
    if (ped.state !== 'down' && distance(px, py, ped.x, ped.y) < 26) return ped;
  }
  return null;
}

export function updateTraffic(G, dt) {
  let moving = 0;
  for (const car of G.cars) {
    if (car.kind !== 'civ' || car.driver !== 'traffic') continue;
    moving++;
    if (!car.route) car.route = newRoute(G.rng, car.x, car.y);
    const target = laneTarget(car);
    const distT = distance(car.x, car.y, target.x, target.y);
    if (distT < 46) advanceRoute(car, G.rng);

    const desired = Math.atan2(target.y - car.y, target.x - car.x);
    const steer = clamp(angleDelta(car.angle, desired) * 2.4, -1, 1);
    let throttle = 0.85;
    const obstacle = obstacleAhead(G, car);
    if (obstacle) {
      const gap = distance(car.x, car.y, obstacle.x, obstacle.y);
      throttle = gap < 52 ? -0.4 : 0.15;
      car.blockedTime = (car.blockedTime || 0) + dt;
      if (car.blockedTime > 2.6 && car.honkCd <= 0) {
        sfx.blip();
        car.honkCd = 3;
        G.fx.floatText(car.x, car.y - 30, 'HONK!', '#ffd166');
        car.blockedTime = 0;
      }
    } else {
      car.blockedTime = 0;
      if (Math.abs(car.speed) > CRUISE) throttle = 0;
    }
    if (car.honkCd > 0) car.honkCd -= dt;
    driveCar(car, { throttle, steer, handbrake: false }, dt);
  }
  // Keep the fleet topped up and retire cars that wander too far away.
  for (let i = G.cars.length - 1; i >= 0; i--) {
    const car = G.cars[i];
    if (car.kind === 'civ' && car.driver === 'traffic' && distance(car.x, car.y, G.player.x, G.player.y) > 1500) {
      G.cars.splice(i, 1);
      moving--;
    }
  }
  if (moving < 12 && G.rng.chance(0.1)) spawnTrafficCar(G);
}
