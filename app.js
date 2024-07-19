// Initialization
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Floor
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

// GUI
const gui = new dat.GUI();
const floorParams = {
    metalness: floorMaterial.metalness,
    roughness: floorMaterial.roughness,
    opacity: floorMaterial.opacity
};
gui.add(floorParams, 'metalness', 0, 1).onChange(value => floorMaterial.metalness = value);
gui.add(floorParams, 'roughness', 0, 1).onChange(value => floorMaterial.roughness = value);
gui.add(floorParams, 'opacity', 0, 1).onChange(value => floorMaterial.opacity = value);

const bloomParams = {
    strength: 1,
    radius: 1,
    threshold: 0.1
};
gui.add(bloomParams, 'strength', 0.0, 3.0).onChange(value => bloomPass.strength = value);
gui.add(bloomParams, 'radius', 0.0, 1.0).onChange(value => bloomPass.radius = value);
gui.add(bloomParams, 'threshold', 0.0, 1.0).onChange(value => bloomPass.threshold = value);

const enemyParams = { count: 50 };
gui.add(enemyParams, 'count', 1, 50).step(1).onChange(() => {
    while (enemies.length > enemyParams.count) {
        const enemy = enemies.pop();
        scene.remove(enemy);
        document.body.removeChild(enemy.userData.hpBar);
    }
});

// Player
const rainbowColors = [
    0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3
];
let colorIndex = 0;

const createNeonMaterial = (color, emissiveIntensity = 1) => new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: emissiveIntensity,
    metalness: 0.5,
    roughness: 0.3
});

const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const playerMaterial = createNeonMaterial(rainbowColors[colorIndex]);
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.castShadow = true;
scene.add(player);

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

    if (playerHP <= 0) {
        triggerGameOver();
    }
}

function triggerGameOver() {
    cancelAnimationFrame(animationFrameId);

    const gameOverScreen = document.createElement('div');
    gameOverScreen.style.position = 'absolute';
    gameOverScreen.style.top = '0';
    gameOverScreen.style.left = '0';
    gameOverScreen.style.width = '100%';
    gameOverScreen.style.height = '100%';
    gameOverScreen.style.backgroundColor = 'black';
    gameOverScreen.style.display = 'flex';
    gameOverScreen.style.justifyContent = 'center';
    gameOverScreen.style.alignItems = 'center';
    gameOverScreen.style.zIndex = '100';

    const tryAgainButton = document.createElement('button');
    tryAgainButton.innerText = 'Try Again';
    tryAgainButton.style.fontSize = '20px';
    tryAgainButton.style.padding = '10px 20px';
    tryAgainButton.onclick = () => {
        location.reload();
    };

    gameOverScreen.appendChild(tryAgainButton);
    document.body.appendChild(gameOverScreen);
}

let countdown = 1800 * 60;
const timerDisplay = document.createElement('div');
timerDisplay.style.position = 'absolute';
timerDisplay.style.top = '10px';
timerDisplay.style.right = '10px';
timerDisplay.style.fontSize = '20px';
timerDisplay.style.color = 'white';
document.body.appendChild(timerDisplay);

function updateTimerDisplay() {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    timerDisplay.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}



camera.position.set(0, 15, 15);
camera.lookAt(player.position);

const keys = {};
['w', 'a', 's', 'd', 'i', 'j', 'k', 'l', 'u', 'o'].forEach(key => keys[key] = false);

document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) keys[event.key] = true;
});

document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) keys[event.key] = false;
});

// Bullets and Enemies
const bullets = [];
const enemies = [];
const lastShotTimes = { i: 0, j: 0, k: 0, l: 0 };
const shotInterval = 200;
const trailLifetime = 3000;

let trailActive = false;
let autoShooterActive = false;
let drainerActive = false;

const trail = {
    create: function (x, y, z, direction, source) {
        colorIndex = (colorIndex + 1) % rainbowColors.length;
        const trailGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const trailMaterial = createNeonMaterial(rainbowColors[colorIndex], 2);
        const trailBullet = new THREE.Mesh(trailGeometry, trailMaterial);
        trailBullet.position.set(x, y, z);
        trailBullet.userData = { direction, creationTime: Date.now(), source };
        trailBullet.castShadow = true;
        scene.add(trailBullet);
        bullets.push(trailBullet);
    }
};

