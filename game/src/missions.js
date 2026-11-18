// missions.js — Ms. Vega's work for Danny: three jobs with a small story,
// told in dialogue at Club Solstice and paid in cash at the end of each.
// A mission is a list of steps; each step knows where its marker stands,
// what its objective line says, and the moment it is done.

import { MONEY } from './config.js';
import { distance } from './rng.js';
import { LANDMARKS } from './city.js';
import { createPed } from './pedestrians.js';
import { sfx } from './audio.js';

const VEGA = 'Ms. Vega';
const DANNY = 'Danny';

export const MISSION_DEFS = [
  {
    title: 'First Pickup',
    pay: MONEY.missionPay[0],
    intro: [
      { who: VEGA, text: 'Danny Reyes. Word travels — they say you can drive and keep your mouth shut.' },
      { who: DANNY, text: 'Depends on the word. And the money.' },
      { who: VEGA, text: 'A package is sitting at the Portside Docks with my name on it. Bring it home to the club. Simple first job — do not make it complicated.' },
    ],
    outro: [
      { who: VEGA, text: 'On time and in one piece. You would be amazed how rare that is in this town.' },
      { who: VEGA, text: 'There is more work where that came from. Come back when you are ready to earn.' },
    ],
    steps: [
      { label: 'Pick up the package at the Portside Docks', at: 'docks', radius: 40, onFoot: true, doneText: 'Package collected' },
      { label: 'Bring the package back to Club Solstice', at: 'club', radius: 46, doneText: 'Delivered' },
    ],
  },
  {
    title: 'Hot Goods, Hot Pursuit',
    pay: MONEY.missionPay[1],
    intro: [
      { who: VEGA, text: 'Tonight the club takes its money to a buyer at the Marina. Cash, in a case, no questions.' },
      { who: DANNY, text: 'Let me guess. There is a catch.' },
      { who: VEGA, text: 'Someone talked. The police will be watching the roads, so move fast — the buyer leaves when the clock runs out.' },
    ],
    outro: [
      { who: VEGA, text: 'The buyer sends his thanks, and I send mine. You are getting a reputation, Danny.' },
    ],
    steps: [
      { label: 'Take the case from the club door', at: 'club', radius: 40, onFoot: true, doneText: 'Case collected — GO!' },
      { label: 'Deliver the case to the buyer at the Marina — fast!', at: 'marina', radius: 48, time: 150, startHeat: 2, doneText: 'Delivered in time' },
    ],
  },
  {
    title: 'The Marina Heist',
    pay: MONEY.missionPay[2],
    intro: [
      { who: VEGA, text: 'Last job, and it is not a delivery. A crew from out of town is holding my money at the Marina warehouses.' },
      { who: DANNY, text: 'You want me to take it back. Alone.' },
      { who: VEGA, text: 'I want you to take it back and be gone before anyone can describe you. Lose the police, then cool off at the beach lot. Do this, and Marisol Bay is yours.' },
    ],
    outro: [
      { who: VEGA, text: 'Every dollar. Danny, you are not a driver any more — you are a Marisol Bay story.' },
      { who: VEGA, text: 'The city is yours now. The club door is always open to you.' },
    ],
    steps: [
      { label: 'Go to the Marina warehouses', at: 'marina', radius: 52, onFoot: true, spawnThugs: 3, doneText: 'The crew is waiting…' },
      { label: 'Put the marina crew down', fight: true, doneText: 'Crew down' },
      { label: 'Grab the cash case', at: 'marinaCase', radius: 34, onFoot: true, doneText: 'Case grabbed — run!' },
      { label: 'Lose the heat, then reach the beach lot hideout', at: 'hideout', radius: 56, needsCalm: true, startHeat: 3, doneText: 'Clean getaway' },
    ],
  },
];

const EXTRA_POINTS = {
  marinaCase: { x: LANDMARKS.marina.x - 60, y: LANDMARKS.marina.y - 130 },
};

export function createMissionState(save) {
  return {
    active: -1,
    step: 0,
    timer: null,
    done: MISSION_DEFS.map((_, i) => save.missionsDone.includes(i)),
    failed: '',
  };
}

export function nextMissionIndex(state) {
  return state.done.findIndex((d) => !d);
}

export function missionPoint(step) {
  if (EXTRA_POINTS[step.at]) return EXTRA_POINTS[step.at];
  return LANDMARKS[step.at] || LANDMARKS.club;
}

