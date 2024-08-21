/*---------------------------------------------------------------------------
                              Classes
---------------------------------------------------------------------------*/

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
        this.boundingBox = new THREE.Box3().setFromObject(this.mesh);
        this.add(this.mesh);
        scene.add(this);
        this.possibleAbilities = new Map();
        this.initAbilities(config.abilities);
    }

    initAbilities(abilitiesConfig) {
        abilitiesConfig.forEach(abilityConfig => {
            const vabilityType = abilityTypes.find(type => type.title === abilityConfig.type);
            if (vabilityType) {
                this.possibleAbilities.set(abilityConfig.type, { ...vabilityType, level: abilityConfig.level });
            }
            if (abilityConfig.level===0) return;
            const existingAbility = this.abilities.find(ability => ability.title === abilityConfig.type);
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

    getUpgradableAbilities() {
        return Array.from(this.possibleAbilities.values())
        .filter(ability => {
            const playerAbility = player.abilities.find(pa => pa.title === ability.title);
            return (playerAbility ? playerAbility.level : 0) < 10;
        });
    }

    addAbility(ability) {
        this.abilities.push(ability);
    }

    activateAbility(index) {
        this.abilities[index]?.activate();
    }

    deactivateAbility(index) {
        this.abilities[index]?.deactivate();
    }

    updateAbilities() {
        this.abilities.forEach(ability => ability.update());
    }

    deactivateAbilities() {
        this.abilities.forEach(ability => ability.deactivate());
        this.abilities.length = 0;
    }

    takeDamage(amount) {
        if (this.evasionCooldown) return;

        const evasionSuccess = Math.random() < (this.evasion / 100);
        if (evasionSuccess) {
            console.log("EVADED");
            this.evasionCooldown = true;
            setTimeout(() => this.evasionCooldown = false, 1000);
            return;
        }

        this.health -= amount;
        if (this.health <= 0) this.die();
    }

    die() {
        handleEntityDeath(this, enemies);
    }
}

/*---------------------------------------------------------------------------
                              Global Variables & Constants
---------------------------------------------------------------------------*/

let player;
let ability;
let world;

let isPaused = true;
let isMainMenu = true;

let animationFrameId;
const clock = new THREE.Clock();
const fixedTimeStep = 1 / 60;
let accumulatedTime = 0;

const isMobile = window.innerWidth <= 650;

let cameraAngle = 0;
const cameraRadius = 20;
const cameraHeight = 20;

let canMove = true;

const keys = {};
['w', 'a', 's', 'd', 'i', 'j', 'k', 'l', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].forEach(key => keys[key] = false);

let joystickActive = false;
let joystickStartX, joystickStartY;
let joystickContainer;
let joystick;
let xpLoadingBar;

const rainbowColors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
let colorIndex = 0;

const xpSpheres = []; 
const xpsphereGeometry = new THREE.SphereGeometry(0.25, 16, 16);
const xpsphereMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });

/*---------------------------------------------------------------------------
                              Utility Functions
---------------------------------------------------------------------------*/

const createNeonMaterial = (color, emissiveIntensity = 1) => new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    metalness: 0.5,
    roughness: 0.3
});

const dropXpSphere = (position) => {
    const xpSphere = new THREE.Mesh(xpsphereGeometry, xpsphereMaterial);
    xpSphere.position.copy(position);
    xpSphere.boundingBox = new THREE.Box3().setFromObject(xpSphere);
    scene.add(xpSphere);
    xpSpheres.push(xpSphere);
};

const handleEntityDeath = (entity, enemies) => {
    if (player.health <= 0) triggerGameOver();
    dropXpSphere(entity.position);
    entity.deactivateAbilities();
    scene.remove(entity);

    const index = scene.children.indexOf(entity);
    if (index > -1) scene.children.splice(index, 1);

    const enemyIndex = enemies.indexOf(entity);
    if (enemyIndex > -1) enemies.splice(enemyIndex, 1);
};

function initiateJoystick(){
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
        keys.w = keys.a = keys.s = keys.d = false; 
}

function updateJoystickDirection(normalizedX, normalizedY) {
        if(!canMove) return;
        keys.w = keys.a = keys.s = keys.d = false;
        
        if (normalizedY > 0.5) keys.w = true; 
        if (normalizedY < -0.5) keys.s = true; 
        if (normalizedX < -0.5) keys.a = true;
        if (normalizedX > 0.5) keys.d = true; 
}

/*---------------------------------------------------------------------------
                              Ability Blueprints
---------------------------------------------------------------------------*/