function createBullet(x, y, z, direction, source) {
    colorIndex = (colorIndex + 1) % rainbowColors.length;
    const bulletGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const bulletMaterial = createNeonMaterial(rainbowColors

[colorIndex], 2);
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.set(x, y, z);
    bullet.userData = { direction, creationTime: Date.now(), source };
    bullet.castShadow = true;
    scene.add(bullet);
    bullets.push(bullet);
}

function cleanupBullets() {
    const currentTime = Date.now();
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (currentTime - bullet.userData.creationTime > trailLifetime) {
            scene.remove(bullet);
            bullets.splice(i, 1);
        } else {
            const ageRatio = (currentTime - bullet.userData.creationTime) / trailLifetime;
            bullet.scale.set(1 - ageRatio, 1 - ageRatio, 1 - ageRatio);
        }
    }
}

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
            trail.create(player.position.x, player.position.y, player.position.z, new THREE.Vector3(0, 0, 0), player);
        }
        const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
        player.rotation.y += (targetRotation - player.rotation.y) * 0.1;

        particleSystem.position.set(player.position.x, player.position.y, player.position.z);
    }

    scene.children.forEach(child => {
        if (child.userData.type === 'xpSphere' && child.userData.attracted) {
            const direction = new THREE.Vector3().subVectors(player.position, child.position).normalize();
            child.position.add(direction.multiplyScalar(movementSpeed));
        }
    });
}

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

function updateBullets() {
    const playerBulletSpeed = 0.4;
    const enemyBulletSpeed = 0.1;

    bullets.forEach(bullet => {
        const speed = bullet.userData.source === player ? playerBulletSpeed : enemyBulletSpeed;
        bullet.position.add(bullet.userData.direction.clone().multiplyScalar(speed));
    });
}

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
            createBullet(player.position.x, player.position.y, player.position.z, shootDirection, player);
            lastShotTimes.i = currentTime;
        }
    }
}

const enemyMaterial = new THREE.PointsMaterial({
    color: 0xff0000,
    size: 0.3,
    transparent: true,
    opacity: 0.8
});
let score = 0;

const scoreDisplay = document.createElement('div');
scoreDisplay.style.position = 'absolute';
scoreDisplay.style.top = '40px';
scoreDisplay.style.right = '10px';
scoreDisplay.style.fontSize = '20px';
scoreDisplay.style.color = 'white';
document.body.appendChild(scoreDisplay);

function updateScoreDisplay() {
    scoreDisplay.innerText = `Score: ${score}`;
}

function createShootingEnemy() {
    const enemyGeometry = new THREE.BoxGeometry(1, 1, 1);
    const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const shootingEnemy = new THREE.Mesh(enemyGeometry, enemyMaterial);

    const spawnDistance = 15;
    const angle = Math.random() * Math.PI * 2;
    const offsetX = Math.cos(angle) * spawnDistance;
    const offsetZ = Math.sin(angle) * spawnDistance;

    shootingEnemy.position.set(
        player.position.x + offsetX,
        0,
        player.position.z + offsetZ
    );
    shootingEnemy.userData = { hp: 1, hpBar: createHPBar(), scoreValue: 50, isShootingEnemy: true };
    scene.add(shootingEnemy);
    enemies.push(shootingEnemy);
}

function createEnemyBullet(position, direction, enemy) {
    const bulletGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(position);
    bullet.userData = { direction: direction.clone(), creationTime: Date.now(), source: enemy };
    scene.add(bullet);
    bullets.push(bullet);
}

function handleEnemyShooting() {
    const currentTime = Date.now();
    enemies.forEach(enemy => {
        if (!enemy.userData.isShootingEnemy) return;
        if (currentTime - (enemy.userData.lastShotTime || 0) > shotInterval * 3) {
            const direction = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
            createEnemyBullet(enemy.position, direction, enemy);
            enemy.userData.lastShotTime = currentTime;
        }
    });
}

function createEnemy() {
    if (Math.random() < 0.5) {
        createShootingEnemy();
    } else {
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

        const spawnDistance = 30;
        const angle = Math.random() * Math.PI * 2;
        const offsetX = Math.cos(angle) * spawnDistance;
        const offsetZ = Math.sin(angle) * spawnDistance;

        enemy.position.set(
            player.position.x + offsetX,
            0,
            player.position.z + offsetZ
        );
        enemy.userData = { hp: 2, hpBar: createHPBar(), scoreValue: 20 };
        scene.add(enemy);
        enemies.push(enemy);
    }
}

