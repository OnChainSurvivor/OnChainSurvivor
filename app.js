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

// Infinite seamless floor
const floorGeometry = new THREE.PlaneGeometry(1, 1);
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
floor.position.y = -0.5;
floor.receiveShadow = true;
scene.add(floor);

floor.onBeforeRender = (renderer, scene, camera) => {
    const distance = 1000;
    const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
    const floorPosition = camera.position.clone().add(cameraDirection.multiplyScalar(distance));
    floor.position.set(floorPosition.x, floor.position.y, floorPosition.z);
};

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

// Create the player (a simple cube)
const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const playerMaterial = createNeonMaterial(rainbowColors[colorIndex]);
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.castShadow = true;
scene.add(player);

// Player HP and XP
let playerHP = 10;
let playerXP = 0;
let playerLevel = 1;

const playerHPBar = document.createElement('div');
playerHPBar.style.position = 'absolute';
playerHPBar.style.width = '50px';
playerHPBar.style.height = '10px';
playerHPBar.style.backgroundColor = 'red';

const playerXPBar = document.createElement('div');
playerXPBar.style.position = 'absolute';
playerXPBar.style.width = '50px';
playerXPBar.style.height = '5px';
playerXPBar.style.backgroundColor = 'blue';

const playerLevelDisplay = document.createElement('div');
playerLevelDisplay.style.position = 'absolute';
playerLevelDisplay.style.fontSize = '20px';
playerLevelDisplay.style.color = 'white';

document.body.appendChild(playerHPBar);
document.body.appendChild(playerXPBar);
document.body.appendChild(playerLevelDisplay);

function updatePlayerBars() {
    const vector = player.position.clone().project(camera);
    playerHPBar.style.left = `${(vector.x * 0.5 + 0.5) * window.innerWidth}px`;
    playerHPBar.style.top = `${-(vector.y * 0.5 - 0.5) * window.innerHeight - 30}px`;
    playerHPBar.style.width = `${playerHP * 5}px`;

    playerXPBar.style.left = `${(vector.x * 0.5 + 0.5) * window.innerWidth}px`;
    playerXPBar.style.top = `${-(vector.y * 0.5 - 0.5) * window.innerHeight - 10}px`;
    playerXPBar.style.width = `${playerXP * 0.5}px`;

    playerLevelDisplay.style.left = `${(vector.x * 0.5 + 0.5) * window.innerWidth + 55}px`;
    playerLevelDisplay.style.top = `${-(vector.y * 0.5 - 0.5) * window.innerHeight - 30}px`;
    playerLevelDisplay.innerHTML = playerLevel;
}

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
const shotInterval = 200; // Interval between shots in milliseconds
const trailLifetime = 3000; // Lifetime of the trail bullets in milliseconds
let trailActive = false;
let autoShooterActive = false;

// Trail object
const trail = {
    create: function (x, y, z, direction) {
        colorIndex = (colorIndex + 1) % rainbowColors.length;
        const trailGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const trailMaterial = createNeonMaterial(rainbowColors[colorIndex], 2); // Higher emissive intensity for neon effect
        const trailBullet = new THREE.Mesh(trailGeometry, trailMaterial);
        trailBullet.position.set(x, y, z);
        trailBullet.userData = { direction, creationTime: Date.now() };
        trailBullet.castShadow = true;
        scene.add(trailBullet);
        bullets.push(trailBullet);
    }
};

function createBullet(x, y, z, direction) {
    colorIndex = (colorIndex + 1) % rainbowColors.length;
    const bulletGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const bulletMaterial = createNeonMaterial(rainbowColors[colorIndex], 2); // Higher emissive intensity for neon effect
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
        if (trailActive) {
            trail.create(player.position.x, player.position.y, player.position.z, new THREE.Vector3(0, 0, 0));
        }
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
        (Math.random() - 0.5) * 20 + player.position.x,
        0,
        (Math.random() - 0.5) * 20 + player.position.z
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

// Create XP sphere
function createXPSphere(position) {
    const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const xpSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    xpSphere.position.copy(position);
    scene.add(xpSphere);
    return xpSphere;
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

        // Remove enemy if HP is 0 and create XP sphere
        if (enemy.userData.hp <= 0) {
            createXPSphere(enemy.position);
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

// Add bloom effect
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1, // Strength
    1, // Radius
    0.1 // Threshold
);

 const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
         format: THREE.RGBAFormat,
         encoding: THREE.sRGBEncoding,
     });
     const composer = new THREE.EffectComposer(renderer, renderTarget);
composer.addPass(renderScene);
composer.addPass(bloomPass);

const bloomParams = {
    strength: 1,
    radius: 1,
    threshold: 0.1
};

gui.add(bloomParams, 'strength', 0.0, 3.0).onChange(value => bloomPass.strength = value);
gui.add(bloomParams, 'radius', 0.0, 1.0).onChange(value => bloomPass.radius = value);
gui.add(bloomParams, 'threshold', 0.0, 1.0).onChange(value => bloomPass.threshold = value);

// Power-up box variables
const powerUps = [];
const powerUpLifetime = 10000; // Lifetime of the power-up in milliseconds

