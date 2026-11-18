// audio.js — every sound in Marisol Bay is synthesised with WebAudio
// oscillators and filtered noise; there are no audio files. A tiny engine
// keeps two continuous voices (the car engine and a police siren) plus a
// helper for one-shot blips, thuds and stings.

let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenFlip = null;

export function initAudio() {
  if (ctx) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
}

export function setMuted(value) {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.03);
}
export const isMuted = () => muted;

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
  if (!ctx || muted) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + dur);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noise(dur, vol = 0.2, cutoff = 1200, delay = 0) {
  if (!ctx || muted) return;
  const start = ctx.currentTime + delay;
  const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(start);
}

export const sfx = {
  punch: () => { noise(0.09, 0.35, 700); tone(120, 0.08, 'sine', 0.25, 60); },
  hurt: () => tone(220, 0.12, 'square', 0.12, 110),
  crash: (hard) => { noise(hard ? 0.35 : 0.16, hard ? 0.5 : 0.28, 900); tone(70, 0.2, 'sine', 0.3, 40); },
  door: () => { tone(340, 0.06, 'square', 0.1, 220); noise(0.05, 0.12, 2000, 0.02); },
  pickup: () => { tone(660, 0.09, 'sine', 0.2); tone(990, 0.14, 'sine', 0.2, null, 0.08); },
  cash: () => { tone(880, 0.07, 'triangle', 0.22); tone(1174, 0.07, 'triangle', 0.22, null, 0.07); tone(1568, 0.16, 'triangle', 0.22, null, 0.14); },
  blip: () => tone(520, 0.05, 'square', 0.07, 480),
  sting: () => { tone(392, 0.12, 'triangle', 0.2); tone(523, 0.12, 'triangle', 0.2, null, 0.11); tone(659, 0.22, 'triangle', 0.24, null, 0.22); },
  fail: () => { tone(330, 0.16, 'sawtooth', 0.14, 262); tone(262, 0.3, 'sawtooth', 0.14, 196, 0.15); },
  star: () => tone(740, 0.1, 'square', 0.12, 988),
  step: () => noise(0.03, 0.05, 500),
};

// The engine voice: a sawtooth whose pitch follows the car's speed. Call
// every frame with the speed fraction (0..1), or null to shut it off.
export function engineSound(speedFraction) {
  if (!ctx) return;
  if (speedFraction === null || muted) {
    if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    return;
  }
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480;
    engineOsc.connect(filter).connect(engineGain).connect(master);
    engineOsc.start();
  }
  engineOsc.frequency.setTargetAtTime(55 + speedFraction * 165, ctx.currentTime, 0.05);
  engineGain.gain.setTargetAtTime(0.05 + speedFraction * 0.05, ctx.currentTime, 0.05);
}

// The siren voice: a square wave flipping between two pitches while any
// police car is close enough to hear. Call with true/false each frame.
export function sirenSound(on) {
  if (!ctx) return;
  if (on && !muted) {
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      let high = false;
      sirenFlip = window.setInterval(() => {
        if (!sirenOsc) return;
        high = !high;
        sirenOsc.frequency.value = high ? 940 : 690;
      }, 380);
    }
    sirenGain.gain.setTargetAtTime(0.028, ctx.currentTime, 0.1);
  } else if (sirenGain) {
    sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  }
}

export function stopAllVoices() {
  engineSound(null);
  sirenSound(false);
}
