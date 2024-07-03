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
marker.position.set(0, 0, -0.6);
cube.add(marker);

// Position the camera
camera.position.set(0, 10, 0);
camera.lookAt(0, 0, 0);

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
let rotationAngle = 0;

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

// Calculate direction vector based on rotation angle
function getDirectionVector(angle) {
    return new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle));
}

// Transform direction vector by the cube's rotation
function transformDirectionVector(vector, rotationAngle) {
    const rotationMatrix = new THREE.Matrix4().makeRotationY(rotationAngle);
    vector.applyMatrix4(rotationMatrix);
    return vector;
}

// Render loop
function animate() {
    requestAnimationFrame(animate);

    const movementSpeed = 0.1;
    const shootingSpeed = 0.2;

    if (keys.w) cube.position.add(transformDirectionVector(new THREE.Vector3(0, 0, -movementSpeed), rotationAngle));
    if (keys.a) cube.position.add(transformDirectionVector(new THREE.Vector3(-movementSpeed, 0, 0), rotationAngle));
    if (keys.s) cube.position.add(transformDirectionVector(new THREE.Vector3(0, 0, movementSpeed), rotationAngle));
    if (keys.d) cube.position.add(transformDirectionVector(new THREE.Vector3(movementSpeed, 0, 0), rotationAngle));

    if (keys.u) rotationAngle -= 0.1;  // Turn left
    if (keys.o) rotationAngle += 0.1;  // Turn right

    cube.rotation.y = rotationAngle;  // Update the cube's rotation

    if (keys.i) createMiniCube(cube.position.x, cube.position.y, cube.position.z, transformDirectionVector(new THREE.Vector3(0, 0, -shootingSpeed), rotationAngle));
    if (keys.j) createMiniCube(cube.position.x, cube.position.y, cube.position.z, transformDirectionVector(new THREE.Vector3(-shootingSpeed, 0, 0), rotationAngle));
    if (keys.k) createMiniCube(cube.position.x, cube.position.y, cube.position.z, transformDirectionVector(new THREE.Vector3(0, 0, shootingSpeed), rotationAngle));
    if (keys.l) createMiniCube(cube.position.x, cube.position.y, cube.position.z, transformDirectionVector(new THREE.Vector3(shootingSpeed, 0, 0), rotationAngle));

    miniCubes.forEach(miniCube => {
        miniCube.position.add(miniCube.userData.direction.clone().multiplyScalar(0.2));
    });

    cleanupMiniCubes();

    renderer.render(scene, camera);
}

animate();
