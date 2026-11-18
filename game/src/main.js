// main.js — Marisol Bay, assembled. This file owns the game state (one
// object, G, that every system reads and writes), the main loop, the
// camera, dialogue, the busted/wasted/respawn cycle, saving, and the
// staged scenes the screenshot runs ask for with ?shot= in the address.

import { PLAYER, MONEY } from './config.js';
import { makeRng, clamp, distance } from './rng.js';
import { CITY_W, CITY_H, BEACH_Y, LANDMARKS, DISTRICT_LIST } from './city.js';
import { initInput, justPressed, endFrame, pointer } from './input.js';
import { initAudio, setMuted, engineSound, stopAllVoices, sfx } from './audio.js';
import { loadSave, storeSave, wipeSave, defaultSave } from './save.js';
import { Effects } from './effects.js';
import { createCar, driveCar, collideCars } from './vehicles.js';
import { createPlayer, updatePlayer, exitCar } from './player.js';
import { spawnCrowd, createPed, updatePeds } from './pedestrians.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { createWanted, addCrime, updatePolice } from './police.js';
import { updateCombat } from './combat.js';
import { createMissionState, updateMissions, tryTalkToVega, MISSION_DEFS } from './missions.js';
import { drawWorld, drawAtmosphere } from './render.js';
import { drawHUD, drawDialogue, drawTitle, drawPause, drawEndScreen } from './hud.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const announcer = document.getElementById('announcer');
const params = new URLSearchParams(location.search);
const shotMode = params.get('shot');
const seed = Number(params.get('seed') || 20261);

let viewW = 1280;
let viewH = 800;
function resize() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = viewW;
  canvas.height = viewH;
}
window.addEventListener('resize', resize);
resize();
initInput(canvas);

// --- The one game state ---------------------------------------------------
const save = loadSave();
const G = {
  time: 0,
  state: shotMode ? 'play' : 'title',
  rng: makeRng(seed),
  fx: new Effects(),
  save,
  money: save.money,
  player: createPlayer(LANDMARKS.club.x - 40, LANDMARKS.club.y + 30),
  cars: [],
  peds: [],
  pickups: [],
  wanted: createWanted(),
  mission: createMissionState(save),
  dialogue: null,
  prompt: '',
  objective: '',
  marker: null,
  district: 'MARISOL BAY',
  bustMeter: 0,
  lastFine: 0,
  toasts: [],
  camera: { x: 0, y: 0 },
  talkHandled: false,
  announcerDirty: '',
};

G.notify = (text) => {
  if (!text) return;
  G.toasts.push({ text, age: 0, life: 3.4 });
  if (G.toasts.length > 3) G.toasts.shift();
  G.announcerDirty = text;
};
G.crime = (points, label) => addCrime(G, points, label);
G.addMoney = (amount, label) => {
  G.money += amount;
  if (G.money > G.save.bestCash) G.save.bestCash = G.money;
  if (label) G.notify(`${label}  +$${amount}`);
  if (amount > 0) sfx.cash();
};
G.setWanted = (stars) => {
  if (stars > G.wanted.stars) {
    G.wanted.stars = stars;
    G.wanted.heat = 0;
    sfx.star();
  }
};
G.hurtPlayer = (damage, fromX, fromY) => {
  if (G.state !== 'play' || G.dialogue) return;
  const p = G.player;
  p.health -= damage;
  G.fx.burst(p.x, p.y - 6, { count: 6, color: '#ff6060', speed: 110, life: 0.4, size: 3 });
  G.fx.shake(3.5, 0.2);
  sfx.hurt();
  if (p.health <= 0) {
    p.health = 0;
    triggerEnd('wasted');
  }
};
G.startDialogue = (lines, onDone) => {
  G.dialogue = { lines, index: 0, shown: 0, onDone };
};
G.saveGame = () => {
  G.save.money = Math.floor(G.money);
  G.save.missionsDone = G.mission.done.map((d, i) => (d ? i : -1)).filter((i) => i >= 0);
  G.save.started = true;
  storeSave(G.save);
};
G.triggerBusted = () => triggerEnd('busted');

