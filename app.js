/*---------------------------------------------------------------------------
                              Classes
---------------------------------------------------------------------------*/
const loader = new THREE.FBXLoader();
const objectMap = new Map(); 
const objectPool = [];
const initialPoolSize = 200;

class Ability {
constructor(user, config) {
        Object.assign(this, { user, ...config });
    }
    activate() {
        this.effect(this.user);
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
        this.position.copy(position);
        this.abilities = [];

        const modelKey = 'SurvivorModel';

        if (objectMap.has(modelKey) && objectPool.length > 0) {
            this.initEntity(objectPool.pop());
        } else if (objectMap.has(modelKey)) {
            this.loadMoreObjects(modelKey, 50, () => this.initEntity(objectPool.pop()));
        } else {
            loader.load('Media/Models/Survivor.fbx', (object) => {
                const serializedObject = object.toJSON();
                objectMap.set(modelKey, serializedObject);
                this.loadMoreObjects(modelKey, initialPoolSize, () => this.initEntity(object));
            });
        }

        this.initAbilities(config.abilities);
    }

    loadMoreObjects(modelKey, count, callback) {
        for (let index = 0; index < count; index++) {
            const newObject = new THREE.ObjectLoader().parse(objectMap.get(modelKey));
            objectPool.push(newObject);
        }
        if (callback) callback();
    }

    returnToPool() {
        if (this.mesh) {
            this.mesh.mixer.stopAllAction();
            scene.remove(this); 
            objectPool.push(this.mesh);
        }
    }

    initEntity(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                child.material = world.playerMaterial;
            }
        });
        this.mesh = object;
        this.add(this.mesh);
        this.mesh.mixer = new THREE.AnimationMixer(this.mesh);
        this.playerRun = this.mesh.mixer.clipAction(object.animations[0]);
        this.playerRun.play();
        this.playerRun.setLoop(THREE.LoopRepeat);
        this.mesh.scale.set(3, 3, 3);
        this.updateMatrixWorld(true);
        this.mesh.updateMatrixWorld(true);
        this.boundingBox = new THREE.Box3().setFromObject(this.mesh);
        scene.add(this);
    }

    updateMesh() {
        if (this.mesh) {
            this.mesh.mixer.update(0.01);
            this.boundingBox.setFromObject(this.mesh);
        }
    }

    initAbilities(entityAbilities) {
        entityAbilities.forEach(entityAbility => {
            const ability = abilityTypes.find(type => type.title === entityAbility.title);
            this.addAbility(new Ability(this, { ...ability }));
        });
    }

    getUpgradableAbilities() {
        return abilityTypes.filter(ability => {
            const isActive = this.abilities.some(pa => pa.title === ability.title);
            return !isActive;
        });
    }

    addAbility(ability) {
        this.abilities.push(ability);
        ability.activate();
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
        if (this.inmuneCooldown) return;

        const evasionSuccess = Math.random() < (this.evasion / 100);
        if (evasionSuccess) {
            console.log("EVADED");
            this.evasionCooldown = true;
            setTimeout(() => this.evasionCooldown = false, 1000);
            return;
        }

        this.health -= amount;
        this.inmuneCooldown = true;
        setTimeout(() => this.inmuneCooldown = false, 500);

        if (this.health <= 0) this.die();
    }

    die() {
        this.returnToPool(); // Return the entity to the pool after death
        handleEntityDeath(this, enemies);
    }
}

/*---------------------------------------------------------------------------
                              Global Variables & Constants
---------------------------------------------------------------------------*/
let player;
let ability;
let world;
let time = 0,liquidations = 0, experience = 0, distance = 0, levels = 0,secrets = 0,bosses = 0;

let isPaused = true;
let isMainMenu = true;

let animationFrameId;
const clock = new THREE.Clock();
const fixedTimeStep = 1 / 60;
let accumulatedTime = 0;

let cameraAngle = 0;
let cameraRadius = 15;
let cameraHeight = 0;

let canMove = true;

let xpLoadingBar, hpBar;

const rainbowColors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
let colorIndex = 0;

const droppedItems = []; 
const lightObjects = [];
const itemGeometry = new THREE.SphereGeometry(0.35, 32, 32);

const enemies = [];
const playerPositionDifference = new THREE.Vector3();  
const enemydirection = new THREE.Vector3();    

const closeEnemy = new THREE.Vector3();    
const farEnemy = new THREE.Vector3();    
const centerEnemy = new THREE.Vector3();

import { keys, initiateJoystick } from './joystick.js';
initiateJoystick();
const uiContainers = [];
/*---------------------------------------------------------------------------
                              Utility Functions
---------------------------------------------------------------------------*/

const dropItem = (position) => {

    const expDropSuccess = Math.random() < (1 / 100);
    if (expDropSuccess) {
        const itemMaterial = world.material;
        const item = new THREE.Mesh(itemGeometry, itemMaterial);
        item.position.copy(position);
        item.position.y=1;
        item.boundingBox = new THREE.Box3().setFromObject(item);
        createParticleEffect(position, 'gold', 10);  
        scene.add(item);
        droppedItems.push(item);
        return;
    }

};

const handleEntityDeath = (entity, enemies) => {
    if (player.health <= 0){
        canMove= false;
        hideUI();
        setTimeout(() => { triggerGameOver("Liquidation notice",'Dear survivor, we regret to inform that your HP \n dropped to 0 and this run has been terminated.\n\n'); }, 1000);
    } 
    //secrets+= 1; when enemy drops a secret
    //bosses+= 1; when boss defeatec
    dropItem(entity.position);
    liquidations += 1;

    entity.deactivateAbilities();
    scene.remove(entity);

    const index = scene.children.indexOf(entity);
    if (index > -1) scene.children.splice(index, 1);

    const enemyIndex = enemies.indexOf(entity);
    if (enemyIndex > -1) enemies.splice(enemyIndex, 1);
};

function createParticleEffect(position, color = 'green', particleCount = 50) {
    const particleGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(particleCount * 9); // Each particle is a triangle (3 vertices)
    const directions = new Float32Array(particleCount * 3); // One direction per particle

    const spread = 3; // Initial spread factor for random positioning

    for (let i = 0; i < particleCount; i++) {
        const baseIndex = i * 9;

        // Generate random triangle vertices around the initial position
        for (let j = 0; j < 9; j += 3) {
            vertices[baseIndex + j] = position.x + (Math.random() - 0.5) * spread;
            vertices[baseIndex + j + 1] = position.y + (Math.random() - 0.5) * spread;
            vertices[baseIndex + j + 2] = position.z + (Math.random() - 0.5) * spread;
        }

        // Calculate a direction vector for each particle
        const dirX = vertices[baseIndex] - position.x;
        const dirY = vertices[baseIndex + 1] - position.y;
        const dirZ = vertices[baseIndex + 2] - position.z;

        // Normalize the direction vector (unit length)
        const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
        directions[i * 3] = dirX / length;
        directions[i * 3 + 1] = dirY / length;
        directions[i * 3 + 2] = dirZ / length;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    const particleMaterial = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
    });

    const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
    scene.add(particleMesh);

    const duration = 0.15; // Particle lifetime in seconds
    const expansionSpeed = 5; // Speed at which particles expand outward
    const startTime = performance.now();

    function animateParticles() {
        const elapsedTime = (performance.now() - startTime) / 1000;

        for (let i = 0; i < particleCount; i++) {
            const baseIndex = i * 9;

            // Move each particle's triangle vertices outward along the direction vector
            for (let j = 0; j < 9; j += 3) {
                vertices[baseIndex + j] += directions[i * 3] * expansionSpeed * elapsedTime;
                vertices[baseIndex + j + 1] += directions[i * 3 + 1] * expansionSpeed * elapsedTime;
                vertices[baseIndex + j + 2] += directions[i * 3 + 2] * expansionSpeed * elapsedTime;
            }
        }

        particleGeometry.attributes.position.needsUpdate = true;
        particleMaterial.opacity = Math.max(0, 0.8 * (1 - elapsedTime / duration)); // Fade out

        if (elapsedTime < duration) {
            requestAnimationFrame(animateParticles);
        } else {
            scene.remove(particleMesh);
            particleGeometry.dispose();
            particleMaterial.dispose();
        }
    }

    animateParticles();
}


