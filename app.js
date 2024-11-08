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

    update() {
        this.effect.forEach(effectName => {
            abilityEffects[effectName].update?.(this.user, this);
        });
    }

    activate(){
        this.effect.forEach(effectName => {
            abilityEffects[effectName].initialize?.(this.user, this);
          });
    }

    terminate(){
        this.effects.forEach(effectName => {
            abilityEffects[effectName].terminate?.(this.user, this);
          });
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
        this.entityRunAnimation = this.mesh.mixer.clipAction(object.animations[0]);
        this.entityRunAnimation.play();
        this.entityRunAnimation.setLoop(THREE.LoopRepeat);
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

    updateAbilities() {
        this.abilities.forEach(ability => ability.update());
    }

    takeDamage(amount) {
        if (this.evasionCooldown) return;
        if (this.inmuneCooldown) return;

        const evasionSuccess = Math.random() < (this.evasion / 100);
        if (evasionSuccess) {
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
        this.returnToPool(); 
        createParticleEffect(this.position);

        //secrets+= 1; when secret enemy defeated
        //bosses+= 1; when boss defeated
        //liquidations += 1; when base enemy defeated
        dropItem(this.position);
        scene.remove(this);

        const index = scene.children.indexOf(this);
        if (index > -1) scene.children.splice(index, 1);

        const enemyIndex = enemies.indexOf(this);
        if (enemyIndex > -1) enemies.splice(enemyIndex, 1);
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

function createParticleEffect(position, color = 'green', particleCount = 50) {
    const particleGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(particleCount * 9);
    const directions = new Float32Array(particleCount * 3); 
    const spread = 3; 

    for (let i = 0; i < particleCount; i++) {
        const baseIndex = i * 9;
        for (let j = 0; j < 9; j += 3) {
            vertices[baseIndex + j] = position.x + (Math.random() - 0.5) * spread;
            vertices[baseIndex + j + 1] = position.y + (Math.random() - 0.5) * spread;
            vertices[baseIndex + j + 2] = position.z + (Math.random() - 0.5) * spread;
        }
        const dirX = vertices[baseIndex] - position.x;
        const dirY = vertices[baseIndex + 1] - position.y;
        const dirZ = vertices[baseIndex + 2] - position.z;
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
    const duration = 0.15;
    const expansionSpeed = 5;
    const startTime = performance.now();

    function animateParticles() {
        const elapsedTime = (performance.now() - startTime) / 1000;

        for (let i = 0; i < particleCount; i++) {
            const baseIndex = i * 9;
            for (let j = 0; j < 9; j += 3) {
                vertices[baseIndex + j] += directions[i * 3] * expansionSpeed * elapsedTime;
                vertices[baseIndex + j + 1] += directions[i * 3 + 1] * expansionSpeed * elapsedTime;
                vertices[baseIndex + j + 2] += directions[i * 3 + 2] * expansionSpeed * elapsedTime;
            }
        }

        particleGeometry.attributes.position.needsUpdate = true;
        particleMaterial.opacity = Math.max(0, 0.8 * (1 - elapsedTime / duration)); 

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
import { abilityTypes } from './abilityTypes.js';

const abilityEffects = {
"Create Bot": {
    initialize: (user, ability) => {
        const bot = new THREE.Mesh(
            new THREE.SphereGeometry(0.6, 16, 6),
            world.material
        );
        bot.position.copy(user.position);
        bot.updateMatrixWorld(true);
        bot.boundingBox = new THREE.Box3().setFromObject(bot);
        lightObjects.push(bot);
        scene.add(bot);
        bot.target = null;
        bot.orbitRadius = 2;
        bot.orbitSpeed = 0.01;
        bot.homingSpeed = 0.5;
        bot.maxDistance= 20;
        bot.offsetAmount= 5;
        bot.followSpeed= 0.1;
        ability.bot = bot;
        ability.lastHitTime = 0;
    },
    update: (user, ability) => {
    },
    terminate: (user, ability) => {
        scene.remove(ability.bot);
        const index = lightObjects.indexOf(ability.bot);
        if (index > -1) {
            lightObjects.splice(index, 1);
        }
        delete ability.bot;
    },
},
"Create Veil": {
        initialize: (user, ability) => {
            if (ability.veil) scene.remove(ability.veil); // Remove old veil if it exists
            const shieldMaterial = world.material;
            const shieldGeometry = new THREE.SphereGeometry(2);
            const veil = new THREE.Mesh(shieldGeometry, shieldMaterial);
            veil.position.copy(user.position);
            scene.add(veil);
            ability.veil = veil; // Store the veil in the ability object
        },
        update: (user, ability) => {
            if (ability.veil) {
                ability.veil.position.set(user.position.x, user.position.y + 2, user.position.z);
            }
        },
        terminate: (user, ability) => {
            if (ability.veil) {
                scene.remove(ability.veil);
                delete ability.veil;
            }
        }
    },

    "Create Trail Step": {  
        initialize: (user, ability) => {
            const trailStep = new THREE.Mesh(new THREE.BoxGeometry(1, .5, 1), world.material);
            trailStep.position.copy(user.position);

            scene.add(trailStep);
            trailStep.boundingBox = new THREE.Box3().setFromObject(trailStep);

            if (!ability.trailBullets) {
                ability.trailBullets = [];
            }
             ability.trailBullets.push(trailStep);
             lightObjects.push(trailStep);
        },
    },

    "Manage Trail": { 
        initialize: (user, ability) => {
            ability.lastTrailTime = 0;
            ability.maxTrailLength = 7;
        },

        update: (user, ability) => {
            if ((Date.now() - ability.lastTrailTime > 400)) {
                ability.lastTrailTime = Date.now();
                abilityEffects["Create Trail Step"].initialize(user, ability); 
                if (ability.trailBullets.length > ability.maxTrailLength) {
                    const oldestBullet = ability.trailBullets.shift();
                    scene.remove(oldestBullet);
                    const index = lightObjects.indexOf(oldestBullet);
                    if (index > -1) lightObjects.splice(index, 1);
                }
            }

        },
        terminate: (user, ability) => {
            ability.trailBullets.forEach(trailStep => {
                scene.remove(trailStep);
                const index = lightObjects.indexOf(trailStep);
                if (index > -1) lightObjects.splice(index, 1);
            });
            delete ability.trailBullets;
        }
    },

"Scalp": {
    update: (user, ability) => {
        const bot = ability.bot;
        if (!bot) return;
        if (closeEnemy) {
            bot.target = closeEnemy;
            const direction = new THREE.Vector3().subVectors(closeEnemy, bot.position).normalize();
            bot.position.add(direction.multiplyScalar(bot.homingSpeed));
            bot.boundingBox.setFromObject(bot);
        } else {
            bot.target = null;
        }
    },
},
"Swipe": {
        update: (user, ability) => {
            const bot = ability.bot;
            if (!bot) return;
            time = Date.now() * bot.orbitSpeed;
            bot.position.set(
                user.position.x + Math.cos(time) * bot.orbitRadius,
                user.position.y+1.5,
                //user.position.z + Math.sin(time) * bot.orbitRadius
            );
            const direction = new THREE.Vector3().subVectors(closeEnemy, bot.position).normalize();
            bot.position.add(direction.multiplyScalar(bot.homingSpeed));
            bot.boundingBox.setFromObject(bot);
        },
},


"Swarm": {
    update: (user, ability) => {
        const bot = ability.bot;
        if (!bot) return;
        time = Date.now();
        const forwardOffset = Math.sin(time * 0.001) * bot.offsetAmount; 
        const targetX = user.position.x + forwardOffset;  
        const targetZ = user.position.z; 
        const distanceFromPlayer = Math.sqrt(
            Math.pow(targetX + bot.position.x, 2) + 
            Math.pow(targetZ + bot.position.z, 2)
        );
        if (distanceFromPlayer > bot.maxDistance) {
            const direction = new THREE.Vector3(
                targetX - bot.position.x,
                0, 
                targetZ - bot.position.z
            ).normalize();
        
            bot.position.add(direction.multiplyScalar(bot.followSpeed * distanceFromPlayer));
        } else {
            bot.position.lerp(new THREE.Vector3(targetX, user.position.y + 2, targetZ), bot.followSpeed);
        }
        bot.boundingBox.setFromObject(bot);
    },
},
    "EvasionUP": {
        initialize: (user, ability) => {
            user.evasion += 50; // Increase evasion on activation
            ability.initialEvasion = user.evasion;  // Store initial evasion value
        },
        terminate: (user, ability) => {
            if (ability.initialEvasion !== undefined) { //Check if initialEvasion was stored
                user.evasion = ability.initialEvasion - 50; // Restore evasion on termination
                delete ability.initialEvasion;  //remove the stored value
            }

        }
    },
}

const oldabilityTypes = [
    {title: "Exploit Finder",
        effect(user) { 
            this.update = () => {}
                let time = Date.now();
                let direction= null;
                const orb = new THREE.Mesh(
                    new THREE.SphereGeometry(1, 16, 6),
                    world.material 
                );
                orb.orbitRadius= 10;
                orb.orbitSpeed= 0.0035;
                orb.homingSpeed= 0.5;
                orb.position.copy(user.position); 
                orb.updateMatrixWorld(true);
                orb.boundingBox = new THREE.Box3().setFromObject(orb);
                lightObjects.push(orb);
                scene.add(orb);
                this.update = () => {
                            time = Date.now() * orb.orbitSpeed;
                            orb.position.set(
                                user.position.x + Math.cos(time) * orb.orbitRadius,
                                user.position.y+1.5,
                                user.position.z + Math.sin(time) * orb.orbitRadius
                            );
                            direction = new THREE.Vector3().subVectors(closeEnemy, orb.position).normalize();
                            orb.position.add(direction.multiplyScalar(orb.homingSpeed));
                            orb.boundingBox.setFromObject(orb);
                };
        },
    },
    {title: "Blockchain Backup",
        description: "The survivor keeps a backup of everything always in handy.",
        thumbnail: 'Media/Abilities/BLOCKCHAINBACKUP.png',
        effect(user) { 
            this.update = () => {};
            let time = Date.now();
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.6, 16, 6),
                world.material 
            );
            orb.offsetAmount= 5, 
            orb.maxDistance= 20, 
            orb.followSpeed= 0.1,
            orb.position.copy(user.position); 
            orb.updateMatrixWorld(true);
            orb.boundingBox = new THREE.Box3().setFromObject(orb);
            lightObjects.push(orb);
            scene.add(orb);
            
            this.update = () => {
                time = Date.now();
                const forwardOffset = Math.sin(time * 0.001) * orb.offsetAmount; 
                const targetX = user.position.x + forwardOffset;  
                const targetZ = user.position.z; 
                const distanceFromPlayer = Math.sqrt(
                    Math.pow(targetX - orb.position.x, 2) + 
                    Math.pow(targetZ - orb.position.z, 2)
                );
                if (distanceFromPlayer > orb.maxDistance) {
                    const direction = new THREE.Vector3(
                        targetX - orb.position.x,
                        0, 
                        targetZ - orb.position.z
                    ).normalize();
    
                    orb.position.add(direction.multiplyScalar(orb.followSpeed * distanceFromPlayer));
                } else {
                    orb.position.lerp(new THREE.Vector3(targetX, user.position.y + 2, targetZ), orb.followSpeed);
                }
                orb.boundingBox.setFromObject(orb);
            };
        },
    }, 
    {title: "Data Blob",
        description: "the survivor heavily brings along a big blob of data holding a piece of the blockchain",
        thumbnail: 'Media/Abilities/BLOB.png',
        effect(user) { 
            this.update = () => {};
            const maxDistance = 20;
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
                const distanceX = orb.position.x - user.position.x;
                const distanceZ = orb.position.z - user.position.z;
                const distance = Math.sqrt(distanceX * distanceX + distanceZ * distanceZ);
                if (distance > maxDistance) {
                    const scale = maxDistance / distance;  
                    orb.position.x = user.position.x + distanceX * scale;
                    orb.position.z = user.position.z + distanceZ * scale;
                } else {
                    orb.position.set(
                        user.position.x + distanceX,
                        user.position.y + 2, 
                        user.position.z + distanceZ
                    );
                }
                orb.boundingBox.setFromObject(orb);
            };
        },
    },
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
        },
    },
    {title: "Sniping Bot",
        description: "Fast trading bot that liquidates opposing survivors.",
        thumbnail: 'Media/Abilities/SNIPEBOT.png',
        effect(user) { 
            let previousPosition = new THREE.Vector3().copy(user.position); 
            this.lastHitTime = 0;
            let dropUpdateFrame = 0; 
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

                if (dropUpdateFrame++ % (60/ (1 + player.attackPerSecond)) === 0) { 
                    if (closeEnemy) {
                        createOrb(orb);
                    }
                }
            
            };
        },
    }, 
];
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
    thumbnail: 0,
    abilities: [],
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
    setup: function(scene, camera, renderer) {},
    update: function(scene, camera, renderer) {},
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
                             Controllers