function createHPBar() {
    const hpBar = document.createElement('div');
    hpBar.style.position = 'absolute';
    hpBar.style.width = '50px';
    hpBar.style.height = '5px';
    hpBar.style.backgroundColor = 'red';
    hpBar.style.display = 'none';
    document.body.appendChild(hpBar);
    return hpBar;
}

function dropItem(position) {
    const randomChance = Math.random();
    if (randomChance < 0.1) {
        createPowerUp({
            color: 0x800080,
            type: 'drainer'
        }, position);
    } else if (randomChance < 0.2) {
        const randomPowerUp = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
        createPowerUp(randomPowerUp, position);
    } else {
        const

 sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        const xpSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        xpSphere.position.copy(position);
        xpSphere.userData = { type: 'xpSphere' };
        scene.add(xpSphere);
    }
}

function updateHPBar(hpBar, position, hp) {
    const vector = position.clone().project(camera);
    hpBar.style.left = `${(vector.x * 0.5 + 0.5) * window.innerWidth}px`;
    hpBar.style.top = `${-(vector.y * 0.5 - 0.5) * window.innerHeight}px`;
    hpBar.style.width = `${hp * 10}px`;
}

function updateEnemies() {
    enemies.forEach(enemy => {
        if (enemy.userData.isShootingEnemy) {
            handleEnemyShooting();
        }

        const direction = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
        enemy.position.add(direction.multiplyScalar(0.02));

        bullets.forEach(bullet => {
            if (bullet.position.distanceTo(enemy.position) < 1 && bullet.userData.source == player) {
                enemy.userData.hp -= 1;
                scene.remove(bullet);
                bullets.splice(bullets.indexOf(bullet), 1);
            }
            if (bullet.position.distanceTo(player.position) < 1 && bullet.userData.source !== player) {
                playerHP -= 1;
                updatePlayerBars();
                scene.remove(bullet);
                bullets.splice(bullets.indexOf(bullet), 1);
            }
        });

        updateHPBar(enemy.userData.hpBar, enemy.position, enemy.userData.hp);

        if (enemy.userData.hp <= 0) {
            score += enemy.userData.scoreValue;
            updateScoreDisplay();
            dropItem(enemy.position);
            scene.remove(enemy);
            document.body.removeChild(enemy.userData.hpBar);
            enemies.splice(enemies.indexOf(enemy), 1);
        }

        if (enemy.position.distanceTo(player.position) < 1) {
            playerHP -= 1;
            updatePlayerBars();
        }
    });
}

function spawnEnemies() {
    setInterval(() => {
        if (enemies.length < enemyParams.count) {
            createEnemy();
        }
    }, 100 );
}

let spawnEnemiesInterval;

function startSpawningEnemies() {
    spawnEnemiesInterval = setInterval(() => {
        if (enemies.length < enemyParams.count) {
            createEnemy();
        }
    }, 1000);
}

function stopSpawningEnemies() {
    clearInterval(spawnEnemiesInterval);
}

startSpawningEnemies();

const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1,
    1,
    0.1
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

// Abilities
const abilities = [];
const abilitiesLifetime = 10000;
const abilitiesLifetimes = new Map();

const autoShooterParams = {
    baseInterval: 3000,  // base interval for shooting in milliseconds
    level: 1
};

const abilityTypes = [
    {
        title: 'Trail',
        description: 'Leaves a neon trail behind the player.',
        tooltip: 'Neon Trail',
        classes: ['archer', 'assassin'],
        effect: (level) => {
            trailActive = true;
            setTimeout(() => { trailActive = false; }, abilitiesLifetime * level);
        },
        thumbnail: 'path/to/trail_thumbnail.png',
        level: 1
    },
    {
        title: 'AutoShooter',
        description: 'Automatically shoots at the nearest enemy.',
        tooltip: 'Auto Shooter',
        classes: ['archer', 'assassin'],
        effect: function(level) {
            autoShooterParams.level = level;
        },
        thumbnail: 'path/to/autoShooter_thumbnail.png',
        level: 1
    }
];

function applyAbilityEffect(ability) {
    ability.effect(ability.level);
}

// Power-ups
const powerUps = [];
const powerUpLifetime = 10000;
const powerUpLifetimes = new Map();