// --- World population -----------------------------------------------------
function populate() {
  spawnCrowd(G);
  initTraffic(G);
  // Vega waits at her club door, in a magenta dress, all day and all night.
  const vega = createPed(LANDMARKS.club.x + 26, LANDMARKS.club.y - 2, G.rng, 'vega');
  vega.shirt = '#c22a5a';
  vega.state = 'talk';
  G.peds.push(vega);
  G.vega = vega;
  // Danny's own battered teal runabout, parked by the club for job one.
  const startCar = createCar(LANDMARKS.club.x - 120, LANDMARKS.club.y + 44, 0, '#2a9d8f', 'civ');
  G.cars.push(startCar);
  // Cafecito cups: a strong little coffee heals 35 health.
  const cupSpots = [LANDMARKS.club, LANDMARKS.park, LANDMARKS.beach, LANDMARKS.docks, LANDMARKS.hospital, LANDMARKS.marina];
  for (const spot of cupSpots) {
    G.pickups.push({ x: spot.x + 34, y: spot.y + 18, taken: false, respawn: 0 });
  }
}
populate();

function clearHeat() {
  G.wanted.stars = 0;
  G.wanted.heat = 0;
  G.wanted.unseen = 0;
  G.wanted.block = null;
  G.bustMeter = 0;
  G.cars = G.cars.filter((car) => car.kind !== 'cop');
  G.peds = G.peds.filter((ped) => ped.kind !== 'cop');
}

function triggerEnd(kind) {
  if (G.state !== 'play') return;
  G.state = kind;
  const fine = Math.floor(G.money * (kind === 'busted' ? MONEY.bustFine : MONEY.wastedFine));
  G.lastFine = fine;
  G.money -= fine;
  if (G.player.car) {
    G.player.car.driver = null;
    G.player.car = null;
  }
  stopAllVoices();
  sfx.fail();
  if (G.mission.active >= 0 && kind === 'busted') {
    // A busted delivery is a failed delivery.
    G.mission.active = -1;
    G.mission.timer = null;
    G.marker = null;
    G.objective = '';
  }
}

function respawn() {
  const spot = G.state === 'busted' ? LANDMARKS.police : LANDMARKS.hospital;
  G.player.x = spot.x;
  G.player.y = spot.y + 16;
  G.player.health = G.state === 'busted' ? 70 : PLAYER.maxHealth;
  G.player.car = null;
  clearHeat();
  G.state = 'play';
  G.saveGame();
  G.notify(G.state === 'play' && spot === LANDMARKS.police ? 'Released. The club, again, from the top.' : 'Patched up. Take it easy out there.');
}