const abilityTypes = [
{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    tags:["Offensive", "Burst Damage"],
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0,
    isLocked: true,
    effect(level, user) {
            this.lastHitTime=0;
            let time = Date.now();
            let potentialTargets= null;
            let distanceToCurrent = null;
            let distanceToNearest = null;
            let direction= null;
            const orb = {
                mesh: null,
                target: null,
                orbitRadius: 2,
                orbitSpeed: 0.01,
                homingSpeed: 0.2,
                create: () => {
                    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
                    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
                    orb.mesh = new THREE.Mesh(geometry, material);
                    orb.boundingBox = new THREE.Box3().setFromObject(orb.mesh);
                    scene.add(orb.mesh);
                }
            };
            this.update = () => {
                    if (!orb.target) {
                        time = Date.now() * orb.orbitSpeed;
                        orb.mesh.position.set(
                            user.position.x + Math.cos(time) * orb.orbitRadius,
                            user.position.y,
                            user.position.z + Math.sin(time) * orb.orbitRadius
                        );
                        if ((Date.now() - this.lastHitTime > (5000-(level*200)))) {
                        this.lastHitTime = Date.now();
                        potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);
                        if (potentialTargets.length > 0) {
                            orb.target = potentialTargets.reduce((nearest, entity) => {
                                distanceToCurrent = user.position.distanceTo(entity.position);
                                distanceToNearest = user.position.distanceTo(nearest.position);
                                return distanceToCurrent < distanceToNearest ? entity : nearest;
                            });
                        }
                        }
                    } else {
                        direction = new THREE.Vector3().subVectors(orb.target.position, orb.mesh.position).normalize();
                        orb.mesh.position.add(direction.multiplyScalar(orb.homingSpeed));
                        orb.boundingBox.setFromObject(orb.mesh);
                        if (orb.boundingBox.intersectsBox(orb.target.boundingBox)) {
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
            orb.create();
    },
},
{
    title: 'Onchain Trail',
    description: 'The Survivor movements leave a powerful Onchain trail behind.',
    tooltip: 'Powerful...interesting choice of words, to say the least.',
    tags: ['Area Damage', 'Defensive', 'Miscellaneous'],
    effectinfo: 'Trail size and frequency increase.',
    thumbnail: 'Media/Abilities/ONCHAINTRAIL.png',
    level: 0,
    isLocked: true,
    effect(level, user) {
        const trailBullets = [];
        this.lastTrailTime = 0;
        const trail = {
            create: () => {
                if (trailBullets.length >= (7+(level*2))) {
                    const oldestBullet = trailBullets.shift(); 
                    scene.remove(oldestBullet); 
                }
                colorIndex = (colorIndex + 1) % rainbowColors.length;
                const trailStep = new THREE.Mesh(
                    new THREE.BoxGeometry(0.2 , 0.2 , 0.2 ),
                    createNeonMaterial(rainbowColors[colorIndex], 2)
                );
                trailStep.position.copy(user.position);
                trailStep.castShadow = true;
                scene.add(trailStep);
                trailStep.trailBox = new THREE.Box3().setFromObject(trailStep);
                trailBullets.push(trailStep);
            }
        };
        this.update = () => {
            if ((Date.now() - this.lastTrailTime > 25)) {
                this.lastTrailTime = Date.now();
                trail.create();
            }
           // playerCollisionList.forEach((trailBullet,index) => {
            //            if (trailBullet.trailBox.intersectsBox(other)) { 
            //                scene.remove(trailBullet); 
            //                trailBullets.splice(index, 1);
            //                player.takeDamage(1);  
            //            }
           // });
        };
        this.deactivate = () => {
            trailBullets.forEach(bullet => { scene.remove(bullet); });
            trailBullets.length = 0; 
        };
    },
},
{
    title: "Veil of Decentralization",
    description: "The Survivor shrouds in decentralization, becoming elusive.",
    tooltip: "Can't touch this!",
    tags: ["Defensive", "Support"],
    effectinfo: 'Veil trigger % UP.',
    thumbnail: 'Media/Abilities/VEILOFDECENTRALIZATION.png',
    level: 0,
    isLocked: true,
    effect(level, user) {
        const veil = {
            create: () => {
                if (veil.shield) scene.remove(veil.shield);
                user.evasion += (3*level);
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
                    user.evasion -= (3*level);
                    scene.remove(veil.shield);
                    veil.shield = null;
                }
        };
        veil.create();
    },
},
{
    title: "Code Refactor",
    description: "Rewrites the Survivor's abilities, reducing their cooldowns.",
    tooltip: "FAST",
    tags: ["Buffs", "Skill Cooldown Reduction"],
    effectinfo: 'Cooldown % reduction  .',
    thumbnail: 'Media/Abilities/CODEREFACTOR.png',
    level: 0,
    isLocked: false, 
    effect(level, user) {
        const veil = {
            create: () => {
                if (veil.shield) scene.remove(veil.shield);
                user.evasion += (3*level);
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
                    user.evasion -= (3*level);
                    scene.remove(veil.shield);
                    veil.shield = null;
                }
        };
        veil.create();
    },
},
];

/*---------------------------------------------------------------------------
                              Survivors Blueprint
---------------------------------------------------------------------------*/

const playerTypes = [{
    class: 'Survivor',
    title: 'Onchain Survivor',
    description:'The jack of all trades (lol), adaptable and versatile with a balanced set of abilities that covers a wide range of effects.',
    tooltip:'despite losing it all in the 2018 market crash, he kept grinding every day.',
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    xpToNextLevel:10,
    tags: ['player'],
    thumbnail: 'Media/Classes/Onchain Survivor/MSURVIVOR.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
        { type: 'Scalping Bot', level: 1 },
        { type: 'Onchain Trail', level: 0  },
        { type: 'Scalping Bot', level: 0 },
        { type: 'Onchain Trail', level: 0 },
        { type: 'Veil of Decentralization', level: 0 },
        { type: 'Onchain Trail', level: 0  },
        { type: 'Scalping Bot', level: 0 },
        { type: 'Onchain Trail', level: 0 },
        { type: 'Onchain Trail', level: 0 }, 
        { type: 'Veil of Decentralization', level: 0 }
    ],
},{
    class: 'Survivor',
    title: 'Onchain Survivor',
    description: 'The jill of all trades (lol), adaptable and versatile with a balanced set of abilities that covers a wide range of effects.',
    tooltip: 'Despite losing it all in the 2018 market crash, she kept grinding every day.',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50, 
    xpToNextLevel:10,
    tags: ['player'],
    thumbnail: 'Media/Classes/Onchain Survivor/FSURVIVOR.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[2]),
    level:0,
    isLocked: false,
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Miner',
    description: 'Strong, durable, reliable, albeit somewhat slow, have higher chance of taking good rewards.',
    tooltip: 'Despite losing it all in the 2018 market crash, she kept grinding every day.',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50, 
    xpToNextLevel:10,
    tags: ['player'],
    thumbnail: 'Media/Classes/Miner/MMINER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[2]),
    level:0,
    isLocked: false,
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Miner',
    description: 'Has a longer and battle tested proven record of protecting and surviving in the chain.',
    tooltip: 'Despite losing it all in the 2018 market crash, she kept grinding every day.',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50, 
    xpToNextLevel:10,
    tags: ['player'],
    thumbnail: 'Media/Classes/Miner/FMINER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[2]),
    level:0,
    isLocked: false,
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Staker',
    description: 'Balanced in speed and strength, stakers gain bonuses for maintaining stability and have unique defensive abilities.',
    tooltip: 'Despite losing it all in the 2018 market crash, she kept grinding every day.',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50, 
    xpToNextLevel:10,
    tags: ['player'],
    thumbnail: 'Media/Classes/Staker/MSTAKER.png',  
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[2]),
    level:0,
    isLocked: false,
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Staker',
    description: 'Balanced in speed and strength, stakers gain bonuses for maintaining stability and have unique defensive abilities.',
    tooltip: 'Despite losing it all in the 2018 market crash, she kept grinding every day.',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50, 
    xpToNextLevel:10,
    tags: ['player'],
    thumbnail: 'Media/Classes/Staker/FSTAKER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[2]),
    level:0,
    isLocked: false,
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Trader',
    description: 'Fast and agile, traders can move quickly around the arena but have lower health. They have unique abilities related to market dynamics.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Trader/MTRADER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Trader',
    description: 'Fast and agile, traders can move quickly around the arena but have lower health. They have unique abilities related to market dynamics.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Trader/FTRADER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Developer',
    description: 'Versatile and strategic, developers can modify the environment and create powerful code-based attacks.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Developer/MDEVELOPER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Developer',
    description: 'Versatile and strategic, developers can modify the environment and create powerful code-based attacks.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Developer/FDEVELOPER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Regulator',
    description: 'Controllers of chaos, regulators can impose rules and restrictions on enemies, making them powerful crowd-control specialists.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Regulator/MREGULATOR.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Regulator',
    description: 'Controllers of chaos, regulators can impose rules and restrictions on enemies, making them powerful crowd-control specialists.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Regulator/FREGULATOR.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Quantum Cryptographer',
    description: 'Masters of quantum cryptography, withouth them the blockchain has no means of suriving in the future.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Quantum/MQUANTUM.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Quantum Cryptographer',
    description: 'Masters of quantum cryptography, withouth them the blockchain has no means of suriving in the future.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Quantum/FQUANTUM.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Crypto Botter',
    description: 'Utilizes bots and scripts for every action, very resourceful, always has an edge agaisnt other survivors.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Crypto Botter/MBOTTER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Crypto Botter',
    description: 'Utilizes bots and scripts for every action, very resourceful, always has an edge agaisnt other survivors.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Crypto Botter/FBOTTER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Fudder',
    description: 'Always bearish, spreading fear, uncertainty, and doubt (FUD). Fudders are unafected by the always improving  blockchain tech...',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Fudder/MFUDDER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Fudder',
    description: 'Always bearish, spreading fear, uncertainty, and doubt (FUD). Fudders are unafected by the always improving  blockchain tech...',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Fudder/FFUDDER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},
{
    class: 'Survivor',
    title: 'Crypto Astrologer',
    description: 'Uses the moon cycles and the stars and signs to predict market movements, providing unique takes based on astrological insights',
    tooltip: 'Some say he has more hidden wallets than *******.',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Astrologer/MASTROLOGER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [

    ],
},
{
    class: 'Survivor',
    title: 'Crypto Astrologer',
    description: 'Uses the moon cycles and the stars and signs to predict market movements, providing unique takes based on astrological insights',
    tooltip: 'Some say he has more hidden wallets than *******.',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Astrologer/FASTROLOGER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [

    ],
},
{
    class: 'Survivor',
    title: 'Influencer',
    description: 'Influencers have a huge following and can move markets with a single well timed post online. Tends to lean the vain side.',
    tooltip: 'Some say he has more hidden wallets than *******.',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Influencer/MINFLUENCER.jpg',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [

    ],
},
{
    class: 'Survivor',
    title: 'Influencer',
    description: 'Influencers have the ability to stand out in a crowded digital space. She has built her reputation from scratch',
    tooltip: 'Some say she has more hidden wallets than *******.',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Influencer/FINFLUENCER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [


    ],
},{
    class: 'Survivor',
    title: 'Cabal Insider',
    description: 'Part of the inner group that manipulates markets for their benefit. They are in control.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Insider Cabal/MCABAL.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Cabal Insider',
    description: 'Part of the inner group that manipulates markets for their benefit. They are in control.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Insider Cabal/FCABAL.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Bitcoin MAXI',
    description: 'Holds 100% of their net worth in a Bitcoin, Never selling, always holding.  Showcases unwavering faith.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Maxi/MMAXI.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Bitcoin MAXI',
    description: 'Holds 100% of their net worth in a Bitcoin, Never selling, always holding.  Showcases unwavering faith.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Maxi/FMAXI.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Gambler',
    description: 'Former poker player and sports bettor turned crypto enthusiast, thriving on risk.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Gambler/MGAMBLER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Gambler',
    description: 'Former poker player and sports bettor turned crypto enthusiast, thriving on risk.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Gambler/FGAMBLER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Liquidator',
    description: 'Specializes in liquidating loans and protocols, causing financial chaos.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Liquidator/MLIQUIDATOR.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Liquidator',
    description: 'Specializes in liquidating loans and protocols, causing financial chaos.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Liquidator/FLIQUIDATOR.png', // Debt: fix the green borders, make them black
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Nocoiner',
    description: 'Does not hold  any crypto currencies,  but spends all their time discussing crypto, spreading skepticism.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Nocoiner/MNOCOINER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Nocoiner',
    description: 'Does not hold  any crypto currencies,  but spends all their time discussing crypto, spreading skepticism.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Nocoiner/FNOCOINER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Auditor',
    description: 'Revises code to ensure it does not contain fatal bugs, preventing exploits',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Auditor/MAUDITOR.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Auditor',
    description: 'Revises code to ensure it does not contain fatal bugs, preventing exploits',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Auditor/FAUDITOR.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Sleuth',
    description: 'Tracks on-chain history to uncover events and catch criminals.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Sleuth/MSLEUTH.png', //Debt: add a pipe, make background black 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Sleuth',
    description: 'Tracks on-chain history to uncover events and catch criminals.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Sleuth/FSLEUTH.png', //Debt: add a pipe 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Beta Tester',
    description: 'Tests blockchain projects during beta, discovering strengths and weaknesses',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Beta Tester/MBETATESTER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Beta Tester',
    description: 'Tests blockchain projects during beta, discovering strengths and weaknesses',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Beta Tester/FBETATESTER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Defi Expert',
    description: 'Experts in utilizing decentralized finance protocols to gain advantages.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Defi/MDEFI.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Defi Expert',
    description: 'Experts in utilizing decentralized finance protocols to gain advantages.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Defi/FDEFI.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Defi Hacker',
    description: 'Skilled in infiltration and sabotage, drains protocols, exploiting vulnerabilities for personal gain',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Defi Hacker/MDEFIHACKER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Defi Hacker',
    description: 'Skilled in infiltration and sabotage, drains protocols, exploiting vulnerabilities for personal gain',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Defi Hacker/FDEFIHACKER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Sybiller',
    description: 'Uses multiple fake personas to forge voting results, airdrops, and more.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Sybiller/MSYBILLER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Sybiller',
    description: 'Uses multiple fake personas to forge voting results, airdrops, and more.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Sybiller/FSYBILLER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},
{
    class: 'Survivor',
    title: 'Validator',
    description: 'Ensures the integrity of the blockchain by validating transactions. Validators have abilities that focus on defense and support.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Validator/MVALIDATOR.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},
{
    class: 'Survivor',
    title: 'Validator',
    description: 'Ensures the integrity of the blockchain by validating transactions. Validators have abilities that focus on defense and support.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Validator/FVALIDATOR.jpg',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Industrial Miner',
    description: 'Volcano Powered, Focused on maximizing mining efficiency, Industrial Miners excel in dealing high damage over a short period',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Industrial Miner/MINDUSTRIAL.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},
{
    class: 'Survivor',
    title: 'Industrial Miner',
    description: 'Volcano Powered, Focused on maximizing mining efficiency, Industrial Miners excel in dealing high damage over a short period',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Industrial Miner/FINDUSTRIAL.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'High Frequency Trader',
    description: 'Specializes in Lightning Fast trades and quick movements, allowing for swift attacks and dodges.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/HFT/MHFT.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},
{
    class: 'Survivor',
    title: 'High Frequency Trader',
    description: 'Specializes in Lightning Fast trades and quick movements, allowing for swift attacks and dodges.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/HFT/FHFT.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Liquid Staker',
    description: 'Liquidity is king. Focused on being flezible and being ready for any kind of eventuality',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Liquid/MLIQUID.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Liquid Staker',
    description: 'For her Liquidity is king. Focused on being flexible and being ready for any kind of eventuality',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Liquid/FLIQUID.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Dormant Holder',
    description: 'Passively holds assets for extended periods, waiting for the right moment to re-engage.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.1,
    xp: 0,
    evasion: 20,
    tags: ['player'],
    thumbnail: 'Media/Classes/Dormant Holder/MDORMANT.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Dormant Holder',
    description: 'Passively holds assets for extended periods, waiting for the right moment to re-engage.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.1,
    xp: 0,
    evasion: 20,
    tags: ['player'],
    thumbnail: 'Media/Classes/Dormant Holder/FDORMANT.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},{
    class: 'Survivor',
    title: 'Solo Node Runner',
    description: 'Operates independently, running a node to support the network, resilient and resourceful.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.25,
    xp: 0,
    evasion: 40,
    tags: ['player'],
    thumbnail: 'Media/Classes/Solo Node Runner/MSOLONODERUNNER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Solo Node Runner',
    description: 'Operates independently, Maintains the networks infrastructure.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.25,
    xp: 0,
    evasion: 40,
    tags: ['player'],
    thumbnail: 'Media/Classes/Solo Node Runner/FSOLONODERUNNER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Governance Staker',
    description: 'Focuses on stability and long-term planning, providing buffs and enhancements over time.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Governance Staker/MGOV.jpg',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Governance Staker',
    description: 'Focuses on stability and long-term planning, providing buffs and enhancements over time.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Governance Staker/FGOV.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Yield Farmer',
    description: 'Experts at maximizing return by risking their capital, Yield Farmers excel at generating resources.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Farmer/MFARMER.png',  //Debt ADD PERSONALITY
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Yield Farmer',
    description: 'Experts at maximizing return by risking their capital, Yield Farmers excel at generating resources.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Farmer/FFARMER.png',  //Debt ADD PERSONALITY
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},
{
    class: 'Survivor',
    title: 'Venture Capital',
    description: 'Masters of funding and investment, venture capitalists provide powerful buffs and debuffs related to resource management.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Venture Capital/MVC.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Venture Capital',
    description: 'Masters of funding and investment, venture capitalists provide powerful buffs and debuffs related to resource management.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Venture Capital/FVC.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Decentralization Trillemma Solver',
    description: 'In the search to solve Balances security, scalability, and decentralization.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Trillemma Solver/MSOLVER.jpg',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Decentralization Trillemma Solver',
    description: 'In the search to solve Balances security, scalability, and decentralization.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Trillemma Solver/FSOLVER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Tether Truther',
    description: 'They hated him because he told the truth.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/TRUTHER/MTRUTHER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Tether Truther',
    description: 'They hated her because she told the truth.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/TRUTHER/FTRUTHER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false, 
    abilities: [

    ],
},{
    class: 'Survivor',
    title: 'Mercerany Capital',
    description: 'High control of the markets, quick to take profits, regardless of the effects his actions might take on others peoples life.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Mercenary Capital/MMERCENARY.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Mercerany Capital',
    description: 'High control of the markets, quick to take profits, regardless of the effects his actions might take on others peoples life.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Mercenary Capital/FMERCENARY.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Copy Trader',
    description: 'Excels at observing and analyzing the strategies of successful traders, seamlessly replicating their moves in real-time.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Copy Trader/MCOPYTRADER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Copy Trader',
    description: 'Excels at observing and analyzing the trading strategies of successful traders, seamlessly replicating their moves in real-time.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Copy Trader/FCOPYTRADER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Policy Maker',
    description: 'Focuses on creating and implementing laws and policies that impact the industry.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Policy Maker/MPOLICYMAKER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Policy Maker',
    description: 'Focuses on creating and implementing laws and policies that impact the industry.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Policy Maker/FPOLICYMAKER.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Angel Investor',
    description: 'Angel Investors provide the essential resources and stability needed to nurture fledgling projects from concept to reality.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Angel/MANGEL.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},{
    class: 'Survivor',
    title: 'Angel Investor',
    description: 'Angel Investors provide the essential resources and stability needed to nurture fledgling projects from concept to reality.',
    tooltip: '',    
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Angel/FANGEL.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level:0,
    isLocked: false,
    abilities: [
  
    ],
},
{
    class: 'Survivor',
    title: 'Holder',
    description: 'Masters of holding assets, they ride the waves of volatility with unshakeable resolve.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.15,
    xp: 0,
    evasion: 30,
    tags: ['player'],
    thumbnail: 'Media/Classes/Holder/MHOLDER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Holder',
    description: 'Dedicated to holding their assets for long-term gain. HODLers have high resilience and can endure prolonged battles.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.15,
    xp: 0,
    evasion: 30,
    tags: ['player'],
    thumbnail: 'Media/Classes/Holder/FHOLDER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'C.E.X. C.E.O.',
    description: 'Leader of a centralized exchange, skilled in navigating regulatory landscapes and market strategies.',
    tooltip: '',    
    health: 3,
    movementspeed: 0.1,
    xp: 0,
    evasion: 20,
    tags: ['player'],
    thumbnail: 'Media/Classes/CEX/MCEX.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'C.E.X. C.E.O.',
    description: 'Leader of a centralized exchange, skilled in navigating regulatory landscapes and market strategies.',
    tooltip: '',    
    health: 3,
    movementspeed: 0.1,
    xp: 0,
    evasion: 20,
    tags: ['player'],
    thumbnail: 'Media/Classes/CEX/FCEX.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'USD Maxi',
    description: 'Dedicated to stablecoins, prioritizes security and stability over volatility.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.15,
    xp: 0,
    evasion: 35,
    tags: ['player'],
    thumbnail: 'Media/Classes/USD Maxi/MUSDMAXI.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'USD Maxi',
    description: 'Dedicated to stablecoins, prioritizes security and stability over volatility.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.15,
    xp: 0,
    evasion: 35,
    tags: ['player'],
    thumbnail: 'Media/Classes/USD Maxi/FUSDMAXI.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Market Maker',
    description: 'Provides liquidity and stabilizes markets, skilled in trading and risk management.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.2,
    xp: 0,
    evasion: 40,
    tags: ['player'],
    thumbnail: 'Media/Classes/Market Maker/MMARKETMAKER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Market Maker',
    description: 'Provides liquidity and stabilizes markets, skilled in trading and risk management.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.2,
    xp: 0,
    evasion: 40,
    tags: ['player'],
    thumbnail: 'Media/Classes/Market Maker/FMARKETMAKER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Wallet Maker',
    description: 'Expert in creating secure and user-friendly digital wallets, critical to ecosystem growth.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Wallet Maker/MWALLETMAKER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Wallet Maker',
    description: 'Expert in creating secure and user-friendly digital wallets, critical to ecosystem growth.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Wallet Maker/FWALLETMAKER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Oracle',
    description: 'Bridges blockchain with real-world data, essential for smart contract execution.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 45,
    tags: ['player'],
    thumbnail: 'Media/Classes/Oracle/MORACLE.jpg', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Oracle',
    description: 'Bridges blockchain with real-world data, essential for smart contract execution.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 45,
    tags: ['player'],
    thumbnail: 'Media/Classes/Oracle/FORACLE.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Whale',
    description: 'Holds significant assets, able to influence markets and project outcomes with their moves.',
    tooltip: '',    
    health: 3,
    movementspeed: 0.1,
    xp: 0,
    evasion: 20,
    tags: ['player'],
    thumbnail: 'Media/Classes/Whale/MWHALE.png', 
    geometry: new THREE

.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Whale',
    description: 'Holds significant assets, able to influence markets and project outcomes with their moves.',
    tooltip: '',    
    health: 3,
    movementspeed: 0.1,
    xp: 0,
    evasion: 20,
    tags: ['player'],
    thumbnail: 'Media/Classes/Whale/FWHALE.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Shrimp',
    description: 'Small player in the crypto space, agile and adaptable, but vulnerable to market swings.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.25,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Shrimp/MSHRIMP.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Shrimp',
    description: 'Small player in the crypto space, agile and adaptable, but vulnerable to market swings.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.25,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Shrimp/FSHRIMP.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'LARP',
    description: 'Masters of deception, creating narratives that may or may not be true, thrives on attention.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 45,
    tags: ['player'],
    thumbnail: 'Media/Classes/LARP/MLARP.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'LARP',
    description: 'Masters of deception, creating narratives that may or may not be true, thrives on attention.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 45,
    tags: ['player'],
    thumbnail: 'Media/Classes/LARP/FLARP.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Grifter',
    description: 'Masters of manipulation and persuasion, skilled in exploiting others for personal gain.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.25,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Grifter/MGRIFTER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Grifter',
    description: 'Masters of manipulation and persuasion, skilled in exploiting others for personal gain.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.25,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Grifter/FGRIFTER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'NFT Artist',
    description: 'The imaginative and artistic minds behind the digital art and collectibles on the blockchain',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 40,
    tags: ['player'],
    thumbnail: 'Media/Classes/NFT Artist/MNFTARTIST.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'NFT Artist',
    description: 'Enthusiasts creator of digital collectibles, focused on art, utility, and ownership within the blockchain.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 40,
    tags: ['player'],
    thumbnail: 'Media/Classes/NFT Artist/FNFTARTIST.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'NFT Collector',
    description: 'Seeks out unique digital art pieces, driven by aesthetics and potential future value.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 35,
    tags: ['player'],
    thumbnail: 'Media/Classes/Art Collector/MNFTCOLLECTOR.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'NFT Collector',
    description: 'Seeks out unique digital art pieces, driven by aesthetics and potential future value.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 35,
    tags: ['player'],
    thumbnail: 'Media/Classes/NFT Collector/FNFTCOLLECTOR.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'CTO Leader',
    description: 'Technical mastermind, leads projects and innovations, critical to tech development in the space.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.15,
    xp: 0,
    evasion: 35,
    tags: ['player'],
    thumbnail: 'Media/Classes/CTO Leader/MCTOLEADER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'CTO Leader',
    description: 'Technical mastermind, leads projects and innovations, critical to tech development in the space.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.15,
    xp: 0,
    evasion: 35,
    tags: ['player'],
    thumbnail: 'Media/Classes/CTO Leader/FCTOLEADER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Serial Scammer',
    description: 'Repeatedly creates fraudulent schemes, skilled at evading consequences and exploiting others.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.3,
    xp: 0,
    evasion: 60,
    tags: ['player'],
    thumbnail: 'Media/Classes/Serial Scammer/MSERIALSCAMMER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Serial Scammer',
    description: 'Repeatedly creates fraudulent schemes, skilled at evading consequences and exploiting others.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.3,
    xp: 0,
    evasion: 60,
    tags: ['player'],
    thumbnail: 'Media/Classes/Serial Scammer/FSERIALSCAMMER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},{
    class: 'Survivor',
    title: 'Bagholder',
    description: 'Caught holding assets after a market downturn, enduring the lows in hopes of a recovery.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.3,
    xp: 0,
    evasion: 60,
    tags: ['player'],
    thumbnail: 'Media/Classes/Bagholder/MBAGHOLDER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},{
    class: 'Survivor',
    title: 'Bagholder',
    description: 'Caught holding assets after a market downturn, enduring the lows in hopes of a recovery.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.3,
    xp: 0,
    evasion: 60,
    tags: ['player'],
    thumbnail: 'Media/Classes/Bagholder/FBAGHOLDER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},{
    class: 'Survivor',
    title: 'Pioneer',
    description: 'Trailblazer in the crypto world, exploring new frontiers and setting trends.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 40,
    tags: ['player'],
    thumbnail: 'Media/Classes/Pioneer/MPIONEER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Pioneer',
    description: 'Trailblazer in the crypto world, exploring new frontiers and setting trends.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.2,
    xp: 0,
    evasion: 40,
    tags: ['player'],
    thumbnail: 'Media/Classes/Pioneer/FPIONEER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Defi Native',
    description: 'Deeply rooted in decentralized finance, adept at navigating complex protocols and strategies.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.2,
    xp: 0,
    evasion: 35,
    tags: ['player'],
    thumbnail: 'Media/Classes/Defi Native/MDEFINATIVE.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Defi Native',
    description: 'Deeply rooted in decentralized finance, adept at navigating complex protocols and strategies.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.2,
    xp: 0,
    evasion: 35,
    tags: ['player'],
    thumbnail: 'Media/Classes/Defi Native/FDEFINATIVE.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Metaverse Landowner',
    description: 'Owns digital land in the metaverse, shaping virtual landscapes and communities.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.15,
    xp: 0,
    evasion: 30,
    tags: ['player'],
    thumbnail: 'Media/Classes/Metaverse Landowner/MMETAVERSELANDOWNER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Metaverse Landowner',
    description: 'Owns digital land in the metaverse, shaping virtual landscapes and communities.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.15,
    xp: 0,
    evasion: 30,
    tags: ['player'],
    thumbnail: 'Media/Classes/Metaverse Landowner/FMETAVERSELANDOWNER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Real Landowner',
    description: 'Holds significant real estate, leveraging tangible assets within and outside the digital space.',
    tooltip: '',    
    health: 3,
    movementspeed: 0.1,
    xp: 0,
    evasion: 25,
    tags: ['player'],
    thumbnail: 'Media/Classes/Real Landowner/MREALLANDOWNER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Real Landowner',
    description: 'Holds significant real estate, leveraging tangible assets within and outside the digital space.',
    tooltip: '',    
    health: 3,
    movementspeed: 0.1,
    xp: 0,
    evasion: 25,
    tags: ['player'],
    thumbnail: 'Media/Classes/Real Landowner/FREALLANDOWNER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Evil Genius',
    description: 'Possesses unmatched intellect and ruthlessness, capable of devising complex and malicious plans.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.15,
    xp: 0,
    evasion: 45,
    tags: ['player'],
    thumbnail: 'Media/Classes/Evil Genius/MEVILGENIUS.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Evil Genius',
    description: 'Possesses unmatched intellect and ruthlessness, capable of devising complex and malicious plans.',
    tooltip: '',    
    health: 2,
    movementspeed: 0.15,
    xp: 0,
    evasion: 45,
    tags: ['player'],
    thumbnail: 'Media/Classes/Evil Genius/FEVILGENIUS.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Ponzi Designer',
    description: 'Expert at crafting deceptive schemes, enticing others with false promises of high returns.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.25,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Ponzi Designer/MPONZIDESIGNER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Ponzi Designer',
    description: 'Expert at crafting deceptive schemes, enticing others with false promises of high returns.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.25,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Ponzi Designer/FPONZIDESIGNER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Ponzi Promoter',
    description: 'Spreads the word about fraudulent schemes, luring others into the trap with charisma and false hope.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.3,
    xp: 0,
    evasion: 55,
    tags: ['player'],
    thumbnail: 'Media/Classes/Ponzi Promoter/MPONZIPROMOTER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Ponzi Promoter',
    description: 'Spreads the word about fraudulent schemes, luring others into the trap with charisma and false hope.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.3,
    xp: 0,
    evasion: 55,
    tags: ['player'],
    thumbnail: 'Media/Classes/Ponzi Promoter/FPONZIPROMOTER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Backstabber',
    description: 'Untrustworthy and opportunistic, willing to betray allies for personal gain.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.25,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Backstabber/MBACKSTABBER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Backstabber',
    description: 'Untrustworthy and opportunistic, willing to betray allies for personal gain.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.25,
    xp: 0,
    evasion: 50,
    tags: ['player'],
    thumbnail: 'Media/Classes/Backstabber/FBACKSTABBER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Trencher Soldier',
    description: 'Hardened and resilient, thrives in harsh environments, committed to long-term survival.',
   

 tooltip: '',    
    health: 3,
    movementspeed: 0.1,
    xp: 0,
    evasion: 20,
    tags: ['player'],
    thumbnail: 'Media/Classes/Trencher Soldier/MTRENCHERSOLDIER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Trencher Soldier',
    description: 'Hardened and resilient, thrives in harsh environments, committed to long-term survival.',
    tooltip: '',    
    health: 3,
    movementspeed: 0.1,
    xp: 0,
    evasion: 20,
    tags: ['player'],
    thumbnail: 'Media/Classes/Trencher Soldier/FTRENCHERSOLDIER.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Beggar',
    description: 'Desperate and resourceful, survives by any means necessary, often relying on the charity of others.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.1,
    xp: 0,
    evasion: 30,
    tags: ['player'],
    thumbnail: 'Media/Classes/Beggar/MBEGGAR.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
},
{
    class: 'Survivor',
    title: 'Beggar',
    description: 'Desperate and resourceful, survives by any means necessary, often relying on the charity of others.',
    tooltip: '',    
    health: 1,
    movementspeed: 0.1,
    xp: 0,
    evasion: 30,
    tags: ['player'],
    thumbnail: 'Media/Classes/Beggar/FBEGGAR.png', 
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    level: 0,
    isLocked: false,
    abilities: [],
}
];
/*---------------------------------------------------------------------------
                              Enemies Blueprints
---------------------------------------------------------------------------*/

const enemyTypes = [{
    class: 'Enemy',
    title: 'Basic',
    health: 1,
    movementspeed:0.2,
    xp: 0,
    evasion: 0,
    tags: ['enemy'],
    thumbnail: 0,
    geometry: new THREE.BoxGeometry(1, 2, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    abilities: [

    ],
    level:0,
}
];

/*---------------------------------------------------------------------------
                              Worlds Blueprints
---------------------------------------------------------------------------*/
const worldTypes = [{
    class: 'World',
    title: 'Ethereumverse',
    description:'An open futuristic, digital landscape where data flows freely. Forever. 12 seconds at a time thought. ',
    tooltip:'0.04 💀',
    tags: ['world'],
    thumbnail: 'Media/Worlds/ETHEREUMVERSE.png',
    level:0,
    setup: function(scene, camera, renderer) {

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.directionalLight.position.set(-30, -30, -30);
        this.directionalLight.castShadow = true;
        scene.add(this.directionalLight)

        this.renderScene = new THREE.RenderPass(scene, camera);
        this.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2, 1, 0.01);  //2,1,0.1
        composer.addPass(this.renderScene);
        composer.addPass(this.bloomPass);

        this.floorGeometry = new THREE.PlaneGeometry(1, 1);
        this.floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        this.floor = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -0.5;
        this.floor.receiveShadow = true;
        scene.add(this.floor);
        
        this.floor.onBeforeRender = (renderer, scene, camera) => {
            const distance = 1000;
            const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
            const floorPosition = camera.position.clone().add(cameraDirection.multiplyScalar(distance));
            this.floor.position.set(floorPosition.x, this.floor.position.y, floorPosition.z);
        };
        
        camera.position.set(0, 15, 15);
    
        this.octahedronGeometry = new THREE.OctahedronGeometry(1);
        this.octahedronGeometry.scale(5, 7, 5); 
        
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();
        
        this.envTexture = new THREE.TextureLoader().load('Media/ENVTEXTURE.png', texture => {
            this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
            this.pmremGenerator.dispose();
            scene.environment = this.envMap; 
        });
        
        this.diamondMaterial = new THREE.MeshPhysicalMaterial({
            envMap: null, 
            reflectivity: 0.9,
            roughness: 0,
            metalness: 1,
            clearcoat: 0.13,
            clearcoatRoughness: 0.1,
            transmission: 0.82,
            ior: 2.75, 
            thickness: 10,
            sheen: 1,
            color: new THREE.Color('white')
        });
        
    this.octahedronMesh = new THREE.Mesh(this.octahedronGeometry, this.diamondMaterial);
    scene.add(this.octahedronMesh);   
    this.octahedronMesh2 = new THREE.Mesh(this.octahedronGeometry, this.diamondMaterial);
    scene.add(this.octahedronMesh2);
        

    camera.lookAt(this.octahedronMesh2.position);
    },
    update: function(scene, camera, renderer) {
        if(isMainMenu){
            this.octahedronMesh.rotation.x -= 0.005;
            this.octahedronMesh2.rotation.x += 0.005;
        }else{
            this.octahedronMesh.rotation.y += 0.005;
        }
    },
    resumeGame: function(){
        scene.remove(world.octahedronMesh2);
        this.octahedronMesh.rotation.x = 0;
    },
    cleanUp: function(scene) {
        scene.remove(this.ambientLight);
        scene.remove(this.directionalLight);
        
        this.ambientLight.dispose && this.ambientLight.dispose();
        this.directionalLight.dispose && this.directionalLight.dispose();
        
        this.composer && this.composer.passes.forEach(pass => pass.dispose && pass.dispose());
        this.composer = null;
    }
}, {
    class: 'World',
    title: 'Digital Goldland',
    description:'Endless wealth and opportunity. Everything gleams in Virtual gold, fortunes here are made and lost in the blink of an eye.',
    tooltip:'15.000 U S D O L L A R S 💀',
    tags: ['world'], 
    thumbnail: 'Media/Worlds/GOLDLAND.jpg',
    level:0,
    isLocked: true,
}
];
/*---------------------------------------------------------------------------
                              Scene Initialization
---------------------------------------------------------------------------*/
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const canvas = document.getElementById('survivorCanvas');
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setPixelRatio(window.devicePixelRatio || 1);
const dpr = window.devicePixelRatio || 1;
const rect = canvas.getBoundingClientRect();

const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    encoding: THREE.sRGBEncoding,
});
const composer = new THREE.EffectComposer(renderer,renderTarget);

