import { getScene, getCamera, getRenderer, getComposer } from './Renderer.js';
import { keys } from '../input/Joystick.js';
import { EnemyCubeManager } from './EnemyCube.js';
import { worlds } from './worldsConfig.js';
import { createChooseMenu } from "../ui/UI.js";
import { abilityTypes } from "../abilityCards.js";
import { AbilityManager } from './abilityComponents.js';

class Octree {
  constructor(boundary, capacity = 8) {
    this.boundary = boundary.clone();
    this.capacity = capacity;
    this.points = []; // Each element is { point: THREE.Vector3, data: any }
    this.divided = false;
    this.children = [];
  }

  subdivide() {
    const { min, max } = this.boundary;
    const mid = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
    const boxes = [
      new THREE.Box3(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(mid.x, mid.y, mid.z)),
      new THREE.Box3(new THREE.Vector3(mid.x, min.y, min.z), new THREE.Vector3(max.x, mid.y, mid.z)),
      new THREE.Box3(new THREE.Vector3(min.x, mid.y, min.z), new THREE.Vector3(mid.x, max.y, mid.z)),
      new THREE.Box3(new THREE.Vector3(mid.x, mid.y, min.z), new THREE.Vector3(max.x, max.y, mid.z)),
      new THREE.Box3(new THREE.Vector3(min.x, min.y, mid.z), new THREE.Vector3(mid.x, mid.y, max.z)),
      new THREE.Box3(new THREE.Vector3(mid.x, min.y, mid.z), new THREE.Vector3(max.x, mid.y, max.z)),
      new THREE.Box3(new THREE.Vector3(min.x, mid.y, mid.z), new THREE.Vector3(mid.x, max.y, max.z)),
      new THREE.Box3(new THREE.Vector3(mid.x, mid.y, mid.z), new THREE.Vector3(max.x, max.y, max.z))
    ];
    for (let i = 0; i < 8; i++) {
      this.children[i] = new Octree(boxes[i], this.capacity);
    }
    this.divided = true;
  }

  insert(point, data) {
    if (!this.boundary.containsPoint(point)) return false;
    if (this.points.length < this.capacity) {
      this.points.push({ point: point.clone(), data });
      return true;
    }
    if (!this.divided) this.subdivide();
    for (let child of this.children) {
      if (child.insert(point, data)) return true;
    }
    return false;
  }

  query(range, found = []) {
    if (!this.boundary.intersectsBox(range)) return found;
    for (let p of this.points) {
      if (range.containsPoint(p.point)) {
        found.push(p.data);
      }
    }
    if (this.divided) {
      for (let child of this.children) {
        child.query(range, found);
      }
    }
    return found;
  }

  clear() {
    this.points = [];
    this.divided = false;
    this.children = [];
  }
}

export class GameManager {
  constructor(defaultWorld) {
    this.scene = getScene();
    this.camera = getCamera();
    this.renderer = getRenderer();
    this.composer = getComposer();
    this.clock = new THREE.Clock();
    this.player = null;
    // Increase player movement speed by 2: original value 6 is now 8.
    this.moveSpeed = 8;
    // Bullet properties
    this.bulletSpeed = 10;
    this.shootCooldown = 1;
    // Set a higher target for camera z-offset
    this.targetCameraZ = 50;
    this.running = false;
    // Add a flag to control enemy updates
    this.updateEnemies = true;
    this.animationFrameId = null;
    this.initScene();

    // Trail properties (for visualizing movement)
    this.trailPieces = [];
    this.trailTimer = 0;

    // Arrays for enemies and bullets
    this.enemies = [];
    this.bullets = [];
    // Object pools for recycling (optimization)
    this.bulletPool = [];
    this.enemyPool = [];
    this.droppedItems = []; // New array for tracking dropped blue spheres

    // Create enemy counter and FPS counter in the corner
    this.createUI();

    // Define a broad boundary containing your game area
    this.gameBounds = new THREE.Box3(
      new THREE.Vector3(-100, -100, -100),
      new THREE.Vector3(100, 100, 100)
    );
    // Instantiate Octree directly using the integrated class.
    this.dynamicOctree = new Octree(this.gameBounds);

    // Use the provided default world if available, else fallback
    this.world = defaultWorld || worlds[0];
    this.world.setup(this.scene, this.camera, this.renderer);

    // NEW: Introduce a flag to track if the player has started moving.
    this.hasPlayerMoved = false;
    this.currentCameraOffset = new THREE.Vector3(0, 0, 15);

    // Pre-allocate reusable vectors and boxes
    this.tempVector = new THREE.Vector3();
    this.bulletRange = new THREE.Box3();
    this.playerRange = new THREE.Box3();
    this.dropRange = new THREE.Box3();

    // Replace enemies array with EnemyCubeManager
    this.enemyManager = new EnemyCubeManager(100);
    this.scene.add(this.enemyManager.instancedMesh);

    // Define grid boundaries
    this.gridBoundary = {
        minX: -50,
        maxX: 50,
        minZ: -50,
        maxZ: 50
    };
    
    // Initialize the ability manager
    this.abilityManager = new AbilityManager(this);
    
    // Flag to track if we're using a custom trail from abilities
    this.hasCustomTrail = false;
    
    // Array to track particles for visual effects
    this.particles = [];
  }

