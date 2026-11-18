// player.js — Danny Reyes himself: walking and running on foot, the
// driving inputs when he is behind a wheel, and the small ceremony of
// getting into a car — politely when it is empty, at a run when it is not.

import { PLAYER, PALETTE } from './config.js';
import { distance } from './rng.js';
import { collideCircle } from './city.js';
import { isDown, justPressed, moveAxes } from './input.js';
import { driveCar, carDoorPoint } from './vehicles.js';
import { createPed, scarePeds } from './pedestrians.js';
import { sfx } from './audio.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    car: null,
    punchCd: 0,
    walkPhase: 0,
    stepTime: 0,
    shirt: PALETTE.playerShirt,
    skin: PALETTE.playerSkin,
    jackTime: 0, // carjack lunge timer
    dead: false,
  };
}

function nearestCarTo(G, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.dead) continue;
    const door = carDoorPoint(car);
    const d = distance(x, y, door.x, door.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(G, car) {
  const player = G.player;
  if (car.driver === 'traffic' || car.driver === 'police') {
    // Carjacking: the driver comes out the hard way and runs.
    const door = carDoorPoint(car, -1);
    const victim = createPed(door.x, door.y, G.rng, 'civ');
    victim.state = 'flee';
    victim.fleeFrom = { x: player.x, y: player.y };
    victim.shirt = '#9aa3ad';
    G.peds.push(victim);
    scarePeds(G, car.x, car.y, 150);
    G.crime(car.driver === 'police' ? 1.4 : 1, car.driver === 'police' ? 'You stole a police car!' : 'Carjacked!');
    player.jackTime = 0.32;
    G.fx.shake(3, 0.18);
    G.fx.floatText(car.x, car.y - 34, 'STOLEN!', '#ffd166');
  } else if (car.kind === 'cop') {
    G.crime(0.7, 'You stole a police car!');
  }
  car.driver = 'player';
  car.route = null;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  sfx.door();
}

export function exitCar(G) {
  const player = G.player;
  const car = player.car;
  if (!car) return;
  const door = carDoorPoint(car);
  player.x = door.x;
  player.y = door.y;
  collideCircle(player, PLAYER.radius);
  car.driver = null;
  player.car = null;
  sfx.door();
}

export function updatePlayer(G, dt) {
  const player = G.player;
  if (player.punchCd > 0) player.punchCd -= dt;
  if (player.jackTime > 0) player.jackTime -= dt;

  if (player.car) {
    const car = player.car;
    const steer = (isDown('a') || isDown('arrowleft') ? -1 : 0) + (isDown('d') || isDown('arrowright') ? 1 : 0);
    const throttle = (isDown('w') || isDown('arrowup') ? 1 : 0) + (isDown('s') || isDown('arrowdown') ? -1 : 0);
    const handbrake = isDown(' ');
    const result = driveCar(car, { throttle, steer, handbrake }, dt);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    // Skid marks and dust while the tyres argue with the road.
    if (result.slip > 120 && Math.abs(car.speed) > 90) {
      const back = { x: car.x - Math.cos(car.angle) * 18, y: car.y - Math.sin(car.angle) * 18 };
      const side = { x: -Math.sin(car.angle) * 10, y: Math.cos(car.angle) * 10 };
      G.fx.skid(back.x + side.x, back.y + side.y, car.angle);
      G.fx.skid(back.x - side.x, back.y - side.y, car.angle);
      if (G.rng.chance(0.3)) G.fx.dust(back.x, back.y, 1);
    }
    if (result.crashed) G.fx.shake(4, 0.2);
    if (justPressed('e') || justPressed('f')) {
      if (Math.abs(car.speed) < 260) exitCar(G);
    }
    G.prompt = Math.abs(car.speed) < 60 ? 'E — get out' : '';
    return;
  }

  // On foot.
  const axes = moveAxes();
  const running = isDown('shift');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (axes.x !== 0 || axes.y !== 0) {
    const len = Math.hypot(axes.x, axes.y);
    const vx = (axes.x / len) * speed;
    const vy = (axes.y / len) * speed;
    player.x += vx * dt;
    player.y += vy * dt;
    player.angle = Math.atan2(vy, vx);
    player.walkPhase += dt * (running ? 13 : 10);
    player.stepTime -= dt;
    if (player.stepTime <= 0) {
      player.stepTime = running ? 0.27 : 0.36;
      if (G.rng.chance(0.5)) sfx.step();
    }
    collideCircle(player, PLAYER.radius);
  }

  // The car question: is there a door within reach?
  const near = nearestCarTo(G, player.x, player.y, 52);
  if (near) {
    if (!G.talkHandled) G.prompt = near.driver ? 'E — steal this car' : 'E — get in';
    if ((justPressed('e') || justPressed('f')) && !G.talkHandled) enterCar(G, near);
  } else if (!G.talkHandled) {
    G.prompt = '';
  }
}
