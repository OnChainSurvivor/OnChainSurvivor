/*---------------------------------------------------------------------------
                              Classes
---------------------------------------------------------------------------*/
const loader = new THREE.FBXLoader();
const objectMap = new Map(); 
const objectPool= [];
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

        if (objectMap.has(modelKey)) {
            this.initEntity(objectPool.pop());
        } else {
            loader.load('Media/Models/Survivor.fbx', (object) => {
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.material = world.material.clone();
                    }
                });
                const serializedObject = object.toJSON();
                objectMap.set(modelKey, serializedObject);

                for (let index = 0; index <2000; index++) {
                    objectPool.push(new THREE.ObjectLoader().parse(objectMap.get(modelKey)))
                }

                this.initEntity(object);
            });
        }

        this.initAbilities(config.abilities);
    }

    initEntity(object) {
        this.mesh = object;
        this.add(this.mesh);
        this.mesh.mixer = new THREE.AnimationMixer(this.mesh);
        this.playerRun = this.mesh.mixer.clipAction(object.animations[0]);
        this.playerRun.play();
        this.playerRun.setLoop(THREE.LoopRepeat);
        this.mesh.scale.set(2,2,2);
        this.boundingBox = new THREE.Box3().setFromObject(this.mesh);
        scene.add(this);
    }

    updateMesh() {
        if (this.mesh) {
            this.mesh.mixer.update(.01);
            this.boundingBox.setFromObject(this.mesh);
        }
    }

    initAbilities(entityAbilities) {
        entityAbilities.forEach(entityAbility => {
                const ability = abilityTypes.find(type => type.title === entityAbility.type);
                    const newAbility = new Ability(this, {...ability});
                    this.addAbility(newAbility);
                    newAbility.activate();
            }
        )
    }

    getUpgradableAbilities() {
        return abilityTypes.filter(ability => {
          if (ability.isLocked) {
            return false; 
          }
      
          const isActive = this.abilities.some(pa => pa.title === ability.title);
          return !isActive; 
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

const isMobile = window.innerWidth <= 830;

let cameraAngle = 0;
let cameraRadius = 15;
let cameraHeight = 0;

let canMove = true;

let xpLoadingBar;

const rainbowColors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
let colorIndex = 0;

const xpSpheres = []; 
const xpsphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);

import { keys, initiateJoystick } from './joystick.js';
initiateJoystick();
const uiContainers = [];
/*---------------------------------------------------------------------------
                              Utility Functions
---------------------------------------------------------------------------*/
const dropXpSphere = (position) => {
    const xpsphereMaterial = world.material.clone();
    xpsphereMaterial.color.setHex(0xFFD700); 
    const xpSphere = new THREE.Mesh(xpsphereGeometry, xpsphereMaterial);
    xpSphere.position.copy(position);
    xpSphere.boundingBox = new THREE.Box3().setFromObject(xpSphere);
    scene.add(xpSphere);
    xpSpheres.push(xpSphere);
};

const handleEntityDeath = (entity, enemies) => {
    if (player.health <= 0) triggerGameOver();
   // TODO: Make drops super rare, no longer guarantee  
    dropXpSphere(entity.position);

    entity.deactivateAbilities();
    scene.remove(entity);

    const index = scene.children.indexOf(entity);
    if (index > -1) scene.children.splice(index, 1);

    const enemyIndex = enemies.indexOf(entity);
    if (enemyIndex > -1) enemies.splice(enemyIndex, 1);
};

function createParticleEffect(position, color = 'red', particleCount = 5) {
    const particleGeometry = new THREE.BufferGeometry();
    const particles = new Float32Array(particleCount * 3); 

    for (let i = 0; i < particleCount; i++) {
        particles[i * 3] = position.x + (Math.random() - 0.5) * 2;
        particles[i * 3 + 1] = position.y + (Math.random() - 0.5) * 2;
        particles[i * 3 + 2] = position.z + (Math.random() - 0.5) * 2;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: color,
        size: 1, 
        transparent: true,
        opacity: .5,
        blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);

    scene.add(particleSystem);

    const duration = 1 ; 
    const startTime = performance.now();

    function animateParticles() {
        const elapsedTime = (performance.now() - startTime) / 1000;

        for (let i = 0; i < particleCount; i++) {
            particleGeometry.attributes.position.array[i * 3] += (Math.random() - 0.5) * 0.05;
            particleGeometry.attributes.position.array[i * 3 + 1] += (Math.random() - 0.5) * 0.05;
            particleGeometry.attributes.position.array[i * 3 + 2] += (Math.random() - 0.5) * 0.05;
        }

        particleGeometry.attributes.position.needsUpdate = true;
        particleMaterial.opacity = Math.max(0, 0.8 * (1 - elapsedTime / duration));

        if (elapsedTime < duration) {
            requestAnimationFrame(animateParticles);
        } else {
            scene.remove(particleSystem);
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
{
    title: "Scalping Bot",
    description: 'Abusing the market volatility, The Scalping bot Executes incredibly fast attacks.',
    tooltip: "Like a true degen",
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
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
                homingSpeed: 0.5,
                create: () => {
                    const geometry = new THREE.SphereGeometry(0.3, 16, 6);
                    orb.mesh = new THREE.Mesh(geometry, world.material);
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
                        if ((Date.now() - this.lastHitTime > (500))) {
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
    description: 'Your onchain movements leave a trail behind, damaging pursuers',
    tooltip: 'Powerful...interesting choice of words, to say the least.',
    thumbnail: 'Media/Abilities/ONCHAINTRAIL.png',
    isLocked: false,
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
                trailStepMaterial.color.setHex(rainbowColors[colorIndex]); 
                trailStepMaterial.emissive.setHex(rainbowColors[colorIndex]);
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
{
    title: "Veil of Decentralization",
    description: "The Survivor shrouds in decentralization, becoming elusive.",
    tooltip: "Can't touch this!",
    thumbnail: 'Media/Abilities/VEILOFDECENTRALIZATION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
        const veil = {
            create: () => {
                if (veil.shield) scene.remove(veil.shield);
                user.evasion += 20;
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
{
    title: "Code Refactor",
    description: "Rewrites and optimizes the Survivor's abilities, reducing their cooldowns.",
    tooltip: "FAST",
    thumbnail: 'Media/Abilities/CODEREFACTOR.png',
    isLocked: false, 
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
    tooltip: "More alts than a telegram schizo",
    thumbnail:'Media/Abilities/SYBILATTACK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Vote Manipulation",
    description: "Illegally uses the voting power of other survivors in range agaisnt their will, turning bonuses into penalties.",
    tooltip: "no, CEXes totally have never ever done this.",
    thumbnail: 'Media/Abilities/VOTEMANIPULATION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Airdrop Fraud",
    description: "Free, fake tokens fall from the sky, draining the survivors who interact with them.",
    tooltip: "Free tokens! Just kidding, they're mine.",
    thumbnail: 'Media/Abilities/AIRDROPFRAUD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Identity Forge",
    description: "Specializes in creating a whole new persona, gaining the bonuses of a random class.",
    tooltip: "Fake it till you make it, anon!",
    thumbnail: 'Media/Abilities/IDENTITYFORGE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Decentralized Vote Rigging",
    description: "By controlling the majority of the chain validators, the survivor gains a random bonus.",
    tooltip: " ",
    thumbnail: 'Media/Abilities/VOTERIGGING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Confirm Block",
    description: "As transactions become confirmed and secured overtime, the survivor gains defensive bonuses",
    tooltip: "Block confirmed!.",
    thumbnail: 'Media/Abilities/CONFIRMBLOCK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Finality",
    description: "The blockchain inmutality makes it so  buried Survivors can not ever revive, If they take more than 6 blocks.",
    tooltip: ">Your transaction was succesfull \n>the coin moons, you check your wallet\n>turns out your tx never got in",
    thumbnail: 'Media/Abilities/FINALITY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},{
    title: "Copy Trading",
    description: "Creates a shield that absorbs multiple hits.",
    tooltip: "No double-spending here, buddy!",
    thumbnail: 'Media/Abilities/COPYTRADING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Double Spend Prevention ",
    description: "Creates a shield that absorbs multiple hits.",
    tooltip: "No double-spending here, buddy!",
    thumbnail: 'Media/Abilities/DOUBLESPENDPREVENTION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Overclock",
    description: "Greatly increases attack power for a brief period.",
    tooltip: "Overclocked like a mining rig in a bull run!",
    thumbnail: 'Media/Abilities/OVERCLOCK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Mining Rig",
    description: "Deploys a stationary turret that automatically attacks enemies.",
    tooltip: "Mining while you sleep!",
    thumbnail: 'Media/Abilities/MININGRIG.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Energy Surge",
    description: "Temporarily increases attack speed and movement speed.",
    tooltip: "Surging like the latest meme coin!",
    thumbnail: 'Media/Abilities/ENERGYSURGE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "PoS Migration",
    description: "Increases the player's defense.",
    tooltip: "Migrated to PoS and feeling safe!",
    thumbnail: 'Media/Abilities/POSMIGRATION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "PoW Migration ",
    description: "Increases the player's attack power.",
    tooltip: "Proof of Whacking! Stronger attacks.",
    thumbnail: 'Media/Abilities/POWMIGRATION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Governance Vote",
    description: "Grants a random beneficial effect based on player needs.",
    tooltip: "DAO voted, gains distributed!",
    thumbnail: 'Media/Abilities/GOVERNANCEVOTE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Protocol Upgrade",
    description: "Improves all abilities for a limited time.",
    tooltip: "Upgraded like ETH 2.0!",
    thumbnail: "Media/Abilities/PROTOCOLUPGRADE.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Network Upgrade ",
    description: "Grants a significant buff to a random ability.",
    tooltip: "Upgrade the network. Buff a random ability.",
    thumbnail: "Media/Abilities/NETWORKUPGRADE.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Quantum Encryption",
    description: "Creates a shield that reduces incoming damage.",
    tooltip: "Encrypt your defenses. Reduce damage taken.",
    thumbnail: "Media/Abilities/QUANTUMENCRYPTION.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Transaction Fee",
    description: "Reduces the cooldown of all abilities.",
    tooltip: "Pay the fee, cut the wait. Reduce your cooldowns.",
    thumbnail: 'Media/Abilities/TRANSACTIONFEE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Transaction Fee Burn",
    description: "Reduces enemy resources by burning their assets.",
    tooltip: "Burned like gas fees in a bull run!",
    thumbnail: 'Media/Abilities/FEEBURN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale Power",
    description: "Increases all stats for a short duration.",
    tooltip: "Unleash the whale power. Dominate the field.",
    thumbnail: "Media/Abilities/WHALEPOWER.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Blockchain Backup",
    description: "Creates a backup of resources for recovery.",
    tooltip: "Backing up like a secure blockchain!",
    thumbnail: 'Media/Abilities/BLOCKCHAINBACKUP.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Block Reward",
    description: "Heals the player for a portion of damage dealt.",
    tooltip: "Reward yourself with health for your efforts.",
    thumbnail: 'Media/Abilities/BLOCKREWARD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Crypto MultiSig",
    description: "Secures resources with multiple signatures.",
    tooltip: "Securing like a multi-signature wallet!",
    thumbnail: 'Media/Abilities/CRYPTOMULTISIG.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Transaction Sign",
    description: "Secures resources with a single signature.",
    tooltip: "Securing like a multi-signature wallet!",
    thumbnail: 'Media/Abilities/CRYPTOSIGN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Staking Rewards",
    description: "Provides periodic healing to all allies.",
    tooltip: "Stake and earn. Heal over time.",
    thumbnail: 'Media/Abilities/STAKINGREWARD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "DAO Governance",
    description: "Empowers allies with decision-making buffs.",
    tooltip: "Collective power like a DAO!",
    thumbnail: 'Media/Abilities/DAOGOVERNANCE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Finger Pointing",
    description: "Implements a major change, significantly debuffing enemies.",
    tooltip: "Implement protocol governance. Buff allies and debuff enemies.",
    thumbnail: 'Media/Abilities/FINGER.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Surprise Liquidation",
    description: "Causes a massive area-of-effect damage.",
    tooltip: "Liquidated harder than a leveraged trade gone wrong!",
    thumbnail: "Media/Abilities/LIQUIDATIONEVENT.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Price Divergence ",
    description: "Confuses enemies, causing them to attack each other.",
    tooltip: "Create price divergence. Confuse enemies to attack each other.",
    thumbnail: "Media/Abilities/DIVERGENCE.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Compliance Order",
    description: "Forces enemies to move towards the player, taking damage over time.",
    tooltip: "Issue a compliance order. Force enemies to move towards you and take damage.",
    thumbnail: "Media/Abilities/COMPLIANCEORDER.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Entanglement",
    description: "Links enemies, causing damage to spread among them.",
    tooltip: "Entangle your enemies. Damage spreads.",
    thumbnail: "Media/Abilities/ENTANGLEMENT.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Decentralized Network",
    description: "Summons allies to assist in battle.",
    tooltip: "Rally the network. Summon allies to join the fight.",
    thumbnail: 'Media/Abilities/DECENTRALIZEDNETWORK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Liquidity Pool",
    description: "Creates a pool that heals allies and damages enemies.",
    tooltip: "Providing liquidity like a degen in a farm!",
    thumbnail: 'Media/Abilities/LIQUIDITYPOOL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Initial DEX Offering",
    description: "Increases allies' attack power.",
    tooltip: "Launch on the DEX. Pump up those attacks.",
    thumbnail: 'Media/Abilities/INITIALDEXOFFERING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "No Coin FUD",
    description: "Decreases enemy attack power and movement speed.",
    tooltip: "Spread FUD. Decrease enemy attack power and speed.",
    thumbnail: "Media/Abilities/NOCOINFUD.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Network Effect",
    description: "Increases the effectiveness of all abilities.",
    tooltip: "Network effect in action. Boost all your powers.",
    thumbnail: 'Media/Abilities/NETWORKEFFECT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Chain Reaction",
    description: "Causes a chain reaction, revealing all enemies and drastically debuffing them while significantly buffing allies.",
    tooltip: "Trigger a chain reaction. Reveal, debuff enemies, and buff allies.",
    thumbnail: 'Media/Abilities/CHAINREACTION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "FOMO Wave",
    description: "Induces fear of missing out, causing enemies to rush towards the player.",
    tooltip: "Create a wave of FOMO. Draw enemies towards you.",
    thumbnail: "Media/Abilities/FOMO.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Chain Analysis",
    description: "Reveals hidden enemies and tracks their movements.",
    tooltip: "Analyze the chain. Reveal and track enemies.",
    thumbnail: "Media/Abilities/ANALYSIS.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidation Wave",
    description: "Deals area-of-effect damage and reduces enemy defenses.",
    tooltip: "Create a liquidation wave. Deal AoE damage and reduce enemy defenses.",
    thumbnail: "Media/Abilities/MASSLIQUIDATION.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Quick Flip",
    description: "Deals instant damage to nearby enemies.",
    tooltip: "Quick flip. Deal instant damage.",
    thumbnail: "Media/Abilities/QUICKFLIP.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Dollar Cost average",
    description: "Deals Slow damage to nearby enemies.",
    tooltip: "Deal Slow damage.",
    thumbnail: "Media/Abilities/DCA.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Jackpot",
    description: "Hits the jackpot, dealing massive damage to all enemies and providing significant buffs to allies.",
    tooltip: "Hit the jackpot. Massive damage and significant buffs.",
    thumbnail: "Media/Abilities/JACKPOT.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Airdrop",
    description: "Drops valuable items or buffs to allies.",
    tooltip: "Free goodies like an airdrop!",
    thumbnail: 'Media/Abilities/AIRDROP.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Blockchain Stress Test ",
    description: "Creates a zone where enemies take increased damage and have reduced speed.",
    tooltip: "Conduct a stress test. Increase enemy damage and reduce speed.",
    thumbnail: 'Media/Abilities/STRESSTEST.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Feature Test ",
    description: "Temporarily boosts allies' abilities.",
    tooltip: "Test features. Temporarily boost ally abilities.",
    thumbnail: 'Media/Abilities/FEATURETEST.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Oracle Insight",
    description: "Predicts enemy movements, increasing evasion.",
    tooltip: "Seeing the future like an oracle!",
    thumbnail: 'Media/Abilities/ORACLEINSIGHT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale Buy",
    description: "Unleashes a powerful area-of-effect attack, representing a large buy order.",
    tooltip: "Make a whale buy. Execute a powerful area-of-effect attack.",
    thumbnail: "Media/Abilities/WHALEBUY.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: " Trilemma Mastery",
    description: "Master the trilemma by providing significant buffs to attack, defense, and movement speed while weakening enemies.",
    tooltip: "Achieve trilemma mastery. Boost attack, defense, and movement speed while weakening enemies.",
    thumbnail: "Media/Abilities/LAW.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Oracle Manipulation",
    description: "Disrupts enemy abilities based on false data.",
    tooltip: "Manipulated just like those price feeds!",
    thumbnail: "Media/Abilities/ORACLEMANIPULATION.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Market Manipulation ",
    description: "Temporarily controls enemy movements.",
    tooltip: "Manipulate the market. Control enemy movements.",
    thumbnail: "Media/Abilities/MARKETMANIPULATION.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Impermanent Loss",
    description: "Reduces damage taken from all sources.",
    tooltip: "Shield against impermanent loss. Take less damage.",
    thumbnail: 'Media/Abilities/IMPERMANENTLOSS.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Tripool",
    description: "Creates three separate pools that buff allies' attack power.",
    tooltip: "Triple the pools, triple the power. Buff your allies.",
    thumbnail: 'Media/Abilities/TRIPOOL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Rug Pull",
    description: "Instantly removes buffs from enemies.",
    tooltip: "Rugged like a failed project!",
    thumbnail: 'Media/Abilities/RUG.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Debt Collector",
    description: "Focuses on sustained damage and debuffs.",
    tooltip: "Be the debt collector. Sustain damage and apply debuffs.",
    thumbnail: "Media/Abilities/DEBTCOLLECTOR.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Swing",
    description: "Temporarily increases critical hit chance and attack speed.",
    tooltip: "Ride the market swing. Increase critical hit chance and attack speed.",
    thumbnail: "Media/Abilities/MARKETSWING.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Maker",
    description: "Balances the battlefield by adjusting enemy and ally stats.",
    tooltip: "Balancing like a true market maker!",
    thumbnail: 'Media/Abilities/MARKETMAKER.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Two Pool",
    description: "Creates two separate pools that buff allies' attack speed.",
    tooltip: "Double the pools, double the speed. Boost your allies' attack rate.",
    thumbnail: 'Media/Abilities/TWOPOOL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Bridge",
    description: "Transfers resources between allies.",
    tooltip: "Bridging like cross-chain assets!",
    thumbnail: 'Media/Abilities/BRIDGE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Buyout Power",
    description: "Temporarily takes control of an enemy, turning them into an ally.",
    tooltip: "Leverage your buyout power. Control an enemy.",
    thumbnail: 'Media/Abilities/BUYPOWER.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Merkle Proof",
    description: "Verifies resources securely.  preventing theft",
    tooltip: "Proof like a Merkle tree!",
    thumbnail: 'Media/Abilities/MERKLE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Compliance Check",
    description: "Forces enemies to slow down and take damage over time.",
    tooltip: "Ensure compliance. Slow down enemies and deal damage.",
    thumbnail: 'Media/Abilities/COMPLIANCE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Portfolio",
    description: "Increases the efficiency of resource gathering.",
    tooltip: "Boosting like a diversified portfolio!",
    thumbnail: 'Media/Abilities/FOLIO.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},{
    title: "Zodiac Prediction ",
    description: "Predicts and reveals enemies' weaknesses, reducing their defenses.",
    tooltip: "The zodiac reveals all. Know your enemies' weaknesses.",
    thumbnail: 'Media/Abilities/ZODIAC.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    }
},
{
    title: "DeFi Yield",
    description: "Periodically grants a boost in resources.",
    tooltip: "APY like a degen farm!",
    thumbnail: 'Media/Abilities/DEFIYIELD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: 'Escrow Services',
    description: "Holds resources in escrow, releasing them after a delay.",
    tooltip: "Escrow like a smart contract!",
    thumbnail: 'Media/Abilities/ESCROW.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Bitcoin Dominance ',
    description: "Temporarily controls all enemies, making them fight each other.",
    tooltip: "Take total control. Enemies turn on each other.",
    thumbnail: 'Media/Abilities/DOMINANCE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "NFT Disruptor",
    description: "Temporarily disables the effects of enemy NFTs.",
    tooltip: "Disrupt like a true NFT master!",
    thumbnail: 'Media/Abilities/NFTDISRUPTOR.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Blockchain Analysis",
    description: "Provides insights to increase strategy effectiveness.",
    tooltip: "Analyzing like a blockchain expert!",
    thumbnail: 'Media/Abilities/BLOCKANALYSIS.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Decentralized Finance Expertise",
    description: "Increases the effectiveness of all resource-gathering abilities.",
    tooltip: "Go DeFi. Boost your resource gains.",
    thumbnail: 'Media/Abilities/EXPERTISE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Trader's Instinct ",
    description: "Enhances movement speed and reduces skill cooldowns in critical moments.",
    tooltip: "Instincts kick in. Move faster and reduce cooldowns when it matters most.",
    thumbnail: 'Media/Abilities/INTUITION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Margin Call ",
    description: "Forces enemies to take damage over time.",
    tooltip: "Issue a margin call. Inflict damage over time.",
    thumbnail: 'Media/Abilities/MARGINCALL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Perfect Arbitrage",
    description: "Executes a perfect arbitrage, drastically increasing attack power and critical hit chance for a short period.",
    tooltip: "Execute perfect arbitrage. Increase attack power and critical hit chance.",
    thumbnail: 'Media/Abilities/ARBITRAGE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Temperature Check",
    description: "Executes a perfect arbitrage, drastically increasing attack power and critical hit chance for a short period.",
    tooltip: "Execute perfect arbitrage. Increase attack power and critical hit chance.",
    thumbnail: 'Media/Abilities/TEMPCHECK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Treasury Allocation",
    description: "Provides a large amount of resources to all allies.",
    tooltip: "Allocate the treasury. Distribute the wealth.",
    thumbnail: 'Media/Abilities/TREASURYALLOC.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Lucky Streak",
    description: "Temporarily increases critical hit chance and dodge rate.",
    tooltip: "Ride a lucky streak. Increase critical hit chance and dodge rate.",
    thumbnail: 'Media/Abilities/STREAK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Self Custody",
    description: "Protects resources from being stolen.",
    tooltip: "Secure like a custody service!",
    thumbnail: 'Media/Abilities/CUSTODY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Flash Crash",
    description: "Briefly stuns all enemies in the area.",
    tooltip: "Stunning like a sudden market crash!",
    thumbnail: 'Media/Abilities/MARKETCRASH.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Stake Defense",
    description: "Increases defense for a short period.",
    tooltip: "Strengthen your defenses with stakes.",
    thumbnail: 'Media/Abilities/STAKEDEFENSE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
 
{
    title: "Final Release",
    description: "Launches the final release, significantly buffing all allies and debuffing all enemies.",
    tooltip: "Release the final version. Buff allies and debuff enemies.",
    thumbnail: 'Media/Abilities/FINALRELEASE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Fork",
    description: "Creates a duplicate of an ability for a short time.",
    tooltip: "Forking like a blockchain split!",
    thumbnail: 'Media/Abilities/CRYPTOFORK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Wallet",
    description: "Stores resources securely.",
    tooltip: "Storing like a hardware wallet!",
    thumbnail: 'Media/Abilities/WALLET.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Slashing Protection",
    description: "Reduces damage taken from critical hits.",
    tooltip: "Protect against slashing. Reduce crit damage.",
    thumbnail: 'Media/Abilities/SLASHINGPROTECTION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Security Lockdown",
    description: "Reduces damage taken for a short period.",
    tooltip: "Lock it down, secure the bag. Take less damage.",
    thumbnail: 'Media/Abilities/LOCKDOWN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Scalability Boost",
    description: "Increases attack speed and movement speed.",
    tooltip: "Scaling up like a true degen, moving fast and striking hard.",
    thumbnail: 'Media/Abilities/SCALABILITYBOOST.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "ICO Hype",
    description: "Temporarily boosts all stats.",
    tooltip: "Hyped like an ICO!",
    thumbnail: 'Media/Abilities/ICOHYPE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "ReBalancing ",
    description: "Spreads damage taken to nearby enemies.",
    tooltip: "Balance the load. Spread damage to nearby enemies.",
    thumbnail: 'Media/Abilities/REBALANCING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Rally",
    description: "Temporarily boosts all allies' speed.",
    tooltip: "Rallying like a bull market!",
    thumbnail: 'Media/Abilities/RALLY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Whitelist",
    description: "Grants immunity to debuffs.",
    tooltip: "Protected like a whitelist spot!",
    thumbnail: 'Media/Abilities/WHITELIST.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Blacklist",
    description: "Grants immunity to buffs.",
    tooltip: "Blocked",
    thumbnail: 'Media/Abilities/BLACKLIST.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Pump and Dump",
    description: "Increases attack power significantly for a short duration, followed by a debuff.",
    tooltip: "Pump it up, then brace for the dump.",
    thumbnail: 'Media/Abilities/PND.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Pump",
    description: "Increases attack power significantly for a short duration",
    tooltip: "Pump it up.",
    thumbnail: 'Media/Abilities/PUMP.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Lending Protocol',
    description: "Lends resources to allies temporarily.",
    tooltip: "Lending like a DeFi protocol!",
    thumbnail: 'Media/Abilities/LENDING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Token Lock',
    description: "Locks an enemy's abilities temporarily.",
    tooltip: "Locked like funds in a smart contract!",
    thumbnail: 'Media/Abilities/TOKENLOCK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Locked In",
    description: "Maximize your profits and outpace the competition with unparalleled focus and strategic insight.",
    tooltip: "Locked in and loaded! Maximize your profits and outpace the competition with unparalleled focus.",
    thumbnail: 'Media/Abilities/LOCKEDIN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Adaptive Trading",
    description: "Adapts to the situation, dealing damage based on the player's needs.",
    tooltip: "Adapt and overcome. Your strikes change to fit the need.",
    thumbnail: 'Media/Abilities/ADAPTIVETRADING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Token Burn",
    description: "Permanently removes a portion of enemy resources.",
    tooltip: "Burned like tokens in a supply reduction!",
    thumbnail: 'Media/Abilities/TOKENBURN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Delegation",
    description: "Allows the player to share buffs with allies.",
    tooltip: "Delegate and elevate. Share the wealth.",
    thumbnail: 'Media/Abilities/DELEGATION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Mastery",
    description: "Master protocols to provide comprehensive buffs to all allies and debuff enemies significantly.",
    tooltip: "Achieve protocol mastery. Provide extensive buffs and debuffs.",
    thumbnail: 'Media/Abilities/MASTERY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Exploit ",
    description: "Deals significant damage to a single target and restores health.",
    tooltip: "Exploit vulnerabilities. Deal damage and restore health.",
    thumbnail: 'Media/Abilities/EXPLOIT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Patch",
    description: "Creates a temporary area that boosts allies' defenses.",
    tooltip: "Deploy a patch. Boost allies' defenses.",
    thumbnail: 'Media/Abilities/PATCHDEPLOY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Inside Info",
    description: "Reveals hidden enemies and weak points.",
    tooltip: "Gain inside information. Reveal hidden enemies and weak points.",
    thumbnail: 'Media/Abilities/INSIDEINFO.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Debate",
    description: "Temporarily silences and weakens enemies.",
    tooltip: "Engage in debate. Silence and weaken enemies.",
    thumbnail: 'Media/Abilities/DEBATE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Profit Taker ",
    description: "Buffs self and allies after defeating enemies.",
    tooltip: "Take profits. Buff self and allies after defeating enemies.",
    thumbnail: 'Media/Abilities/PROFITTAKING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Regulatory Framework ",
    description: "Creates a barrier that blocks enemy movement.",
    tooltip: "Establish a regulatory framework. Block enemy movement.",
    thumbnail: 'Media/Abilities/REGULATORYFRAMEWORK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Transaction Revert",
    description: "Teleports the player to a previous location, avoiding damage.",
    tooltip: "Revert to a previous location. Avoid damage.",
    thumbnail: 'Media/Abilities/TXREVERT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Code Review",
    description: "Temporarily reveals enemy weaknesses and increases damage dealt.",
    tooltip: "Review code. Reveal weaknesses and increase damage.",
    thumbnail: 'Media/Abilities/REVIEW.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "QA",
    description: "Enhances ally buffs and reduces enemy effectiveness.",
    tooltip: "Quality assurance. Enhance buffs and reduce enemy effectiveness.",
    thumbnail: 'Media/Abilities/QUALITYASSURANCE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Let him Cook",
    description: "Over time, gains stats exponentially.",
    tooltip: "Burned like tokens in a supply reduction!",
    thumbnail: 'Media/Abilities/COOK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: 'Token UnLock',
    description: "Locks an enemy's abilities temporarily.",
    tooltip: "Locked like funds in a smart contract!",
    thumbnail: 'Media/Abilities/TOKENUNLOCK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crop Rotation",
    description: "Switches between different buffs to suit the player's needs.",
    tooltip: "Rotate crops. Switch between buffs.",
    thumbnail: 'Media/Abilities/ROTATION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Dapp",
    description: "Creates a decentralized application for resource generation.",
    tooltip: "Building like a dApp developer!",
    thumbnail: 'Media/Abilities/DAPP.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Bounty",
    description: "Rewards for defeating enemies.",
    tooltip: "Bounties like finding bugs in protocols!",
    thumbnail: 'Media/Abilities/CRYPTOBOUNTY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidity Vampire",
    description: "Steals resources and buffs self and allies.",
    tooltip: "Be a liquidity vampire. Steal resources and buff allies.",
    thumbnail: "Media/Abilities/LIQUIDITYVAMPIRE.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "Frontrunning Bot",
    description: "Increases movement speed and prioritizes attacks.",
    tooltip: "Faster than your FOMO trades!",
    thumbnail: 'Media/Abilities/FRONTRUNNINGBOT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Malware Injection ",
    description: "Inflicts damage over time and reduces enemy attack speed.",
    tooltip: "Inject malware. Damage and slow your enemies.",
    thumbnail: "Media/Abilities/BUG.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title:  "Network Consensus",
    description: "Achieves network consensus, significantly boosting allies' defense and providing damage immunity for a short period.",
    tooltip: "Achieve network consensus. Boost defense and provide damage immunity.",
    thumbnail: "Media/Abilities/CONSENSUS.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Exploit Finder",
    description: "Scans for enemy weaknesses and exploits them.",
    tooltip: "Finding bugs like a true degen!",
    thumbnail: "Media/Abilities/EXPLOITFINDER.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Chain Split",
    description: "Creates a duplicate of yourself to confuse enemies.",
    tooltip: "Splitting like a forked chain!",
    thumbnail: 'Media/Abilities/CHAINSPLIT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Validator Uptime",
    description: "Increases the duration of all buffs.",
    tooltip: "Stay online. Extend those buffs.",
    thumbnail: 'Media/Abilities/VALIDATORUPTIME.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Exit Scam",
    description: "Teleports to a safe location and leaves a damaging decoy behind.",
    tooltip: "Execute an exit scam. Teleport and leave a damaging decoy.",
    thumbnail: 'Media/Abilities/EXITSCAM.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sellout",
    description: "Trades a portion of your resources for a temporary power boost.",
    tooltip: "Sellout for power. Trade resources for a boost.",
    thumbnail: 'Media/Abilities/SELLOUT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Crash",
    description: "Creates a zone where enemies take increased damage and have reduced speed.",
    tooltip: "Crash the protocol. Increase damage and slow enemies.",
    thumbnail: 'Media/Abilities/PROTOCOLCRASH.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Trading Frenzy",
    description: "Increases speed and critical hit chance drastically for a short time.",
    tooltip: "Enter a trading frenzy. Maximum speed and precision.",
    thumbnail: 'Media/Abilities/TRADINGFRENZY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Hash Power",
    description: "Temporarily increases attack power.",
    tooltip: "Harness the power of the hash. Strike with more force.",
    thumbnail: 'Media/Abilities/HASHPOWER.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Miner Network",
    description: "Creates a zone that damages enemies over time.",
    tooltip: "Lay down the mines. Enemies beware.",
    thumbnail: 'Media/Abilities/MINERNETWORK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Validator Support",
    description: "Summons a temporary ally to aid in battle.",
    tooltip: "Call in support from a trusted validator.",
    thumbnail: 'Media/Abilities/VALIDATORSUPPORT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Diamond Hands ",
    description: "Reduces damage taken significantly for a short period.",
    tooltip: "Hold with diamond hands. Reduce damage taken.",
    thumbnail: 'Media/Abilities/DIAMONDHANDS.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "HODL",
    description: "Increases the player's defense.",
    tooltip: "HODL strong. Boost your defense.",
    thumbnail: 'Media/Abilities/HODL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Titanium Support ",
    description: "Creates a barrier that absorbs damage.",
    tooltip: "HODL the line. Create a damage-absorbing barrier.",
    thumbnail: 'Media/Abilities/SUPPORT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'The Citadel',
    description: "Constructs a powerful fortress that provides extensive protection to allies and significantly disrupts enemies.",
    tooltip: "Build a network fortress. Offer extensive protection and disrupt enemies.",
    thumbnail: 'Media/Abilities/CITADEL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Total Shutdown",
    description: "Shuts down all enemy abilities and greatly reduces their stats for a short period.",
    tooltip: "Initiate total shutdown. Disable and weaken enemies.",
    thumbnail: 'Media/Abilities/SHUTDOWN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Market Stabilization',
    description: "Stabilizes prices, reducing enemy attack power and increasing ally defense.",
    tooltip: "Stabilize prices. Reduce enemy attack power and boost ally defense.",
    thumbnail: 'Media/Abilities/STABILIZATION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Contract Breach",
    description: "Disables enemy abilities for a short period.",
    tooltip: "Breach their systems. Disable enemy abilities.",
    thumbnail: 'Media/Abilities/BREACH.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Single Stake",
    description: "Increases health regeneration based on a single stake.",
    tooltip: "Stake your claim. Boost health regeneration.",
    thumbnail: 'Media/Abilities/SINGLESTAKE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Capital Injection ",
    description: "Provides a significant health boost to the player or an ally.",
    tooltip: "Inject capital. Boost health significantly.",
    thumbnail: 'Media/Abilities/CAPITALINJECTION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Due Diligence",
    description: "Reveals enemies' weaknesses and reduces their defenses.",
    tooltip: "Conduct due diligence. Know and weaken your enemies.",
    thumbnail: 'Media/Abilities/DD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Funding Boost ",
    description: "Increases resource generation for a short period.",
    tooltip: "Boost your funding. Increase resource generation.",
    thumbnail: 'Media/Abilities/FUNDINGBOOST.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Firewall Fort",
    description: "Increases the player's defense temporarily.",
    tooltip: "Raise your firewall. Increase defense.",
    thumbnail: 'Media/Abilities/FIREWALL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "DeFi Supremacy",
    description: "Establishes complete DeFi dominance, significantly enhancing all aspects of resource generation and providing massive buffs to allies.",
    tooltip: "Achieve DeFi supremacy. Enhance resource generation and buff allies extensively.",
    thumbnail: 'Media/Abilities/DEFISUPREMACY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Leveraged Yield",
    description: "Increases resource generation for a short period.",
    tooltip: "Boost yield. Increase resource generation temporarily.",
    thumbnail: 'Media/Abilities/LEVERAGEDYIELD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Collector Frenzy",
    description: "Calls upon devoted collectors to swarm enemies, dealing massive damage.",
    tooltip: "Collectors are on the hunt! Unleash their frenzy on your foes.",
    thumbnail: 'Media/Abilities/COLLECTORSFRENZY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Capitulation',
    description: "Spreads widespread fear and panic, causing enemies to lose resources and morale.",
    tooltip: "Instill capitulation. Cause widespread fear and resource loss.",
    thumbnail: 'Media/Abilities/CAPITULATION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Maxi Ascendancy",
    description: "Ascends to a state of maximum power, drastically increasing all stats and providing powerful buffs to allies for a short period.",
    tooltip: "Achieve maxi ascendancy. Drastically boost stats and buff allies.",
    thumbnail: 'Media/Abilities/MAXIAS.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Inspection",
    description: "Reveals and debuffs all enemies in a targeted area.",
    tooltip: "Conduct an inspection. Reveal and debuff enemies.",
    thumbnail: 'Media/Abilities/INSPECTION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Exit Hatch ",
    description: "Grants one extra life.",
    tooltip: "One chance to escape from a L2+.",
    thumbnail: 'Media/Abilities/EXITHATCH.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Chain Reorg",
    description: "Rewinds time slightly to undo recent events.",
    tooltip: "Reorg'd like a 51% attack!",
    thumbnail: 'Media/Abilities/CHAINREORG.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Pact with the Devil",
    description: "Grants a significant boost in power at the cost of health.",
    tooltip: "Make a pact. Gain power, but lose health.",
    thumbnail: 'Media/Abilities/PACTWITHTHEDEVIL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Congestion",
    description: "Slows all enemies for a short duration.",
    tooltip: "Freeze the network! Slow down all activity.",
    thumbnail: "Media/Abilities/CONGESTION.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Mining Frenzy",
    description: "Triggers a mining frenzy, drastically increasing attack power and speed for a short period.",
    tooltip: "Enter a mining frenzy. Drastically increase attack power and speed.",
    thumbnail: "Media/Abilities/MININGFRENZY.PNG",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "DDoS Attack",
    description: "Stuns all enemies for a short duration.",
    tooltip: "Overloaded like a cheap DDoS script!",
    tooltip: "Freeze the network! Slow down all activity.",
    thumbnail: "Media/Abilities/DDOS.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Data Blob",
    description: "Provides a significant health boost.",
    tooltip: " More health, more power.",
    thumbnail: 'Media/Abilities/BLOB.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Interest Yield",
    description: "Gradually regenerates health over time.",
    tooltip: "Reap the benefits of your interest. Regenerate health.",
    thumbnail: 'Media/Abilities/INTERESTYIELD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Monolithic Design",
    description: "Provides a significant health boost.",
    tooltip: "Built like a monolith. More health, more power.",
    thumbnail: 'Media/Abilities/MONOLITHICDESIGN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Multilayer Design",
    description: "Adds an additional layer of defense.",
    tooltip: "Layer up! More defense, less worry.",
    thumbnail: 'Media/Abilities/MULTILAYERDESIGN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Layer 2 Scaling",
    description: "Reduces the cost and cooldown of all abilities.",
    tooltip: "Scale up and save! Reduce costs and cooldowns.",
    thumbnail: 'Media/Abilities/LAYERSCALING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Patience",
    description: "Gradually regenerates health over time.",
    tooltip: "Show market patience. Gradually regenerate health.",
    thumbnail: 'Media/Abilities/PATIENCE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidity Mining",
    description: "Generates resources over time.",
    tooltip: "Earning passively like liquidity mining!",
    thumbnail: 'Media/Abilities/LIQUIDITYMINING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Gas Optimization",
    description: "Decreases mana cost of all abilities.",
    tooltip: "Optimize your gas, save on costs. Efficiency wins.",
    thumbnail: 'Media/Abilities/GASOPTIMIZATION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bearish Sentiment",
    description: "Reduces enemies' attack power.",
    tooltip: "Bearish like a market downturn!",
    thumbnail: 'Media/Abilities/BEARISHSENTIMENT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale Games",
    description: "Uses overwhelming power to crush enemies.",
    tooltip: "Whale-sized like a market mover!",
    thumbnail: 'Media/Abilities/CRYPTOWHALE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bullish Sentiment",
    description: "Increases allies' attack power.",
    tooltip: "Bullish like a market rally!",
    thumbnail: 'Media/Abilities/BULLISHSENTIMENT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Vampire ATTACK",
    description: "Steals resources.",
    tooltip: "Steal resources and buff allies.",
    thumbnail: "Media/Abilities/VAMPIREATTACK.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Black Swan Event",
    description: "Creates a chaotic event that massively disrupts enemy abilities and resources while providing significant buffs to allies.",
    tooltip: "Trigger a black swan event. Cause chaos and gain massive advantages.",
    thumbnail: "Media/Abilities/BLACKSWAM.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Dead Cat Bounce",
    description: "Temporarily makes the player invincible and greatly increases attack power.",
    tooltip: "Unbreakable resolve. Become invincible and unleash your power.",
    thumbnail: 'Media/Abilities/DEADCATBOUNCE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "White Swan Event",
    description: "Creates an event that massively benefits all market participants providing significant buffs.",
    tooltip: "Trigger a black swan event. Cause chaos and gain massive advantages.",
    thumbnail: "Media/Abilities/WHITESWAM.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crab Market Action ",
    description: "Reverses buff and debuffs of everyone for the rest of the game .",
    tooltip: "Trigger a Crab market action.",
    thumbnail: "Media/Abilities/CRABACTION.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Unicorn Startup',
    description: 'a very rare sight.',
    tooltip: "Execute a policy overhaul. Buff allies and debuff enemies significantly.",
    thumbnail: 'Media/Abilities/UNICORN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Male Astrology",
    description: "Predicts and reveals enemies' weaknesses, reducing their defenses.",
    tooltip: "The zodiac reveals all. Know your enemies' weaknesses.",
    thumbnail: 'Media/Abilities/ASTROLOGY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    }
},
{
    title: "NFT Enhancer",
    description: "Boosts the effects of your NFTs.",
    tooltip: "Enhancing like an NFT upgrade!",
    thumbnail: 'Media/Abilities/NFTREWORK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "Debt Drown ",
    description: "Provides a temporary boost to defense and health regeneration.",
    tooltip: "Unyielding spirit. Boost your defense and health regen.",
    thumbnail: 'Media/Abilities/DEBTDROWN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "NFT Marketplace",
    description: "Increases the drop rate of rare items.",
    tooltip: "Trade NFTs. Find rare items more often.",
    thumbnail: 'Media/Abilities/NFTMARKET.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sanction",
    description: "Targets a single enemy, greatly reducing its speed and defense.",
    tooltip: "Impose sanctions. Weaken a single enemy.",
    thumbnail: 'Media/Abilities/SANCTION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Scam Alert ",
    description: "Temporarily decreases enemies' attack power and movement speed.",
    tooltip: "Sound the scam alert. Weaken your enemies.",
    thumbnail: 'Media/Abilities/SCAM.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "Double or Nothing ",
    description: "Randomly buffs or debuffs the player.",
    tooltip: "Double or nothing. Randomly buff or debuff yourself.",
    thumbnail: 'Media/Abilities/DOUBLEORNOTHING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Skeptical Scholar",
    description: "Buffs allies' defense and reduces enemy effectiveness.",
    tooltip: "Skeptical scholar. Buff allies' defense and reduce enemy effectiveness.",
    thumbnail: 'Media/Abilities/SKEPTIC.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Policy Overhaul',
    description: "Executes a policy overhaul, providing massive buffs to allies and drastically debuffing enemies across the battlefield.",
    tooltip: "Execute a policy overhaul. Buff allies and debuff enemies significantly.",
    thumbnail: 'Media/Abilities/OVERHAUL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "Lunar Cycle ",
    description: "Provides buffs or debuffs based on the current moon phase.",
    tooltip: "Harness the power of the moon. Buffs and debuffs change with each phase.",
    thumbnail: 'Media/Abilities/LUNARCYCLE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Signal",
    description: "Calls for reinforcements to aid in battle.",
    tooltip: "Signaling like a trading bot!",
    thumbnail: 'Media/Abilities/CRYPTOSIGNAL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Flash Loan",
    description: "Temporarily boosts resources for a short period.",
    tooltip: "Leveraged like a flash loan exploit!",
    thumbnail: 'Media/Abilities/FLASHLOAN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Star Alignment ",
    description: "Increases critical hit chance and attack power when stars align.",
    tooltip: "The stars have aligned! Your attacks become more powerful.",
    thumbnail: 'Media/Abilities/ALIGNMENT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Risk Taker",
    description: "High-risk, high-reward abilities.",
    tooltip: "Take a risk. High-risk, high-reward abilities.",
    thumbnail: 'Media/Abilities/RISKTAKER.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Shill",
    description: "Temporarily increases allies' attack power and speed.",
    tooltip: "Shill your way to victory. Boost ally attack power and speed.",
    thumbnail: 'Media/Abilities/SHILLING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Compound Interest ",
    description: "Gradually increases attack power and defense over time.",
    tooltip: "Compound interest. Gradually increase attack power and defense.",
    thumbnail: 'Media/Abilities/COMPOUND.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Hype Train",
    description: "Summons a stampede of followers that trample enemies.",
    tooltip: "Summon the hype train. Trample your enemies.",
    thumbnail: 'Media/Abilities/HYPETRAIN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Virality ",
    description: "Goes viral, drastically increasing the effectiveness of all abilities and summoning followers to fight alongside.",
    tooltip: "Become a viral sensation. Amplify abilities and summon followers.",
    thumbnail: 'Media/Abilities/VIRALITY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Viral Spread ",
    description: "Goes viral, drastically increasing the effectiveness of all abilities and summoning followers to fight alongside.",
    tooltip: "Become a viral sensation. Amplify abilities and summon followers.",
    thumbnail: 'Media/Abilities/SPREAD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Second Best ",
    description: "Gradually increases attack power and defense over time.",
    tooltip: "Compound interest. Gradually increase attack power and defense.",
    thumbnail: 'Media/Abilities/SECONDBEST.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Martket Impact",
    description: "Enhances debuffs and controls enemy behavior.",
    tooltip: "Critique crypto. Enhance debuffs and control enemies.",
    thumbnail: 'Media/Abilities/MARKETIMPACT.png',
        isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "It's Over ",
    description: "over.",
    tooltip: "Declare the end. Reduce enemy effectiveness and cause them to falter.",
    thumbnail: 'Media/Abilities/OVER.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "All In",
    description: "Deals massive damage to a single target but leaves the player vulnerable.",
    tooltip: "Go all in. Deal massive damage but become vulnerable.",
    thumbnail: 'Media/Abilities/ALLIN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Token Swap",
    description: "Exchanges debuffs for buffs with enemies.",
    tooltip: "Swapped like a dex trade!",
    thumbnail: 'Media/Abilities/COINSWAP.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Bug Fixing',
    description: "Fixes bugs in the code, restoring a small amount of health.",
    tooltip: "Fix the bugs. Restore your health.",
    thumbnail: 'Media/Abilities/ASSISTEDBUGFIXING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Upgrade Shiping',
    description: "Splits the player's attacks into multiple projectiles, hitting more enemies.",
    tooltip: "Divide and conquer! Your attacks hit multiple targets.",
    thumbnail: 'Media/Abilities/SHIPPING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Raider",
    description: "Focuses on high-damage, single-target attacks.",
    tooltip: "Raid protocols. High-damage, single-target attacks.",
    thumbnail: 'Media/Abilities/RAIDING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},

{
    title: "Sidechains",
    description: "Allows the player to create decoys that distract enemies.",
    tooltip: "Sidechains for sidekicks! Distract your enemies.",
    thumbnail: "Media/Abilities/SIDECHAIN.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Gas Limit",
    description: "Reduces the speed of all enemies in a large area.",
    tooltip: "Set a gas limit. Reduce enemy speed in a large area.",
    thumbnail: "Media/Abilities/GASLIMIT.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Critical Patch",
    description: "Deploys a critical patch, significantly buffing all allies and debuffing all enemies.",
    tooltip: "Deploy a critical patch. Buff allies and debuff enemies.",
    thumbnail: "Media/Abilities/CRITICALPATCH.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: 'Light Node Run',
    description: "Increases movement speed.",
    tooltip: "Light on your feet, quick on your toes.",
    thumbnail: "Media/Abilities/LNRUN.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Investigation",
    description: "Buffs self and allies based on revealed enemy locations.",
    tooltip: "Investigate crypto. Buff self and allies based on enemy locations.",
    thumbnail: "Media/Abilities/CRYPTOINVESTIGATION.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Criminal Hunt ",
    description: "Deals extra damage to recently revealed enemies.",
    tooltip: "Hunt criminals. Deal extra damage to revealed enemies.",
    thumbnail: "Media/Abilities/CRIMINALHUNT.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Transaction Trace",
    description: "Temporarily reduces enemy speed and reveals weak points.",
    tooltip: "Trace transactions. Reduce speed and reveal weak points.",
    thumbnail: "Media/Abilities/TXTRACE.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Drain",
    description: "Drains multiple protocols simultaneously, dealing massive damage to all enemies and providing significant resources to allies.",
    tooltip: "Drain multiple protocols. Massive damage and resource gain.",
    thumbnail: "Media/Abilities/DRAIN.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "NFT Masterpiece",
    description: "Creates a stunning piece of digital art that distracts enemies and boosts allies' morale.",
    tooltip: "A true masterpiece! Watch as enemies are mesmerized and allies are inspired.",
    thumbnail: "Media/Abilities/NFTMASTERPIECE.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale Alert",
    description: "Marks the strongest enemy, increasing damage dealt to them",
    tooltip: "Spotted a whale in the arena!",
    thumbnail: "Media/Abilities/WHALEALERT.png",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
        // Implement the effect logic here
    }
},
{
    title: "Smart Contract Deployment",
    description: "Deploys a smart contract to trap and damage enemies.",
    tooltip: "Caught in a gas war!",
    thumbnail: 'Media/Abilities/SMARTCONTRACT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
        // Implement the effect logic here
    }
},
{
    title: "Smart Contract Audit",
    description: "Identifies and negates enemy traps.",
    tooltip: "Secure like a certified audit!",
    thumbnail: 'Media/Abilities/SMARTCONTRACTAUDIT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Smart Contract Hack",
    description: "Deals consistent damage over time to enemies.",
    tooltip: "Exploiting vulnerabilities like a pro!",
    thumbnail: 'Media/Abilities/SMARTCONTRACTHACK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Quantum Key Exchange 🔑",
    description: "Transfers health from enemies to the player.",
    tooltip: "Exchange health. Transfer from enemies to you.",
    thumbnail: 'Media/Abilities/QKEYEX.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Anti-Rug Bot",
    description: "Detects and disables rug traps.",
    tooltip: "No more rug-pulls for you. Detect and disable rug traps.",
    thumbnail: 'Media/Abilities/RUGBOT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bot Swarm",
    description: "Summons additional bots to assist in battle.",
    tooltip: "Summon a bot swarm. Increase your firepower.",
    thumbnail: 'Media/Abilities/SWARM.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bot Armada",
    description: "Summons an entire armada of bots for massive support and damage.",
    tooltip: "Call in the bot armada. Maximum support and damage.",
    thumbnail: 'Media/Abilities/ARMADA.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "MEV Bot",
    description: "Drains health from enemies based on their movements.",
    tooltip: "Front-running like an MEV bot!",
    thumbnail: 'Media/Abilities/MEVBOT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sniping Bot",
    description: "Enhances critical hit chances and accuracy.",
    tooltip: "Get the perfect shot. Increase critical hit chances and accuracy.",
    thumbnail: 'Media/Abilities/SNIPEBOT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Fear Spread",
    description: "Spreads fear, causing enemies to flee in random directions.",
    tooltip: "Spread fear. Enemies flee.",
    thumbnail: 'Media/Abilities/FEAR.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "FUD Storm",
    description: "Creates confusion among enemies, reducing their effectiveness.",
    tooltip: "Causing FUD like a pro!",
    thumbnail: 'Media/Abilities/FUDSTORM.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "White Paper",
    description: "Grants temporary immunity to damage.",
    tooltip: "Protected by the wisdom of Satoshi!",
    thumbnail: 'Media/Abilities/WHITEPAPER.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Yellow Paper",
    description: "Grants temporary immunity to damage.",
    tooltip: "Protected by the wisdom of Satoshi!",
    thumbnail: 'Media/Abilities/YELLOWPAPER.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
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
    movementspeed:0.5,
    xp: 0,
    evasion: 0,
    tags: ['enemy'],
    thumbnail: 0,
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
    description:'Survive 5 Minutes in Ethereum, an open neutral and futuristic landscape where data flows freely, Forever.',
    tooltip:'0.04 💀',
    thumbnail: 'Media/Worlds/ETHEREUMVERSE.png',
    material:new THREE.MeshPhysicalMaterial({
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
        wireframe : true
    }),
    setup: function(scene, camera, renderer) {
        this.renderScene = new THREE.RenderPass(scene, camera);
        this.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.5, .5, 0.01); 
        composer.addPass(this.renderScene);
        composer.addPass(this.bloomPass);
        
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();
        
        this.envTexture = new THREE.TextureLoader().load('Media/Textures/ENVTEXTURE.png', texture => {
            this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
            this.pmremGenerator.dispose();
            scene.environment = this.envMap; 
        });
 
            this.gridSize = 5; 
            if(isMobile) 
            this.gridSize = 20; 

            this.divisions = 1;
            if(isMobile) 
            this.divisions = 2; 

            this.numTiles = 30;
            if(isMobile) 
            this.numTiles = 6; 
        
            this.gridGeometry = new THREE.PlaneGeometry( this.gridSize,  this.gridSize,  this.divisions,  this.divisions);
        
            this.lightSourceTextureSize = 256; 
            this.lightSourceTextureData = new Float32Array( this.lightSourceTextureSize *  this.lightSourceTextureSize * 4);
            this.lightSourceTexture = new THREE.DataTexture( this.lightSourceTextureData,  this.lightSourceTextureSize,  this.lightSourceTextureSize, THREE.RGBAFormat, THREE.FloatType);
            this.lightSourceTexture.needsUpdate = true;
        
            this.gridMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    playerInfluenceRadius: { value: 10 } ,
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
        
                    void main() {
                        float distanceToPlayer = distance(vWorldPos.xz, playerPosition.xz);
                        float lightSourceInfluence = 0.0;
        
                        for (int i = 0; i < lightSourceCount; i++) {
                            int x = i % lightSourceTextureSize;
                            int y = i / lightSourceTextureSize;
                            vec2 uv = vec2(float(x) / float(lightSourceTextureSize), float(y) / float(lightSourceTextureSize));
                            vec3 lightPos = texture(lightSourceTexture, uv).xyz;
                            float dist = distance(vWorldPos.xz, lightPos.xz);
                            lightSourceInfluence += smoothstep(2.5, 0.0, dist);
                        }
        
                        vec2 cellCoord = floor(vUv);
                        float hue = mod((cellCoord.x + cellCoord.y) * 0.1 + time * 0.1, 1.0);
                        float brightness = max(smoothstep(playerInfluenceRadius, 0.0, distanceToPlayer), lightSourceInfluence);
                        vec3 color = hsv2rgb(vec3(hue, 1.0, brightness));
        
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
            const possibleY = [-4,4];
            this.axisY =possibleY[Math.floor(Math.random() * possibleY.length)];

    this.octahedronGeometry = new THREE.OctahedronGeometry(1);
    this.octahedronGeometry.scale(4.5,5.25,3.75); 
            
    this.octahedronMesh = new THREE.Mesh(this.octahedronGeometry, this.material);
    scene.add(this.octahedronMesh);   
    this.octahedronMesh2 = new THREE.Mesh(this.octahedronGeometry, this.material);
    scene.add(this.octahedronMesh2); 
    this.octahedronMesh2.scale.set(1, 0.75, 0.75);
    this.octahedronMesh.scale.set(1, 0.75, 0.75);


    const cameraX = 0+ cameraRadius * Math.cos(cameraAngle);
    const cameraZ = 0+ cameraRadius * Math.sin(cameraAngle);
    camera.position.set(cameraX, cameraHeight, cameraZ);
    camera.lookAt(this.octahedronMesh.position);

    this.miniOctahedrons = [];
    const miniOctahedronGeometry = new THREE.OctahedronGeometry(0.25);
    const miniOctahedronMaterial = this.material.clone();

    miniOctahedronGeometry.scale(0.5,0.75,0.5)
    let numCrystals = 1024;
    if (isMobile)
    numCrystals = 512 ; 
  
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
this.frameCount = 0;
},
    update: function(scene, camera, renderer) {
       //if (this.frameCount++ % 2 !== 0) return;  
        const timeNow = Date.now() * 0.001;
        if (isMainMenu) {
            if (player.mesh) player.mesh.scale.set(0, 0, 0);
    
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
                    0.1
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
    
        this.gridMaterial.uniforms.time.value += 0.01;
        this.gridMaterial.uniforms.playerPosition.value.copy(player.position);
    
        if (!isMobile) {
            this.lightSourceIndex = 0;
            const addLightSource = (obj) => {
                if (obj.visible && this.lightSourceIndex < this.lightSourceTextureSize * this.lightSourceTextureSize) {
                    this.lightSourceTextureData.set([obj.position.x, obj.position.y, obj.position.z], this.lightSourceIndex * 4);
                    this.lightSourceIndex++;
                }
            };
            xpSpheres.forEach(addLightSource);
            enemies.forEach(addLightSource);
        }
    
        this.lightSourceTexture.needsUpdate = true;
        this.gridMaterial.uniforms.lightSourceCount.value = this.lightSourceIndex;
    
        const playerGridX = Math.floor(player.position.x / this.gridSize) * this.gridSize;
        const playerGridZ = Math.floor(player.position.z / this.gridSize) * this.gridSize;
        this.gridMesh.position.set(playerGridX, isMainMenu ? this.axisY : 0, playerGridZ);
    
        if (isMainMenu) {
            this.gridMesh.position.set(playerGridX, this.axisY, playerGridZ);
            this.gridGeometry.rotateY(this.gridRotationSpeed);
        } else {
            const influenceRadius = this.gridMaterial.uniforms.playerInfluenceRadius.value;
            if (this.radiusDirection === 1 && influenceRadius < this.radiusTarget) {
                this.gridGeometry.rotateY(this.gridRotationSpeed);
                this.gridMaterial.uniforms.playerInfluenceRadius.value += this.radiusSpeed;
            } else if (this.radiusDirection === -1 && influenceRadius > 10) {
                this.gridGeometry.rotateY(this.gridRotationSpeed);
                this.gridMaterial.uniforms.playerInfluenceRadius.value -= this.radiusSpeed;
            } else {
                if (this.radiusDirection === 1) {
                    this.radiusDirection = -1;
                    this.radiusTarget = 10;
                } else {
                    this.radiusDirection = 0;
                }
            }
        }
        
    },
    resumeGame: function(){
        player.mesh.scale.set(2,2,2);
    },
    cleanUp: function(scene) {
        this.sceneObjects.forEach(object => scene.remove(object));
        this.sceneObjects = []; 
    }       
},
 {
    class: 'World',
    title: 'Digital Goldland',
    description:'Outlast 1000 Survivors in the Bitcoin world, where everything gleams in easily gained (and lost) virtual gold.',
    tooltip:'15.000 U S D O L L A R S 💀 \n THERE IS NO SECOND BEST',
    thumbnail: 'Media/Worlds/GOLDLAND.jpg',
    isLocked: false,
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
    if (isMobile)
    numCrystals = 512 ; 
  
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
        this.frameCount++;
        if (this.frameCount % 3 !== 0) return;  
    
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
                this.gridMesh.position.set(playerGridX,  this.axisY, playerGridZ);
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
    resumeGame: function(){},
    cleanUp: function(scene) {
        this.sceneObjects.forEach(object => scene.remove(object));
        this.sceneObjects = []; 
    }      
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
/*---------------------------------------------------------------------------
                              World Controller
---------------------------------------------------------------------------*/
world = worldTypes[0];
world.setup(scene,camera,renderer);
/*---------------------------------------------------------------------------
                            Abilities Controller
---------------------------------------------------------------------------*/
ability = abilityTypes[0];
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
    }

    const cosAngle = Math.cos(cameraAngle); 
    const sinAngle = Math.sin(cameraAngle);
    camera.position.set(
        player.position.x + cameraRadius * cosAngle,
        cameraHeight,
        player.position.z + cameraRadius * sinAngle
    );
    camera.lookAt(player.position);

    if(cameraHeight <= (isMobile ? 35:30))
    cameraHeight+=0.25;

    player.updateAbilities();

    if (dropUpdateFrame++ % 4 === 0) {
        updateDrops();
    }
}

function updateDrops() {
    for (let i = xpSpheres.length - 1; i >= 0; i--) {
        const xpSphere = xpSpheres[i];
        if (!xpSphere.visible) continue; 

        xpSphere.boundingBox.setFromObject(xpSphere);

        if (player.boundingBox.intersectsBox(xpSphere.boundingBox)) {
            player.xp += 10;
            xpLoadingBar.style.width = ((player.xp / player.xpToNextLevel) * 100) + '%';
            
            if (player.xp >= player.xpToNextLevel) {
                LevelUp();  
                createParticleEffect(player.position, 'gold', 10);  
            }

            createParticleEffect(player.position, 'gold', 1);
            scene.remove(xpSphere);  
            xpSpheres.splice(i, 1); 
        }
    }
}

function LevelUp() {
    canMove = false;
    isPaused = true;
   hideUI();
    player.xp = 0;  

    const upgradableAbilities = player.getUpgradableAbilities();

    if (upgradableAbilities.length === 0) {
        canMove = true;
        isPaused = false;
        return;
    }

    player.xpToNextLevel  =  player.xpToNextLevel + player.xpToNextLevel ;

    const upgradeOptions = [];
    for (let i = 0; i < 2 && upgradableAbilities.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * upgradableAbilities.length);
        const abilityToUpgrade = { ...upgradableAbilities[randomIndex] };
        abilityToUpgrade.isLocked = false; 
        console.log(abilityToUpgrade.level)
        upgradeOptions.push(abilityToUpgrade);
        upgradableAbilities.splice(randomIndex, 1);
    }
    createChooseMenu(upgradeOptions, "\nLevel Up! 🔱\n Choose one ability.", "Upgrade");
}
/*---------------------------------------------------------------------------
                              Enemies Controller
---------------------------------------------------------------------------*/
const enemies = [];
const playerPositionDifference = new THREE.Vector3();  
const enemydirection = new THREE.Vector3();           

function updateEnemies() {
    playerPositionDifference.copy(player.position);
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        enemydirection.copy(playerPositionDifference).sub(enemy.position).normalize();
        enemy.position.addScaledVector(enemydirection, enemy.movementspeed/2);
        enemy.rotation.y = Math.atan2(enemydirection.x, enemydirection.z);
        enemy.updateMesh();
    }
}

function startSpawningEnemies(player, spawnInterval = 1000, spawnRadius = 150, numberOfEnemies = 25) {
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
            const enemy = new Entity(enemyConfig,new THREE.Vector3(spawnPosition.x, spawnPosition.y, spawnPosition.z));

            scene.add(enemy);
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

UI.createTitleElement = function(text, title, classCSS) {
    const element = document.createElement('div');
    element.innerText = text;
    element.title = title;
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

UI.createTitleContainer= function (text,tooltip) {
    const container = document.createElement('div');
    container.classList.add('choose-menu-title');
    const title = UI.createTitleElement(text, tooltip, "title"); 
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

        button.style.border = '2px solid transparent'; 
        button.style.borderImageSlice = 1; 
        button.style.borderImageSource = 'linear-gradient(45deg, red, orange, yellow, green, deepskyblue, blueviolet, violet)'; 

        button.title = dataType.tooltip;
    
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
        button.title = 'Insert unlock hint here'
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
        const mainTitle = UI.createTitleContainer('🏆⚔️🔗\nOnchain Survivor', 'laziest Logo ive ever seen, isnt the dev just using ai for everything and this is the best he could come up with? 💀');
        const web3Title = UI.createTitleElement('♦️\nWeb3\n♦️', 'lazy subtitle too btw', "subtitle");
        web3Title.style.cursor = 'pointer';
        const todaysContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });

    const challengeTitle = UI.createTitleElement(`Today's\n Challenge:`, 'lazy subtitle too btw', "minititle");
    
        const miniplayerButton = createButton(player, isMobile ? 0.3 : 0.5);
        const miniworldButton = createButton(world, isMobile ? 0.3 : 0.5);
        const miniabilityButton = createButton(ability,isMobile ? 0.3 : 0.5);
        todaysContainer.appendChild(challengeTitle);
        todaysContainer.appendChild(miniplayerButton);
        todaysContainer.appendChild(miniabilityButton);
        todaysContainer.appendChild(miniworldButton);
        const subTitle = UI.createTitleElement('Move to Start!', 'lazy subtitle too btw', "title");
        const aboutTitle = UI.createTitleElement('\n⚙️\n', 'lazy subtitle too btw', "subtitle");

     

       addContainerUI('top-container', [mainTitle]);
        uiContainers.forEach(container => {
            container.style.cursor = 'pointer';
            container.onclick = () => {
            canMove = false;
            isPaused = true;
            hideUI();
            createInfoMenu();
        };})

        addContainerUI('BR-container', [aboutTitle]);
        aboutTitle.style.cursor = 'pointer';
        aboutTitle.onclick = () => {
            canMove = false;
            isPaused = true;
            hideUI();
            createSettingsMenu();
        }

        addContainerUI('bottom-container', [subTitle,todaysContainer]);
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
                                MAIN MENU
---------------------------------------------------------------------------*/
function createGameMenu() {
    const classImages = playerTypes.map(player => player.thumbnail);
    const abilityImages = abilityTypes.map(ability => ability.thumbnail);
    const worldImages = worldTypes.map(world => world.thumbnail);

    const classContainer = document.createElement('div');
    const classSubTitle = UI.createTitleElement('🏆', 'lazy subtitle too btw', "subtitle")
    const classButton = createButton(player, isMobile ? 0.6 : 0.75);
    classContainer.appendChild(classButton);
    classContainer.appendChild(classSubTitle);

    const abilitiesSubTitle = UI.createTitleElement('⚔️', 'lazy subtitle too btw', "subtitle");
    const abilitiesButton = createButton(ability, isMobile ? 0.6 : 0.75);
    const classAbilityContainer = document.createElement('div');
    classAbilityContainer.appendChild(abilitiesButton);
    classAbilityContainer.appendChild(abilitiesSubTitle);

    const worldSubTitle = UI.createTitleElement('🔗', 'lazy subtitle too btw', "subtitle");
    const worldButton = createButton(world, isMobile ? 0.6 : 0.75);
    const worldContainer = document.createElement('div');
    worldContainer.appendChild(worldButton);
    worldContainer.appendChild(worldSubTitle);

    const menuButtonsContainer = UI.createContainer([], { display: 'flex' });
    menuButtonsContainer.appendChild(classContainer);
    menuButtonsContainer.appendChild(classAbilityContainer);
    menuButtonsContainer.appendChild(worldContainer);
    const subTitle = UI.createTitleElement('Move to quick start !', 'lazy subtitle too btw', "subtitle");

        menuButtonsContainer.childNodes.forEach(button => {
            button.addEventListener('click', () => {
                hideUI();
                canMove=false;
                if (button === classContainer)  createChooseMenu(playerTypes, "\nChoose a Survivor 🏆","Survivor");
                if(button === classAbilityContainer) createChooseMenu(abilityTypes, "\nChoose an Ability ⚔️","Ability");
                if(button === worldContainer) createChooseMenu(worldTypes, "\nChoose a Chain 🔗","World");

            });
        });
        addContainerUI('center-container', [subTitle,menuButtonsContainer]);
        createRandomRunEffect(classButton, classImages, 110, isMobile ? 0.6 : 0.75, "class"); 
        createRandomRunEffect(abilitiesButton, abilityImages, 0, isMobile ? 0.6 : 0.75, "ability");
        createRandomRunEffect(worldButton, worldImages, 0, isMobile ? 0.6 : 0.75, "world");
    };
 //createGameMenu()
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
    const titleContainer = UI.createTitleContainer(text,'For now it trully doesnt matter what you choose');
    const gridContainer = UI.createContainer(['choose-menu-grid']); 
    addContainerUI('center-container', [popUpContainer]);
    entityList.forEach(entity => {
        const itemButton = createButton(entity, 1);
        gridContainer.appendChild(itemButton);
        itemButton.onclick = () => handleEntitySelection(entity, type);
        if (type === "Survivor") {
           const abilitiesOfClassContainer = UI.createContainer(['abilities-grid']); 
       
           entity.abilities.forEach(survivorAbility => {
               const existingAbility = abilityTypes.find(abilityType => abilityType.title === survivorAbility.type);
               if (existingAbility) {
                   const abilityButton = createButton(existingAbility, 0.33);
                   abilitiesOfClassContainer.appendChild(abilityButton);
               }
           });

           abilitiesOfClassContainer.onclick = () => handleEntitySelection(entity, type);
           gridContainer.appendChild(abilitiesOfClassContainer);
        }   
    });
    popUpContainer.appendChild(titleContainer);
    popUpContainer.appendChild(gridContainer);
}

function handleEntitySelection(entity, type) {
    if (type === "Upgrade") {
        entity.isLocked = false;
        const newAbility = new Ability(player, { ...entity});
        player.addAbility(newAbility);
        newAbility.activate();
        hideUI();
        refreshDisplay();
    } else if (entity.isLocked) {
        return;
    } else if (type === "Survivor") {
        player.deactivateAbilities();
        scene.remove(player);
        player = new Entity(playerTypes.find(t => t === entity),new THREE.Vector3(0, 0, 0));
        hideUI();
        createGameMenu();
    } else if (type === "Ability") {
        ability = entity;
        hideUI();
        createGameMenu();
    } else if (type === "World") {
        world.cleanUp(scene);
        world = entity;
        world.setup(scene,camera,renderer);
        hideUI();
        createGameMenu();
    }
    canMove = true;
}
/*---------------------------------------------------------------------------
                                    WEB3 Options  Menu
---------------------------------------------------------------------------*/
    function createWeb3Menu(address) {
        canMove=false;

        const subTitleLogout = UI.createTitleElement('♢\nLog Out\n♢', 'lazy subtitle too btw',"subtitle");
        subTitleLogout.style.cursor = 'pointer';
        subTitleLogout.onclick = () => {
            canMove=true;
            localStorage.removeItem('metaMaskAddress');
            hideUI();
            createGameTitle();
        };

        const checkRanks = UI.createTitleElement('\nChallenge\nQueue', 'sorry for all the gimmicky words, technically it is true tho', "title")

        const topChallengerContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(5, auto)' });
        topChallengerContainer.appendChild(UI.createTitleElement('\n#\nSpot', 'lazy subtitle too btw', "subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('\n🏆\nClass', 'lazy subtitle too btw', "subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('\n⚔️\nSkill ', 'lazy subtitle too btw', "subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('\n🔗\nChain ', 'lazy subtitle too btw', "subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('\nΞ\nEther', 'lazy subtitle too btw', "subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('1°', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
        topChallengerContainer.appendChild(createButton(playerTypes[0], .6));
        topChallengerContainer.appendChild(createButton(abilityTypes[3], .6 ));
        topChallengerContainer.appendChild(createButton(worldTypes[0], .6 ));
        topChallengerContainer.appendChild(UI.createTitleElement('1Ξ', 'lazy subtitle too btw', "subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('2°', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
        topChallengerContainer.appendChild(createButton(playerTypes[1], .5));
        topChallengerContainer.appendChild(createButton(abilityTypes[6], .5 ));
        topChallengerContainer.appendChild(createButton(worldTypes[1], .5 ));
        topChallengerContainer.appendChild(UI.createTitleElement('0.1Ξ', 'lazy subtitle too btw', "subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('3°', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
        topChallengerContainer.appendChild(createButton(playerTypes[3], .4));
        topChallengerContainer.appendChild(createButton(abilityTypes[9], .4));
        topChallengerContainer.appendChild(createButton(worldTypes[1], .4));
        topChallengerContainer.appendChild(UI.createTitleElement('0.01Ξ', 'lazy subtitle too btw', "subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('4°', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
        topChallengerContainer.appendChild(createButton(playerTypes[3], .3));
        topChallengerContainer.appendChild(createButton(abilityTypes[10], .3));
        topChallengerContainer.appendChild(createButton(worldTypes[0], .3));
        topChallengerContainer.appendChild(UI.createTitleElement('0.001Ξ', 'lazy subtitle too btw', "subtitle"));
        topChallengerContainer.appendChild(UI.createTitleElement('5°', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
        topChallengerContainer.appendChild(createButton(playerTypes[0], .2));
        topChallengerContainer.appendChild(createButton(abilityTypes[20], .2));
        topChallengerContainer.appendChild(createButton(worldTypes[0], .2));
        topChallengerContainer.appendChild(UI.createTitleElement('0.0001Ξ', 'lazy subtitle too btw', "subtitle"));
   
        const classImages = playerTypes.map(player => player.thumbnail);
        const abilityImages = abilityTypes.map(ability => ability.thumbnail);
        const worldImages = worldTypes.map(world => world.thumbnail);
     
        const classContainer = document.createElement('div');
        const classSubTitle = UI.createTitleElement('\n🏆 ', 'lazy subtitle too btw', "subtitle");
        const classButton = createButton(player, isMobile ? 0.6 : 0.75);
        classContainer.appendChild(classSubTitle);
        classContainer.appendChild(classButton);

     
        const abilitiesSubTitle = UI.createTitleElement('\n⚔️', 'lazy subtitle too btw', "subtitle");
        ability.isLocked=false;
        const abilitiesButton = createButton(ability, isMobile ? 0.6 : 0.75);
        const classAbilityContainer = document.createElement('div');
        classAbilityContainer.appendChild(abilitiesSubTitle);
        classAbilityContainer.appendChild(abilitiesButton);

     
        const worldSubTitle = UI.createTitleElement('\n🔗', 'lazy subtitle too btw', "subtitle");
        const worldButton = createButton(world, isMobile ? 0.6 : 0.75);
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

     const yourSpot = UI.createTitleElement('Add 0.01Ξ for spot 24°.\nYou can edit, rank up your challenge any\ntime before becoming Challenge of the day! \n \n', 'sorry for all the gimmicky words, technically it is true tho', "subtitle")

     const loadingContainer = document.createElement('div');
     loadingContainer.classList.add('loading-container'); 
     const loadingBar = document.createElement('div');
     loadingBar.classList.add('loading-bar');
     const loadingText =  UI.createTitleElement('', 'who even keeps track of these', "subtitle");
  
     loadingContainer.appendChild(loadingBar);
     function updateLoadingBar(currentAmount) {
         const goal = 1000000; 
         const percentage = (currentAmount / goal) * 100;
         loadingBar.style.width = percentage + '%';
         loadingText.innerText ='\nNext Challenge (#1°) starts in 9 blocks!';
         loadingText.classList.add('rainbow-text'); 
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

     const checkRecords = UI.createTitleElement('\nEdit your challenge\n', 'sorry for all the gimmicky words, technically it is true tho', "title")
   
     const hallreportContainer = UI.createContainer(['abilities-grid']); 

    const rankButton = createButton({
        title: "Hall of Challengers ",
        description: "Allows you to verify previous official Challengers.",
        tooltip: "...",
        thumbnail: 'Media/Abilities/CHALLENGERS.png',
        isLocked: false,
        effect(user) { 
            this.update = () => {} 
        },
    }, 1);
    hallreportContainer.appendChild(rankButton);
    rankButton.onclick = () => {
        hideUI();
        createRunMenu();
    };

     const hallButton = createButton({
         title: "Hall of Survivors",
         description: "Allows you to verify previous official Survivors. ",
         tooltip: "...",
         thumbnail: 'Media/Abilities/HALL.png',
         isLocked: false,
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
         tooltip: "...",
         thumbnail: 'Media/Abilities/LAW.png',
         isLocked: false,
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
        tooltip: "...",
        thumbnail: 'Media/Abilities/CHALLENGEQUEUE.png',
        isLocked: false,
        effect(user) { 
            this.update = () => {} 
        },
    }, 1);
    hallreportContainer.appendChild(tutButton);
    tutButton.onclick = () => {
        hideUI();
        createRunMenu();
    };


    const goBackButton = UI.createTitleContainer('\n Made in 2024 ❤️Ξ', 'Return to the game', "subtitle");

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


   /// popUpContainer.appendChild(topSponsorText);

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
    }

    window.addEventListener('load', async () => {
        document.documentElement.style.setProperty('--image-filter', 'brightness(130%)');
        const storedAddress = localStorage.getItem('metaMaskAddress');
        if (storedAddress) {
            const web3 = new Web3(window.ethereum);
            hideUI();
            createRunMenu();
        }
    });
/*---------------------------------------------------------------------------
                                   IN-GAME UI 
---------------------------------------------------------------------------*/
let countdown = 300 * 60;

const timerDisplay = UI.createTitleElement('', 'who even keeps track of these', "subtitle");
function updateTimerDisplay() {
    countdown--;
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    timerDisplay.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds} \nSurvive.`;
}

function refreshDisplay() {
    let xpLoadingContainer = document.createElement('div');
    xpLoadingContainer.id = 'xpLoadingContainer';

    xpLoadingBar = document.createElement('div');
    xpLoadingBar.id = 'xpLoadingBar';
    xpLoadingContainer.appendChild(xpLoadingBar);

    const abilitiesContainer = UI.createContainer(['abilities-grid']); 
    const playerContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(1, auto)' });
    const playerButton = createButton(player, isMobile? .25:.5 );
    const worldButton = createButton(world,  isMobile? .11:.22 );
    playerContainer.appendChild(playerButton);
    playerContainer.appendChild(abilitiesContainer);
    abilitiesContainer.appendChild(worldButton);
    player.abilities.forEach(ability => {
        const clonedAbility = { ...ability, isLocked: false };
        abilitiesContainer.appendChild(createButton(clonedAbility,  isMobile? .11:.22));
    });

    addContainerUI('bottom-container',[timerDisplay]).onclick = () => {
        canMove = false;
        isPaused = true;
        hideUI();
        createPlayerInfoMenu();
    };

    addContainerUI('TL-container', [xpLoadingContainer,playerContainer]).onclick = () => {
        canMove = false;
        isPaused = true;
        hideUI();
        createPlayerInfoMenu();
    };
}

function createPlayerInfoMenu() {
    const popUpContainer = UI.createContainer(['choose-menu-container']); 
    const statusButton = UI.createTitleContainer('\nGlobal Run\nStatus', 'Return to the game', "subtitle");
    popUpContainer.appendChild(statusButton);

    const playerOnlyContainer = UI.createContainer(['abilities-grid']); 
    const classButton = createButton(player, 1);
    playerOnlyContainer.appendChild(classButton);
    popUpContainer.appendChild(playerOnlyContainer);
    const playerClassContainer = UI.createContainer(['abilities-grid']); 
    const worldButton = createButton(world, 1);
    playerClassContainer.appendChild(worldButton);

  
    player.abilities.forEach(ability => {
      const clonedAbility = { ...ability, isLocked: false };
      const abilityButton = createButton(clonedAbility, 1);
      playerClassContainer.appendChild(abilityButton);
    });

    popUpContainer.appendChild(playerClassContainer);
    const goBackButton = UI.createTitleContainer('\n - Continue -', 'Return to the game', "subtitle");
    goBackButton.style.cursor = 'pointer';
    popUpContainer.appendChild(goBackButton);
    addContainerUI('center-container', [popUpContainer]).onclick = () => {
            canMove = true;
            hideUI();
            refreshDisplay();
    };
}
function createSettingsMenu() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);
    const statusButton = UI.createTitleContainer('\n Settings', 'Return to the game', "subtitle");
    popUpContainer.appendChild(statusButton);

    const volumesTitle = UI.createTitleElement('- Volume -\n\n', 'Return to the game', "subtitle");
    popUpContainer.appendChild(volumesTitle);

  const volumesContainer =UI.createContainer(['abilities-grid']);
  const fxVolumeSlider = document.createElement('input');
  fxVolumeSlider.type = 'range'
  fxVolumeSlider.min = '0';
  fxVolumeSlider.max = '100';
  fxVolumeSlider.value = '50'; 
  fxVolumeSlider.id = 'fxVolumeSlider';
  fxVolumeSlider.classList.add('rainbow-slider');

  const fxVolumeTitle = UI.createTitleElement("FX", '', "subtitle");
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

  const vaVolumeTitle = UI.createTitleElement("Voices", '', "subtitle");
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
  
  const VolumeTitle = UI.createTitleElement("Music", '', "subtitle");
  VolumeTitle.htmlFor = 'volumeSlider';
  volumesContainer.appendChild(VolumeTitle);

  volumesContainer.appendChild(volumeSlider);
  popUpContainer.appendChild(volumesContainer); 
  
  const themeContainer = document.createElement('div');
  const themesTitle = UI.createTitleElement('\n - Themes -\n\n', 'Return to the game', "subtitle");
  themeContainer.appendChild(themesTitle);
  
  const themeOptions = [
      { id: 'rainbowCheckbox', label: 'Rainbow', filter: 'brightness(130%)', default: true }, 
      { id: 'goldCheckbox', label: 'Gold', filter: 'brightness(130%) sepia(100%) hue-rotate(15deg) saturate(180%)' },
      { id: 'silverCheckbox', label: 'Silver', filter: 'brightness(130%) grayscale(100%)' },
      { id: 'bronzeCheckbox', label: 'Bronze', filter: 'brightness(130%) sepia(100%) hue-rotate(5deg) ' }
  ];
  const themesContainerGrid = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });
  
  themeOptions.forEach(option => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = option.id;
      checkbox.classList.add('rainbow-checkbox'); 
      const themeTitle = UI.createTitleElement(option.label, '', "subtitle");
      themeTitle.htmlFor= option.id;
      themeContainer.appendChild(themesTitle);
  
      themesContainerGrid.appendChild(checkbox);
      themesContainerGrid.appendChild(themeTitle);
      themeContainer.appendChild(themesContainerGrid);
  
      if (option.default) {
          checkbox.checked = true;
          document.documentElement.style.setProperty('--image-filter', option.filter);
      }
  
      checkbox.addEventListener('change', (event) => {
  
          if (option.default && !event.target.checked) { 
              event.target.checked = true;  
              return; 
          }
  
          themeOptions.forEach(otherOption => {
              if (otherOption.id !== option.id) {
                  document.getElementById(otherOption.id).checked = false;
              }
          });
  
          if (event.target.checked) { 
            document.documentElement.style.setProperty('--image-filter', option.filter);
          } else {
            document.documentElement.style.setProperty('--image-filter', '');
          }
      });
  });
  
  popUpContainer.appendChild(themeContainer);

  const langContainer = document.createElement('div');
  const langTitle = UI.createTitleElement('\n - Language -\n\n', 'Return to the game', "subtitle");
  langContainer.appendChild(langTitle);
  
  const languageSelect = document.createElement('select');
  languageSelect.classList.add('rainbow-select'); 
  
  // Curated list of languages
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


  const goBackButton = UI.createTitleContainer('- Go back -', 'Return to the game', "subtitle");
  goBackButton.style.cursor = 'pointer';
  
addContainerUI('center-container', [popUpContainer]);
  goBackButton.onclick = () => {
      canMove = true;
      hideUI();
      createGameTitle();
  };
  popUpContainer.appendChild(goBackButton);

}
async function createInfoMenu() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);

    const newChallengesButton = UI.createTitleContainer('\n New Challenges \neveryday!', 'Return to the game', "subtitle");
    newChallengesButton.style.cursor = 'pointer';
    newChallengesButton.onclick = () => {
    canMove = true;
    hideUI();
    refreshDisplay();
    };
    popUpContainer.appendChild(newChallengesButton);

    const aboutButton = UI.createTitleElement('Welcome to Onchain Survivor. \n a roguelite top down auto-shooter\n powered by decentralized blockchains!\n\n Today`s Challenge:', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(aboutButton);

    const worldContainer = UI.createContainer(['abilities-grid']); 
    const worldButton = createButton(world, 1);
    worldContainer.appendChild(worldButton);
    popUpContainer.appendChild(worldContainer);

    //Debt:  DOES NOT WORK WITHOUT METAMASK. calculate time left  using the Smart contract blocks left 
    let currentBlockNumber = "Next Challlenge: Loading...";
    const blockCounter = UI.createTitleElement(`Next Challlenge: ${currentBlockNumber}`, 'lazy subtitle too btw', "subtitle");
    async function updateBlockNumber() {
         try {
             if (window.ethereum) {
                 const web3 = new Web3(window.ethereum);
                 currentBlockNumber = await web3.eth.getBlockNumber();
                 // **Update the UI element**
                 blockCounter.innerText = `Next Challlenge: ${currentBlockNumber}`;
             } else {
                 currentBlockNumber = "MetaMask Not Found";
                 challengeTitle.innerText = `Next Challlenge: ${currentBlockNumber}`;
             }
         } catch (error) {
             console.error('Error fetching block number:', error);
             currentBlockNumber = "Error";
             challengeTitle.innerText = `Next Challlenge: ${currentBlockNumber}`;
         }
     }
     updateBlockNumber(); 
     setInterval(updateBlockNumber, 5000);
     popUpContainer.appendChild(blockCounter);

    const objectiveText = UI.createTitleElement('\nEach playrun has an objective, and \nafter you survive, inscribe  your records \nto the hall of survivors for all of ethernity. \n\n Today`s Class:', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(objectiveText);

    const todaysPlayerContainer = UI.createContainer(['abilities-grid']); 
    const classButton = createButton(player, 1);
    todaysPlayerContainer.appendChild(classButton);
    popUpContainer.appendChild(todaysPlayerContainer);

    const instructionsText = UI.createTitleElement('\n As a survivor you can only \n move, choose and Survive! \n each class has different innate abilities.\n\n Today`s Ability:', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(instructionsText);

    const todaysAbilityContainer = UI.createContainer(['abilities-grid']); 
    const abilButton = createButton(ability, 1);
    todaysAbilityContainer.appendChild(abilButton);
    popUpContainer.appendChild(todaysAbilityContainer);

    const abilText = UI.createTitleElement('\n Install many abilities during your run. Let \nyour creativity and intuition guide you, \n some abilities are very sinergetic. Good luck!\n\n    -the dev (@onchainsurvivor)', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(abilText);

    const goBackButton = UI.createTitleContainer('\n- Go back -', 'Return to the game', "subtitle");
    goBackButton.style.cursor = 'pointer';
    
addContainerUI('center-container', [popUpContainer]);
    goBackButton.onclick = () => {
        canMove = true;
        hideUI();
        createGameTitle();
    };
    popUpContainer.appendChild(goBackButton);

}

function createTransparencyReport() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);;

    const titleButton = UI.createTitleContainer('\nTransparency\nReport\n⚖️', 'Return to the game', "subtitle");
   // titleButton.style.cursor = 'pointer';

    popUpContainer.appendChild(titleButton);
    const aboutButton = UI.createTitleElement(' You can read and run offline every line \n of code of the onchain survivor client !\n\n Repository:', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(aboutButton);

    const githubContainer = UI.createContainer(['abilities-grid']); 
    const githubButton = createButton({
        title: "Read Onchain Survivor Code",
        description: "Allows you to check the client source code, line by line, public for everyone to verify.",
        tooltip: "...",
        thumbnail: 'Media/Abilities/???.png',
        isLocked: false,
        effect(user) { 
            this.update = () => {} 
        },
    }, 1);
    githubContainer.appendChild(githubButton);
    popUpContainer.appendChild(githubContainer);

    const rankingText = UI.createTitleElement('\nYou can verify the Global Ranking smart \n contract powering the survivor system\n\n Ranking Smart Contract:', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(rankingText);

    const rankingContainer = UI.createContainer(['abilities-grid']); 
    const rankingButton = createButton({
        title: "Verify Ranking Smart Contract",
        description: "Allows you to check the Ranking Smart Contract source code, line by line, public for everyone to verify.",
        tooltip: "...",
        thumbnail: 'Media/Abilities/???.png',
        isLocked: false,
        effect(user) { 
            this.update = () => {} 
        },
    }, 1);
    rankingContainer.appendChild(rankingButton);
    popUpContainer.appendChild(rankingContainer);

    const sponsorText = UI.createTitleElement('\n You can also verify the Rollup Centric \n Sponsor Contract that settles in Ethereum!\n\n Sponsor Smart Contract:', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(sponsorText);

    const sponsorContainer = UI.createContainer(['abilities-grid']); 
    const sponsorButton = createButton({
        title: "Verify Sponsor Smart Contract",
        description: "Allows you to check the Sponsor Smart Contract source code, line by line, public for everyone to verify.",
        tooltip: "...",
        thumbnail: 'Media/Abilities/???.png',
        isLocked: false,
        effect(user) { 
            this.update = () => {} 
        },
    }, 1);
    sponsorContainer.appendChild(sponsorButton);
    popUpContainer.appendChild(sponsorContainer);

    const disclaimerText = UI.createTitleElement('\n None of the smart contracts hold balance. \n Every sponsor transaction is final. \n Timeframes might change for the players! \n Theres only one social media account.\n\n    -the dev (@onchainsurvivor)', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(disclaimerText);

    const goBackButton = UI.createTitleContainer('\n- Go back -', 'Return to the game', "subtitle");
    goBackButton.style.cursor = 'pointer';
    
addContainerUI('center-container', [popUpContainer]);
    goBackButton.onclick = () => {
        canMove = true;
        hideUI();
        createWeb3Menu();
    };
    popUpContainer.appendChild(goBackButton);
}
//createTransparencyReport();

function createRunMenu() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);;

    const titleButton = UI.createTitleContainer('\nThe Daily\n Challenge Queue', 'Return to the game', "subtitle");
    popUpContainer.appendChild(titleButton);

    const aboutButton = UI.createTitleElement(' \nEvery day (7152 Ξ blocks) the game changes \n  according to the #1 rank Challenger, choosing \n the Character, Ability &  Chain for a day! \n\n Next 5 Days Challenges:', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(aboutButton);


    const topChallengerContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });
    topChallengerContainer.appendChild(UI.createTitleElement('\n#\nSpot', 'lazy subtitle too btw', "subtitle"));
    topChallengerContainer.appendChild(UI.createTitleElement('\n🏆\nClass', 'lazy subtitle too btw', "subtitle"));
    topChallengerContainer.appendChild(UI.createTitleElement('\n⚔️\nSkill ', 'lazy subtitle too btw', "subtitle"));
    topChallengerContainer.appendChild(UI.createTitleElement('\n🔗\nChain ', 'lazy subtitle too btw', "subtitle"));
    topChallengerContainer.appendChild(UI.createTitleElement('1°', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topChallengerContainer.appendChild(createButton(playerTypes[0], .6));
    topChallengerContainer.appendChild(createButton(abilityTypes[3], .6 ));
    topChallengerContainer.appendChild(createButton(worldTypes[0], .6 ));
    topChallengerContainer.appendChild(UI.createTitleElement('2°', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topChallengerContainer.appendChild(createButton(playerTypes[1], .5));
    topChallengerContainer.appendChild(createButton(abilityTypes[6], .5 ));
    topChallengerContainer.appendChild(createButton(worldTypes[1], .5 ));
    topChallengerContainer.appendChild(UI.createTitleElement('3°', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topChallengerContainer.appendChild(createButton(playerTypes[3], .4));
    topChallengerContainer.appendChild(createButton(abilityTypes[9], .4));
    topChallengerContainer.appendChild(createButton(worldTypes[1], .4));
    topChallengerContainer.appendChild(UI.createTitleElement('4°', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topChallengerContainer.appendChild(createButton(playerTypes[3], .3));
    topChallengerContainer.appendChild(createButton(abilityTypes[10], .3));
    topChallengerContainer.appendChild(createButton(worldTypes[0], .3));
    topChallengerContainer.appendChild(UI.createTitleElement('5°', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topChallengerContainer.appendChild(createButton(playerTypes[0], .2));
    topChallengerContainer.appendChild(createButton(abilityTypes[20], .2));
    topChallengerContainer.appendChild(createButton(worldTypes[0], .2));
   
    popUpContainer.appendChild(topChallengerContainer);

    const rankingText = UI.createTitleElement('\n The #1 rank Challenger gets recorded in the \n Hall of Challengers, all the others rank up one\n spot daily, eventually setting the Challenge!\n\n Queue Example:\n\n', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(rankingText);

    const topbidContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(5, auto)' });
    topbidContainer.appendChild(UI.createTitleElement('# Address', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topbidContainer.appendChild(UI.createTitleElement('🏆', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topbidContainer.appendChild(UI.createTitleElement('⚔️', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topbidContainer.appendChild(UI.createTitleElement('🔗', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topbidContainer.appendChild(UI.createTitleElement('Next day', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));

    topbidContainer.appendChild(UI.createTitleElement('#1 0x...be2', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topbidContainer.appendChild(createButton(playerTypes[0], .33));
    topbidContainer.appendChild(createButton(abilityTypes[3], .33 ));
    topbidContainer.appendChild(createButton(worldTypes[0], .33 ));
    topbidContainer.appendChild(UI.createTitleElement('Recorded', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));

    topbidContainer.appendChild(UI.createTitleElement('#2 0x...02a', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topbidContainer.appendChild(createButton(playerTypes[1], .33));
    topbidContainer.appendChild(createButton(abilityTypes[6], .33 ));
    topbidContainer.appendChild(createButton(worldTypes[1], .33 ));
    topbidContainer.appendChild(UI.createTitleElement('#1▲', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));

    topbidContainer.appendChild(UI.createTitleElement('#3 0x...73d', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topbidContainer.appendChild(createButton(playerTypes[0], .33));
    topbidContainer.appendChild(createButton(abilityTypes[9], .33));
    topbidContainer.appendChild(createButton(worldTypes[1], .33));
    topbidContainer.appendChild(UI.createTitleElement('#2▲', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));

    topbidContainer.appendChild(UI.createTitleElement('#4 0x...421', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));
    topbidContainer.appendChild(createButton(playerTypes[0], .33));
    topbidContainer.appendChild(createButton(abilityTypes[9], .33));
    topbidContainer.appendChild(createButton(worldTypes[1], .33));
    topbidContainer.appendChild(UI.createTitleElement('#3▲', 'sorry for all the gimmicky words, technically it is true tho', "subtitle"));

    popUpContainer.appendChild(topbidContainer);


    const sponsorText = UI.createTitleElement('\nChallengers can add any amount and \n accumulate until they get the first rank!\nKeep in mind that you cannot cancel once set! \n\n Set a Challenge', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(sponsorText);

    const classImages = playerTypes.map(player => player.thumbnail);
    const abilityImages = abilityTypes.map(ability => ability.thumbnail);
    const worldImages = worldTypes.map(world => world.thumbnail);
 
    const classContainer = document.createElement('div');
    const classSubTitle = UI.createTitleElement('\n🏆 ', 'lazy subtitle too btw', "subtitle");
    const classButton = createButton(player, isMobile ? 0.6 : 0.75);
    classContainer.appendChild(classSubTitle);
    classContainer.appendChild(classButton);

 
    const abilitiesSubTitle = UI.createTitleElement('\n⚔️', 'lazy subtitle too btw', "subtitle");
    ability.isLocked=false;
    const abilitiesButton = createButton(ability, isMobile ? 0.6 : 0.75);
    const classAbilityContainer = document.createElement('div');
    classAbilityContainer.appendChild(abilitiesSubTitle);
    classAbilityContainer.appendChild(abilitiesButton);

 
    const worldSubTitle = UI.createTitleElement('\n🔗', 'lazy subtitle too btw', "subtitle");
    const worldButton = createButton(world, isMobile ? 0.6 : 0.75);
    const worldContainer = document.createElement('div');
    worldContainer.appendChild(worldSubTitle);
    worldContainer.appendChild(worldButton);

    const galleryButtonsContainer = UI.createContainer([], { display: 'flex',justifyContent: 'center' });
    galleryButtonsContainer.appendChild(classContainer);
    galleryButtonsContainer.appendChild(classAbilityContainer);
    galleryButtonsContainer.appendChild(worldContainer);

    popUpContainer.appendChild(galleryButtonsContainer);

 const inputContainer = document.createElement('div');
 const sponsorAmount = createInput('number', { placeholder: '0.00Ξ, Rank: ----', id: 'sponsorAmount' });
 const submitButton = document.createElement('button'); 
 submitButton.classList.add('rainbow-button'); 
 submitButton.classList.add('subtitle'); 
 submitButton.innerText = 'Add';
 inputContainer.appendChild(sponsorAmount);
 inputContainer.appendChild(submitButton); 

 popUpContainer.appendChild(inputContainer);

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

    const disclaimerText = UI.createTitleElement('\n Your Challenges let me develop fulltime \n and dedicate all day into Onchain Survivor.\n thanks for making this a reality!\n\n    -the dev (@onchainsurvivor)', 'sorry for all the gimmicky words, technically it is true tho', "subtitle");
    popUpContainer.appendChild(disclaimerText);

    const goBackButton = UI.createTitleContainer('\n- Continue -', 'Return to the game', "subtitle");
    goBackButton.style.cursor = 'pointer';
    
addContainerUI('center-container', [popUpContainer]);
    goBackButton.onclick = () => {
        canMove = true;
        hideUI();
        createWeb3Menu();
    };
    popUpContainer.appendChild(goBackButton);

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

    createRandomRunEffect(classButton, classImages, 110, isMobile ? 0.6 : 0.75, "class"); 
    createRandomRunEffect(abilitiesButton, abilityImages, 0, isMobile ? 0.6 : 0.75, "ability");
    createRandomRunEffect(worldButton, worldImages, 0, isMobile ? 0.6 : 0.75, "world");

}
//createRunMenu();
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
                          Service Worker for Offline Play  
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
    const newAbility = new Ability(player, { ...ability});
    player.addAbility(newAbility);
    newAbility.activate();
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
    
    world.update(scene,camera,renderer);
    composer.render();
}

animate();