  createUI() {
    // Create enemy counter element
    this.enemyCounterElement = document.createElement("div");
    this.enemyCounterElement.style.position = "fixed";
    this.enemyCounterElement.style.top = "10px";
    this.enemyCounterElement.style.left = "10px";
    this.enemyCounterElement.style.color = "#ffffff";
    this.enemyCounterElement.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    this.enemyCounterElement.style.padding = "5px";
    this.enemyCounterElement.style.fontFamily = "Arial, sans-serif";
    this.enemyCounterElement.style.zIndex = "1000";
    document.body.appendChild(this.enemyCounterElement);

    // Create FPS counter element, positioned just below the enemy counter
    this.fpsCounterElement = document.createElement("div");
    this.fpsCounterElement.style.position = "fixed";
    this.fpsCounterElement.style.top = "40px";
    this.fpsCounterElement.style.left = "10px";
    this.fpsCounterElement.style.color = "#ffffff";
    this.fpsCounterElement.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    this.fpsCounterElement.style.padding = "5px";
    this.fpsCounterElement.style.fontFamily = "Arial, sans-serif";
    this.fpsCounterElement.style.zIndex = "1000";
    // document.body.appendChild(this.fpsCounterElement);
  }

  initScene() {
    const loader = new THREE.FBXLoader();
    const self = this;
    loader.load(
      'src/Media/Models/Survivor.fbx',
      function (object) {
        const playerColor = self.world.sceneConfig.playerColor;
        object.traverse(function (child) {
          if (child.isMesh) {
            child.material = new THREE.MeshBasicMaterial({ 
              color: playerColor ,
            });
          }
        });
        self.player = object;
        self.player.scale.set(1, 1, 1);
        self.player.position.set(0, 0, 0);
        self.player.mixer = new THREE.AnimationMixer(self.player);
        if (object.animations && object.animations.length > 0) {
          self.player.animationAction = self.player.mixer.clipAction(object.animations[0]);
          self.player.animationAction.play();
          // Store the enemy animation clip for later use.
          self.enemyFBXAnimationClip = object.animations[0];
        }
        self.scene.add(self.player);
        // Hide the player model until the game officially starts.
        self.player.visible = false;
      },
      undefined,
      (error) => {
        console.error('Error loading Survivor.fbx model:', error);
      }
    );

    this.enemiesData = [];
  }

  shootBullet(direction) {
    let bullet;
    if (this.bulletPool.length > 0) {
      // Reuse a bullet from the pool
      bullet = this.bulletPool.pop();
      bullet.position.copy(this.player.position);
      bullet.velocity.copy(direction).multiplyScalar(this.bulletSpeed);
      bullet.life = 2;
      bullet.visible = true;
      if (!this.scene.children.includes(bullet)) {
        this.scene.add(bullet);
      }
    } else {
      // Create a new bullet if none exist in the pool
      const geometry = new THREE.SphereGeometry(0.1, 8, 8);
      const material = new THREE.MeshBasicMaterial({ color: this.world.sceneConfig.bulletColor });
      bullet = new THREE.Mesh(geometry, material);
      bullet.position.copy(this.player.position);
      bullet.velocity = direction.clone().multiplyScalar(this.bulletSpeed);
      bullet.life = 2;
      this.scene.add(bullet);
    }
    this.bullets.push(bullet);
  }

