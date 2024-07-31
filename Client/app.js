class Ability {
    constructor(user, config) {
        Object.assign(this, { user, ...config, active: false });
    }

    activate() {
        this.effect(this.level, this.user);
    }

    deactivate() {
        this.effect.deactivate();
    }

    update() {
        this.effect.update();
    }
}

class Entity extends THREE.Object3D {
    constructor(config, position) {
        super();
        Object.assign(this, config);
        this.abilities = [];
        this.mesh = new THREE.Mesh(config.geometry, config.material);
        this.add(this.mesh);
        scene.add(this);
        this.initAbilities(config.abilities);
    }

    initAbilities(abilitiesConfig) {
        abilitiesConfig.forEach(abilityConfig => {
            const existingAbility = this.abilities.find(
                ability => ability.title === abilityConfig.type
            );

            if (existingAbility) {
                existingAbility.level = Math.min(existingAbility.level + abilityConfig.level, 10); // Max level cap at 10
                existingAbility.activate();  
            } else {
                const abilityType = abilityTypes.find(type => type.title === abilityConfig.type);
                if (abilityType) {
                    const newAbility = new Ability(this, { ...abilityType, level: abilityConfig.level });
                    this.addAbility(newAbility);
                    newAbility.activate();
                }
            }
        });
    }

    addAbility(ability) {
        this.abilities.push(ability);
    }

    activateAbility(index) {
        if (this.abilities[index]) this.abilities[index].activate();
    }

    deactivateAbility(index) {
        if (this.abilities[index]) this.abilities[index].deactivate();
    }

    updateAbilities() {
        this.abilities.forEach(ability => {
            ability.update();
        });
    }