// --- Screenshot staging ---------------------------------------------------
// The maker's own scenes: ?shot=cover|onfoot|steal|mission&seed=n sets the
// city up mid-moment so the screenshots are the game itself, caught live.
function stageShot() {
  if (!shotMode) return;
  const p = G.player;
  if (shotMode === 'cover') {
    // On the avenue in front of the club, not the block behind it: the
    // road in front of the door is the one Danny would actually flee down.
    const car = createCar(LANDMARKS.club.x - 420, LANDMARKS.club.y + 33, 0, '#d94f30', 'civ');
    car.driver = 'player';
    car.speed = 340;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    G.cars.push(car);
    for (let i = 0; i < 3; i++) {
      const cop = createCar(car.x - 170 - i * 125, car.y + (i - 1) * 26, 0, '#eef1f4', 'cop');
      cop.driver = 'police';
      cop.speed = 300;
      cop.route = { stuckTime: 0, reverseTime: 0 };
      G.cars.push(cop);
    }
    G.wanted.stars = 3;
    G.mission.active = 1;
    G.mission.timer = 96;
    G.objective = MISSION_DEFS[1].steps[1].label;
    G.marker = LANDMARKS.marina;
  } else if (shotMode === 'onfoot') {
    p.x = LANDMARKS.club.x - 260;
    p.y = LANDMARKS.club.y + 190;
    p.angle = 0.6;
    G.objective = '';
  } else if (shotMode === 'steal') {
    const car = createCar(LANDMARKS.club.x - 190, LANDMARKS.club.y + 120, 0.2, '#e8a13a', 'civ');
    car.driver = 'traffic';
    car.route = null;
    car.speed = 0;
    G.cars.push(car);
    // A parked car nose-to-nose keeps the victim's car stopped in traffic.
    const blocker = createCar(car.x + Math.cos(0.2) * 64, car.y + Math.sin(0.2) * 64, 0.2, '#3a7bd5', 'civ');
    blocker.driver = null;
    G.cars.push(blocker);
    p.x = car.x - 6;
    p.y = car.y + 34;
    p.angle = -Math.PI / 2;
  } else if (shotMode === 'mission') {
    p.x = LANDMARKS.club.x - 16;
    p.y = LANDMARKS.club.y + 8;
    p.angle = Math.atan2(G.vega.y - p.y, G.vega.x - p.x);
    G.dialogue = { lines: MISSION_DEFS[0].intro, index: 2, shown: 999, onDone: () => {} };
    G.objective = MISSION_DEFS[0].steps[0].label;
    G.marker = LANDMARKS.docks;
  }
}
stageShot();

// --- Per-frame update -----------------------------------------------------
function updateDialogue(dt) {
  const d = G.dialogue;
  if (!d) return;
  const line = d.lines[d.index];
  if (!line) {
    G.dialogue = null;
    if (d.onDone) d.onDone();
    return;
  }
  d.shown = Math.min(line.text.length, d.shown + dt * 55);
  const advance = justPressed('e') || justPressed('enter') || pointer().clicked;
  if (advance) {
    if (d.shown < line.text.length) {
      d.shown = line.text.length;
    } else {
      d.index += 1;
      d.shown = 0;
      sfx.blip();
      if (d.index >= d.lines.length) {
        G.dialogue = null;
        if (d.onDone) d.onDone();
      }
    }
  }
}

function districtAt(x, y) {
  if (y > BEACH_Y) return 'MARISOL BEACH';
  for (const d of DISTRICT_LIST) {
    if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d.name;
  }
  return 'MARISOL BAY';
}

let autosaveTime = 0;

function updatePlay(dt) {
  G.talkHandled = false;
  // Talking to Vega comes before car doors: her doorstep has both.
  const nearVega = !G.player.car && distance(G.player.x, G.player.y, G.vega.x, G.vega.y) < 54;
  if (nearVega && !G.dialogue) {
    G.prompt = 'E — talk to Ms. Vega';
    if (justPressed('e')) {
      G.talkHandled = true;
      tryTalkToVega(G);
    }
  }
  // If that conversation just opened, the frame belongs to it now.
  if (G.dialogue) return;

  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);

  // Cars nobody is driving still roll to a stop.
  for (const car of G.cars) {
    if (car.driver === null && car.speed !== 0) driveCar(car, { throttle: 0, steer: 0, handbrake: false }, dt);
  }
  const crashes = collideCars(G.cars, G.fx);
  for (const crash of crashes) {
    const mine = crash.a === G.player.car || crash.b === G.player.car;
    const cop = crash.a.kind === 'cop' || crash.b.kind === 'cop';
    if (mine && cop && crash.closing > 210) G.crime(0.45, 'You rammed a police car!');
  }

  // Cafecito pickups.
  for (const cup of G.pickups) {
    if (cup.taken) {
      cup.respawn -= dt;
      if (cup.respawn <= 0) cup.taken = false;
      continue;
    }
    if (!G.player.car && distance(G.player.x, G.player.y, cup.x, cup.y) < 24 && G.player.health < PLAYER.maxHealth) {
      cup.taken = true;
      cup.respawn = 45;
      G.player.health = Math.min(PLAYER.maxHealth, G.player.health + 35);
      sfx.pickup();
      G.fx.floatText(cup.x, cup.y - 18, '+35', '#7be495');
    }
  }

  // Slow health regen keeps a careful driver alive between jobs.
  if (G.player.health > 0 && G.player.health < PLAYER.maxHealth && G.wanted.stars === 0) {
    G.player.health = Math.min(PLAYER.maxHealth, G.player.health + dt * 1.6);
  }

  G.district = districtAt(G.player.x, G.player.y);
  engineSound(G.player.car ? Math.abs(G.player.car.speed) / 430 : null);

  autosaveTime += dt;
  if (autosaveTime > 6) {
    autosaveTime = 0;
    G.saveGame();
  }
}