//Technical debt: Make the UI Elements, divs and containers responsive. 
function updateRendererSize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderTarget.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

updateRendererSize();

/*---------------------------------------------------------------------------
                              World Controller
---------------------------------------------------------------------------*/

world = worldTypes[0];

world.setup(scene,camera,renderer);

/*---------------------------------------------------------------------------
                              Player Controller
---------------------------------------------------------------------------*/
player = new Entity(playerTypes.find(type => type.title === 'Onchain Survivor'));

initiateJoystick();

ability = abilityTypes[0] ;

function updatePlayerMovement() {
    if(!canMove) return;
    let direction = new THREE.Vector3();

    if (keys.s) direction.z -= player.movementspeed;
    if (keys.w) direction.z += player.movementspeed;
    if (keys.a) direction.x += player.movementspeed;
    if (keys.d) direction.x -= player.movementspeed;

    if (direction.length() > 0) {
        isPaused = false;
        direction.normalize();
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();
        const moveDirection = direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(cameraDirection.x, cameraDirection.z));
        player.position.add(moveDirection.multiplyScalar(player.movementspeed));
        const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
        player.rotation.y += (targetRotation - player.rotation.y) * 0.1;
        player.boundingBox.setFromObject(player.mesh);
    }

    const cameraX = player.position.x + cameraRadius * Math.cos(cameraAngle);
    const cameraZ = player.position.z + cameraRadius * Math.sin(cameraAngle);
    camera.position.set(cameraX, cameraHeight, cameraZ);
    camera.lookAt(player.position);

    player.updateAbilities();

    xpSpheres.forEach((xpSphere, index) => {
        if (player.boundingBox.intersectsBox(xpSphere.boundingBox)) {
            player.xp += 10;
            xpLoadingBar.style.width = ((player.xp / player.xpToNextLevel) * 100) + '%';
            if (player.xp >= player.xpToNextLevel) {
                LevelUp();
            }
            scene.remove(xpSphere);
            xpSpheres.splice(index, 1);
        }
    });
}

