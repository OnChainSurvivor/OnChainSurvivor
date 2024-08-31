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

        if (objectPool.has(modelKey)) {
            const serializedModel = objectPool.get(modelKey);
            this.initEntity(new THREE.ObjectLoader().parse(serializedModel));
        } else {
            loader.load('Media/Models/Survivor.fbx', (object) => {
                this.modifyMaterials(object);
                const serializedObject = object.toJSON();
                objectPool.set(modelKey, serializedObject);
                this.initEntity(object);
            });
        }

        this.initAbilities(config.abilities);
    }

    modifyMaterials(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                child.material = world.material.clone();
            }
        });
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
            this.mesh.position.set(0, 0, 0); 
            this.mesh.rotation.set(0, 0, 0); 
            this.mesh.updateMatrixWorld(true);
            this.boundingBox.setFromObject(this.mesh);
        }
    }

    initAbilities(entityAbilities) {
        entityAbilities.forEach(entityAbility => {
                const abilityType = abilityTypes.find(type => type.title === entityAbility.type);
                    const newAbility = new Ability(this, { ...abilityType});
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
const xpsphereGeometry = new THREE.SphereGeometry(0.25, 16, 16);

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
},
{
    title: "Double Spend Prevention",
    description: "Creates a shield that absorbs multiple hits.",
    tooltip: "No double-spending here, buddy!",
    thumbnail: "A broken coin split in half.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Overclock",
    description: "Greatly increases attack power for a brief period.",
    tooltip: "Overclocked like a mining rig in a bull run!",
    thumbnail: "A CPU with a glowing overclock symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Mining Rig",
    description: "Deploys a stationary turret that automatically attacks enemies.",
    tooltip: "Mining while you sleep!",
    thumbnail: "A turret with mining gear.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Energy Surge",
    description: "Temporarily increases attack speed and movement speed.",
    tooltip: "Surging like the latest meme coin!",
    thumbnail: "A lightning bolt with gears.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "PoS Migration",
    description: "Increases the player's defense.",
    tooltip: "Migrated to PoS and feeling safe!",
    thumbnail: "A shield with 'PoS' written on it.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Governance Vote",
    description: "Grants a random beneficial effect based on player needs.",
    tooltip: "DAO voted, gains distributed!",
    thumbnail: "A voting card with a checkmark.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Protocol Upgrade",
    description: "Improves all abilities for a limited time.",
    tooltip: "Upgraded like ETH 2.0!",
    thumbnail: "A progress bar with a checkmark.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "DeFi Yield",
    description: "Periodically grants a boost in resources.",
    tooltip: "APY like a degen farm!",
    thumbnail: "A yield sign with coins.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Flash Loan Attack",
    description: "Deals a burst of damage to a single target.",
    tooltip: "One-shot wonder like a flash loan!",
    thumbnail: "A lightning bolt striking a target.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Frontrunning Bot",
    description: "Increases movement speed and prioritizes attacks.",
    tooltip: "Faster than your FOMO trades!",
    thumbnail: "A racing bot with a trail.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Exploit Finder",
    description: "Scans for enemy weaknesses and exploits them.",
    tooltip: "Finding bugs like a true degen!",
    thumbnail: "A magnifying glass over a bug.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Liquidation Event",
    description: "Causes a massive area-of-effect damage.",
    tooltip: "Liquidated harder than a leveraged trade gone wrong!",
    thumbnail: "A graph plummeting with red arrows.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Chain Reorg",
    description: "Rewinds time slightly to undo recent events.",
    tooltip: "Reorg'd like a 51% attack!",
    thumbnail: "A clock turning backward.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Staking Rewards",
    description: "Grants a boost to resources over time.",
    tooltip: "Compounding gains like a staking pro!",
    thumbnail: "A pile of tokens growing over time.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "DDoS Attack",
    description: "Stuns all enemies for a short duration.",
    tooltip: "Overloaded like a cheap DDoS script!",

    thumbnail: "A wave crashing into a server.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Oracle Manipulation",
    description: "Disrupts enemy abilities based on false data.",
    tooltip: "Manipulated just like those price feeds!",
    thumbnail: "A tampered-with scale.",
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
}, {
    title: "Whale Alert",
    description: "Marks the strongest enemy, increasing damage dealt to them",
    tooltip: "Spotted a whale in the arena!",
    thumbnail: "A whale icon with a radar.",
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
    thumbnail: "A smart contract document with chains.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
        // Implement the effect logic here
    }
},{
    title: "Liquidity Pool",
    description: "Creates a pool that heals allies and damages enemies.",
    tooltip: "Providing liquidity like a degen in a farm!",
    thumbnail: 'Media/Abilities/LIQUIDITYPOOL.png',
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
    title: "Whitepaper Shield",
    description: "Grants temporary immunity to damage.",
    tooltip: "Protected by the wisdom of Satoshi!",
    thumbnail: 'Media/Abilities/WHITEPAPERSHIELD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Transaction Fee Burn",
    description: "Reduces enemy resources by burning their assets.",
    tooltip: "Burned like gas fees in a bull run!",
    thumbnail: 'Media/Abilities/TRANSACTIONFEEBURN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Transaction Front-Runner",
    description: "Gains the initiative to act before enemies.",
    tooltip: "Faster than an MEV bot!",
    thumbnail: 'Media/Abilities/TRANSACTIONFRONTRUNNER.png',
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
    title: "Flash Crash",
    description: "Briefly stuns all enemies in the area.",
    tooltip: "Stunning like a sudden market crash!",
    thumbnail: 'Media/Abilities/FLASHCRASH.png',
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
    title: "Gas Fee Reduction",
    description: "Decreases resource cost for abilities.",
    tooltip: "Cheap like a bear market gas fee!",
    thumbnail: 'Media/Abilities/GASFEEREDUCTION.png',
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
    title: "Rug Pull",
    description: "Instantly removes buffs from enemies.",
    tooltip: "Rugged like a failed project!",
    thumbnail: 'Media/Abilities/RUGPULL.png',
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
    title: "Token Swap",
    description: "Exchanges debuffs for buffs with enemies.",
    tooltip: "Swapped like a dex trade!",
    thumbnail: 'Media/Abilities/TOKENSWAP.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Stablecoin Shield",
    description: "Reduces damage taken.",
    tooltip: "Stable like a top-tier stablecoin!",
    thumbnail: 'Media/Abilities/STABLECOINSHIELD.png',
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
    title: "Consensus Protocol",
    description: "Harmonizes allies, boosting their effectiveness.",
    tooltip: "Unified like a consensus protocol!",
    thumbnail: 'Media/Abilities/CONSENSUSPROTOCOL.png',
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
    title: "Crypto Whale",
    description: "Uses overwhelming power to crush enemies.",
    tooltip: "Whale-sized like a market mover!",
    thumbnail: 'Media/Abilities/CRYPTOWHALE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Airdrop",
    description: "Distributes resources to allies.",
    tooltip: "Airdropped like free tokens!",
    thumbnail: 'Media/Abilities/CRYPTOAIRDROP.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Bear",
    description: "Reduces enemies' attack power.",
    tooltip: "Bearish like a market downturn!",
    thumbnail: 'Media/Abilities/CRYPTOBEAR.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Bull",
    description: "Increases allies' attack power.",
    tooltip: "Bullish like a market rally!",
    thumbnail: 'Media/Abilities/CRYPTOBULL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Whale Dump",
    description: "Deals massive damage to a single enemy.",
    tooltip: "Dumping like a whale!",
    thumbnail: 'Media/Abilities/CRYPTOWHALEDUMP.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Rally",
    description: "Temporarily boosts all allies' speed.",
    tooltip: "Rallying like a bull market!",
    thumbnail: 'Media/Abilities/CRYPOTORALLY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Whitelist",
    description: "Grants immunity to debuffs.",
    tooltip: "Protected like a whitelist spot!",
    thumbnail: 'Media/Abilities/CRYPTOWHITELIST.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Lock",
    description: "Locks an enemy's abilities temporarily.",
    tooltip: "Locked like funds in a smart contract!",
    thumbnail: 'Media/Abilities/CRYPTOLOCK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Lending",
    description: "Lends resources to allies temporarily.",
    tooltip: "Lending like a DeFi protocol!",
    thumbnail: 'Media/Abilities/CRYPTOLOAN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Governance",
    description: "Empowers allies through decentralized decisions.",
    tooltip: "Governance like a DAO!",
    thumbnail: 'Media/Abilities/CRYPTOGOVERNANCE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Hodler",
    description: "Increases resources the longer they are held.",
    tooltip: "Hodling like a true believer!",
    thumbnail: 'Media/Abilities/CRYPTOHODLER.png',
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
    title: "Crypto Fee",
    description: "Charges a fee to enemies for using abilities.",
    tooltip: "Charging like a transaction fee!",
    thumbnail: 'Media/Abilities/CRYPTOFEE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Mining",
    description: "Generates resources over time.",
    tooltip: "Mining like a blockchain!",
    thumbnail: 'Media/Abilities/CRYPTOMINING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Escrow",
    description: "Holds resources in escrow, releasing them after a delay.",
    tooltip: "Escrow like a smart contract!",
    thumbnail: 'Media/Abilities/CRYPTOESCROW.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Bridge",
    description: "Transfers resources between allies.",
    tooltip: "Bridging like cross-chain assets!",
    thumbnail: 'Media/Abilities/CRYPTOBRIDGE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Custody",
    description: "Protects resources from being stolen.",
    tooltip: "Secure like a custody service!",
    thumbnail: 'Media/Abilities/CRYPTOCUSTODY.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Yield",
    description: "Generates yield from resources held.",
    tooltip: "Yielding like a DeFi protocol!",
    thumbnail: 'Media/Abilities/CRYPTOYIELD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Arbitrage",
    description: "Exploits price differences for gain.",
    tooltip: "Arbitraging like a pro!",
    thumbnail: 'Media/Abilities/CRYPTOARBITRAGE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Dapp",
    description: "Creates a decentralized application for resource generation.",
    tooltip: "Building like a dApp developer!",
    thumbnail: 'Media/Abilities/CRYPTODAPP.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Merkle Proof",
    description: "Verifies resources securely.  preventing theft",
    tooltip: "Proof like a Merkle tree!",
    thumbnail: 'Media/Abilities/CRYPTOMERKLEPROOF.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Wallet",
    description: "Stores resources securely.",
    tooltip: "Storing like a hardware wallet!",
    thumbnail: 'Media/Abilities/CRYPTOWALLET.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Oracle",
    description: "Provides accurate data for resource generation.",
    tooltip: "Oracling like Chainlink!",
    thumbnail: 'Media/Abilities/CRYPTOORACLE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Consensus",
    description: "Achieves consensus for increased power.",
    tooltip: "Consensing like a blockchain!",
    thumbnail: 'Media/Abilities/CRYPTOCONSENSUS.png',
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
    title: "NFT Enhancer",
    description: "Boosts the effects of your NFTs.",
    tooltip: "Enhancing like an NFT upgrade!",
    thumbnail: 'Media/Abilities/NFTENHANCER.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Smart Contract Shield",
    description: "Provides temporary protection from enemy attacks.",
    tooltip: "Shielding like a smart contract!",
    thumbnail: 'Media/Abilities/SMARTCONTRACTSHIELD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Portfolio",
    description: "Increases the efficiency of resource gathering.",
    tooltip: "Boosting like a diversified portfolio!",
    thumbnail: 'Media/Abilities/CRYPTOPORTFOLIO.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Decentralized Exchange",
    description: "Allows trading of resources between allies.",
    tooltip: "Trading like a decentralized exchange!",
    thumbnail: 'Media/Abilities/DECENTRALIZEDEXCHANGE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Blockchain Analytics",
    description: "Provides insights to increase strategy effectiveness.",
    tooltip: "Analyzing like a blockchain expert!",
    thumbnail: 'Media/Abilities/BLOCKCHAINANALYTICS.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Audit",
    description: "Reveals enemy weaknesses and exploits them.",
    tooltip: "Auditing like a pro!",
    thumbnail: 'Media/Abilities/CRYPTOAUDIT.png',
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
    title: "Crypto Validator",
    description: "Ensures the integrity of resource transactions.",
    tooltip: "Validating like a blockchain node!",
    thumbnail: 'Media/Abilities/CRYPTOVALIDATOR.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {} 
    },
},
{
    title: "Crypto Escalation",
    description: "Escalates the power of abilities temporarily.",
    tooltip: "Escalating like a market rally!",
    thumbnail: 'Media/Abilities/CRYPTOESCALATION.png',
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
    title: "Minefield",
    description: "Creates a zone that damages enemies over time.",
    tooltip: "Lay down the mines. Enemies beware.",
    thumbnail: 'Media/Abilities/MINEFIELD.png',

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
    title: "Mega Miner",
    description: "Unleashes a massive explosion, dealing heavy area damage.",
    tooltip: "Unleash the power of the Mega Miner. Massive destruction.",
    thumbnail: 'Media/Abilities/MEGAMINER.png',
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
    title: "Stake Fortress",
    description: "Creates an impenetrable fortress, providing massive defense.",
    tooltip: "Build your fortress and withstand any attack.",
    thumbnail: 'Media/Abilities/STAKEFORTRESS.png',
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
    title: "Security Lockdown",
    description: "Reduces damage taken for a short period.",
    tooltip: "Lock it down, secure the bag. Take less damage.",
    thumbnail: 'Media/Abilities/SECURITYLOCKDOWN.png',
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
},
{
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
    title: "Sidechains",
    description: "Allows the player to create decoys that distract enemies.",
    tooltip: "Sidechains for sidekicks! Distract your enemies.",
    thumbnail: 'Media/Abilities/SIDECHAINS.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Layer 2 Scaling",
    description: "Reduces the cost and cooldown of all abilities.",
    tooltip: "Scale up and save! Reduce costs and cooldowns.",
    thumbnail: 'Media/Abilities/LAYER2SCALING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Deploy Contract",
    description: "Sets up a turret that automatically attacks enemies.",
    tooltip: "Deploy the contract. Let the turret handle it.",
    thumbnail: 'Media/Abilities/DEPLOYCONTRACT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
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
    title: "FUD Shield",
    description: "Temporarily makes the player immune to all debuffs.",
    tooltip: "Block out the FUD. Stay strong and immune.",
    thumbnail: 'Media/Abilities/FUDSHIELD.png',
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
    title: "Proof of Stake",
    description: "Increases health regeneration.",
    tooltip: "Stake your claim. Regenerate health faster.",
    thumbnail: 'Media/Abilities/PROOFOFSTAKE.png',
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
    title: "Yield Farming",
    description: "Increases resource gain.",
    tooltip: "Farm those yields. Reap the rewards.",
    thumbnail: 'Media/Abilities/YIELDFARMING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Flash Loan",
    description: "Instantly grants a large amount of resources.",
    tooltip: "Get instant liquidity. Just don't get rekt.",
    thumbnail: 'Media/Abilities/FLASHLOAN.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidity Pool",
    description: "Creates a pool that buffs allies' attack speed.",
    tooltip: "Add liquidity, boost the pool. Attack faster.",
    thumbnail: 'Media/Abilities/LIQUIDITYPOOL.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Impermanent Loss Shield",
    description: "Reduces damage taken from all sources.",
    tooltip: "Shield against impermanent loss. Take less damage.",
    thumbnail: 'Media/Abilities/IMPERMANENTLOSsshield.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Airdrop",
    description: "Grants random buffs to all allies.",
    tooltip: "Receive the airdrop. Enjoy the random goodies.",
    thumbnail: 'Media/Abilities/AIRDROP.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Initial DEX Offering",
    description: "Increases allies' attack power.",
    tooltip: "Launch on the DEX. Pump up those attacks.",
    thumbnail: 'Media/Abilities/INITIALDEXOFFERING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Staking Rewards",
    description: "Provides periodic healing to all allies.",
    tooltip: "Stake and earn. Heal over time.",
    thumbnail: 'Media/Abilities/STAKINGREWARDS.png',
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
    title: "Governance Vote",
    description: "Grants temporary invulnerability to all allies.",
    tooltip: "Vote and secure. Gain temporary invulnerability.",
    thumbnail: 'Media/Abilities/GOVERNANCEVOTE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Treasury Allocation",
    description: "Provides a large amount of resources to all allies.",
    tooltip: "Allocate the treasury. Distribute the wealth.",
    thumbnail: 'Media/Abilities/TREASURYALLOCATION.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Decentralized Finance",
    description: "Increases the effectiveness of all resource-gathering abilities.",
    tooltip: "Go DeFi. Boost your resource gains.",
    thumbnail: 'Media/Abilities/DECENTRALIZEDFINANCE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "NFT Marketplace",
    description: "Increases the drop rate of rare items.",
    tooltip: "Trade NFTs. Find rare items more often.",
    thumbnail: 'Media/Abilities/NFTMARKETPLACE.png',
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
    title: "Orderbook",
    description: "Provides a large amount of resources based on order book data.",
    tooltip: "Consult the order book. Gain a wealth of resources.",
    thumbnail: 'Media/Abilities/ORDERBOOK.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "See HP Bars",
    description: "Displays HP bars for all entities in the game.",
    tooltip: "Reveal the HP. Monitor health bars of all entities.",
    thumbnail: 'Media/Abilities/SEEHPBARS.png',
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
    title: "HODL",
    description: "Increases the player's defense.",
    tooltip: "HODL strong. Boost your defense.",
    thumbnail: "A fist gripping a glowing token.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Pump and Dump",
    description: "Increases attack power significantly for a short duration, followed by a debuff.",
    tooltip: "Pump it up, then brace for the dump.",
    thumbnail: "A graph with a sharp rise and fall.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale Power",
    description: "Increases all stats for a short duration.",
    tooltip: "Unleash the whale power. Dominate the field.",
    thumbnail: "A whale swimming through a sea of tokens.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Adaptive Trading ⚔️",
    description: "Adapts to the situation, dealing damage based on the player's needs.",
    tooltip: "Adapt and overcome. Your strikes change to fit the need.",
    thumbnail: 'Media/Abilities/ADAPTIVETRADING.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Resilient Spirit 💪",
    description: "Provides a temporary boost to defense and health regeneration.",
    tooltip: "Unyielding spirit. Boost your defense and health regen.",
    thumbnail: 'Media/Abilities/RESILIENTSPIRIT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Survivor's Instinct 🧠",
    description: "Enhances movement speed and reduces skill cooldowns in critical moments.",
    tooltip: "Instincts kick in. Move faster and reduce cooldowns when it matters most.",
    thumbnail: 'Media/Abilities/SURVIVORSINSTINCT.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Survivor's Resolve 🔥",
    description: "Temporarily makes the player invincible and greatly increases attack power.",
    tooltip: "Unbreakable resolve. Become invincible and unleash your power.",
    thumbnail: 'Media/Abilities/ULTIMATESURVIVORSRESOLVE.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Hash Power ⚡",
    description: "Temporarily increases attack power.",
    tooltip: "Harness the power of the hash. Strike with more force.",
    thumbnail: 'Media/Abilities/HASHPOWER.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Minefield 💥",
    description: "Creates a zone that damages enemies over time.",
    tooltip: "Lay down the mines. Enemies beware.",
    thumbnail: 'Media/Abilities/MINEFIELD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Block Reward 💎",
    description: "Heals the player for a portion of damage dealt.",
    tooltip: "Reward yourself with health for your efforts.",
    thumbnail: 'Media/Abilities/BLOCKREWARD.png',
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Mega Miner 🚀",
    description: "Unleashes a massive explosion, dealing heavy area damage.",
    tooltip: "Unleash the power of the Mega Miner. Massive destruction.",
    thumbnail: "A mining rig with an explosion.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Stake Defense 🛡️",
    description: "Increases defense for a short period.",
    tooltip: "Strengthen your defenses with stakes.",
    thumbnail: "A shield with stakes.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Interest Yield 💲",
    description: "Gradually regenerates health over time.",
    tooltip: "Reap the benefits of your interest. Regenerate health.",
    thumbnail: "A growing plant.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Validator Support 🤖",
    description: "Summons a temporary ally to aid in battle.",
    tooltip: "Call in support from a trusted validator.",
    thumbnail: "A robot helper.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Stake Fortress 🏰",
    description: "Creates an impenetrable fortress, providing massive defense and healing.",
    tooltip: "Become an unbreakable fortress. Ultimate defense and healing.",
    thumbnail: "A fortified castle.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Manipulation 📈",
    description: "Temporarily increases critical hit chance.",
    tooltip: "Manipulate the market. Strike with precision.",
    thumbnail: "A graph with a rising arrow.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Flash Crash ⚡",
    description: "A quick dash attack that damages all enemies in the path.",
    tooltip: "Crash through your enemies with lightning speed.",
    thumbnail: "A lightning bolt.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Pump and Dump 📉",
    description: "Deals heavy damage to a single enemy, then weakens the player for a short time.",
    tooltip: "Deal massive damage but face the consequences.",
    thumbnail: "A pump and dump graph.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Trading Frenzy 🚀",
    description: "Increases speed and critical hit chance drastically for a short time.",
    tooltip: "Enter a trading frenzy. Maximum speed and precision.",
    thumbnail: "A trader in frenzy.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Locked In 🧠💹",
    description: "Maximize your profits and outpace the competition with unparalleled focus and strategic insight.",
    tooltip: "Locked in and loaded! Maximize your profits and outpace the competition with unparalleled focus.",
    thumbnail: "A pair of focused eyes with dollar signs in the pupils, surrounded by a glowing aura.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bug Fix 🔧",
    description: "Fixes bugs in the code, restoring a small amount of health.",
    tooltip: "Fix the bugs. Restore your health.",
    thumbnail: "A wrench fixing code.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Code Refactor 🖥️",
    description: "Rewrites the player's abilities, reducing their cooldowns.",
    tooltip: "Refactor your code. Reduce cooldowns.",
    thumbnail: "A refactored code.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Deploy Patch 🛠️",
    description: "Creates a temporary area that boosts allies' defenses.",
    tooltip: "Deploy a patch. Boost allies' defenses.",
    thumbnail: "A patch being deployed.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Overhaul ⚙️",
    description: "Completely overhauls the player's abilities, providing massive buffs and resetting cooldowns.",
    tooltip: "Overhaul your abilities. Massive buffs and cooldown reset.",
    thumbnail: "A complete overhaul.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Compliance Check 📋",
    description: "Forces enemies to slow down and take damage over time.",
    tooltip: "Ensure compliance. Slow down enemies and deal damage.",
    thumbnail: "A compliance checklist.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Audit 🔍",
    description: "Reveals all hidden enemies and disables their abilities temporarily.",
    tooltip: "Conduct an audit. Reveal and disable enemies.",
    thumbnail: "A magnifying glass.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sanction 🛑",
    description: "Targets a single enemy, greatly reducing its speed and defense.",
    tooltip: "Impose sanctions. Weaken a single enemy.",
    thumbnail: "A stop sign.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Total Control 🕹️",
    description: "Temporarily controls all enemies, making them fight each other.",
    tooltip: "Take total control. Enemies turn on each other.",
    thumbnail: "A controller.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Quantum Encryption 🛡️",
    description: "Creates a shield that reduces incoming damage.",
    tooltip: "Encrypt your defenses. Reduce damage taken.",
    thumbnail: "A quantum shield.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Entanglement 🕸️",
    description: "Links enemies, causing damage to spread among them.",
    tooltip: "Entangle your enemies. Damage spreads.",
    thumbnail: "Entangled particles.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Quantum Key Exchange 🔑",
    description: "Transfers health from enemies to the player.",
    tooltip: "Exchange health. Transfer from enemies to you.",
    thumbnail: "A key exchange.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Quantum Overload ⚡",
    description: "Overloads the quantum field, dealing massive area damage and stunning enemies.",
    tooltip: "Overload the field. Massive damage and stun.",
    thumbnail: "A quantum explosion.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bot Swarm 🐝",
    description: "Summons additional bots to assist in battle.",
    tooltip: "Summon a bot swarm. Increase your firepower.",
    thumbnail: "A swarm of bots.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bot Shield 🛡️",
    description: "Creates a defensive barrier with the bots.",
    tooltip: "Form a bot shield. Increase your defense.",
    thumbnail: "Bots forming a shield.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bot Attack 🔫",
    description: "Directs all bots to focus fire on a single enemy.",
    tooltip: "Focus fire. Direct all bots to attack a target.",
    thumbnail: "Bots attacking.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Anti-Rug Bot 🚫🧩",
    description: "Detects and disables rug traps.",
    tooltip: "No more rug-pulls for you. Detect and disable rug traps.",
    thumbnail: "A crossed-out rug.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sniping Bot 🎯",
    description: "Enhances critical hit chances and accuracy.",
    tooltip: "Get the perfect shot. Increase critical hit chances and accuracy.",
    thumbnail: "A sniper rifle with a target.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "MEV Bot 📉",
    description: "Drains resources from enemy HP pools for personal gain.",
    tooltip: "Drain enemy resources. Extract value from their HP pools.",
    thumbnail: "A downward arrow with a dollar sign.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Bot Armada 🚀",
    description: "Summons an entire armada of bots for massive support and damage.",
    tooltip: "Call in the bot armada. Maximum support and damage.",
    thumbnail: "A fleet of bots.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Scam Alert 🚨",
    description: "Temporarily decreases enemies' attack power and movement speed.",
    tooltip: "Sound the scam alert. Weaken your enemies.",
    thumbnail: "A warning sign.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bear Market 🐻",
    description: "Summons a wave of bearish sentiment that damages all enemies.",
    tooltip: "Invoke the bear market. Damage your enemies.",
    thumbnail: "A bear wave.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Fear Spread 😱",
    description: "Spreads fear, causing enemies to flee in random directions.",
    tooltip: "Spread fear. Enemies flee.",
    thumbnail: "A face in terror.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Billions Must Capitulate 💸",
    description: "Spreads widespread fear and panic, causing enemies to lose resources and morale.",
    tooltip: "Instill capitulation. Cause widespread fear and resource loss.",
    thumbnail: "A collapsing currency symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "It's Over 🪦",
    description: "Convinces enemies that defeat is inevitable, reducing their effectiveness and causing them to falter.",
    tooltip: "Declare the end. Reduce enemy effectiveness and cause them to falter.",
    thumbnail: "A gravestone with a downward arrow.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Apocalypse Now 💀",
    description: "Unleashes a massive wave of FUD, causing heavy damage and stunning all enemies.",
    tooltip: "The end is near. Massive damage and stun.",
    thumbnail: "A skull with a storm.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Lunar Cycle 🌒",
    description: "Provides buffs or debuffs based on the current moon phase.",
    tooltip: "Harness the power of the moon. Buffs and debuffs change with each phase.",
    thumbnail: "A moon with phases.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Star Alignment ✨",
    description: "Increases critical hit chance and attack power when stars align.",
    tooltip: "The stars have aligned! Your attacks become more powerful.",
    thumbnail: "A constellation.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Zodiac Prediction ♒",
    description: "Predicts and reveals enemies' weaknesses, reducing their defenses.",
    tooltip: "The zodiac reveals all. Know your enemies' weaknesses.",
    thumbnail: "Zodiac symbols.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Celestial Fury 🌠",
    description: "Unleashes the power of the cosmos, dealing massive area damage and providing buffs to allies.",
    tooltip: "Harness celestial fury. Massive damage and buffs.",
    thumbnail: "A meteor shower.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Shill 🚀",
    description: "Temporarily increases allies' attack power and speed.",
    tooltip: "Shill your way to victory. Boost ally attack power and speed.",
    thumbnail: "A rocket emoji.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "FOMO Wave 🌊",
    description: "Induces fear of missing out, causing enemies to rush towards the player.",
    tooltip: "Create a wave of FOMO. Draw enemies towards you.",
    thumbnail: "A wave symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Hype Train 🚂",
    description: "Summons a stampede of followers that trample enemies.",
    tooltip: "Summon the hype train. Trample your enemies.",
    thumbnail: "A train emoji.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Mover 📈",
    description: "Enhances allies' abilities and influences the battlefield.",
    tooltip: "Move the market. Enhance ally abilities.",
    thumbnail: "A rising graph.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Trend Setter 💫",
    description: "Buffs allies and debuffs enemies based on market trends.",
    tooltip: "Set the trend. Buff allies and debuff enemies.",
    thumbnail: "A star with upward arrows.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Viral Sensation 🌐",
    description: "Goes viral, drastically increasing the effectiveness of all abilities and summoning followers to fight alongside.",
    tooltip: "Become a viral sensation. Amplify abilities and summon followers.",
    thumbnail: "A viral symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Inside Info 📉📈",
    description: "Reveals hidden enemies and weak points.",
    tooltip: "Gain inside information. Reveal hidden enemies and weak points.",
    thumbnail: "An eye with a market graph.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Manipulation 🧠",
    description: "Temporarily controls enemy movements.",
    tooltip: "Manipulate the market. Control enemy movements.",
    thumbnail: "A brain with puppet strings.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Pump and Dump 💣",
    description: "Deals heavy damage to a single target and redistributes health to allies.",
    tooltip: "Pump and dump. Deal heavy damage and heal allies.",
    thumbnail: "A bomb with a dollar sign.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale 🐋",
    description: "Focuses on high-impact, single-target attacks.",
    tooltip: "Be the whale. Deliver high-impact attacks.",
    thumbnail: "A whale.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Puppeteer 🎭",
    description: "Controls and manipulates multiple enemies.",
    tooltip: "Puppet master. Control and manipulate enemies.",
    thumbnail: "A puppet on strings.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Black Swan Event 🦢",
    description: "Creates a chaotic event that massively disrupts enemy abilities and resources while providing significant buffs to allies.",
    tooltip: "Trigger a black swan event. Cause chaos and gain massive advantages.",
    thumbnail: "A black swan.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Quick Flip 🤑",
    description: "Deals instant damage to nearby enemies.",
    tooltip: "Quick flip. Deal instant damage.",
    thumbnail: "A dollar sign and a lightning bolt.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sell-Off 🔥",
    description: "Creates an area where enemies take increased damage over time.",
    tooltip: "Sell-off. Increase damage over time in an area.",
    thumbnail: "A downward graph on fire.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Exit Scam 🏃‍♂️",
    description: "Teleports to a safe location and leaves a damaging decoy behind.",
    tooltip: "Execute an exit scam. Teleport and leave a damaging decoy.",
    thumbnail: "A running man with a disappearing trail.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Flash Trader ⚡",
    description: "Specializes in quick, high-damage attacks.",
    tooltip: "Flash trader. Quick, high-damage attacks.",
    thumbnail: "A lightning bolt and a dollar sign.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Profit Taker 💸",
    description: "Buffs self and allies after defeating enemies.",
    tooltip: "Take profits. Buff self and allies after defeating enemies.",
    thumbnail: "A bag of money.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Rug Pull 💥",
    description: "Performs a devastating attack that deals massive damage to all enemies and stuns them.",
    tooltip: "Execute a rug pull. Massive damage and stun all enemies.",
    thumbnail: "A rug being pulled.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Diamond Hands ✋💎",
    description: "Reduces damage taken significantly for a short period.",
    tooltip: "Hold with diamond hands. Reduce damage taken.",
    thumbnail: "A diamond and a hand.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "HODL Line 🛡️",
    description: "Creates a barrier that absorbs damage.",
    tooltip: "HODL the line. Create a damage-absorbing barrier.",
    thumbnail: "A shield with 'HODL'.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Maxi Rally 🏋️",
    description: "Temporarily boosts all allies' attack and defense.",
    tooltip: "Maxi rally. Boost ally attack and defense.",
    thumbnail: "A rallying flag.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Perma-Bull 🐂",
    description: "Buffs allies' attack and movement speed.",
    tooltip: "Perma-bull. Increase ally attack and movement speed.",
    thumbnail: "A bullish arrow.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Coin Zealot 🔥",
    description: "Enhances defense and health regeneration.",
    tooltip: "Zealot's fervor. Enhance defense and health regeneration.",
    thumbnail: "A flaming coin.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Maxi Ascendancy 🌟",
    description: "Ascends to a state of maximum power, drastically increasing all stats and providing powerful buffs to allies for a short period.",
    tooltip: "Achieve maxi ascendancy. Drastically boost stats and buff allies.",
    thumbnail: "A shining star.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "All In 🃏",
    description: "Deals massive damage to a single target but leaves the player vulnerable.",
    tooltip: "Go all in. Deal massive damage but become vulnerable.",
    thumbnail: "Poker chips and cards.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Lucky Streak 🍀",
    description: "Temporarily increases critical hit chance and dodge rate.",
    tooltip: "Ride a lucky streak. Increase critical hit chance and dodge rate.",
    thumbnail: "A four-leaf clover.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Double or Nothing 🎰",
    description: "Randomly buffs or debuffs the player.",
    tooltip: "Double or nothing. Randomly buff or debuff yourself.",
    thumbnail: "A slot machine.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Risk Taker ⚖️",
    description: "High-risk, high-reward abilities.",
    tooltip: "Take a risk. High-risk, high-reward abilities.",
    thumbnail: "A balance scale.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Luck Manipulator 🔮",
    description: "Controls odds and outcomes for strategic advantage.",
    tooltip: "Manipulate luck. Control odds and outcomes.",
    thumbnail: "A crystal ball.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Jackpot 💰",
    description: "Hits the jackpot, dealing massive damage to all enemies and providing significant buffs to allies.",
    tooltip: "Hit the jackpot. Massive damage and significant buffs.",
    thumbnail: "A jackpot slot machine.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Margin Call 📉",
    description: "Forces enemies to take damage over time.",
    tooltip: "Issue a margin call. Inflict damage over time.",
    thumbnail: "A falling chart with a phone.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidation Wave 🌊",
    description: "Deals area-of-effect damage and reduces enemy defenses.",
    tooltip: "Create a liquidation wave. Deal AoE damage and reduce enemy defenses.",
    thumbnail: "A crashing wave.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Crash 💥",
    description: "Creates a zone where enemies take increased damage and have reduced speed.",
    tooltip: "Crash the protocol. Increase damage and slow enemies.",
    thumbnail: "A broken protocol symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Debt Collector 🗡️",
    description: "Focuses on sustained damage and debuffs.",
    tooltip: "Be the debt collector. Sustain damage and apply debuffs.",
    thumbnail: "A hand holding a collection notice.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Enforcer 🛡️",
    description: "Controls and disrupts enemy formations.",
    tooltip: "Enforce market rules. Disrupt enemy formations.",
    thumbnail: "A gavel.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Financial Collapse 💣",
    description: "Triggers a massive financial collapse, dealing devastating damage to all enemies and significantly debuffing them.",
    tooltip: "Cause a financial collapse. Devastate and debuff all enemies.",
    thumbnail: "An explosion over a market chart.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Skeptic's Shield 🛡️",
    description: "Reduces incoming damage and reflects a portion back to attackers.",
    tooltip: "Skeptic's shield. Reduce damage and reflect a portion.",
    thumbnail: "A shield with a question mark.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Debate 🗣️",
    description: "Temporarily silences and weakens enemies.",
    tooltip: "Engage in debate. Silence and weaken enemies.",
    thumbnail: "Two speech bubbles.",    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "No Coin FUD ❗",
    description: "Decreases enemy attack power and movement speed.",
    tooltip: "Spread FUD. Decrease enemy attack power and speed.",
    thumbnail: "A warning sign.",    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Critic 📉",
    description: "Enhances debuffs and controls enemy behavior.",
    tooltip: "Critique crypto. Enhance debuffs and control enemies.",
    thumbnail: "A downward arrow.",    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Skeptical Scholar 📚",
    description: "Buffs allies' defense and reduces enemy effectiveness.",
    tooltip: "Skeptical scholar. Buff allies' defense and reduce enemy effectiveness.",
    thumbnail: "A book and shield.",    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Market Crash 📉",
    description: "Causes a market crash, drastically weakening all enemies and providing significant buffs to allies.",
    tooltip: "Induce a market crash. Weaken enemies and buff allies.",
    thumbnail: "A crashing market chart.",    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Code Review 📝",
    description: "Temporarily reveals enemy weaknesses and increases damage dealt.",
    tooltip: "Review code. Reveal weaknesses and increase damage.",
    thumbnail: "A checklist.",    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bug Fix 🔧",
    description: "Removes debuffs from allies and restores health.",
    tooltip: "Fix bugs. Remove debuffs and restore health.",
    thumbnail: "A wrench and a bug.",    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Security Audit 🔒",
    description: "Creates a zone where enemies are significantly weakened.",
    tooltip: "Conduct a security audit. Weaken enemies in a zone.",
    thumbnail: "A lock and a magnifying glass.",    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Code Enforcer 🛡️",
    description: "Specializes in revealing and exploiting enemy weaknesses.",
    tooltip: "Enforce code standards. Reveal and exploit weaknesses.",
    thumbnail: "A gavel and code.",    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bug Hunter 🐞",
    description: "Focuses on debuff removal and ally support.",
    tooltip: "Hunt bugs. Remove debuffs and support allies.",
    thumbnail: "A net catching a bug.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Critical Patch 🚀",
    description: "Deploys a critical patch, significantly buffing all allies and debuffing all enemies.",
    tooltip: "Deploy a critical patch. Buff allies and debuff enemies.",
    thumbnail: "A rocket and code.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Chain Analysis 🔗",
    description: "Reveals hidden enemies and tracks their movements.",
    tooltip: "Analyze the chain. Reveal and track enemies.",
    thumbnail: "A chain and an eye.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Transaction Trace 📈",
    description: "Temporarily reduces enemy speed and reveals weak points.",
    tooltip: "Trace transactions. Reduce speed and reveal weak points.",
    thumbnail: "A chart and a footprint.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Criminal Hunt 🔍",
    description: "Deals extra damage to recently revealed enemies.",
    tooltip: "Hunt criminals. Deal extra damage to revealed enemies.",
    thumbnail: "A target symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "On-Chain Detective 🔦",
    description: "Enhances enemy tracking and debuffs.",
    tooltip: "Be the on-chain detective. Enhance tracking and debuffs.",
    thumbnail: "A flashlight and chain.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crypto Investigator 📜",
    description: "Buffs self and allies based on revealed enemy locations.",
    tooltip: "Investigate crypto. Buff self and allies based on enemy locations.",
    thumbnail: "A magnifying glass and map.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Chain Reaction 💥",
    description: "Causes a chain reaction, revealing all enemies and drastically debuffing them while significantly buffing allies.",
    tooltip: "Trigger a chain reaction. Reveal, debuff enemies, and buff allies.",
    thumbnail: "Exploding chain links.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Bug Report 📝",
    description: "Reveals enemy weaknesses and reduces their defenses.",
    tooltip: "Report bugs. Reveal weaknesses and reduce defenses.",
    thumbnail: "A bug report form.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Feature Test ⚙️",
    description: "Temporarily boosts allies' abilities.",
    tooltip: "Test features. Temporarily boost ally abilities.",
    thumbnail: "A gear and a check mark.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Stress Test 🏋️",
    description: "Creates a zone where enemies take increased damage and have reduced speed.",
    tooltip: "Conduct a stress test. Increase enemy damage and reduce speed.",
    thumbnail: "A weight and a clock.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Test Engineer 🔧",
    description: "Specializes in revealing and exploiting enemy weaknesses.",
    tooltip: "Be a test engineer. Reveal and exploit weaknesses.",
    thumbnail: "A wrench and gear.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "QA Specialist 🛡️",
    description: "Enhances ally buffs and reduces enemy effectiveness.",
    tooltip: "Quality assurance. Enhance buffs and reduce enemy effectiveness.",
    thumbnail: "A shield and check mark.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Final Release 🚀",
    description: "Launches the final release, significantly buffing all allies and debuffing all enemies.",
    tooltip: "Release the final version. Buff allies and debuff enemies.",
    thumbnail: "A rocket launching.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Exploit 🔨",
    description: "Deals significant damage to a single target and restores health.",
    tooltip: "Exploit vulnerabilities. Deal damage and restore health.",
    thumbnail: "A broken lock and a hammer.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Drain Liquidity 💧",
    description: "Reduces enemy defenses and steals resources.",
    tooltip: "Drain liquidity. Reduce defenses and steal resources.",
    thumbnail: "A draining faucet.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Flash Loan Attack ⚡",
    description: "Temporarily boosts attack power and speed.",
    tooltip: "Execute a flash loan attack. Boost attack power and speed.",
    thumbnail: "A lightning bolt.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Raider 🏴",
    description: "Focuses on high-damage, single-target attacks.",
    tooltip: "Raid protocols. High-damage, single-target attacks.",
    thumbnail: "A pirate flag.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidity Vampire 🧛",
    description: "Steals resources and buffs self and allies.",
    tooltip: "Be a liquidity vampire. Steal resources and buff allies.",
    thumbnail: "A vampire and a dollar sign.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Congestion ❄️",
    description: "Slows all enemies for a short duration.",
    tooltip: "Freeze the network! Slow down all activity.",
    thumbnail: "A clock with ice crystals.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Protocol Drain 🌀",
    description: "Drains multiple protocols simultaneously, dealing massive damage to all enemies and providing significant resources to allies.",
    tooltip: "Drain multiple protocols. Massive damage and resource gain.",
    thumbnail: "A swirling vortex.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sybil Attack 🎭",
    description: "Creates decoys that distract and damage enemies.",
    tooltip: "Execute a Sybil attack. Distract and damage enemies.",
    thumbnail: "Multiple masks.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Vote Manipulation 🗳️",
    description: "Temporarily controls enemy movements.",
    tooltip: "Manipulate votes. Control enemy movements.",
    thumbnail: "A ballot box with strings.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Airdrop Fraud ✈️",
    description: "Steals resources from enemies and redistributes them to allies.",
    tooltip: "Commit airdrop fraud. Steal resources and redistribute.",
    thumbnail: "An airplane dropping coins.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Identity Forger 🛠️",
    description: "Specializes in creating decoys and controlling enemies.",
    tooltip: "Forge identities. Create decoys and control enemies.",
    thumbnail: "A forging hammer.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Total Takeover 🌐",
    description: "Completely takes over the battlefield, drastically buffing allies and debuffing enemies.",
    tooltip: "Execute a total takeover. Drastically buff allies and debuff enemies.",
    thumbnail: "A world with chains.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Confirm Block 🧱",
    description: "Temporarily increases defense and regenerates health.",
    tooltip: "Confirm a block. Increase defense and regenerate health.",
    thumbnail: "A confirmed block symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Finality ⏳",
    description: "Grants temporary invincibility to all nearby players.",
    tooltip: "Achieve finality. Grant temporary invincibility.",
    thumbnail: "An hourglass.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Double Spend Prevention 🛡️",
    description: "Creates a shield that absorbs multiple hits.",
    tooltip: "Prevent double spend. Create a shield.",
    thumbnail: "A shield with a double spend symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Veil of Decentralization 🕸️",
    description: "Provides a shield that absorbs damage.",
    tooltip: "A veil of protection. Stay safe out there.",
    thumbnail: "A veil covering the player.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Network Consensus 🌐",
    description: "Achieves network consensus, significantly boosting allies' defense and providing damage immunity for a short period.",
    tooltip: "Achieve network consensus. Boost defense and provide damage immunity.",
    thumbnail: "A globe with connected nodes.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Overclock 🔥",
    description: "Greatly increases attack power for a brief period.",
    tooltip: "Overclock your rig. Greatly increase attack power.",
    thumbnail: "An overheating GPU.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Mining Rig 🏗️",
    description: "Deploys a stationary turret that automatically attacks enemies.",
    tooltip: "Deploy a mining rig. Automatically attack enemies.",
    thumbnail: "A mining rig.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Energy Surge ⚡",
    description: "Temporarily increases attack speed and movement speed.",
    tooltip: "Unleash an energy surge. Increase attack speed and movement speed.",
    thumbnail: "A lightning bolt.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "PoS Migration 🛡️",
    description: "Increases the player's defense.",
    tooltip: "Proof of Safety! Stronger defenses.",
    thumbnail: "A shield with 'PoS' written on it.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Mining Frenzy ⛏️",
    description: "Triggers a mining frenzy, drastically increasing attack power and speed for a short period.",
    tooltip: "Enter a mining frenzy. Drastically increase attack power and speed.",
    thumbnail: "A pickaxe and a lightning bolt.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Governance Vote 🗳️",
    description: "Grants a random beneficial effect based on player needs.",
    tooltip: "Cast a governance vote. Grant a random beneficial effect.",
    thumbnail: "A ballot box.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Upgrade 🆙",
    description: "Permanently enhances one of the player's abilities.",
    tooltip: "Execute a protocol upgrade. Permanently enhance an ability.",
    thumbnail: "An upgrade symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Stability Mechanism ⚖️",
    description: "Reduces damage taken for a prolonged period.",
    tooltip: "Activate a stability mechanism. Reduce damage taken.",
    thumbnail: "A scale.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "PoW Migration 🔨",
    description: "Increases the player's attack power.",
    tooltip: "Proof of Whacking! Stronger attacks.",
    thumbnail: "A hammer with 'PoW' on it.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Protocol Governance 🏛️",
    description: "Implements a major governance change, significantly buffing allies and debuffing enemies.",
    tooltip: "Implement protocol governance. Buff allies and debuff enemies.",
    thumbnail: "A government building.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Harvest Yield 🌽",
    description: "Increases resource drops from defeated enemies.",
    tooltip: "Harvest yield. Increase resource drops.",
    thumbnail: "A harvest basket.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Compound Interest 💹",
    description: "Gradually increases attack power and defense over time.",
    tooltip: "Compound interest. Gradually increase attack power and defense.",
    thumbnail: "An interest chart.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Crop Rotation 🌱",
    description: "Switches between different buffs to suit the player's needs.",
    tooltip: "Rotate crops. Switch between buffs.",
    thumbnail: "Rotating crops.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Bountiful Harvest 🌾",
    description: "Triggers a bountiful harvest, drastically increasing resource drops and providing significant buffs to all allies.",
    tooltip: "Trigger a bountiful harvest. Increase resources and buff allies.",
    thumbnail: "A golden field.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Price Divergence 🔀",
    description: "Confuses enemies, causing them to attack each other.",
    tooltip: "Create price divergence. Confuse enemies to attack each other.",
    thumbnail: "Diverging arrows.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Quick Trade 🏃",
    description: "Rapidly dashes through enemies, dealing damage.",
    tooltip: "Execute a quick trade. Dash through enemies and deal damage.",
    thumbnail: "A running figure.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Swing 📊",
    description: "Temporarily increases critical hit chance and attack speed.",
    tooltip: "Ride the market swing. Increase critical hit chance and attack speed.",
    thumbnail: "A swinging market chart.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Perfect Arbitrage 💰",
    description: "Executes a perfect arbitrage, drastically increasing attack power and critical hit chance for a short period.",
    tooltip: "Execute perfect arbitrage. Increase attack power and critical hit chance.",
    thumbnail: "Golden coins.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Flash Trade ⚡",
    description: "Instantaneously moves to a targeted location, dealing damage.",
    tooltip: "Execute a flash trade. Instantly move and deal damage.",
    thumbnail: "A lightning bolt.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Order Book 📈",
    description: "Creates decoys to confuse enemies.",
    tooltip: "Create an order book. Confuse enemies with decoys.",
    thumbnail: "A financial order book.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Execution Speed 🚀",
    description: "Increases attack speed and movement speed.",
    tooltip: "Boost execution speed. Increase attack and movement speed.",
    thumbnail: "A rocket.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Trade Frenzy 📉",
    description: "Enters a trade frenzy, drastically increasing attack speed and damage for a short period.",
    tooltip: "Enter a trade frenzy. Drastically increase attack speed and damage.",
    thumbnail: "A frenzied market chart.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Mint Masterpiece 🎨",
    description: "Creates a stunning piece of digital art that distracts enemies and boosts allies' morale.",
    tooltip: "A true masterpiece! Watch as enemies are mesmerized and allies are inspired.",
    thumbnail: "A paintbrush and palette.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Token Airdrop 🎁",
    description: "Airdrops valuable tokens to allies, providing temporary buffs and resources.",
    tooltip: "Free tokens for everyone! Enjoy the perks of being an NFT creator.",
    thumbnail: "A gift box with tokens.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Smart Contract Art 🖼️",
    description: "Deploys a smart contract-based artwork that creates a protective barrier.",
    tooltip: "Art meets security. This smart contract art keeps you safe and sound.",
    thumbnail: "A framed artwork.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Collector's Frenzy 🛍️",
    description: "Calls upon devoted collectors to swarm enemies, dealing massive damage.",
    tooltip: "Collectors are on the hunt! Unleash their frenzy on your foes.",
    thumbnail: "A swarm of collectors.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Art Revolution 🌟",
    description: "Unleashes an art revolution, drastically buffing allies and dealing massive damage to all enemies.",
    tooltip: "Lead an art revolution. Drastically buff allies and damage enemies.",
    thumbnail: "A radiant artwork.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Scalability Boost 📈",
    description: "Increases attack speed and movement speed.",
    tooltip: "Boost scalability. Enhance attack and movement speed.",
    thumbnail: "A speedometer.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Security Lockdown 🔒",
    description: "Reduces damage taken for a short period.",
    tooltip: "Activate security lockdown. Reduce damage taken.",
    thumbnail: "A locked shield.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Decentralized Network 🌐",
    description: "Summons allies to assist in battle.",
    tooltip: "The power of many. Amplify your abilities.",
    thumbnail: "A network diagram with a ripple effect.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Network Effect 🌟",
    description: "Increases the effectiveness of all abilities.",
    tooltip: "The network effect amplifies all abilities.",
    thumbnail: "A glowing network node.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Multilayer Design 🛡️",
    description: "Adds an additional layer of defense.",
    tooltip: "When one layer just isn't enough.",
    thumbnail: "Stacked shields.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Monolithic Design 🏛️",
    description: "Provides a significant health boost.",
    tooltip: "Strong, sturdy, and monolithic – just like your health.",
    thumbnail: "A large, imposing monolith.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sidechains 🔗",
    description: "Allows the player to create decoys that distract enemies.",
    tooltip: "Sidechains for sidekicks! Distract your enemies.",
    thumbnail: "A chain with multiple branches.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Layer 2 Scaling 📊",
    description: "Reduces the cost and cooldown of all abilities.",
    tooltip: "Scale up and save! Reduce costs and cooldowns.",
    thumbnail: "Two layers stacked with an arrow.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Trilemma Mastery ⚖️",
    description: "Master the trilemma by providing significant buffs to attack, defense, and movement speed while weakening enemies.",
    tooltip: "Achieve trilemma mastery. Boost attack, defense, and movement speed while weakening enemies.",
    thumbnail: "A balanced scale with a glowing aura.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Deploy Contract 🏗️",
    description: "Sets up a turret that automatically attacks enemies.",
    tooltip: "Deploy a smart contract. Set up a turret to attack enemies.",
    thumbnail: "A turret.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Gas Limit ⛽",
    description: "Reduces the speed of all enemies in a large area.",
    tooltip: "Set a gas limit. Reduce enemy speed in a large area.",
    thumbnail: "A gas gauge.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Revert ↩️",
    description: "Teleports the player to a previous location, avoiding damage.",
    tooltip: "Revert to a previous location. Avoid damage.",
    thumbnail: "A backward arrow.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Exit Hatch 🚪",
    description: "Grants one extra life.",
    tooltip: "One chance to escape from a L2+.",
    thumbnail: "A hatch with an emergency sign.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Code Overload 💥",
    description: "Deploys multiple automated defenses and traps that significantly disrupt and damage enemies.",
    tooltip: "Deploy an overload of defenses and traps. Disrupt and damage enemies.",
    thumbnail: "A computer with an overload symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Protocol Enhancement ⚙️",
    description: "Temporarily increases the effectiveness of all abilities.",
    tooltip: "Enhance protocols. Boost the effectiveness of all abilities.",
    thumbnail: "A gear with a plus symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Patch Update 🔄",
    description: "Heals and buffs nearby allies.",
    tooltip: "Apply a patch update. Heal and buff nearby allies.",
    thumbnail: "A patch with a heart.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Network Upgrade 🆙",
    description: "Grants a significant buff to a random ability.",
    tooltip: "Upgrade the network. Buff a random ability.",
    thumbnail: "An upgrade arrow.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sharding Upgrade 💎",
    description: "Splits the player's attacks into multiple projectiles, hitting more enemies.",
    tooltip: "Divide and conquer! Your attacks hit multiple targets.",
    thumbnail: "A shard of glass with reflections.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Protocol Mastery 🏆",
    description: "Master protocols to provide comprehensive buffs to all allies and debuff enemies significantly.",
    tooltip: "Achieve protocol mastery. Provide extensive buffs and debuffs.",
    thumbnail: "A trophy with protocol symbols.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Rule of Law ⚖️",
    description: "Significantly slows all enemies in a large area.",
    tooltip: "Enforce the rule of law. Slow all enemies in a large area.",
    thumbnail: "A gavel.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Inspection 🔍",
    description: "Reveals and debuffs all enemies in a targeted area.",
    tooltip: "Conduct an inspection. Reveal and debuff enemies.",
    thumbnail: "A magnifying glass.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Compliance Order 📜",
    description: "Forces enemies to move towards the player, taking damage over time.",
    tooltip: "Issue a compliance order. Force enemies to move towards you and take damage.",
    thumbnail: "A compliance document.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Law Enforcement 🔨",
    description: "Enforces a comprehensive area of control, significantly weakening and slowing all enemies while providing substantial buffs to allies.",
    tooltip: "Enforce the law. Weaken and slow enemies while buffing allies.",
    thumbnail: "A gavel with a shield.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Legislation 📜",
    description: "Creates an area where enemies are significantly weakened.",
    tooltip: "Implement legislation. Weaken enemies in a designated area.",
    thumbnail: "A scroll with a seal.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Sanction Wave 🌊",
    description: "Sends out a wave that debuffs all enemies it touches.",
    tooltip: "Unleash a sanction wave. Debuff enemies in its path.",
    thumbnail: "A wave with sanctions.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Regulatory Framework 🏛️",
    description: "Creates a barrier that blocks enemy movement.",
    tooltip: "Establish a regulatory framework. Block enemy movement.",
    thumbnail: "A government building.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Policy Overhaul 📋",
    description: "Executes a policy overhaul, providing massive buffs to allies and drastically debuffing enemies across the battlefield.",
    tooltip: "Execute a policy overhaul. Buff allies and debuff enemies significantly.",
    thumbnail: "A document with major changes.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Network Upgrade 🔧",
    description: "Increases the attack and defense of all nearby allies.",
    tooltip: "Upgrade the network. Boost attack and defense of allies.",
    thumbnail: "A network with an upward arrow.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Node Fortification 🏰",
    description: "Temporarily becomes invulnerable while taunting enemies.",
    tooltip: "Fortify the node. Become invulnerable and taunt enemies.",
    thumbnail: "A fortified node.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Load Balancing ⚖️",
    description: "Spreads damage taken to nearby enemies.",
    tooltip: "Balance the load. Spread damage to nearby enemies.",
    thumbnail: "A balancing scale.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Light Node Runner 🏃",
    description: "Increases movement speed.",
    tooltip: "Light on your feet, quick on your toes.",
    thumbnail: "A runner with a light node.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Network Fortress 🏰",
    description: "Constructs a powerful fortress that provides extensive protection to allies and significantly disrupts enemies.",
    tooltip: "Build a network fortress. Offer extensive protection and disrupt enemies.",
    thumbnail: "A fortified network with a protective shield.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Diamond Hands 💎",
    description: "Reduces incoming damage significantly for a short period.",
    tooltip: "Hold strong with diamond hands. Reduce incoming damage.",
    thumbnail: "A diamond hand.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Market Patience ⏳",
    description: "Gradually regenerates health over time.",
    tooltip: "Show market patience. Gradually regenerate health.",
    thumbnail: "An hourglass.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Whale Buy 🐋",
    description: "Unleashes a powerful area-of-effect attack, representing a large buy order.",
    tooltip: "Make a whale buy. Execute a powerful area-of-effect attack.",
    thumbnail: "A whale with a coin.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: HODL Triumph 🎉",
    description: "Unleashes a triumphant display of resilience, massively boosting defense and health while delivering a devastating area attack.",
    tooltip: "Triumph with HODL. Boost defense, health, and deliver a massive area attack.",
    thumbnail: "A trophy with diamond hands.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidity Pool 💧",
    description: "Creates an area that slowly heals and buffs allies.",
    tooltip: "Create a liquidity pool. Heal and buff allies in the area.",
    thumbnail: "A pool with a healing symbol.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Yield Boost 📈",
    description: "Increases resource generation for a short period.",
    tooltip: "Boost yield. Increase resource generation temporarily.",
    thumbnail: "A growing bar chart.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Flash Loan 💸",
    description: "Temporarily borrows attack power from enemies, dealing increased damage.",
    tooltip: "Take a flash loan. Borrow attack power and deal increased damage.",
    thumbnail: "A loan document with an arrow.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: DeFi Supremacy 🏆",
    description: "Establishes complete DeFi dominance, significantly enhancing all aspects of resource generation and providing massive buffs to allies.",
    tooltip: "Achieve DeFi supremacy. Enhance resource generation and buff allies extensively.",
    thumbnail: "A golden trophy with DeFi symbols.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Funding Boost 📈",
    description: "Increases resource generation for a short period.",
    tooltip: "Boost your funding. Increase resource generation.",
    thumbnail: "A stack of coins.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Due Diligence 🔎",
    description: "Reveals enemies' weaknesses and reduces their defenses.",
    tooltip: "Conduct due diligence. Know and weaken your enemies.",
    thumbnail: "A magnifying glass over documents.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Capital Injection 💰",
    description: "Provides a significant health boost to the player or an ally.",
    tooltip: "Inject capital. Boost health significantly.",
    thumbnail: "A money bag with a plus sign.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Buyout Power 💼",
    description: "Temporarily takes control of an enemy, turning them into an ally.",
    tooltip: "Leverage your buyout power. Control an enemy.",
    thumbnail: "A handshake with dollar signs.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "System Breach 🕵️",
    description: "Disables enemy abilities for a short period.",
    tooltip: "Breach their systems. Disable enemy abilities.",
    thumbnail: "A broken lock.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Malware Injection 🐛",
    description: "Inflicts damage over time and reduces enemy attack speed.",
    tooltip: "Inject malware. Damage and slow your enemies.",
    thumbnail: "A bug with a syringe.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Firewall Defense 🛡️",
    description: "Increases the player's defense temporarily.",
    tooltip: "Raise your firewall. Increase defense.",
    thumbnail: "A shield with flames.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Total Shutdown 💻",
    description: "Shuts down all enemy abilities and greatly reduces their stats for a short period.",
    tooltip: "Initiate total shutdown. Disable and weaken enemies.",
    thumbnail: "A power button with a lock.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Quick Strike ⚔️",
    description: "Delivers a fast attack with increased critical hit chance.",
    tooltip: "Strike quickly and precisely. Increase critical hit chance.",
    thumbnail: "A fast-moving sword.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Speed Boost 💨",
    description: "Increases movement speed for a short period.",
    tooltip: "Boost your speed. Move faster for a short time.",
    thumbnail: "A running figure.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Escape Plan 🚪",
    description: "Teleports the player to a safe location.",
    tooltip: "Execute your escape plan. Teleport to safety.",
    thumbnail: "An open door.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Scalping Frenzy ⚡",
    description: "Temporarily boosts attack speed and movement speed to maximum levels.",
    tooltip: "Unleash scalping frenzy. Maximize attack and movement speed.",
    thumbnail: "A lightning-fast figure.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Price Stabilization 📉📈",
    description: "Stabilizes prices, reducing enemy attack power and increasing ally defense.",
    tooltip: "Stabilize prices. Reduce enemy attack power and boost ally defense.",
    thumbnail: "Stabilized graphs.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Liquidity Pool 🌊",
    description: "Creates a liquidity pool that heals allies over time.",
    tooltip: "Create a liquidity pool. Heal allies over time.",
    thumbnail: "A pool of liquid.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Order Book 📖",
    description: "Summons an order book that blocks enemy projectiles.",
    tooltip: "Summon the order book. Block incoming projectiles.",
    thumbnail: "An open book.",
    isLocked: false,
    effect(user) { 
        this.update = () => {}
    },
},
{
    title: "Ultimate: Market Manipulation Master 🧠",
    description: "Gains full control over the market, drastically buffing allies and debuffing enemies.",
    tooltip: "Master the market. Drastically buff allies and debuff enemies.",
    thumbnail: "A mastermind controlling the market.",
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
    description:'An open futuristic, digital landscape where data flows freely. Forever. 12 seconds at a time thought. ',
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

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.directionalLight.position.set(10, 10, 10);
        this.directionalLight.castShadow = true;
        scene.add(this.directionalLight)

        this.renderScene = new THREE.RenderPass(scene, camera);
        this.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 3, .5, 0.01); 
        composer.addPass(this.renderScene);
        composer.addPass(this.bloomPass);

   
        const cameraX = 0+ cameraRadius * Math.cos(cameraAngle);
        const cameraZ = 0+ cameraRadius * Math.sin(cameraAngle);
        camera.position.set(cameraX, cameraHeight, cameraZ);
    
        this.octahedronGeometry = new THREE.OctahedronGeometry(1);
        this.octahedronGeometry.scale(4.5,5.25,3.75); 
        
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();
        
        this.envTexture = new THREE.TextureLoader().load('Media/Textures/ENVTEXTURE.png', texture => {
            this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
            this.pmremGenerator.dispose();
            scene.environment = this.envMap; 
        });
        
    this.octahedronMesh = new THREE.Mesh(this.octahedronGeometry, this.material);
    scene.add(this.octahedronMesh);   
    this.octahedronMesh2 = new THREE.Mesh(this.octahedronGeometry, this.material);
    scene.add(this.octahedronMesh2); 
    this.octahedronMesh2.rotation.z += 90;


    this.octahedronMesh3 = new THREE.Mesh(this.octahedronGeometry, this.material.clone());
    scene.add(this.octahedronMesh3);   
    this.octahedronMesh4 = new THREE.Mesh(this.octahedronGeometry, this.material.clone());
    scene.add(this.octahedronMesh4); 
    this.octahedronMesh3.material.transparent=true;
    this.octahedronMesh3.material.opacity=1;
    this.octahedronMesh3.material.wireframe=false;
    this.octahedronMesh4.material.transparent=true;
    this.octahedronMesh4.material.opacity=1;
    this.octahedronMesh4.material.wireframe=false;
    this.octahedronMesh4.rotation.z += 90;

    camera.lookAt(this.octahedronMesh.position);
    this.miniOctahedrons = [];
    const miniOctahedronGeometry = new THREE.OctahedronGeometry(0.2);
    const miniOctahedronMaterial = this.material.clone();

    miniOctahedronGeometry.scale(0.5,0.75,0.5)

    const numCrystals = 1024; 

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    const possibleRadii = [1, 25, 50, 75];
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
},
    update: function(scene, camera, renderer) {
        if(isMainMenu){
            this.octahedronMesh.rotation.z -= 0.005;
            this.octahedronMesh2.rotation.z += 0.005;
        
            this.octahedronMesh3.rotation.z -= 0.005;
            this.octahedronMesh4.rotation.z += 0.005;
            this.octahedronMesh4.material.opacity-=0.002;
            this.octahedronMesh3.material.opacity-=0.002;

            if (this.octahedronMesh3.material.opacity <= 0) { 
                scene.remove(this.octahedronMesh4); 
                scene.remove(this.octahedronMesh3); 
           }

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
                if (distanceToCenter > 1.5) { 
                    miniOctahedron.position.addScaledVector(direction, attractionSpeed);
                }
        });
        }else{

            this.octahedronMesh.scale.multiplyScalar(1 - 0.05); 
            this.octahedronMesh2.scale.multiplyScalar(1 - 0.05); 
            this.octahedronMesh3.scale.multiplyScalar(1 - 0.05); 
            this.octahedronMesh4.scale.multiplyScalar(1 - 0.05); 
            if (this.octahedronMesh.scale.x <= 0.1) { 
                scene.remove(this.octahedronMesh); 
                scene.remove(this.octahedronMesh3); 
                scene.remove(this.octahedronMesh4); 
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
    },
    resumeGame: function(){
       scene.remove(world.octahedronMesh2);
       this.octahedronMesh.rotation.z = 0;
  
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
    thumbnail: 'Media/Worlds/GOLDLAND.jpg',
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
function createInfinityGridFloor(scene, camera, renderer, player) {
    const gridSize = 50;
    const divisions = 5; 

    const gridGeometry = new THREE.PlaneGeometry(gridSize, gridSize, divisions, divisions);
    gridGeometry.rotateX(-Math.PI / 2);

    const gridMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            playerPosition: { value: player.position },
            gridSize: { value: gridSize },
            divisions: { value: divisions }
        },
        vertexShader: `
            uniform vec3 playerPosition;
            uniform float time;
            uniform float gridSize;
            uniform float divisions;

            varying vec3 vWorldPos;
            varying vec2 vUv; 

            void main() {
                vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 playerPosition;
            uniform float time;
            uniform float gridSize;
            uniform float divisions;

            varying vec3 vWorldPos;
            varying vec2 vUv;

            // HSV to RGB conversion (for color transitions)
            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            void main() {
                // 1. Calculate distance to player on the XZ plane
                float distanceToPlayer = distance(vWorldPos.xz, playerPosition.xz);

                // 2. Cell coordinates for color variation 
                vec2 cellCoord = floor(vUv * divisions);

                // 3. Calculate hue based on cell coordinates and time 
                float hue = mod((cellCoord.x + cellCoord.y) * 0.1 + time * 0.1, 1.0);

                // 4. Brightness based on player proximity
                float brightness = smoothstep(25.0, 0.0, distanceToPlayer); 

                // 5. Combine hue and brightness for final color
                vec3 color = hsv2rgb(vec3(hue, 1.0, brightness));

                gl_FragColor = vec4(color, 1.0); 
            }
        `,
        wireframe:true,
        transparent:true,
        opacity:0.1,

    });

   
    const grid = new THREE.Mesh(gridGeometry, gridMaterial);
    scene.add(grid);

    renderer.setAnimationLoop(() => {
        gridMaterial.uniforms.time.value += 0.05;
        gridMaterial.uniforms.playerPosition.value.copy(player.position); 
    });
}
/*---------------------------------------------------------------------------
                              Player Controller
---------------------------------------------------------------------------*/
const initialPlayerPosition = new THREE.Vector3(0, 0, 0);