/*---------------------------------------------------------------------------
                               Ability Blueprints
---------------------------------------------------------------------------*/
const abilityTypes = [
    {title: "Frontrunning Bot",
        description: "A fast bot that outpaces you and your enemy movements.",
        thumbnail: 'Media/Abilities/FRONTRUNNINGBOT.png',
        effect(user) { 
            let previousPosition = new THREE.Vector3().copy(user.position); 
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.6, 16, 6),
                world.material 
            );
            orb.position.copy(user.position); 
            orb.updateMatrixWorld(true);
            orb.boundingBox = new THREE.Box3().setFromObject(orb);
            lightObjects.push(orb);
            scene.add(orb);
            this.update = () => {
                const currentPosition = new THREE.Vector3().copy(user.position);
                const playerDirection = new THREE.Vector3().subVectors(currentPosition, previousPosition).normalize();
                const newOrbPosition = new THREE.Vector3(
                    user.position.x + playerDirection.x * user.range,
                    user.position.y + 2, 
                    user.position.z + playerDirection.z * user.range
                );
                orb.position.lerp(newOrbPosition, 0.1);
                orb.boundingBox.setFromObject(orb);
                previousPosition.copy(currentPosition);
            };
            this.deactivate = () => {
                scene.remove(orb);
                const index = lightObjects.indexOf(orb);
                if (index > -1) lightObjects.splice(index, 1); 
            };
        },
    },
    {title: "Sniping Bot",
        description: "Fast trading bot that liquidates opposing survivors.",
        thumbnail: 'Media/Abilities/SNIPEBOT.png',
        effect(user) { 
            let previousPosition = new THREE.Vector3().copy(user.position); 
            this.lastHitTime = 0;
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.6, 16, 6),
                world.material 
            );
            orb.position.copy(user.position); 
            orb.updateMatrixWorld(true);
            orb.boundingBox = new THREE.Box3().setFromObject(orb);
            lightObjects.push(orb);
            scene.add(orb);
            this.update = () => {
                const currentPosition = new THREE.Vector3().copy(user.position);
                const playerDirection = new THREE.Vector3().subVectors(currentPosition, previousPosition).normalize();
                const newOrbPosition = new THREE.Vector3(
                    user.position.x + playerDirection.x * user.range,
                    user.position.y + 15, 
                    user.position.z + playerDirection.z * user.range 
                );
                orb.position.lerp(newOrbPosition, .05);
                orb.boundingBox.setFromObject(orb);
                previousPosition.copy(currentPosition);
 
                scene.remove(orb.beam);
                const testBeamGeometry = new THREE.BufferGeometry().setFromPoints([orb.position.clone(), closeEnemy]);
                orb.beam = new THREE.Line(testBeamGeometry, new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 1 }),);
                orb.beam.boundingBox = new THREE.Box3().setFromObject(orb.beam);
                scene.add(orb.beam);
            };

            this.deactivate = () => {
                if (orb.mesh) {
                    scene.remove(orb);
                    orb = null;
                }
            };
        },
    },  
    {title: "Data Blob",
        description: "the survivor heavily brings along a big blob of data holding a piece of the blockchain",
        thumbnail: 'Media/Abilities/BLOB.png',
        effect(user) { 
            this.update = () => {};
            this.lastHitTime = 0;
            const maxDistance = 20;
            const orb = {
                mesh: null,
                boundingBox: null,
                homingSpeed: 0.5,
                create: () => {
                    const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
                    const geometry = new THREE.SphereGeometry(1, 16, 6);
                    orb.mesh = new THREE.Mesh(geometry, material);
                    orb.boundingBox = new THREE.Box3().setFromObject(orb.mesh);
                    scene.add(orb.mesh);
                    lightObjects.push(orb);
                }
            };
            this.update = () => {
                const distanceX = orb.mesh.position.x - user.position.x;
                const distanceZ = orb.mesh.position.z - user.position.z;
                const distance = Math.sqrt(distanceX * distanceX + distanceZ * distanceZ);
                if (distance > maxDistance) {
                    const scale = maxDistance / distance; // Scaling factor to reduce the distance to maxDistance
                    orb.mesh.position.x = user.position.x + distanceX * scale;
                    orb.mesh.position.z = user.position.z + distanceZ * scale;
                } else {
                    orb.mesh.position.set(
                        user.position.x + distanceX,
                        user.position.y + 2, // Keep Y slightly above the player
                        user.position.z + distanceZ
                    );
                }
                orb.boundingBox.setFromObject(orb.mesh);
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
    {title: "Bot Swarm",
        description: "Summons additional bots to assist in battle.",
        thumbnail: 'Media/Abilities/SWARM.png',
        effect(user) { 
            this.update = () => {};
            this.lastHitTime = 0;
            let time = Date.now();
            const orb = {
                mesh: null,
                boundingBox: null,
                maxDistance: 20, // Maximum allowed distance ahead/behind the player
                offsetAmount: 5,  // How far ahead or behind the bot can go
                followSpeed: 0.1, // How fast the bot adjusts its position
                create: () => {
                    const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
                    const geometry = new THREE.SphereGeometry(1, 16, 6);
                    orb.mesh = new THREE.Mesh(geometry, material);
                    orb.boundingBox = new THREE.Box3().setFromObject(orb.mesh);
                    scene.add(orb.mesh);
                    lightObjects.push(orb);
                }
            };
            this.update = () => {
                time = Date.now();
                const forwardOffset = Math.sin(time * 0.001) * orb.offsetAmount; 
                const targetX = user.position.x + forwardOffset;  
                const targetZ = user.position.z; 
                const distanceFromPlayer = Math.sqrt(
                    Math.pow(targetX + orb.mesh.position.x, 2) + 
                    Math.pow(targetZ + orb.mesh.position.z, 2)
                );
                if (distanceFromPlayer > orb.maxDistance) {
                    const direction = new THREE.Vector3(
                        targetX - orb.mesh.position.x,
                        0, 
                        targetZ - orb.mesh.position.z
                    ).normalize();
    
                    orb.mesh.position.add(direction.multiplyScalar(orb.followSpeed * distanceFromPlayer));
                } else {
                    orb.mesh.position.lerp(new THREE.Vector3(targetX, user.position.y + 2, targetZ), orb.followSpeed);
                }
                orb.boundingBox.setFromObject(orb.mesh);
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
    {title: "Blockchain Backup",
        description: "The survivor keeps a backup of everything always in handy.",
        thumbnail: 'Media/Abilities/BLOCKCHAINBACKUP.png',
        effect(user) { 
            this.update = () => {};
            this.lastHitTime = 0;
            let time = Date.now();
            const orb = {
                mesh: null,
                boundingBox: null,
                maxDistance: 20, // Maximum allowed distance ahead/behind the player
                offsetAmount: 5,  // How far ahead or behind the bot can go
                followSpeed: 0.1, // How fast the bot adjusts its position
                create: () => {
                    const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
                    const geometry = new THREE.SphereGeometry(1, 16, 6);
                    orb.mesh = new THREE.Mesh(geometry, material);
                    orb.boundingBox = new THREE.Box3().setFromObject(orb.mesh);
                    scene.add(orb.mesh);
                    lightObjects.push(orb);
                }
            };
            this.update = () => {
                time = Date.now();
                const forwardOffset = Math.sin(time * 0.001) * orb.offsetAmount; 
                const targetX = user.position.x + forwardOffset;  
                const targetZ = user.position.z; 
                const distanceFromPlayer = Math.sqrt(
                    Math.pow(targetX - orb.mesh.position.x, 2) + 
                    Math.pow(targetZ - orb.mesh.position.z, 2)
                );
                if (distanceFromPlayer > orb.maxDistance) {
                    const direction = new THREE.Vector3(
                        targetX - orb.mesh.position.x,
                        0, 
                        targetZ - orb.mesh.position.z
                    ).normalize();
    
                    orb.mesh.position.add(direction.multiplyScalar(orb.followSpeed * distanceFromPlayer));
                } else {
                    orb.mesh.position.lerp(new THREE.Vector3(targetX, user.position.y + 2, targetZ), orb.followSpeed);
                }
                orb.boundingBox.setFromObject(orb.mesh);
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
    {title: "Anti-Rug Bot",
        description: "Detects and disables rug traps.",
        thumbnail: 'Media/Abilities/RUGBOT.png',
        effect(user) { 
            this.update = () => {}
                this.lastHitTime=0;
                let time = Date.now();
                let direction= null;
                const orb = {
                    mesh: null,
                    orbitRadius: 10,
                    orbitSpeed: 0.01,
                    homingSpeed: 0.5,
                    create: () => {
                        const material = new THREE.MeshBasicMaterial({ color: 0xff00ff});
                        const geometry = new THREE.SphereGeometry(0.6, 16, 6);
                        orb.mesh = new THREE.Mesh(geometry, material);
                        orb.boundingBox = new THREE.Box3().setFromObject(orb.mesh);
                        scene.add(orb.mesh);
                        lightObjects.push(orb)
                    }
                };
                this.update = () => {
                            time = Date.now() * orb.orbitSpeed;
                            orb.mesh.position.set(
                                user.position.x + Math.cos(time) * orb.orbitRadius,
                                user.position.y+1.5,
                               // user.position.z + Math.sin(time) * orb.orbitRadius
                            );
                            direction = new THREE.Vector3().subVectors(closeEnemy, orb.mesh.position).normalize();
                            orb.mesh.position.add(direction.multiplyScalar(orb.homingSpeed));
                            orb.boundingBox.setFromObject(orb.mesh);
                        
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
    {title: "Exploit Finder",
        description: "Scans the blockchain for harmful elements and neutralizes them.",
        thumbnail: "Media/Abilities/EXPLOITFINDER.png",
        effect(user) { 
            this.update = () => {}
                this.lastHitTime=0;
                let time = Date.now();
                let direction= null;
                const orb = {
                    mesh: null,
                    orbitRadius: 10,
                    orbitSpeed: 0.01,
                    homingSpeed: 0.5,
                    create: () => {
                        const material = new THREE.MeshBasicMaterial({ color: 0x0000ff});
                        const geometry = new THREE.SphereGeometry(0.6, 16, 6);
                        orb.mesh = new THREE.Mesh(geometry, material);
                        orb.boundingBox = new THREE.Box3().setFromObject(orb.mesh);
                        scene.add(orb.mesh);
                        lightObjects.push(orb)
                    }
                };
                this.update = () => {
                            time = Date.now() * orb.orbitSpeed;
                            orb.mesh.position.set(
                                user.position.x + Math.cos(time) * orb.orbitRadius,
                                user.position.y+1.5,
                                user.position.z + Math.sin(time) * orb.orbitRadius
                            );
                            direction = new THREE.Vector3().subVectors(closeEnemy, orb.mesh.position).normalize();
                            orb.mesh.position.add(direction.multiplyScalar(orb.homingSpeed));
                            orb.boundingBox.setFromObject(orb.mesh);
                        
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
    {title: "Scalping Bot",
        description: 'Abusing the market volatility, The Scalping bot Executes incredibly fast attacks.',
        thumbnail: 'Media/Abilities/SCALPINGBOT.png',
        effect(user) { 
            this.update = () => {}
                this.lastHitTime=0;
                let time = Date.now();
                let direction= null;
                const orb = {
                    mesh: null,
                    target: null,
                    orbitRadius: 2,
                    orbitSpeed: 0.01,
                    homingSpeed: 0.5,
                    create: () => {
                        const material = new THREE.MeshBasicMaterial({ color: 0xff0000});
                        const geometry = new THREE.SphereGeometry(0.6, 16, 6);
                        orb.mesh = new THREE.Mesh(geometry, material);
                        orb.boundingBox = new THREE.Box3().setFromObject(orb.mesh);
                        scene.add(orb.mesh);
                        lightObjects.push(orb)
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
                            orb.target=true;
                            if ((Date.now() - this.lastHitTime > (500))) {
                            this.lastHitTime = Date.now();
                            }
                        } else {
                            direction = new THREE.Vector3().subVectors(closeEnemy, orb.mesh.position).normalize();
                            orb.mesh.position.add(direction.multiplyScalar(orb.homingSpeed));
                            orb.boundingBox.setFromObject(orb.mesh);
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
    { title: 'Onchain Trail',
        description: 'Your onchain movements leave a trail behind, damaging pursuers',
        thumbnail: 'Media/Abilities/ONCHAINTRAIL.png',
        effect(user) { 
            this.update = () => {}
            const trailBullets = [];
            this.lastTrailTime = 0;
            const trail = {
                create: () => {
                    if (trailBullets.length >= (10)) {
                        const oldestBullet = trailBullets.shift(); 
                        scene.remove(oldestBullet); 
                    }
                    colorIndex = (colorIndex + 1) % rainbowColors.length;
                    const trailStepMaterial = world.material.clone(); 
                   // trailStepMaterial.color.setHex(rainbowColors[colorIndex]); 
                   // trailStepMaterial.emissive.setHex(rainbowColors[colorIndex]);
                    const trailStep = new THREE.Mesh(new THREE.BoxGeometry(1,.5,1 ),trailStepMaterial);
                    trailStep.position.copy(user.position);
                    trailStep.position.y-=1;
                    trailStep.castShadow = true;
                    scene.add(trailStep);
                    trailStep.trailBox = new THREE.Box3().setFromObject(trailStep);
                    trailBullets.push(trailStep);
                }
            };
            this.update = () => {
                if ((Date.now() - this.lastTrailTime > 400)) {
                    this.lastTrailTime = Date.now();
                    trail.create();
                }
            // playerCollisionList.forEach((trailBullet,index) => {
                //             if (trailBullet.trailBox.intersectsBox(other)) { 
                //               scene.remove(trailBullet); 
                //               trailBullets.splice(index, 1);
                //               player.takeDamage(1);  
                //            }
            //  
            //});
            };
            this.deactivate = () => {
                trailBullets.forEach(bullet => { scene.remove(bullet); });
                trailBullets.length = 0; 
            };
        },
    },
    {title: "Veil of Decentralization",
        description: "The Survivor shrouds in decentralization, becoming greatly elusive.",
        thumbnail: 'Media/Abilities/VEILOFDECENTRALIZATION.png',
        effect(user) { 
            this.update = () => {}
            const veil = {
                create: () => {
                    if (veil.shield) scene.remove(veil.shield);
                    user.evasion += 50;
                    const shieldMaterial = world.material.clone();
                    shieldMaterial.transparent = true;
                    shieldMaterial.opacity = 0.1; 
                    const shieldGeometry = new THREE.SphereGeometry(2.5);
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
            veil.create();
        },
    },
];

/*---------------------------------------------------------------------------
                              Future Abilities

{
    title: "Code Refactor",
    description: "Rewrites and optimizes the Survivor's abilities, reducing their cooldowns.",
    thumbnail: 'Media/Abilities/CODEREFACTOR.png',
    effect(user) { 
        this.update = () => {}
        const veil = {
            create: () => {
                if (veil.shield) scene.remove(veil.shield);
                user.evasion += 3;
                colorIndex = (colorIndex + 1) % rainbowColors.length;
                const shieldMaterial = world.material.clone(); 
                shieldMaterial.color.setHex(rainbowColors[colorIndex]);
                shieldMaterial.transparent = true;
                shieldMaterial.opacity = 0.1;
                shieldMaterial.emissive.setHex(rainbowColors[colorIndex]);
                shieldMaterial.emissiveIntensity = 1;
    
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
        veil.create();
    },
},{
    title: "Sybil Attack",
    description: "Creates multiples identities, disorienting and damaging enemies.",
    thumbnail:'Media/Abilities/SYBILATTACK.png',
    effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Vote Manipulation",
    description: "Illegally uses the voting power of other survivors in range agaisnt their will, turning bonuses into penalties.",
    thumbnail: 'Media/Abilities/VOTEMANIPULATION.png',
    effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Airdrop Fraud",
    description: "Free, fake tokens fall from the sky, draining the survivors who interact with them.",
    thumbnail: 'Media/Abilities/AIRDROPFRAUD.png', effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Identity Forge",
    description: "Specializes in creating a whole new persona, gaining the bonuses of a random class.",
    thumbnail: 'Media/Abilities/IDENTITYFORGE.png', effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Decentralized Vote Rigging",
    description: "By controlling the majority of the chain validators, the survivor gains a random bonus.",
    thumbnail: 'Media/Abilities/VOTERIGGING.png',effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Confirm Block",
    description: "As transactions become confirmed and secured overtime, the survivor gains defensive bonuses",
    thumbnail: 'Media/Abilities/CONFIRMBLOCK.png',
effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Finality",
    description: "The blockchain inmutality makes it so  buried Survivors can not ever revive, If they take more than 6 blocks.",
    thumbnail: 'Media/Abilities/FINALITY.png',
effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Copy Trading",
    description: "Creates a shield that absorbs multiple hits.",
    thumbnail: 'Media/Abilities/COPYTRADING.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Double Spend Prevention ",
    description: "Creates a shield that absorbs multiple hits.",
    thumbnail: 'Media/Abilities/DOUBLESPENDPREVENTION.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Overclock",
    description: "Greatly increases attack power for a brief period.",
    thumbnail: 'Media/Abilities/OVERCLOCK.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Mining Rig",
    description: "Deploys a stationary turret that automatically attacks enemies.",
    thumbnail: 'Media/Abilities/MININGRIG.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Energy Surge",
    description: "Temporarily increases attack speed and movement speed.",
    thumbnail: 'Media/Abilities/ENERGYSURGE.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "PoS Migration",
    description: "Increases the player's defense.",
    thumbnail: 'Media/Abilities/POSMIGRATION.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "PoW Migration ",
    description: "Increases the player's attack power.",
    thumbnail: 'Media/Abilities/POWMIGRATION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Governance Vote",
    description: "Grants a random beneficial effect based on player needs.",
    thumbnail: 'Media/Abilities/GOVERNANCEVOTE.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Protocol Upgrade",
    description: "Improves all abilities for a limited time.",
    thumbnail: "Media/Abilities/PROTOCOLUPGRADE.png",
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Network Upgrade ",
    description: "Grants a significant buff to a random ability.",
    thumbnail: "Media/Abilities/NETWORKUPGRADE.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Quantum Encryption",
    description: "Creates a shield that reduces incoming damage.",
    thumbnail: "Media/Abilities/QUANTUMENCRYPTION.png",
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Transaction Fee",
    description: "Reduces the cooldown of all abilities.",
    thumbnail: 'Media/Abilities/TRANSACTIONFEE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Transaction Fee Burn",
    description: "Reduces enemy resources by burning their assets.",
    thumbnail: 'Media/Abilities/FEEBURN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale Power",
    description: "Increases all stats for a short duration.",
    thumbnail: "Media/Abilities/WHALEPOWER.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Block Reward",
    description: "Heals the player for a portion of damage dealt.",
    thumbnail: 'Media/Abilities/BLOCKREWARD.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Crypto MultiSig",
    description: "Secures resources with multiple signatures.",
    thumbnail: 'Media/Abilities/CRYPTOMULTISIG.png',
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Transaction Sign",
    description: "Secures resources with a single signature.",
    thumbnail: 'Media/Abilities/CRYPTOSIGN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Staking Rewards",
    description: "Provides periodic healing to all allies.",
    thumbnail: 'Media/Abilities/STAKINGREWARD.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "DAO Governance",
    description: "Empowers allies with decision-making buffs.",
    thumbnail: 'Media/Abilities/DAOGOVERNANCE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Finger Pointing",
    description: "Implements a major change, significantly debuffing enemies.",
    thumbnail: 'Media/Abilities/FINGER.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Surprise Liquidation",
    description: "Causes a massive area-of-effect damage.",
    thumbnail: "Media/Abilities/LIQUIDATIONEVENT.png",
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Price Divergence ",
    description: "Confuses enemies, causing them to attack each other.",
    thumbnail: "Media/Abilities/DIVERGENCE.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Compliance Order",
    description: "Forces enemies to move towards the player, taking damage over time.",
    thumbnail: "Media/Abilities/COMPLIANCEORDER.png",
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Entanglement",
    description: "Links enemies, causing damage to spread among them.",
    thumbnail: "Media/Abilities/ENTANGLEMENT.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Decentralized Network",
    description: "Summons allies to assist in battle.",
    thumbnail: 'Media/Abilities/DECENTRALIZEDNETWORK.png',
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Liquidity Pool",
    description: "Creates a pool that heals allies and damages enemies.",
    thumbnail: 'Media/Abilities/LIQUIDITYPOOL.png',
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Initial DEX Offering",
    description: "Increases allies' attack power.",
    thumbnail: 'Media/Abilities/INITIALDEXOFFERING.png',
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "No Coin FUD",
    description: "Decreases enemy attack power and movement speed.",
    thumbnail: "Media/Abilities/NOCOINFUD.png",
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Network Effect",
    description: "Increases the effectiveness of all abilities.",
    thumbnail: 'Media/Abilities/NETWORKEFFECT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Chain Reaction",
    description: "Causes a chain reaction, revealing all enemies and drastically debuffing them while significantly buffing allies.",
    thumbnail: 'Media/Abilities/CHAINREACTION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "FOMO Wave",
    description: "Induces fear of missing out, causing enemies to rush towards the player.",
    thumbnail: "Media/Abilities/FOMO.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Chain Analysis",
    description: "Reveals hidden enemies and tracks their movements.",
    thumbnail: "Media/Abilities/ANALYSIS.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidation Wave",
    description: "Deals area-of-effect damage and reduces enemy defenses.",
    thumbnail: "Media/Abilities/MASSLIQUIDATION.png",
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Quick Flip",
    description: "Deals instant damage to nearby enemies.",
    thumbnail: "Media/Abilities/QUICKFLIP.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Dollar Cost average",
    description: "Deals Slow damage to nearby enemies.",
    thumbnail: "Media/Abilities/DCA.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Jackpot",
    description: "Hits the jackpot, dealing massive damage to all enemies and providing significant buffs to allies.",
    thumbnail: "Media/Abilities/JACKPOT.png",
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Airdrop",
    description: "Drops valuable items or buffs to allies.",
    thumbnail: 'Media/Abilities/AIRDROP.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Blockchain Stress Test ",
    description: "Creates a zone where enemies take increased damage and have reduced speed.",
    thumbnail: 'Media/Abilities/STRESSTEST.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Feature Test ",
    description: "Temporarily boosts allies' abilities.",
    thumbnail: 'Media/Abilities/FEATURETEST.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Oracle Insight",
    description: "Predicts enemy movements, increasing evasion.",
    thumbnail: 'Media/Abilities/ORACLEINSIGHT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale Buy",
    description: "Unleashes a powerful area-of-effect attack, representing a large buy order.",
    thumbnail: "Media/Abilities/WHALEBUY.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: " Trilemma Mastery",
    description: "Master the trilemma by providing significant buffs to attack, defense, and movement speed while weakening enemies.",
    thumbnail: "Media/Abilities/LAW.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Oracle Manipulation",
    description: "Disrupts enemy abilities based on false data.",
    thumbnail: "Media/Abilities/ORACLEMANIPULATION.png",
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Market Manipulation ",
    description: "Temporarily controls enemy movements.",
    thumbnail: "Media/Abilities/MARKETMANIPULATION.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Impermanent Loss",
    description: "Reduces damage taken from all sources.",
    thumbnail: 'Media/Abilities/IMPERMANENTLOSS.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Tripool",
    description: "Creates three separate pools that buff allies' attack power.",
    thumbnail: 'Media/Abilities/TRIPOOL.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Rug Pull",
    description: "Instantly removes buffs from enemies.",
    thumbnail: 'Media/Abilities/RUG.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Debt Collector",
    description: "Focuses on sustained damage and debuffs.",
    thumbnail: "Media/Abilities/DEBTCOLLECTOR.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Swing",
    description: "Temporarily increases critical hit chance and attack speed.",
    thumbnail: "Media/Abilities/MARKETSWING.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Maker",
    description: "Balances the battlefield by adjusting enemy and ally stats.",
    thumbnail: 'Media/Abilities/MARKETMAKER.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Two Pool",
    description: "Creates two separate pools that buff allies' attack speed.",
    thumbnail: 'Media/Abilities/TWOPOOL.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Bridge",
    description: "Transfers resources between allies.",
    thumbnail: 'Media/Abilities/BRIDGE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Buyout Power",
    description: "Temporarily takes control of an enemy, turning them into an ally.",
    thumbnail: 'Media/Abilities/BUYPOWER.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Merkle Proof",
    description: "Verifies resources securely.  preventing theft",
    thumbnail: 'Media/Abilities/MERKLE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Compliance Check",
    description: "Forces enemies to slow down and take damage over time.",
    thumbnail: 'Media/Abilities/COMPLIANCE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Portfolio",
    description: "Increases the efficiency of resource gathering.",
    thumbnail: 'Media/Abilities/FOLIO.png',
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Zodiac Prediction ",
    description: "Predicts and reveals enemies' weaknesses, reducing their defenses.",
    thumbnail: 'Media/Abilities/ZODIAC.png',
    effect(user) { 
        this.update = () => {}
    }
},
{
    title: "DeFi Yield",
    description: "Periodically grants a boost in resources.",
    thumbnail: 'Media/Abilities/DEFIYIELD.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: 'Escrow Services',
    description: "Holds resources in escrow, releasing them after a delay.",
    thumbnail: 'Media/Abilities/ESCROW.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Bitcoin Dominance ',
    description: "Temporarily controls all enemies, making them fight each other.",
    thumbnail: 'Media/Abilities/DOMINANCE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "NFT Disruptor",
    description: "Temporarily disables the effects of enemy NFTs.",
    thumbnail: 'Media/Abilities/NFTDISRUPTOR.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Blockchain Analysis",
    description: "Provides insights to increase strategy effectiveness.",
    thumbnail: 'Media/Abilities/BLOCKANALYSIS.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Decentralized Finance Expertise",
    description: "Increases the effectiveness of all resource-gathering abilities.",
    thumbnail: 'Media/Abilities/EXPERTISE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Trader's Instinct ",
    description: "Enhances movement speed and reduces skill cooldowns in critical moments.",
    thumbnail: 'Media/Abilities/INTUITION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Margin Call ",
    description: "Forces enemies to take damage over time.",
    thumbnail: 'Media/Abilities/MARGINCALL.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Perfect Arbitrage",
    description: "Executes a perfect arbitrage, drastically increasing attack power and critical hit chance for a short period.",
    thumbnail: 'Media/Abilities/ARBITRAGE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Temperature Check",
    description: "Executes a perfect arbitrage, drastically increasing attack power and critical hit chance for a short period.",
    thumbnail: 'Media/Abilities/TEMPCHECK.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Treasury Allocation",
    description: "Provides a large amount of resources to all allies.",
    thumbnail: 'Media/Abilities/TREASURYALLOC.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Lucky Streak",
    description: "Temporarily increases critical hit chance and dodge rate.",
    thumbnail: 'Media/Abilities/STREAK.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Self Custody",
    description: "Protects resources from being stolen.",
    thumbnail: 'Media/Abilities/CUSTODY.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Flash Crash",
    description: "Briefly stuns all enemies in the area.",
    thumbnail: 'Media/Abilities/MARKETCRASH.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Stake Defense",
    description: "Increases defense for a short period.",
    thumbnail: 'Media/Abilities/STAKEDEFENSE.png',
    effect(user) { 
        this.update = () => {} 
    },
},
 
{
    title: "Final Release",
    description: "Launches the final release, significantly buffing all allies and debuffing all enemies.",
    thumbnail: 'Media/Abilities/FINALRELEASE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Fork",
    description: "Creates a duplicate of an ability for a short time.",
    thumbnail: 'Media/Abilities/CRYPTOFORK.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Wallet",
    description: "Stores resources securely.",
    thumbnail: 'Media/Abilities/WALLET.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Slashing Protection",
    description: "Reduces damage taken from critical hits.",
    thumbnail: 'Media/Abilities/SLASHINGPROTECTION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Security Lockdown",
    description: "Reduces damage taken for a short period.",
    thumbnail: 'Media/Abilities/LOCKDOWN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Scalability Boost",
    description: "Increases attack speed and movement speed.",
    thumbnail: 'Media/Abilities/SCALABILITYBOOST.png',
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "ICO Hype",
    description: "Temporarily boosts all stats.",
    thumbnail: 'Media/Abilities/ICOHYPE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "ReBalancing ",
    description: "Spreads damage taken to nearby enemies.",
    thumbnail: 'Media/Abilities/REBALANCING.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Rally",
    description: "Temporarily boosts all allies' speed.",
    thumbnail: 'Media/Abilities/RALLY.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Whitelist",
    description: "Grants immunity to debuffs.",
    thumbnail: 'Media/Abilities/WHITELIST.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Blacklist",
    description: "Grants immunity to buffs.",
    thumbnail: 'Media/Abilities/BLACKLIST.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Pump and Dump",
    description: "Increases attack power significantly for a short duration, followed by a debuff.",
    thumbnail: 'Media/Abilities/PND.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Pump",
    description: "Increases attack power significantly for a short duration",
    thumbnail: 'Media/Abilities/PUMP.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Lending Protocol',
    description: "Lends resources to allies temporarily.",
    thumbnail: 'Media/Abilities/LENDING.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Token Lock',
    description: "Locks an enemy's abilities temporarily.",
    thumbnail: 'Media/Abilities/TOKENLOCK.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Locked In",
    description: "Maximize your profits and outpace the competition with unparalleled focus and strategic insight.",
    thumbnail: 'Media/Abilities/LOCKEDIN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Adaptive Trading",
    description: "Adapts to the situation, dealing damage based on the player's needs.",
    thumbnail: 'Media/Abilities/ADAPTIVETRADING.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Token Burn",
    description: "Permanently removes a portion of enemy resources.",
    thumbnail: 'Media/Abilities/TOKENBURN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Delegation",
    description: "Allows the player to share buffs with allies.",
    thumbnail: 'Media/Abilities/DELEGATION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Mastery",
    description: "Master protocols to provide comprehensive buffs to all allies and debuff enemies significantly.",
    thumbnail: 'Media/Abilities/MASTERY.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Exploit ",
    description: "Deals significant damage to a single target and restores health.",
    thumbnail: 'Media/Abilities/EXPLOIT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Patch",
    description: "Creates a temporary area that boosts allies' defenses.",
    thumbnail: 'Media/Abilities/PATCHDEPLOY.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Inside Info",
    description: "Reveals hidden enemies and weak points.",
    thumbnail: 'Media/Abilities/INSIDEINFO.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Debate",
    description: "Temporarily silences and weakens enemies.",
    thumbnail: 'Media/Abilities/DEBATE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Profit Taker ",
    description: "Buffs self and allies after defeating enemies.",
    thumbnail: 'Media/Abilities/PROFITTAKING.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Regulatory Framework ",
    description: "Creates a barrier that blocks enemy movement.",
    thumbnail: 'Media/Abilities/REGULATORYFRAMEWORK.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Transaction Revert",
    description: "Teleports the player to a previous location, avoiding damage.",
    thumbnail: 'Media/Abilities/TXREVERT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Code Review",
    description: "Temporarily reveals enemy weaknesses and increases damage dealt.",
    thumbnail: 'Media/Abilities/REVIEW.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "QA",
    description: "Enhances ally buffs and reduces enemy effectiveness.",
    thumbnail: 'Media/Abilities/QUALITYASSURANCE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Let him Cook",
    description: "Over time, gains stats exponentially.",
    thumbnail: 'Media/Abilities/COOK.png',
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: 'Token UnLock',
    description: "Locks an enemy's abilities temporarily.",
    thumbnail: 'Media/Abilities/TOKENUNLOCK.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crop Rotation",
    description: "Switches between different buffs to suit the player's needs.",
    thumbnail: 'Media/Abilities/ROTATION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Dapp",
    description: "Creates a decentralized application for resource generation.",
    thumbnail: 'Media/Abilities/DAPP.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Bounty",
    description: "Rewards for defeating enemies.",
    thumbnail: 'Media/Abilities/CRYPTOBOUNTY.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidity Vampire",
    description: "Steals resources and buffs self and allies.",
    thumbnail: "Media/Abilities/LIQUIDITYVAMPIRE.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Malware Injection ",
    description: "Inflicts damage over time and reduces enemy attack speed.",
    thumbnail: "Media/Abilities/BUG.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title:  "Network Consensus",
    description: "Achieves network consensus, significantly boosting allies' defense and providing damage immunity for a short period.",
    thumbnail: "Media/Abilities/CONSENSUS.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Chain Split",
    description: "Creates a duplicate of yourself to confuse enemies.",
    thumbnail: 'Media/Abilities/CHAINSPLIT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Validator Uptime",
    description: "Increases the duration of all buffs.",
    thumbnail: 'Media/Abilities/VALIDATORUPTIME.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Exit Scam",
    description: "Teleports to a safe location and leaves a damaging decoy behind.",
    thumbnail: 'Media/Abilities/EXITSCAM.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sellout",
    description: "Trades a portion of your resources for a temporary power boost.",
    thumbnail: 'Media/Abilities/SELLOUT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Crash",
    description: "Creates a zone where enemies take increased damage and have reduced speed.",
    thumbnail: 'Media/Abilities/PROTOCOLCRASH.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Trading Frenzy",
    description: "Increases speed and critical hit chance drastically for a short time.",
    thumbnail: 'Media/Abilities/TRADINGFRENZY.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Hash Power",
    description: "Temporarily increases attack power.",
    thumbnail: 'Media/Abilities/HASHPOWER.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Miner Network",
    description: "Creates a zone that damages enemies over time.",
    thumbnail: 'Media/Abilities/MINERNETWORK.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Validator Support",
    description: "Summons a temporary ally to aid in battle.",
    thumbnail: 'Media/Abilities/VALIDATORSUPPORT.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Diamond Hands ",
    description: "Reduces damage taken significantly for a short period.",
    thumbnail: 'Media/Abilities/DIAMONDHANDS.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "HODL",
    description: "Increases the player's defense.",
    thumbnail: 'Media/Abilities/HODL.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Titanium Support ",
    description: "Creates a barrier that absorbs damage.",
    thumbnail: 'Media/Abilities/SUPPORT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'The Citadel',
    description: "Constructs a powerful fortress that provides extensive protection to allies and significantly disrupts enemies.",
    thumbnail: 'Media/Abilities/CITADEL.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Total Shutdown",
    description: "Shuts down all enemy abilities and greatly reduces their stats for a short period.",
    thumbnail: 'Media/Abilities/SHUTDOWN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Market Stabilization',
    description: "Stabilizes prices, reducing enemy attack power and increasing ally defense.",
    thumbnail: 'Media/Abilities/STABILIZATION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Contract Breach",
    description: "Disables enemy abilities for a short period.",
    thumbnail: 'Media/Abilities/BREACH.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Single Stake",
    description: "Increases health regeneration based on a single stake.",
    thumbnail: 'Media/Abilities/SINGLESTAKE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Capital Injection ",
    description: "Provides a significant health boost to the player or an ally.",
    thumbnail: 'Media/Abilities/CAPITALINJECTION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Due Diligence",
    description: "Reveals enemies' weaknesses and reduces their defenses.",
    thumbnail: 'Media/Abilities/DD.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Funding Boost ",
    description: "Increases resource generation for a short period.",
    thumbnail: 'Media/Abilities/FUNDINGBOOST.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Firewall Fort",
    description: "Increases the player's defense temporarily.",
    thumbnail: 'Media/Abilities/FIREWALL.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "DeFi Supremacy",
    description: "Establishes complete DeFi dominance, significantly enhancing all aspects of resource generation and providing massive buffs to allies.",
    thumbnail: 'Media/Abilities/DEFISUPREMACY.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Leveraged Yield",
    description: "Increases resource generation for a short period.",
    thumbnail: 'Media/Abilities/LEVERAGEDYIELD.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Collector Frenzy",
    description: "Calls upon devoted collectors to swarm enemies, dealing massive damage.",
    thumbnail: 'Media/Abilities/COLLECTORSFRENZY.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Capitulation',
    description: "Spreads widespread fear and panic, causing enemies to lose resources and morale.",
    thumbnail: 'Media/Abilities/CAPITULATION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Maxi Ascendancy",
    description: "Ascends to a state of maximum power, drastically increasing all stats and providing powerful buffs to allies for a short period.",
    thumbnail: 'Media/Abilities/MAXIAS.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Inspection",
    description: "Reveals and debuffs all enemies in a targeted area.",
    thumbnail: 'Media/Abilities/INSPECTION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Exit Hatch ",
    description: "Grants one extra life.",
    thumbnail: 'Media/Abilities/EXITHATCH.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Chain Reorg",
    description: "Rewinds time slightly to undo recent events.",
    thumbnail: 'Media/Abilities/CHAINREORG.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Pact with the Devil",
    description: "Grants a significant boost in power at the cost of health.",
    thumbnail: 'Media/Abilities/PACTWITHTHEDEVIL.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Congestion",
    description: "Slows all enemies for a short duration.",
    thumbnail: "Media/Abilities/CONGESTION.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Mining Frenzy",
    description: "Triggers a mining frenzy, drastically increasing attack power and speed for a short period.",
    thumbnail: "Media/Abilities/MININGFRENZY.PNG",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "DDoS Attack",
    description: "Stuns all enemies for a short duration.",
    thumbnail: "Media/Abilities/DDOS.png",
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Interest Yield",
    description: "Gradually regenerates health over time.",
    thumbnail: 'Media/Abilities/INTERESTYIELD.png',
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Monolithic Design",
    description: "Provides a significant health boost.",
    thumbnail: 'Media/Abilities/MONOLITHICDESIGN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Multilayer Design",
    description: "Adds an additional layer of defense.",
    thumbnail: 'Media/Abilities/MULTILAYERDESIGN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Layer 2 Scaling",
    description: "Reduces the cost and cooldown of all abilities.",
    thumbnail: 'Media/Abilities/LAYERSCALING.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Patience",
    description: "Gradually regenerates health over time.",
    thumbnail: 'Media/Abilities/PATIENCE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidity Mining",
    description: "Generates resources over time.",
    thumbnail: 'Media/Abilities/LIQUIDITYMINING.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Gas Optimization",
    description: "Decreases mana cost of all abilities.",
    thumbnail: 'Media/Abilities/GASOPTIMIZATION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bearish Sentiment",
    description: "Reduces enemies' attack power.",
    thumbnail: 'Media/Abilities/BEARISHSENTIMENT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale Games",
    description: "Uses overwhelming power to crush enemies.",
    thumbnail: 'Media/Abilities/CRYPTOWHALE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bullish Sentiment",
    description: "Increases allies' attack power.",
    thumbnail: 'Media/Abilities/BULLISHSENTIMENT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Vampire ATTACK",
    description: "Steals resources.",
    thumbnail: "Media/Abilities/VAMPIREATTACK.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Black Swan Event",
    description: "Creates a chaotic event that massively disrupts enemy abilities and resources while providing significant buffs to allies.",
    thumbnail: "Media/Abilities/BLACKSWAM.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Dead Cat Bounce",
    description: "Temporarily makes the player invincible and greatly increases attack power.",
    thumbnail: 'Media/Abilities/DEADCATBOUNCE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "White Swan Event",
    description: "Creates an event that massively benefits all market participants providing significant buffs.",
    thumbnail: "Media/Abilities/WHITESWAM.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crab Market Action ",
    description: "Reverses buff and debuffs of everyone for the rest of the game .",
    thumbnail: "Media/Abilities/CRABACTION.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Unicorn Startup',
    description: 'a very rare sight.',
    thumbnail: 'Media/Abilities/UNICORN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Male Astrology",
    description: "Predicts and reveals enemies' weaknesses, reducing their defenses.",
    thumbnail: 'Media/Abilities/ASTROLOGY.png',
    effect(user) { 
        this.update = () => {}
    }
},
{
    title: "NFT Enhancer",
    description: "Boosts the effects of your NFTs.",
    thumbnail: 'Media/Abilities/NFTREWORK.png',
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "Debt Drown ",
    description: "Provides a temporary boost to defense and health regeneration.",
    thumbnail: 'Media/Abilities/DEBTDROWN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "NFT Marketplace",
    description: "Increases the drop rate of rare items.",
    thumbnail: 'Media/Abilities/NFTMARKET.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sanction",
    description: "Targets a single enemy, greatly reducing its speed and defense.",
    thumbnail: 'Media/Abilities/SANCTION.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Scam Alert ",
    description: "Temporarily decreases enemies' attack power and movement speed.",
    thumbnail: 'Media/Abilities/SCAM.png',
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "Double or Nothing ",
    description: "Randomly buffs or debuffs the player.",
    thumbnail: 'Media/Abilities/DOUBLEORNOTHING.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Skeptical Scholar",
    description: "Buffs allies' defense and reduces enemy effectiveness.",
    thumbnail: 'Media/Abilities/SKEPTIC.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Policy Overhaul',
    description: "Executes a policy overhaul, providing massive buffs to allies and drastically debuffing enemies across the battlefield.",
    thumbnail: 'Media/Abilities/OVERHAUL.png',
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "Lunar Cycle ",
    description: "Provides buffs or debuffs based on the current moon phase.",
    thumbnail: 'Media/Abilities/LUNARCYCLE.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Signal",
    description: "Calls for reinforcements to aid in battle.",
    thumbnail: 'Media/Abilities/CRYPTOSIGNAL.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Flash Loan",
    description: "Temporarily boosts resources for a short period.",
    thumbnail: 'Media/Abilities/FLASHLOAN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Star Alignment ",
    description: "Increases critical hit chance and attack power when stars align.",
    thumbnail: 'Media/Abilities/ALIGNMENT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Risk Taker",
    description: "High-risk, high-reward abilities.",
    thumbnail: 'Media/Abilities/RISKTAKER.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Shill",
    description: "Temporarily increases allies' attack power and speed.",
    thumbnail: 'Media/Abilities/SHILLING.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Compound Interest ",
    description: "Gradually increases attack power and defense over time.",
    thumbnail: 'Media/Abilities/COMPOUND.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Hype Train",
    description: "Summons a stampede of followers that trample enemies.",
    thumbnail: 'Media/Abilities/HYPETRAIN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Virality ",
    description: "Goes viral, drastically increasing the effectiveness of all abilities and summoning followers to fight alongside.",
    thumbnail: 'Media/Abilities/VIRALITY.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Viral Spread ",
    description: "Goes viral, drastically increasing the effectiveness of all abilities and summoning followers to fight alongside.",
    thumbnail: 'Media/Abilities/SPREAD.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Second Best ",
    description: "Gradually increases attack power and defense over time.",
    thumbnail: 'Media/Abilities/SECONDBEST.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Martket Impact",
    description: "Enhances debuffs and controls enemy behavior.",
    thumbnail: 'Media/Abilities/MARKETIMPACT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "It's Over ",
    description: "over.",
    thumbnail: 'Media/Abilities/OVER.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "All In",
    description: "Deals massive damage to a single target but leaves the player vulnerable.",
    thumbnail: 'Media/Abilities/ALLIN.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Token Swap",
    description: "Exchanges debuffs for buffs with enemies.",
    thumbnail: 'Media/Abilities/COINSWAP.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Bug Fixing',
    description: "Fixes bugs in the code, restoring a small amount of health.",
    thumbnail: 'Media/Abilities/ASSISTEDBUGFIXING.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Upgrade Shiping',
    description: "Splits the player's attacks into multiple projectiles, hitting more enemies.",
    thumbnail: 'Media/Abilities/SHIPPING.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Raider",
    description: "Focuses on high-damage, single-target attacks.",
    thumbnail: 'Media/Abilities/RAIDING.png',
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "Sidechains",
    description: "Allows the player to create decoys that distract enemies.",
    thumbnail: "Media/Abilities/SIDECHAIN.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Gas Limit",
    description: "Reduces the speed of all enemies in a large area.",
    thumbnail: "Media/Abilities/GASLIMIT.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Critical Patch",
    description: "Deploys a critical patch, significantly buffing all allies and debuffing all enemies.",
    thumbnail: "Media/Abilities/CRITICALPATCH.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Light Node Run',
    description: "Increases movement speed.",
    thumbnail: "Media/Abilities/LNRUN.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Investigation",
    description: "Buffs self and allies based on revealed enemy locations.",
    thumbnail: "Media/Abilities/CRYPTOINVESTIGATION.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Criminal Hunt ",
    description: "Deals extra damage to recently revealed enemies.",
    thumbnail: "Media/Abilities/CRIMINALHUNT.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Transaction Trace",
    description: "Temporarily reduces enemy speed and reveals weak points.",
    thumbnail: "Media/Abilities/TXTRACE.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Drain",
    description: "Drains multiple protocols simultaneously, dealing massive damage to all enemies and providing significant resources to allies.",
    thumbnail: "Media/Abilities/DRAIN.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "NFT Masterpiece",
    description: "Creates a stunning piece of digital art that distracts enemies and boosts allies' morale.",
    thumbnail: "Media/Abilities/NFTMASTERPIECE.png",
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale Alert",
    description: "Marks the strongest enemy, increasing damage dealt to them",
    thumbnail: "Media/Abilities/WHALEALERT.png",
    effect(user) { 
        this.update = () => {}
        // Implement the effect logic here
    }
},
{
    title: "Smart Contract Deployment",
    description: "Deploys a smart contract to trap and damage enemies.",
    thumbnail: 'Media/Abilities/SMARTCONTRACT.png',
    effect(user) { 
        this.update = () => {}
        // Implement the effect logic here
    }
},
{
    title: "Smart Contract Audit",
    description: "Identifies and negates enemy traps.",
    thumbnail: 'Media/Abilities/SMARTCONTRACTAUDIT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Smart Contract Hack",
    description: "Deals consistent damage over time to enemies.",
    thumbnail: 'Media/Abilities/SMARTCONTRACTHACK.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Quantum Key Exchange 🔑",
    description: "Transfers health from enemies to the player.",
    thumbnail: 'Media/Abilities/QKEYEX.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bot Armada",
    description: "Summons an entire armada of bots for massive support and damage.",
    thumbnail: 'Media/Abilities/ARMADA.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "MEV Bot",
    description: "Drains health from enemies based on their movements.",
    thumbnail: 'Media/Abilities/MEVBOT.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Fear Spread",
    description: "Spreads fear, causing enemies to flee in random directions.",
    thumbnail: 'Media/Abilities/FEAR.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "FUD Storm",
    description: "Creates confusion among enemies, reducing their effectiveness.",
    thumbnail: 'Media/Abilities/FUDSTORM.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "White Paper",
    description: "Grants temporary immunity to damage.",
    thumbnail: 'Media/Abilities/WHITEPAPER.png',
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Yellow Paper",
    description: "Grants temporary immunity to damage.",
    thumbnail: 'Media/Abilities/YELLOWPAPER.png',
    effect(user) { 
        this.update = () => {}
    },
},


];
---------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------
                              Survivors Blueprint
---------------------------------------------------------------------------*/
import { playerTypes } from './playerTypes.js';
/*---------------------------------------------------------------------------
                              Enemies Blueprints
---------------------------------------------------------------------------*/
const enemyTypes = [{
    class: 'Enemy',
    title: 'Basic',
    health: 1,
    movementspeed:0.15,
    xp: 0,
    evasion: 0,
    tags: ['enemy'],
    thumbnail: 0,
    abilities: [
    //{"title": "Frontrunning Bot"}
    ],
    level:0,
}
];
/*---------------------------------------------------------------------------
                              Challenges Blueprints
---------------------------------------------------------------------------*/
const challengeTypes = [{
    title:"Timer",
    target: 300,
    status: null,
    initialize(){
    this.countdown = this.target * 60;
    },
    update(){
        this.countdown--;
        time++
        if(this.countdown<=0){
            isPaused=true;  
            canMove= false;
            hideUI();
            setTimeout(() => { triggerGameOver("Survivor Notice","Dear Survivor, we proudly inform that you beat \n the challenge and this run is completed.\n\n "); }, 1000);
            return;
        }
        const seconds = Math.floor(this.countdown / 60);
        const mseconds = this.countdown % 60;
        challengeDisplay.innerText = `${seconds}:${mseconds < 10 ? '0' : ''}${mseconds}`;
        
    },
},
{
    title:"Eliminate",
    target: null,
},
{
    title:"Collect",
    target:null,
},
{
    title:"Find",
    target:null,
},
{
    title:"Collect",
    target:null,
},
{
    title:"Level",
    target:null,
},
];
/*---------------------------------------------------------------------------
                              Worlds Blueprints
---------------------------------------------------------------------------*/

const worldTypes = [
    {title: 'The Dark Forest',
    class: 'World',
    description:'Survive in Ethereum, an open, futuristic landscape where data flows freely. Be aware of whats lurking in the dark!',
    thumbnail: 'Media/Worlds/ETHEREUMVERSE.png',
    challenge:challengeTypes[0],
    material:new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
        uniform float time;
        varying vec2 vUv;
    
        vec3 rainbowColor(float t) {
            return vec3(
                0.5 + 0.5 * cos(6.28318 * (t + 0.0)),
                0.5 + 0.5 * cos(6.28318 * (t + 0.33)),
                0.5 + 0.5 * cos(6.28318 * (t + 0.66))
            );
        }
    
        void main() {
            float t = vUv.y + time * 0.2;
            gl_FragColor = vec4(rainbowColor(t), 1.0);
        }
    `,
        side: THREE.DoubleSide,
        wireframe:true,
    }),
    playerMaterial:new THREE.MeshPhysicalMaterial({
        envMap: null, 
        reflectivity: 1,
        roughness: 0,
        metalness: 1,
        clearcoat: 0.13,
        clearcoatRoughness: 0.1,
        transmission: 0.82,
        ior: 2.75, 
        thickness: 10,
        sheen: 1,
        color: new THREE.Color('transparent'),
        wireframe : true,
        emissive: 0xffffff, 
        emissiveIntensity: 0.25
    }),
    enemyMaterial:new THREE.MeshPhysicalMaterial({
        envMap: null, 
        reflectivity: 1,
        roughness: 0,
        metalness: 1,
        clearcoat: 0.13,
        clearcoatRoughness: 0.1,
        transmission: 0.82,
        ior: 2.75, 
        thickness: 10,
        sheen: 1,
        color: new THREE.Color('white'),
        wireframe : true,
        emissive: 0x0ff00, 
        emissiveIntensity: 2 
    }),
    gridMaterial:null,
    backgroundColor:new THREE.Color(0x000000),
    texturePath:'Media/Textures/ENVTEXTURE.png' ,
    setup: function(scene, camera, renderer) {
        this.challenge.initialize();
        scene.background = this.backgroundColor;
        this.renderScene = new THREE.RenderPass(scene, camera);
        this.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), .75, .5, 0.01); 
        composer.addPass(this.renderScene);
        composer.addPass(this.bloomPass);
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();
        this.envTexture = new THREE.TextureLoader().load(this.texturePath, texture => {
            this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
            this.pmremGenerator.dispose();
            scene.environment = this.envMap; 
        });
 
            this.gridSize = 5; 
            this.divisions = 1; 
            this.numTiles = 25; 
        
            this.gridGeometry = new THREE.PlaneGeometry( this.gridSize,  this.gridSize,  this.divisions,  this.divisions);
        
            this.lightSourceTextureSize = 256; 
            this.lightSourceTextureData = new Float32Array( this.lightSourceTextureSize *  this.lightSourceTextureSize * 4);
            this.lightSourceTexture = new THREE.DataTexture( this.lightSourceTextureData,  this.lightSourceTextureSize,  this.lightSourceTextureSize, THREE.RGBAFormat, THREE.FloatType);
            this.lightSourceTexture.needsUpdate = true;
            this.gridMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    playerInfluenceRadius: { value: 75 } ,
                    time: { value: 0 },
                    playerPosition: { value: new THREE.Vector3() },
                    lightSourceTexture: { value:  this.lightSourceTexture },
                    lightSourceCount: { value: 0 },
                    lightSourceTextureSize: { value:  this.lightSourceTextureSize },
                },
                vertexShader: `
                    uniform vec3 playerPosition;
                    uniform sampler2D lightSourceTexture;
                    uniform int lightSourceCount;
                    uniform float time;
            
                    attribute vec2 offset;
            
                    varying vec3 vWorldPos;
                    varying vec2 vUv; 
            
                    void main() {
                        vec3 pos = position;
                        pos.x += offset.x;
                        pos.z += offset.y;
                        vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 playerPosition;
                    uniform sampler2D lightSourceTexture;
                    uniform int lightSourceCount;
                    uniform int lightSourceTextureSize;
                    uniform float time;
                    uniform float playerInfluenceRadius;
            
                    varying vec3 vWorldPos;
                    varying vec2 vUv;
            
                    vec3 hsv2rgb(vec3 c) {
                        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                    }
            
                    vec3 rainbowColor(float t) {
                        return vec3(
                            0.5 + 0.5 * cos(6.28318 * (t + 0.0)),
                            0.5 + 0.5 * cos(6.28318 * (t + 0.33)),
                            0.5 + 0.5 * cos(6.28318 * (t + 0.66))
                        );
                    }
            
                    void main() {
                        float distanceToPlayer = distance(vWorldPos.xz, playerPosition.xz);
                        float lightSourceInfluence = 0.0;
            
                        for (int i = 0; i < lightSourceCount; i++) {
                            int x = i % lightSourceTextureSize;
                            int y = i / lightSourceTextureSize;
                            vec2 uv = vec2(float(x) / float(lightSourceTextureSize), float(y) / float(lightSourceTextureSize));
                            vec3 lightPos = texture(lightSourceTexture, uv).xyz;
                            float dist = distance(vWorldPos.xz, lightPos.xz);
                            lightSourceInfluence += smoothstep(8.0, 1.0, dist);
                        }
            
                        vec2 cellCoord = floor(vUv);
                        float hue = mod((cellCoord.x + cellCoord.y) * 0.1 + time * 0.1, 1.0);
                        float brightness = max(smoothstep(playerInfluenceRadius, 0.0, distanceToPlayer), lightSourceInfluence);
                        
                        // Apply the rainbow effect using the time uniform
                        vec3 color = rainbowColor(hue + time * 0.1) * brightness;
            
                        gl_FragColor = vec4(color, 1.0); 
                    }
                `,
                wireframe: true
            });
            
            const offsets = [];
            const halfTiles = Math.floor( this.numTiles / 2);
        
            for (let x = -halfTiles; x <= halfTiles; x++) {
                for (let z = -halfTiles; z <= halfTiles; z++) {
                    offsets.push(x *  this.gridSize, z *  this.gridSize);  
                }
            }
        
            const offsetAttribute = new THREE.InstancedBufferAttribute(new Float32Array(offsets), 2);
            this.gridGeometry.setAttribute('offset', offsetAttribute); 
            this.gridGeometry.rotateX(-Math.PI / 2);
            this.gridMesh = new THREE.InstancedMesh( this.gridGeometry,  this.gridMaterial, offsets.length / 2);
            scene.add( this.gridMesh);
        
            this.radiusTarget = 100;
            this.radiusDirection = 1;

    this.octahedronGeometry = new THREE.OctahedronGeometry(1);
    this.octahedronGeometry.scale(5.6,5.25,3.75); 
    this.octahedronMesh = new THREE.Mesh(this.octahedronGeometry, this.material);
    scene.add(this.octahedronMesh);   
    this.octahedronMesh2 = new THREE.Mesh(this.octahedronGeometry, this.material);
    scene.add(this.octahedronMesh2); 

    const cameraX = 0+ cameraRadius * Math.cos(cameraAngle);
    const cameraZ = 0+ cameraRadius * Math.sin(cameraAngle);
    camera.position.set(cameraX, 0, cameraZ);
    camera.lookAt(this.octahedronMesh.position);

    this.miniOctahedrons = [];
    const miniOctahedronGeometry = new THREE.OctahedronGeometry(0.25);
    const miniOctahedronMaterial = this.material;
    miniOctahedronGeometry.scale(0.5,0.75,0.5)
    let numCrystals = 750;
    
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    const possibleRadii = [1, 25, 50];
    const radiusx = possibleRadii[Math.floor(Math.random() * possibleRadii.length)];
    const radiusy = possibleRadii[Math.floor(Math.random() * possibleRadii.length)];
    const radiusz = possibleRadii[Math.floor(Math.random() * possibleRadii.length)];

    const possibleRoot = [1,2,3];
    const possibleSqrt = [0.1,0.5,1,2];

    const root =possibleRoot[Math.floor(Math.random() * possibleRoot.length)];
    const Sqrt =possibleSqrt[Math.floor(Math.random() * possibleSqrt.length)];

    for (let i = 0; i < numCrystals; i++) {
        this.miniOctahedron = new THREE.Mesh(miniOctahedronGeometry, miniOctahedronMaterial);

        const y = 1 - (i / (numCrystals - 1)) * root; 
        const radius = Math.sqrt(Sqrt - y * y); 

        const phi = goldenAngle * i; 
        const theta = Math.atan2(radius, y); 

        this.miniOctahedron.position.set(
            radiusx* Math.cos(phi) * Math.sin(theta),
            radiusy* y,
            radiusz* Math.sin(phi) * Math.sin(theta)
        );
 
        this.miniOctahedron.rotation.set(
            Math.random() * 2 * Math.PI,
            Math.random() * 2 * Math.PI,
            Math.random() * 2 * Math.PI
        );

        scene.add(this.miniOctahedron);
        this.miniOctahedrons.push(this.miniOctahedron);

    }

this.sceneObjects = [];
this.sceneObjects.push(this.gridMesh);
this.sceneObjects.push(this.octahedronMesh);
this.sceneObjects.push(this.octahedronMesh2);
this.miniOctahedrons.forEach(miniOctahedron => this.sceneObjects.push(miniOctahedron)); 
this.orbitSpeed = 0.5;
this.attractionSpeed = 0.025;
this.rotationIncrement = 0.005;
this.miniRotationIncrement = 0.01;
this.scaleDecayFactor = 0.95;
this.miniScaleSpeed = 0.005;
this.radiusSpeed = 0.50;
this.gridRotationSpeed = 0.002;
this.scaleThreshold = 0.3;
this.meshScaleThreshold = 0.1;
},
    update: function(scene, camera, renderer) {
        const timeNow = Date.now() * 0.001;
        this.material.uniforms.time.value += 0.01;
        this.gridMaterial.uniforms.time.value += 0.01;
        this.gridMaterial.uniforms.playerPosition.value.copy(player.position);

        const playerGridX = Math.floor(player.position.x / this.gridSize) * this.gridSize;
        const playerGridZ = Math.floor(player.position.z / this.gridSize) * this.gridSize;
        this.gridMesh.position.set(playerGridX, 0, playerGridZ);

        if (isMainMenu) {
            if (player.mesh) player.mesh.scale.set(0, 0, 0);
    
            this.gridMesh.position.set(playerGridX, this.axisY, playerGridZ);
            this.gridGeometry.rotateY(this.gridRotationSpeed);
            
            this.octahedronMesh.rotation.z -= this.rotationIncrement;
            this.octahedronMesh2.rotation.z += this.rotationIncrement;
    
            this.miniOctahedrons.forEach((miniOctahedron, index) => {
                miniOctahedron.rotation.x += this.miniRotationIncrement;
                miniOctahedron.rotation.y += this.miniRotationIncrement;
    
                const orbitRadius = miniOctahedron.position.distanceTo(this.octahedronMesh.position);
                const phi = Math.PI * index / this.miniOctahedrons.length;
                const theta = Math.sqrt(this.miniOctahedrons.length * Math.PI) * phi;
                const angle = timeNow * this.orbitSpeed;
    
                miniOctahedron.position.set(
                    this.octahedronMesh.position.x + orbitRadius * Math.cos(angle + theta) * Math.sin(phi),
                    this.octahedronMesh.position.y + orbitRadius * Math.cos(phi),
                    this.octahedronMesh.position.z + orbitRadius * Math.sin(angle + theta) * Math.sin(phi)
                );
    
                const direction = miniOctahedron.position.clone().normalize().negate();
                if (miniOctahedron.position.length() > 1) {
                    miniOctahedron.position.addScaledVector(direction, this.attractionSpeed);
                }
            });
        } else if (this.miniOctahedrons.length > 1) {
            this.octahedronMesh.scale.multiplyScalar(this.scaleDecayFactor);
            this.octahedronMesh2.scale.multiplyScalar(this.scaleDecayFactor);
    
            if (this.octahedronMesh.scale.x <= this.meshScaleThreshold) {
                scene.remove(this.octahedronMesh, this.octahedronMesh2);
            }
    
            this.miniOctahedrons.forEach((miniOctahedron, index) => {
                miniOctahedron.position.addScaledVector(
                    miniOctahedron.position.clone().sub(this.octahedronMesh.position).normalize(),
                    0.2
                );
                miniOctahedron.rotation.x += this.miniRotationIncrement;
                miniOctahedron.rotation.y += this.miniRotationIncrement;
                miniOctahedron.scale.multiplyScalar(1 - this.miniScaleSpeed);
    
                if (miniOctahedron.scale.x <= this.scaleThreshold) {
                    scene.remove(miniOctahedron);
                    this.miniOctahedrons.splice(index, 1);
                }
            });
        }

            this.lightSourceIndex = 0;
            const illuminatingPositions = [];
            illuminatingPositions.push(player.position); 

            const addLightSource = (obj) => {
                if (obj.visible && this.lightSourceIndex < this.lightSourceTextureSize * this.lightSourceTextureSize) {
                    this.lightSourceTextureData.set([obj.position.x, obj.position.y, obj.position.z], this.lightSourceIndex * 4);
                    this.lightSourceIndex++;
                    illuminatingPositions.push(obj.position);
                }
            };
            droppedItems.forEach(item => {
                addLightSource(item); 
            });
            lightObjects.forEach(item => {
                addLightSource(item); 
            });

            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                let isVisible = false;
                for (let j = 0; j < illuminatingPositions.length; j++) {
                    const lightPos = illuminatingPositions[j];
                    const distanceToLight = enemy.position.distanceTo(lightPos);
                    if (distanceToLight <= (player.influenceRadius-1)) { 
                        isVisible = true;
                        break; 
                    }
                }
                enemy.visible = isVisible; 
            }

        this.lightSourceTexture.needsUpdate = true;
        this.gridMaterial.uniforms.lightSourceCount.value = this.lightSourceIndex;
    
        if (!isMainMenu) {
            const influenceRadius = this.gridMaterial.uniforms.playerInfluenceRadius.value;
            if (this.radiusDirection === 1 && influenceRadius < this.radiusTarget) {
                this.gridGeometry.rotateY(this.gridRotationSpeed);
                this.gridMaterial.uniforms.playerInfluenceRadius.value += this.radiusSpeed;
            } else if (this.radiusDirection === -1 && influenceRadius > player.influenceRadius) {
                this.gridGeometry.rotateY(this.gridRotationSpeed);
                this.gridMaterial.uniforms.playerInfluenceRadius.value -= this.radiusSpeed;
            } else {
                if (this.radiusDirection === 1) {
                    this.radiusDirection = -1;
                    this.radiusTarget = player.influenceRadius;
                } else {
                    this.radiusDirection = 0;
                }
            }
        }
       this.gridGeometry.rotateY(-Math.PI / 2 + 0.002); 
    },
    resumeGame: function(){
        player.mesh.scale.set(2.5,2.5,2.5);
    }  
},
{title: 'Digital Goldland',
    class: 'World',
    description:'Outlast 1000 Survivors in the Bitcoin world, where everything gleams in easily gained (and lost) virtual gold.',
    thumbnail: 'Media/Worlds/GOLDLAND.jpg',
    material: new THREE.MeshPhysicalMaterial({
        reflectivity: 1.0,          
        roughness: 0,            
        metalness: 1.0,            
        clearcoat: 1.0,            
        clearcoatRoughness: 0.05,   
        transmission: 0.0,         
        ior: 1.45,                  
        thickness: 0.0,          
        sheen: new THREE.Color('gold'), 
        sheenRoughness: 0.2,       
        color: new THREE.Color(0xffd700), 
        emissive: new THREE.Color(0x331a00),  
        emissiveIntensity: 0.3,    
        envMapIntensity: 2.0,      
        sheenRoughness: 0.1         
    }),
    setup: function(scene, camera, renderer) {
        this.renderScene = new THREE.RenderPass(scene, camera);
        this.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), .05, .5, 0.01); 
        this.afterimagePass = new THREE.AfterimagePass(.8);
        composer.addPass(this.renderScene);
        composer.addPass(this.bloomPass);
        composer.addPass(this.afterimagePass); 

        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();
        
        //Terrible hack HDR  until i find a good HDR pic 
        this.envTexture = new THREE.TextureLoader().load('Media/HDR.png', texture => {
            this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
            this.pmremGenerator.dispose();
            scene.environment = this.envMap; 
        });
 
            this.gridSize = 15; 
            this.divisions = 1; 
            this.numTiles = 7;

        const pointLight = new THREE.PointLight(0xffffff, .5);
        pointLight.position.set(10, 10, 10); 
        scene.add(pointLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, .1); 
        directionalLight.position.set(-5, 5, 5); 
        scene.add(directionalLight);

        const ambientLight = new THREE.AmbientLight(0x404040, 0.3); 
        scene.add(ambientLight);

        this.gridGeometry = new THREE.PlaneGeometry( this.gridSize,  this.gridSize,  this.divisions,  this.divisions);
            this.lightSourceTextureSize = 256; 
            this.lightSourceTextureData = new Float32Array( this.lightSourceTextureSize *  this.lightSourceTextureSize * 4);
            this.lightSourceTexture = new THREE.DataTexture( this.lightSourceTextureData,  this.lightSourceTextureSize,  this.lightSourceTextureSize, THREE.RGBAFormat, THREE.FloatType);
            this.lightSourceTexture.needsUpdate = true;
            this.gridMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    playerInfluenceRadius: { value: 1 },
                    time: { value: 0 },
                    playerPosition: { value: new THREE.Vector3() },
                    lightSourceTexture: { value: this.lightSourceTexture },
                    lightSourceCount: { value: 0 },
                    lightSourceTextureSize: { value: this.lightSourceTextureSize },
                    goldColor: { value: new THREE.Color('gold') },
                    reflectivity: { value: 0.9 }, 
                    shininess: { value: 1000 }, 
                    emissiveColor: { value: new THREE.Color(0xffcc00) }, 
                    rippleOrigin: { value: new THREE.Vector2(0.0, 0.0) }, 
                    rippleAmplitude: { value: 1 }, 
                    rippleFrequency: { value: 2 }, 
                    rippleSpeed: { value: 1.0 } 
                },
                vertexShader: `
                uniform vec3 playerPosition;
                uniform float time;
                uniform vec2 rippleOrigin;
                uniform float rippleAmplitude;
                uniform float rippleFrequency;
                uniform float rippleSpeed;
            
                attribute vec2 offset;
            
                varying vec3 vWorldPos;
                varying vec2 vUv;
                varying vec3 vNormal; // Declare vNormal as a varying
            
                void main() {
                    vec3 pos = position;
                    pos.x += offset.x;
                    pos.z += offset.y;
            
                    // Calculate ripple effect
                    float distanceToOrigin = distance(pos.xz, rippleOrigin);
                    float rippleEffect = rippleAmplitude * sin(rippleFrequency * distanceToOrigin - rippleSpeed * time);
                   // pos.y += rippleEffect; 
            
                    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
                    vUv = uv;
            
                    // Calculate vNormal
                    vNormal = normalize(normalMatrix * normal);
            
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
                fragmentShader: `
                    uniform vec3 playerPosition;
                    uniform sampler2D lightSourceTexture;
                    uniform int lightSourceCount;
                    uniform int lightSourceTextureSize;
                    uniform float time;
                    uniform float playerInfluenceRadius;
                    uniform vec3 goldColor;
                    uniform float reflectivity;
                    uniform float shininess;
                    uniform vec3 emissiveColor;
                    uniform vec2 rippleOrigin;
                    uniform float rippleAmplitude;
                    uniform float rippleFrequency;
                    uniform float rippleSpeed;
            
                    varying vec3 vWorldPos;
                    varying vec2 vUv;
                    varying vec3 vNormal;
            
                    // Convert HSV to RGB
                    vec3 hsv2rgb(vec3 c) {
                        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                    }
            
                    void main() {
                        float distanceToPlayer = distance(vWorldPos.xz, playerPosition.xz);
                        float lightSourceInfluence = 0.0;
            
                        // Light sources influence
                        for (int i = 0; i < lightSourceCount; i++) {
                            int x = i % lightSourceTextureSize;
                            int y = i / lightSourceTextureSize;
                            vec2 uv = vec2(float(x) / float(lightSourceTextureSize), float(y) / float(lightSourceTextureSize));
                            vec3 lightPos = texture(lightSourceTexture, uv).xyz;
                            float dist = distance(vWorldPos.xz, lightPos.xz);
                            lightSourceInfluence += smoothstep(2.5, 0.0, dist);
                        }
            
                        // Lighting calculation
                        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0)); 
                        vec3 viewDir = normalize(-vWorldPos);
                        vec3 reflectDir = reflect(-lightDir, vNormal);
                        float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
            
                        // Ripple effect
                        float distanceToOrigin = distance(vWorldPos.xz, rippleOrigin);
                        float rippleEffect = rippleAmplitude * sin(rippleFrequency * distanceToOrigin - rippleSpeed * time);
                        
                        // Create a temporary position variable
                        vec3 modifiedWorldPos = vWorldPos;
                        modifiedWorldPos.y += rippleEffect; // Apply ripple to the temporary variable
            
                        vec3 color = goldColor;
                        
                        // Increase brightness closer to player
                        float rippleIntensity = smoothstep(5.0, 0.0, distanceToPlayer);
                        color = mix(color, vec3(1.0, 0.8, 0.0), rippleIntensity * 0.5);
            
                        // Emissive glowing gridlines
                        vec2 cellCoord = floor(vUv);
                        float hue = mod((cellCoord.x + cellCoord.y) * 0.1 + time * 0.1, 1.0);
                        float brightness = max(smoothstep(playerInfluenceRadius, 0.0, distanceToPlayer), lightSourceInfluence);
            
                        vec3 emissiveGlow = emissiveColor * rippleIntensity;
                        color = color * brightness + emissiveGlow + spec * reflectivity * vec3(1.0, 0.9, 0.7);
            
                        gl_FragColor = vec4(color, 1.0); 
                    }
                `,
            });
            
            const offsets = [];
            const halfTiles = Math.floor( this.numTiles / 2);
        
            for (let x = -halfTiles; x <= halfTiles; x++) {
                for (let z = -halfTiles; z <= halfTiles; z++) {
                    offsets.push(x *  this.gridSize, z *  this.gridSize);  
                }
            }
        
            const offsetAttribute = new THREE.InstancedBufferAttribute(new Float32Array(offsets), 2);
            this.gridGeometry.setAttribute('offset', offsetAttribute); 
            this.gridGeometry.rotateX(-Math.PI / 2);
            this.gridMesh = new THREE.InstancedMesh( this.gridGeometry,  this.gridMaterial, offsets.length / 2);
            scene.add( this.gridMesh);
        
            this.radiusTarget = 100;
            this.radiusDirection = 1;
            const possibleY = [-4,4];
            this.axisY =possibleY[Math.floor(Math.random() * possibleY.length)];

    this.octahedronGeometry = new THREE.SphereGeometry(1);
    this.octahedronGeometry.scale(4,4,4); 
            
    this.octahedronMesh = new THREE.Mesh(this.octahedronGeometry, this.material);
    scene.add(this.octahedronMesh);   
    this.octahedronMesh.scale.set(0, 0, 0);

    const cameraX = 0+ cameraRadius * Math.cos(cameraAngle);
    const cameraZ = 0+ cameraRadius * Math.sin(cameraAngle);
    camera.position.set(cameraX, cameraHeight, cameraZ);
    camera.lookAt(this.octahedronMesh.position);

    this.miniOctahedrons = [];
    const miniOctahedronGeometry =  new THREE.SphereGeometry(1);
    const miniOctahedronMaterial = this.material.clone();

    miniOctahedronGeometry.scale(0.15,0.15,0.15)
    miniOctahedronMaterial.wireframe=false;
    let numCrystals = 1024;
  
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    const possibleRadii = [1, 25];
    const radiusx = possibleRadii[Math.floor(Math.random() * possibleRadii.length)];
    const radiusy = possibleRadii[Math.floor(Math.random() * possibleRadii.length)];
    const radiusz = possibleRadii[Math.floor(Math.random() * possibleRadii.length)];

    const possibleRoot = [1,2,3];
    const possibleSqrt = [0.1,0.5,1,2];

    const root =possibleRoot[Math.floor(Math.random() * possibleRoot.length)];
    const Sqrt =possibleSqrt[Math.floor(Math.random() * possibleSqrt.length)];

    for (let i = 0; i < numCrystals; i++) {
        this.miniOctahedron = new THREE.Mesh(miniOctahedronGeometry, miniOctahedronMaterial);

        const y = 1 - (i / (numCrystals - 1)) * root; 
        const radius = Math.sqrt(Sqrt - y * y); 

        const phi = goldenAngle * i; 
        const theta = Math.atan2(radius, y); 

        this.miniOctahedron.position.set(
            radiusx* Math.cos(phi) * Math.sin(theta),
            radiusy* y,
            radiusz* Math.sin(phi) * Math.sin(theta)
        );
 
        this.miniOctahedron.rotation.set(
            Math.random() * 2 * Math.PI,
            Math.random() * 2 * Math.PI,
            Math.random() * 2 * Math.PI
        );

        scene.add(this.miniOctahedron);
        this.miniOctahedrons.push(this.miniOctahedron);

    }

this.sceneObjects = [];
this.sceneObjects.push(this.gridMesh);
this.sceneObjects.push(this.octahedronMesh);
this.miniOctahedrons.forEach(miniOctahedron => this.sceneObjects.push(miniOctahedron)); 
this.frameCount = 0;
},
    update: function(scene, camera, renderer) {
       // this.frameCount++;
      //  if (this.frameCount % 3 !== 0) return;  
    
        this.gridMaterial.uniforms.time.value = performance.now() / 1000; 
 
        if(isMainMenu){
            this.octahedronMesh.rotation.z -= 0.005;

            player.rotation.y += 0.005;
            player.rotation.y = player.rotation.y % (2 * Math.PI); 
    
            this.miniOctahedrons.forEach((miniOctahedron,index) => {
            miniOctahedron.rotation.x += 0.01;
            miniOctahedron.rotation.y += 0.01;
            const orbitSpeed = 0.5;
            const orbitRadius = miniOctahedron.position.distanceTo(this.octahedronMesh.position);
            const phi = Math.PI * index / this.miniOctahedrons.length;
            const theta = Math.sqrt(this.miniOctahedrons.length * Math.PI) * phi;
            const angle = Date.now() * 0.001 * orbitSpeed;
            miniOctahedron.position.set(
                this.octahedronMesh.position.x + orbitRadius * Math.cos(angle + theta) * Math.sin(phi),
                this.octahedronMesh.position.y + orbitRadius * Math.cos(phi),
                this.octahedronMesh.position.z +  orbitRadius * Math.sin(angle + theta) * Math.sin(phi),
            );
            const direction = new THREE.Vector3(0, 0, 0).sub(miniOctahedron.position).normalize();
            const attractionSpeed = 0.025;
            const distanceToCenter = miniOctahedron.position.distanceTo(new THREE.Vector3(0, 0, 0));
            if (distanceToCenter > 1) { 
                miniOctahedron.position.addScaledVector(direction, attractionSpeed);
            }
        });
        }else if (this.miniOctahedrons.length>1){
            this.octahedronMesh.scale.multiplyScalar(1 - 0.05); 
 
            if (this.octahedronMesh.scale.x <= 0.1) { 
                scene.remove(this.octahedronMesh); 
            }
            this.miniOctahedrons.forEach((miniOctahedron,index) => {
                const direction = new THREE.Vector3().subVectors(miniOctahedron.position, this.octahedronMesh.position).normalize();
                const speed = 0.1; 
                miniOctahedron.position.addScaledVector(direction, speed); 
                miniOctahedron.rotation.x += 0.01;
                miniOctahedron.rotation.y += 0.01;
                const scaleSpeed = 0.005;
                miniOctahedron.scale.multiplyScalar(1 - scaleSpeed); 
                if (miniOctahedron.scale.x <= 0.3) { 
                     scene.remove(miniOctahedron); 
                     this.miniOctahedrons.splice(index, 1);
                }
            });
        }

        this.gridMaterial.uniforms.time.value += 0.01;
        this.gridMaterial.uniforms.playerPosition.value.copy(player.position);
        this.lightSourceIndex = 0;
    
            this.lightSourceTexture.needsUpdate = true;
            this.gridMaterial.uniforms.lightSourceCount.value =  this.lightSourceIndex;
            const playerGridX = Math.floor(player.position.x /  this.gridSize) *  this.gridSize;
            const playerGridZ = Math.floor(player.position.z /  this.gridSize) *  this.gridSize;
            this.gridMesh.position.set(playerGridX, 0, playerGridZ);

    
            if (isMainMenu) {
                this.gridMesh.position.set(playerGridX,  0, playerGridZ);
            } else {
                if ( this.radiusDirection === 1 &&  this.gridMaterial.uniforms.playerInfluenceRadius.value <  this.radiusTarget) {
                    this.gridMaterial.uniforms.playerInfluenceRadius.value += 0.50; 
                } else if ( this.radiusDirection === -1 &&  this.gridMaterial.uniforms.playerInfluenceRadius.value > 10) {
                    this.gridMaterial.uniforms.playerInfluenceRadius.value -= 0.50;
                } else {
                    if ( this.radiusDirection === 1) {
                        this.radiusDirection = -1;  
                        this.radiusTarget = 10;  
                    } else {
                        this.radiusDirection = 0; 
                    }
                }
        }

       /// this.gridGeometry.rotateY(-Math.PI / 2 + 0.002); 
    },
    resumeGame: function(){}  
}
];
/*---------------------------------------------------------------------------
                              Scene Initialization
---------------------------------------------------------------------------*/
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const canvas = document.getElementById('survivorCanvas');
const renderer = new THREE.WebGLRenderer({ canvas});
renderer.setPixelRatio(window.devicePixelRatio || 1);

const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    encoding: THREE.sRGBEncoding,
});
const composer = new THREE.EffectComposer(renderer,renderTarget);

function updateRendererSize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderTarget.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

updateRendererSize();
window.addEventListener('resize', updateRendererSize);
window.addEventListener('load', updateRendererSize);
/*---------------------------------------------------------------------------
                              World Controller
---------------------------------------------------------------------------*/
world = worldTypes[0];
world.setup(scene,camera,renderer);
/*---------------------------------------------------------------------------
                            Abilities Controller
---------------------------------------------------------------------------*/
ability = abilityTypes[1];
/*---------------------------------------------------------------------------
                              Player Controller
---------------------------------------------------------------------------*/
player = new Entity(playerTypes.find(type => type.title === 'Onchain Survivor'), new THREE.Vector3(0, 0, 0));

const direction = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const rotationAxis = new THREE.Vector3(0, 1, 0);  
const rotationSpeed = 0.1;
let dropUpdateFrame = 0; 

function createOrb(user) {
    const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 16, 6),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );

    orb.position.copy(user.position); 
    orb.updateMatrixWorld(true);
    orb.boundingBox = new THREE.Box3().setFromObject(orb);
    lightObjects.push(orb);
    scene.add(orb);

    const shootDirection = new THREE.Vector3().subVectors(closeEnemy, user.position).normalize();
    const shootSpeed = player.attackSpeed;
    const orbLifetime = player.attackLTL; 
    const startTime = Date.now();

    function updateOrb() {
        if (Date.now() - startTime > orbLifetime) {
            scene.remove(orb);
            const index = lightObjects.indexOf(orb);
            if (index > -1) lightObjects.splice(index, 1); 

            return;
        }
        orb.position.add(shootDirection.clone().multiplyScalar(shootSpeed));
        requestAnimationFrame(updateOrb);
        orb.boundingBox.setFromObject(orb);
    }
    
    updateOrb();

}


function updatePlayerMovement() {
    if (!canMove) return;
    direction.set(0, 0, 0);

    if (keys.s) direction.z -= 1;
    if (keys.w) direction.z += 1;
    if (keys.a) direction.x += 1;
    if (keys.d) direction.x -= 1;

    if (direction.lengthSq() > 0) { 
        isPaused = false;
        direction.normalize();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();
        moveDirection.copy(direction).applyAxisAngle(rotationAxis, Math.atan2(cameraDirection.x, cameraDirection.z));
        player.position.add(moveDirection.multiplyScalar(player.movementspeed));
        const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);

        const angleDifference = targetRotation - player.rotation.y;
        const adjustedAngle = ((angleDifference + Math.PI) % (2 * Math.PI)) - Math.PI;
        player.rotation.y += Math.sign(adjustedAngle) * Math.min(rotationSpeed, Math.abs(adjustedAngle));
        player.updateMesh();
        distance++;
    }

    const cosAngle = Math.cos(cameraAngle); 
    const sinAngle = Math.sin(cameraAngle);
    camera.position.set(
        player.position.x + cameraRadius * cosAngle,
        cameraHeight,
        player.position.z + cameraRadius * sinAngle
    );
    camera.lookAt(player.position);

    if(cameraHeight <= 30)
    cameraHeight+=0.25;

    player.updateAbilities();

    if (dropUpdateFrame++ % (60/ player.attackPerSecond) === 0) { 
        if (closeEnemy) {
            createOrb(player);
        }
    }

    for (let i = droppedItems.length - 1; i >= 0; i--) {
        const item = droppedItems[i];

        const directionToPlayer = new THREE.Vector3().subVectors(player.position, item.position).normalize();
        const distanceToPlayer = item.position.distanceTo(player.position);
        const attractionSpeed = 0.15; 
        if(distanceToPlayer<=player.influenceRadius)
        item.position.add(directionToPlayer.multiplyScalar(attractionSpeed));

        item.boundingBox.setFromObject(item);
        if (player.boundingBox.intersectsBox(item.boundingBox)) {
            scene.remove(item);  
            droppedItems.splice(i, 1); 
            player.xp += 1;
            experience += 1;
            xpLoadingBar.style.width = ((player.xp / player.xpToNextLevel) * 100) + '%';
            createParticleEffect(player.position, 'gold', 50);  
            if (player.xp >= player.xpToNextLevel) {
                player.xp = 0;  
                player.xpToNextLevel  =  player.xpToNextLevel + player.xpToNextLevel + player.xpToNextLevel ;  
                levels += 1
                chooseAbility();
            }
           // chooseAbility();
           // randomAbility();
        }
    }
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (player.boundingBox.intersectsBox(enemy.boundingBox)) {
               createParticleEffect(player.position, 'red', 5);  
               player.takeDamage(1);  
               hpBar.style.width = (player.health / player.maxhealth * 100) + '%';
            }
            lightObjects.forEach((lightObject) => {
                if (!lightObject.boundingBox) return;
                if (lightObject.boundingBox.intersectsBox(enemy.boundingBox)) {
                  enemy.takeDamage(1);  
                }
              }); 
                
        }    

}
function randomAbility() {
    const upgradableAbilities = player.getUpgradableAbilities();
    if (upgradableAbilities.length === 0) {
        canMove = true;
        isPaused = false;
        return;
    }

    const randomIndex = Math.floor(Math.random() * upgradableAbilities.length);
    const abilityToUpgrade = { ...upgradableAbilities[randomIndex] };
    player.addAbility(new Ability(player, { ...abilityToUpgrade}));
    hideUI();
    refreshDisplay();
}
function chooseAbility() {
    canMove = false;
    isPaused = true;
    hideUI();

    const upgradableAbilities = player.getUpgradableAbilities();

    if (upgradableAbilities.length === 0) {
        canMove = true;
        isPaused = false;
        return;
    }

    const upgradeOptions = [];
    for (let i = 0; i < 2 && upgradableAbilities.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * upgradableAbilities.length);
        const abilityToUpgrade = { ...upgradableAbilities[randomIndex] };
        upgradeOptions.push(abilityToUpgrade);
        upgradableAbilities.splice(randomIndex, 1);
    }
    createChooseMenu(upgradeOptions, "\nLevel Up! 🔱\n Choose one ability.", "Upgrade");
}


/*---------------------------------------------------------------------------
                              Enemies Controller
---------------------------------------------------------------------------*/

function updateEnemies() {
    let closestDistance = Infinity;
    let farthestDistance = 0;
    let sumPosition = new THREE.Vector3(); 

    playerPositionDifference.copy(player.position);

    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        enemydirection.copy(playerPositionDifference).sub(enemy.position).normalize();
        const distanceToPlayer = enemy.position.distanceTo(player.position);
    
        if (distanceToPlayer < closestDistance) {
            closestDistance = distanceToPlayer;
            closeEnemy.copy(enemy.position); 
        }
        if (distanceToPlayer > farthestDistance) {
            farthestDistance = distanceToPlayer;
            farEnemy.copy(enemy.position); 
        }

        sumPosition.add(enemy.position);

        for (let j = 0; j < enemies.length; j++) {
            if (i !== j) { 
                const otherEnemy = enemies[j];
                const distance = enemy.position.distanceTo(otherEnemy.position);
                const separationDistance = 5; 
                if (distance < separationDistance) {
                    const separationForce = enemy.position.clone().sub(otherEnemy.position).normalize();
                    enemydirection.addScaledVector(separationForce, (separationDistance - distance) * 0.5); 
                }
            }
        }

        enemy.position.addScaledVector(enemydirection, enemy.movementspeed / 2);
        enemy.rotation.y = Math.atan2(enemydirection.x, enemydirection.z);
        enemy.updateMesh();
    }

    if (enemies.length > 0) {
        centerEnemy.copy(sumPosition.divideScalar(enemies.length));
    }
}


function startSpawningEnemies(player, spawnInterval = 500, spawnRadius = 50, numberOfEnemies =3) {
    const spawnEnemy = () => {
        if(isPaused) return;
        if(enemies.length >100) return;
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
            const enemy = new Entity(enemyConfig,new THREE.Vector3(spawnPosition.x, spawnPosition.y, spawnPosition.z));
            enemy.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.material = world.enemyMaterial;
                }
            });
            enemies.push(enemy);
        }
    };
    setInterval(spawnEnemy, spawnInterval);
}
startSpawningEnemies(player);

Entity.prototype.die = function() {
    handleEntityDeath(this, enemies);
    createParticleEffect(this.position);
};
/*---------------------------------------------------------------------------
                                UI UTILITIES 
---------------------------------------------------------------------------*/
const UI = {};

UI.createTitleElement = function(text, classCSS) {
    const element = document.createElement('div');
    element.innerText = text;
    element.classList.add(classCSS); 
    element.classList.add('rainbow-text'); 
    return element;
}

UI.createContainer = function(classNames = [], styles = {}) {
    const container = document.createElement('div');
    classNames.forEach(className => container.classList.add(className));
    Object.assign(container.style, styles);
    document.body.appendChild(container);
    return container;
}

UI.createTitleContainer= function (text) {
    const container = document.createElement('div');
    container.classList.add('choose-menu-title');
    const title = UI.createTitleElement(text, "title"); 
    container.appendChild(title);
    return container;
}

    function createButton(dataType, scale = 1, onClick) {
        const button = document.createElement('button');
        button.style.width = `${175 * scale}px`;
        button.style.margin = '3px';
        button.style.display = 'flex';
        button.style.flexDirection = 'column';
        button.style.alignItems = 'center';
        button.style.backgroundColor = 'black';
        button.style.overflow = 'hidden';
        button.style.padding = '0';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'Arial, sans-serif';

        button.style.border = '1px solid transparent'; 
        button.style.borderImageSlice = 1; 
        button.style.borderImageSource = 'linear-gradient(45deg, red, orange, yellow, green, deepskyblue, blueviolet, violet)'; 
    
        const title = document.createElement('div');
        title.innerText = dataType.title;
        title.style.fontSize = `${20 * scale}px`;
        title.classList.add('rainbow-text'); 
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
    
        const description = document.createElement('div');
        description.innerText = `${dataType.description}`;
        description.style.fontSize = `${14.5 * scale}px`;
        description.classList.add('rainbow-text'); 

        description.style.height = `${5 * scale}em`; 
        description.style.lineHeight = `${1 * scale}em`; 
        description.style.overflow = 'hidden'; 
        description.style.textAlign = 'center';
        description.style.alignItems = 'center'; 
        description.style.justifyContent = 'center';
        description.style.padding = `${5 * scale}px`;
        description.style.display = scale > 0.751 ? 'flex' : 'none'; 
    
        button.appendChild(title);
        button.appendChild(img);
        button.appendChild(description);
        
        if (onClick) button.onclick = onClick;

        if(dataType.isLocked){
      //  button.style.color = 'gray';
       // button.style.borderImageSource = 'linear-gradient(45deg, gray, gray)';
        button.style.cursor = 'not-allowed';
        button.style.opacity = '0.5';
        title.innerText="???"
       // title.style.color = 'gray';
       // description.style.color = 'gray';
        description.innerText="?????????????"
        button.style.animation = 'none';
        img.style.filter = 'blur(5px)';
    }
    
        return button;
    }

    function addContainerUI(location,uiElements){
        const container = document.createElement('div');
        document.body.appendChild(container);
        container.classList.add(location, 'fade-in');
        uiElements.forEach(element => {
            container.appendChild(element);
        });
        uiContainers.push(container);
        setTimeout(() => {container.classList.add('show'); }, 10);
        return container;
    }    

    function hideUI(){
        uiContainers.forEach(container => {
        container.classList.add('fade-out'); 
        setTimeout(() => { container.classList.add('hide'); }, 10);
        setTimeout(() => {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        container.parentNode.removeChild(container);
        }, 1000);
        })
        uiContainers.length = 0;
    }

    const spinningStates = {
        class: true,
        ability: true,
        world: true
    };
    
    function createRandomRunEffect(button, images, finalImageIndex, scale, category) {
        if (!spinningStates[category])
        return;
        const imgContainer = document.createElement('div');
        imgContainer.style.position = 'relative';
        imgContainer.style.height = `${150 * scale}px`; 
        imgContainer.style.width = `${150 * scale}px`; 
    
        images = images.concat(images); 
    
        images.forEach((src) => {
            const img = document.createElement('img');
            img.src = src;
            img.style.width = `${150 * scale}px`;
            img.style.height = `${150 * scale}px`;
            img.style.display = 'block';
            imgContainer.appendChild(img);
        });
    
        button.innerHTML = ''; 
        button.appendChild(imgContainer);
    
        const totalHeight = images.length * 150 * scale;
        let currentTop = 0;
        let speed = (Math.random() * 0.5 + 0.25) * Math.sign(Math.random() + 0.5);
        function spin() {
            if (spinningStates[category]) {
                currentTop -= speed;
                if (currentTop <= -totalHeight / 2) {
                    currentTop = 0;
                }
                imgContainer.style.transform = `translateY(${currentTop}px)`;
            }
            requestAnimationFrame(spin); 
        }
        spin();
        button.parentElement.addEventListener('click', () => {
            spinningStates[category] = false;
        });
    }


/*---------------------------------------------------------------------------
                                GAME TITLE 
---------------------------------------------------------------------------*/
    async function createGameTitle(){
        const mainTitle = UI.createTitleElement('🏆⚔️🔗\nOnchain Survivor','title');
        const worldTitle = UI.createTitleElement(world.title,"minititle");
        const miniTitle = UI.createTitleElement('Move to Start!', "minititle");
        const web3Title = UI.createTitleElement('♦️\nWeb3\n♦️',"subtitle");
        web3Title.style.cursor = 'pointer';
        const todaysContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });

    const challengeTitle = UI.createTitleElement(``, "minititle");
    
        const miniplayerButton = createButton(player, 0.4);
        const miniworldButton = createButton(world, 0.4);
        const miniabilityButton = createButton(ability,0.4);
        todaysContainer.appendChild(challengeTitle);
        todaysContainer.appendChild(miniplayerButton);
        todaysContainer.appendChild(miniabilityButton);
        todaysContainer.appendChild(miniworldButton);
        const subTitle = UI.createTitleElement('Move to Start!', "title");
        const aboutTitle = UI.createTitleElement('\n⚙️\n', "subtitle");

     

       addContainerUI('top-container', [mainTitle,worldTitle]);

        addContainerUI('BR-container', [aboutTitle]);
        aboutTitle.style.cursor = 'pointer';
        aboutTitle.onclick = () => {
            canMove = false;
            isPaused = true;
            hideUI();
            createSettingsMenu();
        }

        const loadingText =  UI.createTitleElement('New challenge 1:47:52', "minititle");

        addContainerUI('bottom-container', [miniTitle,todaysContainer,loadingText]);
        todaysContainer.style.cursor = 'pointer';
        todaysContainer.onclick = () => {
            canMove = false;
            isPaused = true;
            hideUI();
            createInfoMenu();
        }

        addContainerUI('TR-container', [web3Title]).onclick = async () => {
            if (window.ethereum) {
                const web3 = new Web3(window.ethereum);
                try {
                    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                    const accounts = await web3.eth.getAccounts();
                    const address = accounts[0];
     
                    let ensName = null;
                    try {
                        ensName = await web3.eth.ens.lookup(address);
                    } catch (error) {
                        console.error('Error looking up ENS:', error);
                    }
                    const displayName = ensName || address;
                    localStorage.setItem('metaMaskAddress', address); 
                    hideUI();
                    setTimeout(() => {
                        canMove = false;
                        isPaused = true;
                        createRunMenu();
                    }, 1100);
        
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
    };
    createGameTitle();
/*---------------------------------------------------------------------------
                                Challenge Editor
---------------------------------------------------------------------------*/
let selectedPlayer = playerTypes[0]; // previously Selected Class, LOAD FROM ETHEREUM
let selectedAbility = abilityTypes[0]; // previously Selected ability, LOAD FROM ETHEREUM
let selectedWorld = worldTypes[0]; // previously Selected world, LOAD FROM ETHEREUM 
let selectedValue = 0; // Default Value, Going for Next rank 

function createChallengeMenu() {
    const classImages = playerTypes.map(player => player.thumbnail);
    const abilityImages = abilityTypes.map(ability => ability.thumbnail);
    const worldImages = worldTypes.map(world => world.thumbnail);

    const classContainer = document.createElement('div');
    const classSubTitle = UI.createTitleElement('🏆',  "subtitle")
    const classButton = createButton(selectedPlayer,  0.65);
    classContainer.appendChild(classButton);
    classContainer.appendChild(classSubTitle);

    const abilitiesSubTitle = UI.createTitleElement('⚔️', "subtitle");
    const abilitiesButton = createButton(selectedAbility,  0.65);
    const classAbilityContainer = document.createElement('div');
    classAbilityContainer.appendChild(abilitiesButton);
    classAbilityContainer.appendChild(abilitiesSubTitle);

    const worldSubTitle = UI.createTitleElement('🔗', "subtitle");
    const worldButton = createButton(selectedWorld, 0.65);
    const worldContainer = document.createElement('div');
    worldContainer.appendChild(worldButton);
    worldContainer.appendChild(worldSubTitle);

    const menuButtonsContainer =  UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(3, auto)' });
    menuButtonsContainer.appendChild(classContainer);
    menuButtonsContainer.appendChild(classAbilityContainer);
    menuButtonsContainer.appendChild(worldContainer);
    const subTitle = UI.createTitleElement('\nSend a Challenge!',  "title");

        menuButtonsContainer.childNodes.forEach(button => {
            button.addEventListener('click', () => {
                hideUI();
                canMove=false;
                if(button === classContainer)  createChooseMenu(playerTypes, "\nChoose a Survivor 🏆","Survivor");
                if(button === classAbilityContainer) createChooseMenu(abilityTypes, "\nChoose an Ability ⚔️","Ability");
                if(button === worldContainer) createChooseMenu(worldTypes, "\nChoose a Chain 🔗","World");
            });
        });

        const inputContainer = document.createElement('div');
        const sponsorAmount = createInput('number', { placeholder: '0.00Ξ, Rank: ----', id: 'sponsorAmount' });
        const submitButton = document.createElement('button'); 
        submitButton.classList.add('rainbow-button'); 
        submitButton.classList.add('subtitle'); 
        submitButton.innerText = 'Agree & Send';
        inputContainer.appendChild(sponsorAmount);
        //inputContainer.appendChild(submitButton); 
   
        sponsorAmount.addEventListener('input', async () => {
           const amount = sponsorAmount.value; 
           if (amount) {
             const rank = await fetchRankForAmount(web3.utils.toWei(amount, 'ether')); 
             if (rank !== null) {
               rankInfo.innerText = `Add ${amount}Ξ to reach rank ${rank}°!`; 
             } else {
               rankInfo.innerText = "Error fetching rank"; 
             }
           } else {
             rankInfo.innerText = "Enter an amount"; 
           }
         });

         const disclaimer = UI.createTitleElement('Participating in OnChain Survivor as a challenger or survivor, and interacting with the smart contracts, is NOT an investment opportunity\n\n   The game is solely for entertainment and experimental purposes, and participants should not expect financial returns.\n\n By sending any transaction to the smart contract, you confirm that you are not subject to any country-specific restrictions, regulatory limitations, or classified as a sanctioned entity.\n\n Special game events may occur that could temporarily freeze or stop the Challenge Queue, during which the 7,150 block rule may not apply.\n\n Additionally, game updates might increase or decrease the duration of daily challenges to accommodate potential downtimes or inconveniences of the player base.\n\n The rules are subject to modification based on special events, updates and unforeseen circumstances, always in favour of the players. Any changes in timing will be publicly communicated in official channels. \n\n Challenges can be edited as many times as desired (fees apply), as long as the challenge is still in the queue\n\n Transactions sent into the challenge queue are irreversible, please doublecheck before sending your challenge.  \n\n', "minititle")
         const popUpContainer = UI.createContainer(['choose-menu-container']);;
         popUpContainer.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
         popUpContainer.appendChild(subTitle); 

         popUpContainer.appendChild(menuButtonsContainer); 
         popUpContainer.appendChild(inputContainer); 
         const yourSpot = UI.createTitleElement('Add 0.01Ξ for Rank 24°.\n\n', "subtitle")
         popUpContainer.appendChild(yourSpot); 

         const fineprint = UI.createTitleElement('Terms and conditions:\n\n', "subtitle")
         popUpContainer.appendChild(fineprint); 
         popUpContainer.appendChild(disclaimer); 
         popUpContainer.appendChild(submitButton); 
         const support = UI.createTitleElement('\nYour challenges allow me develop full time! \nthanks, -the dev\n\n', "subtitle")
         popUpContainer.appendChild(support); 

        addContainerUI('center-container', [popUpContainer]);
        createRandomRunEffect(classButton, classImages, 110,  0.6 , "class"); 
        createRandomRunEffect(abilitiesButton, abilityImages, 0,  0.6 , "ability");
        createRandomRunEffect(worldButton, worldImages, 0,  0.6, "world");
    };
 //createChallengeMenu()
/*---------------------------------------------------------------------------
                        Generic Choose Menu
---------------------------------------------------------------------------*/
function createInput(type, attributes = {}) {
    const input = document.createElement('input');
    input.type = type; 

    for (const [key, value] of Object.entries(attributes)) {
        input.setAttribute(key, value);
    }
    input.classList.add('rainbow-input'); 
    input.classList.add('subtitle'); 
    return input;
}

function createChooseMenu(entityList, text, type) {
    const popUpContainer = UI.createContainer(['choose-menu-container']);;
    const titleContainer = UI.createTitleContainer(text);
    const gridContainer = UI.createContainer(['choose-menu-grid']); 
    addContainerUI('center-container', [popUpContainer]);
    entityList.forEach(entity => {
        const itemButton = createButton(entity, 1);
        gridContainer.appendChild(itemButton);
        itemButton.onclick = () => handleEntitySelection(entity, type);
    });
    popUpContainer.appendChild(titleContainer);
    popUpContainer.appendChild(gridContainer);
}


function handleEntitySelection(entity, type) {
    if (type === "Upgrade") {
        keys.w = keys.a = keys.s = keys.d = false;
        direction.set(0, 0, 0);
        player.addAbility(new Ability(player, { ...entity}));
        hideUI();
        refreshDisplay();
        canMove=true;
    } else if (entity.isLocked) {
        return;
    } else if (type === "Survivor")  {
        selectedPlayer = entity;
        hideUI();
        createChallengeMenu();
    } else if (type === "Ability") {
        selectedAbility = entity;
        hideUI();
        createChallengeMenu();
    } else if (type === "World") {
        selectedWorld = entity;
        hideUI();
        createChallengeMenu();
    }
}
/*---------------------------------------------------------------------------
                                    WEB3 Options  Menu
---------------------------------------------------------------------------*/
    function createWeb3Menu(address) {
        canMove=false;

        const subTitleLogout = UI.createTitleElement('♢\nLog Out\n♢', "subtitle");
        subTitleLogout.style.cursor = 'pointer';
        subTitleLogout.onclick = () => {
            canMove=true;
            localStorage.removeItem('metaMaskAddress');
            hideUI();
            createGameTitle();
        };

        const checkRanks = UI.createTitleElement('\nChallenge\nQueue',  "title")

        const topChallengerContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });
        topChallengerContainer.appendChild(UI.createTitleElement('\n#\nRank',"subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('\n🏆\nClass',"subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('\n⚔️\nSkill ',"subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('\n🔗\nChain ', "subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('1°',  "subtitle"));
        topChallengerContainer.appendChild(createButton(playerTypes[0], .6));
        topChallengerContainer.appendChild(createButton(abilityTypes[3], .6 ));
        topChallengerContainer.appendChild(createButton(worldTypes[0], .6 ));
        topChallengerContainer.appendChild(UI.createTitleElement('2°', "subtitle"));
        topChallengerContainer.appendChild(createButton(playerTypes[1], .5));
        topChallengerContainer.appendChild(createButton(abilityTypes[6], .5 ));
        topChallengerContainer.appendChild(createButton(worldTypes[1], .5 ));
        topChallengerContainer.appendChild(UI.createTitleElement('3°',"subtitle"));
        topChallengerContainer.appendChild(createButton(playerTypes[3], .4));
        topChallengerContainer.appendChild(createButton(abilityTypes[9], .4));
        topChallengerContainer.appendChild(createButton(worldTypes[1], .4));
        topChallengerContainer.appendChild(UI.createTitleElement('4°', "subtitle"));
        topChallengerContainer.appendChild(createButton(playerTypes[3], .3));
        topChallengerContainer.appendChild(createButton(abilityTypes[4], .3));
        topChallengerContainer.appendChild(createButton(worldTypes[0], .3));
        topChallengerContainer.appendChild(UI.createTitleElement('5°', "subtitle"));
        topChallengerContainer.appendChild(createButton(playerTypes[0], .2));
        topChallengerContainer.appendChild(createButton(abilityTypes[5], .2));
        topChallengerContainer.appendChild(createButton(worldTypes[0], .2));
   
        const buttons = topChallengerContainer.querySelectorAll('button');
        buttons.forEach(button => {
          button.style.cursor = 'default';
        });


        const classImages = playerTypes.map(player => player.thumbnail);
        const abilityImages = abilityTypes.map(ability => ability.thumbnail);
        const worldImages = worldTypes.map(world => world.thumbnail);
     
        const classContainer = document.createElement('div');
        const classSubTitle = UI.createTitleElement('\n🏆 ',  "subtitle");
        const classButton = createButton(player,  0.6);
        classContainer.appendChild(classSubTitle);
        classContainer.appendChild(classButton);

     
        const abilitiesSubTitle = UI.createTitleElement('\n⚔️', "subtitle");
        const abilitiesButton = createButton(ability,  0.6 );
        const classAbilityContainer = document.createElement('div');
        classAbilityContainer.appendChild(abilitiesSubTitle);
        classAbilityContainer.appendChild(abilitiesButton);

     
        const worldSubTitle = UI.createTitleElement('\n🔗',"subtitle");
        const worldButton = createButton(world, 0.6);
        const worldContainer = document.createElement('div');
        worldContainer.appendChild(worldSubTitle);
        worldContainer.appendChild(worldButton);

        const galleryButtonsContainer = UI.createContainer([], { display: 'flex',justifyContent: 'center' });
        galleryButtonsContainer.appendChild(classContainer);
        galleryButtonsContainer.appendChild(classAbilityContainer);
        galleryButtonsContainer.appendChild(worldContainer);
 
     const inputContainer = document.createElement('div');
     const sponsorAmount = createInput('number', { placeholder: '0.00Ξ, Rank: ----', id: 'sponsorAmount' });
     const submitButton = document.createElement('button'); 
     submitButton.classList.add('rainbow-button'); 
     submitButton.classList.add('subtitle'); 
     submitButton.innerText = 'Add';
     inputContainer.appendChild(sponsorAmount);
     inputContainer.appendChild(submitButton); 

     sponsorAmount.addEventListener('input', async () => {
        const amount = sponsorAmount.value; 
        if (amount) {
          const rank = await fetchRankForAmount(web3.utils.toWei(amount, 'ether')); 
          if (rank !== null) {
            rankInfo.innerText = `Add ${amount}Ξ to reach rank ${rank}°!`; 
          } else {
            rankInfo.innerText = "Error fetching rank"; 
          }
        } else {
          rankInfo.innerText = "Enter an amount"; 
        }
      });

     const yourSpot = UI.createTitleElement('Add 0.01Ξ for spot 24°.\n\n ', "subtitle")

     const loadingContainer = document.createElement('div');
     loadingContainer.classList.add('loading-container'); 
     const loadingBar = document.createElement('div');
     loadingBar.classList.add('loading-bar');
     const loadingText =  UI.createTitleElement('', "subtitle");
  
     loadingContainer.appendChild(loadingBar);
     function updateLoadingBar(currentAmount) {
         const goal = 1000000; 
         const percentage = (currentAmount / goal) * 100;
         loadingBar.style.width = percentage + '%';
         loadingText.innerText ='\n Rank #1 Challenge starts in 500 blocks!';
         loadingText.classList.add('rainbow-text'); 
     }
     function simulateLoading() {
         let currentAmount = 0;
         const increment = 10000; 
         const loadingInterval = setInterval(() => {
             if (currentAmount >= 1000000) {
             //TODO
             } else {
                if(currentAmount <=750000)
                 currentAmount += increment;
                 updateLoadingBar(currentAmount);
             }
         }, 50); 
     }

     const checkRecords = UI.createTitleElement('\nYour challenge\n', "title")
   
     const hallreportContainer = UI.createContainer(['abilities-grid']); 

    const rankButton = createButton({
        title: "Hall of Challengers ",
        description: "Allows you to verify previous official Challengers.",
        thumbnail: 'Media/Abilities/CHALLENGERS.png',
        effect(user) { 
            this.update = () => {} 
        },
    }, 1);
    hallreportContainer.appendChild(rankButton);
    rankButton.onclick = () => {
        canMove = false;
        isPaused = true;
        hideUI();
        createRunMenu();
    };

     const hallButton = createButton({
         title: "Hall of Survivors",
         description: "Allows you to verify previous official Survivors. ",
         thumbnail: 'Media/Abilities/HALL.png',
         effect(user) { 
             this.update = () => {} 
         },
     }, 1);

     hallreportContainer.appendChild(hallButton);
     hallButton.onclick = () => {
         hideUI();
         createTransparencyReport();
     };

     const reportButton = createButton({
         title: "Transparency Report",
         description: "Fun. Decentralization and transparency. View the transparency report in real time.",
         thumbnail: 'Media/Abilities/LAW.png',
         effect(user) { 
             this.update = () => {} 
         },
     }, 1);
     reportButton.onclick = () => {
         hideUI();
         createTransparencyReport();
     };
     hallreportContainer.appendChild(reportButton);

     const tutButton = createButton({
        title: "Challenge Queue",
        description: "Allows you to check the full Challenge Queue.",
        thumbnail: 'Media/Abilities/CHALLENGEQUEUE.png',
        effect(user) { 
            this.update = () => {} 
        },
    }, 1);
    hallreportContainer.appendChild(tutButton);
    tutButton.onclick = () => {
        canMove = false;
        isPaused = true;
        hideUI();
        createRunMenu();
    };


    const goBackButton = UI.createTitleContainer('\n Made in 2024 ❤️Ξ', "subtitle");

     const popUpContainer = UI.createContainer(['choose-menu-container']);;
     popUpContainer.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
     popUpContainer.appendChild(checkRanks);
     popUpContainer.appendChild(loadingText);
     popUpContainer.appendChild(loadingContainer);
     popUpContainer.appendChild(topChallengerContainer);
     popUpContainer.appendChild(checkRecords);
     popUpContainer.appendChild(galleryButtonsContainer);
     popUpContainer.appendChild(inputContainer);
     popUpContainer.appendChild(yourSpot);
     popUpContainer.appendChild(hallreportContainer);
     popUpContainer.appendChild(goBackButton);

            addContainerUI('center-container', [popUpContainer]);
            addContainerUI('TR-container', [subTitleLogout]);
            simulateLoading(); 

            galleryButtonsContainer.childNodes.forEach(button => {
                button.addEventListener('click', () => {
                    canMove=false;
                    hideUI();
                    if (button === classContainer) {
                        createChooseMenu(playerTypes, "🏆 Survivors 🏆","Survivor");
                   } else if (button === classAbilityContainer) {
                        createChooseMenu(abilityTypes, "⚔️ Abilities ⚔️","Ability");
                    } else if (button === worldContainer) {
                        createChooseMenu(worldTypes, " 🔗 Chains 🔗","World");
                    }
                });
             });

  
            createRandomRunEffect(classButton, classImages, 110,  0.6 , "class"); 
            createRandomRunEffect(abilitiesButton, abilityImages, 0,  0.6 , "ability");
            createRandomRunEffect(worldButton, worldImages, 0,  0.6 , "world");

    }

/*---------------------------------------------------------------------------
                            In Game UI
---------------------------------------------------------------------------*/
let challengeDisplay = UI.createTitleElement('', "minititle");
function refreshDisplay() {
  let xpLoadingContainer = document.createElement('div');
    xpLoadingContainer.id = 'horizontalBarContainer';
    xpLoadingBar = document.createElement('div');
    xpLoadingBar.id = 'horizontalBar';
    xpLoadingContainer.appendChild(xpLoadingBar);

    let hpBarContainer = document.createElement('div');
    hpBarContainer.id = 'hpBarContainer';
    hpBar = document.createElement('div');
    hpBar.id = 'hpBar';
    hpBar.style.width =  (player.health / player.maxhealth * 100) + '%';
    hpBarContainer.appendChild(hpBar);

    const abilitiesContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(7, auto)' }); 
    const playerContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(3, auto)' });
    const barGridContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(1, auto)' });
    const playerButton = createButton(player, .25 );
    const worldButton = createButton(world, .25 );
    barGridContainer.appendChild(hpBarContainer);
    barGridContainer.appendChild(xpLoadingContainer);
    
    abilitiesContainer.appendChild(playerButton);
    abilitiesContainer.appendChild(worldButton);
    
    player.abilities.forEach(ability => {
        const clonedAbility = { ...ability };
        abilitiesContainer.appendChild(createButton(clonedAbility, .25 ));
    });



    addContainerUI('center-container', [barGridContainer]).onclick = () => {
        canMove = false;
        isPaused = true;
        hideUI();
        createPlayerInfoMenu();
    };

    addContainerUI('bottom-container',[abilitiesContainer]).onclick = () => {
        canMove = false;
        isPaused = true;
        hideUI();
        createPlayerInfoMenu();
    };
    const worldTitle = UI.createTitleElement(world.title, "minititle");
    addContainerUI('top-container',[worldTitle,challengeDisplay]).onclick = () => {

    };
    

}

function createPlayerInfoMenu() {
    const popUpContainer = UI.createContainer(['choose-menu-container']); 
    const statusButton = UI.createTitleContainer('\nChallenge\nStatus', "subtitle");
    popUpContainer.appendChild(statusButton);

    const oneOnlyContainer = UI.createContainer(['abilities-grid']); 
    const worldButton = createButton(world, 1);
    oneOnlyContainer.appendChild(worldButton);
    worldButton.style.cursor = 'default';
    popUpContainer.appendChild(oneOnlyContainer);
  
    const recordsTextContainer = UI.createContainer(['abilities-grid']);
    const timeScoreTitle = UI.createTitleElement('\nTime',"subtitle");
    const timeScore = UI.createTitleElement('\n'+time,"subtitle");
    recordsTextContainer.appendChild(timeScoreTitle);
    recordsTextContainer.appendChild(timeScore);

    const liquidationScoreTitle = UI.createTitleElement('Liquidations',"subtitle");
    const liquidationScore = UI.createTitleElement(liquidations,"subtitle");
    recordsTextContainer.appendChild(liquidationScoreTitle);
    recordsTextContainer.appendChild(liquidationScore);

    const expScoreTitle = UI.createTitleElement('Experience',"subtitle");
    const expScore = UI.createTitleElement(experience,"subtitle");
    recordsTextContainer.appendChild(expScoreTitle);
    recordsTextContainer.appendChild(expScore);

    const distanceScoreTitle = UI.createTitleElement('Distance',"subtitle");
    const distanceScore = UI.createTitleElement(distance,"subtitle");
    recordsTextContainer.appendChild(distanceScoreTitle);
    recordsTextContainer.appendChild(distanceScore);

    const levelScoreTitle = UI.createTitleElement('Lvls',"subtitle");
    const levelScore = UI.createTitleElement(levels,"subtitle");
    recordsTextContainer.appendChild(levelScoreTitle);
    recordsTextContainer.appendChild(levelScore);

    const secretsScoreTitle = UI.createTitleElement('Secrets',"subtitle");
    const secretsScore = UI.createTitleElement(secrets,"subtitle");
    recordsTextContainer.appendChild(secretsScoreTitle);
    recordsTextContainer.appendChild(secretsScore);

    const bossesScoreTitle = UI.createTitleElement('Bosses\n',"subtitle");
    const bossesScore = UI.createTitleElement(bosses,"subtitle");
    recordsTextContainer.appendChild(bossesScoreTitle);
    recordsTextContainer.appendChild(bossesScore);

    popUpContainer.appendChild(recordsTextContainer);

    const randomHash = generateRandomHash();
    const secretContainer = UI.createTitleElement('\n Gamestate Hash\n'+randomHash+'\n',"minititle");
    popUpContainer.appendChild(secretContainer);

    const playerClassContainer = UI.createContainer(['abilities-grid']); 
    const classButton = createButton(player, 1);
    playerClassContainer.appendChild(classButton);
    classButton.style.cursor = 'default';
  
    player.abilities.forEach(ability => {
      const clonedAbility = { ...ability };
      const abilityButton = createButton(clonedAbility, 1);
      playerClassContainer.appendChild(abilityButton);
      abilityButton.style.cursor = 'default';
    });

    popUpContainer.appendChild(playerClassContainer);
    const goBackButton = UI.createTitleContainer('\n - Continue -',  "subtitle");
    goBackButton.style.cursor = 'pointer';
    popUpContainer.appendChild(goBackButton);
    addContainerUI('center-container', [popUpContainer]);
      goBackButton.onclick = () => {
        canMove = true;
        hideUI();
        refreshDisplay();
};
}
function createSettingsMenu() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);
    const statusButton = UI.createTitleContainer('\n Settings',  "subtitle");
    popUpContainer.appendChild(statusButton);

    const volumesTitle = UI.createTitleElement('- Volume -\n\n', "subtitle");
    popUpContainer.appendChild(volumesTitle);

  const volumesContainer =UI.createContainer(['abilities-grid']);
  const fxVolumeSlider = document.createElement('input');
  fxVolumeSlider.type = 'range'
  fxVolumeSlider.min = '0';
  fxVolumeSlider.max = '100';
  fxVolumeSlider.value = '50'; 
  fxVolumeSlider.id = 'fxVolumeSlider';
  fxVolumeSlider.classList.add('rainbow-slider');

  const fxVolumeTitle = UI.createTitleElement("FX",  "subtitle");
  fxVolumeTitle.htmlFor = 'fxVolumeSlider';
  volumesContainer.appendChild(fxVolumeTitle);

  volumesContainer.appendChild(fxVolumeSlider);

  const vaVolumeSlider = document.createElement('input');
  vaVolumeSlider.type = 'range'
  vaVolumeSlider.min = '0';
  vaVolumeSlider.max = '100';
  vaVolumeSlider.value = '50'; 
  vaVolumeSlider.id = 'vaVolumeSlider';
  vaVolumeSlider.classList.add('rainbow-slider');

  const vaVolumeTitle = UI.createTitleElement("Voices",  "subtitle");
  vaVolumeTitle.htmlFor= 'vaVolumeSlider';
  volumesContainer.appendChild(vaVolumeTitle);

  volumesContainer.appendChild(vaVolumeSlider);

  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = '0';
  volumeSlider.max = '100';
  volumeSlider.value = '50'; 
  volumeSlider.id = 'volumeSlider';
  volumeSlider.classList.add('rainbow-slider'); 
  
  const VolumeTitle = UI.createTitleElement("Music", "subtitle");
  VolumeTitle.htmlFor = 'volumeSlider';
  volumesContainer.appendChild(VolumeTitle);

  volumesContainer.appendChild(volumeSlider);
  popUpContainer.appendChild(volumesContainer); 
  
  const themeContainer = document.createElement('div');
  const themesTitle = UI.createTitleElement('\n - Themes -\n\n', "subtitle");
  themeContainer.appendChild(themesTitle);
  
  const themeOptions = [
      { id: 'rainbowCheckbox', label: 'Chroma', filter: 'brightness(130%)' }, 
      { id: 'goldCheckbox', label: 'Gold', filter: 'brightness(130%) sepia(100%) hue-rotate(15deg) saturate(180%)' },
      { id: 'silverCheckbox', label: 'Silver', filter: 'brightness(130%) grayscale(100%)' },
      { id: 'bronzeCheckbox', label: 'Bronze', filter: 'brightness(130%) sepia(100%) hue-rotate(5deg)' }
  ];
  const themesContainerGrid = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });
  const checkboxes=[];
  themeOptions.forEach(option => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = option.id;
      checkbox.classList.add('rainbow-checkbox'); 
      const themeTitle = UI.createTitleElement(option.label, "subtitle");
      themeTitle.htmlFor= option.id;
      themeContainer.appendChild(themesTitle);
      themesContainerGrid.appendChild(checkbox);
      themesContainerGrid.appendChild(themeTitle);
      themeContainer.appendChild(themesContainerGrid);
  
      checkbox.addEventListener('change', (event) => {
          themeOptions.forEach(otherOption => {
              if (otherOption.id !== option.id) {
                  document.getElementById(otherOption.id).checked = false;
              }
          });
  
          if (event.target.checked) { 
            document.documentElement.style.setProperty('--image-filter', option.filter);
          }  
          if (!event.target.checked) { 
            event.target.checked = true;  
            return; 
        }

      });
      checkboxes.push(checkbox);
  });
  
  popUpContainer.appendChild(themeContainer);

  const langContainer = document.createElement('div');
  const langTitle = UI.createTitleElement('\n - Language -\n\n', "subtitle");
  langContainer.appendChild(langTitle);
  
  const languageSelect = document.createElement('select');
  languageSelect.classList.add('rainbow-select'); 
  
  const languageOptions = [
      { value: "en", label: "English" },
      { value: "es", label: "Español" }, 
      { value: "fr", label: "Français" }, 
      { value: "de", label: "Deutsch" }, 
      { value: "pt", label: "Português" },
      { value: "zh", label: "中文" },
      { value: "ja", label: "日本語" },
      { value: "ru", label: "Русский" },
      { value: "ko", label: "한국어" },

  ];
  
  languageOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value; 
      optionElement.text = option.label; 
      languageSelect.appendChild(optionElement);
  });
  
  langContainer.appendChild(languageSelect);
  popUpContainer.appendChild(langContainer); 
  const goBackButton = UI.createTitleContainer('\n- Go back -', "subtitle");
  goBackButton.style.cursor = 'pointer';
  
addContainerUI('center-container', [popUpContainer]);
  goBackButton.onclick = () => {
    canMove = true;
    hideUI();
    createGameTitle();
  };
  popUpContainer.appendChild(goBackButton);

  const savedSettings = localStorage.getItem('onchainSurvivorSettings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    languageSelect.value = settings.language;
    fxVolumeSlider.value = settings.fxVolume;
    vaVolumeSlider.value = settings.vaVolume;
    volumeSlider.value = settings.musicVolume;
    for (let i = 0; i < themeOptions.length; i++) {
        if (settings.theme === themeOptions[i].filter) {
          checkboxes[i].checked = true; 
          document.documentElement.style.setProperty('--image-filter', settings.theme); 
          break;
        }
    }
  }

  function saveSettings() {
    const settings = {
      theme: document.documentElement.style.getPropertyValue('--image-filter'),
      language: languageSelect.value, 
      fxVolume: fxVolumeSlider.value, 
      vaVolume: vaVolumeSlider.value,
      musicVolume: volumeSlider.value,
    };
    localStorage.setItem('onchainSurvivorSettings', JSON.stringify(settings));
   }

languageSelect.addEventListener('change', saveSettings);
fxVolumeSlider.addEventListener('change', saveSettings);
vaVolumeSlider.addEventListener('change', saveSettings);
volumeSlider.addEventListener('change', saveSettings);
checkboxes.forEach(checkbox => {
checkbox.addEventListener('change', saveSettings);
});

}

async function createInfoMenu() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);

    const newChallengesButton = UI.createTitleContainer('\n New Challenges \neveryday!', "subtitle");
    popUpContainer.appendChild(newChallengesButton);

    const aboutButton = UI.createTitleElement('Welcome to Onchain Survivor. \n a free to play global  challenge game\n powered by decentralized blockchains!\n\n Today`s Challenge:', "subtitle");
    popUpContainer.appendChild(aboutButton);

    const worldContainer = UI.createContainer(['abilities-grid']); 
    const worldButton = createButton(world, 1);
    worldButton.style.cursor = 'default';
    worldContainer.appendChild(worldButton);
    popUpContainer.appendChild(worldContainer);

    const objectiveText = UI.createTitleElement('\nEach day brings a new Challenge, and \nafter you complete it, inscribe your records \nto the hall of survivors for all of eternity. \n\n Today`s Character Class:', "subtitle");
    popUpContainer.appendChild(objectiveText);

    const todaysPlayerContainer = UI.createContainer(['abilities-grid']); 
    const classButton = createButton(player, 1);
    classButton.style.cursor = 'default';
    todaysPlayerContainer.appendChild(classButton);
    popUpContainer.appendChild(todaysPlayerContainer);

    const instructionsText = UI.createTitleElement('\n As a survivor you can only \n move and Survive! each class  \n  has a different base ability, and stats.\n\n Today`s Ability:', "subtitle");
    popUpContainer.appendChild(instructionsText);

    const todaysAbilityContainer = UI.createContainer(['abilities-grid']); 
    const abilButton = createButton(ability, 1);
    abilButton.style.cursor = 'default';
    todaysAbilityContainer.appendChild(abilButton);
    popUpContainer.appendChild(todaysAbilityContainer);

    const abilText = UI.createTitleElement('\n Install many abilities during your run. Let \nyour creativity and intuition guide you, \n some abilities combine well.  Good luck!\n\n    -the dev (@onchainsurvivor)',  "subtitle");
    popUpContainer.appendChild(abilText);

    const goBackButton = UI.createTitleContainer('\n- Go back -', "subtitle");
    goBackButton.style.cursor = 'pointer';
    