    deactivateAbilities() {
        this.abilities.forEach(ability => {
            ability.deactivate();
        });
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) this.die();
    }

    die() {
        this.deactivateAbilities();
        this.dropItem();
        scene.remove(this);
    }

    move(direction) {
        this.position.add(direction);
    }

    detectCollisions() {
        const thisBox = new THREE.Box3().setFromObject(this);
        scene.children.forEach(child => {
            if (child instanceof Entity && child !== this) {
                const otherBox = new THREE.Box3().setFromObject(child);
                if (thisBox.intersectsBox(otherBox)) this.onCollision(child);
            }
        });
    }

    onCollision(otherEntity) {
        // Placeholder for collision handling logic
    }

    dropItem() {
        const sphereGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        const xpSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        xpSphere.position.copy(this.position);
        xpSphere.userData = { type: 'xpSphere' };
        scene.add(xpSphere);
    }

    innerUpdate() {
            this.updateAbilities();
            this.detectCollisions();
     }
}
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
const abilityTypes = [{
    title: 'Onchain Trail',
    description: 'The Survivor movements leave a powerful Onchain trail behind.',
    tooltip: 'Powerful...interesting choice of words, to say the least.',
    classes: ['Data Analysts', 'Blockchain Enthusiasts', 'Coders'],
    explanation: 'Data Analysts use the trails to gather data insights, Blockchain Enthusiasts appreciate the representation of transaction trails, and Coders find utility in the trail for debugging and tracking.',
    tags: ['Area Damage', 'Defensive', 'Miscellaneous'],
    effect(level, user) {
        const trailBullets = [];
        this.lastTrailTime = 0;
        const trail = {
            create: (x, y, z, direction, source) => {
                colorIndex = (colorIndex + 1) % rainbowColors.length;
                const trailStep = new THREE.Mesh(
                    new THREE.BoxGeometry(0.2 * level, 0.2 * level, 0.2 * level),
                    createNeonMaterial(rainbowColors[colorIndex], 2)
                );
                Object.assign(trailStep.position, { x, y, z });
                trailStep.userData = { direction, creationTime: Date.now(), source, isTrail: true };
                trailStep.castShadow = true;
                scene.add(trailStep);
                trailBullets.push(trailStep);
            }
        };
        this.update = () => {
            if ((Date.now() - this.lastTrailTime > 500)) {
                this.lastTrailTime = Date.now();
                trail.create(user.position.x, user.position.y, user.position.z, new THREE.Vector3(0, 0, 0), user);
            }
            trailBullets.forEach(trailBullet => {
                const trailBox = new THREE.Box3().setFromObject(trailBullet);
                scene.children.forEach(child => {
                    if (child instanceof Entity && child !== user) {
                        const otherBox = new THREE.Box3().setFromObject(child);
                        if (trailBox.intersectsBox(otherBox)) {
                            child.takeDamage(1);  // Assuming trail damage is 1
                        }
                    }
                });
            });
        };
        this.deactivate = () => {
            trailBullets.forEach(bullet => {
                scene.remove(bullet);
            });
            trailBullets.length = 0; 
            scene.remove(this);
        };
    },
    effectinfo: 'Trail size and frequency increase.',
    thumbnail: 'Media/Abilities/ONCHAINTRAIL.png',
    level: 0
},
{
    title: "Veil of Decentralization",
    description: "The Survivor shrouds in decentralization, becoming elusive.",
    tooltip: "Can't touch this!",
    classes: ["Validator", "Decentralization Trilemma Solver"],
    explanation: "Validator: Ensures decentralization security. Decentralization Trilemma Solver: Balances decentralization aspects.",
    tags: ["Defensive", "Support"],
    effect(level, user) {
        const veil = {
            shield: null,
            create: () => {
                if (veil.shield) scene.remove(veil.shield);

                colorIndex = (colorIndex + 1) % rainbowColors.length;
                const shieldMaterial = new THREE.MeshStandardMaterial({
                    color: rainbowColors[colorIndex],
                    transparent: true,
                    opacity: 0.1,
                    emissive: rainbowColors[colorIndex],
                    emissiveIntensity: 1
                });
                const shieldGeometry = new THREE.SphereGeometry(1.5, 32, 32);
                veil.shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
                veil.shield.position.copy(user.position);
                scene.add(veil.shield);
            },
            update: () => {
                if (veil.shield) veil.shield.position.copy(user.position);
            },
            deactivate: () => {
                if (veil.shield) {
                    scene.remove(veil.shield);
                    veil.shield = null;
                }
                this.active = false;
            }
        };
        this.update = veil.update;
        this.deactivate = veil.deactivate;
        this.active = true;
        veil.create();
    },
    effectinfo: 'Veil trigger % UP.',
    thumbnail: 'Media/Abilities/VEILOFDECENTRALIZATION.png',
    level: 0,
},
{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
    effect(level, user) {
        const orb = {
            mesh: null,
            target: null,
            orbitRadius: 2,
            orbitSpeed: 0.05,
            homingSpeed: 0.1,
            create: () => {
                const geometry = new THREE.SphereGeometry(0.3, 16, 16);
                const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
                orb.mesh = new THREE.Mesh(geometry, material);
                scene.add(orb.mesh);
            },
            update: () => {
                if (!orb.mesh) return;
                
                if (!orb.target) {
                    const time = Date.now() * orb.orbitSpeed;
                    orb.mesh.position.set(
                        user.position.x + Math.cos(time) * orb.orbitRadius,
                        user.position.y,
                        user.position.z + Math.sin(time) * orb.orbitRadius
                    );

                    const potentialTargets = scene.children.filter(child => child instanceof Entity && child !== user && !user.tags.some(tag => child.tags.includes(tag)));
                    if (potentialTargets.length > 0) {
                        orb.target = potentialTargets.reduce((nearest, entity) => {
                            const distanceToCurrent = user.position.distanceTo(entity.position);
                            const distanceToNearest = user.position.distanceTo(nearest.position);
                            return distanceToCurrent < distanceToNearest ? entity : nearest;
                        });
                    }
                } else {
                    const direction = new THREE.Vector3().subVectors(orb.target.position, orb.mesh.position).normalize();
                    orb.mesh.position.add(direction.multiplyScalar(orb.homingSpeed));

                    const orbBox = new THREE.Box3().setFromObject(orb.mesh);
                    const targetBox = new THREE.Box3().setFromObject(orb.target);
                    if (orbBox.intersectsBox(targetBox)) {
                        orb.target.takeDamage(1);  // Assuming orb damage is 1
                        orb.target = null;  // Reset target
                    }
                }
            },
            deactivate: () => {
                if (orb.mesh) {
                    scene.remove(orb.mesh);
                    orb.mesh = null;
                }
                this.active = false;
            }
        };

        this.update = orb.update;
        this.deactivate = orb.deactivate;
        this.active = true;
        orb.create();
    },
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
}
];

