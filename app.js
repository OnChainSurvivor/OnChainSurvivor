// File path: main.js

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Infinite seamless glass floor
const floorGeometry = new THREE.PlaneGeometry(100, 100);
let floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.8
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.5; // Slightly below the humanoid
scene.add(floor);

// GUI for controlling floor material properties
const gui = new dat.GUI();
const floorParams = {
    color: floorMaterial.color.getHex(),
    metalness: floorMaterial.metalness,
    roughness: floorMaterial.roughness,
    opacity: floorMaterial.opacity
};

gui.addColor(floorParams, 'color').onChange(value => floorMaterial.color.set(value));
gui.add(floorParams, 'metalness', 0, 1).onChange(value => floorMaterial.metalness = value);
gui.add(floorParams, 'roughness', 0, 1).onChange(value => floorMaterial.roughness = value);
gui.add(floorParams, 'opacity', 0, 1).onChange(value => floorMaterial.opacity = value);

// Create a neon material
const createNeonMaterial = (color, emissiveIntensity = 1) => new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: emissiveIntensity,
    metalness: 0.5,
    roughness: 0.3
});

// Function to create a polygon humanoid
const createHumanoid = () => {
    const humanoid = new THREE.Group();

    const headGeometry = new THREE.BoxGeometry(1, 1, 1);
    const headMaterial = createNeonMaterial(0x00ff00);
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 2.5, 0);
    humanoid.add(head);

    const bodyGeometry = new THREE.BoxGeometry(1.5, 2, 1);
    const bodyMaterial = createNeonMaterial(0x00ff00);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 1, 0);
    humanoid.add(body);

    const armGeometry = new THREE.BoxGeometry(0.5, 1.5, 0.5);
    const armMaterial = createNeonMaterial(0x00ff00);
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-1.25, 1.75, 0);
    rightArm.position.set(1.25, 1.75, 0);
    humanoid.add(leftArm);
    humanoid.add(rightArm);

    const legGeometry = new THREE.BoxGeometry(0.5, 1.5, 0.5);
    const legMaterial = createNeonMaterial(0x00ff00);
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.5, -0.75, 0);
    rightLeg.position.set(0.5, -0.75, 0);
    humanoid.add(leftLeg);
    humanoid.add(rightLeg);

    const clock = new THREE.Clock();
    function animateHumanoid() {
        const time = clock.getElapsedTime();
        leftArm.rotation.z = Math.sin(time * 2) * 0.5;
        rightArm.rotation.z = -Math.sin(time * 2) * 0.5;
        leftLeg.rotation.z = -Math.sin(time * 2) * 0.5;
        rightLeg.rotation.z = Math.sin(time * 2) * 0.5;
        requestAnimationFrame(animateHumanoid);
    }
    animateHumanoid();

    return humanoid;
};

const player = createHumanoid();
scene.add(player);

// Position the camera
camera.position.set(0, 10, 10);
camera.lookAt(player.position);

// Add global ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

// Handle user input
const keys = {};
['w', 'a', 's', 'd', 'i', 'j', 'k', 'l', 'u', 'o'].forEach(key => keys[key] = false);

document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) keys[event.key] = true;
});

document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) keys[event.key] = false;
});

// Array to store bullets
const bullets = [];
const lastShotTimes = { i: 0, j: 0, k: 0, l: 0 };
const shotInterval = 50; // Interval between shots in milliseconds
const trailLifetime = 3000; // Lifetime of the trail bullets in milliseconds

function createBullet(x, y, z, direction) {
    const bulletGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const bulletMaterial = createNeonMaterial(0xff0000, 2); // Higher emissive intensity for neon effect
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.set(x, y, z);
    bullet.userData = { direction, creationTime: Date.now() };
    scene.add(bullet);
    bullets.push(bullet);
}

// Cleanup function to remove bullets that go out of the scene
function cleanupBullets() {
    const currentTime = Date.now();
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (currentTime - bullet.userData.creationTime > trailLifetime) {
            scene.remove(bullet);
            bullets.splice(i, 1);
        } else {
            const ageRatio = (currentTime - bullet.userData.creationTime) / trailLifetime;
            bullet.scale.set(1 - ageRatio, 1 - ageRatio, 1 - ageRatio); // Scale down over time
        }
    }
}

// Update the player's movement and rotation
function updatePlayerMovement() {
    const movementSpeed = 0.2;
    let direction = new THREE.Vector3();

    if (keys.s) direction.z -= movementSpeed;
    if (keys.w) direction.z += movementSpeed;
    if (keys.a) direction.x += movementSpeed;
    if (keys.d) direction.x -= movementSpeed;

    if (direction.length() > 0) {
        direction.normalize();
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        const moveDirection = direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(cameraDirection.x, cameraDirection.z));
        player.position.add(moveDirection.multiplyScalar(movementSpeed));

        const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
        player.rotation.y += (targetRotation - player.rotation.y) * 0.1;

        createBullet(player.position.x, player.position.y, player.position.z, new THREE.Vector3(0, 0, 0));
    }
}

// Variables for camera rotation
let cameraAngle = 0;
const cameraRadius = 10;
const cameraHeight = 10;
const cameraRotationSpeed = 0.05;

function updateCamera() {
    if (keys.u) cameraAngle -= cameraRotationSpeed;
    if (keys.o) cameraAngle += cameraRotationSpeed;

    const cameraX = player.position.x + cameraRadius * Math.cos(cameraAngle);
    const cameraZ = player.position.z + cameraRadius * Math.sin(cameraAngle);
    camera.position.set(cameraX, cameraHeight, cameraZ);
    camera.lookAt(player.position);
}

// Update the bullets' movement
function updateBullets() {
    bullets.forEach(bullet => {
        bullet.position.add(bullet.userData.direction.clone().multiplyScalar(0.4));
    });
}

// Handle continuous shooting
function handleShooting() {
    const currentTime = Date.now();

    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const cameraForward = new THREE.Vector3();
    camera.matrix.extractBasis(cameraRight, cameraUp, cameraForward);

    const shootDirection = new THREE.Vector3();
    if (keys.i) shootDirection.set(-cameraForward.x, 0, -cameraForward.z);
    if (keys.k) shootDirection.set(cameraForward.x, 0, cameraForward.z);
    if (keys.j) shootDirection.set(-cameraRight.x, 0, -cameraRight.z);
    if (keys.l) shootDirection.set(cameraRight.x, 0, cameraRight.z);

    if (shootDirection.length() > 0) {
        shootDirection.normalize();
        if (currentTime - lastShotTimes.i > shotInterval) {
            createBullet(player.position.x, player.position.y, player.position.z, shootDirection);
            lastShotTimes.i = currentTime;
        }
    }
}

// Render loop
function animate() {
    requestAnimationFrame(animate);

    updatePlayerMovement();
    updateCamera();
    updateBullets();
    cleanupBullets();
    handleShooting();

    renderer.render(scene, camera);
}

animate();
