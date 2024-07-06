// File path: main.js

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

// Enable shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Add global ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Add a directional light to cast shadows
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Infinite seamless glass floor (textureless)
const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.5; // Slightly below the player
floor.receiveShadow = true;
scene.add(floor);

// GUI for controlling floor material properties
const gui = new dat.GUI();
const floorParams = {
    metalness: floorMaterial.metalness,
    roughness: floorMaterial.roughness,
    opacity: floorMaterial.opacity
};
gui.add(floorParams, 'metalness', 0, 1).onChange(value => floorMaterial.metalness = value);
gui.add(floorParams, 'roughness', 0, 1).onChange(value => floorMaterial.roughness = value);
gui.add(floorParams, 'opacity', 0, 1).onChange(value => floorMaterial.opacity = value);

// Create the player (a simple cube)
const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.castShadow = true;
scene.add(player);

// Player HP
let playerHP = 10;
const playerHPBar = document.createElement('div');
playerHPBar.style.position = 'absolute';
playerHPBar.style.top = '10px';
playerHPBar.style.left = '10px';
playerHPBar.style.width = '100px';
playerHPBar.style.height = '20px';
playerHPBar.style.backgroundColor = 'red';
document.body.appendChild(playerHPBar);

// Position the camera farther away
camera.position.set(0, 15, 15);
camera.lookAt(player.position);

// Handle user input
const keys = {};
['w', 'a', 's', 'd', 'i', 'j', 'k', 'l', 'u', 'o'].forEach(key => keys[key] = false);

document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) keys[event.key] = true;
});

document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) keys[event.key] = false;
});

// Array to store bullets and enemies
const bullets = [];
const enemies = [];
const lastShotTimes = { i: 0, j: 0, k: 0, l: 0 };
const shotInterval = 50; // Interval between shots in milliseconds
const trailLifetime = 3000; // Lifetime of the trail bullets in milliseconds

function createBullet(x, y, z, direction) {
    const bulletGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.set(x, y, z);
    bullet.userData = { direction, creationTime: Date.now() };
    bullet.castShadow = true;
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

// Create particle effect for electric sparks
const particleGeometry = new THREE.BufferGeometry();
const particleCount = 100;
const particles = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
    particles[i * 3] = (Math.random() - 0.5) * 0.2;
    particles[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
    particles[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));

const particleMaterial = new THREE.PointsMaterial({
    color: 0xffff00,
    size: 0.1,
    transparent: true,
    opacity: 0.8
});

const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particleSystem);

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

        particleSystem.position.set(player.position.x, player.position.y, player.position.z);
    }
}

// Variables for camera rotation
let cameraAngle = 0;
const cameraRadius = 20;
const cameraHeight = 20;
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

// Create enemy particles
const enemyMaterial = new THREE.PointsMaterial({
    color: 0xff0000,
    size: 0.3,
    transparent: true,
    opacity: 0.8
});

// Create an enemy
function createEnemy() {
    const enemyGeometry = new THREE.BufferGeometry();
    const enemyCount = 100;
    const enemyParticles = new Float32Array(enemyCount * 3);

    for (let i = 0; i < enemyCount; i++) {
        enemyParticles[i * 3] = (Math.random() - 0.5) * 1;
        enemyParticles[i * 3 + 1] = (Math.random() - 0.5) * 1;
        enemyParticles[i * 3 + 2] = (Math.random() - 0.5) * 1;
    }

    enemyGeometry.setAttribute('position', new THREE.BufferAttribute(enemyParticles, 3));

    const enemy = new THREE.Points(enemyGeometry, enemyMaterial);
    enemy.position.set(
        (Math.random() - 0.5) * 50,
        0,
        (Math.random() - 0.5) * 50
    );
    enemy.userData = { hp: 5, hpBar: createHPBar() };
    scene.add(enemy);
    enemies.push(enemy);
}

// Create an HP bar
function createHPBar() {
    const hpBar = document.createElement('div');
    hpBar.style.position = 'absolute';
    hpBar.style.width = '50px';
    hpBar.style.height = '5px';
    hpBar.style.backgroundColor = 'red';
    document.body.appendChild(hpBar);
    return hpBar;
}

// Update HP bar position
function updateHPBar(hpBar, position, hp) {
    const vector = position.clone().project(camera);
    hpBar.style.left = `${(vector.x * 0.5 + 0.5) * window.innerWidth}px`;
    hpBar.style.top = `${-(vector.y * 0.5 - 0.5) * window.innerHeight}px`;
    hpBar.style.width = `${hp * 10}px`; // Assuming max HP is 5
}

// Function to update enemies
function updateEnemies() {
    enemies.forEach(enemy => {
        const direction = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
        enemy.position.add(direction.multiplyScalar(0.02));

        // Check for bullet collision
        bullets.forEach(bullet => {
            if (bullet.position.distanceTo(enemy.position) < 1) {
                enemy.userData.hp -= 1;
                scene.remove(bullet);
                bullets.splice(bullets.indexOf(bullet), 1);
            }
        });

        // Update HP bar
        updateHPBar(enemy.userData.hpBar, enemy.position, enemy.userData.hp);

        // Remove enemy if HP is 0
        if (enemy.userData.hp <= 0) {
            scene.remove(enemy);
            document.body.removeChild(enemy.userData.hpBar);
            enemies.splice(enemies.indexOf(enemy), 1);
        }
    });
}

// Automatically spawn enemies
function spawnEnemies() {
    setInterval(() => {
        if (enemies.length < enemyParams.count) {
            createEnemy();
        }
    }, 1000); // Spawn every second
}

// GUI for controlling number of enemies
const enemyParams = { count: 5 };
gui.add(enemyParams, 'count', 1, 50).step(1).onChange(() => {
    while (enemies.length > enemyParams.count) {
        const enemy = enemies.pop();
        scene.remove(enemy);
        document.body.removeChild(enemy.userData.hpBar);
    }
});

spawnEnemies();

// Render loop
function animate() {
    requestAnimationFrame(animate);

    updatePlayerMovement();
    updateCamera();
    updateBullets();
    cleanupBullets();
    handleShooting();
    updateEnemies();

    // Update player's HP bar
    playerHPBar.style.width = `${playerHP * 10}px`;

    renderer.render(scene, camera);
}

animate();