const entityTypes = [{
    class: 'Survivor',
    name: 'Onchain Survivor',
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 0,
    tags: ['player'],
    thumbnail: 'Media/Classes/Onchain Survivor/MSURVIVOR.png',
    level: 0,
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    abilities: [
        { type: 'Onchain Trail', level: 1 }
    ],
},
{
    class: 'Enemy',
    name: 'Basic',
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 0,
    tags: ['enemy'],
    thumbnail: 0,
    level: 0,
    geometry: new THREE.BoxGeometry(1, 2, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    abilities: [
        { type: 'Onchain Trail', level: 1 },
        { type: 'Veil of Decentralization', level: 1 }
    ],
}
];

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

const player = new Entity(entityTypes.find(type => type.class === 'Survivor'));
const enemies = [];
let playerXP = 0;

const characterContainer = document.createElement('div');
characterContainer.style.position = 'absolute';
characterContainer.style.top = '10px';
characterContainer.style.left = '10px';
characterContainer.style.display = 'flex';
characterContainer.style.alignItems = 'center';
characterContainer.style.backgroundColor = 'black';
characterContainer.style.padding = '10px';
characterContainer.style.borderRadius = '10px';

const characterImage = document.createElement('img');
characterImage.src = 'Media/Classes/Onchain Survivor/MSURVIVOR.png';
characterImage.style.width = '50px';
characterImage.style.height = '50px';
characterImage.style.borderRadius = '50%';
characterImage.style.marginBottom = '10px';

const characterName = document.createElement('div');
characterName.innerText = 'Onchain Survivor V0.0.9';
characterName.style.fontSize = '20px';
characterName.style.color = 'white';
characterName.style.marginBottom = '10px';

characterContainer.appendChild(characterImage);
characterContainer.appendChild(characterName);
document.body.appendChild(characterContainer);

const playerLevelDisplay = document.createElement('div');
playerLevelDisplay.style.position = 'absolute';
playerLevelDisplay.style.fontSize = '20px';
playerLevelDisplay.style.color = 'black';
playerLevelDisplay.style.display = 'none';
document.body.appendChild(playerLevelDisplay);

const abilitiesContainer = document.createElement('div');
abilitiesContainer.id = 'abilitiesContainer';
abilitiesContainer.style.position = 'absolute';
abilitiesContainer.style.bottom = '10px';
abilitiesContainer.style.left = '10px';
abilitiesContainer.style.display = 'flex';
document.body.appendChild(abilitiesContainer);

const metaMaskContainer = document.createElement('div');
metaMaskContainer.style.position = 'absolute';
metaMaskContainer.style.top = '10px';
metaMaskContainer.style.left = '50%';
metaMaskContainer.style.transform = 'translateX(-50%)';
metaMaskContainer.style.display = 'flex';
metaMaskContainer.style.alignItems = 'center';
metaMaskContainer.style.cursor = 'pointer';

const metaMaskImage = document.createElement('img');
metaMaskImage.src = 'Media/MetamaskLogo.png';
metaMaskImage.style.width = '30px';
metaMaskImage.style.height = '30px';

const metaMaskButton = document.createElement('button');
metaMaskButton.innerText = '';
metaMaskButton.style.fontSize = '14px';
metaMaskButton.style.padding = '5px 5px';
metaMaskButton.style.backgroundColor = 'transparent';
metaMaskButton.style.color = 'white';
metaMaskButton.style.border = '1px solid white';
metaMaskButton.style.borderRadius = '5px';

metaMaskContainer.appendChild(metaMaskButton);
metaMaskButton.appendChild(metaMaskImage);
document.body.appendChild(metaMaskContainer);


function displayMetaMaskInfo(address, ethBalance) {
    metaMaskContainer.innerHTML = `
        <div style="color: white; margin-right: 10px;">
            <div>Address: ${address}</div>
        </div>
    `;
}

metaMaskButton.onclick = async () => {
    if (window.ethereum) {
        const web3 = new Web3(window.ethereum);
        try {
            await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const accounts = await web3.eth.getAccounts();
            const address = accounts[0];
            const balance = await web3.eth.getBalance(address);
            const ethBalance = web3.utils.fromWei(balance, 'ether');
            localStorage.setItem('metaMaskAddress', address);

            displayMetaMaskInfo(address, ethBalance);
        } catch (error) {
            if (error.code === 4902) {
                alert('The Ethereum chain is not available in your MetaMask, please add it manually.');
            } else {
                console.error('Error:', error);
            }
        }
    } else {
        alert('MetaMask is not installed. Please install it to use this feature.');
    }
};

function triggerGameOver() {
    isPaused = true;

    cancelAnimationFrame(animationFrameId);

    const gameOverScreen = document.createElement('div');
    gameOverScreen.style.position = 'absolute';
    gameOverScreen.style.top = '0';
    gameOverScreen.style.left = '0';
    gameOverScreen.style.width = '100%';
    gameOverScreen.style.height = '100%';
    gameOverScreen.style.backgroundColor = 'rgba(0, 0, 0)';
    gameOverScreen.style.display = 'flex';
    gameOverScreen.style.flexDirection = 'column';
    gameOverScreen.style.justifyContent = 'center';
    gameOverScreen.style.alignItems = 'center';
    gameOverScreen.style.zIndex = '100';

    const title = document.createElement('div');
    title.innerText = 'Liquidated.';
    title.style.fontSize = '40px';
    title.style.color = 'white';
    title.style.marginBottom = '20px';
    gameOverScreen.appendChild(title);

    const tryAgainButton = document.createElement('button');
    tryAgainButton.innerText = 'Try Again';
    tryAgainButton.style.fontSize = '20px';
    tryAgainButton.style.padding = '10px 20px';
    tryAgainButton.style.marginTop = '20px';
    tryAgainButton.style.backgroundColor = 'black';
    tryAgainButton.style.border = '1px solid black';
    tryAgainButton.style.boxShadow = '0px 0px 10px rgba(0, 0, 0, 0.5)';
    tryAgainButton.style.display = 'flex';
    tryAgainButton.style.flexDirection = 'column';
    tryAgainButton.style.alignItems = 'center';

    const img = document.createElement('img');
    img.src = 'Media/Abilities/LIQUIDATED.png';
    img.style.width = '575px';
    img.style.height = '250px';
    img.style.marginBottom = '10px';

    const description = document.createElement('div');
    description.innerText = 'Restart the game from the beginning.';
    description.style.fontSize = '12px';
    description.style.textAlign = 'center';
    description.style.color = 'white';
    tryAgainButton.appendChild(img);
    tryAgainButton.appendChild(description);

    tryAgainButton.onclick = () => {
        location.reload(true);
        document.body.removeChild(gameOverScreen);
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
    countdown--;
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

function updatePlayerMovement() {
    let direction = new THREE.Vector3();

    if (keys.s) direction.z -= player.movementspeed;
    if (keys.w) direction.z += player.movementspeed;
    if (keys.a) direction.x += player.movementspeed;
    if (keys.d) direction.x -= player.movementspeed;

    if (direction.length() > 0) {
        direction.normalize();
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();
        const moveDirection = direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(cameraDirection.x, cameraDirection.z));
        player.position.add(moveDirection.multiplyScalar(player.movementspeed));
        const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
        player.rotation.y += (targetRotation - player.rotation.y) * 0.1;
    }
    player.innerUpdate();

    scene.children.forEach(child => {
        if (child.userData.type === 'xpSphere' && player.position.distanceTo(child.position) < 1) {
            playerXP += 100;
            if (playerXP >= 100) {
                playerXP = 0;
                showLevelUpUI();
            }
            scene.remove(child);
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

function updateEnemies() {
    enemies.forEach(enemy => {
        const direction = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
        enemy.position.add(direction.multiplyScalar(enemy.movementspeed/2));
        enemy.innerUpdate();
    });
}

function startSpawningEnemies(player, spawnInterval = 2000, spawnRadius = 20, numberOfEnemies = 3) {
    const spawnEnemy = () => {
        for (let i = 0; i < numberOfEnemies; i++) {
            const angle = Math.random() * Math.PI * 2;
            const offsetX = Math.cos(angle) * spawnRadius;
            const offsetZ = Math.sin(angle) * spawnRadius;

            const spawnPosition = new THREE.Vector3(
                player.position.x + offsetX,
                player.position.y,
                player.position.z + offsetZ
            );

            const enemyConfig = entityTypes.find(type => type.class === 'Enemy'); // Use the enemy type configuration
            const enemy = new Entity(enemyConfig);

            enemy.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);

            scene.add(enemy);
            enemies.push(enemy);
        }
    };

    setInterval(spawnEnemy, spawnInterval);
}


startSpawningEnemies(player);

const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 1, 0.1, 0);

const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    encoding: THREE.sRGBEncoding,
});
const composer = new THREE.EffectComposer(renderer, renderTarget);
composer.addPass(renderScene);
composer.addPass(bloomPass);

let isPaused = false;

function createAbilityButton(ability, scale = 1, onClick) {
    const button = document.createElement('button');
    button.style.width = `${150 * scale}px`;
    button.style.height = `${250 * scale}px`;
    button.style.margin = '10px';
    button.style.display = 'flex';
    button.style.flexDirection = 'column';
    button.style.alignItems = 'center';
    button.style.backgroundColor = 'black';
    button.style.border = '1px solid white';
    button.style.padding = `${10 * scale}px`;
    button.style.boxShadow = '0px 0px 10px rgba(0, 0, 0, 0.5)';

    const img = document.createElement('img');
    img.src = ability.thumbnail;
    img.style.width = `${100 * scale}px`;
    img.style.height = `${100 * scale}px`;
    img.style.marginBottom = `${10 * scale}px`;

    const title = document.createElement('div');
    title.innerText = ability.title;
    title.style.fontSize = `${16 * scale}px`;
    title.style.fontWeight = 'bold';
    title.style.marginBottom = `${10 * scale}px`;
    title.style.color = 'white';

    const effectinfo = document.createElement('div');
    effectinfo.innerText = `Lvl ${ability.level}: ${ability.effectinfo}`;
    effectinfo.style.fontSize = `${12 * scale}px`;
    effectinfo.style.textAlign = 'center';
    effectinfo.style.color = 'white';

    button.appendChild(img);
    button.appendChild(title);
    button.appendChild(effectinfo);

    if (onClick) button.onclick = onClick;

    return button;
}

function showLevelUpUI() {
    const levelUpContainer = document.createElement('div');
    levelUpContainer.style.top = '0';
    levelUpContainer.style.left = '0';
    levelUpContainer.style.position = 'absolute';
    levelUpContainer.style.width = '100%';
    levelUpContainer.style.height = '100%';
    levelUpContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    levelUpContainer.style.display = 'flex';
    levelUpContainer.style.flexDirection = 'column';
    levelUpContainer.style.justifyContent = 'center';
    levelUpContainer.style.alignItems = 'center';
    levelUpContainer.style.zIndex = '20';

    const levelUpTitle = document.createElement('div');
    levelUpTitle.innerText = 'LEVEL UP';
    levelUpTitle.style.fontSize = '40px';
    levelUpTitle.style.color = 'white';
    levelUpTitle.style.marginBottom = '20px';
    levelUpContainer.appendChild(levelUpTitle);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.justifyContent = 'center';

    isPaused = true;
    cancelAnimationFrame(animationFrameId);

    for (let i = 0; i < 3; i++) {
        const abilityIndex = Math.floor(Math.random() * player.abilities.length);
        const ability = player.abilities[abilityIndex];

        const button = createAbilityButton(ability, 1, () => {
            levelUpContainer.remove();
            ability.level + 1; 
            isPaused = false;
            startSpawningEnemies();
            animate();
            addAbilityToUI(ability); 
        });
        buttonsContainer.appendChild(button);
    }
    levelUpContainer.appendChild(buttonsContainer);
    document.body.appendChild(levelUpContainer);
}

function addAbilityToUI(ability) {
    const abilityContainer = createAbilityButton(ability, 0.5); // Adjust scale as needed for in-game UI
    abilitiesContainer.insertBefore(abilityContainer, abilitiesContainer.firstChild);
}

let animationFrameId;

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderTarget.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}, false);

window.addEventListener('load', async () => {
    const storedAddress = localStorage.getItem('metaMaskAddress');
    if (storedAddress) {
        const web3 = new Web3(window.ethereum);
        const balance = await web3.eth.getBalance(storedAddress);
        const ethBalance = web3.utils.fromWei(balance, 'ether');
        displayMetaMaskInfo(storedAddress, ethBalance);
    }
});

function animate() {
    if (isPaused) return;
    animationFrameId = requestAnimationFrame(animate);
    updatePlayerMovement();
    updateCamera();
    updateEnemies();
    composer.render();
    if (countdown > 0)  updateTimerDisplay();
    if (player.health <= 0) triggerGameOver();
}

animate();