// vehicles.js — what a car is in Marisol Bay: its arcade physics (throttle,
// steering, grip and drift), the damage it carries, and how cars push each
// other around in a crash. Who drives a car — player, traffic or police —
// lives in those systems; this file only knows how a car moves and breaks.

import { CAR, PALETTE } from './config.js';
import { clamp, distance } from './rng.js';
import { collideCircle } from './city.js';
import { sfx } from './audio.js';

let nextCarId = 1;

export function createCar(x, y, angle, color, kind = 'civ') {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0, // forward velocity along the nose
    steer: 0, // current steering lock, -1..1
    color,
    kind, // 'civ' | 'cop' | 'player-start'
    driver: null, // 'player' | 'traffic' | 'police' | 'thug' | null (empty)
    damage: 0, // 0..100, smokes then burns the engine out
    handbrake: false,
    honkCd: 0,
    sirenPhase: Math.random() * Math.PI * 2,
    route: null, // traffic/police navigation state, owned by those systems
    dead: false,
  };
}

export function randomCarColor(rng) {
  return rng.pick(PALETTE.carColors);
}

// One physics step for a driven car. input: {throttle -1..1, steer -1..1,
// handbrake bool}. Returns the lateral slip so callers can lay skid marks.
export function driveCar(car, input, dt) {
  const wrecked = car.damage >= 100;
  const power = wrecked ? 0.25 : 1;
  if (input.throttle > 0) car.speed += CAR.accel * power * input.throttle * dt;
  if (input.throttle < 0) {
    // Braking while rolling forward, reversing once stopped.
    if (car.speed > 12) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverseAccel * input.throttle * dt * power;
  }
  const drag = input.handbrake ? 2.6 : 0.55;
  car.speed -= car.speed * drag * dt;
  if (input.throttle === 0 && !input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed * power);

  const steerTarget = input.steer * clamp(Math.abs(car.speed) / 130, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.steer += clamp(steerTarget - car.steer, -CAR.steerRate * dt, CAR.steerRate * dt);
  const grip = input.handbrake ? CAR.grip * 0.35 : CAR.grip;
  car.angle += car.steer * (car.speed / 46) * dt * (grip / CAR.grip + 0.35);

  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  car.x += fx * car.speed * dt;
  car.y += fy * car.speed * dt;

  // Buildings and the bay stop a car dead, with a crunch scaled by speed.
  const before = { x: car.x, y: car.y };
  collideCircle(car, 21);
  const stopped = distance(before.x, before.y, car.x, car.y) > 2 && Math.abs(car.speed) > 60;
  const slip = Math.abs(car.steer) * Math.abs(car.speed) + (input.handbrake ? Math.abs(car.speed) * 0.7 : 0);
  if (stopped) {
    car.damage = Math.min(100, car.damage + Math.abs(car.speed) * 0.05);
    car.speed *= -0.18;
  }
  return { slip, crashed: stopped };
}

// Parked and abandoned cars still sit in the world and can be shoved.
export function settleCar(car) {
  collideCircle(car, 21);
}

// Car against car: circles push apart, both take damage, and a hard enough
// meeting is returned as an event so the game can shake, spark and fine the
// player for it.
export function collideCars(cars, fx) {
  const events = [];
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = 44;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const closing = Math.abs(a.speed) + Math.abs(b.speed);
      if (closing > 90) {
        const hurt = (closing - 80) * 0.06;
        a.damage = Math.min(100, a.damage + hurt);
        b.damage = Math.min(100, b.damage + hurt);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        fx.sparks(mx, my, 10);
        fx.shake(Math.min(9, closing * 0.03), 0.22);
        sfx.crash(closing > 240);
        events.push({ a, b, closing, x: mx, y: my });
        a.speed *= 0.45;
        b.speed *= 0.45;
      } else {
        a.speed *= 0.8;
        b.speed *= 0.8;
      }
    }
  }
  return events;
}

export function carDoorPoint(car, side = 1) {
  // The driver's door: left side, a step back from the nose.
  const px = -Math.sin(car.angle) * side;
  const py = Math.cos(car.angle) * side;
  return { x: car.x + px * 20 - Math.cos(car.angle) * 4, y: car.y + py * 20 - Math.sin(car.angle) * 4 };
}

export function speedOf(car) {
  return Math.abs(car.speed);
}