player = new Entity(playerTypes.find(type => type.title === 'Onchain Survivor'), initialPlayerPosition);
createInfinityGridFloor(scene, camera, renderer,player);
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
    createChooseMenu(upgradeOptions, "\nUpgrade 🔱", "Upgrade");
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

    function createTitleElement(text, title, fontSize) {
        const element = document.createElement('div');
        element.innerText = text;
        element.title = title;
        element.classList.add(fontSize); 
        element.classList.add('rainbow-text'); 
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
        
        img.style.filter = 'brightness(130%)'; 
    
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
        //img.style.filter = 'grayscale(100%) blur(5px)';
        if(dataType.isLocked){
        button.style.color = 'gray';
        button.style.borderImageSource = 'linear-gradient(45deg, gray, gray)';
        button.style.cursor = 'not-allowed';
        button.style.opacity = '0.5';
        title.innerText="???"
        title.style.color = 'gray';
        description.style.color = 'gray';
        description.innerText="?????????????"
        button.style.animation = 'none';
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
    
    function createTitleContainer(text,tooltip) {
        const container = document.createElement('div');
        container.classList.add('choose-menu-title');
        const title = createTitleElement(text, tooltip, "title"); 
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
        const mainTitle = createTitleContainer('🏆⚔️🔗\nOnchain Survivor', 'laziest Logo ive ever seen, isnt the dev just using ai for everything and this is the best he could come up with? 💀');
        mainTitle.style.cursor= "pointer"
        mainTitle.onclick = function() { window.open('https://x.com/OnChainSurvivor', '_blank'); };
        addContainerUI(topUI,'top-container', [mainTitle]);

        const subTitle = createTitleContainer('Move to Start !', 'lazy subtitle too btw', "subtitle");
        const sponsor = createTitleElement('Sponsor: Nobody yet!', 'lazy subtitle too btw', "subtitle");
        sponsor.onclick = function() { window.open('https://x.com/OnChainSurvivor', '_blank'); };  //debt: explain the sponsor gameplay mechanics

        addContainerUI(botUI,'bottom-container', [subTitle,sponsor]);
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
    const classSubTitle = createTitleElement('🏆', 'lazy subtitle too btw', "subtitle")
    const classButton = createButton(player, isMobile ? 0.6 : 0.75);
    classContainer.appendChild(classButton);
    classContainer.appendChild(classSubTitle);

    const abilitiesSubTitle = createTitleElement('⚔️', 'lazy subtitle too btw', "subtitle");
    const abilitiesButton = createButton(ability, isMobile ? 0.6 : 0.75);
    const classAbilityContainer = document.createElement('div');
    classAbilityContainer.appendChild(abilitiesButton);
    classAbilityContainer.appendChild(abilitiesSubTitle);

    const worldSubTitle = createTitleElement('🔗', 'lazy subtitle too btw', "subtitle");
    const worldButton = createButton(world, isMobile ? 0.6 : 0.75);
    const worldContainer = document.createElement('div');
    worldContainer.appendChild(worldButton);
    worldContainer.appendChild(worldSubTitle);

    const menuButtonsContainer = createContainer([], { display: 'flex' });
    menuButtonsContainer.appendChild(classContainer);
    menuButtonsContainer.appendChild(classAbilityContainer);
    menuButtonsContainer.appendChild(worldContainer);
    const subTitle = createTitleElement('Move to quick start !', 'lazy subtitle too btw', "subtitle");
    addContainerUI(botUI, 'bottom-container', [subTitle,menuButtonsContainer]);

        menuButtonsContainer.childNodes.forEach(button => {
            button.addEventListener('click', () => {
                canMove=false;
                if (button === classContainer) {
                    createChooseMenu(playerTypes, "\nChoose a Survivor 🏆","Survivor");
                } else if (button === classAbilityContainer) {
                    createChooseMenu(abilityTypes, "\nChoose an Ability ⚔️","Ability");
                } else if (button === worldContainer) {
                    createChooseMenu(worldTypes, "\nChoose a Chain 🔗","World");
                }
                hideContainerUI(botUI);
            });
        });
 
        createRandomRunEffect(classButton, classImages, 110, isMobile ? 0.6 : 0.75, "class"); 
        createRandomRunEffect(abilitiesButton, abilityImages, 0, isMobile ? 0.6 : 0.75, "ability");
        createRandomRunEffect(worldButton, worldImages, 0, isMobile ? 0.6 : 0.75, "world");
    };
   // createGameMenu()
/*---------------------------------------------------------------------------
                        Generic Choose Menu
---------------------------------------------------------------------------*/
function createChooseMenu(entityList, text, type) {
    const popUpContainer = createPopUpContainer();
    const titleContainer = createTitleContainer(text,'Test');
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
        const newAbility = new Ability(player, { ...entity});
        player.addAbility(newAbility);
        newAbility.activate();
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
    const web3Container = createContainer(['fade-in', 'top-container'], { left: '130%' });
    const buttonConnect = document.createElement('button');
    const subTitle = createTitleElement('♦️\nConnect\n♦️', 'lazy subtitle too btw', "subtitle");
    buttonConnect.style.backgroundColor = 'transparent';
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
        const classSubTitle = createTitleElement('🏆 100%', 'lazy subtitle too btw', "subtitle");
        const classButton = createButton(player, isMobile ? 0.6 : 0.75);
        classContainer.appendChild(classButton);
        classContainer.appendChild(classSubTitle);
     
        const abilitiesSubTitle = createTitleElement('⚔️ 50%', 'lazy subtitle too btw', "subtitle");
        ability.isLocked=false;
        const abilitiesButton = createButton(ability, isMobile ? 0.6 : 0.75);
        const classAbilityContainer = document.createElement('div');
        classAbilityContainer.appendChild(abilitiesButton);
        classAbilityContainer.appendChild(abilitiesSubTitle);
     
        const worldSubTitle = createTitleElement('🔗 10%', 'lazy subtitle too btw', "subtitle");
        const worldButton = createButton(world, isMobile ? 0.6 : 0.75);
        const worldContainer = document.createElement('div');
        worldContainer.appendChild(worldButton);
        worldContainer.appendChild(worldSubTitle);
     
        const galleryButtonsContainer = createContainer([], { display: 'flex' });
        galleryButtonsContainer.appendChild(classContainer);
        galleryButtonsContainer.appendChild(classAbilityContainer);
        galleryButtonsContainer.appendChild(worldContainer);
        const subTitle = createTitleContainer(`Welcome Home, Survivor.eth!`, 'lazy subtitle too btw');
        
        const subTitleRun = createTitleElement('⌛️ Start Run ⌛️', 'lazy subtitle too btw', "subtitle");
        subTitleRun.style.cursor = 'pointer';
         
        const subTitleReport = createTitleElement('⚖️ Transparency Report ⚖️', 'lazy subtitle too btw',"subtitle");
        subTitleReport.style.cursor = 'pointer';
 
        const subTitleHall = createTitleElement('💎 Hall of Survivors 💎', 'lazy subtitle too btw',"subtitle");
        subTitleHall.style.cursor = 'pointer';
 
        const subTitleLogout = createTitleElement('♢Log Out ♢', 'lazy subtitle too btw',"subtitle");
        subTitleLogout.style.cursor = 'pointer';
        subTitleLogout.onclick = () => {
            localStorage.removeItem('metaMaskAddress');
            location.reload(); 
        };
 
        const loadingContainer = document.createElement('div');
        loadingContainer.classList.add('loading-container');
             
        const loadingBar = document.createElement('div');
        loadingBar.classList.add('loading-bar');
         
        const loadingText =  createTitleElement('', 'who even keeps track of these', "subtitle");
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
const modeDisplay = createTitleElement('__________________', 'who even keeps track of these',"subtitle");
const timerDisplay = createTitleElement('', 'who even keeps track of these', "subtitle");
const coordinateDisplay = createTitleElement('', 'who even keeps track of these',"subtitle");
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

    const abilitiesContainer = createContainer(['abilities-grid-container']); 
    abilitiesContainer.style.display = 'grid';
    abilitiesContainer.style.gridTemplateColumns = 'repeat(7, 1fr)';
    abilitiesContainer.appendChild(createButton(player, .25));
    player.abilities.forEach(ability => {
        const clonedAbility = { ...ability, isLocked: false };
        abilitiesContainer.appendChild(createButton(clonedAbility, 0.25));
    });
    addContainerUI(topUI,'top-container', [xpLoadingContainer, abilitiesContainer]);
    addContainerUI(botUI,'bottom-container', [modeDisplay,timerDisplay,]);
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

             if(cameraHeight <= 35)
            cameraHeight+=0.075;

             if(cameraRadius <= 30)
                cameraRadius+=0.0075;

        } else if((canMove) && (keys.w ||keys.a || keys.s || keys.d)) resumeGame();
        accumulatedTime -= fixedTimeStep;
    }
    world.update(scene,camera,renderer);
    composer.render();
}

animate();