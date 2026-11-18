// combat.js — fists and consequences: Danny's punch, the thugs who punch
// back, and what happens when two tons of car meet a pedestrian (or the
// player). Damage, knockdowns and the crimes they commit all land here.

import { PLAYER } from './config.js';
import { clamp, angleDelta, distance } from './rng.js';
import { collideCircle } from './city.js';
import { justPressed } from './input.js';
import { scarePeds } from './pedestrians.js';
import { sfx } from './audio.js';

function knockDown(G, ped, fromX, fromY, damage) {
  ped.health -= damage;
  const away = Math.atan2(ped.y - fromY, ped.x - fromX);
  ped.x += Math.cos(away) * 16;
  ped.y += Math.sin(away) * 16;
  collideCircle(ped, 11);
  if (ped.health <= 0) {
    ped.state = 'down';
    ped.stateTime = 0;
    G.fx.stars(ped.x, ped.y - 8, 8);
  }
}

export function playerPunch(G) {
  const p = G.player;
  p.punchCd = PLAYER.punchCooldown;
  p.punchAnim = 0.18;
  sfx.punch();
  const reach = PLAYER.punchRange;
  let hitSomething = false;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const d = distance(p.x, p.y, ped.x, ped.y);
    if (d > reach + 10) continue;
    const toPed = Math.atan2(ped.y - p.y, ped.x - p.x);
    if (Math.abs(angleDelta(p.angle, toPed)) > PLAYER.punchArc) continue;
    hitSomething = true;
    knockDown(G, ped, p.x, p.y, PLAYER.punchDamage);
    G.fx.burst(ped.x, ped.y - 6, { count: 5, color: '#ffd98a', speed: 120, life: 0.35, size: 2.5 });
    if (ped.state !== 'down' && ped.kind === 'thug') ped.state = 'fight';
    if (ped.kind === 'civ') {
      scarePeds(G, ped.x, ped.y, 170);
      G.crime(0.35, '');
    } else if (ped.kind === 'cop') {
      G.crime(0.8, 'You hit an officer!');
    }
  }
  // Cars take a dent and a wobble, and their drivers take offence.
  for (const car of G.cars) {
    if (car.driver === 'player') continue;
    if (distance(p.x, p.y, car.x, car.y) < reach + 16) {
      car.damage = Math.min(100, car.damage + 4);
      G.fx.sparks(car.x, car.y - 10, 5);
      hitSomething = true;
    }
  }
  if (!hitSomething) G.fx.dust(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, 2);
}

// Thugs: the only civilians who run toward a fight instead of away.
export function updateThugs(G, dt) {
  for (const ped of G.peds) {
    if (ped.kind !== 'thug') continue;
    if (ped.state === 'down') { ped.stateTime += dt; continue; }
    if (ped.state !== 'fight') continue;
    const p = G.player;
    const d = distance(ped.x, ped.y, p.x, p.y);
    if (d > 340 || p.car) {
      if (d > 340) ped.state = 'walk';
      continue;
    }
    const desired = Math.atan2(p.y - ped.y, p.x - ped.x);
    ped.angle += clamp(angleDelta(ped.angle, desired), -5 * dt, 5 * dt);
    if (d > 30) {
      ped.x += Math.cos(ped.angle) * 176 * dt;
      ped.y += Math.sin(ped.angle) * 176 * dt;
      ped.walkPhase += dt * 12;
      collideCircle(ped, 11);
    }
    if (ped.attackCd > 0) ped.attackCd -= dt;
    if (d <= 32 && ped.attackCd <= 0 && !p.car) {
      ped.attackCd = 1.0;
      ped.punchAnim = 0.18;
      sfx.punch();
      G.hurtPlayer(7, ped.x, ped.y);
    }
  }
}

// Cars meet people. Checked for every moving car against every standing
// person, and against Danny when he is on foot in the road.
export function updateCarHits(G, dt) {
  for (const car of G.cars) {
    const speed = Math.abs(car.speed);
    if (speed < 55) continue;
    for (const ped of G.peds) {
      if (ped.state === 'down') continue;
      if (distance(car.x, car.y, ped.x, ped.y) > 27) continue;
      const damage = speed * 0.16;
      knockDown(G, ped, car.x, car.y, damage);
      G.fx.dust(ped.x, ped.y, 8);
      sfx.crash(false);
      car.speed *= 0.72;
      if (car.driver === 'player') {
        if (ped.kind === 'cop') G.crime(1.5, 'You ran down an officer!');
        else if (ped.kind === 'thug') G.crime(0.5, '');
        else G.crime(1.1, 'Hit and run!');
        scarePeds(G, ped.x, ped.y, 200);
      }
    }
    const p = G.player;
    if (!p.car && car.driver !== 'player' && distance(car.x, car.y, p.x, p.y) < 27) {
      G.hurtPlayer(clamp(speed * 0.09, 4, 26), car.x, car.y);
      const away = Math.atan2(p.y - car.y, p.x - car.x);
      p.x += Math.cos(away) * 22;
      p.y += Math.sin(away) * 22;
      collideCircle(p, 13);
      car.speed *= 0.5;
      G.fx.shake(5, 0.25);
    }
  }
}

export function updateCombat(G, dt) {
  if (!G.player.car && justPressed(' ') && G.player.punchCd <= 0 && G.state === 'play') {
    playerPunch(G);
  }
  if (G.player.punchAnim > 0) G.player.punchAnim -= dt;
  for (const ped of G.peds) if (ped.punchAnim > 0) ped.punchAnim -= dt;
  updateThugs(G, dt);
  updateCarHits(G, dt);
}
