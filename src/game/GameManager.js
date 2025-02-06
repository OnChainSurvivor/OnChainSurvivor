import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
import { getScene, getCamera, getRenderer } from './Renderer.js';
import { keys } from '../input/Joystick.js';
import { Enemy } from './Enemy.js';

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
  constructor() {
    this.scene = getScene();
    this.camera = getCamera();
    this.renderer = getRenderer();
    this.clock = new THREE.Clock();
    this.cube = null;
    // Increase player movement speed by 2: original value 6 is now 8.
    this.moveSpeed = 10;
    // Bullet properties
    this.bulletSpeed = 10;
    this.shootCooldown = 0;
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

    // Define a paused flag (default: false)
    this.isPaused = false;

    // Create enemy counter and FPS counter in the corner
    this.createUI();

    // Define a broad boundary containing your game area
    const gameBounds = new THREE.Box3(
      new THREE.Vector3(-1000, -1000, -1000),
      new THREE.Vector3(1000, 1000, 1000)
    );
    // Instantiate Octree directly using the integrated class.
    this.octree = new Octree(gameBounds);
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
    document.body.appendChild(this.fpsCounterElement);
  }

  initScene() {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);

    // Create an instanced mesh for enemies. Define the enemy geometry and material.
    const enemyGeometry = new THREE.BoxGeometry(1, 1, 1); // Replace with your enemy geometry
    const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    // For example, support up to 10000 enemies
    this.enemyInstancedMesh = new THREE.InstancedMesh(enemyGeometry, enemyMaterial, 10000);
    // Mark the matrix as dynamic so we can update it each frame.
    this.enemyInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.enemyInstancedMesh);

    // Instead of using individual enemy objects containing meshes,
    // maintain a data array for enemy properties.
    this.enemiesData = []; // Each enemy: { position, rotation, movementspeed, active }
  }

  shootBullet(direction) {
    let bullet;
    if (this.bulletPool.length > 0) {
      // Reuse a bullet from the pool
      bullet = this.bulletPool.pop();
      bullet.position.copy(this.cube.position);
      bullet.velocity.copy(direction).multiplyScalar(this.bulletSpeed);
      bullet.life = 2;
      bullet.visible = true;
      if (!this.scene.children.includes(bullet)) {
        this.scene.add(bullet);
      }
    } else {
      // Create a new bullet if none exist in the pool
      const geometry = new THREE.SphereGeometry(0.1, 8, 8);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      bullet = new THREE.Mesh(geometry, material);
      bullet.position.copy(this.cube.position);
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
    const spawnX = this.cube.position.x + Math.cos(angle) * distance;
    const spawnY = this.cube.position.y + Math.sin(angle) * distance;
    const spawnPosition = new THREE.Vector3(spawnX, spawnY, this.cube.position.z);
    let enemy;
    if (this.enemyPool.length > 0) {
      enemy = this.enemyPool.pop();
      // Make sure the recycled enemy has a mesh; if not, recreate it.
      if (!enemy.mesh) {
        enemy = new Enemy(spawnPosition);
      } else {
        enemy.mesh.position.copy(spawnPosition);
      }
      enemy.active = true;
      // Always add the enemy's mesh back to the scene.
      if (!this.scene.children.includes(enemy.mesh)) {
        this.scene.add(enemy.mesh);
      }
    } else {
      enemy = new Enemy(spawnPosition);
      enemy.active = true;
      this.scene.add(enemy.mesh);
    }
    this.enemies.push(enemy);
    // Insert each enemy's position into the octree. (Assuming each enemy is stored in this.enemies with a .mesh.position.)
    this.octree.insert(enemy.mesh.position, enemy);
  }

  restartGame() {
    // Clear enemy spawner if applicable
    if (this.enemySpawner) {
      clearInterval(this.enemySpawner);
      this.enemySpawner = null;
    }
    // Remove all enemies and bullets from the scene and recycle them
    this.enemies.forEach(enemy => {
      this.scene.remove(enemy.mesh);
      enemy.active = false;
      this.enemyPool.push(enemy);
    });
    this.enemies = [];
    this.bullets.forEach(bullet => {
      this.scene.remove(bullet);
      this.bulletPool.push(bullet);
    });
    this.bullets = [];
    // Reset player position
    this.cube.position.set(0, 0, 0);
    this.shootCooldown = 0;
    console.log("Game restarted!");
    // Restart enemy spawner
    this.startEnemySpawner();
  }

  startEnemySpawner() {
    // Spawn an enemy every 50ms, up to a maximum of 10000 enemies
    if (this.enemySpawner) clearInterval(this.enemySpawner);
    this.enemySpawner = setInterval(() => {
      if (this.enemies.length < 10000 && !this.isPaused) {
        this.spawnEnemy();
      }
    }, 50);
  }

  start() {
    this.running = true;
    this.startEnemySpawner();
    // Ensure bullets array is cleared initially
    this.bullets = [];
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  animate() {
    if (!this.running) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();

    // Update player movement via keys (WASD)
    if (keys.w) {
      this.cube.position.y += this.moveSpeed * delta;
    }
    if (keys.s) {
      this.cube.position.y -= this.moveSpeed * delta;
    }
    if (keys.a) {
      this.cube.position.x -= this.moveSpeed * delta;
    }
    if (keys.d) {
      this.cube.position.x += this.moveSpeed * delta;
    }

    // Update enemy movement for each active enemy
    this.enemies.forEach(enemy => {
      if (enemy.active) {
        enemy.update(delta, this.cube.position);
      }
    });

    // Auto-shoot at the closest enemy
    if (this.enemies.length > 0 && this.shootCooldown <= 0) {
      let closestEnemy = null;
      let closestDistanceSq = Infinity;
      this.enemies.forEach(enemy => {
        const dSq = enemy.mesh.position.distanceToSquared(this.cube.position);
        if (dSq < closestDistanceSq) {
          closestDistanceSq = dSq;
          closestEnemy = enemy;
        }
      });
      if (closestEnemy) {
        const autoShootDirection = new THREE.Vector3().subVectors(closestEnemy.mesh.position, this.cube.position).normalize();
        this.shootBullet(autoShootDirection);
        this.shootCooldown = 0.1;
      }
    }
    if (this.shootCooldown > 0) {
      this.shootCooldown -= delta;
    }

    this.updateBullets(delta);

    // Rebuild a dynamic octree based on updated enemy positions
    const gameBounds = new THREE.Box3(
      new THREE.Vector3(-1000, -1000, -1000),
      new THREE.Vector3(1000, 1000, 1000)
    );
    const dynamicOctree = new Octree(gameBounds);
    this.enemies.forEach(enemy => {
      dynamicOctree.insert(enemy.mesh.position, enemy);
    });

    // Collision detection for player vs. enemy
    const querySize = 2;
    const playerRange = new THREE.Box3().setFromCenterAndSize(this.cube.position, new THREE.Vector3(querySize, querySize, querySize));
    const collidingEnemies = dynamicOctree.query(playerRange);
    if (collidingEnemies.length > 0) {
      collidingEnemies.forEach(enemy => {
        if (enemy.mesh.position.distanceToSquared(this.cube.position) < 1) {
          console.log("Enemy collided with player!");
          this.restartGame();
          return;
        }
      });
    }

    // Bullet vs. enemy collision detection
    const bulletCollisionThreshold = 0.5; // Adjust as needed (collision radius)
    // Iterate in reverse order for safe removal
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const bulletRange = new THREE.Box3().setFromCenterAndSize(bullet.position, new THREE.Vector3(bulletCollisionThreshold, bulletCollisionThreshold, bulletCollisionThreshold));
      const enemiesHit = dynamicOctree.query(bulletRange);
      for (let enemy of enemiesHit) {
        if (bullet.position.distanceToSquared(enemy.mesh.position) < 0.25) { // 0.25 is the squared collision threshold
          console.log("Bullet collided with enemy!");
          // Remove or recycle enemy
          this.scene.remove(enemy.mesh);
          enemy.active = false;
          const enemyIndex = this.enemies.indexOf(enemy);
          if (enemyIndex !== -1) {
            this.enemies.splice(enemyIndex, 1);
          }
          this.enemyPool.push(enemy);
          // Remove or recycle bullet
          this.scene.remove(bullet);
          this.bullets.splice(i, 1);
          this.bulletPool.push(bullet);
          break; // Break out of bullet loop if collision handled
        }
      }
    }

    // Create a trail piece for the player every 0.2 seconds
    this.trailTimer += delta;
    const trailInterval = 0.2;
    if (this.trailTimer >= trailInterval) {
      const trailGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const trailMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const trailPiece = new THREE.Mesh(trailGeometry, trailMaterial);
      trailPiece.position.copy(this.cube.position);
      trailPiece.birth = this.clock.elapsedTime;
      this.scene.add(trailPiece);
      this.trailPieces.push(trailPiece);
      this.trailTimer = 0;
    }

    // Remove trail pieces older than 2 seconds
    const trailLifetime = 2;
    for (let i = this.trailPieces.length - 1; i >= 0; i--) {
      const piece = this.trailPieces[i];
      if (this.clock.elapsedTime - piece.birth > trailLifetime) {
        this.scene.remove(piece);
        this.trailPieces.splice(i, 1);
      }
    }

    // Update camera (smooth follow)
    const offset = new THREE.Vector3(0, 15, 50);
    const targetPosition = this.cube.position.clone().add(offset);
    this.camera.position.lerp(targetPosition, 0.1);
    this.camera.lookAt(this.cube.position);

    // Update UI counters
    this.enemyCounterElement.innerText = `Enemies: ${this.enemies.length}`;
    this.fpsCounterElement.innerText = `FPS: ${Math.round(1 / delta)}`;
    this.renderer.render(this.scene, this.camera);
  }

  updateEnemiesInstanced(delta) {
    // Update each enemy in our data array.
    for (let i = 0; i < this.enemiesData.length; i++) {
      let enemy = this.enemiesData[i];
      // Simple movement toward the player:
      const direction = new THREE.Vector3().subVectors(this.cube.position, enemy.position).normalize();
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
}