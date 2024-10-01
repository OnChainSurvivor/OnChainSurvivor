const keys = {};
['w', 'a', 's', 'd', 'i', 'j', 'k', 'l', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].forEach(key => keys[key] = false);

let joystickActive = false;
let joystickStartX, joystickStartY;
let joystickContainer, joystick;

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

        if (event.key === 'ArrowUp' || event.key === 'i') keys['w'] = true;
        if (event.key === 'ArrowLeft' || event.key === 'j') keys['a'] = true;
        if (event.key === 'ArrowDown' || event.key === 'k') keys['s'] = true;
        if (event.key === 'ArrowRight' || event.key === 'l') keys['d'] = true;

        if (event.key === 'ArrowUp' || event.key === 'i' || event.key === 'w') keys['s'] = false;
        if (event.key === 'ArrowLeft' || event.key === 'j' || event.key === 'a') keys['d'] = false;
        if (event.key === 'ArrowDown' || event.key === 'k' || event.key === 's') keys['w'] = false;
        if (event.key === 'ArrowRight' || event.key === 'l' || event.key === 'd') keys['a'] = false;
    
    });
    document.addEventListener('keyup', (event) => {
        if (keys.hasOwnProperty(event.key)) {
            keys[event.key] = false;
        }
        
        if (event.key === 'ArrowUp' || event.key === 'i') keys['w'] = false;
        if (event.key === 'ArrowLeft' || event.key === 'j') keys['a'] = false;
        if (event.key === 'ArrowDown' || event.key === 'k') keys['s'] = false;
        if (event.key === 'ArrowRight' || event.key === 'l') keys['d'] = false;

       
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
}

function deactivateJoystick() {
    joystickActive = false;
    joystickContainer.style.pointerEvents = 'none';
    joystickContainer.style.visibility = 'hidden';
    joystick.style.transform = 'translate(-50%, -50%)';
   // keys.w = keys.a = keys.s = keys.d = false;
}

function updateJoystickDirection(normalizedX, normalizedY) {
    keys.w = keys.a = keys.s = keys.d = false;

    const sensitivity = 4;

    const adjustedX = normalizedX * sensitivity;
    const adjustedY = normalizedY * sensitivity;

    if (adjustedY > 0.5) keys.w = true;
    if (adjustedY < -0.5) keys.s = true;
    if (adjustedX < -0.5) keys.a = true;
    if (adjustedX > 0.5) keys.d = true;
}

function handleMouseDown(e) {
    if(!canMove) return;
    activateJoystick(e.clientX, e.clientY);
}

function handleTouchStart(e) {
    if(!canMove) return;
    activateJoystick(e.touches[0].clientX, e.touches[0].clientY);
}

function handleMouseMove(e) {
    if(!canMove) return;
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
}

export { keys, initiateJoystick };