addContainerUI('center-container', [popUpContainer]);
    goBackButton.onclick = () => {
        canMove = true;
        isPaused = true;
        hideUI();
        createGameTitle();
    };
    popUpContainer.appendChild(goBackButton);

}

function createTransparencyReport() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);;

    const titleButton = UI.createTitleContainer('\nTransparency\nReport\n⚖️', "subtitle");
   // titleButton.style.cursor = 'pointer';

    popUpContainer.appendChild(titleButton);
    const aboutButton = UI.createTitleElement(' You can read and run offline every line \n of code of the onchain survivor client !\n\n Repository:', "subtitle");
    popUpContainer.appendChild(aboutButton);

    const githubContainer = UI.createContainer(['abilities-grid']); 
    const githubButton = createButton({
        title: "Read Onchain Survivor Code",
        description: "Allows you to check the client source code, line by line, public for everyone to verify.",
        thumbnail: 'Media/Abilities/???.png',
        effect(user) { 
            this.update = () => {} 
        },
    }, 1);
    githubContainer.appendChild(githubButton);
    popUpContainer.appendChild(githubContainer);

    const rankingText = UI.createTitleElement('\nYou can verify the Global Ranking smart \n contract powering the survivor system\n\n Ranking Smart Contract:', "subtitle");
    popUpContainer.appendChild(rankingText);

    const rankingContainer = UI.createContainer(['abilities-grid']); 
    const rankingButton = createButton({
        title: "Verify Ranking Smart Contract",
        description: "Allows you to check the Ranking Smart Contract source code, line by line, public for everyone to verify.",
        thumbnail: 'Media/Abilities/???.png',
        effect(user) { 
            this.update = () => {} 
        },
    }, 1);
    rankingContainer.appendChild(rankingButton);
    popUpContainer.appendChild(rankingContainer);

    const sponsorText = UI.createTitleElement('\n You can also verify the Rollup Centric \n Sponsor Contract that settles in Ethereum!\n\n Sponsor Smart Contract:',  "subtitle");
    popUpContainer.appendChild(sponsorText);

    const sponsorContainer = UI.createContainer(['abilities-grid']); 
    const sponsorButton = createButton({
        title: "Verify Sponsor Smart Contract",
        description: "Allows you to check the Sponsor Smart Contract source code, line by line, public for everyone to verify.",
        thumbnail: 'Media/Abilities/???.png',
        effect(user) { 
            this.update = () => {} 
        },
    }, 1);
    sponsorContainer.appendChild(sponsorButton);
    popUpContainer.appendChild(sponsorContainer);

    const disclaimerText = UI.createTitleElement('\n None of the smart contracts hold balance. \n Every sponsor transaction is final. \n Timeframes might change for the players! \n Theres only one social media account.\n\n    -the dev (@onchainsurvivor)',"subtitle");
    popUpContainer.appendChild(disclaimerText);

    const goBackButton = UI.createTitleContainer('\n- Go back -',  "subtitle");
    goBackButton.style.cursor = 'pointer';
    