function createPowerUp(color, position, type) {
    const powerUpGeometry = new THREE.BoxGeometry(1, 1, 1);
    const powerUpMaterial = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 1,
        metalness: 0.5,
        roughness: 0.3
    });
    const powerUp = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
    powerUp.position.set(position.x, position.y, position.z);
    powerUp.userData = { type: type, creationTime: Date.now() };
    powerUp.castShadow = true;
    scene.add(powerUp);
    powerUps.push(powerUp);
    // Power-up self-destruction after 7 seconds
    setTimeout(() => {
        if (powerUps.includes(powerUp)) {
            scene.remove(powerUp);
            powerUps.splice(powerUps.indexOf(powerUp), 1);
        }
    }, 7000);
}

function checkPowerUpCollection() {
    powerUps.forEach((powerUp, index) => {
        if (player.position.distanceTo(powerUp.position) < 1) {
            if (powerUp.userData.type === 'trail') {
                trailActive = true;
                setTimeout(() => {
                    trailActive = false;
                }, powerUpLifetime);
            } else if (powerUp.userData.type === 'autoShooter') {
                autoShooterActive = true;
                setTimeout(() => {
                    autoShooterActive = false;


                }, powerUpLifetime);
            }
            scene.remove(powerUp);
            powerUps.splice(powerUps.indexOf(powerUp), 1);
        }
    });
}

function findClosestEnemy() {
    let closestEnemy = null;
    let closestDistance = Infinity;
    enemies.forEach(enemy => {
        const distance = player.position.distanceTo(enemy.position);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestEnemy = enemy;
        }
    });
    return closestEnemy;
}

function autoShootClosestEnemy() {
    if (autoShooterActive) {
        const closestEnemy = findClosestEnemy();
        if (closestEnemy) {
            const direction = new THREE.Vector3().subVectors(closestEnemy.position, player.position).normalize();
            createBullet(player.position.x, player.position.y, player.position.z, direction);
        }
    }
}

// Initialize power-ups at game start
//createPowerUp(0x00ff00, new THREE.Vector3(-10, 0, -10), 'trail');
//createPowerUp(0x0000ff, new THREE.Vector3(10, 0, 10), 'autoShooter');

// Function to check for XP sphere collection
function checkXPSphereCollection() {
    scene.children.forEach(child => {
        if (child.geometry && child.geometry.type === 'SphereGeometry' && player.position.distanceTo(child.position) < 1) {
            playerXP += 10;
            if (playerXP >= 100) {
                playerLevel += 1;
                playerXP = 0;
                showLevelUpUI();
            }
            scene.remove(child);
        }
    });
}

// Show level-up UI
function showLevelUpUI() {

    const levelUpContainer = document.createElement('div');
    levelUpContainer.style.position = 'absolute';
    levelUpContainer.style.width ='100%';
    levelUpContainer.style.height ='100%';
    levelUpContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    levelUpContainer.style.display = 'flex';
    levelUpContainer.style.justifyContent = 'center';
    levelUpContainer.style.alignItems = 'center';
    levelUpContainer.style.zIndex = '20'; // Ensure the level-up UI is above the main UI container

    const powerUpOptions = ['trail', 'autoShooter']; // Add all power-up types here
    const buttons = [];

    for (let i = 0; i < 3; i++) {
        const button = document.createElement('button');
        button.style.width = '100px';
        button.style.height = '50px';
        button.style.margin = '10px';
        const powerUp = powerUpOptions[Math.floor(Math.random() * powerUpOptions.length)];
        button.innerText = powerUp;
        button.onclick = () => {
            levelUpContainer.remove();
            if (powerUp === 'trail') {
                trailActive = true;
                setTimeout(() => {
                    trailActive = false;
                }, powerUpLifetime);
            } else if (powerUp === 'autoShooter') {
                autoShooterActive = true;
                setTimeout(() => {
                    autoShooterActive = false;
                }, powerUpLifetime);
            }
            animate();
        };
        buttons.push(button);
        levelUpContainer.appendChild(button);
    }

    const vector = player.position.clone().project(camera);
    levelUpContainer.style.left = `0px`;
    levelUpContainer.style.top = `0px`;

    document.body.appendChild(levelUpContainer);
    cancelAnimationFrame(animationFrameId);
}

// Render loop
let animationFrameId;
function animate() {
    animationFrameId = requestAnimationFrame(animate);

    updatePlayerMovement();
    updateCamera();
    updateBullets();
    cleanupBullets();
    handleShooting();
    updateEnemies();
    checkPowerUpCollection();
    autoShootClosestEnemy();
    checkXPSphereCollection();
    updatePlayerBars();

    composer.render();
    renderer.render(scene, camera);
}

 // Resize renderer, render target, and composer on window resize
  window.addEventListener('resize', () => {
         camera.aspect = window.innerWidth / window.innerHeight;
         camera.updateProjectionMatrix();
         renderer.setSize(window.innerWidth, window.innerHeight);
        renderTarget.setSize(window.innerWidth, window.innerHeight);
          composer.setSize(window.innerWidth, window.innerHeight);
     }, false);

// Spawn a power-up box every 5 seconds
setInterval(() => {
    createPowerUp(0x00ff00, new THREE.Vector3((Math.random() - 0.5) * 20 + player.position.x, 0, (Math.random() - 0.5) * 20 + player.position.z), 'trail');
    createPowerUp(0x0000ff, new THREE.Vector3((Math.random() - 0.5) * 20 + player.position.x, 0, (Math.random() - 0.5) * 20 + player.position.z), 'autoShooter');
}, 5000);

animate();