function startStep(G, def, step) {
  G.marker = step.fight ? null : missionPoint(step);
  G.objective = step.label;
  if (step.time) G.mission.timer = step.time;
  else if (!step.fight) G.mission.timer = null;
  if (step.startHeat) G.setWanted(step.startHeat);
  if (step.spawnThugs) {
    const base = LANDMARKS.marina;
    for (let i = 0; i < step.spawnThugs; i++) {
      const thug = createPed(base.x - 90 + i * 70, base.y - 120 + (i % 2) * 46, G.rng, 'thug');
      thug.state = 'walk';
      thug.home = { x: thug.x, y: thug.y };
      G.peds.push(thug);
      G.mission.thugs = G.mission.thugs || [];
      G.mission.thugs.push(thug);
    }
  }
  if (step.fight) {
    G.marker = null;
    for (const thug of G.mission.thugs || []) {
      if (thug.state !== 'down') thug.state = 'fight';
    }
  }
}

export function beginMission(G, index) {
  const def = MISSION_DEFS[index];
  G.mission.active = index;
  G.mission.step = 0;
  G.mission.thugs = [];
  G.startDialogue(def.intro, () => {
    startStep(G, def, def.steps[0]);
    G.notify(`Mission started: ${def.title}`);
    sfx.sting();
  });
}

function finishMission(G) {
  const index = G.mission.active;
  const def = MISSION_DEFS[index];
  G.mission.done[index] = true;
  G.mission.active = -1;
  G.mission.timer = null;
  G.marker = null;
  G.objective = '';
  G.addMoney(def.pay, `Mission complete: ${def.title}`);
  G.fx.confetti(G.player.x, G.player.y - 10, 30);
  sfx.cash();
  G.startDialogue(def.outro, () => {
    G.saveGame();
    if (G.mission.done.every(Boolean)) {
      G.notify('Story complete — Marisol Bay is yours. Free roam!');
    } else {
      G.notify('Ms. Vega has more work at Club Solstice.');
    }
  });
}

export function failMission(G, reason) {
  const def = MISSION_DEFS[G.mission.active];
  G.mission.active = -1;
  G.mission.timer = null;
  G.marker = null;
  G.objective = '';
  G.mission.thugs = [];
  sfx.fail();
  G.notify(`${def ? def.title : 'Mission'} failed — ${reason}. Vega still has the job at the club.`);
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (m.active < 0) return;
  // The world holds its breath during a conversation: a step must never
  // complete before its own starting line has been spoken (the club-door
  // pickup sits within arm's reach of Vega herself).
  if (G.dialogue) return;
  const def = MISSION_DEFS[m.active];
  const step = def.steps[m.step];
  if (!step) { finishMission(G); return; }

  if (m.timer !== null && m.timer !== undefined) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(G, 'out of time');
      return;
    }
  }

  let complete = false;
  if (step.fight) {
    complete = (m.thugs || []).every((t) => t.state === 'down');
    G.objective = `Put the marina crew down (${(m.thugs || []).filter((t) => t.state === 'down').length}/${(m.thugs || []).length})`;
  } else {
    const point = missionPoint(step);
    const d = distance(G.player.x, G.player.y, point.x, point.y);
    const footOk = !step.onFoot || !G.player.car;
    if (d < step.radius && footOk) {
      if (step.needsCalm && G.wanted.stars > 0) {
        G.objective = 'Lose the heat first — the hideout is no good while the police see you';
      } else {
        complete = true;
      }
    }
    if (step.needsCalm && G.wanted.stars === 0) {
      G.objective = step.label;
    }
  }

  if (complete) {
    if (step.doneText) G.notify(step.doneText);
    sfx.pickup();
    m.step += 1;
    if (m.step >= def.steps.length) finishMission(G);
    else startStep(G, def, def.steps[m.step]);
  }
}

// Talking to Vega at her club door: the one door every job comes through.
export function tryTalkToVega(G) {
  if (G.mission.active >= 0) {
    G.startDialogue([
      { who: VEGA, text: 'You have a job, Danny. Finish it, then we talk about the next one.' },
    ], () => {});
    return;
  }
  const next = nextMissionIndex(G.mission);
  if (next === -1) {
    G.startDialogue([
      { who: VEGA, text: 'The bay is quiet tonight, and it is quiet because of you. Drive safe, Danny.' },
    ], () => {});
    return;
  }
  beginMission(G, next);
}