  updateBullets(delta) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.position.add(bullet.velocity.clone().multiplyScalar(delta));
      bullet.life -= delta;
      if (bullet.life <= 0) {
        // Recycle the bullet via object pool
        this.scene.remove(bullet);
        this.bullets.splice(i, 1);
        this.bulletPool.push(bullet);
      }
    }
  }

  spawnEnemy() {
    const spawnRadius = 20;
    const angle = Math.random() * Math.PI * 2;
    const distance = spawnRadius * (0.8 + 0.4 * Math.random());
    const spawnX = this.player.position.x + Math.cos(angle) * distance;
    const spawnZ = this.player.position.z + Math.sin(angle) * distance;

    const spawnPos = new THREE.Vector3(
        Math.max(Math.min(spawnX, this.gridBoundary.maxX), this.gridBoundary.minX),
        0,
        Math.max(Math.min(spawnZ, this.gridBoundary.maxZ), this.gridBoundary.minZ)
    );

    if (this.enemyManager.activeEnemies.size >= 100) {
        // Get and remove the oldest enemy
        const oldestEnemy = this.enemyManager.getOldestEnemy();
        if (oldestEnemy) {
            this.enemyManager.removeEnemy(oldestEnemy);
        }
        // Add new enemy at the spawn position
        this.enemyManager.addEnemy(spawnPos);
    } else {
        // Add new enemy
        this.enemyManager.addEnemy(spawnPos);
    }
  }

  restartGame() {
    // Trigger a full page reload using the cached version.
    // This will effectively reset the game.
    window.location.reload(false);
  }

  startEnemySpawner() {
    if (this.enemySpawner) clearInterval(this.enemySpawner);
    this.enemySpawner = setInterval(() => {
            this.spawnEnemy();
    }, 100);
  }

  start() {
    this.running = true;
    // Ensure bullets array is cleared initially
    this.bullets = [];
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  run() {
    this.startEnemySpawner();
    this.hasPlayerMoved = true;
    this.world.hasPlayerMoved = true;
    // Reveal the player model if it is still hidden.
    if (!this.player.visible) {
      this.player.visible = true;
    }
  }

  animate() {
    // CRITICAL: First check if the game is paused and return immediately
    if (this.isPaused === true) {
      console.log("Animation frame called while game is paused - ignoring");
      return;
    }
    
    // Don't run any game logic if the game is not running
    if (!this.running) {
      return;
    }
    
    // Schedule the next animation frame
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    
    // Get the time delta
    const delta = this.clock.getDelta();
    
    // Cache player and scene references
    const player = this.player;
    const scene = this.scene;
    
    // Make sure keys are accessible to the ability manager
    this.keys = keys;
    
    // Debug: Check if we have the OnchainTrail ability active
    this.debugTrailStatus();
    
    // Update the ability manager
    if (this.abilityManager) {
      this.abilityManager.update(delta);
    }
    
    // Update any particles for visual effects
    if (this.particles && this.particles.length > 0) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const particle = this.particles[i];
        
        // Call custom update function if it exists
        if (particle.update) {
          particle.update(delta);
        } else {
          // Default update behavior
          // Update position based on velocity
          if (particle.velocity) {
            particle.position.addScaledVector(particle.velocity, delta);
          }
          
          // Update lifetime
          particle.life -= delta;
          
          // Update opacity based on remaining life
          if (particle.material && particle.material.opacity) {
            particle.material.opacity = Math.min(1, particle.life * 2);
          }
        }
        
        // Remove dead particles
        if (particle.life <= 0) {
          scene.remove(particle);
          this.particles.splice(i, 1);
        }
      }
    }

    // Update animations only if player exists and has mixer
    if (player?.mixer) {
        player.mixer.update(delta);
    }

    // Pre-calculate player position for multiple uses
    const playerPosition = player.position;
    
    // Cache movement direction vector to avoid recreation
    if (!this.moveDirection) {
        this.moveDirection = new THREE.Vector3(0, 0, 0);
    }
    const moveDirection = this.moveDirection;
    moveDirection.set(0, 0, 0);

    if (keys.w) moveDirection.z -= 1;
    if (keys.s) moveDirection.z += 1;
    if (keys.d) moveDirection.x += 1;
    if (keys.a) moveDirection.x -= 1;

    if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();
        
        // Cache new position calculation
        if (!this.newPosition) {
            this.newPosition = new THREE.Vector3();
        }
        const newPosition = this.newPosition;
        newPosition.copy(playerPosition);
        newPosition.x += moveDirection.x * this.moveSpeed * delta;
        newPosition.z += moveDirection.z * this.moveSpeed * delta;

        // Apply grid boundaries
        const gridBoundary = {
            minX: -50,
            maxX: 50,
            minZ: -50,
            maxZ: 50
        };

        newPosition.x = Math.max(gridBoundary.minX, Math.min(gridBoundary.maxX, newPosition.x));
        newPosition.z = Math.max(gridBoundary.minZ, Math.min(gridBoundary.maxZ, newPosition.z));

        player.position.copy(newPosition);

        // Optimize rotation calculation
        const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
        const currentRotation = player.rotation.y;
        let deltaRotation = targetRotation - currentRotation;
        
        // Normalize rotation delta
        if (deltaRotation > Math.PI) deltaRotation -= 2 * Math.PI;
        if (deltaRotation < -Math.PI) deltaRotation += 2 * Math.PI;
        
        player.rotation.y += deltaRotation * 10 * delta;

        // Handle animation state
        const animationAction = player.animationAction;
        if (animationAction?.paused) {
            animationAction.paused = false;
            if (!animationAction.isRunning()) {
                animationAction.play();
            }
        }
    } else if (player.animationAction) {
        player.animationAction.paused = true;
    }

    // Update enemies and octree
    this.dynamicOctree.clear(); // Clear the octree for this frame
    let closestEnemy = null;
    let closestDistanceSq = Infinity;

    // Update enemy instances through EnemyManager only if updateEnemies is true
    if (this.updateEnemies) {
      this.enemyManager.update(delta, this.player.position);
    }

    // Get all active enemies for octree and closest enemy detection
    const activeEnemies = this.enemyManager.getActiveEnemies();
    for (const enemy of activeEnemies) {
        this.dynamicOctree.insert(enemy.position, enemy);
        
        const dSq = enemy.position.distanceToSquared(this.player.position);
        if (dSq < closestDistanceSq) {
            closestDistanceSq = dSq;
            closestEnemy = enemy;
        }
    }

    // Auto-shoot logic
    if (closestEnemy && this.shootCooldown <= 0) {
        this.tempVector.subVectors(closestEnemy.position, this.player.position).normalize();
        this.shootBullet(this.tempVector);
        this.shootCooldown = 2;
    }
    this.shootCooldown = Math.max(0, this.shootCooldown - delta);

    this.updateBullets(delta);

    // Collision detection: Player vs. Enemy
    this.playerRange.setFromCenterAndSize(
        this.player.position,
        new THREE.Vector3(1, 1, 1)
    );
    
    const collidingEnemies = this.dynamicOctree.query(this.playerRange);
    for (const enemy of collidingEnemies) {
        if (!enemy.active) continue;
        
        if (enemy.position.distanceToSquared(this.player.position) < 1) {
            console.log("Enemy collided with player!");
            this.restartGame();
            return;
        }
    }

    // Collision detection: Bullet vs. Enemy
    const bulletCollisionThreshold = 0.5;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
        const bullet = this.bullets[i];
        this.bulletRange.setFromCenterAndSize(
            bullet.position,
            new THREE.Vector3(bulletCollisionThreshold, bulletCollisionThreshold, bulletCollisionThreshold)
        );
        
        const enemiesHit = this.dynamicOctree.query(this.bulletRange);
        for (const enemy of enemiesHit) {
            if (!enemy.active) continue;
            
            if (bullet.position.distanceToSquared(enemy.position) < 0.25) {
                this.handleEnemyDeath(enemy, bullet, i);
                break;
            }
        }
    }

    // Handle dropped items using the same octree approach
    const dropOctree = new Octree(this.gameBounds);
    this.droppedItems.forEach(drop => dropOctree.insert(drop.position, drop));
    
    this.dropRange.setFromCenterAndSize(
        this.player.position,
        new THREE.Vector3(1, 1, 1)
    );
    
    const dropsCollected = dropOctree.query(this.dropRange);
    for (const drop of dropsCollected) {
        console.log("Player picked up a drop!");
        
        // Remove the drop from the scene
        this.scene.remove(drop);
        const index = this.droppedItems.indexOf(drop);
        if (index !== -1) {
            this.droppedItems.splice(index, 1);
        }
        
        // Add a random ability to the player
        this.addRandomAbility();
        
        // Create a visual effect for the pickup
        this.createPickupEffect(this.player.position);
        
        // Break after one drop to avoid multiple pickups at once
        break;
    }

    // Update camera offset based on player movement
    let desiredOffset;
    if (this.hasPlayerMoved) {
      desiredOffset = new THREE.Vector3(0, 10, 10);
    } else {
      desiredOffset = new THREE.Vector3(0, 0, 15);
    }
    this.currentCameraOffset.lerp(desiredOffset, 0.01);

    // Update the camera position based on the player's position plus the current camera offset
    const targetPosition = this.player.position.clone().add(this.currentCameraOffset);
    this.camera.position.lerp(targetPosition, 0.1);
    this.camera.lookAt(this.player.position);

    // Update UI counters
    // this.enemyCounterElement.innerText = `❤️ Enemies: ${this.enemies.length}`;
    //this.fpsCounterElement.innerText = `FPS: ${Math.round(1 / delta)}`;

    // Update your main screen components
    this.world.update(this.scene, this.camera, this.renderer, delta);

    // Use composer instead of direct renderer
    this.composer.render();

    // At the end of your animate loop (after updating other objects):
    this.droppedItems.forEach(drop => {
      // Increase the Y rotation based on the spin speed and delta time
      drop.rotation.y += drop.userData.spinSpeed * delta;
    });
  }

  // New helper method to handle enemy death
  handleEnemyDeath(enemy, bullet, bulletIndex) {
    console.log("Bullet collided with enemy!");
    
    // Remove enemy using the manager
    this.enemyManager.removeEnemy(enemy);
    
    // New drop looks like a card using a modified box geometry.
    const cardWidth = 0.5;
    const cardHeight = 0.75;
    const cardDepth = 0.05;

    // Create the box geometry. By default the geometry is centered at (0,0,0).
    const dropGeometry = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);

    // Translate the geometry so that its bottom (left-front) corner is at (0,0,0).
    // The default bottom corner is at (-cardWidth/2, -cardHeight/2, -cardDepth/2).
    // We translate by (cardWidth/2, cardHeight/2, cardDepth/2) so that corner moves to the origin.
    dropGeometry.translate(cardWidth / 2, cardHeight / 2, cardDepth / 2);

    // Create a basic material for the drop.
    const dropMaterial = new THREE.MeshBasicMaterial({ color: "yellow" });

    // Create the mesh.
    const drop = new THREE.Mesh(dropGeometry, dropMaterial);

    // Rotate the drop so that the pivot (the bottom corner) is the part touching the ground.
    drop.rotation.z = Math.PI / 4;
    drop.rotation.x = -Math.PI / 10;

    // Position the drop at the enemy's last location.
    drop.position.copy(enemy.position);

    // Assign a spin speed (adjust the value as needed).
    drop.userData.spinSpeed = 1.0; 

    // Add the drop to the scene and track it.
    this.scene.add(drop);
    this.droppedItems.push(drop);

    // Recycle bullet
    this.scene.remove(bullet);
    this.bullets.splice(bulletIndex, 1);
    this.bulletPool.push(bullet);
  }

  // Add a random ability to the player
  addRandomAbility() {
    // Get a random ability from the abilityTypes array
    const randomIndex = Math.floor(Math.random() * abilityTypes.length);
    const randomAbility = abilityTypes[randomIndex];
    
    console.log(`Adding random ability: ${randomAbility.title}`);
    
    // Convert the ability title to a key format that matches the abilityComponents keys
    let abilityKey;
    
    // Map the ability title to the corresponding key in abilityComponents
    switch(randomAbility.title) {
      case "Onchain Trail":
        abilityKey = "OnchainTrail";
        break;
      case "Frontrunning Bot":
        abilityKey = "FrontrunningBot";
        break;
      case "Debt Drown":
        abilityKey = "DebtDrown";
        break;
      default:
        // Fallback to a simple conversion if no direct mapping exists
        abilityKey = randomAbility.title.replace(/[^a-zA-Z0-9]/g, '');
    }
    
    console.log(`Mapped ability key: ${abilityKey}`);
    
    // Add the ability using the ability manager
    this.abilityManager.addAbility(abilityKey);
    
    // Show a notification about the new ability
    this.showAbilityNotification(randomAbility);
  }
  
  // Create a visual effect for ability pickup
  createPickupEffect(position) {
    // Create a burst of particles
    const particleCount = 20;
    const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00, // Yellow for ability pickup
      transparent: true,
      opacity: 0.8
    });
    
    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.copy(position);
      
      // Random velocity in all directions
      particle.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 3,
        (Math.random() - 0.5) * 3
      );
      
      particle.life = 1.0; // Longer lifetime for pickup effect
      particle.birth = this.clock.elapsedTime;
      
      this.scene.add(particle);
      
      // Add to particles array for updating
      if (!this.particles) this.particles = [];
      this.particles.push(particle);
    }
    
    // Add a flash effect
    const flashGeometry = new THREE.SphereGeometry(2, 16, 16);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5
    });
    
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    flash.scale.set(0.1, 0.1, 0.1);
    flash.life = 0.5;
    flash.birth = this.clock.elapsedTime;
    
    this.scene.add(flash);
    this.particles.push(flash);
    
    // Add a scaling animation to the flash
    flash.update = (delta) => {
      flash.scale.multiplyScalar(1.1);
      flash.material.opacity -= delta * 2;
    };
  }
  
  // Show a notification about the new ability
  showAbilityNotification(ability) {
    // Create a notification element
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.color = '#fff';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.style.zIndex = '1000';
    notification.style.textAlign = 'center';
    notification.style.transition = 'opacity 0.5s';
    
    // Add ability info including the image
    notification.innerHTML = `
      <div style="font-weight: bold; color: #ffcc00; margin-bottom: 5px;">New Ability Acquired!</div>
      <img src="${ability.thumbnail}" alt="${ability.title}" style="width: 100px; height: auto; margin-bottom: 5px;">
      <div style="font-size: 18px; margin-bottom: 5px;">${ability.title}</div>
      <div style="font-size: 14px;">${ability.description}</div>
    `;
    
    // Add to the document
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 3000);
  }

  // Debug method to check if the trail is working
  debugTrailStatus() {
    // Only run this check occasionally to avoid console spam
    if (!this._lastTrailDebug || (this.clock.elapsedTime - this._lastTrailDebug > 5)) {
      this._lastTrailDebug = this.clock.elapsedTime;
      
      console.log("Trail status check:");
      console.log("- hasCustomTrail flag:", this.hasCustomTrail);
      
      if (this.abilityManager) {
        console.log("- Active abilities:", this.abilityManager.getActiveAbilityNames());
        
        if (this.abilityManager.hasAbility("OnchainTrail")) {
          const trailAbility = this.abilityManager.activeAbilities.get("OnchainTrail");
          console.log("- OnchainTrail active with", trailAbility.trailPieces.length, "trail pieces");
        }
      }
      
      // Check if keys are being detected
      console.log("- Movement keys:", 
        (this.keys.w ? "W " : "") + 
        (this.keys.a ? "A " : "") + 
        (this.keys.s ? "S " : "") + 
        (this.keys.d ? "D " : "") || "None pressed"
      );
    }
  }
}