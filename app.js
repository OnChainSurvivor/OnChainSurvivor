/*---------------------------------------------------------------------------
                              Classes
---------------------------------------------------------------------------*/
const loader = new THREE.FBXLoader();
const objectPool = new Map(); 

class Ability {
    constructor(user, config) {
        Object.assign(this, { user, ...config });
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
        this.position.copy(position);
        this.abilities = [];
        this.possibleAbilities = new Map();

        const modelKey = 'SurvivorModel';

        if (objectPool.has(modelKey)) {
            const serializedModel = objectPool.get(modelKey);
            this.initEntity(new THREE.ObjectLoader().parse(serializedModel), position);
        } else {
            loader.load('Media/Models/Survivor.fbx', (object) => {
                this.modifyMaterials(object);
                const serializedObject = object.toJSON();
                objectPool.set(modelKey, serializedObject);
                this.initEntity(object, position);
            });
        }

        this.initAbilities(config.abilities);
    }

    modifyMaterials(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshPhysicalMaterial({
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
            }
        });
    }


    initEntity(object, position) {
        this.mesh = object;
        this.add(this.mesh);
        this.mesh.mixer = new THREE.AnimationMixer(this.mesh);
        this.playerRun = this.mesh.mixer.clipAction(object.animations[0]);
        this.playerRun.play();
        this.playerRun.setLoop(THREE.LoopRepeat);
        this.mesh.scale.set(3, 3, 3);
        this.boundingBox = new THREE.Box3().setFromObject(this.mesh);
        scene.add(this);
    }

    updateMesh() {
        if (this.mesh) {
            this.mesh.mixer.update(.01);
            this.mesh.position.set(0, 0, 0); 
            this.mesh.rotation.set(0, 0, 0); 
            this.mesh.updateMatrixWorld(true);
            this.boundingBox.setFromObject(this.mesh);
        }
    }

    initAbilities(entityAbilities) {
        entityAbilities.forEach(entityAbility => {
            const vabilityType = abilityTypes.find(type => type.title === entityAbility.type);
            if (vabilityType) {
                this.possibleAbilities.set(entityAbility.type, { ...vabilityType, level: entityAbility.level });
            }
            if (entityAbility.level===0) return;
            const existingAbility = this.abilities.find(ability => ability.title === entityAbility.type);
            if (existingAbility) {
               existingAbility.level = Math.min(existingAbility.level + entityAbility.level, 10);
               existingAbility.activate();
            } else {
                const abilityType = abilityTypes.find(type => type.title === entityAbility.type);
                if (abilityType) {
                    const newAbility = new Ability(this, { ...abilityType, level: entityAbility.level });
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
let cameraHeight = 1;

let canMove = true;

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
/*---------------------------------------------------------------------------
                              Ability Blueprints
---------------------------------------------------------------------------*/
const abilityTypes = [
{
    title: "Scalping Bot",
    description: 'Abusing the market volatility, The Scalping bot Executes incredibly fast attacks.',
    tooltip: "Like a true degen",
    effectinfo: 'Bot damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0,
    isLocked: false,
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
                homingSpeed: 0.5,
                create: () => {
                    const geometry = new THREE.SphereGeometry(0.3, 16, 6);
                    const material = new THREE.MeshStandardMaterial({ color: 'red' });
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
                        if ((Date.now() - this.lastHitTime > (500-(level*200)))) {
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
    effectinfo: 'Trail size and frequency increase.',
    thumbnail: 'Media/Abilities/ONCHAINTRAIL.png',
    level: 0,
    isLocked: false,
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
    effectinfo: 'Veil trigger % UP.',
    thumbnail: 'Media/Abilities/VEILOFDECENTRALIZATION.png',
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
{
    title: "Code Refactor",
    description: "Rewrites the Survivor's abilities, reducing their cooldowns.",
    tooltip: "FAST",
    effectinfo: 'Optimizes the code much more, reducing cooldown of all other abilities.',
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
},{
    title: "Sybil Attack",
    description: "Creates multiples identities, disorienting and damaging enemies.",
    tooltip: "More alts than a telegram schizo",
    effectinfo: "Creates 2 extra identities.",
    thumbnail:'Media/Abilities/SYBILATTACK.png',
    level: 0,
    isLocked: false,
    effect(level, user) { 

    },
},{
    title: "Vote Manipulation",
    description: "Illegally uses the voting power of other survivors in range agaisnt their will, turning bonuses into penalties.",
    tooltip: "no, CEXes totally have never ever done this.",
    effectinfo: "Doubles the penalties value.",
    thumbnail: 'Media/Abilities/VOTEMANIPULATION.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},{
    title: "Airdrop Fraud",
    description: "Free, fake tokens fall from the sky, draining the survivors who interact with them.",
    tooltip: "Free tokens! Just kidding, they're mine.",
    effectinfo: "Fake airdrop also steals networth out of enemies.",
    thumbnail: 'Media/Abilities/AIRDROPFRAUD.png',
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},{
    title: "Identity Forge",
    description: "Specializes in creating a whole new persona, gaining the bonuses of a random class.",
    tooltip: "Fake it till you make it, anon!",
    effectinfo: "Doubles the bonuses of the forged class.",
    thumbnail: 'Media/Abilities/IDENTITYFORGE.png',
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},{
    title: "Decentralized Vote Rigging",
    description: "By controlling the majority of the chain validators, the survivor gains a random bonus.",
    tooltip: " ",
    effectinfo: "Increases attack and defense by 3% per controlled enemy. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/VOTERIGGING.png',
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},{
    title: "Confirm Block",
    description: "As transactions become confirmed and secured overtime, the survivor gains defensive bonuses",
    tooltip: "Block confirmed!.",
    effectinfo: "Doubles defensive bonuses.",
    thumbnail: 'Media/Abilities/CONFIRMBLOCK.png',
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Finality",
    description: "The blockchain inmutality makes it so  buried Survivors can not ever revive, If they take more than 6 blocks.",
    tooltip: ">Your transaction was succesfull \n>the coin moons, you check your wallet\n>turns out your tx never got in",
    effectinfo: "Survivors downed cannot come back from life.",
    thumbnail: 'Media/Abilities/FINALITY.png',
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Double Spend Prevention",
    description: "Creates a shield that absorbs multiple hits.",
    tooltip: "No double-spending here, buddy!",
    effectinfo: "Absorbs 1 hit per level.",
    thumbnail: "A broken coin split in half.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Overclock",
    description: "Greatly increases attack power for a brief period.",
    tooltip: "Overclocked like a mining rig in a bull run!",
    effectinfo: "Increases attack power by 20% for 5 seconds. Increases by 5% per level.",
    thumbnail: "A CPU with a glowing overclock symbol.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Mining Rig",
    description: "Deploys a stationary turret that automatically attacks enemies.",
    tooltip: "Mining while you sleep!",
    effectinfo: "Deploys a turret that deals 5% damage per second. Increases by 1% per level.",
    thumbnail: "A turret with mining gear.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Energy Surge",
    description: "Temporarily increases attack speed and movement speed.",
    tooltip: "Surging like the latest meme coin!",
    effectinfo: "Increases attack speed and movement speed by 10% for 5 seconds. Increases by 2% per level.",
    thumbnail: "A lightning bolt with gears.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "PoS Migration",
    description: "Increases the player's defense.",
    tooltip: "Migrated to PoS and feeling safe!",
    effectinfo: "Increases defense by 5% per level.",
    thumbnail: "A shield with 'PoS' written on it.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Governance Vote",
    description: "Grants a random beneficial effect based on player needs.",
    tooltip: "DAO voted, gains distributed!",
    effectinfo: "Grants a random buff of 5% to an attribute for 5 seconds. Increases by 1% per level.",
    thumbnail: "A voting card with a checkmark.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Protocol Upgrade",
    description: "Improves all abilities for a limited time.",
    tooltip: "Upgraded like ETH 2.0!",
    effectinfo: "Increases effectiveness of all abilities by 5% for 5 seconds. Increases by 1% per level.",
    thumbnail: "A progress bar with a checkmark.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "DeFi Yield",
    description: "Periodically grants a boost in resources.",
    tooltip: "APY like a degen farm!",
    effectinfo: "Grants 5% more resources every 10 seconds. Increases by 1% per level.",
    thumbnail: "A yield sign with coins.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Flash Loan Attack",
    description: "Deals a burst of damage to a single target.",
    tooltip: "One-shot wonder like a flash loan!",
    effectinfo: "Deals 20% damage to a single target. Increases by 5% per level.",
    thumbnail: "A lightning bolt striking a target.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Frontrunning Bot",
    description: "Increases movement speed and prioritizes attacks.",
    tooltip: "Faster than your FOMO trades!",
    effectinfo: "Increases movement speed by 10% and attack priority by 5%. Increases by 2% per level.",
    thumbnail: "A racing bot with a trail.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Exploit Finder",
    description: "Scans for enemy weaknesses and exploits them.",
    tooltip: "Finding bugs like a true degen!",
    effectinfo: "Increases damage to enemies by 10% when weaknesses are found. Increases by 2% per level.",
    thumbnail: "A magnifying glass over a bug.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Liquidation Event",
    description: "Causes a massive area-of-effect damage.",
    tooltip: "Liquidated harder than a leveraged trade gone wrong!",
    effectinfo: "Deals 15% area damage. Increases by 3% per level.",
    thumbnail: "A graph plummeting with red arrows.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Chain Reorg",
    description: "Rewinds time slightly to undo recent events.",
    tooltip: "Reorg'd like a 51% attack!",
    effectinfo: "Rewinds 2 seconds of gameplay. Increases by 0.5 seconds per level.",
    thumbnail: "A clock turning backward.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Staking Rewards",
    description: "Grants a boost to resources over time.",
    tooltip: "Compounding gains like a staking pro!",
    effectinfo: "Increases resource gain by 5% every 10 seconds. Increases by 1% per level.",
    thumbnail: "A pile of tokens growing over time.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "DDoS Attack",
    description: "Stuns all enemies for a short duration.",
    tooltip: "Overloaded like a cheap DDoS script!",
    effectinfo: "Stuns all enemies for 2 seconds. Increases by 0.5 seconds per level.",
    thumbnail: "A wave crashing into a server.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
},
{
    title: "Oracle Manipulation",
    description: "Disrupts enemy abilities based on false data.",
    tooltip: "Manipulated just like those price feeds!",
    effectinfo: "Disrupts enemy abilities for 3 seconds. Increases by 1 second per level.",
    thumbnail: "A tampered-with scale.",
    level: 0,
    isLocked: false,
    effect(level, user) { 
    },
}, {
    title: "Whale Alert",
    description: "Identifies and marks the strongest enemy.",
    tooltip: "Spotted a whale in the arena!",
    effectinfo: "Marks the strongest enemy, increasing damage dealt to them by 10%. Increases by 2% per level.",
    thumbnail: "A whale icon with a radar.",
    level: 0,
    isLocked: false,
    effect(level, user) {
        // Implement the effect logic here
    }
},
{
    title: "Smart Contract Deployment",
    description: "Deploys a smart contract to trap and damage enemies.",
    tooltip: "Caught in a gas war!",
    effectinfo: "Deploys a smart contract that traps enemies in an area, dealing 5% damage per second. Increases by 1% per level.",
    thumbnail: "A smart contract document with chains.",
    level: 0,
    isLocked: false,
    effect(level, user) {
        // Implement the effect logic here
    }
},{
    title: "Liquidity Pool",
    description: "Creates a pool that heals allies and damages enemies.",
    tooltip: "Providing liquidity like a degen in a farm!",
    effectinfo: "Heals allies for 5% and damages enemies for 5% per second. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/LIQUIDITYPOOL.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "MEV Bot",
    description: "Drains health from enemies based on their movements.",
    tooltip: "Front-running like an MEV bot!",
    effectinfo: "Drains 2% health per second from moving enemies. Increases by 0.5% per level.",
    thumbnail: 'Media/Abilities/MEVBOT.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "FUD Storm",
    description: "Creates confusion among enemies, reducing their effectiveness.",
    tooltip: "Causing FUD like a pro!",
    effectinfo: "Reduces enemy effectiveness by 10% for 10 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/FUDSTORM.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Whitepaper Shield",
    description: "Grants temporary immunity to damage.",
    tooltip: "Protected by the wisdom of Satoshi!",
    effectinfo: "Grants immunity to damage for 3 seconds. Increases by 0.5 seconds per level.",
    thumbnail: 'Media/Abilities/WHITEPAPERSHIELD.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Transaction Fee Burn",
    description: "Reduces enemy resources by burning their assets.",
    tooltip: "Burned like gas fees in a bull run!",
    effectinfo: "Reduces enemy resources by 5% per second for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/TRANSACTIONFEEBURN.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Transaction Front-Runner",
    description: "Gains the initiative to act before enemies.",
    tooltip: "Faster than an MEV bot!",
    effectinfo: "Increases attack speed by 5% and initiative by 10%. Increases by 2% per level.",
    thumbnail: 'Media/Abilities/TRANSACTIONFRONTRUNNER.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Smart Contract Hack",
    description: "Deals consistent damage over time to enemies.",
    tooltip: "Exploiting vulnerabilities like a pro!",
    effectinfo: "Deals 5% damage per second for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/SMARTCONTRACTHACK.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Flash Crash",
    description: "Briefly stuns all enemies in the area.",
    tooltip: "Stunning like a sudden market crash!",
    effectinfo: "Stuns enemies for 2 seconds. Increases by 0.5 seconds per level.",
    thumbnail: 'Media/Abilities/FLASHCRASH.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Chain Split",
    description: "Creates a duplicate of yourself to confuse enemies.",
    tooltip: "Splitting like a forked chain!",
    effectinfo: "Creates a duplicate that lasts for 5 seconds. Increases by 1 second per level.",
    thumbnail: 'Media/Abilities/CHAINSPLIT.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Airdrop",
    description: "Drops valuable items or buffs to allies.",
    tooltip: "Free goodies like an airdrop!",
    effectinfo: "Grants a 5% buff to allies for 10 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/AIRDROP.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Gas Fee Reduction",
    description: "Decreases resource cost for abilities.",
    tooltip: "Cheap like a bear market gas fee!",
    effectinfo: "Reduces ability resource cost by 5%. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/GASFEEREDUCTION.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Market Maker",
    description: "Balances the battlefield by adjusting enemy and ally stats.",
    tooltip: "Balancing like a true market maker!",
    effectinfo: "Balances stats, increasing allies' and decreasing enemies' by 5%. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/MARKETMAKER.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Rug Pull",
    description: "Instantly removes buffs from enemies.",
    tooltip: "Rugged like a failed project!",
    effectinfo: "Removes all buffs from enemies instantly. Duration increases by 0.5 seconds per level.",
    thumbnail: 'Media/Abilities/RUGPULL.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "DAO Governance",
    description: "Empowers allies with decision-making buffs.",
    tooltip: "Collective power like a DAO!",
    effectinfo: "Grants a 5% decision-making buff to allies for 10 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/DAOGOVERNANCE.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Liquidity Mining",
    description: "Generates resources over time.",
    tooltip: "Earning passively like liquidity mining!",
    effectinfo: "Generates 5% resources every 10 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/LIQUIDITYMINING.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Smart Contract Audit",
    description: "Identifies and negates enemy traps.",
    tooltip: "Secure like a certified audit!",
    effectinfo: "Negates enemy traps for 5 seconds. Increases by 1 second per level.",
    thumbnail: 'Media/Abilities/SMARTCONTRACTAUDIT.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "ICO Hype",
    description: "Temporarily boosts all stats.",
    tooltip: "Hyped like an ICO!",
    effectinfo: "Increases all stats by 10% for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/ICOHYPE.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Token Swap",
    description: "Exchanges debuffs for buffs with enemies.",
    tooltip: "Swapped like a dex trade!",
    effectinfo: "Swaps 5% debuffs for buffs with enemies. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/TOKENSWAP.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Stablecoin Shield",
    description: "Reduces damage taken.",
    tooltip: "Stable like a top-tier stablecoin!",
    effectinfo: "Reduces damage taken by 5%. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/STABLECOINSHIELD.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Oracle Insight",
    description: "Predicts enemy movements, increasing evasion.",
    tooltip: "Seeing the future like an oracle!",
    effectinfo: "Increases evasion by 5%. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/ORACLEINSIGHT.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Bounty",
    description: "Rewards for defeating enemies.",
    tooltip: "Bounties like finding bugs in protocols!",
    effectinfo: "Grants 5% extra resources for each enemy defeated. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOBOUNTY.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Consensus Protocol",
    description: "Harmonizes allies, boosting their effectiveness.",
    tooltip: "Unified like a consensus protocol!",
    effectinfo: "Increases allies' effectiveness by 5%. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CONSENSUSPROTOCOL.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Token Burn",
    description: "Permanently removes a portion of enemy resources.",
    tooltip: "Burned like tokens in a supply reduction!",
    effectinfo: "Burns 5% of enemy resources. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/TOKENBURN.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Flash Loan",
    description: "Temporarily boosts resources for a short period.",
    tooltip: "Leveraged like a flash loan exploit!",
    effectinfo: "Increases resources by 10% for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/FLASHLOAN.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Signal",
    description: "Calls for reinforcements to aid in battle.",
    tooltip: "Signaling like a trading bot!",
    effectinfo: "Summons reinforcements that last for 5 seconds. Increases by 1 second per level.",
    thumbnail: 'Media/Abilities/CRYPTOSIGNAL.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Whale",
    description: "Uses overwhelming power to crush enemies.",
    tooltip: "Whale-sized like a market mover!",
    effectinfo: "Increases damage by 10% for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOWHALE.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Airdrop",
    description: "Distributes resources to allies.",
    tooltip: "Airdropped like free tokens!",
    effectinfo: "Grants 5% extra resources to allies for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOAIRDROP.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Bear",
    description: "Reduces enemies' attack power.",
    tooltip: "Bearish like a market downturn!",
    effectinfo: "Reduces enemies' attack power by 5% for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOBEAR.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Bull",
    description: "Increases allies' attack power.",
    tooltip: "Bullish like a market rally!",
    effectinfo: "Increases allies' attack power by 5% for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOBULL.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Whale Dump",
    description: "Deals massive damage to a single enemy.",
    tooltip: "Dumping like a whale!",
    effectinfo: "Deals 20% damage to a single enemy. Increases by 2% per level.",
    thumbnail: 'Media/Abilities/CRYPTOWHALEDUMP.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Rally",
    description: "Temporarily boosts all allies' speed.",
    tooltip: "Rallying like a bull market!",
    effectinfo: "Increases allies' speed by 10% for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPOTORALLY.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Whitelist",
    description: "Grants immunity to debuffs.",
    tooltip: "Protected like a whitelist spot!",
    effectinfo: "Grants immunity to debuffs for 5 seconds. Increases by 1 second per level.",
    thumbnail: 'Media/Abilities/CRYPTOWHITELIST.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Lock",
    description: "Locks an enemy's abilities temporarily.",
    tooltip: "Locked like funds in a smart contract!",
    effectinfo: "Locks an enemy's abilities for 3 seconds. Increases by 0.5 seconds per level.",
    thumbnail: 'Media/Abilities/CRYPTOLOCK.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Lending",
    description: "Lends resources to allies temporarily.",
    tooltip: "Lending like a DeFi protocol!",
    effectinfo: "Lends 10% resources to allies for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOLOAN.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Governance",
    description: "Empowers allies through decentralized decisions.",
    tooltip: "Governance like a DAO!",
    effectinfo: "Increases allies' power by 5% for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOGOVERNANCE.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Hodler",
    description: "Increases resources the longer they are held.",
    tooltip: "Hodling like a true believer!",
    effectinfo: "Increases resources by 5% per 10 seconds held. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOHODLER.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Fork",
    description: "Creates a duplicate of an ability for a short time.",
    tooltip: "Forking like a blockchain split!",
    effectinfo: "Duplicates an ability for 5 seconds. Increases by 1 second per level.",
    thumbnail: 'Media/Abilities/CRYPTOFORK.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Fee",
    description: "Charges a fee to enemies for using abilities.",
    tooltip: "Charging like a transaction fee!",
    effectinfo: "Charges enemies 5% resources for using abilities. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOFEE.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Mining",
    description: "Generates resources over time.",
    tooltip: "Mining like a blockchain!",
    effectinfo: "Generates 5% resources every 10 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOMINING.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Escrow",
    description: "Holds resources in escrow, releasing them after a delay.",
    tooltip: "Escrow like a smart contract!",
    effectinfo: "Holds 5% resources in escrow for 10 seconds, releasing them after the delay. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOESCROW.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Bridge",
    description: "Transfers resources between allies.",
    tooltip: "Bridging like cross-chain assets!",
    effectinfo: "Transfers 10% resources to an ally. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOBRIDGE.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Custody",
    description: "Protects resources from being stolen.",
    tooltip: "Secure like a custody service!",
    effectinfo: "Prevents resources from being stolen for 5 seconds. Increases by 1 second per level.",
    thumbnail: 'Media/Abilities/CRYPTOCUSTODY.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Yield",
    description: "Generates yield from resources held.",
    tooltip: "Yielding like a DeFi protocol!",
    effectinfo: "Generates 5% yield from resources every 10 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOYIELD.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Arbitrage",
    description: "Exploits price differences for gain.",
    tooltip: "Arbitraging like a pro!",
    effectinfo: "Generates 10% resources from price differences every 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOARBITRAGE.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Dapp",
    description: "Creates a decentralized application for resource generation.",
    tooltip: "Building like a dApp developer!",
    effectinfo: "Generates 5% resources from dApp every 10 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTODAPP.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Merkle Proof",
    description: "Verifies resources securely.",
    tooltip: "Proof like a Merkle tree!",
    effectinfo: "Verifies resources, preventing theft for 5 seconds. Increases by 1 second per level.",
    thumbnail: 'Media/Abilities/CRYPTOMERKLEPROOF.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Wallet",
    description: "Stores resources securely.",
    tooltip: "Storing like a hardware wallet!",
    effectinfo: "Stores resources securely, preventing theft for 5 seconds. Increases by 1 second per level.",
    thumbnail: 'Media/Abilities/CRYPTOWALLET.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Oracle",
    description: "Provides accurate data for resource generation.",
    tooltip: "Oracling like Chainlink!",
    effectinfo: "Generates 5% resources from accurate data every 10 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOORACLE.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Consensus",
    description: "Achieves consensus for increased power.",
    tooltip: "Consensing like a blockchain!",
    effectinfo: "Increases power by 5% through consensus for 5 seconds. Increases by 1% per level.",
    thumbnail: 'Media/Abilities/CRYPTOCONSENSUS.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto MultiSig",
    description: "Secures resources with multiple signatures.",
    tooltip: "Securing like a multi-signature wallet!",
    effectinfo: "Secures resources with multiple signatures for 5 seconds. Increases by 1 second per level.",
    thumbnail: 'Media/Abilities/CRYPTOMULTISIG.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "NFT Disruptor",
    description: "Temporarily disables the effects of enemy NFTs.",
    tooltip: "Disrupt like a true NFT master!",
    effectinfo: "Disables enemy NFT effects for 3 seconds. Increases by 0.5 seconds per level.",
    thumbnail: 'Media/Abilities/NFTDISRUPTOR.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "NFT Enhancer",
    description: "Boosts the effects of your NFTs.",
    tooltip: "Enhancing like an NFT upgrade!",
    effectinfo: "Increases NFT effects by 10% for 5 seconds. Increases by 2% per level.",
    thumbnail: 'Media/Abilities/NFTENHANCER.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Smart Contract Shield",
    description: "Provides temporary protection from enemy attacks.",
    tooltip: "Shielding like a smart contract!",
    effectinfo: "Provides 20% damage reduction for 5 seconds. Increases by 5% per level.",
    thumbnail: 'Media/Abilities/SMARTCONTRACTSHIELD.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Portfolio",
    description: "Increases the efficiency of resource gathering.",
    tooltip: "Boosting like a diversified portfolio!",
    effectinfo: "Increases resource gathering efficiency by 10% for 10 seconds. Increases by 2% per level.",
    thumbnail: 'Media/Abilities/CRYPTOPORTFOLIO.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Decentralized Exchange",
    description: "Allows trading of resources between allies.",
    tooltip: "Trading like a decentralized exchange!",
    effectinfo: "Allows trading of resources between allies. Increases trade efficiency by 10% per level.",
    thumbnail: 'Media/Abilities/DECENTRALIZEDEXCHANGE.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Blockchain Analytics",
    description: "Provides insights to increase strategy effectiveness.",
    tooltip: "Analyzing like a blockchain expert!",
    effectinfo: "Increases strategy effectiveness by 15% for 10 seconds. Increases by 3% per level.",
    thumbnail: 'Media/Abilities/BLOCKCHAINANALYTICS.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Audit",
    description: "Reveals enemy weaknesses and exploits them.",
    tooltip: "Auditing like a pro!",
    effectinfo: "Reveals enemy weaknesses and increases damage dealt to them by 10% for 5 seconds. Increases by 2% per level.",
    thumbnail: 'Media/Abilities/CRYPTOAUDIT.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Blockchain Backup",
    description: "Creates a backup of resources for recovery.",
    tooltip: "Backing up like a secure blockchain!",
    effectinfo: "Creates a backup of 20% resources for recovery after 10 seconds. Increases by 5% per level.",
    thumbnail: 'Media/Abilities/BLOCKCHAINBACKUP.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Validator",
    description: "Ensures the integrity of resource transactions.",
    tooltip: "Validating like a blockchain node!",
    effectinfo: "Validates transactions, preventing fraudulent activities for 5 seconds. Increases by 1 second per level.",
    thumbnail: 'Media/Abilities/CRYPTOVALIDATOR.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Escalation",
    description: "Escalates the power of abilities temporarily.",
    tooltip: "Escalating like a market rally!",
    effectinfo: "Increases ability power by 15% for 5 seconds. Increases by 3% per level.",
    thumbnail: 'Media/Abilities/CRYPTOESCALATION.png',
    level: 0,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Hash Power",
    description: "Temporarily increases attack power.",
    tooltip: "Harness the power of the hash. Strike with more force.",
    effectinfo: "Increases attack power by 10% per level.",
    thumbnail: 'Media/Abilities/HASHPOWER.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Minefield",
    description: "Creates a zone that damages enemies over time.",
    tooltip: "Lay down the mines. Enemies beware.",
    effectinfo: "Deals 5% of total damage per second to enemies in the zone. Duration increases per level.",
    thumbnail: 'Media/Abilities/MINEFIELD.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Block Reward",
    description: "Heals the player for a portion of damage dealt.",
    tooltip: "Reward yourself with health for your efforts.",
    effectinfo: "Heals for 2% of damage dealt per level.",
    thumbnail: 'Media/Abilities/BLOCKREWARD.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Mega Miner",
    description: "Unleashes a massive explosion, dealing heavy area damage.",
    tooltip: "Unleash the power of the Mega Miner. Massive destruction.",
    effectinfo: "Deals 50% of total damage in a large area. Damage increases per level.",
    thumbnail: 'Media/Abilities/MEGAMINER.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Stake Defense",
    description: "Increases defense for a short period.",
    tooltip: "Strengthen your defenses with stakes.",
    effectinfo: "Increases defense by 10% per level for a short duration.",
    thumbnail: 'Media/Abilities/STAKEDEFENSE.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Interest Yield",
    description: "Gradually regenerates health over time.",
    tooltip: "Reap the benefits of your interest. Regenerate health.",
    effectinfo: "Regenerates 1% of total health per level over time.",
    thumbnail: 'Media/Abilities/INTERESTYIELD.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Validator Support",
    description: "Summons a temporary ally to aid in battle.",
    tooltip: "Call in support from a trusted validator.",
    effectinfo: "Summons an ally with 10% of player's stats per level for a short duration.",
    thumbnail: 'Media/Abilities/VALIDATORSUPPORT.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Stake Fortress",
    description: "Creates an impenetrable fortress, providing massive defense.",
    tooltip: "Build your fortress and withstand any attack.",
    effectinfo: "Increases defense by 50% per level and reduces damage taken by 20% per level for a short duration.",
    thumbnail: 'Media/Abilities/STAKEFORTRESS.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Scalability Boost",
    description: "Increases attack speed and movement speed.",
    tooltip: "Scaling up like a true degen, moving fast and striking hard.",
    effectinfo: "Increases attack speed and movement speed by 5% per level.",
    thumbnail: 'Media/Abilities/SCALABILITYBOOST.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Security Lockdown",
    description: "Reduces damage taken for a short period.",
    tooltip: "Lock it down, secure the bag. Take less damage.",
    effectinfo: "Reduces damage taken by 10% per level for a short period.",
    thumbnail: 'Media/Abilities/SECURITYLOCKDOWN.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Decentralized Network",
    description: "Summons allies to assist in battle.",
    tooltip: "Rally the network. Summon allies to join the fight.",
    effectinfo: "Summons 1 ally per level to assist in battle, each with 10% of player's stats.",
    thumbnail: 'Media/Abilities/DECENTRALIZEDNETWORK.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Network Effect",
    description: "Increases the effectiveness of all abilities.",
    tooltip: "Network effect in action. Boost all your powers.",
    effectinfo: "Increases the effectiveness of all abilities by 5% per level.",
    thumbnail: 'Media/Abilities/NETWORKEFFECT.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Multilayer Design",
    description: "Adds an additional layer of defense.",
    tooltip: "Layer up! More defense, less worry.",
    effectinfo: "Adds an additional layer of defense, reducing damage taken by 5% per level.",
    thumbnail: 'Media/Abilities/MULTILAYERDESIGN.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Monolithic Design",
    description: "Provides a significant health boost.",
    tooltip: "Built like a monolith. More health, more power.",
    effectinfo: "Increases maximum health by 10% per level.",
    thumbnail: 'Media/Abilities/MONOLITHICDESIGN.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Sidechains",
    description: "Allows the player to create decoys that distract enemies.",
    tooltip: "Sidechains for sidekicks! Distract your enemies.",
    effectinfo: "Creates 1 decoy per level that distracts enemies for a short duration.",
    thumbnail: 'Media/Abilities/SIDECHAINS.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Layer 2 Scaling",
    description: "Reduces the cost and cooldown of all abilities.",
    tooltip: "Scale up and save! Reduce costs and cooldowns.",
    effectinfo: "Reduces the cost and cooldown of all abilities by 5% per level.",
    thumbnail: 'Media/Abilities/LAYER2SCALING.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Deploy Contract",
    description: "Sets up a turret that automatically attacks enemies.",
    tooltip: "Deploy the contract. Let the turret handle it.",
    effectinfo: "Deploys a turret with 10% of player's attack power per level. Duration increases per level.",
    thumbnail: 'Media/Abilities/DEPLOYCONTRACT.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Transaction Fee",
    description: "Reduces the cooldown of all abilities.",
    tooltip: "Pay the fee, cut the wait. Reduce your cooldowns.",
    effectinfo: "Reduces the cooldown of all abilities by 5% per level.",
    thumbnail: 'Media/Abilities/TRANSACTIONFEE.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "FUD Shield",
    description: "Temporarily makes the player immune to all debuffs.",
    tooltip: "Block out the FUD. Stay strong and immune.",
    effectinfo: "Makes the player immune to all debuffs for 5 seconds per level.",
    thumbnail: 'Media/Abilities/FUDSHIELD.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Gas Optimization",
    description: "Decreases mana cost of all abilities.",
    tooltip: "Optimize your gas, save on costs. Efficiency wins.",
    effectinfo: "Decreases mana cost of all abilities by 5% per level.",
    thumbnail: 'Media/Abilities/GASOPTIMIZATION.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Proof of Stake",
    description: "Increases health regeneration.",
    tooltip: "Stake your claim. Regenerate health faster.",
    effectinfo: "Increases health regeneration by 5% per level.",
    thumbnail: 'Media/Abilities/PROOFOFSTAKE.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Delegation",
    description: "Allows the player to share buffs with allies.",
    tooltip: "Delegate and elevate. Share the wealth.",
    effectinfo: "Shares 5% of all buffs with allies per level.",
    thumbnail: 'Media/Abilities/DELEGATION.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Yield Farming",
    description: "Increases resource gain.",
    tooltip: "Farm those yields. Reap the rewards.",
    effectinfo: "Increases resource gain by 10% per level.",
    thumbnail: 'Media/Abilities/YIELDFARMING.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Flash Loan",
    description: "Instantly grants a large amount of resources.",
    tooltip: "Get instant liquidity. Just don't get rekt.",
    effectinfo: "Instantly grants a large amount of resources, with a cooldown. Amount increases per level.",
    thumbnail: 'Media/Abilities/FLASHLOAN.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Liquidity Pool",
    description: "Creates a pool that buffs allies' attack speed.",
    tooltip: "Add liquidity, boost the pool. Attack faster.",
    effectinfo: "Creates a pool that increases allies' attack speed by 5% per level.",
    thumbnail: 'Media/Abilities/LIQUIDITYPOOL.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Impermanent Loss Shield",
    description: "Reduces damage taken from all sources.",
    tooltip: "Shield against impermanent loss. Take less damage.",
    effectinfo: "Reduces damage taken by 5% per level.",
    thumbnail: 'Media/Abilities/IMPERMANENTLOSsshield.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Airdrop",
    description: "Grants random buffs to all allies.",
    tooltip: "Receive the airdrop. Enjoy the random goodies.",
    effectinfo: "Grants a random buff to all allies, effect increases per level.",
    thumbnail: 'Media/Abilities/AIRDROP.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Initial DEX Offering",
    description: "Increases allies' attack power.",
    tooltip: "Launch on the DEX. Pump up those attacks.",
    effectinfo: "Increases allies' attack power by 5% per level.",
    thumbnail: 'Media/Abilities/INITIALDEXOFFERING.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Staking Rewards",
    description: "Provides periodic healing to all allies.",
    tooltip: "Stake and earn. Heal over time.",
    effectinfo: "Heals all allies for 2% of their total health per level every few seconds.",
    thumbnail: 'Media/Abilities/STAKINGREWARDS.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Validator Uptime",
    description: "Increases the duration of all buffs.",
    tooltip: "Stay online. Extend those buffs.",
    effectinfo: "Increases the duration of all buffs by 5% per level.",
    thumbnail: 'Media/Abilities/VALIDATORUPTIME.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Slashing Protection",
    description: "Reduces damage taken from critical hits.",
    tooltip: "Protect against slashing. Reduce crit damage.",
    effectinfo: "Reduces damage taken from critical hits by 5% per level.",
    thumbnail: 'Media/Abilities/SLASHINGPROTECTION.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Governance Vote",
    description: "Grants temporary invulnerability to all allies.",
    tooltip: "Vote and secure. Gain temporary invulnerability.",
    effectinfo: "Grants temporary invulnerability to all allies for 2 seconds per level.",
    thumbnail: 'Media/Abilities/GOVERNANCEVOTE.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Treasury Allocation",
    description: "Provides a large amount of resources to all allies.",
    tooltip: "Allocate the treasury. Distribute the wealth.",
    effectinfo: "Provides a large amount of resources to all allies, amount increases per level.",
    thumbnail: 'Media/Abilities/TREASURYALLOCATION.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Decentralized Finance",
    description: "Increases the effectiveness of all resource-gathering abilities.",
    tooltip: "Go DeFi. Boost your resource gains.",
    effectinfo: "Increases the effectiveness of all resource-gathering abilities by 5% per level.",
    thumbnail: 'Media/Abilities/DECENTRALIZEDFINANCE.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "NFT Marketplace",
    description: "Increases the drop rate of rare items.",
    tooltip: "Trade NFTs. Find rare items more often.",
    effectinfo: "Increases the drop rate of rare items by 5% per level.",
    thumbnail: 'Media/Abilities/NFTMARKETPLACE.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Tripool",
    description: "Creates three separate pools that buff allies' attack power.",
    tooltip: "Triple the pools, triple the power. Buff your allies.",
    effectinfo: "Creates three pools that each increase allies' attack power by 5% per level.",
    thumbnail: 'Media/Abilities/TRIPOOL.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Two Pool",
    description: "Creates two separate pools that buff allies' attack speed.",
    tooltip: "Double the pools, double the speed. Boost your allies' attack rate.",
    effectinfo: "Creates two pools that each increase allies' attack speed by 5% per level.",
    thumbnail: 'Media/Abilities/TWOPOOL.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Single Stake",
    description: "Increases health regeneration based on a single stake.",
    tooltip: "Stake your claim. Boost health regeneration.",
    effectinfo: "Increases health regeneration by 10% per level based on a single stake.",
    thumbnail: 'Media/Abilities/SINGLESTAKE.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Orderbook",
    description: "Provides a large amount of resources based on order book data.",
    tooltip: "Consult the order book. Gain a wealth of resources.",
    effectinfo: "Grants a large amount of resources based on order book data, amount increases per level.",
    thumbnail: 'Media/Abilities/ORDERBOOK.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "See HP Bars",
    description: "Displays HP bars for all entities in the game.",
    tooltip: "Reveal the HP. Monitor health bars of all entities.",
    effectinfo: "Shows HP bars for all entities in the game, allowing you to monitor their health.",
    thumbnail: 'Media/Abilities/SEEHPBARS.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Pact with the Devil",
    description: "Grants a significant boost in power at the cost of health.",
    tooltip: "Make a pact. Gain power, but lose health.",
    effectinfo: "Increases all stats by 20% per level but reduces maximum health by 10% per level.",
    thumbnail: 'Media/Abilities/PACTWITHTHEDEVIL.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Sellout",
    description: "Trades a portion of your resources for a temporary power boost.",
    tooltip: "Sellout for power. Trade resources for a boost.",
    effectinfo: "Trades 10% of your resources for a 15% increase in power for 30 seconds per level.",
    thumbnail: 'Media/Abilities/SELLOUT.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "HODL",
    description: "Increases the player's defense.",
    tooltip: "HODL strong. Boost your defense.",
    effectinfo: "Increases the player's defense by 5% per level.",
    thumbnail: "A fist gripping a glowing token.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Pump and Dump",
    description: "Increases attack power significantly for a short duration, followed by a debuff.",
    tooltip: "Pump it up, then brace for the dump.",
    effectinfo: "Increases attack power by 20% per level for 5 seconds, followed by a 10% debuff for 10 seconds.",
    thumbnail: "A graph with a sharp rise and fall.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Whale Power",
    description: "Increases all stats for a short duration.",
    tooltip: "Unleash the whale power. Dominate the field.",
    effectinfo: "Increases all stats by 10% per level for 10 seconds.",
    thumbnail: "A whale swimming through a sea of tokens.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Adaptive Trading ⚔️",
    description: "Adapts to the situation, dealing damage based on the player's needs.",
    tooltip: "Adapt and overcome. Your strikes change to fit the need.",
    effectinfo: "Adapts damage based on current situation, varying between single target and area effects.",
    thumbnail: 'Media/Abilities/ADAPTIVETRADING.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Resilient Spirit 💪",
    description: "Provides a temporary boost to defense and health regeneration.",
    tooltip: "Unyielding spirit. Boost your defense and health regen.",
    effectinfo: "Boosts defense and health regeneration temporarily.",
    thumbnail: 'Media/Abilities/RESILIENTSPIRIT.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Survivor's Instinct 🧠",
    description: "Enhances movement speed and reduces skill cooldowns in critical moments.",
    tooltip: "Instincts kick in. Move faster and reduce cooldowns when it matters most.",
    effectinfo: "Enhances movement speed and reduces cooldowns temporarily during critical moments.",
    thumbnail: 'Media/Abilities/SURVIVORSINSTINCT.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Survivor's Resolve 🔥",
    description: "Temporarily makes the player invincible and greatly increases attack power.",
    tooltip: "Unbreakable resolve. Become invincible and unleash your power.",
    effectinfo: "Grants temporary invincibility and greatly increases attack power.",
    thumbnail: 'Media/Abilities/ULTIMATESURVIVORSRESOLVE.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Hash Power ⚡",
    description: "Temporarily increases attack power.",
    tooltip: "Harness the power of the hash. Strike with more force.",
    effectinfo: "Temporarily increases attack power.",
    thumbnail: 'Media/Abilities/HASHPOWER.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Minefield 💥",
    description: "Creates a zone that damages enemies over time.",
    tooltip: "Lay down the mines. Enemies beware.",
    effectinfo: "Creates a damaging zone that applies damage over time to enemies.",
    thumbnail: 'Media/Abilities/MINEFIELD.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Block Reward 💎",
    description: "Heals the player for a portion of damage dealt.",
    tooltip: "Reward yourself with health for your efforts.",
    effectinfo: "Heals the player for a portion of the damage dealt.",
    thumbnail: 'Media/Abilities/BLOCKREWARD.png',
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Mega Miner 🚀",
    description: "Unleashes a massive explosion, dealing heavy area damage.",
    tooltip: "Unleash the power of the Mega Miner. Massive destruction.",
    effectinfo: "Deals heavy area damage with a massive explosion.",
    thumbnail: "A mining rig with an explosion.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Stake Defense 🛡️",
    description: "Increases defense for a short period.",
    tooltip: "Strengthen your defenses with stakes.",
    effectinfo: "Increases defense for a short period.",
    thumbnail: "A shield with stakes.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Interest Yield 💲",
    description: "Gradually regenerates health over time.",
    tooltip: "Reap the benefits of your interest. Regenerate health.",
    effectinfo: "Gradually regenerates health over time.",
    thumbnail: "A growing plant.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Validator Support 🤖",
    description: "Summons a temporary ally to aid in battle.",
    tooltip: "Call in support from a trusted validator.",
    effectinfo: "Summons a temporary ally to assist in battle.",
    thumbnail: "A robot helper.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Stake Fortress 🏰",
    description: "Creates an impenetrable fortress, providing massive defense and healing.",
    tooltip: "Become an unbreakable fortress. Ultimate defense and healing.",
    effectinfo: "Creates an impenetrable fortress that provides massive defense and healing.",
    thumbnail: "A fortified castle.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Market Manipulation 📈",
    description: "Temporarily increases critical hit chance.",
    tooltip: "Manipulate the market. Strike with precision.",
    effectinfo: "Temporarily increases critical hit chance.",
    thumbnail: "A graph with a rising arrow.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Flash Crash ⚡",
    description: "A quick dash attack that damages all enemies in the path.",
    tooltip: "Crash through your enemies with lightning speed.",
    effectinfo: "A quick dash attack that damages all enemies in the path.",
    thumbnail: "A lightning bolt.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Pump and Dump 📉",
    description: "Deals heavy damage to a single enemy, then weakens the player for a short time.",
    tooltip: "Deal massive damage but face the consequences.",
    effectinfo: "Deals heavy damage to a single enemy and applies a debuff to the player for a short time.",
    thumbnail: "A pump and dump graph.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Trading Frenzy 🚀",
    description: "Increases speed and critical hit chance drastically for a short time.",
    tooltip: "Enter a trading frenzy. Maximum speed and precision.",
    effectinfo: "Drastically increases speed and critical hit chance for a short time.",
    thumbnail: "A trader in frenzy.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Locked In 🧠💹",
    description: "Maximize your profits and outpace the competition with unparalleled focus and strategic insight.",
    tooltip: "Locked in and loaded! Maximize your profits and outpace the competition with unparalleled focus.",
    effectinfo: "Maximizes profits and increases strategic insight, providing substantial boosts.",
    thumbnail: "A pair of focused eyes with dollar signs in the pupils, surrounded by a glowing aura.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Bug Fix 🔧",
    description: "Fixes bugs in the code, restoring a small amount of health.",
    tooltip: "Fix the bugs. Restore your health.",
    effectinfo: "Restores a small amount of health by fixing bugs.",
    thumbnail: "A wrench fixing code.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Code Refactor 🖥️",
    description: "Rewrites the player's abilities, reducing their cooldowns.",
    tooltip: "Refactor your code. Reduce cooldowns.",
    effectinfo: "Reduces cooldowns of the player's abilities.",
    thumbnail: "A refactored code.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Deploy Patch 🛠️",
    description: "Creates a temporary area that boosts allies' defenses.",
    tooltip: "Deploy a patch. Boost allies' defenses.",
    effectinfo: "Creates a temporary area that boosts allies' defenses.",
    thumbnail: "A patch being deployed.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Overhaul ⚙️",
    description: "Completely overhauls the player's abilities, providing massive buffs and resetting cooldowns.",
    tooltip: "Overhaul your abilities. Massive buffs and cooldown reset.",
    effectinfo: "Provides massive buffs and resets cooldowns of abilities.",
    thumbnail: "A complete overhaul.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Compliance Check 📋",
    description: "Forces enemies to slow down and take damage over time.",
    tooltip: "Ensure compliance. Slow down enemies and deal damage.",
    effectinfo: "Slows down enemies and deals damage over time.",
    thumbnail: "A compliance checklist.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Audit 🔍",
    description: "Reveals all hidden enemies and disables their abilities temporarily.",
    tooltip: "Conduct an audit. Reveal and disable enemies.",
    effectinfo: "Reveals all hidden enemies and disables their abilities temporarily.",
    thumbnail: "A magnifying glass.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Sanction 🛑",
    description: "Targets a single enemy, greatly reducing its speed and defense.",
    tooltip: "Impose sanctions. Weaken a single enemy.",
    effectinfo: "Reduces speed and defense of a single enemy significantly.",
    thumbnail: "A stop sign.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Total Control 🕹️",
    description: "Temporarily controls all enemies, making them fight each other.",
    tooltip: "Take total control. Enemies turn on each other.",
    effectinfo: "Temporarily makes all enemies fight each other.",
    thumbnail: "A controller.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Quantum Encryption 🛡️",
    description: "Creates a shield that reduces incoming damage.",
    tooltip: "Encrypt your defenses. Reduce damage taken.",
    effectinfo: "Creates a shield that reduces incoming damage.",
    thumbnail: "A quantum shield.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Entanglement 🕸️",
    description: "Links enemies, causing damage to spread among them.",
    tooltip: "Entangle your enemies. Damage spreads.",
    effectinfo: "Links enemies, causing damage to spread among them.",
    thumbnail: "Entangled particles.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Quantum Key Exchange 🔑",
    description: "Transfers health from enemies to the player.",
    tooltip: "Exchange health. Transfer from enemies to you.",
    effectinfo: "Transfers health from enemies to the player.",
    thumbnail: "A key exchange.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Quantum Overload ⚡",
    description: "Overloads the quantum field, dealing massive area damage and stunning enemies.",
    tooltip: "Overload the field. Massive damage and stun.",
    effectinfo: "Deals massive area damage and stuns enemies.",
    thumbnail: "A quantum explosion.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Bot Swarm 🐝",
    description: "Summons additional bots to assist in battle.",
    tooltip: "Summon a bot swarm. Increase your firepower.",
    effectinfo: "Summons additional bots to assist in battle.",
    thumbnail: "A swarm of bots.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Bot Shield 🛡️",
    description: "Creates a defensive barrier with the bots.",
    tooltip: "Form a bot shield. Increase your defense.",
    effectinfo: "Creates a defensive barrier with the bots.",
    thumbnail: "Bots forming a shield.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Bot Attack 🔫",
    description: "Directs all bots to focus fire on a single enemy.",
    tooltip: "Focus fire. Direct all bots to attack a target.",
    effectinfo: "Directs all bots to focus fire on a single enemy.",
    thumbnail: "Bots attacking.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Anti-Rug Bot 🚫🧩",
    description: "Detects and disables rug traps.",
    tooltip: "No more rug-pulls for you. Detect and disable rug traps.",
    effectinfo: "Detects and disables rug traps.",
    thumbnail: "A crossed-out rug.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Sniping Bot 🎯",
    description: "Enhances critical hit chances and accuracy.",
    tooltip: "Get the perfect shot. Increase critical hit chances and accuracy.",
    effectinfo: "Enhances critical hit chances and accuracy.",
    thumbnail: "A sniper rifle with a target.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "MEV Bot 📉",
    description: "Drains resources from enemy HP pools for personal gain.",
    tooltip: "Drain enemy resources. Extract value from their HP pools.",
    effectinfo: "Drains resources from enemy HP pools and converts them to personal gain.",
    thumbnail: "A downward arrow with a dollar sign.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Bot Armada 🚀",
    description: "Summons an entire armada of bots for massive support and damage.",
    tooltip: "Call in the bot armada. Maximum support and damage.",
    effectinfo: "Summons an entire armada of bots for significant support and damage.",
    thumbnail: "A fleet of bots.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Scam Alert 🚨",
    description: "Temporarily decreases enemies' attack power and movement speed.",
    tooltip: "Sound the scam alert. Weaken your enemies.",
    effectinfo: "Decreases enemies' attack power and movement speed for a short duration.",
    thumbnail: "A warning sign.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Bear Market 🐻",
    description: "Summons a wave of bearish sentiment that damages all enemies.",
    tooltip: "Invoke the bear market. Damage your enemies.",
    effectinfo: "Damages all enemies with a wave of bearish sentiment.",
    thumbnail: "A bear wave.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Fear Spread 😱",
    description: "Spreads fear, causing enemies to flee in random directions.",
    tooltip: "Spread fear. Enemies flee.",
    effectinfo: "Causes enemies to flee in random directions.",
    thumbnail: "A face in terror.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Billions Must Capitulate 💸",
    description: "Spreads widespread fear and panic, causing enemies to lose resources and morale.",
    tooltip: "Instill capitulation. Cause widespread fear and resource loss.",
    effectinfo: "Causes enemies to lose resources and morale due to widespread fear and panic.",
    thumbnail: "A collapsing currency symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "It's Over 🪦",
    description: "Convinces enemies that defeat is inevitable, reducing their effectiveness and causing them to falter.",
    tooltip: "Declare the end. Reduce enemy effectiveness and cause them to falter.",
    effectinfo: "Reduces enemies' effectiveness and causes them to falter.",
    thumbnail: "A gravestone with a downward arrow.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Apocalypse Now 💀",
    description: "Unleashes a massive wave of FUD, causing heavy damage and stunning all enemies.",
    tooltip: "The end is near. Massive damage and stun.",
    effectinfo: "Deals heavy damage and stuns all enemies with a wave of FUD.",
    thumbnail: "A skull with a storm.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Lunar Cycle 🌒",
    description: "Provides buffs or debuffs based on the current moon phase.",
    tooltip: "Harness the power of the moon. Buffs and debuffs change with each phase.",
    effectinfo: "Provides buffs or debuffs depending on the current moon phase.",
    thumbnail: "A moon with phases.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Star Alignment ✨",
    description: "Increases critical hit chance and attack power when stars align.",
    tooltip: "The stars have aligned! Your attacks become more powerful.",
    effectinfo: "Increases critical hit chance and attack power when stars align.",
    thumbnail: "A constellation.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Zodiac Prediction ♒",
    description: "Predicts and reveals enemies' weaknesses, reducing their defenses.",
    tooltip: "The zodiac reveals all. Know your enemies' weaknesses.",
    effectinfo: "Reduces enemies' defenses by revealing their weaknesses.",
    thumbnail: "Zodiac symbols.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Celestial Fury 🌠",
    description: "Unleashes the power of the cosmos, dealing massive area damage and providing buffs to allies.",
    tooltip: "Harness celestial fury. Massive damage and buffs.",
    effectinfo: "Deals massive area damage and provides buffs to allies.",
    thumbnail: "A meteor shower.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Shill 🚀",
    description: "Temporarily increases allies' attack power and speed.",
    tooltip: "Shill your way to victory. Boost ally attack power and speed.",
    effectinfo: "Temporarily increases attack power and speed of allies.",
    thumbnail: "A rocket emoji.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "FOMO Wave 🌊",
    description: "Induces fear of missing out, causing enemies to rush towards the player.",
    tooltip: "Create a wave of FOMO. Draw enemies towards you.",
    effectinfo: "Causes enemies to rush towards the player due to fear of missing out.",
    thumbnail: "A wave symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Hype Train 🚂",
    description: "Summons a stampede of followers that trample enemies.",
    tooltip: "Summon the hype train. Trample your enemies.",
    effectinfo: "Summons followers to stampede and trample enemies.",
    thumbnail: "A train emoji.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Market Mover 📈",
    description: "Enhances allies' abilities and influences the battlefield.",
    tooltip: "Move the market. Enhance ally abilities.",
    effectinfo: "Enhances allies' abilities and influences the battlefield.",
    thumbnail: "A rising graph.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Trend Setter 💫",
    description: "Buffs allies and debuffs enemies based on market trends.",
    tooltip: "Set the trend. Buff allies and debuff enemies.",
    effectinfo: "Buffs allies and debuffs enemies based on market trends.",
    thumbnail: "A star with upward arrows.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Viral Sensation 🌐",
    description: "Goes viral, drastically increasing the effectiveness of all abilities and summoning followers to fight alongside.",
    tooltip: "Become a viral sensation. Amplify abilities and summon followers.",
    effectinfo: "Drastically increases all abilities' effectiveness and summons followers.",
    thumbnail: "A viral symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Inside Info 📉📈",
    description: "Reveals hidden enemies and weak points.",
    tooltip: "Gain inside information. Reveal hidden enemies and weak points.",
    effectinfo: "Reveals hidden enemies and weak points.",
    thumbnail: "An eye with a market graph.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Market Manipulation 🧠",
    description: "Temporarily controls enemy movements.",
    tooltip: "Manipulate the market. Control enemy movements.",
    effectinfo: "Temporarily controls enemy movements.",
    thumbnail: "A brain with puppet strings.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Pump and Dump 💣",
    description: "Deals heavy damage to a single target and redistributes health to allies.",
    tooltip: "Pump and dump. Deal heavy damage and heal allies.",
    effectinfo: "Deals heavy damage to a single target and redistributes health to allies.",
    thumbnail: "A bomb with a dollar sign.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Whale 🐋",
    description: "Focuses on high-impact, single-target attacks.",
    tooltip: "Be the whale. Deliver high-impact attacks.",
    effectinfo: "Focuses on high-impact attacks against a single target.",
    thumbnail: "A whale.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Market Puppeteer 🎭",
    description: "Controls and manipulates multiple enemies.",
    tooltip: "Puppet master. Control and manipulate enemies.",
    effectinfo: "Controls and manipulates multiple enemies.",
    thumbnail: "A puppet on strings.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Black Swan Event 🦢",
    description: "Creates a chaotic event that massively disrupts enemy abilities and resources while providing significant buffs to allies.",
    tooltip: "Trigger a black swan event. Cause chaos and gain massive advantages.",
    effectinfo: "Massively disrupts enemy abilities and resources, providing significant buffs to allies.",
    thumbnail: "A black swan.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Quick Flip 🤑",
    description: "Deals instant damage to nearby enemies.",
    tooltip: "Quick flip. Deal instant damage.",
    effectinfo: "Deals instant damage to nearby enemies.",
    thumbnail: "A dollar sign and a lightning bolt.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Sell-Off 🔥",
    description: "Creates an area where enemies take increased damage over time.",
    tooltip: "Sell-off. Increase damage over time in an area.",
    effectinfo: "Creates an area where enemies take increased damage over time.",
    thumbnail: "A downward graph on fire.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Exit Scam 🏃‍♂️",
    description: "Teleports to a safe location and leaves a damaging decoy behind.",
    tooltip: "Execute an exit scam. Teleport and leave a damaging decoy.",
    effectinfo: "Teleports to a safe location and leaves a damaging decoy behind.",
    thumbnail: "A running man with a disappearing trail.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Flash Trader ⚡",
    description: "Specializes in quick, high-damage attacks.",
    tooltip: "Flash trader. Quick, high-damage attacks.",
    effectinfo: "Performs quick, high-damage attacks.",
    thumbnail: "A lightning bolt and a dollar sign.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Profit Taker 💸",
    description: "Buffs self and allies after defeating enemies.",
    tooltip: "Take profits. Buff self and allies after defeating enemies.",
    effectinfo: "Buffs self and allies after defeating enemies.",
    thumbnail: "A bag of money.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Rug Pull 💥",
    description: "Performs a devastating attack that deals massive damage to all enemies and stuns them.",
    tooltip: "Execute a rug pull. Massive damage and stun all enemies.",
    effectinfo: "Deals massive damage to all enemies and stuns them.",
    thumbnail: "A rug being pulled.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Diamond Hands ✋💎",
    description: "Reduces damage taken significantly for a short period.",
    tooltip: "Hold with diamond hands. Reduce damage taken.",
    effectinfo: "Reduces damage taken significantly for a short period.",
    thumbnail: "A diamond and a hand.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "HODL Line 🛡️",
    description: "Creates a barrier that absorbs damage.",
    tooltip: "HODL the line. Create a damage-absorbing barrier.",
    effectinfo: "Creates a barrier that absorbs damage.",
    thumbnail: "A shield with 'HODL'.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Maxi Rally 🏋️",
    description: "Temporarily boosts all allies' attack and defense.",
    tooltip: "Maxi rally. Boost ally attack and defense.",
    effectinfo: "Temporarily boosts all allies' attack and defense.",
    thumbnail: "A rallying flag.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Perma-Bull 🐂",
    description: "Buffs allies' attack and movement speed.",
    tooltip: "Perma-bull. Increase ally attack and movement speed.",
    effectinfo: "Buffs allies' attack and movement speed.",
    thumbnail: "A bullish arrow.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Coin Zealot 🔥",
    description: "Enhances defense and health regeneration.",
    tooltip: "Zealot's fervor. Enhance defense and health regeneration.",
    effectinfo: "Enhances defense and health regeneration.",
    thumbnail: "A flaming coin.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Maxi Ascendancy 🌟",
    description: "Ascends to a state of maximum power, drastically increasing all stats and providing powerful buffs to allies for a short period.",
    tooltip: "Achieve maxi ascendancy. Drastically boost stats and buff allies.",
    effectinfo: "Drastically increases all stats and provides powerful buffs to allies.",
    thumbnail: "A shining star.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "All In 🃏",
    description: "Deals massive damage to a single target but leaves the player vulnerable.",
    tooltip: "Go all in. Deal massive damage but become vulnerable.",
    effectinfo: "Deals massive damage to a single target and leaves the player vulnerable.",
    thumbnail: "Poker chips and cards.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Lucky Streak 🍀",
    description: "Temporarily increases critical hit chance and dodge rate.",
    tooltip: "Ride a lucky streak. Increase critical hit chance and dodge rate.",
    effectinfo: "Temporarily increases critical hit chance and dodge rate.",
    thumbnail: "A four-leaf clover.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Double or Nothing 🎰",
    description: "Randomly buffs or debuffs the player.",
    tooltip: "Double or nothing. Randomly buff or debuff yourself.",
    effectinfo: "Randomly buffs or debuffs the player.",
    thumbnail: "A slot machine.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Risk Taker ⚖️",
    description: "High-risk, high-reward abilities.",
    tooltip: "Take a risk. High-risk, high-reward abilities.",
    effectinfo: "High-risk, high-reward abilities.",
    thumbnail: "A balance scale.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Luck Manipulator 🔮",
    description: "Controls odds and outcomes for strategic advantage.",
    tooltip: "Manipulate luck. Control odds and outcomes.",
    effectinfo: "Controls odds and outcomes for strategic advantage.",
    thumbnail: "A crystal ball.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Jackpot 💰",
    description: "Hits the jackpot, dealing massive damage to all enemies and providing significant buffs to allies.",
    tooltip: "Hit the jackpot. Massive damage and significant buffs.",
    effectinfo: "Deals massive damage to all enemies and provides significant buffs to allies.",
    thumbnail: "A jackpot slot machine.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Margin Call 📉",
    description: "Forces enemies to take damage over time.",
    tooltip: "Issue a margin call. Inflict damage over time.",
    effectinfo: "Forces enemies to take damage over time.",
    thumbnail: "A falling chart with a phone.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Liquidation Wave 🌊",
    description: "Deals area-of-effect damage and reduces enemy defenses.",
    tooltip: "Create a liquidation wave. Deal AoE damage and reduce enemy defenses.",
    effectinfo: "Deals area-of-effect damage and reduces enemy defenses.",
    thumbnail: "A crashing wave.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Protocol Crash 💥",
    description: "Creates a zone where enemies take increased damage and have reduced speed.",
    tooltip: "Crash the protocol. Increase damage and slow enemies.",
    effectinfo: "Creates a zone where enemies take increased damage and have reduced speed.",
    thumbnail: "A broken protocol symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Debt Collector 🗡️",
    description: "Focuses on sustained damage and debuffs.",
    tooltip: "Be the debt collector. Sustain damage and apply debuffs.",
    effectinfo: "Focuses on sustained damage and applies debuffs.",
    thumbnail: "A hand holding a collection notice.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Market Enforcer 🛡️",
    description: "Controls and disrupts enemy formations.",
    tooltip: "Enforce market rules. Disrupt enemy formations.",
    effectinfo: "Controls and disrupts enemy formations.",
    thumbnail: "A gavel.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Financial Collapse 💣",
    description: "Triggers a massive financial collapse, dealing devastating damage to all enemies and significantly debuffing them.",
    tooltip: "Cause a financial collapse. Devastate and debuff all enemies.",
    effectinfo: "Deals devastating damage to all enemies and significantly debuffs them.",
    thumbnail: "An explosion over a market chart.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Skeptic's Shield 🛡️",
    description: "Reduces incoming damage and reflects a portion back to attackers.",
    tooltip: "Skeptic's shield. Reduce damage and reflect a portion.",
    effectinfo: "Reduces incoming damage and reflects a portion back to attackers.",
    thumbnail: "A shield with a question mark.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Debate 🗣️",
    description: "Temporarily silences and weakens enemies.",
    tooltip: "Engage in debate. Silence and weaken enemies.",
    effectinfo: "Temporarily silences and weakens enemies.",
    thumbnail: "Two speech bubbles.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "No Coin FUD ❗",
    description: "Decreases enemy attack power and movement speed.",
    tooltip: "Spread FUD. Decrease enemy attack power and speed.",
    effectinfo: "Decreases enemy attack power and movement speed.",
    thumbnail: "A warning sign.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Critic 📉",
    description: "Enhances debuffs and controls enemy behavior.",
    tooltip: "Critique crypto. Enhance debuffs and control enemies.",
    effectinfo: "Enhances debuffs and controls enemy behavior.",
    thumbnail: "A downward arrow.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Skeptical Scholar 📚",
    description: "Buffs allies' defense and reduces enemy effectiveness.",
    tooltip: "Skeptical scholar. Buff allies' defense and reduce enemy effectiveness.",
    effectinfo: "Buffs allies' defense and reduces enemy effectiveness.",
    thumbnail: "A book and shield.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Market Crash 📉",
    description: "Causes a market crash, drastically weakening all enemies and providing significant buffs to allies.",
    tooltip: "Induce a market crash. Weaken enemies and buff allies.",
    effectinfo: "Drastically weakens all enemies and provides significant buffs to allies.",
    thumbnail: "A crashing market chart.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Code Review 📝",
    description: "Temporarily reveals enemy weaknesses and increases damage dealt.",
    tooltip: "Review code. Reveal weaknesses and increase damage.",
    effectinfo: "Reveals enemy weaknesses and increases damage dealt.",
    thumbnail: "A checklist.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Bug Fix 🔧",
    description: "Removes debuffs from allies and restores health.",
    tooltip: "Fix bugs. Remove debuffs and restore health.",
    effectinfo: "Removes debuffs from allies and restores health.",
    thumbnail: "A wrench and a bug.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Security Audit 🔒",
    description: "Creates a zone where enemies are significantly weakened.",
    tooltip: "Conduct a security audit. Weaken enemies in a zone.",
    effectinfo: "Creates a zone where enemies are significantly weakened.",
    thumbnail: "A lock and a magnifying glass.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Code Enforcer 🛡️",
    description: "Specializes in revealing and exploiting enemy weaknesses.",
    tooltip: "Enforce code standards. Reveal and exploit weaknesses.",
    effectinfo: "Reveals and exploits enemy weaknesses.",
    thumbnail: "A gavel and code.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Bug Hunter 🐞",
    description: "Focuses on debuff removal and ally support.",
    tooltip: "Hunt bugs. Remove debuffs and support allies.",
    effectinfo: "Focuses on debuff removal and ally support.",
    thumbnail: "A net catching a bug.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Critical Patch 🚀",
    description: "Deploys a critical patch, significantly buffing all allies and debuffing all enemies.",
    tooltip: "Deploy a critical patch. Buff allies and debuff enemies.",
    effectinfo: "Significantly buffs all allies and debuffs all enemies.",
    thumbnail: "A rocket and code.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Chain Analysis 🔗",
    description: "Reveals hidden enemies and tracks their movements.",
    tooltip: "Analyze the chain. Reveal and track enemies.",
    effectinfo: "Reveals hidden enemies and tracks their movements.",
    thumbnail: "A chain and an eye.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Transaction Trace 📈",
    description: "Temporarily reduces enemy speed and reveals weak points.",
    tooltip: "Trace transactions. Reduce speed and reveal weak points.",
    effectinfo: "Reduces enemy speed and reveals weak points.",
    thumbnail: "A chart and a footprint.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Criminal Hunt 🔍",
    description: "Deals extra damage to recently revealed enemies.",
    tooltip: "Hunt criminals. Deal extra damage to revealed enemies.",
    effectinfo: "Deals extra damage to recently revealed enemies.",
    thumbnail: "A target symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "On-Chain Detective 🔦",
    description: "Enhances enemy tracking and debuffs.",
    tooltip: "Be the on-chain detective. Enhance tracking and debuffs.",
    effectinfo: "Enhances enemy tracking and debuffs.",
    thumbnail: "A flashlight and chain.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crypto Investigator 📜",
    description: "Buffs self and allies based on revealed enemy locations.",
    tooltip: "Investigate crypto. Buff self and allies based on enemy locations.",
    effectinfo: "Buffs self and allies based on revealed enemy locations.",
    thumbnail: "A magnifying glass and map.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Chain Reaction 💥",
    description: "Causes a chain reaction, revealing all enemies and drastically debuffing them while significantly buffing allies.",
    tooltip: "Trigger a chain reaction. Reveal, debuff enemies, and buff allies.",
    effectinfo: "Reveals all enemies and drastically debuffs them while significantly buffing allies.",
    thumbnail: "Exploding chain links.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Bug Report 📝",
    description: "Reveals enemy weaknesses and reduces their defenses.",
    tooltip: "Report bugs. Reveal weaknesses and reduce defenses.",
    effectinfo: "Reveals enemy weaknesses and reduces their defenses.",
    thumbnail: "A bug report form.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Feature Test ⚙️",
    description: "Temporarily boosts allies' abilities.",
    tooltip: "Test features. Temporarily boost ally abilities.",
    effectinfo: "Temporarily boosts allies' abilities.",
    thumbnail: "A gear and a check mark.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Stress Test 🏋️",
    description: "Creates a zone where enemies take increased damage and have reduced speed.",
    tooltip: "Conduct a stress test. Increase enemy damage and reduce speed.",
    effectinfo: "Creates a zone where enemies take increased damage and have reduced speed.",
    thumbnail: "A weight and a clock.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Test Engineer 🔧",
    description: "Specializes in revealing and exploiting enemy weaknesses.",
    tooltip: "Be a test engineer. Reveal and exploit weaknesses.",
    effectinfo: "Specializes in revealing and exploiting enemy weaknesses.",
    thumbnail: "A wrench and gear.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "QA Specialist 🛡️",
    description: "Enhances ally buffs and reduces enemy effectiveness.",
    tooltip: "Quality assurance. Enhance buffs and reduce enemy effectiveness.",
    effectinfo: "Enhances ally buffs and reduces enemy effectiveness.",
    thumbnail: "A shield and check mark.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Final Release 🚀",
    description: "Launches the final release, significantly buffing all allies and debuffing all enemies.",
    tooltip: "Release the final version. Buff allies and debuff enemies.",
    effectinfo: "Significantly buffs all allies and debuffs all enemies.",
    thumbnail: "A rocket launching.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Exploit 🔨",
    description: "Deals significant damage to a single target and restores health.",
    tooltip: "Exploit vulnerabilities. Deal damage and restore health.",
    effectinfo: "Deals significant damage to a single target and restores health.",
    thumbnail: "A broken lock and a hammer.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Drain Liquidity 💧",
    description: "Reduces enemy defenses and steals resources.",
    tooltip: "Drain liquidity. Reduce defenses and steal resources.",
    effectinfo: "Reduces enemy defenses and steals resources.",
    thumbnail: "A draining faucet.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Flash Loan Attack ⚡",
    description: "Temporarily boosts attack power and speed.",
    tooltip: "Execute a flash loan attack. Boost attack power and speed.",
    effectinfo: "Temporarily boosts attack power and speed.",
    thumbnail: "A lightning bolt.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Protocol Raider 🏴",
    description: "Focuses on high-damage, single-target attacks.",
    tooltip: "Raid protocols. High-damage, single-target attacks.",
    effectinfo: "Focuses on high-damage, single-target attacks.",
    thumbnail: "A pirate flag.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Liquidity Vampire 🧛",
    description: "Steals resources and buffs self and allies.",
    tooltip: "Be a liquidity vampire. Steal resources and buff allies.",
    effectinfo: "Steals resources and buffs self and allies.",
    thumbnail: "A vampire and a dollar sign.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Congestion ❄️",
    description: "Slows all enemies for a short duration.",
    tooltip: "Freeze the network! Slow down all activity.",
    effectinfo: "Slows all enemies for a short duration.",
    thumbnail: "A clock with ice crystals.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Protocol Drain 🌀",
    description: "Drains multiple protocols simultaneously, dealing massive damage to all enemies and providing significant resources to allies.",
    tooltip: "Drain multiple protocols. Massive damage and resource gain.",
    effectinfo: "Drains multiple protocols simultaneously, dealing massive damage to all enemies and providing significant resources to allies.",
    thumbnail: "A swirling vortex.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Sybil Attack 🎭",
    description: "Creates decoys that distract and damage enemies.",
    tooltip: "Execute a Sybil attack. Distract and damage enemies.",
    effectinfo: "Creates decoys that distract and damage enemies.",
    thumbnail: "Multiple masks.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Vote Manipulation 🗳️",
    description: "Temporarily controls enemy movements.",
    tooltip: "Manipulate votes. Control enemy movements.",
    effectinfo: "Temporarily controls enemy movements.",
    thumbnail: "A ballot box with strings.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Airdrop Fraud ✈️",
    description: "Steals resources from enemies and redistributes them to allies.",
    tooltip: "Commit airdrop fraud. Steal resources and redistribute.",
    effectinfo: "Steals resources from enemies and redistributes them to allies.",
    thumbnail: "An airplane dropping coins.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Identity Forger 🛠️",
    description: "Specializes in creating decoys and controlling enemies.",
    tooltip: "Forge identities. Create decoys and control enemies.",
    effectinfo: "Specializes in creating decoys and controlling enemies.",
    thumbnail: "A forging hammer.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Total Takeover 🌐",
    description: "Completely takes over the battlefield, drastically buffing allies and debuffing enemies.",
    tooltip: "Execute a total takeover. Drastically buff allies and debuff enemies.",
    effectinfo: "Completely takes over the battlefield, drastically buffing allies and debuffing enemies.",
    thumbnail: "A world with chains.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Confirm Block 🧱",
    description: "Temporarily increases defense and regenerates health.",
    tooltip: "Confirm a block. Increase defense and regenerate health.",
    effectinfo: "Temporarily increases defense and regenerates health.",
    thumbnail: "A confirmed block symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Finality ⏳",
    description: "Grants temporary invincibility to all nearby players.",
    tooltip: "Achieve finality. Grant temporary invincibility.",
    effectinfo: "Grants temporary invincibility to all nearby players.",
    thumbnail: "An hourglass.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Double Spend Prevention 🛡️",
    description: "Creates a shield that absorbs multiple hits.",
    tooltip: "Prevent double spend. Create a shield.",
    effectinfo: "Creates a shield that absorbs multiple hits.",
    thumbnail: "A shield with a double spend symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Veil of Decentralization 🕸️",
    description: "Provides a shield that absorbs damage.",
    tooltip: "A veil of protection. Stay safe out there.",
    effectinfo: "Provides a shield that absorbs damage.",
    thumbnail: "A veil covering the player.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Network Consensus 🌐",
    description: "Achieves network consensus, significantly boosting allies' defense and providing damage immunity for a short period.",
    tooltip: "Achieve network consensus. Boost defense and provide damage immunity.",
    effectinfo: "Significantly boosts allies' defense and provides damage immunity for a short period.",
    thumbnail: "A globe with connected nodes.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Overclock 🔥",
    description: "Greatly increases attack power for a brief period.",
    tooltip: "Overclock your rig. Greatly increase attack power.",
    effectinfo: "Greatly increases attack power for a brief period.",
    thumbnail: "An overheating GPU.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Mining Rig 🏗️",
    description: "Deploys a stationary turret that automatically attacks enemies.",
    tooltip: "Deploy a mining rig. Automatically attack enemies.",
    effectinfo: "Deploys a stationary turret that automatically attacks enemies.",
    thumbnail: "A mining rig.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Energy Surge ⚡",
    description: "Temporarily increases attack speed and movement speed.",
    tooltip: "Unleash an energy surge. Increase attack speed and movement speed.",
    effectinfo: "Temporarily increases attack speed and movement speed.",
    thumbnail: "A lightning bolt.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "PoS Migration 🛡️",
    description: "Increases the player's defense.",
    tooltip: "Proof of Safety! Stronger defenses.",
    effectinfo: "Increases the player's defense.",
    thumbnail: "A shield with 'PoS' written on it.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Mining Frenzy ⛏️",
    description: "Triggers a mining frenzy, drastically increasing attack power and speed for a short period.",
    tooltip: "Enter a mining frenzy. Drastically increase attack power and speed.",
    effectinfo: "Drastically increases attack power and speed for a short period.",
    thumbnail: "A pickaxe and a lightning bolt.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Governance Vote 🗳️",
    description: "Grants a random beneficial effect based on player needs.",
    tooltip: "Cast a governance vote. Grant a random beneficial effect.",
    effectinfo: "Grants a random beneficial effect based on player needs.",
    thumbnail: "A ballot box.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Protocol Upgrade 🆙",
    description: "Permanently enhances one of the player's abilities.",
    tooltip: "Execute a protocol upgrade. Permanently enhance an ability.",
    effectinfo: "Permanently enhances one of the player's abilities.",
    thumbnail: "An upgrade symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Stability Mechanism ⚖️",
    description: "Reduces damage taken for a prolonged period.",
    tooltip: "Activate a stability mechanism. Reduce damage taken.",
    effectinfo: "Reduces damage taken for a prolonged period.",
    thumbnail: "A scale.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "PoW Migration 🔨",
    description: "Increases the player's attack power.",
    tooltip: "Proof of Whacking! Stronger attacks.",
    effectinfo: "Increases the player's attack power.",
    thumbnail: "A hammer with 'PoW' on it.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Protocol Governance 🏛️",
    description: "Implements a major governance change, significantly buffing allies and debuffing enemies.",
    tooltip: "Implement protocol governance. Buff allies and debuff enemies.",
    effectinfo: "Significantly buffs allies and debuffs enemies.",
    thumbnail: "A government building.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Harvest Yield 🌽",
    description: "Increases resource drops from defeated enemies.",
    tooltip: "Harvest yield. Increase resource drops.",
    effectinfo: "Increases resource drops from defeated enemies.",
    thumbnail: "A harvest basket.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Compound Interest 💹",
    description: "Gradually increases attack power and defense over time.",
    tooltip: "Compound interest. Gradually increase attack power and defense.",
    effectinfo: "Gradually increases attack power and defense over time.",
    thumbnail: "An interest chart.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Crop Rotation 🌱",
    description: "Switches between different buffs to suit the player's needs.",
    tooltip: "Rotate crops. Switch between buffs.",
    effectinfo: "Switches between different buffs to suit the player's needs.",
    thumbnail: "Rotating crops.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Bountiful Harvest 🌾",
    description: "Triggers a bountiful harvest, drastically increasing resource drops and providing significant buffs to all allies.",
    tooltip: "Trigger a bountiful harvest. Increase resources and buff allies.",
    effectinfo: "Drastically increases resource drops and provides significant buffs to all allies.",
    thumbnail: "A golden field.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Price Divergence 🔀",
    description: "Confuses enemies, causing them to attack each other.",
    tooltip: "Create price divergence. Confuse enemies to attack each other.",
    effectinfo: "Confuses enemies, causing them to attack each other.",
    thumbnail: "Diverging arrows.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Quick Trade 🏃",
    description: "Rapidly dashes through enemies, dealing damage.",
    tooltip: "Execute a quick trade. Dash through enemies and deal damage.",
    effectinfo: "Rapidly dashes through enemies, dealing damage.",
    thumbnail: "A running figure.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Market Swing 📊",
    description: "Temporarily increases critical hit chance and attack speed.",
    tooltip: "Ride the market swing. Increase critical hit chance and attack speed.",
    effectinfo: "Temporarily increases critical hit chance and attack speed.",
    thumbnail: "A swinging market chart.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Perfect Arbitrage 💰",
    description: "Executes a perfect arbitrage, drastically increasing attack power and critical hit chance for a short period.",
    tooltip: "Execute perfect arbitrage. Increase attack power and critical hit chance.",
    effectinfo: "Drastically increases attack power and critical hit chance for a short period.",
    thumbnail: "Golden coins.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Flash Trade ⚡",
    description: "Instantaneously moves to a targeted location, dealing damage.",
    tooltip: "Execute a flash trade. Instantly move and deal damage.",
    effectinfo: "Instantaneously moves to a targeted location, dealing damage.",
    thumbnail: "A lightning bolt.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Order Book 📈",
    description: "Creates decoys to confuse enemies.",
    tooltip: "Create an order book. Confuse enemies with decoys.",
    effectinfo: "Creates decoys to confuse enemies.",
    thumbnail: "A financial order book.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Execution Speed 🚀",
    description: "Increases attack speed and movement speed.",
    tooltip: "Boost execution speed. Increase attack and movement speed.",
    effectinfo: "Increases attack speed and movement speed.",
    thumbnail: "A rocket.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Trade Frenzy 📉",
    description: "Enters a trade frenzy, drastically increasing attack speed and damage for a short period.",
    tooltip: "Enter a trade frenzy. Drastically increase attack speed and damage.",
    effectinfo: "Drastically increases attack speed and damage for a short period.",
    thumbnail: "A frenzied market chart.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Mint Masterpiece 🎨",
    description: "Creates a stunning piece of digital art that distracts enemies and boosts allies' morale.",
    tooltip: "A true masterpiece! Watch as enemies are mesmerized and allies are inspired.",
    effectinfo: "Creates a stunning piece of digital art that distracts enemies and boosts allies' morale.",
    thumbnail: "A paintbrush and palette.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Token Airdrop 🎁",
    description: "Airdrops valuable tokens to allies, providing temporary buffs and resources.",
    tooltip: "Free tokens for everyone! Enjoy the perks of being an NFT creator.",
    effectinfo: "Airdrops valuable tokens to allies, providing temporary buffs and resources.",
    thumbnail: "A gift box with tokens.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Smart Contract Art 🖼️",
    description: "Deploys a smart contract-based artwork that creates a protective barrier.",
    tooltip: "Art meets security. This smart contract art keeps you safe and sound.",
    effectinfo: "Deploys a smart contract-based artwork that creates a protective barrier.",
    thumbnail: "A framed artwork.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Collector's Frenzy 🛍️",
    description: "Calls upon devoted collectors to swarm enemies, dealing massive damage.",
    tooltip: "Collectors are on the hunt! Unleash their frenzy on your foes.",
    effectinfo: "Calls upon devoted collectors to swarm enemies, dealing massive damage.",
    thumbnail: "A swarm of collectors.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Art Revolution 🌟",
    description: "Unleashes an art revolution, drastically buffing allies and dealing massive damage to all enemies.",
    tooltip: "Lead an art revolution. Drastically buff allies and damage enemies.",
    effectinfo: "Drastically buffs allies and deals massive damage to all enemies.",
    thumbnail: "A radiant artwork.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Scalability Boost 📈",
    description: "Increases attack speed and movement speed.",
    tooltip: "Boost scalability. Enhance attack and movement speed.",
    effectinfo: "Increases attack speed and movement speed.",
    thumbnail: "A speedometer.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Security Lockdown 🔒",
    description: "Reduces damage taken for a short period.",
    tooltip: "Activate security lockdown. Reduce damage taken.",
    effectinfo: "Reduces damage taken for a short period.",
    thumbnail: "A locked shield.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Decentralized Network 🌐",
    description: "Summons allies to assist in battle.",
    tooltip: "The power of many. Amplify your abilities.",
    effectinfo: "Summons allies to assist in battle.",
    thumbnail: "A network diagram with a ripple effect.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Network Effect 🌟",
    description: "Increases the effectiveness of all abilities.",
    tooltip: "The network effect amplifies all abilities.",
    effectinfo: "Increases the effectiveness of all abilities.",
    thumbnail: "A glowing network node.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Multilayer Design 🛡️",
    description: "Adds an additional layer of defense.",
    tooltip: "When one layer just isn't enough.",
    effectinfo: "Adds an additional layer of defense.",
    thumbnail: "Stacked shields.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Monolithic Design 🏛️",
    description: "Provides a significant health boost.",
    tooltip: "Strong, sturdy, and monolithic – just like your health.",
    effectinfo: "Provides a significant health boost.",
    thumbnail: "A large, imposing monolith.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Sidechains 🔗",
    description: "Allows the player to create decoys that distract enemies.",
    tooltip: "Sidechains for sidekicks! Distract your enemies.",
    effectinfo: "Allows the player to create decoys that distract enemies.",
    thumbnail: "A chain with multiple branches.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Layer 2 Scaling 📊",
    description: "Reduces the cost and cooldown of all abilities.",
    tooltip: "Scale up and save! Reduce costs and cooldowns.",
    effectinfo: "Reduces the cost and cooldown of all abilities.",
    thumbnail: "Two layers stacked with an arrow.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Trilemma Mastery ⚖️",
    description: "Master the trilemma by providing significant buffs to attack, defense, and movement speed while weakening enemies.",
    tooltip: "Achieve trilemma mastery. Boost attack, defense, and movement speed while weakening enemies.",
    effectinfo: "Provides significant buffs to attack, defense, and movement speed while weakening enemies.",
    thumbnail: "A balanced scale with a glowing aura.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Deploy Contract 🏗️",
    description: "Sets up a turret that automatically attacks enemies.",
    tooltip: "Deploy a smart contract. Set up a turret to attack enemies.",
    effectinfo: "Sets up a turret that automatically attacks enemies.",
    thumbnail: "A turret.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Gas Limit ⛽",
    description: "Reduces the speed of all enemies in a large area.",
    tooltip: "Set a gas limit. Reduce enemy speed in a large area.",
    effectinfo: "Reduces the speed of all enemies in a large area.",
    thumbnail: "A gas gauge.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Revert ↩️",
    description: "Teleports the player to a previous location, avoiding damage.",
    tooltip: "Revert to a previous location. Avoid damage.",
    effectinfo: "Teleports the player to a previous location, avoiding damage.",
    thumbnail: "A backward arrow.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Exit Hatch 🚪",
    description: "Grants one extra life.",
    tooltip: "One chance to escape from a L2+.",
    effectinfo: "Grants one extra life.",
    thumbnail: "A hatch with an emergency sign.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Code Overload 💥",
    description: "Deploys multiple automated defenses and traps that significantly disrupt and damage enemies.",
    tooltip: "Deploy an overload of defenses and traps. Disrupt and damage enemies.",
    effectinfo: "Deploys multiple automated defenses and traps that significantly disrupt and damage enemies.",
    thumbnail: "A computer with an overload symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Protocol Enhancement ⚙️",
    description: "Temporarily increases the effectiveness of all abilities.",
    tooltip: "Enhance protocols. Boost the effectiveness of all abilities.",
    effectinfo: "Temporarily increases the effectiveness of all abilities.",
    thumbnail: "A gear with a plus symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Patch Update 🔄",
    description: "Heals and buffs nearby allies.",
    tooltip: "Apply a patch update. Heal and buff nearby allies.",
    effectinfo: "Heals and buffs nearby allies.",
    thumbnail: "A patch with a heart.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Network Upgrade 🆙",
    description: "Grants a significant buff to a random ability.",
    tooltip: "Upgrade the network. Buff a random ability.",
    effectinfo: "Grants a significant buff to a random ability.",
    thumbnail: "An upgrade arrow.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Sharding Upgrade 💎",
    description: "Splits the player's attacks into multiple projectiles, hitting more enemies.",
    tooltip: "Divide and conquer! Your attacks hit multiple targets.",
    effectinfo: "Splits the player's attacks into multiple projectiles, hitting more enemies.",
    thumbnail: "A shard of glass with reflections.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Protocol Mastery 🏆",
    description: "Master protocols to provide comprehensive buffs to all allies and debuff enemies significantly.",
    tooltip: "Achieve protocol mastery. Provide extensive buffs and debuffs.",
    effectinfo: "Provides comprehensive buffs to all allies and debuffs enemies significantly.",
    thumbnail: "A trophy with protocol symbols.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Rule of Law ⚖️",
    description: "Significantly slows all enemies in a large area.",
    tooltip: "Enforce the rule of law. Slow all enemies in a large area.",
    effectinfo: "Significantly slows all enemies in a large area.",
    thumbnail: "A gavel.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Inspection 🔍",
    description: "Reveals and debuffs all enemies in a targeted area.",
    tooltip: "Conduct an inspection. Reveal and debuff enemies.",
    effectinfo: "Reveals and debuffs all enemies in a targeted area.",
    thumbnail: "A magnifying glass.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Compliance Order 📜",
    description: "Forces enemies to move towards the player, taking damage over time.",
    tooltip: "Issue a compliance order. Force enemies to move towards you and take damage.",
    effectinfo: "Forces enemies to move towards the player, taking damage over time.",
    thumbnail: "A compliance document.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Law Enforcement 🔨",
    description: "Enforces a comprehensive area of control, significantly weakening and slowing all enemies while providing substantial buffs to allies.",
    tooltip: "Enforce the law. Weaken and slow enemies while buffing allies.",
    effectinfo: "Significantly weakens and slows all enemies while providing substantial buffs to allies.",
    thumbnail: "A gavel with a shield.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Legislation 📜",
    description: "Creates an area where enemies are significantly weakened.",
    tooltip: "Implement legislation. Weaken enemies in a designated area.",
    effectinfo: "Creates an area where enemies are significantly weakened.",
    thumbnail: "A scroll with a seal.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Sanction Wave 🌊",
    description: "Sends out a wave that debuffs all enemies it touches.",
    tooltip: "Unleash a sanction wave. Debuff enemies in its path.",
    effectinfo: "Sends out a wave that debuffs all enemies it touches.",
    thumbnail: "A wave with sanctions.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Regulatory Framework 🏛️",
    description: "Creates a barrier that blocks enemy movement.",
    tooltip: "Establish a regulatory framework. Block enemy movement.",
    effectinfo: "Creates a barrier that blocks enemy movement.",
    thumbnail: "A government building.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Policy Overhaul 📋",
    description: "Executes a policy overhaul, providing massive buffs to allies and drastically debuffing enemies across the battlefield.",
    tooltip: "Execute a policy overhaul. Buff allies and debuff enemies significantly.",
    effectinfo: "Provides massive buffs to allies and drastically debuffs enemies across the battlefield.",
    thumbnail: "A document with major changes.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Network Upgrade 🔧",
    description: "Increases the attack and defense of all nearby allies.",
    tooltip: "Upgrade the network. Boost attack and defense of allies.",
    effectinfo: "Increases the attack and defense of all nearby allies.",
    thumbnail: "A network with an upward arrow.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Node Fortification 🏰",
    description: "Temporarily becomes invulnerable while taunting enemies.",
    tooltip: "Fortify the node. Become invulnerable and taunt enemies.",
    effectinfo: "Temporarily becomes invulnerable while taunting enemies.",
    thumbnail: "A fortified node.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Load Balancing ⚖️",
    description: "Spreads damage taken to nearby enemies.",
    tooltip: "Balance the load. Spread damage to nearby enemies.",
    effectinfo: "Spreads damage taken to nearby enemies.",
    thumbnail: "A balancing scale.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Light Node Runner 🏃",
    description: "Increases movement speed.",
    tooltip: "Light on your feet, quick on your toes.",
    effectinfo: "Increases movement speed.",
    thumbnail: "A runner with a light node.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Network Fortress 🏰",
    description: "Constructs a powerful fortress that provides extensive protection to allies and significantly disrupts enemies.",
    tooltip: "Build a network fortress. Offer extensive protection and disrupt enemies.",
    effectinfo: "Constructs a powerful fortress that provides extensive protection to allies and significantly disrupts enemies.",
    thumbnail: "A fortified network with a protective shield.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Diamond Hands 💎",
    description: "Reduces incoming damage significantly for a short period.",
    tooltip: "Hold strong with diamond hands. Reduce incoming damage.",
    effectinfo: "Reduces incoming damage significantly for a short period.",
    thumbnail: "A diamond hand.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Market Patience ⏳",
    description: "Gradually regenerates health over time.",
    tooltip: "Show market patience. Gradually regenerate health.",
    effectinfo: "Gradually regenerates health over time.",
    thumbnail: "An hourglass.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Whale Buy 🐋",
    description: "Unleashes a powerful area-of-effect attack, representing a large buy order.",
    tooltip: "Make a whale buy. Execute a powerful area-of-effect attack.",
    effectinfo: "Unleashes a powerful area-of-effect attack, representing a large buy order.",
    thumbnail: "A whale with a coin.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: HODL Triumph 🎉",
    description: "Unleashes a triumphant display of resilience, massively boosting defense and health while delivering a devastating area attack.",
    tooltip: "Triumph with HODL. Boost defense, health, and deliver a massive area attack.",
    effectinfo: "Massively boosts defense and health while delivering a devastating area attack.",
    thumbnail: "A trophy with diamond hands.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Liquidity Pool 💧",
    description: "Creates an area that slowly heals and buffs allies.",
    tooltip: "Create a liquidity pool. Heal and buff allies in the area.",
    effectinfo: "Creates an area that slowly heals and buffs allies.",
    thumbnail: "A pool with a healing symbol.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Yield Boost 📈",
    description: "Increases resource generation for a short period.",
    tooltip: "Boost yield. Increase resource generation temporarily.",
    effectinfo: "Increases resource generation for a short period.",
    thumbnail: "A growing bar chart.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Flash Loan 💸",
    description: "Temporarily borrows attack power from enemies, dealing increased damage.",
    tooltip: "Take a flash loan. Borrow attack power and deal increased damage.",
    effectinfo: "Temporarily borrows attack power from enemies, dealing increased damage.",
    thumbnail: "A loan document with an arrow.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: DeFi Supremacy 🏆",
    description: "Establishes complete DeFi dominance, significantly enhancing all aspects of resource generation and providing massive buffs to allies.",
    tooltip: "Achieve DeFi supremacy. Enhance resource generation and buff allies extensively.",
    effectinfo: "Significantly enhances all aspects of resource generation and provides massive buffs to allies.",
    thumbnail: "A golden trophy with DeFi symbols.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Funding Boost 📈",
    description: "Increases resource generation for a short period.",
    tooltip: "Boost your funding. Increase resource generation.",
    effectinfo: "Increases resource generation for a short period.",
    thumbnail: "A stack of coins.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Due Diligence 🔎",
    description: "Reveals enemies' weaknesses and reduces their defenses.",
    tooltip: "Conduct due diligence. Know and weaken your enemies.",
    effectinfo: "Reveals enemies' weaknesses and reduces their defenses.",
    thumbnail: "A magnifying glass over documents.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Capital Injection 💰",
    description: "Provides a significant health boost to the player or an ally.",
    tooltip: "Inject capital. Boost health significantly.",
    effectinfo: "Provides a significant health boost to the player or an ally.",
    thumbnail: "A money bag with a plus sign.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Buyout Power 💼",
    description: "Temporarily takes control of an enemy, turning them into an ally.",
    tooltip: "Leverage your buyout power. Control an enemy.",
    effectinfo: "Temporarily takes control of an enemy, turning them into an ally.",
    thumbnail: "A handshake with dollar signs.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "System Breach 🕵️",
    description: "Disables enemy abilities for a short period.",
    tooltip: "Breach their systems. Disable enemy abilities.",
    effectinfo: "Disables enemy abilities for a short period.",
    thumbnail: "A broken lock.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Malware Injection 🐛",
    description: "Inflicts damage over time and reduces enemy attack speed.",
    tooltip: "Inject malware. Damage and slow your enemies.",
    effectinfo: "Inflicts damage over time and reduces enemy attack speed.",
    thumbnail: "A bug with a syringe.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Firewall Defense 🛡️",
    description: "Increases the player's defense temporarily.",
    tooltip: "Raise your firewall. Increase defense.",
    effectinfo: "Increases the player's defense temporarily.",
    thumbnail: "A shield with flames.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Total Shutdown 💻",
    description: "Shuts down all enemy abilities and greatly reduces their stats for a short period.",
    tooltip: "Initiate total shutdown. Disable and weaken enemies.",
    effectinfo: "Shuts down all enemy abilities and greatly reduces their stats for a short period.",
    thumbnail: "A power button with a lock.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Quick Strike ⚔️",
    description: "Delivers a fast attack with increased critical hit chance.",
    tooltip: "Strike quickly and precisely. Increase critical hit chance.",
    effectinfo: "Delivers a fast attack with increased critical hit chance.",
    thumbnail: "A fast-moving sword.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Speed Boost 💨",
    description: "Increases movement speed for a short period.",
    tooltip: "Boost your speed. Move faster for a short time.",
    effectinfo: "Increases movement speed for a short period.",
    thumbnail: "A running figure.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Escape Plan 🚪",
    description: "Teleports the player to a safe location.",
    tooltip: "Execute your escape plan. Teleport to safety.",
    effectinfo: "Teleports the player to a safe location.",
    thumbnail: "An open door.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Scalping Frenzy ⚡",
    description: "Temporarily boosts attack speed and movement speed to maximum levels.",
    tooltip: "Unleash scalping frenzy. Maximize attack and movement speed.",
    effectinfo: "Temporarily boosts attack speed and movement speed to maximum levels.",
    thumbnail: "A lightning-fast figure.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Price Stabilization 📉📈",
    description: "Stabilizes prices, reducing enemy attack power and increasing ally defense.",
    tooltip: "Stabilize prices. Reduce enemy attack power and boost ally defense.",
    effectinfo: "Stabilizes prices, reducing enemy attack power and increasing ally defense.",
    thumbnail: "Stabilized graphs.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Liquidity Pool 🌊",
    description: "Creates a liquidity pool that heals allies over time.",
    tooltip: "Create a liquidity pool. Heal allies over time.",
    effectinfo: "Creates a liquidity pool that heals allies over time.",
    thumbnail: "A pool of liquid.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Order Book 📖",
    description: "Summons an order book that blocks enemy projectiles.",
    tooltip: "Summon the order book. Block incoming projectiles.",
    effectinfo: "Summons an order book that blocks enemy projectiles.",
    thumbnail: "An open book.",
    level: 1,
    isLocked: false,
    effect(level, user) {
    },
},
{
    title: "Ultimate: Market Manipulation Master 🧠",
    description: "Gains full control over the market, drastically buffing allies and debuffing enemies.",
    tooltip: "Master the market. Drastically buff allies and debuff enemies.",
    effectinfo: "Gains full control over the market, drastically buffing allies and debuffing enemies.",
    thumbnail: "A mastermind controlling the market.",
    level: 1,
    isLocked: false,
    effect(level, user) {
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
        this.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.2, .5, 0.01); 
        composer.addPass(this.renderScene);
        composer.addPass(this.bloomPass);

        this.floorGeometry = new THREE.PlaneGeometry(.100, .100);
        this.floorMaterial = new THREE.MeshStandardMaterial({

            metalness: 0,
            roughness: 0,
            transparent: true,
            opacity: 0.15,   
            side: THREE.DoubleSide,
            envMap: this.envMap,
            refractionRatio: 0.98 
        });
        
        this.floor = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -0.5;
        this.floor.receiveShadow = true;
        scene.add(this.floor);
        
        this.floor.onBeforeRender = (renderer, scene, camera) => {
            const distance = 1;
            const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
            const floorPosition = camera.position.clone().add(cameraDirection.multiplyScalar(distance));
            this.floor.position.set(floorPosition.x, this.floor.position.y, floorPosition.z);
        };
        
        camera.position.set(0, 15, 15);
    
        this.octahedronGeometry = new THREE.OctahedronGeometry(1);
        this.octahedronGeometry.scale(5,7.5,5); 
        
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();
        
        this.envTexture = new THREE.TextureLoader().load('Media/Textures/ENVTEXTURE.png', texture => {
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
window.addEventListener('resize', updateRendererSize);

/*---------------------------------------------------------------------------
                              World Controller
---------------------------------------------------------------------------*/
world = worldTypes[0];
world.setup(scene,camera,renderer);
/*---------------------------------------------------------------------------
                              Player Controller
---------------------------------------------------------------------------*/
const initialPlayerPosition = new THREE.Vector3(0, 0, 0);
player = new Entity(playerTypes.find(type => type.title === 'Onchain Survivor'), initialPlayerPosition);

import { keys, initiateJoystick } from './joystick.js';
initiateJoystick();

ability = abilityTypes[0] ;

function updatePlayerMovement() {
    if (!canMove) return;
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
        const rotationSpeed = 0.1;
        const angleDifference = targetRotation - player.rotation.y;
        const adjustedAngle = ((angleDifference + Math.PI) % (2 * Math.PI)) - Math.PI;
        player.rotation.y += Math.sign(adjustedAngle) * Math.min(rotationSpeed, Math.abs(adjustedAngle));
        player.updateMesh();
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
function createParticleEffect(position, color = 'red', particleCount = 100) {
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
        size: 0.05, 
        transparent: true,
        opacity: 0.5,
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

Entity.prototype.die = function() {
    handleEntityDeath(this, enemies);
    createParticleEffect(this.position);
};

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
    //Debt: Make level up more difficult according to the number of skilss in the player  
    player.xpToNextLevel  =  player.xpToNextLevel + player.xpToNextLevel ;

    const upgradeOptions = [];
    for (let i = 0; i < 4 && upgradableAbilities.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * upgradableAbilities.length);
        const abilityToUpgrade = { ...upgradableAbilities[randomIndex] };
        abilityToUpgrade.isLocked = false; 
        console.log(abilityToUpgrade.level)
        upgradeOptions.push(abilityToUpgrade);
        upgradableAbilities.splice(randomIndex, 1);
    }
    createChooseMenu(upgradeOptions, "Upgrade:", "Upgrade");
}
    
/*---------------------------------------------------------------------------
                              Enemies Controller
---------------------------------------------------------------------------*/

const enemies = [];

function updateEnemies() {
    enemies.forEach(enemy => {
        const direction = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
        enemy.position.add(direction.multiplyScalar(enemy.movementspeed/2));
        const targetRotation = Math.atan2(direction.x, direction.z);
        enemy.rotation.y = targetRotation;
        enemy.boundingBox.setFromObject(enemy.mesh);
        enemy.updateMesh();
        enemy.updateAbilities();
    });
}

function startSpawningEnemies(player, spawnInterval = 1000, spawnRadius = 150, numberOfEnemies = 5) {
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
        
        img.style.filter = 'brightness(130%)'; 

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
    


        const effectinfo = document.createElement('div');
        effectinfo.innerText = `${dataType.description}`;
        if (dataType.level>0)
        effectinfo.innerText =`${dataType.effectinfo}`;
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
        button.title = 'Insert unlock hint here'
    }
        return button;
    }

    function addContainerUI(container,location,uiElements){
        container.innerHTML='';
        container.className = ''; 
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

    function createPopUpContainer() {
        const container = document.createElement('div');
        container.classList.add('choose-menu-container'); 
        return container;
    }
    
    function createTitleContainer(text) {
        const container = document.createElement('div');
        container.classList.add('choose-menu-title');
        const title = createTitleElement(text, '', isMobile ? '10vw' : '6vw'); 
        container.appendChild(title);
        return container;
    }
    
    function createGridContainer() {
        const container = document.createElement('div');
        container.classList.add('choose-menu-grid'); 
        return container;
    }

    let topUI = createContainer(['top-container', 'fade-in']);
        
    let centerUI = createContainer(['center-container', 'fade-in']);

    let botUI = createContainer(['bottom-container', 'fade-in']);

/*---------------------------------------------------------------------------
                                GAME TITLE 
---------------------------------------------------------------------------*/
    function createGameTitle(){
        const mainTitle = createTitleElement('🏆⚔️🔗\nOnchain Survivor', 'laziest Logo ive ever seen, isnt the dev just using ai for everything and this is the best he could come up with? 💀', isMobile ? '10vw' : '6vw');
        mainTitle.style.cursor= "pointer"
        mainTitle.onclick = function() { window.open('https://x.com/OnChainSurvivor', '_blank'); };
        const subTitle = createTitleElement('', 'lazy subtitle too btw', isMobile ? '4vw' : '2vw');
        addContainerUI(topUI,'top-container', [mainTitle,subTitle]);
    };
    createGameTitle();
/*---------------------------------------------------------------------------
                                MAIN MENU
---------------------------------------------------------------------------*/
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
function createGameMenu() {
    const classImages = playerTypes.map(player => player.thumbnail);
    const abilityImages = abilityTypes.map(ability => ability.thumbnail);
    const worldImages = worldTypes.map(world => world.thumbnail);

    const classContainer = document.createElement('div');
    const classSubTitle = createTitleElement('🏆', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
    const classButton = createButton(player, isMobile ? 0.6 : 0.75);
    classContainer.appendChild(classButton);
    classContainer.appendChild(classSubTitle);

    const abilitiesSubTitle = createTitleElement('⚔️', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
    const abilitiesButton = createButton(ability, isMobile ? 0.6 : 0.75);
    const classAbilityContainer = document.createElement('div');
    classAbilityContainer.appendChild(abilitiesButton);
    classAbilityContainer.appendChild(abilitiesSubTitle);

    const worldSubTitle = createTitleElement('🔗', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
    const worldButton = createButton(world, isMobile ? 0.6 : 0.75);
    const worldContainer = document.createElement('div');
    worldContainer.appendChild(worldButton);
    worldContainer.appendChild(worldSubTitle);

    const menuButtonsContainer = createContainer([], { display: 'flex' });
    menuButtonsContainer.appendChild(classContainer);
    menuButtonsContainer.appendChild(classAbilityContainer);
    menuButtonsContainer.appendChild(worldContainer);
    const subTitle = createTitleElement('Move to quick start !', 'lazy subtitle too btw', isMobile ? '4vw' : '2vw');
    addContainerUI(botUI, 'bottom-container', [subTitle,menuButtonsContainer]);

        menuButtonsContainer.childNodes.forEach(button => {
            button.addEventListener('click', () => {
                canMove=false;
                if (button === classContainer) {
                    createChooseMenu(playerTypes, "Choose a Survivor 🏆","Survivor");
                } else if (button === classAbilityContainer) {
                    createChooseMenu(abilityTypes, "Choose an Ability ⚔️","Ability");
                } else if (button === worldContainer) {
                    createChooseMenu(worldTypes, "Choose a Chain 🔗","World");
                }
                hideContainerUI(botUI);
            });
        });
 
        createRandomRunEffect(classButton, classImages, 110, isMobile ? 0.6 : 0.75, "class"); 
        createRandomRunEffect(abilitiesButton, abilityImages, 0, isMobile ? 0.6 : 0.75, "ability");
        createRandomRunEffect(worldButton, worldImages, 0, isMobile ? 0.6 : 0.75, "world");
    };
    createGameMenu()
/*---------------------------------------------------------------------------
                        Generic Choose Menu
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
           const abilitiesOfClassContainer = document.createElement('div');
           abilitiesOfClassContainer.classList.add('abilities-grid');
       
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
    addContainerUI(centerUI, 'center-container', [popUpContainer]);
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
        player.possibleAbilities.set(entity.title, { ...entity, level: 1 });
        refreshDisplay();
    } else if (entity.isLocked) {
        return;
    } else if (type === "Survivor") {
        player.deactivateAbilities();
        scene.remove(player);
        player = new Entity(playerTypes.find(t => t === entity),initialPlayerPosition);
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

/*---------------------------------------------------------------------------
                                    WEB3 Connect Menu
---------------------------------------------------------------------------*/
    const web3Container = createContainer(['fade-in', 'top-container'], { left: '135%' });
    const buttonConnect = document.createElement('button');
    const subTitle = createTitleElement('♦️\nConnect\n♦️', 'lazy subtitle too btw', isMobile ? '3vw' : '1.5vw');
    buttonConnect.style.backgroundColor = 'black';
    buttonConnect.style.border = 'transparent';
    buttonConnect.style.cursor = 'pointer';
    buttonConnect.appendChild(subTitle);
    web3Container.appendChild(buttonConnect);
    topUI.appendChild(web3Container);
    setTimeout(() => { web3Container.classList.add('show'); }, 10); 

    buttonConnect.onclick = async () => {
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
                displayWeb3Menu(displayName); 
    
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
            displayWeb3Menu(storedAddress);
        }
    });
/*---------------------------------------------------------------------------
                                    WEB3 Options  Menu
---------------------------------------------------------------------------*/
    function displayWeb3Menu(address) {
        canMove=false;

        hideContainerUI(botUI);
        hideContainerUI(topUI);
        hideContainerUI(centerUI);

        const classImages = playerTypes.map(player => player.thumbnail);
        const abilityImages = abilityTypes.map(ability => ability.thumbnail);
        const worldImages = worldTypes.map(world => world.thumbnail);
     
        const classContainer = document.createElement('div');
        const classSubTitle = createTitleElement('🏆 100%', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
        const classButton = createButton(player, isMobile ? 0.6 : 0.75);
        classContainer.appendChild(classButton);
        classContainer.appendChild(classSubTitle);
     
        const abilitiesSubTitle = createTitleElement('⚔️ 50%', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
        ability.isLocked=false;
        const abilitiesButton = createButton(ability, isMobile ? 0.6 : 0.75);
        const classAbilityContainer = document.createElement('div');
        classAbilityContainer.appendChild(abilitiesButton);
        classAbilityContainer.appendChild(abilitiesSubTitle);
     
        const worldSubTitle = createTitleElement('🔗 10%', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
        const worldButton = createButton(world, isMobile ? 0.6 : 0.75);
        const worldContainer = document.createElement('div');
        worldContainer.appendChild(worldButton);
        worldContainer.appendChild(worldSubTitle);
     
        const galleryButtonsContainer = createContainer([], { display: 'flex' });
        galleryButtonsContainer.appendChild(classContainer);
        galleryButtonsContainer.appendChild(classAbilityContainer);
        galleryButtonsContainer.appendChild(worldContainer);
        const subTitle = createTitleElement(`Welcome Home, ${address}!`, 'lazy subtitle too btw', isMobile ? '4.5vw' : '2.5vw');
        
        const subTitleRun = createTitleElement('⌛️ Start Run ⌛️', 'lazy subtitle too btw', isMobile ? '4vw' : '2vw');
        subTitleRun.style.cursor = 'pointer';
         
        const subTitleReport = createTitleElement('⚖️ Transparency Report ⚖️', 'lazy subtitle too btw', isMobile ? '4vw' : '2vw');
        subTitleReport.style.cursor = 'pointer';
 
        const subTitleHall = createTitleElement('💎 Hall of Survivors 💎', 'lazy subtitle too btw', isMobile ? '4vw' : '2vw');
        subTitleHall.style.cursor = 'pointer';
 
        const subTitleLogout = createTitleElement('♢Log Out ♢', 'lazy subtitle too btw', isMobile ? '4vw' : '2vw');
        subTitleLogout.style.cursor = 'pointer';
        subTitleLogout.onclick = () => {
            localStorage.removeItem('metaMaskAddress');
            location.reload(); 
        };
 
        const loadingContainer = document.createElement('div');
        loadingContainer.classList.add('loading-container');
             
        const loadingBar = document.createElement('div');
        loadingBar.classList.add('loading-bar');
         
        const loadingText =  createTitleElement('', 'who even keeps track of these', isMobile ? '4vw' : '2vw');
        loadingContainer.appendChild(loadingBar);

        //debt: push real data here, eventually
        function updateLoadingBar(currentAmount) {
            const goal = 1000000; 
            const percentage = (currentAmount / goal) * 100;
            loadingBar.style.width = percentage + '%';
            loadingText.innerText =' ❤️ Goal '+percentage.toFixed(2) + '% ❤️';
            loadingText.classList.add('rainbow-text'); 
        }
     
     //debt: delete  after simulation not needed 
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
     
        setTimeout(() => { 
            addContainerUI(topUI, 'top-container', [subTitle,galleryButtonsContainer]);
            addContainerUI(botUI,'bottom-container', [subTitleRun,subTitleHall,subTitleReport,loadingText,loadingContainer,subTitleLogout]);
            simulateLoading(); 
        }, 1050);
     
            // Debt: Gallery functionality after withdrawing data from the blockchain
         //    galleryButtonsContainer.childNodes.forEach(button => {
            //     button.addEventListener('click', () => {
            //         canMove=false;
            //         if (button === classContainer) {
           //              createGallery(playerTypes, "Your Survivors 🏆","Survivor");
           //          } else if (button === classAbilityContainer) {
           //              createGallery(abilityTypes, "Your Abilities ⚔️","Ability");
           //          } else if (button === worldContainer) {
           //              createGallery(worldTypes, "Your Chains 🔗","World");
          //           }
          //           hideContainerUI(center);
          //       });
         //    });

             createRandomRunEffect(classButton, classImages, 110, isMobile ? 0.6 : 0.75, "class"); 
             createRandomRunEffect(abilitiesButton, abilityImages, 0, isMobile ? 0.6 : 0.75, "ability");
             createRandomRunEffect(worldButton, worldImages, 0, isMobile ? 0.6 : 0.75, "world");
    }
/*---------------------------------------------------------------------------
                                   IN-GAME UI 
---------------------------------------------------------------------------*/
let countdown = 300 * 60;
const modeDisplay = createTitleElement('__________________', 'who even keeps track of these', isMobile ? '4vw' : '3vw');
const timerDisplay = createTitleElement('', 'who even keeps track of these', isMobile ? '4vw' : '3vw');
const coordinateDisplay = createTitleElement('', 'who even keeps track of these', isMobile ? '4vw' : '3vw');
function updateTimerDisplay() {
    countdown--;
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    timerDisplay.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    coordinateDisplay.innerText = (`${Math.trunc(player.position.x)},${Math.trunc(player.position.z)}`);
}

function refreshDisplay() {
    let xpLoadingContainer = document.createElement('div');
    xpLoadingContainer.id = 'xpLoadingContainer';
    
    xpLoadingBar = document.createElement('div');
    xpLoadingBar.id = 'xpLoadingBar';
    xpLoadingContainer.appendChild(xpLoadingBar);

    const abilitiesContainer = createContainer([], { display: 'flex' });
    abilitiesContainer.appendChild(createButton(player, .3));
    player.abilities.filter(ability => ability.level > 0).forEach(ability => {
            const clonedAbility = { ...ability, isLocked: false }; 

            abilitiesContainer.appendChild(createButton(clonedAbility, 0.25));
        });

    addContainerUI(topUI,'top-container', [xpLoadingContainer,abilitiesContainer,timerDisplay]);
    addContainerUI(botUI,'bottom-container', [modeDisplay,coordinateDisplay]);
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
             if(cameraHeight <= 35)
            cameraHeight+=0.075;
        } else if((canMove) && (keys.w ||keys.a || keys.s || keys.d)) resumeGame();
        accumulatedTime -= fixedTimeStep;
    }
    world.update();
    composer.render();
}

animate();
