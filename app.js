// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a floor
const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.6,
    roughness: 0.4
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Create a cube with neon effect
const createNeonMaterial = (color) => new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 1,
    metalness: 0.5,
    roughness: 0.3
});

const cubeGeometry = new THREE.BoxGeometry();
const cubeMaterial = createNeonMaterial(0x00ff00);
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

function createMiniCube(x, y, z, direction) {
    const miniGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const miniMaterial = createNeonMaterial(0xff0000);
    const miniCube = new THREE.Mesh(miniGeometry, miniMaterial);
    miniCube.position.set(x, y, z);
    miniCube.userData.direction = direction;
    scene.add(miniCube);
    miniCubes.push(miniCube);
}

// Cleanup function to remove mini cubes that go out of the scene
function cleanupMiniCubes() {
    for (let i = miniCubes.length - 1; i >= 0; i--) {
        const miniCube = miniCubes[i];
        if (miniCube.position.x > 50 || miniCube.position.x < -50 || miniCube.position.z > 50 || miniCube.position.z < -50) {
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

// Render loop
function animate() {
    requestAnimationFrame(animate);

    updateCubeMovement();
    updateCamera();
    updateMiniCubes();
    cleanupMiniCubes();
    handleShooting();

    renderer.render(scene, camera);
}

animate();