function LevelUp() {
    canMove = false;
    isPaused = true;
    hideContainerUI(topUI);
    hideContainerUI(botUI); 
    player.xp = 0;  

    const upgradableAbilities = player.getUpgradableAbilities();


    if (upgradableAbilities.length === 0) {
        canMove = true;
        isPaused = false;
        return;
    }

    //Make level up more difficult according to the number of skilss in the player  
    player.xpToNextLevel  =  player.xpToNextLevel + player.xpToNextLevel ;

    const upgradeOptions = [];
    for (let i = 0; i < 2 && upgradableAbilities.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * upgradableAbilities.length);
        const abilityToUpgrade = { ...upgradableAbilities[randomIndex] };
        abilityToUpgrade.isLocked = false; 
        upgradeOptions.push(abilityToUpgrade);
        upgradableAbilities.splice(randomIndex, 1);
    }
    createChooseMenu(upgradeOptions, "Choose:", "Upgrade");
}
    
 
/*---------------------------------------------------------------------------
                              Enemies Controller
---------------------------------------------------------------------------*/

const enemies = [];

function updateEnemies() {
    enemies.forEach(enemy => {
        const direction = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
        enemy.position.add(direction.multiplyScalar(enemy.movementspeed/2));
        enemy.boundingBox.setFromObject(enemy.mesh);
        enemy.updateAbilities();
    });
}