const powerUpTypes = [
    {
        color: 0x00ff00,
        type: 'trail',
        title: 'Trail',
        description: 'Leaves a neon trail behind the player.',
        tooltip: 'Neon Trail',
        classes: ['archer', 'assassin'],
        effect: (level) => {
            trailActive = true;
            setTimeout(() => { trailActive = false; }, abilitiesLifetime * level);
        },
        thumbnail: 'path/to/trail_thumbnail.png',
        level: 1
    },
    {
        color: 0x0000ff,
        type: 'autoShooter',
        title: 'AutoShooter',
        description: 'Automatically shoots at the nearest enemy.',
        tooltip: 'Auto Shooter',
        classes: ['archer', 'assassin'],
        effect: (level) => {
            autoShooterActive = true;
            setTimeout(() => { autoShooterActive = false; }, abilitiesLifetime * level);
        },
        thumbnail: 'path/to/autoShooter_thumbnail.png',
        level: 1
    },
    {
        color: 0x800080,
        type: 'drainer',
        title: 'Drainer',
        description: 'Attracts all XP balls to the player.',
        tooltip: 'Drainer Power-Up',
        classes: ['all'],
        effect: () => {
            scene.children.forEach(child => {
                if (child.userData.type === 'xpSphere') {
                    child.userData.attracted = true;
                }
            });
            setTimeout(() => {
                scene.children.forEach(child => {
                    if (child.userData.type === 'xpSphere') {
                        child.userData.attracted = false;
                    }
                });
            }, abilitiesLifetime);
        },
        thumbnail: 'path/to/drainer_thumbnail.png',
        level: 1
    }
];

function createPowerUp(powerUp, position) {
    const powerUpGeometry = new THREE.BoxGeometry(1, 1, 1);
    const powerUpMaterial = new THREE.MeshStandardMaterial({
        color: powerUp.color,
        emissive: powerUp.color,
        emissiveIntensity: 1,
        metalness: 0.5,
        roughness: 0.3
    });
    const powerUpMesh = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
    powerUpMesh.position.set(position.x, position.y, position.z);
    powerUpMesh.userData = { type: powerUp.type, creationTime: Date.now() };
    powerUpMesh.castShadow = true;
    scene.add(powerUpMesh);
    powerUps.push(powerUpMesh);
    powerUpLifetimes.set(powerUpMesh, powerUpLifetime);
}

function updatePowerUps() {
    const currentTime = Date.now();
    powerUps.forEach(powerUp => {
        const lifetime = powerUpLifetimes.get(powerUp);
        if (currentTime - powerUp.userData.creationTime > lifetime) {
            scene.remove(powerUp);
            powerUps.splice(powerUps.indexOf(powerUp), 1);
            powerUpLifetimes.delete(powerUp);
        }
    });
}

function checkPowerUpCollection() {
    powerUps.forEach((powerUp, index) => {
        if (player.position.distanceTo(powerUp.position) < 1) {
            const powerUP = powerUpTypes.find(a => a.type === powerUp.userData.type);
            if (powerUP) {
                applyAbilityEffect(powerUP);
            }
            scene.remove(powerUp);
            powerUps.splice(index, 1);
        }
    });
}

// Other functions
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

let lastAutoShootTime = 0;

function autoShootClosestEnemy() {
    const currentTime = Date.now();
    const interval = autoShooterParams.baseInterval / autoShooterParams.level;

    if (currentTime - lastAutoShootTime >= interval) {
        const closestEnemy = findClosestEnemy();
        if (closestEnemy) {
            const direction = new THREE.Vector3().subVectors(closestEnemy.position, player.position).normalize();
            createBullet(player.position.x, player.position.y, player.position.z, direction, player);
            lastAutoShootTime = currentTime;
        }
    }
}

function emitShockwave() {
    const shockwaveGeometry = new THREE.RingGeometry(0.5, 1, 32);
    const shockwaveMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
    });
    const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
    shockwave.position.copy(player.position);
    shockwave.rotation.x = -Math.PI / 2;
    scene.add(shockwave);

    const maxScale = 20;
    const duration = 500;
    const startTime = Date.now();

    function animateShockwave() {
        const elapsed = Date.now() - startTime;
        const scale = 1 + (maxScale - 1) * (elapsed / duration);
        shockwave.scale.set(scale, scale, scale);
        shockwave.material

.opacity = 0.5 * (1 - elapsed / duration);

        if (elapsed < duration) {
            requestAnimationFrame(animateShockwave);
        } else {
            scene.remove(shockwave);
        }
    }

    animateShockwave();
}