addContainerUI('center-container', [popUpContainer]);
    goBackButton.onclick = () => {
        canMove = false;
        isPaused = true;
        hideUI();
        createWeb3Menu();
    };
    popUpContainer.appendChild(goBackButton);
}
//createTransparencyReport();

function createRunMenu() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);;

    const titleButton = UI.createTitleContainer('\nWelcome\n Challenger!', "subtitle");
    popUpContainer.appendChild(titleButton);

    const aboutButton = UI.createTitleElement(' \nEvery day (7152 Ξ blocks) the game morphs \n  according to the #1 rank Challenger, changing \n the Character, Ability &  Chain for a day! \n\n Next 5 Days (Example):',   "subtitle");
    popUpContainer.appendChild(aboutButton);


    const topChallengerContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });
    topChallengerContainer.appendChild(UI.createTitleElement('\n#\nRank',  "subtitle"));
    topChallengerContainer.appendChild(UI.createTitleElement('\n🏆\nClass',  "subtitle"));
    topChallengerContainer.appendChild(UI.createTitleElement('\n⚔️\nSkill ',  "subtitle"));
    topChallengerContainer.appendChild(UI.createTitleElement('\n🔗\nChain ',  "subtitle"));
    topChallengerContainer.appendChild(UI.createTitleElement('1°',   "subtitle"));
    topChallengerContainer.appendChild(createButton(playerTypes[1], .6));
    topChallengerContainer.appendChild(createButton(abilityTypes[3], .6 ));
    topChallengerContainer.appendChild(createButton(worldTypes[0], .6 ));
    topChallengerContainer.appendChild(UI.createTitleElement('2°',   "subtitle"));
    topChallengerContainer.appendChild(createButton(playerTypes[1], .5));
    topChallengerContainer.appendChild(createButton(abilityTypes[6], .5 ));
    topChallengerContainer.appendChild(createButton(worldTypes[1], .5 ));
    topChallengerContainer.appendChild(UI.createTitleElement('3°',   "subtitle"));
    topChallengerContainer.appendChild(createButton(playerTypes[3], .4));
    topChallengerContainer.appendChild(createButton(abilityTypes[9], .4));
    topChallengerContainer.appendChild(createButton(worldTypes[1], .4));
    topChallengerContainer.appendChild(UI.createTitleElement('4°',   "subtitle"));
    topChallengerContainer.appendChild(createButton(playerTypes[3], .3));
    topChallengerContainer.appendChild(createButton(abilityTypes[4], .3));
    topChallengerContainer.appendChild(createButton(worldTypes[0], .3));
    topChallengerContainer.appendChild(UI.createTitleElement('5°',   "subtitle"));
    topChallengerContainer.appendChild(createButton(playerTypes[0], .2));
    topChallengerContainer.appendChild(createButton(abilityTypes[5], .2));
    topChallengerContainer.appendChild(createButton(worldTypes[0], .2));
   
    popUpContainer.appendChild(topChallengerContainer);

    const rankingText = UI.createTitleElement('\n The #1 rank Challenger gets recorded in the \n Hall of Challengers, and all the others   rank up \n as queue clears, eventually ranking #1!\n\n Queue Progress Example:\n\n',   "subtitle");
    popUpContainer.appendChild(rankingText);

    const topbidContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(5, auto)' });
    topbidContainer.appendChild(UI.createTitleElement('# Address',   "subtitle"));
    topbidContainer.appendChild(UI.createTitleElement('🏆',   "subtitle"));
    topbidContainer.appendChild(UI.createTitleElement('⚔️',   "subtitle"));
    topbidContainer.appendChild(UI.createTitleElement('🔗',   "subtitle"));
    topbidContainer.appendChild(UI.createTitleElement('Next day',   "subtitle"));

    topbidContainer.appendChild(UI.createTitleElement('#1 0x...e2',   "subtitle"));
    topbidContainer.appendChild(createButton(playerTypes[0], .33));
    topbidContainer.appendChild(createButton(abilityTypes[3], .33 ));
    topbidContainer.appendChild(createButton(worldTypes[0], .33 ));
    topbidContainer.appendChild(UI.createTitleElement('Record',   "subtitle"));

    topbidContainer.appendChild(UI.createTitleElement('#2 0x...2a',   "subtitle"));
    topbidContainer.appendChild(createButton(playerTypes[1], .33));
    topbidContainer.appendChild(createButton(abilityTypes[6], .33 ));
    topbidContainer.appendChild(createButton(worldTypes[1], .33 ));
    topbidContainer.appendChild(UI.createTitleElement('#1▲',   "subtitle"));

    topbidContainer.appendChild(UI.createTitleElement('#3 0x...3d',   "subtitle"));
    topbidContainer.appendChild(createButton(playerTypes[0], .33));
    topbidContainer.appendChild(createButton(abilityTypes[9], .33));
    topbidContainer.appendChild(createButton(worldTypes[1], .33));
    topbidContainer.appendChild(UI.createTitleElement('#2▲',   "subtitle"));

    topbidContainer.appendChild(UI.createTitleElement('#4 0x...21',   "subtitle"));
    topbidContainer.appendChild(createButton(playerTypes[0], .33));
    topbidContainer.appendChild(createButton(abilityTypes[9], .33));
    topbidContainer.appendChild(createButton(worldTypes[1], .33));
    topbidContainer.appendChild(UI.createTitleElement('#3▲',   "subtitle"));
    popUpContainer.appendChild(topbidContainer);


    const sponsorText = UI.createTitleElement('\nChallengers can add any Ξ amount and \n accumulate until they get the first rank!\nKeep in mind that you cannot cancel once set! \n\n Setting a Challenge (Example)',   "subtitle");
    popUpContainer.appendChild(sponsorText);
 
    const classContainer = document.createElement('div');
    const classSubTitle = UI.createTitleElement('\n🏆 ',  "subtitle");
    const classButton = createButton(player,  0.6 );
    classContainer.appendChild(classSubTitle);
    classContainer.appendChild(classButton);

 
    const abilitiesSubTitle = UI.createTitleElement('\n⚔️',  "subtitle");
    const abilitiesButton = createButton(ability,  0.6 );
    const classAbilityContainer = document.createElement('div');
    classAbilityContainer.appendChild(abilitiesSubTitle);
    classAbilityContainer.appendChild(abilitiesButton);

 
    const worldSubTitle = UI.createTitleElement('\n🔗',  "subtitle");
    const worldButton = createButton(world,  0.6 );
    const worldContainer = document.createElement('div');
    worldContainer.appendChild(worldSubTitle);
    worldContainer.appendChild(worldButton);

    const galleryButtonsContainer = UI.createContainer([], { display: 'flex',justifyContent: 'center' });
    galleryButtonsContainer.appendChild(classContainer);
    galleryButtonsContainer.appendChild(classAbilityContainer);
    galleryButtonsContainer.appendChild(worldContainer);

    popUpContainer.appendChild(galleryButtonsContainer);

 const inputContainer = document.createElement('div');
 const sponsorAmount = createInput('number', { placeholder: '0.01Ξ, Rank: 8', id: 'sponsorAmount' });
 const submitButton = document.createElement('button'); 
 submitButton.classList.add('rainbow-button'); 
 submitButton.classList.add('subtitle'); 
 submitButton.innerText = 'Added';
 sponsorAmount.disabled = true;
 inputContainer.appendChild(sponsorAmount);
 inputContainer.appendChild(submitButton); 

 popUpContainer.appendChild(inputContainer);

    const disclaimerText = UI.createTitleElement('\n To set your own challenge, select a Survivor,\nAbility, Chain and send any amount of Ξ.\nYour challenge will be added in the Queue!\n\n    -the dev (@onchainsurvivor)',   "subtitle");
    popUpContainer.appendChild(disclaimerText);

    const buttons = popUpContainer.querySelectorAll('button');
    buttons.forEach(button => {
      button.style.cursor = 'default';
    });
    const goBackButton = UI.createTitleContainer('\n- Continue -', "subtitle");
    goBackButton.style.cursor = 'pointer';

    addContainerUI('center-container', [popUpContainer]);
    goBackButton.onclick = () => {
        canMove = false;
        isPaused = true;
        hideUI();
        createWeb3Menu();
    };
    popUpContainer.appendChild(goBackButton);
}
//createRunMenu();
/*---------------------------------------------------------------------------
                                 GAME OVER UI
---------------------------------------------------------------------------*/
//Dummy hash until I decide on scoring!
function generateRandomHash() {
    return [...Array(16)] 
        .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'))
        .join('');
}
 //triggerGameOver();