function startSpawningEnemies(player, spawnInterval = 1000, spawnRadius = 50, numberOfEnemies = 5) {
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

            const enemyConfig = enemyTypes.find(type => type.class === 'Enemy'); 
            const enemy = new Entity(enemyConfig);

            enemy.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);

            scene.add(enemy);
            enemies.push(enemy);
        }
    };
    setInterval(spawnEnemy, spawnInterval);
}
startSpawningEnemies(player);

/*---------------------------------------------------------------------------
                                UI UTILITIES 
---------------------------------------------------------------------------*/

    const rainbowText = (element, fontSize) => {
        element.style.fontSize = fontSize;
        element.classList.add('rainbow-text'); 
    };

    function createTitleElement(text, title, fontSize) {
        const element = document.createElement('div');
        element.innerText = text;
        element.title = title;
        rainbowText(element, fontSize);
        return element;
    }

    function createContainer(classNames = [], styles = {}) {
        const container = document.createElement('div');
        classNames.forEach(className => container.classList.add(className));
        Object.assign(container.style, styles);
        document.body.appendChild(container);
        return container;
    }

    function attachHoverEffect(button, entity) {
        button.addEventListener('pointerenter', () => {
            
            centerUI.innerHTML='';
            centerUI = createContainer(['center-container', 'fade-in']);
            const scaledButton = createButton(entity, 1);
            scaledButton.style.position = 'fixed';
            scaledButton.style.top = '-100%';
            scaledButton.style.left = '50%';
            scaledButton.style.transform = 'translate(-50%, -50%)';
            scaledButton.style.zIndex = '2000';
            scaledButton.style.pointerEvents = 'none'; 
            centerUI.appendChild(scaledButton);
          
            const removeScaledButton = () => {
                console.log('Mouse left:', entity.title);
                if (scaledButton) {
                    centerUI.removeChild(scaledButton);
                }
            };

            setTimeout(() => { centerUI.classList.add('show'); }, 10);
    
            button.addEventListener('pointerleave', removeScaledButton, { once: true });
        });
    }

    function createButton(dataType, scale = 1, onClick) {
        const button = document.createElement('button');
        button.style.width = `${200 * scale}px`;
        button.style.margin = '3px';
        button.style.display = 'flex';
        button.style.flexDirection = 'column';
        button.style.alignItems = 'center';
        button.style.backgroundColor = 'black';
        button.style.overflow = 'hidden';
        button.style.padding = '0';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'Arial, sans-serif';
        button.style.border = '.1px solid';
        button.style.borderImageSlice = 1;
        button.style.borderImageSource = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';

        // button.style.animation = 'rainbowBorder 5s linear infinite';

        button.title = dataType.tooltip;
    
        const title = document.createElement('div');
        title.innerText = dataType.title;
        rainbowText(title, `${20 * scale}px`);  
        title.style.height = `${2.5 * scale}em`; 
        title.style.lineHeight = `${1.5 * scale}em`;
        title.style.overflow = 'hidden';
        title.style.textAlign = 'center'; 
        title.style.display = scale > 0.751 ? 'flex' : 'none';  
        title.style.alignItems = 'center';
        title.style.justifyContent = 'center';
        title.style.padding = `${5 * scale}px 0`;

        const img = document.createElement('img');
        img.src = dataType.thumbnail;
        img.style.width = `${150 * scale}px`;
        img.style.height = `${150 * scale}px`;
        
        //img.style.filter = 'brightness(200%)'; 

        const titlelvl = document.createElement('div');
        titlelvl.innerText = 'LVL : 0'; 
        rainbowText(titlelvl, `${20 * scale}px`);  
        titlelvl.style.height = `${2.5 * scale}em`; 
        titlelvl.style.lineHeight = `${1.5 * scale}em`;
        titlelvl.style.overflow = 'hidden';
        titlelvl.style.textAlign = 'center'; 
        titlelvl.style.display = scale < 0.751 ? 'flex' : 'none';
        titlelvl.style.alignItems = 'center';
        titlelvl.style.justifyContent = 'center';
        titlelvl.style.padding = `${5 * scale}px 0`;

        const levelStars = document.createElement('div');
        levelStars.style.display = scale < 0.751 ? 'flex' : 'none';
        levelStars.style.alignItems = 'center'; 
        levelStars.style.justifyContent = 'center';
        for (let i = 0; i < dataType.level; i++) {
            const star = document.createElement('img');
            star.src = 'Media/Abilities/STAR.png';
            star.style.width = `${20 * scale}px`;
            star.style.height = `${20 * scale}px`;
            levelStars.appendChild(star);
        }
    
        expl = dataType.description;
        if (dataType.level != 0) expl = dataType.effectinfo;
    
        const effectinfo = document.createElement('div');
        effectinfo.innerText = `${expl}`;
        rainbowText(effectinfo, `${14.5 * scale}px`); 
        effectinfo.style.height = `${5 * scale}em`; 
        effectinfo.style.lineHeight = `${1 * scale}em`; 
        effectinfo.style.overflow = 'hidden'; 
        effectinfo.style.textAlign = 'center';
        effectinfo.style.alignItems = 'center'; 
        effectinfo.style.justifyContent = 'center';
        effectinfo.style.padding = `${5 * scale}px`;
        effectinfo.style.display = scale > 0.751 ? 'flex' : 'none'; 
    
        button.appendChild(title);
        button.appendChild(img);
        button.appendChild(effectinfo);
        button.appendChild(levelStars); 
        

        if (onClick) button.onclick = onClick;

        //  if(scale== 0.55)
        //attachHoverEffect(button, dataType); 

        //img.style.filter = 'grayscale(100%) blur(5px)';
        if(dataType.isLocked){
        button.style.color = 'gray';
        button.style.borderImageSource = 'linear-gradient(45deg, gray, gray)';
        button.style.cursor = 'not-allowed';
        button.style.opacity = '0.5';
        title.innerText="???"
        title.style.color = 'gray';
        titlelvl.style.color = 'gray';
        effectinfo.style.color = 'gray';
        effectinfo.innerText="?????????????"
        button.style.animation = 'none';
        levelStars.style.filter = 'grayscale(100%)';
        img.style.filter = 'grayscale(100%) blur(5px)';
        }

        return button;
    }

    function addContainerUI(container,location,uiElements){

        container.innerHTML='';
        container.className = ''; // Remove any existing classes
        container.classList.add(location, 'fade-in');
      
        uiElements.forEach(element => {
            container.appendChild(element);
        });

        setTimeout(() => {container.classList.add('show'); }, 10);
    }    

    function hideContainerUI(container){
        container.classList.add('fade-out'); 
        setTimeout(() => { container.classList.add('hide'); }, 10);
    }

    let topUI = createContainer(['top-container', 'fade-in']);
        
    let centerUI = createContainer(['center-container', 'fade-in']);

    let botUI = createContainer(['bottom-container', 'fade-in']);

