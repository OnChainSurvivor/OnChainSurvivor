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
                existingAbility.level = Math.min(existingAbility.level + abilityConfig.level, 10);
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
            ability = null;
        });
        this.abilities.length = 0;
    }

    takeDamage(amount) {
        const evasionSuccess = Math.random() < (this.evasion / 100);
        if (evasionSuccess) return;

        this.health -= amount;
        if (this.health <= 0) this.die();
    }

    die() {
        this.dropItem();
        this.deactivateAbilities();
        scene.remove(this);
        for (let i = 0; i < scene.children.length; i++) {
            if (scene.children[i] === this) {
                scene.children.splice(i, 1);
                break;
            }
        }
        const enemyIndex = enemies.indexOf(this);
        if (enemyIndex > -1) enemies.splice(enemyIndex, 1);
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
                            child.takeDamage(1);  
                        }
                    }
                });
            });
        };
        this.deactivate = () => {
            trailBullets.forEach(bullet => { scene.remove(bullet); });
            trailBullets.length = 0; 
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
                this.evasion=20+(3*level);
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
            }
        };
        this.update = () => {
                if (veil.shield) veil.shield.position.copy(user.position);
        };
        this.deactivate = () => {
                if (veil.shield) {
                    scene.remove(veil.shield);
                    veil.shield = null;
                }
        };
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
            }
        };
        this.update = () => {
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
                        orb.target.takeDamage(1);  
                        orb.target = null;  
                    }
                }
        };
        this.deactivate = () => {
                if (orb.mesh) {
                    scene.remove(orb.mesh);
                    orb.mesh = null;
                }
        };
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
    evasion: 100,
    tags: ['player'],
    thumbnail: 'Media/Classes/Onchain Survivor/MSURVIVOR.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    abilities: [
        { type: 'Onchain Trail', level: 5 }
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
characterContainer.style.bottom = '10px';
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
characterName.innerText = 'Onchain Survivor V0.0.10';
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
abilitiesContainer.style.top = '10px';
abilitiesContainer.style.left = '10px';
abilitiesContainer.style.display = 'flex';

characterContainer.appendChild(characterImage);
characterContainer.appendChild(characterName);
characterContainer.appendChild(abilitiesContainer);
document.body.appendChild(characterContainer);

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