function update(dt) {
  G.time += dt;
  for (const toast of G.toasts) toast.age += dt;
  G.toasts = G.toasts.filter((t) => t.age < t.life);
  G.fx.update(dt);

  if (G.state === 'title') {
    if (justPressed('enter')) {
      initAudio();
      setMuted(G.save.muted);
      G.save.started = true;
      G.state = 'play';
      G.notify('Find Ms. Vega at Club Solstice — the pink sign, Coral Downtown.');
    }
    if (justPressed('n') && G.save.started) {
      wipeSave();
      G.save = defaultSave();
      G.money = G.save.money;
      G.mission = createMissionState(G.save);
      G.notify('Save wiped. A fresh Danny, a fresh bay.');
    }
    return;
  }
  if (G.state === 'busted' || G.state === 'wasted') {
    if (justPressed('enter')) respawn();
    return;
  }
  if (justPressed('m')) {
    G.save.muted = !G.save.muted;
    setMuted(G.save.muted);
    G.saveGame();
  }
  if (G.state === 'pause') {
    if (justPressed('p') || justPressed('escape')) G.state = 'play';
    return;
  }
  if (justPressed('p') || justPressed('escape')) {
    if (!G.dialogue) {
      G.state = 'pause';
      stopAllVoices();
      return;
    }
  }
  if (G.dialogue) {
    updateDialogue(dt);
    return;
  }
  updatePlay(dt);
  if (shotMode === 'steal') G.prompt = 'E — steal this car';
  if (G.announcerDirty) {
    announcer.textContent = G.announcerDirty;
    G.announcerDirty = '';
  }
}

// --- Rendering --------------------------------------------------------------
function cameraTarget() {
  if (G.state === 'title') {
    return {
      x: CITY_W / 2 + Math.sin(G.time * 0.07) * 420,
      y: CITY_H / 2 + Math.cos(G.time * 0.05) * 260,
    };
  }
  const p = G.player;
  const lead = p.car ? 0.32 : 0.12;
  return {
    x: p.x + Math.cos(p.angle) * Math.abs(p.car ? p.car.speed : 60) * lead,
    y: p.y + Math.sin(p.angle) * Math.abs(p.car ? p.car.speed : 60) * lead,
  };
}

function render() {
  const target = cameraTarget();
  const camX = clamp(target.x - viewW / 2, 0, Math.max(0, CITY_W - viewW));
  const camY = clamp(target.y - viewH / 2, 0, Math.max(0, CITY_H - viewH));
  const shake = G.fx.shakeOffset();
  ctx.save();
  ctx.translate(-Math.round(camX + shake.x), -Math.round(camY + shake.y));
  drawWorld(ctx, G);
  ctx.restore();
  drawAtmosphere(ctx, viewW, viewH, G);
  if (G.state === 'title') {
    drawTitle(ctx, G, viewW, viewH);
    return;
  }
  drawHUD(ctx, G, viewW, viewH);
  if (G.dialogue) drawDialogue(ctx, G, viewW, viewH);
  if (G.state === 'pause') drawPause(ctx, G, viewW, viewH);
  if (G.state === 'busted' || G.state === 'wasted') drawEndScreen(ctx, G, viewW, viewH, G.state);
}

// A handle for the maker's own playtest scripts: harmless in play, and it
// lets a headless browser drive Danny and check the city's pulse.
window.__marisol = G;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