/*---------------------------------------------------------------------------
                                GAME TITLE 
---------------------------------------------------------------------------*/

    function createGameTitle(){
        const mainTitle = createTitleElement('🏆⚔️🔗\nOnchain Survivor', 'laziest Logo ive ever seen, isnt the dev just using ai for everything and this is the best he could come up with? 💀', isMobile ? '10vw' : '6vw');
        mainTitle.onclick = function() { window.open('https://x.com/OnChainSurvivor', '_blank'); };
        const subTitle = createTitleElement('Can you survive? Move to start', 'lazy subtitle too btw', isMobile ? '4vw' : '2vw');
        addContainerUI(topUI,'top-container', [mainTitle,subTitle]);
    };

    createGameTitle();

/*---------------------------------------------------------------------------
                                MAIN MENU
---------------------------------------------------------------------------*/

    function createGameMenu(){
        classContainer = document.createElement('div');
        const classSubTitle = createTitleElement('🏆 Class 🏆', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
        classContainer.appendChild(createButton(player, isMobile ? 0.6 : 0.75));
        classContainer.appendChild(classSubTitle);

        classAbilityContainer = document.createElement('div');
        const abilitiesSubTitle = createTitleElement( '⚔️ Ability ⚔️', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
        ability.isLocked=false;
        classAbilityContainer.appendChild(createButton(ability,isMobile ? 0.6 : 0.75));
        classAbilityContainer.appendChild(abilitiesSubTitle);

        worldContainer = document.createElement('div');
        const worldSubTitle = createTitleElement('🔗 World 🔗', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
        worldContainer.appendChild(createButton(world, isMobile ? 0.6 : 0.75));
        worldContainer.appendChild(worldSubTitle);
        
        const menuButtonsContainer = createContainer([], { display: 'flex' });
        menuButtonsContainer.appendChild(classContainer);
        menuButtonsContainer.appendChild(classAbilityContainer);
        menuButtonsContainer.appendChild(worldContainer);
        addContainerUI(botUI,'bottom-container', [menuButtonsContainer]);

        menuButtonsContainer.childNodes.forEach(button => {
            button.addEventListener('click', () => {
                canMove=false;
                if (button === classContainer) {
                    createChooseMenu(playerTypes, "Choose your Survivor 🏆 NFT!","Survivor");
                } else if (button === classAbilityContainer) {
                    createChooseMenu(abilityTypes, "Choose your Ability ⚔️ NFT!","Ability");
                } else if (button === worldContainer) {
                    createChooseMenu(worldTypes, "Choose your Chain 🔗 NFT! ","World");
                }
                hideContainerUI(botUI);
            });
        });
    };
    createGameMenu()

/*---------------------------------------------------------------------------
                        Generic Choose NFT Menu
---------------------------------------------------------------------------*/
function createChooseMenu(entityList, text, type) {
    const popUpContainer = createPopUpContainer();
    const titleContainer = createTitleContainer(text);
    const gridContainer = createGridContainer();

    entityList.forEach(entity => {
        const itemButton = createButton(entity, 1);
        gridContainer.appendChild(itemButton);

        itemButton.onclick = () => handleEntitySelection(entity, type);

        if (type === "Survivor") {
           const abilitiesOfClassContainer = createAbilitiesContainer(entity);
           // DEBT gridContainer.appendChild(abilitiesOfClassContainer);
        }
    });

    popUpContainer.appendChild(titleContainer);
    popUpContainer.appendChild(gridContainer);
    addContainerUI(centerUI, 'center-container', [popUpContainer]);
}

function createPopUpContainer() {
    const container = createContainer([]);
    Object.assign(container.style, {
        position: 'fixed',
        zIndex: '1001',
        backgroundColor: 'black',
        height: `${window.innerHeight * 0.99}px`,
        width: `${window.innerWidth * 0.99}px`,
        transform: 'translate(0%, -50%)',
        border: '.5px solid',
        borderImageSource: 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)',
        borderImageSlice: 1,
        boxSizing: 'border-box',
        overflowY: 'auto',
        animation: 'rainbow-border 5s linear infinite',
    });
    return container;
}

function createTitleContainer(text) {
    const container = document.createElement('div');
    Object.assign(container.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexDirection: 'column',
    });
    const title = createTitleElement(text, '', isMobile ? '10vw' : '6vw');
    container.appendChild(title);
    return container;
}
let isWide = window.innerWidth > 830;
console.log(window.innerWidth)
function createGridContainer() {
    const container = document.createElement('div');
    Object.assign(container.style, {
        display: 'grid',
        justifyContent: 'center',
        margin: '0 auto',
        gridTemplateColumns: isWide ? 'repeat(4, auto)' : 'repeat(2, auto)',
    });
    return container;
}

function handleEntitySelection(entity, type) {
    if (type === "Upgrade") {
        entity.isLocked = false;
        const existingAbility = player.abilities.find(a => a.title === entity.title);
        if (existingAbility) {
            existingAbility.deactivate();
            existingAbility.level += 1;
            existingAbility.activate();
        } else {
            const newAbility = new Ability(player, { ...entity, level: 1 });
            player.addAbility(newAbility);
            newAbility.activate();
        }
        refreshDisplay();
    } else if (entity.isLocked) {
        return;
    } else if (type === "Survivor") {
        player.deactivateAbilities();
        scene.remove(player);
        player = new Entity(playerTypes.find(t => t === entity));
        createGameMenu();
    } else if (type === "Ability") {
        ability = entity;
        createGameMenu();
    } else if (type === "World") {
        world = entity;
        createGameMenu();
    }
    canMove = true;
    hideContainerUI(centerUI);
}

function createAbilitiesContainer(entity) {
    const container = document.createElement('div');
    Object.assign(container.style, {
        display: 'grid',
        justifyContent: 'center',
        margin: '0 auto',
        gridTemplateColumns: 'repeat(2, auto)',
    });

    entity.abilities.forEach(survivorAbility => {
        const existingAbility = abilityTypes.find(abilityType => abilityType.title === survivorAbility.type);
        if (existingAbility) {
            const abilityButton = createButton(existingAbility, 0.33);
            container.appendChild(abilityButton);
        }
    });
    return container;
}

/*---------------------------------------------------------------------------
                                    WEB3 Menu
---------------------------------------------------------------------------*/
   //debt: havent touched it at all
    const web3Container = createContainer(['fade-in', 'top-container'], { left: '95%' });

    const metaMaskImage = document.createElement('img');
    metaMaskImage.src = 'Media/MetamaskLogo.png';
    metaMaskImage.style.width = '30px';
    metaMaskImage.style.height = '30px';

    const metaMaskButton = document.createElement('button');
    metaMaskButton.innerText = '';
    metaMaskButton.style.fontSize = '14px';
    metaMaskButton.style.padding = '3px 3px';
    metaMaskButton.style.backgroundColor = 'transparent';
    metaMaskButton.style.color = 'white';
    metaMaskButton.style.border = '1px solid white';
    metaMaskButton.style.borderRadius = '5px';
    metaMaskButton.title = 'wen update';
    metaMaskButton.appendChild(metaMaskImage);
 
    const loadingContainer = document.createElement('div');
    loadingContainer.id = 'loadingContainer';
    loadingContainer.style.position = 'relative';
    loadingContainer.style.width = '100%'; 
    loadingContainer.style.height = '10px';
    loadingContainer.style.backgroundColor = 'black';
    loadingContainer.style.boxSizing = 'border-box';
    loadingContainer.style.border = '0.5px solid'; 
    loadingContainer.style.borderImageSlice = 1;
    loadingContainer.style.borderImageSource = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';

    const loadingBar = document.createElement('div');
    loadingBar.id = 'loadingBar';
    loadingBar.style.width = '0';
    loadingBar.style.height = '100%';
    loadingBar.style.background = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';
    loadingBar.style.backgroundSize = '400% 400%';
    loadingBar.style.animation = 'rainbow 5s linear infinite';

    const loadingText = document.createElement('div');
    loadingText.id = 'loadingText';
    loadingText.style.color = 'white';
  
    loadingContainer.appendChild(loadingBar);
    web3Container.appendChild(metaMaskButton);

    function displayMetaMaskInfo(address, ethBalance) {
        web3Container.appendChild(loadingContainer);
        web3Container.appendChild(loadingText);
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

        window.addEventListener('load', async () => {
            const storedAddress = localStorage.getItem('metaMaskAddress');
            if (storedAddress) {
                const web3 = new Web3(window.ethereum);
                const balance = await web3.eth.getBalance(storedAddress);
                const ethBalance = web3.utils.fromWei(balance, 'ether');
                displayMetaMaskInfo(storedAddress, ethBalance);
            }
        });
        
        document.body.appendChild(web3Container);

    setTimeout(() => { web3Container.classList.add('show'); }, 10); 


function updateLoadingBar(currentAmount) {
    const loadingBar = document.getElementById('loadingBar');
    const loadingText = document.getElementById('loadingText');
    const goal = 1000000; 
    const percentage = (currentAmount / goal) * 100;
    loadingBar.style.width = percentage + '%';
    loadingText.innerText ='🏆\n'+percentage.toFixed(2) + '%';
}

function simulateLoading() {
    let currentAmount = 0;
    const increment = 10000; 
    const loadingInterval = setInterval(() => {
        if (currentAmount >= 1000000) {
          //TODO
        } else {
            currentAmount += increment;
            updateLoadingBar(currentAmount);
        }
    }, 50); 
}

//simulateLoading();

/*---------------------------------------------------------------------------
                                   IN-GAME UI 
---------------------------------------------------------------------------*/
//debt, this will change depending on the world  mostly the display time and game mode  
let countdown = 500 * 60;
const modeDisplay = createTitleElement('Practice Mode', 'who even keeps track of these', isMobile ? '5vw' : '3vw');
const timerDisplay = createTitleElement('', 'who even keeps track of these', isMobile ? '5vw' : '3vw');

function updateTimerDisplay() {
    countdown--;
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    timerDisplay.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}


function refreshDisplay() {
    let xpLoadingContainer = document.createElement('div');
    xpLoadingContainer.style.position = 'absolute';
    xpLoadingContainer.style.bottom = '-5px';
    xpLoadingContainer.style.left = '50%';
    xpLoadingContainer.style.transform = 'translateX(-50%)';
    xpLoadingContainer.style.width = '97%'; 
    xpLoadingContainer.style.height = '7px';
    xpLoadingContainer.style.backgroundColor = 'black';
    xpLoadingContainer.style.boxSizing = 'border-box';
    xpLoadingContainer.style.border = '0.1px solid'; 
    xpLoadingContainer.style.borderImageSlice = 1;
    xpLoadingContainer.style.borderImageSource = 'linear-gradient(45deg, red, orange, yellow, green, deepskyblue, blueviolet, violet)';

    xpLoadingBar = document.createElement('div');
    xpLoadingBar.style.width = '0';
    xpLoadingBar.style.height = '100%';
    xpLoadingBar.style.background = 'linear-gradient(45deg, red, orange, yellow, green, deepskyblue, blueviolet, violet)';
    xpLoadingBar.style.backgroundSize = '400% 400%';
    xpLoadingBar.style.animation = 'rainbow 5s linear infinite';
    xpLoadingContainer.appendChild(xpLoadingBar);

    const abilitiesContainer = createContainer([], { display: 'flex' });
    abilitiesContainer.appendChild(createButton(player, .35));
    player.abilities.filter(ability => ability.level > 0).forEach(ability => {
            const clonedAbility = { ...ability, isLocked: false }; 

            abilitiesContainer.appendChild(createButton(clonedAbility, 0.3));
        });

    addContainerUI(topUI,'top-container', [modeDisplay,timerDisplay]);
    addContainerUI(botUI,'bottom-container', [abilitiesContainer,xpLoadingContainer]);
}

/*---------------------------------------------------------------------------
                                 GAME OVER UI
---------------------------------------------------------------------------*/

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

/*---------------------------------------------------------------------------
                                    GAMESTATE CONTROLLER  
---------------------------------------------------------------------------*/

function resumeGame() {

    if (isPaused) {
        isPaused = false;
    }
    
    if(isMainMenu){ 
    world.resumeGame();
    isMainMenu = false;
    hideContainerUI(topUI);
    hideContainerUI(centerUI);
    hideContainerUI(botUI);
    setTimeout(() => { refreshDisplay() }, 1050);

        const existingAbility = player.abilities.find(playerAbility => playerAbility.title === ability.title);
        if (existingAbility) {
            existingAbility.deactivate();
            existingAbility.level += 1;
            existingAbility.activate();
        } else {
            const newAbility = new Ability(player, { ...ability, level: 1 });
            player.addAbility(newAbility);
            newAbility.activate();
        }
        player.possibleAbilities.set(ability.title, { ...ability, level: 1 });
    }
}

/*---------------------------------------------------------------------------
                            Main loop
---------------------------------------------------------------------------*/
function animate() {
    animationFrameId = requestAnimationFrame(animate);
    accumulatedTime += clock.getDelta();
    while (accumulatedTime >= fixedTimeStep) {
        if (!isPaused) {
            updatePlayerMovement();
            updateEnemies();
            updateTimerDisplay();
        } else if((canMove) && (keys.w ||keys.a || keys.s || keys.d)) resumeGame();
        accumulatedTime -= fixedTimeStep;
    }
    world.update();
    composer.render();
}

animate();

/*---------------------------------------------------------------------------
                            Service Worker for PWA
---------------------------------------------------------------------------*/

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
        console.log('Service Worker registered with scope:', registration.scope);
      }, function(error) {
        console.log('Service Worker registration failed:', error);
      });
    });
  }  

