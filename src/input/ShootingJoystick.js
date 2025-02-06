const shootingKeys = { i: false, j: false, k: false, l: false };

let joystickShootingActive = false;
let joystickShootingStartX, joystickShootingStartY;
let joystickShootingContainer, joystickShooting;
let joystickShootingStarted = false;

function initiateShootingJoystick() {
  joystickShootingContainer = document.createElement('div');
  joystickShootingContainer.style.position = 'absolute';
  joystickShootingContainer.style.width = '100px';
  joystickShootingContainer.style.height = '100px';
  joystickShootingContainer.style.borderRadius = '50%';
  joystickShootingContainer.style.touchAction = 'none';
  joystickShootingContainer.style.pointerEvents = 'none';
  joystickShootingContainer.style.visibility = 'hidden';
  document.body.appendChild(joystickShootingContainer);

  joystickShooting = document.createElement('div');
  joystickShooting.style.width = '60px';
  joystickShooting.style.height = '60px';
  joystickShooting.style.background = 'rgba(255, 255, 255, 0.8)';
  joystickShooting.style.borderRadius = '50%';
  joystickShooting.style.position = 'absolute';
  joystickShooting.style.top = '50%';
  joystickShooting.style.left = '50%';
  joystickShooting.style.transform = 'translate(-50%, -50%)';
  joystickShootingContainer.appendChild(joystickShooting);

  setupShootingEventListeners();
}

function setupShootingEventListeners() {
  document.addEventListener('mousedown', handleShootingMouseDown);
  document.addEventListener('touchstart', handleShootingTouchStart);
  document.addEventListener('mousemove', handleShootingMouseMove);
  document.addEventListener('touchmove', handleShootingTouchMove);
  document.addEventListener('mouseup', handleShootingMouseUp);
  document.addEventListener('touchend', handleShootingMouseUp);

  // Add keyboard event listeners for I, J, K, L keys
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['i', 'j', 'k', 'l'].includes(key)) {
      shootingKeys[key] = true;
      // Dispatch shoot joystick event on first valid key press
      if (!joystickShootingStarted && (shootingKeys.i || shootingKeys.j || shootingKeys.k || shootingKeys.l)) {
        joystickShootingStarted = true;
        document.dispatchEvent(new CustomEvent("shootJoystickMoveInitiated"));
      }
    }
  });

  document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (['i', 'j', 'k', 'l'].includes(key)) {
      shootingKeys[key] = false;
    }
  });
}

function activateShootingJoystick(x, y) {
  joystickShootingContainer.style.left = `${x - joystickShootingContainer.clientWidth / 2}px`;
  joystickShootingContainer.style.top = `${y - joystickShootingContainer.clientHeight / 2}px`;
  joystickShootingContainer.style.pointerEvents = 'auto';
  joystickShootingContainer.style.visibility = 'visible';
  joystickShootingStartX = x;
  joystickShootingStartY = y;
  joystickShootingActive = true;
  joystickShootingStarted = false;
}

function deactivateShootingJoystick() {
  joystickShootingActive = false;
  joystickShootingContainer.style.pointerEvents = 'none';
  joystickShootingContainer.style.visibility = 'hidden';
  joystickShooting.style.transform = 'translate(-50%, -50%)';
  shootingKeys.i = shootingKeys.j = shootingKeys.k = shootingKeys.l = false;
  joystickShootingStarted = false;
}

function updateShootingJoystickDirection(normalizedX, normalizedY) {
  shootingKeys.i = shootingKeys.j = shootingKeys.k = shootingKeys.l = false;

  const sensitivity = 40;
  const adjustedX = normalizedX * sensitivity;
  const adjustedY = normalizedY * sensitivity;

  if (adjustedY > 0.5) shootingKeys.i = true;
  if (adjustedY < -0.5) shootingKeys.k = true;
  if (adjustedX < -0.5) shootingKeys.j = true;
  if (adjustedX > 0.5) shootingKeys.l = true;
}

function handleShootingMouseDown(e) {
  // Only use shooting joystick if click is on the right half of the screen.
  if (e.clientX < window.innerWidth / 2) return;
  activateShootingJoystick(e.clientX, e.clientY);
}

function handleShootingTouchStart(e) {
  const touch = e.touches[0];
  if (touch.clientX < window.innerWidth / 2) return;
  activateShootingJoystick(touch.clientX, touch.clientY);
}

function handleShootingMouseMove(e) {
  if (!joystickShootingActive) return;
  updateShootingJoystickPosition(e.clientX, e.clientY);
}

function handleShootingTouchMove(e) {
  if (!joystickShootingActive) return;
  const touch = e.touches[0];
  updateShootingJoystickPosition(touch.clientX, touch.clientY);
}

function handleShootingMouseUp() {
  deactivateShootingJoystick();
}

function updateShootingJoystickPosition(x, y) {
  const deltaX = x - joystickShootingStartX;
  const deltaY = y - joystickShootingStartY;
  const maxDistance = joystickShootingContainer.clientWidth / 2;
  const distance = Math.min(maxDistance, Math.sqrt(deltaX ** 2 + deltaY ** 2));
  const angle = Math.atan2(deltaY, deltaX);
  const joystickX = distance * Math.cos(angle);
  const joystickY = distance * Math.sin(angle);

  joystickShooting.style.transform = `translate(${joystickX - 50}%, ${joystickY - 50}%)`;

  const normalizedX = joystickX / maxDistance;
  const normalizedY = joystickY / maxDistance;
  updateShootingJoystickDirection(normalizedX, -normalizedY);
}

export { shootingKeys, initiateShootingJoystick }; 