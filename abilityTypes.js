export const abilityTypes = [
    {title: "Scalping Bot",
        description: 'Abusing the market volatility, The Scalping bot Executes incredibly fast attacks.',
        thumbnail: 'Media/Abilities/SCALPINGBOT.png',
        effect(user) { 
            this.update = () => {}
                this.lastHitTime=0;
                let time = Date.now();
                let direction= null;
                const orb = new THREE.Mesh(
                    new THREE.SphereGeometry(0.6, 16, 6),
                    world.material 
                );
                orb.position.copy(user.position); 
                orb.updateMatrixWorld(true);
                orb.boundingBox = new THREE.Box3().setFromObject(orb);
                lightObjects.push(orb);
                scene.add(orb);
                orb.target= null;
                orb.orbitRadius= 2;
                orb.orbitSpeed= 0.01;
                orb.homingSpeed= 0.5;

                this.update = () => {
                        if (!orb.target) {
                            time = Date.now() * orb.orbitSpeed;
                            orb.position.set(
                                user.position.x + Math.cos(time) * orb.orbitRadius,
                                user.position.y,
                                user.position.z + Math.sin(time) * orb.orbitRadius
                            );
                            orb.target=true;
                            if ((Date.now() - this.lastHitTime > (500))) {
                            this.lastHitTime = Date.now();
                            }
                        } else {
                            direction = new THREE.Vector3().subVectors(closeEnemy, orb.position).normalize();
                            orb.position.add(direction.multiplyScalar(orb.homingSpeed));
                            orb.boundingBox.setFromObject(orb);
                        }
                };
                this.deactivate = () => {
                        if (orb) {
                            scene.remove(orb);
                            orb = null;
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
                    if (trailBullets.length >= (7)) {
                        const oldestBullet = trailBullets.shift(); 
                        scene.remove(oldestBullet); 
                        const index = lightObjects.indexOf(oldestBullet);
                        if (index > -1) lightObjects.splice(index, 1); 
            
                    } 
                    const trailStep = new THREE.Mesh(new THREE.BoxGeometry(1,.5,1 ),world.material);
                    trailStep.position.copy(user.position);
                    trailStep.position.y-=1;
                    scene.add(trailStep);
                    trailStep.boundingBox = new THREE.Box3().setFromObject(trailStep);
                    trailBullets.push(trailStep);
                    lightObjects.push(trailStep);
                }
            };
            this.update = () => {
                if ((Date.now() - this.lastTrailTime > 400)) {
                    this.lastTrailTime = Date.now();
                    trail.create();
                }
            };
            this.deactivate = () => {
                trailBullets.forEach(bullet => { 
                    scene.remove(bullet);
                    const index = lightObjects.indexOf(oldestBullet);
                    if (index > -1) lightObjects.splice(index, 1); 
                });
                trailBullets.length = 0; 
            };
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
                const orb = new THREE.Mesh(
                    new THREE.SphereGeometry(0.6, 16, 6),
                    world.material 
                );
                orb.position.copy(user.position); 
                orb.updateMatrixWorld(true);
                orb.boundingBox = new THREE.Box3().setFromObject(orb);
                lightObjects.push(orb);
                scene.add(orb);
                orb.orbitRadius= 10;
                orb.orbitSpeed= 0.0075;
                orb.homingSpeed= 0.25;

                this.update = () => {
                            time = Date.now() * orb.orbitSpeed;
                            orb.position.set(
                                user.position.x + Math.cos(time) * orb.orbitRadius,
                                user.position.y+1.5,
                               // user.position.z + Math.sin(time) * orb.orbitRadius
                            );
                            direction = new THREE.Vector3().subVectors(closeEnemy, orb.position).normalize();
                            orb.position.add(direction.multiplyScalar(orb.homingSpeed));
                            orb.boundingBox.setFromObject(orb);
                        
                };
                this.deactivate = () => {
                        if (orb) {
                            scene.remove(orb);
                            orb = null;
                        }
                };
        },
    },
    {title: "Bot Swarm",
        description: "Summons additional bots to assist in battle.",
        thumbnail: 'Media/Abilities/SWARM.png',
        effect(user) { 
            this.update = () => {};
            let time = Date.now();
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.6, 16, 6),
                world.material 
            );
            orb.maxDistance= 20;
            orb.offsetAmount= 5;
            orb.followSpeed= 0.1;
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
                    Math.pow(targetX + orb.position.x, 2) + 
                    Math.pow(targetZ + orb.position.z, 2)
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
            this.deactivate = () => {
                if (orb) {
                    scene.remove(orb);
                    orb = null;
                }
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
                    const shieldMaterial = world.material
                    const shieldGeometry = new THREE.SphereGeometry(2);
                    veil.shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
                    veil.shield.position.copy(user.position);
                    scene.add(veil.shield);
                }
            };
            this.update = () => {
                    if (veil.shield) 
                        veil.shield.position.set(user.position.x ,user.position.y + 2, user.position.z );
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
    {title: "Exploit Finder",
        description: "Scans the blockchain for harmful elements and neutralizes them.",
        thumbnail: "Media/Abilities/EXPLOITFINDER.png",
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
                this.deactivate = () => {
                        if (orb) {
                            scene.remove(orb);
                            orb = null;
                        }
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
            this.deactivate = () => {
                if (orb) {
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
    
            this.deactivate = () => {
                if (orb) {
                    scene.remove(orb);
                    orb = null;
                }
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

                if (dropUpdateFrame++ % (60/ player.attackPerSecond) === 0) { 
                    if (closeEnemy) {
                        createOrb(orb);
                    }
                }
            
            };

            this.deactivate = () => {
                if (orb.mesh) {
                    scene.remove(orb);
                    orb = null;
                }
            };
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
    }
},
{
    title: "Smart Contract Deployment",
    description: "Deploys a smart contract to trap and damage enemies.",
    thumbnail: 'Media/Abilities/SMARTCONTRACT.png',
    effect(user) { 
        this.update = () => {}
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