function startSpawningEnemies(player, spawnInterval = 1000, spawnRadius = 20, numberOfEnemies = 5) {
    const spawnEnemy = () => {
        if(isPaused) return;
        for (let i = 0; i < numberOfEnemies; i++) {
            const angle = Math.random() * Math.PI * 2;
            const offsetX = Math.cos(angle) * spawnRadius;
            const offsetZ = Math.sin(angle) * spawnRadius;

            const spawnPosition = new THREE.Vector3(
                player.position.x + offsetX,
                player.position.y,
                player.position.z + offsetZ
            );

            const enemyConfig = entityTypes.find(type => type.class === 'Enemy'); 
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

let wheelRotation = 0; //

function createAbilityButton(ability, scale = 1, onClick) {
    const button = document.createElement('button');
    button.style.width = `${200 * scale}px`;
    button.style.height = `${300 * scale}px`;
    button.style.margin = '10px';
    button.style.display = 'flex';
    button.style.flexDirection = 'column';
    button.style.alignItems = 'center';
    button.style.backgroundColor = 'black';

    if (scale > 0.5)
    button.style.position = 'absolute'; 
    if (scale <= 0.5)
    button.style.position = 'relative';

    button.style.overflow = 'hidden';
    button.style.padding = '0';
    button.style.cursor = 'pointer';
    button.style.fontFamily = 'Arial, sans-serif';
    button.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';

    button.style.border = '1.5px solid';
    button.style.borderImageSlice = 1;
    button.style.borderImageSource = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';
    button.style.animation = 'rainbowBorder 5s linear infinite';

    const foilEffect = document.createElement('div');
    foilEffect.style.position = 'absolute';
    foilEffect.style.top = '0';
    foilEffect.style.left = '0';
    foilEffect.style.width = '100%';
    foilEffect.style.height = '100%';
    foilEffect.style.background = 'linear-gradient(135deg, rgba(192,192,192,0.5) 25%, rgba(255,255,255,0.1) 50%, rgba(192,192,192,0.5) 75%)';
    foilEffect.style.opacity = '0.3';
    foilEffect.style.pointerEvents = 'none';
    foilEffect.style.backgroundSize = '300% 300%';
    foilEffect.style.animation = 'foilShine 5s linear infinite';

    const rainbowText = (element, fontSize) => {
        element.style.fontSize = fontSize;
        element.style.color = 'transparent';
        element.style.background = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';
        element.style.backgroundClip = 'text';
        element.style.webkitBackgroundClip = 'text';
        element.style.backgroundSize = '200% 200%';
        element.style.animation = 'rainbowText 7s linear infinite';
        element.style.textAlign = 'center';
        //element.style.textShadow = '0 0 9px white, 0 0 4px gray'; 
        //element.style.filter = 'blur(1px)';
    };

    const levelStars = document.createElement('div');
    levelStars.style.display = 'flex';
    levelStars.style.marginTop = '10px';
    levelStars.style.marginBottom = '10px';
    for (let i = 0; i < ability.level; i++) {
        const star = document.createElement('img');
        star.src = 'Media/Abilities/Star.png';
        star.style.width = `${20 * scale}px`;
        star.style.height = `${20 * scale}px`;
        levelStars.appendChild(star);
    }

    const img = document.createElement('img');
    img.src = ability.thumbnail;
    img.style.width = `${150 * scale}px`;
    img.style.height = `${150 * scale}px`;

    const title = document.createElement('div');
    title.innerText = ability.title;
    rainbowText(title, `${20 * scale}px`);  
    title.style.padding = `${5 * scale}px 0`;

    lvl = ability.level;
    expl = ability.effectinfo;
    if (scale == 1) lvl = ability.level + 1;
    if (lvl == 1) expl = ability.description;

    const effectinfo = document.createElement('div');
    effectinfo.innerText = `Lvl ${lvl}: ${expl}`;
    rainbowText(effectinfo, `${14 * scale}px`); 
    effectinfo.style.padding = '10px';
    effectinfo.style.textAlign = 'justify';
    effectinfo.style.flexGrow = '1';
    button.appendChild(title);
    button.appendChild(img);
    button.appendChild(levelStars);
    button.appendChild(effectinfo);
    //button.appendChild(foilEffect);

    if (onClick) button.onclick = onClick;
    return button;
}

function refreshAbilitiesDisplay() {
    abilitiesContainer.innerHTML = '';
    abilitiesContainer.style.display = 'flex'; 
    abilitiesContainer.style.flexWrap = 'wrap'; 
    abilitiesContainer.style.gap = '10px'; 
    
    player.abilities.forEach(ability => {
        const abilityButton = createAbilityButton(ability, 0.3);
        abilityButton.style.flex = '0 1 auto'; 
        abilitiesContainer.appendChild(abilityButton);
    });
}
function create3DButton(ability, scale = 1, onClick) {
    const buttonTexture = new THREE.TextureLoader().load(ability.thumbnail);
    const buttonMaterial = new THREE.MeshBasicMaterial({ map: buttonTexture, transparent: true });
    const buttonGeometry = new THREE.PlaneGeometry(2 * scale, 3 * scale);
    const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);

    buttonMesh.userData = { ability, onClick };

    return buttonMesh;
}

function showLevelUpUI() {
    isPaused = true;
    const levelUpGroup = new THREE.Group();

    const availableAbilities = abilityTypes.filter(abilityType => {
        return !player.abilities.some(playerAbility => playerAbility.title === abilityType.title);
    });

    const allAbilities = [...player.abilities, ...availableAbilities];
    const numberOfAbilities = Math.min(15, allAbilities.length); // Max 15 abilities to show
    const angleStep = (Math.PI * 2) / numberOfAbilities;
    const radius = 5;

    for (let i = 0; i < numberOfAbilities; i++) {
        const randomIndex = Math.floor(Math.random() * allAbilities.length);
        const randomAbility = allAbilities[randomIndex];
        const buttonMesh = create3DButton(randomAbility, 5);

        const angle = i * angleStep;
        buttonMesh.position.set(
            Math.cos(angle) * radius,
            2,  // slightly above the ground level
            Math.sin(angle) * radius
        );

        buttonMesh.lookAt(camera.position);
        levelUpGroup.add(buttonMesh);

        // Set up interaction
        buttonMesh.userData.onClick = () => {
            levelUpGroup.clear(); // Remove all buttons
            const existingAbility = player.abilities.find(playerAbility => playerAbility.title === randomAbility.title);
            if (existingAbility) {
                existingAbility.deactivate();
                existingAbility.level += 1;
                existingAbility.activate();
            } else {
                const newAbility = new Ability(player, { ...randomAbility, level: 1 });
                player.addAbility(newAbility);
                newAbility.activate();
            }
            refreshAbilitiesDisplay();
            isPaused = false;
        };
    }

    scene.add(levelUpGroup);

    // Raycaster for detecting button clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(levelUpGroup.children);

        if (intersects.length > 0) {
            intersects[0].object.userData.onClick();
        }
    };

    window.addEventListener('click', onClick, { once: true });
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

let isAnimating = false;

function animate() {
    if (!isPaused) {
        updatePlayerMovement();
        updateCamera();
        updateEnemies();
        updateTimerDisplay();
    }
    animationFrameId = requestAnimationFrame(animate);
    composer.render();
    if (countdown > 0)  updateTimerDisplay();
    if (player.health <= 0) triggerGameOver();
}
refreshAbilitiesDisplay();
animate();