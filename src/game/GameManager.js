import { getScene, getCamera, getRenderer, getComposer } from './Renderer.js';
import { keys } from '../input/Joystick.js';
import { Enemy } from './Enemy.js';
import { worlds } from './worldsConfig.js';

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
    const gameBounds = new THREE.Box3(
      new THREE.Vector3(-1000, -1000, -1000),
      new THREE.Vector3(1000, 1000, 1000)
    );
    // Instantiate Octree directly using the integrated class.
    this.octree = new Octree(gameBounds);

    // Use the provided default world if available, else fallback
    this.world = defaultWorld || worlds[0];
    this.world.setup(this.scene, this.camera, this.renderer);

    // NEW: Introduce a flag to track if the player has started moving.
    this.hasPlayerMoved = false;
    this.currentCameraOffset = new THREE.Vector3(0, 0, 15);
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
      'Media/Models/Survivor.fbx',
      function (object) {
        const playerColor = self.world.sceneConfig.playerColor;
        object.traverse(function (child) {
          if (child.isMesh) {
            child.material = new THREE.MeshBasicMaterial({ 
              color: playerColor 
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
   
       // Current spawn logic: compute a random offset around the player.
       const offsetX = (Math.random() - 0.5) * 20; // random value between -10 and 10
       const offsetZ = (Math.random() - 0.5) * 20;
       let spawnPos = new THREE.Vector3(
        spawnX,
        this.player.position.y,
        spawnZ
       );
   
       // Determine grid boundary. Use gridSize defined on the world if available, else default to 100.
       const gridSize = this.world.gridSize !== undefined ? this.world.gridSize : 100;
       const halfSize = gridSize / 2;
   
       // Clamp the spawn position so enemies never spawn outside the grid.
       spawnPos.x = Math.max(Math.min(spawnPos.x, halfSize), -halfSize);
       spawnPos.z = Math.max(Math.min(spawnPos.z, halfSize), -halfSize);
   
    const spawnPosition = new THREE.Vector3(spawnPos.x, this.player.position.y, spawnPos.z);
    let enemy;
    if (this.enemyPool.length > 0) {
      enemy = this.enemyPool.pop();
      if (!enemy.mesh) {
        enemy = new Enemy(spawnPosition,  this.world.sceneConfig.enemyColor);
      } else {
        enemy.mesh.position.copy(spawnPosition);
      }
      enemy.active = true;
      if (!this.scene.children.includes(enemy.mesh)) {
        this.scene.add(enemy.mesh);
      }
    } else {
      enemy = new Enemy(spawnPosition, this.world.sceneConfig.enemyColor);
      enemy.active = true;
      this.scene.add(enemy.mesh);
    }
    this.enemies.push(enemy);
    this.octree.insert(enemy.mesh.position, enemy);
  }

  restartGame() {
    // Trigger a full page reload using the cached version.
    // This will effectively reset the game.
    window.location.reload(false);
  }

  startEnemySpawner() {
    if (this.enemySpawner) clearInterval(this.enemySpawner);
    this.enemySpawner = setInterval(() => {
      if (this.enemies.length < 100) {
        this.spawnEnemy();
      } else {
        this.respawnOldestEnemy();
      }
    }, 100);
  }

  respawnOldestEnemy() {
    // Remove the oldest enemy from the array.
    const enemy = this.enemies.shift();

    // Calculate a new spawn position (using similar logic as in spawnEnemy)
    const spawnRadius = 20;
    const angle = Math.random() * Math.PI * 2;
    const distance = spawnRadius * (0.8 + 0.4 * Math.random());
    const spawnX = this.player.position.x + Math.cos(angle) * distance;
    const spawnZ = this.player.position.z + Math.sin(angle) * distance;
    let spawnPos = new THREE.Vector3(spawnX, this.player.position.y, spawnZ);

    // Clamp the spawn position to the grid boundaries
    const gridSize = this.world.gridSize !== undefined ? this.world.gridSize : 100;
    const halfSize = gridSize / 2;
    spawnPos.x = Math.max(Math.min(spawnPos.x, halfSize), -halfSize);
    spawnPos.z = Math.max(Math.min(spawnPos.z, halfSize), -halfSize);

    // Update the enemy's position and state
    enemy.mesh.position.copy(spawnPos);
    enemy.active = true;
    if (!this.scene.children.includes(enemy.mesh)) {
      this.scene.add(enemy.mesh);
    }

    // Update the octree with the enemy's new position
    this.octree.insert(enemy.mesh.position, enemy);

    // Push the enemy back to the end to keep the order updated
    this.enemies.push(enemy);
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
    if (!this.running) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();

    // Update animations
    if (this.player && this.player.mixer) {
      this.player.mixer.update(delta);
    }

    // Calculate movement direction (movement along the XZ plane)
    const moveDirection = new THREE.Vector3(0, 0, 0);

    if (keys.w) moveDirection.z -= 1;
    if (keys.s) moveDirection.z += 1;
    if (keys.d) moveDirection.x += 1;
    if (keys.a) moveDirection.x -= 1;

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();

      // Update the player's position on the XZ plane.
      const newPosition = this.player.position.clone();
      newPosition.x += moveDirection.x * this.moveSpeed * delta;
      newPosition.z += moveDirection.z * this.moveSpeed * delta;

      // Define grid boundaries
      const gridBoundary = {
        minX: -50,
        maxX: 50,
        minZ: -50,
        maxZ: 50
      };

      // Clamp the position within the grid boundaries
      newPosition.x = Math.max(gridBoundary.minX, Math.min(gridBoundary.maxX, newPosition.x));
      newPosition.z = Math.max(gridBoundary.minZ, Math.min(gridBoundary.maxZ, newPosition.z));

      this.player.position.copy(newPosition);

      // Calculate target rotation and smoothly interpolate toward it.
      const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
      const rotationSpeed = 10;
      const currentRotation = this.player.rotation.y;
      let deltaRotation = targetRotation - currentRotation;
      if (deltaRotation > Math.PI) deltaRotation -= 2 * Math.PI;
      if (deltaRotation < -Math.PI) deltaRotation += 2 * Math.PI;
      this.player.rotation.y += deltaRotation * rotationSpeed * delta;

      // Unpause the player animation.
      if (this.player.animationAction) {
        this.player.animationAction.paused = false;
        if (!this.player.animationAction.isRunning()) {
          this.player.animationAction.play();
        }
      }
    } else {
      // If no movement, pause the animation.
      if (this.player.animationAction) {
        this.player.animationAction.paused = true;
      }
    }

    // Update enemies octree and handle collisions
    const gameBounds = new THREE.Box3(
      new THREE.Vector3(-1000, -1000, -1000),
      new THREE.Vector3(1000, 1000, 1000)
    );
    const dynamicOctree = new Octree(gameBounds);
    this.enemies.forEach(enemy => {
      if (enemy.active) {
        enemy.update(delta, this.player.position);
        dynamicOctree.insert(enemy.mesh.position, enemy);
      }
    });

    // Auto-shoot at the closest enemy
    if (this.enemies.length > 0 && this.shootCooldown <= 0) {
      let closestEnemy = null;
      let closestDistanceSq = Infinity;
      this.enemies.forEach(enemy => {
        const dSq = enemy.mesh.position.distanceToSquared(this.player.position);
        if (dSq < closestDistanceSq) {
          closestDistanceSq = dSq;
          closestEnemy = enemy;
        }
      });
      if (closestEnemy) {
        const autoShootDirection = new THREE.Vector3().subVectors(closestEnemy.mesh.position, this.player.position).normalize();
        this.shootBullet(autoShootDirection);
        this.shootCooldown = 2;
      }
    }
    if (this.shootCooldown > 0) {
      this.shootCooldown -= delta;
    }

    this.updateBullets(delta);

    // Collision detection: Player vs. Enemy
    const querySize = 2;
    const playerRange = new THREE.Box3().setFromCenterAndSize(this.player.position, new THREE.Vector3(querySize, querySize, querySize));
    const collidingEnemies = dynamicOctree.query(playerRange);
    collidingEnemies.forEach(enemy => {
      if (enemy.mesh.position.distanceToSquared(this.player.position) < 1) {
        console.log("Enemy collided with player!");
        this.restartGame();
        return;
      }
    });

    // Collision detection: Bullet vs. Enemy
    const bulletCollisionThreshold = 0.5;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const bulletRange = new THREE.Box3().setFromCenterAndSize(bullet.position, new THREE.Vector3(bulletCollisionThreshold, bulletCollisionThreshold, bulletCollisionThreshold));
      const enemiesHit = dynamicOctree.query(bulletRange);
      for (let enemy of enemiesHit) {
        if (enemy.mesh && bullet.position.distanceToSquared(enemy.mesh.position) < 0.25) {
          console.log("Bullet collided with enemy!");
          // Remove enemy and add a blue drop
          this.scene.remove(enemy.mesh);
          enemy.active = false;
          const enemyIndex = this.enemies.indexOf(enemy);
          if (enemyIndex !== -1) {
            this.enemies.splice(enemyIndex, 1);
          }
          this.enemyPool.push(enemy);

          // Create blue sphere drop (small bonus)
          const dropGeometry = new THREE.SphereGeometry(0.2, 8, 8);
          const dropMaterial = new THREE.MeshBasicMaterial({ color: "yellow" });
          const drop = new THREE.Mesh(dropGeometry, dropMaterial);
          drop.position.copy(enemy.mesh.position);
          this.scene.add(drop);
          this.droppedItems.push(drop);

          // Remove/recycle bullet
          this.scene.remove(bullet);
          this.bullets.splice(i, 1);
          this.bulletPool.push(bullet);
          break;
        }
      }
    }

    // Check collision: Player vs. Blue Sphere Drops
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const drop = this.droppedItems[i];
      if (drop.position.distanceToSquared(this.player.position) < 1) { 
        console.log("Player picked up a drop!");
        this.scene.remove(drop);
        this.droppedItems.splice(i, 1);
        // (Optionally, grant a bonus to the player here.)
      }
    }

    // Create a trail piece for the player every 0.2 seconds
    this.trailTimer += delta;
    const trailInterval = 0.2;
    if (this.trailTimer >= trailInterval) {
      const footSize = { width: 0.05, length: 0.34 };
      const footGeometry = new THREE.Shape();
      footGeometry.moveTo(-footSize.width, -footSize.length / 2);
      footGeometry.lineTo(-footSize.width, footSize.length / 2);
      footGeometry.quadraticCurveTo(0, footSize.length / 2 + 0.1, footSize.width, footSize.length / 2);
      footGeometry.lineTo(footSize.width, -footSize.length / 2);
      footGeometry.quadraticCurveTo(0, -footSize.length / 2 - 0.1, -footSize.width, -footSize.length / 2);

      const footShape = new THREE.ShapeGeometry(footGeometry);
      // Use the world's playerColor for the trail color
      const trailMaterial = new THREE.MeshBasicMaterial({
        color: this.world.sceneConfig.playerColor,
        transparent: true,
        opacity: 0.6
      });

      const trailPiece = new THREE.Mesh(footShape, trailMaterial);
      trailPiece.position.copy(this.player.position);
      trailPiece.rotation.x = -Math.PI / 2;
      trailPiece.rotation.z = this.player.rotation.y + (this.trailPieces.length % 2 ? Math.PI / 6 : -Math.PI / 6);
      trailPiece.position.y += 0.01;
      trailPiece.birth = this.clock.elapsedTime;
      this.scene.add(trailPiece);
      this.trailPieces.push(trailPiece);
      this.trailTimer = 0;
    }

    // Remove trail pieces older than 2 seconds
    const trailLifetime = 2;
    for (let i = this.trailPieces.length - 1; i >= 0; i--) {
      const piece = this.trailPieces[i];
      const age = this.clock.elapsedTime - piece.birth;
      if (age > trailLifetime) {
        this.scene.remove(piece);
        this.trailPieces.splice(i, 1);
      } else {
        piece.material.opacity = 0.6 * (1 - age / trailLifetime);
      }
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
    this.enemyCounterElement.innerText = `❤️ Enemies: ${this.enemies.length}`;
    this.fpsCounterElement.innerText = `FPS: ${Math.round(1 / delta)}`;

    // Update your main screen components
    this.world.update(this.scene, this.camera, this.renderer, delta);

    // Use composer instead of direct renderer
    this.composer.render();
  }

  updateEnemiesInstanced(delta) {
    // Update each enemy in our data array.
    for (let i = 0; i < this.enemiesData.length; i++) {
      let enemy = this.enemiesData[i];
      enemy.animationAction = this.player.mixer.clipAction(this.enemyFBXAnimationClip);
      if (enemy.animationAction && !enemy.animationAction.isRunning()) {
        enemy.animationAction.play();
        enemy.mesh.mixer.update(delta);
      }
      // Simple movement toward the player:
      const direction = new THREE.Vector3().subVectors(this.player.position, enemy.position).normalize();
      enemy.position.addScaledVector(direction, enemy.movementspeed * delta);
      enemy.rotation.y = Math.atan2(direction.x, direction.z);

      // Build an instance matrix from the enemy data.
      const quaternion = new THREE.Quaternion().setFromEuler(enemy.rotation);
      const matrix = new THREE.Matrix4();
      matrix.compose(enemy.position, quaternion, new THREE.Vector3(1, 1, 1));
      this.enemyInstancedMesh.setMatrixAt(i, matrix);
    }
    this.enemyInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  swapWorld(newWorldConfig) {
    // Create a fresh copy of the world config to avoid stale state
    const freshWorldConfig = {
        ...baseWorldConfig,  // Include the base world methods
        ...newWorldConfig,
        sceneConfig: { ...newWorldConfig.sceneConfig },
        components: [...newWorldConfig.components]
    };

    this.world = freshWorldConfig;
    
    // Clear the existing scene.
    while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0]);
    }
    
    // Reset game state arrays and pools.
    this.enemies = [];
    this.bullets = [];
    this.bulletPool = [];
    this.enemyPool = [];
    this.droppedItems = [];
    this.trailPieces = [];
    
    // Set up the new world which will initialize all components.
    this.world.setup(this.scene, this.camera, this.renderer);
    
    // Reinitialize scene (e.g., to reload the player model)
    this.initScene();
    
    // Reposition the camera.
    this.camera.position.set(15, 10, 15);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    
    // Finally, force a render update.
    if (this.composer) {
        this.composer.render();
    } else {
        this.renderer.render(this.scene, this.camera);
    }
  }
}