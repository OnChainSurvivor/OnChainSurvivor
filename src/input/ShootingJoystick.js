const shootingKeys = { i: false, j: false, k: false, l: false };

let joystickShootingActive = false;
let joystickShootingTouchId = null;
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
  // Touch events for mobile
  document.addEventListener('touchstart', handleShootingTouchStart, false);
  document.addEventListener('touchmove', handleShootingTouchMove, false);
  document.addEventListener('touchend', handleShootingTouchEnd, false);
  document.addEventListener('touchcancel', handleShootingTouchEnd, false);

  // Mouse events for desktop
  document.addEventListener('mousedown', handleShootingMouseDown, false);
  document.addEventListener('mousemove', handleShootingMouseMove, false);
  document.addEventListener('mouseup', handleShootingMouseUp, false);

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

function handleShootingTouchStart(e) {
  // Loop through the changed touches to find one in the right half
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.clientX >= window.innerWidth / 2 && !joystickShootingActive) {
      joystickShootingActive = true;
      joystickShootingTouchId = touch.identifier;
      joystickShootingStartX = touch.clientX;
      joystickShootingStartY = touch.clientY;
      activateShootingJoystick(touch.clientX, touch.clientY);
      break;
    }
  }
}

function handleShootingTouchMove(e) {
  if (!joystickShootingActive) return;
  // Look for the touch with our active identifier
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === joystickShootingTouchId) {
      updateShootingJoystickPosition(touch.clientX, touch.clientY);
      break;
    }
  }
}

function handleShootingTouchEnd(e) {
  // Look for the touch that ended which belongs to our joystick
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === joystickShootingTouchId) {
      deactivateShootingJoystick();
      joystickShootingTouchId = null;
      joystickShootingActive = false;
      break;
    }
  }
}

function handleShootingMouseDown(e) {
  // Only use the shooting joystick if on the right half of the screen
  if (e.clientX < window.innerWidth / 2) return;
  if (!joystickShootingActive) {
    joystickShootingActive = true;
    joystickShootingStartX = e.clientX;
    joystickShootingStartY = e.clientY;
    activateShootingJoystick(e.clientX, e.clientY);
  }
}

function handleShootingMouseMove(e) {
  if (!joystickShootingActive) return;
  updateShootingJoystickPosition(e.clientX, e.clientY);
}

function handleShootingMouseUp(e) {
  if (joystickShootingActive) {
    deactivateShootingJoystick();
    joystickShootingActive = false;
  }
}

function activateShootingJoystick(x, y) {
  joystickShootingContainer.style.pointerEvents = 'auto';
  joystickShootingContainer.style.visibility = 'visible';
  // Position the container so that the joystick is centered at the touch point
  joystickShootingContainer.style.left = (x - 50) + 'px';
  joystickShootingContainer.style.top = (y - 50) + 'px';
  joystickShooting.style.transform = 'translate(-50%, -50%)';
}

function deactivateShootingJoystick() {
  joystickShootingActive = false;
  joystickShootingContainer.style.pointerEvents = 'none';
  joystickShootingContainer.style.visibility = 'hidden';
  joystickShooting.style.transform = 'translate(-50%, -50%)';
  shootingKeys.i = shootingKeys.j = shootingKeys.k = shootingKeys.l = false;
  joystickShootingStarted = false;
}

function updateShootingJoystickPosition(x, y) {
  const deltaX = x - joystickShootingStartX;
  const deltaY = y - joystickShootingStartY;
  const maxDistance = joystickShootingContainer.clientWidth / 2;
  const distance = Math.min(maxDistance, Math.hypot(deltaX, deltaY));
  const angle = Math.atan2(deltaY, deltaX);
  const joystickX = distance * Math.cos(angle);
  const joystickY = distance * Math.sin(angle);

  joystickShooting.style.transform = `translate(${joystickX - 50}%, ${joystickY - 50}%)`;

  const normalizedX = joystickX / maxDistance;
  const normalizedY = joystickY / maxDistance;
  updateShootingJoystickDirection(normalizedX, -normalizedY);
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

export { shootingKeys, initiateShootingJoystick }; 