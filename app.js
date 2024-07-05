// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a floor with higher reflectivity and lower roughness
const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.8,
    roughness: 0.1
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Rainbow colors
const rainbowColors = [
    0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3
];
let colorIndex = 0;

// Create a neon material with a rainbow color
const createNeonMaterial = (color, emissiveIntensity = 1) => new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: emissiveIntensity,
    metalness: 0.5,
    roughness: 0.3
});

const cubeGeometry = new THREE.BoxGeometry();
const cubeMaterial = createNeonMaterial(rainbowColors[colorIndex]);
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
scene.add(cube);

// Add a marker to show the front of the cube
const markerGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 32);
const markerMaterial = createNeonMaterial(0xffff00);
const marker = new THREE.Mesh(markerGeometry, markerMaterial);
marker.rotation.x = Math.PI / 2;
marker.position.set(0, 0, 0.6);
cube.add(marker);

// Position the camera
camera.position.set(0, 10, 10);
camera.lookAt(cube.position);

// Add ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Add directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 10, 10);
scene.add(directionalLight);

// Handle user input
const keys = {};
['w', 'a', 's', 'd', 'i', 'j', 'k', 'l', 'u', 'o'].forEach(key => keys[key] = false);

document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) keys[event.key] = true;
});

document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) keys[event.key] = false;
});

// Array to store mini cubes
const miniCubes = [];
const lastShotTimes = { i: 0, j: 0, k: 0, l: 0 };
const shotInterval = 50; // Interval between shots in milliseconds
const trailLifetime = 3000; // Lifetime of the trail cubes in milliseconds

function createMiniCube(x, y, z, direction) {
    colorIndex = (colorIndex + 1) % rainbowColors.length;
    const miniGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const miniMaterial = createNeonMaterial(rainbowColors[colorIndex], 2); // Higher emissive intensity for neon effect
    const miniCube = new THREE.Mesh(miniGeometry, miniMaterial);
    miniCube.position.set(x, y, z);
    miniCube.userData = { direction, creationTime: Date.now() };
    scene.add(miniCube);
    miniCubes.push(miniCube);
}

// Cleanup function to remove mini cubes that go out of the scene
function cleanupMiniCubes() {
    const currentTime = Date.now();
    for (let i = miniCubes.length - 1; i >= 0; i--) {
        const miniCube = miniCubes[i];
        if (currentTime - miniCube.userData.creationTime > trailLifetime) {
            scene.remove(miniCube);
            miniCubes.splice(i, 1);
        }
    }
}

// Update the cube's movement and rotation
function updateCubeMovement() {
    const movementSpeed = 0.2;
    let direction = new THREE.Vector3();

    // Move forward and backward relative to the camera's direction
    if (keys.s) direction.z -= movementSpeed;
    if (keys.w) direction.z += movementSpeed;
    // Move left and right relative to the camera's direction
    if (keys.a) direction.x += movementSpeed;
    if (keys.d) direction.x -= movementSpeed;

    // Transform the direction from camera space to world space
    if (direction.length() > 0) {
        direction.normalize();
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0; // Keep movement on the XZ plane
        cameraDirection.normalize();

        // Apply the camera's orientation to the movement direction
        const moveDirection = direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(cameraDirection.x, cameraDirection.z));
        cube.position.add(moveDirection.multiplyScalar(movementSpeed));

        const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
        cube.rotation.y += (targetRotation - cube.rotation.y) * 0.1; // Smooth rotation

        // Add trail cubes
        createMiniCube(cube.position.x, cube.position.y, cube.position.z, new THREE.Vector3(0, 0, 0));
    }
}

// Variables for camera rotation
let cameraAngle = 0;
const cameraRadius = 10;
const cameraHeight = 10;
const cameraRotationSpeed = 0.05;

// Camera follow function
function updateCamera() {
    // Check for camera rotation input
    if (keys.u) cameraAngle -= cameraRotationSpeed;
    if (keys.o) cameraAngle += cameraRotationSpeed;

    // Update camera position
    const cameraX = cube.position.x + cameraRadius * Math.cos(cameraAngle);
    const cameraZ = cube.position.z + cameraRadius * Math.sin(cameraAngle);
    camera.position.set(cameraX, cameraHeight, cameraZ);
    camera.lookAt(cube.position);
}

// Update the mini cubes' movement
function updateMiniCubes() {
    miniCubes.forEach(miniCube => {
        miniCube.position.add(miniCube.userData.direction.clone().multiplyScalar(0.4)); // Increased speed from 0.2 to 0.4
    });
}

// Handle continuous shooting
function handleShooting() {
    const currentTime = Date.now();

    // Calculate shoot direction based on screen perspective
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const cameraForward = new THREE.Vector3();

    camera.matrix.extractBasis(cameraRight, cameraUp, cameraForward);

    const shootDirection = new THREE.Vector3();
    if (keys.i) shootDirection.set(-cameraForward.x, 0, -cameraForward.z); // North from the camera's perspective
    if (keys.k) shootDirection.set(cameraForward.x, 0, cameraForward.z); // South from the camera's perspective
    if (keys.j) shootDirection.set(-cameraRight.x, 0, -cameraRight.z); // West from the camera's perspective
    if (keys.l) shootDirection.set(cameraRight.x, 0, cameraRight.z); // East from the camera's perspective

    if (shootDirection.length() > 0) {
        shootDirection.normalize();
        if (currentTime - lastShotTimes.i > shotInterval) {
            createMiniCube(cube.position.x, cube.position.y, cube.position.z, shootDirection);
            lastShotTimes.i = currentTime;
        }
    }
}

// Add bloom effect
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1, // Strength
    1, // Radius
    0.1 // Threshold
);

const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// GUI for controlling bloom effect
const gui = new dat.GUI();
const bloomParams = {
    strength: 1,
    radius: 1,
    threshold: 0.1
};

gui.add(bloomParams, 'strength', 0.0, 3.0).onChange(value => bloomPass.strength = value);
gui.add(bloomParams, 'radius', 0.0, 1.0).onChange(value => bloomPass.radius = value);
gui.add(bloomParams, 'threshold', 0.0, 1.0).onChange(value => bloomPass.threshold = value);

// Render loop
function animate() {
    requestAnimationFrame(animate);

    updateCubeMovement();
    updateCamera();
    updateMiniCubes();
    cleanupMiniCubes();
    handleShooting();

    composer.render();
}

animate();
