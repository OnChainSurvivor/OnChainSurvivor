/*---------------------------------------------------------------------------
                              Constants
---------------------------------------------------------------------------*/

const rainbowColors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
let colorIndex = 0;

const xpSpheres = []; 
const xpsphereGeometry = new THREE.SphereGeometry(0.25, 16, 16);
const xpsphereMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });

let mainMenuContainers = [];

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
        this.initAbilities(config.abilities);
    }

    initAbilities(abilitiesConfig) {
        abilitiesConfig.forEach(abilityConfig => {
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
                              Ability Blueprints
---------------------------------------------------------------------------*/

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
            create: () => {
                if (trailBullets.length >= level) {
                    const oldestBullet = trailBullets.shift(); 
                    scene.remove(oldestBullet); 
                }
                colorIndex = (colorIndex + 1) % rainbowColors.length;
                const trailStep = new THREE.Mesh(
                    new THREE.BoxGeometry(0.2 * level, 0.2 * level, 0.2 * level),
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
            if ((Date.now() - this.lastTrailTime > 500)) {
                this.lastTrailTime = Date.now();
                trail.create();
            }
           // playerCollisionList.forEach((trailBullet,index) => {
            //            if (trailBullet.trailBox.intersectsBox(other)) { // Make this generic in the future
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
},{
    title: "Scalping Bot",
    description: "Abusing the market volatility, The Survivor's bot Executes incredibly fast attacks.",
    tooltip: "Like a true degen",
    classes: ["Trader", "High-Frequency Trader"],
    explanation: "Trader: Uses quick trades for gains. High-Frequency Trader: Executes high-speed strategies.",
    tags:["Offensive", "Burst Damage"],
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
                    potentialTargets = scene.children.filter(child => child instanceof Entity && child.class !== user.class);// TO OPTIMIZE
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
    effectinfo: 'Orb damage and homing speed increase.',
    thumbnail: 'Media/Abilities/SCALPINGBOT.png',
    level: 0
}
];

/*---------------------------------------------------------------------------
                              Class Blueprints
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
    tags: ['player'],
    thumbnail: 'Media/Classes/Onchain Survivor/MSURVIVOR.png',
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: createNeonMaterial(rainbowColors[colorIndex]),
    abilities: [
        { type: 'Scalping Bot', level: 1 },
        { type: 'Onchain Trail', level: 1 },
        { type: 'Veil of Decentralization', level: 1 }
    ],
    level:0,
}
];

/*---------------------------------------------------------------------------
                              Enemy Blueprints
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
        { type: 'Onchain Trail', level: 1 },
        { type: 'Veil of Decentralization', level: 1 }
    ],
    level:0,
}
];

/*---------------------------------------------------------------------------
                              World Blueprints
---------------------------------------------------------------------------*/

const worldTypes = [{
    class: 'World',
    title: 'Ethereumverse',
    description:'An open futuristic, digital landscape where data flows freely. Forever. 12 seconds at a time thought. ',
    tooltip:'0.04 💀',
    tags: ['world'],
    thumbnail: 'Media/Worlds/ETHEREUMVERSE.png',
    level:0,
}
];

/*---------------------------------------------------------------------------
                              World Controller
---------------------------------------------------------------------------*/

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const canvas = document.getElementById('survivorCanvas');
const renderer = new THREE.WebGLRenderer({ canvas });
function updateRendererSize() {
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(dpr);
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
}
updateRendererSize();

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



window.addEventListener('resize', updateRendererSize);

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

camera.position.set(0, 15, 15);
//camera.lookAt(player.position);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderTarget.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}, false);

/*---------------------------------------------------------------------------
                              Player Controller
---------------------------------------------------------------------------*/

const player = new Entity(playerTypes.find(type => type.class === 'Survivor'));

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
    else{
        isPaused = true;
    }
    player.updateAbilities();

    xpSpheres.forEach((xpSphere, index) => {
        if (player.boundingBox.intersectsBox(xpSphere.boundingBox)) {
            player.xp += 100;
            if (player.xp >= 100) {
                player.xp = 0;
                LevelUp();
            }
            scene.remove(xpSphere);
            xpSpheres.splice(index, 1);
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

function LevelUp() {
    const availableAbilities = abilityTypes.filter(abilityType => {
        return !player.abilities.some(playerAbility => playerAbility.title === abilityType.title);
    });
    const allAbilities = [...player.abilities, ...availableAbilities];
        const randomIndex = Math.floor(Math.random() * allAbilities.length);
        const randomAbility = allAbilities[randomIndex];
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
                refreshDisplay();
                isPaused = false;
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
    let mainMenu=true;
    const isMobile = window.innerWidth <= 600;

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
        return container;
    }

    const entities = [
        playerTypes[0],    
        abilityTypes[1],
        worldTypes[0]
    ];

    function attachHoverEffect(button, entity) {
        button.addEventListener('pointerenter', () => {
            const fullButtonContainer = createContainer(['fade-in']);
            document.body.appendChild(fullButtonContainer);
            
            console.log('Hovered over:', entity.title);
            const scaledButton = createButton(entity, 1);
            scaledButton.style.position = 'fixed';
            scaledButton.style.top = '-100%';
            scaledButton.style.left = '50%';
            scaledButton.style.transform = 'translate(-50%, -50%)';
            scaledButton.style.zIndex = '2000';
            scaledButton.style.pointerEvents = 'none'; 
            menuContainer.appendChild(fullButtonContainer);
            fullButtonContainer.appendChild(scaledButton);
    
            const removeScaledButton = () => {
                console.log('Mouse left:', entity.title);
                if (scaledButton) {
                    menuContainer.removeChild(fullButtonContainer);
                }
            };
            setTimeout(() => { fullButtonContainer.classList.add('show'); }, 10);
    
            button.addEventListener('pointerleave', removeScaledButton, { once: true });
        });
    }

    function createButton(ability, scale = 1, onClick) {
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
        button.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        button.style.border = '1px solid';
        button.style.borderImageSlice = 1;
        button.style.borderImageSource = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';
        button.style.animation = 'rainbowBorder 5s linear infinite';
    
        button.title = ability.tooltip;
    
        const title = document.createElement('div');
        title.innerText = ability.title;
        rainbowText(title, `${20 * scale}px`);  
        title.style.height = `${2.5 * scale}em`; 
        title.style.lineHeight = `${1.5 * scale}em`;
        title.style.overflow = 'hidden';
        title.style.textAlign = 'center'; 
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.justifyContent = 'center';
        title.style.padding = `${5 * scale}px 0`;
        const img = document.createElement('img');
        img.src = ability.thumbnail;
        img.style.width = `${150 * scale}px`;
        img.style.height = `${150 * scale}px`;
    
        const levelStars = document.createElement('div');
        levelStars.style.display = 'flex';
        levelStars.style.marginTop = '1px';
        levelStars.style.marginBottom = '1px';
        for (let i = 0; i < ability.level; i++) {
            const star = document.createElement('img');
            star.src = 'Media/Abilities/Star.png';
            star.style.width = `${20 * scale}px`;
            star.style.height = `${20 * scale}px`;
            levelStars.appendChild(star);
        }
    
        expl = ability.description;
        if (ability.level != 0) expl = ability.effectinfo;
    
        const effectinfo = document.createElement('div');
        effectinfo.innerText = `${expl}`;
        rainbowText(effectinfo, `${14 * scale}px`); 
        effectinfo.style.height = `${5 * scale}em`; 
        effectinfo.style.lineHeight = `${1.15 * scale}em`; 
        effectinfo.style.overflow = 'hidden'; 
        effectinfo.style.textAlign = 'center';
        effectinfo.style.alignItems = 'center'; 
        effectinfo.style.justifyContent = 'center';
        effectinfo.style.padding = `${5 * scale}px 0`;
        effectinfo.style.display = scale > 0.751 ? 'block' : 'none'; 
    
        button.appendChild(title);
        button.appendChild(img);
        button.appendChild(levelStars);
        button.appendChild(effectinfo);
    
        if (onClick) button.onclick = onClick;

        if(scale <=.3)
        attachHoverEffect(button, ability); 

        return button;
    }
    
/*---------------------------------------------------------------------------
                                GAME TITLE 
---------------------------------------------------------------------------*/

    const titleContainer = createContainer(['top-container', 'fade-in']);

    const mainTitle = createTitleElement('🔗🏆\nOnchain Survivor', 'laziest Logo ive ever seen, isnt the dev just using ai for everything and this is the best he could come up with? 💀', isMobile ? '10vw' : '6vw');
    titleContainer.appendChild(mainTitle);

    const subTitle = createTitleElement('Can you survive 5 minutes? Move to Start!', 'lazy subtitle too btw', isMobile ? '4vw' : '2vw');
    titleContainer.appendChild(subTitle);

    mainMenuContainers.push(titleContainer);
    document.body.appendChild(titleContainer);

    setTimeout(() => { titleContainer.classList.add('show'); }, 10); 

/*---------------------------------------------------------------------------
                                   GAME MENU
---------------------------------------------------------------------------*/

    const menuContainer = createContainer(['bottom-container', 'fade-in']);
    const menuButtonsContainer = createContainer([], { display: 'flex' });
    menuContainer.appendChild(menuButtonsContainer);

    classContainer = document.createElement('div');
    const classSubTitle = createTitleElement('🏆 Class 🏆', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
    menuButtonsContainer.appendChild(classContainer);
    classContainer.appendChild(createButton(entities[0], 0.7));
    classContainer.appendChild(classSubTitle);
    menuButtonsContainer.appendChild(classContainer);

    classAbilityContainer = document.createElement('div');
    const abilitiesSubTitle = createTitleElement( '⚔️ Ability ⚔️', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
    classAbilityContainer.appendChild(createButton(entities[1], 0.7));
    classAbilityContainer.appendChild(abilitiesSubTitle);
    classContainer.appendChild(classAbilityContainer);
    menuButtonsContainer.appendChild(classAbilityContainer);

    worldContainer = document.createElement('div');
    const worldSubTitle = createTitleElement('🔗 World 🔗', 'lazy subtitle too btw', isMobile ? '4.5vw' : '1.5vw');
    worldContainer.appendChild(createButton(entities[2], .7));
    worldContainer.appendChild(worldSubTitle);
    menuButtonsContainer.appendChild(worldContainer);

    mainMenuContainers.push(menuContainer);
    document.body.appendChild(menuContainer);

    setTimeout(() => { menuContainer.classList.add('show');}, 10); 

    menuButtonsContainer.childNodes.forEach(button => {
        button.addEventListener('click', () => {
            if (button === classContainer) {
                createPopUpMenu(playerTypes, button,classSubTitle);
            } else if (button === classAbilityContainer) {
                createPopUpMenu(abilityTypes, button,abilitiesSubTitle);
            } else if (button === worldContainer) {
                createPopUpMenu(worldTypes, button,worldSubTitle);
            }
        });
    });

/*---------------------------------------------------------------------------
                        Select NFT Menu
---------------------------------------------------------------------------*/

function createPopUpMenu(entityList, buttonToUpdate, buttonsubTitle) {
    const popUpContainer = createContainer(['top-container', 'fade-in']);
    popUpContainer.style.position = 'fixed';
    popUpContainer.style.zIndex = '1001';
    popUpContainer.style.backgroundColor = 'black';
    popUpContainer.style.width = '75%';
    popUpContainer.style.height = '95%';
    popUpContainer.style.border = '.5px solid';
    popUpContainer.style.borderImageSource = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';
    popUpContainer.style.borderImageSlice = 1;
    popUpContainer.style.padding = '20px';
    popUpContainer.style.boxSizing = 'border-box';
    popUpContainer.style.overflowY = 'auto';
    popUpContainer.style.animation = 'rainbow-border 5s linear infinite';

    const titleContainer = document.createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.justifyContent = 'space-between';
    titleContainer.style.alignItems = 'center';
    titleContainer.style.marginBottom = '20px';
    titleContainer.style.flexDirection = 'column';
    popUpContainer.appendChild(titleContainer);
    const title = createTitleElement('Choose your NFT', '', isMobile ? '4.5vw' : '1.5vw');
    titleContainer.appendChild(title);
    titleContainer.appendChild(buttonToUpdate.childNodes[1].cloneNode(true));

    const gridContainer = document.createElement('div');
    gridContainer.style.display = 'grid';
    gridContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    if (isMobile) gridContainer.style.gridTemplateColumns = 'repeat(1, 1fr)';
    gridContainer.style.gap = '20px';
    popUpContainer.appendChild(gridContainer);

    entityList.forEach(entity => {
        const itemButton = createButton(entity, 1);
        itemButton.style.display = 'block';
        itemButton.onclick = () => {
            buttonToUpdate.innerHTML = '';
            const newButton = createButton(entity, 0.7);
            buttonToUpdate.appendChild(newButton);
            buttonToUpdate.appendChild(buttonsubTitle);
            document.body.removeChild(popUpContainer);
        };
        gridContainer.appendChild(itemButton);
    });

    document.body.appendChild(popUpContainer);
    setTimeout(() => { popUpContainer.classList.add('show'); }, 10);
}

/*---------------------------------------------------------------------------
                                    WEB3 Menu
---------------------------------------------------------------------------*/
   
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
        mainMenuContainers.push(web3Container);
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

let countdown = 500 * 60;
const timerDisplay = createTitleElement('', 'who even keeps track of these', isMobile ? '3vw' : '1.5vw');

function updateTimerDisplay() {
    countdown--;
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    timerDisplay.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function refreshDisplay() {

    const gameStateContainer = createContainer(['bottom-container','fade-in'],{ display: 'flex' });
    document.body.appendChild(gameStateContainer);
    const abilitiesContainer = createContainer([], { display: 'flex' });
    gameStateContainer.appendChild(abilitiesContainer);
    gameStateContainer.appendChild(timerDisplay);
    
    abilitiesContainer.innerHTML = '';
    abilityButton = createButton(player, .3);
    abilitiesContainer.appendChild(abilityButton);

    player.abilities.forEach(ability => {
        const abilityButton = createButton(ability, .3);
        abilitiesContainer.appendChild(abilityButton);
    });

    abilitiesContainer.appendChild(createButton(worldTypes[0],.3));

    document.body.appendChild(gameStateContainer);

    setTimeout(() => { gameStateContainer.classList.add('show'); }, 10); 

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

let isPaused = true;
let isMainMenu = true;

function resumeGame() {

    if (isPaused) {
        isPaused = false;
        refreshDisplay();
    }
    

    if(isMainMenu){
        mainMenuContainers.forEach(container => { container.classList.add('fade-out'); })
        setTimeout(() => {
            mainMenuContainers.forEach(container => { container.classList.add('hide'); })
            setTimeout(() => {
                mainMenuContainers.forEach(container => {
                    container.innerHTML = '';
                    container.classList.remove('fade-out', 'hide');
                })
            }, 1500);
        }, 10); 
    }
}

/*---------------------------------------------------------------------------
                              Animation Loop 
---------------------------------------------------------------------------*/

let animationFrameId;
const clock = new THREE.Clock();
const fixedTimeStep = 1 / 60;
let accumulatedTime = 0;
let deltaTime;

function animate() {
    animationFrameId = requestAnimationFrame(animate);

    deltaTime = clock.getDelta();
    accumulatedTime += deltaTime;

    while (accumulatedTime >= fixedTimeStep) {
        if (!isPaused) {
            updatePlayerMovement();
            updateCamera();
            updateEnemies();
            updateTimerDisplay();
        } else {
            if (keys.s) resumeGame();
            if (keys.w) resumeGame();
            if (keys.a) resumeGame();
            if (keys.d) resumeGame();
        }
        accumulatedTime -= fixedTimeStep;
    }
    composer.render();
}
animate();