---------------------------------------------------------------------------*/
world = worldTypes[0];
world.setup(scene,camera,renderer);
ability = abilityTypes[0];
player = new Entity(playerTypes.find(type => type.title === 'Onchain Survivor'), new THREE.Vector3(0, 0, 0));
player.health=  5;
player.maxhealth= 5;
player.movementspeed= 0.15;
player.attackSpeed=  0.25;
player.attackLTL+1000;
player.attackPerSecond=0;
player.influenceRadius=10;
player.xp= 0;
player.range=15;
player.evasion=0;
player.xpToNextLevel=1;
player.level=0;

/*---------------------------------------------------------------------------
                             Player Controller
---------------------------------------------------------------------------*/

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

    if (dropUpdateFrame++ % (60/ (1 +player.attackPerSecond)) === 0) { 
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
               if (player.health <= 0){
                canMove= false;
                isPaused=true;
                hideUI();
                setTimeout(() => { triggerGameOver("Liquidation notice",'Dear survivor, we regret to inform that your HP \n dropped to 0 and this run has been terminated.\n\n'); }, 1000);
            } 
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

       //  addContainerUI('BR-container', [aboutTitle]);
       // aboutTitle.style.cursor = 'pointer';
       // aboutTitle.onclick = () => {
       //      canMove = false;
       //     isPaused = true;
       //     hideUI();
       //     createSettingsMenu();
       // }

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
    const subTitle = UI.createTitleElement('\nSet Challenge!',  "title");

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

         const disclaimer = UI.createTitleElement('Participating in OnChain Survivor as a challenger or survivor\nand interacting with the smart contracts\n is NOT an investment opportunity\n\n   The game is solely for entertainment and experimental purposes\n and participants should not expect financial returns.\n\n By sending any transaction to the smart contract\n you confirm that you are not subject to any country-specific restrictions\n regulatory limitations, or classified as a sanctioned entity.\n\n Special game events may occur that could temporarily freeze \nor stop the Challenge Queue during which the 7,150 block rule may not apply.\n\n Additionally, game updates might increase or decrease the duration of daily challenges\n to accommodate potential downtimes or inconveniences of the player base.\n\n The rules are subject to modification based on special events\n updates and unforeseen circumstances\n always in favour of the players. Any changes in timing will be publicl\n communicated in official channels. \n\n Challenges can be edited as many times as desired (fees apply)\n as long as the challenge is still in the queue\n\n Transactions sent into the challenge queue are irreversible\n please doublecheck before sending your challenge. \n\n', "smalltitle")
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
 // createChallengeMenu()
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

    const scoreTitle = UI.createTitleElement('\n Run Score\n\n',"title");
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
    const timeScoreTitle = UI.createTitleElement('\nTime',"subtitle");
    const timeScore = UI.createTitleElement("\n"+time,"subtitle");
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