function smoothPushBackEnemies() {
    const pushDistance = 5;
    const pushDuration = 6000;
    const startPositions = enemies.map(enemy => enemy.position.clone());
    const startTime = Date.now();

    function animatePushBack() {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / pushDuration;

        enemies.forEach((enemy, index) => {
            const pushDirection = new THREE.Vector3().subVectors(enemy.position, player.position).normalize();
            const newPosition = startPositions[index].clone().add(pushDirection.multiplyScalar(pushDistance * progress));
            enemy.position.copy(newPosition);
        });

        if (progress < 1) {
            requestAnimationFrame(animatePushBack);
        }
    }

    animatePushBack();
}

function checkXPSphereCollection() {
    scene.children.forEach(child => {
        if (child.userData.type === 'xpSphere' && player.position.distanceTo(child.position) < 1) {
            playerXP += 20;
            if (playerXP >= 100) {
                playerLevel += 1;
                playerXP = 0;
                showLevelUpUI();
            }
            scene.remove(child);
        }
    });
}

let isPaused = false;

function showLevelUpUI() {
    const levelUpContainer = document.createElement('div');
    levelUpContainer.style.position = 'absolute';
    levelUpContainer.style.width = '100%';
    levelUpContainer.style.height = '100%';
    levelUpContainer.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    levelUpContainer.style.display = 'flex';
    levelUpContainer.style.justifyContent = 'center';
    levelUpContainer.style.alignItems = 'center';
    levelUpContainer.style.zIndex = '20';

    const buttons = [];

    isPaused = true;
    clearInterval(spawnEnemiesInterval);
    cancelAnimationFrame(animationFrameId);

    for (let i = 0; i < 3; i++) {
        const button = document.createElement('button');
        button.style.width = '100px';
        button.style.height = '50px';
        button.style.margin = '10px';
        const ability = abilityTypes[Math.floor(Math.random() * abilityTypes.length)];
        button.innerText = `${ability.title} (Level ${ability.level + 1})`;
        button.onclick = () => {
            levelUpContainer.remove();
            ability.level = Math.min(ability.level + 1, 10);
            applyAbilityEffect(ability);
            isPaused = false;
            startSpawningEnemies();
            animate();
            emitShockwave();
            smoothPushBackEnemies();
        };
        buttons.push(button);
        levelUpContainer.appendChild(button);
    }

    const vector = player.position.clone().project(camera);
    levelUpContainer.style.left = `0px`;
    levelUpContainer.style.top = `0px`;

    document.body.appendChild(levelUpContainer);
}

let animationFrameId;

function animate() {
    if (isPaused) return;
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
    updatePowerUps();
    composer.render();

    if (countdown > 0) {
        countdown--;
        updateTimerDisplay();
    } else {
        triggerGameOver();
    }
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderTarget.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}, false);


let uiVisible = false;

const toggleUIButton = document.createElement('button');
toggleUIButton.innerText = 'Toggle UI';
toggleUIButton.style.position = 'absolute';
toggleUIButton.style.top = '60px';
toggleUIButton.style.right = '10px';
toggleUIButton.style.fontSize = '20px';
toggleUIButton.style.padding = '10px 20px';
document.body.appendChild(toggleUIButton);

toggleUIButton.onclick = () => {
    uiVisible = !uiVisible;
    playerHPBar.style.display = uiVisible ? 'block' : 'none';
    playerXPBar.style.display = uiVisible ? 'block' : 'none';
    playerLevelDisplay.style.display = uiVisible ? 'block' : 'none';
    timerDisplay.style.display = uiVisible ? 'block' : 'none';
    scoreDisplay.style.display = uiVisible ? 'block' : 'none';
    enemies.forEach(enemy => {
        enemy.userData.hpBar.style.display = uiVisible ? 'block' : 'none';
    });
    toggleUIButton.innerText = uiVisible ? 'Hide UI' : 'Show UI';
};

playerHPBar.style.display = 'none';
playerXPBar.style.display = 'none';
playerLevelDisplay.style.display = 'none';
timerDisplay.style.display = 'none';
scoreDisplay.style.display = 'none';
toggleUIButton.innerText = 'Show UI';


animate();
