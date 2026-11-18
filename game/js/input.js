// input.js — keyboard and mouse state, read by the game loop each frame.
// Movement is WASD or the arrow keys, aiming follows the mouse, firing is
// the mouse button or Space. Enter starts and restarts, P pauses, M mutes.

const Input = (() => {
  const keys = new Set();
  const mouse = { x: 640, y: 400, down: false };
  const pressed = new Set(); // keys that went down since the last frame

  function bind(canvas) {
    window.addEventListener('keydown', (ev) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(ev.key)) {
        ev.preventDefault();
      }
      if (!keys.has(ev.key.toLowerCase())) pressed.add(ev.key.toLowerCase());
      keys.add(ev.key.toLowerCase());
      if (ev.key === 'Enter') pressed.add('enter');
    });
    window.addEventListener('keyup', (ev) => keys.delete(ev.key.toLowerCase()));
    window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

    function toGame(ev) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (ev.clientX - rect.left) * (canvas.width / rect.width);
      mouse.y = (ev.clientY - rect.top) * (canvas.height / rect.height);
    }
    canvas.addEventListener('mousemove', toGame);
    canvas.addEventListener('mousedown', (ev) => { toGame(ev); mouse.down = true; pressed.add('click'); });
    window.addEventListener('mouseup', () => { mouse.down = false; });
  }

  function moveVector() {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  function firing() {
    return mouse.down || keys.has(' ');
  }

  function wasPressed(name) {
    return pressed.has(name);
  }

  function endFrame() {
    pressed.clear();
  }

  return { bind, moveVector, firing, wasPressed, endFrame, mouse };
})();