/*---------------------------------------------------------------------------
                            Event Listeners
---------------------------------------------------------------------------*/

document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = true;
    }
    
    // Map arrow keys to WASD behavior
    if (event.key === 'ArrowUp' || event.key === 'i') keys['w'] = true;
    if (event.key === 'ArrowLeft' || event.key === 'j') keys['a'] = true;
    if (event.key === 'ArrowDown' || event.key === 'k') keys['s'] = true;
    if (event.key === 'ArrowRight' || event.key === 'l') keys['d'] = true;
});
document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = false;
    }
    
    // Map arrow keys to WASD behavior
    if (event.key === 'ArrowUp' || event.key === 'i') keys['w'] = false;
    if (event.key === 'ArrowLeft' || event.key === 'j') keys['a'] = false;
    if (event.key === 'ArrowDown' || event.key === 'k') keys['s'] = false;
    if (event.key === 'ArrowRight' || event.key === 'l') keys['d'] = false;
});
document.addEventListener('mousedown', (e) => {
        if(!canMove) return;
        activateJoystick(e.clientX, e.clientY);
});
document.addEventListener('touchstart', (e) => {
        if(!canMove) return; 
        activateJoystick(e.touches[0].clientX, e.touches[0].clientY);
});
document.addEventListener('mousemove', (e) => {
        if (!joystickActive) return;
        if(!canMove) return;

        const joystickDeltaX = e.clientX - joystickStartX;
        const joystickDeltaY = e.clientY - joystickStartY;

        const maxDistance = joystickContainer.clientWidth / 2;
        const distance = Math.min(maxDistance, Math.sqrt(joystickDeltaX ** 2 + joystickDeltaY ** 2));
        const angle = Math.atan2(joystickDeltaY, joystickDeltaX);

        const x = distance * Math.cos(angle);
        const y = distance * Math.sin(angle);

        joystick.style.transform = `translate(${x - 50}%, ${y - 50}%)`;

        const normalizedX = x / maxDistance;
        const normalizedY = y / maxDistance;
        updateJoystickDirection(normalizedX, -normalizedY);
});
document.addEventListener('touchmove', (e) => {
        if (!joystickActive) return;

        const touch = e.touches[0];
        const joystickDeltaX = touch.clientX - joystickStartX;
        const joystickDeltaY = touch.clientY - joystickStartY;

        const maxDistance = joystickContainer.clientWidth / 2;
        const distance = Math.min(maxDistance, Math.sqrt(joystickDeltaX ** 2 + joystickDeltaY ** 2));
        const angle = Math.atan2(joystickDeltaY, joystickDeltaX);

        const x = distance * Math.cos(angle);
        const y = distance * Math.sin(angle);

        joystick.style.transform = `translate(${x - 50}%, ${y - 50}%)`;

        const normalizedX = x / maxDistance;
        const normalizedY = y / maxDistance;
        updateJoystickDirection(normalizedX, -normalizedY);
});
document.addEventListener('mouseup', deactivateJoystick);
document.addEventListener('touchend', deactivateJoystick);
window.addEventListener('resize', updateRendererSize);