function triggerGameOver(notice,message ) {
    const popUpContainer = UI.createContainer(['choose-menu-container']);

    const titleContainer = UI.createTitleContainer('\n[Onchain Survivor]\n'+ notice );
    popUpContainer.appendChild(titleContainer);

    const imgContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(1, auto)' });
    const img = document.createElement('img');
    img.src = 'Media/Abilities/DEAR.png';
    img.style.width = '360px';
    img.style.height = '180px';
    img.classList.add('filter');
    imgContainer.appendChild(img);
    popUpContainer.appendChild(imgContainer);
    const liquidatedTitle = UI.createTitleElement(message,"subtitle");
    popUpContainer.appendChild(liquidatedTitle);

    const optionsContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });
    const inscribeButton = createButton({
        title: "Inscribe Records",
        description: 'Save your current score in the Hall of Survivors.',
        thumbnail: 'Media/Abilities/RECORD.png',
        effect(user) { 
            this.update = () => {} 
        },
    },1);
    inscribeButton.onclick = () => {
      //  location.reload(true);
    };
    const tryAgainButton = createButton({
        title: "Try Again",
        description: 'Survivors never give up. Run it back turbo.',
        thumbnail: 'Media/Abilities/TRYAGAIN.png',
        effect(user) { 
            this.update = () => {} 
        },
    },1);
    tryAgainButton.onclick = () => {
        location.reload(true);
    };

    optionsContainer.appendChild(inscribeButton)
    optionsContainer.appendChild(tryAgainButton)
    popUpContainer.appendChild(optionsContainer);

    const randomHash = generateRandomHash();

    const scoreTitle = UI.createTitleElement('\n Run Scores',"title");
    popUpContainer.appendChild(scoreTitle);

    const recordsContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(3, auto)' }); 
    const playerButton = createButton(player, .5 );
    const worldButton = createButton(world, .5 );
    recordsContainer.appendChild(playerButton);
    recordsContainer.appendChild(worldButton);
    player.abilities.forEach(ability => {
        const clonedAbility = { ...ability };
        const  abilButton = createButton(clonedAbility, .5 );
        recordsContainer.appendChild(abilButton);
    });

    popUpContainer.appendChild(recordsContainer);

    const recordsTextContainer = UI.createContainer(['abilities-grid']);
    const timeScoreTitle = UI.createTitleElement('Time',"subtitle");
    const timeScore = UI.createTitleElement(time,"subtitle");
    recordsTextContainer.appendChild(timeScoreTitle);
    recordsTextContainer.appendChild(timeScore);

    const liquidationScoreTitle = UI.createTitleElement('Liquidations',"subtitle");
    const liquidationScore = UI.createTitleElement(liquidations,"subtitle");
    recordsTextContainer.appendChild(liquidationScoreTitle);
    recordsTextContainer.appendChild(liquidationScore);

    const expScoreTitle = UI.createTitleElement('Experience',"subtitle");
    const expScore = UI.createTitleElement(experience,"subtitle");
    recordsTextContainer.appendChild(expScoreTitle);
    recordsTextContainer.appendChild(expScore);

    const distanceScoreTitle = UI.createTitleElement('Distance',"subtitle");
    const distanceScore = UI.createTitleElement(distance,"subtitle");
    recordsTextContainer.appendChild(distanceScoreTitle);
    recordsTextContainer.appendChild(distanceScore);

    const levelScoreTitle = UI.createTitleElement('Lvls',"subtitle");
    const levelScore = UI.createTitleElement(levels,"subtitle");
    recordsTextContainer.appendChild(levelScoreTitle);
    recordsTextContainer.appendChild(levelScore);

    const secretsScoreTitle = UI.createTitleElement('Secrets',"subtitle");
    const secretsScore = UI.createTitleElement(secrets,"subtitle");
    recordsTextContainer.appendChild(secretsScoreTitle);
    recordsTextContainer.appendChild(secretsScore);

    const bossesScoreTitle = UI.createTitleElement('Bosses\n',"subtitle");
    const bossesScore = UI.createTitleElement(bosses,"subtitle");
    recordsTextContainer.appendChild(bossesScoreTitle);
    recordsTextContainer.appendChild(bossesScore);

    popUpContainer.appendChild(recordsTextContainer);

    const secretContainer = UI.createTitleElement('\n Results Hash\n'+randomHash+'\n',"minititle");
    popUpContainer.appendChild(secretContainer);

    const reminderTitle = UI.createTitleElement('\nⓘ Reminder: \n Onchain survivor is a highly addicting endeavor!\n\n\n',"minititle");
    popUpContainer.appendChild(reminderTitle);

    addContainerUI('center-container', [popUpContainer]);
}
/*---------------------------------------------------------------------------
                        Load Settings for Offline Play  
---------------------------------------------------------------------------*/
window.addEventListener('load', async () => {
    document.documentElement.style.setProperty('--image-filter', 'brightness(130%)');
    const savedSettings = localStorage.getItem('onchainSurvivorSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      document.documentElement.style.setProperty('--image-filter', settings.theme);
     //Set volume and other parameters once set  
    }

    const storedAddress = localStorage.getItem('metaMaskAddress');
    if (storedAddress) {
        canMove = false;
        isPaused = true;
        hideUI();
        createRunMenu();
    }
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
          console.log('Service Worker registered with scope:', registration.scope);
        }, function(error) {
          console.log('Service Worker registration failed:', error);
        });
  }  

});



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
    hideUI();
    setTimeout(() => { refreshDisplay() }, 1050);
    player.addAbility(new Ability(player, { ...ability}));
    }
}

