// input.js — keyboard and mouse state for the game. The rest of the code
// asks questions ("is E down?", "was Space just pressed?") instead of
// listening to events itself, which keeps the game loop readable and makes
// scripted screenshot scenes easy to drive.

const held = new Set();
const pressed = new Set(); // keys that went down since the last frame
const released = new Set();
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let mouseClicked = false;

const GAME_KEYS = new Set([
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ',
  'w', 'a', 's', 'd', 'e', 'f', 'p', 'm', 'enter', 'escape', 'shift',
]);

export function initInput(canvas) {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (GAME_KEYS.has(key)) event.preventDefault();
    if (!event.repeat) pressed.add(key);
    held.add(key);
  });
  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    held.delete(key);
    released.add(key);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', () => {
    mouseDown = true;
    mouseClicked = true;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });
}

export const isDown = (key) => held.has(key);
export const justPressed = (key) => pressed.has(key);
export const justReleased = (key) => released.has(key);
export const pointer = () => ({ x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked });

// Called once at the end of every frame: edge triggers live for one frame.
export function endFrame() {
  pressed.clear();
  released.clear();
  mouseClicked = false;
}

// Movement axes from either WASD or the arrow keys, as -1..1 pairs.
export function moveAxes() {
  const x = (isDown('d') || isDown('arrowright') ? 1 : 0) - (isDown('a') || isDown('arrowleft') ? 1 : 0);
  const y = (isDown('s') || isDown('arrowdown') ? 1 : 0) - (isDown('w') || isDown('arrowup') ? 1 : 0);
  return { x, y };
}
