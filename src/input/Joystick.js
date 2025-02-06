const keys = {};
// Only track movement keys (remove "i", "j", "k", "l")
['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].forEach(key => {
  keys[key] = false;
});

let joystickActive = false;
let joystickStartX, joystickStartY;
let joystickContainer, joystick;
let joystickStarted = false;
var canMove = true; 

export function setCanMove(value) { 
  canMove = value;
}

function initiateJoystick() {
  joystickContainer = document.createElement('div');
  joystickContainer.style.position = 'absolute';
  joystickContainer.style.width = '100px';
  joystickContainer.style.height = '100px';
  joystickContainer.style.borderRadius = '50%';
  joystickContainer.style.touchAction = 'none';
  joystickContainer.style.pointerEvents = 'none';
  joystickContainer.style.visibility = 'hidden';
  document.body.appendChild(joystickContainer);

  joystick = document.createElement('div');
  joystick.style.width = '60px';
  joystick.style.height = '60px';
  joystick.style.background = 'rgba(255, 255, 255, 0.8)';
  joystick.style.borderRadius = '50%';
  joystick.style.position = 'absolute';
  joystick.style.top = '50%';
  joystick.style.left = '50%';
  joystick.style.transform = 'translate(-50%, -50%)';
  joystickContainer.appendChild(joystick);

  setupEventListeners();
}

function setupEventListeners() {
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('touchstart', handleTouchStart);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('touchmove', handleTouchMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('touchend', handleMouseUp); 

  document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) {
      keys[event.key] = true;
    }
    // Only use WASD and arrow keys for movement
  });
  document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) {
      keys[event.key] = false;
    }
  });
}

function activateJoystick(x, y) {
  joystickContainer.style.left = `${x - joystickContainer.clientWidth / 2}px`;
  joystickContainer.style.top = `${y - joystickContainer.clientHeight / 2}px`;
  joystickContainer.style.pointerEvents = 'auto';
  joystickContainer.style.visibility = 'visible';
  joystickStartX = x;
  joystickStartY = y;
  joystickActive = true;
  joystickStarted = false;
}

function deactivateJoystick() {
  joystickActive = false;
  joystickContainer.style.pointerEvents = 'none';
  joystickContainer.style.visibility = 'hidden';
  joystick.style.transform = 'translate(-50%, -50%)';
  keys.w = keys.a = keys.s = keys.d = false;
  joystickStarted = false;
}

function updateJoystickDirection(normalizedX, normalizedY) {
  keys.w = keys.a = keys.s = keys.d = false;

  const sensitivity = 40;
  const adjustedX = normalizedX * sensitivity;
  const adjustedY = normalizedY * sensitivity;

  if (adjustedY > 0.5) keys.w = true;
  if (adjustedY < -0.5) keys.s = true;
  if (adjustedX < -0.5) keys.a = true;
  if (adjustedX > 0.5) keys.d = true;
}

function handleMouseDown(e) {
  if (!canMove) return;
  // Only activate if the click is on the left half of the screen.
  if (e.clientX >= window.innerWidth / 2) return;
  activateJoystick(e.clientX, e.clientY);
}

function handleTouchStart(e) {
  if (!canMove) return;
  const touch = e.touches[0];
  if (touch.clientX >= window.innerWidth / 2) return;
  activateJoystick(touch.clientX, touch.clientY);
}

function handleMouseMove(e) {
  if (!canMove) return;
  if (!joystickActive) return;
  updateJoystickPosition(e.clientX, e.clientY);
}

function handleTouchMove(e) {
  if (!joystickActive) return;
  const touch = e.touches[0];
  updateJoystickPosition(touch.clientX, touch.clientY);
}

function handleMouseUp() {
  deactivateJoystick();
}

function updateJoystickPosition(x, y) {
  const joystickDeltaX = x - joystickStartX;
  const joystickDeltaY = y - joystickStartY;
  const maxDistance = joystickContainer.clientWidth / 2;
  const distance = Math.min(maxDistance, Math.sqrt(joystickDeltaX ** 2 + joystickDeltaY ** 2));
  const angle = Math.atan2(joystickDeltaY, joystickDeltaX);
  const joystickX = distance * Math.cos(angle);
  const joystickY = distance * Math.sin(angle);

  joystick.style.transform = `translate(${joystickX - 50}%, ${joystickY - 50}%)`;

  const normalizedX = joystickX / maxDistance;
  const normalizedY = joystickY / maxDistance;
  updateJoystickDirection(normalizedX, -normalizedY);

  // Dispatch joystick move initiated event on first movement
  if (!joystickStarted && (keys.w || keys.a || keys.s || keys.d)) {
    joystickStarted = true;
    document.dispatchEvent(new CustomEvent("joystickMoveInitiated"));
  }
}

export { keys, initiateJoystick };