/*---------------------------------------------------------------------------
              INSTANCED MESHES TO OPTIMIZE IN THE FUTURE

const instanceCount = 1; 
let instancedMesh;
loader.load('Media/Models/Survivor.fbx', (object) => {
    const geometry = object.children[0].geometry; 
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00});
    instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);
    instancedMesh.scale.set(4,4,4);
    instancedMesh.mixer = new THREE.AnimationMixer(object);
    instancedMesh.playerRun = instancedMesh.mixer.clipAction(object.animations[0]);
    instancedMesh.playerRun.play();
    instancedMesh.playerRun.setLoop(THREE.LoopRepeat);
    scene.add(instancedMesh);
});

                    (Update loop to test)
            const cloneOffset = new THREE.Vector3(); 
            const matrix = new THREE.Matrix4();
            const direction = new THREE.Vector3();
            const targetPosition= player.getWorldDirection(direction);
            cloneOffset.copy(direction).negate().multiplyScalar(.2); 
            const clonePosition = player.position.clone().add(cloneOffset);
            matrix.setPosition(clonePosition);
            const position = new THREE.Vector3();
            position.setFromMatrixPosition(matrix);
            matrix.lookAt(position, targetPosition, new THREE.Vector3(0, 1, 0)); 
            instancedMesh.setMatrixAt(0, matrix);
            instancedMesh.mixer.update(0.1); 
            instancedMesh.instanceMatrix.needsUpdate = true;

---------------------------------------------------------------------------*/

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
            world.challenge.update();
        } else if((canMove) && (keys.w ||keys.a || keys.s || keys.d)) resumeGame();
        accumulatedTime -= fixedTimeStep;
    }
    
    world.update(scene,camera,renderer);
    composer.render();
}

animate();